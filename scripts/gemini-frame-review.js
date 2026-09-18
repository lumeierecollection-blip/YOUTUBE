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
  // Sample each beat at its SETTLED midpoint, not its start. The renderer
  // crossfades between beats over ~12 frames (0.4s) at every boundary
  // (DirectedScene.transitionOpacity), and previously this sampled at
  // cue.start + 0.1s — frame 3, squarely inside that crossfade — so QA
  // was grading double-exposed transition frames (two beats' visuals
  // overlaid) instead of the composition each beat actually presents.
  // That inflated both "headline/monoculture" and overlap readings.
  // Cue midpoint is past the entrance fade and before the exit fade.
  const times = [];
  if (srtCues.length) {
    for (const cue of srtCues) {
      const mid = (cue.start + Math.min(cue.end, duration)) / 2;
      times.push(Math.max(0.5, Math.min(duration - 0.5, mid)));
    }
  } else {
    const interval = Math.max(1, duration / 12);
    for (let t = 0.7; t < duration - 0.5; t += interval) times.push(t);
  }
  times.sort((a, b) => a - b);
  const unique = [times[0]];
  for (let i = 1; i < times.length; i++) {
    if (times[i] - unique[unique.length - 1] > 0.8) unique.push(times[i]);
  }
  return unique.slice(0, 20);
}

async function callGemini(apiKey, messages, maxTokens = 1200) {
  const base = "https://generativelanguage.googleapis.com/v1beta/openai";
  const model = "gemini-3.5-flash-lite";
  const body = JSON.stringify({ model, max_tokens: maxTokens, temperature: 0, messages });
  try {
    // fetch(), not execFileSync curl — a synchronous child process blocks
    // the whole event loop for the request's duration, which made
    // scene-by-scene review structurally impossible to overlap even when
    // called from concurrent workers. fetch() lets the reviewWorker pool
    // above actually run requests in parallel.
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body,
      signal: AbortSignal.timeout(90000),
    });
    const json = await res.json();
    if (!res.ok || !json.choices?.[0]?.message) {
      return { error: `API call failed: ${res.status} ${JSON.stringify(json).slice(0, 300)}` };
    }
    const raw = json.choices[0].message.content.trim()
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
  const result = await callGemini(apiKey, messages);
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

/* ── Plan-compliance review — intended (director) vs actual (render) ──── */

// Map a frame time to the plan beat that governs it. Plan beats align 1:1
// with SRT sentences (index i = sentence i), so the beat for time t is the
// one whose cue window contains t.
function planBeatAtTime(planBeats, srtCues, t) {
  if (!planBeats || !srtCues.length) return null;
  let idx = srtCues.findIndex((c) => t >= c.start && t <= c.end + 0.3);
  if (idx < 0) {
    // nearest cue start
    idx = srtCues.reduce((best, c, i) => Math.abs(c.start - t) < Math.abs(srtCues[best].start - t) ? i : best, 0);
  }
  return planBeats[idx] || null;
}

function directionSummary(beat) {
  const d = beat?.direction || {};
  const td = beat?.typography_direction || null;
  const parts = [];
  if (d.subject) parts.push(`subject: ${d.subject}`);
  if (d.action_start || d.action_end) parts.push(`change: ${d.action_start || "?"} -> ${d.action_end || "?"}`);
  if (d.camera) parts.push(`camera: ${d.camera}`);
  if (d.motion) parts.push(`motion: ${d.motion}`);
  // Narrative typography is stated as an explicit directed phrase + the
  // narrative moment it serves, so the review can check BEHAVIOUR (emphasis
  // vs headline), not just whether some text appeared.
  if (td?.phrase) parts.push(`directed phrase: "${td.phrase}" (${td.moment || "statement"}; narrative emphasis, ONE line, centred)`);
  else if (d.typography && String(d.typography).toLowerCase() !== "none") parts.push(`text: ${d.typography}`);
  else parts.push("text: none (this beat must carry NO on-screen text)");
  if (d.muted_read) parts.push(`muted-read: ${d.muted_read}`);
  if (!parts.length && beat?.visual_headline) parts.push(`phrase: ${beat.visual_headline} (${beat.mechanism || "?"})`);
  return parts.join(" | ") || "(no direction)";
}

