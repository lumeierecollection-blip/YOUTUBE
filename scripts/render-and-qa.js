#!/usr/bin/env node
/**
 * render-and-qa.js — render orchestrator with Gemini correction loop.
 *
 * Flow per video:
 *   1. Gemini Visual Plan — Gemini reads the script and decides what each
 *      beat should SHOW (visual headline, treatment, reason).
 *   2. Render — Remotion renders using the visual plan.
 *   3. QA — frame extraction, pixel audit, Gemini review.
 *   4. If Gemini review says NEEDS IMPROVEMENT → feed corrections back
 *      into step 1 → re-render → re-review (max 3 attempts).
 *
 * Usage:
 *   node scripts/render-and-qa.js [--channel <numeric-id>]
 *   node scripts/render-and-qa.js --script <path> [--channel <id>] [--output <mp4>]
 *   node scripts/render-and-qa.js --dry-run [--channel <id>] [--script <path>]
 */
import "dotenv/config";
import { resolveChannel } from "./lib/channel-lookup.mjs";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, copyFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname, basename, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createRequire as createRequireEntity } from "node:module";
import { compositionFor } from "../src/skills/remotion-render/visual/canvas-layout.js";
import { resolveGround } from "../src/skills/remotion-render/visual/backgrounds.js";
import { styleCanvases } from "../src/skills/remotion-render/visual/canvas-style.js";
import { enforceRotation, candidatesFor } from "./composition-rotation.js";
import { assignCanvasAnimations } from "./anim-plan.js";
import { isTypeCanvas, varietyReport, beatsToConvert, fallbacksFor } from "./composition-variety.js";
import { quantitiesOf } from "./canvas-grounding.js";
import { checkVisual, figureKey, entityNamedInSentence, comparisonNumbers } from "./gemini-visual-plan.js";
import { splitHeadline } from "../src/skills/remotion-render/visual/canvas-layout.js";
import { validateConcepts } from "../src/skills/remotion-render/visual/concept-visuals.js";
import { classOf } from "../src/skills/remotion-render/visual/concept-classes.js";
import { inkOf } from "./cutout-ink.mjs";
const { resolveDocument, resolveMoney, qualifyEntity } = createRequireEntity(import.meta.url)("./entity-assets.cjs");
const { fetchCutoutForBeat, qualifyConcept } = createRequireEntity(import.meta.url)("./fetch-cutout-once.cjs");
const { resolveSceneEntity, sceneEntities } = createRequireEntity(import.meta.url)("./resolve-scene.cjs");
const { verifyPlaceImage } = createRequireEntity(import.meta.url)("./verify-place-image.cjs");
import { resolveRegion as resolveRegionName } from "../src/skills/remotion-render/visual/geo-regions.js";
import { bundle } from "@remotion/bundler";
import { verifyTts } from "../src/utils/tts-verify.js";
import {
  deriveAdjustments, applyAdjustments, verifyAdjustments,
  isKnownDirective, describeDirective,
} from "../src/skills/remotion-render/visual/plan-adjustments.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RENDER_JS = join(ROOT, "src", "skills", "remotion-render", "render.js");
const REMOTION_ROOT_JSX = join(ROOT, "src", "skills", "remotion-render", "Root.jsx");
const VIDEO_REVIEW_JS = join(__dirname, "video-review.js");
const FRAME_AUDIT_JS = join(__dirname, "frame-audit.js");
const SLOP_CHECK_JS = join(__dirname, "slop-check.js");
const VISUAL_QA_JS = join(__dirname, "gate-visual-qa.js");
const GEMINI_REVIEW_JS = join(__dirname, "gemini-frame-review.js");
const GEMINI_PLAN_JS = join(__dirname, "gemini-visual-plan.js");
const CHALLENGER_JS = join(__dirname, "gemini-visual-challenger.js");
const ELEMENT_REMEDIATION_JS = join(__dirname, "beat-element-remediation.js");
const { recordEvalLoop } = await import("./eval-loop-callsite.js");
const { judge } = await import("./eval-layer3-judge.js");
const { layer2Advisory } = await import("./eval-layer2-wire.js");

async function challengePlan(channelId, planPath, srtPath, tag) {
  const out = planPath.replace(/\.json$/, `-challenge${tag}.json`);
  const { code } = await runChild("node", [
    CHALLENGER_JS, "--plan", planPath, "--srt", srtPath, "--channel", String(channelId), "--out", out,
  ], { label: `challenger ${channelId}` });
  return { code, review: readJsonSafe(out) };
}

/**
 * One decision per blocking beat: which FIELD is wrong and what it should say
 * instead (scripts/beat-element-remediation.js). Decision only — the re-planner
 * still rewrites the whole plan and the renderer still re-renders the whole
 * video, which is why the next line keeps asking geminiPlan() for a full plan.
 *
 * Returns { corrections, source }. `source` is "element" only when the layer
 * actually produced something; the caller falls back to the generic per-beat
 * correction otherwise, so a provider that cannot answer costs specificity
 * rather than costing the re-plan.
 */
async function elementCorrections(planPath, reviewPath, srtPath) {
  const out = planPath.replace(/\.json$/, "-element-corrections.json");
  const { code } = await runChild("node", [
    ELEMENT_REMEDIATION_JS, "--plan", planPath, "--review", reviewPath, "--srt", srtPath, "--out", out,
  ], { label: "element-corrections" });
  const doc = readJsonSafe(out);
  const corrections = Array.isArray(doc?.corrections) ? doc.corrections : [];
  if (!corrections.length) {
    console.warn(`[element] no element-level correction (exit ${code}) — falling back to the generic per-beat correction`);
    return { corrections: [], source: "none" };
  }
  console.log(`[element] ${corrections.length} element correction(s) from ${(doc.unresolved || []).length} unresolved`);
  for (const c of corrections) console.log(`   beat ${c.beat} ${c.element}: ${c.fix}`);
  return { corrections, source: "element" };
}
const LOCAL_AUDITOR_JS = join(__dirname, "local-visual-auditor.js");
// 3 attempts: initial + 2 corrections. Was 2 (initial + ONE correction),
// which meant Gemini got a single chance to respond and then the video
// shipped whatever it said — run 35266860427 ended "attempt 2/2,
// verdict=severe template monoculture and AI-generated slop" with qa=PASS.
// One round is not a loop. Each attempt is ~2-4 min for shorts, and the
// six-channel workflow ran 15-17 min at two attempts, so three keeps it
// inside the 30-minute budget.
//
// Attempts are only SPENT when there is something actionable to change: if
// the merge produces no corrections, the loop stops instead of re-rolling
// the planner with no instruction.
const MAX_CORRECTION_LOOPS = 3;

function readJsonSafe(p) {
  try { return existsSync(p) ? JSON.parse(readFileSync(p, "utf-8")) : null; } catch { return null; }
}

function parseArgs(argv) {
  const flag = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : null;
  };
  return {
    channelOverride: flag("--channel"),
    scriptOverride: flag("--script"),
    outputOverride: flag("--output"),
    dryRun: argv.includes("--dry-run"),
    skipQA: argv.includes("--skip-qa"),
  };
}

function loadChannelIds(override) {
  if (override) return [override];
  const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  const channels = data.channels || data;
  return channels.map((c) => String(c.id));
}

function findScripts(channelId) {
  // data/research/<channelId>/*-script.json is committed to git and never
  // pruned, so a fresh checkout on every CI run sees every script this
  // channel has ever written — not just today's. data/tts/**/*.mp3 is
  // gitignored (never committed), so today's freshly-downloaded prep
  // artifact is the ONLY script with matching audio. Filtering on that
  // here — before geminiPlan() runs — is what actually skips the stale
  // backlog, instead of discovering "no audio" only after paying for a
  // full Gemini visual-plan call per leftover file (seen in production:
  // 21 of 22 committed scripts for channel 1 were history, each still
  // triggering a real API call and burning render-job wall-clock time).
  const dir = join(ROOT, "data", "research", channelId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith("-script.json"))
    .map((f) => join(dir, f))
    .filter((scriptPath) => existsSync(audioPathFor(channelId, scriptPath)));
}

function planWork({ channelOverride, scriptOverride }) {
  if (scriptOverride) {
    const scriptPath = join(ROOT, relative(ROOT, scriptOverride));
    if (!existsSync(scriptPath)) {
      console.error(`::error::--script path not found: ${scriptPath}`);
      process.exit(1);
    }
    const channelId = channelOverride || basename(dirname(scriptPath));
    return [{ channelId, scriptPath }];
  }
  const work = [];
  for (const channelId of loadChannelIds(channelOverride)) {
    for (const scriptPath of findScripts(channelId)) work.push({ channelId, scriptPath });
  }
  return work;
}

function formatFromScriptPath(scriptPath) {
  if (scriptPath.endsWith("-shorts-script.json")) return "shorts";
  if (scriptPath.endsWith("-longform-script.json")) return "longform";
  console.warn(`WARN: can't tell shorts/longform from ${scriptPath} — defaulting to longform`);
  return "longform";
}

function audioPathFor(channelId, scriptPath) {
  const base = basename(scriptPath, ".json");
  return join(ROOT, "data", "tts", channelId, `${base}-vo.mp3`);
}

function expectedOutputPath(channelId, scriptPath, format) {
  const slug = basename(scriptPath, extname(scriptPath)).replace(/-script$/, "");
  const timestamp = new Date().toISOString().slice(0, 10);
  return join(ROOT, "data", "renders", channelId, `${slug}-${format}-${timestamp}.mp4`);
}

function runChild(cmd, args, { label, env }) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: env ? { ...process.env, ...env } : process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
      process.stdout.write(`[${label}] ${d}`);
    });
    child.stderr.on("data", (d) => {
      stderr += d;
      process.stderr.write(`[${label}] ${d}`);
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.on("error", (err) => {
      resolve({ code: null, stdout, stderr: `${stderr}\n${err.message}` });
    });
  });
}

/* ── Gemini Visual Planning ──────────────────────────────────────── */

async function geminiPlan(channelId, scriptPath, correctionsPath) {
  const planDir = join(ROOT, "data", "visual-plans", channelId);
  mkdirSync(planDir, { recursive: true });
  const planPath = join(planDir, basename(scriptPath, ".json") + "-visual-plan.json");

  const audio = audioPathFor(channelId, scriptPath);
  const srtPath = join(dirname(audio), basename(audio, extname(audio)) + ".srt");

  // Step 1: the planner — Gemini, or local Ollama when Gemini cannot answer
  // (src/lib/llm.js / gemini-visual-plan.js). It runs when EITHER is
  // configured: a missing Gemini key is not a reason to skip planning.
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.VISION_API_KEY;
  if (geminiKey || process.env.OLLAMA_URL) {
    const args = [
      GEMINI_PLAN_JS,
      "--script", relative(ROOT, scriptPath),
      "--channel", channelId,
      "--out", planPath,
    ];
    if (existsSync(srtPath)) args.push("--srt", srtPath);
    if (correctionsPath && existsSync(correctionsPath)) args.push("--corrections", correctionsPath);

    console.log(`=== VISUAL PLAN: ${channelId} — ${basename(scriptPath)} ===`);
    const { code } = await runChild("node", args, { label: `plan ${channelId}/${basename(scriptPath)}` });
    if (code === 0 && existsSync(planPath)) {
      // Compositions the renderer cannot build (under the 35% coverage
      // floor, unknown primitives) used to be discovered at render time and
      // "fall back to mechanism" there (run 35833174133: ch-26, ch-44).
      // The planner already lists them; hand them straight back to Gemini
      // ONCE, at plan time. Whatever is still invalid after that stays in
      // the plan and is reported by the renderer — not hidden.
      const first = readJsonSafe(planPath);
      const issues = first?.compositionIssues || [];
      // Not on a local-model plan: the corrective pass costs another 10-25
      // min on a CPU runner and in run 36431582306 mostly changed nothing
      // ("1 -> 1"). The issues stay in the plan and are reported, as before.
      if (issues.length && first?.source === "ollama") {
        console.log(`[plan] ${issues.length} composition issue(s) on an ollama plan — reported, no corrective re-plan (CPU cost)`);
      }
      // Not on a paper/canvas plan either: an EDITORIAL beat is drawn by CanvasVideo
      // from its own fields and has no composition (gemini-visual-plan.js
      // deletes it), so these issues cannot change what renders. In run
      // 36478456863 this re-plan, judged on composition-issue count alone,
      // replaced ch-2's gate-passing MAP beat and dropped ch-26's
      // gate-passing CUTOUT (it kept the first plan, 2 -> 2 issues).
      const paperPlan = (first?.beats || []).some((b) => b.kind === "EDITORIAL" || b.headline !== undefined);
      if (issues.length && paperPlan) {
        console.log(`[plan] ${issues.length} composition issue(s) on a paper plan — not used by the paper renderer; no corrective re-plan`);
      }
      if (issues.length && !correctionsPath && first?.source !== "ollama" && !paperPlan) {
        const corrDir = join(ROOT, "data", "audit", "corrections", process.env.GITHUB_RUN_ID || "local");
        mkdirSync(corrDir, { recursive: true });
        const corrFile = join(corrDir, `${basename(scriptPath, ".json")}-composition.json`);
        writeFileSync(corrFile, JSON.stringify({ corrections: issues }, null, 2) + "\n");
        console.log(`[plan] ${issues.length} unbuildable composition issue(s) — re-planning once with them as corrections`);
        const firstCopy = planPath.replace(/\.json$/, "-first.json");
        copyFileSync(planPath, firstCopy);
        const retry = await runChild("node", [...args, "--corrections", corrFile], { label: `plan-fix ${channelId}/${basename(scriptPath)}` });
        const second = retry.code === 0 ? readJsonSafe(planPath) : null;
        const remaining = second?.compositionIssues?.length;
        if (second && remaining < issues.length) {
          console.log(`[plan] composition issues ${issues.length} → ${remaining} after the corrective pass`);
        } else {
          copyFileSync(firstCopy, planPath);
          console.log(`[plan] corrective pass did not reduce composition issues (${issues.length} → ${remaining ?? "failed"}); keeping the first plan`);
        }
      }
      return planPath;
    }
    console.error("::error::Visual planning failed (gemini, then ollama) — no plan, no render.");
  } else {
    console.error("::error::No Gemini key and no Ollama server (OLLAMA_URL) — cannot plan visuals.");
  }

  // The rule-based local planner (scripts/local-visual-plan.cjs) used to run
  // here as a fallback. It is no longer called: QA run 35916464573 showed its
  // plans are generic placeholders ("CAUSE/EFFECT", "EXPECTED/ACTUAL" boxes,
  // caption text) that the per-beat frame review rejects 6/6 every time, and
  // the challenger approved them anyway. A failed Gemini plan now fails the
  // channel honestly instead of rendering a text-card video.
  return null;
}

/* ── Render ──────────────────────────────────────────────────────── */

async function renderOne(channelId, scriptPath, format, planPath) {
  const audio = audioPathFor(channelId, scriptPath);
  if (!existsSync(audio)) {
    console.error(`::error::no voiceover audio at ${audio} — cannot render ${scriptPath}`);
    return { skipped: false, ok: false };
  }
  console.log(`=== RENDER: ${channelId} — ${basename(scriptPath)} (${format}) ===`);
  const args = [RENDER_JS, format, channelId, relative(ROOT, scriptPath), relative(ROOT, audio)];
  const label = `render ${channelId}/${basename(scriptPath)}`;
  // The plan render.js must draw (the asset-resolved plan). Without this it
  // read the canonical plan path, so enforced correction plans never rendered.
  const env = planPath ? { VISUAL_PLAN_PATH: planPath } : undefined;
  let { code, stderr, stdout } = await runChild("node", args, { label, env });
  // One retry, ONLY when Chrome never came up. That is the runner, not the
  // video: run 35842024112 lost ch-48 to "Timed out after 25000 ms while
  // trying to connect to the browser" with every other gate green. Any
  // other render failure is not retried.
  if (code !== 0 && /trying to connect to the browser/i.test(`${stderr}\n${stdout}`)) {
    console.warn(`::warning::${label}: browser failed to launch — retrying the render once`);
    ({ code, stderr, stdout } = await runChild("node", args, { label: `${label} (retry)`, env }));
  }
  if (code !== 0) {
    // A crash after the encoder started can leave a partial MP4 at the output
    // path: it goes to rejected/ with the crash reason, never left behind.
    const partial = expectedOutputPath(channelId, scriptPath, format);
    const tail = `${stderr || ""}\n${stdout || ""}`.trim().split("\n").filter(Boolean).slice(-1)[0] || "";
    const q = existsSync(partial) ? await queueVideo({ verdict: "rejected", videoPath: partial, channelId, stage: "render", check: "crash", reason: `render.js exited ${code}: ${tail.slice(0, 300)}` }) : null;
    return { skipped: false, ok: false, queued: q || undefined };
  }
  const outputPath = expectedOutputPath(channelId, scriptPath, format);
  if (!existsSync(outputPath)) {
    console.error(`::error::render.js exited 0 but expected output not found: ${outputPath}`);
    return { skipped: false, ok: false };
  }
  return { skipped: false, ok: true, outputPath, channelId, scriptPath, audio };
}

/* ── Silence Detection ───────────────────────────────────────────── */

async function probeDuration(path, streamSelector) {
  const args = ["-v", "error"];
  if (streamSelector) args.push("-select_streams", streamSelector, "-show_entries", "stream=duration");
  else args.push("-show_entries", "format=duration");
  args.push("-of", "default=noprint_wrappers=1:nokey=1", path);
  const r = await runChild("ffprobe", args, { label: "probe" });
  if (r.code !== 0) return { ok: false, error: `ffprobe exited ${r.code}: ${r.stderr.trim().slice(0, 300)}` };
  const v = parseFloat(r.stdout.trim().split("\n")[0]);
  return { ok: true, value: Number.isFinite(v) ? v : 0, raw: r.stdout.trim() };
}

