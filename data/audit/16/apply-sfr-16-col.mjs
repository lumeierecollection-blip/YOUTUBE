// Stage-16 SFR application — color lane's SHARED-FILE REQUESTS, P2.6
// (2026-08-30). COL-23 gate, frames 01/02/03/06/09.
//
// Applies, in order (anchors verified against live file contents before
// writing; CRLF-preserving; idempotent — a step whose NEW text already
// exists exactly once is skipped, any OTHER state aborts without writing):
//
//   SFR-16-COL-2 — quantity-scenes.jsx ACCUMULATION container lines at
//     partial opacity (stroke ink 0.6 / 0.45 over bg ~249-252 -> glyphs
//     rgb(143-145)/rgb(110-117), 2.97-4.41:1). Full-opacity stroke ink:
//     opacity 0.6 -> 1 (L155), opacity 0.45 -> 1 (L159, L160).
//   SFR-16-COL-3 — motion-graphics.jsx stageExitStyle dims the whole stage
//     via opacity:1-p in the last D.short frames; statement phrase renders
//     mid-ramp (~55%) inside the headline probe band (4.21/4.13:1). Fix:
//     keep the -12px slide, set opacity:1 (noFade precedent L128-146).
//   SFR-16-COL-1 — abstract-scenes.jsx accent stake (strokeWidth 3, ~50%
//     pixel coverage -> rgb(124,187,143), 2.14/2.19:1). Fix: integer-snap
//     textCx and widen strokeWidth 3 -> 6 so >=1 pixel column is fully
//     inside the stroke -> darkest = full accent (~5:1 vs grained bg).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "C:/Users/user/YOUTUBE";
const QUANTITY = join(ROOT, "src/skills/remotion-render/compositions/scenes/quantity-scenes.jsx");
const MOTION = join(ROOT, "src/skills/remotion-render/compositions/motion-graphics.jsx");
const ABSTRACT = join(ROOT, "src/skills/remotion-render/compositions/scenes/abstract-scenes.jsx");

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

// ─────────────────────────────────────────────────────────────────────────
// 1. SFR-16-COL-2 — quantity-scenes.jsx (3 full lines, each unique)
// ─────────────────────────────────────────────────────────────────────────
applyLineReplace(QUANTITY, [
  '        <div style={{ position: "absolute", left: trayX, top: ledgerTop, width: 3, height: ledgerH * ease(pEmpty), background: colors.stroke, opacity: 0.6 }} />',
], [
  '        <div style={{ position: "absolute", left: trayX, top: ledgerTop, width: 3, height: ledgerH * ease(pEmpty), background: colors.stroke, opacity: 1 }} />',
], "quantity-scenes.jsx: ledger rule opacity 0.6 -> 1");

applyLineReplace(QUANTITY, [
  '          <div style={{ position: "absolute", left: trayX, top: floorY - 300, width: 2, height: 300 * ease(pEmpty), background: colors.stroke, opacity: 0.45 }} />',
], [
  '          <div style={{ position: "absolute", left: trayX, top: floorY - 300, width: 2, height: 300 * ease(pEmpty), background: colors.stroke, opacity: 1 }} />',
], "quantity-scenes.jsx: tray rail left opacity 0.45 -> 1");

applyLineReplace(QUANTITY, [
  '          <div style={{ position: "absolute", left: trayX + trayW - 2, top: floorY - 300, width: 2, height: 300 * ease(pEmpty), background: colors.stroke, opacity: 0.45 }} />',
], [
  '          <div style={{ position: "absolute", left: trayX + trayW - 2, top: floorY - 300, width: 2, height: 300 * ease(pEmpty), background: colors.stroke, opacity: 1 }} />',
], "quantity-scenes.jsx: tray rail right opacity 0.45 -> 1");

// ─────────────────────────────────────────────────────────────────────────
// 2. SFR-16-COL-3 — motion-graphics.jsx stageExitStyle (1 line)
// ─────────────────────────────────────────────────────────────────────────
applyLineReplace(MOTION, [
  "  return { opacity: 1 - p, translate: `0px ${-12 * p}px` };",
], [
  "  return { opacity: 1, translate: `0px ${-12 * p}px` };",
], "motion-graphics.jsx: stageExitStyle opacity 1-p -> 1 (keep slide)");

// ─────────────────────────────────────────────────────────────────────────
// 3. SFR-16-COL-1 — abstract-scenes.jsx accent stake (3 lines)
// ─────────────────────────────────────────────────────────────────────────
applyLineReplace(ABSTRACT, [
  "              x1={textCx} y1={horizon}",
  "              x2={textCx} y2={horizon - stakeH * eSubject}",
  "              stroke={colors.accent} strokeWidth={3} />",
], [
  "              x1={Math.round(textCx)} y1={horizon}",
  "              x2={Math.round(textCx)} y2={horizon - stakeH * eSubject}",
  "              stroke={colors.accent} strokeWidth={6} />",
], "abstract-scenes.jsx: stake integer-snap + strokeWidth 3 -> 6");

console.log("\ndone.");