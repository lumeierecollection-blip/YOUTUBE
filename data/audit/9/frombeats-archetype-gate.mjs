/**
 * data/audit/9/frombeats-archetype-gate.mjs — Stage 9 gate runner (evidence
 * harness) for the audit-encoding lane.
 *
 * Gate (CROSSCHECK-PROTOCOL.md line 387 + CHECK-REGISTER §3.5 stage 9):
 *   "Remaining 7 archetypes | audit-encoding, audit-motion | 16 compositions
 *   render as stills; C10–C13, D11–D13 pass" — ENC-01..07, ENC-16..19.
 *
 * Proves, per CLAIM-ENC-9-01..05 (data/audit/9/audit-encoding.ledger.md §1):
 *   Run 1 — one fixture per archetype (8) through the real pipeline
 *           fromBeats → validateShotSpecs → compile → lintAll: headline
 *           content + timing per archetype, accent policy per MANUAL F
 *           (rule only for TERM_DEFINE, chart highlight for PROGRESS, none
 *           elsewhere), LIST_ITEM headline omitted, L1–L6 + L8–L12 pass,
 *           L7 outcomes per the accent map, toEnglish renders, C3.1 overlap
 *           reported (not thrown — producer gap, SFR-ENC-9-4).
 *   Run 2 — stage-9 ENC gates fire: ENC-01/02/18 (array mix) and
 *           ENC-03/04 (per-beat anchor) throw with the ENC code.
 *   Run 3 — real scripts through the REAL production pipeline
 *           (buildMgPackage: parseSrtToBeats → downgrades → deriveScene →
 *           groupListRuns) → fromBeats → validate → compile → lint:
 *           ENC-01/18 either pass or reject with the ENC code (register's
 *           FAIL states), all other lint green except map-L7.
 *   Run 4 — RE-VERIFIED source greps (P1.2, §0.1): pickScene /
 *           extractStats / extractHeroNumber / extractFlowLines /
 *           GridBackground = 0 hits in the render package; Math.random = 0;
 *           bRollFiles consumed in beats.js / mg-package.js / render.js;
 *           "concepts" = 0 hits in config/channels.json (SFR-ENC-9-3);
 *           HEADLINE_DELAY in motion-graphics.jsx matches my map
 *           (CLAIM-ENC-9-03); chunkVoiceover live (informational, stage 10).
 *   Run 5 — stage-8 gate divergence containment (§0.3): spawned
 *           `node data/audit/8/frombeats-chart-gate.mjs`; every FAIL line
 *           must be one of the known-superseded patterns (accent policy) or
 *           an ENC-01/02/18 rejection; everything else stays green.
 *   Run 6 — `node src/skills/remotion-render/layout/run-lint.js` exits 0
 *           (repo lint gate must not regress).
 *
 * Exit code: 0 = gate holds, 1 = any assertion failed.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MG_TYPE } from "../../../src/skills/remotion-render/compositions/beats.js";
import { buildMgPackage, contentWords, overlapCount, parseNumber } from "../../../src/skills/remotion-render/compositions/mg-package.js";
import { validateShotSpecs } from "../../../src/skills/remotion-render/spec/schema.js";
import { fromBeats, headlineEnterAt, headlineTextFor } from "../../../src/skills/remotion-render/spec/fromBeats.js";
import { shotsToEnglish } from "../../../src/skills/remotion-render/spec/toEnglish.js";
import { compile } from "../../../src/skills/remotion-render/layout/compile.js";
import { measuredKey } from "../../../src/skills/remotion-render/layout/compile-lint.js";
import { lintAll, lintL1, lintL10, lintL11, lintL12, lintL2, lintL3, lintL4, lintL5, lintL6, lintL7, lintL8, lintL9 } from "../../../src/skills/remotion-render/layout/lint.js";
import { SAFE_SHORTS, SLOTS_SHORTS } from "../../../src/skills/remotion-render/layout/slots.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url)); // data/audit/9 → repo root
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => {
  try {
    statSync(path.join(ROOT, p));
    return true;
  } catch {
    return false;
  }
};

let failed = 0;
let passed = 0;
function check(label, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ok  ${label}`);
  } else {
    failed++;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── Browser-measure stand-in (R3 input, mirrors stage-8 gate) ─────────────────

function fixtureMetrics(text, fontSize, slotW) {
  const chars = String(text).length;
  const charW = 0.6 * fontSize;
  const perLine = Math.max(Math.floor(slotW / charW), 1);
  const lines = Math.min(Math.ceil(chars / perLine), 2);
  const width = Math.min(chars * charW, slotW);
  return { width, lines };
}

function buildInputs(specs, beats, channel) {
  const fontFamily = channel.font || "Inter";
  const fonts = {};
  const measured = {};
  const anchorFrame = {};
  for (const spec of specs) {
    const idx = Number(spec.id.match(/b(\d+)$/)[1]);
    const beat = beats[idx];
    anchorFrame[spec.id] = beat ? Math.max(beat.anchorFrame - beat.startFrame, 0) : 0;
    spec.layers.forEach((layer, i) => {
      const key = `${spec.id}:${i}`;
      if (["kicker", "headline", "caption", "support"].includes(layer.role)) {
        const fontSize = MG_TYPE[layer.role] || 44;
        const text =
          layer.role === "kicker"
            ? `${String(layer.content.index).padStart(2, "0")} ${layer.content.label}`
            : layer.content.text;
        const slotW = layer.role === "caption" ? SLOTS_SHORTS.caption.w : SLOTS_SHORTS.headline.w;
        fonts[key] = { fontSize, fontFamily };
        measured[measuredKey(text, fontSize, fontFamily)] = fixtureMetrics(text, fontSize, slotW);
      }
    });
  }
  return { fonts, measured, anchorFrame };
}

function runSpecs(beats, sections, label, channel) {
  // Returns { specs, valid, frames, lint } — throws only on fromBeats gates.
  const specs = fromBeats(beats, { sections });
  const valid = validateShotSpecs(specs);
  const { fonts, measured, anchorFrame } = buildInputs(specs, beats, channel);
  const frames = compile(specs, { slots: SLOTS_SHORTS, safe: SAFE_SHORTS, fonts, measured, anchorFrame });
  const lint = lintAll(frames, { slots: SLOTS_SHORTS, safe: SAFE_SHORTS });
  return { specs, valid, frames, lint };
}

const SECTIONS = [{ index: 0, id: "FIXTURE" }];
const CH0 = { font: "Inter" };

// ── Run 1: one fixture per archetype ──────────────────────────────────────────

/** CLAIM-ENC-9-02 — the manual's accent map per archetype: what fromBeats
 *  emits (spec lane) and where the frame's one accent lives. */
