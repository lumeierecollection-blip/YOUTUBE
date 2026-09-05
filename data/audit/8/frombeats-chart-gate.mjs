/**
 * data/audit/8/frombeats-chart-gate.mjs — Stage 8 gate runner (evidence
 * harness) for the audit-encoding lane.
 *
 * Gate (CHECK-REGISTER §3.5, stage 8 + LAYOUT-SYSTEM §8.4 step 6):
 *   "L8, L9, L10 pass — the three chart bugs; ENC-08..15, ENC-20..24"
 *
 * Proves that spec/fromBeats.js + primitives/Chart.jsx make the three
 * historical chart bugs (LAY-07 36 px float, LAY-08 42/84 gutters, LAY-09
 * axis-label mis-position) impossible, and that the chart data-honesty
 * checks are armed (each violation THROWS with the ENC code).
 *
 * Runs:
 *   Run 1  — a real PROGRESS beat (with beat.data) → fromBeats →
 *            validateShotSpecs → compile → lintAll: L1–L12 pass; L7 one
 *            accent; L8 bar.bottom == axisY exactly; L9 gutters equal;
 *            L10 gridX − axisLabelRight == 12; values/highlight pass
 *            through EXACTLY (ENC-13/24); the ShotSpec renders to English
 *            (toEnglish.js consumer).
 *   Run 2  — honesty gates: fromBeats THROWS with the ENC code on every
 *            violation (ENC-08/09/13/21/10/24/20/23) and downgrades the
 *            single-point series to HERO_NUMBER (ENC-22/H8).
 *   Run 3  — ENC-23 verifiable/limitation boundary: 3+ year labels with
 *            unequal intervals throw; 2-point and non-year labels pass
 *            (documented limitation).
 *   Run 4  — Chart.jsx source greps: zero hex literals, zero forbidden
 *            encodings (ENC-11/12), exactly one accent decision driven by
 *            bar.highlight (ENC-15), no value-derived highlight (ENC-13),
 *            VALUE_GAP ≤ 24 (ENC-14), AXIS_LABEL_GAP == 12 (L10).
 *   Run 5  — fromBeats.js source greps: no i===0 / max() / Math.abs
 *            highlight or sign derivation (ENC-13/10).
 *   Run 6  — `node src/skills/remotion-render/layout/run-lint.js` stays
 *            green (spawned — the repo lint gate must not regress).
 *   Run 7  — the SFR-LAY-6-2 lift proof: all three gate scripts × all 13
 *            motion-graphics channels through the REAL fromBeats (with the
 *            mg-package.js:419-421 downgrade applied first, exactly like
 *            the real pipeline) → validateShotSpecs → compile → lintAll.
 *
 * Exit code: 0 = gate holds, 1 = any assertion failed.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MG_TYPE, parseSrtToBeats } from "../../../src/skills/remotion-render/compositions/beats.js";
import { parseNumber } from "../../../src/skills/remotion-render/compositions/mg-package.js";
import { validateShotSpecs } from "../../../src/skills/remotion-render/spec/schema.js";
import { fromBeats } from "../../../src/skills/remotion-render/spec/fromBeats.js";
import { shotsToEnglish } from "../../../src/skills/remotion-render/spec/toEnglish.js";
import { compile } from "../../../src/skills/remotion-render/layout/compile.js";
import { measuredKey } from "../../../src/skills/remotion-render/layout/compile-lint.js";
import { lintAll, lintL7, lintL8, lintL9, lintL10 } from "../../../src/skills/remotion-render/layout/lint.js";
import { SAFE_SHORTS, SLOTS_SHORTS } from "../../../src/skills/remotion-render/layout/slots.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url)); // data/audit/8 → repo root
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

// ── Script + SRT inputs (mirror data/audit/6/build-shots.mjs:72-117) ─────────

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
    return { index: i, id: s.id || `section_${i}`, startMs, endMs };
  });
}

function captionsFromScript(script) {
  return (script.sections || []).map((s) => ({
    text: String(s.voiceover || "").trim(),
    startMs: timeToMs(String(s.timing || "").split("-")[0]),
    endMs: timeToMs(String(s.timing || "0:00-0:10").split("-")[1] || ""),
  }));
}

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

/** The mg-package downgrade (mg-package.js:419-421) — applied BEFORE
 *  fromBeats exactly like the real pipeline: a PROGRESS beat whose data
 *  carries no series is not a chart beat (E3.2) and reclassifies honestly.
 *  parseNumber is imported from mg-package.js itself (authoritative). */
