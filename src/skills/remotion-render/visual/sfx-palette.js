/**
 * SFX palette events — world.txt Part 3.2.
 *
 * Generates SFX events from beats based on their archetype and position.
 *
 * | Effect       | Fires on                           | Volume |
 * |--------------|------------------------------------|--------|
 * | whoosh       | Every transition between beats     | −14 dB |
 * | impact       | HOOK beat landing                  | −10 dB |
 * | tick         | Each word in TYPE beat (numbers)   | −18 dB |
 * | reveal       | VISUAL beat onset                  | −12 dB |
 * | number-count | QUANTIFY beat where number animates| −16 dB |
 *
 * USAGE:
 *   import { generateSfxPalette } from "./sfx-palette.js";
 *   const events = generateSfxPalette(beats, { fps: 30 });
 */

/**
 * Generate SFX palette events from beats.
 *
 * @param {Array} beats - Beat objects with archetype, startFrame, durationInFrames
 * @param {Object} opts
 * @param {number} opts.fps - Frames per second
 * @returns {Array<{role: string, atFrame: number, reason: string}>}
 */
export function generateSfxPalette(beats, { fps = 30 } = {}) {
  if (!beats || !beats.length) return [];

  const events = [];

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const prev = i > 0 ? beats[i - 1] : null;

    // 1. WHOOSH — every transition between beats
    if (prev) {
      events.push({
        role: "whoosh",
        atFrame: beat.startFrame,
        reason: `transition from beat ${i - 1} to ${i}`,
      });
    }

    // 2. IMPACT — HOOK beat landing (first beat)
    if (i === 0) {
      events.push({
        role: "impact",
        atFrame: beat.startFrame,
        reason: "hook beat landing",
      });
    }

    // 3. TICK — each word in TYPE beat (only if beat contains a number)
    if (
      (beat.archetype === "HERO_NUMBER" || beat.archetype === "PROGRESS") &&
      beat.tokens &&
      beat.tokens.length > 0
    ) {
      // Fire a tick for each word token
      for (let t = 0; t < beat.tokens.length; t++) {
        const token = beat.tokens[t];
        const tokenFrame = Math.round((token.fromMs / 1000) * fps);
        events.push({
          role: "tick",
          atFrame: beat.startFrame + tokenFrame,
          reason: `word landing in number beat ${i}`,
        });
      }
    }

    // 4. REVEAL — VISUAL beat onset (IMAGE_BEAT)
    if (beat.archetype === "IMAGE_BEAT") {
      events.push({
        role: "reveal",
        atFrame: beat.startFrame,
        reason: "visual beat onset",
      });
    }

    // 5. NUMBER-COUNT — HERO_NUMBER/QUANTIFY beat where number animates
    if (beat.archetype === "HERO_NUMBER" && beat.data && beat.data.value != null) {
      events.push({
        role: "number-count",
        atFrame: beat.startFrame,
        reason: `number ${beat.data.value} animating`,
      });
    }
  }

  // Deduplicate (same frame, same role)
  const seen = new Set();
  return events.filter((e) => {
    const key = `${e.role}:${e.atFrame}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
