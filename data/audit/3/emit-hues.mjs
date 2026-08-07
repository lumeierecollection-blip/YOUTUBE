/**
 * data/audit/3/emit-hues.mjs
 * Final step of the GROUND phase: emit the per-channel (baseHue, accentHue)
 * pairs that will be written into config/channels.json, then verify the
 * LOCKED parameter set against COL-01..06 on all 50 channels using the exact
 * same oklch.js math the tokens.js rollup will use at runtime.
 *
 * LOCKED PARAMS (from refine.mjs, margins computed on 8-bit-quantized hexes):
 *   E0=0.16 E1=0.23 E2=0.29  (B1, unchanged)
 *   C_BG=0.03 L_TEXT=0.90 C_TEXT=0.02 L_DIM=0.61
 *   L_STROKE=0.50  (AMENDED from B1's 0.40; min c04 2.075 -> 3.177)
 *   L_ACC=0.60 C_ACC=0.17
 * Output: data/audit/3/hues.json + full gate table appended to stdout.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  hexFromOklch, contrastRatio, hueDistance, oklchFromHex, roundHue,
} from "./oklch.js";

const channels = JSON.parse(readFileSync("config/channels.json", "utf8")).channels;

function deriveHues(c) {
  const p = c.thumbnail_spec?.color_palette;
  const cands = [p[0], p[2], p[1]];
  let baseHue = null, baseSrc = null;
  for (const hex of cands) {
    const { h, C } = oklchFromHex(hex);
    if (C >= 0.005) { baseHue = roundHue(h); baseSrc = hex; break; }
  }
  if (baseHue === null) { baseHue = 265; baseSrc = "FALLBACK"; }
  let accentHue = roundHue(oklchFromHex(p[1]).h);
  let moved = "";
  const d = ((accentHue - baseHue) % 360 + 360) % 360;
  if (d < 60) { baseHue = roundHue(accentHue - 60); moved = "base-60"; }
  else if (d > 300) { baseHue = roundHue(accentHue + 60); moved = "base+60"; }
  return { baseHue, accentHue, baseSrc, moved };
}

const seen = new Map();
const hues = channels.map((c) => {
  const h = deriveHues(c);
  const key = `${h.baseHue}|${h.accentHue}`;
  const k = seen.get(key) || 0;
  seen.set(key, k + 1);
  h.tiebreak = false;
  if (k > 0) {
    const delta = 1.5 * k;
    const up = roundHue(h.accentHue + delta);
    const down = roundHue(h.accentHue - delta);
    h.accentHue = hueDistance(h.baseHue, up) >= hueDistance(h.baseHue, down) ? up : down;
    h.tiebreak = true;
  }
  return { id: c.id, name: c.channel_name, ...h };
});

// ---- locked params ----
const P = { L_E0: 0.16, L_E1: 0.23, L_E2: 0.29, C_BG: 0.03, L_TEXT: 0.90, C_TEXT: 0.02, L_DIM: 0.61, L_STROKE: 0.50, L_ACC: 0.60, C_ACC: 0.17 };

function rolesFor(h) {
  return {
    bg: hexFromOklch(P.L_E0, P.C_BG, h.baseHue),
    surface: hexFromOklch(P.L_E1, P.C_BG, h.baseHue),
    raised: hexFromOklch(P.L_E2, P.C_BG, h.baseHue),
    stroke: hexFromOklch(P.L_STROKE, P.C_BG, h.baseHue),
    textPrimary: hexFromOklch(P.L_TEXT, P.C_TEXT, h.baseHue),
    textDim: hexFromOklch(P.L_DIM, P.C_TEXT, h.baseHue),
    accent: hexFromOklch(P.L_ACC, P.C_ACC, h.accentHue),
  };
}
function gates(h, roles) {
  return {
    c01: contrastRatio(roles.textPrimary, roles.bg),
    c02: contrastRatio(roles.accent, roles.bg),
    c03: contrastRatio(roles.accent, roles.textPrimary),
    c04: contrastRatio(roles.stroke, roles.bg),
    c05: contrastRatio(roles.textDim, roles.bg),
    c06: hueDistance(h.accentHue, h.baseHue),
    achromatic: (r, g, b) => r === g && g === b,
  };
}

let passAll = 0;
const rows = hues.map((h) => {
  const roles = rolesFor(h);
  const g = gates(h, roles);
  const [r, gr, b] = ["bg", "textPrimary", "textDim", "accent", "stroke", "surface", "raised"].map(
    (k) => roles[k].match(/[0-9A-F]{2}/gi).map((x) => parseInt(x, 16)));
  const hexes = { bg: roles.bg, surface: roles.surface, raised: roles.raised, stroke: roles.stroke, textPrimary: roles.textPrimary, textDim: roles.textDim, accent: roles.accent };
  const achro = Object.values(hexes).filter((hex) => {
    const m = hex.match(/[0-9A-F]{2}/gi).map((x) => parseInt(x, 16));
    return m[0] === m[1] && m[1] === m[2];
  });
  const ok = g.c01 >= 7 && g.c01 <= 17 && g.c02 >= 4.5 && g.c03 >= 2.5 && g.c04 >= 3 && g.c05 >= 4.5 && g.c06 >= 60 && !achro.length;
  if (ok) passAll++;
  return {
    id: h.id, name: h.name, baseHue: h.baseHue, accentHue: h.accentHue,
    baseSrc: h.baseSrc, moved: h.moved, tiebreak: h.tiebreak,
    c01: +g.c01.toFixed(3), c02: +g.c02.toFixed(3), c03: +g.c03.toFixed(3),
    c04: +g.c04.toFixed(3), c05: +g.c05.toFixed(3), c06: +g.c06.toFixed(1),
    achromatic: achro, ok,
  };
});

console.log(`FINAL VERIFY (locked params): ${passAll}/50 channels pass COL-01..06 + no-achromatic`);
const mins = { c01: Infinity, c02: Infinity, c03: Infinity, c04: Infinity, c05: Infinity, c06: Infinity };
for (const r of rows) {
  for (const k of Object.keys(mins)) mins[k] = Math.min(mins[k], k === "c01" ? Math.min(r.c01 - 7, 17 - r.c01) : k === "c06" ? r.c06 - 60 : r[k] - { c02: 4.5, c03: 2.5, c04: 3, c05: 4.5 }[k]);
  if (!r.ok) console.log(`  FAIL ${r.id} ${r.name}: c01=${r.c01} c02=${r.c02} c03=${r.c03} c04=${r.c04} c05=${r.c05} c06=${r.c06} achro=${JSON.stringify(r.achromatic)}`);
}
console.log("worst margins (min over 50):", JSON.stringify(mins));
const dups = new Set(rows.map((r) => `${r.baseHue}|${r.accentHue}`));
console.log("unique (baseHue,accentHue) pairs:", dups.size, "/ 50");

writeFileSync("data/audit/3/hues.json", JSON.stringify(Object.fromEntries(rows.map((r) => [r.id, { baseHue: r.baseHue, accentHue: r.accentHue }])), null, 2) + "\n");
console.log("wrote data/audit/3/hues.json");

console.log("\n id  name                        base  acc  sep  c01     c02     c03     c04     c05   ok");
for (const r of rows) {
  console.log(`${String(r.id).padEnd(4)} ${r.name.padEnd(28)} ${String(r.baseHue).padEnd(5)} ${String(r.accentHue).padEnd(5)} ${(r.c06).toFixed(1).padEnd(5)} ${r.c01.toFixed(2).padStart(6)} ${r.c02.toFixed(2).padStart(6)} ${r.c03.toFixed(2).padStart(6)} ${r.c04.toFixed(2).padStart(6)} ${r.c05.toFixed(2).padStart(6)}  ${r.ok ? "PASS" : "FAIL"} ${r.moved}${r.tiebreak ? " TB" : ""}`);
}
