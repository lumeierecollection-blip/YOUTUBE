/**
 * Audio mix — kalimba bed + SFX palette integration.
 *
 * This module extends the existing sound-design.js with:
 *   1. A kalimba background bed that runs under the entire video
 *   2. A fixed SFX palette (whoosh/impact/tick/reveal/number-count)
 *
 * The existing sound-design.js handles visual-state-driven SFX scheduling.
 * This module adds the kalimba layer and the world.txt SFX palette.
 *
 * USAGE:
 *   import { KalimbaBed, SfxPalette } from "./audio-mix.js";
 *
 *   // In motion-graphics.jsx:
 *   <KalimbaBed totalFrames={totalFrames} fps={fps} />
 *   <SfxPalette events={beatSfxEvents} />
 */

import { Audio, Sequence, staticFile } from "remotion";

/**
 * Convert dBFS to linear volume for Remotion's <Audio volume={...} />.
 * 0 dB = 1.0, -6 dB ≈ 0.5, -20 dB = 0.1, etc.
 */
function dbToVolume(db) {
  return Math.pow(10, db / 20);
}

// Per-video rotation: render.js calls pickKalimbaTrack(channel, script)
// and passes `src`. Re-exported so callers import one audio module.
export { KALIMBA_TRACKS, pickKalimbaTrack } from "./kalimba-pool.js";

/**
 * Kalimba background bed.
 *
 * Plays ONE track from the rotation pool (public/music/kalimba/, chosen by
 * pickKalimbaTrack) under the entire video at −24 dB below full scale —
 * the tracks are loudness-normalised to −16 LUFS so that gain means the
 * same thing on every track. Fades in over the first 15 frames and out
 * over the last 15. Loops if the video outlasts the track.
 * (No ducking under SFX — an earlier comment here claimed it; the code
 * never did it.)
 *
 * @param {Object} opts
 * @param {number} opts.totalFrames - Total video frames
 * @param {number} opts.fps - Frames per second
 * @param {string} [opts.src] - staticFile path from pickKalimbaTrack().file.
 *   Omitted only by the legacy MotionGraphics path, which keeps its old
 *   single bed (audio/kalimba.mp3 — no recorded source/license).
 * @param {number} [opts.volumeDb=-24] - Target volume in dBFS
 * @param {boolean} [opts.hasUnderscore=true] - Whether to play kalimba
 */
export function KalimbaBed({ totalFrames, fps, src, volumeDb = -24, hasUnderscore = true }) {
  if (!hasUnderscore) return null;

  const fadeInFrames = 15;
  const fadeOutFrames = 15;

  return (
    <Audio
      src={staticFile(src || "audio/kalimba.mp3")}
      volume={(f) => {
        // Fade in
        if (f < fadeInFrames) {
          return dbToVolume(volumeDb) * (f / fadeInFrames);
        }
        // Fade out
        if (f > totalFrames - fadeOutFrames) {
          return dbToVolume(volumeDb) * ((totalFrames - f) / fadeOutFrames);
        }
        // Normal volume
        return dbToVolume(volumeDb);
      }}
      loop
    />
  );
}

/**
 * SFX palette — four files, fired only by semantic triggers.
 *
 * DirectedShorts passes events from sound-design.js semanticSfxEvents():
 *   {trigger, file, db, atFrame}   file relative to sfx/ in the Remotion
 *   public dir (impact.mp3, reveal.mp3, number-count.mp3, whoosh.mp3).
 *
 * The table this replaced fired a whoosh on EVERY transition, a reveal on
 * every visual beat and a tick per word, pointing at audio/sfx/*.wav files
 * that did not exist. Legacy callers that still pass {role} (the
 * MotionGraphics path via sfx-palette.js) are mapped onto the same four
 * files at the trigger-table volumes; "tick" has no file and is dropped.
 *
 * @param {Object} opts
 * @param {Array} opts.events - [{file, db, atFrame, trigger}] or legacy [{role, atFrame}]
 */
const LEGACY_ROLE = {
  impact:         { file: "impact.mp3",       db: -10 },
  reveal:         { file: "reveal.mp3",       db: -12 },
  "number-count": { file: "number-count.mp3", db: -16 },
  whoosh:         { file: "whoosh.mp3",       db: -14 },
};

export function SfxPalette({ events = [] }) {
  return events.map((event, i) => {
    const spec = event.file ? event : LEGACY_ROLE[event.role];
    if (!spec) {
      console.warn(`[audio-mix] no SFX file for role "${event.role}" — not played`);
      return null;
    }
    const tag = event.trigger || event.role;
    return (
      <Sequence key={`sfx-${tag}-${i}`} from={event.atFrame} layout="none" name={`sfx:${tag}`}>
        <Audio src={staticFile(`sfx/${spec.file}`)} volume={dbToVolume(spec.db)} />
      </Sequence>
    );
  });
}