async function silenceSpans(path, endAt) {
  const r = await runChild("ffmpeg", [
    "-hide_banner", "-nostats", "-i", path,
    "-af", "silencedetect=noise=-40dB:d=0.5",
    "-f", "null", "-",
  ], { label: "silence/detect" });
  if (r.code !== 0) return { ok: false, error: `ffmpeg silencedetect exited ${r.code} on ${path}` };
  // silencedetect reports on STDERR — the old version parsed stdout only
  // and so could never see a gap.
  const spans = [];
  let start = null;
  for (const line of `${r.stdout}\n${r.stderr}`.split("\n")) {
    const sm = line.match(/silence_start:\s*(-?[\d.]+)/);
    const em = line.match(/silence_end:\s*([\d.]+)/);
    if (sm) start = Math.max(0, parseFloat(sm[1]));
    if (em && start !== null) { spans.push({ start, end: parseFloat(em[1]) }); start = null; }
  }
  // Silence that runs to end-of-stream has a start and no end.
  if (start !== null) spans.push({ start, end: endAt });
  return { ok: true, spans: spans.map((g) => ({ ...g, duration: g.end - g.start })) };
}

async function detectSilence(videoPath, audioPath) {
  // No "skipping" branches: a missing ffmpeg/ffprobe is a broken runner, and
  // a check that silently passes is how six silent videos would have shipped.
  const audio = await probeDuration(audioPath);
  if (!audio.ok) return { ok: false, gaps: [], reason: `cannot probe voiceover: ${audio.error}` };
  const audioDuration = audio.value;
  if (audioDuration <= 0) return { ok: false, gaps: [], reason: `voiceover ${audioPath} has zero duration` };

  const stream = await probeDuration(videoPath, "a:0");
  if (!stream.ok || !stream.raw) {
    return { ok: false, gaps: [], reason: `rendered video has no audio stream (${stream.error || "ffprobe returned nothing"})` };
  }

  // A SKIP is silence in the video that the voiceover itself doesn't have.
  // The voiceover legitimately pauses ~1s between paragraphs (tts.js joins
  // them with blank lines), so "any gap > 0.5s" flagged every sentence
  // boundary — run 35817394030 rejected both renders on exactly those.
  const vid = await silenceSpans(videoPath, audioDuration);
  if (!vid.ok) return { ok: false, gaps: [], reason: vid.error };
  const src = await silenceSpans(audioPath, audioDuration);
  if (!src.ok) return { ok: false, gaps: [], reason: src.error };

  const START_TOL = 0.4;   // s — mux/encode offset between the two
  const EXTRA_TOL = 0.3;   // s — how much longer than the source pause is still the same pause
  // A video silence is legitimate when it lies INSIDE a voiceover pause.
  // The old test also required it to START within 0.4 s of the pause, which
  // assumed nothing plays during pauses; with the kalimba bed, the bed can
  // cover the start of a pause and then decay, so the video's silence begins
  // later — run 36369197918 ch-1: VO pause 29.19-30.28, video silence
  // 29.65-30.32, flagged "unmatched". Containment keeps the rule's purpose:
  // silence while the narration is SPEAKING (a dropout) lies inside no
  // pause and still fails.
  const gaps = vid.spans.filter((g) => {
    if (g.start >= audioDuration - 0.1 || g.duration <= 0.5) return false;
    const match = src.spans.find((s) => g.start >= s.start - START_TOL && g.end <= s.end + EXTRA_TOL);
    return !match;
  });
  console.log(`[silence] voiceover pauses ${src.spans.length}, video pauses ${vid.spans.length}, unmatched ${gaps.length}`);

  if (gaps.length > 0) {
    console.error(`::error::${gaps.length} silence gap(s) in the video with no matching pause in the voiceover:`);
    for (const g of gaps) {
      console.error(`  ${g.start.toFixed(2)}s — ${g.end.toFixed(2)}s (${g.duration.toFixed(2)}s)`);
    }
    return { ok: false, gaps, reason: `${gaps.length} unmatched silence gap(s)` };
  }
  return { ok: true, gaps: [] };
}

/* ── Render verification (runs with or without --skip-qa) ────────── */

const MAX_DURATION_DRIFT_S = 1;
const MIN_BEAT0_FRAME_BYTES = 15 * 1024;

