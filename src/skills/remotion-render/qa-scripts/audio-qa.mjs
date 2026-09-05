#!/usr/bin/env node
/**
 * Audio QA — measure the RENDERED mix, not the plan.
 *
 * Usage: node qa-scripts/audio-qa.mjs <video.mp4> [visual-report.json]
 *
 * WHY THIS EXISTS SEPARATELY FROM summarizeSound()
 *
 * visual/diagnostics.js summarizes what the scheduler INTENDED: how many
 * events, at what targets, how far apart. That is the plan. It cannot tell
 * you whether Remotion actually mixed those files in, whether the volume
 * function was applied, or whether the result sits under the narration.
 * Only the finished file can, so this decodes it.
 *
 * WHAT IT MEASURES
 *
 *   - The mix's own level over time, in 100ms windows.
 *   - The level in each scheduled event's window against the level of the
 *     surrounding audio, which is what "sits beneath the narration" means
 *     in practice.
 *   - Whether the event windows are audibly different from the silence
 *     around them at all — the check that proves the sound is really there
 *     rather than scheduled and dropped.
 *
 * THE MUTE TEST (section 7 of the brief) is the complement of this and is
 * not an audio measurement: it asks whether the PICTURE still carries the
 * story with the sound off. qa-scripts/render-visual-tests.sh plus frame
 * inspection is where that is answered; the numbers here only establish
 * that the sound is present and correctly placed underneath.
 *
 * HONEST LIMIT
 *
 * When the voiceover track is silent — which it is for every fixture in
 * this sandbox, because EdgeTTS needs a WebSocket the proxy does not carry
 * — there is no narration to measure SFX against. This script says so
 * explicitly and reports absolute SFX levels only, rather than printing a
 * headroom figure it did not observe.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(__dirname, "..");
const FFMPEG = join(RENDER_DIR, "node_modules", "@remotion", "compositor-linux-x64-gnu", "ffmpeg");

const SR = 44100;
const WIN_MS = 100;

/** Decode to mono PCM and return Float32 samples in [-1, 1]. */
function decode(path) {
  const wav = execFileSync(FFMPEG, ["-v", "error", "-i", path, "-ac", "1", "-ar", String(SR), "-f", "wav", "-"], {
    maxBuffer: 1024 * 1024 * 1024,
  });
  let off = 12;
  while (off + 8 <= wav.length) {
    const id = wav.toString("ascii", off, off + 4);
    const size = wav.readUInt32LE(off + 4);
    if (id === "data") {
      off += 8;
      const count = Math.floor(Math.min(size, wav.length - off) / 2);
      const out = new Float32Array(count);
      for (let i = 0; i < count; i++) out[i] = wav.readInt16LE(off + i * 2) / 32768;
      return out;
    }
    off += 8 + size + (size % 2);
  }
  throw new Error(`no data chunk in ${path}`);
}

const db = (v) => (v > 0 ? Math.round(20 * Math.log10(v) * 10) / 10 : null);

function rms(samples, from, to) {
  const a = Math.max(0, Math.floor(from));
  const b = Math.min(samples.length, Math.ceil(to));
  if (b <= a) return 0;
  let s = 0;
  for (let i = a; i < b; i++) s += samples[i] * samples[i];
  return Math.sqrt(s / (b - a));
}

