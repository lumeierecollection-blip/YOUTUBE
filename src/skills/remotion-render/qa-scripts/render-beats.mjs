#!/usr/bin/env node
/**
 * Build a beat plan from a script and render it through the beat engine.
 *
 *   node qa-scripts/render-beats.mjs --channel ch-02 --stills 40,140,300,520,760,1000
 *   node qa-scripts/render-beats.mjs --channel ch-02 --video
 *
 * Beats and their timing come from `buildMgPackage` against the real SRT, so
 * nothing about WHEN anything happens is invented here.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill, renderMedia } from "@remotion/renderer";
import { findChrome } from "../find-chrome.js";
import { buildMgPackage } from "../compositions/mg-package.js";
import { chunkTextClauseAware } from "../compositions/beats.js";
import { buildBeatPlan } from "../visual-engine/beats/beat-sequence.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(__dirname, "..");
const ROOT = join(RENDER_DIR, "..", "..", "..");
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const cid = arg("channel", "ch-02");
const wantVideo = process.argv.includes("--video");

const script = JSON.parse(readFileSync(join(ROOT, "data/scripts/ch-fixture/movile-cave-shorts-script.json"), "utf-8"));
const srt = readFileSync(join(ROOT, "data/tts/ch-fixture/movile-cave-shorts-script-vo.srt"), "utf-8");
const channel = (JSON.parse(readFileSync(join(ROOT, "config/channels.json"), "utf-8")).channels || []).find((c) => c.channel_id === cid);
const spec = JSON.parse(readFileSync(join(ROOT, "config/visual-identity.json"), "utf-8")).channels[cid];

const sections = (script.sections || []).filter((s) => s.voiceover && s.voiceover.trim()).map((s) => ({
  id: s.id, timing: s.timing, voiceover: s.voiceover, content: chunkTextClauseAware(s.voiceover),
  visualCue: s.visual_cue || null, bRoll: null, textOverlay: s.text_overlay || null,
  transitionOut: s.transition_out || null, bRollFiles: [],
}));
const mg = buildMgPackage(srt, { sections, hook: script.hook || null, channel, imageForSection: () => null, totalMs: 45000 });
const built = buildBeatPlan(mg.beats, { objects: spec.core_objects });
const plan = {
  beats: built.beats,
  palette: { primary: spec.primary_palette, secondary: spec.secondary_palette },
  fonts: { primary: spec.typography_primary, secondary: spec.typography_secondary },
  text_placement: spec.text_placement,
};
const planDir = join(ROOT, "data/plans/beats");
mkdirSync(planDir, { recursive: true });
const planPath = join(planDir, `${cid}.beats.json`);
writeFileSync(planPath, JSON.stringify(plan, null, 1));
const intents = {};
for (const b of built.beats) intents[b.visual_intent] = (intents[b.visual_intent] || 0) + 1;
console.log(`${cid}: ${built.beats.length} beats, ${mg.totalFrames}f`);
console.log(`  intents: ${JSON.stringify(intents)}`);
if (built.warnings.length) console.log(`  ${built.warnings.length} beat-duration warning(s): ${built.warnings.slice(0, 3).join("; ")}`);
console.log(`  plan: ${planPath.replace(ROOT + "/", "")}`);

const CHROME = findChrome();
const serveUrl = await bundle({ entryPoint: join(RENDER_DIR, "Root.jsx"), onProgress: () => {} });
const composition = await selectComposition({
  serveUrl, id: "BeatSequenceShorts", inputProps: { plan },
  ...(CHROME ? { browserExecutable: CHROME } : {}),
});
const outDir = join(ROOT, "data/renders/beats");
mkdirSync(outDir, { recursive: true });
const common = {
  composition: { ...composition, durationInFrames: mg.totalFrames },
  serveUrl, inputProps: { plan }, chromiumOptions: { gl: "swangle" },
  timeoutInMilliseconds: 600000, logLevel: "error",
  ...(CHROME ? { browserExecutable: CHROME } : {}),
};

if (wantVideo) {
  const out = join(outDir, `${cid}-beats.mp4`);
  await renderMedia({ ...common, codec: "h264", crf: 20, outputLocation: out });
  console.log("wrote", out.replace(ROOT + "/", ""));
} else {
  for (const f of arg("stills", "40,140,300,520,760,1000").split(",").map(Number)) {
    const b = built.beats.find((x) => f >= x.start_frame && f < x.start_frame + x.duration_frames);
    const out = join(outDir, `${cid}-f${f}-${b ? b.visual_intent : "none"}.png`);
    await renderStill({ ...common, output: out, imageFormat: "png", frame: f });
    console.log("wrote", out.replace(ROOT + "/", ""));
  }
}