function firstCueMidpoint(srtPath) {
  if (!existsSync(srtPath)) return null;
  const m = readFileSync(srtPath, "utf-8").match(/(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return null;
  const t = (h, mi, se, ms) => +h * 3600 + +mi * 60 + +se + +ms / 1000;
  return (t(m[1], m[2], m[3], m[4]) + t(m[5], m[6], m[7], m[8])) / 2;
}

async function verifyRender(videoPath, audioPath, channelId) {
  const problems = [];

  const video = await probeDuration(videoPath);
  const audio = await probeDuration(audioPath);
  if (!video.ok || !audio.ok) {
    problems.push(`cannot probe durations: ${video.error || audio.error}`);
  } else {
    const drift = Math.abs(video.value - audio.value);
    console.log(`[verify] video ${video.value.toFixed(2)}s, voiceover ${audio.value.toFixed(2)}s, drift ${drift.toFixed(2)}s`);
    if (drift > MAX_DURATION_DRIFT_S) {
      problems.push(`video ${video.value.toFixed(2)}s vs voiceover ${audio.value.toFixed(2)}s drifts ${drift.toFixed(2)}s (max ${MAX_DURATION_DRIFT_S}s)`);
    }
  }

  // Beat 0 is sampled at the middle of the first caption cue — after its
  // entrance, before its exit — and written as PNG so a flat/empty frame
  // compresses to almost nothing.
  const srtPath = join(dirname(audioPath), basename(audioPath, extname(audioPath)) + ".srt");
  const at = firstCueMidpoint(srtPath) ?? 1;
  const framePath = videoPath.replace(/\.mp4$/, "-beat0.png");
  const grab = await runChild("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-ss", at.toFixed(3), "-i", videoPath,
    "-frames:v", "1", framePath,
  ], { label: "verify/beat0" });
  if (grab.code !== 0 || !existsSync(framePath)) {
    problems.push(`could not extract beat-0 frame at ${at.toFixed(2)}s`);
  } else {
    const bytes = statSync(framePath).size;
    console.log(`[verify] beat-0 frame @${at.toFixed(2)}s: ${(bytes / 1024).toFixed(1)} KB`);
    if (bytes <= MIN_BEAT0_FRAME_BYTES) {
      problems.push(`beat-0 frame is ${(bytes / 1024).toFixed(1)} KB (must be > 15 KB) — near-empty frame`);
    }
  }
  problems.push(...measureGround(videoPath));

  return { ok: problems.length === 0, problems };
}

// Uniform white ground, measured (owner's decision 2026-09-30; replaces the
// bg_mode "white" beat-0 > 222 check and the short-lived gradient check).
// On the first beat that shows the bare ground (manifest canvas.ground
// "white"), at 60% of it: three 80x80 corner patches (top-left, top-right,
// bottom-right — clear of the header, which starts at y 180, and of the
// caption band, which ends at y 1610) must each read the ground colour
// (visual/backgrounds.js GROUND) within 4 per RGB channel (h264 rounding),
// and must match each other within 2 — any tint, gradient, vignette or
// shadow fails. Where this stops: one frame, three corners.
function measureGround(videoPath) {
  const manifestPath = videoPath.replace(/\.mp4$/, "-manifest.json");
  let man = null;
  try { man = JSON.parse(readFileSync(manifestPath, "utf-8")); } catch { return []; }
  if (typeof man?.ground !== "string") return [];                // not a canvas render
  // Not a beat whose layout draws a full-frame shape: COMPARISON-SPLIT's diagonal
  // covers the top-right corner by design (CI run 37067332714 ch-2: beat 0 was one,
  // and its corner read #0E0E0E as "the ground").
  // (nor one carrying a source credit: "Source: ..." sits in the bottom-right patch — part C)
  const beat = (man.beats || []).find((b) => b.canvas?.ground === "white" && !b.canvas?.ground_color && !b.canvas?.source_credit && b.canvas?.composition !== "COMPARISON-SPLIT" && !Object.values(b.canvas?.boxes || {}).some((v) => v?.role === "shape"));
  if (!beat) { console.log("[verify] ground: every beat is a full-bleed photo or declares its own ground — the default white ground not measured (local-audit canvas-ground checks declared grounds)"); return []; }
  const at = beat.start_sec + beat.duration_sec * 0.6;
  const framePath = videoPath.replace(/\.mp4$/, "-ground.png");
  try {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", at.toFixed(3), "-i", videoPath, "-frames:v", "1", framePath]);
    const patch = (x, y) => {
      const raw = execFileSync("ffmpeg", ["-v", "error", "-i", framePath, "-vf", `crop=iw*80/1080:ih*80/1920:${x}:${y}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
      const s = [0, 0, 0];
      for (let i = 0; i < raw.length; i += 3) { s[0] += raw[i]; s[1] += raw[i + 1]; s[2] += raw[i + 2]; }
      return s.map((v) => v / (raw.length / 3));
    };
    const pts = { "top-left": patch("0", "0"), "top-right": patch("iw-iw*80/1080", "0"), "bottom-right": patch("iw-iw*80/1080", "ih-ih*80/1920") };
    const want = [1, 3, 5].map((i) => parseInt(man.ground.slice(i, i + 2), 16));
    const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
    console.log(`[verify] white ground (beat ${beat.index} @${at.toFixed(2)}s): ${Object.entries(pts).map(([k, c]) => `${k} ${hex(c)}`).join(", ")} (want ${man.ground})`);
    const out = [];
    for (const [k, c] of Object.entries(pts)) if (c.some((v, i) => Math.abs(v - want[i]) > 4)) out.push(`ground ${k} reads ${hex(c)}, not the uniform ${man.ground}`);
    const all = Object.values(pts);
    const spread = Math.max(...[0, 1, 2].map((i) => Math.max(...all.map((c) => c[i])) - Math.min(...all.map((c) => c[i]))));
    if (spread > 2) out.push(`ground is not uniform: the three corners differ by up to ${spread.toFixed(1)} per channel`);
    return out;
  } catch (e) {
    return [`could not measure the white ground: ${e.message}`];
  }
}

/* ── QA ──────────────────────────────────────────────────────────── */

async function qaOne(runId, rendered, planPath) {
  const { outputPath, channelId, scriptPath, audio } = rendered;
  const reviewDir = join(ROOT, "data", "audit", "render-review", runId, basename(outputPath, ".mp4"));
  mkdirSync(reviewDir, { recursive: true });
  // Pass the render manifest so frames are sampled at BEAT-SETTLED times
  // rather than evenly across the video. Evenly-spaced sampling lands inside
  // a beat's entrance fade regularly, and the gate then measures a
  // half-faded glyph as a contrast failure (ch44 1.86:1, ch48 1.71:1 — both
  // the accent at roughly a third opacity, not illegible text). Optional:
  // video-review.js falls back to even spacing when it is absent.
  const renderManifest = outputPath.replace(/\.mp4$/, "-manifest.json");
  const reviewArgs = [VIDEO_REVIEW_JS, outputPath, "--frames", "4", "--out", reviewDir];
  if (existsSync(renderManifest)) reviewArgs.push("--manifest", renderManifest);
  const review = await runChild("node", reviewArgs, {
    label: `qa/review ${basename(outputPath)}`,
  });
  if (review.code !== 0) {
    return { outputPath, gatePass: false, stage: "video-review", reviewDir };
  }
  const audit = await runChild("node", [FRAME_AUDIT_JS, reviewDir], { label: `qa/audit ${basename(outputPath)}` });

  // LOCAL VISUAL AUDITOR — deterministic, free checks (black/static/motion,
  // manifest vs plan compliance, monoculture, audio, channel fingerprint).
  // It produces a RISK level and whether a Gemini semantic review is even
  // needed. This is the cost lever for scaling to many channels: an
  // objectively-clean, low-risk video does NOT pay for a vision-model pass.
  let localAudit = null;
  if (audit.code === 0) {
    const laArgs = ["--video", outputPath, "--channel", String(channelId)];
    if (planPath && existsSync(planPath)) laArgs.push("--plan", planPath);
    const manifestPath = outputPath.replace(/\.mp4$/, "-manifest.json");
    if (existsSync(manifestPath)) laArgs.push("--manifest", manifestPath);
    // The SRT lets the auditor measure transcript-likeness (is the on-screen
    // phrase just the narration restated?) without a vision model.
    const laSrt = join(dirname(audio), basename(audio, extname(audio)) + ".srt");
    if (existsSync(laSrt)) laArgs.push("--srt", laSrt);
    await runChild("node", [LOCAL_AUDITOR_JS, ...laArgs], { label: `qa/local-audit ${basename(outputPath)}` });
    localAudit = readJsonSafe(outputPath.replace(/\.mp4$/, "-local-audit.json"));
  }
  // Gemini runs ONLY when the local auditor cannot clear the video on its own
  // (risk not LOW, or specific uncertain beats). If the local report is
  // missing (auditor errored), fall back to running Gemini so we never ship a
  // video that nothing semantically reviewed.
  const geminiNeeded = !localAudit || localAudit.gemini_required !== false;

  let visionQaPromise;
  if (audit.code === 0 && geminiNeeded && (process.env.VISION_API_KEY || process.env.OLLAMA_URL)) {
    const chId = `ch-${String(channelId).padStart(2, "0")}`;
    visionQaPromise = runChild("node", [VISUAL_QA_JS, "--channel", chId, "--video", outputPath], {
      label: `qa/vision ${basename(outputPath)}`,
    });
  }

  let geminiReviewPromise;
  // The frame review runs with Gemini OR the local Ollama vision model.
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.VISION_API_KEY;
  if (audit.code === 0 && geminiNeeded && (geminiKey || process.env.OLLAMA_URL)) {
    const srtPath = join(dirname(audio), basename(audio, extname(audio)) + ".srt");
    const srtArg = existsSync(srtPath) ? srtPath : "";
    const reviewArgs = ["--video", outputPath, "--script", scriptPath, "--channel", String(channelId), "--fix"];
    if (srtArg) reviewArgs.push("--srt", srtArg);
    // Pass the authoritative visual plan so the review runs plan-compliance
    // (directed vs rendered), not a vague "looks good" pass.
    if (planPath && existsSync(planPath)) reviewArgs.push("--plan", planPath);
    geminiReviewPromise = runChild("node", [GEMINI_REVIEW_JS, ...reviewArgs], {
      label: `qa/gemini-review ${basename(outputPath)}`,
    });
  } else if (audit.code === 0 && !geminiNeeded) {
    console.log(`[qa] local auditor cleared ${basename(outputPath)} (risk ${localAudit.risk?.level}) — skipping Gemini review`);
  }

  const slopCheckPromise = runChild("node", [SLOP_CHECK_JS, outputPath, channelId, scriptPath, audio], {
    label: `qa/slop-check ${basename(outputPath)}`,
  });

  // THE HARD GATE = objective frame-audit AND no objective blocker.
  //
  // frame-audit stays the primary gate, but it only looks at PIXELS, so a
  // video with perfect frames and no audible audio passed it. Run
  // 35266860427 shipped exactly that on two channels: 4/4 frames, LUFS -70,
  // silence for the full duration, qa=PASS. The auditor had already measured
  // it; silence was just 8 points on an advisory risk score.
  //
  // `localAudit.blockers` is deliberately narrow — objective conditions that
  // make a video unpublishable on its face (currently: effectively silent).
  // Subjective quality stays with Gemini and the correction loop; this is not
  // a quality bar, it is a "nobody can watch this" bar.
  const blockers = localAudit?.blockers || [];
  for (const b of blockers) {
    console.error(`[qa/BLOCKER ${basename(outputPath)}] ${b}`);
  }
  const gatePass = audit.code === 0 && blockers.length === 0;

  return { outputPath, gatePass, stage: "frame-audit", reviewDir, slopCheckPromise, visionQaPromise, geminiReviewPromise, localAudit, geminiNeeded, blockers };
}

/* ── Enforcement: the system makes the changes ───────────────────── */

/**
 * Apply the mandated changes to the plan file, in place, and verify they
 * held. Returns { planPath, appliedCount, failures }.
 *
 * Gemini decides WHAT must change; this decides nothing and enforces
 * everything. Two sources of directives:
 *
 *   - derived from the local auditor's MEASURED violations (no model): a
 *     text-beat share over the cap, mechanism monoculture, a beat drawing
 *     two narrative lines. These are arithmetic and so are their fixes.
 *   - Gemini's own structured `adjustments`, for the judgment calls that
 *     carry a VALUE (which phrase, which figure). The system never invents
 *     such a value itself — that would be fabricated on-screen content.
 *
 * Every applied directive is re-checked against the resulting plan. A
 * directive that did not take effect is reported, not assumed, because
 * silently rendering a plan that still contains the rejected defect is
 * exactly what "Gemini rates but nothing changes" looked like.
 */
function enforceAdjustments(planPath, localAudit, geminiReportPath, attempt) {
  const empty = { planPath, appliedCount: 0, failures: [] };
  if (!planPath || !existsSync(planPath)) return empty;

  let plan;
  try { plan = JSON.parse(readFileSync(planPath, "utf-8")); } catch { return empty; }

  const derived = deriveAdjustments(plan, localAudit);

  let fromGemini = [];
  if (geminiReportPath && existsSync(geminiReportPath)) {
    try {
      const r = JSON.parse(readFileSync(geminiReportPath, "utf-8"));
      fromGemini = (r.adjustments || []).filter((a) => a && isKnownDirective(a.directive));
    } catch { /* report unreadable — derived directives still apply */ }
  }

  const all = [...derived, ...fromGemini];
  if (!all.length) return empty;

  const { plan: next, applied, rejected } = applyAdjustments(plan, all);
  const { failures } = verifyAdjustments(next, applied);

  console.log(`[enforce] ${applied.length} directive(s) applied (auditor ${derived.length}, gemini ${fromGemini.length})`);
  for (const a of applied) console.log(`   APPLIED  ${describeDirective(a)}`);
  for (const r of rejected) console.warn(`   REJECTED ${r.adj?.directive || "?"} — ${r.reason}`);
  for (const f of failures) {
    // `impossible` means the demand exceeded what the plan can express (six
    // distinct mechanisms in a three-beat video). That is a bad directive,
    // not a failed application, and it must not read as an enforcement bug.
    const tag = f.impossible ? "UNSATISFIABLE" : "NOT VERIFIED";
    console.warn(`   ${tag} ${f.adj?.directive} — ${f.reason}`);
  }

  if (!applied.length) return empty;

  // An edit the renderer never reads is no change. Run 36509937804 ch-9:
  // DIVERSIFY_MECHANISMS "applied" (and did not even verify) to a
  // full-canvas plan, whose beats render from visual_type / data / headline
  // — the next two attempts rendered the identical video and the job was
  // cancelled at its time cap. Compared on what a beat renders from.
  const renderedAs = (p) => JSON.stringify((p?.beats || []).map((b) => [b.visual_type, b.data, b.headline, b.lead_in, b.kind, b.composition,
    b.motion_tier, b.camera_focus, b.persists_from, b.match_cut_prev, b.named_entities, b.photo, b.canvas]));
  if (renderedAs(next) === renderedAs(plan)) {
    console.log(`[enforce] the ${applied.length} applied directive(s) change nothing a beat renders from — no re-render of the same video`);
    return empty;
  }

  // Write the edited plan next to the original so the attempt that renders
  // it is inspectable afterwards, then point the plan at it.
  const out = planPath.replace(/\.json$/, `-enforced-attempt${attempt}.json`);
  writeFileSync(out, JSON.stringify(next, null, 2) + "\n");
  console.log(`[enforce] edited plan -> ${basename(out)}`);
  return { planPath: out, appliedCount: applied.length, failures };
}

/* ── Correction merge ────────────────────────────────────────────── */

/**
 * Write the corrections file the next planning attempt consumes.
 *
 * gemini-visual-plan.js reads `review.corrections` (falling back to
 * `review.wholeVideoResult.corrections`), so the merged file keeps that
 * shape and the planner needs no changes.
 *
 * Returns the path, or null when there is nothing actionable — in which case
 * the caller must NOT spend another attempt, since re-planning with no
 * instruction just re-rolls the dice.
 */
function writeMergedCorrections(runId, channelId, scriptPath, geminiReportPath, localAudit, attempt) {
  const fromGemini = (() => {
    if (!geminiReportPath || !existsSync(geminiReportPath)) return [];
    try {
      const r = JSON.parse(readFileSync(geminiReportPath, "utf-8"));
      return r.corrections || r.wholeVideoResult?.corrections || [];
    } catch { return []; }
  })();
  const fromAuditor = localAudit?.corrections || [];

  // Auditor findings first: they are specific and measured, and the planner
  // prompt lists corrections in order.
  const merged = [...fromAuditor, ...fromGemini];
  if (!merged.length) return null;

  const dir = join(ROOT, "data", "audit", "corrections", String(runId));
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${basename(scriptPath, extname(scriptPath))}-attempt${attempt}.json`);
  writeFileSync(out, JSON.stringify({
    generatedAt: new Date().toISOString(),
    channel: channelId,
    attempt,
    sources: { auditor: fromAuditor.length, gemini: fromGemini.length },
    corrections: merged,
  }, null, 2) + "\n");

  const byOwner = merged.reduce((a, c) => { a[c.owner || "GEMINI"] = (a[c.owner || "GEMINI"] || 0) + 1; return a; }, {});
  console.log(`[corrections] ${merged.length} for next attempt (auditor ${fromAuditor.length}, gemini ${fromGemini.length}) ${JSON.stringify(byOwner)}`);
  for (const c of merged.slice(0, 8)) console.log(`   ${c.scene || c.beat}: ${c.problem}`.slice(0, 160));
  return out;
}

/* ── Gemini review report lookup ─────────────────────────────────── */

function findGeminiReviewReport(channelId, scriptPath) {
  const slug = basename(scriptPath, extname(scriptPath)).replace(/-script$/, "");
  const reportDir = join(ROOT, "data", "audit", "gemini-review");
  if (!existsSync(reportDir)) return null;
  const files = readdirSync(reportDir).filter((f) => f.includes(slug) && f.endsWith(".json")).sort().reverse();
  return files.length ? join(reportDir, files[0]) : null;
}

/* ── Backup QA: local deterministic audit ────────────────────────── */

// When an AI stage (challenger, Gemini frame review, beat check) FAILS or
// cannot produce a verdict, the video is not simply lost: the rule-based
// scripts/local-audit.cjs decides which human queue it goes to. Neither
// queue is uploaded. local-pass -> data/renders/approved-review/ (a human
// looks when available); local-fail -> data/renders/rejected/. The video
// is NEVER counted as approved here: publish still only sees videos that
// passed every AI stage.
const LOCAL_AUDIT_CJS = join(__dirname, "local-audit.cjs");
// Wall-clock budget for this process: the render job's 18-minute timeout
// minus ~1.7 min of setup before this step (measured) and ~1.3 min of QA
// counts and uploads after it.
const PROCESS_T0 = Date.now();
// Default: the job's timeout (JOB_TIMEOUT_MIN) less ~5 min of setup and uploads.
const RENDER_QA_BUDGET_MS = Number(process.env.RENDER_QA_BUDGET_MIN || Math.max(5, Number(process.env.JOB_TIMEOUT_MIN || 20) - 5)) * 60000;
const APPROVED_DIR = join(ROOT, "data", "renders", "approved");
const APPROVED_REVIEW_DIR = join(ROOT, "data", "renders", "approved-review");
const REJECTED_DIR = join(ROOT, "data", "renders", "rejected");
const QUEUE_DIRS = { approved: APPROVED_DIR, "approved-review": APPROVED_REVIEW_DIR, rejected: REJECTED_DIR };

/**
 * The three queues (owner's rule, 2026-10-02): every channel that produces an
 * MP4 lands in exactly ONE of them, and no finished video is deleted.
 *   approved/         passed every check — the only queue publish reads
 *   approved-review/  passed the local audit, failed an AI check
 *   rejected/         failed the local audit, a deterministic gate, or crashed
 * The MP4 is MOVED (it must not stay where the publish step used to look) and
 * a companion <stem>.json is written:
 *   { run_id, channel, verdict, failed_stage, failed_check, reason,
 *     duration_s, queued_at, ...extra }
 * The one MP4 still removed: a superseded correction attempt, whose path the
 * next attempt re-renders to (logged as such) — the channel's final video is
 * what lands in the queue.
 */
async function queueVideo({ verdict, videoPath, channelId, stage = null, check = null, reason = "", extra = {} }) {
  if (!videoPath || !existsSync(videoPath)) return null;
  const dest = QUEUE_DIRS[verdict];
  const stem = basename(videoPath, ".mp4");
  const pd = await probeDuration(videoPath).catch(() => null);
  const duration = pd?.ok ? pd.value : null;
  mkdirSync(dest, { recursive: true });
  copyFileSync(videoPath, join(dest, `${stem}.mp4`));
  try { rmSync(videoPath); } catch {}
  const marker = {
    run_id: process.env.GITHUB_RUN_ID || null,
    channel: Number(channelId),
    verdict,
    failed_stage: stage,
    failed_check: check,
    reason: String(reason || "").slice(0, 500),
    duration_s: Number.isFinite(duration) ? Math.round(duration * 10) / 10 : null,
    queued_at: new Date().toISOString(),
    ...extra,
  };
  writeFileSync(join(dest, `${stem}.json`), JSON.stringify(marker, null, 2) + "\n");
  console.log(`[queue] ch-${channelId}: ${stem}.mp4 -> ${relative(ROOT, dest)}/ (${verdict}${stage ? `, failed ${stage}${check ? ` / ${check}` : ""}` : ""})`);
  return verdict;
}

// forceReject: the failure is one the local audit may not overrule (a
// wrong-person photo) — the video goes to rejected/ whatever the audit says.
async function backupAudit({ stage, reason, videoPath, planPath, srtPath, audio, channelId, forceReject = false, check = null }) {
  const stem = basename(videoPath, ".mp4");
  const reportPath = videoPath.replace(/\.mp4$/, "-backup-audit.json");
  const la = await runChild("node", [LOCAL_AUDIT_CJS,
    "--video", videoPath,
    "--manifest", videoPath.replace(/\.mp4$/, "-manifest.json"),
    "--plan", planPath || "",
    "--srt", srtPath || "",
    "--audio", audio || "",
    "--out", reportPath,
  ], { label: `backup-qa ${channelId}/${stem}` });
  const report = readJsonSafe(reportPath);
  const localPass = !forceReject && la.code === 0 && report?.pass === true;
  const failedChecks = (report?.checks || []).filter((c) => !c.pass).map((c) => `${c.id}: ${c.detail}`);
  const verdict = localPass ? "approved-review" : "rejected";
  const failedIds = (report?.checks || []).filter((c) => !c.pass).map((c) => c.id);
  await queueVideo({ verdict, videoPath, channelId, stage, reason,
    // failed_check: the gate's own failing check(s); for an AI stage, the local audit's failures when it rejected.
    check: check || (failedIds.length ? failedIds.join(",") : null),
    extra: { local_audit: la.code === 2 ? "could not run" : failedChecks.length ? failedChecks : "all checks passed" } });
  console.log(`[backup-qa] ${stage} failed (${String(reason || "").slice(0, 160)}) -> local audit ${localPass ? "PASS" : "FAIL"} -> ${verdict} (NOT uploaded)`);
  return { skipped: false, ok: false, queued: verdict };
}

// Frame review PASS = gemini-frame-review.js's own "VERDICT: APPROVED".
// As of 2026-10-05 that script PERSISTS the verdict (pipelineVerdict /
// pipelineReason), so the branch below is the normal path and the re-derivation
// after it is only reached for a report written before that change — or by a
// caller that never ran it. It used to be the only path: the script printed its
// verdict but never saved it, so this loop logged UNKNOWN and silently
// substituted looser thresholds (no CRITICAL, no monoculture, HIGH <= 30%,
// whole-video not FAIL at CRITICAL/HIGH) for the model's own call.
// A report with no pipelineVerdict is NOT evidence of a pass.
function frameReviewVerdict(geminiReport) {
  const report = geminiReport ? readJsonSafe(geminiReport) : null;
  if (!report) return { pass: false, error: true, reason: "Gemini frame review produced no report" };
  if (report.pipelineVerdict) {
    return { pass: report.pipelineVerdict === "APPROVED", reason: `${report.pipelineVerdict} — ${report.pipelineReason || ""}` };
  }
  // A whole-video review that did not produce a result (status ERROR or
  // missing) is a review that did not run — NOT a pass. Run 36370967090
  // ch-1: "Whole-video: ERROR (?/10)" was approved because only FAIL
  // rejected. It now counts as an error (backup audit), like a missing report.
  const wstat = String(report.wholeVideoResult?.status || "").toUpperCase();
  if (wstat !== "PASS" && wstat !== "FAIL") {
    return { pass: false, error: true, reason: `whole-video review produced no verdict (status ${wstat || "missing"})` };
  }
  const critical = report.summary?.critical ?? 0;
  const high = report.summary?.high ?? 0;
  const frames = report.totalFrames ?? 0;
  const whole = report.wholeVideoResult || {};
  const score = whole.overall_score != null ? ` ${whole.overall_score}/10` : "";
  if (critical > 0) return { pass: false, reason: `REJECTED — ${critical} CRITICAL frame(s)` };
  // Full-canvas style (2026-09-29): there is no reference video any more
  // (the paper reference was replaced by the owner's full-canvas spec, which
  // the reviewer gets as text), so the reference_match rule is gone and the
  // monoculture headline test applies again, as it did before the paper.
  // CRITICAL frames, HIGH-issue share and a failing whole-video severity
  // reject exactly as before.
  if (whole.headline_test?.monoculture) return { pass: false, reason: `REJECTED — TEMPLATE_MONOCULTURE ${whole.headline_test.percent ?? "?"}% headline-dominated` };
  if (high > Math.floor(frames * 0.3)) return { pass: false, reason: `NEEDS_IMPROVEMENT — ${high} HIGH issues across ${frames} frames` };
  if (whole.status === "FAIL" && (whole.severity === "CRITICAL" || whole.severity === "HIGH")) {
    return { pass: false, reason: `NEEDS_IMPROVEMENT — whole-video FAIL (${whole.severity})${score}` };
  }
  return { pass: true, reason: `APPROVED — whole-video ${whole.status || "?"}${score}` };
}

/* ── Real-asset resolution (fetch before render) ─────────────────── */

// For every VISUAL beat: a manifest asset matching its concept/asset_query
// -> a `photo` composition (+ the beat's counter); else its fallback drawing
// (the composition gemini-visual-plan.js built); else the render FAILS with
// the beat and concept. Unmatched concepts are fetched first
// (scripts/fetch-assets.cjs). The resolved plan is written next to the plan
// and is what render.js renders (VISUAL_PLAN_PATH).
const FETCH_ASSETS_CJS = join(__dirname, "fetch-assets.cjs");
const ASSET_MANIFEST = join(ROOT, "src", "skills", "remotion-render", "public", "asset-library", "manifest.json");
const MOVEMENTS = ["push", "drift-left", "drift-right", "reveal-left", "reveal-right"];
// Base-layer camera moves for layered beats (layered-scene.jsx).
const BASE_MOTIONS = ["push", "push-slow", "drift-left", "drift-right"];
const hashByte = (s, i = 0) => createHash("sha1").update(String(s || "")).digest()[i];

// The layered frame for a VISUAL beat: base (photo, or the fallback
// drawing) + grain texture + the named number + the kinetic phrase.
// Everything deterministic from the beat's own fields.
function layersFor(b, base) {
  const layers = [base, { role: "texture", kind: "grain" }];
  const num = b.number == null ? "" : String(b.number).trim();
  if (num && /\d/.test(num)) layers.push({ role: "overlay", kind: "number", text: num });
  const phrase = String(b.typography_direction?.phrase || b.caption || "").trim();
  if (phrase) {
    const style = base.kind === "photo" && hashByte(b.concept, 1) % 2 === 0 ? "mask" : "slam";
    layers.push({ role: "type", kind: "kinetic", text: phrase, style });
  }
  return layers;
}

function channelTopic(channelId) {
  try {
    const cfg = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
    const ch = resolveChannel(channelId, cfg.channels || cfg);
    return ch?.niche || null;
  } catch { return null; }
}
function findAsset(manifest, beat) {
  const norm = (x) => String(x || "").trim().toLowerCase();
  const c = norm(beat.concept), q = norm(beat.asset_query);
  return (manifest.assets || []).find((a) =>
    (a.concepts || []).some((x) => norm(x) === c) || (q && (a.asset_queries || []).some((x) => norm(x) === q)));
}
function variantFor(concept) {
  const t = String(concept || "").toLowerCase();
  if (/\b(screenshot|screen|app interface|dashboard|website)\b/.test(t)) return "screenshot";
  if (/\b(chart|graph)\b/.test(t)) return "chart";
  if (/\b(document|letter|filing|form|contract|certificate|report page)\b/.test(t)) return "document";
  return "photo";
}
// Deterministic: the same concept always gets the same movement.
function movementFor(concept) {
  const h = createHash("sha1").update(String(concept || "")).digest();
  return MOVEMENTS[h[0] % MOVEMENTS.length];
}

// Full-canvas content for one beat (visual/full-canvas.jsx draws it; there
// is no paper). The composition follows from the CHECKED visual type
// (canvas-layout.js compositionFor): a PHOTO that could not be
// resolved is drawn as TYPE-FULL, never as a stand-in image.
// "Source: <domain>" (owner's spec 2026-10-03, part C): the hostname of a fetched image's page,
// with Wikipedia's language subdomain and Wikimedia's upload host folded to their sites.
export function sourceCredit(url) {
  let h;
  try { h = new URL(String(url)).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
  if (/(^|\.)wikipedia\.org$/.test(h)) return "wikipedia.org";
  if (/wikimedia\.org$/.test(h)) return "commons.wikimedia.org";
  return h;
}

function canvasContentFor(b, { photo = null } = {}) {
  let vt = String(b.visual_type || "TYPE").toUpperCase();
  if (((vt === "PHOTO" || vt === "DOCUMENT" || vt === "MONEY") && !photo)) vt = "TYPE";
  const c = {
    visual_type: vt,
    data: vt === "TYPE" ? null : b.data || null,
    lead_in: b.lead_in || null,
    // An empty headline left a TYPE-FULL beat blank (run 36504143080 ch-44
    // beat 6, 1% of the frame): the planner's own on-screen phrase fills it.
    headline: b.headline || b.caption || b.visual_headline || b.typography_direction?.phrase || "",
    emphasis_word: b.emphasis_word || null,
    emphasis_words: Array.isArray(b.emphasis_words) ? b.emphasis_words.filter((w) => typeof w === "string").slice(0, 3) : [],
    photo: vt === "PHOTO" || vt === "DOCUMENT" || vt === "MONEY" ? photo : null,
    motion_tier: ["micro", "medium", "major"].includes(b.motion_tier) ? b.motion_tier : "medium",
    camera_focus: Array.isArray(b.camera_focus) ? b.camera_focus.slice(0, 2) : null,
    persists_from: Number.isInteger(b.persists_from) ? b.persists_from : null,
    match_cut_prev: !!b.match_cut_prev,
    named_entities: Array.isArray(b.named_entities) ? b.named_entities : [],
    // The planner's text entrance for the statement (a POP name or null);
    // scripts/anim-plan.js checks it against the video (POP_HARD on the hook /
    // CTA only, POP_LETTER once, POP_WORD_STACK only where it fits).
    text_entrance: b.text_entrance || null,
    // Zones (gemini-visual-plan.js checkZones; canvas-layout.js ZONES): only
    // a COUNTER beat is laid out with the swap (number top, headline middle).
    headline_zone: b.headline_zone === "middle" && b.chart_zone === "top" && vt === "COUNTER" ? "middle" : "top",
    chart_zone: b.headline_zone === "middle" && b.chart_zone === "top" && vt === "COUNTER" ? "top" : "middle",
    caption_zone: "bottom",
    // The beat's own ground, as the planner chose it (backgrounds.js resolveGround): a hex, or
    // null for the default white — a beat that said nothing is drawn exactly as before.
    ground_color: resolveGround(b.ground).hex,
  };
  if (b.type_layout === "split") c.type_layout = "split";
  // A named entity with no verified photo (resolve-scene.cjs): its name, large (canvas-layout.js).
  if (vt === "TYPE" && b.name_card?.name) c.name_card = b.name_card;
  // A logo or a money object fetched for this beat: the hero cutout (canvas-layout.js TYPE-FULL).
  if (vt === "TYPE" && b.hero_cutout) c.concept_visuals = [b.hero_cutout];
  // Composition variety's drawn-symbol fallback (scripts/composition-variety.js): the symbol for
  // what the sentence states ("risk" -> warning triangle) is the beat's hero. A name card keeps its name.
  else if (vt === "TYPE" && b.fallback_symbol && !b.name_card?.name) c.concept_visuals = [{ name: b.fallback_symbol, class: "symbol", w: 1, h: 1, fallback: true }];
  // Entrance style (part C.4, assigned by the planner): together | staggered | visual-first.
  if (b.entrance_style) c.entrance_style = b.entrance_style;
  // The planner's own layout (canvas-layout.js applyPlanLayout): where each element of this beat
  // goes, on a grid the planner chose. Passed through as written — the layout code reads it.
  if (b.layout && typeof b.layout === "object" && Array.isArray(b.layout.slots) && b.layout.slots.length) {
    c.layout = { cols: b.layout.cols ?? null, rows: b.layout.rows ?? null, slots: b.layout.slots.slice(0, 16) };
    console.log(`[layout] beat ${b.index ?? "?"}: plan layout ${c.layout.cols ?? "-"}x${c.layout.rows ?? "-"} — ${c.layout.slots.map((sl) => sl.id).join(", ")}`);
  }
  // Source credit (part C): the domain of the beat's fetched image.
  const credit = sourceCredit(photo?.source_url || b.hero_cutout?.source_url);
  if (credit) c.source_credit = credit;
  // The word the entity visual pops on (gemini-visual-plan.js; timed in render.js, visual/entity-sync.js).
  if (b.entity_anchor_word) c.anchor_word = b.entity_anchor_word;
  // A beat with a hero (cutout, logo, drawn symbol) is TYPE-FULL: the split layout has no hero
  // slot, and a TYPE-SPLIT carrying a symbol drew none (CI run 37125010644 ch-48 beat 3:
  // middle zone 12% filled, rejected).
  const hasHero = (c.concept_visuals || []).length > 0;
  if (hasHero) delete c.type_layout;
  c.composition = compositionFor(vt, !!c.photo, { view: c.photo?.view, split: !hasHero && c.type_layout === "split" && !!splitHeadline(c.headline) });
  return c;
}

async function resolveAssets(channelId, planPath) {
  const plan = readJsonSafe(planPath);
  if (!plan?.beats?.length) return { ok: false, reason: `no plan at ${planPath}` };
  if (plan.beats.some((b) => b.kind === "EDITORIAL" || b.headline !== undefined)) return resolveCanvas(channelId, planPath, plan);
  const visual = plan.beats.filter((b) => b.kind === "VISUAL");
  const typeBeats = plan.beats.filter((b) => b.kind === "TYPE").length;
  let manifest = readJsonSafe(ASSET_MANIFEST) || { assets: [] };
  let fetchedNew = 0;
  const wanted = visual.filter((b) => b.concept && !findAsset(manifest, b))
    .map((b) => ({ beat: b.index, concept: b.concept, asset_query: b.asset_query || b.concept }));
  if (wanted.length) {
    const tmpIn = planPath.replace(/\.json$/, "-asset-requests.json");
    const tmpOut = planPath.replace(/\.json$/, "-asset-results.json");
    writeFileSync(tmpIn, JSON.stringify(wanted, null, 2) + "\n");
    const topic = channelTopic(channelId);
    const f = await runChild("node", [FETCH_ASSETS_CJS, "--in", tmpIn, "--out", tmpOut, ...(topic ? ["--topic", topic] : [])],
      { label: `assets ${channelId}` });
    if (f.code !== 0) return { ok: false, reason: `fetch-assets.cjs exited ${f.code}` };
    manifest = readJsonSafe(ASSET_MANIFEST) || { assets: [] };
    fetchedNew = (readJsonSafe(tmpOut)?.resolved || []).length;
  }
  const counts = { photo: 0, drawing: 0, type: typeBeats };
  for (const b of visual) {
    const asset = b.concept ? findAsset(manifest, b) : null;
    const counter = (b.composition?.objects || []).find((o) => o.kind === "counter");
    if (asset) {
      const movement = movementFor(b.concept);
      const photo = { kind: "photo", asset: asset.local_path, variant: variantFor(b.concept), movement,
        anchor: "center", motion: "appear", label: b.caption || undefined, emphasis: true };
      b.fallback_composition = b.composition;
      b.composition = { objects: counter ? [photo, counter] : [photo] };
      b.asset = { id: asset.id, source: asset.source, source_url: asset.source_url, license: asset.license, attribution: asset.attribution };
      b.layers = layersFor(b, { role: "base", kind: "photo", asset: asset.local_path, variant: photo.variant, motion: BASE_MOTIONS[hashByte(b.concept) % BASE_MOTIONS.length] });
      console.log(`[layers] beat ${b.index}: ${b.layers.map((l) => l.role + ":" + (l.kind === "photo" ? "photo/" + l.motion : l.kind === "kinetic" ? "type/" + l.style : l.kind)).join(" + ")}`);
      counts.photo++;
      console.log(`[assets] beat ${b.index} photo ${asset.id} (${asset.license}) movement=${movement} variant=${photo.variant} — "${b.concept}"`);
    } else if ((b.composition?.objects || []).some((o) => o.kind === "library_shape")) {
      counts.drawing++;
      const d = b.composition.objects.find((o) => o.kind === "library_shape").name;
      b.layers = layersFor(b, { role: "base", kind: "drawing", name: d, label: b.caption || undefined, motion: BASE_MOTIONS[hashByte(b.concept) % BASE_MOTIONS.length] });
      console.log(`[layers] beat ${b.index}: ${b.layers.map((l) => l.role + ":" + (l.kind === "drawing" ? "drawing/" + l.name : l.kind === "kinetic" ? "type/" + l.style : l.kind)).join(" + ")}`);
      console.log(`[assets] "${b.concept || "(no concept)"}" unresolved → fallback_drawing "${d}" (beat ${b.index})`);
    } else {
      console.error(`::error::[assets] beat ${b.index}: no real asset and no valid fallback_drawing for "${b.concept || "(no concept)"}" — not rendering`);
      return { ok: false, reason: `beat ${b.index} unresolved` };
    }
  }
  // A beat that is neither VISUAL nor TYPE came from a path that does not
  // speak this schema (e.g. an old cached plan) — refuse rather than guess.
  const other = plan.beats.filter((b) => b.kind !== "VISUAL" && b.kind !== "TYPE");
  if (other.length) {
    console.error(`::error::[assets] beat(s) ${other.map((b) => b.index).join(", ")} have no kind (VISUAL/TYPE) — not rendering`);
    return { ok: false, reason: "beats without kind" };
  }
  const out = planPath.replace(/\.json$/, "-resolved.json");
  writeFileSync(out, JSON.stringify(plan, null, 2) + "\n");
  console.log(`[assets] resolved ${basename(planPath)}: photo ${counts.photo}, drawing ${counts.drawing}, type ${counts.type}`);
  return { ok: true, planPath: out, counts, fetchedNew };
}

// Full-canvas plans.
// PHOTO beats resolve a named person / place / organization to a verified
// Wikimedia photo (scripts/entity-assets.cjs); COUNTER / BAR / PIE / LINE /
// GAUGE / MAP / PROCESS are drawn from the plan's checked data; TYPE is
// typography. An unresolved PHOTO becomes TYPE-FULL — never a
// generic photo (CLAUDE.md: real, verified photos only for named entities).
// Cutouts: the PNG bank (if a person supplies one), else a live Pixabay fetch
// for the beat — each verified by a vision model before it is used. The old
// library (public/cutouts/) is deleted (owner's rule 2026-10-02): it shipped a
// sun dial as "calendar", a wooden box as "coin-stack", a stamp as
// "magnifying-glass". A concept with no verified candidate renders without one.
const PUBLIC_DIR = join(ROOT, "src", "skills", "remotion-render", "public");
const CUTOUT_SPECS = readJsonSafe(join(ROOT, "scripts", "cutout-specs.json"))?.specs || [];
// The curated PNG bank (owner's option, 2026-10-02): public/png-bank/<name>.png
// (+ <name>.json metadata), supplied by a person — the FIRST source, ahead of
// the live fetch. Looked up by concept name, then by the concept phrase's slug.
const PNG_BANK = join(ROOT, "src", "skills", "remotion-render", "public", "png-bank");
function bankCutout(name, concept) {
  for (const key of [name, String(concept || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")]) {
    const png = join(PNG_BANK, `${key}.png`);
    if (!key || !existsSync(png)) continue;
    const meta = readJsonSafe(join(PNG_BANK, `${key}.json`)) || {};
    let w = meta.width, h = meta.height;
    if (!(w && h)) { try { const b = readFileSync(png); if (b.toString("ascii", 12, 16) === "IHDR") { w = b.readUInt32BE(16); h = b.readUInt32BE(20); } } catch {} }
    return { name, class: "cutout", asset: `png-bank/${key}.png`, w: w || 1, h: h || 1, source: "bank", file: `${key}.png` };
  }
  return null;
}

async function resolveCanvas(channelId, planPath, plan) {
  let fetchedNew = 0;
  const counts = { by_comp: {}, photos: 0, entity_fallbacks: 0 };
  const entities = { resolved: [], fell_back: [], rejected: [] };
  // THE SCENE RESOLVER (owner's spec 2026-10-02; scripts/resolve-scene.cjs).
  // Every content beat that is not already a chart / map / process / list
  // (those draw the sentence's own data) shows what it NAMES: a person as a
  // verified PORTRAIT, a building or an organization's building as
  // ARCHITECTURE, a place as SCENE-FULL — each from Wikipedia / Wikimedia
  // first, verified, MATCH only. A named entity with no verified photo in any
  // source becomes a NAME CARD (its name large, the sentence's figure or key
  // phrase under it) — never a stand-in photo, never an empty middle zone.
  // The hook and the CTA stay typography. Objects go to the cutout path below.
  const REAL = ["person", "company", "institution", "building", "organization", "place"];   // within a beat: a person first
  const DRAWN = new Set(["COUNTER", "BAR", "PIE", "LINE", "GAUGE", "MAP", "PROCESS", "LIST", "TIMELINE", "COMPARE"]);
  const countries = plan.beats.flatMap((x) => (x.named_entities || []).filter((e) => e.type === "place").map((e) => e.name)).filter((n) => resolveRegionName(n));
  const keyPhraseOf = (b, name) => {
    const num = (b.named_entities || []).find((e) => e.type === "number")?.name || b.data?.value || null;
    if (num) return String(num);
    const h = String(b.headline || b.visual_headline || "").trim();
    return h && h.toLowerCase() !== String(name).toLowerCase() ? h : "";
  };
  // Every channel resolves every beat the same way (no channel-specific skip exists).
  console.log(`[resolve] starting PNG fetch for ch-${channelId}, ${plan.beats.length} beats to resolve`);
  for (const [bi, b] of plan.beats.entries()) {
    let photo = null;
    const vt = String(b.visual_type || "").toUpperCase();
    delete b.name_card; delete b.hero_cutout;
    if (vt === "MONEY") {
      // Money (owner's spec 2026-10-03, part G): the object the sentence means (a bill of its
      // denomination, a stack of bills, a coin, a piggy bank...) as a clean, verified cutout —
      // a bill or coin from Wikipedia / Wikimedia first and checked FLAT (fetch-cutout-once.cjs),
      // shown whole as the hero; not a full-bleed photo that crops it.
      const obj = String(b.data?.object || "dollar bill").toLowerCase();
      const value = b.data?.value || null;
      const spec = CUTOUT_SPECS.find((x) => x.name === obj.replace(/\s+/g, "-")) || {};
      const r = await fetchCutoutForBeat({ concept: obj, name: obj, channel: channelId, beat_index: b.index, spec, scene: b.scene_description || null });
      b.visual_type = "TYPE"; b.data = null; delete b.type_layout;
      if (r) {
        b.hero_cutout = { name: obj, class: "cutout", asset: r.png_path, w: r.width || 1, h: r.height || 1, source: r.source, source_url: r.source_url, money: true, ink: await inkOf(r.abs_path) };
        if (value && !String(b.headline || "").includes(String(value).replace(/\s.*$/, ""))) b.lead_in = String(value);
        fetchedNew++;
        entities.resolved.push(`beat ${b.index}: money "${obj}" -> ${r.png_path} (${r.source}, ${r.license})`);
      } else {
        entities.fell_back.push(`beat ${b.index}: money "${obj}": no verified cutout`);
        counts.entity_fallbacks++;
      }
    } else if (vt === "DOCUMENT") {
      // A real scan of the named instrument / a real photo of the money object;
      // none found -> the beat is TYPE (never a stand-in).
      const r = vt === "DOCUMENT" ? await resolveDocument({ name: b.data?.name }) : await resolveMoney({ query: b.data?.object });
      // Every fetched photo is verified before use (owner's spec 2026-10-02, task 2.4). The
      // document lookup matched "HOME Act" to a photo of people announcing a DIFFERENT act
      // (CI run 37031119023 ch-2 beat 4); a file name is not what the image shows.
      if (r.ok) {
        const what = vt === "DOCUMENT" ? `the document "${b.data?.name}" (a scan or photograph of its pages)` : `${b.data?.object} (a photograph of it)`;
        const v = await verifyPlaceImage(join(PUBLIC_DIR, r.asset), what);
        console.log(`[resolve] ch-${channelId} beat ${b.index}: ${vt.toLowerCase()} "${b.data?.name || b.data?.object}"
    → ${r.file_title || r.asset}
    → verified ${v.verdict === "NONE" ? "UNAVAILABLE" : v.verdict} (${v.seen})`);
        if (v.verdict !== "MATCH") { r.ok = false; r.why = `verifier: ${v.verdict} (${v.seen})`; r.attempts = []; }
      }
      if (r.ok) {
        if (!r.cached) fetchedNew++;
        photo = { asset: r.asset, entity: vt === "DOCUMENT" ? b.data.name : null, kind: vt.toLowerCase(), view: vt === "DOCUMENT" ? "document" : "money", credit: r.credit, source_url: r.source_url, license: r.license };
        entities.resolved.push(`${vt.toLowerCase()} "${b.data?.name || b.data?.object}" -> ${r.asset} (attempt ${r.attempt ?? "cache"}, ${r.license})`);
        console.log(`[entity] ${vt} "${b.data?.name || b.data?.object}" resolved: ${r.asset} — ${r.page_title || ""} (${r.license})`);
      } else {
        entities.fell_back.push(`${vt.toLowerCase()} "${b.data?.name || b.data?.object}": ${r.why}`);
        console.log(`[entity] ${vt} "${b.data?.name || b.data?.object}" fell back to typography: ${r.why}${(r.attempts || []).length ? " — " + r.attempts.join(" | ") : ""}`);
        counts.entity_fallbacks++;
        // A named instrument with no verified scan: its name card (task 4.3).
        if (vt === "DOCUMENT" && b.data?.name && bi !== 0 && bi !== plan.beats.length - 1) { b.name_card = { name: b.data.name, sub: keyPhraseOf(b, b.data.name) }; b.visual_type = "TYPE"; b.data = null; }
      }
    } else if (!DRAWN.has(vt)) {
      // Every beat that names something gets its picture — the hook and the CTA too (owner's
      // spec 2026-10-03, "PNGs on every beat"; this replaces "the hook stays typography").
      const ents = await sceneEntities({ beat: b, sentence: b.narration || "", entityNamedInSentence });
      const real = ents.filter((e) => REAL.includes(e.type))
        .sort((x, y) => (y.name === b.data?.entity) - (x.name === b.data?.entity) || REAL.indexOf(x.type) - REAL.indexOf(y.type));
      const named = [];   // real, resolvable names that found no verified photo: the name card's subject
      for (const e0 of real) {
        // A country or US state is drawn as its MAP (below), not a photo: verified photos of
        // "California" (a beach) and "North Korea" (a skyline) matched the place and nothing in
        // the sentence (beat check NO, CI run 37113140609 ch-2 / ch-26). Cities, buildings and
        // landmarks keep the photo path.
        if (e0.type === "place" && resolveRegionName(e0.name)) continue;
        // A generic institution name ("Supreme Court", "the central bank") names a
        // different building in every country (run 36504143080 ch-2): qualified with
        // the script's one country, or refused.
        const q = ["organization", "institution", "building"].includes(e0.type) ? qualifyEntity(e0, countries) : { ent: e0 };
        if (q.note) console.log(`[entity] ${q.note}`);
        if (!q.ent?.name) { entities.fell_back.push(`${e0.type} "${e0.name}": ${q.note}`); named.push(e0); continue; }
        const r = await resolveSceneEntity({ channel: channelId, beatIndex: b.index, entity: q.ent, context: channelTopic(channelId) || "", scene: b.scene_description || null, sentence: b.narration || "" });
        if (r.ok && r.logo) {
          // A company / institution logo (part B): the hero cutout of a TYPE-FULL beat.
          b.visual_type = "TYPE"; b.data = null; delete b.type_layout;
          b.hero_cutout = { name: e0.name, class: "cutout", asset: r.logo.asset, w: r.logo.w, h: r.logo.h, logo: true, source: r.logo.source, source_url: r.logo.source_url, ink: await inkOf(r.logo.abs) };
          fetchedNew++;
          entities.resolved.push(`beat ${b.index}: ${e0.type} "${e0.name}" -> logo ${r.logo.asset} (${r.logo.source}, ${r.logo.license})`);
          break;
        }
        if (r.ok) {
          photo = { ...r.photo, entity: e0.name };
          fetchedNew++;   // a new file under public/: the bundle is rebuilt (run 36498049819)
          entities.resolved.push(`beat ${b.index}: ${e0.type} "${e0.name}" -> ${photo.asset} (${photo.source}, ${photo.license || "?"})`);
          b.visual_type = "PHOTO"; b.data = { entity: e0.name, entity_type: e0.type };
          break;
        }
        entities.fell_back.push(`beat ${b.index}: ${e0.type} "${e0.name}": ${r.why}`);
        // A refused acronym ("AI", "ED") is not a name: no name card is made of it.
        if (!r.refused) named.push(e0);
      }
      // A country / US state with no verified photo is still shown as ITSELF: the drawn
      // map (MAP-CENTERED, the region's real outline) — not a name card, never a stand-in.
      const region = !photo && real.find((e) => e.type === "place" && resolveRegionName(e.name));
      const mv = region ? checkVisual({ visual_type: "MAP", data: { place: region.name }, named_entities: b.named_entities }, b.narration || "") : null;
      if (mv && !mv.why && mv.type === "MAP") {
        b.visual_type = "MAP"; b.data = mv.data; delete b.type_layout;
        console.log(`[resolve] ch-${channelId} beat ${b.index}: no verified photo of place "${region.name}" — rendering its map (MAP-CENTERED)`);
      } else if (!photo && !b.hero_cutout && named.length) {
        b.visual_type = "TYPE"; b.data = null; delete b.type_layout;
        counts.entity_fallbacks++;
        // The hook and the CTA are never fragile (owner's note 2026-10-03): with no verified
        // picture they fall to the plain TYPE-FULL statement, not a name card.
        if (bi === 0 || bi === plan.beats.length - 1) {
          console.log(`[resolve] ch-${channelId} beat ${b.index}: no verified photo of ${named.map((e) => `${e.type} "${e.name}"`).join(", ")} — the ${bi === 0 ? "hook" : "CTA"} renders as its plain TYPE-FULL statement`);
        } else {
          b.name_card = { name: named[0].name.replace(/\s*\([^)]*\)/g, "").trim(), sub: keyPhraseOf(b, named[0].name) };
          console.log(`[resolve] ch-${channelId} beat ${b.index}: no verified photo of ${named.map((e) => `${e.type} "${e.name}"`).join(", ")} — rendering as TYPE with the name only ("${b.name_card.name}"${b.name_card.sub ? ` / "${b.name_card.sub}"` : ""})`);
        }
      }
    }
    b.canvas = canvasContentFor(b, { photo });
    if (photo) b.asset = { id: photo.asset, source: photo.source || "wikimedia", source_url: photo.source_url, license: photo.license, attribution: photo.credit };
  }
  // NO REPEAT, again, on what actually resolved (a real photo of a building is
  // ARCHITECTURE; a DOCUMENT / MONEY / PHOTO with no image became TYPE): the
  // same rule and alternatives as the planner (composition-rotation.js), the
  // same gates (checkVisual). A beat holding a real photo is never given up
  // while it is the video's last one — a script that names an entity shows one.
  {
    const narr = (b) => b.narration || "";
    const imageBeats = () => plan.beats.filter((b) => b.canvas.photo).length;
    const rot = enforceRotation(plan.beats.length, {
      // A name card is its own composition exactly as local-audit canvas-type keys it: by the
      // lead_phrase box, which the layout draws only when the card has a sub-phrase. A bare-name
      // card next to a TYPE-FULL statement is "TYPE-FULL twice" to the audit (CI run
      // 37119036921 ch-1 beat 1, rejected), so it is keyed — and rotated — the same way here.
      compositionOf: (i) => plan.beats[i].canvas.composition + (String(plan.beats[i].canvas.name_card?.sub || "").trim() ? "+NAME" : "") + ((plan.beats[i].canvas.concept_visuals || []).length ? `+HERO:${plan.beats[i].canvas.concept_visuals[0].name || ""}` : ""),
      // A two-number comparison drawn as a chart (part D) is never rotated away.
      candidates: (i) => (plan.beats[i].canvas.photo && imageBeats() <= 1 ? [] : comparisonNumbers(narr(plan.beats[i])) && ["BAR", "LINE", "PIE", "GAUGE"].includes(String(plan.beats[i].visual_type).toUpperCase()) ? [] : candidatesFor({ sentence: narr(plan.beats[i]), headline: plan.beats[i].canvas.headline || "" })),
      accept: (i, alt) => {
        const b = plan.beats[i];
        const v = checkVisual({ visual_type: alt.visual_type, data: alt.data || {}, named_entities: b.named_entities }, narr(b));
        if (v.why || v.type !== alt.visual_type) return false;
        const fk = figureKey(v);
        return !(fk && plan.beats.some((x, j) => j !== i && figureKey(checkVisual(x, narr(x))) === fk));
      },
      apply: (i, alt) => {
        const b = plan.beats[i];
        const v = checkVisual({ visual_type: alt.visual_type, data: alt.data || {}, named_entities: b.named_entities }, narr(b));
        b.visual_type = v.type; b.data = v.data;
        if (alt.extra?.split) b.type_layout = "split"; else delete b.type_layout;
        b.canvas = canvasContentFor(b, {});
      },
      log: (m) => console.log(m.replace("[plan]", "[canvas]")),
    });
    if (rot.repeats.length) console.warn(`::warning::[canvas] composition repeats left after rotation: beats ${rot.repeats.join(", ")} (nothing else in their sentences is grounded)`);
  }
  // VISUAL-FIRST (owner's spec 2026-10-02): of the content beats (not the
  // hook, not the CTA), >= 60% visual and <= 40% TYPE; a sentence that names a
  // number, place, process or comparison is a VISUAL beat. Every content TYPE
  // beat whose OWN sentence grounds a visual (candidatesFor + checkVisual, the
  // planner's gates — nothing is invented) is converted, unless that would put
  // one composition twice in a row (canvas-type). A sentence that grounds
  // nothing stays TYPE (it may still get a concept cutout below); the ratio
  // is logged, and missed when the script is abstract.
  {
    const narr = (b) => b.narration || "";
    const isType = (b) => ["TYPE-FULL", "TYPE-SPLIT"].includes(b.canvas.composition) && !b.canvas.photo;
    const n = plan.beats.length;
    let converted = 0;
    for (let i = 1; i < n - 1; i++) {
      const b = plan.beats[i];
      // A name card stays a name card (owner's spec 2026-10-02, task 4.3: the entity's name and figure, not a chart).
      if (!isType(b) || b.canvas.name_card) continue;
      for (const alt of candidatesFor({ sentence: narr(b), headline: b.canvas.headline || "" })) {
        if (["TYPE-FULL", "TYPE-SPLIT"].includes(alt.composition)) continue;
        const v = checkVisual({ visual_type: alt.visual_type, data: alt.data || {}, named_entities: b.named_entities }, narr(b));
        if (v.why || v.type !== alt.visual_type) continue;
        const fk = figureKey(v);
        if (fk && plan.beats.some((x, j) => j !== i && figureKey(checkVisual(x, narr(x))) === fk)) continue;
        if ([plan.beats[i - 1], plan.beats[i + 1]].some((x) => x?.canvas?.composition === alt.composition)) continue;
        const was = b.canvas.composition;
        b.visual_type = v.type; b.data = v.data; delete b.type_layout;
        b.canvas = canvasContentFor(b, {});
        converted++;
        console.log(`[visual-first] ch-${channelId} beat ${b.index}: ${was} -> ${b.canvas.composition} ${v.type} (grounded in its sentence)`);
        break;
      }
    }
    const content = plan.beats.slice(1, n - 1);
    const typeN = content.filter(isType).length;
    const share = content.length ? (content.length - typeN) / content.length : 1;
    console.log(`[visual-first] ch-${channelId}: ${converted} beat(s) converted; content beats ${content.length - typeN}/${content.length} visual (${(share * 100).toFixed(0)}%, target >= 60%)${share < 0.6 ? " — the remaining TYPE sentences ground no number, place or process" : ""}`);
  }
  // (The old "at least one photo" pass is gone: the scene resolver above already tries every
  // content beat's named entities.)
  // Typography rebuild: sentence case from the narration, left / right
  // variant, dark beats, the one emphasis word, the one vertical beat, the
  // number accent (visual/canvas-style.js — every rule is unit-tested).
  {
    const styled = styleCanvases(plan.beats.map((b) => b.canvas), plan.beats.map((b) => b.narration || ""));
    console.log(`[canvas] style: dark beats ${JSON.stringify(styled.dark)}, emphasis beat ${styled.emphasis}, vertical beat ${styled.vertical}, biggest figure beat ${styled.accentBest}`);
  }
  // Concept visuals (visual/concept-visuals.js): a text-only beat shows what
  // its sentence names. Cutouts are fetched FOR THIS BEAT before the render
  // (scripts/fetch-cutout-once.cjs: Pixabay -> rembg -> geometric checks ->
  // content verification: LITERAL and recognizable only). A bank PNG is
  // verified the same way before use. No library: a concept with no verified
  // candidate renders without a cutout. Symbols are drawn.
  // Fetching never happens inside renderMedia: a slow network cannot time
  // the render out. Budget: 4 minutes a channel, 3 fetches at a time (the
  // fetcher's own token bucket keeps Pixabay <= 30 requests a minute).
  {
    const ALL = CUTOUT_SPECS.map((s) => s.name);
    const PEOPLE = new Set(CUTOUT_SPECS.filter((s) => s.category === "people").map((s) => s.name));
    const T0 = Date.now(), BUDGET_MS = Number(process.env.CUTOUT_LIVE_BUDGET_MS || 4 * 60000);
    const stats = { bank: 0, live: 0, symbol: 0, none: 0, rejected: [] };
    // 1. Which beats, which concepts.
    const wanted = [];
    for (const [bi, b] of plan.beats.entries()) {
      const c = b.canvas;
      // TYPE-SPLIT beats are text-only too (TEMPLATE_MONOCULTURE, CI run
      // 36953236514); converted in step 3 only if a visual resolves.
      // (a logo or a money object already holds the hero cutout: part B / G)
      if (!["TYPE-FULL", "TYPE-SPLIT"].includes(c.composition) || c.emphasis_beat || c.vertical || c.name_card || (c.concept_visuals || []).length || String(c.visual_type).toUpperCase() !== "TYPE") continue;
      // The hook and the CTA get their object too (owner's spec 2026-10-03, "PNGs on every
      // beat" — this replaces "the hook and the CTA stay TYPE").
      const vc = validateConcepts(b.concepts, b.narration || "", CUTOUT_SPECS);
      // A generic person cutout on a beat that NAMES a person would read as
      // that person: people concepts are dropped there (the person stays on
      // the Wikipedia path, entity-assets.cjs).
      const namesPerson = (b.named_entities || []).some((e) => e.type === "person");
      // Free-form people words count as people too (a stock "man" on a beat naming a person).
      const PEOPLE_WORDS = /\b(man|men|woman|women|person|people|officer|official|ceo|leader|worker|workers|scientist|doctor|judge|lawyer|founder|president|minister)\b/;
      const isPeople = (n) => PEOPLE.has(n) || PEOPLE_WORDS.test(n);
      if (namesPerson && vc.concepts.some(isPeople)) console.log(`[concepts] ch-${channelId} beat ${b.index}: names a person — generic people cutouts dropped (${vc.concepts.filter(isPeople).join(", ")})`);
      const names = (namesPerson ? vc.concepts.filter((n) => !isPeople(n)) : vc.concepts).slice(0, 3);
      if (names.length) wanted.push({ bi, b, names, from: vc.from });
    }
    // 2. Resolve: symbol drawn; cutout bank (verified) -> live (verified) -> none; scene none.
    // Three questions (verify-image.cjs, owner's spec 2026-10-03 part E): shows YES, LITERAL, CLEAN.
    const { verifyImage } = createRequireEntity(import.meta.url)("./verify-image.cjs");
    const { FLAT_MONEY } = createRequireEntity(import.meta.url)("./fetch-cutout-once.cjs");
    const results = new Map();   // `${bi}:${name}` -> visual | null
    const tasks = [];
    for (const w of wanted) for (const name of w.names) {
      const cls = classOf(name, ALL);
      if (cls === "symbol") { results.set(`${w.bi}:${name}`, { name, class: "symbol", w: 1, h: 1 }); continue; }
      if (cls === "scene") { console.log(`[cutout-live] ch-${channelId} beat ${w.b.index}: "${name}" is a scene (no scene-photo source), skipped`); continue; }
      // cls null = a free-form object the sentence names ("solar panel"): fetched live only.
      tasks.push({ w, name });
    }
    let next = 0;
    const worker = async () => {
      while (next < tasks.length) {
        const { w, name } = tasks[next++];
        const spec = CUTOUT_SPECS.find((s) => s.name === name) || {};
        const raw = (spec.queries || [name.replace(/-/g, " ")])[0];
        const concept = spec.queries ? raw : qualifyConcept(raw, `${w.b.narration || ""} ${w.b.scene_description || ""}`);
        if (concept !== raw) console.log(`[cutout] ch-${channelId} beat ${w.b.index} "${raw}" -> "${concept}" (the material the sentence gives it)`);
        let v = bankCutout(name, concept);
        if (v) {
          // A person supplied it, but it is verified like any fetched PNG.
          const vr = await verifyImage(join(PUBLIC_DIR, v.asset), { entity: concept, type: "object", scene: w.b.scene_description || null, money: FLAT_MONEY(concept) });
          if (vr.accept) { Object.assign(v, { verdict: vr.kind, seen: vr.seen, source_url: `png-bank/${v.file}` }); console.log(`[cutout] ch-${channelId} beat ${w.b.index} "${concept}": bank file ${v.file} ACCEPTED (${vr.reason}, saw "${vr.seen}")`); results.set(`${w.bi}:${name}`, v); continue; }
          console.log(`[cutout] ch-${channelId} beat ${w.b.index} "${concept}": bank file ${v.file} REJECTED (${vr.reason}, saw "${vr.seen}")`);
          v = null;
        } else console.log(`[cutout] ch-${channelId} beat ${w.b.index} "${concept}": not in bank, fetching live`);
        if (Date.now() - T0 < BUDGET_MS) {
          const r = await fetchCutoutForBeat({ concept, name, channel: channelId, beat_index: w.b.index, spec, scene: w.b.scene_description || null });
          if (r) { v = { name, class: "cutout", asset: r.png_path, w: r.width || 1, h: r.height || 1, source: "live", source_url: r.source_url, verdict: r.literal, seen: r.seen }; }
        } else console.log(`[cutout] ch-${channelId} beat ${w.b.index} "${concept}": ${(BUDGET_MS / 60000).toFixed(0)}-minute budget spent, not fetched — beat renders without a cutout`);
        results.set(`${w.bi}:${name}`, v);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    // Each cutout's ink outline: the layout sizes, centres and tilts the hero by
    // what a frame shows of it, not by the PNG rectangle (scripts/cutout-ink.mjs).
    for (const v of results.values()) {
      if (v?.class === "cutout" && v.asset && !v.ink) v.ink = await inkOf(join(PUBLIC_DIR, v.asset));
    }
    const resolved =[...results.values()].filter((v) => v && v.class === "cutout").length;
    if (Date.now() - T0 >= BUDGET_MS) console.log(`[cutout-live] ch-${channelId}: ${(BUDGET_MS / 60000).toFixed(0)}-minute budget reached, using ${resolved}/${tasks.length} resolved cutouts`);
    // 3. Attach, in beat order (the TYPE-SPLIT conversion sees its final neighbours).
    for (const w of wanted) {
      const visuals = w.names.map((n) => results.get(`${w.bi}:${n}`)).filter(Boolean);
      for (const v of visuals) stats[v.class === "symbol" ? "symbol" : v.source]++;
      if (!visuals.length) { stats.none++; continue; }
      // Two cutout beats in a row both render (owner's spec 2026-10-03, C.3 — the earlier
      // "never a hero next to a hero" guard is removed); canvas-type keys a hero beat by its
      // object, so only the SAME object twice in a row is a repeat.
      const c = w.b.canvas;
      if (c.composition === "TYPE-SPLIT") {
        // A hero-cutout beat is not a plain statement: next to a TYPE-FULL it is
        // not "TYPE-FULL twice" (local-audit canvas-type keys it as +HERO).
        c.composition = "TYPE-FULL"; delete c.type_layout;
        console.log(`[concepts] ch-${channelId} beat ${w.b.index}: TYPE-SPLIT -> TYPE-FULL concept beat`);
      }
      c.concept_visuals = visuals;
      // Source credit (part C): the fetched cutout's page domain.
      { const cr = sourceCredit(visuals.find((v) => v.class === "cutout")?.source_url); if (cr) c.source_credit = cr; }
      console.log(`[concepts] ch-${channelId} beat ${w.b.index}: ${visuals.map((v) => `${v.name} (${v.class === "symbol" ? "symbol" : v.source})`).join(", ")} — from the ${w.from}`);
      // Every rendered cutout: where it came from and what the verifier saw (owner's audit trail).
      for (const v of visuals.filter((x) => x.class === "cutout")) {
        console.log(`[cutout] ch-${channelId} beat ${w.b.index}: "${v.name}" from ${v.source === "live" ? "pixabay" : v.source}, verdict=${v.verdict}, seen="${v.seen}"`);
        console.log(`[cutout] ch-${channelId} beat ${w.b.index}: source=${v.source_url || "?"}`);
      }
    }
    console.log(`[cutout-live] ch-${channelId}: ${stats.bank} from the bank, ${stats.live} live, ${stats.symbol} symbol(s), ${stats.none} concept beat(s) with no visual; ${((Date.now() - T0) / 1000).toFixed(0)} s`);
    // Final visual-first ratio (owner spec 2026-10-02): a TYPE beat that shows a
    // named object (a concept cutout / symbol) counts as visual.
    {
      const content = plan.beats.slice(1, -1);
      const vis = content.filter((b) => !(["TYPE-FULL", "TYPE-SPLIT"].includes(b.canvas.composition) && !b.canvas.photo) || (b.canvas.concept_visuals || []).length).length;
      const share = content.length ? vis / content.length : 1;
      console.log(`[visual-first] ch-${channelId} final: ${vis}/${content.length} content beats visual (${(share * 100).toFixed(0)}%, ${share >= 0.6 ? "passes" : "under the 60% target"})`);
      // Two-number comparisons (part D) as drawn.
      for (const b of plan.beats) {
        const nums = comparisonNumbers(b.narration || "");
        if (nums) console.log(`[two-number] ch-${channelId} beat ${b.index}: ${nums.join(" vs ")} -> ${b.canvas.composition} ${b.canvas.visual_type}${["BAR", "LINE", "PIE", "GAUGE"].includes(String(b.canvas.visual_type).toUpperCase()) ? " (chart, as the rule requires)" : " (NOT a chart)"}`);
      }
    }
  }
  // ── COMPOSITION VARIETY on the resolved canvases (owner's spec 2026-10-03, part B) ──
  // The planner applied the rule to its plan; resolution can still turn a beat back into
  // TYPE (a photo that did not verify, a dropped concept). Same rule, same fallbacks
  // (scripts/composition-variety.js), the same gates (checkVisual), no composition twice in
  // a row; a name card (an entity's name) is converted last. Never fails the run.
  {
    const narr = (b) => b.narration || "";
    // A hero beat is keyed by its object (C.3): two different objects in a row are fine.
    const keyOf = (c) => c.composition + ((c.concept_visuals || []).length ? `+HERO:${c.concept_visuals[0].name || ""}` : "") + (String(c.name_card?.sub || "").trim() ? "+NAME" : "");
    const flags = () => plan.beats.map((b) => isTypeCanvas(b.canvas));
    const before = varietyReport(flags());
    let changed = 0;
    if (!before.ok) {
      for (const i of beatsToConvert(flags(), (k) => !!plan.beats[k].canvas.name_card)) {
        const f = flags(), r = varietyReport(f);
        if (r.ok) break;
        if (!f[i] || (!f[i - 1] && !f[i + 1] && r.excess === 0)) continue;
        const b = plan.beats[i], st = narr(b), was = keyOf(b.canvas);
        const q = quantitiesOf(st)[0];
        let done = null;
        for (const cand of fallbacksFor(st, { number: q ? { value: q.value, label: null } : null })) {
          const nb = [plan.beats[i - 1], plan.beats[i + 1]].filter(Boolean).map((x) => keyOf(x.canvas));
          if (cand.kind === "symbol") {
            if (nb.includes(`TYPE-FULL+HERO:${cand.symbol}`) || b.canvas.name_card) continue;
            b.fallback_symbol = cand.symbol; b.visual_type = "TYPE"; b.data = null; delete b.type_layout;
            b.canvas = canvasContentFor(b, {});
            done = `${was} -> ${keyOf(b.canvas)} (drawn symbol "${cand.symbol}": what the sentence states)`;
            break;
          }
          const v = checkVisual({ visual_type: cand.visual_type, data: cand.data, named_entities: b.named_entities }, st);
          if (v.why || v.type !== cand.visual_type) continue;
          if (nb.includes(compositionFor(v.type, false))) continue;
          const fk = figureKey(v);
          if (fk && plan.beats.some((x, j) => j !== i && figureKey(checkVisual(x, narr(x))) === fk)) continue;
          b.visual_type = v.type; b.data = v.data; delete b.type_layout; delete b.name_card;
          b.canvas = canvasContentFor(b, {});
          done = `${was} -> ${b.canvas.composition} ${v.type} ${JSON.stringify(v.data)}${cand.kind === "keynouns" ? " (last resort: two of the sentence's own key nouns)" : ""}`;
          break;
        }
        if (done) changed++;
        console.log(`[variety] ch-${channelId} beat ${b.index}: ${done || `${was} kept — no fallback fits its sentence`}`);
      }
      // Rebuilt canvases get their sentence case, variant and folio back (and the one emphasis beat is re-chosen).
      if (changed) styleCanvases(plan.beats.map((b) => b.canvas), plan.beats.map((b) => b.narration || ""));
    }
    // The SAME hero object on two beats in a row is still a repeat (C.3 allows two DIFFERENT
    // objects in a row): CI run 37141128792 ch-26 drew the broken-chain symbol twice, rejected by
    // canvas-type. The later beat gives its hero up for a composition its own sentence grounds
    // (not a symbol), or for its statement — logged.
    for (let i = 1; i < plan.beats.length; i++) {
      const a = plan.beats[i - 1], b = plan.beats[i];
      if (!(b.canvas.concept_visuals || []).length || keyOf(a.canvas) !== keyOf(b.canvas)) continue;
      const st = narr(b), was = keyOf(b.canvas);
      const q = quantitiesOf(st)[0];
      let done = null;
      for (const cand of fallbacksFor(st, { number: q ? { value: q.value, label: null } : null })) {
        if (cand.kind === "symbol") continue;
        const v = checkVisual({ visual_type: cand.visual_type, data: cand.data, named_entities: b.named_entities }, st);
        if (v.why || v.type !== cand.visual_type) continue;
        if ([plan.beats[i - 1], plan.beats[i + 1]].filter(Boolean).some((y) => keyOf(y.canvas) === compositionFor(v.type, false))) continue;
        b.visual_type = v.type; b.data = v.data;
        done = `${v.type} ${JSON.stringify(v.data)}`;
        break;
      }
      delete b.hero_cutout; delete b.fallback_symbol; delete b.type_layout;
      if (!done) { b.visual_type = "TYPE"; b.data = null; done = "its statement"; }
      b.canvas = canvasContentFor(b, {});
      changed++;
      console.log(`[variety] ch-${channelId} beat ${b.index}: ${was} repeats the beat before -> ${done}`);
    }
    if (changed) styleCanvases(plan.beats.map((b) => b.canvas), plan.beats.map((b) => b.narration || ""));
    const after = varietyReport(flags());
    const keys = plan.beats.map((b) => keyOf(b.canvas));
    let run = 1, maxRun = 1;
    for (let i = 1; i < keys.length; i++) { run = keys[i] === keys[i - 1] ? run + 1 : 1; maxRun = Math.max(maxRun, run); }
    const distinct = new Set(plan.beats.map((b) => b.canvas.composition)).size;
    plan.variety = { type_full: after.count, beats: after.n, max_type: after.max, adjacent_type: after.adjacent.length, max_consecutive_same: maxRun, distinct_compositions: distinct, converted: changed,
      entrance_styles: plan.beats.map((b) => b.canvas.entrance_style || null) };
    console.log(`[variety] ch-${channelId} final: TYPE-FULL ${after.count}/${after.n} (max ${after.max}), adjacent TYPE pairs ${after.adjacent.length}, max consecutive same composition ${maxRun}, distinct compositions ${distinct} (${keys.join(", ")})${after.ok ? "" : " — OVER the variety rule (logged; nothing else in these sentences is grounded)"}`);
    if (!after.ok) console.warn(`::warning::[variety] ch-${channelId}: ${after.count}/${after.n} TYPE beats after the fallbacks (max ${after.max})`);
  }
  // "Georgia" is two regions: the map drew the COUNTRY for Hyundai's Metaplant in the US state
  // (CI run 37126933290 ch-48 beat 1, beat check NO). It is the US state unless the script
  // speaks of the Caucasus country (Tbilisi, Georgian, the Black Sea, Abkhazia, South Ossetia).
  {
    const all = plan.beats.map((b) => b.narration || "").join(" ");
    const caucasus = /\b(Tbilisi|Georgian|Caucasus|Black Sea|Abkhazia|South Ossetia|Batumi)\b/.test(all);
    for (const b of plan.beats) {
      const c = b.canvas;
      if (c?.composition !== "MAP-CENTERED" || !/^georgia$/i.test(String(c.data?.place || "").trim()) || caucasus) continue;
      // "Georgia state" resolves to the US state (geo-regions alias); the map is still labelled "Georgia".
      c.data = { ...c.data, place: "Georgia state", label: "Georgia" };
      if (b.data) b.data = { ...b.data, place: "Georgia state", label: "Georgia" };
      console.log(`[canvas] ch-${channelId} beat ${b.index}: MAP "Georgia" -> the US state (no Caucasus context in the script)`);
    }
  }
  // Two major TYPE-FULL statements in a row both get the "words" headline motion, and
  // canvas-type fails "headline motion twice in a row" (CI run 37108869325 ch-48 beats 6-7):
  // the earlier one (never the hook) is made medium; the close keeps its weight.
  for (let i = 1; i < plan.beats.length; i++) {
    const a = plan.beats[i - 1].canvas, b = plan.beats[i].canvas;
    if (a.composition === "TYPE-FULL" && b.composition === "TYPE-FULL" && a.motion_tier === "major" && b.motion_tier === "major") {
      const k = i - 1 > 0 ? i - 1 : i;
      if (k === plan.beats.length - 1 && k === i) continue;
      plan.beats[k].canvas.motion_tier = "medium"; plan.beats[k].motion_tier = "medium";
      console.log(`[canvas] beat ${plan.beats[k].index}: motion_tier major -> medium (two major TYPE-FULL statements in a row share one headline motion)`);
    }
  }
  // Fix 2: the animation of every element, on the final canvases (the beat's
  // tokens, dark / vertical / emphasis styling are settled): scripts/anim-plan.js.
  {
    const run = assignCanvasAnimations(plan.beats, { seed: channelId, log: (m) => console.log(m) });
    if (run.relaxed.length) console.warn(`[anim] relaxed: ${run.relaxed.join("; ")}`);
    console.log(`[anim] ${Object.keys(run.used).length} distinct animations across ${plan.beats.length} beats`);
    plan.recent_animations = run.recent;
  }
  // Part C.1: what each beat SHOWS. A plain typography beat whose sentence names nothing is a
  // script defect (the narrative engine requires every sentence to name something) — logged.
  {
    const kindOf = (c) => {
      const h = (c.concept_visuals || [])[0];
      if (h) return h.logo ? `logo (${h.name})` : h.money ? `money (${h.name})` : h.class === "symbol" ? `symbol (${h.name})` : `cutout (${h.name})`;
      if (c.photo) return c.composition === "PORTRAIT" ? `portrait (${c.photo.entity})` : `photo (${c.photo.entity || c.composition})`;
      if (c.name_card) return `name card (${c.name_card.name})`;
      return { "NUMBER-FULL": "number", "DATA-FULL": "chart", "PROCESS-FULL": "process", "MAP-CENTERED": "map", "LIST-BUILD": "list", "TIMELINE": "timeline", "COMPARISON-SPLIT": "comparison" }[c.composition] || "typography (key phrase)";
    };
    let pngs = 0, none = 0;
    for (const b of plan.beats) {
      const k = kindOf(b.canvas);
      if (/^(logo|money|cutout|portrait|photo)/.test(k)) pngs++;
      console.log(`[visual] ch-${channelId} beat ${b.index}: ${k}`);
      if (k.startsWith("typography")) {
        const named = (b.named_entities || []).some((e) => e.type !== "number") || /\d/.test(b.narration || "");
        if (!named) { none++; console.log(`[plan] ch-${channelId} beat ${b.index}: no concept identified, sentence: "${b.narration || ""}" — this sentence violates the script rules and should have been rewritten`); }
      }
    }
    plan.visual_summary = { beats: plan.beats.length, pngs, no_concept: none };
    console.log(`[visual] ch-${channelId}: ${pngs}/${plan.beats.length} beats show a fetched PNG; ${none} beat(s) with no concept`);
  }
  for (const b of plan.beats) {
    const k = b.canvas.composition;
    counts.by_comp[k] = (counts.by_comp[k] || 0) + 1;
    if (b.canvas.photo) counts.photos++;
    console.log(`[canvas] beat ${b.index} ${k} ${b.canvas.visual_type} ${JSON.stringify(b.canvas.data || {})} tier=${b.canvas.motion_tier}${b.canvas.camera_focus ? ` camera=${b.canvas.camera_focus.map((f) => `${f.target}@${f.at_percent}`).join(",")}` : ""}${b.canvas.persists_from !== null ? ` persists_from=${b.canvas.persists_from}` : ""}${b.canvas.match_cut_prev ? " match_cut" : ""}${b.canvas.dark ? " DARK" : ""}${b.canvas.emphasis_beat ? " EMPHASIS" : ""}${b.canvas.vertical ? " VERTICAL" : ""}`);
  }
  plan.entity_report = { ...entities, name_cards: plan.beats.filter((b) => b.name_card).map((b) => `beat ${b.index}: ${b.name_card.name}`) };
  const out = planPath.replace(/\.json$/, "-resolved.json");
  writeFileSync(out, JSON.stringify(plan, null, 2) + "\n");
  console.log(`[canvas] resolved ${basename(planPath)}: ${Object.entries(counts.by_comp).map(([k, v]) => `${k} ${v}`).join(", ")}; photos ${counts.photos}; entities resolved ${entities.resolved.length}, fell back ${entities.fell_back.length}`);
  return { ok: true, planPath: out, counts, fetchedNew };
}

/**
 * Asset guard, run right before render: every image the plan references
 * (canvas.photo.asset, relative to public/) must be IN the bundle the render
 * will serve, or Chrome 404s it and Remotion cancels the whole render (run
 * 36915319430 ch-2 hawaii-county.jpg; run 36906932610 ch-2 seattle.jpg,
 * ch-48 dyno-nobel.jpg). Why it happened: the planner's photo verification
 * downloads the entity photo AFTER the pre-bundle, so resolveCanvas finds it
 * "cached", counts no new fetch, and the re-bundle guard never fires.
 *
 *   in public/, not in the bundle  -> re-bundle once (keeps the real photo)
 *   still missing after that       -> the beat drops the photo and becomes
 *                                     TYPE (never a stand-in image), logged
 *                                     with channel, beat and asset
 * A missing asset no longer crashes the run. Returns the plan path to render.
 */
async function guardPlanAssets(channelId, planPath) {
  const plan = readJsonSafe(planPath);
  if (!plan?.beats) return planPath;
  const publicDir = join(dirname(REMOTION_ROOT_JSX), "public");
  const refs = [
    ...plan.beats.map((b, i) => ({ b, i, asset: b.canvas?.photo?.asset })).filter((r) => r.asset),
    // concept cutouts (concept_visuals): a missing PNG drops that visual only
    ...plan.beats.flatMap((b, i) => (b.canvas?.concept_visuals || []).filter((v) => v.asset).map((v) => ({ b, i, asset: v.asset, concept: v.name }))),
  ];
  if (!refs.length) return planPath;
  // render.js bundles per call when REMOTION_SERVE_URL is unset; that bundle
  // copies public/ as it is then, so public/ is what counts.
  const inBundle = (a) => existsSync(join(process.env.REMOTION_SERVE_URL || publicDir, process.env.REMOTION_SERVE_URL ? "public" : "", a));
  let missing = refs.filter((r) => !inBundle(r.asset));
  if (missing.length && process.env.REMOTION_SERVE_URL && missing.some((r) => existsSync(join(publicDir, r.asset)))) {
    const t0 = Date.now();
    process.env.REMOTION_SERVE_URL = await bundle({ entryPoint: REMOTION_ROOT_JSX, publicDir, onProgress: () => {} });
    console.log(`[assets] ch-${channelId}: ${missing.length} plan asset(s) not in the bundle (${missing.map((r) => r.asset).join(", ")}) — re-bundled: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    missing = refs.filter((r) => !inBundle(r.asset));
  }
  if (!missing.length) return planPath;
  for (const { b, i, asset, concept } of missing) {
    if (concept) {
      console.warn(`::warning::[assets] ch-${channelId} beat ${i}: concept cutout ${asset} is not in the render bundle — "${concept}" dropped`);
      b.canvas.concept_visuals = (b.canvas.concept_visuals || []).filter((v) => v.asset !== asset);
      if (!b.canvas.concept_visuals.length) delete b.canvas.concept_visuals;
      continue;
    }
    console.warn(`::warning::[assets] ch-${channelId} beat ${i}: ${asset} is not in the render bundle (in public/: ${existsSync(join(publicDir, asset)) ? "yes" : "no"}) — photo -> TYPE`);
    b.visual_type = "TYPE"; b.data = null; delete b.asset;
    b.canvas = canvasContentFor(b, {});
  }
  // The downgraded beats need the same styling / animation pass resolveCanvas gave the rest.
  styleCanvases(plan.beats.map((b) => b.canvas), plan.beats.map((b) => b.narration || ""));
  assignCanvasAnimations(plan.beats, { seed: channelId, log: () => {} });
  // Written back to the same resolved plan: the render, the manifest and the
  // audits must all see the beat as it was actually drawn.
  writeFileSync(planPath, JSON.stringify(plan, null, 2) + "\n");
  return planPath;
}

/* ── Correction loop ─────────────────────────────────────────────── */

async function renderWithCorrectionLoop(channelId, scriptPath, format, runId, outputOverride, skipQA) {
  let correctionsPath = null;
  // When directives were enforced on the previous attempt, this holds the
  // EDITED plan. The next attempt renders it directly rather than asking
  // Gemini for a fresh plan, which would discard the enforced changes — the
  // point is that the change is MADE, not re-negotiated.
  let enforcedPlanPath = null;
  let lastResult = null;

  // Pre-bundle once per VIDEO, reused across this video's correction-loop
  // attempts (render.js already honors REMOTION_SERVE_URL when set — see
  // renderVideo()). Scoped per-video, not per-run: src/skills/remotion-
  // render/audio.js does `import voiceover from "./vo.mp3"`, a static
  // webpack import, so the bundle bakes in whichever audio file is staged
  // at bundle time. Bundling once for the whole run (the first version of
  // this change) broke every render with "Can't resolve './vo.mp3'"
  // because nothing had staged any audio yet — caught by the real GH
  // Actions test, not locally. Audio doesn't change between attempt 1 and
  // 2 of the SAME video, so this still eliminates the redundant re-bundle
  // exactly where it mattered (a REJECTED video's retry), without
  // reusing a bundle across videos whose audio differs.
  const audioForBundle = audioPathFor(channelId, scriptPath);
  // Word-level captions need the real per-word timings of THIS voiceover
  // (<base>-vo-words.json, written by tts.js in the same synthesis as the mp3
  // and SRT). A voiceover from before that existed has none: it is
  // re-synthesized — mp3, SRT and words together — before planning, so the
  // plan is built on the SRT the words belong to. Never modelled timings.
  const wordsFile = audioForBundle.replace(/\.mp3$/, "-words.json");
  let voiceoverProvenance = "reused";
  if (existsSync(audioForBundle) && !existsSync(wordsFile)) {
    console.log(`[captions] no word timings for ${basename(audioForBundle)} — regenerating the voiceover with word boundaries`);
    voiceoverProvenance = "regenerated";
    const t = await runChild("node", [join(ROOT, "src", "utils", "tts.js"), String(channelId), relative(ROOT, scriptPath)], { label: `tts ${channelId}` });
    if (t.code !== 0 || !existsSync(wordsFile)) {
      console.error(`::error::[captions] ${basename(scriptPath)}: no word timings (tts.js exited ${t.code}) — not rendering`);
      return { skipped: false, ok: false };
    }
  }
  // Task 4.3 — TTS prosody/timing verification. MUST run on every render,
  // whether the voiceover was just generated or reused (Fix 2).
  const srtPath2 = audioForBundle.replace(/\.mp3$/, ".srt");
  let spokenText = "";
  try {
    const w = JSON.parse(readFileSync(wordsFile, "utf-8"));
    const arr = Array.isArray(w) ? w : w.words || [];
    // edge-tts words use "text"; elevenlabs/max estimated timings use "word".
    spokenText = arr.map((x) => x.word || x.text || "").join(" ").trim();
  } catch { spokenText = ""; }
  let verification = null;
  if (existsSync(audioForBundle)) {
    console.log(`[tts] ch-${channelId}: verify running (voiceover: ${voiceoverProvenance})`);
    verification = verifyTts({ mp3Path: audioForBundle, srtPath: srtPath2, wordsPath: wordsFile, spokenText, channel: channelId, topic: basename(scriptPath, ".json") });
  }
  // Blocker 2: if the reused artifact's SRT is misaligned with the audio
  // (drift > 0.5s), regenerate that voiceover fresh so the SRT word timings
  // are produced by the SAME engine run that produced the MP3 — they can
  // never be merged from two different tools.
  if (verification && Number(verification.timingDrift) > 0.5 && voiceoverProvenance !== "regenerated") {
    console.log(`[tts] ch-${channelId}: drift ${Number(verification.timingDrift).toFixed(2)}s>0.5s — regenerating voiceover to realign SRT/audio`);
    const t = await runChild("node", [join(ROOT, "src", "utils", "tts.js"), String(channelId), relative(ROOT, scriptPath)], { label: `tts ${channelId}` });
    voiceoverProvenance = "regenerated";
    if (t.code === 0 && existsSync(wordsFile)) {
      spokenText = "";
      try { const w = JSON.parse(readFileSync(wordsFile, "utf-8")); const arr = Array.isArray(w) ? w : w.words || []; spokenText = arr.map((x) => x.word || x.text || "").join(" ").trim(); } catch { spokenText = ""; }
      verification = verifyTts({ mp3Path: audioForBundle, srtPath: srtPath2, wordsPath: wordsFile, spokenText, channel: channelId, topic: basename(scriptPath, ".json") });
    }
  }
  if (existsSync(audioForBundle)) {
    const voTarget = join(ROOT, "src", "skills", "remotion-render", "vo.mp3");
    mkdirSync(dirname(voTarget), { recursive: true });
    copyFileSync(audioForBundle, voTarget);
    const bundleStart = Date.now();
    console.log(`[render-and-qa] pre-bundling for ${basename(scriptPath)}...`);
    try {
      // publicDir explicit: without it Remotion resolves public/ from the
      // process cwd (the repo root), not the Remotion project where the
      // staticFile() assets live (music/kalimba/, sfx/, asset-library/).
      process.env.REMOTION_SERVE_URL = await bundle({ entryPoint: REMOTION_ROOT_JSX, publicDir: join(dirname(REMOTION_ROOT_JSX), "public"), onProgress: () => {} });
      console.log(`[render-and-qa] pre-bundle done: ${((Date.now() - bundleStart) / 1000).toFixed(1)}s`);
    } catch (e) {
      console.warn(`[render-and-qa] pre-bundle failed, falling back to per-attempt bundling: ${e.message}`);
      delete process.env.REMOTION_SERVE_URL;
    }
  }

  for (let attempt = 1; attempt <= MAX_CORRECTION_LOOPS; attempt++) {
    const attemptStartedAt = Date.now();
    console.log(`\n=== ATTEMPT ${attempt}/${MAX_CORRECTION_LOOPS}: ${basename(scriptPath)} ===`);

    // Step 1: render the ENFORCED plan when the previous attempt produced
    // one; otherwise Gemini plans (or re-plans with prose corrections).
    let planPath;
    if (enforcedPlanPath && existsSync(enforcedPlanPath)) {
      planPath = enforcedPlanPath;
      console.log(`Rendering ENFORCED plan from attempt ${attempt - 1}: ${basename(planPath)}`);
    } else {
      planPath = await geminiPlan(channelId, scriptPath, correctionsPath);
    }

    // No plan, no render. Rendering without one used to hand the director
    // nothing and let its regex classifier invent the visuals.
    const plan = planPath ? readJsonSafe(planPath) : null;
    if (!plan || !Array.isArray(plan.beats) || plan.beats.length === 0) {
      console.error(`::error::No visual plan at ${planPath || "(planner returned none)"}. Run the planner first.`);
      return { skipped: false, ok: false };
    }
    console.log(`Visual plan: ${basename(planPath)} (source ${plan.source || "gemini"}, ${plan.beats.length} beats)`);
    const planReadyAt = Date.now();

    // Step 1b: CHALLENGER — a second AI checks the plan against the script's
    // sentences before anything renders. A rejection (MISMATCH or
    // CONTRADICTION) gets ONE re-plan with the rejected beats as
    // corrections; a second rejection fails the video. A challenger that
    // can't run fails the video too — it is never skipped.
    const srtPath = join(dirname(audioPathFor(channelId, scriptPath)), basename(audioPathFor(channelId, scriptPath), ".mp3") + ".srt");
    let challenge = await challengePlan(channelId, planPath, srtPath, "");
    if (challenge.code === 1) {
      // A snapshot, not a path: geminiPlan() writes the re-plan to the SAME
      // file (…-visual-plan.json), so the first plan must be kept in memory.
      const firstPlan = readJsonSafe(planPath), firstReview = challenge.review;
      const blocking = (challenge.review?.beats || []).filter((b) => b.verdict === "MISMATCH" || b.verdict === "CONTRADICTION");
      const corrFile = planPath.replace(/\.json$/, "-challenger-corrections.json");
      // Per-element first: which field of the beat is actually wrong. The
      // generic sentence below is the floor, not the target — it gave every
      // rejected beat the same instruction, so the planner had no way to tell a
      // wrong visual_type from a wrong headline.
      const element = await elementCorrections(
        planPath,
        planPath.replace(/\.json$/, "-challenge.json"),
        srtPath,
      );
      const corrections = element.corrections.length ? element.corrections : blocking.map((b) => ({
        beat: b.beat_index,
        problem: `${b.verdict}: ${b.reason} (sentence: "${b.sentence}")`,
        fix: "re-plan this beat so its subject, change and on-screen text show exactly what the sentence says — no claim the sentence does not make",
      }));
      writeFileSync(corrFile, JSON.stringify({ corrections }, null, 2) + "\n");
      console.log(`[challenger] ${blocking.length} blocking beat(s) — re-planning once with ${corrections.length} correction(s) (${element.source})`);
      planPath = await geminiPlan(channelId, scriptPath, corrFile);
      const replanned = planPath ? readJsonSafe(planPath) : null;
      if (!replanned?.beats?.length) {
        console.error(`::error::re-plan after challenger rejection produced no plan`);
        return { skipped: false, ok: false };
      }
      challenge = await challengePlan(channelId, planPath, srtPath, "-2");
      // A second rejection is usually a DIFFERENT beat: the re-plan fixed the
      // rejected beats but rewrote beats that had passed (run 36416582506:
      // ch-1 beat 0 then beat 4; ch-44 beat 5 then beat 9). Every beat the
      // second review blocks but the first review passed is restored from
      // the first plan (verdicts are per beat, against its own sentence);
      // the merged plan is challenged AGAIN and must pass outright. A beat
      // blocked by both reviews still fails the video.
      const isBlock = (v) => v.verdict === "MISMATCH" || v.verdict === "CONTRADICTION";
      if (challenge.code === 1 && firstReview?.beats && challenge.review?.beats) {
        const merged = readJsonSafe(planPath);
        const passedFirst = new Set(firstReview.beats.filter((v) => !isBlock(v)).map((v) => v.beat_index));
        const blocked2 = challenge.review.beats.filter(isBlock).map((v) => v.beat_index);
        const sameShape = firstPlan?.beats?.length && firstPlan.beats.length === merged?.beats?.length;
        if (sameShape && blocked2.length && blocked2.every((i) => passedFirst.has(i))) {
          for (const i of blocked2) merged.beats[i] = firstPlan.beats[i];
          const mergedPath = planPath.replace(/\.json$/, "-merged.json");
          writeFileSync(mergedPath, JSON.stringify(merged, null, 2) + "\n");
          console.log(`[challenger] beat(s) ${blocked2.join(", ")} passed the first review and failed the second — restored from the first plan; challenging the merged plan`);
          const third = await challengePlan(channelId, mergedPath, srtPath, "-3");
          if (third.code === 0) { planPath = mergedPath; challenge = third; }
          else console.log(`[challenger] the merged plan was rejected too (exit ${third.code})`);
        }
      }
    }
    // A challenger failure still fails the video. It is rendered only so
    // the backup audit can queue it for a human (approved-review/ or
    // rejected/) instead of losing it; it can never be approved or uploaded.
    let challengerFailure = null;
    if (challenge.code !== 0) {
      challengerFailure = challenge.code === 1 ? "rejected the plan twice" : "could not run";
      console.error(`::error::challenger ${challengerFailure} for ${basename(scriptPath)} — rendering for the backup audit only`);
    }

    // Step 1c: resolve real assets (fetch before render). A beat with no real
    // asset and no fallback drawing fails the video here.
    const resolvedAssets = await resolveAssets(channelId, planPath);
    if (!resolvedAssets.ok) {
      console.error(`::error::asset resolution failed for ${basename(scriptPath)}: ${resolvedAssets.reason}`);
      return { skipped: false, ok: false };
    }
    planPath = resolvedAssets.planPath;
    // Remotion copies public/ into the bundle when it is BUILT, and the
    // bundle was built before this attempt. Newly fetched images are not in
    // it, so staticFile() would 404 — rebuild it with them.
    if (resolvedAssets.fetchedNew > 0 && process.env.REMOTION_SERVE_URL) {
      const t0 = Date.now();
      process.env.REMOTION_SERVE_URL = await bundle({ entryPoint: REMOTION_ROOT_JSX, publicDir: join(dirname(REMOTION_ROOT_JSX), "public"), onProgress: () => {} });
      console.log(`[assets] re-bundled with ${resolvedAssets.fetchedNew} new asset(s): ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }

    // Step 1d: every image the plan references must be in the bundle
    // (guardPlanAssets: re-bundle, else photo -> TYPE) — a 404 cancels the render.
    planPath = await guardPlanAssets(channelId, planPath);

    // Step 2: Render (uses pre-built bundle via REMOTION_SERVE_URL) — the
    // resolved plan, passed explicitly (VISUAL_PLAN_PATH).
    const result = await renderOne(channelId, scriptPath, format, planPath);
    if (result.skipped) return { skipped: true };
    if (!result.ok) return { skipped: false, ok: false, queued: result.queued || undefined };

    if (outputOverride && result.outputPath) {
      const outDir = dirname(outputOverride);
      if (outDir) mkdirSync(outDir, { recursive: true });
      copyFileSync(result.outputPath, outputOverride);
      console.log(`Copied render to --output: ${outputOverride}`);
    }

    lastResult = result;

    // Step 2b: Silence detection — fail if narration window has gaps > 0.5s
    const silenceCheck = await detectSilence(result.outputPath, result.audio);
    if (!silenceCheck.ok) {
      console.error(`::error::silence detection failed for ${basename(result.outputPath)} — ${silenceCheck.reason}`);
      // Queued, not deleted (owner's rule 2026-10-02).
      const q = await queueVideo({ verdict: "rejected", videoPath: result.outputPath, channelId, stage: "silence-detect", check: "silence", reason: silenceCheck.reason });
      return { skipped: false, ok: false, queued: q };
    }

    // Step 2b': duration and beat-0 frame. Hard gates, independent of QA.
    const verify = await verifyRender(result.outputPath, result.audio, channelId);
    if (!verify.ok) {
      for (const p of verify.problems) console.error(`::error::verify ${basename(result.outputPath)}: ${p}`);
      const q = await queueVideo({ verdict: "rejected", videoPath: result.outputPath, channelId, stage: "verify-render", check: "duration/beat-0 frame", reason: verify.problems.join("; ") });
      return { skipped: false, ok: false, queued: q };
    }

    const backupArgs = { planPath, srtPath, audio: result.audio, channelId, videoPath: result.outputPath };

    // Step 2b''': CANVAS CHECKS (full-canvas style), on every render —
    // local-audit.cjs --canvas-only: canvas-fit (every element box inside the
    // 1080x1920 frame's safe area; no two text boxes overlapping; no element
    // in the caption band), canvas-coverage (each beat's rendered content
    // spans >= 60% of the frame height), canvas-accent (the channel accent
    // appears in at least one beat), motion-tiers (2-3 major beats).
    // Deterministic. A failing check fails the render; the video goes to the
    // backup audit, which runs the same checks and rejects it.
    const manifestPath = result.outputPath.replace(/\.mp4$/, "-manifest.json");
    let canvasFailure = null;
    if ((readJsonSafe(manifestPath)?.beats || []).some((b) => b.canvas)) {
      const fit = await runChild("node", [LOCAL_AUDIT_CJS, "--canvas-only", "--video", result.outputPath, "--manifest", manifestPath],
        { label: `canvas-checks ${channelId}/${basename(scriptPath)}` });
      if (fit.code !== 0) {
        const failedIds = [...String(fit.stdout || "").matchAll(/\[canvas\] FAIL (\S+)/g)].map((m) => m[1]);
        canvasFailure = { code: fit.code, failedIds };
      }
    }

    // ── Three-layer eval loop (EVAL_LOOP_MODE, default off) ────────────────
    // Runs HERE — after Layer 1 (the canvas checks) has been measured and BEFORE its
    // early-return below — so Layers 2 and 3 are recorded on every render, pass or fail.
    // It used to sit after the frame review, which a Layer 1 failure never reached, so
    // no channel ever produced a Layer 2/3 number in CI.
    //
    // off is the default and skips everything. dry records what it would do; live acts.
    // It does NOT route: Layer 1 still gates (the return below is unchanged), and the loop's
    // decision is data in data/audit/eval-loop/ — `layer1_result` says whether Layer 1 passed.
    // Nothing it decides can ship, block, or delete anything. See eval-loop-callsite.js.
    await recordEvalLoop({
      plan, scriptPath, attempt, channelId, outputPath: result.outputPath,
      layer1Failures: canvasFailure ? (canvasFailure.failedIds.length ? canvasFailure.failedIds : ["canvas-checks"]) : null,
      layer2Advisory, judge,
    });

    if (canvasFailure) {
      console.error(`::error::canvas checks ${canvasFailure.code === 1 ? "FAILED" : "could not run"} for ${basename(result.outputPath)}`);
      return backupAudit({ ...backupArgs, stage: "canvas-checks", check: canvasFailure.failedIds.join(",") || null,
        reason: canvasFailure.code === 1 ? `failed: ${canvasFailure.failedIds.join(", ") || "see the canvas-checks log"}` : "canvas checks could not run" });
    }

    if (challengerFailure) {
      return backupAudit({ ...backupArgs, stage: "challenger", reason: challengerFailure });
    }

    // Step 2b'': PER-BEAT FRAME CHECK — one frame at every beat's midpoint,
    // each judged by Gemini against its own sentence. More than one beat
    // that doesn't visually match fails the video. Runs with or without
    // --skip-qa; a check that can't run fails the video.
    const beatCheck = await runChild("node", [
      GEMINI_REVIEW_JS, "--beat-check",
      "--video", result.outputPath,
      "--manifest", result.outputPath.replace(/\.mp4$/, "-manifest.json"),
      "--srt", srtPath,
      "--out", result.outputPath.replace(/\.mp4$/, "-beat-check.json"),
    ], { label: `beat-check ${channelId}/${basename(scriptPath)}` });
    if (beatCheck.code !== 0) {
      const why = beatCheck.code === 1 ? "FAILED — frames do not match their sentences" : "could not run";
      console.error(`::error::beat check ${why} for ${basename(result.outputPath)}`);
      const bc = readJsonSafe(result.outputPath.replace(/\.mp4$/, "-beat-check.json"));
      // A wrong-person photo is never rescued by the local audit into
      // approved-review: the video is rejected (a named person is shown as
      // that person or not at all).
      if (bc?.wrong_person?.length) {
        console.error(`::error::[review] wrong-person photo on beat(s) ${bc.wrong_person.join(", ")} — ${basename(result.outputPath)} rejected`);
        return backupAudit({ ...backupArgs, stage: "beat-check", reason: `wrong-person photo on beat(s) ${bc.wrong_person.join(", ")}`, forceReject: true });
      }
      return backupAudit({ ...backupArgs, stage: "beat-check", reason: bc?.failing ? `${why}: beats ${bc.failing.join(", ")}` : why });
    }

    // Step 2c: Skip QA when --skip-qa is set (local dev without ffmpeg)
    if (skipQA) {
      console.log(`--skip-qa: skipping QA for ${basename(result.outputPath)}`);
      return { skipped: false, ok: true, outputPath: result.outputPath, attempt: 1, geminiVerdict: "SKIP_QA", qaGatePass: true };
    }

    // Step 3: QA (frame extraction + audit + Gemini plan-compliance review)
    const qa = await qaOne(runId, result, planPath);

    // Wait for all background QA tasks to finish before checking Gemini verdict
    await Promise.all([qa.slopCheckPromise, qa.visionQaPromise, qa.geminiReviewPromise].filter(Boolean));

    // Step 4: verdict. If the local auditor cleared the video (LOW risk, no
    // uncertain beats), Gemini was not run — that IS the approval; ship it
    // without spending a correction attempt.
    if (qa.geminiNeeded === false && qa.gatePass) {
      const lvl = qa.localAudit?.risk?.level || "LOW";
      console.log(`Local auditor cleared (risk ${lvl}) — approved without Gemini.`);
      return { skipped: false, ok: true, outputPath: result.outputPath, attempt, geminiVerdict: `LOCAL_AUDIT_${lvl}`, qaGatePass: qa.gatePass };
    }

    const geminiReport = findGeminiReviewReport(channelId, scriptPath);
    let pipelineVerdict = "UNKNOWN";
    let geminiVerdict = "UNKNOWN";
    if (geminiReport) {
      try {
        const report = JSON.parse(readFileSync(geminiReport, "utf-8"));
        // pipelineVerdict is the Visual Bible's own computed decision
        // (APPROVED/NEEDS_IMPROVEMENT/REJECTED — see gemini-frame-review.js).
        // wholeVideoResult.verdict is Gemini's free-text "one-sentence final
        // judgment" from the whole_video_review prompt and is display-only —
        // it is NEVER the literal string "APPROVED", so gating on it (the
        // previous behavior) meant a REJECTED Bible review still shipped
        // once the unrelated frame-audit pixel check passed. UNKNOWN (no
        // report, or review skipped/errored) is treated as passable so
        // environments without a Gemini key don't start blocking publishes.
        pipelineVerdict = report.pipelineVerdict || "UNKNOWN";
        geminiVerdict = report.wholeVideoResult?.verdict || report.pipelineReason || pipelineVerdict;
        const owner = report.correctionOwner ? ` [owner: ${report.correctionOwner}]` : "";
        console.log(`Gemini verdict (attempt ${attempt}): ${pipelineVerdict} — ${geminiVerdict}${owner}`);
      } catch {}
    }

    // The HARD ship/no-ship gate is qa.gatePass — the OBJECTIVE frame-audit
    // (WCAG text contrast, safe-area margins, edge-bleed, non-empty frame).
    // That is what "genuinely broken frame" means and it is measured from
    // pixels, not opinion. The Gemini pipelineVerdict is a SUBJECTIVE quality
    // assessment (monoculture, "not cinematic enough", per-scene HIGH/CRITICAL
    // style notes) and it drives the CORRECTION LOOP — a non-APPROVED verdict
    // triggers a re-plan + re-render — but it does NOT permanently discard a
    // frame-audit-clean video once retries are exhausted. Reason: the scene
    // reviewer flags headline-dominance as a per-scene CRITICAL, so folding
    // its verdict into the hard gate meant any stylistically-imperfect video
    // was zeroed out and the channel posted nothing that day. A production
    // system must post its daily upload (private-first, delayed public, human
    // review window) when the frame is objectively sound; persistent
    // monoculture is addressed by the plan prompt + scene design, not by
    // withholding the upload. Objectively-broken frames still never ship —
    // qa.gatePass is false for them regardless of the Gemini verdict.
    // Frame review verdict (see frameReviewVerdict). PASS ships as before.
    // A review that could not run, or one still failing after the last
    // correction attempt, now goes to the backup audit and a human queue
    // instead of shipping -- a failing review used to be approved outright
    // once attempts ran out. A frame-audit (pixel gate) failure is
    // unchanged: returned with qaGatePass false and removed by main().
    const fr = frameReviewVerdict(geminiReport);
    console.log(`[frame-review] attempt ${attempt}: ${fr.pass ? "PASS" : fr.error ? "ERROR" : "FAIL"} — ${fr.reason}`);

    if (fr.pass || !qa.gatePass) {
      if (fr.pass || attempt === MAX_CORRECTION_LOOPS || fr.error) {
        // A failed pixel gate (or a failed / unrun review) used to return
        // qaGatePass false and be DELETED by main(); it is queued now.
        if (!(qa.gatePass && fr.pass)) return backupAudit({ ...backupArgs, stage: qa.gatePass ? "frame-review" : "frame-audit", reason: qa.gatePass ? fr.reason : "the frame audit (pixel gate) failed" });
        return { skipped: false, ok: true, outputPath: result.outputPath, attempt, geminiVerdict, qaGatePass: true };
      }
    } else if (fr.error || attempt === MAX_CORRECTION_LOOPS) {
      return backupAudit({ ...backupArgs, stage: "frame-review", reason: fr.reason });
    }

    // Not approved — feed corrections back and re-render.
    //
    // The corrections handed to the planner are the UNION of:
    //   - Gemini's own review corrections (semantic judgment), and
    //   - the local auditor's owner-tagged findings (mechanical facts).
    //
    // The auditor's findings used to go nowhere. It was measuring exactly the
    // things Gemini needed in order to change its mind — "this phrase is
    // prose in a figure slot", "this beat draws two narrative lines", "this
    // label cannot be drawn legibly at any size" — and the loop fed back only
    // Gemini's own prose verdict, so the concrete defects were never stated
    // to the thing that could fix them. They got fixed by hand in the
    // renderer instead, which teaches the renderer to tolerate bad direction
    // and lets the direction stay bad.
    //
    // Only DIRECTION_QUALITY and PLAN_COMPLIANCE are forwarded (see
    // GEMINI_FIXABLE in local-visual-auditor.js). RENDER_TECHNICAL stays out:
    // Gemini cannot fix a renderer bug by rewriting a phrase, and asking it
    // to would produce a workaround instead of a fix.
    // STEP 4a — ENFORCE. Gemini said what is wrong; the SYSTEM makes the
    // change to the plan and proves it stuck.
    //
    // This runs BEFORE any re-prompt. Re-prompting alone was the old
    // behaviour and it does not converge: run 35271777426 fed 28 then 38
    // corrections into two further planning passes and the auditor's issue
    // count went 12 -> 19 -> 16, every attempt REJECTED. A model handed its
    // own complaint re-rolls the dice; it does not enforce anything.
    //
    // Objective violations become directives with no model involved (a
    // text-beat share over 40% is arithmetic, and so is the fix). Gemini's
    // own structured adjustments are applied alongside them, and anything
    // that fails to verify is reported rather than assumed.
    const enforced = enforceAdjustments(planPath, qa.localAudit, geminiReport, attempt);

    // Prose corrections still go to the planner, but only for the beats the
    // directives could NOT settle — the value judgments (which phrase, which
    // figure) that the system must not invent for itself.
    const nextCorrections = writeMergedCorrections(runId, channelId, scriptPath, geminiReport, qa.localAudit, attempt);

    if (!enforced.appliedCount && !nextCorrections) {
      // Nothing concrete to change, and nothing enforced. Re-planning here
      // would just re-roll the planner's randomness and burn ~3 minutes, so
      // accept this render and report the verdict honestly rather than
      // pretending a retry happened.
      console.log(`Frame review ${fr.reason} but produced no actionable corrections — not spending another attempt.`);
      // Used to ship as ok:true. The review did not pass, so it is a
      // frame-review failure like any other: backup audit + human queue.
      return backupAudit({ ...backupArgs, stage: "frame-review", reason: `${fr.reason} (no actionable corrections)` });
    }

    // TIME BUDGET. The render job has an 18-minute timeout; run 36397373831
    // ch-48 was cancelled by it in the middle of attempt 3, so its video
    // never reached the backup audit or a queue. When another attempt would
    // not finish inside the budget, this failure goes to the backup audit
    // now instead. The next attempt is estimated from THIS attempt's work
    // after its plan was ready (challenger, assets, render, checks, review)
    // — plus planning time only if it must re-plan (no enforced plan).
    // Run 36414021961 ch-26: estimating it as the whole first attempt
    // (7.1 min, planning and cutout fetching included) refused a retry that
    // would have fit.
    const postPlanMs = Date.now() - planReadyAt;
    const nextMs = postPlanMs + (enforced.appliedCount ? 0 : planReadyAt - attemptStartedAt);
    if (Date.now() - PROCESS_T0 + nextMs > RENDER_QA_BUDGET_MS) {
      console.log(`[budget] attempt ${attempt + 1} would take ~${(nextMs / 60000).toFixed(1)} min at ${((Date.now() - PROCESS_T0) / 60000).toFixed(1)} min in; that passes the ${(RENDER_QA_BUDGET_MS / 60000).toFixed(0)}-min budget — no further attempt`);
      return backupAudit({ ...backupArgs, stage: "frame-review", reason: `${fr.reason} (time budget: no further attempt)` });
    }
    // When directives were enforced, the NEXT attempt renders the edited
    // plan directly instead of asking Gemini for a fresh one — the changes
    // are already made, and re-planning would discard them.
    enforcedPlanPath = enforced.appliedCount ? enforced.planPath : null;
    correctionsPath = nextCorrections;
    // Superseded: the next attempt re-renders to this same path. The one MP4
    // removed rather than queued — the channel's final video is what lands.
    if (existsSync(result.outputPath)) {
      try { rmSync(result.outputPath); console.log(`[queue] ch-${channelId}: attempt ${attempt} superseded by attempt ${attempt + 1} (same output path) — removed, not queued`); } catch {}
    }
  }

  return {
    skipped: false,
    ok: lastResult?.ok || false,
    outputPath: lastResult?.outputPath,
    attempt: MAX_CORRECTION_LOOPS,
    geminiVerdict: "NOT_APPROVED",
    qaGatePass: false,
  };
}

/* ── Main ────────────────────────────────────────────────────────── */

async function main() {
  const { channelOverride, scriptOverride, outputOverride, dryRun, skipQA } = parseArgs(process.argv.slice(2));
  const runId = process.env.GITHUB_RUN_ID || String(Date.now());
  const work = planWork({ channelOverride, scriptOverride });

  if (dryRun) {
    console.log(`DRY RUN — ${work.length} script(s) would render:\n`);
    for (const { channelId, scriptPath } of work) {
      const format = formatFromScriptPath(scriptPath);
      const audio = audioPathFor(channelId, scriptPath);
      const hasAudio = existsSync(audio);
      const out = expectedOutputPath(channelId, scriptPath, format);
      console.log(`  channel ${channelId}  ${format}`);
      console.log(`    script : ${relative(ROOT, scriptPath)}`);
      console.log(`    audio  : ${relative(ROOT, audio)}   ${hasAudio ? "" : "MISSING — would be skipped"}`);
      console.log(`    output : ${relative(ROOT, out)}`);
      console.log(`    flow   : gemini-plan -> render -> gemini-review -> correction loop (max ${MAX_CORRECTION_LOOPS})\n`);
    }
    console.log("No render.js processes were spawned.");
    process.exit(0);
  }

  let rendered = 0;
  let renderFailed = 0;
  const results = [];
  const queued = { "approved-review": 0, rejected: 0 };

  for (const { channelId, scriptPath } of work) {
    const format = formatFromScriptPath(scriptPath);
    let result;
    try {
      result = await renderWithCorrectionLoop(channelId, scriptPath, format, runId, outputOverride, skipQA);
    } catch (e) {
      // A crash anywhere after the MP4 exists: it goes to rejected/ with the reason, never left behind.
      console.error(`::error::render-and-qa crashed for ${scriptPath}: ${e?.stack || e}`);
      const q = await queueVideo({ verdict: "rejected", videoPath: expectedOutputPath(channelId, scriptPath, format), channelId, stage: "crash", check: "exception", reason: String(e?.message || e) });
      result = { skipped: false, ok: false, queued: q || undefined };
    }
    if (result.skipped) continue;
    if (result.queued) queued[result.queued]++;
    if (!result.ok) {
      renderFailed++;
      console.error(`::error::render failed for ${scriptPath}${result.queued ? ` (queued: ${result.queued})` : ""}`);
      continue;
    }
    rendered++;
    results.push(result);
    console.log(`  Completed: attempt ${result.attempt}/${MAX_CORRECTION_LOOPS}, verdict=${result.geminiVerdict}`);
  }

  // Every QA-gate failure is queued inside the loop now (backupAudit). One
  // that still arrives here is queued as rejected — never deleted.
  const qaFailed = results.filter((r) => !r.qaGatePass);
  for (const r of qaFailed) {
    const q = await queueVideo({ verdict: "rejected", videoPath: r.outputPath, channelId: r.channelId ?? (r.outputPath || "").match(/renders[\\/](\d+)[\\/]/)?.[1], stage: "qa-gate", check: "qaGatePass", reason: `verdict ${r.geminiVerdict}` });
    if (q) queued.rejected++;
  }
  // approved/: passed every check. publish (youtube-publish/run.js) reads this queue.
  for (const r of results.filter((x) => x.qaGatePass)) {
    const ch = (r.outputPath || "").match(/renders[\\/](\d+)[\\/]/)?.[1];
    const q = await queueVideo({ verdict: "approved", videoPath: r.outputPath, channelId: ch, reason: `verdict ${r.geminiVerdict}`, extra: { attempts: r.attempt } });
    if (q) r.outputPath = join(APPROVED_DIR, basename(r.outputPath));
  }

  const successfulCount = rendered - qaFailed.length;

  console.log(
    `\n=== SUMMARY === rendered=${rendered} renderFailed=${renderFailed} qaFailed=${qaFailed.length} successful=${successfulCount}`
  );
  for (const r of results) {
    console.log(`  ${basename(r.outputPath || "?")}: attempts=${r.attempt} verdict=${r.geminiVerdict} qa=${r.qaGatePass ? "PASS" : "FAIL"}`);
  }
  // Read by the workflow's "QA counts" step. approved = passed every AI
  // stage (the only videos publish sees); the other two are human queues.
  const counts = { approved: successfulCount, "approved-review": queued["approved-review"], rejected: queued.rejected };
  mkdirSync(join(ROOT, "data", "renders"), { recursive: true });
  writeFileSync(join(ROOT, "data", "renders", "qa-counts.json"), JSON.stringify(counts) + "\n");
  console.log(`Approved: ${counts.approved} · Approved-review: ${counts["approved-review"]} · Rejected: ${counts.rejected}`);

  if (successfulCount === 0) {
    console.error("::error::0 videos successfully rendered and passed QA - nothing for publish to upload.");
    process.exit(1);
  }
  if (renderFailed > 0) {
    console.warn(`WARN: ${renderFailed} render(s) failed, but ${successfulCount} video(s) succeeded and passed QA.`);
  }
  if (qaFailed.length > 0) {
    console.warn(`WARN: ${qaFailed.length} rendered video(s) failed their QA gate and were excluded from publishing.`);
  }
}

// Only as the CLI: importing the module (scripts/test-resolver-canvas.mjs) runs nothing.
export { resolveAssets, canvasContentFor, guardPlanAssets, queueVideo };
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
