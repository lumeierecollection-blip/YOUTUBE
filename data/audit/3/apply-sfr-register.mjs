import { readFileSync, writeFileSync } from "fs";

// R-6: CHECK-REGISTER.md 3.3 — COL-01..10 state updates (audit-color Stage 3).
// File contains mojibake for non-ASCII glyphs, so match by line prefix only.
const f = "CHECK-REGISTER.md";
const lines = readFileSync(f, "utf8").split("\n");

const NEW = {
  "| COL-01 ": "| COL-01 | `textPrimary / bg` contrast | WCAG relative luminance | 7:1 <= r <= 17:1 | 0 | BLOCKER | 3 | **PASS** - 14.35-14.49 (data/audit/3/verify-final.mjs) |",
  "| COL-02 ": "| COL-02 | `accent / bg` contrast | WCAG | >=4.5:1 | 0 | BLOCKER | 3 | **PASS** - 4.53-5.70 |",
  "| COL-03 ": "| COL-03 | `accent / textPrimary` contrast | WCAG | >=2.5:1 | 0 | MAJOR | 3 | **PASS** - 2.54-3.20 |",
  "| COL-04 ": "| COL-04 | `stroke / bg` contrast | WCAG | >=3:1 | 0 | MAJOR | 3 | **PASS** - 3.18-3.28 |",
  "| COL-05 ": "| COL-05 | `textDim / bg` contrast | WCAG | >=4.5:1 | 0 | MINOR | 3 | **PASS** - 5.07-5.17 |",
  "| COL-06 ": "| COL-06 | Accent hue >=60 deg from base hue | OKLCH hue circle | >=60 deg | 0 | MAJOR | 3 | **PASS** - 60.0-167.2 deg (21 at constructed 60) |",
  "| COL-07 ": "| COL-07 | No `#FFFFFF`, `#000000`, or R=G=B in `thumbnail_spec` | parse `channels.json` | 0 | 0 | MAJOR | 3 | **PASS** - 0 (whole-file `.colors` legacy field = T-colors follow-up) |",
  "| COL-08 ": "| COL-08 | No hex literals in `thumbnail_spec` | parse `channels.json` | 0 | 0 | MAJOR | 3 | **PASS** - 0 (whole-file `.colors` legacy field = T-colors follow-up) |",
  "| COL-09 ": "| COL-09 | No two channels share both hues | parse | 0 duplicates | 0 | MAJOR | 3 | **PASS** - 50/50 unique |",
  "| COL-10 ": "| COL-10 | Within a niche cluster, accent hues >=40 deg apart | parse + cluster map | >=40 deg | 0 | MINOR | 3 | N/A - all 50 niches unique, no cluster map exists |",
};

let count = 0;
for (let i = 0; i < lines.length; i++) {
  for (const [prefix, to] of Object.entries(NEW)) {
    if (lines[i].startsWith(prefix)) {
      lines[i] = to;
      count++;
    }
  }
}
if (count !== Object.keys(NEW).length) {
  throw new Error(`expected ${Object.keys(NEW).length} rows, matched ${count}`);
}
writeFileSync(f, lines.join("\n"), "utf8");
console.log(`CHECK-REGISTER COL rows updated: ${count}`);
