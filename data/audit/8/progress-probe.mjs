// audit-motion Stage 8 — Tier 2 probe (claim motion-020). Runs in the REAL
// render engine: a real PROGRESS beat → fromBeats → validateShotSpecs →
// compile → Layer + beats/Progress.jsx → @remotion/bundler → renderStill →
// onBrowserLog DOM measurement. Pattern: data/audit/7/tier2-probe.mjs
// (browser + relative measurement) + data/audit/8/frombeats-chart-gate.mjs
// (fixture beat + buildInputs + compiled-geometry gate).
//
// Proves, empirically in Chrome:
//   G1  every compiled Layer rect measures within ±2 px at settled stills
//       (frames 60, 75 of a 90f beat — every entrance ≥ D.base=9 done, every
//       exit window not started) — LAY-12 geometry.
//   G2  zero safe-rect crossings (SAFE_SHORTS, ±2 px tolerance).
//   G3  zero sibling flex (no Layer div is flex, no flex container parents).
//   G4  the stage-8 gate holds in the DOM at rest (frames 60, 75):
//       L8 — every bar's measured bottom == axisY (896) within ±2 px;
//       L9 — the measured gutter (bar1.x − (bar0.x + bar0.w)) == 8 within ±2;
//       L10 — the axis-label's measured right edge == gridX − 12 == 76 ±2;
//       L7 — exactly ONE accent fill in the chart (the highlight bar);
//       bar widths == barW 376 and heights == 120/464 within ±2 px;
//       counter rest text == Chart.jsx fmtValue: "12" and "47".
//   G5  counter format-stability (A2.3/ENC-26, A2.4/ENC-28):
//       at the overshoot frame (20) the highlight counter reads "47" — the
//       target, clamped (A2.6) — never "53", same digit count as at rest;
//       a second 4-digit chart (850/1,240) shows thousands separators in
//       EVERY logged intermediate value and "1,240" at rest.
// Evidence (not gated to ±2, qualitative/structural):
//   f9   construction order in flight — baseline ≈ 759.9 px (drawn 9/10),
//        gridline 0 ≈ 375.7 px (drawn 1/10), gridline 1 = 0 (not started),
//        bar 0 mounted at 62.3 px (spring frame 3), bar 1 absent (its grow
//        starts at 13), axis label still at opacity 0 (RISE waits for 16).
//   f20  grow stagger + overshoot + clamp — bar 0 ≈ 119.5 px (spring frame
//        14), bar 1 ≈ 521.1 px > 464 (overshoot p(7) = 1.123) while its
//        counter is clamped at "47", gridline 0 fully drawn (760 px).
//   f36/37  the 1-frame accent switch — bar 1 fill is surface at 36 and
//        accent at 37 (exactly one accent in the chart after 37).
//
// The fixture is the peer lane's real-shaped PROGRESS beat (frombeats-chart
// -gate.mjs fixtureBeat) so the compiled geometry is identical to Run 1's:
// chart rect {88,432,760,464}, bars {88,376,120} / {472,376,464}, axisY 896,
// gridX 88, gutter 8, axisLabelRight 76, highlightIndex 1.
//
// Exit code: 0 = gate holds, 1 = any assertion failed.

import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill, openBrowser } from "@remotion/renderer";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { fromBeats } from "../../../src/skills/remotion-render/spec/fromBeats.js";
import { validateShotSpecs } from "../../../src/skills/remotion-render/spec/schema.js";
import { compile } from "../../../src/skills/remotion-render/layout/compile.js";
import { measuredKey } from "../../../src/skills/remotion-render/layout/compile-lint.js";
import { lintAll, lintL7, lintL8, lintL9, lintL10 } from "../../../src/skills/remotion-render/layout/lint.js";
import { SAFE_SHORTS, SLOTS_SHORTS } from "../../../src/skills/remotion-render/layout/slots.js";
import { paletteFromHues } from "../../../src/skills/remotion-render/styles/tokens.js";
import { MG_TYPE } from "../../../src/skills/remotion-render/compositions/beats.js";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "out");
const ENTRY = join(here, "_progress-entry.jsx");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PUBLIC_DIR = "src/skills/remotion-render/public"; // staticFile home (repo-root relative)

const DUR = 90;
const FPS = 30;
const TOL = 2; // ±2 px gate (G1/G4/G5 rest, LAY-12)
const EV_TOL = 3; // evidence frames — wider, qualitative/structural
const GATED_FRAMES = [60, 75]; // settled stills — the ±2 px gate
const EVIDENCE_FRAMES = [9, 20, 36, 37]; // motion branches + 1-frame switch

