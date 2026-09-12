#!/usr/bin/env node
/**
 * Gemini Visual Director — per-beat + whole-video review using Gemini 3.5 Flash Lite.
 *
 * Not a passive QA checker. This is the visual post-production director:
 * inspects actual rendered pixels, compares against the Visual Bible,
 * and produces structured correction instructions when the video fails.
 *
 * Usage:
 *   node scripts/gemini-frame-review.js --video <path> --script <path> --srt <path> --channel <id>
 *   node scripts/gemini-frame-review.js --video <path> --script <path> --srt <path> --channel <id> --fix
 *
 * --fix   Outputs actionable corrections the pipeline can use to re-render.
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

function callGemini(apiKey, messages, maxTokens = 1200) {
  const base = "https://generativelanguage.googleapis.com/v1beta/openai";
  const model = "gemini-3.5-flash-lite";
  const body = JSON.stringify({ model, max_tokens: maxTokens, temperature: 0, messages });
  try {
    const res = execFileSync("curl", [
      "-sS", "--max-time", "90",
      "-H", "Content-Type: application/json",
      "-H", `Authorization: Bearer ${apiKey}`,
      "-d", "@-",
      `${base}/chat/completions`,
    ], { input: body, encoding: "utf-8" });
    const raw = JSON.parse(res).choices[0].message.content.trim()
      .replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
    return JSON.parse(raw);
  } catch (e) {
    return { error: `API call failed: ${String(e.message).slice(0, 300)}` };
  }
}

function buildScenePrompt(bible, frameIndex, totalFrames, time, voiceover) {
  return bible.prompts.scene_review
    .replace("{frame_index}", String(frameIndex))
    .replace("{total_frames}", String(totalFrames))
    .replace("{time}", time.toFixed(1))
    .replace("{voiceover}", voiceover.replace(/"/g, '\\"'));
}

async function reviewFrame(framePath, voiceoverText, frameIndex, totalFrames, time, apiKey, bible) {
  const prompt = buildScenePrompt(bible, frameIndex, totalFrames, time, voiceoverText);
  const imageData = readFileSync(framePath).toString("base64");
  const messages = [{
    role: "user",
    content: [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: `data:image/png;base64,${imageData}` } },
    ],
  }];
  const result = callGemini(apiKey, messages);
  if (!result.error) {
    result.frame_index = frameIndex;
    result.time_seconds = time;
    result.voiceover_text = voiceoverText;
  }
  return result;
}

async function reviewWholeVideo(framePaths, beatTimes, srtCues, duration, apiKey, bible) {
  const step = Math.max(1, Math.floor(framePaths.length / 8));
  const selected = [];
  selected.push(0);
  for (let i = step; i < framePaths.length - 1; i += step) selected.push(i);
  selected.push(framePaths.length - 1);
  const unique = [...new Set(selected)].sort((a, b) => a - b).slice(0, 10);

  const prompt = bible.prompts.whole_video_review
    .replace("{total_frames}", String(unique.length))
    .replace("{duration}", duration.toFixed(1));

  const content = [{ type: "text", text: prompt }];
  for (const idx of unique) {
    const imageData = readFileSync(framePaths[idx]).toString("base64");
    const t = beatTimes[idx];
    const vo = srtCues.length ? getVoiceoverAtTime(srtCues, t) : "(no SRT)";
    content.push({ type: "text", text: `\n--- Frame ${idx + 1}/${unique.length} at t=${t.toFixed(1)}s | VO: "${vo.slice(0, 80)}" ---` });
    content.push({ type: "image_url", image_url: { url: `data:image/png;base64,${imageData}` } });
  }

  return callGemini(apiKey, [{ role: "user", content }], 1600);
}

function categorizeResult(result, bible) {
  if (result.error) return { tier: "ERROR", blocking: false };
  const status = result.status || (result.quality_score >= 6 ? "PASS" : "FAIL");
  const severity = result.severity || null;

  const criticalRuleFails = Object.entries(result.checks || {}).filter(([id, v]) => {
    const rule = bible.rules[id];
    return rule && rule.severity === "CRITICAL" && !v.pass;
  });
  const highRuleFails = Object.entries(result.checks || {}).filter(([id, v]) => {
    const rule = bible.rules[id];
    return rule && rule.severity === "HIGH" && !v.pass;
  });

  if (criticalRuleFails.length > 0 || severity === "CRITICAL") {
    return { tier: "CRITICAL", blocking: true, criticalRuleFails, highRuleFails };
  }
  if (highRuleFails.length > 0 || severity === "HIGH") {
    return { tier: "HIGH", blocking: false, criticalRuleFails, highRuleFails };
  }
  if (status === "FAIL") {
    return { tier: severity || "MEDIUM", blocking: false, criticalRuleFails, highRuleFails };
  }
  return { tier: "PASS", blocking: false, criticalRuleFails, highRuleFails };
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
    console.error("Gemini visual director review SKIPPED — set an API key to enable.");
    process.exit(0);
  }

  const video = existsSync(videoPath) ? videoPath : join(ROOT, videoPath);
  if (!existsSync(video)) { console.error(`Video not found: ${videoPath}`); process.exit(2); }

  const bible = JSON.parse(readFileSync(join(ROOT, "config", "visual-bible.json"), "utf-8"));
  console.log(`Visual Bible v${bible.version} loaded — ${Object.keys(bible.rules).length} rules, ${bible.failure_categories.length} failure categories`);

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

  const sceneResults = [];
  const framePaths = [];
  let criticalCount = 0;
  let highCount = 0;
  let passCount = 0;

  try {
    // ── PHASE 1: Scene-level review ──
    console.log("\n═══ PHASE 1: SCENE-BY-SCENE REVIEW ═══\n");
    for (let i = 0; i < beatTimes.length; i++) {
      const t = beatTimes[i];
      const framePath = join(work, `beat-${String(i).padStart(2, "0")}.png`);
      extractFrameAtTime(video, t, framePath);
      framePaths.push(framePath);

      const voText = srtCues.length ? getVoiceoverAtTime(srtCues, t) : "(no SRT available)";
      console.log(`  [${i + 1}/${beatTimes.length}] t=${t.toFixed(1)}s — VO: "${voText.slice(0, 60)}..."`);

      const result = await reviewFrame(framePath, voText, i, beatTimes.length, t, apiKey, bible);
      sceneResults.push(result);

      if (result.error) {
        console.log(`    ERROR: ${result.error}`);
        continue;
      }

      const cat = categorizeResult(result, bible);
      const status = result.status || "UNKNOWN";
      const score = result.quality_score || "?";

      if (cat.tier === "CRITICAL") {
        criticalCount++;
        console.log(`    ✗ CRITICAL (score: ${score}/10) — ${status}`);
        if (result.problem) console.log(`      Problem: ${result.problem}`);
        if (result.correction?.action) console.log(`      Fix: ${result.correction.action}`);
        if (cat.criticalRuleFails?.length) {
          for (const [id, v] of cat.criticalRuleFails) console.log(`      ${id}: ${v.note}`);
        }
      } else if (cat.tier === "HIGH") {
        highCount++;
        console.log(`    ! HIGH (score: ${score}/10) — ${status}`);
        if (result.problem) console.log(`      Problem: ${result.problem}`);
        if (cat.highRuleFails?.length) {
          for (const [id, v] of cat.highRuleFails) console.log(`      ${id}: ${v.note}`);
        }
      } else {
        passCount++;
        console.log(`    ✓ PASS (score: ${score}/10)`);
      }

      if (!result.visual_audio_match) {
        console.log(`    AUDIO MISMATCH: ${result.visual_audio_note}`);
      }

      const slopFail = result.quality_tests?.ANTI_SLOP_TEST;
      if (slopFail && !slopFail.pass) {
        console.log(`    SLOP: ${slopFail.note}`);
      }
    }

    // ── PHASE 2: Whole-video review ──
    console.log("\n═══ PHASE 2: WHOLE-VIDEO REVIEW ═══\n");
    const wholeResult = await reviewWholeVideo(framePaths, beatTimes, srtCues, duration, apiKey, bible);

    if (wholeResult.error) {
      console.log(`  Whole-video review ERROR: ${wholeResult.error}`);
    } else {
      console.log(`  Overall score: ${wholeResult.overall_score || "?"}/10`);
      console.log(`  Status: ${wholeResult.status || "UNKNOWN"}`);
      console.log(`  Verdict: ${wholeResult.verdict || "(none)"}`);

      if (wholeResult.repetition_issues?.length) {
        console.log(`  Repetition issues:`);
        for (const r of wholeResult.repetition_issues) console.log(`    - ${r}`);
      }
      if (wholeResult.slop_indicators?.length) {
        console.log(`  Slop indicators:`);
        for (const s of wholeResult.slop_indicators) console.log(`    - ${s}`);
      }
      if (wholeResult.pacing_assessment) {
        console.log(`  Pacing: ${wholeResult.pacing_assessment}`);
      }
      if (wholeResult.opening_assessment) {
        console.log(`  Opening: ${wholeResult.opening_assessment}`);
      }
      if (wholeResult.strongest_scene) {
        console.log(`  Strongest: Frame ${wholeResult.strongest_scene.index} — ${wholeResult.strongest_scene.why}`);
      }
      if (wholeResult.weakest_scene) {
        console.log(`  Weakest: Frame ${wholeResult.weakest_scene.index} — ${wholeResult.weakest_scene.why}`);
      }
      if (wholeResult.corrections?.length) {
        console.log(`  Corrections needed:`);
        for (const c of wholeResult.corrections) {
          console.log(`    ${c.scene}: ${c.problem} → ${c.fix}`);
        }
      }
    }

    // ── Build report ──
    const avgScore = sceneResults.filter((r) => r.quality_score).length > 0
      ? (sceneResults.reduce((s, r) => s + (r.quality_score || 0), 0) / sceneResults.filter((r) => r.quality_score).length).toFixed(1)
      : "N/A";

    const record = {
      generatedAt: new Date().toISOString(),
      bibleVersion: bible.version,
      video: basename(video),
      channel: channelId,
      duration: duration.toFixed(2),
      totalFrames: beatTimes.length,
      summary: {
        critical: criticalCount,
        high: highCount,
        passed: passCount,
        avgScore,
        passRate: beatTimes.length > 0
          ? `${((passCount / beatTimes.length) * 100).toFixed(0)}%`
          : "N/A",
      },
      sceneResults,
      wholeVideoResult: wholeResult,
      failureCategories: [...new Set(
        sceneResults.flatMap((r) => r.categories || [])
          .concat(wholeResult.categories || [])
      )],
      corrections: fixMode ? [
        ...sceneResults.filter((r) => r.correction?.action).map((r) => ({
          scene: r.scene || `beat_${r.frame_index}`,
          level: r.correction.level,
          action: r.correction.action,
          severity: r.severity,
        })),
        ...(wholeResult.corrections || []),
      ] : [],
    };

    const outDir = join(ROOT, "data", "audit", "gemini-review");
    mkdirSync(outDir, { recursive: true });
    const outFile = join(outDir, `${channelId || "unknown"}-${basename(video, ".mp4")}-${new Date().toISOString().slice(0, 10)}.json`);
    writeFileSync(outFile, JSON.stringify(record, null, 2) + "\n");

    // ── Final verdict ──
    console.log(`\n═══ GEMINI VISUAL DIRECTOR — FINAL VERDICT ═══`);
    console.log(`  Bible: v${bible.version} (${Object.keys(bible.rules).length} rules)`);
    console.log(`  Frames reviewed: ${beatTimes.length}`);
    console.log(`  CRITICAL: ${criticalCount}  HIGH: ${highCount}  PASS: ${passCount}`);
    console.log(`  Avg quality: ${avgScore}/10`);
    console.log(`  Pass rate: ${record.summary.passRate}`);
    console.log(`  Whole-video: ${wholeResult.status || "ERROR"} (${wholeResult.overall_score || "?"}/10)`);
    console.log(`  Report: ${outFile}`);

    if (criticalCount > 0) {
      console.log(`\n  VERDICT: REJECTED — ${criticalCount} CRITICAL failure(s) require re-render.`);
      if (fixMode) {
        console.log(`  Corrections written to report. Pipeline should apply and re-render.`);
      }
      process.exit(1);
    } else if (highCount > Math.floor(beatTimes.length * 0.3)) {
      console.log(`\n  VERDICT: NEEDS IMPROVEMENT — ${highCount} HIGH issues across ${beatTimes.length} frames.`);
      if (!fixMode) process.exit(1);
    } else if (wholeResult.status === "FAIL" && (wholeResult.severity === "CRITICAL" || wholeResult.severity === "HIGH")) {
      console.log(`\n  VERDICT: NEEDS IMPROVEMENT — whole-video review flagged ${wholeResult.severity} issues.`);
      if (!fixMode) process.exit(1);
    } else {
      console.log(`\n  VERDICT: APPROVED — video meets Visual Bible standards.`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
