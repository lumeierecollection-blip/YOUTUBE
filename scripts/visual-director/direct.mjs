#!/usr/bin/env node
/**
 * direct.mjs — the visual director: one CONSTRUCTED scene per narration beat (docs/VISUAL-DIRECTOR.md).
 *
 *   node scripts/visual-director/direct.mjs --script <script.json> --research <research.json> \
 *        [--tts <dir with <base>-vo-words.json>] --channel <id> --out <direction.json> \
 *        [--critique <critic.json> --beats 3,5]
 *
 * What it does
 *   1. Beats. The narration is split exactly as the voiceover is: narrationSections() (hook folded into
 *      section one) -> each voiceover's paragraphs (split on blank lines, as src/utils/tts.js does) -> joined
 *      with "\n\n" -> sentenceSpans(), a line-for-line port of sentence_spans() in src/utils/tts_words.py, which
 *      is what cuts the SRT cues and tags every word with its sentence. With --tts, the cues in
 *      <base>-vo-words.json ARE the beats (text + start/end of their first/last word) — the timings are the
 *      voiceover's own, never modelled. Without --tts, t_start/t_end are ESTIMATED at 2.5 words/s and the log
 *      says so; such a direction is for review only, the renderer needs a TTS run.
 *   2. Model. Gemini through src/lib/gemini-client.js (GEMINI_API_KEY_1..4, CI only). The client has no
 *      structured-output parameter, so the beat schema (from schemas/scene-direction.json) is put in the prompt
 *      and the answer is validated with ajv. Beats go in chunks of VD_BEATS_PER_CALL (default 8) with the full
 *      narration as context. Model: VD_MODEL (default gemini-3.5-flash-lite, the client's default).
 *   3. Gates. scripts/visual-director/gate.mjs. Any failure (schema or hard gate) goes back to the model ONCE
 *      as a corrective retry naming the failures; per beat the version with fewer failures is kept. A schema
 *      failure that survives fails the run loudly (exit 1, <out>.failed.json written for evidence). Hard-gate
 *      failures that survive are written to the output as `gate_failures` — no beat is ever dropped.
 *   4. Re-direct (--critique + --beats): the existing direction at --out is read; ONLY the listed beats are
 *      re-directed, given the critic's verdict and reasons, with an instruction to delete-and-rebuild rather than
 *      patch. Every other beat is copied byte-identical. Rebuilt beats get status "rebuilt" and a critic_history
 *      entry. The critic.json shape belongs to critic.mjs; entries are read from .scenes / .beats / .verdicts /
 *      a top-level array, keyed by beat_index (or beat / index).
 *
 * What it deliberately does NOT do: resolve or verify materials (materials/ does), choose colours
 * (config/channels.json), or invent facts — the prompt carries the research facts with their URLs and the gate
 * rejects evidence / data URLs outside the script's sources_used.
 *
 * Deterministic normalisation (timing contract, not creative choice): beat_index / sentence / t_start / t_end
 * are overwritten from the narration; shot ids are renumbered b<beat>s<n>; shot durations are scaled to sum to
 * the beat's duration.
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, basename, resolve, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { narrationSections } from "../../src/utils/script-narration.js";
import { gateDirection, implicatedBeats, schemaFailures } from "./gate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCHEMA = JSON.parse(readFileSync(join(ROOT, "schemas", "scene-direction.json"), "utf8"));
const PROMPT_PATH = join(ROOT, "prompts", "visual-director.md");
const EST_WORDS_PER_S = 2.5;
const readJ = (p) => JSON.parse(readFileSync(p, "utf8"));
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();

// ── beats ─────────────────────────────────────────────────────────
const ABBREV = new Set(["u.s.", "u.k.", "e.u.", "u.n.", "mr.", "mrs.", "ms.", "dr.", "st.", "jr.", "sr.", "vs.", "e.g.", "i.e.",
  "inc.", "no.", "co.", "corp.", "ltd.", "etc.", "approx.", "dept.", "gov.", "sen.", "rep.", "gen.", "a.m.", "p.m."]);

/** Port of sentence_spans() in src/utils/tts_words.py — keep the two in step. -> [[start, end]] */
export function sentenceSpans(text) {
  const spans = []; let start = 0;
  const re = /[.!?]+["')\]]*(?=\s)|\n\s*\n/g;
  let m;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length;
    if (".!?".includes(m[0][0])) {
      const parts = text.slice(0, end).split(/\s+/).filter(Boolean);
      const tok = (parts.length ? parts[parts.length - 1].toLowerCase() : "").replace(/^["')\]]+|["')\]]+$/g, "");
      if (ABBREV.has(tok) || /^(?:[a-z]\.){1,3}$/.test(tok)) continue;
    }
    if (text.slice(start, end).trim()) spans.push([start, end]);
    start = end;
  }
  if (text.slice(start).trim()) spans.push([start, text.length]);
  return spans;
}

/** The text the voiceover speaks, assembled as src/utils/tts.js parseScriptForTTS + generateTTS do. */
export function narrationText(script) {
  const paras = [];
  for (const s of narrationSections(script)) if (s.voiceover) for (const p of String(s.voiceover).split(/\n\n+/)) if (p.trim()) paras.push(p.trim());
  return paras.join("\n\n");
}

/** -> [{ text }] one per beat, in the voiceover's own sentence split. */
export function splitNarration(script) {
  const text = narrationText(script);
  return sentenceSpans(text).map(([a, b]) => ({ text: norm(text.slice(a, b)) }));
}

/** Word timings of this script's voiceover. -> { sentences:[{text,start,end}], voiceoverEnd, file } ; throws when --tts has none. */
export function readTimings(ttsDir, scriptPath) {
  const base = basename(scriptPath, ".json");
  const want = join(ttsDir, `${base}-vo-words.json`);
  let file = existsSync(want) ? want : null;
  if (!file) {
    const any = existsSync(ttsDir) ? readdirSync(ttsDir).filter((f) => f.endsWith("-vo-words.json")) : [];
    if (any.length === 1) file = join(ttsDir, any[0]);
    else throw new Error(`--tts ${ttsDir}: no ${base}-vo-words.json${any.length ? ` (found ${any.length} other words files; not guessing)` : ""}`);
  }
  const doc = readJ(file);
  const words = Array.isArray(doc) ? doc : doc.words || [];
  let sentences = Array.isArray(doc.sentences) ? doc.sentences.map((c) => ({ text: norm(c.text), start: +c.start, end: +c.end })) : [];
  if (!sentences.length && words.length && words.every((w) => Number.isInteger(w.sentence))) {
    const by = new Map();
    for (const w of words) by.set(w.sentence, [...(by.get(w.sentence) || []), w]);
    sentences = [...by.keys()].sort((a, b) => a - b).map((k) => { const ws = by.get(k); return { text: norm(ws.map((w) => w.text || w.word).join(" ")), start: +ws[0].start, end: +ws[ws.length - 1].end }; });
  }
  if (!sentences.length) throw new Error(`${file}: no sentence cues and no per-word sentence index — cannot time beats`);
  const ends = words.map((w) => +w.end).filter(Number.isFinite);
  const voiceoverEnd = ends.length ? Math.max(...ends) : Math.max(...sentences.map((s) => s.end));
  return { sentences, voiceoverEnd, file };
}

/** Beats with times: from the voiceover's cues when given, else estimated (logged). */
export function timedBeats(script, timings = null) {
  const split = splitNarration(script);
  if (timings) {
    const warn = split.length !== timings.sentences.length || split.some((s, i) => norm(s.text) !== norm(timings.sentences[i]?.text))
      ? `narration split (${split.length}) and voiceover cues (${timings.sentences.length}) differ; the voiceover's cues are used — they are what is spoken` : null;
    return { sentences: timings.sentences, source: "tts", voiceoverEnd: timings.voiceoverEnd, warn };
  }
  let t = 0;
  const sentences = split.map((s) => { const d = Math.max(1, s.text.split(/\s+/).length / EST_WORDS_PER_S); const o = { text: s.text, start: +t.toFixed(3), end: +(t + d).toFixed(3) }; t += d; return o; });
  return { sentences, source: "estimated", voiceoverEnd: null, warn: `no --tts: timings ESTIMATED at ${EST_WORDS_PER_S} words/s (review only; render needs the voiceover's word timings)` };
}

// ── research / context ────────────────────────────────────────────
export function researchDigest(research) {
  const r = research || {};
  const facts = (r.key_facts || []).map((f) => ({ fact: norm(f.fact), source_url: f.source_url || null, source_name: f.source_name || f.source || null }));
  const numbers = (r.numbers || []).map((n) => ({ label: n.label, value: n.value, unit: n.unit, source_url: n.source_url || null }));
  const entities = (r.named_entities || []).map((e) => ({ name: e.name, kind: e.kind }));
  return { facts, numbers, entities };
}

export function contextFor({ scriptPath, researchPath = null, ttsDir = null }) {
  const script = readJ(scriptPath);
  const research = researchPath && existsSync(researchPath) ? readJ(researchPath) : null;
  const timings = ttsDir ? readTimings(ttsDir, scriptPath) : null;
  const tb = timedBeats(script, timings);
  const digest = researchDigest(research);
  const sourcesUsed = Array.isArray(script.sources_used) ? script.sources_used.map(String) : [];
  return { script, research, digest, timings, ...tb, sourcesUsed, gate: { sentences: tb.sentences, voiceoverEnd: tb.voiceoverEnd, sourcesUsed, namedEntities: digest.entities } };
}

function channelFor(id) {
  try {
    const c = readJ(join(ROOT, "config", "channels.json"));
    const arr = Array.isArray(c) ? c : c.channels || Object.values(c);
    return arr.find((x) => String(x.id) === String(id) || String(x.channel_id) === String(id)) || null;
  } catch { return null; }
}

async function referenceFor(channelId) {
  try {
    const m = await import("../reference/channel-direction.mjs");
    const loaded = m.loadChannelDirection(channelId);
    const sum = m.directionSummary(loaded);
    return { stem: loaded.refs?.[0]?.stem || null, text: sum.text || "", why: sum.why || null };
  } catch (e) { return { stem: null, text: "", why: `channel-direction unavailable: ${e.message}` }; }
}

// ── prompt ────────────────────────────────────────────────────────
/** The beat definition with $refs inlined, minus the fields the director never writes. */
export function beatSchemaForPrompt() {
  const defs = SCHEMA.definitions;
  const inline = (o) => {
    if (Array.isArray(o)) return o.map(inline);
    if (!o || typeof o !== "object") return o;
    if (o.$ref) return inline(defs[o.$ref.split("/").pop()]);
    const out = {};
    for (const [k, v] of Object.entries(o)) if (k !== "description") out[k] = inline(v);
    return out;
  };
  const b = inline(defs.beat);
  delete b.properties.status; delete b.properties.critic_history;
  delete b.properties.shots.items.properties.materials.items.properties.resolved;
  return b;
}

const GATE_RULES = [
  "- one beat per sentence; beat_index / sentence / t_start / t_end copied exactly",
  "- `statement` (typography carries the beat) on at most min(2, 20% of beats) beats",
  "- no mechanism family on more than 40% of beats; adjacent beats never share family AND camera-move sequence",
  "- a chart / number / timeline only as `kind: data` with data.values whose source_url is in SOURCES USED, and only on a sentence that compares quantities",
  "- every named person / place / organisation / artefact in the sentence appears in some material's must_show",
  "- reveal / context-reveal / scale-reveal start close and end wide; comparisons establish A then B; `hold` states its reason",
  "- every shot's `action` is something physical happening to that shot's materials (name them); text never stands in for a picture",
  "- no gradients, glows, particles, lens flares, icons, UI panels, cards, floating labels, decorative lines, infographics",
  "- no colour of any kind (hex, rgb, colour grade, tint)",
  "- `evidence` URLs only from SOURCES USED",
].join("\n");

export function buildPrompt({ channel, channelId, sentences, targets, digest, sourcesUsed, reference, context = [], critiques = null, failures = null }) {
  const tpl = readFileSync(PROMPT_PATH, "utf8");
  const ch = channel || {};
  const channelBlock = [`id: ${channelId}`, ch.channel_name && `name: ${ch.channel_name}`, ch.niche && `niche: ${ch.niche}`, ch.style && `visual style: ${ch.style}`,
    ch.tone && `tone: ${typeof ch.tone === "string" ? ch.tone : JSON.stringify(ch.tone)}`, ch.target_audience && `audience: ${typeof ch.target_audience === "string" ? ch.target_audience : JSON.stringify(ch.target_audience)}`].filter(Boolean).join("\n");
  const list = (arr, f) => (arr.length ? arr.map(f).join("\n") : "(none)");
  const narration = sentences.map((s, i) => `[${i}] ${s.text}`).join("\n");
  const targetBeats = targets.map((i) => `beat_index ${i}  t_start ${sentences[i].start}  t_end ${sentences[i].end}  (duration ${(sentences[i].end - sentences[i].start).toFixed(2)} s)\nsentence: ${JSON.stringify(sentences[i].text)}`).join("\n\n");
  const ctx = context.length ? `## OTHER BEATS ALREADY DIRECTED (vary against these: family / camera)\n\n${context.map((b) => `[${b.beat_index}] ${b.mechanism?.family} | camera ${(b.shots || []).map((s) => s.camera?.move).join(">")} | ${norm(b.mechanism?.construction).slice(0, 120)}`).join("\n")}\n\n` : "";
  let crit = "";
  if (critiques && Object.keys(critiques).length) {
    crit += "## CRITIC VERDICTS ON YOUR PREVIOUS SCENES FOR THESE BEATS\n\nThe previous scene for each beat below was judged on rendered frames. Do NOT patch it (no added labels, glow, particles, captions). Delete it and construct a fresh scene from the sentence: a different construction and different materials; change the mechanism family unless the critic says the family was right. The previous construction is shown only so you do not repeat it.\n\n";
    for (const [bi, c] of Object.entries(critiques)) crit += `[${bi}] previous: ${c.previous ? `${c.previous.mechanism?.family} — ${norm(c.previous.mechanism?.construction).slice(0, 300)}` : "(none)"}\ncritic: ${JSON.stringify(c.verdict).slice(0, 1500)}\n\n`;
  }
  if (failures && failures.length) {
    crit += "## YOUR PREVIOUS ANSWER FAILED THESE CHECKS — fix every one (reconstruct the scene where the failure is about meaning)\n\n" + failures.map((f) => `- beat ${f.beat_index ?? "*"} ${f.rule}: ${f.detail}`).join("\n") + "\n\n";
  }
  const vars = {
    channel_name: ch.channel_name || `channel ${channelId}`, channel_niche: ch.niche || "unknown niche", channel_style: ch.style || "documentary",
    gate_rules: GATE_RULES, reference_direction: reference?.text ? `## REFERENCE DIRECTION (technique only — never copy its content)\n\n${reference.text}` : "",
    channel_block: channelBlock, narration,
    facts: list(digest.facts, (f) => `- ${f.fact} — ${f.source_url || `(no URL: ${f.source_name || "unnamed source"}; not citable as evidence)`}`),
    numbers: list(digest.numbers, (n) => `- ${n.label}: ${n.value} ${n.unit || ""} — ${n.source_url || "(no URL)"}`),
    entities: list(digest.entities, (e) => `- ${e.name} (${e.kind})`),
    sources: list(sourcesUsed, (u) => `- ${u}`),
    context_beats: ctx, critique: crit, target_beats: targetBeats, beat_schema: JSON.stringify(beatSchemaForPrompt()),
  };
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : `{{${k}}}`));
}

