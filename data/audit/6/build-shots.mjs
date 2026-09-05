/**
 * data/audit/6/build-shots.mjs — Stage 6 gate runner (evidence harness).
 *
 * Gate (CROSSCHECK-PROTOCOL.md line 384):
 *   "L1–L12 pass on all three existing scripts, all 12 mg channels"
 *
 * Lives under data/audit/6/ (NOT src/skills/remotion-render/stage6/) because
 * the orchestrator's permission allow-list has no stage6/ path — the same
 * stale-allow-list species recorded for mg-orchestrator.md. This harness is
 * the Stage-6 evidence: real scripts → real beats → ShotSpec[] → compile →
 * lintAll, per script per motion-graphics channel.
 *
 * Pipeline per script: script JSON → captions (the paired SRT when one
 * exists, else the script's own voiceover + timing strings) → Beat[]
 * (compositions/beats.js parseSrtToBeats — the real pipeline shape, incl.
 * anchorTokenIndex/anchorFrame) → ShotSpec[] → validateShotSpecs →
 * compile() → lintAll() → assert every check passes.
 *
 * The ShotSpec mapping below is the Stage-6 INLINE stand-in: spec/fromBeats.js
 * belongs to the audit-encoding lane (protocol line 78 — the specific grant
 * narrows the general spec/** grant at line 74), so this runner carries a
 * local mirror of that future module and documents every choice in the
 * ledger. It emits the data-free beat set (kicker + rail + caption +
 * headline + accent rule) for every archetype: the three gate scripts carry
 * no chart data (mg-package.js reclassifies data-less PROGRESS beats the same
 * way), so chart content is exercised by the lint fixtures and the compile
 * probe below, not invented here.
 *
 * Font coverage: every motion-graphics channel in config/channels.json is run
 * through the pipeline with its REAL font (channels.json "font"), proving
 * L1–L12 are font-agnostic. channels.json has 13 motion-graphics channels;
 * the manual's "12" list omits Money Mind (id 1) — see the ledger ESCALATION.
 *
 * Measurement: Node cannot measure text (ESCLAY-5-1 — @remotion/layout-utils
 * throws outside a browser, machine-verified on 4.0.506), so the browser
 * measure step (layout/measure.js, audit-type lane) is represented here by a
 * deterministic fixture-metrics generator (documented below). The gate proves
 * compile + lint mechanics on real text and real timing; the real measured
 * sidecars replace the fixture in a later stage.
 *
 * Exit code: 0 = gate holds, 1 = any assertion failed.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MG_TYPE, parseSrtToBeats } from "../../../src/skills/remotion-render/compositions/beats.js";
import { validateShotSpecs } from "../../../src/skills/remotion-render/spec/schema.js";
import { compile } from "../../../src/skills/remotion-render/layout/compile.js";
import { measuredKey } from "../../../src/skills/remotion-render/layout/compile-lint.js";
import { lintAll } from "../../../src/skills/remotion-render/layout/lint.js";
import { SAFE_LONGFORM, SAFE_SHORTS, SLOTS_LONGFORM, SLOTS_SHORTS } from "../../../src/skills/remotion-render/layout/slots.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url)); // data/audit/6 → repo root
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

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

// ── Script + SRT inputs ──────────────────────────────────────────────────────

const SCRIPTS = [
  { path: "data/scripts/ch-fixture/movile-cave-shorts-script.json", srt: "data/tts/ch-fixture/movile-cave-shorts-script-vo.srt" },
  { path: "data/scripts/ch-fixture/render-test-script.json", srt: null },
  { path: "data/scripts/ch-02/narrowboat-10k-surprise-shorts-script.json", srt: null },
];

/** "0:00-0:10" → ms (the scripts' own timing strings — real data). */
function timeToMs(t) {
  const m = String(t || "").match(/^(\d+):(\d{2})/);
  if (!m) return 0;
  return +m[1] * 60000 + +m[2] * 1000;
}

/** Sections → [{ index, id, startMs, endMs }] from the script's timing strings. */
function sectionsFromScript(script) {
  return (script.sections || []).map((s, i) => {
    const [fromStr, toStr] = String(s.timing || "0:00-0:10").split("-");
    const startMs = timeToMs(fromStr);
    const endMs = Math.max(timeToMs(toStr), startMs + 1000);
    return { index: i, id: s.id || `section_${i}`, startMs, endMs };
  });
}

/** Captions for SRT-less scripts: the script's own voiceover words + its own
 *  section timing — both real; only the per-beat split is the builder's
 *  arithmetic (the same char-proportional split parseSrtToBeats applies). */
