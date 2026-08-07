/**
 * data/audit/3/explore.mjs — Stage 3 colour audit exploration.
 * 1. Current baseline: COL-01..06 over the live color_palette arrays using the
 *    repo's own role derivation (mg-style.js rolesFromPalette) + OKLCH hues.
 * 2. Hue-pair derivation: baseHue/accentHue from current bg/accent OKLCH hues,
 *    COL-06 rule (accent hue preserved; base hue moved to exactly 60° when the
 *    pair is too close), COL-09 duplicate tiebreaks (+1.5°·k on accentHue).
 * 3. Parameter sweep: fixed OKLCH L/C per role → COL-01..07 pass rate across
 *    all 50 channels, plus minimum boundary margins for the winner.
 * Output only; writes nothing. (read-only exploration)
 */
import { readFileSync } from "node:fs";
import {
  oklchFromHex, hexFromOklch, contrastRatio, mixHex, hueDistance, roundHue,
} from "./oklch.js";

const channels = JSON.parse(readFileSync("config/channels.json", "utf8")).channels;
console.log("channels:", channels.length);

const withPalette = channels.map((c) => {
  const p = c.thumbnail_spec?.color_palette;
  return { id: c.id, name: c.channel_name, niche: c.niche, style: c.style, palette: Array.isArray(p) && p.length === 3 ? p : null };
});
const missing = withPalette.filter((c) => !c.palette);
console.log("missing palette:", missing.length, missing.map((m) => m.id).join(", ") || "none");

/* ---------- 1. CURRENT BASELINE ---------- */
import { rolesFromPalette, contrastRatio as mgContrast } from "../../../src/skills/remotion-render/compositions/mg-style.js";

let c01lo = 0, c01hi = 0, c02 = 0, c03 = 0, c04 = 0, c05 = 0, c06 = 0;
const c06fails = [];
for (const c of withPalette) {
  if (!c.palette) continue;
  const roles = rolesFromPalette(c.palette);
  const r1 = mgContrast(roles.textPrimary, roles.bg);
  const r2 = mgContrast(roles.accent, roles.bg);
  const r3 = mgContrast(roles.accent, roles.textPrimary);
  const r4 = mgContrast(roles.stroke, roles.bg);
  const r5 = mgContrast(roles.textDim, roles.bg);
  const { h: hb, C: cb } = oklchFromHex(c.palette[0]);
  const { h: ha, C: ca } = oklchFromHex(c.palette[1]);
  const sep = cb < 0.001 || ca < 0.001 ? null : hueDistance(hb, ha);
  if (r1 < 7) c01lo++;
  if (r1 > 17) c01hi++;
  if (r2 < 4.5) c02++;
  if (r3 < 2.5) c03++;
  if (r4 < 3) c04++;
  if (r5 < 4.5) c05++;
  if (sep !== null && sep < 60) { c06++; c06fails.push(`${c.id} ${c.name} bg h=${hb.toFixed(1)} accent h=${ha.toFixed(1)} sep=${sep.toFixed(1)}`); }
  console.log(`${String(c.id).padEnd(5)} ${c.name.padEnd(28)} r1=${r1.toFixed(2).padStart(6)} r2=${r2.toFixed(2).padStart(6)} r3=${r3.toFixed(2).padStart(6)} r4=${r4.toFixed(2).padStart(6)} r5=${r5.toFixed(2).padStart(6)} sep=${sep === null ? " n/a" : sep.toFixed(1).padStart(5)}`);
}
console.log("\nCURRENT COL failures:");
console.log(` COL-01 <7: ${c01lo}   >17: ${c01hi}`);
console.log(` COL-02 <4.5: ${c02}   COL-03 <2.5: ${c03}   COL-04 <3: ${c04}   COL-05 <4.5: ${c05}   COL-06 <60°: ${c06}`);
c06fails.forEach((f) => console.log("   ", f));

/* ---------- 2. HUE-PAIR DERIVATION ---------- */
function deriveHues(c) {
  // baseHue: hue of the first non-achromatic palette member in [bg, textPrimary, accent]
  const cands = [c.palette[0], c.palette[2], c.palette[1]];
  let baseHue = null, src = null;
  for (const hex of cands) {
    const { h, C } = oklchFromHex(hex);
    if (C >= 0.005) { baseHue = roundHue(h); src = hex; break; }
  }
  if (baseHue === null) { baseHue = 265; src = "FALLBACK"; }
  const { h: ha } = oklchFromHex(c.palette[1]);
  let accentHue = roundHue(ha);
  // COL-06: separation must be >= 60°; preserve accent hue, move base.
  let moved = "";
  const d = ((accentHue - baseHue) % 360 + 360) % 360;
  if (d < 60) { baseHue = roundHue(accentHue - 60); moved = "base-60"; }
  else if (d > 300) { baseHue = roundHue(accentHue + 60); moved = "base+60"; }
  return { baseHue, accentHue, moved, baseSrc: src };
}

