// Orchestrator application of Stage-12 shared-file requests.
// - SFR-12-COL-1  (audit-color → motion-graphics.jsx): dot-grid density wiring
// - SFR-motion-12-1 (audit-motion → visual/composition.js): MOT-18 permanent gate
// - SFR-motion-12-2 (audit-motion → visual/composition.js): MOT-18 self-match fix
//
// Line-wise, CRLF-preserving, existence-checked: each anchor must match exactly
// once or the script aborts without writing. This file is itself the audit
// record of what was applied (referenced by data/audit/12/GATE.md).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RENDER = "src/skills/remotion-render";

function splitLines(s) {
  return s.split(/\r?\n/);
}
function detectEol(s) {
  return s.includes("\r\n") ? "\r\n" : "\n";
}
function applyLineReplace(file, oldLines, newLines, label) {
  const src = readFileSync(file, "utf8");
  const eol = detectEol(src);
  const lines = splitLines(src);
  const from = oldLines[0];
  let hits = [];
  for (let i = 0; i + oldLines.length <= lines.length; i++) {
    let ok = true;
    for (let j = 0; j < oldLines.length; j++) {
      if (lines[i + j] !== oldLines[j]) { ok = false; break; }
    }
    if (ok) hits.push(i);
  }
  // Idempotence: if the NEW text is already present exactly once, the step was
  // applied in a prior run — skip without error. Anything else must match the
  // OLD text exactly once or we abort without writing.
  let newHits = [];
  for (let i = 0; i + newLines.length <= lines.length; i++) {
    let ok = true;
    for (let j = 0; j < newLines.length; j++) {
      if (lines[i + j] !== newLines[j]) { ok = false; break; }
    }
    if (ok) newHits.push(i);
  }
  if (newHits.length === 1) {
    console.log(`SKIP ${label} (already applied)`);
    return;
  }
  if (hits.length !== 1) {
    console.error(`ABORT ${label}: expected exactly 1 anchor match, found ${hits.length}`);
    process.exit(1);
  }
  const at = hits[0];
  const out = [...lines.slice(0, at), ...newLines, ...lines.slice(at + oldLines.length)];
  writeFileSync(file, out.join(eol));
  console.log(`OK ${label} (line ${at + 1})`);
}
function appendLines(file, blockLines, label, marker) {
  const src = readFileSync(file, "utf8");
  const eol = detectEol(src);
  const lines = splitLines(src);
  // Idempotence: if the block's marker line is already present exactly once,
  // the append already happened — skip. (Duplicates are a defect: they break
  // later anchor-uniqueness checks, as SFR-motion-12-2 discovered.)
  const markerHits = lines.filter((l) => l === marker).length;
  if (markerHits === 1) {
    console.log(`SKIP ${label} (already applied)`);
    return;
  }
  if (markerHits > 1) {
    console.error(`ABORT ${label}: marker "${marker}" found ${markerHits} times — duplicate append detected; repair the file before re-running`);
    process.exit(1);
  }
  if (lines[lines.length - 1] === "") lines.pop(); // drop trailing empty from final newline
  const out = [...lines, ...blockLines, ""];
  writeFileSync(file, out.join(eol));
  console.log(`OK ${label} (appended ${blockLines.length} lines)`);
}

// ── SFR-12-COL-1 ─────────────────────────────────────────────────────────────

// Diff A — Background becomes density-driven (B2.1–B2.4), 0% renders no layer.
applyLineReplace(
  join(RENDER, "compositions", "motion-graphics.jsx"),
  [
    "function Background({ colors }) {",
    "  const { width, height } = useVideoConfig();",
    "  const frame = useCurrentFrame();",
    "  const { fps } = useVideoConfig();",
    "  const breathe = 1 + BREATHE_AMPLITUDE * Math.sin((2 * Math.PI * frame) / (fps * BREATHE_PERIOD_SEC));",
    "  return (",
    "    <>",
    "      <Solid width={width} height={height} color={colors.bg} style={{ position: \"absolute\", inset: 0 }} />",
    "      <Solid",
    "        width={width}",
    "        height={height}",
    "        color={colors.stroke}",
    "        effects={[dotGrid({ dotSize: 8, gridSize: 80 })]}",
    "        style={{ position: \"absolute\", inset: 0, opacity: 0.06, scale: `${breathe}`, transformOrigin: \"center\" }}",
    "      />",
  ],
  [
    "function Background({ colors, beats = [], sectionRanges = {} }) {",
    "  const { width, height } = useVideoConfig();",
    "  const frame = useCurrentFrame();",
    "  const { fps } = useVideoConfig();",
    "  const breathe = 1 + BREATHE_AMPLITUDE * Math.sin((2 * Math.PI * frame) / (fps * BREATHE_PERIOD_SEC));",
    "  // B2.1–B2.4 — density per archetype (6%/4%/0%, nothing between), per-section",
    "  // min (B2.2), fixed 64 px pitch / 4 px dot (B2.3/B2.4). 0% renders no layer.",
    "  const grid = dotGridStateForFrame(sectionRanges, beats, frame);",
    "  return (",
    "    <>",
    "      <Solid width={width} height={height} color={colors.bg} style={{ position: \"absolute\", inset: 0 }} />",
    "      {grid ? (",
    "        <Solid",
    "          width={width}",
    "          height={height}",
    "          color={colors.stroke}",
    "          effects={[dotGrid({ dotSize: grid.dotSize, gridSize: grid.gridSize })]}",
    "          style={{ position: \"absolute\", inset: 0, opacity: grid.opacity, scale: `${breathe}`, transformOrigin: \"center\" }}",
    "        />",
    "      ) : null}",
  ],
  "Diff A (Background density-driven)"
);

