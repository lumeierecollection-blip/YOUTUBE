#!/usr/bin/env node
/**
 * model-availability.mjs — the early warning for every model the repo calls.
 *
 * Three checks, one table, one exit code:
 *   1. COVERAGE  every model-ID string in the live code (scripts/, src/, workflows, prompts, config) must be in
 *                config/model-registry.json. An unregistered ID fails the run, so a new model cannot go unprobed.
 *   2. PROBE     each registered, called model: Gemini gets one minimal generateContent call per key, in the
 *                production key order (collectKeys, src/lib/gemini-client.js); OpenRouter and Groq are checked
 *                against their public model lists. A model is RETIRED when Gemini answers 404 on every key, or
 *                when the list does not contain it, or when the official deprecations page gives a shutdown
 *                date that has passed.
 *   3. DEPRECATION  the official deprecations page (rendered to text by the workflow) gives each Gemini model's
 *                shutdown date. Within DEPRECATED_WINDOW_DAYS it is a warning; after it, RETIRED.
 *
 * Exit 1 if any called model is RETIRED or MISSING. Warnings do not fail the run.
 * It prints the key indices and which keys are the same key (equal strings), never a key value.
 *
 *   node scripts/model-availability.mjs --deprecations <rendered-deprecations.txt> [--now 2026-10-10]
 *
 * Weekly, from .github/workflows/model-availability.yml. Not run on boards.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { join, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

export const DEPRECATED_WINDOW_DAYS = 90;
export const SCAN_DIRS = ["scripts", "src", ".github/workflows", ".github/actions", "prompts", "config", ".opencode"];
const SKIP = [/workflows-deprecated/, /model-status\.yml$/, /openrouter-probe\.yml$/, /model-availability\.yml$/,
  /model-availability\.mjs$/, /model-registry\.json$/, /node_modules/, /__tests__\/model-availability\.test\.js$/];
const TEXT_EXT = new Set([".js", ".mjs", ".cjs", ".py", ".yml", ".yaml", ".json", ".sh", ".toml", ".md", ".txt"]);
// Model-ID shapes this repo uses: gemini-<version>..., and provider/model for OpenRouter and Groq.
const ID_RE = /\b(gemini-[0-9][0-9a-z.\-]*[0-9a-z]|qwen\/[a-z0-9][a-z0-9.\-]*[a-z0-9]|openai\/gpt-[a-z0-9.\-]*[a-z0-9])\b/gi;

// The bare model name: "google/gemini-3.5-flash-lite" and "gemini-3.5-flash-lite" are the same model.
export function bareId(s) { return String(s).replace(/^google\//, ""); }

// Pure: classify one Gemini generateContent answer for one key.
export function classifyGeminiStatus(status, body = "") {
  const text = String(body);
  if (status === 200) return "alive";
  if (status === 429) return "alive-quota";
  if (status === 404 || /no longer available|NOT_FOUND|is not found for API version/i.test(text)) return "retired";
  if (status === 401 || status === 403 || /API key not valid|Please pass a valid API key/i.test(text)) return "key-rejected";
  if (status >= 500) return "unknown-transient";
  return "unknown";
}

// Pure: parse "Month D, YYYY" or "Month YYYY" (the page uses both). Returns a Date or null.
export function parseShutdown(s) {
  const t = String(s || "").trim();
  if (!t || /no shutdown date/i.test(t)) return null;
  const d = Date.parse(t) || Date.parse(`1 ${t}`);
  return Number.isFinite(d) ? new Date(d) : null;
}

// Pure: the rendered deprecations page is tab-separated rows: model, release, shutdown, replacement.
// Returns { found: bool, shutdown: string, replacement: string } for the first row that names the model.
export function deprecationFor(id, pageText) {
  for (const line of String(pageText).split("\n")) {
    const cols = line.trim().split("\t");
    if (cols[0] === id && cols.length >= 3) {
      return { found: true, shutdown: cols[2].trim(), replacement: (cols[3] || "").trim() };
    }
  }
  return { found: false, shutdown: "", replacement: "" };
}

// Pure: one model's verdict. Rules, in order:
//   not called by the code                                  -> NOT-CALLED
//   Gemini: 404 on every key                                -> RETIRED
//   Gemini: rejected on every key (bad key, not the model)  -> KEY-REJECTED
//   Gemini: no key answered alive and none was retired      -> UNKNOWN (transient, re-run)
//   list (OpenRouter/Groq) does not contain the model       -> MISSING
//   official shutdown date has passed                       -> RETIRED
//   official shutdown date within the window                -> DEPRECATED-SOON
//   the list could not be checked (no key)                  -> NOT-CHECKED
//   otherwise                                               -> ALIVE
export function verdictFor({ called = true, gemini = [], list = null, shutdown = null, now = new Date() }) {
  if (!called) return "NOT-CALLED";
  if (gemini.length && gemini.every((s) => s === "retired")) return "RETIRED";
  if (gemini.length && gemini.every((s) => s === "key-rejected")) return "KEY-REJECTED";
  if (gemini.length && !gemini.some((s) => s === "alive" || s === "alive-quota")) return "UNKNOWN";
  if (list === "absent") return "MISSING";
  if (shutdown && shutdown.getTime() < now.getTime()) return "RETIRED";
  if (shutdown && (shutdown.getTime() - now.getTime()) / 86400000 <= DEPRECATED_WINDOW_DAYS) return "DEPRECATED-SOON";
  if (list === "not-checked") return "NOT-CHECKED";
  return "ALIVE";
}

// Walk the live code and collect every model-ID string with its file:line.
export function scanIds(root) {
  const found = new Map();
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const rel = relative(root, p);
      if (SKIP.some((re) => re.test(rel))) continue;
      const st = statSync(p);
      if (st.isDirectory()) { walk(p); continue; }
      if (!TEXT_EXT.has(extname(name))) continue;
      const lines = readFileSync(p, "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const m of line.matchAll(ID_RE)) {
          const id = bareId(m[1]);
          if (!found.has(id)) found.set(id, []);
          found.get(id).push(`${rel}:${i + 1}`);
        }
      });
    }
  };
  for (const d of SCAN_DIRS) { const p = join(root, d); if (existsSync(p)) walk(p); }
  return found;
}

// Pure: IDs seen in the code and absent from the registry.
export function unregistered(found, registry) {
  const known = new Set(registry.map((r) => bareId(r.id)));
  return [...found.keys()].filter((id) => !known.has(id)).map((id) => ({ id, where: found.get(id).slice(0, 3) }));
}

async function geminiChecks(id, keys) {
  const out = [];
  const body = JSON.stringify({ contents: [{ parts: [{ text: "ok" }] }], generationConfig: { maxOutputTokens: 8, temperature: 0 } });
  for (const key of keys) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent`, {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body,
        signal: AbortSignal.timeout(60000),
      });
      const text = await res.text();
      out.push(classifyGeminiStatus(res.status, text));
    } catch (e) {
      out.push("unknown-transient");
    }
  }
  return out;
}

async function listIds(url, headers = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const j = await res.json();
  return new Set((j.data || j.models || []).map((m) => bareId(m.id || m.name || "")));
}

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const argv = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
  const deprecationsPath = argv("deprecations", null);
  const now = argv("now", null) ? new Date(argv("now", null)) : new Date();
  const registry = JSON.parse(readFileSync(join(root, "config", "model-registry.json"), "utf8"));
  const pageText = deprecationsPath && existsSync(deprecationsPath) ? readFileSync(deprecationsPath, "utf8") : "";
  const summary = [];
  const say = (s = "") => { console.log(s); summary.push(s); };

  // 1. Coverage.
  const found = scanIds(root);
  const missing = unregistered(found, registry);
  say("## Model availability");
  say(`Scanned ${found.size} distinct model IDs in ${SCAN_DIRS.join(", ")}; registry has ${registry.length} entries. Run at ${now.toISOString()}.`);
  if (missing.length) {
    say("");
    say("### Unregistered model IDs (fail)");
    for (const m of missing) say(`- \`${m.id}\` at ${m.where.join(", ")}`);
  }

  // 2 + 3. Probe.
  let keys = [];
  try {
    const { collectKeys } = await import("../src/lib/gemini-client.js");
    keys = collectKeys();
  } catch (e) {
    say(`(no Gemini keys: ${e.message.split(".")[0]})`);
  }
  // Key diagnostics: which env var holds the same key as which. Equal strings only; no value is printed.
  const names = ["GEMINI_API_KEY_4", "GEMINI_API_KEY_3", "GEMINI_API_KEY_1", "GEMINI_API_KEY", "GEMINI_API_KEY_2"];
  const present = names.filter((n) => process.env[n]);
  const dupes = [];
  for (let i = 0; i < present.length; i++) for (let j = i + 1; j < present.length; j++) {
    if (process.env[present[i]] === process.env[present[j]]) dupes.push(`${present[i]} = ${present[j]}`);
  }
  say("");
  say(`Gemini key env vars set: ${present.join(", ") || "none"}`);
  say(`Keys that are the same key: ${dupes.join("; ") || "none"}`);
  say(`Production key order (collectKeys): ${keys.length} key(s), tried in this order`);

  let openrouterIds = null, groqIds = null;
  try { openrouterIds = await listIds("https://openrouter.ai/api/v1/models"); } catch (e) { say(`OpenRouter catalog: ${e.message}`); }
  if (process.env.GROQ_API_KEY) {
    try { groqIds = await listIds("https://api.groq.com/openai/v1/models", { authorization: `Bearer ${process.env.GROQ_API_KEY}` }); }
    catch (e) { say(`Groq model list: ${e.message}`); }
  }

  const rows = [];
  let failures = 0, warnings = 0;
  for (const r of registry) {
    const id = bareId(r.id);
    const called = r.called !== false && (found.has(id) || r.called === true);
    const dep = r.provider === "gemini" ? deprecationFor(id, pageText) : { found: false, shutdown: "", replacement: "" };
    const shutdown = parseShutdown(dep.shutdown);
    let gemini = [], list = null;
    if (r.provider === "gemini" && called && keys.length) gemini = await geminiChecks(id, keys);
    if (r.provider === "openrouter" && openrouterIds) list = openrouterIds.has(id) ? "present" : "absent";
    if (r.provider === "groq") list = groqIds ? (groqIds.has(id) ? "present" : "absent") : "not-checked";
    const verdict = verdictFor({ called, gemini, list, shutdown, now, onPage: dep.found });
    if (["RETIRED", "MISSING", "UNKNOWN", "KEY-REJECTED"].includes(verdict)) failures++;
    if (["DEPRECATED-SOON", "NOT-CHECKED"].includes(verdict)) warnings++;
    const geminiCol = gemini.length ? gemini.map((s) => s).join(" / ") : (list ? `list: ${list}` : "-");
    rows.push(`| ${r.provider} | \`${id}\` | ${called ? "yes" : "no"} | ${geminiCol} | ${dep.found ? (dep.shutdown || "-") : "not on page"} | ${dep.replacement || "-"} | **${verdict}** |`);
  }
  say("");
  say("| provider | model | called | probe (per key, or list) | shutdown (official page) | replacement | verdict |");
  say("|---|---|---|---|---|---|---|");
  for (const row of rows) say(row);
  say("");
  say(`Failures: ${failures + missing.length}. Warnings: ${warnings}. (${DEPRECATED_WINDOW_DAYS}-day deprecation window.)`);

  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join("\n") + "\n");
  if (failures + missing.length) {
    console.error(`::error::${failures + missing.length} model problem(s): see the table. A retired or unregistered model breaks the pipeline silently; fix it before the next board.`);
    process.exit(1);
  }
  if (warnings) console.log(`::warning::${warnings} model(s) to watch (deprecated soon, or not checkable from here).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
