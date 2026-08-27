#!/usr/bin/env node
/**
 * Phase 17 (token observability) — deterministic aggregation over
 * data/token-usage/log.jsonl (written by scripts/opencode-agent.js's
 * logTokenUsage). No model call, no estimation: only what was actually
 * reported by real runs. A missing input_tokens/output_tokens on a line
 * means the provider's usage event didn't match any known shape for that
 * call (see opencode-agent.js's addUsage) — reported as "null" counts in
 * the group, not silently coerced to 0, so a gap in observability stays
 * visible instead of reading as "zero tokens used".
 *
 * Usage: node scripts/token-usage-report.js [--by task|provider|model|channel_id]
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOG_PATH = join(ROOT, "data", "token-usage", "log.jsonl");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    }
  }
  return args;
}

function loadEntries() {
  if (!existsSync(LOG_PATH)) return [];
  return readFileSync(LOG_PATH, "utf-8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function groupBy(entries, key) {
  const groups = new Map();
  for (const e of entries) {
    const k = e[key] ?? "(unknown)";
    if (!groups.has(k)) {
      groups.set(k, { calls: 0, ok: 0, failed: 0, cost_usd: 0, input_tokens: 0, output_tokens: 0, calls_with_usage: 0 });
    }
    const g = groups.get(k);
    g.calls += 1;
    if (e.ok) g.ok += 1;
    else g.failed += 1;
    g.cost_usd += e.cost_usd || 0;
    if (typeof e.input_tokens === "number" || typeof e.output_tokens === "number") {
      g.calls_with_usage += 1;
      g.input_tokens += e.input_tokens || 0;
      g.output_tokens += e.output_tokens || 0;
    }
  }
  return groups;
}

function printGroup(title, groups) {
  console.log(`\n== by ${title} ==`);
  const rows = [...groups.entries()].sort((a, b) => b[1].calls - a[1].calls);
  for (const [key, g] of rows) {
    const usageNote = g.calls_with_usage < g.calls ? ` (usage reported for ${g.calls_with_usage}/${g.calls} calls)` : "";
    console.log(
      `${String(key).padEnd(28)} calls=${g.calls} ok=${g.ok} failed=${g.failed} ` +
        `cost=$${g.cost_usd.toFixed(4)} in=${g.input_tokens} out=${g.output_tokens}${usageNote}`
    );
  }
}

const args = parseArgs(process.argv.slice(2));
const entries = loadEntries();

if (entries.length === 0) {
  console.log(`No entries in ${LOG_PATH} yet — run the pipeline at least once (opencode-agent.js writes one line per model call).`);
  process.exit(0);
}

console.log(`${entries.length} logged model call(s) from ${LOG_PATH}`);

if (args.by) {
  printGroup(args.by, groupBy(entries, args.by));
} else {
  for (const by of ["task", "provider", "model", "channel_id"]) {
    printGroup(by, groupBy(entries, by));
  }
}
