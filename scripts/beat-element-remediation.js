#!/usr/bin/env node
/**
 * beat-element-remediation.js — name the one wrong element of a rejected beat,
 * and propose its replacement.
 *
 * What this is for. The challenger (scripts/gemini-visual-challenger.js) rejects a
 * plan per BEAT: beat 3 is a MISMATCH, here is why. Until now the correction the
 * re-planner received was the same sentence for every rejected beat —
 * "re-plan this beat so its subject, change and on-screen text show exactly what
 * the sentence says" (scripts/render-and-qa.js). One generic instruction for N
 * beats gives the planner N identical edits and no indication which FIELD of the
 * beat is at fault, so a wrong visual_type gets "fixed" by rewriting the headline.
 *
 * This turns that into one decision per failing element: which field the beat
 * actually gets wrong, and what it should say instead. It is DECISIONS only — the
 * planner still owns the whole plan, and the renderer still re-renders the whole
 * video. Nothing here re-renders anything.
 *
 * Per-element, not per-beat, for one measured reason: scripts/validate-script-claims.cjs
 * reached the same decision from the other direction and documented it — "One call,
 * not one per triple: ~20 triples x 6 channels per run would spend the free-tier
 * quota the planner needs". The difference is scope. That file judges every
 * sentence of every video whether or not anything failed; this runs only on beats
 * the challenger already blocked, so a normal run spends zero calls and a rejected
 * beat spends one per failing element, not twenty per script.
 *
 * The addressable vocabulary is not invented here. It is the set of fields the
 * renderer actually reads, taken from renderedAs() in scripts/render-and-qa.js:645
 * — a field outside that list produces no visible change, which is the exact
 * failure enforceAdjustments() was written to catch. A proposed element that is
 * not in this list, or not present on that beat, is REJECTED and the beat is
 * reported unresolved.
 *
 * Nothing here can approve anything. Every path that does not produce a concrete,
 * valid replacement returns no correction for that element and records why. An
 * unanswered question is not evidence the beat was fine, so it can never be
 * rounded up to a pass — the same rule gemini-visual-challenger.js:104 states for
 * its own verdicts.
 *
 * What this deliberately does NOT do:
 *
 * - It does not re-render part of a video. render-and-qa.js still re-renders the
 *   whole video on every attempt; this only decides WHAT each rejection asks for.
 *   Partial re-render is a renderer change and is not attempted here.
 * - It does not give Ollama a veto, or ask Gemini to approve an Ollama answer.
 *   cedb63e rejected veto-only on measured evidence (run 37349640976: Ollama
 *   scored both fixtures 2/10 and fabricated a 100% TEMPLATE_MONOCULTURE signal
 *   Gemini measures at 25%), and this adds no such path back.
 * - For an element whose current value is an OBJECT (data, named_entities), the
 *   replacement arrives as a JSON STRING, e.g. "{\"value\":250000}". The
 *   re-planner reads corrections as prose — gemini-visual-plan.js:668 interpolates
 *   c.fix — so a string is the shape it actually consumes, but the correction is
 *   therefore not machine-diffable against the beat.
 *
 * Usage:
 *   node scripts/beat-element-remediation.js --plan <plan.json> \
 *        --review <challenge.json> --out <corrections.json>
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * Fields a beat renders from, per renderedAs() in scripts/render-and-qa.js:645.
 * canvas, photo, persists_from and match_cut_prev are deliberately excluded: the
 * first is the whole layout and the last three are set by the asset resolver, not
 * by the planner, so a correction naming them would describe something no
 * re-planning attempt can act on.
 */
export const ADDRESSABLE_ELEMENTS = [
  "visual_type",
  "kind",
  "headline",
  "lead_in",
  "data",
  "composition",
  "motion_tier",
  "camera_focus",
  "named_entities",
];

const BLOCKING = new Set(["MISMATCH", "CONTRADICTION"]);

/** A sub-task answers with one element and one replacement. Nothing wider. */
const MAX_TOKENS_PER_ELEMENT = 220;

function blockingBeats(review) {
  return (review?.beats || []).filter((b) => b && BLOCKING.has(b.verdict));
}

