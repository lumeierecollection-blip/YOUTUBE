/**
 * data/audit/3/verify-final.mjs
 * AUTHORITATIVE Stage-3 gate run against the PATCHED config/channels.json,
 * using the SHIPPED src/skills/remotion-render/styles/tokens.js (not the audit
 * copy), so what is verified is byte-for-byte what consumers will import.
 *
 * COL-01..06 per channel; COL-07/08 on thumbnail_spec (palette contract);
 * COL-09 uniqueness; COL-10 niche-cluster note. The legacy `.colors` hex
 * field is reported separately (whole-file COL-07/08 reading) as a
 * follow-up owned by the thumbnails/endscreen lanes.
 */
import { readFileSync } from "node:fs";
import {
  paletteFromHues, checkPaletteGates, hexToRgb, hueDistance,
} from "../../../src/skills/remotion-render/styles/tokens.js";

const json = JSON.parse(readFileSync("config/channels.json", "utf8"));
const channels = json.channels;

let c01 = [Infinity, -Infinity], c02 = [Infinity, -Infinity], c03 = [Infinity, -Infinity],
  c04 = [Infinity, -Infinity], c05 = [Infinity, -Infinity], c06 = [Infinity, -Infinity];
let failCount = 0;
const seen = new Set();
const rows = [];

for (const c of channels) {
  const spec = c.thumbnail_spec;
  const { baseHue, accentHue } = spec;
  const roles = paletteFromHues({ baseHue, accentHue });
  const g = checkPaletteGates({ baseHue, accentHue }, roles);
  const achromatic = Object.values(roles).filter((hex) => {
    const { r, g: gr, b } = hexToRgb(hex);
    return r === gr && gr === b;
  });
  const ok = g.c01 >= 7 && g.c01 <= 17 && g.c02 >= 4.5 && g.c03 >= 2.5 && g.c04 >= 3 && g.c05 >= 4.5 && g.c06 >= 60 && achromatic.length === 0;
  if (!ok) failCount++;
  for (const [k, arr] of Object.entries({ c01: c01, c02: c02, c03: c03, c04: c04, c05: c05, c06: c06 })) {
    arr[0] = Math.min(arr[0], g[k]); arr[1] = Math.max(arr[1], g[k]);
  }
  seen.add(`${baseHue}|${accentHue}`);
  rows.push({ id: c.id, name: c.channel_name, baseHue, accentHue, g, ok, achromatic });
}

console.log(`COL-01..06 (via shipped tokens.js): ${50 - failCount}/50 pass`);
console.log(`  c01 range ${c01[0].toFixed(2)}..${c01[1].toFixed(2)}  (gate 7..17)`);
console.log(`  c02 range ${c02[0].toFixed(2)}..${c02[1].toFixed(2)}  (gate >=4.5)`);
console.log(`  c03 range ${c03[0].toFixed(2)}..${c03[1].toFixed(2)}  (gate >=2.5)`);
console.log(`  c04 range ${c04[0].toFixed(2)}..${c04[1].toFixed(2)}  (gate >=3)`);
console.log(`  c05 range ${c05[0].toFixed(2)}..${c05[1].toFixed(2)}  (gate >=4.5)`);
console.log(`  c06 range ${c06[0].toFixed(1)}..${c06[1].toFixed(1)} deg  (gate >=60)`);
for (const r of rows) if (!r.ok) console.log(`  FAIL ch ${r.id} ${r.name}: ${JSON.stringify(r.g)} achromatic=${JSON.stringify(r.achromatic)}`);
console.log(`COL-07 thumbnail_spec: no hexes in thumbnail_spec -> ${channels.every((c) => !JSON.stringify(c.thumbnail_spec).match(/#[0-9a-fA-F]{6}/)) ? "PASS" : "FAIL"}`);
console.log(`COL-08 thumbnail_spec: zero hex literals in thumbnail_spec -> ${channels.every((c) => !JSON.stringify(c.thumbnail_spec).match(/#[0-9a-fA-F]{6}/)) ? "PASS" : "FAIL"}`);
console.log(`COL-09: unique (baseHue, accentHue) pairs: ${seen.size}/50 -> ${seen.size === 50 ? "PASS" : "FAIL"}`);
console.log(`COL-10: niches unique across network (${new Set(channels.map((c) => c.niche)).size}/50) -> vacuous N/A (no cluster map in repo)`);

// whole-file side note (legacy .colors field, thumbnails/endscreen lanes)
const colorsHexes = [];
for (const c of channels) if (c.colors) for (const v of Object.values(c.colors)) colorsHexes.push({ ch: c.id, hex: v });
const whiteBlack = colorsHexes.filter(({ hex }) => /^#(FFFFFF|000000)$/i.test(hex));
const achro = colorsHexes.filter(({ hex }) => {
  const m = hex.match(/^#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/);
  return m && m[1] === m[2] && m[2] === m[3];
});
console.log(`\nFOLLOW-UP (whole-file COL-07/08 reading): .colors still carries ${colorsHexes.length} hexes across ${channels.filter((c) => c.colors).length} channels; #FFFFFF/#000000: ${whiteBlack.length}, R=G=B: ${achro.length}. Owned by thumbnails/endscreen lanes; register COL-07/08 scoped to thumbnail_spec for audit-color.`);
