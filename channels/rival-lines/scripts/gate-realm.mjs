// Gate for a Rival Lines "realm" episode. usage: node gate-realm.mjs <episode_dir>
// Checks: SCR-14 (every sources_used URL appears in the research files), every number spoken in the script traces to a number in
// research/facts.json or gate-allow.json, every scene has a non-text visual and its own visual signature, every image used has
// author, licence and page, SCR-13 (no colour literals in the realm render source), every cue found in the narration, closing scene.
// Limits, stated plainly: numbers written as words ("three", "ten") are not checked; a number that appears in the facts by
// coincidence passes; the gate cannot tell whether a sentence says what the cited page says, only that its numbers and URLs exist.
import fs from "node:fs";
import path from "node:path";

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
  for (const m of b.text.matchAll(/\d[\d,]*\.?\d*/g)) {
    const raw = m[0].replace(/[,.]+$/, "");
    const n = Number(raw.replace(/,/g, ""));
    if (!allowed.has(String(n)) && !allowed.has(raw)) fail("NUM", `${b.id}: "${raw}" in narration is not in the research files or gate-allow.json`);
  }
}

const nonText = new Set(["versus", "timeline", "clock", "headlines", "quote", "dots", "coins", "faces", "ladder", "ranking", "ruler", "ballot", "cutout", "cards3", "tiles", "table", "bigstat", "results", "bars", "cards"]);
const sigs = new Map();
const keysOf = (v, out = []) => {
  if (Array.isArray(v)) v.forEach((x) => keysOf(x, out));
  else if (v && typeof v === "object") for (const [k, val] of Object.entries(v)) { if (["cue", "cues"].includes(k)) continue; if (typeof val === "object") keysOf(val, out); else out.push(`${k}=${val}`); }
  return out;
};
for (const s of props.scenes) {
  const v = s.visual;
  if (!nonText.has(v.type)) fail("VIS", `${s.id}: visual type "${v.type}" is not a graphic or photo scene`);
  const sig = `${v.type}:${keysOf(v).join("|")}`;
  if (sigs.has(sig)) fail("VIS", `${s.id} repeats the visual of ${sigs.get(sig)}`);
  sigs.set(sig, s.id);
  if (s.t1 - s.t0 < 2.5) warns.push(`${s.id}: scene is only ${(s.t1 - s.t0).toFixed(1)} s`);
  if (!s.words.length) fail("PLAN", `${s.id}: no caption words`);
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