function describeElement(beat, element) {
  const v = beat?.[element];
  if (v === undefined || v === null) return "(absent)";
  if (typeof v === "string") return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

/**
 * Zero-shot, and labelled blocks. No worked examples: a 3B-14B local model copies
 * data points out of examples and into its answer (docs/V2-NARRATIVE-SCRIPT-GREEN.md
 * records qwen2.5:3b repeating the prompt's example sentence for exactly this
 * reason). The blocks are separated because the models that end up answering here
 * are small enough that an unlabelled instruction block reads as prose to be
 * continued rather than a rule to be followed.
 */
function buildElementPrompt(beat, sentence, elements, verdict, reason) {
  return [
    "ROLE",
    "You name the single wrong field of one beat of a YouTube Short's visual plan, and propose its replacement.",
    "",
    "OBJECTIVE",
    `Beat ${beat.__index} was rejected as ${verdict}: ${reason}`,
    `The narration sentence it must serve is: "${sentence || "(none)"}"`,
    "Name exactly ONE field from the list below that is the reason this beat fails, and write the value that field should hold instead.",
    "",
    "CONSTRAINTS",
    "- Answer with ONE element. A beat can fail for one reason; if you cannot name the field, answer with null.",
    "- The replacement must be the field's value, not a description of the change and not a sentence about the beat.",
    "- The replacement must show what the narration sentence says. Do not add a claim the sentence does not make.",
    "- Keep the channel's existing visual approach. Change only what is wrong.",
    "- Do not return markdown, commentary, or any field outside the list.",
    "",
    "INPUT",
    `available elements: ${elements.join(", ")}`,
    ...elements.map((el) => `  ${el} = ${describeElement(beat, el)}`),
    "",
    "RESPONSE (JSON only)",
    '{"element":"<one element from the list or null>","replacement":"<the value that field should hold>","reason":"<one sentence>"}',
  ].join("\n");
}

function stripFences(text) {
  return String(text).trim()
    .replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
}

/**
 * Normalise an answer to an object, or null.
 *
 * Three real shapes reach here and they are not interchangeable:
 *   - an already-parsed object. gemini-client.js:240 documents callGemini as
 *     returning "Parsed JSON response", and ollama-client.cjs:134 returns a
 *     parsed object whenever its answer was JSON. This is the common case on a
 *     healthy Gemini key, and reading it as a string yields null — which is how
 *     a live run answered, used 326 tokens, and still reported "unparseable".
 *   - { content: "<json string>" } — gemini-client.js:510, and ollama's
 *     non-JSON fallback. The JSON is inside a string here.
 *   - a bare string, for a caller that injects a raw answer.
 *
 * A provider error object ({ source, error, detail }) has none of these keys and
 * must fall through to null: it is a failure to report, never a proposal.
 */
function parseAnswer(answer) {
  if (answer === null || answer === undefined) return null;
  if (typeof answer === "string") {
    const t = stripFences(answer);
    if (!t) return null;
    try { return JSON.parse(t); } catch { return null; }
  }
  if (typeof answer !== "object") return null;
  if ("element" in answer) return answer;
  const nested = answer.content ?? answer.response;
  if (typeof nested === "string") {
    const t = stripFences(nested);
    if (!t) return null;
    try { return JSON.parse(t); } catch { return null; }
  }
  if (nested && typeof nested === "object") return nested;
  return null;
}

/**
 * Validate one proposed element against the beat it belongs to. Returns a
 * correction, or null with the reason — never a correction built from a rejected
 * answer, because a correction that names a field nothing renders from is how a
 * re-plan "responds" while producing an identical video.
 */
function validate(beat, parsed) {
  if (!parsed || typeof parsed !== "object") return { error: "unparseable answer" };
  const element = parsed.element;
  if (element === null || element === undefined || element === "") return { error: "no element named" };
  if (!ADDRESSABLE_ELEMENTS.includes(element)) return { error: `element "${element}" is not one a beat renders from` };
  if (!(element in beat)) return { error: `element "${element}" is not on this beat` };
  const replacement = parsed.replacement;
  if (typeof replacement !== "string" || !replacement.trim()) return { error: `no replacement value for "${element}"` };
  return {
    element,
    replacement: replacement.trim(),
    correction: {
      beat: beat.__index,
      element,
      problem: `${beat.__verdict} on ${element}: current value "${describeElement(beat, element)}" (${beat.__reason})`,
      fix: `set ${element} to "${replacement.trim()}" so the beat shows exactly what its sentence says`,
    },
  };
}

async function defaultAsk(prompt) {
  const { callLLM } = await import("../src/lib/llm.js");
  return callLLM([{ role: "user", content: prompt }], {
    maxTokens: MAX_TOKENS_PER_ELEMENT,
    temperature: 0,
    keepAlive: 0,
    capKind: "challenger",
  }, "element-remediation");
}

/**
 * One decision per blocking beat. Beats the challenger passed are never sent —
 * a correction for a beat that passed is how a re-plan rewrites working beats
 * (run 36416582506: ch-1 beat 0 then beat 4; ch-44 beat 5 then beat 9).
 *
 * `ask` is injectable so this is testable without a provider, and so a caller can
 * pin a provider the way a1-discrimination.yml does.
 */
export async function remediateBlockingBeats({ beats = [], sentences = [], review, ask = defaultAsk }) {
  const blocking = blockingBeats(review);
  const corrections = [];
  const unresolved = [];
  if (!blocking.length) return { corrections, unresolved };

  for (const verdict of blocking) {
    const index = Number(verdict.beat_index);
    const beat = beats[index];
    if (!beat) { unresolved.push({ beat: index, why: "verdict names a beat the plan does not have" }); continue; }
    const present = ADDRESSABLE_ELEMENTS.filter((el) => el in beat);
    if (!present.length) { unresolved.push({ beat: index, why: "no addressable element on this beat" }); continue; }

    const tagged = { ...beat, __index: index, __verdict: verdict.verdict, __reason: verdict.reason };
    let answer;
    try { answer = await ask(buildElementPrompt(tagged, sentences[index], present, verdict.verdict, verdict.reason)); }
    catch (e) { unresolved.push({ beat: index, why: `sub-task failed: ${String(e.message || e).slice(0, 160)}` }); continue; }

    const checked = validate(tagged, parseAnswer(answer));
    if (checked.error) { unresolved.push({ beat: index, why: checked.error }); continue; }
    corrections.push(checked.correction);
  }

  return { corrections, unresolved };
}

function arg(name, argv = process.argv) {
  const i = argv.indexOf("--" + name);
  return i > -1 && argv[i + 1] ? argv[i + 1] : null;
}

/**
 * True only when this file is the program being run.
 *
 * process.argv[1] is undefined under `node -e` and under some embedders, so it
 * cannot be dereferenced unguarded: doing that made this module throw on import
 * while the test suite stayed green, because `node --test` always supplies
 * argv[1]. Resolving both sides to file URLs compares paths rather than matching
 * a filename suffix, so a copy of this script elsewhere does not run on import.
 */
export function isMainModule(argv) {
  const entry = argv?.[1];
  if (!entry) return false;
  try { return pathToFileURL(entry).href === import.meta.url; } catch { return false; }
}

function srtSentences(srtPath) {
  return readFileSync(srtPath, "utf-8").replace(/\r/g, "").split(/\n\n+/)
    .map((b) => b.trim().split("\n")).filter((l) => l.length >= 3)
    .map((l) => l.slice(2).join(" "));
}

async function main() {
  const planPath = arg("plan");
  const reviewPath = arg("review");
  const srtPath = arg("srt");
  const outPath = arg("out");
  if (!planPath || !reviewPath || !outPath) {
    console.error("Usage: beat-element-remediation.js --plan <plan.json> --review <challenge.json> --srt <vo.srt> --out <corrections.json>");
    process.exit(2);
  }
  const plan = JSON.parse(readFileSync(planPath, "utf-8"));
  const review = JSON.parse(readFileSync(reviewPath, "utf-8"));
  const sentences = srtPath ? srtSentences(srtPath) : [];
  const { corrections, unresolved } = await remediateBlockingBeats({ beats: plan.beats || [], sentences, review });

  console.log(`[element] ${(review.beats || []).filter((b) => BLOCKING.has(b.verdict)).length} blocking beat(s) -> ${corrections.length} element correction(s)`);
  for (const c of corrections) console.log(`   beat ${c.beat} ${c.element}: ${c.fix}`);
  for (const u of unresolved) console.warn(`   UNRESOLVED beat ${u.beat}: ${u.why}`);
  if (!corrections.length) {
    // No correction means no re-plan: re-planning with no instruction re-rolls
    // the dice (scripts/render-and-qa.js:76-79).
    console.error("::error::no element-level correction could be derived — the re-plan must not run with an empty instruction");
    process.exit(3);
  }
  writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    plan: planPath,
    review: reviewPath,
    // The shape gemini-visual-plan.js:713 reads: review.corrections[].{scene|beat,problem,fix}
    corrections,
    unresolved,
  }, null, 2) + "\n");
  console.log(`[element] -> ${outPath}`);
}

if (isMainModule(process.argv)) {
  main().catch((e) => { console.error(`::error::${e.message}`); process.exit(1); });
}

export { blockingBeats, buildElementPrompt, parseAnswer, validate, BLOCKING };