const hues = withPalette.map((c) => ({ ...c, ...deriveHues(c) }));
// COL-09 tiebreak: exact-duplicate (baseHue, accentHue) pairs get ±1.5°·k on
// accentHue, pushed in whichever direction INCREASES the shortest hue distance
// (so COL-06 separation never shrinks, including across the 0/360 wrap).
const seen = new Map();
for (const c of hues) {
  const key = `${c.baseHue}|${c.accentHue}`;
  const k = seen.get(key) || 0;
  seen.set(key, k + 1);
  if (k > 0) {
    const delta = 1.5 * k;
    const up = roundHue(c.accentHue + delta);
    const down = roundHue(c.accentHue - delta);
    const sepUp = hueDistance(c.baseHue, up);
    const sepDown = hueDistance(c.baseHue, down);
    if (sepUp >= sepDown) {
      c.accentHue = up;
      c.tiebreak = `accent+${delta.toFixed(1)}° (sep ${sepUp.toFixed(1)})`;
    } else {
      c.accentHue = down;
      c.tiebreak = `accent-${delta.toFixed(1)}° (sep ${sepDown.toFixed(1)})`;
    }
  }
}
console.log("\nDERIVED HUE PAIRS (baseHue, accentHue):");
for (const c of hues) {
  console.log(`${String(c.id).padEnd(5)} ${c.name.padEnd(28)} base=${String(c.baseHue).padStart(6)} accent=${String(c.accentHue).padStart(6)} sep=${hueDistance(c.baseHue, c.accentHue).toFixed(1).padStart(5)} ${c.moved ? c.moved : ""} ${c.tiebreak ? c.tiebreak : ""}  (baseSrc ${c.baseSrc})`);
}
const dupCheck = new Set(hues.map((c) => `${c.baseHue}|${c.accentHue}`));
console.log("unique hue pairs after tiebreak:", dupCheck.size, "/", hues.length);
const col6 = hues.filter((c) => hueDistance(c.baseHue, c.accentHue) < 60);
console.log("COL-06 residual failures:", col6.length);
if (col6.length) col6.forEach((c) => console.log("  ", c.id, hueDistance(c.baseHue, c.accentHue)));

/* ---------- 3. PARAMETER SWEEP ---------- */
// Insights that shape the grid:
//  - WCAG's +0.05 floor: textPrimary must be LIGHT (lum 0.65-0.87) for
//    COL-01 7..17 AND for COL-03 (accent darker than text) to coexist with
//    COL-02 (accent >= 4.5 vs bg => accent lum ~0.19-0.32).
//  - A2.1's mix(textPrimary, bg, 0.45) textDim can no longer reach 4.5:1
//    (see evidence column A21 vs OKLCH) -> textDim as OKLCH role.
const C_BG_V = [0.03, 0.04];
const L_TEXT_V = [0.84, 0.86, 0.88, 0.90];
const C_TEXT_V = [0.02, 0.025, 0.03];
const L_DIM_V = [0.58, 0.60, 0.62, 0.64];
const L_STROKE_V = [0.40, 0.44, 0.48, 0.52];
const L_ACC_V = [0.56, 0.58, 0.60, 0.62];
const C_ACC_V = [0.17, 0.19];

const L_E0 = 0.16, L_E1 = 0.23, L_E2 = 0.29; // DETAIL-REF B1 (stroke swept)

function rolesFor(baseHue, accentHue, p) {
  const bg = hexFromOklch(L_E0, p.cbg, baseHue);
  const surface = hexFromOklch(L_E1, p.cbg, baseHue);
  const raised = hexFromOklch(L_E2, p.cbg, baseHue);
  const stroke = hexFromOklch(p.lstroke, p.cbg, baseHue);
  const textPrimary = hexFromOklch(p.ltext, p.ctext, baseHue);
  const textDim = hexFromOklch(p.ldim, p.ctext, baseHue); // amended from A2.1 mix
  const textDimA21 = mixHex(textPrimary, bg, 0.45); // evidence column
  const accent = hexFromOklch(p.lacc, p.cacc, accentHue);
  return { bg, surface, raised, stroke, textPrimary, textDim, textDimA21, accent };
}

function checkGates(roles, baseHue, accentHue) {
  const out = {};
  out.c01 = contrastRatio(roles.textPrimary, roles.bg);
  out.c02 = contrastRatio(roles.accent, roles.bg);
  out.c03 = contrastRatio(roles.accent, roles.textPrimary);
  out.c04 = contrastRatio(roles.stroke, roles.bg);
  out.c05 = contrastRatio(roles.textDim, roles.bg);
  out.c05a21 = contrastRatio(roles.textDimA21, roles.bg);
  out.c06 = hueDistance(accentHue, baseHue);
  // COL-07: no #FFFFFF / #000000 / R=G=B on any role
  out.c07 = Object.entries(roles).filter(([k]) => k !== "textDimA21").every(([, hex]) => {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const isPure = (r === 255 && g === 255 && b === 255) || (r === 0 && g === 0 && b === 0);
    return !isPure && !(r === g && g === b);
  });
  out.hierarchy = out.c05 < out.c01; // textDim dimmer than textPrimary (extra sanity)
  return out;
}