const ACCENT_MAP = {
  HERO_NUMBER: { spec: "none", where: "peer Stage numeral (F1)" },
  TERM_DEFINE: { spec: "rule", where: "spec rule (F2)" },
  LIST_ITEM: { spec: "none", where: "peer Stage badge (F3)" },
  CONTRAST: { spec: "none", where: "peer Stage key element (F4)" },
  PROGRESS: { spec: "chart highlight", where: "spec chart (F5)" },
  RELATION: { spec: "none", where: "none declared (F6)" },
  IMAGE_BEAT: { spec: "none", where: "none declared (F7)" },
  STATEMENT: { spec: "none", where: "none declared (F8)" },
};

const FIXTURES = [
  {
    archetype: "HERO_NUMBER",
    text: "Rates grew 40 percent last year.",
    wordTokens: [{ text: "Rates" }, { text: "grew" }, { text: "40" }, { text: "percent" }, { text: "last" }, { text: "year" }],
    anchorTokenIndex: 2,
    data: { unit: "%" },
    scene: { headline: "%" },
    headline: "%",
    enter: "anchor+8",
  },
  {
    archetype: "TERM_DEFINE",
    text: "The bankruptcy was filed in Delaware.",
    wordTokens: [{ text: "The" }, { text: "bankruptcy" }, { text: "was" }, { text: "filed" }, { text: "in" }, { text: "Delaware" }],
    anchorTokenIndex: 1,
    scene: { headline: "BANKRUPTCY" },
    headline: "BANKRUPTCY",
    enter: "anchor+0",
  },
  {
    archetype: "CONTRAST",
    text: "It was not a rescue, but a secret loan.",
    wordTokens: [{ text: "It" }, { text: "was" }, { text: "not" }, { text: "a" }, { text: "rescue" }, { text: "but" }, { text: "a" }, { text: "secret" }, { text: "loan" }],
    anchorTokenIndex: 6,
    scene: { headline: null },
    headline: "a secret loan",
    enter: "anchor+0",
  },
  {
    archetype: "RELATION",
    text: "Revenue rose because costs fell.",
    wordTokens: [{ text: "Revenue" }, { text: "rose" }, { text: "because" }, { text: "costs" }, { text: "fell" }],
    anchorTokenIndex: 0,
    scene: { headline: "BECAUSE" },
    headline: "BECAUSE",
    enter: "anchor+18",
  },
  {
    archetype: "LIST_ITEM",
    text: "First, the engine flooded.",
    wordTokens: [{ text: "First" }, { text: "the" }, { text: "engine" }, { text: "flooded" }],
    anchorTokenIndex: 0,
    scene: { headline: null },
    headline: null,
    enter: null,
  },
  {
    archetype: "IMAGE_BEAT",
    text: "The Alameda Court ruled in his favor.",
    wordTokens: [{ text: "The" }, { text: "Alameda" }, { text: "Court" }, { text: "ruled" }, { text: "in" }, { text: "his" }, { text: "favor" }],
    anchorTokenIndex: 0,
    scene: { headline: "ALAMEDA COURT" },
    headline: "ALAMEDA COURT",
    enter: "anchor+6",
  },
  {
    archetype: "STATEMENT",
    text: "The company quietly restructured.",
    wordTokens: [{ text: "The" }, { text: "company" }, { text: "quietly" }, { text: "restructured" }],
    anchorTokenIndex: 0,
    scene: { headline: "THE COMPANY" },
    headline: "THE COMPANY",
    enter: "anchor+0",
  },
  {
    archetype: "PROGRESS",
    text: "Rates grew from 12 percent in 2019 to 47 percent in 2024.",
    wordTokens: [{ text: "Rates" }, { text: "grew" }, { text: "from" }, { text: "12" }, { text: "percent" }, { text: "in" }, { text: "2019" }, { text: "to" }, { text: "47" }, { text: "percent" }, { text: "in" }, { text: "2024" }],
    anchorTokenIndex: 3,
    data: { unit: "%", series: [{ label: "2019", value: 12 }, { label: "2024", value: 47, highlight: true }] },
    scene: { headline: null },
    headline: "12 percent in",
    enter: "anchor+8",
  },
];

