#!/usr/bin/env node
/**
 * ollama-agent.js — prep-stage model runner that talks to Ollama directly.
 *
 * Drop-in for scripts/opencode-agent.js on the prep stages (same flags,
 * same single JSON line on stdout), without OpenCode in the loop.
 *
 * Why: through OpenCode, every request to qwen2.5:7b carried OpenCode's own
 * system prompt and tool definitions — 6–7k tokens per call — and on a
 * CPU-only runner (~30–40 tok/s prompt eval) a single Discover call ran past
 * 5 minutes (runs 35800003908, 35803176381; data/ci-runs/blocked-prep-model.txt).
 *
 * Flow for an agent that may search (--agent pipeline-research):
 *   1. Ask the model for up to --search-budget queries (tiny JSON output).
 *   2. Run each query against Exa's hosted search (the same backend OpenCode's
 *      websearch tool uses when OPENCODE_ENABLE_EXA=1).
 *   3. Give the model the results and ask for the stage JSON, with Ollama's
 *      schema-constrained output (`format: <JSON Schema>`).
 * For an agent with no tools (--agent pipeline-script) only step 3 runs.
 *
 * Grounding — stricter than the OpenCode path, not looser: every
 * `source_url` / `url` the model returns must be a URL that one of THIS
 * run's searches actually returned. gate-research.js only checks that a
 * source_url is well-formed (its own header says where that stops); this
 * check closes that gap for this runner. A response citing any other URL is
 * rejected and retried with the violation named.
 *
 * Every response is validated with ajv against --schema-file; a failure is
 * fed back and retried up to --max-retries. Nothing is padded or defaulted.
 */

import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const EXA_URL = process.env.EXA_MCP_URL || "https://mcp.exa.ai/mcp";
const CALL_TIMEOUT_S = Number(process.env.PREP_CALL_TIMEOUT_S || process.env.OPENCODE_CALL_TIMEOUT_S) || 300;
const NUM_CTX = Number(process.env.OLLAMA_CONTEXT_LENGTH) || 16384;
const SEARCH_AGENTS = new Set(["pipeline-research"]);
const SEARCH_TEXT_MAX = Number(process.env.SEARCH_TEXT_MAX) || 3000; // chars per query

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

function readStdin() {
  try { return readFileSync(0, "utf-8"); } catch { return ""; }
}

function log(msg) { console.error(msg); }

async function fetchWithTimeout(url, init, timeoutS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutS * 1000);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`timed out after ${timeoutS}s: ${url}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/* ── Ollama ───────────────────────────────────────────────────────── */

async function chat(model, messages, format, label) {
  const t0 = Date.now();
  const res = await fetchWithTimeout(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model, messages, format, stream: false,
      options: { temperature: 0.2, num_ctx: NUM_CTX },
    }),
  }, CALL_TIMEOUT_S);
  const body = await res.text();
  if (!res.ok) throw new Error(`ollama ${res.status}: ${body.slice(0, 400)}`);
  const j = JSON.parse(body);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  log(`[${model}] ${label}: ${secs}s (prompt ${j.prompt_eval_count ?? "?"} tok, output ${j.eval_count ?? "?"} tok)`);
  return { content: j.message?.content || "", usage: { input: j.prompt_eval_count, output: j.eval_count } };
}

/* ── Exa search (same hosted endpoint as OpenCode's websearch tool) ── */

async function exaSearch(query, { numResults = 4, contextMaxCharacters = 900 } = {}) {
  const t0 = Date.now();
  const res = await fetchWithTimeout(EXA_URL, {
    method: "POST",
    headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "tools/call",
      params: { name: "web_search_exa", arguments: { query, type: "fast", numResults, contextMaxCharacters } },
    }),
  }, 60);
  const raw = await res.text();
  if (!res.ok) throw new Error(`exa ${res.status}: ${raw.slice(0, 300)}`);
  // Streamable-HTTP MCP answers either as JSON or as SSE "data:" lines.
  const payloads = raw.trim().startsWith("{")
    ? [raw]
    : raw.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim());
  let text = "";
  for (const p of payloads) {
    try {
      const j = JSON.parse(p);
      if (j.error) throw new Error(`exa error: ${JSON.stringify(j.error).slice(0, 300)}`);
      for (const c of j.result?.content || []) if (c.type === "text") text += c.text + "\n";
    } catch (e) {
      if (String(e.message).startsWith("exa error")) throw e;
    }
  }
  if (!text.trim()) throw new Error(`exa returned no text for "${query}": ${raw.slice(0, 300)}`);
  // Exa's contextMaxCharacters did not bound the payload: run 35825042889's
  // answer prompt reached 7,395 tokens and the first call timed out at 300s.
  // Cap what the model reads; URLs are taken from the capped text, so the
  // model can only cite what it was actually shown.
  if (text.length > SEARCH_TEXT_MAX) text = text.slice(0, SEARCH_TEXT_MAX);
  const urls = [...text.matchAll(/https?:\/\/[^\s)\]"'>]+/g)].map((m) => normUrl(m[0]));
  log(`[exa] "${query}" → ${urls.length} URL(s) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { query, text: text.trim(), urls: [...new Set(urls)] };
}

