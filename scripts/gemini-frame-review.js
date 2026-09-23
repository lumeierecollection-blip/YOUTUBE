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
import { callGemini } from "../src/lib/gemini-client.js";
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
  const result = callGemini(messages);
  if (!result.error) {
    result.frame_index = frameIndex;
    result.time_seconds = time;
    result.voiceover_text = voiceoverText;
  }
  return result;
}

/**
 * Batched frame review — sends multiple frames in one Gemini call.
 * Reduces API overhead from N calls to ceil(N/BATCH_SIZE) calls.
 *
 * @param {Array<{path: string, index: number, time: number, voiceover: string}>} frames
 * @param {number} totalFrames
 * @param {Object} bible
 * @returns {Promise<Array<Object>>} Array of results, one per frame
 */
async function reviewFrameBatch(frames, totalFrames, bible) {
  if (!frames.length) return [];

  const BATCH_SIZE = 10;
  const results = [];

  for (let b = 0; b < frames.length; b += BATCH_SIZE) {
    const batch = frames.slice(b, b + BATCH_SIZE);

    // Build a single prompt for the batch
    const batchDescription = batch.map((f, i) =>
      `Frame ${f.index + 1}/${totalFrames} at t=${f.time.toFixed(1)}s — VO: "${f.voiceover.slice(0, 80)}"`
    ).join("\n");

    const prompt =
      `You are reviewing ${batch.length} frames from one video. ` +
      `For EACH frame, provide a separate JSON object in an array.\n\n` +
      `Frames:\n${batchDescription}\n\n` +
      `Answer ONLY with a JSON array, no prose, no markdown fences:\n` +
      `[\n` +
      `  {\n` +
      `    "frame_index": <number>,\n` +
      `    "time_seconds": <number>,\n` +
      `    "status": "PASS"|"FAIL",\n` +
      `    "quality_score": <1-10>,\n` +
      `    "problem": "<one sentence if FAIL, else empty>",\n` +
      `    "correction": { "action": "<what to fix>" },\n` +
      `    "visual_audio_match": true|false,\n` +
      `    "visual_audio_note": "<if mismatch, why>"\n` +
      `  },\n` +
      `  ...\n` +
      `]\n\n` +
      `Rules:\n` +
      `- Each frame must have its own object.\n` +
      `- frame_index must match the frame number above.\n` +
      `- quality_score: 1=terrible, 10=perfect.\n` +
      `- Be harsh but fair. Flag real problems, not style preferences.`;

    // Build content with text + all images in batch
    const content = [{ type: "text", text: prompt }];
    for (const f of batch) {
      const imageData = readFileSync(f.path).toString("base64");
      content.push({ type: "text", text: `\n--- Frame ${f.index + 1} at t=${f.time.toFixed(1)}s ---` });
      content.push({ type: "image_url", image_url: { url: `data:image/png;base64,${imageData}` } });
    }

    const batchResult = await callGemini([{ role: "user", content }], { maxTokens: 2000 });

    if (batchResult.error) {
      // Retry batch once instead of falling back to N individual calls
      console.warn(`  Batch ${Math.floor(b / BATCH_SIZE) + 1} failed: ${batchResult.error} — retrying once`);
      const retryResult = await callGemini([{ role: "user", content }], { maxTokens: 2000 });
      if (retryResult.error) {
        console.warn(`  Batch ${Math.floor(b / BATCH_SIZE) + 1} retry failed — skipping ${batch.length} frames`);
        continue;
      }
      const retryItems = Array.isArray(retryResult) ? retryResult : [retryResult];
      for (let i = 0; i < batch.length; i++) {
        const item = retryItems[i] || { error: "Missing from retry response" };
        item.frame_index = batch[i].index;
        item.time_seconds = batch[i].time;
        item.voiceover_text = batch[i].voiceover;
        results.push(item);
      }
      continue;
    }

    // Parse batch result — should be an array
    const items = Array.isArray(batchResult) ? batchResult : [batchResult];
    for (let i = 0; i < batch.length; i++) {
      const item = items[i] || { error: "Missing from batch response" };
      item.frame_index = batch[i].index;
      item.time_seconds = batch[i].time;
      item.voiceover_text = batch[i].voiceover;
      results.push(item);
    }
  }

  return results;
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

  return callGemini([{ role: "user", content }], { maxTokens: 1600 });
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

/* ── Per-beat check ──────────────────────────────────────────────────
 *
 *   node scripts/gemini-frame-review.js --beat-check --video <mp4> \
 *        --manifest <render-manifest.json> --srt <vo.srt> [--out <json>]
 *
 * One frame at the MIDPOINT of every beat (timings from the render
 * manifest render.js writes), each paired with that beat's sentence (SRT
 * cue i ↔ beat i), sent to Gemini in one call. For each: does this frame
 * visually correspond to this sentence — YES or NO?
 *
 * Exit 0 = at most 1 beat NO. Exit 1 = more than 1 beat NO (listed).
 * Exit 3 = the check could not run (no key, no answer, unreadable answer,
 * wrong number of verdicts). Nothing defaults to a pass — the full review
 * below exits 0 "SKIPPED" when no key is set, which is how a missing check
 * looked like a passing one.
 */
async function beatCheck() {
  const videoPath = arg("video");
  const manifestPath = arg("manifest");
  const srtPath = arg("srt");
  const outPath = arg("out");
  if (!videoPath || !manifestPath || !srtPath) {
    console.error("Usage: gemini-frame-review.js --beat-check --video <mp4> --manifest <manifest.json> --srt <vo.srt> [--out <json>]");
    process.exit(2);
  }
  if (!getApiKey()) {
    console.error("::error::beat check cannot run: no Gemini API key");
    process.exit(3);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const cues = parseSrt(readFileSync(srtPath, "utf-8").replace(/\r\n/g, "\n"));
  const beats = manifest.beats || [];
  if (!beats.length) {
    console.error("::error::beat check: manifest has no beats");
    process.exit(3);
  }
  const work = join(tmpdir(), `beat-check-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  const content = [{
    type: "text",
    text: `You are checking a finished YouTube Short, beat by beat. For each beat you get the narration sentence spoken during it and ONE frame from the middle of that beat.
Question for every beat: does this frame VISUALLY correspond to this sentence — would a viewer with the sound off get the sentence's point from what is drawn?
Answer NO when the frame is only a line of text restating or labelling the sentence with no visual that shows its idea, when the frame is blank, or when what is drawn is unrelated to the sentence.
Respond ONLY with JSON: {"beats":[{"beat_index":<n>,"matches":"YES"|"NO","what_is_shown":"<what the frame actually contains>","reason":"<one sentence>"}]} — exactly one entry per beat, beat_index 0..${beats.length - 1}.`,
  }];
  try {
    beats.forEach((b, i) => {
      const mid = (b.start_sec ?? 0) + (b.duration_sec ?? 0) / 2;
      const framePath = join(work, `beat-${String(i).padStart(2, "0")}.png`);
      extractFrameAtTime(videoPath, mid, framePath);
      const sentence = cues[i]?.text ?? "(no sentence)";
      content.push({ type: "text", text: `Beat ${i} (frame at ${mid.toFixed(2)}s). Sentence: "${sentence}"` });
      content.push({ type: "image_url", image_url: { url: `data:image/png;base64,${readFileSync(framePath).toString("base64")}` } });
    });
    console.log(`[beat-check] ${beats.length} beat frames extracted at midpoints — asking Gemini`);
    const result = await callGemini([{ role: "user", content }], { maxTokens: 2048, temperature: 0, noCache: true });
    if (result?.error) {
      console.error(`::error::beat check unavailable: ${result.error}`);
      process.exit(3);
    }
    const verdicts = Array.isArray(result?.beats) ? result.beats : null;
    if (!verdicts || verdicts.length !== beats.length) {
      console.error(`::error::beat check returned ${verdicts ? verdicts.length : "no"} verdict(s) for ${beats.length} beats: ${JSON.stringify(result).slice(0, 300)}`);
      process.exit(3);
    }
    for (const v of verdicts) {
      console.log(`[beat-check] beat ${v.beat_index}: ${v.matches} — shows: ${v.what_is_shown} — ${v.reason}`);
    }
    const failing = verdicts.filter((v) => String(v.matches).toUpperCase() !== "YES");
    if (outPath) {
      writeFileSync(outPath, JSON.stringify({ checkedAt: new Date().toISOString(), video: videoPath, beats: verdicts.map((v) => ({ ...v, sentence: cues[v.beat_index]?.text ?? null })), failing: failing.map((v) => v.beat_index) }, null, 2) + "\n");
    }
    if (failing.length > 1) {
      console.error(`::error::beat check failed: ${failing.length}/${beats.length} beats do not visually match their sentence — beats ${failing.map((v) => v.beat_index).join(", ")}`);
      process.exit(1);
    }
    console.log(`[beat-check] PASS: ${beats.length - failing.length}/${beats.length} beats match their sentence`);
    process.exit(0);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

async function main() {
  if (process.argv.includes("--beat-check")) return beatCheck();
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
    // ── PHASE 1: Scene-level review (BATCHED) ──
    console.log("\n═══ PHASE 1: SCENE-BY-SCENE REVIEW (BATCHED) ═══\n");

    // Extract all frames first
    const frameData = [];
    for (let i = 0; i < beatTimes.length; i++) {
      const t = beatTimes[i];
      const framePath = join(work, `beat-${String(i).padStart(2, "0")}.png`);
      extractFrameAtTime(video, t, framePath);
      framePaths.push(framePath);
      const voText = srtCues.length ? getVoiceoverAtTime(srtCues, t) : "(no SRT available)";
      frameData.push({ path: framePath, index: i, time: t, voiceover: voText });
      console.log(`  [${i + 1}/${beatTimes.length}] t=${t.toFixed(1)}s — VO: "${voText.slice(0, 60)}..."`);
    }

    // Batch review: 5 frames per call instead of 1
    const batchResults = await reviewFrameBatch(frameData, beatTimes.length, bible);

    for (const result of batchResults) {
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

      const headlineFail = result.quality_tests?.HEADLINE_TEST;
      if (headlineFail && !headlineFail.pass) {
        console.log(`    HEADLINE: ${headlineFail.note}`);
      }

      const contFail = result.quality_tests?.CONTINUITY_TEST;
      if (contFail && !contFail.pass) {
        console.log(`    CONTINUITY: ${contFail.note}`);
      }

      const graphFail = result.quality_tests?.GRAPH_TEST;
      if (graphFail && !graphFail.pass) {
        console.log(`    GRAPH: ${graphFail.note}`);
      }

      const iconFail = result.quality_tests?.ICON_TEST;
      if (iconFail && !iconFail.pass) {
        console.log(`    ICON: ${iconFail.note}`);
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
      if (wholeResult.headline_test) {
        const ht = wholeResult.headline_test;
        console.log(`  Headline test: ${ht.headline_beat_count}/${ht.total_beats} headline-dominated (${ht.percent}%) — ${ht.pass ? "PASS" : "FAIL"}${ht.monoculture ? " — TEMPLATE_MONOCULTURE" : ""}`);
      }
      if (wholeResult.continuity_score != null) {
        console.log(`  Continuity: ${wholeResult.continuity_score}/10`);
      }
      if (wholeResult.motion_weight_score != null) {
        console.log(`  Motion weight: ${wholeResult.motion_weight_score}/10`);
      }
      if (wholeResult.slop_indicators?.length) {
        console.log(`  Slop indicators:`);
        for (const s of wholeResult.slop_indicators) console.log(`    - ${s}`);
      }
      if (wholeResult.decoration_issues?.length) {
        console.log(`  Decoration issues:`);
        for (const d of wholeResult.decoration_issues) console.log(`    - ${d}`);
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

    const monoculture = wholeResult.headline_test?.monoculture;

    if (criticalCount > 0 || monoculture) {
      const reason = monoculture
        ? `TEMPLATE_MONOCULTURE — ${wholeResult.headline_test.percent}% headline-dominated beats`
        : `${criticalCount} CRITICAL failure(s)`;
      console.log(`\n  VERDICT: REJECTED — ${reason} require re-render.`);
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
