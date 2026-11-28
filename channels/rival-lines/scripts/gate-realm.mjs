// Gate for a Rival Lines "realm" episode. usage: node gate-realm.mjs <episode_dir>
// Checks: SCR-14 (every sources_used URL appears in the research files), every number spoken in the script traces to a number in
// research/facts.json or gate-allow.json, every scene has a non-text visual and its own visual signature, every image and clip used has
// author, licence and page (photos) or owner, url, date, length and no sound track (clips), SCR-13 (no colour literals in the realm render source), every cue found in the narration, closing scene.
// Limits, stated plainly: numbers written as words ("three", "ten") are not checked; a number that appears in the facts by
// coincidence passes; the gate cannot tell whether a sentence says what the cited page says, only that its numbers and URLs exist.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ep = path.resolve(process.argv[2]);
const repo = path.resolve(import.meta.dirname, "..", "..", "..");
const rj = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const script = rj(path.join(ep, "script.json"));
const props = rj(path.join(ep, "out", "props.json"));
const resDir = path.join(ep, "research");
const fails = [];
const warns = [];
const fail = (id, msg) => fails.push(`${id}: ${msg}`);

const resFiles = fs.readdirSync(resDir).filter((f) => f.endsWith(".json"));
const resText = resFiles.map((f) => fs.readFileSync(path.join(resDir, f), "utf8")).join("\n");
for (const u of script.sources_used) if (!resText.includes(u)) fail("SCR-14", `sources_used url not in research files: ${u}`);
if (!script.sources_used.length) fail("SCR-14", "no sources_used");

const allowed = new Set();
const add = (n) => {
  if (!Number.isFinite(n)) return;
  for (const d of [0, 1, 2]) allowed.add(String(Number(n.toFixed(d))));
};
const walk = (x) => {
  if (typeof x === "number") add(x);
  else if (typeof x === "string") for (const m of x.matchAll(/\d[\d,]*\.?\d*/g)) add(Number(m[0].replace(/,/g, "")));
  else if (Array.isArray(x)) x.forEach(walk);
  else if (x && typeof x === "object") Object.values(x).forEach(walk);
};
resFiles.forEach((f) => walk(rj(path.join(resDir, f))));
const allowPath = path.join(ep, "gate-allow.json");
if (fs.existsSync(allowPath)) for (const k of Object.keys(rj(allowPath))) allowed.add(k);
for (const b of script.beats) {
  for (const m of (b.text || "").matchAll(/\d[\d,]*\.?\d*/g)) {
    const raw = m[0].replace(/[,.]+$/, "");
    const n = Number(raw.replace(/,/g, ""));
    if (!allowed.has(String(n)) && !allowed.has(raw)) fail("NUM", `${b.id}: "${raw}" in narration is not in the research files or gate-allow.json`);
  }
}

const nonText = new Set(["clip", "circle", "strip", "trio", "seq", "quote", "score", "plain"]);
const sigs = new Map();
const keysOf = (v, out = []) => {
  if (Array.isArray(v)) v.forEach((x) => keysOf(x, out));
  else if (v && typeof v === "object") for (const [k, val] of Object.entries(v)) { if (["cue", "cues"].includes(k)) continue; if (typeof val === "object") keysOf(val, out); else out.push(`${k}=${val}`); }
  return out;
};
for (const s of props.scenes) {
  const v = s.visual;
  if (!nonText.has(v.type)) fail("VIS", `${s.id}: visual type "${v.type}" is not a footage or photo scene`);
  if (v.type === "seq") {
    if (!Array.isArray(v.parts) || v.parts.length < 2) fail("VIS", `${s.id}: seq needs at least two parts`);
    for (const p of v.parts || []) if (!nonText.has(p.type) || p.type === "seq") fail("VIS", `${s.id}: seq part type "${p.type}" is not a footage or photo scene`);
    const ats = (v.parts || []).map((p) => p.at).filter((x) => typeof x === "number");
    if (ats.some((x, i) => i && x <= ats[i - 1])) fail("VIS", `${s.id}: seq parts are not in narration order`);
  }
  if (v.type === "clip" && (!Array.isArray(v.shots) || !v.shots.length)) fail("VIS", `${s.id}: clip scene has no shots`);
  const sig = `${v.type}:${keysOf(v).join("|")}`;
  if (sigs.has(sig)) fail("VIS", `${s.id} repeats the visual of ${sigs.get(sig)}`);
  sigs.set(sig, s.id);
  if (s.t1 - s.t0 < 2.5) warns.push(`${s.id}: scene is only ${(s.t1 - s.t0).toFixed(1)} s`);
  if (!s.words.length && v.type !== "quote") fail("PLAN", `${s.id}: no caption words`);
  if (v.type === "quote" && !(props.footage || {})[v.clip]?.audio) fail("FTG", `${s.id}: quote scene clip ${v.clip} is not a sound clip`);
}
const consecutive = props.scenes.filter((s, i) => i && s.visual.type === props.scenes[i - 1].visual.type);
for (const s of consecutive) warns.push(`${s.id}: same visual type as the scene before (${s.visual.type})`);