function normUrl(u) {
  return String(u).trim().replace(/[.,;]+$/, "").replace(/#.*$/, "").replace(/\/+$/, "");
}

/* ── Output checks ────────────────────────────────────────────────── */

function extractJson(text) {
  const t = String(text).trim();
  try { return JSON.parse(t); } catch {}
  const fenced = [...t.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  for (const f of fenced.reverse()) { try { return JSON.parse(f); } catch {} }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} }
  return null;
}

// Formatting-only normalisation: slugs to the schema's charset. No content
// is invented — a slug too short after cleaning still fails validation.
function normaliseSlugs(obj) {
  if (!obj || typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && /(^|_)slug$/.test(k)) {
      obj[k] = v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60).replace(/-$/, "");
    } else if (v && typeof v === "object") normaliseSlugs(v);
  }
}

function citedUrls(obj, out = []) {
  if (Array.isArray(obj)) { for (const v of obj) citedUrls(v, out); return out; }
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && /(^|_)url$/i.test(k)) out.push(v);
    else if (v && typeof v === "object") citedUrls(v, out);
  }
  return out;
}

/**
 * Queries for the stages whose input already says what to search for.
 * Returns null for any other stage (the model plans those queries).
 *   discover-topics: two of the channel's content pillars, rotated by day
 *     so consecutive days search different pillars, each with the year.
 *   research: the reserved topic, then the topic with its angle.
 */
function derivedQueries(taskLabel, inputText, budget) {
  let input;
  try { input = JSON.parse(inputText); } catch { return null; }
  const year = new Date().getUTCFullYear();
  if (taskLabel === "discover-topics") {
    const ch = (input.channels || [])[0];
    const pillars = ch?.content_pillars || [];
    if (!pillars.length) return null;
    const day = Math.floor(Date.now() / 86400000);
    const picks = [];
    for (let i = 0; i < Math.min(budget, pillars.length); i++) picks.push(pillars[(day + i) % pillars.length]);
    return picks.map((p) => `${p} ${year} news`);
  }
  if (taskLabel === "research") {
    if (!input.topic) return null;
    const qs = [input.topic];
    if (input.angle) qs.push(`${input.topic} ${input.angle}`.slice(0, 200));
    return qs.slice(0, Math.max(1, budget));
  }
  return null;
}