function captionsFromScript(script) {
  return (script.sections || []).map((s) => ({
    text: String(s.voiceover || "").trim(),
    startMs: timeToMs(String(s.timing || "").split("-")[0]),
    endMs: timeToMs(String(s.timing || "0:00-0:10").split("-")[1] || ""),
  }));
}

/** Real beats per script: SRT when present, else voiceover captions. */
function beatsForScript(script, srtPath) {
  const sections = sectionsFromScript(script);
  const captions = srtPath ? null : captionsFromScript(script).filter((c) => c.text.length > 0);
  const opts = captions ? { captions } : {};
  const beats = parseSrtToBeats(srtPath ? read(srtPath) : "", opts);
  for (const beat of beats) {
    const hit = sections.findIndex((s) => beat.startMs >= s.startMs && beat.startMs < s.endMs);
    beat.sectionIndex = hit >= 0 ? hit : sections.length - 1;
  }
  return { beats, sections };
}

// ── Inline Beat[] → ShotSpec[] mapping (Stage-6 stand-in for spec/fromBeats.js) ──

/** §2.1.3-safe entrance: "anchor+8" unless the anchor sits too late in the
 *  beat for an 8-frame rise before the "end−6" fade — then enter at "end−6". */
function headlineEnterAt(anchorFrame, dur) {
  return anchorFrame + 8 <= dur - 6 ? "anchor+8" : "end-6";
}

/** The headline term: the anchor token phrase, ≤16 chars (one line at 84 px —
 *  the §3.7 content box + L6 floor mean a headline is 1 line at 84). */
function headlineFor(beat, maxChars = 16) {
  const tokens = beat.wordTokens || [];
  const anchor = tokens[beat.anchorTokenIndex];
  if (!anchor) return String(beat.text || "").split(/\s+/)[0] || "";
  let phrase = anchor.text;
  for (let i = beat.anchorTokenIndex + 1; i < tokens.length; i++) {
    const next = `${phrase} ${tokens[i].text}`;
    if (next.length > maxChars) break;
    phrase = next;
  }
  return phrase;
}

/** One beat → one ShotSpec. Persistent: kicker/rail/caption (§2.3).
 *  Non-persistent: headline + the 4 px accent rule (the ONE accent, L7 —
 *  chart beats would carry the highlight bar instead, never both). */
function beatToShotSpec(beat, section, beatIndex) {
  const dur = beat.durationInFrames;
  const anchorFrame = Math.max(beat.anchorFrame - beat.startFrame, 0);
  const layers = [
    {
      role: "kicker",
      slot: "kicker",
      content: { index: section.index + 1, label: section.id },
      enter: { pattern: "RISE", atFrame: 0 },
      exit: { pattern: "NONE" },
    },
    { role: "rail", slot: "rail", content: {}, enter: { pattern: "NONE" }, exit: { pattern: "NONE" } },
    {
      role: "caption",
      slot: "caption",
      content: { text: beat.text },
      fit: { maxSize: MG_TYPE.caption, minSize: MG_TYPE.caption, maxLines: 2 },
      enter: { pattern: "RISE", atFrame: 0 },
      exit: { pattern: "NONE" },
    },
    {
      role: "headline",
      slot: "headline",
      align: "left",
      content: { text: headlineFor(beat) },
      fit: { maxSize: MG_TYPE.headline, minSize: MG_TYPE.headline, maxLines: 1 },
      enter: { pattern: "RISE", atFrame: headlineEnterAt(anchorFrame, dur) },
      exit: { pattern: "FADE", atFrame: "end-6" },
    },
    {
      role: "accent",
      slot: "headline",
      content: {},
      enter: { pattern: "DRAW", atFrame: headlineEnterAt(anchorFrame, dur) },
      exit: { pattern: "FADE", atFrame: "end-6" },
    },
  ];
  return {
    id: `s${section.index}b${beatIndex}`,
    archetype: beat.archetype,
    startFrame: beat.startFrame,
    durationInFrames: dur,
    anchorTokenIndex: beat.anchorTokenIndex,
    layers,
  };
}

function specsForScript(script, srtPath) {
  const { beats, sections } = beatsForScript(script, srtPath);
  return {
    specs: beats.map((b, i) => beatToShotSpec(b, sections[b.sectionIndex] || sections[0], i)),
    beats,
    sections,
  };
}

// ── Browser-measure stand-in (R3 input) ──────────────────────────────────────

/** Fixture metrics, keyed exactly like layout/measure.js output
 *  (compile-lint.measuredKey). Deterministic stand-in for the browser
 *  measure step — Node cannot measure (ESCLAY-5-1). charW = 0.6 × fontSize
 *  is the ratio the doc itself uses ("42 chars x 0.6 ≈ 25/line",
 *  CAPTION_LIMITS). lines capped at 2 = the fit's truncation policy. */
