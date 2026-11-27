// Builds the render props for a Rival Lines episode from script.json, audio/timing.json, research/*.json and config/channels.json.
// usage: node build-plan.mjs <episode_dir>   -> <episode_dir>/out/props.json, and copies images and audio into render/public/ep
// Colour comes only from config/channels.json (SCR-13): the theme in props is a copy of that file's ch-04 colours.
import fs from "node:fs";
import path from "node:path";

const ep = path.resolve(process.argv[2]);
const repo = path.resolve(import.meta.dirname, "..", "..", "..");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const script = readJson(path.join(ep, "script.json"));
const timing = readJson(path.join(ep, "audio", "timing.json"));
const model = readJson(path.join(ep, "research", "model.json"));
const wiki = readJson(path.join(ep, "research", "wikipedia-stats.json"));
const imgs = readJson(path.join(ep, "images", "images.json"));
const channels = readJson(path.join(repo, "config", "channels.json"));
const ch = (channels.channels || channels).find((c) => c.channel_id === "ch-04");
if (!ch) throw new Error("ch-04 not in config/channels.json");

const norm = (s) => String(s).toLowerCase().replace(/^[^a-z0-9.]+|[^a-z0-9]+$/g, "");
const warnings = [];

function resolveCue(words, token, after) {
  const t = norm(token);
  let idx = words.findIndex((w, i) => w.t0 >= after && norm(w.w) === t);
  if (idx < 0) idx = words.findIndex((w, i) => w.t0 >= after && norm(w.w).includes(t));
  if (idx < 0) idx = words.findIndex((w) => norm(w.w) === t || norm(w.w).includes(t));
  if (idx < 0) return null;
  return words[idx].t0;
}

function resolveVisual(v, words, beatId) {
  let last = 0;
  const out = Array.isArray(v) ? [] : {};
  for (const [k, val] of Object.entries(v)) {
    if (k === "cue" && typeof val === "string") {
      const t = resolveCue(words, val, 0);
      if (t == null) { warnings.push(`${beatId}: cue "${val}" not found in narration`); out[k] = 0.4; } else out[k] = t;
    } else if (k === "cues" && Array.isArray(val)) {
      let after = 0;
      out[k] = val.map((tok) => {
        const t = resolveCue(words, tok, after);
        if (t == null) { warnings.push(`${beatId}: cue "${tok}" not found in narration`); return after + 0.4; }
        after = t + 0.01;
        return t;
      });
    } else if (val && typeof val === "object") {
      out[k] = resolveVisual(val, words, beatId);
    } else out[k] = val;
  }
  return out;
}

const byId = Object.fromEntries(timing.beats.map((b) => [b.id, b]));
const end = timing.duration + 1.2;
const scenes = script.beats.map((b, i) => {
  const tm = byId[b.id];
  if (!tm) throw new Error(`no timing for ${b.id}`);
  const next = timing.beats[i + 1];
  const t0 = i === 0 ? 0 : tm.t0;
  const t1 = next ? next.t0 : end;
  const words = tm.words.map((w) => ({ ...w, t0: w.t0, t1: w.t1 }));
  return { id: b.id, chapter: b.chapter || null, t0, t1, speechStart: tm.t0, visual: resolveVisual(b.visual, words, b.id) };
});

const usedImgs = new Set();
scenes.forEach((s) => { if (s.visual.img) usedImgs.add(s.visual.img); (s.visual.imgs || []).forEach((x) => usedImgs.add(x)); });
const images = {};
for (const im of imgs.images) {
  const author = String(im.author || "").replace(/^Original:\s*/i, "").replace(/\s+/g, " ").trim();
  images[im.id] = { file: `ep/images/${im.file}`, w: im.w, h: im.h, author, license: im.license, page: im.page, credit: `${author}, ${im.license}, Wikimedia Commons` };
}
for (const id of usedImgs) if (!images[id]) throw new Error(`image ${id} not in images.json`);

const pub = path.join(repo, "channels", "rival-lines", "render", "public", "ep");
fs.rmSync(pub, { recursive: true, force: true });
fs.mkdirSync(path.join(pub, "images"), { recursive: true });
for (const f of fs.readdirSync(path.join(ep, "images"))) if (!f.endsWith(".json")) fs.copyFileSync(path.join(ep, "images", f), path.join(pub, "images", f));
fs.copyFileSync(path.join(ep, "audio", "narration.mp3"), path.join(pub, "narration.mp3"));

const c = ch.colors;
const theme = { paper: c.paper, ink: c.ink, accent: c.accent, accent2: c.accent2, highlight: c.highlight, muted: c.muted, grid: c.grid, font: ch.font };
const data = {
  as_of: model.as_of,
  by_season: model.by_season,
  results: model.results,
  baseline: model.baseline,
  assumptions: model.assumptions,
  per_match_needed: model.per_match_needed,
  matches_needed_at_club_rate: model.matches_needed_at_club_rate,
  totals: { club: wiki.club_total, portugal: wiki.portugal_total, official_goals: wiki.official_goals, official_apps: wiki.official_apps }
};
const props = { theme, durationSec: end, fps: 30, audioSrc: "ep/narration.mp3", scenes, images, data };
fs.mkdirSync(path.join(ep, "out"), { recursive: true });
fs.writeFileSync(path.join(ep, "out", "props.json"), JSON.stringify(props));
console.log(`plan: ${scenes.length} scenes, ${end.toFixed(1)}s, ${usedImgs.size} photos`);
if (warnings.length) { console.log("CUE WARNINGS:\n" + warnings.join("\n")); process.exitCode = process.env.STRICT_CUES ? 1 : 0; }