function fixtureFor(f) {
  return {
    text: f.text,
    wordTokens: f.wordTokens,
    anchorTokenIndex: f.anchorTokenIndex,
    archetype: f.archetype,
    startFrame: 300,
    durationInFrames: 90,
    anchorFrame: 310,
    sectionIndex: 0,
    data: f.data || {},
    scene: f.scene || {},
  };
}

console.log("Run 1 — 8 archetypes → fromBeats → validate → compile → lint (per-archetype contract)");
// One of each archetype is a legal mix (1/8 STATEMENT = 12.5% ≤30%, 1/8
// IMAGE_BEAT = 12.5% ≤20%, no consecutive repeats) — so the single fromBeats
// call below exercises the recipes AND passes the mix gates.
const allEight = FIXTURES.map(fixtureFor);
const mixSpecs = fromBeats(allEight, { sections: SECTIONS });
check("Run 1 — the 8-beat mix passes fromBeats (mix gates: 1/8 STATEMENT, 1/8 IMAGE_BEAT)", mixSpecs.length === 8, String(mixSpecs.length));
const l7Summary = {};
for (let i = 0; i < FIXTURES.length; i++) {
  const f = FIXTURES[i];
  const beat = allEight[i];
  const spec = mixSpecs[i];
  check(`[${f.archetype}] spec archetype kept`, spec.archetype === f.archetype, spec.archetype);

  const headlineLayer = spec.layers.find((l) => l.role === "headline") || null;
  if (f.headline === null) {
    check(`[${f.archetype}] no headline layer (honest omit)`, headlineLayer === null);
  } else {
    check(`[${f.archetype}] headline content = "${f.headline}"`, headlineLayer !== null && headlineLayer.content.text === f.headline, headlineLayer && headlineLayer.content.text);
    check(`[${f.archetype}] headline enter = ${f.enter}`, headlineLayer !== null && headlineLayer.enter.atFrame === f.enter, headlineLayer && headlineLayer.enter.atFrame);
  }

  const accentLayer = spec.layers.find((l) => l.role === "accent") || null;
  const chartLayer = spec.layers.find((l) => l.role === "chart") || null;
  const wantAccent = ACCENT_MAP[f.archetype].spec === "rule";
  check(`[${f.archetype}] accent rule ${wantAccent ? "present" : "absent"} (F2 only)`, wantAccent ? accentLayer !== null : accentLayer === null);
  if (f.archetype === "TERM_DEFINE") {
    check(`[${f.archetype}] rule enters anchor+6 (F2)`, accentLayer.enter.atFrame === "anchor+6", accentLayer.enter.atFrame);
  }
  if (f.archetype === "PROGRESS") {
    check("[PROGRESS] chart layer present, highlight index 1 (F5)", chartLayer !== null && chartLayer.content.series.filter((p) => p.highlight).length === 1);
  } else {
    check(`[${f.archetype}] no chart layer`, chartLayer === null);
  }
  check(`[${f.archetype}] ≤1 stage-slot layer (ENC-16)`, spec.layers.filter((l) => l.slot === "stage").length <= 1);

  const valid = validateShotSpecs([spec]);
  check(`[${f.archetype}] ShotSpec validates (schema.js)`, valid.valid, valid.errors.join(" | "));

  const { fonts, measured, anchorFrame } = buildInputs([spec], [beat], CH0);
  let frames;
  try {
    frames = compile([spec], { slots: SLOTS_SHORTS, safe: SAFE_SHORTS, fonts, measured, anchorFrame });
  } catch (err) {
    frames = null;
    check(`[${f.archetype}] compile did not throw`, false, err.message);
  }
  if (frames) {
    const noL7 = [lintL1(frames, SLOTS_SHORTS), lintL2(SLOTS_SHORTS), lintL3(frames), lintL4(frames), lintL5(frames), lintL6(frames), lintL8(frames), lintL9(frames), lintL10(frames), lintL11(frames), lintL12(frames)];
    const bad = noL7.filter((r) => r.failures.length > 0);
    check(`[${f.archetype}] L1–L6, L8–L12 pass (${noL7.length} checks)`, bad.length === 0, bad.map((r) => `${r.id}: ${r.failures[0]}`).join(" | "));
    const l7 = lintL7(frames);
    l7Summary[f.archetype] = l7.failures.length === 0 ? "L7 pass" : l7.failures[0];
    // L7 expected outcome per the manual's accent map:
    const expectL7 = f.archetype === "TERM_DEFINE" || f.archetype === "PROGRESS";
    check(`[${f.archetype}] L7 ${expectL7 ? "=1 accent" : "0 accents (expected spec-level)"} — manual map`, l7.failures.length === 0 === expectL7, l7.failures[0]);
    check(`[${f.archetype}] spec renders to English`, /rise|draw|chart_build/.test(shotsToEnglish([spec])));
  }

  // C3.1 — reported, not thrown (producer gap, SFR-ENC-9-4; same semantics as
  // gateMgHeadlineOverlap over scene.headline, which is null for these today).
  const ht = headlineTextFor(beat);
  if (ht) {
    const shared = overlapCount(contentWords(ht, 6), beat.text);
    if (shared > 2) {
      check(`[${f.archetype}] C3.1 report: headline "${ht}" shares ${shared} words with caption (report — producer gap, SFR-ENC-9-4)`, false, "C3.1 exceeded");
    } else {
      check(`[${f.archetype}] C3.1 report: headline "${ht}" shares ${shared} ≤2 words`, true, "");
    }
  }
}
console.log(`  L7 per archetype: ${JSON.stringify(l7Summary, null, 0)}`);

