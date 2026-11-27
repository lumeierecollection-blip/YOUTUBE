// Builds the render props for a Rival Lines "realm" episode (The Football Realm look) from script.json, audio/timing.json,
// research/facts.json, images/images.json and config/channels.json.
// usage: node build-realm-plan.mjs <episode_dir>   -> <episode_dir>/out/props.json, copies images and audio into render/public/ep
// Colour comes only from config/channels.json ch-04.realm_colors (SCR-13); props.theme is a copy of it.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ep = path.resolve(process.argv[2]);
const repo = path.resolve(import.meta.dirname, "..", "..", "..");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const script = readJson(path.join(ep, "script.json"));
if (script.format !== "realm") throw new Error("script.json format is not realm");
const timing = readJson(path.join(ep, "audio", "timing.json"));
const imgs = readJson(path.join(ep, "images", "images.json"));
const channels = readJson(path.join(repo, "config", "channels.json"));
const ch = (channels.channels || channels).find((c) => c.channel_id === "ch-04");
if (!ch || !ch.realm_colors) throw new Error("ch-04.realm_colors not in config/channels.json");

const norm = (s) => String(s).toLowerCase().replace(/^[^a-z0-9.]+|[^a-z0-9]+$/g, "");
const warnings = [];

function resolveCue(words, token, after) {
  const t = norm(token);
  let idx = words.findIndex((w) => w.t0 >= after && norm(w.w) === t);
  if (idx < 0) idx = words.findIndex((w) => w.t0 >= after && norm(w.w).includes(t));
  if (idx < 0) idx = words.findIndex((w) => norm(w.w) === t || norm(w.w).includes(t));
  return idx < 0 ? null : words[idx].t0;
}

function resolveVisual(v, words, beatId) {
  const out = Array.isArray(v) ? [] : {};
  for (const [k, val] of Object.entries(v)) {
    if (k === "from" && typeof val === "string") {
      const t = resolveCue(words, val, 0);
      if (t == null) { warnings.push(`${beatId}: from "${val}" not found in narration`); out.at = 0; } else out.at = t;
    } else if (k === "cue" && typeof val === "string") {
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
    } else if (val && typeof val === "object") out[k] = resolveVisual(val, words, beatId);
    else out[k] = val;
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
  const words = tm.words.map((w) => ({ w: w.w, t0: w.t0 + (tm.t0 - t0), t1: w.t1 + (tm.t0 - t0) }));
  return { id: b.id, t0, t1, speechStart: tm.t0, accent: b.accent || [], words, visual: resolveVisual(b.visual, tm.words, b.id) };
});

const collect = (v, out) => {
  if (Array.isArray(v)) v.forEach((x) => collect(x, out));
  else if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v)) {
      if (k === "img" && typeof val === "string") out.add(val);
      else if (k === "imgs" && Array.isArray(val)) val.forEach((x) => out.add(x));
      else collect(val, out);
    }
  }
  return out;
};
const usedImgs = new Set();
scenes.forEach((s) => collect(s.visual, usedImgs));
const thumbPath = path.join(ep, "thumbnails.json");
if (fs.existsSync(thumbPath)) readJson(thumbPath).variants.forEach((v) => collect(v, usedImgs));

const images = {};
for (const im of imgs.images) {
  const author = String(im.author || "").replace(/^Original:\s*/i, "").replace(/\s+/g, " ").trim();
  images[im.id] = { file: `ep/images/${im.file}`, w: im.w, h: im.h, author, license: im.license, page: im.page, credit: `${author}, ${im.license}, Wikimedia Commons` };
}
for (const id of usedImgs) if (!images[id]) throw new Error(`image ${id} not in images.json`);

const pub = path.join(repo, "channels", "rival-lines", "render", "public", "ep");
fs.rmSync(pub, { recursive: true, force: true });
fs.mkdirSync(path.join(pub, "images"), { recursive: true });
fs.cpSync(path.join(ep, "images"), path.join(pub, "images"), { recursive: true, filter: (s) => !s.endsWith(".json") && !s.endsWith("contact.jpg") });
const footage = {};
const fpath = path.join(ep, "footage", "footage.json");
if (fs.existsSync(fpath)) {
  const used = new Set();
  const grab = (v) => { if (Array.isArray(v)) v.forEach(grab); else if (v && typeof v === "object") for (const [k, val] of Object.entries(v)) { if (k === "shots" && Array.isArray(val)) val.forEach((x) => used.add(x)); else grab(val); } };
  scenes.forEach((s) => grab(s.visual));
  const fdir = path.join(ep, "footage");
  const clips = readJson(fpath).clips.filter((c) => used.has(c.id));
  if (clips.some((c) => !fs.existsSync(path.join(fdir, c.file)))) {
    if (!process.env.CLIP_KEY) throw new Error("clips are encrypted in the repo and CLIP_KEY is not set");
    execFileSync(process.execPath, [path.join(import.meta.dirname, "footage-crypt.mjs"), "dec", fdir], { stdio: "inherit" });
  }
  fs.mkdirSync(path.join(pub, "footage"), { recursive: true });
  for (const c of clips) {
    fs.copyFileSync(path.join(fdir, c.file), path.join(pub, "footage", c.file));
    footage[c.id] = { file: `ep/footage/${c.file}`, w: c.w, h: c.h, dur: c.dur, owner: c.owner, url: c.url, upload_date: c.upload_date, video_title: c.video_title, lower_name: c.lower_name, lower_sub: c.lower_sub };
  }
  for (const id of used) if (!footage[id]) throw new Error(`clip ${id} not in footage.json`);
}
const mixFile = path.join(ep, "out", "mix.mp3");
const hasMix = fs.existsSync(mixFile);
fs.copyFileSync(path.join(ep, "audio", "narration.mp3"), path.join(pub, "narration.mp3"));
if (hasMix) fs.copyFileSync(mixFile, path.join(pub, "mix.mp3"));

const theme = { ...ch.realm_colors, font: ch.font };
delete theme.realm_note;
const props = { format: "realm", theme, durationSec: end, fps: 30, audioSrc: hasMix ? "ep/mix.mp3" : "ep/narration.mp3", scenes, images, footage };
fs.mkdirSync(path.join(ep, "out"), { recursive: true });
fs.writeFileSync(path.join(ep, "out", "props.json"), JSON.stringify(props));
console.log(`realm plan: ${scenes.length} scenes, ${end.toFixed(1)}s, ${usedImgs.size} photos, ${Object.keys(footage).length} clips, audio ${hasMix ? "mix.mp3" : "narration only"}`);
if (warnings.length) { console.log("CUE WARNINGS:\n" + warnings.join("\n")); process.exitCode = process.env.STRICT_CUES ? 1 : 0; }
