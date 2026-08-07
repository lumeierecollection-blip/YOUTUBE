// audit-layout Stage 7 — Tier 2 probe (claim LAY-020). Runs in the REAL
// render engine: compile() → Layer + the five primitive drafts → bundle →
// renderStill → onBrowserLog DOM measurement. Pattern: data/audit/2
// measure-current.mjs + data/audit/5 font-gate-probe.mjs.
//
// Proves, empirically in Chrome at settled stills (frames 30, 45 of a 90f
// beat — every entrance ≥ D.base=9 done, every exit window ≥78 not started):
//   G1. LAY-12 geometry: measured getBoundingClientRect == compiled rect
//       within ±2 px on x/y/w/h for EVERY layer (kicker, chart, headline,
//       caption, rail, accent, support — all 7 roles).
//   G2. zero safe-rect crossings: every measured rect inside SAFE_SHORTS,
//       beyond the ±2 px measurement tolerance (slots sit flush at the safe
//       edge — kicker top 288, rail left 48, caption bottom 1248 — so this
//       genuinely stress-tests the boundary).
//   G3. zero sibling flex: no Layer div is display:flex and the container
//       holding the Layer divs (the Stage positioner) is not flex. Chip's
//       internal flex is a LEAF descendant (allowed, §4.1 R1) and is
//       deliberately rendered inside the chart layer to prove it never trips
//       the sibling gate.
// Evidence (bonus, not gated): frames 3 (entrances in flight — opacity < 1)
// and 86 (exit windows active — stage/headline/support/accent opacity 0,
// caption 0<op<1, kicker/rail 1) prove both motion branches execute live.
// Frame 86 additionally proves EXIT ROLE ROUTING by dy sign: headline/accent
// fade-only (dy 0), chart/support stage exit (dy −12), caption-test (an
// entry-level branch-coverage layer — production captions are exit NONE, so
// the D3 caption 3f branch is dormant in compiled output) at measured scale
// 0.97. rect.role is embedded exactly as compile() emits it (compile.js:
// 169,223,275,310) because Layer's exit routing keys off it — the v1 probe
// dropped it and the counter-check caught every FADE layer landing in the
// default branch.
//
// Front-end px are scale-aware: every measurement is normalized by the
// probe-root div's measured width / 1080 (renders at scale 1 in headless,
// verified by the ROOT log line).
//
// Staging note: the primitive drafts live in data/audit/7/primitives-draft/
// awaiting the SFR production move. Icon.jsx imports "../compositions/…"
// which resolves correctly ONLY from the production home
// (src/skills/remotion-render/primitives/). This runner copies the five
// drafts into probe-prims/ and rewrites exactly those three import
// specifiers to the absolute-from-repo path — a staging-path artifact, not
// a draft defect (the drafts were authored for their final location).
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill, openBrowser } from "@remotion/renderer";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { compile } from "../../../src/skills/remotion-render/layout/compile.js";
import {
  measuredKey,
  renderedTextForContent,
} from "../../../src/skills/remotion-render/layout/compile-lint.js";
import { paletteFromHues } from "../../../src/skills/remotion-render/styles/tokens.js";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "out");
const PRIMS = join(here, "probe-prims");
const ENTRY = join(here, "_tier2-entry.jsx");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const SAFE = { left: 48, right: 888, top: 288, bottom: 1248 }; // SAFE_SHORTS
const FONT_FAMILY = "ProbeSans";
const DUR = 90;
const TOL = 2; // ±2 px gate (LAY-12)
const CAPTION_EXIT_SCALE = 0.97; // Layer.jsx D3 caption exit (MANUAL D3)
const GATED_FRAMES = [30, 45]; // settled stills — the ±2 px gate
const EVIDENCE_FRAMES = [3, 86]; // motion branches — opacity evidence only

