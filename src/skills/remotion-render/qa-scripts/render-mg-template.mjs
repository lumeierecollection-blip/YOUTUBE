#!/usr/bin/env node
/**
 * Render stills from the FULL motion-graphics composition with the template
 * engine switched on, using the ch-fixture script and its real caption stream.
 *
 *   node qa-scripts/render-mg-template.mjs --channel ch-02 --frames 60,210,420,700
 *
 * This is the end-to-end path a channel actually runs: the SRT gives the beat
 * timing, the director chooses each beat's strategy from the beat's own text,
 * and every beat whose required parameter could be grounded is drawn by the
 * template engine inside the same composition that draws everything else. It is
 * the only check that the two engines coexist in one video rather than each
 * working alone.
 */
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill, renderMedia } from "@remotion/renderer";
import { findChrome } from "../find-chrome.js";
import { buildMgPackage } from "../compositions/mg-package.js";
import { chunkTextClauseAware } from "../compositions/beats.js";
import { paletteFromHues, deriveHuesFromHexes } from "../styles/tokens.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(__dirname, "..");
const ROOT = join(RENDER_DIR, "..", "..", "..");
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const cid = arg("channel", "ch-02");
const frames = arg("frames", "60,210,420,700").split(",").map(Number);
// --video renders the whole package to mp4 instead of picking stills. There is
// no voiceover for the ch-fixture script in this repo, so the clip is SILENT --
// the caption stream supplies the timing, which is what is being checked here.
const video = process.argv.includes("--video");

const script = JSON.parse(readFileSync(join(ROOT, "data/scripts/ch-fixture/movile-cave-shorts-script.json"), "utf-8"));
const srt = readFileSync(join(ROOT, "data/tts/ch-fixture/movile-cave-shorts-script-vo.srt"), "utf-8");
const channel = (JSON.parse(readFileSync(join(ROOT, "config/channels.json"), "utf-8")).channels || []).find((c) => c.channel_id === cid);
const identitySpec = JSON.parse(readFileSync(join(ROOT, "config/visual-identity.json"), "utf-8")).channels[cid];
const templates = {};
for (const f of readdirSync(join(ROOT, "config/templates"))) {
  if (!f.startsWith(`${cid}.`) || !f.endsWith(".json")) continue;
  const d = JSON.parse(readFileSync(join(ROOT, "config/templates", f), "utf-8"));
  templates[d.strategy] = d;
}

const sections = (script.sections || []).filter((s) => s.voiceover && s.voiceover.trim()).map((s) => ({
  id: s.id, timing: s.timing, voiceover: s.voiceover, content: chunkTextClauseAware(s.voiceover),
  visualCue: s.visual_cue || null, bRoll: null, textOverlay: s.text_overlay || null,
  transitionOut: s.transition_out || null, bRollFiles: [],
}));

const mg = buildMgPackage(srt, {
  sections, hook: script.hook || null, channel,
  imageForSection: () => null, totalMs: 45000, templates, identitySpec,
});
console.log(`beats ${mg.beats.length}, template-drawn ${mg.templateBeats.drawn}/${mg.templateBeats.offered}`);

// deriveHuesFromHexes wants the legacy 3-hex array, not the named colors object.
const colors = paletteFromHues(
  deriveHuesFromHexes([channel.colors.primary, channel.colors.accent, channel.colors.secondary]),
  channel.bg_mode
);
const props = { script, sections, colors, channel, mg, fontFamily: channel.font };

const CHROME = findChrome();
const serveUrl = await bundle({ entryPoint: join(RENDER_DIR, "Root.jsx"), onProgress: () => {} });
const composition = await selectComposition({
  serveUrl, id: "MotionGraphicsShorts", inputProps: props,
  ...(CHROME ? { browserExecutable: CHROME } : {}),
});
const outDir = join(ROOT, "data/renders/mg-template");
mkdirSync(outDir, { recursive: true });

if (video) {
  const out = join(outDir, `${cid}-template-engine.mp4`);
  await renderMedia({
    composition: { ...composition, durationInFrames: mg.totalFrames },
    serveUrl, inputProps: props, codec: "h264", crf: 20,
    chromiumOptions: { gl: "swangle" }, timeoutInMilliseconds: 600000, logLevel: "error",
    ...(CHROME ? { browserExecutable: CHROME } : {}),
    outputLocation: out,
  });
  const drawn = mg.beats.filter((b) => b.templatePlan);
  const strategies = [...new Set(drawn.map((b) => b.visualPlan.strategy))].sort();
  console.log(`wrote ${out.replace(ROOT + "/", "")}  ${mg.totalFrames}f @30fps`);
  console.log(`  template engine drew ${drawn.length}/${mg.beats.length} beats: ${strategies.join(", ")}`);
  console.log(`  existing engine drew ${mg.beats.length - drawn.length}: ` +
    [...new Set(mg.beats.filter((b) => !b.templatePlan).map((b) => b.visualPlan.strategy))].sort().join(", "));
  process.exit(0);
}

for (const f of frames) {
  const beat = mg.beats.find((b) => f >= b.startFrame && f < b.startFrame + b.durationInFrames);
  const tag = beat ? `${beat.visualPlan.strategy}${beat.templatePlan ? "-template" : "-existing"}` : "none";
  const out = join(outDir, `${cid}-f${f}-${tag}.png`);
  await renderStill({
    composition: { ...composition, durationInFrames: mg.totalFrames },
    serveUrl, inputProps: props, chromiumOptions: { gl: "swangle" },
    timeoutInMilliseconds: 240000, logLevel: "error",
    ...(CHROME ? { browserExecutable: CHROME } : {}),
    output: out, imageFormat: "png", frame: f,
  });
  console.log("wrote", out.replace(ROOT + "/", ""));
}
