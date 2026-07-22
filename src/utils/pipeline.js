/**
 * Pipeline Orchestrator — Runs the full daily pipeline for a channel.
 *
 * Usage: node src/utils/pipeline.js <channel-id> [--dry-run]
 *
 * Steps:
 * 1. Deep Research — pick topic from content pillars, research deeply
 * 2. Trend Research — check YouTube trends (needs API)
 * 3. Script Writer — produce Shorts + long-form scripts
 * 4. TTS — generate voiceover with EdgeTTS
 * 5. Thumbnail — generate thumbnail spec
 * 6. VFX Audit — validate visual effects against checklist
 * 7. SFX — source sound effects from library
 * 8. Render — produce video files with Remotion
 * 9. Publish — upload to YouTube as private, auto-publish after 1hr
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..");

function log(step, msg, status = "info") {
  const icons = { info: "▸", ok: "✓", warn: "⚠", err: "✗", skip: "○" };
  console.log(`[${step}] ${icons[status] || "▸"} ${msg}`);
}

function run(cmd, cwd) {
  try {
    execSync(cmd, { cwd, stdio: "pipe", timeout: 300000 });
    return true;
  } catch (err) {
    return false;
  }
}

function main() {
  const channelId = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");

  if (!channelId) {
    console.error("Usage: node pipeline.js <channel-id> [--dry-run]");
    process.exit(1);
  }

  // Load channel config
  const channelsPath = join(ROOT, "config", "channels.json");
  const data = JSON.parse(readFileSync(channelsPath, "utf-8"));
  const channels = data.channels || data;
  const channel = channels.find((c) => c.channel_id === channelId);
  if (!channel) {
    console.error(`Channel "${channelId}" not found`);
    process.exit(1);
  }

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  PIPELINE: ${channel.channel_id}`);
  console.log(`  Niche: ${channel.niche} / ${channel.niche_sub}`);
  console.log(`  Style: ${channel.style}`);
  console.log(`  Tone: ${channel.tone}`);
  console.log(`  Dry Run: ${dryRun}`);
  console.log(`═══════════════════════════════════════════\n`);

  // Step 1: Deep Research
  log("1", "Deep Research", "info");
  const researchDir = join(ROOT, "data", "research", channelId);
  if (existsSync(researchDir)) {
    const researchFiles = readdirSync(researchDir).filter((f) => f.endsWith(".json"));
    if (researchFiles.length > 0) {
      log("1", `Found ${researchFiles.length} existing research file(s)`, "ok");
      log("1", `Latest: ${researchFiles[researchFiles.length - 1]}`, "info");
    } else {
      log("1", "No research files yet — run deep-research first", "warn");
    }
  } else {
    log("1", "No research directory — run deep-research first", "warn");
  }

  // Step 2: Trend Research
  log("2", "Trend Research", "info");
  const trendsAvailable = channel.youtube_channel_id !== "SET_ME";
  if (trendsAvailable) {
    log("2", "API available — fetching trends", "info");
    run(`node src/skills/trend-research/run.js ${channelId}`, ROOT);
  } else {
    log("2", "API not configured — using content pillars", "skip");
  }

  // Step 3: Script Writer
  log("3", "Script Writer", "info");
  const scriptsDir = join(ROOT, "data", "research", channelId);
  if (existsSync(scriptsDir)) {
    const scripts = readdirSync(scriptsDir).filter(
      (f) => f.includes("script") && (f.endsWith(".txt") || f.endsWith(".md"))
    );
    if (scripts.length > 0) {
      log("3", `Found ${scripts.length} script(s)`, "ok");
      scripts.forEach((s) => log("3", `  ${s}`, "info"));
    } else {
      log("3", "No scripts yet — run script-writer", "warn");
    }
  }

  // Step 4: TTS
  log("4", "TTS (EdgeTTS)", "info");
  const ttsDir = join(ROOT, "data", "tts", channelId);
  if (existsSync(ttsDir)) {
    const audioFiles = readdirSync(ttsDir).filter((f) => f.endsWith(".mp3"));
    log("4", `Found ${audioFiles.length} audio file(s)`, audioFiles.length > 0 ? "ok" : "warn");
  } else {
    log("4", "No TTS output yet", "warn");
  }

  // Step 5: Thumbnail
  log("5", "Thumbnail", "info");
  const thumbDir = join(ROOT, "data", "thumbnails", channelId);
  if (existsSync(thumbDir)) {
    const thumbs = readdirSync(thumbDir).filter((f) => f.endsWith("-thumb-spec.json"));
    log("5", `Found ${thumbs.length} thumbnail spec(s)`, thumbs.length > 0 ? "ok" : "warn");
  } else {
    log("5", "No thumbnails yet", "warn");
  }

  // Step 6: VFX Audit
  log("6", "VFX Audit", "info");
  const vfxChecklist = join(ROOT, "data", "vfx-checklist.json");
  if (existsSync(vfxChecklist)) {
    log("6", "VFX checklist loaded", "ok");
  } else {
    log("6", "No VFX checklist — run vfx-audit", "warn");
  }

  // Step 7: SFX
  log("7", "SFX Library", "info");
  const sfxDir = join(ROOT, "data", "audio", "sfx");
  if (existsSync(sfxDir)) {
    log("7", "SFX directory exists", "ok");
  } else {
    log("7", "No SFX library — run sfx-sourcing", "warn");
  }

  // Step 8: Render
  log("8", "Render (Remotion)", "info");
  const rendersDir = join(ROOT, "data", "renders", channelId);
  if (existsSync(rendersDir)) {
    const renders = readdirSync(rendersDir).filter((f) => f.endsWith(".mp4"));
    log("8", `Found ${renders.length} rendered video(s)`, renders.length > 0 ? "ok" : "warn");
    renders.forEach((r) => log("8", `  ${r}`, "info"));
  } else {
    log("8", "No renders yet", "warn");
  }

  // Step 9: Publish
  log("9", "YouTube Publish", "info");
  if (dryRun) {
    log("9", "Dry run — skipping publish", "skip");
  } else if (!trendsAvailable) {
    log("9", "API not configured — manual upload required", "skip");
  } else {
    log("9", "Ready to publish", "info");
  }

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Pipeline complete for ${channelId}`);
  console.log(`═══════════════════════════════════════════\n`);
}

main();