function downgradeDataLessProgress(beats) {
  for (const b of beats) {
    if (b.archetype === "PROGRESS" && !(b.data && Array.isArray(b.data.series) && b.data.series.length)) {
      b.archetype = parseNumber(b.text) ? "HERO_NUMBER" : "STATEMENT";
    }
  }
  return beats;
}

// ── Browser-measure stand-in (R3 input, mirror build-shots.mjs:208-243) ──────

function fixtureMetrics(text, fontSize, slotW) {
  const chars = String(text).length;
  const charW = 0.6 * fontSize;
  const perLine = Math.max(Math.floor(slotW / charW), 1);
  const lines = Math.min(Math.ceil(chars / perLine), 2);
  const width = Math.min(chars * charW, slotW);
  return { width, lines };
}

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

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SECTIONS = [{ index: 0, id: "FIXTURE" }];

/** A real-shaped PROGRESS beat with honest data (E3.1 shape). */
function fixtureBeat(overrides = {}) {
  return {
    text: "Rates grew from 12 percent in 2019 to 47 percent in 2024.",
    wordTokens: [{ text: "Rates" }, { text: "grew" }, { text: "from" }, { text: "12" }, { text: "percent" }, { text: "in" }, { text: "2019" }, { text: "to" }, { text: "47" }, { text: "percent" }, { text: "in" }, { text: "2024" }],
    anchorTokenIndex: 3,
    archetype: "PROGRESS",
    startFrame: 300,
    durationInFrames: 90,
    anchorFrame: 310,
    sectionIndex: 0,
    data: {
      unit: "%",
      series: [
        { label: "2019", value: 12 },
        { label: "2024", value: 47, highlight: true },
      ],
    },
    ...overrides,
  };
}

function fromBeatsExpectThrow(beat, label, enc, sections = SECTIONS) {
  let threw = null;
  try {
    fromBeats([beat], { sections });
  } catch (err) {
    threw = err.message;
  }
  check(label, threw !== null && threw.includes(enc), threw ? threw.split(" — ")[0] : "did not throw");
}

// ── Run 1: real PROGRESS beat through the full pipeline ─────────────────────

console.log("Run 1 — PROGRESS beat → fromBeats → validate → compile → lintAll");
const spec = fromBeats([fixtureBeat()], { sections: SECTIONS })[0];
check("spec archetype is PROGRESS", spec.archetype === "PROGRESS");
check(
  "chart beat layers are exactly [kicker, rail, caption, headline, chart] — no accent rule (L7)",
  spec.layers.map((l) => l.role).join(",") === "kicker,rail,caption,headline,chart",
  spec.layers.map((l) => l.role).join(",")
);
const chartLayer = spec.layers.find((l) => l.role === "chart");
check("chart layer enters with CHART_BUILD at 0", chartLayer.enter.pattern === "CHART_BUILD" && chartLayer.enter.atFrame === 0);
check("chart layer exits NONE", chartLayer.exit.pattern === "NONE");
check("chart layer carries unit + series (E3.1)", chartLayer.content.unit === "%" && chartLayer.content.series.length === 2);
check("values pass through EXACTLY — 12 and 47 (ENC-24)", chartLayer.content.series[0].value === 12 && chartLayer.content.series[1].value === 47);
check("highlight passes through from data only (ENC-13)", chartLayer.content.series[0].highlight === false && chartLayer.content.series[1].highlight === true);

