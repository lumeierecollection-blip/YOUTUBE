// probe-renderer-state.js — computed CURRENT for the two Stage-5 gate legs.
// Scans the renderer sources (not my owned deliverables) and reports every
// text-measurement call site, whether the font gate (validateFontIsLoaded) is
// armed anywhere, and whether a shared fontStyle object exists.
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..", "..", "src", "skills", "remotion-render");
const patterns = {
  measureText: /measureText\s*\(/g,
  fitTextOnNLines: /fitTextOnNLines\s*\(/g,
  fitTextCall: /(?<!OnNLines)\bfitText\s*\(/g,
  fillTextBox: /fillTextBox\s*\(/g,
  validateFontIsLoaded: /validateFontIsLoaded/g,
  fontStyle: /fontStyle/g,
  getBoundingClientRect: /getBoundingClientRect/g,
  getComputedStyle: /getComputedStyle/g,
  useCurrentScale: /useCurrentScale/g,
};

function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".cache" || ent.name === ".remotion") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(js|jsx|mjs|ts|tsx)$/.test(ent.name)) out.push(p);
  }
  return out;
}

const files = walk(root, []);
const report = { files: [], totals: {} };

for (const pat of Object.keys(patterns)) report.totals[pat] = 0;

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const lines = src.split("\n");
  const fileReport = { rel: path.relative(root, f).replace(/\\/g, "/"), hits: [] };
  for (const pat of Object.keys(patterns)) {
    for (let i = 0; i < lines.length; i++) {
      const re = patterns[pat];
      re.lastIndex = 0;
      if (re.test(lines[i])) {
        fileReport.hits.push({ pattern: pat, line: i + 1, text: lines[i].trim().slice(0, 140) });
        report.totals[pat]++;
      }
    }
  }
  report.files.push(fileReport);
}

// Distinct inline font-property literals in the renderer (evidence of
// duplication vs a single shared fontStyle object).
const fontWeightLiterals = {};
const fontFamilyLiterals = {};
for (const f of files) {
  if (!/motion-graphics|mg-style|cinematic|minimal/.test(f)) continue;
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/fontWeight\s*:\s*["']?\d+["']?/g)) {
    fontWeightLiterals[m[0].replace(/\s/g, "")] = (fontWeightLiterals[m[0].replace(/\s/g, "")] || 0) + 1;
  }
  for (const m of src.matchAll(/fontFamily\s*:\s*([A-Za-z_$][\w$]*)/g)) {
    fontFamilyLiterals[m[1]] = (fontFamilyLiterals[m[1]] || 0) + 1;
  }
}

console.log(JSON.stringify({ ...report, fontFamilyLiterals, fontWeightLiterals }, null, 2));