// ── model ─────────────────────────────────────────────────────────
export async function defaultCallModel(messages, opts) {
  const { callGemini } = await import("../../src/lib/gemini-client.js");
  // _noOllamaFirst: this is a writing stage (it decides what the video shows); Gemini answers, as for the script.
  return callGemini(messages, { maxTokens: 16000, temperature: 0.4, tag: "visual-director", _noOllamaFirst: true, ...opts });
}

function parseAnswer(r) {
  if (r && r.source === "gemini" && r.error) throw new Error(`model call failed: ${r.error} ${r.detail || ""}`);
  let o = r;
  if (r && typeof r.content === "string" && !r.beats) {
    const s = r.content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    o = JSON.parse(s);
  }
  if (typeof r === "string") o = JSON.parse(r.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, ""));
  if (Array.isArray(o)) o = { beats: o };
  if (!o || !Array.isArray(o.beats)) throw new Error(`model answer has no beats array: ${JSON.stringify(r).slice(0, 200)}`);
  return o.beats;
}

/** Deterministic normalisation of one model beat onto narration beat i. */
export function normaliseBeat(raw, i, sent, status = "directed", history = undefined) {
  const b = { ...(raw || {}) };
  delete b.status; delete b.critic_history;
  b.beat_index = i; b.sentence = sent.text; b.t_start = sent.start; b.t_end = sent.end;
  const dur = sent.end - sent.start;
  if (Array.isArray(b.shots)) {
    const sum = b.shots.reduce((a, s) => a + (+s?.duration_s > 0 ? +s.duration_s : 0), 0);
    b.shots = b.shots.map((s, k) => {
      const o = { ...s, id: `b${i}s${k}` };
      if (dur > 0) o.duration_s = +(sum > 0 && +s?.duration_s > 0 ? (+s.duration_s / sum) * dur : dur / b.shots.length).toFixed(3);
      if (Array.isArray(o.materials)) o.materials = o.materials.map((m) => { const c = { ...m }; delete c.resolved; return c; });
      return o;
    });
  }
  const ordered = {};
  for (const k of ["beat_index", "sentence", "t_start", "t_end", "semantic", "visual_question", "mechanism", "shots", "mute_test", "evidence", "reference_cues"]) if (k in b) ordered[k] = b[k];
  for (const k of Object.keys(b)) if (!(k in ordered)) ordered[k] = b[k];
  ordered.status = status;
  if (history) ordered.critic_history = history;
  return ordered;
}