const valid = validateShotSpecs([spec]);
check("ShotSpec validates (schema.js)", valid.valid, valid.errors.join(" | "));
check("spec renders to English (toEnglish.js consumer)", /chart_build at 0/.test(shotsToEnglish([spec])));

const ch0 = { font: "Inter" };
const { fonts, measured, anchorFrame } = buildInputs([spec], [fixtureBeat()], ch0);
let frames;
try {
  frames = compile([spec], { slots: SLOTS_SHORTS, safe: SAFE_SHORTS, fonts, measured, anchorFrame });
} catch (err) {
  check(`compile did not throw: ${err.message}`, false, err.message);
  frames = [];
}
const chartRect0 = frames[0] && frames[0].rects.find((r) => r.role === "chart");
const chart = chartRect0 && chartRect0.chart;
check("compiled chart frame present", !!chart, "no chart rect");
if (chart) {
  check("L8 — bar bottoms equal axis y exactly (Δ 0, the 36 px float)", lintL8(frames).failures.length === 0 && chart.bars.every((b) => b.bottom === chart.axisY));
  check("L9 — gutters equal (the 42/84 split)", lintL9(frames).failures.length === 0 && Math.max(...chart.gutters) - Math.min(...chart.gutters) <= 1);
  check("L10 — axis label right edge 12 px from gridline", lintL10(frames).failures.length === 0 && chart.gridX - chart.axisLabelRight === 12);
  check("L7 — exactly one accent (the highlight bar)", lintL7(frames).failures.length === 0 && chart.highlightIndex === 1);
  check("bar values in compiled geometry are exact (ENC-24)", chart.bars[0].value === 12 && chart.bars[1].value === 47);
  const all = lintAll(frames, { slots: SLOTS_SHORTS, safe: SAFE_SHORTS });
  check("lintAll L1–L12 pass on the chart frame", all.pass === true, all.results.filter((r) => r.failures.length).map((r) => `${r.id}: ${r.failures[0]}`).join(" | "));
}

// ── Run 2: honesty gates — every violation THROWS with the ENC code ──────────

console.log("Run 2 — ENC honesty gates (fromBeats throws on violations)");
fromBeatsExpectThrow(fixtureBeat({ data: { unit: "%" } }), "ENC-08 — no series throws", "ENC-08");
fromBeatsExpectThrow(
  fixtureBeat({
    data: {
      unit: "%",
      series: [1, 2, 3, 4, 5, 6].map((v) => ({ label: `L${v}`, value: v, highlight: v === 3 })),
    },
  }),
  "ENC-09 — 6 series points throws",
  "ENC-09"
);
fromBeatsExpectThrow(
  fixtureBeat({ data: { unit: "%", series: [{ label: "2019", value: 12 }, { label: "2024", value: 47 }] } }),
  "ENC-13 — no highlight in the data throws",
  "ENC-13"
);
fromBeatsExpectThrow(
  fixtureBeat({
    data: {
      unit: "%",
      series: [
        { label: "2019", value: 12, highlight: true },
        { label: "2024", value: 47, highlight: true },
      ],
    },
  }),
  "ENC-13/L7 — two highlights throw",
  "ENC-13"
);
fromBeatsExpectThrow(
  fixtureBeat({
    data: {
      unit: "%",
      series: [
        { label: "2019", value: 12 },
        { label: "2024", value: 47, highlight: true, unit: "£" },
      ],
    },
  }),
  "ENC-21 — mixed per-point unit throws",
  "ENC-21"
);
fromBeatsExpectThrow(
  fixtureBeat({
    data: {
      unit: "%",
      series: [
        { label: "2019", value: -12 },
        { label: "2024", value: 47, highlight: true },
      ],
    },
  }),
  "ENC-10 — negative value throws (axis origin is zero)",
  "ENC-10"
);
fromBeatsExpectThrow(
  fixtureBeat({
    data: {
      unit: "%",
      series: [
        { label: "2019", value: "abc" },
        { label: "2024", value: 47, highlight: true },
      ],
    },
  }),
  "ENC-24 — non-finite value throws (nothing silently becomes 0)",
  "ENC-24"
);
fromBeatsExpectThrow(
  fixtureBeat({ text: "Grow rates climbed over time, nothing about shares.", data: { unit: "%", series: [{ label: "2019", value: 12 }, { label: "2024", value: 47, highlight: true }] } }),
  "ENC-20 — unit % without a stated percentage throws",
  "ENC-20"
);
fromBeatsExpectThrow(
  fixtureBeat({
    data: {
      unit: "%",
      series: [
        { label: "2019", value: 12 },
        { label: "2021", value: 30 },
        { label: "2024", value: 47, highlight: true },
      ],
    },
  }),
  "ENC-23 — unequal year intervals (2019/2021/2024) throw",
  "ENC-23"
);

