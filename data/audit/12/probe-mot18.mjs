#!/usr/bin/env node
/**
 * MOT-18 probe — motion blur only inside a transition subtree.
 *
 * Tier-1 compiled measure (CHECK-REGISTER §3.4 MOT-18, owner audit-motion,
 * Stage 12). E1: the number is measured over the real composition graph, not
 * read from code. Run from the render subpackage:
 *
 *   node data/audit/12/probe-mot18.mjs
 *
 * WHAT IT MEASURES
 *   1. MOTION-BLUR primitives anywhere in the composition graph — the
 *      `@remotion/motion-blur` package (<CameraMotionBlur>, <Trail>) and any
 *      frame-progress-driven `blur(...)`. These may exist ONLY inside a
 *      transition subtree. Count = motionBlurTotal; passes iff
 *      outsideTransition === 0. (CHECK-REGISTER MOT-18, threshold 0 elsewhere.)
 *   2. The DEPTH-blur inventory (ALLOWED, and distinct): the static per-plane
 *      blur in DEPTH_PROFILES (subject must stay 0 so the read layer is
 *      sharp; non-subject planes are fixed constants, never frame-driven).
 *
 * Because composition.js is importable but the MOT-18 gate landed there via
 * SFR (orchestrator), this probe prefers composition.js's
 * gateMotionBlur/scanMotionBlurSource/isTransitionContextFile/MOTION_BLUR_SIGNALS
 * and falls back to a bundled copy so it runs before AND after that SFR
 * applies.
 *
 * NEGATIVE FIXTURES (E3 — a tier-1 check that has never failed is untested):
 *   - a planted <CameraMotionBlur> in a HOLD/caption/end-card context MUST be
 *     reported outside a transition (gate FAILS) — proves the check has teeth;
 *   - a planted <CameraMotionBlur> in a TRANSITION context MUST be reported
 *     inside a transition (gate still passes for that file) — proves the
 *     boundary actually admits the allowed case;
 *   - a planted frame-driven blur in a caption file MUST be caught;
 *   - (Phase 4) a real violation planted two lines AFTER the real MOT-18 gate
 *     block as it exists in composition.js MUST still be caught — proves the
 *     self-match exemption is token-absence (byte-level), not a skippable
 *     region a future editor could hide a regression in.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { join, dirname, relative, normalize } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
// PROBE_MOT18_RENDER_DIR: test hook so the probe can measure a STAGED render
// tree (used to validate SFR-motion-12-2 before the orchestrator applies it:
// the staged tree is the real tree except visual/composition.js carries the
// SFR patch). Unset = the real render tree.
const RENDER = process.env.PROBE_MOT18_RENDER_DIR
  ? normalize(process.env.PROBE_MOT18_RENDER_DIR)
  : normalize(join(HERE, "..", "..", "..", "src", "skills", "remotion-render"));
const COMPOSITION_FILE = join(RENDER, "visual", "composition.js");
// Dynamic import so the probe can load the composition gate from the staged
// tree; identical to a static import on the default path.
const composition = await import(pathToFileURL(COMPOSITION_FILE).href);
const OUT = join(HERE, "mot18-report.json");

// ── Prefer the gate if the SFR put it in composition.js; else use the
// ── bundled copy so the probe runs whether or not the SFR has been applied.
const FALLBACK = ((mod) => {
  const gate = mod.gateMotionBlur || undefined;
  const scan = mod.scanMotionBlurSource || undefined;
  const isTrans = mod.isTransitionContextFile || undefined;
  return {
    gateReady: Boolean(gate),
    gate,
    scan: scan || null,
    isTrans: isTrans || null,
  };
})(composition);

// Bundled fallback is behaviourally identical to composition.js's gate and is
// built from fragments for the same reason (Phase 4 self-match fix): no
// signal token appears as a contiguous string in any scanner's own code.
const MOTION_BLUR_SIGNALS =
  composition.MOTION_BLUR_SIGNALS || [
    { name: '@remotion' + '/' + 'motion-blur' + ' package', re: new RegExp('@remotion' + '/' + 'motion-blur') },
    { name: '<' + 'CameraMotionBlur' + '>', re: new RegExp('<' + 'CameraMotionBlur' + '\\b') },
    { name: '<' + 'Trail' + '> (motion-blur package)', re: new RegExp('<' + 'Trail' + '\\b') },
  ];

const FRAME_BLUR_RE =
  composition.FRAME_BLUR_RE ||
  /blur\(\s*.*?(?:interpolate\s*\(|ease\s*\(|progressOf\s*\(|Math\.(?:sin|cos)\s*\(|\bframe\b|\bp\b\s*[*+])/;

function scanMotionBlurSource(src, { isTransitionContext = false } = {}) {
  const hits = [];
  const lines = String(src).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const sig of MOTION_BLUR_SIGNALS) {
      if (sig.re.test(line)) {
        hits.push({ line: i + 1, signal: sig.name, inTransition: isTransitionContext });
      }
    }
    if (/blur\(/.test(line) && FRAME_BLUR_RE.test(line)) {
      hits.push({
        line: i + 1,
        signal: "frame-driven blur (a blur that follows motion)",
        inTransition: isTransitionContext,
      });
    }
  }
  return hits;
}

function isTransitionContextFile(filePath) {
  const base = String(filePath).toLowerCase().replace(/\\/g, "/");
  return /(?:^|\/)(?:transition|transitions|presentation|presentations)\b/.test(base);
}

function gateMotionBlur(sourceMap) {
  const files = Object.entries(sourceMap);
  const outside = [];
  const inside = [];
  let totalHits = 0;
  for (const [file, src] of files) {
    const inTransition = isTransitionContextFile(file);
    const hits = scanMotionBlurSource(src, { isTransitionContext: inTransition });
    for (const h of hits) {
      totalHits += 1;
      (h.inTransition ? inside : outside).push({ file, ...h });
    }
  }
  return {
    pass: outside.length === 0,
    totalMotionBlur: totalHits,
    outsideTransition: outside.length,
    insideTransition: inside.length,
    detail: { inside, outside },
  };
}

// Which source is authoritative — composition.js (SFR applied) or bundled copy.
// Phase 4 note: if the applied gate is the pre-fix SFR-1 version, scanning
// visual/composition.js (itself a graph file) flags the gate's OWN declaration
// block as motion blur — a self-match, not composition content. The detection
// below runs after the graph is built; the measurement still goes through the
// applied gate (there is no honest way to scan around a defective gate), and
// VERDICT FAILS while the gate self-matches because a self-matching permanent
// gate is not certifiable. SFR-motion-12-2 removes the tokens from the gate's
// text, which makes both the gate and this probe pass.
const useMod = FALLBACK.gateReady
  ? { gate: FALLBACK.gate, scan: FALLBACK.scan, isTrans: FALLBACK.isTrans }
  : { gate: gateMotionBlur, scan: scanMotionBlurSource, isTrans: isTransitionContextFile };

// ─────────────────────────────────────────────────────────────────────────────
// Walk the real composition graph.
// ─────────────────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(jsx?|mjs|cjs)$/.test(name) && !/\.(map)$/.test(name)) out.push(full);
  }
  return out;
}

const GRAPH_DIRS = [
  join(RENDER, "compositions"),
  join(RENDER, "visual"),
  join(RENDER, "effects"),
  join(RENDER, "styles"),
  join(RENDER, "Root.jsx"),
];
const graphFiles = [];
const seen = new Set();
for (const d of GRAPH_DIRS) {
  if (d.endsWith("Root.jsx")) {
    if (statSync(d, { throwIfNoEntry: false })) { graphFiles.push(d); seen.add(d); }
    continue;
  }
  if (!statSync(d, { throwIfNoEntry: false })) continue;
  for (const f of walk(d)) {
    if (!seen.has(f)) { seen.add(f); graphFiles.push(f); }
  }
}

const sourceMap = {};
for (const f of graphFiles) {
  sourceMap[relative(RENDER, f).replace(/\\/g, "/")] = readFileSync(f, "utf-8");
}

// package is / is not installed — a second, architectural signal: an uninstalled
// package cannot be used, so a future install + usage is exactly the regression
// the static scan must then catch.
let motionBlurPkgInstalled = false;
try {
  // resolve from the render dir's perspective
  const { createRequire } = await import("module");
  const req = createRequire(join(RENDER, "package.json"));
  req.resolve("@remotion/motion-blur");
  motionBlurPkgInstalled = true;
} catch {
  motionBlurPkgInstalled = false;
}

// ── PHASE 4 GATE SELF-MATCH DETECTOR ────────────────────────────────────────
// The permanent gate lives in visual/composition.js, which IS a scanned graph
// file. If its own declaration block self-matches, the gate reports its own
// text as OUTSIDE-transition motion blur — a defect of the gate module, not
// of the composition content. The verdict must fail until SFR-motion-12-2
// lands, and the printed reason must say so (instead of a bare outside=4).
const gateSelfMatch = FALLBACK.gateReady
  ? (() => {
      const text = sourceMap['visual/composition.js'] || '';
      const hits = useMod.scan(text, { isTransitionContext: false });
      return { defected: hits.length > 0, hits };
    })()
  : { defected: false, hits: [] };

const gateResult = useMod.gate(sourceMap);

// ─────────────────────────────────────────────────────────────────────────────
// DEPTH-blur inventory (allowed, distinct from motion blur).
// ─────────────────────────────────────────────────────────────────────────────
function depthBlurInventory() {
  const profiles = composition.DEPTH_PROFILES || {};
  const rows = [];
  let subjectNotSharp = [];
  let nonConstant = [];
  for (const [name, prof] of Object.entries(profiles)) {
    for (const plane of prof.planes || []) {
      rows.push({ profile: name, plane: plane.name, blur: plane.blur });
      if (plane.name === "subject" && Number(plane.blur) !== 0) subjectNotSharp.push(`${name}.subject=${plane.blur}`);
      // depth blur must be a fixed constant, never frame/progress-driven
      if (typeof plane.blur !== "number" || !Number.isFinite(plane.blur)) nonConstant.push(`${name}.${plane.name}`);
    }
  }
  return { rows, subjectNotSharp, nonConstant };
}
const depth = depthBlurInventory();

// ─────────────────────────────────────────────────────────────────────────────
// Negative fixtures (E3).
// ─────────────────────────────────────────────────────────────────────────────
const fixtures = [];
function runFixture(name, file, src, expectOutside) {
  const inTrans = useMod.isTrans(file);
  const hits = useMod.scan(src, { isTransitionContext: inTrans });
  const outside = hits.filter((h) => !h.inTransition).length;
  const ok = outside === expectOutside;
  fixtures.push({ name, file, inTransitionContext: inTrans, outsideHits: outside, expectedOutside: expectOutside, ok });
  return ok;
}
// 1. planted motion blur in a HOLD/end-card context → must be OUTSIDE (FAIL gate)
runFixture(
  "hold/end-card camera motion blur must be outside a transition",
  "compositions/motion-graphics.jsx",
  'const EndCard = () => <CameraMotionBlur shutterAngle={180}>OUTRO</CameraMotionBlur>;\n',
  1
);
// 2. planted motion blur in a TRANSITION context → must be INSIDE (allowed)
runFixture(
  "transition presentation camera motion blur is allowed inside a transition",
  "transitions/presentation.jsx",
  'const Whip = () => <CameraMotionBlur shutterAngle={200}>...</CameraMotionBlur>;\n',
  0
);
// 3. planted frame-driven blur (same-line interpolate+frame) in a caption file
//    → motion blur, OUTSIDE a transition → must be caught
runFixture(
  "frame-driven blur in a caption file is motion blur → outside",
  "captions/caption.jsx",
  'const f = 0;\n<div style={{ filter: `blur(${interpolate(frame, [0, 24], [0, 6])}px)` }}>',
  1
);
// 4. PHASE 4 BACK-DOOR PROOF: take the REAL MOT-18 gate block exactly as it
//    exists in the scanned composition.js, then plant a real violation two
//    lines after it. The self-match exemption is token-absence (the tokens
//    are not contiguous in the gate module's source), NOT a region skip — so
//    a violation right after the block must be caught, and the block itself
//    must contribute zero hits. If the block still self-matches, this scan
//    returns 5+ hits instead of 1 and the fixture fails.
const gateSrc = sourceMap['visual/composition.js'] || '';
const motAnchor = gateSrc.indexOf('MOT-18 — motion blur only inside a transition subtree');
const gateBlock = motAnchor === -1 ? 'export const MOTION_BLUR_SIGNALS = [];' : gateSrc.slice(motAnchor);
runFixture(
  "Phase-4 back-door proof: real violation planted 2 lines after the gate's own block in composition.js is still caught",
  "visual/composition.js",
  `${gateBlock}\n\nconst regression = () => <CameraMotionBlur shutterAngle={180} />;\n`,
  1
);

// ─────────────────────────────────────────────────────────────────────────────
const overallPass =
  gateResult.pass &&
  !gateSelfMatch.defected &&
  depth.subjectNotSharp.length === 0 &&
  depth.nonConstant.length === 0 &&
  fixtures.every((f) => f.ok);

const report = {
  check: "MOT-18",
  assertion: "Motion blur only inside a transition subtree; 0 elsewhere.",
  graphBase: RENDER,
  source: FALLBACK.gateReady
    ? gateSelfMatch.defected
      ? "composition.js (SFR applied — SELF-MATCH DEFECT: SFR-motion-12-2 pending)"
      : "composition.js (SFR applied)"
    : "bundled copy (SFR not applied)",
  graphFilesScanned: Object.keys(sourceMap).length,
  motionBlur: {
    pass: gateResult.pass,
    total: gateResult.totalMotionBlur,
    insideTransition: gateResult.insideTransition,
    outsideTransition: gateResult.outsideTransition,
    details: gateResult.detail,
  },
  motionBlurPackageInstalled: motionBlurPkgInstalled,
  gateSelfMatch: { defected: gateSelfMatch.defected, details: gateSelfMatch.hits },
  depthBlur: { rows: depth.rows, subjectNotSharp: depth.subjectNotSharp, nonConstant: depth.nonConstant },
  fixtures,
  verdict: overallPass ? "PASS" : "FAIL",
};
writeFileSync(OUT, JSON.stringify(report, null, 2));

// ── human-readable
console.log(`MOT-18 probe over real composition graph`);
console.log(`  modules:            ${report.source}`);
console.log(`  files scanned:      ${report.graphFilesScanned}`);
console.log(`  motionBlur total:   ${report.motionBlur.total}`);
console.log(`    inside transition: ${report.motionBlur.insideTransition}`);
console.log(`    OUTSIDE transition: ${report.motionBlur.outsideTransition}  (threshold 0)`);
console.log(`  @remotion/motion-blur installed: ${report.motionBlurPackageInstalled}`);
console.log(`  depth blur (allowed, distinct):  ${depth.rows.length} plane values; subject-not-sharp: ${depth.subjectNotSharp.length}; non-constant: ${depth.nonConstant.length}`);
console.log(`  fixtures (E3 teeth-prove):`);
for (const f of fixtures) console.log(`    ${f.ok ? "ok  " : "FAIL"} ${f.name} (outside=${f.outsideHits}, expect ${f.expectedOutside})`);
console.log(`VERDICT: ${report.verdict}`);
if (!report.motionBlur.pass) {
  console.log("OUTSIDE-TRANSITION MOTION BLUR FOUND:");
  for (const d of report.motionBlur.details.outside) console.log(`  ${d.file}:${d.line} ${d.signal}`);
}
if (gateSelfMatch.defected) {
  console.log("GATE SELF-MATCH DEFECT: the permanent gate in visual/composition.js flags its");
  console.log("  own declaration block as motion blur (self-match, not composition content).");
  console.log("  Apply SFR-motion-12-2 (data/audit/12/audit-motion.ledger.md Phase 4); the probe");
  console.log("  then measures with composition.js itself and this block disappears.");
  for (const d of gateSelfMatch.hits) console.log(`  visual/composition.js:${d.line} ${d.signal}  (gate's own text)`);
}
process.exitCode = report.verdict === "PASS" ? 0 : 1;
