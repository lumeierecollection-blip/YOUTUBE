/**
 * silence-match — which silences in the RENDERED VIDEO are real dropouts, and which are the narration's own pauses?
 *
 * A silence in the video is legitimate when it lies inside a pause in the voiceover. Two facts made the old test fail on a clean video:
 *
 *   1. The two files are not on one clock. Measured on board 38742395747 ch-6, every video pause sits 0.088 s after the voiceover pause that
 *      causes it (8.904 vs 8.815, 10.170 vs 10.082, 17.061 vs 16.973 ...), a constant. The slack allowed was 0.3 s at the END of a pause.
 *   2. The voiceover opens with a quiet lead-in (~0.47 s) that silencedetect at d=0.5 never reports, and the video's is 0.088 s longer, which
 *      tips it over 0.5 s and it is reported with NO voiceover pause to match. The kalimba bed used to fill the video's lead-in and its pauses,
 *      so none of this showed; with no bed under a grave or serious story (src/utils/video-tone.js) it showed as "unmatched silence" on ch-6.
 *
 * So: (a) the voiceover is scanned for pauses down to 0.2 s, so its lead-in is on the list; (b) the constant clock offset is ESTIMATED from the
 * pauses that do line up (the median of their start differences) and the video's spans are put on the voiceover's clock before matching.
 * Containment is still required and the tolerances are unchanged: a dropout while the narration is SPEAKING lies inside no pause and still fails.
 */
export const START_TOL = 0.4;     // s: mux/encode offset between the two
export const EXTRA_TOL = 0.3;     // s: how much longer than the source pause is still the same pause
export const MAX_OFFSET = 0.5;    // s: a clock offset larger than this is a fault, not a pad, and is not corrected for
export const SRC_MIN_PAUSE = 0.2; // s: the voiceover is scanned for pauses this short (silencedetect d=)
export const VID_MIN_PAUSE = 0.5; // s: a video silence shorter than this is not judged

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };

/** The constant by which the video's clock runs ahead of the voiceover's: the median start difference over the pauses that line up. 0 when none do. */
export function clockOffset(vidSpans, srcSpans) {
  const diffs = [];
  for (const v of vidSpans || []) {
    if (v.start < 0.05 || v.duration < VID_MIN_PAUSE) continue;      // the lead-in is the thing being explained, not evidence
    let best = null;
    for (const s of srcSpans || []) { const d = v.start - s.start; if (best === null || Math.abs(d) < Math.abs(best)) best = d; }
    if (best !== null && Math.abs(best) <= MAX_OFFSET) diffs.push(best);
  }
  return Math.min(MAX_OFFSET, Math.max(-MAX_OFFSET, median(diffs)));
}

/** The video silences (longer than VID_MIN_PAUSE, before the voiceover ends) that lie inside no voiceover pause once on the voiceover's clock. */
export function unmatchedSilences(vidSpans, srcSpans, audioDuration) {
  const offset = clockOffset(vidSpans, srcSpans);
  return (vidSpans || []).filter((g) => {
    if (g.start >= audioDuration - 0.1 || g.duration <= VID_MIN_PAUSE) return false;
    const start = Math.max(0, g.start - offset), end = g.end - offset;
    return !(srcSpans || []).some((s) => start >= s.start - START_TOL && end <= s.end + EXTRA_TOL);
  });
}