function main() {
  const [videoPath, reportPath] = process.argv.slice(2);
  if (!videoPath || !existsSync(videoPath)) {
    console.error("usage: audio-qa.mjs <video.mp4> [visual-report.json]");
    process.exit(2);
  }

  const samples = decode(videoPath);
  const seconds = samples.length / SR;
  const winN = Math.floor((WIN_MS / 1000) * SR);

  // Whole-file shape.
  const windows = [];
  for (let i = 0; i + winN <= samples.length; i += winN) windows.push(rms(samples, i, i + winN));
  const overall = rms(samples, 0, samples.length);
  const peak = samples.reduce((m, s) => Math.max(m, Math.abs(s)), 0);

  console.log(`file      : ${videoPath}`);
  console.log(`duration  : ${seconds.toFixed(2)}s`);
  console.log(`mix RMS   : ${db(overall) ?? "-inf"} dBFS`);
  console.log(`mix peak  : ${db(peak) ?? "-inf"} dBFS`);

  if (peak === 0) {
    console.log("\nThe rendered audio track is entirely silent. Nothing to measure.");
    process.exit(1);
  }

  const report = reportPath && existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf-8")) : null;
  const events = (report && report.sound && report.sound.events) || [];
  if (events.length === 0) {
    console.log("\nNo scheduled events in the report — reporting whole-file levels only.");
    console.log("(Pass the render's *-visual-report.json to measure per-event windows.)");
    return;
  }

  // SEARCH WINDOW, not an exact offset.
  //
  // A scheduled frame is not a sample offset. Frames quantise to 33.3ms, and
  // the AAC encoder adds its own priming delay, so a sound scheduled at
  // frame N lands consistently 20-40ms later in the finished file. Measured
  // dead-on from atFrame/fps, a 23ms tick reads as -inf and looks dropped
  // when it played perfectly. So each event is measured over a window that
  // brackets its scheduled frame, and the level is the RMS over the sound's
  // own duration starting at the loudest onset found inside it.
  const PRE_S = 0.02;
  const POST_S = 0.12;

  const eventWindowIdx = new Set();
  for (const ev of events) {
    const start = (ev.atFrame / 30 - PRE_S) * SR;
    const end = start + ((ev.durationMs || 300) / 1000 + PRE_S + POST_S) * SR;
    for (let i = Math.floor(start / winN); i <= Math.floor(end / winN); i++) eventWindowIdx.add(i);
  }
  const bedWindows = windows.filter((_, i) => !eventWindowIdx.has(i));
  const bedRms = Math.sqrt(bedWindows.reduce((a, v) => a + v * v, 0) / (bedWindows.length || 1));

  // -60 dBFS, not "exactly zero". A silent voiceover track still comes back
  // at about -71 dBFS because AAC coding noise is not digital silence, and
  // treating that as narration produced a nonsense headroom figure the first
  // time this ran. Nothing at -60 dBFS is speech.
  const SILENCE_FLOOR_DB = -60;
  const bedIsSilent = (db(bedRms) ?? -Infinity) < SILENCE_FLOOR_DB;

  console.log(`\nnon-event audio (narration + silence): ${db(bedRms) ?? "-inf"} dBFS RMS over ${bedWindows.length} windows`);
  if (bedIsSilent) {
    console.log(
      `  ! Below the ${SILENCE_FLOOR_DB} dBFS speech floor: this render has NO NARRATION to sit under.\n` +
        "    Absolute SFX levels below are real measurements; the headroom against\n" +
        "    speech is NOT measured here and must not be reported as if it were.\n" +
        "    (EdgeTTS needs a WebSocket this sandbox's proxy does not carry — see\n" +
        "    visual/sound-design.js.)"
    );
  }

  console.log(`\n${events.length} scheduled events, measured in the finished mix:`);
  let present = 0;
  let loudest = 0;
  let loudestPeak = 0;
  const offsets = [];
  for (const ev of events) {
    const durS = (ev.durationMs || 300) / 1000;
    const searchFrom = Math.max(0, (ev.atFrame / 30 - PRE_S) * SR);
    const searchTo = (ev.atFrame / 30 + durS + POST_S) * SR;

    // Onset = the first 5ms window in the bracket that rises clearly above
    // the 200ms of audio preceding it.
    const floor = Math.max(rms(samples, searchFrom - 0.2 * SR, searchFrom), 1e-7);
    const step = Math.floor(0.005 * SR);
    let onset = null;
    for (let i = Math.floor(searchFrom); i + step < searchTo; i += step) {
      if (rms(samples, i, i + step) > floor * 4) {
        onset = i;
        break;
      }
    }

    const level = onset === null ? 0 : rms(samples, onset, onset + durS * SR);
    let pk = 0;
    if (onset !== null) {
      for (let i = onset; i < Math.min(samples.length, onset + durS * SR); i++) pk = Math.max(pk, Math.abs(samples[i]));
    }
    const audible = onset !== null && level > 1e-6;
    if (audible) {
      present += 1;
      offsets.push(onset / SR - ev.atFrame / 30);
    }
    loudest = Math.max(loudest, level);
    loudestPeak = Math.max(loudestPeak, pk);

    console.log(
      `  ${(ev.atFrame / 30).toFixed(2).padStart(6)}s  ${String(ev.role).padEnd(12)} ` +
        `target ${String(ev.targetDb).padStart(4)}  measured ${String(db(level) ?? "-inf").padStart(6)} dBFS  ` +
        `${audible ? `+${Math.round((onset / SR - ev.atFrame / 30) * 1000)}ms` : "NOT AUDIBLE"}`.padEnd(14) +
        `  ${(ev.file || "").split("/").pop()}`
    );
  }

  const meanOffset = offsets.length ? (offsets.reduce((a, b) => a + b, 0) / offsets.length) * 1000 : 0;
  console.log(`\nevents audible in the mix : ${present}/${events.length}`);
  console.log(`mean schedule->mix offset : ${meanOffset.toFixed(0)}ms (frame quantisation + encoder priming)`);
  console.log(`loudest event RMS         : ${db(loudest) ?? "-inf"} dBFS`);
  console.log(`loudest event peak        : ${db(loudestPeak) ?? "-inf"} dBFS`);
  if (bedIsSilent) {
    console.log("headroom under narration  : NOT MEASURED (no narration in this render)");
  } else {
    console.log(`headroom under narration  : ${(db(bedRms) - db(loudest)).toFixed(1)} dB (measured)`);
  }

  if (present < events.length) {
    console.log(`\nFAIL: ${events.length - present} scheduled events did not reach the mix.`);
    process.exit(1);
  }
  console.log("\nPASS: every scheduled event is present in the rendered audio.");
}

main();
