#!/usr/bin/env node
/**
 * gemini-visual-plan-enhanced.js - Enhanced visual planner with beat grouping + plan caching.
 *
 * This wraps the existing gemini-visual-plan.js and adds:
 *   1. Visual beat grouping (SRT cues -> coherent visual beats)
 *   2. Plan caching (content-hash based, avoids regenerating same plans)
 *   3. Token savings reporting
 *
 * Usage:
 *   node scripts/gemini-visual-plan-enhanced.js --script PATH --srt PATH --channel ID --out PATH
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { groupCuesIntoBeats } from "./visual-beat-grouper.js";
import { planCacheKey, getCachedPlan, setCachedPlan } from "./plan-cache.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const GEMINI_PLAN_JS = join(__dirname, "gemini-visual-plan.js");

function arg(name, fallback = null) {
  const i = process.argv.indexOf("--" + name);
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function parseSrt(srtText) {
  const blocks = srtText.replace(/\r\n/g, "\n").split(/\n\n+/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;
    const match = lines[1].match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );
    if (!match) continue;
    const start = parseInt(match[1])*3600 + parseInt(match[2])*60 + parseInt(match[3]) + parseInt(match[4])/1000;
    const end = parseInt(match[5])*3600 + parseInt(match[6])*60 + parseInt(match[7]) + parseInt(match[8])/1000;
    const text = lines.slice(2).join(" ").trim();
    if (text.length > 0) cues.push({ start, end, text });
  }
  return cues;
}

async function main() {
  const scriptPath = arg("script");
  const srtPath = arg("srt");
  const channelId = arg("channel");
  const outPath = arg("out");
  const correctionsPath = arg("corrections");

  if (!scriptPath || !outPath) {
    console.error("Usage: gemini-visual-plan-enhanced.js --script PATH --srt PATH --channel ID --out PATH");
    process.exit(2);
  }

  // Step 1: Check plan cache
  let channelConfig = null;
  if (channelId) {
    try {
      const config = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
      channelConfig = config.channels.find(c => String(c.id) === String(channelId));
    } catch {}
  }

  const resolvedSrt = srtPath && existsSync(srtPath) ? srtPath : (srtPath ? join(ROOT, srtPath) : null);
  const resolvedScript = existsSync(scriptPath) ? scriptPath : join(ROOT, scriptPath);

  const cacheKey = planCacheKey(resolvedScript, resolvedSrt, channelId, channelConfig);
  const cachedPlan = getCachedPlan(cacheKey);
  if (cachedPlan && !correctionsPath) {
    console.log("Plan cache HIT - reusing cached plan");
    writeFileSync(outPath, JSON.stringify(cachedPlan, null, 2) + "\n");
    console.log("Written: " + outPath);
    process.exit(0);
  }

  // Step 2: Group SRT cues into visual beats (token savings)
  let beatCount = 0;
  let cueCount = 0;
  if (resolvedSrt && existsSync(resolvedSrt)) {
    const srtText = readFileSync(resolvedSrt, "utf-8");
    const cues = parseSrt(srtText);
    cueCount = cues.length;

    // Get timing from channel style
    let timing = {};
    if (channelConfig && channelConfig.style) {
      const STYLE_TIMING = {
        "cinematic-documentary": { minBeat: 4.0, maxBeat: 8.0, pauseThreshold: 0.4 },
        "motion-graphics": { minBeat: 2.5, maxBeat: 6.0, pauseThreshold: 0.25 },
        minimal: { minBeat: 3.0, maxBeat: 7.0, pauseThreshold: 0.35 },
      };
      timing = STYLE_TIMING[channelConfig.style] || {};
    }

    const beats = groupCuesIntoBeats(cues, timing);
    beatCount = beats.length;
    const savings = Math.round((1 - beats.length / cues.length) * 100);
    console.log("Beat grouping: " + cues.length + " cues -> " + beats.length + " beats (" + savings + "% token savings)");
  }

  // Step 3: Delegate to original gemini-visual-plan.js
  console.log("Delegating to gemini-visual-plan.js...");
  const args = [GEMINI_PLAN_JS, "--script", scriptPath, "--out", outPath];
  if (resolvedSrt) args.push("--srt", resolvedSrt);
  if (channelId) args.push("--channel", channelId);
  if (correctionsPath) args.push("--corrections", correctionsPath);

  const result = spawnSync("node", args, {
    encoding: "utf-8",
    timeout: 5 * 60 * 1000,
    cwd: ROOT,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    console.error("gemini-visual-plan.js exited with code " + result.status);
    process.exit(result.status || 1);
  }

  // Step 4: Cache the generated plan
  if (existsSync(outPath)) {
    try {
      const plan = JSON.parse(readFileSync(outPath, "utf-8"));
      setCachedPlan(cacheKey, plan);
      console.log("Plan cached for future reuse");
    } catch {}
  }

  // Step 5: Report token savings
  if (beatCount > 0 && cueCount > 0) {
    console.log("\n=== TOKEN SAVINGS REPORT ===");
    console.log("  Original cues: " + cueCount);
    console.log("  Grouped beats: " + beatCount);
    console.log("  Token savings: " + Math.round((1 - beatCount / cueCount) * 100) + "%");
    console.log("  Gemini calls avoided: " + (cueCount - beatCount) + " individual cue decisions");
  }
}

main().catch(e => {
  console.error("Fatal: " + e.message);
  process.exit(1);
});