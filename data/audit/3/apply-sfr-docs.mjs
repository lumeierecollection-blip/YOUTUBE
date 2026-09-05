import { readFileSync, writeFileSync } from "fs";

// R-3: DETAIL-REFERENCE.md B1 table row — stroke 0.40 -> 0.50
let d = readFileSync("DETAIL-REFERENCE.md", "utf8");
const row = "| — | `stroke` | 0.40 | outlines at every level |";
const newRow =
  "| — | `stroke` | 0.50 | outlines at every level (amended from 0.40 — COL-04 needs ≥3:1; see data/audit/3 ledger A-1) |";
if (!d.includes(row)) throw new Error("B1 stroke row not found");
d = d.replace(row, newRow);
writeFileSync("DETAIL-REFERENCE.md", d, "utf8");
console.log("DETAIL-REFERENCE B1 table row patched");

// R-5: MOTION-GRAPHICS-MANUAL.md — A2 intro + line 1117 wording
let m = readFileSync("MOTION-GRAPHICS-MANUAL.md", "utf8");
let count = 0;

const introFrom = [
  "Each channel supplies three colours via `thumbnail_spec.color_palette` in",
  "`config/channels.json` — e.g. Legal Brief is `['#1A1A2E', '#E94560', '#FFFFFF']`.",
  "`resolveColors()` in `compositions/visual.js` already maps these.",
].join("\n");
const introTo = [
  "Each channel supplies two hues — `baseHue` and `accentHue` (OKLCH hue degrees)",
  "in `config/channels.json` — e.g. Legal Brief is `{ baseHue: 283.8, accentHue: 15.7 }`.",
  "All role colours (bg/accent/textPrimary/textDim/stroke/surface/raised) are derived",
  "from those two hues in `styles/tokens.js` (`paletteFromHues`), with the role map",
  "below; `resolveColors()` in `compositions/visual.js` maps the derived roles onto",
  "each style's semantic colour roles.",
].join("\n");
if (!m.includes(introFrom)) throw new Error("MANUAL A2 intro not found");
m = m.replace(introFrom, introTo);
count++;

const rowFrom = "| `thumbnail_spec.color_palette` | 3 colours, must pass A2.4 |";
const rowTo =
  "| `thumbnail_spec.baseHue` / `accentHue` | 2 hues, derived roles must pass A2.4 and COL-01..06 |";
if (!m.includes(rowFrom)) throw new Error("MANUAL row 1117 not found");
m = m.replace(rowFrom, rowTo);
count++;

writeFileSync("MOTION-GRAPHICS-MANUAL.md", m, "utf8");
console.log(`MOTION-GRAPHICS-MANUAL patched (${count} spots)`);