// Diff B — token import after the CanvasGrain import.
applyLineReplace(
  join(RENDER, "compositions", "motion-graphics.jsx"),
  ['import { CanvasGrain } from "../effects/CanvasGrain.jsx";'],
  [
    'import { CanvasGrain } from "../effects/CanvasGrain.jsx";',
    'import { DOT_DIAMETER, DOT_GRID_PITCH, DOT_GRID, dotGridStateForFrame } from "../styles/tokens.js";',
  ],
  "Diff B (import)"
);

// Diff B — call site passes beats + sectionRanges.
applyLineReplace(
  join(RENDER, "compositions", "motion-graphics.jsx"),
  ["      <Background colors={colors} />"],
  ["      <Background colors={colors} beats={mg?.beats || []} sectionRanges={mg?.sectionRanges || {}} />"],
  "Diff B (call site)"
);

// Diff C — ListRunScene panel grid: B2.3/B2.4 geometry + DOT_GRID.LIST_ITEM opacity (B5 fix).
applyLineReplace(
  join(RENDER, "compositions", "motion-graphics.jsx"),
  [
    "          <Solid",
    "            width={LIST_PANEL.width}",
    "            height={LIST_PANEL.height}",
    "            color={colors.stroke}",
    "            effects={[dotGrid({ dotSize: 6, gridSize: 56 })]}",
    "            style={{ position: \"absolute\", inset: 0, opacity: 0.1 }}",
    "          />",
  ],
  [
    "          <Solid",
    "            width={LIST_PANEL.width}",
    "            height={LIST_PANEL.height}",
    "            color={colors.stroke}",
    "            effects={[dotGrid({ dotSize: DOT_DIAMETER, gridSize: DOT_GRID_PITCH })]}",
    "            style={{ position: \"absolute\", inset: 0, opacity: DOT_GRID.LIST_ITEM }}",
    "          />",
  ],
  "Diff C (ListRunScene panel grid)"
);

// ── SFR-motion-12-1 ──────────────────────────────────────────────────────────

const block = readFileSync(join("data", "audit", "12", "sfr-motion-12-1-block.txt"), "utf8");
const blockLines = splitLines(block);
if (blockLines[blockLines.length - 1] === "") blockLines.pop();
if (!blockLines.includes("export function gateMotionBlur(sourceMap) {")) {
  console.error("ABORT: sfr-motion-12-1-block.txt missing gateMotionBlur marker");
  process.exit(1);
}
appendLines(
  join(RENDER, "visual", "composition.js"),
  blockLines,
  "SFR-motion-12-1 (MOT-18 gate appended)",
  "// MOT-18 — motion blur only inside a transition subtree"
);

// ── SFR-motion-12-2 (audit-motion → visual/composition.js): MOT-18 self-match fix ──
// Phase 4 (data/audit/12/audit-motion.ledger.md): the gate block appended by
// SFR-motion-12-1 self-matched — its literal signal-name strings ARE the tokens
// the scanner detects, and its doc comment paired `blur(` with `frame` on one
// line — so scanning composition.js (a graph file) flagged the gate's own text
// as OUTSIDE-transition motion blur. The fix REPLACES the declaration block
// (signal names built from fragments; comment reworded) so no token appears as
// a contiguous string in the gate module; FRAME_BLUR_RE stays a literal (its
// raw text spells `blur\(`, never `blur(`, so it cannot match itself). Runtime
// values are byte-identical to the originals — only the source text differs.

const fix2Old = [
  'export const MOTION_BLUR_SIGNALS = [',
  '  { name: "@remotion/motion-blur package", re: /@remotion\\/motion-blur/ },',
  '  { name: "<CameraMotionBlur>", re: /<CameraMotionBlur\\b/ },',
  '  { name: "<Trail> (motion-blur package)", re: /<Trail\\b/ },',
  '];',
  '',
  '/**',
  ' * A `blur(...)` whose radius is driven by frame/progress is a blur that',
  ' * follows motion (motion blur), not the static per-plane depth blur.',
  ' * `blur(${plane.blur}px)` (stage.jsx) does NOT match: after `blur(` comes a',
  ' * resolved constant, never a frame token. Catches a future mistake that',
  ' * animates the depth blur per frame, which would turn a depth anchor into',
  ' * motion blur.',
  ' */',
  'export const FRAME_BLUR_RE = /blur\\(\\s*.*?(?:interpolate\\s*\\(|ease\\s*\\(|progressOf\\s*\\(|Math\\.(?:sin|cos)\\s*\\(|\\bframe\\b|\\bp\\b\\s*[*+])/;',
];
const fix2New = splitLines(readFileSync(join("data", "audit", "12", "sfr-motion-12-2-block.txt"), "utf8"));
if (fix2New[fix2New.length - 1] === "") fix2New.pop();
if (!fix2New.includes("const MOTION_BLUR_SIGNAL_TOKENS = {")) {
  console.error("ABORT: sfr-motion-12-2-block.txt missing MOTION_BLUR_SIGNAL_TOKENS marker");
  process.exit(1);
}
applyLineReplace(
  join(RENDER, "visual", "composition.js"),
  fix2Old,
  fix2New,
  "SFR-motion-12-2 (MOT-18 self-match fix)"
);

console.log("\nALL STAGE-12 SFRS APPLIED");