// ── Run 2: stage-9 ENC gates fire ─────────────────────────────────────────────

console.log("Run 2 — stage-9 ENC honesty gates (fromBeats throws on violations)");

function expectThrow(beats, label, enc) {
  let threw = null;
  try {
    fromBeats(beats, { sections: SECTIONS });
  } catch (err) {
    threw = err.message;
  }
  check(label, threw !== null && threw.includes(enc), threw ? threw.split(" — ")[0] : "did not throw");
}

const oneStatement = () => fixtureFor(FIXTURES[6]); // STATEMENT "THE COMPANY"
const oneProgress = () => fixtureFor(FIXTURES[7]); // 2-point PROGRESS (ENC-08..24 clean)
const oneHero = () => fixtureFor(FIXTURES[0]);
const oneTerm = () => fixtureFor(FIXTURES[1]);
const oneImage = () => fixtureFor(FIXTURES[5]);

// ENC-01 — 4 of 10 STATEMENT (>30%).
expectThrow([oneStatement(), oneStatement(), oneStatement(), oneStatement(), oneHero(), oneTerm(), oneProgress(), oneImage(), oneHero(), oneTerm()], "ENC-01 — 4/10 STATEMENT throws", "ENC-01");
// ENC-02 — three PROGRESS in a row (>2×).
expectThrow([oneHero(), oneProgress(), oneProgress(), oneProgress()], "ENC-02 — 3 consecutive PROGRESS throws", "ENC-02");
// ENC-18 — 3 of 10 IMAGE_BEAT (>20%).
expectThrow([oneHero(), oneImage(), oneImage(), oneHero(), oneTerm(), oneHero(), oneImage(), oneHero(), oneTerm(), oneHero()], "ENC-18 — 3/10 IMAGE_BEAT throws", "ENC-18");
// ENC-03 — missing anchorTokenIndex.
expectThrow([{ ...oneHero(), anchorTokenIndex: undefined }], "ENC-03 — missing anchorTokenIndex throws", "ENC-03");
// ENC-03 — anchor out of wordTokens range.
expectThrow([{ ...oneHero(), anchorTokenIndex: 99 }], "ENC-03 — anchor past wordTokens throws", "ENC-03");
// ENC-04 — tA before the beat start.
expectThrow([{ ...oneHero(), anchorFrame: 280, startFrame: 300 }], "ENC-04 — tA < 0 throws", "ENC-04");
// ENC-04 — tA past the beat end.
expectThrow([{ ...oneHero(), anchorFrame: 500, startFrame: 300 }], "ENC-04 — tA > dur throws", "ENC-04");
// Positive control — the 8-beat mix passes fromBeats (already proven in Run 1).
check("positive control — one of each archetype passes fromBeats", mixSpecs.length === 8);
check("ENC-16 — every recipe spec carries ≤1 stage-slot layer (structurally)", mixSpecs.every((s) => s.layers.filter((l) => l.slot === "stage").length <= 1));

