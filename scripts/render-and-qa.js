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
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, copyFileSync } from "node:fs";
import { join, dirname, basename, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RENDER_JS = join(ROOT, "src", "skills", "remotion-render", "render.js");
const VIDEO_REVIEW_JS = join(__dirname, "video-review.js");
const FRAME_AUDIT_JS = join(__dirname, "frame-audit.js");
const SLOP_CHECK_JS = join(__dirname, "slop-check.js");
const VISUAL_QA_JS = join(__dirname, "gate-visual-qa.js");
const GEMINI_REVIEW_JS = join(__dirname, "gemini-frame-review.js");
const GEMINI_PLAN_JS = join(__dirname, "gemini-visual-plan.js");
const MAX_CORRECTION_LOOPS = 3;

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
  const dir = join(ROOT, "data", "research", channelId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith("-script.json"))
    .map((f) => join(dir, f));
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
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.VISION_API_KEY;
  if (!geminiKey) {
    console.log("No Gemini API key — skipping visual planning.");
    return null;
  }
  const planDir = join(ROOT, "data", "visual-plans", channelId);
  mkdirSync(planDir, { recursive: true });
  const planPath = join(planDir, basename(scriptPath, ".json") + "-visual-plan.json");

  const audio = audioPathFor(channelId, scriptPath);
  const srtPath = join(dirname(audio), basename(audio, extname(audio)) + ".srt");

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
  if (code !== 0) {
    console.warn("Gemini planning failed — will use default director.");
    return null;
  }
  return planPath;
}

/* ── Render ──────────────────────────────────────────────────────── */

async function renderOne(channelId, scriptPath, format) {
  const audio = audioPathFor(channelId, scriptPath);
  if (!existsSync(audio)) {
    console.warn(`WARN: no voiceover audio at ${audio} — skipping render for ${scriptPath}`);
    return { skipped: true };
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

/* ── QA ──────────────────────────────────────────────────────────── */

async function qaOne(runId, rendered) {
  const { outputPath, channelId, scriptPath, audio } = rendered;
  const reviewDir = join(ROOT, "data", "audit", "render-review", runId, basename(outputPath, ".mp4"));
  mkdirSync(reviewDir, { recursive: true });
  const review = await runChild("node", [VIDEO_REVIEW_JS, outputPath, "--frames", "4", "--out", reviewDir], {
    label: `qa/review ${basename(outputPath)}`,
  });
  if (review.code !== 0) {
    return { outputPath, gatePass: false, stage: "video-review", reviewDir };
  }
  const audit = await runChild("node", [FRAME_AUDIT_JS, reviewDir], { label: `qa/audit ${basename(outputPath)}` });

  let visionQaPromise;
  if (audit.code === 0 && process.env.VISION_API_KEY) {
    const chId = `ch-${String(channelId).padStart(2, "0")}`;
    visionQaPromise = runChild("node", [VISUAL_QA_JS, "--channel", chId, "--video", outputPath], {
      label: `qa/vision ${basename(outputPath)}`,
    });
  }

  let geminiReviewPromise;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.VISION_API_KEY;
  if (audit.code === 0 && geminiKey) {
    const srtPath = join(dirname(audio), basename(audio, extname(audio)) + ".srt");
    const srtArg = existsSync(srtPath) ? srtPath : "";
    const reviewArgs = ["--video", outputPath, "--script", scriptPath, "--channel", String(channelId), "--fix"];
    if (srtArg) reviewArgs.push("--srt", srtArg);
    geminiReviewPromise = runChild("node", [GEMINI_REVIEW_JS, ...reviewArgs], {
      label: `qa/gemini-review ${basename(outputPath)}`,
    });
  }

  const slopCheckPromise = runChild("node", [SLOP_CHECK_JS, outputPath, channelId, scriptPath, audio], {
    label: `qa/slop-check ${basename(outputPath)}`,
  });

  return { outputPath, gatePass: audit.code === 0, stage: "frame-audit", reviewDir, slopCheckPromise, visionQaPromise, geminiReviewPromise };
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
  let lastResult = null;


  for (let attempt = 1; attempt <= MAX_CORRECTION_LOOPS; attempt++) {
    console.log(`\n=== ATTEMPT ${attempt}/${MAX_CORRECTION_LOOPS}: ${basename(scriptPath)} ===`);

    // Step 1: Gemini plans (or re-plans with corrections)
    await geminiPlan(channelId, scriptPath, correctionsPath);

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

    // Step 3: QA (frame extraction + audit + Gemini review)
    const qa = await qaOne(runId, result);

    // Wait for all background QA tasks to finish before checking Gemini verdict
    await Promise.all([qa.slopCheckPromise, qa.visionQaPromise, qa.geminiReviewPromise].filter(Boolean));

    // Step 4: Check Gemini verdict
    const geminiReport = findGeminiReviewReport(channelId, scriptPath);
    let geminiVerdict = "UNKNOWN";
    if (geminiReport) {
      try {
        const report = JSON.parse(readFileSync(geminiReport, "utf-8"));
        geminiVerdict = report.wholeVideoResult?.verdict || report.verdict || "UNKNOWN";
        console.log(`Gemini verdict (attempt ${attempt}): ${geminiVerdict}`);
      } catch {}
    }

    if (geminiVerdict === "APPROVED" || attempt === MAX_CORRECTION_LOOPS) {
      return {
        skipped: false,
        ok: true,
        outputPath: result.outputPath,
        attempt,
        geminiVerdict,
        qaGatePass: qa.gatePass,
      };
    }

    // Not approved — feed corrections back
    console.log(`Gemini says ${geminiVerdict} — feeding corrections back for attempt ${attempt + 1}`);
    correctionsPath = geminiReport;
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
