// Stage-16 SFR application — layout lane's SHARED-FILE REQUEST (2026-08-30).
//
// Applies, in order (anchors verified against live file contents before
// writing; CRLF-preserving; idempotent — a step whose NEW text already
// exists exactly once is skipped, any OTHER state aborts without writing):
//
//   SFR-LAY16-1 — ATMOSPHERE_HORIZON_Y 1200 (layout/slots.js) consumption:
//     1. abstract-scenes.jsx: delete local const (comment + value), import
//        the slot constant.
//     2. stage.jsx: horizonY = CANVAS_H * 0.6 -> ATMOSPHERE_HORIZON_Y,
//        atmo-haze top stop opacity 0.1*a -> 0.06*a (top-margin FRM-02
//        leak: alpha 0.08-0.093*a was 1-2 units over FG_DIFF=20).
//     3. structure-scenes.jsx: groundY = CANVAS_H * 0.6 -> constant, plus
//        comment update. L313 lastY = CANVAS_H * 0.68 left untouched.
//
// Line-wise, CRLF-preserving, existence-checked — same pattern as
// apply-sfr-15.mjs and apply-sfr-13-14.mjs.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "C:/Users/user/YOUTUBE";
const ABSTRACT = join(ROOT, "src/skills/remotion-render/compositions/scenes/abstract-scenes.jsx");
const STAGE = join(ROOT, "src/skills/remotion-render/compositions/scenes/stage.jsx");
const STRUCTURE = join(ROOT, "src/skills/remotion-render/compositions/scenes/structure-scenes.jsx");

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

  const countMatches = (block) => {
    const hits = [];
    for (let i = 0; i + block.length <= lines.length; i++) {
      let ok = true;
      for (let j = 0; j < block.length; j++) {
        if (lines[i + j] !== block[j]) { ok = false; break; }
      }
      if (ok) hits.push(i);
    }
    return hits;
  };

  const hits = countMatches(oldLines);
  const newHits = newLines.length > 0 ? countMatches(newLines) : [];

  if (newLines.length === 0) {
    if (hits.length === 0) {
      console.log(`SKIP ${label} (already applied)`);
      return;
    }
  } else if (newHits.length === 1) {
    console.log(`SKIP ${label} (already applied)`);
    return;
  }

  if (hits.length !== 1) {
    console.error(`ABORT ${label}: expected exactly 1 anchor match, found ${hits.length}`);
    console.error(`  anchor[0] = ${JSON.stringify(oldLines[0])}`);
    process.exit(1);
  }

  const at = hits[0];
  const out = [...lines.slice(0, at), ...newLines, ...lines.slice(at + oldLines.length)];
  writeFileSync(file, out.join(eol), "utf8");
  console.log(`APPLIED ${label}`);
}

function applySubstringReplace(file, oldText, newText, label) {
  const src = readFileSync(file, "utf8");
  const newCount = src.split(newText).length - 1;
  if (newCount === 1) {
    console.log(`SKIP ${label} (already applied)`);
    return;
  }
  const count = src.split(oldText).length - 1;
  if (count !== 1) {
    console.error(`ABORT ${label}: expected exactly 1 match, found ${count}`);
    console.error(`  oldText = ${JSON.stringify(oldText)}`);
    process.exit(1);
  }
  writeFileSync(file, src.replace(oldText, newText), "utf8");
  console.log(`APPLIED ${label}`);
}

// ─────────────────────────────────────────────────────────────────────────
// 1. abstract-scenes.jsx — delete local const, import slot constant
// ─────────────────────────────────────────────────────────────────────────
applyLineReplace(ABSTRACT, [
  "/** Where AtmosphereGround puts its horizon. One horizon per frame. */",
  "const ATMOSPHERE_HORIZON_Y = CANVAS_H * 0.6;",
], [
  "// Horizon lives in layout/slots.js (ATMOSPHERE_HORIZON_Y = 1200) —",
  "// stage-16 FRM-02: 1152 placed the ridge band straddling safe-bottom",
  "// 1248 under the captionDrop(110) + camera mapping.",
], "abstract-scenes.jsx: local horizon const -> comment");

applyLineReplace(ABSTRACT, [
  'import { PressureWalls } from "./elements/pressure.jsx";',
], [
  'import { PressureWalls } from "./elements/pressure.jsx";',
  'import { ATMOSPHERE_HORIZON_Y } from "../../layout/slots.js";',
], "abstract-scenes.jsx: import ATMOSPHERE_HORIZON_Y");

// ─────────────────────────────────────────────────────────────────────────
// 2. stage.jsx — horizonY + haze stop
// ─────────────────────────────────────────────────────────────────────────
applyLineReplace(STAGE, [
  'import { planeOffset } from "../../visual/composition.js";',
], [
  'import { planeOffset } from "../../visual/composition.js";',
  'import { ATMOSPHERE_HORIZON_Y } from "../../layout/slots.js";',
], "stage.jsx: import ATMOSPHERE_HORIZON_Y");

applySubstringReplace(STAGE,
  "const horizonY = CANVAS_H * 0.6;",
  "const horizonY = ATMOSPHERE_HORIZON_Y;",
  "stage.jsx: horizonY -> slot constant");

applyLineReplace(STAGE, [
  "        <linearGradient id=\"atmo-haze\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\">",
  "          <stop offset=\"0%\" stopColor={colors.stroke} stopOpacity={0.1 * a} />",
], [
  "        <linearGradient id=\"atmo-haze\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\">",
  "          <stop offset=\"0%\" stopColor={colors.stroke} stopOpacity={0.06 * a} />",
], "stage.jsx: atmo-haze top stop 0.1a -> 0.06a");

// ─────────────────────────────────────────────────────────────────────────
// 3. structure-scenes.jsx — groundY + comment
// ─────────────────────────────────────────────────────────────────────────
applyLineReplace(STRUCTURE, [
  'import { CircuitNode, CircuitTrace, SignalPacket } from "./elements/circuit.jsx";',
], [
  'import { CircuitNode, CircuitTrace, SignalPacket } from "./elements/circuit.jsx";',
  'import { ATMOSPHERE_HORIZON_Y } from "../../layout/slots.js";',
], "structure-scenes.jsx: import ATMOSPHERE_HORIZON_Y");

applyLineReplace(STRUCTURE, [
  "  // The ground sits on the SAME horizon AtmosphereGround draws (0.6 of",
  "  // frame height). A first version put it at f.cy + 22% of the band and a",
  "  // rendered frame showed two competing horizons in one shot — the shared",
  "  // ground's and the scene's — with the markers stranded below both.",
  "  const groundY = CANVAS_H * 0.6;",
], [
  "  // The ground sits on the SAME horizon AtmosphereGround draws",
  "  // (ATMOSPHERE_HORIZON_Y, layout/slots.js). A first version put it at",
  "  // f.cy + 22% of the band and a rendered frame showed two competing",
  "  // horizons in one shot — the shared ground's and the scene's — with the",
  "  // markers stranded below both.",
  "  const groundY = ATMOSPHERE_HORIZON_Y;",
], "structure-scenes.jsx: groundY -> slot constant + comment");

console.log("\ndone.");