// ── Run 3: real scripts through the REAL production pipeline ─────────────────

console.log("Run 3 — 3 gate scripts through buildMgPackage (real pipeline) → fromBeats → compile → lint");

const SCRIPTS = [
  { path: "data/scripts/ch-01/movile-cave-shorts-script.json", srt: "data/tts/ch-01/movile-cave-shorts-script-vo.srt" },
  { path: "data/scripts/ch-01/render-test-script.json", srt: null },
  { path: "data/scripts/ch-02/narrowboat-10k-surprise-shorts-script.json", srt: null },
];

function timeToMs(t) {
  const m = String(t || "").match(/^(\d+):(\d{2})/);
  if (!m) return 0;
  return +m[1] * 60000 + +m[2] * 1000;
}

function sectionsFromScript(script) {
  return (script.sections || []).map((s, i) => {
    const [fromStr, toStr] = String(s.timing || "0:00-0:10").split("-");
    const startMs = timeToMs(fromStr);
    const endMs = Math.max(timeToMs(toStr), startMs + 1000);
    return { index: i, id: s.id || `section_${i}`, startMs, endMs, voiceover: String(s.voiceover || "") };
  });
}

const CHANNELS = JSON.parse(read("config/channels.json")).channels.filter((c) => c.style === "motion-graphics");
const INTER = { font: "Inter" };

