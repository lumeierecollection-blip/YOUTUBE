#!/usr/bin/env node
/**
 * Long-form visual approval package. Renders ONLY single frames (Remotion renderStill) of the real long-form compositions, for each channel:
 * openings, main scene types, transitions (start / middle / end frame), information graphics and three thumbnail concepts, then labelled contact
 * sheets. No timeline and no video is rendered. Usage: node platform/longform/stills/run.mjs [channel,...]. Output: output/longform-approval/<channel>/.
 * Content is real: Wikipedia, DOJ/CBS excerpts, StatsBomb events and our own stored AI test, with Commons photographs and Natural Earth maps.
 * Where a scene is a layout demonstration the label says so.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";
import { commonsAsset } from "../../production/commons.mjs";
import { SPECS } from "./specs.mjs";

const sharp = createRequire(join(ROOT, "package.json"))("sharp");
const only = (process.argv[2] || "hidden-past,ai-tested,court-and-spotlight,rival-lines").split(",");
const OUT = join(ROOT, "output/longform-approval"), REMOTION = join(ROOT, "src/skills/remotion-render");
mkdirSync(OUT, { recursive: true });
// The Remotion bundle imports ./vo.mp3 (the video pipeline puts the narration there); a stills run needs only a placeholder.
if (!existsSync(join(REMOTION, "vo.mp3"))) spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "1", join(REMOTION, "vo.mp3")]);
const jpg = async (file, w = 1500) => `data:image/jpeg;base64,${(await sharp(file).resize({ width: w, withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer()).toString("base64")}`;
const ctx = { OUT, ROOT, jpg, commons: async (title, id, dir) => { const { file, entry } = await commonsAsset({ title, dir, id, role: "preview photograph" }); return { file, entry }; }, sharp };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
async function label(png, lines, outFile) {
  const meta = await sharp(png).metadata(), bar = 150, W = meta.width;
  const svg = Buffer.from(`<svg width="${W}" height="${bar}"><rect width="${W}" height="${bar}" fill="#0b0f14"/>${lines.map((l, i) => `<text x="22" y="${34 + i * 28}" font-family="sans-serif" font-size="${i === 0 ? 24 : 20}" font-weight="${i === 0 ? 700 : 400}" fill="${i === 0 ? "#ffd34d" : "#dfe6ee"}">${esc(l)}</text>`).join("")}</svg>`);
  await sharp({ create: { width: W, height: meta.height + bar, channels: 3, background: "#000" } }).composite([{ input: png, top: 0, left: 0 }, { input: svg, top: meta.height, left: 0 }]).jpeg({ quality: 88 }).toFile(outFile);
}
async function sheet(files, out, cols, w) {
  const tiles = await Promise.all(files.map((f) => sharp(f).resize(w).toBuffer())), hs = await Promise.all(tiles.map(async (t) => (await sharp(t).metadata()).height)), rowH = Math.max(...hs), rows = Math.ceil(tiles.length / cols);
  await sharp({ create: { width: cols * (w + 8), height: rows * (rowH + 8), channels: 3, background: "#222" } }).composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * (w + 8), top: Math.floor(i / cols) * (rowH + 8) }))).jpeg({ quality: 84 }).toFile(out);
}

for (const ch of only) {
  const dir = join(OUT, ch), raw = join(dir, "raw"); mkdirSync(raw, { recursive: true });
  const spec = await SPECS[ch](ctx, dir);
  // SHOTS=<regex> renders a subset (local checks and re-renders of fixed frames).
  if (process.env.SHOTS) { const re = new RegExp(process.env.SHOTS); spec.shots = spec.shots.filter((s) => re.test(s.name)); spec.storyboard = (spec.storyboard || []).filter((s) => re.test(s.name)); }
  writeFileSync(join(dir, "assets.json"), JSON.stringify(spec.assets, null, 2));
  const job = join(dir, "job.json");
  writeFileSync(job, JSON.stringify({ outDir: raw, shots: spec.shots.map((s) => ({ name: s.name, id: s.id, props: s.props, frame: s.frame, scale: s.scale || 1, durationInFrames: s.id === "LfThumb" ? 1 : undefined })) }));
  const r = spawnSync("node", ["render-stills.mjs", job], { cwd: REMOTION, stdio: "inherit", timeout: 40 * 60e3 });
  if (r.status !== 0) throw new Error(`still render failed for ${ch}`);
  const groups = {};
  for (const s of spec.shots) {
    const lab = join(dir, `${s.name}.jpg`);
    await label(join(raw, `${s.name}.png`), [`${ch}  ·  ${s.label.scene}`, `Component: ${s.label.component}`, `Technique: ${s.label.technique}`, `Preview: ${s.label.mode}${s.label.note ? `  ·  ${s.label.note}` : ""}`], lab);
    (groups[s.group] ||= []).push(lab);
  }
  for (const [g, files] of Object.entries(groups)) await sheet(files, join(dir, `sheet-${g}.jpg`), g === "transitions" ? 3 : g === "thumbs" ? 3 : 2, g === "transitions" ? 640 : g === "thumbs" ? 640 : 960);
  // Contact sheet of everything, and a storyboard sheet: the beat frames in episode order with the narration under each.
  if (spec.shots.length) await sheet(spec.shots.map((s) => join(dir, `${s.name}.jpg`)), join(dir, "contact-sheet.jpg"), 4, 600);
  if (spec.storyboard?.length) {
    const wrap = (t, n) => t.split(" ").reduce((ls, w) => { const l = ls[ls.length - 1]; if ((l + " " + w).trim().length > n) ls.push(w); else ls[ls.length - 1] = (l + " " + w).trim(); return ls; }, [""]);
    const cards = [];
    for (const [i, s] of spec.storyboard.entries()) {
      const img = await sharp(join(raw, `${s.name}.png`)).resize(640, 360).toBuffer(), lines = wrap(`${i + 1}. [${s.beat}] ${s.vo}`, 62).slice(0, 6);
      const txt = Buffer.from(`<svg width="640" height="150"><rect width="640" height="150" fill="#101317"/>${lines.map((l, k) => `<text x="12" y="${24 + k * 22}" font-family="sans-serif" font-size="17" fill="${k === 0 ? "#ffd34d" : "#e6e9ee"}">${esc(l)}</text>`).join("")}</svg>`);
      const f = join(raw, `sb-${i}.jpg`); await sharp({ create: { width: 640, height: 510, channels: 3, background: "#000" } }).composite([{ input: img, top: 0, left: 0 }, { input: txt, top: 360, left: 0 }]).jpeg({ quality: 82 }).toFile(f); cards.push(f);
    }
    await sheet(cards, join(dir, "storyboard.jpg"), 4, 640);
  }
  writeFileSync(join(dir, "shots.json"), JSON.stringify(spec.shots.map(({ props, ...s }) => s), null, 2));
  console.log(ch, "done:", spec.shots.length, "stills");
}