// The heart of the closed loop: Gemini directed each beat, now it sees the
// actual frames and reports, per beat, whether the render EXECUTED that
// direction — classifying each miss by OWNER so corrections route to the
// right place instead of a vague "looks bad".
async function reviewPlanCompliance(framePaths, beatTimes, srtCues, planBeats, apiKey) {
  const step = Math.max(1, Math.floor(framePaths.length / 8));
  const selected = [0];
  for (let i = step; i < framePaths.length - 1; i += step) selected.push(i);
  selected.push(framePaths.length - 1);
  const unique = [...new Set(selected)].sort((a, b) => a - b).slice(0, 10);

  const prompt = `You are the VISUAL DIRECTOR reviewing whether the render EXECUTED your direction.
For each frame you are given the DIRECTION you wrote for that beat and the ACTUAL rendered frame.
Do NOT judge whether the video "looks good" in the abstract. Judge COMPLIANCE and assign an OWNER for every miss.

For each frame decide:
- observed: what the frame ACTUALLY shows (one line).
- compliance: MATCH (render delivered the directed event) | PARTIAL (some of it) | FAIL (it did not).
- failure_owner (only when not MATCH), exactly one of:
    DIRECTION_QUALITY  — the DIRECTION itself was lazy/generic (e.g. it just asked for a chart or the text); fix by re-directing.
    PLAN_COMPLIANCE    — the direction was good but the render did NOT execute it (directed a growing document stack, got a generic bar); fix the implementation.
    RENDER_TECHNICAL   — a technical rendering defect (empty, broken, cut off).
    CONTENT_FACTUAL    — the frame shows a fabricated/incorrect number, label, or claim not supported by the script.
    QA                 — safe-area/contrast/legibility defect.
- correction: one concrete instruction to fix it, addressed to the owner.

NARRATIVE TYPOGRAPHY — judge BEHAVIOUR, not looks. Do NOT ask "does the text
look good?". For every frame with on-screen text ask: does it behave as
NARRATIVE EMPHASIS according to the direction — ONE short centred line (2-7
words) that emphasises what the narrator is saying while the visual
independently demonstrates the idea? Or does it behave as PROHIBITED headline/
subtitle typography? Set typography_behaviour per frame to exactly one of:
  NARRATIVE_EMPHASIS  — correct: one centred line, emphasis, works with the visual
  HEADLINE            — a section/article/topic title or label ("The Problem",
                        "The Psychology Behind It"), or a title+subtitle structure
  SUBTITLE            — the narration verbatim or merely restated; a caption track
  MULTI_LINE          — two or more lines / stacked text / headline+subhead
  DESCRIBES_VISUAL    — text that just labels what is already on screen
  UNMOTIVATED         — text present with no narrative reason to emphasise anything
  NONE                — no on-screen text in this frame (correct when none was directed)
Anything other than NARRATIVE_EMPHASIS or NONE is a failure: owner
DIRECTION_QUALITY when the PLAN asked for it, PLAN_COMPLIANCE when the plan
directed a proper phrase but the render produced something else (wrong text,
extra text, stacked lines, or text where none was directed).

Also judge the whole sequence: is it template monoculture (same headline/chart
language repeated)? Is typography being used as a DEFAULT treatment rather than
selective emphasis (text in most beats, TEXT->TEXT->TEXT runs)? Does the visual
argument stay continuous?

Respond ONLY with JSON (no fences):
{
  "beat_compliance": [
    { "frame": <int>, "directed": "<short>", "observed": "<short>", "compliance": "MATCH|PARTIAL|FAIL", "typography_behaviour": "<one of the labels above>", "failure_owner": "<one of the owners or null>", "correction": "<short or null>" }
  ],
  "monoculture": true|false,
  "typography_is_default_treatment": true|false,
  "typography_notes": "<one sentence on how typography behaved across the video>",
  "continuity_ok": true|false,
  "dominant_failure_owner": "<the owner responsible for the most/worst misses, or null>",
  "overall_compliance": "MATCH|PARTIAL|FAIL",
  "summary": "<one sentence: did the render execute the direction, and if not, whose fault>"
}`;

  const content = [{ type: "text", text: prompt }];
  for (const idx of unique) {
    const t = beatTimes[idx];
    const beat = planBeatAtTime(planBeats, srtCues, t);
    const vo = srtCues.length ? getVoiceoverAtTime(srtCues, t) : "(no SRT)";
    const imageData = readFileSync(framePaths[idx]).toString("base64");
    content.push({ type: "text", text: `\n--- Frame ${idx + 1} at t=${t.toFixed(1)}s\nVO: "${vo.slice(0, 90)}"\nDIRECTED: ${directionSummary(beat)} ---` });
    content.push({ type: "image_url", image_url: { url: `data:image/png;base64,${imageData}` } });
  }
  return callGemini(apiKey, [{ role: "user", content }], 2000);
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
  const planPath = arg("plan");
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

  // The AUTHORITATIVE visual direction (data/visual-plans/.../*-visual-plan.json).
  // When present, the post-render review becomes a PLAN-COMPLIANCE check —
  // did the rendered video execute the directed visual event? — instead of a
  // vague "does this look good?". Absent (older plans, or planning skipped),
  // it falls back to the whole-video Bible review only.
  let planBeats = null;
  const planFile = planPath && existsSync(planPath) ? planPath
    : (planPath && existsSync(join(ROOT, planPath)) ? join(ROOT, planPath) : null);
  if (planFile) {
    try {
      const plan = JSON.parse(readFileSync(planFile, "utf-8"));
      planBeats = Array.isArray(plan.beats) ? plan.beats : null;
      if (planBeats) console.log(`Visual plan loaded: ${planBeats.length} directed beats (plan-compliance review enabled)`);
    } catch (e) {
      console.warn(`Could not load visual plan ${planFile}: ${e.message}`);
    }
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
    // Frame extraction (local ffmpeg, cheap) stays sequential; the Gemini
    // calls (network round-trips, ~2-5s each) used to run one at a time in
    // this same loop — up to 20 beats meant up to 20 serial round-trips
    // (~40-100s) for scene review alone, every correction-loop attempt.
    // callGemini now uses fetch() instead of a blocking execFileSync curl,
    // so these can actually overlap; SCENE_REVIEW_CONCURRENCY caps how many
    // run at once (conservative default — this hits the same Gemini API
    // key/quota as the whole-video review and the visual-plan call).
    console.log("\n═══ PHASE 1: SCENE-BY-SCENE REVIEW ═══\n");
    const voTexts = [];
    for (let i = 0; i < beatTimes.length; i++) {
      const t = beatTimes[i];
      const framePath = join(work, `beat-${String(i).padStart(2, "0")}.png`);
      extractFrameAtTime(video, t, framePath);
      framePaths.push(framePath);
      voTexts.push(srtCues.length ? getVoiceoverAtTime(srtCues, t) : "(no SRT available)");
    }

    const SCENE_REVIEW_CONCURRENCY = 4;
    const sceneResultsByIndex = new Array(beatTimes.length);
    let nextIndex = 0;
    async function reviewWorker() {
      while (nextIndex < beatTimes.length) {
        const i = nextIndex++;
        sceneResultsByIndex[i] = await reviewFrame(
          framePaths[i], voTexts[i], i, beatTimes.length, beatTimes[i], apiKey, bible
        );
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(SCENE_REVIEW_CONCURRENCY, beatTimes.length) }, reviewWorker)
    );

    for (let i = 0; i < beatTimes.length; i++) {
      const t = beatTimes[i];
      const voText = voTexts[i];
      const result = sceneResultsByIndex[i];
      console.log(`  [${i + 1}/${beatTimes.length}] t=${t.toFixed(1)}s — VO: "${voText.slice(0, 60)}..."`);
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

    // ── PHASE 3: Plan-compliance review (intended vs actual) ──
    let planCompliance = null;
    if (planBeats && framePaths.length) {
      console.log("\n═══ PHASE 3: PLAN-COMPLIANCE (directed vs rendered) ═══\n");
      planCompliance = await reviewPlanCompliance(framePaths, beatTimes, srtCues, planBeats, apiKey);
      if (planCompliance.error) {
        console.log(`  Plan-compliance review ERROR: ${planCompliance.error}`);
        planCompliance = null;
      } else {
        console.log(`  Overall compliance: ${planCompliance.overall_compliance || "?"}  monoculture: ${planCompliance.monoculture}  continuity_ok: ${planCompliance.continuity_ok}`);
        console.log(`  Dominant failure owner: ${planCompliance.dominant_failure_owner || "none"}`);
        console.log(`  ${planCompliance.summary || ""}`);
        if (planCompliance.typography_notes) console.log(`  Typography: ${planCompliance.typography_notes}${planCompliance.typography_is_default_treatment ? " [USED AS DEFAULT TREATMENT]" : ""}`);
        for (const b of (planCompliance.beat_compliance || [])) {
          if (b.compliance && b.compliance !== "MATCH") {
            const tb = b.typography_behaviour && !["NARRATIVE_EMPHASIS", "NONE"].includes(b.typography_behaviour)
              ? ` typo=${b.typography_behaviour}` : "";
            console.log(`    frame ${b.frame}: ${b.compliance} [${b.failure_owner || "?"}]${tb} directed="${b.directed}" observed="${b.observed}" → ${b.correction || ""}`);
          }
        }
      }
    }

    // ── Build report ──
    const avgScore = sceneResults.filter((r) => r.quality_score).length > 0
      ? (sceneResults.reduce((s, r) => s + (r.quality_score || 0), 0) / sceneResults.filter((r) => r.quality_score).length).toFixed(1)
      : "N/A";

    // The pipeline decision (APPROVED / NEEDS_IMPROVEMENT / REJECTED) used to
    // be computed AFTER the report was already written to disk, and only
    // ever reached the caller via process.exit() — which render-and-qa.js's
    // qaOne() never inspects (it fires the review as a background promise
    // and only ever reads report.wholeVideoResult.verdict). That field is
    // Gemini's own free-text "<one-sentence final judgment>" from the
    // whole_video_review prompt in config/visual-bible.json — never the
    // literal string "APPROVED" — so the correction loop's
    // `geminiVerdict === "APPROVED"` check could never be true, and a video
    // this Bible review computed as REJECTED for TEMPLATE_MONOCULTURE still
    // shipped once frame-audit's unrelated pixel check passed. Computing the
    // real decision here, before the report is written, and exposing it as
    // pipelineVerdict/pipelineReason lets render-and-qa.js actually gate on
    // the Visual Bible's own semantic verdict instead of silently discarding it.
    // Two tiers, deliberately distinct (see render-and-qa.js for how each is
    // acted on):
    //   REJECTED          = a HARD defect that makes the frame itself bad —
    //                       per-frame CRITICAL failures (unreadable text,
    //                       empty/black frame, safe-area violation, broken
    //                       scene). These must never ship.
    //   NEEDS_IMPROVEMENT = a real quality complaint about the video as a
    //                       whole — template monoculture, too many HIGH scene
    //                       issues, a failing whole-video review. These DRIVE
    //                       the correction loop (re-plan + re-render), but a
    //                       technically-sound video is not permanently
    //                       discarded over a stylistic opinion once retries
    //                       are exhausted — otherwise a channel that keeps
    //                       drawing a monoculture posts nothing at all, which
    //                       is not a production system. The fix for persistent
    //                       monoculture is the plan prompt + scene design, not
    //                       zeroing out the day's upload.
    // This is NOT a weakening of QA: genuinely broken frames still hard-block
    // via criticalCount, and the frame-audit pixel gate (qa.gatePass in
    // render-and-qa.js) is an independent hard gate on top of this.
    //
    // PLAN-COMPLIANCE adds a third dimension on top of the two tiers: it
    // classifies each miss by OWNER so the correction is routed, not just
    // "video bad". CONTENT_FACTUAL (a fabricated number/label/claim on
    // screen) is the ONE new HARD reject — the repo's no-fabrication rule
    // means such a frame must never publish, exactly like a broken frame.
    // Every other owner (DIRECTION_QUALITY = lazy plan; PLAN_COMPLIANCE =
    // render didn't execute the direction; monoculture) is NEEDS_IMPROVEMENT:
    // it drives the correction loop with an owner-tagged instruction, but a
    // technically-sound, factually-honest video still ships after retries.
    // A frame whose typography behaved as a headline / subtitle / stacked
    // block is a prohibited visual language, not a taste issue — surface it
    // as its own reason so the correction is specific.
    const typoBad = (planCompliance?.beat_compliance || []).filter(
      (b) => b.typography_behaviour && !["NARRATIVE_EMPHASIS", "NONE"].includes(b.typography_behaviour)
    );
    const monoculture = wholeResult.headline_test?.monoculture || planCompliance?.monoculture
      || planCompliance?.typography_is_default_treatment;
    const compBeats = planCompliance?.beat_compliance || [];
    const factualMiss = compBeats.find((b) => b.failure_owner === "CONTENT_FACTUAL" && b.compliance === "FAIL");
    const complianceOwner = planCompliance?.dominant_failure_owner || null;
    const complianceFail = planCompliance && planCompliance.overall_compliance && planCompliance.overall_compliance !== "MATCH";

    let pipelineVerdict = "APPROVED";
    let pipelineReason = "Meets Visual Bible standards.";
    let correctionOwner = null;
    if (criticalCount > 0) {
      pipelineVerdict = "REJECTED";
      pipelineReason = `${criticalCount} CRITICAL per-frame failure(s)`;
      correctionOwner = "RENDER_TECHNICAL";
    } else if (factualMiss) {
      pipelineVerdict = "REJECTED";
      pipelineReason = `CONTENT_FACTUAL — fabricated/unsupported on-screen content: ${factualMiss.observed || factualMiss.correction || "see plan-compliance"}`;
      correctionOwner = "CONTENT_FACTUAL";
    } else if (typoBad.length) {
      pipelineVerdict = "NEEDS_IMPROVEMENT";
      pipelineReason = `NARRATIVE_TYPOGRAPHY — ${typoBad.length} frame(s) behaved as ${[...new Set(typoBad.map((b) => b.typography_behaviour))].join("/")} instead of narrative emphasis`;
      correctionOwner = typoBad[0].failure_owner || "DIRECTION_QUALITY";
    } else if (monoculture) {
      pipelineVerdict = "NEEDS_IMPROVEMENT";
      pipelineReason = `TEMPLATE_MONOCULTURE${wholeResult.headline_test?.percent ? ` — ${wholeResult.headline_test.percent}% headline-dominated beats` : ""}${planCompliance?.typography_is_default_treatment ? " (typography used as default treatment)" : ""}`;
      correctionOwner = complianceOwner || "DIRECTION_QUALITY";
    } else if (complianceFail) {
      pipelineVerdict = "NEEDS_IMPROVEMENT";
      pipelineReason = `PLAN_COMPLIANCE ${planCompliance.overall_compliance} — ${planCompliance.summary || "render did not execute the direction"}`;
      correctionOwner = complianceOwner || "PLAN_COMPLIANCE";
    } else if (highCount > Math.floor(beatTimes.length * 0.3)) {
      pipelineVerdict = "NEEDS_IMPROVEMENT";
      pipelineReason = `${highCount} HIGH issues across ${beatTimes.length} frames`;
      correctionOwner = "PLAN_COMPLIANCE";
    } else if (wholeResult.status === "FAIL" && (wholeResult.severity === "CRITICAL" || wholeResult.severity === "HIGH")) {
      pipelineVerdict = "NEEDS_IMPROVEMENT";
      pipelineReason = `Whole-video review flagged ${wholeResult.severity} issues`;
      correctionOwner = "DIRECTION_QUALITY";
    }

    const record = {
      generatedAt: new Date().toISOString(),
      bibleVersion: bible.version,
      video: basename(video),
      channel: channelId,
      duration: duration.toFixed(2),
      totalFrames: beatTimes.length,
      pipelineVerdict,
      pipelineReason,
      correctionOwner,
      planCompliance,
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
      // MACHINE-APPLICABLE DIRECTIVES (Bible REV-01).
      //
      // The system applies and verifies these; Gemini only states them. They
      // are emitted regardless of fixMode, because a rejection the pipeline
      // cannot act on is the failure mode this exists to close — run
      // 35271777426 rejected six attempts in prose and shipped both videos
      // unchanged.
      adjustments: [
        ...(wholeResult.adjustments || []),
        ...(planCompliance?.adjustments || []),
      ].filter((a) => a && typeof a.directive === "string"),
      corrections: fixMode ? [
        ...sceneResults.filter((r) => r.correction?.action).map((r) => ({
          scene: r.scene || `beat_${r.frame_index}`,
          level: r.correction.level,
          action: r.correction.action,
          severity: r.severity,
        })),
        ...(wholeResult.corrections || []),
        // Plan-compliance corrections carry the owner so the re-plan
        // instruction is specific ("you directed X, the render showed Y").
        ...compBeats.filter((b) => b.compliance && b.compliance !== "MATCH" && b.correction).map((b) => ({
          scene: `frame_${b.frame}`,
          owner: b.failure_owner,
          problem: `directed "${b.directed}" but rendered "${b.observed}"`,
          fix: b.correction,
        })),
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
    if (planCompliance) console.log(`  Plan-compliance: ${planCompliance.overall_compliance || "?"} (owner: ${correctionOwner || "none"})`);
    console.log(`  Report: ${outFile}`);
    console.log(`\n  VERDICT: ${pipelineVerdict} — ${pipelineReason}`);

    if (pipelineVerdict === "REJECTED") {
      if (fixMode) {
        console.log(`  Corrections written to report. Pipeline should apply and re-render.`);
      }
      process.exit(1);
    } else if (pipelineVerdict === "NEEDS_IMPROVEMENT") {
      if (!fixMode) process.exit(1);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
