// Rival Lines long-form, rebuild v3 (16 Nov 2026): the same data-checked narration as v2 ("How To Analyse a Football Match (Using the Euro 2024 Final)"),
// re-cut so it LOOKS like the reference (Football Made Simple, gpgYLJrPP2M; its frame spread is mostly green: real pitch footage, bright boards on grass, a few stat panels):
//   * ~35 % real stock footage (Pixabay Content License, spec data/clone/media/rival-lines-analyse-v3.json). It is GENERIC football footage, never the Euro 2024 final:
//     every clip shows "Illustrative footage · Pixabay"; clips carry the general principles (the camera problem, off the ball), the boards carry this final's data.
//   * ~40 % boards on bright green grass (theme "rival-lines-v3" in config/longform-v2.json, colour never in code), big discs, thick lines, and PLAYERS on every board
//     (shot / pressure / substitution boards used to show an empty pitch: they now carry both starting elevens at their average on-ball positions).
//   * the rest: stat panels, text cards, real Commons photos.
// Shots are derived from v2's shot lists (same numbers, same narration); the rules are in the code below. Nothing here adds a fact.
import { EPISODE as V2, SOURCES as S2, _SIDES } from "./rival-lines-analyse-v2.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../../preview/lib.mjs";

export const SOURCES = { ...S2, PIX: { title: "Illustrative stock footage (not the match): Pixabay, Pixabay Content License", url: "https://pixabay.com/videos/", retrieved: "2026-11-16" } };
const spec = JSON.parse(readFileSync(join(ROOT, "data/clone/media/rival-lines-analyse-v3.json"), "utf8"));
const DROP = new Set(JSON.parse(process.env.V3_DROP || "[]").concat(["q-football-tactics"])); // clips looked at and rejected (not real football / off topic); see report
const CLIPS = spec.pixabay.filter((p) => !DROP.has(p.name)).map((p) => ({ name: p.name, dur: p.dur }));
const FOOT = "Illustrative footage · Pixabay";
let ci = 0;
const clip = (cap, w = 1, o = {}) => { const n = ci++, c = CLIPS[(n * 5) % CLIPS.length], second = Math.floor((n * 5) / CLIPS.length) % 2, start = second ? Math.min(4, c.dur - 3) : 0;
  return { type: "clip", video: `lf2/rival-lines/clips/rival-lines-analyse-v3/${c.name}.mp4`, videoLen: c.dur - start, start, captions: cap ? [{ from: 6, text: cap }] : [], credit: FOOT, from: n % 2 ? 1.12 : 1.02, to: n % 2 ? 1.02 : 1.12, pos: ["50% 50%", "30% 50%", "70% 50%"][n % 3], w, ...o }; };
const WPS = 2.4;
function beat(b, shots) {
  const L = b.vo.split(/\s+/).length / WPS + 0.55, T = shots.reduce((a, s) => a + (s.w || 1), 0);
  const out = shots.map((s) => { if (!s.win) return s; const [a, c] = s.win, { win, ...r } = s, len = (L * (s.w || 1)) / T; return { ...r, start: a, speed: Math.max(0.45, (c - a) / len), freezeAt: c }; });
  return { id: b.id, part: b.part, ref: b.ref, src: [...b.src, "PIX"], vo: b.vo, frames: [40, 220, 400], scene: { type: "montage", shots: out } };
}
const BOARD = new Set(["sequence", "formation", "network", "press", "shots", "sub"]);
const NUM = new Set(["stats", "bars", "number", "timeline", "lineup"]);
const textToCaption = (s) => s.lines.map((l) => l.replace(/^\*/, "")).join(" ").replace(/\s+/g, " ").trim();
const KEEP_NUM = new Set(["V03", "V04", "V06", "V10", "V16", "V17", "V18", "V21"]);
const KEEP_TEXT = new Set(["V01", "V14", "V19", "V20"]); // the "analyse this / write it down / your turn / what did you miss" cards stay cards
const beats = V2.beats.map((b) => {
  // recover the playback window v2 turned into start/freezeAt, so beat() re-times it for the new shot list
  const src = b.scene.shots.map((s) => { if (s.freezeAt == null) return s; const { start, speed, freezeAt, ...r } = s; return { ...r, win: [start, freezeAt] }; });
  const shots = []; let nums = 0;
  for (const s of src) {
    if (s.type === "text") { if (KEEP_TEXT.has(b.id) || shots.filter((x) => x.type === "text").length === 0 && b.id === "V21") shots.push(s); else shots.push(clip(textToCaption(s), s.w || 1)); continue; }
    if (NUM.has(s.type)) { if ((nums++ < 1 && KEEP_NUM.has(b.id)) || s.type === "timeline") shots.push(s); continue; }
    if (s.type === "scorecard") { shots.push(s); continue; }
    if (s.type === "press") { shots.push({ ...s, sides: [{ team: "England", players: _SIDES.ENG.players }] }); continue; }
    if (s.type === "shots" || s.type === "sub") { shots.push({ ...s, sides: [{ team: "Spain", players: _SIDES.SPA.players }, { team: "England", players: _SIDES.ENG.players, mirror: true }] }); continue; }
    shots.push(s);
  }
  // after every non-clip, non-text shot, a clip of real footage, until the footage share is reached (see report: measured mix)
  const withClips = []; let k = 0;
  for (const s of shots) { withClips.push(s); if (s.type !== "clip" && s.type !== "photo" && !KEEP_TEXT.has(b.id) && k++ % 2 === 1) withClips.push(clip(null, 1.25)); }
  return beat(b, withClips);
});

export const EPISODE = {
  channel: "rival-lines", slug: "rival-lines-analyse-v3", theme: "rival-lines-v3", title: V2.title, target_minutes: 8,
  sound: { bed: "MUSIC_DOC_WINTER", bed_rel_db: -22, dip_scenes: [] },
  beats,
  thumbs: V2.thumbs.map((t) => ({ ...t, name: "thumb1-analyse-v3" })),
};
