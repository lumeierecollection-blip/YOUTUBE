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
 * Fixed SFX palette from world.txt.
 *
 * | Effect       | Fires on                           | Volume |
 * |--------------|------------------------------------|--------|
 * | whoosh       | Every transition between beats     | −14 dB |
 * | impact       | HOOK beat landing                  | −10 dB |
 * | tick         | Each word in TYPE beat (numbers)   | −18 dB |
 * | reveal       | VISUAL beat onset                  | −12 dB |
 * | number-count | QUANTIFY beat where number animates| −16 dB |
 *
 * @param {Object} opts
 * @param {Array} opts.events - [{role, atFrame, reason}]
 * @param {number} opts.fps - Frames per second
 */
export function SfxPalette({ events = [], fps }) {
  const VOLUME_DB = {
    whoosh: -14,
    impact: -10,
    tick: -18,
    reveal: -12,
    "number-count": -16,
  };

  const FILE_MAP = {
    whoosh: "audio/sfx/whoosh.wav",
    impact: "audio/sfx/impact.wav",
    tick: "audio/sfx/tick.wav",
    reveal: "audio/sfx/reveal.wav",
    "number-count": "audio/sfx/number-count.wav",
  };

  return events.map((event, i) => {
    const file = FILE_MAP[event.role];
    const volumeDb = VOLUME_DB[event.role] ?? -14;

    if (!file) {
      console.warn(`[audio-mix] Unknown SFX role: ${event.role}`);
      return null;
    }

    return (
      <Sequence
        key={`sfx-${event.role}-${i}`}
        from={event.atFrame}
        layout="none"
        name={`sfx:${event.role}`}
      >
        <Audio src={staticFile(file)} volume={dbToVolume(volumeDb)} />
      </Sequence>
    );
  });
}

/**
 * Check if required SFX files exist.
 * Returns {missing: string[]} — empty if all present.
 */
export function checkSfxFiles() {
  const required = [
    "audio/sfx/whoosh.wav",
    "audio/sfx/impact.wav",
    "audio/sfx/tick.wav",
    "audio/sfx/reveal.wav",
    "audio/sfx/number-count.wav",
    "audio/kalimba.mp3",
  ];

  // In Node.js (non-Remotion context), check file existence
  if (typeof window === "undefined") {
    const fs = require("node:fs");
    const path = require("node:path");
    const missing = required.filter((f) => {
      const fullPath = path.join(process.cwd(), "public", f);
      return !fs.existsSync(fullPath);
    });
    return { missing };
  }

  return { missing: [] };
}
