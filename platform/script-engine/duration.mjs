/**
 * Duration comes from MEASURED words per minute for the voice, never a constant.
 * measureWpm() voices a fixed calibration passage with the channel's real TTS voice and times the file; the
 * result is the voice's effective rate including its pauses. Nothing is sped up to fit: a story that does not
 * fit the length is narrowed (blueprint.mjs / engine.mjs), the voice rate is not touched.
 *
 * DEFAULT_WPM exists only so the engine can run where no TTS is installed (the local tests, or a TTS outage). Anything that
 * uses it says so in the quality report (`wpm.source: "default"`) and in its caveats.
 */
import { wordCount } from "./text.mjs";

export const DEFAULT_WPM = 150;
export const CALIBRATION_TEXT = "The report was published in March. It listed three findings. The first concerned the cost of the programme, which rose by a fifth over two years. The second looked at how long people waited, and found the average had fallen. The third was about trust: most of those surveyed said they knew who ran the service, but fewer could name one thing it had changed.";

export function measureWpm({ tools, voice, text = CALIBRATION_TEXT, rate = "+0%" }) {
  const file = tools.voice({ text, voice, output: `calibration-${voice}.mp3`, rate });
  const seconds = tools.durationOf(file);
  if (!(seconds > 3)) throw new Error(`calibration for ${voice} measured ${seconds}s`);
  return { voice, wpm: Math.round((wordCount(text) / seconds) * 60 * 10) / 10, seconds, words: wordCount(text), source: "measured", rate };
}

export const wpmFrom = (m) => (m && m.wpm > 60 ? { wpm: m.wpm, source: m.source || "measured", voice: m.voice ?? null } : { wpm: DEFAULT_WPM, source: "default", voice: m?.voice ?? null });

export const estimateSeconds = (text, wpm) => Math.round((wordCount(text) / wpm) * 60 * 10) / 10;
export const capacityWords = (seconds, wpm) => Math.floor((seconds * wpm) / 60);

/** Script estimate against the real narration and the real MP4. Used by the engine's QA and by the tests. */
export function durationProblems({ estimate_s, narration_s = null, mp4_s = null, max_s, min_s = 0, tolerance = 0.12 }) {
  const out = [];
  if (estimate_s > max_s) out.push({ severity: "critical", category: "unrealistic_duration", problem: `the script is estimated at ${estimate_s}s; the limit is ${max_s}s`, fix: "Narrow the story. Do not speed the voice up." });
  if (estimate_s < min_s) out.push({ severity: "major", category: "unrealistic_duration", problem: `the script is estimated at ${estimate_s}s; the minimum is ${min_s}s`, fix: "Add a beat that serves the question." });
  if (narration_s != null) {
    const drift = Math.abs(narration_s - estimate_s) / estimate_s;
    if (drift > tolerance) out.push({ severity: "major", category: "unrealistic_duration", problem: `measured narration is ${narration_s}s against an estimate of ${estimate_s}s (${Math.round(drift * 100)}% apart)`, fix: "Re-measure the voice's words per minute." });
    if (narration_s > max_s) out.push({ severity: "critical", category: "unrealistic_duration", problem: `narration runs ${narration_s}s; the limit is ${max_s}s`, fix: "Narrow the story." });
  }
  if (mp4_s != null) {
    if (mp4_s > max_s + 1) out.push({ severity: "critical", category: "unrealistic_duration", problem: `the MP4 runs ${mp4_s}s; the limit is ${max_s}s`, fix: "Cut the story, not the speed." });
    if (narration_s != null && Math.abs(mp4_s - narration_s) > 1.5) out.push({ severity: "major", category: "unrealistic_duration", problem: `the MP4 (${mp4_s}s) and the narration (${narration_s}s) differ by more than 1.5s`, fix: "Scene timings must follow the narration." });
  }
  return out;
}
