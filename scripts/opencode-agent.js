#!/usr/bin/env node
/**
 * Headless OpenCode runner — replaces `claude -p ... --json-schema ...` for
 * the 3-stage pipeline, now that the provider is Cerebras instead of
 * Anthropic.
 *
 * Why this exists instead of driving OpenCode's SDK directly: OpenCode's own
 * schema-constrained output (`session.prompt` with `format: {type:
 * "json_schema"}`) is a real, documented feature, but as of opencode-ai
 * 1.18.16 it 500s server-side on every attempt (confirmed against both a
 * manually-started server and the SDK's own bundled createOpencode() helper,
 * so it isn't a version-mismatch issue on this end). Until that's fixed
 * upstream, this drives the plain `opencode run --format json` CLI path
 * (verified to build correct real requests) and enforces the JSON schema
 * itself with ajv, retrying with a corrective prompt on failure — the same
 * validation guarantee `--json-schema` gave, just applied client-side
 * instead of server-side.
 *
 * Usage:
 *   node scripts/opencode-agent.js \
 *     --prompt-file <path> --schema-file <path> --agent <opencode-agent-name> \
 *     --model cerebras/gpt-oss-120b[,cerebras/gemma-4-31b,...] \
 *     [--append-system-prompt-file <path>] [--max-retries 3]
 *   (context piped via stdin is prepended to the prompt, same convention as
 *   the old `cat context.json | claude -p ...` invocations)
 *
 * --model accepts a comma-separated list — tried in order, failing over to
 * the next on any error (network, rate-limit, invalid output that still
 * fails validation after retries). This is the primary+failover mechanism.
 *
 * Output on stdout: {"structured_output": <schema-valid object>,
 * "total_cost_usd": <number>, "model_used": "<provider/model>"} — same shape
 * the workflow's `jq '.structured_output'` / `jq -r '.total_cost_usd'` calls
 * already expect from claude -p's --output-format json, so the surrounding
 * workflow jq logic didn't need to change.
 */