const results = [];
for (const cbg of C_BG_V) for (const ltext of L_TEXT_V) for (const ctext of C_TEXT_V)
for (const ldim of L_DIM_V) for (const lstroke of L_STROKE_V) for (const lacc of L_ACC_V) for (const cacc of C_ACC_V) {
  const p = { cbg, ltext, ctext, ldim, lstroke, lacc, cacc };
  let pass = 0;
  const margins = { c01: [], c02: [], c03: [], c04: [], c05: [], c06: [] };
  const gfail = { c01: 0, c02: 0, c03: 0, c04: 0, c05: 0, c06: 0, c07: 0 };
  let fail = [];
  for (const c of hues) {
    const roles = rolesFor(c.baseHue, c.accentHue, p);
    const g = checkGates(roles, c.baseHue, c.accentHue);
    const ok =
      g.c01 >= 7 && g.c01 <= 17 && g.c02 >= 4.5 && g.c03 >= 2.5 &&
      g.c04 >= 3 && g.c05 >= 4.5 && g.c06 >= 60 && g.c07;
    if (!ok) {
      if (g.c01 < 7 || g.c01 > 17) gfail.c01++;
      if (g.c02 < 4.5) gfail.c02++;
      if (g.c03 < 2.5) gfail.c03++;
      if (g.c04 < 3) gfail.c04++;
      if (g.c05 < 4.5) gfail.c05++;
      if (g.c06 < 60) gfail.c06++;
      if (!g.c07) gfail.c07++;
    }
    if (ok) {
      pass++;
      margins.c01.push(Math.min(g.c01 - 7, 17 - g.c01));
      margins.c02.push(g.c02 - 4.5);
      margins.c03.push(g.c03 - 2.5);
      margins.c04.push(g.c04 - 3);
      margins.c05.push(g.c05 - 4.5);
      margins.c06.push(g.c06 - 60);
    } else if (fail.length < 4) {
      fail.push(`${c.id}: c01=${g.c01.toFixed(2)} c02=${g.c02.toFixed(2)} c03=${g.c03.toFixed(2)} c04=${g.c04.toFixed(2)} c05=${g.c05.toFixed(2)} c06=${g.c06.toFixed(1)} c07=${g.c07}`);
    }
  }
  if (pass === 50) {
    const worst = {
      c01: Math.min(...margins.c01), c02: Math.min(...margins.c02),
      c03: Math.min(...margins.c03), c04: Math.min(...margins.c04),
      c05: Math.min(...margins.c05), c06: Math.min(...margins.c06),
    };
    const minMargin = Math.min(...Object.values(worst));
    results.push({ p, worst, minMargin, gfail });
  } else {
    results.push({ p, pass, fail, gfail });
  }
}

const winners = results.filter((r) => r.pass === 50).sort((a, b) => b.minMargin - a.minMargin);
console.log("\nSWEEP: parameter combos with 50/50 pass:", winners.length);
for (const w of winners.slice(0, 12)) {
  console.log(` ${JSON.stringify(w.p)} minMargin=${w.minMargin.toFixed(3)} worst=${JSON.stringify(w.worst)}`);
}
if (!winners.length) {
  console.log("NO FULL-PASS COMBO. Per-gate failure counts over all combos:");
  const byGate = { c01: 0, c02: 0, c03: 0, c04: 0, c05: 0, c06: 0, c07: 0 };
  let bestPass = 0;
  for (const r of results) {
    for (const k of Object.keys(byGate)) byGate[k] += r.gfail[k];
    if (r.pass > bestPass) bestPass = r.pass;
  }
  console.log(" total gate-failures across all combos:", JSON.stringify(byGate));
  console.log(" best single-combo pass count:", bestPass);
  results.sort((a, b) => (b.pass || 0) - (a.pass || 0)).slice(0, 10).forEach((r) =>
    console.log(` ${JSON.stringify(r.p)} pass=${r.pass} gfail=${JSON.stringify(r.gfail)} fail=${JSON.stringify(r.fail)}`));
}

// Evidence for the textDim SPEC AMENDMENT: A2.1 mix vs OKLCH textDim on the best combo.
if (winners.length) {
  const w = winners[0];
  console.log("\nEVIDENCE (A2.1 mix vs OKLCH textDim) on winning combo", JSON.stringify(w.p));
  console.log(" id  textDimA21-ratio  textDimOKLCH-ratio  textPrimary-ratio");
  for (const c of hues) {
    const roles = rolesFor(c.baseHue, c.accentHue, w.p);
    const g = checkGates(roles, c.baseHue, c.accentHue);
    console.log(`${String(c.id).padEnd(4)} ${g.c05a21.toFixed(2).padStart(6)} ${g.c05.toFixed(2).padStart(8)} ${g.c01.toFixed(2).padStart(8)}   (${c.id === 1 ? "textPrimary hex " + roles.textPrimary : ""})`);
    if (c.id === 1) console.log("  roles: bg", roles.bg, "textPrimary", roles.textPrimary, "textDim", roles.textDim, "textDimA21", roles.textDimA21, "accent", roles.accent, "stroke", roles.stroke, "surface", roles.surface, "raised", roles.raised);
  }
}
