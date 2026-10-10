/**
 * The video covers the whole voiceover file.
 *
 * The beats are cut from the subtitle cues, so the last one ends at the LAST WORD. The voiceover file runs on past it (0.4-2 s of breath and
 * decay: `[tts] ... mp3 tail after last word 2.03s`), so every video ended before its audio and the render gate (video vs voiceover, max 1 s)
 * failed the ones with the longest tail (board 38044082797 ch 9 drifted 1.95 s; 38047691386 ch 5 1.97 s). Trimming silence off the file did
 * not help — the tail is not digital silence. The last beat is held to the end of the audio instead, so the two always end together.
 *
 *   beats        [{ start_frame, duration_frames, ... }] in order (mutated)
 *   audioFrames  the voiceover file's length in frames
 * Returns the number of frames added (0 when the beats already reach the audio).
 */
export function coverAudio(beats, audioFrames) {
  if (!Array.isArray(beats) || !beats.length || !Number.isFinite(audioFrames) || audioFrames <= 0) return 0;
  const last = beats[beats.length - 1];
  const end = last.start_frame + last.duration_frames;
  if (end >= audioFrames) return 0;
  last.duration_frames += audioFrames - end;
  return audioFrames - end;
}