const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

/** Ask the model for `targets`; returns Map(beat_index -> raw beat). Throws (loudly) on an unusable answer after one retry. */
async function askBeats({ callModel, log, base, targets, per, contextOf, failures = null }) {
  const out = new Map();
  for (const part of chunk(targets, per)) {
    const prompt = buildPrompt({ ...base, targets: part, context: contextOf(part), failures: failures && failures.filter((f) => f.beat_index === null || part.includes(f.beat_index)), critiques: base.critiques && Object.fromEntries(Object.entries(base.critiques).filter(([k]) => part.includes(+k))) });
    let beats = null, err = null;
    for (let attempt = 0; attempt < 2 && !beats; attempt++) {
      const p = attempt === 0 ? prompt : `${prompt}\n\n## YOUR PREVIOUS ANSWER WAS UNUSABLE\n\n${err}\nReturn ONLY {"beats": [...]} with exactly ${part.length} beat object(s), beat_index ${part.join(", ")}.`;
      try {
        const got = parseAnswer(await callModel([{ role: "user", content: p }], {}));
        if (got.length !== part.length) throw new Error(`expected ${part.length} beats (${part.join(", ")}), got ${got.length}`);
        beats = got;
      } catch (e) { err = e.message; log(`[vd-direct] beats ${part.join(",")}: attempt ${attempt + 1} unusable: ${err}`); }
    }
    if (!beats) throw new Error(`beats ${part.join(",")}: no usable model answer after the corrective retry: ${err}`);
    part.forEach((bi, k) => out.set(bi, beats[k]));
  }
  return out;
}

