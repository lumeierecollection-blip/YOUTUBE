/**
 * Kalimba bed pool + deterministic per-video selection.
 *
 * PURE .js, no React/JSX, so render.js (plain node) can pick and LOG the
 * track, and audio-mix.js (inside the Remotion bundle) can play it. The
 * bundle cannot list a directory, so the pool is this array — keep it in
 * step with public/music/kalimba/ and its CREDITS.md.
 *
 * Rule: index = hash(channel + script) % track_count. Same channel + same
 * script -> same track on every re-render; different scripts rotate.
 */

export const KALIMBA_TRACKS = [
  "kalimba-01.mp3",
  "kalimba-02.mp3",
  "kalimba-03.mp3",
  "kalimba-04.mp3",
];

// FNV-1a, 32-bit. Stable across node versions and platforms (no Math.random,
// no crypto dependency inside the bundle).
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * @param {string|number} channelId
 * @param {string} scriptName  script filename (basename, e.g. "foo-shorts-script.json")
 * @returns {{ index: number, name: string, file: string, count: number }}
 *   `file` is relative to the Remotion public dir, for staticFile().
 */
export function pickKalimbaTrack(channelId, scriptName) {
  const count = KALIMBA_TRACKS.length;
  const index = fnv1a(`${channelId}:${scriptName}`) % count;
  const name = KALIMBA_TRACKS[index];
  return { index, name, file: `music/kalimba/${name}`, count };
}
