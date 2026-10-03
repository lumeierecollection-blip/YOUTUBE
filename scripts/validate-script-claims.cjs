#!/usr/bin/env node
/**
 * Script CLAIM validator (owner's spec 2026-10-03, "Fix 4"): every sentence's claims must be
 * supported by THIS video's research artifact. SCR-14 (gate-script.js) only checks that the
 * cited URLs are in the research; it cannot see a sentence that glues two research tokens into
 * a claim the research never makes — CI run 37149091704 ch-2 "Courts enforce 6 votes inside
 * Service Employees International Union Local 32BJ agreements", ch-9 "to defy Israel" (the
 * research: "amid Iran's ongoing confrontation with Israel").
 *
 *   node scripts/validate-script-claims.cjs <channel> <script.json> <research.json> [--blocked <dir>]
 *     exit 0 = no INVENTED claim (PARTIAL is logged and accepted)
 *     exit 2 = at least one INVENTED claim ("  - CLAIM:" lines are the re-ask feedback);
 *              with --blocked: also writes <dir>/blocked-claims-<ch>.txt and prints the skip line
 *     exit 4 = the check could not run (Gemini failed twice: quota / timeout / bad answer) —
 *              "[script] ch-X: claim check unavailable, proceeding without"
 *
 * How: ONE Gemini call per script (src/lib/gemini-client.js, the planner's client). The model
 * splits each numbered sentence into (subject, verb, object) triples and gives each triple a
 * verdict against the research — SUPPORTED (stated or directly implied), PARTIAL (the entities
 * are there, this claim is not), INVENTED (absent from or contradicting the research) — with
 * the research fact it relied on. One call, not one per triple: ~20 triples x 6 channels per
 * run would spend the free-tier quota the planner needs, and the verdicts are still per triple.
 *
 * Where it stops: the judge is a model. It checks the claims against the research JSON it is
 * given (key_facts, numbers, named_entities) — not against the source pages behind them. A
 * claim the research itself got wrong passes. Voiceover sentences only (not text_overlay).
 */
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { sentences } = require("./validate-script.cjs");

const MODEL = process.env.CLAIMS_GEMINI_MODEL || process.env.SCRIPT_GEMINI_MODEL || "gemini-3.5-flash-lite";
const RETRY_WAIT_MS = Number(process.env.CLAIMS_RETRY_WAIT_MS ?? 20000);

/** The research the judge reads: facts, numbers, entities — compact, no page text. */
function researchText(r) {
  const facts = (r?.key_facts || []).map((f, i) => `F${i + 1}. ${f.fact || f.claim || f.text || JSON.stringify(f)}`);
  const nums = (r?.numbers || []).map((n, i) => `N${i + 1}. ${[n.value, n.unit, n.label || n.description || n.context].filter((x) => x !== undefined && x !== null && x !== "").join(" — ")}`);
  const ents = (r?.named_entities || []).map((e) => `${e.name} (${e.kind || e.type || "?"})`);
  return [
    r?.topic ? `TOPIC: ${r.topic}` : "",
    r?.strongest_angle ? `ANGLE: ${r.strongest_angle}` : "",
    r?.summary ? `SUMMARY: ${r.summary}` : "",
    facts.length ? `KEY FACTS:\n${facts.join("\n")}` : "",
    nums.length ? `NUMBERS:\n${nums.join("\n")}` : "",
    ents.length ? `NAMED ENTITIES: ${ents.join("; ")}` : "",
  ].filter(Boolean).join("\n\n");
}

function promptFor(research, sents) {
  return [
    "You are checking a video script against its source research. The research below is the ONLY evidence; do not use your own knowledge.",
    "",
    "RESEARCH ARTIFACT:",
    researchText(research),
    "",
    "SCRIPT SENTENCES:",
    ...sents.map((s, i) => `${i + 1}. ${s}`),
    "",
    "For EVERY sentence: extract each factual claim as a (subject, verb, object) triple — every number, name, date, cause, action or comparison it asserts. Skip pure questions and imperatives addressed to the viewer (\"Check your contract\"), but DO check any fact embedded in them.",
    "For each triple, is this claim supported by the research?",
    "  SUPPORTED — the research states or directly implies it",
    "  PARTIAL — the research mentions the entities but not this specific claim",
    "  INVENTED — the claim contradicts or is absent from the research (including a research number or name attached to the wrong thing)",
    "",
    'Return JSON only: {"sentences": [{"n": 1, "triples": [{"triple": "subject | verb | object", "verdict": "SUPPORTED" | "PARTIAL" | "INVENTED", "evidence": "the research fact id (F3 / N2) or a short reason"}]}]}',
    "Include every sentence number, even one with no triples (\"triples\": []).",
  ].join("\n");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function judge(research, sents, tag) {
  const { callGemini } = await import("../src/lib/gemini-client.js");
  const messages = [{ role: "user", content: promptFor(research, sents) }];
  let last = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await callGemini(messages, { model: MODEL, maxTokens: 8192, temperature: 0, noCache: attempt > 1, tag });
    if (r && r.source === "gemini" && r.error) last = `${r.error}: ${String(r.detail || "").slice(0, 160)}`;
    else {
      let data = r;
      if (r && typeof r.content === "string" && Object.keys(r).length === 1) {
        const t = r.content, a = t.indexOf("{"), b = t.lastIndexOf("}");
        try { data = JSON.parse(t.slice(a, b + 1)); } catch { data = null; }
      }
      if (data && Array.isArray(data.sentences)) return { ok: true, data };
      last = `unparseable answer: ${JSON.stringify(r).slice(0, 160)}`;
    }
    if (attempt === 1) { console.log(`${tag}: claim check attempt 1 failed (${last}) — retrying in ${RETRY_WAIT_MS / 1000}s`); await sleep(RETRY_WAIT_MS); }
  }
  return { ok: false, why: last };
}

