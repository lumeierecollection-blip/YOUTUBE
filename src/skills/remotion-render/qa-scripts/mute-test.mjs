#!/usr/bin/env node
/**
 * THE MUTE TEST — pull the frame each beat has to carry, with the sound off.
 *
 * Usage: node qa-scripts/mute-test.mjs <video.mp4> <visual-report.json> [outDir]
 *
 * WHAT THE MUTE TEST IS
 *
 * Play the video with the audio muted. If a viewer can still follow what is
 * being explained, the picture is doing the work. If they cannot, the video
 * was narration with decoration behind it. That is the whole standard.
 *
 * WHAT THIS SCRIPT CAN AND CANNOT DO — READ THIS BEFORE QUOTING IT
 *
 * It CANNOT answer the mute test. "Does this frame explain the idea" is a
 * judgement, and this pass adds zero model calls, so nothing here is going
 * to make that judgement. Any script claiming to have automated it would be
 * lying about what it measured.
 *
 * What it does instead is make the test cheap for a human to actually run:
 *
 *   1. It extracts the frame at each beat's ANCHOR — the frame where the
 *      beat's key word is really spoken, from the SRT. That is the moment
 *      the picture is most on the hook, and it is a far harder test than a
 *      frame picked at a round number of seconds.
 *   2. It prints, per beat, the strategy, the composition variant, and how
 *      many words that beat puts on screen — so a frame that "reads well"
 *      only because it is printing the sentence is obvious in the list.
 *   3. It reports the proxy metrics that CAN be measured: how much of the
 *      narration is printed, how many beats print nothing at all, whether
 *      any beat is still an icon on a background.
 *
 * A frame that scores perfectly on every proxy can still fail the real
 * test. Look at the frames.
 */
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FFMPEG = join(__dirname, "..", "node_modules", "@remotion", "compositor-linux-x64-gnu", "ffmpeg");
const FPS = 30;

const [videoPath, reportPath, outArg] = process.argv.slice(2);
if (!videoPath || !existsSync(videoPath) || !reportPath || !existsSync(reportPath)) {
  console.error("usage: mute-test.mjs <video.mp4> <visual-report.json> [outDir]");
  process.exit(2);
}

const report = JSON.parse(readFileSync(reportPath, "utf-8"));
const beats = report.beats || [];
if (beats.length === 0) {
  console.error("report has no beats[] — re-render with the current diagnostics.js");
  process.exit(2);
}

const slug = basename(videoPath).replace(/\.mp4$/, "");
const outDir = outArg || join(__dirname, "..", "..", "..", "..", "qa", "pass3", "mute-test", slug);
mkdirSync(outDir, { recursive: true });

const m = report.metrics;
console.log(`${slug}\n`);
console.log("PROXY METRICS (these do not answer the mute test, they bound it)");
console.log(`  words printed on screen : ${m.supportingTextWords} total, max ${m.maxWordsOnOneBeat} on one beat`);
console.log(`  text/narration ratio    : ${m.textNarrationRatio}`);
console.log(`  beats printing nothing  : ${Math.round(m.wordlessBeatRatio * 100)}%`);
console.log(`  icon-as-hero ratio      : ${m.iconHeroRatio}`);
console.log(`  generic fallback ratio  : ${m.genericFallbackRatio}`);
console.log(`  visual states per beat  : ${m.averageStatesPerBeat}`);

console.log(`\nFRAMES AT EACH BEAT'S ANCHOR (the frame the picture has to carry)`);
/**
 * A BEAT PAST THE END OF THE VIDEO IS REPORTED, NOT COUNTED.
 *
 * ffmpeg seeking beyond EOF exits 0 and writes nothing, and this loop used
 * to print `beats.length` regardless — so pointing it at a 15s clip whose
 * report describes the whole 72s script announced "31 frames" when 8 were
 * on disk. A muted review that thinks it has 31 frames and has 8 is worse
 * than one that knows it has 8: the strategies in the missing 23 look
 * reviewed and never were.
 */
let written = 0;
const missing = [];
for (const b of beats) {
  const frame = Number.isFinite(b.anchorFrame) ? b.anchorFrame : b.startFrame + Math.floor(b.durationInFrames / 2);
  const t = frame / FPS;
  const name = `beat-${String(frame).padStart(5, "0")}-${b.strategy || "unplanned"}.png`;
  const outPath = join(outDir, name);
  try {
    execFileSync(FFMPEG, ["-v", "error", "-ss", String(t), "-i", videoPath, "-frames:v", "1", outPath, "-y"]);
  } catch {
    /* fall through to the existsSync check — a failed seek is not fatal */
  }
  if (existsSync(outPath)) {
    written++;
    console.log(
      `  ${t.toFixed(2).padStart(6)}s  ${String(b.strategy || "-").padEnd(21)} v${b.variant ?? "-"}  ` +
        `${String(b.words).padStart(2)} words on screen   "${b.text}"`
    );
  } else {
    missing.push({ t, strategy: b.strategy || "-" });
  }
}

console.log(`\n${written} frames -> ${outDir}`);
if (missing.length) {
  const strategies = [...new Set(missing.map((m) => m.strategy))].sort();
  console.log(
    `${missing.length} beat(s) lie past the end of this video (from ${missing[0].t.toFixed(2)}s) and were NOT captured — ` +
    `strategies unreviewed here: ${strategies.join(", ")}`
  );
  console.log("The report describes the whole script; this clip is only part of it.");
}
console.log("Now LOOK at them. Nothing above is a substitute for that.");
