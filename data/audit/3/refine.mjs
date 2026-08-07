/**
 * data/audit/3/refine.mjs — refine around the feasible region found by
 * explore.mjs: ltext~0.90, ldim~0.60, lacc~0.60-0.62, and find the MINIMAL
 * stroke L that passes COL-04 >= 3:1 on all 50 channels (B1 says 0.40).
 */
import { readFileSync } from "node:fs";
import {
  hexFromOklch, contrastRatio, mixHex, hueDistance, oklchFromHex, roundHue,
} from "./oklch.js";

const channels = JSON.parse(readFileSync("config/channels.json", "utf8")).channels;

// Re-derive hue pairs exactly as explore.mjs does.
function deriveHues(c) {
  const p = c.thumbnail_spec?.color_palette;
  const cands = [p[0], p[2], p[1]];
  let baseHue = null;
  for (const hex of cands) {
    const { h, C } = oklchFromHex(hex);
    if (C >= 0.005) { baseHue = roundHue(h); break; }
  }
  if (baseHue === null) baseHue = 265;
  let accentHue = roundHue(oklchFromHex(p[1]).h);
  const d = ((accentHue - baseHue) % 360 + 360) % 360;
  if (d < 60) baseHue = roundHue(accentHue - 60);
  else if (d > 300) baseHue = roundHue(accentHue + 60);
  return { baseHue, accentHue };
}
const seen = new Map();
const hues = channels.map((c) => {
  const h = deriveHues(c);
  const key = `${h.baseHue}|${h.accentHue}`;
  const k = seen.get(key) || 0;
  seen.set(key, k + 1);
  if (k > 0) {
    const delta = 1.5 * k;
    const up = roundHue(h.accentHue + delta);
    const down = roundHue(h.accentHue - delta);
    h.accentHue = hueDistance(h.baseHue, up) >= hueDistance(h.baseHue, down) ? up : down;
    h.tiebreak = true;
  }
  return { id: c.id, name: c.channel_name, ...h };
});

const L_E0 = 0.16, L_E1 = 0.23, L_E2 = 0.29;
const C_BG = 0.03, L_TEXT = 0.90, C_TEXT = 0.02;

function rolesFor(baseHue, accentHue, ldim, lacc, cacc, lstroke) {
  return {
    bg: hexFromOklch(L_E0, C_BG, baseHue),
    surface: hexFromOklch(L_E1, C_BG, baseHue),
    raised: hexFromOklch(L_E2, C_BG, baseHue),
    stroke: hexFromOklch(lstroke, C_BG, baseHue),
    textPrimary: hexFromOklch(L_TEXT, C_TEXT, baseHue),
    textDim: hexFromOklch(ldim, C_TEXT, baseHue),
    accent: hexFromOklch(lacc, cacc, accentHue),
  };
}
function gates(roles, baseHue, accentHue) {
  return {
    c01: contrastRatio(roles.textPrimary, roles.bg),
    c02: contrastRatio(roles.accent, roles.bg),
    c03: contrastRatio(roles.accent, roles.textPrimary),
    c04: contrastRatio(roles.stroke, roles.bg),
    c05: contrastRatio(roles.textDim, roles.bg),
    c06: hueDistance(accentHue, baseHue),
  };
}

// 1) minimal stroke L
for (const lstroke of [0.40, 0.42, 0.44, 0.46, 0.48, 0.50, 0.52]) {
  let worst = Infinity;
  for (const c of hues) {
    const roles = rolesFor(c.baseHue, c.accentHue, 0.60, 0.60, 0.17, lstroke);
    const g = gates(roles, c.baseHue, c.accentHue);
    worst = Math.min(worst, g.c04);
  }
  console.log(`stroke L=${lstroke.toFixed(2)}  min c04 across 50 = ${worst.toFixed(3)}`);
}

// 2) refine accent/dim
const combos = [];
for (const ldim of [0.59, 0.60, 0.61]) for (const lacc of [0.60, 0.61, 0.62]) for (const cacc of [0.17, 0.18, 0.19]) {
  const L_STROKE = 0.52;
  let pass = 0, worst = Infinity;
  const mins = { c01: [], c02: [], c03: [], c04: [], c05: [], c06: [] };
  for (const c of hues) {
    const roles = rolesFor(c.baseHue, c.accentHue, ldim, lacc, cacc, L_STROKE);
    const g = gates(roles, c.baseHue, c.accentHue);
    const ok = g.c01 >= 7 && g.c01 <= 17 && g.c02 >= 4.5 && g.c03 >= 2.5 && g.c04 >= 3 && g.c05 >= 4.5 && g.c06 >= 60;
    if (ok) {
      pass++;
      mins.c01.push(Math.min(g.c01 - 7, 17 - g.c01));
      mins.c02.push(g.c02 - 4.5);
      mins.c03.push(g.c03 - 2.5);
      mins.c04.push(g.c04 - 3);
      mins.c05.push(g.c05 - 4.5);
      mins.c06.push(g.c06 - 60);
    } else {
      worst = Math.min(worst, -1);
    }
  }
  if (pass === 50) {
    const w = {
      c01: Math.min(...mins.c01), c02: Math.min(...mins.c02), c03: Math.min(...mins.c03),
      c04: Math.min(...mins.c04), c05: Math.min(...mins.c05), c06: Math.min(...mins.c06),
    };
    const mm = Math.min(...Object.values(w));
    combos.push({ ldim, lacc, cacc, w, mm });
    console.log(`ldim=${ldim} lacc=${lacc} cacc=${cacc} 50/50 minMargin=${mm.toFixed(3)} worst=${JSON.stringify(w)}`);
  } else {
    console.log(`ldim=${ldim} lacc=${lacc} cacc=${cacc} pass=${pass}`);
  }
}
combos.sort((a, b) => b.mm - a.mm);
const best = combos[0];
if (best) {
  console.log("\nBEST:", JSON.stringify(best));
  console.log(" id  name                        c01     c02     c03     c04     c05     c06  roles");
  for (const c of hues) {
    const roles = rolesFor(c.baseHue, c.accentHue, best.ldim, best.lacc, best.cacc, 0.52);
    const g = gates(roles, c.baseHue, c.accentHue);
    console.log(`${String(c.id).padEnd(4)} ${c.name.padEnd(28)} ${g.c01.toFixed(2).padStart(6)} ${g.c02.toFixed(2).padStart(6)} ${g.c03.toFixed(2).padStart(6)} ${g.c04.toFixed(2).padStart(6)} ${g.c05.toFixed(2).padStart(6)} ${g.c06.toFixed(1).padStart(6)}  bg=${roles.bg} tp=${roles.textPrimary} td=${roles.textDim} acc=${roles.accent} str=${roles.stroke}`);
  }
}