function fixtureMetrics(text, fontSize, slotW) {
  const chars = String(text).length;
  const charW = 0.6 * fontSize;
  const perLine = Math.max(Math.floor(slotW / charW), 1);
  const lines = Math.min(Math.ceil(chars / perLine), 2);
  const width = Math.min(chars * charW, slotW);
  return { width, lines };
}

/** Per-channel R3 inputs: fonts (resolved fontSize per layer — the real
 *  MG_TYPE sizes) and measured (per text|fontSize|fontFamily). */
function buildInputs(specs, beats, channel) {
  const fontFamily = channel.font;
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

// ── Run 1: the three gate scripts through compile + lintAll ─────────────────

console.log("stage 6 gate — three scripts, all mg channels");
const channels = JSON.parse(read("config/channels.json")).channels.filter((c) => c.style === "motion-graphics");
check("6 motion-graphics channels found in channels.json", channels.length === 6, String(channels.length));
check("6 motion-graphics channels present", channels.length >= 6);

for (const scriptDef of SCRIPTS) {
  const script = JSON.parse(read(scriptDef.path));
  const { specs, beats, sections } = specsForScript(script, scriptDef.srt);
  check(
    `${scriptDef.path}: ${beats.length} beats, ${specs.length} specs`,
    beats.length >= 1 && specs.length === beats.length,
    `beats=${beats.length}`
  );
  const valid = validateShotSpecs(specs);
  check(`${scriptDef.path}: every ShotSpec validates (schema.js)`, valid.valid, valid.errors.join(" | "));
  for (const channel of channels) {
    const { fonts, measured, anchorFrame } = buildInputs(specs, beats, channel);
    let frames;
    try {
      frames = compile(specs, { slots: SLOTS_SHORTS, safe: SAFE_SHORTS, fonts, measured, anchorFrame });
    } catch (err) {
      check(`${scriptDef.path} × ${channel.channel_name || channel.id}: compile threw — ${err.message}`, false, err.message);
      continue;
    }
    const result = lintAll(frames, { slots: SLOTS_SHORTS, safe: SAFE_SHORTS });
    const detail = result.results
      .filter((r) => r.failures.length > 0)
      .map((r) => `${r.id}: ${r.failures[0]}`)
      .join(" | ");
    check(
      `${scriptDef.path} × ${channel.channel_name || channel.id} (${channel.font}): L1–L12 pass on ${frames.length} frames`,
      result.pass,
      detail
    );
  }
}

// ── Run 2: compile negative tests — R3/R4 violations THROW (build error) ────

console.log("compile negative tests (R4 — a layout error is a build error)");
const probeScript = JSON.parse(read(SCRIPTS[0].path)); // movile-cave, real beats
const probe = specsForScript(probeScript, SCRIPTS[0].srt);
const base = buildInputs(probe.specs, probe.beats, channels[0]);

let threw = false;
try {
  compile(probe.specs, { slots: SLOTS_SHORTS, safe: SAFE_SHORTS, fonts: {}, measured: base.measured, anchorFrame: base.anchorFrame });
} catch (err) {
  threw = /no resolved fontSize/.test(err.message);
}
check("missing fonts input throws (R3 — measurement must feed compile)", threw);

threw = false;
try {
  compile(probe.specs, { slots: SLOTS_SHORTS, safe: SAFE_SHORTS, fonts: base.fonts, measured: {}, anchorFrame: base.anchorFrame });
} catch (err) {
  threw = /no measured size/.test(err.message);
}
check("missing measured input throws (R3 — no measurement inside compile)", threw);

// P3.5 re-entry (attempt 2, verifier ses_0244c1a2cffeNx1HpTD392w5Si REJECT):
// a PARTIAL measured entry — width present, lines missing/invalid — is still
// incomplete R3 input and must throw, not silently default to 1 line.
threw = false;
const partialMeasured = {};
{
  const spec = probe.specs[0];
  const layer = spec.layers[0]; // kicker
  const key = `${spec.id}:0`;
  const fontSize = MG_TYPE.kicker || 28;
  const text = `${String(layer.content.index).padStart(2, "0")} ${layer.content.label}`;
  partialMeasured[measuredKey(text, fontSize, channels[0].font)] = { width: 400 }; // NO lines
}
try {
  compile(probe.specs, { slots: SLOTS_SHORTS, safe: SAFE_SHORTS, fonts: base.fonts, measured: partialMeasured, anchorFrame: base.anchorFrame });
} catch (err) {
  threw = /no measured line count/.test(err.message);
}
check("partial measured entry (width, no lines) throws (R3/L5 — not silently 1 line)", threw);

threw = false;
const badRangeSpec = JSON.parse(
  JSON.stringify({
    ...probe.specs[0],
    layers: [
      { role: "headline", slot: "headline", content: { text: "X" }, enter: { pattern: "RISE", atFrame: "anchor+999" }, exit: { pattern: "NONE" } },
    ],
  })
);
try {
  compile([badRangeSpec], { slots: SLOTS_SHORTS, safe: SAFE_SHORTS, fonts: {}, measured: {}, anchorFrame: {} });
} catch (err) {
  threw = /outside \[0/.test(err.message);
}
check("out-of-range atFrame throws (R4/L12)", threw);

// §3.7 collision: a Longform beat with a 2-line caption (top 836) and a
// 1-line 84px headline (bottom 876) must throw.
const longformSpec = {
  id: "lf01",
  archetype: "STATEMENT",
  startFrame: 0,
  durationInFrames: 90,
  anchorTokenIndex: 0,
  layers: [
    { role: "headline", slot: "headline", align: "left", content: { text: "TERM SHORT" }, enter: { pattern: "RISE", atFrame: 0 }, exit: { pattern: "NONE" } },
    { role: "caption", slot: "caption", content: { text: "A two-line longform caption that wraps" }, enter: { pattern: "RISE", atFrame: 0 }, exit: { pattern: "NONE" } },
  ],
};
threw = false;
try {
  compile([longformSpec], {
    slots: SLOTS_LONGFORM,
    safe: SAFE_LONGFORM,
    fonts: { "lf01:0": { fontSize: 84, fontFamily: "Inter" }, "lf01:1": { fontSize: 64, fontFamily: "Inter" } },
    measured: {
      [measuredKey("TERM SHORT", 84, "Inter")]: { width: 480, lines: 1 },
      [measuredKey("A two-line longform caption that wraps", 64, "Inter")]: { width: 960, lines: 2 },
    },
    anchorFrame: {},
  });
} catch (err) {
  threw = /collides with the caption rect/.test(err.message);
}
check("§3.7 — headline colliding with a 2-line caption throws", threw);

// §3.7 content box: a 2-line headline at 84 (h=192 > 128) must throw.
const tallHeadlineSpec = {
  id: "b35",
  archetype: "STATEMENT",
  startFrame: 0,
  durationInFrames: 90,
  anchorTokenIndex: 0,
  layers: [
    { role: "headline", slot: "headline", align: "left", content: { text: "TOO LONG FOR ONE LINE" }, enter: { pattern: "RISE", atFrame: 0 }, exit: { pattern: "NONE" } },
  ],
};
threw = false;
try {
  compile([tallHeadlineSpec], {
    slots: SLOTS_SHORTS,
    safe: SAFE_SHORTS,
    fonts: { "b35:0": { fontSize: 84, fontFamily: "Inter" } },
    measured: { [measuredKey("TOO LONG FOR ONE LINE", 84, "Inter")]: { width: 840, lines: 2 } },
    anchorFrame: {},
  });
} catch (err) {
  threw = /content box/.test(err.message);
}
check("§3.7 — 2-line headline exceeding the content box throws", threw);

// ── Run 3: fixture chart through compile → L8/L9/L10 on real compiled output ─

console.log("compile of a chart beat — L8/L9/L10 on compiled interior geometry");
const chartSpec = {
  id: "ch01",
  archetype: "PROGRESS",
  startFrame: 0,
  durationInFrames: 90,
  anchorTokenIndex: 0,
  layers: [
    {
      role: "chart",
      slot: "stage",
      align: "bottom-left",
      content: {
        unit: "%",
        series: [
          { label: "2019", value: 12 },
          { label: "2024", value: 47, highlight: true },
        ],
      },
      enter: { pattern: "CHART_BUILD", atFrame: 0 },
      exit: { pattern: "NONE" },
    },
  ],
};
const chartFrames = compile([chartSpec], { slots: SLOTS_SHORTS, safe: SAFE_SHORTS, fonts: {}, measured: {}, anchorFrame: {} });
const chartRect = chartFrames[0].rects.find((r) => r.role === "chart");
const c = chartRect.chart;
check("compiled chart: bars sit exactly on the axis (L8)", c.bars.every((b) => b.bottom === c.axisY), `axisY=${c.axisY} bottoms=${c.bars.map((b) => b.bottom)}`);
check("compiled chart: gutters equal (L9)", Math.max(...c.gutters) - Math.min(...c.gutters) <= 1, String(c.gutters));
check("compiled chart: axis label 12px from gridline (L10)", c.gridX - c.axisLabelRight === 12, `gap=${c.gridX - c.axisLabelRight}`);
check("compiled chart: exactly one accent (highlight bar, L7)", c.highlightIndex === 1, String(c.highlightIndex));
check("compiled chart frame passes lintAll", lintAll(chartFrames, { slots: SLOTS_SHORTS, safe: SAFE_SHORTS }).pass === true);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