function lengthReminders(schema, path = "", out = []) {
  if (!schema || typeof schema !== "object") return out;
  if (schema.type === "string" && (schema.minLength || schema.maxLength || schema.pattern)) {
    const bits = [];
    if (schema.minLength) bits.push(`at least ${schema.minLength} chars`);
    if (schema.maxLength) bits.push(`at most ${schema.maxLength} chars`);
    if (schema.pattern) bits.push(`must match ${schema.pattern}`);
    out.push(`- ${path || "(root)"}: ${bits.join(", ")}`);
  }
  if (schema.type === "array" && (schema.minItems || schema.maxItems)) {
    out.push(`- ${path}: ${schema.minItems ? `at least ${schema.minItems}` : ""}${schema.minItems && schema.maxItems ? ", " : ""}${schema.maxItems ? `at most ${schema.maxItems}` : ""} items`);
  }
  for (const [k, v] of Object.entries(schema.properties || {})) lengthReminders(v, path ? `${path}.${k}` : k, out);
  if (schema.items) lengthReminders(schema.items, `${path}[]`, out);
  return out;
}

function logTokenUsage(entry) {
  try {
    const dir = join(ROOT, "data", "token-usage");
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, "calls.jsonl"), JSON.stringify({ ts: new Date().toISOString(), runner: "ollama-agent", ...entry }) + "\n");
  } catch {}
}