// ── 1. Build the ShotSpec and compile it (Node-side, its home) ────────────
const spec = {
  id: "probeBeat",
  archetype: "statement",
  startFrame: 0,
  durationInFrames: DUR,
  anchorTokenIndex: 0,
  layers: [
    { role: "kicker", slot: "kicker", align: "top-left", content: { index: 2, label: "THE PROBE" }, enter: { pattern: "RISE", atFrame: 0 }, exit: { pattern: "NONE" } },
    { role: "chart", slot: "stage", content: { series: [{ label: "A", value: 40 }, { label: "B", value: 90 }, { label: "C", value: 60 }, { label: "D", value: 75 }] }, enter: { pattern: "POP", atFrame: 0 }, exit: { pattern: "FADE", atFrame: "end-6" } },
    { role: "headline", slot: "headline", align: "top-left", content: { text: "THE PROBE SETTLED" }, enter: { pattern: "RISE", atFrame: 0 }, exit: { pattern: "FADE", atFrame: "end-6" } },
    { role: "caption", slot: "caption", align: "bottom", content: { text: "A probe caption line" }, enter: { pattern: "RISE", atFrame: 0 }, exit: { pattern: "NONE" } },
    { role: "rail", slot: "rail", enter: { pattern: "NONE" }, exit: { pattern: "NONE" } },
    { role: "accent", slot: "headline", enter: { pattern: "FADE", atFrame: 0 }, exit: { pattern: "FADE", atFrame: "end-6" } },
    { role: "support", slot: "stage", align: "bottom-left", content: { text: "SOURCE: TIER 2 PROBE" }, enter: { pattern: "NONE" }, exit: { pattern: "FADE", atFrame: "end-6" } },
  ],
};

// Deterministic browser-fed inputs (this probe gates LAYER placement, not
// measure.js accuracy — widths/lines are fabricated but every compile R3
// input is satisfied and every rect snaps to the 8 px grid).
const FONT_SIZE = { kicker: 64, chart: null, headline: 84, caption: 64, rail: null, accent: null, support: 32 };
const MEASURE_W = { kicker: 400, headline: 760, caption: 640, support: 304 };
const fonts = {};
const measured = {};
spec.layers.forEach((layer, i) => {
  if (FONT_SIZE[layer.role] == null) return;
  fonts[`${spec.id}:${i}`] = { fontSize: FONT_SIZE[layer.role], fontFamily: FONT_FAMILY };
  const text = renderedTextForContent(layer.content);
  const key = measuredKey(text, FONT_SIZE[layer.role], FONT_FAMILY);
  measured[key] = { width: MEASURE_W[layer.role], lines: 1 };
});

const [beat] = compile([spec], { fonts, measured });
console.log("PROBE compiled", beat.rects.length, "rects");
for (const r of beat.rects) {
  console.log(`PROBE rect ${r.role.padEnd(9)} ${r.x},${r.y} ${r.w}x${r.h} from=${r.from} to=${r.to} structural=${!!r.structural}`);
}

const colors = paletteFromHues({ baseHue: 208, accentHue: 26 });

// ── 2. Copy drafts → probe-prims, rewriting Icon.jsx's 3 import specifiers ─
// (staging-path artifact only; see header comment.)
const ICON_IMPORTS = {
  "../compositions/icons-data.js": "../../../../src/skills/remotion-render/compositions/icons-data.js",
  "../compositions/mg-style.js": "../../../../src/skills/remotion-render/compositions/mg-style.js",
  "../compositions/beats.js": "../../../../src/skills/remotion-render/compositions/beats.js",
};
mkdirSync(PRIMS, { recursive: true });
for (const name of ["Rule", "Chip", "Node", "Panel", "Icon"]) {
  const src = readFileSync(join(here, "primitives-draft", `${name}.jsx`), "utf8");
  let text = src;
  if (name === "Icon") {
    for (const [from, to] of Object.entries(ICON_IMPORTS)) {
      const before = text;
      text = text.replaceAll(from, to);
      const count = before.split(from).length - 1;
      if (count !== 1) throw new Error(`Icon.jsx import rewrite "${from}" matched ${count}× (expected 1)`);
    }
  }
  writeFileSync(join(PRIMS, `${name}.jsx`), text, "utf8");
}
console.log("PROBE staged primitives ->", PRIMS);

