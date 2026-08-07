// data/audit/3/tiebreak-audit.mjs — definitive moved/tiebreak flags for the
// ledger appendix, re-derived from the PRE-migration palette (git HEAD).
import { execSync } from "node:child_process";
import { oklchFromHex, hueDistance, roundHue } from "./oklch.js";

const before = JSON.parse(execSync("git show HEAD:config/channels.json", { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }));
const channels = before.channels;
const seen = new Map();
const rows = [];
for (const c of channels) {
  const p = c.thumbnail_spec.color_palette;
  let baseHue = null;
  for (const hex of [p[0], p[2], p[1]]) {
    const { C, h } = oklchFromHex(hex);
    if (C >= 0.005) { baseHue = roundHue(h); break; }
  }
  if (baseHue === null) baseHue = 265;
  let accentHue = roundHue(oklchFromHex(p[1]).h);
  let moved = "-";
  const d = ((accentHue - baseHue) % 360 + 360) % 360;
  if (d < 60) { baseHue = roundHue(accentHue - 60); moved = "base-60"; }
  else if (d > 300) { baseHue = roundHue(accentHue + 60); moved = "base+60"; }
  const key = `${baseHue}|${accentHue}`;
  const k = seen.get(key) || 0;
  seen.set(key, k + 1);
  let tb = false;
  if (k > 0) {
    const delta = 1.5 * k;
    const up = roundHue(accentHue + delta);
    const down = roundHue(accentHue - delta);
    accentHue = hueDistance(baseHue, up) >= hueDistance(baseHue, down) ? up : down;
    tb = true;
  }
  rows.push({ id: c.id, tb, moved, sep: Math.round(hueDistance(accentHue, baseHue) * 10) / 10 });
}

const at60 = rows.filter((r) => r.sep === 60).map((r) => r.id);
const tbs = rows.filter((r) => r.tb).map((r) => r.id);
const movedAll = rows.filter((r) => r.moved !== "-").map((r) => r.id);
console.log("AT60:", at60.join(", "));
console.log("TB:", tbs.join(", "));
console.log("MOVED:", movedAll.join(", "));
for (const r of rows) console.log(`${String(r.id).padStart(2)} ${r.tb ? "TB" : "--"} ${r.moved} sep=${r.sep}`);
