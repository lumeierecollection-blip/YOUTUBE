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
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, copyFileSync, writeFileSync } from "node:fs";
import { join, dirname, basename, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
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

function runChild(cmd, args, { label }) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
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
  });
}

/* ── Gemini Visual Planning ──────────────────────────────────────── */

async function geminiPlan(channelId, scriptPath, correctionsPath) {
  const planDir = join(ROOT, "data", "visual-plans", channelId);
  mkdirSync(planDir, { recursive: true });
  const planPath = join(planDir, basename(scriptPath, ".json") + "-visual-plan.json");

  const audio = audioPathFor(channelId, scriptPath);
  const srtPath = join(dirname(audio), basename(audio, extname(audio)) + ".srt");

  // Step 1: Try Gemini if API key available
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.VISION_API_KEY;
  if (geminiKey) {
    const args = [
      GEMINI_PLAN_JS,
      "--script", relative(ROOT, scriptPath),
      "--channel", channelId,
      "--out", planPath,
    ];
    if (existsSync(srtPath)) args.push("--srt", srtPath);
    if (correctionsPath && existsSync(correctionsPath)) args.push("--corrections", correctionsPath);

    console.log(`=== GEMINI PLAN: ${channelId} — ${basename(scriptPath)} ===`);
    const { code } = await runChild("node", args, { label: `plan ${channelId}/${basename(scriptPath)}` });
    if (code === 0 && existsSync(planPath)) {
      return planPath;
    }
    console.warn("Gemini planning failed — trying local fallback.");
  } else {
    console.log("No Gemini API key — trying local plan generator.");
  }

  // Step 2: Local fallback — rule-based plan from SRT, no API needed
  const LOCAL_PLAN_CJS = join(__dirname, "local-visual-plan.cjs");
  if (existsSync(srtPath) && existsSync(LOCAL_PLAN_CJS)) {
    console.log(`=== LOCAL PLAN: ${channelId} — ${basename(scriptPath)} ===`);
    const { code } = await runChild("node", [
      LOCAL_PLAN_CJS,
      "--srt", srtPath,
      "--channel", channelId,
      "--out", planPath,
    ], { label: `local-plan ${channelId}/${basename(scriptPath)}` });
    if (code === 0 && existsSync(planPath)) {
      return planPath;
    }
    console.warn("Local plan generator failed.");
  } else {
    if (!existsSync(srtPath)) console.warn("No SRT file for local plan generator.");
    if (!existsSync(LOCAL_PLAN_CJS)) console.warn("local-visual-plan.cjs not found.");
  }

  return null;
}

/* ── Render ──────────────────────────────────────────────────────── */

async function renderOne(channelId, scriptPath, format) {
  const audio = audioPathFor(channelId, scriptPath);
  if (!existsSync(audio)) {
    console.error(`::error::no voiceover audio at ${audio} — cannot render ${scriptPath}`);
    return { skipped: false, ok: false };
  }
  console.log(`=== RENDER: ${channelId} — ${basename(scriptPath)} (${format}) ===`);
  const { code } = await runChild(
    "node",
    [RENDER_JS, format, channelId, relative(ROOT, scriptPath), relative(ROOT, audio)],
    { label: `render ${channelId}/${basename(scriptPath)}` }
  );
  if (code !== 0) return { skipped: false, ok: false };
  const outputPath = expectedOutputPath(channelId, scriptPath, format);
  if (!existsSync(outputPath)) {
    console.error(`::error::render.js exited 0 but expected output not found: ${outputPath}`);
    return { skipped: false, ok: false };
  }
  return { skipped: false, ok: true, outputPath, channelId, scriptPath, audio };
}

/* ── Silence Detection ───────────────────────────────────────────── */

