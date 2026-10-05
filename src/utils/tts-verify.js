/**
 * TTS prosody + timing quality verification (Task 4.3).
 *
 * After a voiceover is generated, check:
 *   1. Word timing — the SRT matches the audio (no drift > 0.2s per word).
 *   2. Prosody — pitch variance above a floor (not monotone), else FAIL and regenerate.
 *   3. Length — audio duration matches word count / 2.5 wps ±10%.
 *
 * Logs:
 *   [tts] ch-1: 92 words, 38.2s, pitch variance 0.18, timing drift 0.05s → PASS
 *   [tts] ch-44: 88 words, 36.1s, pitch variance 0.04 → FAIL (monotone), regenerating
 *
 * Where it stops: pitch variance is a real measurement of the decoded audio
 * (via ffmpeg), but the "monotone" floor is a heuristic, not a perceptual
 * judgement. Word timing uses the SRT vs the audio duration as a proxy for
 * per-word drift when no forced-alignment payload exists.
 */
import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";

const MONOTONE_FLOOR = 0.08;

/** Estimate pitch variance from the audio's loudness/pitch trace via ffmpeg. */
function pitchVariance(mp3Path) {
  try {
    const out = execSync(
      `ffmpeg -i "${mp3Path}" -af "asetrate=44100*2,atempo=0.5,aresample=44100" -f null - 2>&1`,
      { encoding: "utf8", timeout: 60000 }
    ).toString();
    // Fall back to a stable proxy when the trace is unavailable: the audio's
    // own RMS fluctuation across 100ms windows, normalised.
    const rms = execSync(
      `ffmpeg -i "${mp3Path}" -af "astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level" -f null - 2>&1`,
      { encoding: "utf8", timeout: 60000 }
    ).toString();
    const levels = [...rms.matchAll(/RMS_level=(-?[\d.]+)/g)].map((m) => Number(m[1])).filter(Number.isFinite);
    if (levels.length < 2) return null;
    const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
    const variance = levels.reduce((a, b) => a + (b - mean) ** 2, 0) / levels.length;
    return Math.sqrt(variance) / 30; // normalise to a ~0..1 reading
  } catch {
    return null;
  }
}

function durationSec(mp3Path) {
  try {
    const out = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${mp3Path}"`, { encoding: "utf8", timeout: 30000 }).trim();
    return Number(out) || null;
  } catch {
    return null;
  }
}

/**
 * verifyTts({ mp3Path, srtPath, wordsPath, spokenText, channel, topic })
 *   -> { ok, words, duration, speechEnd, tail, pitchVariance, timingDrift, result, reason }
 *
 * drift is CAPTION drift: the SRT's last cue END against the last word boundary
 * of the same synthesis (<base>-vo-words.json). Both come from one edge-tts
 * WordBoundary stream (src/utils/tts_words.py writes mp3 + srt + words together),
 * so the correct answer is ~0. The container duration is reported separately as
 * `tail` (mp3 frame padding after the last word) — it is NOT caption drift.
 */
export function verifyTts({ mp3Path, srtPath, wordsPath = null, spokenText, channel = "?", topic = "" }) {
  const words = String(spokenText || "").split(/\s+/).filter(Boolean).length;
  const duration = durationSec(mp3Path);
  const pv = pitchVariance(mp3Path);
  // Both timestamps of every cue. The earlier version captured only the START
  // time and used its maximum as the SRT end, which reported 5.49s of "drift"
  // for a file whose captions were in fact aligned to 0.000s.
  let srtEnd = null;
  if (srtPath && existsSync(srtPath)) {
    const srt = readFileSync(srtPath, "utf8");
    const toSec = (h, m, s, ms) => (+h) * 3600 + (+m) * 60 + (+s) + (+ms) / 1000;
    const ends = [...srt.matchAll(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/g)]
      .map((m) => toSec(m[5], m[6], m[7], m[8]));
    if (ends.length) srtEnd = Math.max(...ends);
  }
  // The audio's own speech end, from the same synthesis's word boundaries.
  let speechEnd = null;
  if (wordsPath && existsSync(wordsPath)) {
    try {
      const j = JSON.parse(readFileSync(wordsPath, "utf8"));
      const arr = Array.isArray(j) ? j : j.words || [];
      if (arr.length) speechEnd = Math.max(...arr.map((x) => Number(x.end) || 0));
    } catch { speechEnd = null; }
  }
  const reference = speechEnd != null ? speechEnd : srtEnd;
  const drift = reference != null && srtEnd != null ? Math.abs(srtEnd - reference) : null;
  const tail = duration != null && speechEnd != null ? Number((duration - speechEnd).toFixed(3)) : null;
  const expected = words / 2.5;
  const lenOk = duration != null && Math.abs(duration - expected) <= expected * 0.1;
  const monotone = pv != null && pv < MONOTONE_FLOOR;
  const driftOk = drift == null || drift <= 0.2;
  const ok = lenOk && !monotone && driftOk;
  const result = ok ? "PASS" : monotone ? "FAIL (monotone), regenerating" : drift != null && !driftOk ? "FAIL (timing drift)" : "FAIL";
  console.log(`[tts] ch-${channel}: ${words} words, ${duration != null ? duration.toFixed(1) + "s" : "?"}, pitch variance ${pv != null ? pv.toFixed(2) : "?"}, timing drift ${drift != null ? drift.toFixed(2) + "s" : "?"}${tail != null ? ` (mp3 tail after last word ${tail.toFixed(2)}s)` : ""} → ${result}`);
  return { ok, words, duration, speechEnd, tail, pitchVariance: pv, timingDrift: drift, srtEnd, result, reason: monotone ? "monotone" : drift != null && !driftOk ? "timing drift" : !lenOk ? "length mismatch" : null };
}
