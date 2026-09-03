#!/usr/bin/env node
/**
 * Proves the runner's `--model a,b,c,d,e` chain really walks all five
 * providers in order, rather than that being an assumption.
 *
 * Why this exists: OpenCode's own config CANNOT express a fallback list.
 * In its published schema `Config.model` is `{"type": "string"}` — one
 * `provider_id/model_id` — and the schema carries no fallback/retry/failover
 * key (sst/opencode @ d8eb3b8, packages/sdk/openapi.json). The N-provider
 * chain is therefore ours, implemented in scripts/opencode-agent.js, and a
 * claim about our own code deserves a test rather than a comment.
 *
 * Method: put a stub `opencode` on PATH that records the --model it was
 * handed and always fails, run the real runner against a 5-entry list, then
 * assert the recorded order matches the list exactly. No provider is
 * contacted; this tests the chain, not the models.
 *
 *   node scripts/verify-failover-chain.mjs
 */
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, existsSync, rmSync, statSync, truncateSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "failover-"));
const log = join(dir, "calls.log");

// opencode-agent.js appends a real row to data/token-usage/log.jsonl for every
// model call, including these stubbed ones. That file is a real observability
// log, so remember how long it was and cut it back afterwards rather than
// leaving five fabricated provider calls in it.
const usageLog = join(ROOT, "data", "token-usage", "log.jsonl");
const usageLogBytes = existsSync(usageLog) ? statSync(usageLog).size : null;
const restoreUsageLog = () => {
  if (usageLogBytes === null) { rmSync(usageLog, { force: true }); return; }
  if (existsSync(usageLog) && statSync(usageLog).size > usageLogBytes) truncateSync(usageLog, usageLogBytes);
};

const MODELS = [
  "opencode/mimo-v2.5-free",
  "mistral/ministral-3b-latest",
  "groq/llama-3.1-8b-instant",
  "google/gemini-2.5-flash-lite",
  "cerebras/gpt-oss-120b",
];
const MAX_RETRIES = 2;

// Stub provider CLI: log the model it was asked for, then fail like a real
// provider error would (exit 1 with an error event on stdout).
const stub = join(dir, "opencode");
writeFileSync(
  stub,
  `#!/usr/bin/env node
const fs = require("fs");
const a = process.argv.slice(2);
const m = a[a.indexOf("--model") + 1];
fs.appendFileSync(${JSON.stringify(log)}, m + "\\n");
process.stdout.write(JSON.stringify({ type: "error", error: "stubbed provider failure" }) + "\\n");
process.exit(1);
`,
);
chmodSync(stub, 0o755);

writeFileSync(join(dir, "prompt.md"), "return {}");
writeFileSync(join(dir, "schema.json"), JSON.stringify({ type: "object" }));

const res = spawnSync(
  process.execPath,
  [join(ROOT, "scripts", "opencode-agent.js"),
   "--prompt-file", join(dir, "prompt.md"),
   "--schema-file", join(dir, "schema.json"),
   "--model", MODELS.join(","),
   "--max-retries", String(MAX_RETRIES)],
  { encoding: "utf-8", env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, OPENCODE_RETRY_SLEEP_MS: "0" },
    input: "", timeout: 120000 },
);

const calls = existsSync(log) ? readFileSync(log, "utf-8").trim().split("\n").filter(Boolean) : [];
const attempted = [...new Set(calls)];

let failed = false;
const check = (label, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failed = true;
};

check("all 5 providers were attempted", attempted.length === 5, `attempted ${attempted.length}: ${attempted.join(", ")}`);
check("attempted in the configured order", attempted.join(",") === MODELS.join(","), attempted.join(" -> "));
check("each got its full retry budget", calls.length === MODELS.length * MAX_RETRIES, `${calls.length} calls, expected ${MODELS.length * MAX_RETRIES}`);
check("runner exits non-zero once the chain is exhausted", res.status !== 0, `exit ${res.status}`);

rmSync(dir, { recursive: true, force: true });
restoreUsageLog();
console.log(failed ? "\nFAILED" : "\nOK — a 5-provider chain is walked end to end.");
process.exit(failed ? 1 : 0);