// ── 3. Generate the browser entry ─────────────────────────────────────────
const layerByRole = new Map(spec.layers.map((l) => [l.role, l]));
const rectsEmbed = beat.rects.map((r) => {
  const layer = layerByRole.get(r.role);
  return {
    // rect carries role EXACTLY as compile() emits it (compile.js:169,223,
    // 275,310) — Layer's D3 exit routing keys off rect.role. Dropping it
    // (a v1 probe bug found by the counter-check) made every FADE layer take
    // the default stage-exit branch and never exercised the headline/accent
    // fade-only branch.
    rect: { role: r.role, x: r.x, y: r.y, w: r.w, h: r.h, from: r.from, to: r.to, structural: r.structural === true, persistent: r.persistent === true },
    role: r.role,
    enter: { pattern: layer.enter.pattern },
    exit: { pattern: layer.exit.pattern },
    text: r.role === "chart" || r.role === "rail" || r.role === "accent" ? "" : renderedTextForContent(layer.content),
    fontSize: r.fontSize || null,
    fontFamily: r.fontFamily || null,
  };
});

// Branch-coverage layer (entry-level, NOT compiled): the production shot
// builder always emits caption exit NONE (build-shots.mjs:163), so the D3
// caption exit branch (3f fade + scale → 0.97, Layer.jsx exitStyle) is
// dormant in compiled output. This synthetic layer proves that branch
// in-engine: rect.role "caption" (routing key), top-level role
// "caption-test" (log/assert key), to=84 → 3f window (81,84], at f86 the
// measured width must be 0.97 × 640.
rectsEmbed.push({
  rect: { role: "caption", x: 148, y: 1096, w: 640, h: 72, from: 0, to: 84, structural: false, persistent: false },
  role: "caption-test",
  enter: { pattern: "RISE" },
  exit: { pattern: "FADE" },
  text: "CAPTION EXIT BRANCH",
  fontSize: 64,
  fontFamily: FONT_FAMILY,
});

const entry = [
  'import React, { useEffect } from "react";',
  'import { AbsoluteFill, Composition, delayRender, continueRender, registerRoot, useCurrentFrame } from "remotion";',
  'import Layer from "../../../src/skills/remotion-render/layers/Layer.jsx";',
  'import Rule from "./probe-prims/Rule.jsx";',
  'import Chip from "./probe-prims/Chip.jsx";',
  'import Node from "./probe-prims/Node.jsx";',
  'import Panel from "./probe-prims/Panel.jsx";',
  'import Icon from "./probe-prims/Icon.jsx";',
  "",
  "const RECTS = " + JSON.stringify(rectsEmbed) + ";",
  "const SAFE = " + JSON.stringify(SAFE) + ";",
  "const COLORS = " + JSON.stringify(colors) + ";",
  "",
  "function contentFor(r) {",
  "  switch (r.role) {",
  '    case "kicker":',
  '      return <Icon name="flame" color={COLORS.accent} size={64} />;',
  '    case "chart":',
  '      return <Panel colors={COLORS}><Node colors={COLORS} active /><Chip colors={COLORS} active>PROBE</Chip></Panel>;',
  '    case "rail":',
  '      return <Rule colors={COLORS} x1={2} y1={0} x2={2} y2={100} thickness={4} />;',
  '    case "accent":',
  '      return <Rule colors={COLORS} thickness={4} color={COLORS.accent} />;',
  "    default:",
  '      return <span style={{ fontSize: r.fontSize, fontFamily: r.fontFamily, color: r.role === "headline" ? COLORS.textPrimary : COLORS.textDim }}>{r.text}</span>;',
  "  }",
  "}",
  "",
  "function Scene() {",
  "  const frame = useCurrentFrame();",
  "  useEffect(() => {",
  '    const handle = delayRender("tier2-probe");',
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
      // Layer coords are measured RELATIVE to the composition root (the
      // headless renderer places the composition at an arbitrary document
      // offset — docleft/doctop above — so viewport coords are meaningless;
      // only rects relative to the root are composition px, which is what
      // compile() emits). Matches the Stage-2 relative-measure precedent.
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
  '      console.log("=====PROBE-END=====");',
  "      continueRender(handle);",
  "    } catch (err) {",
  '      console.log("PROBE ERROR: " + String(err && err.message ? err.message : err));',
  "      continueRender(handle);",
  "    }",
  "  }, [frame]);",
  "  return (",
  "    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>",
  '      <div id="probe-root" style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920 }}>',
  "        {RECTS.map((r, i) => (",
  "          <Layer key={i} data-rect-id={i} rect={r.rect} enter={r.enter} exit={r.exit}>",
  "            {contentFor(r)}",
  "          </Layer>",
  "        ))}",
  "      </div>",
  "    </AbsoluteFill>",
  "  );",
  "}",
  "",
  'const Root = () => <Composition id="Tier2Probe" component={Scene} durationInFrames={' + DUR + '} fps={30} width={1080} height={1920} />;',
  "registerRoot(Root);",
  "",
].join("\n");
writeFileSync(ENTRY, entry, "utf8");
console.log("PROBE entry bytes:", entry.length);

