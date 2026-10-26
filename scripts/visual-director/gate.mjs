#!/usr/bin/env node
/**
 * gate.mjs — the hard gates on a scene direction (docs/VISUAL-DIRECTOR.md §"Hard gates").
 *
 *   gateDirection(direction, ctx) -> [{ beat_index, rule, detail }]   (pure; [] = passes)
 *
 *   ctx = {
 *     sentences:      [{ text, start, end }]   the narration beats, from splitNarration() in direct.mjs
 *     voiceoverEnd:   number | null            seconds; null when there is no voiceover yet
 *     sourcesUsed:    [url]                    the script's sources_used (CLAUDE.md: every claim traces there)
 *     namedEntities:  [{ name, kind }]         research named_entities, when the research has them
 *   }
 *
 * CLI: node scripts/visual-director/gate.mjs --direction <direction.json> --script <script.json>
 *        [--research <research.json>] [--tts <dir>]     exits 1 and prints every failure when any gate fails.
 *
 * Rules (ids are what direct.mjs feeds back to the model and writes to gate_failures):
 *   schema             ajv against schemas/scene-direction.json
 *   beat-count         one beat per narration sentence
 *   sentence           beat.sentence is the narration sentence verbatim (whitespace-normalised)
 *   timing             t_start < t_end, beats in order, inside the voiceover (0.25 s tolerance)
 *   shot-id            shot ids are b<beat_index>s<n>
 *   shot-durations     a beat's shot durations add up to its t_end - t_start (within 15 % / 0.3 s)
 *   statement-cap      'statement' on at most min(2, floor(20 % of beats)) beats
 *   family-share       no mechanism family on more than 40 % of beats (only checked from 3 beats up:
 *                      with 1-2 beats every family is >40 % by arithmetic)
 *   adjacent-repeat    two adjacent beats with the same family AND the same camera-move sequence
 *   data-unsourced     a kind:data material without data.values, or a value whose source_url is not in sources_used
 *   data-not-quantity  a kind:data material on a sentence that compares no quantities
 *   chart-outside-data a chart / graph / timeline / counter / giant number in a construction, action or must_show
 *                      with no kind:data material on the beat
 *   evidence-unsourced an evidence URL that is not in sources_used
 *   entity-unshown     a named person / place / organisation / artefact in the sentence that no material's must_show names
 *   material-unfindable a material whose must_show / search asks for a screenshot, webpage, docs page or press release:
 *                      no licensed archive holds those, so the resolver can only fail; name the picture itself instead
 *   camera-motivation  reveal / context-reveal / scale-reveal without a close-to-wide move; comparative-transformation
 *                      with one unmoving framing; a 'hold' whose motivation gives no reason
 *   action-unanchored  a shot action that names none of the shot's materials (text standing in for a picture)
 *   reject-list        decorative slop in the construction/action: gradients, glows, particles, lens flares, icons,
 *                      UI panels / cards, floating labels, decorative lines, "infographic"
 *   colour             a colour value (hex, rgb(), hsl()) or a colour-grade instruction anywhere in the direction
 *
 * Where the guarantees stop (said plainly, per CLAUDE.md):
 *   - entity-unshown finds names by capitalisation (plus research named_entities when present). A lower-case
 *     artefact ("the tapestry") is not detected; a capitalised non-entity at a sentence start is only counted
 *     when it is part of a multi-word name. Months and weekdays are ignored.
 *   - data-not-quantity counts digits / number words / comparison words; it cannot tell a real comparison from a
 *     sentence that merely contains two numbers.
 *   - reject-list and chart-outside-data are keyword checks on the director's own words. They catch a direction
 *     that SAYS "bar chart"; whether the render looks like one is the critic's question, on CI frames.
 *   - action-unanchored checks word overlap with must_show / material ids, not that the action is physical.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv from "ajv";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCHEMA_PATH = join(ROOT, "schemas", "scene-direction.json");

let validator = null;
export function schemaValidator() {
  if (!validator) {
    const ajv = new Ajv({ allErrors: true, strict: false, useDefaults: false });
    validator = ajv.compile(JSON.parse(readFileSync(SCHEMA_PATH, "utf8")));
  }
  return validator;
}

/** ajv errors -> gate failures, attributed to a beat when the path is inside one. */
export function schemaFailures(direction) {
  const v = schemaValidator();
  if (v(direction)) return [];
  return (v.errors || []).map((e) => {
    const m = /^\/beats\/(\d+)/.exec(e.instancePath || "");
    const bi = m ? direction.beats?.[+m[1]]?.beat_index : null;
    return { beat_index: Number.isInteger(bi) ? bi : (m ? +m[1] : null), rule: "schema", detail: `${e.instancePath || "/"} ${e.message}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ""}${e.params?.allowedValues ? ` (allowed: ${e.params.allowedValues.join(", ")})` : ""}` };
  });
}

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
const lc = (s) => norm(s).toLowerCase();
const STOP = new Set("the a an of and or in on at to for with from by into onto over under its it's his her their this that these those is was were are be been as than then".split(" "));
const contentWords = (s) => lc(s).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w));
const allStrings = (o, out = []) => {
  if (typeof o === "string") out.push(o);
  else if (Array.isArray(o)) o.forEach((x) => allStrings(x, out));
  else if (o && typeof o === "object") Object.entries(o).forEach(([k, v]) => { if (k !== "resolved" && k !== "critic_history") allStrings(v, out); });
  return out;
};

