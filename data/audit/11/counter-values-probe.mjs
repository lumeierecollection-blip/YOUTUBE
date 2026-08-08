/**
 * data/audit/11/counter-values-probe.mjs — Stage-11 audit-motion probe.
 *
 * Runs the PRODUCTION package builder (mg-package buildMgPackage) over every
 * real SRT + the sections-fallback synthesis paths and prints every HERO_NUMBER
 * and PROGRESS counter value the beats/** components will render, plus the
 * counter strings formatCounter/counterText would emit across the count.
 *
 * Purpose: ground D5 (start value has the same digit count as the target) and
 * the motion half of D14 (counter string length / bounding box stability) on
 * REAL data, not fixtures.
 *
 * Run: node data/audit/11/counter-values-probe.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, "..", "..", "..");
const render = path.join(repo, "src", "skills", "remotion-render");

const { buildMgPackage } = await import(pathToFileURL(path.join(render, "compositions", "mg-package.js")));

// beats/HeroNumber.jsx raisedFloor + formatCounter — copied verbatim from the
// file (the file is .jsx and cannot be imported by Node directly; the probe
// mirrors the exact arithmetic so it tests what the component renders).
function raisedFloor(value) {
  const abs = Math.abs(Math.trunc(value));
  if (!Number.isFinite(abs) || abs < 10) return 0;
  return 10 ** (String(abs).length - 1);
}
function formatCounter(value, progress) {
  if (!Number.isFinite(value)) return "0";
  const floor = raisedFloor(value);
  const shown = Math.min(value, floor + (value - floor) * progress);
  const rounded = Number.isInteger(value) ? Math.round(shown) : Math.round(shown * 10) / 10;
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// The same counter arithmetic beats/Progress.jsx uses (mirrored — Progress.jsx
// does not export counterText; copied verbatim from the file).
function fmtValue(v) {
  if (!Number.isFinite(v)) return "0";
  if (Number.isInteger(v)) return v.toLocaleString("en-US");
  return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
}
function counterText(value, p) {
  const digits = String(Math.abs(Math.trunc(value))).length;
  const floor = value >= 10 ? 10 ** (digits - 1) : 0;
  const shown = Math.min(value, floor + (value - floor) * p);
  const rounded = Number.isInteger(value) ? Math.round(shown) : Math.round(shown * 10) / 10;
  return fmtValue(rounded);
}

function digitCountOf(s) {
  return String(s).replace(/[^0-9]/g, "").length;
}

const cases = [
  { tag: "ch-01 SRT", srt: "data/tts/ch-01/movile-cave-shorts-script-vo.srt", sections: [], totalMs: 60000 },
  { tag: "ch-01 sections-fallback", srt: "", sectionsFile: "data/scripts/ch-01/movile-cave-shorts-script.json", totalMs: 60000 },
  { tag: "ch-02 sections-fallback", srt: "", sectionsFile: "data/scripts/ch-02/narrowboat-10k-surprise-shorts-script.json", totalMs: 60000 },
  { tag: "ch-01 debt-snowball SRT", srt: "data/tts/1/debt-snowball-vs-debt-avalanche-shorts-script-vo.srt", sections: [], totalMs: 0 },
  { tag: "ch-04 great-fire SRT", srt: "data/tts/4/great-fire-of-london-script-vo.srt", sections: [], totalMs: 0 },
  { tag: "ch-02 what-to-say SRT (legacy)", srt: "data/tts/2/what-to-say-traffic-stop-script-vo.srt", sections: [], totalMs: 0 },
];

let anyD5Fail = false;
const report = { cases: [] };

for (const c of cases) {
  const srt = c.srt ? fs.readFileSync(path.join(repo, c.srt), "utf8") : "";
  let sections = c.sections || [];
  if (c.sectionsFile) {
    const j = JSON.parse(fs.readFileSync(path.join(repo, c.sectionsFile), "utf8"));
    sections = (j.sections || []).map((s) => ({ id: s.id, timing: s.timing, voiceover: s.voiceover }));
  }
  const pkg = buildMgPackage(srt, { sections, totalMs: c.totalMs || undefined });
  const entry = { tag: c.tag, heroes: [], progress: [] };

  for (const b of pkg.beats) {
    if (b.archetype === "HERO_NUMBER") {
      const v = b.scene.value;
      const floor = raisedFloor(v);
      const strings = [];
      const targetStr = String(v);
      const targetDigits = digitCountOf(targetStr);
      // Sample the count across progress 0..1 in 0.05 steps.
      for (let p = 0; p <= 1.0001; p += 0.05) strings.push(formatCounter(v, Math.min(p, 1)));
      const startDigits = digitCountOf(strings[0]);
      const widths = new Set(strings.map((s) => s.length));
      const d5ok = startDigits === targetDigits;
      if (!d5ok) anyD5Fail = true;
      entry.heroes.push({
        text: b.text,
        value: v,
        floor,
        targetStr,
        startStr: strings[0],
        endStr: strings[strings.length - 1],
        startDigits,
        targetDigits,
        d5ok,
        distinctLengths: [...widths].sort((a, b) => a - b),
        distinctStrs: [...new Set(strings)],
      });
    }
    if (b.archetype === "PROGRESS") {
      for (const p of b.scene.series || []) {
        const v = p.value;
        const floor = v >= 10 ? 10 ** (String(Math.abs(Math.trunc(v))).length - 1) : 0;
        const strings = [];
        for (let t = 0; t <= 1.0001; t += 0.05) strings.push(counterText(v, Math.min(t, 1)));
        const targetStr = fmtValue(v);
        const targetDigits = digitCountOf(targetStr);
        const startDigits = digitCountOf(strings[0]);
        const d5ok = startDigits === targetDigits;
        if (!d5ok) anyD5Fail = true;
        entry.progress.push({
          text: b.text,
          value: v,
          floor,
          targetStr,
          startStr: strings[0],
          endStr: strings[strings.length - 1],
          startDigits,
          targetDigits,
          d5ok,
          distinctLengths: [...new Set(strings.map((s) => s.length))].sort((a, b) => a - b),
          distinctStrs: [...new Set(strings)],
        });
      }
    }
  }
  report.cases.push(entry);
  console.log("=== " + c.tag + " ===");
  for (const h of entry.heroes) {
    console.log(
      `  HERO value=${h.value} floor=${h.floor} "${h.startStr}" -> "${h.endStr}" startDigits=${h.startDigits} targetDigits=${h.targetDigits} D5=${h.d5ok ? "PASS" : "FAIL"} lengths=${h.distinctLengths.join(",")}`
    );
  }
  for (const p of entry.progress) {
    console.log(
      `  PROG value=${p.value} floor=${p.floor} "${p.startStr}" -> "${p.endStr}" startDigits=${p.startDigits} targetDigits=${p.targetDigits} D5=${p.d5ok ? "PASS" : "FAIL"} lengths=${p.distinctLengths.join(",")}`
    );
  }
}

console.log("\nD5 overall: " + (anyD5Fail ? "FAIL — at least one counter's start digit count != target digit count" : "PASS — all counters keep the target's digit count from frame 0"));
console.log("(D14 motion half: any counter whose distinctLengths > 1 has a string whose WIDTH changes mid-count on a non-tnum font, and even on tnum if the digit count changes.)");
fs.writeFileSync(path.join(__dirname, "out", "counter-values-probe.json"), JSON.stringify(report, null, 2));
process.exit(anyD5Fail ? 1 : 0);