for (const scriptDef of SCRIPTS) {
  const script = JSON.parse(read(scriptDef.path));
  const sections = sectionsFromScript(script);
  const srtText = scriptDef.srt && exists(scriptDef.srt) ? read(scriptDef.srt) : "";
  const pkg = buildMgPackage(srtText, {
    fps: 30,
    sections,
    bRollFiles: [],
    totalMs: 60000,
    imageForSection: () => null,
  });
  const beats = pkg.beats;
  check(`${scriptDef.path}: production pipeline produced ${beats.length} beats`, beats.length > 0, String(beats.length));
  let specs = null;
  let threw = null;
  try {
    specs = fromBeats(beats, { sections });
  } catch (err) {
    threw = err.message;
  }
  if (threw) {
    const encOk = /ENC-01|ENC-02|ENC-18/.test(threw);
    check(`${scriptDef.path}: fromBeats rejected the mix honestly — ${threw.split(" — ")[0]}`, encOk, threw);
    continue;
  }
  check(`${scriptDef.path}: fromBeats accepted ${beats.length} beats (no anchor/gate rejection)`, true, "");
  const valid = validateShotSpecs(specs);
  check(`${scriptDef.path}: every ShotSpec validates`, valid.valid, valid.errors.join(" | "));
  for (const channel of CHANNELS.slice(0, 3)) {
    let frames;
    try {
      frames = compile(specs, { slots: SLOTS_SHORTS, safe: SAFE_SHORTS, ...buildInputs(specs, beats, channel) });
    } catch (err) {
      check(`${scriptDef.path} × ${channel.channel_name || channel.id}: compile threw`, false, err.message);
      continue;
    }
    const noL7 = [lintL1(frames, SLOTS_SHORTS), lintL2(SLOTS_SHORTS), lintL3(frames), lintL4(frames), lintL5(frames), lintL6(frames), lintL8(frames), lintL9(frames), lintL10(frames), lintL11(frames), lintL12(frames)];
    const bad = noL7.filter((r) => r.failures.length > 0);
    check(`${scriptDef.path} × ${channel.channel_name || channel.id}: L1–L6, L8–L12 pass on ${frames.length} frames`, bad.length === 0, bad.map((r) => `${r.id}: ${r.failures[0]}`).join(" | "));
    const l7 = lintL7(frames);
    const l7FailBeats = l7.failures.length;
    check(`${scriptDef.path} × ${channel.channel_name || channel.id}: L7 per-accent-map (${l7FailBeats} frame(s) outside the manual map)`, l7FailBeats === 0, l7.failures[0]);
  }
  // ENC-01/18 state on a real script: report the mix.
  const tally = {};
  for (const b of beats) tally[b.archetype] = (tally[b.archetype] || 0) + 1;
  console.log(`  mix ${scriptDef.path}: ${JSON.stringify(tally)}`);
}

