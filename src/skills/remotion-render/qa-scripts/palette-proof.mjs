#!/usr/bin/env node
/** Same frame, accent solved from the hue vs taken from channels.json. */
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill, openBrowser } from "@remotion/renderer";
import { buildMgPackage } from "../compositions/mg-package.js";
import { chunkTextClauseAware } from "../compositions/beats.js";
import { paletteFromHues } from "../styles/tokens.js";
import { narrationSections } from "../../../utils/script-narration.js";
import { findChrome } from "../find-chrome.js";
const RD = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(RD, "..", "..", "..");
const OUT = join(ROOT, "data", "renders", "palette-proof");
mkdirSync(OUT, { recursive: true });

// ch-31's declared amber vs its solved brown is the widest gap of the 17.
const base = JSON.parse(readFileSync(join(ROOT, "config/channels.json"), "utf8")).channels.find((c) => c.channel_id === "ch-31");
const script = JSON.parse(readFileSync(join(ROOT, "data/research/1/debt-snowball-vs-debt-avalanche-shorts-script.json"), "utf8"));
const srt = readFileSync(join(ROOT, "data/tts/1/debt-snowball-vs-debt-avalanche-shorts-script-vo.srt"), "utf8");
const sections = narrationSections(script).filter((s) => s.voiceover && s.voiceover.trim()).map((s) => ({
  id: s.id, timing: s.timing, voiceover: s.voiceover, content: chunkTextClauseAware(s.voiceover), bRoll: null }));
const mg = buildMgPackage(srt, { sections, channel: base, bRollFiles: [], imageForSection: () => null });

const CHROME = findChrome();
const serveUrl = await bundle({ entryPoint: join(RD, "Root.jsx"), onProgress: () => {} });
const browser = await openBrowser(undefined, { browserExecutable: CHROME, chromiumOptions: { gl: "swangle" } });
const FRAME = 200;
for (const [label, pal] of [
  ["before-hue-derived", paletteFromHues({ accentHue: base.thumbnail_spec.accentHue, bgMode: base.bg_mode })],
  ["after-declared", paletteFromHues({ accentHue: base.thumbnail_spec.accentHue, bgMode: base.bg_mode, accent: base.colors.accent })],
]) {
  const props = { channelId: base.channel_id, style: base.style, format: "shorts", sections, mg,
    ttsAudioPath: null, hasUnderscore: false, font: base.font || "Inter",
    channelName: base.channel_name, palette: pal, showCaptions: false };
  const out = join(OUT, `ch-31-${label}.png`);
  const comp = await selectComposition({ serveUrl, id: "MotionGraphicsShorts", browserExecutable: CHROME, puppeteerInstance: browser, inputProps: props });
  await renderStill({ composition: { ...comp, durationInFrames: mg.totalFrames }, serveUrl, output: out,
    frame: FRAME, browserExecutable: CHROME, puppeteerInstance: browser, inputProps: props });
  console.log(`RESULT ${label.padEnd(20)} accent=${pal.accent}  bg=${pal.bg}`);
}
await browser.close({ silent: true });