import { spawnSync } from "child_process";
import { readFileSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import Ajv from "ajv";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function readStdin() {
  try {
    if (process.stdin.isTTY) return "";
    return readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

// opencode run --format json streams newline-delimited event objects (the
// same Message/Part shapes the server API uses). Parsing is defensive on
// purpose: this couldn't be verified against a live response in the
// environment this was built in (egress to every model host was blocked
// there), so if the real event shape differs, the broad-fallback regex
// extraction below is the safety net rather than a hard failure.
function extractTextAndCost(stdout) {
  let text = "";
  let cost = 0;
  const lines = stdout.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    let evt;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }
    // Cost. A real run reports this per step, as
    // {"type":"step_finish","part":{...,"cost":0.017}} — the earlier
    // assistant-message shapes below never actually matched a live stream,
    // which is why every previous run logged cost_usd=0. Sum the steps.
    if (evt?.type === "step_finish" && typeof evt.part?.cost === "number") {
      cost += evt.part.cost;
    } else if (evt?.role === "assistant" && typeof evt.cost === "number") {
      cost = evt.cost;
    } else if (evt?.info?.role === "assistant" && typeof evt.info.cost === "number") {
      cost = evt.info.cost;
    }
    // TextPart-shaped event.
    if (evt?.type === "text" && typeof evt.text === "string") {
      text += evt.text;
    }
    if (evt?.part?.type === "text" && typeof evt.part.text === "string") {
      text += evt.part.text;
    }
  }
  // No usable fallback here on purpose: a previous attempt at one globbed
  // "first { to last }" across the entire event stream, which just returns
  // the whole transcript and can never parse. If the text parts above
  // matched nothing, the caller's error path (which dumps real output) is
  // more useful than a guess.
  return { text, cost };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Real failures seen on live runs against Cerebras: its free tier hit
// "Tokens per minute limit exceeded" on nearly every attempt — a SINGLE
// websearch result (one article's full text) was enough on its own to
// trip it on the very next call. This is a per-minute account-wide quota,
// not a per-request one — a 30s wait doesn't reliably clear a 60s window,
// so this waits out the full window.
function isRateLimitError(errorText) {
  return /token_quota_exceeded|tokens per minute|rate.?limit|429|ContextOverflowError/i.test(errorText || "");
}

// Real failure: gpt-oss-120b produced otherwise-valid JSON but overshot a
// maxLength constraint by a few characters, forcing a retry that then hit
// the rate limit and failed the whole run. Models count characters
// imprecisely, so give them margin below the hard cap rather than the
// exact number, for every maxLength in the schema (not just this one
// field — research/script schemas have the same shape of constraint).
function lengthReminders(schema, seen = new Set()) {
  const lines = [];
  if (!schema || typeof schema !== "object" || seen.has(schema)) return lines;
  seen.add(schema);
  if (schema.properties) {
    for (const [key, def] of Object.entries(schema.properties)) {
      if (typeof def?.maxLength === "number") {
        const margin = Math.max(1, Math.floor(def.maxLength * 0.15));
        lines.push(`- "${key}": stay under ${def.maxLength - margin} characters (hard max is ${def.maxLength} — leave margin, you count characters imprecisely).`);
      }
      lines.push(...lengthReminders(def, seen));
    }
  }
  if (schema.items) lines.push(...lengthReminders(schema.items, seen));
  return lines;
}

function tryParse(s) {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

// Ordered fallbacks, cheapest and most-likely-correct first. Every failure
// here costs a full retry against a rate-limited account, so it's worth
// being generous about how the model wrapped its JSON.
function extractJson(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;

  // 1. The model complied exactly: the whole response is the object.
  const whole = tryParse(trimmed);
  if (whole) return whole;

  // 2. Fenced block(s). Prefer the LAST one — when a model narrates first
  // and answers second, the answer is the later block.
  const fences = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)];
  for (let i = fences.length - 1; i >= 0; i--) {
    const parsed = tryParse(fences[i][1].trim());
    if (parsed) return parsed;
  }

  // 3. Widest brace span, then progressively earlier openings — handles
  // prose that happens to contain a "{" before the real object starts.
  const end = trimmed.lastIndexOf("}");
  if (end === -1) return null;
  let start = trimmed.indexOf("{");
  while (start !== -1 && start < end) {
    const parsed = tryParse(trimmed.slice(start, end + 1));
    if (parsed) return parsed;
    start = trimmed.indexOf("{", start + 1);
  }
  return null;
}

function runOnce({ model, agent, promptText }) {
  const args = [
    "run",
    "--model", model,
    "--format", "json",
    "--auto",
  ];
  if (agent) args.push("--agent", agent);
  args.push(promptText);

  const env = { ...process.env, OPENCODE_ENABLE_EXA: process.env.OPENCODE_ENABLE_EXA || "1" };
  const result = spawnSync("opencode", args, {
    encoding: "utf-8",
    env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 15 * 60 * 1000,
  });

  if (result.error) {
    return { ok: false, error: `spawn failed: ${result.error.message}` };
  }
  if (result.status !== 0) {
    // opencode reports API/provider errors as a {"type":"error",...} event
    // on stdout with exit code 1 and an empty stderr — surface both so the
    // real cause (auth, rate limit, blocked host, etc.) is actually visible.
    // Take the TAIL, not the head: the terminal error/state is the last
    // event in the stream, and a real run's stdout is dominated by verbose
    // tool_use output (full search results) that pushes the actual error
    // past a head-slice entirely — confirmed missing from a live run's logs.
    const detail = [result.stderr, result.stdout].filter(Boolean).join(" | ").slice(-2000);
    return { ok: false, error: `opencode exited ${result.status}: ${detail || "(no output on stdout or stderr)"}` };
  }

  const { text, cost } = extractTextAndCost(result.stdout);
  if (!text) {
    return { ok: false, error: `no text content extracted from opencode output (first 500 chars): ${result.stdout.slice(0, 500)}` };
  }
  const parsed = extractJson(text);
  if (!parsed) {
    return { ok: false, error: `could not extract valid JSON from model output: ${text.slice(0, 500)}` };
  }
  return { ok: true, data: parsed, cost };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { "prompt-file": promptFile, "schema-file": schemaFile, agent, model: modelArg } = args;
  const systemPromptFile = args["append-system-prompt-file"];
  // Default lowered from 3 to 2: more attempts means more cumulative
  // token spend against the same tight quota, not a better chance of
  // success — the real fix is the per-request token cap above, not
  // throwing more retries at it.
  const maxRetries = parseInt(args["max-retries"] || "2", 10);

  if (!promptFile || !schemaFile || !modelArg) {
    console.error("Usage: node scripts/opencode-agent.js --prompt-file <path> --schema-file <path> --model <provider/model[,provider/model...]> [--agent <name>] [--append-system-prompt-file <path>] [--max-retries N]");
    process.exit(1);
  }

  // opencode run's CLI has no distinct --system flag (unlike claude -p
  // --append-system-prompt) — folding it into the same prompt text is
  // functionally equivalent here since it all becomes the model's context
  // either way.
  const systemPrompt = systemPromptFile ? readFileSync(systemPromptFile, "utf-8") + "\n\n" : "";
  const basePrompt = systemPrompt + readFileSync(promptFile, "utf-8");
  const schema = JSON.parse(readFileSync(schemaFile, "utf-8"));
  const stdinContext = readStdin();
  const models = String(modelArg).split(",").map((m) => m.trim()).filter(Boolean);

  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  // The first live runs against Cerebras showed two real problems, both
  // token-budget related on a free tier that's tighter than expected:
  // (1) the model quoted entire fetched search-result blocks into its
  //     response before ever reaching the JSON, hit its own output-length
  //     limit, and got cut off mid-generation with no JSON at all;
  // (2) a SINGLE websearch call's result (one article's full text) was
  //     enough on its own to trip "Tokens per minute limit exceeded" on
  //     the very next model call — this isn't a retry-pacing problem, each
  //     individual attempt's own token footprint is close to the ceiling.
  // Claude Code CLI's models didn't need either constraint said explicitly;
  // these ones do.
  const lengthLines = lengthReminders(schema);
  const lengthBlock = lengthLines.length
    ? `\n\nFIELD LENGTH LIMITS — a near-miss on this cost an entire extra (rate-limited) attempt last run, stay comfortably under every one:\n${lengthLines.join("\n")}`
    : "";

  const schemaInstruction = `\n\nTOKEN BUDGET — this account is on a tight per-minute quota, so keep tool use lean, but not so lean that you can't meet the sourcing requirements above:
- Call websearch AT MOST TWICE. Use the second call only if the first didn't give you enough DISTINCT source domains.
- Every websearch call MUST include numResults: 6 and contextMaxCharacters: 1200.
- type must be "fast". Never use "deep". Never set livecrawl to "preferred" — omit livecrawl entirely (default "fallback" only).
- Do not fetch full web pages or read local files — work only from websearch results (or the INPUT section itself, for stages with no web access at all). Some of these tools are denied at the permission level for this run, not just discouraged, so attempting them wastes a turn and fails.
Do your research and reasoning silently — do not quote, paste, or summarize search results in your response. Your entire response must be ONLY a single JSON object — no markdown code fences, no explanation before or after, no restated sources — that validates against this JSON Schema:\n${JSON.stringify(schema)}${lengthBlock}`;

  // The context arrives on THIS process's stdin, but the model never sees a
  // stdin — it only sees prompt text. A bare, unlabelled JSON blob pasted
  // ahead of the instructions caused a real failure: a model announced "I
  // cannot read from /dev/stdin due to permission rules" and asked the user
  // to paste the data, because the prompts (written for `claude -p`, which
  // really did pipe stdin) still said "you receive JSON on stdin". Label the
  // block explicitly and state that it's already here, so the model stops
  // looking for it elsewhere.
  const inputBlock = stdinContext
    ? `\n\n## INPUT\n\nThis is the input data for this run. It is already provided here in full — there is no stdin to read, no file to open, and nothing to ask the user for.\n\n\`\`\`json\n${stdinContext.trim()}\n\`\`\``
    : "";

  let lastError = null;
  for (const model of models) {
    let promptText = `${basePrompt}${inputBlock}${schemaInstruction}`;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = runOnce({ model, agent, promptText });
      if (!result.ok) {
        lastError = `[${model}] attempt ${attempt}/${maxRetries}: ${result.error}`;
        console.error(lastError);
        if (attempt < maxRetries) {
          // Cerebras rate limits appear to be account-wide (both models hit
          // the identical error at the same time), so this is a per-minute
          // window to wait out, not something a shorter pause or a
          // different model escapes. 65s to clear a 60s window with margin.
          const waitMs = isRateLimitError(result.error) ? 65000 : 3000;
          console.error(`Waiting ${waitMs / 1000}s before retrying...`);
          await sleep(waitMs);
        }
        continue;
      }
      const valid = validate(result.data);
      if (!valid) {
        lastError = `[${model}] attempt ${attempt}/${maxRetries}: schema validation failed: ${ajv.errorsText(validate.errors)}`;
        console.error(lastError);
        // Retry without re-searching: the model already has what it needs,
        // and a second research pass would spend quota re-fetching the same
        // ground just to fix a formatting/validation problem.
        promptText = `${basePrompt}${inputBlock}${schemaInstruction}\n\nYour previous response failed schema validation with these errors: ${ajv.errorsText(validate.errors)}. Fix ONLY those problems and respond again with the corrected JSON object. Do not run any new searches — reuse what you already found.`;
        continue;
      }
      console.log(JSON.stringify({
        structured_output: result.data,
        total_cost_usd: result.cost || 0,
        model_used: model,
      }));
      return;
    }
    console.error(`Model ${model} exhausted ${maxRetries} attempts, failing over to next model if any...`);
  }

  console.error(`All models failed. Last error: ${lastError}`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
