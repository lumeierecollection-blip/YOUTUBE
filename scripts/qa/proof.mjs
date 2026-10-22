#!/usr/bin/env node
// CI proof of the QA core on a REAL render (qa-proof.yml): objective checks,
// risk-frame extraction + labelled contact sheet, defect report. With --expect
// it also asserts which defect checks must (or must not) be found, so a
// deliberately damaged copy of the render proves detection on real pixels.
//
//   node scripts/qa/proof.mjs --video v.mp4 [--manifest m.json] --out dir [--expect clean|black,aspect]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { runObjectiveChecks, probe } from "./objective-checks.mjs";
import { planRiskFrames, extractRiskFrames } from "./risk-frames.mjs";
import { writeDefectReport, sortDefects } from "./defects.mjs";

const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const video = arg("video"), out = arg("out"), manifestPath = arg("manifest"), expect = arg("expect");
if (!video || !out) { console.error("usage: proof.mjs --video v.mp4 --out dir [--manifest m.json] [--expect clean|check,check]"); process.exit(2); }

const manifest = manifestPath && existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
const info = probe(video);
const defects = sortDefects(runObjectiveChecks(video, { format: "shorts", manifest, publicDir: "src/skills/remotion-render/public" }));
const beats = (manifest?.beats || []).map((b) => ({ start: b.start_sec, end: b.start_sec + (b.duration_sec || 0) })).filter((b) => Number.isFinite(b.start));
const planned = planRiskFrames({ duration: info.duration, beats, max: 24 });
const { frames, sheet } = extractRiskFrames(video, planned, join(out, "risk-frames"));
const stem = basename(video).replace(/\.[^.]+$/, "");
writeDefectReport(out, stem, defects, { video, duration: info.duration, width: info.width, height: info.height, risk_frames: frames.length, contact_sheet: sheet });

const found = [...new Set(defects.map((d) => d.check))];
const summary = { video, duration: info.duration, size: `${info.width}x${info.height}`, beats: beats.length, risk_frames_planned: planned.length, risk_frames_extracted: frames.length, contact_sheet: sheet, defects: defects.length, checks_found: found, by_severity: defects.reduce((a, d) => ((a[d.severity] = (a[d.severity] || 0) + 1), a), {}) };
writeFileSync(join(out, "proof-summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

let fail = false;
if (!sheet) { console.log("::error::risk contact sheet was not produced"); fail = true; }
if (frames.length !== planned.length) { console.log(`::error::extracted ${frames.length}/${planned.length} risk frames`); fail = true; }
if (expect === "clean") {
  const bad = defects.filter((d) => d.severity === "blocker");
  if (bad.length) { console.log(`::error::clean render has blocker defects: ${bad.map((d) => d.check).join(", ")}`); fail = true; }
} else if (expect) {
  for (const want of expect.split(",")) {
    if (!found.some((c) => c.includes(want))) { console.log(`::error::expected a "${want}" defect on the damaged render; found [${found.join(", ")}]`); fail = true; }
  }
}
process.exit(fail ? 1 : 0);