// ENC-22 — single-point data is a HERO_NUMBER, never a one-bar chart (H8).
console.log("Run 2b — ENC-22 single-point downgrade");
const onePoint = fixtureBeat({ data: { unit: "%", series: [{ label: "2024", value: 47 }] } });
const downgraded = fromBeats([onePoint], { sections: SECTIONS })[0];
check("single-point PROGRESS downgrades to HERO_NUMBER", downgraded.archetype === "HERO_NUMBER");
check("downgraded spec has NO chart layer", !downgraded.layers.some((l) => l.role === "chart"));
check("downgraded spec keeps the accent rule (L7 one accent)", downgraded.layers.map((l) => l.role).join(",") === "kicker,rail,caption,headline,accent");
const dv = validateShotSpecs([downgraded]);
check("downgraded spec validates (schema.js)", dv.valid, dv.errors.join(" | "));
const dInputs = buildInputs([downgraded], [onePoint], ch0);
const dFrames = compile([downgraded], { slots: SLOTS_SHORTS, safe: SAFE_SHORTS, fonts: dInputs.fonts, measured: dInputs.measured, anchorFrame: dInputs.anchorFrame });
check("downgraded spec compiles and passes lintAll", lintAll(dFrames, { slots: SLOTS_SHORTS, safe: SAFE_SHORTS }).pass === true);

// ── Run 3: ENC-23 verifiable / limitation boundary ───────────────────────────

console.log("Run 3 — ENC-23 boundary");
const twoYear = fixtureBeat({ data: { unit: "%", series: [{ label: "2019", value: 12 }, { label: "2024", value: 47, highlight: true }] } });
check("2 year labels pass (one interval, trivially equal)", fromBeats([twoYear], { sections: SECTIONS }).length === 1);
const nonYear = fixtureBeat({
  text: "Shares grew from 10 percent to 30 percent to 50 percent.",
  data: {
    unit: "%",
    series: [
      { label: "Q1", value: 10 },
      { label: "Q2", value: 30 },
      { label: "Q3", value: 50, highlight: true },
    ],
  },
});
check("non-year labels (Q1/Q2/Q3) pass — recorded as a documented limitation", fromBeats([nonYear], { sections: SECTIONS }).length === 1);

// ── Run 4: Chart.jsx source honesty greps ────────────────────────────────────