function evaluate(data, sents) {
  const rows = sents.map((s, i) => {
    const got = (data.sentences || []).find((x) => Number(x?.n) === i + 1);
    const triples = (got?.triples || []).map((t) => ({ triple: String(t?.triple || "").trim(), verdict: String(t?.verdict || "").toUpperCase().trim(), evidence: String(t?.evidence || "").trim() }));
    return { n: i + 1, sentence: s, triples, invented: triples.filter((t) => t.verdict === "INVENTED"), partial: triples.filter((t) => t.verdict === "PARTIAL"), missing: !got };
  });
  return { rows, invented: rows.reduce((n, r) => n + r.invented.length, 0), partial: rows.reduce((n, r) => n + r.partial.length, 0), triples: rows.reduce((n, r) => n + r.triples.length, 0) };
}

function feedbackLines(res) {
  const out = [];
  for (const r of res.rows) for (const t of r.invented) {
    out.push(`  - CLAIM: sentence ${r.n} "${r.sentence}" — the claim "${t.triple}" is not in the research (${t.evidence || "absent"}). Rewrite the sentence using only what the research states, or cut it.`);
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const bi = args.indexOf("--blocked");
  const blockedDir = bi >= 0 ? args[bi + 1] : null;
  const [ch, scriptPath, researchPath] = bi < 0 ? args : args.filter((a, i) => i !== bi && i !== bi + 1);
  const tag = `[script] ch-${ch}`;
  const script = JSON.parse(readFileSync(scriptPath, "utf8"));
  const research = JSON.parse(readFileSync(researchPath, "utf8"));
  const sents = sentences((script.sections || []).map((x) => x.voiceover || "").join(" "));
  const j = await judge(research, sents, tag);
  if (!j.ok) {
    console.log(`${tag}: claim check unavailable, proceeding without (${j.why})`);
    process.exit(4);
  }
  const res = evaluate(j.data, sents);
  for (const r of res.rows) {
    for (const t of r.invented) console.log(`${tag} sentence ${r.n}: INVENTED claim "${t.triple}" (${t.evidence || "absent"})`);
    for (const t of r.partial) console.log(`${tag} sentence ${r.n}: PARTIAL claim "${t.triple}" (${t.evidence || "?"}) — accepted`);
    if (r.missing) console.log(`${tag} sentence ${r.n}: the judge returned no verdict for it`);
  }
  console.log(`${tag}: claims — ${sents.length} sentences, ${res.triples} triples, ${res.invented} INVENTED, ${res.partial} PARTIAL → ${res.invented ? "FAIL" : "PASS"}`);
  for (const l of feedbackLines(res)) console.log(l);
  if (res.invented && blockedDir) {
    console.log(`${tag}: invented claims after the re-ask, skipping this channel this run`);
    mkdirSync(blockedDir, { recursive: true });
    const text = (script.sections || []).map((x) => `[${x.id}] ${x.voiceover}`).join("\n");
    writeFileSync(join(blockedDir, `blocked-claims-${ch}.txt`), `INVENTED claims after the re-ask — ch-${ch}, ${scriptPath} (${new Date().toISOString()}). The channel was SKIPPED this run; nothing was rendered or uploaded.\n\n${feedbackLines(res).join("\n")}\n\nScript:\n${text}\n`);
  }
  process.exit(res.invented ? 2 : 0);
}

module.exports = { researchText, promptFor, evaluate, feedbackLines };
if (require.main === module) main().catch((e) => { console.log(`[script] claim check unavailable, proceeding without (${e.message})`); process.exit(4); });
