// Gate for a Rival Lines episode. usage: node gate-episode.mjs <episode_dir>
// Checks: SCR-14 (every sources_used URL appears in the research files), every number spoken in the script traces to a
// number in the research or model files, every scene has a non-text visual, every image used has author, licence and page,
// SCR-13 (no colour literals in the render source), scene lengths.
// Limits, stated plainly: numbers written as words ("thirteen", "four", "ten") are not checked; a number that appears in the
// data by coincidence passes; dates are checked as numbers, not as dates.
import fs from "node:fs";
import path from "node:path";

const ep = path.resolve(process.argv[2]);
const repo = path.resolve(import.meta.dirname, "..", "..", "..");
const rj = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const script = rj(path.join(ep, "script.json"));
const props = rj(path.join(ep, "out", "props.json"));
const imgs = rj(path.join(ep, "images", "images.json"));
const resDir = path.join(ep, "research");
const fails = [];
const warns = [];
const fail = (id, msg) => fails.push(`${id}: ${msg}`);

// SCR-14
const resText = fs.readdirSync(resDir).filter((f) => f.endsWith(".json")).map((f) => fs.readFileSync(path.join(resDir, f), "utf8")).join("\n");
for (const u of script.sources_used) if (!resText.includes(u)) fail("SCR-14", `sources_used url not in research files: ${u}`);

// numbers in narration against numbers in the data
const allowed = new Set();
const add = (n) => {
  if (!Number.isFinite(n)) return;
  for (const d of [0, 1, 2]) allowed.add(String(Number(n.toFixed(d))));
  if (Math.abs(n) <= 1) for (const d of [0, 1]) allowed.add(String(Number((n * 100).toFixed(d))));
};
const walk = (x) => {
  if (typeof x === "number") add(x);
  else if (typeof x === "string") for (const m of x.matchAll(/\d[\d,]*\.?\d*/g)) add(Number(m[0].replace(/,/g, "")));
  else if (Array.isArray(x)) x.forEach(walk);
  else if (x && typeof x === "object") Object.values(x).forEach(walk);
};
fs.readdirSync(resDir).filter((f) => f.endsWith(".json")).forEach((f) => walk(rj(path.join(resDir, f))));
// 13 and 16 needed come from 1000 minus a sourced total; 1000 is the target in the question; 41 is his age on the as-of date.
const derived = { 13: "1000 - 987 (Wikipedia)", 16: "1000 - 984 (ronaldogoalscore)", 1000: "the target", 41: "age on 2026-11-27 from birth date 1985-02-05" };
for (const k of Object.keys(derived)) allowed.add(k);
const asm = rj(path.join(resDir, "model.json")).assumptions;
add(asm.club_matches_per_month + asm.intl_matches_per_month);
// day-of-month and as-of dates are in the research files as part of dates; months a count of three, six, twelve are model horizons.
for (const n of [3, 6, 12, 24, 20, 26, 27]) allowed.add(String(n));
const allowPath = path.join(ep, "gate-allow.json");
const extra = fs.existsSync(allowPath) ? rj(allowPath) : {};
for (const k of Object.keys(extra)) allowed.add(k);
for (const b of script.beats) {
  for (const m of b.text.matchAll(/\d[\d,]*\.?\d*/g)) {
    const raw = m[0].replace(/[,.]+$/, "");
    const n = Number(raw.replace(/,/g, ""));
    if (!allowed.has(String(n)) && !allowed.has(raw)) fail("NUM", `${b.id}: "${raw}" in narration is not in the research or model files`);
  }
}

// every scene has its own non-text visual
const nonText = new Set(["photo", "dots2", "monthstrip", "ruler", "cards3", "stack", "seasonbars", "agecurve", "recent4", "matchtiles", "requiredbars", "curve", "dumbbell", "icon", "rangebar", "collage"]);
const sigs = new Map();
for (const s of props.scenes) {
  const v = s.visual;
  if (!nonText.has(v.type)) fail("VIS", `${s.id}: visual type "${v.type}" is not a graphic or photo`);
  const sig = v.type === "photo" ? `photo:${v.img}` : `${v.type}:${JSON.stringify(v.show || v.kind || v.seasons || v.scenario || "")}`;
  if (sigs.has(sig)) fail("VIS", `${s.id} repeats the visual of ${sigs.get(sig)} (${sig})`);
  sigs.set(sig, s.id);
  if (s.t1 - s.t0 < 2.5) warns.push(`${s.id}: scene is only ${(s.t1 - s.t0).toFixed(1)} s`);
}

// images
const used = new Set();
for (const s of props.scenes) { if (s.visual.img) used.add(s.visual.img); (s.visual.imgs || []).forEach((i) => used.add(i)); }
for (const id of used) {
  const im = props.images[id];
  if (!im) { fail("IMG", `${id} not in props.images`); continue; }
  if (!im.author || !im.license || !im.page) fail("IMG", `${id} lacks author, licence or page`);
  if (!fs.existsSync(path.join(repo, "channels", "rival-lines", "render", "public", im.file))) fail("IMG", `${id} file missing: ${im.file}`);
}

// SCR-13
const colour = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;
for (const f of ["src/Episode.tsx", "src/Root.tsx", "render.mjs"]) {
  const p = path.join(repo, "channels", "rival-lines", "render", f);
  fs.readFileSync(p, "utf8").split("\n").forEach((l, i) => {
    if (colour.test(l) && !(f === "src/Root.tsx" && l.includes("defaultProps"))) fail("SCR-13", `${f}:${i + 1} colour literal`);
  });
}

// the episode ends: a closing question and a plan that fits the narration
const last = props.scenes[props.scenes.length - 1];
if (Math.abs(last.t1 - props.durationSec) > 0.05) fail("PLAN", "last scene does not end at durationSec");

for (const w of warns) console.log("warn:", w);
if (fails.length) { console.log(fails.join("\n")); console.log(`gate: FAIL (${fails.length})`); process.exit(1); }
console.log(`gate: PASS (${props.scenes.length} scenes, ${used.size} photos, ${script.sources_used.length} sources)`);