console.log("Run 4 — Chart.jsx source honesty (ENC-11/12/13/14/15, L10)");
const chartSource = read("src/skills/remotion-render/primitives/Chart.jsx");
check("zero hex colour literals", !/#[0-9a-f]{3,8}\b/i.test(chartSource));
check("no forbidden encodings — pie/donut/gauge/bubble/treemap/word cloud/heatmap/arc/stack (ENC-11/12)", !/pie|donut|gauge|bubble|treemap|word\s*cloud|heatmap|arc\(|stack/i.test(chartSource));
check("no shadows, gradients, or glow (A5.2)", !/shadow|gradient|glow/i.test(chartSource));
check("exactly one accent decision, driven by bar.highlight (ENC-15)", (chartSource.match(/bar\.highlight \? colors\.accent : colors\.surface/g) || []).length === 1);
check("no value-derived highlight — no Math.max / i===0 (ENC-13)", !/Math\.max|i\s*===\s*0/.test(chartSource));
const valueGap = chartSource.match(/VALUE_GAP = (\d+)/);
check("VALUE_GAP ≤ 24 px (ENC-14 adjacency)", valueGap !== null && Number(valueGap[1]) <= 24, valueGap && valueGap[1]);
check("AXIS_LABEL_GAP == 12 (L10)", /AXIS_LABEL_GAP = 12/.test(chartSource));
check("value formatting uses thousands separators (ENC-28)", /toLocaleString\(/.test(chartSource) && /Number\.isInteger\(v\)/.test(chartSource));

// ── Run 5: fromBeats.js source honesty greps ─────────────────────────────────

console.log("Run 5 — fromBeats.js source honesty (ENC-10/13)");
const fromBeatsSource = read("src/skills/remotion-render/spec/fromBeats.js");
check("no Math.abs (a silent sign flip would corrupt bars)", !/Math\.abs/.test(fromBeatsSource));
check("no i===0 / max() highlight derivation", !/i\s*===\s*0|Math\.max/.test(fromBeatsSource));
check("highlight passthrough is literal (p.highlight === true)", /highlight:\s*p\.highlight === true/.test(fromBeatsSource));

// ── Run 6: the repo lint gate stays green ────────────────────────────────────

console.log("Run 6 — layout/run-lint.js stays green");
let lintExit = -1;
try {
  execFileSync(process.execPath, ["src/skills/remotion-render/layout/run-lint.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  lintExit = 0;
} catch (err) {
  lintExit = err.status ?? -1;
}
check("run-lint.js exits 0 (repo lint gate green)", lintExit === 0, `exit ${lintExit}`);

// ── Run 7: SFR-LAY-6-2 lift — real scripts × all mg channels, real fromBeats ─

console.log("Run 7 — 3 gate scripts × 13 mg channels through the real fromBeats");
const channels = JSON.parse(read("config/channels.json")).channels.filter((c) => c.style === "motion-graphics");
check("13 motion-graphics channels found (superset of the manual's 12)", channels.length >= 12, String(channels.length));
let totalBeats = 0;
for (const scriptDef of SCRIPTS) {
  const script = JSON.parse(read(scriptDef.path));
  const { beats, sections } = beatsForScript(script, scriptDef.srt);
  downgradeDataLessProgress(beats); // mg-package.js:419-421 — the real pipeline order
  totalBeats += beats.length;
  check(`${scriptDef.path}: PROGRESS beats carry series after the downgrade (ENC-08 stays armed, never fires)`, beats.every((b) => b.archetype !== "PROGRESS" || (b.data && Array.isArray(b.data.series) && b.data.series.length > 0)));
  let specs;
  try {
    specs = fromBeats(beats, { sections });
  } catch (err) {
    check(`${scriptDef.path}: fromBeats did not throw — ${err.message}`, false, err.message);
    continue;
  }
  check(`${scriptDef.path}: ${beats.length} beats → ${specs.length} specs (one per beat)`, specs.length === beats.length);
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
    check(
      `${scriptDef.path} × ${channel.channel_name || channel.id} (${channel.font}): L1–L12 pass on ${frames.length} frames`,
      result.pass,
      result.results.filter((r) => r.failures.length).map((r) => `${r.id}: ${r.failures[0]}`).join(" | ")
    );
  }
}
check("gate covered real beats from the three scripts", totalBeats > 0, String(totalBeats));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