// ── 4. Bundle + render stills with browser-log capture ────────────────────
mkdirSync(OUT, { recursive: true });
const serveUrl = await bundle({ entryPoint: ENTRY, onProgress: () => {} });
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
  id: "Tier2Probe",
  puppeteerInstance: browserInstance,
  timeoutInMilliseconds: 120000,
});

for (const frame of [...GATED_FRAMES, ...EVIDENCE_FRAMES]) {
  const logs = [];
  await renderStill({
    composition,
    serveUrl,
    output: join(OUT, `tier2-f${frame}.png`),
    frame,
    puppeteerInstance: browserInstance,
    timeoutInMilliseconds: 120000,
    onBrowserLog: (l) => logs.push(l),
  });
  perFrameLogs[frame] = logs;
  const logFile = join(OUT, `tier2-f${frame}.log`);
  writeFileSync(logFile, logs.map((l) => `[${l.type}] ${l.text}`).join("\n"), "utf8");
  console.log("PROBE still f" + frame + " log lines:", logs.length, "->", logFile);
}
await browserInstance.close({ silent: true });

// ── 5. Parse + assert ─────────────────────────────────────────────────────
const parse = (logs) => {
  const layers = [];
  const safes = [];
  const flexes = [];
  const opacities = [];
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
  }
  return { layers, safes, flexes, opacities, rootScale };
};

let failures = 0;
const report = (frame, gate, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"} [f${frame}] ${gate} ${detail}`);
  if (!ok) failures++;
};

console.log("===== PROBE ASSERTIONS =====");
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
  report(frame, "LAY-12 GEOMETRY ±2px", geomOk, `worst |d| = ${worst.toFixed(2)}px over ${d.layers.length} layers`);
  d.layers.forEach((l) =>
    console.log(`  ${l.role.padEnd(9)} measured (${l.mx},${l.my}) ${l.mw}x${l.mh}  compiled (${l.ex},${l.ey}) ${l.ew}x${l.eh}  d=(${l.dx},${l.dy},${l.dw},${l.dh})`)
  );

  const safeOk = d.safes.every((s) => s.cross <= TOL);
  const worstCross = d.safes.map((s) => s.cross).reduce((a, b) => Math.max(a, b), 0);
  report(frame, "SAFE-ZONE CROSSINGS ≤2px", safeOk, `worst crossing = ${worstCross.toFixed(2)}px (0 = fully inside SAFE_SHORTS)`);

  const flexOk = d.flexes.every((f) => f.self === 0 && f.parent === 0);
  report(frame, "ZERO SIBLING FLEX", flexOk, d.flexes.every((f) => f.self === 0) ? "no Layer div is flex; " : "a Layer div IS flex; " + (d.flexes.every((f) => f.parent === 0) ? "no flex container parents" : "a flex container parents the layers"));

  report(frame, "ROOT SCALE ≈ 1", d.rootScale != null && Math.abs(d.rootScale - 1) < 0.05, `scale=${d.rootScale == null ? "MISSING" : d.rootScale.toFixed(4)}`);
}

