#!/usr/bin/env node
/**
 * narration-floor — the DETERMINISTIC checks on a voiceover. Blocking. Reads pixels-free measurements of the file only; no model.
 *
 *   node scripts/narration-floor.mjs --audio <vo.mp3> --srt <vo.srt> [--words <vo-words.json>] [--video <video.mp4>] [--out <json>]
 *
 * What it checks (each one a concrete failure, nothing about how the speech sounds):
 *   decode        the file decodes, and has a duration
 *   length        the file runs at least to the last cue's end (a voiceover cut short)
 *   av            the video and the audio agree within AV_TOL_S (a render that ends before or after its narration) — when --video is given
 *   silence       no silence longer than MAX_SILENCE_S between the first and last spoken word
 *   drift         the captions end within DRIFT_TOL_S of the last spoken word (the SRT and the audio disagree)
 *   clipping      fewer than CLIP_MAX_SAMPLES samples at full scale (the audio was driven into the ceiling)
 *
 * Exit 0 = every check passes; exit 1 = a check failed (listed). The listener (narration-judge.mjs) is advisory and is NOT consulted here.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const AV_TOL_S = 1.0;          // the render and the voiceover may differ by a frame or two, not by a sentence
export const MAX_SILENCE_S = 2.0;     // a voiceover pause between paragraphs is about 1 s; longer is a hole
export const DRIFT_TOL_S = 0.5;       // matches the regeneration threshold in render-and-qa.js
export const CLIP_MAX_SAMPLES = 20;   // full-scale samples tolerated (a single peak is not clipping)
const SILENCE_DB = "-45dB";

const run = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

export function probeSeconds(file, audioStreamOnly = false) {
  const args = ["-v", "error", ...(audioStreamOnly ? ["-select_streams", "a:0"] : []), "-show_entries", audioStreamOnly ? "stream=duration" : "format=duration", "-of", "csv=p=0", file];
  const r = run("ffprobe", args);
  const v = Number(String(r.stdout || "").trim().split("\n")[0]);
  return r.status === 0 && Number.isFinite(v) && v > 0 ? v : null;
}

/** Silence runs (seconds) longer than MAX_SILENCE_S, measured within [from, to] of the file. */
export function silenceRuns(file, from, to) {
  const r = run("ffmpeg", ["-v", "info", "-ss", String(from), "-t", String(Math.max(0.1, to - from)), "-i", file, "-af", `silencedetect=noise=${SILENCE_DB}:d=${MAX_SILENCE_S}`, "-f", "null", "-"]);
  const text = `${r.stderr || ""}`;
  const runs = [...text.matchAll(/silence_duration: ([\d.]+)/g)].map((m) => Number(m[1]));
  return { ok: r.status === 0, longest: runs.length ? Math.max(...runs) : 0, count: runs.length };
}

/** Full-scale samples in the decoded audio (16-bit PCM). */
export function clippedSamples(file) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-f", "s16le", "-ac", "1", "-ar", "24000", "-"], { maxBuffer: 512 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout) return null;
  const buf = r.stdout;
  let n = 0;
  for (let i = 0; i + 1 < buf.length; i += 2) {
    const v = buf.readInt16LE(i);
    if (v >= 32767 || v <= -32768) n++;
  }
  return n;
}

export function lastCueEnd(srtText) {
  const ends = [...String(srtText || "").matchAll(/-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/g)].map((m) => Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000);
  return ends.length ? Math.max(...ends) : null;
}

export function floorCheck({ audio, srt, words = null, video = null }) {
  const failures = [], measured = {};
  const dur = probeSeconds(audio);
  measured.audio_seconds = dur;
  if (dur === null) return { ok: false, failures: ["decode: the voiceover does not decode or has no duration"], measured };

  const cueEnd = srt ? lastCueEnd(readFileSync(srt, "utf8")) : null;
  measured.last_cue_end = cueEnd;
  if (cueEnd !== null && dur + 0.05 < cueEnd) failures.push(`length: the voiceover (${dur.toFixed(2)} s) ends before its last caption (${cueEnd.toFixed(2)} s)`);

  let speechEnd = null, speechStart = 0;
  if (words) {
    try {
      const arr = JSON.parse(readFileSync(words, "utf8")); const w = Array.isArray(arr) ? arr : arr.words || [];
      if (w.length) { speechStart = Math.min(...w.map((x) => Number(x.start) || 0)); speechEnd = Math.max(...w.map((x) => Number(x.end) || 0)); }
    } catch (e) { failures.push(`drift: the word timings cannot be read (${e.message})`); }
  }
  if (speechEnd !== null && cueEnd !== null) {
    measured.drift_s = Math.abs(cueEnd - speechEnd);
    if (measured.drift_s > DRIFT_TOL_S) failures.push(`drift: the captions end ${measured.drift_s.toFixed(2)} s from the last spoken word (tolerance ${DRIFT_TOL_S} s)`);
  }

  const sil = silenceRuns(audio, speechStart, speechEnd ?? Math.max(speechStart, dur));
  measured.longest_silence_s = sil.longest;
  if (!sil.ok) failures.push("silence: the voiceover cannot be scanned for silence");
  else if (sil.longest > MAX_SILENCE_S) failures.push(`silence: ${sil.longest.toFixed(2)} s of silence inside the speech (limit ${MAX_SILENCE_S} s)`);

  const clipped = clippedSamples(audio);
  measured.full_scale_samples = clipped;
  if (clipped === null) failures.push("clipping: the voiceover cannot be decoded to samples");
  else if (clipped > CLIP_MAX_SAMPLES) failures.push(`clipping: ${clipped} full-scale samples (limit ${CLIP_MAX_SAMPLES})`);

  if (video) {
    const vd = probeSeconds(video);
    measured.video_seconds = vd;
    if (vd === null) failures.push("av: the video cannot be probed");
    else if (Math.abs(vd - dur) > AV_TOL_S) failures.push(`av: video ${vd.toFixed(2)} s vs voiceover ${dur.toFixed(2)} s (tolerance ${AV_TOL_S} s)`);
  }
  return { ok: failures.length === 0, failures, measured };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
  const res = floorCheck({ audio: arg("audio"), srt: arg("srt"), words: arg("words"), video: arg("video") });
  const out = arg("out");
  if (out) writeFileSync(out, JSON.stringify(res, null, 2) + "\n");
  console.log(`[floor] ${res.ok ? "PASS" : "FAIL"} ${JSON.stringify(res.measured)}`);
  for (const f of res.failures) console.error(`::error::narration floor: ${f}`);
  process.exit(res.ok ? 0 : 1);
}