// ── Run 4: RE-VERIFIED source greps (P1.2 / §0.1) ─────────────────────────────

console.log("Run 4 — RE-VERIFIED source-level evidence (ENC-05/06/07/19, SFR-ENC-9-3)");

function walk(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(js|jsx|mjs|ts|tsx)$/.test(ent.name)) out.push(p);
  }
  return out;
}
const RENDER_PKG = path.join(ROOT, "src", "skills", "remotion-render");
const renderFiles = walk(RENDER_PKG);
const renderSource = renderFiles.map((f) => ({ file: path.relative(ROOT, f), src: readFileSync(f, "utf8") }));

for (const ident of ["pickScene", "extractStats", "extractHeroNumber", "extractFlowLines", "GridBackground"]) {
  const hits = renderSource.filter((f) => f.src.includes(ident));
  check(`grep "${ident}" = 0 hits in the render package (${hits.map((h) => h.file).join(", ") || "none"})`, hits.length === 0, hits.map((h) => h.file).join(", "));
}
const randomHits = renderSource.filter((f) => f.src.includes("Math.random"));
check("grep Math.random = 0 hits in the render package", randomHits.length === 0, randomHits.map((h) => h.file).join(", "));

for (const [file, ident] of [["compositions/beats.js", "bRollFiles"], ["compositions/mg-package.js", "bRollFiles"], ["render.js", "bRollFiles"]]) {
  const src = read(`src/skills/remotion-render/${file}`);
  check(`bRollFiles consumed in ${file} (ENC-19)`, src.includes("bRollFiles"), "0 hits");
}
// ENC-17 — the honest claim is "0 `concepts` KEYS in the config" (ledger §0.1),
// not "the substring never appears" (descriptions legitimately use the word).
// A key-level scan avoids the prose false positive.
function hasKey(obj, key) {
  if (Array.isArray(obj)) return obj.some((o) => hasKey(o, key));
  if (obj && typeof obj === "object") {
    if (key in obj) return true;
    return Object.values(obj).some((o) => hasKey(o, key));
  }
  return false;
}
const configJson = JSON.parse(read("config/channels.json"));
check("no `concepts` key in config/channels.json (ENC-17 config gap persists, SFR-ENC-9-3 open)", !hasKey(configJson, "concepts"), "concepts key found");

const legacySrc = read("src/skills/remotion-render/compositions/motion-graphics.jsx");
const legacyDelays = {};
const legacyMatch = legacySrc.match(/const HEADLINE_DELAY = \{([\s\S]*?)\};/);
if (legacyMatch) {
  for (const m of legacyMatch[1].matchAll(/(\w+):\s*(\d+)/g)) legacyDelays[m[1]] = Number(m[2]);
}
const MY_DELAYS = { HERO_NUMBER: 8, TERM_DEFINE: 0, RELATION: 18, STATEMENT: 0, IMAGE_BEAT: 6, CONTRAST: 0, LIST_ITEM: 0, PROGRESS: 8 };
// CLAIM-ENC-9-03: equality with the legacy map (motion-graphics.jsx:48-57)
// EXCEPT the ONE documented divergence — PROGRESS: 8 here vs 0 there
// (fromBeats retains stage-8's anchor+8; F5/A4 declare no PROGRESS headline
// event — ledger §0.3 + SFR-ENC-9-2 sibling). The check is per-key so a
// drift in any OTHER key still fails loudly.
const delayDiverge = Object.keys(MY_DELAYS).filter((k) => legacyDelays[k] !== MY_DELAYS[k]);
check(
  "HEADLINE_DELAY matches the legacy map on every key except the documented PROGRESS divergence (CLAIM-ENC-9-03)",
  delayDiverge.length === 1 && delayDiverge[0] === "PROGRESS" && MY_DELAYS.PROGRESS === 8 && legacyDelays.PROGRESS === 0,
  `diverging keys: ${delayDiverge.join(", ") || "none"}`
);