for (const frame of EVIDENCE_FRAMES) {
  const d = parse(perFrameLogs[frame] || []);
  const op = Object.fromEntries(d.opacities.map((o) => [o.role, o.op]));
  if (frame === 3) {
    // Entrances in flight: RISE/FADE envelopes at rel=3 < D.base=9 → opacity < 1.
    const inFlight = ["kicker", "headline", "caption", "accent"].filter((r) => op[r] != null && op[r] < 0.99);
    report(frame, "ENTRANCE BRANCH FIRES (op<1)", inFlight.length === 4,
      `in-flight at rel=3: ${inFlight.join(", ") || "NONE"}  full: ${JSON.stringify(op)}`);
    const rail = op.rail;
    report(frame, "FURNITURE RAIL HOLDS op=1", rail != null && rail > 0.99, `rail opacity=${rail == null ? "MISSING" : rail}`);
  }
  if (frame === 86) {
    // Exit windows active: to=84 for chart/headline/support/accent/
    // caption-test (fade at end-6 → exit window (78,84], gone past 84);
    // kicker/caption exit NONE (persistent trio + build-shots.mjs) → held at
    // 1; rail is furniture → 1.
    const gone = ["chart", "headline", "support", "accent", "caption-test"].filter((r) => op[r] != null && op[r] < 0.01);
    const held = ["kicker", "caption", "rail"].filter((r) => op[r] != null && op[r] > 0.99);
    report(frame, "EXIT BRANCH FIRES (NONE held / FADE gone)", gone.length === 5 && held.length === 3,
      `gone at to=84: ${gone.join(", ")}  held (NONE/furniture): ${held.join(", ")}`);

    // Role-routing discrimination (the counter-check's reject point): the
    // dy sign distinguishes WHICH exit branch fired —
    //   headline/accent: fade-only → dy = 0 (no translate);
    //   chart/support:   stage exit   → dy = −12;
    //   caption-test:    caption exit → scale 0.97, no translate.
    const dy = Object.fromEntries(d.layers.map((l) => [l.role, l.dy]));
    const fadeOnlyOk = Math.abs(dy.headline) <= TOL && Math.abs(dy.accent) <= TOL;
    const stageExitOk = Math.abs(dy.chart + 12) <= TOL && Math.abs(dy.support + 12) <= TOL;
    const ct = d.layers.find((l) => l.role === "caption-test");
    const captionScaleOk = ct != null && Math.abs(ct.mw / ct.ew - CAPTION_EXIT_SCALE) <= 0.02;
    report(frame, "EXIT ROLE ROUTING (headline/accent fade-only, stage −12, caption scale 0.97)",
      fadeOnlyOk && stageExitOk && captionScaleOk,
      `dy: headline=${dy.headline}, accent=${dy.accent}, chart=${dy.chart}, support=${dy.support}; ` +
      `caption-test measured scale=${ct == null ? "MISSING" : (ct.mw / ct.ew).toFixed(3)} (expect 0.97)`);
  }
}

console.log("===== PROBE RESULT:", failures === 0 ? "ALL GATES PASS" : failures + " FAILURE(S) =====");
process.exitCode = failures === 0 ? 0 : 1;