function critiqueEntries(critic) {
  const arr = Array.isArray(critic) ? critic : critic?.scenes || critic?.beats || critic?.verdicts || critic?.results || [];
  const m = {};
  for (const e of arr) { const bi = e?.beat_index ?? e?.beat ?? e?.index; if (Number.isInteger(+bi)) m[+bi] = e; }
  return m;
}

/**
 * The director. Pure apart from callModel and the files it is pointed at.
 *  -> { direction, failures }   throws on an unrecoverable model/schema failure.
 */
export async function direct({ scriptPath, researchPath = null, ttsDir = null, channelId, previous = null, critique = null, beats: only = null, callModel = defaultCallModel, log = (m) => console.error(m), model = process.env.VD_MODEL || "gemini-3.5-flash-lite", per = +(process.env.VD_BEATS_PER_CALL || 8) }) {
  const ctx = contextFor({ scriptPath, researchPath, ttsDir });
  if (ctx.warn) log(`[vd-direct] ${ctx.warn}`);
  log(`[vd-direct] ${ctx.sentences.length} beats (timing: ${ctx.source}${ctx.timings ? `, ${relative(ROOT, ctx.timings.file)}` : ""}); ${ctx.digest.facts.length} facts, ${ctx.digest.numbers.length} numbers, ${ctx.sourcesUsed.length} sources_used`);
  if (!ctx.sourcesUsed.length) log("[vd-direct] script has no sources_used: no evidence URL and no data material can pass the gate");
  const reference = await referenceFor(channelId);
  log(reference.text ? `[vd-direct] reference direction: ${reference.stem}` : `[vd-direct] no reference direction: ${reference.why}`);
  const callM = (messages, opts) => callModel(messages, { model, ...opts });

  const n = ctx.sentences.length;
  const redirect = !!(critique && only);
  if (redirect && !previous) throw new Error("--critique/--beats need an existing direction at --out to re-direct");
  if (redirect && previous.beats.length !== n) throw new Error(`existing direction has ${previous.beats.length} beats, narration has ${n}`);
  const targets = redirect ? [...new Set(only)].filter((i) => i >= 0 && i < n).sort((a, b) => a - b) : [...Array(n).keys()];
  if (redirect && targets.length !== new Set(only).size) throw new Error(`--beats ${only.join(",")} outside 0..${n - 1}`);

  const crit = redirect ? critiqueEntries(critique) : {};
  const critiques = redirect ? Object.fromEntries(targets.map((i) => [i, { previous: previous.beats[i], verdict: crit[i] || { note: "no critic entry for this beat; rebuild requested" } }])) : null;
  const base = { channel: channelFor(channelId), channelId, sentences: ctx.sentences, digest: ctx.digest, sourcesUsed: ctx.sourcesUsed, reference, critiques };
  const statusOf = (i) => (redirect ? "rebuilt" : "directed");
  const historyOf = (i) => (redirect ? [...(previous.beats[i].critic_history || []), { round: (previous.beats[i].critic_history || []).length + 1, verdict: crit[i] || null, previous: { mechanism: previous.beats[i].mechanism, shots: (previous.beats[i].shots || []).map((s) => s.id) } }] : undefined);

  const current = redirect ? previous.beats.slice() : new Array(n).fill(null);
  const contextOf = (part) => current.filter((b, i) => b && !part.includes(i));
  const make = (beatsArr) => ({ schema_version: 1, channel_id: String(channelId), script: relative(ROOT, resolve(scriptPath)).replace(/\\/g, "/"), reference: reference.stem, model, beats: beatsArr });

  // round 1
  const got = await askBeats({ callModel: callM, log, base, targets, per, contextOf });
  for (const i of targets) current[i] = normaliseBeat(got.get(i), i, ctx.sentences[i], statusOf(i), historyOf(i));
  let doc = make(current.slice());
  let failures = gateDirection(doc, ctx.gate);
  const failsOf = (fs, i) => fs.filter((f) => f.beat_index === i);
  log(`[vd-direct] round 1: ${failures.length} gate failure(s)${failures.length ? ` — ${[...new Set(failures.map((f) => f.rule))].join(", ")}` : ""}`);

  // one corrective retry, only on the beats being directed
  const retry = implicatedBeats(failures, doc).filter((i) => targets.includes(i));
  if (retry.length) {
    log(`[vd-direct] corrective retry on beats ${retry.join(",")}`);
    const fixes = await askBeats({ callModel: callM, log, base, targets: retry, per, contextOf, failures });
    const score = (fs) => (fs.some((f) => f.rule === "schema") ? 1e6 : 0) + fs.length;
    for (const i of retry) {
      const cand = current.slice(); cand[i] = normaliseBeat(fixes.get(i), i, ctx.sentences[i], statusOf(i), historyOf(i));
      const before = score(failsOf(failures, i)), after = score(failsOf(gateDirection(make(cand), ctx.gate), i));
      if (after <= before) current[i] = cand[i];
      else log(`[vd-direct] beat ${i}: corrected version scored worse (${after} vs ${before}); kept the first`);
    }
    doc = make(current.slice());
    failures = gateDirection(doc, ctx.gate);
  }
  const schemaLeft = failures.filter((f) => f.rule === "schema");
  if (schemaLeft.length) {
    const err = new Error(`direction is not schema-valid after the corrective retry:\n${schemaLeft.slice(0, 20).map((f) => `  beat ${f.beat_index}: ${f.detail}`).join("\n")}`);
    err.direction = { ...doc, gate_failures: failures };
    throw err;
  }
  if (failures.length) doc.gate_failures = failures;
  if (schemaFailures(doc).length) throw new Error("internal: gate_failures made the direction schema-invalid");
  log(`[vd-direct] done: ${n} beats, ${failures.length} gate failure(s) recorded${failures.length ? `: ${failures.map((f) => `b${f.beat_index ?? "*"} ${f.rule}`).join("; ")}` : ""}`);
  return { direction: doc, failures };
}

