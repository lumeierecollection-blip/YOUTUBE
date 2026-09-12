#!/usr/bin/env node
/**
 * Gemini Frame Review — per-beat visual QA using Gemini 3.5 Flash Lite.
 *
 * Extracts a frame at each beat/scene transition point, sends it to Gemini
 * alongside the voiceover text for that moment, and checks against the
 * Visual Bible standards. Reports pass/fail per rule per frame.
 *
 * Usage:
 *   node scripts/gemini-frame-review.js --video <path> --script <path> --srt <path> --channel <id>
 *   node scripts/gemini-frame-review.js --video <path> --script <path> --srt <path> --channel <id> --fix
 *
 * --fix   When set, outputs actionable fix suggestions that the pipeline can
 *         use to adjust the next render. Without --fix, it's audit-only.
 *
 * Requires: GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY or VISION_API_KEY
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const compositorPkg = process.platform === "win32"
  ? "@remotion/compositor-win32-x64-msvc" : "@remotion/compositor-linux-x64-gnu";
const binExt = process.platform === "win32" ? ".exe" : "";
const FFMPEG_MIN = join(ROOT, "src", "skills", "remotion-render", "node_modules",
  compositorPkg, `ffmpeg${binExt}`);
const ffmpegStatic = join(ROOT, "node_modules", "ffmpeg-static", `ffmpeg${binExt}`);
const FFMPEG = existsSync(ffmpegStatic) ? ffmpegStatic : FFMPEG_MIN;
const FFPROBE = join(dirname(FFMPEG_MIN), `ffprobe${binExt}`);

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.split("=").slice(1).join("=") : fallback;
}

function getApiKey() {
  return process.env.GEMINI_API_KEY
    || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    || process.env.VISION_API_KEY
    || null;
}

function parseSrt(srtText) {
  return srtText.split(/\n\n+/).map((block) => {
    const lines = block.trim().split("\n");
    if (lines.length < 3) return null;
    const timeLine = lines[1];
    const [start, end] = timeLine.split(" --> ").map((t) => {
      const [h, m, rest] = t.trim().split(":");
      const [s, ms] = rest.split(",");
      return (+h * 3600) + (+m * 60) + +s + +ms / 1000;
    });
    return { start, end, text: lines.slice(2).join(" ") };
  }).filter(Boolean);
}

function getVoiceoverAtTime(cues, timeSec) {
  const active = cues.filter((c) => timeSec >= c.start && timeSec <= c.end + 0.5);
  if (active.length) return active.map((c) => c.text).join(" ");
  const nearest = cues.reduce((best, c) => {
    const dist = Math.min(Math.abs(timeSec - c.start), Math.abs(timeSec - c.end));
    return dist < best.dist ? { dist, text: c.text } : best;
  }, { dist: Infinity, text: "" });
  return nearest.text;
}

function extractFrameAtTime(video, timeSec, outPath) {
  execFileSync(FFMPEG, [
    "-hide_banner", "-loglevel", "error",
    "-ss", String(timeSec),
    "-i", video,
    "-frames:v", "1",
    "-vf", "scale=540:960",
    "-y", outPath,
  ]);
}

function getVideoDuration(video) {
  const out = execFileSync(FFPROBE, [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1", video,
  ], { encoding: "utf-8" });
  return parseFloat(out.trim());
}

function computeBeatTimes(srtCues, duration) {
  const times = [];
  const interval = Math.max(1, duration / 12);
  for (let t = 0.5; t < duration - 0.3; t += interval) {
    times.push(t);
  }
  for (const cue of srtCues) {
    if (!times.some((t) => Math.abs(t - cue.start) < 0.5)) {
      times.push(cue.start + 0.1);
    }
  }
  times.sort((a, b) => a - b);
  const unique = [times[0]];
  for (let i = 1; i < times.length; i++) {
    if (times[i] - unique[unique.length - 1] > 0.8) unique.push(times[i]);
  }
  return unique.slice(0, 20);
}

async function reviewFrame(framePath, voiceoverText, frameIndex, totalFrames, apiKey, bible) {
  const base = "https://generativelanguage.googleapis.com/v1beta/openai";
  const model = "gemini-3.5-flash-lite";

  const rulesSummary = Object.entries(bible.rules)
    .map(([id, r]) => `${id} (${r.severity}): ${r.description}`)
    .join("\n");

  const prompt =
    `You are a visual QA editor for YouTube Shorts. Review this frame (${frameIndex + 1}/${totalFrames}).\n\n` +
    `VOICEOVER TEXT at this moment: "${voiceoverText}"\n\n` +
    `VISUAL BIBLE RULES:\n${rulesSummary}\n\n` +
    `Check this frame against EVERY rule. Be harsh — mediocre is not acceptable.\n\n` +
    `CRITICAL CHECKS:\n` +
    `1. Is the text on screen ONE LINE ONLY? (TYP-01 — any multi-line text = immediate FAIL)\n` +
    `2. Does the visual MATCH what the voiceover is saying? (VIS-01)\n` +
    `3. Is text readable with good contrast? (TYP-02)\n` +
    `4. Is there a clear focal point? (VIS-02)\n` +
    `5. Is the frame non-empty with real content? (VIS-03)\n\n` +
    `Respond ONLY with JSON, no markdown fences:\n` +
    `{\n` +
    `  "frame_index": ${frameIndex},\n` +
    `  "checks": { "<rule_id>": { "pass": true|false, "note": "<why>" } },\n` +
    `  "quality_score": <1-10>,\n` +
    `  "improvement": "<one specific fix>",\n` +
    `  "visual_audio_match": true|false,\n` +
    `  "visual_audio_note": "<how well visual matches audio>"\n` +
    `}`;

  const imageData = readFileSync(framePath).toString("base64");
  const body = JSON.stringify({
    model, max_tokens: 800, temperature: 0,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:image/png;base64,${imageData}` } },
      ],
    }],
  });

  let res;
  try {
    res = execFileSync("curl", [
      "-sS", "--max-time", "60",
      "-H", "Content-Type: application/json",
      "-H", `Authorization: Bearer ${apiKey}`,
      "-d", "@-",
      `${base}/chat/completions`,
    ], { input: body, encoding: "utf-8" });
  } catch (e) {
    return { frame_index: frameIndex, error: `API call failed: ${String(e.message).slice(0, 200)}` };
  }

  try {
    const raw = JSON.parse(res).choices[0].message.content.trim()
      .replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
    return JSON.parse(raw);
  } catch (e) {
    return { frame_index: frameIndex, error: `Could not parse response: ${String(res).slice(0, 300)}` };
  }
}

async function main() {
  const videoPath = arg("video");
  const scriptPath = arg("script");
  const srtPath = arg("srt");
  const channelId = arg("channel");
  const fixMode = process.argv.includes("--fix");

  if (!videoPath || !scriptPath) {
    console.error("Usage: gemini-frame-review.js --video <path> --script <path> --srt <path> --channel <id>");
    process.exit(2);
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("No Gemini API key found (GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY / VISION_API_KEY)");
    console.error("Gemini frame review SKIPPED — set an API key to enable per-beat visual QA.");
    process.exit(0);
  }

  const video = existsSync(videoPath) ? videoPath : join(ROOT, videoPath);
  if (!existsSync(video)) { console.error(`Video not found: ${videoPath}`); process.exit(2); }

  const bible = JSON.parse(readFileSync(join(ROOT, "config", "visual-bible.json"), "utf-8"));

  let srtCues = [];
  const srt = srtPath && existsSync(srtPath) ? srtPath : (srtPath ? join(ROOT, srtPath) : null);
  if (srt && existsSync(srt)) {
    srtCues = parseSrt(readFileSync(srt, "utf-8").replace(/\r\n/g, "\n"));
    console.log(`SRT loaded: ${srtCues.length} cues`);
  } else {
    console.warn("No SRT file — voiceover text unavailable for visual-audio alignment checks.");
  }

  const duration = getVideoDuration(video);
  console.log(`Video duration: ${duration.toFixed(2)}s`);

  const beatTimes = computeBeatTimes(srtCues, duration);
  console.log(`Sampling ${beatTimes.length} frames at beat points`);

  const work = join(tmpdir(), `gemini-review-${Date.now()}`);
  mkdirSync(work, { recursive: true });

  const results = [];
  let passed = 0;
  let failed = 0;

  try {
    for (let i = 0; i < beatTimes.length; i++) {
      const t = beatTimes[i];
      const framePath = join(work, `beat-${String(i).padStart(2, "0")}.png`);
      extractFrameAtTime(video, t, framePath);

      const voText = srtCues.length ? getVoiceoverAtTime(srtCues, t) : "(no SRT available)";
      console.log(`  [${i + 1}/${beatTimes.length}] t=${t.toFixed(1)}s — VO: "${voText.slice(0, 60)}..."`);

      const result = await reviewFrame(framePath, voText, i, beatTimes.length, apiKey, bible);
      result.time_seconds = t;
      result.voiceover_text = voText;
      results.push(result);

      if (result.error) {
        console.log(`    ERROR: ${result.error}`);
        continue;
      }

      const failedChecks = Object.entries(result.checks || {})
        .filter(([, v]) => !v.pass)
        .map(([id, v]) => `${id}: ${v.note}`);

      if (failedChecks.length === 0) {
        passed++;
        console.log(`    PASS (score: ${result.quality_score}/10)`);
      } else {
        failed++;
        console.log(`    FAIL (score: ${result.quality_score}/10) — ${failedChecks.length} issue(s):`);
        for (const f of failedChecks) console.log(`      - ${f}`);
      }

      if (!result.visual_audio_match) {
        console.log(`    AUDIO MISMATCH: ${result.visual_audio_note}`);
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  const record = {
    generatedAt: new Date().toISOString(),
    video: basename(video),
    channel: channelId,
    totalFrames: beatTimes.length,
    passed,
    failed,
    passRate: beatTimes.length > 0 ? `${((passed / beatTimes.length) * 100).toFixed(0)}%` : "N/A",
    avgScore: results.filter((r) => r.quality_score).length > 0
      ? (results.reduce((s, r) => s + (r.quality_score || 0), 0) / results.filter((r) => r.quality_score).length).toFixed(1)
      : "N/A",
    results,
  };

  const outDir = join(ROOT, "data", "audit", "gemini-review");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${channelId || "unknown"}-${basename(video, ".mp4")}-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(outFile, JSON.stringify(record, null, 2) + "\n");

  console.log(`\n=== GEMINI FRAME REVIEW ===`);
  console.log(`  Frames reviewed: ${beatTimes.length}`);
  console.log(`  Passed: ${passed}  Failed: ${failed}`);
  console.log(`  Pass rate: ${record.passRate}`);
  console.log(`  Avg quality score: ${record.avgScore}/10`);
  console.log(`  Report: ${outFile}`);

  const blockerFails = results.filter((r) => {
    if (!r.checks) return false;
    return Object.entries(r.checks).some(([id]) => {
      const rule = bible.rules[id];
      return rule && rule.severity === "BLOCKER" && !r.checks[id].pass;
    });
  });

  if (blockerFails.length > 0) {
    console.log(`\n  BLOCKER failures in ${blockerFails.length} frame(s):`);
    for (const r of blockerFails) {
      const blockers = Object.entries(r.checks)
        .filter(([id, v]) => !v.pass && bible.rules[id]?.severity === "BLOCKER")
        .map(([id, v]) => `${id}: ${v.note}`);
      console.log(`    Frame ${r.frame_index} (t=${r.time_seconds?.toFixed(1)}s): ${blockers.join("; ")}`);
    }
    console.log(`\n  VERDICT: NEEDS IMPROVEMENT — ${blockerFails.length} frame(s) have blocker-level issues.`);
    if (!fixMode) process.exit(1);
  } else {
    console.log(`\n  VERDICT: ACCEPTABLE — no blocker-level failures.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