// ── named entities ─────────────────────────────────────────────────
const NOT_NAMES = new Set("I A An The This That These Those It Its He She They We You Our Their His Her But And Or So Yet If When While Then Here There What Why How Who Which Where Every Each Some No Not One Two Three Four Five Six Seven Eight Nine Ten Follow Subscribe From In On At By For With After Before During Since Until Under Over To As Like Even Only Just Now Today Yesterday Tomorrow".split(" "));
const MONTHS_DAYS = /^(January|February|March|April|May|June|July|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/;
const CONNECT = new Set(["of", "the", "de", "von", "van", "da", "du", "la", "le", "and", "&"]);

/** Pure. Capitalised names the sentence turns on (plus research named_entities that appear in it). */
export function namedEntitiesIn(sentence, researchEntities = []) {
  const s = String(sentence || "");
  const found = new Map();
  for (const e of researchEntities || []) {
    const name = norm(e?.name);
    if (name && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(s)) found.set(name.toLowerCase(), name);
  }
  const tokens = s.replace(/[—–]/g, " ").split(/\s+/);
  let run = [], runStartsSentence = false;
  const flush = () => {
    while (run.length && CONNECT.has(run[run.length - 1].toLowerCase())) run.pop();
    while (run.length && (CONNECT.has(run[0].toLowerCase()) || NOT_NAMES.has(run[0]))) { run.shift(); runStartsSentence = false; }
    const caps = run.filter((w) => /^[A-Z]/.test(w) && !MONTHS_DAYS.test(w));
    const ok = caps.length >= 2 || (caps.length === 1 && !runStartsSentence);
    if (ok && caps.length) {
      const name = run.join(" ");
      if (![...found.keys()].some((k) => k.includes(name.toLowerCase()) || name.toLowerCase().includes(k))) found.set(name.toLowerCase(), name);
    }
    run = []; runStartsSentence = false;
  };
  tokens.forEach((raw, i) => {
    const prevEnds = i === 0 || /[.!?:"“]$/.test(tokens[i - 1]);
    const endsHere = /[,.;:!?)"”]$/.test(raw) || /'s$|’s$/.test(raw);
    const w = raw.replace(/^[("“'‘]+/, "").replace(/['’]s$/, "").replace(/[,.;:!?)"”'’]+$/, "");
    if (!w) { flush(); return; }
    const isCap = /^[A-Z][A-Za-z\-]*$/.test(w) && !MONTHS_DAYS.test(w);
    if (isCap || (run.length && CONNECT.has(w.toLowerCase()))) {
      if (!run.length) runStartsSentence = prevEnds;
      run.push(w);
    } else flush();
    if (endsHere) flush();
  });
  flush();
  return [...found.values()];
}

const mentions = (text, name) => {
  const t = lc(text), words = contentWords(name);
  return words.length ? words.every((w) => t.includes(w)) : t.includes(lc(name));
};

// ── quantities ─────────────────────────────────────────────────────
const NUMBER = /\b\d[\d,.]*\b|\b(?:hundred|thousand|million|billion|trillion|half|double|twice|triple|percent|dozen)\b|%/gi;
const COMPARE = /\b(?:more|less|fewer|than|times|versus|vs|compared|increase[ds]?|decrease[ds]?|doubled|halved|rose|fell|grew|shrank|out of|per|ratio|share|percent)\b|%/i;
// Dates are not quantities: "September 2, 1666" and a bare year are stripped before counting.
const DATES = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?(?:\s+\d{3,4})?|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:,?\s+\d{3,4})?|\b(?:1[0-9]|20)\d{2}s?\b/g;
export function isQuantityComparison(sentence) {
  const s = String(sentence || "").replace(DATES, " ");
  const nums = s.match(NUMBER) || [];
  return nums.length >= 2 || (nums.length >= 1 && COMPARE.test(s));
}

const CHART_WORDS = /\b(?:bar chart|bar graph|pie chart|line chart|line graph|chart|graph|histogram|timeline|counter|ticker|tally|odometer|infographic|giant (?:number|figure|numeral)s?|big (?:number|figure|numeral)s?|floating (?:number|figure|numeral)s?)\b/i;
// Run 40377931670: the director asked for screenshots of Anthropic's pricing/docs pages. Commons and
// every other licensed archive hold photographs, artworks and scans of physical things — never a
// live webpage — so those materials can only resolve to "missing". Reject the request at gate time
// and let the director's corrective retry re-plan to the person / object / place itself.
const UNFINDABLE = /\b(?:screenshots?|screen shots?|screen grabs?|screen captures?|web ?pages?|websites?|home ?pages?|landing pages?|product pages?|pricing pages?|docs|documentation|docs? (?:pages?|sites?)|documentation (?:pages?|sites?)|help cent(?:er|re)|support pages?|press releases?|news (?:pages?|sites?|stor(?:y|ies)|articles?)|article pages?|blog posts?|tweets?|social media posts?|app (?:interface|screen)|user interfaces?|browser (?:window|tab)s?)\b/i;
// "a VentureBeat article by Carl Franzen" is a citation of a webpage; "a newspaper article from 1666"
// is a scan an archive can hold. Only the byline form is a dead end, and it needs real capitals.
const UNFINDABLE_BYLINE = /\b(?:articles?|posts?|stories) (?:by|from) [A-Z][a-z]/;
const REJECT = [
  [/\bgradients?\b/i, "gradient"], [/\bglow(?:s|ing)?\b/i, "glow"], [/\bparticles?\b/i, "particles"], [/\blens flares?\b/i, "lens flare"],
  [/\bicons?\b/i, "icon"], [/\b(?:ui|hud) (?:panel|element|card)s?\b|\bpanels? of (?:text|ui)\b/i, "UI panel"],
  [/\b(?:info|title|text|stat|data) cards?\b|\bcards? (?:layout|stack|grid)\b/i, "card"], [/\bfloating (?:label|text|word|tag)s?\b/i, "floating label"],
  [/\bdecorative (?:line|stroke|rule|border)s?\b/i, "decorative line"], [/\binfographic\b/i, "infographic"], [/\bnodes? (?:and|connected by) (?:lines|edges|arrows)\b|\bnode graph\b/i, "nodes"],
];
const COLOUR = [/#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?\b/i, /\brgba?\s*\(/i, /\bhsla?\s*\(/i, /\bcolou?r[- ]grade[ds]?\b|\bcolou?r grading\b|\btinted\b|\btint(?:ed)? (?:red|orange|blue|green|amber|sepia)\b/i];

const CLOSE = /\b(?:extreme close|close[- ]?up|close on|tight|macro|detail|fragment|single|one (?:piece|corner|edge))\b/i;
const WIDE = /\b(?:wide|full|whole|entire|overview|establishing|aerial|all of|everything|complete)\b/i;
const movesOf = (b) => (b.shots || []).map((s) => s.camera?.move || "?").join(">");

/** Pure. All hard-gate failures of a direction. */
export function gateDirection(direction, ctx = {}) {
  const out = [];
  const add = (beat_index, rule, detail) => out.push({ beat_index, rule, detail });
  const sch = schemaFailures(direction);
  out.push(...sch);
  const beats = Array.isArray(direction?.beats) ? direction.beats : [];
  if (!beats.length) return out;
  const sentences = ctx.sentences || null;
  const sources = new Set((ctx.sourcesUsed || []).map((u) => String(u).trim()));
  const n = beats.length;

  if (sentences && sentences.length !== n) add(null, "beat-count", `${n} beats for ${sentences.length} narration sentences`);

  let prevEnd = -Infinity;
  beats.forEach((b, i) => {
    const bi = Number.isInteger(b.beat_index) ? b.beat_index : i;
    if (b.beat_index !== i) add(bi, "beat-count", `beat at position ${i} has beat_index ${b.beat_index}`);
    if (sentences?.[i] && norm(b.sentence) !== norm(sentences[i].text)) add(bi, "sentence", `beat sentence "${norm(b.sentence).slice(0, 60)}" is not narration sentence ${i} "${norm(sentences[i].text).slice(0, 60)}"`);
    const t0 = +b.t_start, t1 = +b.t_end;
    if (!(t1 > t0)) add(bi, "timing", `t_end ${t1} is not after t_start ${t0}`);
    if (t0 < prevEnd - 0.05) add(bi, "timing", `t_start ${t0} is before the previous beat's end ${prevEnd}`);
    if (Number.isFinite(ctx.voiceoverEnd) && t1 > ctx.voiceoverEnd + 0.25) add(bi, "timing", `t_end ${t1} is past the voiceover end ${ctx.voiceoverEnd}`);
    prevEnd = Math.max(prevEnd, t1);

    const shots = Array.isArray(b.shots) ? b.shots : [];
    shots.forEach((s, k) => { if (s?.id && s.id !== `b${bi}s${k}` && !new RegExp(`^b${bi}s\\d+$`).test(s.id)) add(bi, "shot-id", `shot ${s.id} is not b${bi}s<n>`); });
    const sum = shots.reduce((a, s) => a + (+s?.duration_s || 0), 0), dur = t1 - t0;
    if (dur > 0 && Math.abs(sum - dur) > Math.max(0.3, 0.15 * dur)) add(bi, "shot-durations", `shots add up to ${sum.toFixed(2)} s for a ${dur.toFixed(2)} s beat`);

    const fam = b.mechanism?.family;
    const words = [b.mechanism?.construction, ...shots.map((s) => s?.action)].join(" ");
    const mats = shots.flatMap((s) => (Array.isArray(s?.materials) ? s.materials : []));
    const dataMats = mats.filter((m) => m?.kind === "data");

    // data / charts
    for (const m of dataMats) {
      const vals = Array.isArray(m.data?.values) ? m.data.values : [];
      if (!vals.length) add(bi, "data-unsourced", `data material ${m.id} has no data.values`);
      for (const v of vals) {
        const src = v?.source_url || m.data?.source_url;
        if (!Number.isFinite(+v?.value)) add(bi, "data-unsourced", `data material ${m.id}: value "${v?.value}" is not a number`);
        if (!src || !sources.has(String(src).trim())) add(bi, "data-unsourced", `data material ${m.id}: value ${v?.label ?? "?"} source ${src || "(none)"} is not in the script's sources_used`);
      }
      if (!isQuantityComparison(b.sentence)) add(bi, "data-not-quantity", `data material ${m.id} on a sentence that compares no quantities`);
    }
    const chartText = [words, ...mats.map((m) => m?.must_show)].join(" ");
    const cm = CHART_WORDS.exec(chartText);
    if (cm && !dataMats.length) add(bi, "chart-outside-data", `"${cm[0]}" with no kind:data material (a chart / number / timeline is legal only as sourced data)`);

    for (const u of b.evidence || []) if (!sources.has(String(u).trim())) add(bi, "evidence-unsourced", `evidence ${u} is not in the script's sources_used`);

    // named entities must be shown
    const mustShow = mats.map((m) => m?.must_show || "").join(" | ");
    if (fam !== "statement") for (const name of namedEntitiesIn(b.sentence, ctx.namedEntities)) {
      if (!mentions(mustShow, name)) add(bi, "entity-unshown", `"${name}" is named in the sentence but no material's must_show names it`);
    }

    // a picture that no licensed archive can hold is not a material, it is a dead end
    for (const m of mats) {
      const asked = `${m?.must_show || ""} ${(Array.isArray(m?.search) ? m.search : []).join(" ")}`;
      const hit = UNFINDABLE.exec(asked) || UNFINDABLE_BYLINE.exec(asked);
      if (hit) add(bi, "material-unfindable", `material ${m?.id ?? "?"}: "${hit[0]}" is a screen or document, not a picture an archive holds; name the person, object or place itself`);
    }

    // camera motivated by the mechanism
    const moves = shots.map((s) => s?.camera?.move);
    if (["reveal", "context-reveal", "scale-reveal"].includes(fam)) {
      const ok = moves.includes("pull-out") || shots.some((s) => CLOSE.test(s?.camera?.from || "") && WIDE.test(s?.camera?.to || "")) ||
        (shots.length >= 2 && CLOSE.test(shots[0]?.camera?.from || "") && WIDE.test(shots[shots.length - 1]?.camera?.to || ""));
      if (!ok) add(bi, "camera-motivation", `${fam} needs to start close and end wide (a pull-out, or close 'from' -> wide 'to'); got ${movesOf(b)}`);
    }
    if (fam === "comparative-transformation" && shots.length < 2 && !["reframe", "pan", "rack", "track", "match-cut"].includes(moves[0])) {
      add(bi, "camera-motivation", `comparison needs A, then B, then both: one ${moves[0]} shot cannot establish two things`);
    }
    shots.forEach((s) => {
      if (s?.camera?.move === "hold") {
        const mot = norm(s.camera.motivation);
        if (mot.length < 20 || /^(?:hold|static|none|n\/a|no move(?:ment)?|stay|still)\b/i.test(mot)) add(bi, "camera-motivation", `${s.id}: hold with no reason ("${mot}")`);
      }
    });

    // the action happens to the materials
    shots.forEach((s) => {
      const ms = Array.isArray(s?.materials) ? s.materials : [];
      if (!ms.length) return; // schema already reports it
      const act = lc(s.action);
      const anchored = ms.some((m) => (m?.id && act.includes(lc(m.id))) || contentWords(m?.must_show).some((w) => act.includes(w)));
      if (!anchored) add(bi, "action-unanchored", `${s.id}: action "${norm(s.action).slice(0, 80)}" names none of its materials`);
    });

    for (const [re, label] of REJECT) if (re.test(words)) add(bi, "reject-list", `${label} in the construction/action (decoration, not meaning)`);

    for (const str of allStrings(b)) for (const re of COLOUR) { const m = re.exec(str); if (m) { add(bi, "colour", `"${m[0]}" — colour comes from config/channels.json, never from a direction`); break; } }
  });

  // whole-video variety
  const cap = Math.min(2, Math.floor(0.2 * n));
  const statements = beats.filter((b) => b.mechanism?.family === "statement");
  if (statements.length > cap) for (const b of statements) add(b.beat_index, "statement-cap", `${statements.length} statement beats; at most ${cap} for ${n} beats`);
  if (n >= 3) {
    const byFam = new Map();
    beats.forEach((b) => { const f = b.mechanism?.family; if (f) byFam.set(f, [...(byFam.get(f) || []), b]); });
    for (const [f, bs] of byFam) if (bs.length / n > 0.4) add(null, "family-share", `${f} on ${bs.length}/${n} beats (${bs.map((b) => b.beat_index).join(", ")}); max 40 %`);
  }
  for (let i = 1; i < n; i++) {
    const a = beats[i - 1], b = beats[i];
    if (a.mechanism?.family && a.mechanism.family === b.mechanism?.family && movesOf(a) === movesOf(b)) add(b.beat_index, "adjacent-repeat", `same family ${b.mechanism.family} and camera ${movesOf(b)} as beat ${a.beat_index}`);
  }
  return out;
}

/** Beat indices a failure list implicates (whole-video rules implicate the beats they name). */
export function implicatedBeats(failures, direction) {
  const set = new Set();
  for (const f of failures) {
    if (Number.isInteger(f.beat_index)) set.add(f.beat_index);
    else if (f.rule === "family-share") { const fam = /^(\S+) on/.exec(f.detail)?.[1]; (direction.beats || []).filter((b) => b.mechanism?.family === fam).slice(1).forEach((b) => set.add(b.beat_index)); }
    else (direction.beats || []).forEach((b) => set.add(b.beat_index));
  }
  return [...set].sort((a, b) => a - b);
}

// ── CLI ───────────────────────────────────────────────────────────
const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
// Not a top-level await: direct.mjs imports this module, so awaiting it here would deadlock the cycle.
if (isMain) import("./direct.mjs").then(({ contextFor }) => {
  const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : null; };
  const dirPath = arg("direction"), scriptPath = arg("script");
  if (!dirPath || !scriptPath || !existsSync(dirPath)) { console.error("usage: gate.mjs --direction <direction.json> --script <script.json> [--research <research.json>] [--tts <dir>]"); process.exit(2); }
  const ctx = contextFor({ scriptPath, researchPath: arg("research"), ttsDir: arg("tts") });
  const fails = gateDirection(JSON.parse(readFileSync(dirPath, "utf8")), ctx.gate);
  for (const f of fails) console.log(`[vd-gate] beat ${f.beat_index ?? "*"} ${f.rule}: ${f.detail}`);
  console.log(`[vd-gate] ${fails.length} failure(s)`);
  process.exit(fails.length ? 1 : 0);
});