// CLAIM-ENC-9-01 (RE-ENTRY) — fromBeats' RELATION_MARKERS mirror must equal the
// live mg-package.js RELATION_MARKERS list verbatim (same entries, same order),
// so the fallback can never drift from deriveScene's splitRelation.
function markerList(src) {
  const m = src.match(/const RELATION_MARKERS = \[([\s\S]*?)\];/);
  if (!m) return null;
  return m[1].matchAll(/"([^"]+)"/g) ? Array.from(m[1].matchAll(/"([^"]+)"/g), (x) => x[1]) : [];
}
const fbMarkers = markerList(read("src/skills/remotion-render/spec/fromBeats.js"));
const mgMarkers = markerList(read("src/skills/remotion-render/compositions/mg-package.js"));
check(
  "RELATION_MARKERS mirror in fromBeats.js equals the live mg-package.js list, in order (CLAIM-ENC-9-01 re-entry)",
  fbMarkers !== null && mgMarkers !== null && JSON.stringify(fbMarkers) === JSON.stringify(mgMarkers),
  `fromBeats: ${JSON.stringify(fbMarkers)} | mg-package: ${JSON.stringify(mgMarkers)}`
);

const renderJs = read("src/skills/remotion-render/render.js");
const verifyJs = read("src/skills/remotion-render/verify-compositions.js");
check("chunkVoiceover still live in render.js + verify-compositions.js (informational — TYP-11/DEL-09 stage 10)", renderJs.includes("chunkVoiceover") && verifyJs.includes("chunkVoiceover"));

// ── Run 5: stage-8 gate divergence containment (§0.3) ─────────────────────────

console.log("Run 5 — stage-8 gate divergence containment (accent-policy supersession)");
let s8Out = "";
let s8Code = -1;
try {
  s8Out = execFileSync(process.execPath, ["data/audit/8/frombeats-chart-gate.mjs"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  s8Code = 0;
} catch (err) {
  s8Out = String(err.stdout || "") + String(err.stderr || "");
  s8Code = err.status ?? -1;
}
writeFileSync(path.join(ROOT, "data", "audit", "9", "stage8-gate-output.txt"), s8Out, "utf8");
const failLines = s8Out.split("\n").filter((l) => l.includes("FAIL "));
const allowed = (detail) => /accent rule/.test(detail) || /accent elements/.test(detail) || /compiles and passes lintAll/.test(detail) || (/did not throw — ENC-0[12]|did not throw — ENC-18/.test(detail)) || /ENC-01:|ENC-02:|ENC-18:/.test(detail);
const unexpected = failLines.filter((l) => !allowed(l));
check(`stage-8 gate: ${failLines.length} failure(s), all inside the §0.3 divergence map (accent policy / ENC-01/02/18)`, unexpected.length === 0, unexpected.slice(0, 4).join(" || "));
const okLines = s8Out.split("\n").filter((l) => l.includes("  ok  "));
check(`stage-8 gate: ENC-08..24 + chart + grep checks stayed green (${okLines.length} ok lines, exit ${s8Code})`, okLines.length > 30 && s8Code === 1, `exit ${s8Code}`);
console.log("  stage-8 gate FAIL lines (evidence archived in stage8-gate-output.txt):");
for (const l of failLines.slice(0, 12)) console.log(`    ${l.trim()}`);

// ── Run 6: repo lint gate ─────────────────────────────────────────────────────

console.log("Run 6 — layout/run-lint.js stays green (repo lint gate)");
let lintExit = -1;
try {
  execFileSync(process.execPath, ["src/skills/remotion-render/layout/run-lint.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  lintExit = 0;
} catch (err) {
  lintExit = err.status ?? -1;
}
check("run-lint.js exits 0", lintExit === 0, `exit ${lintExit}`);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
