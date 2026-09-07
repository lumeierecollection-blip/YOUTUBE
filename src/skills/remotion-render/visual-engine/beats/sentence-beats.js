/**
 * THE RHYTHM — sentence, then the thing the sentence was about.
 *
 * Section 4.7, in order: the sentence types out word by word as it is spoken;
 * it clears; the visual for that sentence takes the screen; it clears; the next
 * sentence begins. Two beats per sentence, one owner each, nothing shared.
 *
 * WORD TIMINGS ARE DERIVED, NOT MEASURED, AND THAT IS A REAL LIMITATION.
 * The spec asks for word timings from the script. This repo's SRT is cue-level:
 * one whole sentence per cue with a start and an end, no per-word marks. So
 * each word's moment is estimated by distributing the cue across the words,
 * weighted by length with an extra beat after punctuation, because longer words
 * take longer to say and a comma is a pause. On the fixture that puts words
 * within roughly a tenth of a second of the speech, which is close enough to
 * read as synchronised and is not the same as being synchronised. A TTS engine
 * that emits word marks would replace `wordTimings` and nothing else.
 *
 * THE VISUAL TAKES THE TAIL OF THE CUE, WHICH IS A COMPROMISE WORTH NAMING.
 * The spec has the visual appear after the sentence ends. These cues run
 * back to back with no gap, so a visual placed after the last word would play
 * over the next sentence's audio. It takes the last third of the cue instead:
 * by then every word is on screen and the sentence has been read.
 */

/** Of each cue, how much belongs to the words and how much to the visual. */
const TYPE_SHARE = 0.64;
/** A visual shorter than this cannot register, so a very short cue stays type. */
const MIN_VISUAL_FRAMES = 26;

/**
 * When each word lands, as a fraction of the cue.
 *
 * Weighted by character count, with a pause added after a comma, colon or full
 * stop. A flat division put short words too late and long words too early.
 */
export function wordTimings(text, durationFrames) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const weights = words.map((w) => w.replace(/[^A-Za-z0-9]/g, "").length + 2 + (/[,:;.!?]$/.test(w) ? 4 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return words.map((w, i) => {
    const at = acc / total;
    acc += weights[i];
    return { word: w, at, frame: Math.round(at * durationFrames) };
  });
}

/**
 * @param {Array}  cues     [{ startFrame, durationInFrames, text }]
 * @param {Function} pick   (sentence) => asset name or null
 * @returns {{beats: Array, warnings: string[]}}
 */
export function buildSentenceBeats(cues, pick) {
  const beats = [];
  const warnings = [];

  cues.forEach((cue, i) => {
    const dur = cue.durationInFrames;
    const text = (cue.text || "").trim();
    if (!text) return;

    const asset = pick(text);
    const visualFrames = Math.round(dur * (1 - TYPE_SHARE));
    const canShowVisual = asset && visualFrames >= MIN_VISUAL_FRAMES;
    if (asset && !canShowVisual) warnings.push(`cue ${i}: only ${visualFrames}f left for a visual, kept as type`);
    if (!asset) warnings.push(`cue ${i}: no asset above threshold — run scripts/expand-assets.mjs`);

    const typeFrames = canShowVisual ? dur - visualFrames : dur;

    beats.push({
      beat_id: `s${i}t`,
      mode: "TYPE",
      focal: text,
      start_frame: cue.startFrame,
      duration_frames: typeFrames,
      sentence: text,
      words: wordTimings(text, typeFrames),
      transitionIn: i === 0 ? "CUT" : "CLEAR",
      transitionOut: canShowVisual ? "MORPH" : "CLEAR",
    });

    if (canShowVisual) {
      beats.push({
        beat_id: `s${i}v`,
        mode: "VISUAL",
        focal: asset,
        start_frame: cue.startFrame + typeFrames,
        duration_frames: visualFrames,
        sentence: text,
        words: [],
        transitionIn: "MORPH",
        transitionOut: "CLEAR",
      });
    }
  });

  return { beats, warnings };
}