// ── CLI ───────────────────────────────────────────────────────────
const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : null; };
  const scriptPath = arg("script"), researchPath = arg("research"), ttsDir = arg("tts"), channelId = arg("channel"), outPath = arg("out");
  const critiquePath = arg("critique"), beatsArg = arg("beats");
  if (!scriptPath || !channelId || !outPath) {
    console.error("usage: direct.mjs --script <script.json> --research <research.json> [--tts <dir>] --channel <id> --out <direction.json> [--critique <critic.json> --beats 3,5]");
    process.exit(2);
  }
  if (!!critiquePath !== !!beatsArg) { console.error("--critique and --beats go together"); process.exit(2); }
  if (!researchPath) console.error("[vd-direct] WARNING: no --research — the model gets no facts and every beat can show only what the sentence states");
  try {
    const previous = critiquePath ? readJ(outPath) : null;
    const { direction } = await direct({ scriptPath, researchPath, ttsDir, channelId, previous, critique: critiquePath ? readJ(critiquePath) : null, beats: beatsArg ? beatsArg.split(",").map((s) => parseInt(s.trim(), 10)) : null });
    mkdirSync(dirname(resolve(outPath)), { recursive: true });
    writeFileSync(outPath, JSON.stringify(direction, null, 2) + "\n");
    console.error(`[vd-direct] wrote ${outPath}`);
  } catch (e) {
    console.error(`::error::[vd-direct] ${e.message}`);
    if (e.direction) { writeFileSync(`${outPath}.failed.json`, JSON.stringify(e.direction, null, 2) + "\n"); console.error(`[vd-direct] wrote ${outPath}.failed.json for evidence`); }
    process.exit(1);
  }
}