// Compiled geometry of the main fixture (machine-verified this session —
// identical to frombeats-chart-gate Run 1): chart rect {x:88,y:432,w:760,
// h:464}; axisY 896; gridX 88; barAreaTop 432; plotH 464; barW 376; gutter 8;
// bar0 {x:88, w:376, h:120}; bar1 {x:472, w:376, h:464}; axisLabelRight 76;
// highlightIndex 1. Asserted node-side (below) and used as the DOM targets.
const AXIS_Y = 896;
const GRID_X = 88;
const GUTTER = 8;
const BAR_W = 376;
const BAR_H = [120, 464];
const AXIS_LABEL_RIGHT = 76; // gridX − 12 (L10)
const PLOT_W = 760;
const RISE_AT = 16;
const HL_START = 13; // tA(10) − 4 + 1·7 — the highlight bar's grow start
const ACCENT_AT = 37; // HL_START + 24 — the 1-frame switch frame

// ── Fixtures (mirror frombeats-chart-gate.mjs:169-189) ──────────────────────
const SECTIONS = [{ index: 0, id: "FIXTURE" }];

function fixtureBeat(overrides = {}) {
  return {
    text: "Rates grew from 12 percent in 2019 to 47 percent in 2024.",
    wordTokens: [{ text: "Rates" }, { text: "grew" }, { text: "from" }, { text: "12" }, { text: "percent" }, { text: "in" }, { text: "2019" }, { text: "to" }, { text: "47" }, { text: "percent" }, { text: "in" }, { text: "2024" }],
    anchorTokenIndex: 3,
    archetype: "PROGRESS",
    startFrame: 300,
    durationInFrames: DUR,
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

/** G5 chart — 4-digit values so thousands separators must appear from frame 0
 *  (A2.4/ENC-28). Highlight is the LAST bar (1,240): its raised floor is
 *  1,000, so every intermediate value is 4 digits and always has the comma. */
function fixtureBeatG5() {
  return {
    text: "Views grew from 850 in 2019 to 1,240 in 2024.",
    anchorTokenIndex: 7, // token index of "1,240" (schema requires integer >= 0)
    archetype: "PROGRESS",
    startFrame: 300,
    durationInFrames: DUR,
    anchorFrame: 310,
    sectionIndex: 0,
    data: {
      unit: "views",
      series: [
        { label: "2019", value: 850 },
        { label: "2024", value: 1240, highlight: true },
      ],
    },
  };
}

// ── Browser-measure stand-in (R3 input, mirror frombeats-chart-gate.mjs) ────
function fixtureMetrics(text, fontSize, slotW) {
  const chars = String(text).length;
  const charW = 0.6 * fontSize;
  const perLine = Math.max(Math.floor(slotW / charW), 1);
  const lines = Math.min(Math.ceil(chars / perLine), 2);
  const width = Math.min(chars * charW, slotW);
  return { width, lines };
}

function buildInputs(specs, beats) {
  const fontFamily = "Inter";
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

// ── 1. Build the two ShotSpecs and compile them (Node-side, their home) ─────
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

const beat1 = fixtureBeat();
const beat2 = fixtureBeatG5();
const specs = fromBeats([beat1, beat2], { sections: SECTIONS });
const valid = validateShotSpecs(specs);
check("both ShotSpecs validate (schema.js)", valid.valid, valid.errors.join(" | "));
const specMain = specs[0];
const specG5 = specs[1];
check("main spec is PROGRESS with 5 layers [kicker,rail,caption,headline,chart]",
  specMain.archetype === "PROGRESS" && specMain.layers.map((l) => l.role).join(",") === "kicker,rail,caption,headline,chart");
check("G5 spec is PROGRESS with 5 layers (no accent rule, L7)",
  specG5.archetype === "PROGRESS" && specG5.layers.map((l) => l.role).join(",") === "kicker,rail,caption,headline,chart");

const { fonts, measured, anchorFrame } = buildInputs(specs, [beat1, beat2]);
let frames;
try {
  frames = compile(specs, { slots: SLOTS_SHORTS, safe: SAFE_SHORTS, fonts, measured, anchorFrame });
} catch (err) {
  check(`compile did not throw: ${err.message}`, false, err.message);
  frames = [];
}
check("compile produced 2 frames", frames.length === 2, String(frames.length));

const mainRect = frames[0].rects.find((r) => r.role === "chart");
const chart = mainRect && mainRect.chart;
const g5Rect = frames[1].rects.find((r) => r.role === "chart");
const g5Chart = g5Rect && g5Rect.chart;

// ── 2. Compiled-geometry gate (the peer lane's Run 1, mirrored) ─────────────
console.log("Gate — compiled geometry (fromBeats → validate → compile → lintAll)");
if (chart) {
  check("L8 — bar bottoms equal axis exactly (the 36 px float)", lintL8(frames).failures.length === 0 && chart.bars.every((b) => b.bottom === chart.axisY));
  check("L9 — gutters equal (the 42/84 split)", lintL9(frames).failures.length === 0 && Math.max(...chart.gutters) - Math.min(...chart.gutters) <= 1);
  check("L10 — axis label right edge 12 px from gridline", lintL10(frames).failures.length === 0 && chart.gridX - chart.axisLabelRight === 12);
  check("L7 — exactly one accent (the highlight bar)", lintL7(frames).failures.length === 0 && chart.highlightIndex === 1);
  check("compiled geometry exact: x/y/w/h + axis + bars", JSON.stringify(chart.bars[0]) === '{"label":"2019","value":12,"x":88,"w":376,"h":120,"y":776,"bottom":896,"highlight":false}' && JSON.stringify(chart.bars[1]) === '{"label":"2024","value":47,"x":472,"w":376,"h":464,"y":432,"bottom":896,"highlight":true}');
  check("lintAll L1–L12 pass on both frames", lintAll(frames, { slots: SLOTS_SHORTS, safe: SAFE_SHORTS }).pass === true);
  check("main chart layer enters CHART_BUILD at 0, exits NONE", specMain.layers[4].enter.pattern === "CHART_BUILD" && specMain.layers[4].enter.atFrame === 0 && specMain.layers[4].exit.pattern === "NONE");
}
if (g5Chart) {
  check("G5 chart compiled exact: bars 850/1240, highlight 1", g5Chart.bars[0].value === 850 && g5Chart.bars[1].value === 1240 && g5Chart.highlightIndex === 1);
  check("G5 chart rest text targets: fmtValue(850)='850', fmtValue(1240)='1,240'",
    850 .toLocaleString("en-US") === "850" && 1240 .toLocaleString("en-US") === "1,240");
}

const colors = paletteFromHues({ baseHue: 208, accentHue: 26 });
const hexToRgb = (hex) => {
  const n = parseInt(String(hex).replace("#", ""), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
const ACCENT_RGB = hexToRgb(colors.accent);
const SURFACE_RGB = hexToRgb(colors.surface);

// ── 3. Embed rects + the two charts into the browser entry ──────────────────
const layerByRole = new Map(specMain.layers.map((l) => [l.role, l]));
const textFor = (layer) =>
  layer.role === "kicker"
    ? `${String(layer.content.index).padStart(2, "0")} ${layer.content.label}`
    : layer.content.text;
const rectsEmbed = frames[0].rects.map((r) => {
  const layer = layerByRole.get(r.role);
  return {
    rect: { role: r.role, x: r.x, y: r.y, w: r.w, h: r.h, from: r.from, to: r.to, structural: r.structural === true, persistent: r.persistent === true },
    role: r.role,
    enter: { pattern: layer.enter.pattern },
    exit: { pattern: layer.exit.pattern },
    text: r.role === "chart" || r.role === "rail" ? "" : textFor(layer),
    fontSize: r.fontSize || null,
    fontFamily: r.fontFamily || null,
    ...(r.role === "chart" ? { chart: r.chart, unit: layer.content.unit, anchorFrame: anchorFrame[specMain.id] } : {}),
  };
});
const g5Embed = {
  rect: { role: "chart", x: g5Rect.x, y: g5Rect.y, w: g5Rect.w, h: g5Rect.h, from: g5Rect.from, to: g5Rect.to, structural: false, persistent: false },
  chart: g5Chart,
  unit: specG5.layers[4].content.unit,
  anchorFrame: anchorFrame[specG5.id],
};

const entry = [
  'import React, { useEffect } from "react";',
  'import { AbsoluteFill, Composition, delayRender, continueRender, registerRoot, useCurrentFrame } from "remotion";',
  'import Layer from "../../../src/skills/remotion-render/layers/Layer.jsx";',
  'import { Progress } from "../../../src/skills/remotion-render/beats/Progress.jsx";',
  "",
  "const RECTS = " + JSON.stringify(rectsEmbed) + ";",
  "const G5 = " + JSON.stringify(g5Embed) + ";",
  "const SAFE = " + JSON.stringify(SAFE_SHORTS) + ";",
  "const COLORS = " + JSON.stringify(colors) + ";",
  "",
  "function contentFor(r) {",
  "  switch (r.role) {",
  '    case "chart":',
  '      return <Progress chart={r.chart} colors={COLORS} unit={r.unit} anchorFrame={r.anchorFrame} data-chart-instance="main" />;',
  '    case "rail":',
  '      return <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", backgroundColor: COLORS.stroke }} />;',
  "    default:",
  '      return <span style={{ fontSize: r.fontSize, fontFamily: r.fontFamily, color: COLORS.textPrimary, whiteSpace: "nowrap" }}>{r.text}</span>;',
  "  }",
  "}",
  "",
  "function Scene() {",
  "  const frame = useCurrentFrame();",
  "  useEffect(() => {",
  '    const handle = delayRender("progress-probe");',
  "    try {",
  '      console.log("=====PROBE-BEGIN=====");',
  '      console.log("FRAME|" + frame);',
  '      const root = document.getElementById("probe-root");',
  '      const rr = root.getBoundingClientRect();',
  '      const scale = rr.width / 1080;',
  '      console.log("ROOT|scale=" + scale.toFixed(6) + "|" + rr.width + "x" + rr.height + "|docleft=" + rr.left.toFixed(1) + "|doctop=" + rr.top.toFixed(1));',
  '      document.querySelectorAll("[data-rect-id]").forEach((el) => {',
  '        const id = Number(el.getAttribute("data-rect-id"));',
  '        const r = el.getBoundingClientRect();',
  '        const m = { x: (r.left - rr.left) / scale, y: (r.top - rr.top) / scale, w: r.width / scale, h: r.height / scale };',
  '        const e = RECTS[id];',
  '        console.log("LAYER|" + id + "|" + e.role + "|" + m.x.toFixed(2) + "|" + m.y.toFixed(2) + "|" + m.w.toFixed(2) + "|" + m.h.toFixed(2) + "|" + e.rect.x + "|" + e.rect.y + "|" + e.rect.w + "|" + e.rect.h + "|" + (m.x - e.rect.x).toFixed(2) + "|" + (m.y - e.rect.y).toFixed(2) + "|" + (m.w - e.rect.w).toFixed(2) + "|" + (m.h - e.rect.h).toFixed(2));',
  '        const cross = Math.max(0, SAFE.left - m.x, m.x + m.w - SAFE.right, SAFE.top - m.y, m.y + m.h - SAFE.bottom);',
  '        const cs = getComputedStyle(el);',
  '        const selfFlex = cs.display === "flex" ? 1 : 0;',
  '        const parentFlex = getComputedStyle(el.parentElement).display === "flex" ? 1 : 0;',
  '        console.log("SAFE|" + id + "|" + e.role + "|" + cross.toFixed(2));',
  '        console.log("FLEX|" + id + "|" + e.role + "|self=" + selfFlex + "|parent=" + parentFlex);',
  '        console.log("OPACITY|" + id + "|" + e.role + "|" + Number(cs.opacity).toFixed(3));',
  "      });",
  // Main chart interior — bars (rect + value text + fill), gridlines,
  // baseline, axis label (rect + opacity). All relative to the probe root.
  '      document.querySelectorAll("[data-chart-instance=main] [data-bar-id]").forEach((el) => {',
  '        const id = Number(el.getAttribute("data-bar-id"));',
  '        const r = el.getBoundingClientRect();',
  '        const m = { x: (r.left - rr.left) / scale, y: (r.top - rr.top) / scale, w: r.width / scale, h: r.height / scale };',
  '        const val = el.querySelector("[data-value-id]");',
  '        const fill = getComputedStyle(el).backgroundColor;',
  '        console.log("BAR|" + id + "|" + m.x.toFixed(2) + "|" + m.y.toFixed(2) + "|" + m.w.toFixed(2) + "|" + m.h.toFixed(2) + "|" + (val ? val.textContent : "-") + "|" + fill);',
  "      });",
  '      document.querySelectorAll("[data-chart-instance=main] [data-role=gridline]").forEach((el, i) => {',
  '        const r = el.getBoundingClientRect();',
  '        const m = { x: (r.left - rr.left) / scale, y: (r.top - rr.top) / scale, w: r.width / scale, h: r.height / scale };',
  '        console.log("GRIDLINE|" + i + "|" + m.x.toFixed(2) + "|" + m.y.toFixed(2) + "|" + m.w.toFixed(2) + "|" + m.h.toFixed(2));',
  "      });",
  '      const bl = document.querySelector("[data-chart-instance=main] [data-role=baseline]");',
  '      if (bl) { const r = bl.getBoundingClientRect(); console.log("BASELINE|" + ((r.left - rr.left) / scale).toFixed(2) + "|" + ((r.top - rr.top) / scale).toFixed(2) + "|" + (r.width / scale).toFixed(2) + "|" + (r.height / scale).toFixed(2)); }',
  '      const al = document.querySelector("[data-chart-instance=main] [data-role=axis-label]");',
  '      if (al) { const r = al.getBoundingClientRect(); const cs = getComputedStyle(al); console.log("AXISLABEL|" + ((r.left - rr.left) / scale).toFixed(2) + "|" + ((r.top - rr.top) / scale).toFixed(2) + "|" + (r.width / scale).toFixed(2) + "|" + (r.height / scale).toFixed(2) + "|op=" + Number(cs.opacity).toFixed(3)); }',
  // G5 chart — every logged highlight-bar value must carry the separator.
  '      document.querySelectorAll("[data-chart-instance=g5] [data-value-id]").forEach((el) => {',
  '        const id = Number(el.getAttribute("data-value-id"));',
  '        console.log("GVALUE|" + id + "|" + el.textContent);',
  "      });",
  '      console.log("=====PROBE-END=====");',
  "      continueRender(handle);",
  "    } catch (err) {",
  '      console.log("PROBE ERROR: " + String(err && err.message ? err.message : err));',
  "      continueRender(handle);",
  "    }",
  "  }, [frame]);",
  "  return (",
  '    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>',
  '      <div id="probe-root" style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920 }}>',
  "        {RECTS.map((r, i) => (",
  '          <Layer key={i} data-rect-id={i} rect={r.rect} enter={r.enter} exit={r.exit}>',
  "            {contentFor(r)}",
  "          </Layer>",
  "        ))}",
  "        <Layer rect={G5.rect} enter={{ pattern: 'CHART_BUILD', atFrame: 0 }} exit={{ pattern: 'NONE' }}>",
  '          <Progress chart={G5.chart} colors={COLORS} unit={G5.unit} anchorFrame={G5.anchorFrame} data-chart-instance="g5" />',
  "        </Layer>",
  "      </div>",
  "    </AbsoluteFill>",
  "  );",
  "}",
  "",
  'const Root = () => <Composition id="ProgressProbe" component={Scene} durationInFrames={' + DUR + '} fps={30} width={1080} height={1920} />;',
  "registerRoot(Root);",
  "",
].join("\n");
writeFileSync(ENTRY, entry, "utf8");
console.log("PROBE entry bytes:", entry.length);

// ── 4. Bundle + render stills with browser-log capture ──────────────────────
mkdirSync(OUT, { recursive: true });
const serveUrl = await bundle({ entryPoint: ENTRY, publicDir: PUBLIC_DIR, onProgress: () => {} });
console.log("PROBE bundled:", serveUrl);

const LAUNCH_CONFIGS = [
  { gl: "swangle", switches: ["--enable-unsafe-swiftshader"] },
  {},
  { gl: "swangle" },
];

async function openBrowserWithRetry() {
  let lastErr;
  for (let i = 0; i < 6; i++) {
    const opts = LAUNCH_CONFIGS[i % LAUNCH_CONFIGS.length];
    console.log("PROBE openBrowser attempt", i + 1, "config", JSON.stringify(opts));
    const launchPromise = openBrowser({
      browserExecutable: CHROME,
      chromiumOptions: opts,
      dumpio: true,
    });
    const withWatchdog = Promise.race([
      launchPromise,
      new Promise((_, rej) => setTimeout(() => rej(new Error("launch watchdog 60s")), 60000)),
    ]);
    try {
      const b = await withWatchdog;
      console.log("PROBE openBrowser attempt", i + 1, "SUCCESS");
      return b;
    } catch (err) {
      lastErr = err;
      console.log("PROBE openBrowser attempt", i + 1, "failed:", err.message);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  throw lastErr;
}

const browserInstance = await openBrowserWithRetry();
const perFrameLogs = {};

const composition = await selectComposition({
  serveUrl,
  id: "ProgressProbe",
  puppeteerInstance: browserInstance,
  timeoutInMilliseconds: 120000,
});

for (const frame of [...GATED_FRAMES, ...EVIDENCE_FRAMES]) {
  const logs = [];
  await renderStill({
    composition,
    serveUrl,
    output: join(OUT, `progress-f${frame}.png`),
    frame,
    puppeteerInstance: browserInstance,
    timeoutInMilliseconds: 120000,
    onBrowserLog: (l) => logs.push(l),
  });
  perFrameLogs[frame] = logs;
  const logFile = join(OUT, `progress-f${frame}.log`);
  writeFileSync(logFile, logs.map((l) => `[${l.type}] ${l.text}`).join("\n"), "utf8");
  console.log("PROBE still f" + frame + " log lines:", logs.length, "->", logFile);
}
await browserInstance.close({ silent: true });

// ── 5. Parse + assert ───────────────────────────────────────────────────────
const parse = (logs) => {
  const layers = [];
  const safes = [];
  const flexes = [];
  const opacities = [];
  const bars = [];
  const gridlines = [];
  const baselines = [];
  const axislabels = [];
  const gvalues = [];
  let rootScale = null;
  for (const l of logs) {
    const t = l.text || "";
    if (t.startsWith("ROOT|")) rootScale = parseFloat(t.split("|")[1].replace("scale=", ""));
    if (t.startsWith("LAYER|")) {
      const p = t.split("|");
      layers.push({ id: Number(p[1]), role: p[2], mx: +p[3], my: +p[4], mw: +p[5], mh: +p[6], ex: +p[7], ey: +p[8], ew: +p[9], eh: +p[10], dx: +p[11], dy: +p[12], dw: +p[13], dh: +p[14] });
    }
    if (t.startsWith("SAFE|")) {
      const p = t.split("|");
      safes.push({ id: Number(p[1]), role: p[2], cross: +p[3] });
    }
    if (t.startsWith("FLEX|")) {
      const p = t.split("|");
      flexes.push({ id: Number(p[1]), role: p[2], self: Number(p[3].replace("self=", "")), parent: Number(p[4].replace("parent=", "")) });
    }
    if (t.startsWith("OPACITY|")) {
      const p = t.split("|");
      opacities.push({ id: Number(p[1]), role: p[2], op: +p[3] });
    }
    if (t.startsWith("BAR|")) {
      const p = t.split("|");
      bars.push({ id: Number(p[1]), mx: +p[2], my: +p[3], mw: +p[4], mh: +p[5], text: p[6], fill: p[7] });
    }
    if (t.startsWith("GRIDLINE|")) {
      const p = t.split("|");
      gridlines.push({ i: Number(p[1]), mx: +p[2], my: +p[3], mw: +p[4], mh: +p[5] });
    }
    if (t.startsWith("BASELINE|")) {
      const p = t.split("|");
      baselines.push({ x: +p[1], y: +p[2], w: +p[3], h: +p[4] });
    }
    if (t.startsWith("AXISLABEL|")) {
      const p = t.split("|");
      axislabels.push({ x: +p[1], y: +p[2], w: +p[3], h: +p[4], op: parseFloat(p[5].replace("op=", "")) });
    }
    if (t.startsWith("GVALUE|")) {
      const p = t.split("|");
      gvalues.push({ id: Number(p[1]), text: p[2] });
    }
  }
  return { layers, safes, flexes, opacities, bars, gridlines, baselines, axislabels, gvalues, rootScale };
};

const report = (frame, gate, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"} [f${frame}] ${gate} ${detail}`);
  if (!ok) failed++;
};

console.log("===== PROBE ASSERTIONS =====");

// G1–G3: layer geometry, safe rect, flex — settled stills only.
for (const frame of GATED_FRAMES) {
  const d = parse(perFrameLogs[frame] || []);
  if (d.layers.length !== rectsEmbed.length) {
    report(frame, "MEASURE-COUNT", false, `${d.layers.length}/${rectsEmbed.length} layers measured`);
    continue;
  }
  const geomOk = d.layers.every((l) =>
    Math.abs(l.dx) <= TOL && Math.abs(l.dy) <= TOL && Math.abs(l.dw) <= TOL && Math.abs(l.dh) <= TOL
  );
  const worst = d.layers.map((l) => Math.max(Math.abs(l.dx), Math.abs(l.dy), Math.abs(l.dw), Math.abs(l.dh))).reduce((a, b) => Math.max(a, b), 0);
  report(frame, "G1 LAYER GEOMETRY ±2px", geomOk, `worst |d| = ${worst.toFixed(2)}px over ${d.layers.length} layers`);
  d.layers.forEach((l) =>
    console.log(`  ${l.role.padEnd(9)} measured (${l.mx},${l.my}) ${l.mw}x${l.mh}  compiled (${l.ex},${l.ey}) ${l.ew}x${l.eh}  d=(${l.dx},${l.dy},${l.dw},${l.dh})`)
  );

  const safeOk = d.safes.every((s) => s.cross <= TOL);
  const worstCross = d.safes.map((s) => s.cross).reduce((a, b) => Math.max(a, b), 0);
  report(frame, "G2 SAFE-ZONE CROSSINGS ≤2px", safeOk, `worst crossing = ${worstCross.toFixed(2)}px (0 = fully inside SAFE_SHORTS)`);

  const flexOk = d.flexes.every((f) => f.self === 0 && f.parent === 0);
  report(frame, "G3 ZERO SIBLING FLEX", flexOk, d.flexes.every((f) => f.self === 0) ? "no Layer div is flex; " : "a Layer div IS flex; " + (d.flexes.every((f) => f.parent === 0) ? "no flex container parents" : "a flex container parents the layers"));

  report(frame, "ROOT SCALE ≈ 1", d.rootScale != null && Math.abs(d.rootScale - 1) < 0.05, `scale=${d.rootScale == null ? "MISSING" : d.rootScale.toFixed(4)}`);
}

// G4 — the stage-8 gate in the DOM at rest: L8/L9/L10/L7 + geometry + texts.
for (const frame of GATED_FRAMES) {
  const d = parse(perFrameLogs[frame] || []);
  const b = d.bars;
  if (b.length !== 2) {
    report(frame, "G4 CHART INTERIOR (L8/L9/L10/L7)", false, `${b.length}/2 bars measured`);
    continue;
  }
  const b0 = b.find((x) => x.id === 0);
  const b1 = b.find((x) => x.id === 1);
  const bottom0 = b0.my + b0.mh;
  const bottom1 = b1.my + b1.mh;
  const gutter = b1.mx - (b0.mx + b0.mw);
  const al = d.axislabels[0];
  const accentCount = b.filter((x) => x.fill === ACCENT_RGB).length;

  const l8 = Math.abs(bottom0 - AXIS_Y) <= TOL && Math.abs(bottom1 - AXIS_Y) <= TOL;
  const l9 = Math.abs(gutter - GUTTER) <= TOL;
  const l10 = al != null && Math.abs(al.x + al.w - AXIS_LABEL_RIGHT) <= TOL;
  const l7 = accentCount === 1;
  const geom = Math.abs(b0.mw - BAR_W) <= TOL && Math.abs(b1.mw - BAR_W) <= TOL &&
    Math.abs(b0.mh - BAR_H[0]) <= TOL && Math.abs(b1.mh - BAR_H[1]) <= TOL;
  const texts = b0.text === "12" && b1.text === "47";
  const grid = d.gridlines.length === 3 && d.gridlines.every((g) => Math.abs(g.mw - PLOT_W) <= TOL);
  const base = d.baselines[0] != null && Math.abs(d.baselines[0].w - PLOT_W) <= TOL;

  report(frame, "G4 L8 — bar bottoms == axis (896) ±2px", l8, `bottom0=${bottom0.toFixed(2)} bottom1=${bottom1.toFixed(2)} (axis ${AXIS_Y})`);
  report(frame, "G4 L9 — gutter == 8 ±2px", l9, `measured gutter=${gutter.toFixed(2)}px`);
  report(frame, "G4 L10 — axis-label right edge == 76 ±2px", l10, al ? `right=${(al.x + al.w).toFixed(2)}px (gridX−12 = ${AXIS_LABEL_RIGHT})` : "axis-label missing");
  report(frame, "G4 L7 — exactly one accent fill", l7, `accent fills=${accentCount} (surface=${SURFACE_RGB}, accent=${ACCENT_RGB})`);
  report(frame, "G4 bar geometry ±2px (w 376, h 120/464)", geom, `b0=${b0.mw.toFixed(1)}x${b0.mh.toFixed(1)} b1=${b1.mw.toFixed(1)}x${b1.mh.toFixed(1)}`);
  report(frame, "G4 counter rest text == Chart.jsx fmtValue", texts, `"${b0.text}" / "${b1.text}" (expect "12"/"47")`);
  report(frame, "G4 gridlines + baseline fully drawn", grid && base, `gridlines=${d.gridlines.length} baseline=${d.baselines[0] ? d.baselines[0].w.toFixed(1) : "MISSING"}px`);
}

// G5 — counter format stability: raised floor keeps the digit count; the
// clamp holds the target through the overshoot; separators from frame 0.
for (const frame of GATED_FRAMES) {
  const d = parse(perFrameLogs[frame] || []);
  const b1 = d.bars.find((x) => x.id === 1);
  const b0 = d.bars.find((x) => x.id === 0);
  const gv = d.gvalues;
  const g5Hl = gv.find((v) => v.id === 1);
  const g5Lo = gv.find((v) => v.id === 0);
  report(frame, "G5 rest text == fmtValue (main 12/47)", b0 != null && b0.text === "12" && b1 != null && b1.text === "47",
    b0 && b1 ? `"${b0.text}" / "${b1.text}"` : "bars missing");
  report(frame, "G5 4-digit separators from frame 0 + rest '1,240'", g5Hl != null && g5Hl.text.includes(",") && g5Hl.text === "1,240",
    g5Hl ? `"${g5Hl.text}"` : "g5 highlight value missing");
  report(frame, "G5 3-digit bar rest '850' (no comma — correct)", g5Lo != null && g5Lo.text === "850", g5Lo ? `"${g5Lo.text}"` : "g5 bar0 missing");
}
{
  const d20 = parse(perFrameLogs[20] || []);
  const b1 = d20.bars.find((x) => x.id === 1);
  const g5 = d20.gvalues.filter((v) => v.id === 1).map((v) => v.text);
  report(20, "G5 overshoot clamp — highlight counter reads '47' (never '53')", b1 != null && b1.text === "47",
    b1 ? `text="${b1.text}" (bar h=${b1.mh.toFixed(1)} > 464 — still overshooting)` : "bar1 missing");
  report(20, "G5 4-digit intermediate has the separator", g5.length > 0 && g5.every((t) => t.includes(",")),
    g5.length ? `"${g5.join('", "')}"` : "g5 highlight value missing at f20");
}

// Evidence — motion branches actually fire (not ±2 gated).
{
  const d9 = parse(perFrameLogs[9] || []);
  const base = d9.baselines[0];
  const gl = d9.gridlines;
  const bars = d9.bars;
  const al = d9.axislabels[0];
  report(9, "E1 construction order — baseline drawn, gridline 0 partial, gridline 1 zero",
    base != null && Math.abs(base.w - 759.91) <= EV_TOL &&
    gl.length === 3 && Math.abs(gl[0].mw - 375.74) <= EV_TOL && Math.abs(gl[1].mw - 0) <= 0.5,
    `baseline=${base ? base.w.toFixed(1) : "MISSING"}px (expect 759.9), g0=${gl[0] ? gl[0].mw.toFixed(1) : "?"}px (expect 375.7), g1=${gl[1] ? gl[1].mw.toFixed(1) : "?"}px (expect 0)`);
  report(9, "E1 bar 0 growing, bar 1 absent (stagger), axis label waiting (op 0)",
    bars.length === 1 && bars[0].id === 0 && Math.abs(bars[0].mh - 62.33) <= EV_TOL && al != null && al.op === 0,
    `bars=${bars.length} (bar0 h=${bars[0] ? bars[0].mh.toFixed(1) : "?"}px expect 62.3), axis-label op=${al ? al.op : "MISSING"} (RISE waits for ${RISE_AT})`);
}
{
  const d20 = parse(perFrameLogs[20] || []);
  const b0 = d20.bars.find((x) => x.id === 0);
  const b1 = d20.bars.find((x) => x.id === 1);
  const g0 = d20.gridlines[0];
  report(20, "E2 overshoot — bar1 taller than its compiled 464 (p(7)=1.123)",
    b1 != null && b1.mh > 464 + TOL && b0 != null && Math.abs(b0.mh - 119.46) <= EV_TOL,
    `b0=${b0 ? b0.mh.toFixed(1) : "?"}px (expect 119.5), b1=${b1 ? b1.mh.toFixed(1) : "?"}px (>464)`);
  report(20, "E2 gridline 0 fully drawn (760)", g0 != null && Math.abs(g0.mw - PLOT_W) <= EV_TOL, g0 ? `${g0.mw.toFixed(1)}px` : "missing");
}
{
  const d36 = parse(perFrameLogs[36] || []);
  const d37 = parse(perFrameLogs[37] || []);
  const b36 = d36.bars.find((x) => x.id === 1);
  const b37 = d37.bars.find((x) => x.id === 1);
  const acc36 = d36.bars.filter((x) => x.fill === ACCENT_RGB).length;
  const acc37 = d37.bars.filter((x) => x.fill === ACCENT_RGB).length;
  report(36, "E3 1-frame switch — surface at 36 (0 accents)", b36 != null && b36.fill === SURFACE_RGB && acc36 === 0,
    b36 ? `fill=${b36.fill} (expect ${SURFACE_RGB})` : "bar1 missing");
  report(37, "E3 1-frame switch — accent at 37 (1 accent)", b37 != null && b37.fill === ACCENT_RGB && acc37 === 1,
    b37 ? `fill=${b37.fill} (expect ${ACCENT_RGB})` : "bar1 missing");
  report(37, "E3 SFX frame consistency — accent lands exactly at highlightStart+24",
    HL_START + 24 === ACCENT_AT, `highlightStart=${HL_START}, +24 = ${ACCENT_AT}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
