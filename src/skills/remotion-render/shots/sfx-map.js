/**
 * shots/sfx-map.js — a shot's free-text `sfx` cue ("paper tear", "whoosh", "heavy thud") -> one COMMITTED sound in
 * public/sfx (CC0 / credited in public/sfx/CREDITS.md), for the existing SfxPalette layer (visual/audio-mix.js).
 * A cue that matches nothing is NOT guessed: it is returned as null and recorded unmapped in <out>.sfx.json.
 * `file` is relative to public/sfx/ (what SfxPalette prefixes with "sfx/").
 */
const TABLE = [
  { re: /whip|whoosh|swish|rush|swoosh|sweep/, file: "transitions/mixkit-fast-whoosh.mp3", db: -16 },
  { re: /thud|slam|impact|drop|land|stamp|hit|boom/, file: "emphasis/impactWood_heavy_001.ogg", db: -12 },
  { re: /bell|toll|gong|sting/, file: "cinematic/impactBell_heavy_001.ogg", db: -16 },
  { re: /click|shutter|snap|switch/, file: "ui/click_002.ogg", db: -14 },
  { re: /tick|clock/, file: "interface-kenney/tick_002.wav", db: -14 },
  { re: /reveal|rise|swell/, file: "reveal.mp3", db: -16 },
  { re: /pop/, file: "pop.mp3", db: -16 },
  { re: /close|shut|seal|lock/, file: "transitions/close_001.ogg", db: -14 },
];

export function mapSfx(cue, transition = null) {
  const t = String(cue || "").toLowerCase();
  if (!t) return null;
  const hit = TABLE.find((r) => r.re.test(t));
  return hit ? { file: hit.file, db: hit.db } : null;
}
