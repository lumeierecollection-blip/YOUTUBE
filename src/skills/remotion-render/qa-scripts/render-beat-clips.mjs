#!/usr/bin/env node
/**
 * Renders a real short clip per beat, for every channel that actually has a
 * script + SRT on this branch. Bundles once and renders many, unlike
 * render-clip.mjs which bundles per invocation.
 *
 * Channels with no script data are NOT faked by borrowing another channel's
 * script — they are reported as gaps by run-beat-reasoning.mjs and left out
 * here on purpose.
 */
import { mkdirSync, readFileSync, existsSync, readdirSync, copyFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import { buildMgPackage } from "../compositions/mg-package.js";
import { chunkTextClauseAware } from "../compositions/beats.js";
import { narrationSections } from "../../../utils/script-narration.js";
import { findChrome } from "../find-chrome.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(__dirname, "..");
const ROOT = join(RENDER_DIR, "..", "..", "..");
const OUT_DIR = join(ROOT, "data", "renders", "beat-clips");
mkdirSync(OUT_DIR, { recursive: true });

const PER_SCRIPT = parseInt(process.env.CLIPS_PER_SCRIPT || "3", 10);
const config = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
const channels = [...(config.channels || config)];
channels.push({ id: "fixture", channel_id: "ch-fixture", channel_name: "ch-fixture", style: "motion-graphics",
  font: "Inter", colors: { primary: "#0F172A", secondary: "#1E293B", accent: "#22C55E", bg: "#0A1020" } });

const FFMPEG = join(ROOT, "node_modules", "ffmpeg-static", "ffmpeg");

/** The composition statically imports ./vo.mp3, so one must always be staged. */
function stageAudio(slug, seconds) {
  const real = join(ROOT, "data", "audit", "14", "measure", `${slug.replace(/-script$/, "")}-vo.mp3`);
  const target = join(RENDER_DIR, "vo.mp3");
  if (existsSync(real)) { copyFileSync(real, target); return "real voiceover"; }
  // No TTS is reachable here (edge-tts absent, every TTS host refused by the
  // egress policy), so picture-only clips get a silent track of the right
  // length. sound-design.js already documents vo.mp3 as a silent placeholder.
  execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
    "-i", "anullsrc=r=44100:cl=stereo", "-t", String(Math.max(seconds, 1)), "-q:a", "9", target]);
  return "SILENT PLACEHOLDER (no TTS reachable)";
}

function pairsFor(c) {
  const out = [];
  for (const [sDir, tDir] of [
    [join(ROOT, "data", "research", String(c.id)), join(ROOT, "data", "tts", String(c.id))],
    [join(ROOT, "data", "scripts", c.channel_id), join(ROOT, "data", "tts", c.channel_id)],
  ]) {
    if (!existsSync(sDir)) continue;
    for (const f of readdirSync(sDir).filter((f) => f.endsWith("script.json"))) {
      const slug = f.replace(/\.json$/, "");
      const srt = join(tDir, `${slug}-vo.srt`);
      if (existsSync(srt)) out.push({ script: join(sDir, f), srt, slug });
    }
  }
  return out;
}

const CHROME = findChrome();
console.log("bundling once...");
const serveUrl = await bundle({ entryPoint: join(RENDER_DIR, "Root.jsx"), onProgress: () => {} });
console.log("chrome:", CHROME || "(remotion-managed)");

const manifest = [];
for (const channel of channels) {
  for (const pair of pairsFor(channel)) {
    const script = JSON.parse(readFileSync(pair.script, "utf-8"));
    const srtText = readFileSync(pair.srt, "utf-8");
    const sections = narrationSections(script)
      .filter((s) => s.voiceover && s.voiceover.trim())
      .map((s) => ({ id: s.id, timing: s.timing, voiceover: s.voiceover,
        content: chunkTextClauseAware(s.voiceover), sfxCue: s.sfx_cue || null,
        bRoll: Array.isArray(s.b_roll) ? s.b_roll : null, beats: Array.isArray(s.beats) ? s.beats : null }));
    const mg = buildMgPackage(srtText, { sections, hook: script.hook || null, channel, bRollFiles: [], imageForSection: () => null });
    const staged = mg.beats.filter((b) => b.archetype !== "LIST_ITEM" && b.visualPlan);

    const audioNote = stageAudio(pair.slug, mg.totalFrames / 30);

    // One clip per DISTINCT strategy, so the clips show different visuals
    // rather than the same treatment three times.
    const seen = new Set();
    const targets = [];
    for (const b of staged) {
      const s = b.visualPlan.strategy;
      if (seen.has(s)) continue;
      seen.add(s); targets.push(b);
      if (targets.length >= PER_SCRIPT) break;
    }

    const props = mg.inputProps || { mg, channel };
    for (const target of targets) {
      const from = Math.max(target.startFrame - 6, 0);
      const to = Math.min(target.startFrame + target.durationInFrames + 6, mg.totalFrames - 1);
      const name = `ch${channel.id}-${pair.slug.replace(/-script$/, "")}-${target.visualPlan.strategy}.mp4`;
      const outPath = join(OUT_DIR, name);
      try {
        const composition = await selectComposition({ serveUrl, id: "MotionGraphicsShorts", inputProps: props,
          ...(CHROME ? { browserExecutable: CHROME } : {}) });
        await renderMedia({ composition: { ...composition, durationInFrames: mg.totalFrames }, serveUrl,
          codec: "h264", inputProps: props, outputLocation: outPath, frameRange: [from, to],
          imageFormat: "png", crf: 20, pixelFormat: "yuv420p", chromiumOptions: { gl: "swangle" },
          concurrency: 2, scale: 0.5, timeoutInMilliseconds: 120000, logLevel: "error",
          ...(CHROME ? { browserExecutable: CHROME } : {}) });
        console.log(`OK   ${name}`);
        manifest.push({ channel: channel.channel_name, channel_id: channel.id, script: pair.slug,
          strategy: target.visualPlan.strategy, beat_text: target.text, frames: [from, to],
          seconds: +((to - from) / 30).toFixed(2), audio: audioNote, file: `data/renders/beat-clips/${name}`, status: "OK" });
      } catch (err) {
        console.log(`FAIL ${name}: ${err.message.split("\n")[0]}`);
        manifest.push({ channel: channel.channel_name, channel_id: channel.id, script: pair.slug,
          strategy: target.visualPlan.strategy, status: "FAIL", error: err.message.split("\n")[0] });
      }
    }
  }
}
writeFileSync(join(OUT_DIR, "clips-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`\n${manifest.filter((m) => m.status === "OK").length} clips OK, ${manifest.filter((m) => m.status !== "OK").length} failed`);