/* ── Main ─────────────────────────────────────────────────────────── */

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const promptFile = args["prompt-file"];
  const schemaFile = args["schema-file"];
  const agent = args.agent || "";
  const maxRetries = Math.max(1, Number(args["max-retries"]) || 3);
  const searchBudget = Math.max(0, Number(args["search-budget"]) || 2);
  const taskLabel = args["task-label"] || "task";
  const models = String(args.model || "").split(",").map((m) => m.trim()).filter(Boolean);
  if (!promptFile || !schemaFile || !models.length) {
    log("Usage: node scripts/ollama-agent.js --prompt-file <p> --schema-file <s> --model ollama/<name> [--agent pipeline-research|pipeline-script] [--search-budget N] [--append-system-prompt-file <p>] [--max-retries N]");
    process.exit(2);
  }
  const nonOllama = models.filter((m) => !m.startsWith("ollama/"));
  if (nonOllama.length) {
    log(`ollama-agent only drives ollama/* models; got ${nonOllama.join(", ")}`);
    process.exit(2);
  }

  const basePrompt = readFileSync(promptFile, "utf-8");
  const system = args["append-system-prompt-file"] ? readFileSync(args["append-system-prompt-file"], "utf-8") : "";
  const schema = JSON.parse(readFileSync(schemaFile, "utf-8"));
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const input = readStdin().trim();
  const canSearch = SEARCH_AGENTS.has(agent) && searchBudget > 0;

  const lengths = lengthReminders(schema);
  const inputBlock = input ? `\n\n## INPUT\n\nThe input data for this run, in full:\n\n\`\`\`json\n${input}\n\`\`\`` : "";
  const toolNote = canSearch
    ? "\n\nNOTE ON TOOLS: you cannot browse. Web search is run FOR you: first you will be asked for search queries, then given the results. Use only facts and URLs from those results."
    : "\n\nNOTE ON TOOLS: you have no tools and no web access in this stage. Work only from the INPUT above.";
  const userPrompt = `${basePrompt}${inputBlock}${toolNote}`;

  let lastError = null;
  for (const spec of models) {
    const model = spec.slice("ollama/".length);
    const messages = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: userPrompt });

    // 1–2. Search, when this agent may.
    let searches = [];
    let allowedUrls = null;
    if (canSearch) {
      // Discover and research build their queries from the input (channel
      // pillars; reserved topic + angle). A model-planned query call cost
      // 15–77s per stage on the runner and produced weak queries ("money
      // trail animations recent" for a crypto-fraud channel, run
      // 35825042889). Other stages still ask the model.
      let queries = derivedQueries(taskLabel, input, searchBudget);
      if (queries) {
        log(`[${taskLabel}] queries from input: ${queries.map((q) => `"${q}"`).join(", ")}`);
      } else {
        const qSchema = { type: "object", required: ["queries"], properties: { queries: { type: "array", minItems: 1, maxItems: searchBudget, items: { type: "string", minLength: 3 } } } };
        messages.push({ role: "user", content: `Before answering, list up to ${searchBudget} web search queries that will find current, specific, citable sources for this task. Respond ONLY with {"queries": [...]}.` });
        try {
          const r = await chat(model, messages, qSchema, `${taskLabel}/queries`);
          queries = (extractJson(r.content)?.queries || []).slice(0, searchBudget);
          messages.push({ role: "assistant", content: r.content });
        } catch (e) {
          lastError = `[${spec}] query planning failed: ${e.message}`;
          log(lastError);
          continue;
        }
      }
      if (!queries.length) {
        lastError = `[${spec}] model produced no search queries`;
        log(lastError);
        continue;
      }
      for (const q of queries) {
        try { searches.push(await exaSearch(q)); } catch (e) { log(`[exa] "${q}" failed: ${e.message}`); }
      }
      if (!searches.length) {
        lastError = `[${spec}] every web search failed — cannot ground this stage`;
        log(lastError);
        continue;
      }
      allowedUrls = new Set(searches.flatMap((s) => s.urls));
      const results = searches.map((s, i) => `### Search ${i + 1}: ${s.query}\n\n${s.text}`).join("\n\n");
      messages.push({ role: "user", content: `## SEARCH RESULTS\n\n${results}\n\nThese are the only sources available. Any source_url you give MUST be one of the URLs shown above, copied exactly.` });
    }

    // 3. Structured answer, validated, with feedback retries.
    const answerInstruction = `Now produce the final answer: ONE JSON object that validates against the schema you are constrained to.${lengths.length ? `\nField limits:\n${lengths.join("\n")}` : ""}`;
    messages.push({ role: "user", content: answerInstruction });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let r;
      try {
        r = await chat(model, messages, schema, `${taskLabel}/answer attempt ${attempt}/${maxRetries}`);
      } catch (e) {
        lastError = `[${spec}] attempt ${attempt}/${maxRetries}: ${e.message}`;
        log(lastError);
        logTokenUsage({ model: spec, agent, task: taskLabel, channelId: args["channel-id"], videoId: args["video-id"], ok: false });
        continue;
      }
      logTokenUsage({ model: spec, agent, task: taskLabel, channelId: args["channel-id"], videoId: args["video-id"], usage: r.usage, ok: true });
      const data = extractJson(r.content);
      const problems = [];
      if (!data) {
        problems.push(`response was not valid JSON: ${r.content.slice(0, 300)}`);
      } else {
        normaliseSlugs(data);
        if (!validate(data)) problems.push(`schema validation failed: ${ajv.errorsText(validate.errors)}`);
        if (allowedUrls) {
          const bad = citedUrls(data).filter((u) => !allowedUrls.has(normUrl(u)));
          if (bad.length) problems.push(`cites URL(s) that no search returned: ${bad.slice(0, 5).join(", ")}`);
        }
      }
      if (!problems.length) {
        console.log(JSON.stringify({
          structured_output: data,
          total_cost_usd: 0,
          model_used: spec,
          websearch_calls: searches.length,
          search_queries: searches.map((s) => s.query),
          input_tokens: r.usage.input ?? null,
          output_tokens: r.usage.output ?? null,
        }));
        return;
      }
      lastError = `[${spec}] attempt ${attempt}/${maxRetries}: ${problems.join("; ")}`;
      log(lastError);
      messages.push({ role: "assistant", content: r.content });
      messages.push({ role: "user", content: `That response was rejected: ${problems.join("; ")}. Fix exactly those problems and return the full corrected JSON object.` });
    }
  }
  log(`All models failed. Last error: ${lastError}`);
  process.exit(1);
}

main().catch((e) => {
  log(`Fatal: ${e.stack || e.message}`);
  process.exit(1);
});