const used = new Set();
const collect = (v) => {
  if (Array.isArray(v)) v.forEach(collect);
  else if (v && typeof v === "object") for (const [k, val] of Object.entries(v)) {
    if (k === "img" && typeof val === "string") used.add(val);
    else if (k === "imgs" && Array.isArray(val)) val.forEach((x) => used.add(x));
    else collect(val);
  }
};
props.scenes.forEach((s) => collect(s.visual));
const thumbPath = path.join(ep, "thumbnails.json");
if (fs.existsSync(thumbPath)) rj(thumbPath).variants.forEach(collect);
for (const id of used) {
  const im = props.images[id];
  if (!im) { fail("IMG", `${id} not in props.images`); continue; }
  if (!im.author || !im.license || !im.page) fail("IMG", `${id} lacks author, licence or page`);
  if (!fs.existsSync(path.join(repo, "channels", "rival-lines", "render", "public", im.file))) fail("IMG", `${id} file missing: ${im.file}`);
}

// Footage is third-party YouTube video used with commentary. The gate cannot judge fair use; it checks that every clip is short,
// attributed on screen, silent unless it is a short quote clip whose sound is the point (owner, dated) and traceable to its source URL.
const pubDir = path.join(repo, "channels", "rival-lines", "render", "public");
const hasFfprobe = spawnSync("ffprobe", ["-version"]).status === 0;
if (!hasFfprobe) warns.push("ffprobe not found: clips were not checked for an audio track");
for (const [id, c] of Object.entries(props.footage || {})) {
  if (!c.owner || !c.url || !c.upload_date || !c.video_title) fail("FTG", `clip ${id} lacks owner, url, upload_date or video_title`);
  if (!/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(c.url || "")) fail("FTG", `clip ${id} url is not a YouTube watch url: ${c.url}`);
  if (!c.lower_name || !/(19|20)\d\d/.test(c.lower_sub || "")) fail("FTG", `clip ${id} on-screen label lacks the owner or a dated line`);
  if (!(c.dur > 0 && c.dur <= 8)) fail("FTG", `clip ${id} is ${c.dur} s; the limit is 8 s`);
  const f = path.join(pubDir, c.file);
  if (!fs.existsSync(f)) { fail("FTG", `clip ${id} file missing: ${c.file}`); continue; }
  if (hasFfprobe) {
    const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", f], { encoding: "utf8" });
    if (r.stdout.trim() && !c.audio) fail("FTG", `clip ${id} still has an audio track`);
    if (c.audio) {
      if (!(c.dur <= 6)) fail("FTG", `quote clip ${id} is ${c.dur} s; the limit for a sound clip is 6 s`);
      if (!Array.isArray(c.words) || !c.words.length) fail("FTG", `quote clip ${id} has no word timings for its subtitles`);
    }
  }
}

const colour = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;
for (const f of ["src/RealmEpisode.tsx", "src/RealmThumb.tsx", "render.mjs"]) {
  const p = path.join(repo, "channels", "rival-lines", "render", f);
  if (!fs.existsSync(p)) { fail("SCR-13", `${f} missing`); continue; }
  fs.readFileSync(p, "utf8").split("\n").forEach((l, i) => { if (colour.test(l)) fail("SCR-13", `${f}:${i + 1} colour literal`); });
}

const last = props.scenes[props.scenes.length - 1];
if (Math.abs(last.t1 - props.durationSec) > 0.05) fail("PLAN", "last scene does not end at durationSec");

for (const w of warns) console.log("warn:", w);
if (fails.length) { console.log(fails.join("\n")); console.log(`gate: FAIL (${fails.length})`); process.exit(1); }
console.log(`gate: PASS (${props.scenes.length} scenes, ${used.size} photos, ${script.sources_used.length} sources)`);
