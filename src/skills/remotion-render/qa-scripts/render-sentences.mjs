#!/usr/bin/env node
/**
 * Build the sentence plan for a script and render it.
 *
 *   node qa-scripts/render-sentences.mjs --channel ch-02 --stills 30,90,200,300
 *   node qa-scripts/render-sentences.mjs --channel ch-02 --video
 *
 * Sentences and their timing come from the SRT. The visual for each sentence
 * comes from the semantic matcher, never from a keyword.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill, renderMedia } from "@remotion/renderer";
import { findChrome } from "../find-chrome.js";
import { buildSentenceBeats } from "../visual-engine/beats/sentence-beats.js";
import { selectAsset } from "../visual-engine/assets/match.js";
import { getIconBody } from "../visual-engine/assets/icon-bodies.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(__dirname, "..");
const ROOT = join(RENDER_DIR, "..", "..", "..");
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const cid = arg("channel", "ch-02");
const FPS = 30;

const srtPath = arg("srt", "data/tts/ch-fixture/movile-cave-shorts-script-vo.srt");
const srt = readFileSync(join(ROOT, srtPath), "utf-8");
const spec = JSON.parse(readFileSync(join(ROOT, "config/visual-identity.json"), "utf-8")).channels[cid];

/**
 * ICONS ONLY. THIS ENGINE NO LONGER DRAWS ITS OWN OBJECTS.
 *
 * data/renders/iconify-proof.png measured that a hand-drawn spider and
 * centipede did not read at Shorts scale and their Iconify equivalents did.
 * The 109-drawing procedural library this engine used to fall back on
 * (config/assets/semantic-library.json) is deleted, not merely deprioritised
 * — hand-tagging ~100 shapes with invented topics was the same
 * ≥2000-with-rich-metadata problem this repo already tried once, and every
 * one of those drawings now has a real icon that reads better at Shorts
 * scale. `compositions/objects/{library,nature}.jsx` and the registry they
 * register into still exist and still render — they are load-bearing for
 * `TemplateScene` (config/channels.json id 2, "Legal Brief", is the one live
 * channel with `visual_engine: "template"`) — this engine simply no longer
 * reads from them.
 */
const library = JSON.parse(readFileSync(join(ROOT, "config/assets/icon-library.json"), "utf-8"));
console.log(`asset pool: ${library.assets.length} icon(s)`);

/** SRT timestamps to frames. The captions are the timing source of truth. */
const toFrames = (t) => {
  const [h, m, rest] = t.split(":");
  const [s, ms] = rest.split(",");
  return Math.round(((+h * 3600) + (+m * 60) + +s + +ms / 1000) * FPS);
};
const cues = srt.split(/\n\n+/).map((b) => b.trim().split("\n")).filter((l) => l.length >= 3).map((l) => {
  const [a, b] = l[1].split(" --> ");
  return { startFrame: toFrames(a), endFrame: toFrames(b), text: l.slice(2).join(" ") };
});
// SRT cues in this file overlap by a few frames; each cue runs until the next
// one starts so no two sentences are ever on screen together.
cues.forEach((c, i) => { c.durationInFrames = Math.max(12, (cues[i + 1] ? cues[i + 1].startFrame : c.endFrame) - c.startFrame); });

const picks = [];
/** name -> the winning asset record, so the icon body can be resolved once per beat. */
const assetByName = new Map(library.assets.map((a) => [a.name, a]));
const { beats, warnings } = buildSentenceBeats(cues, (sentence) => {
  const r = selectAsset(sentence, library);
  picks.push({ sentence, asset: r.asset ? r.asset.name : null, score: r.score, subject: r.intent.literalSubject });
  return r.asset ? r.asset.name : null;
});

/**
 * Resolve the icon body for every VISUAL beat.
 *
 * This runs in Node, after the beats exist, so the plan JSON ends up
 * self-contained: `beat.icon` carries the raw SVG body and its native
 * viewBox, and the browser-side composition never imports an npm icon
 * package (see icon-bodies.js for why that split exists). Every asset in
 * the pool is an icon now, so a VISUAL beat's focal always resolves to one
 * — buildSentenceBeats() never emits a VISUAL beat for a sentence pick()
 * returned null for (see sentence-beats.js's canShowVisual).
 */
for (const b of beats) {
  if (b.mode !== "VISUAL") continue;
  const asset = assetByName.get(b.focal);
  b.icon = { ...getIconBody(asset.iconSet, asset.iconName), set: asset.iconSet, name: asset.iconName };
  if (asset.attribution) b.attribution = asset.attribution;
}

const plan = {
  beats,
  palette: { primary: spec.primary_palette, secondary: spec.secondary_palette },
  fonts: { primary: spec.typography_primary, secondary: spec.typography_secondary },
  picks,
};
mkdirSync(join(ROOT, "data/plans/sentences"), { recursive: true });
const planPath = join(ROOT, "data/plans/sentences", `${cid}.sentences.json`);
writeFileSync(planPath, JSON.stringify(plan, null, 1));

const total = beats.length ? beats[beats.length - 1].start_frame + beats[beats.length - 1].duration_frames : 300;
console.log(`${cid}: ${cues.length} sentences -> ${beats.length} beats, ${total}f`);
for (const p of picks) console.log(`  ${(p.asset || "** NO MATCH **").padEnd(20)} ${String(p.score).padStart(6)}  [${p.subject}]  ${p.sentence.slice(0, 46)}`);
if (warnings.length) console.log(`  ${warnings.length} warning(s): ${warnings.slice(0, 3).join("; ")}`);

const CHROME = findChrome();
const serveUrl = await bundle({ entryPoint: join(RENDER_DIR, "Root.jsx"), onProgress: () => {} });
const composition = await selectComposition({ serveUrl, id: "SentenceShorts", inputProps: { plan }, ...(CHROME ? { browserExecutable: CHROME } : {}) });
const outDir = join(ROOT, "data/renders/sentences");
mkdirSync(outDir, { recursive: true });
const common = {
  composition: { ...composition, durationInFrames: total },
  serveUrl, inputProps: { plan }, chromiumOptions: { gl: "swangle" },
  timeoutInMilliseconds: 600000, logLevel: "error",
  ...(CHROME ? { browserExecutable: CHROME } : {}),
};
if (process.argv.includes("--video")) {
  const out = join(outDir, `${cid}-sentences.mp4`);
  await renderMedia({ ...common, codec: "h264", crf: 20, outputLocation: out });
  console.log("wrote", out.replace(ROOT + "/", ""));
} else {
  for (const f of arg("stills", "40,120,200,300,420,560").split(",").map(Number)) {
    const b = beats.find((x) => f >= x.start_frame && f < x.start_frame + x.duration_frames);
    const out = join(outDir, `${cid}-f${String(f).padStart(4, "0")}-${b ? b.mode : "none"}.png`);
    await renderStill({ ...common, output: out, imageFormat: "png", frame: f });
    console.log("wrote", out.replace(ROOT + "/", ""));
  }
}