async function detectSilence(videoPath, audioPath) {
  const FFPROBE = "ffprobe";
  // Get audio duration
  let audioDuration = 0;
  try {
    const dur = await runChild(FFPROBE, [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1", audioPath,
    ], { label: "silence/probe-audio" });
    audioDuration = parseFloat(dur.stdout.trim()) || 0;
  } catch {}

  if (audioDuration <= 0) return { ok: true, gaps: [] };

  // Detect silence gaps > 0.5s using ffmpeg silencedetect
  const { code, stdout } = await runChild("ffmpeg", [
    "-i", videoPath,
    "-af", "silencedetect=noise=-40dB:d=0.5",
    "-f", "null", "-",
  ], { label: "silence/detect" });

  // Parse silencedetect output for silence_start/silence_end
  const gaps = [];
  const lines = stdout.split("\n");
  let silenceStart = null;
  for (const line of lines) {
    const startMatch = line.match(/silence_start:\s*([\d.]+)/);
    const endMatch = line.match(/silence_end:\s*([\d.]+)/);
    if (startMatch) silenceStart = parseFloat(startMatch[1]);
    if (endMatch && silenceStart !== null) {
      const silenceEnd = parseFloat(endMatch[1]);
      const gapDuration = silenceEnd - silenceStart;
      // Only flag gaps inside the narration window (0 to audio duration)
      if (silenceStart < audioDuration && gapDuration > 0.5) {
        gaps.push({ start: silenceStart, end: silenceEnd, duration: gapDuration });
      }
      silenceStart = null;
    }
  }

  if (gaps.length > 0) {
    console.error(`::error::${gaps.length} silence gap(s) > 0.5s detected inside narration window:`);
    for (const g of gaps) {
      console.error(`  ${g.start.toFixed(2)}s — ${g.end.toFixed(2)}s (${g.duration.toFixed(2)}s)`);
    }
    return { ok: false, gaps };
  }

  return { ok: true, gaps: [] };
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
  if (audit.code === 0 && geminiNeeded && process.env.VISION_API_KEY) {
    const chId = `ch-${String(channelId).padStart(2, "0")}`;
    visionQaPromise = runChild("node", [VISUAL_QA_JS, "--channel", chId, "--video", outputPath], {
      label: `qa/vision ${basename(outputPath)}`,
    });
  }

  let geminiReviewPromise;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.VISION_API_KEY;
  if (audit.code === 0 && geminiNeeded && geminiKey) {
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

/* ── Correction loop ─────────────────────────────────────────────── */

async function renderWithCorrectionLoop(channelId, scriptPath, format, runId, outputOverride) {
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
  if (existsSync(audioForBundle)) {
    const voTarget = join(ROOT, "src", "skills", "remotion-render", "vo.mp3");
    mkdirSync(dirname(voTarget), { recursive: true });
    copyFileSync(audioForBundle, voTarget);
    const bundleStart = Date.now();
    console.log(`[render-and-qa] pre-bundling for ${basename(scriptPath)}...`);
    try {
      process.env.REMOTION_SERVE_URL = await bundle({ entryPoint: REMOTION_ROOT_JSX, onProgress: () => {} });
      console.log(`[render-and-qa] pre-bundle done: ${((Date.now() - bundleStart) / 1000).toFixed(1)}s`);
    } catch (e) {
      console.warn(`[render-and-qa] pre-bundle failed, falling back to per-attempt bundling: ${e.message}`);
      delete process.env.REMOTION_SERVE_URL;
    }
  }

  for (let attempt = 1; attempt <= MAX_CORRECTION_LOOPS; attempt++) {
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

    // Step 2: Render (uses pre-built bundle via REMOTION_SERVE_URL)
    const result = await renderOne(channelId, scriptPath, format);
    if (result.skipped) return { skipped: true };
    if (!result.ok) return { skipped: false, ok: false };

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
      console.error(`::error::silence detection failed for ${basename(result.outputPath)} — ${silenceCheck.gaps.length} gap(s)`);
      if (existsSync(result.outputPath)) {
        try { rmSync(result.outputPath); } catch {}
      }
      continue;
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
    if (pipelineVerdict === "APPROVED" || attempt === MAX_CORRECTION_LOOPS) {
      return {
        skipped: false,
        ok: true,
        outputPath: result.outputPath,
        attempt,
        geminiVerdict,
        qaGatePass: qa.gatePass,
      };
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
      console.log(`Gemini says ${pipelineVerdict} but produced no actionable corrections — not spending another attempt.`);
      return {
        skipped: false, ok: true, outputPath: result.outputPath, attempt,
        geminiVerdict, qaGatePass: qa.gatePass, unresolvedVerdict: pipelineVerdict,
      };
    }
    // When directives were enforced, the NEXT attempt renders the edited
    // plan directly instead of asking Gemini for a fresh one — the changes
    // are already made, and re-planning would discard them.
    enforcedPlanPath = enforced.appliedCount ? enforced.planPath : null;
    correctionsPath = nextCorrections;
    if (existsSync(result.outputPath)) {
      try { rmSync(result.outputPath); } catch {}
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
  const { channelOverride, scriptOverride, outputOverride, dryRun } = parseArgs(process.argv.slice(2));
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

  for (const { channelId, scriptPath } of work) {
    const format = formatFromScriptPath(scriptPath);
    const result = await renderWithCorrectionLoop(channelId, scriptPath, format, runId, outputOverride);
    if (result.skipped) continue;
    if (!result.ok) {
      renderFailed++;
      console.error(`::error::render failed for ${scriptPath}`);
      continue;
    }
    rendered++;
    results.push(result);
    console.log(`  Completed: attempt ${result.attempt}/${MAX_CORRECTION_LOOPS}, verdict=${result.geminiVerdict}`);
  }

  const qaFailed = results.filter((r) => !r.qaGatePass);

  for (const r of qaFailed) {
    if (r.outputPath && existsSync(r.outputPath)) {
      try {
        rmSync(r.outputPath);
        console.log(`Removed QA-failed video: ${r.outputPath}`);
      } catch (e) {
        console.warn(`Failed to remove QA-failed video ${r.outputPath}:`, e.message);
      }
    }
  }

  const successfulCount = rendered - qaFailed.length;

  console.log(
    `\n=== SUMMARY === rendered=${rendered} renderFailed=${renderFailed} qaFailed=${qaFailed.length} successful=${successfulCount}`
  );
  for (const r of results) {
    console.log(`  ${basename(r.outputPath || "?")}: attempts=${r.attempt} verdict=${r.geminiVerdict} qa=${r.qaGatePass ? "PASS" : "FAIL"}`);
  }

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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
