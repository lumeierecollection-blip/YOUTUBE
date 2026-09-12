#!/usr/bin/env node
/**
 * render-and-qa.js — PART 8 of the motion-graphics rebuild.
 *
 * Replaces daily-pipeline.yml's "Render all videos" (bash loop over every
 * channel/script) followed by a separate, fully sequential "Review renders"
 * step. Doing all N renders and only then all N reviews means every
 * review sits idle time on the runner that could have overlapped with the
 * NEXT render. This orchestrator pipelines the two instead:
 *
 *   render(video 1) -> [render(video 2) while QA(video 1) runs in the
 *   background] -> [render(video 3) while QA(video 2) runs] -> ...
 *
 * QA (video-review.js frame extraction + frame-audit.js pixel audit) is
 * dispatched right after a render finishes and NEVER awaited before the
 * next render starts — only collected at the very end. A QA failure fails
 * only that one video; the batch keeps going. Exit code mirrors the bash
 * loop it replaces (0 rendered -> fail; any render failure -> fail) PLUS
 * PART 8's new rule: fail the job if a video that would have published
 * (i.e. it rendered successfully) failed its QA gate.
 *
 * Uses the SAME channel-id convention as the bash it replaces: `c.id`
 * (numeric, as a string) from config/channels.json — matching
 * build-discovery-context.js's `channel_id: String(c.id)`, which is what
 * every research/tts/thumbnail directory is actually keyed by upstream.
 * Not "ch-01" — that's a separate field (`channel.channel_id`) used for
 * OAuth cred paths and per-channel b-roll/asset-library dirs, not for
 * data/research|tts|thumbnails/<id>/.
 *
 * Usage:
 *   node scripts/render-and-qa.js [--channel <numeric-id>]
 *   node scripts/render-and-qa.js --script <path-to-*-script.json> [--channel <id>] [--output <mp4>]
 *   node scripts/render-and-qa.js --dry-run [--channel <id>] [--script <path>]
 *
 * --script   render one script JSON only (channel id from --channel, else
 *            the script's parent dir name).
 * --output   after a successful render, copy the mp4 to this path too
 *            (render.js still writes its canonical data/renders/<id>/ path).
 * --dry-run  print the render + QA plan and exit 0 without spawning render.js.
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

function parseArgs(argv) {
  const flag = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : null;
  };
  return {
    channelOverride: flag("--channel"),
    // --script <path> renders exactly one script JSON and skips the channel
    // scan. The channel id is taken from --channel if given, else from the
    // script's parent directory (data/research/<id>/…), which is how every
    // other path in this file is keyed.
    scriptOverride: flag("--script"),
    // --output <path> copies the finished mp4 to an arbitrary location
    // AFTER the normal render (render.js still writes its canonical
    // data/renders/<id>/… path; this is an extra copy for test harnesses).
    outputOverride: flag("--output"),
    // --dry-run prints the render plan (every script that would render, its
    // format, its voiceover path, and where the mp4 would land) and exits 0
    // without spawning render.js.
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

// Build the (channelId, scriptPath) work list for either mode.
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

// Mirrors render.js's own output-path construction exactly (main()'s
// outputDir/slug/timestamp logic) so this orchestrator knows where the mp4
// will land without depending on parsing the child process's stdout.
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

async function renderOne(channelId, scriptPath, format) {
  const audio = audioPathFor(channelId, scriptPath);
  if (!existsSync(audio)) {
    console.warn(`WARN: no voiceover audio at ${audio} — skipping render for ${scriptPath}`);
    return { skipped: true };
  }
  console.log(`=== RENDER: ${channelId} — ${basename(scriptPath)} (${format}) ===`);
  // render.js's loadScript() always re-joins its argv path onto its own
  // ROOT (`join(ROOT, ...scriptPath.split(/[\/\\]/))`) — it expects a path
  // RELATIVE to the repo root, exactly like the bash loop this replaces
  // always passed (`"$SCRIPT"` from a `data/research/...` glob run with cwd
  // = repo root). Passing the absolute paths this orchestrator uses
  // internally double-joins them onto ROOT and 404s.
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

// QA for ONE finished video — frame extraction + pixel audit, THEN
// (PART 9, warn-only) the anti-slop gate. Returns a result object rather
// than throwing: a QA failure must never crash the orchestrator, only mark
// that video's gate as failed (PART 8 — "a QA failure fails only that
// video; the batch continues"). slop-check's own verdict never affects
// gatePass — see ANTI-SLOP.md's warn-only rule; it's logged, not gating.
async function qaOne(runId, rendered) {
  const { outputPath, channelId, scriptPath, audio } = rendered;
  const reviewDir = join(ROOT, "data", "audit", "render-review", runId, basename(outputPath, ".mp4"));
  mkdirSync(reviewDir, { recursive: true });
  const review = await runChild("node", [VIDEO_REVIEW_JS, outputPath, "--frames", "10", "--out", reviewDir], {
    label: `qa/review ${basename(outputPath)}`,
  });
  if (review.code !== 0) {
    return { outputPath, gatePass: false, stage: "video-review", reviewDir };
  }
  const audit = await runChild("node", [FRAME_AUDIT_JS, reviewDir], { label: `qa/audit ${basename(outputPath)}` });

  // Vision QA (Gemini) — runs after frame-audit passes, warn-only so it
  // doesn't block renders while the visual system is still evolving.
  let visionQaPromise;
  if (audit.code === 0 && process.env.VISION_API_KEY) {
    const chId = `ch-${String(channelId).padStart(2, "0")}`;
    visionQaPromise = runChild("node", [VISUAL_QA_JS, "--channel", chId, "--video", outputPath], {
      label: `qa/vision ${basename(outputPath)}`,
    });
  }

  // Gemini Frame Review — per-beat visual QA with visual bible checks.
  // Runs if any Gemini API key is available. Warn-only (doesn't gate).
  let geminiReviewPromise;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.VISION_API_KEY;
  if (audit.code === 0 && geminiKey) {
    const srtPath = join(dirname(audio), basename(audio, extname(audio)) + ".srt");
    const srtArg = existsSync(srtPath) ? srtPath : "";
    const reviewArgs = ["--video", outputPath, "--script", scriptPath, "--channel", String(channelId)];
    if (srtArg) reviewArgs.push("--srt", srtArg);
    geminiReviewPromise = runChild("node", [GEMINI_REVIEW_JS, ...reviewArgs], {
      label: `qa/gemini-review ${basename(outputPath)}`,
    });
  }

  // PART 9 — dispatched after frame-audit, never awaited into gatePass
  // (ANTI-SLOP.md's warn-only rule: its verdict is logged, not gating).
  // Still tracked (not orphaned) via slopCheckPromise so main() can wait
  // for it to actually finish logging before the process exits.
  const slopCheckPromise = runChild("node", [SLOP_CHECK_JS, outputPath, channelId, scriptPath, audio], {
    label: `qa/slop-check ${basename(outputPath)}`,
  });

  return { outputPath, gatePass: audit.code === 0, stage: "frame-audit", reviewDir, slopCheckPromise, visionQaPromise, geminiReviewPromise };
}

async function main() {
  const { channelOverride, scriptOverride, outputOverride, dryRun } = parseArgs(process.argv.slice(2));
  const runId = process.env.GITHUB_RUN_ID || String(Date.now());
  const work = planWork({ channelOverride, scriptOverride });

  // --dry-run: print the plan and exit 0 without spawning anything.
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
      console.log(`    QA     : video-review (10 frames) -> frame-audit -> slop-check (warn-only)\n`);
    }
    console.log("No render.js processes were spawned.");
    process.exit(0);
  }

  let rendered = 0;
  let renderFailed = 0;
  const pendingQA = []; // PART 8 — never awaited until every render has been dispatched

  for (const { channelId, scriptPath } of work) {
    const format = formatFromScriptPath(scriptPath);
    const result = await renderOne(channelId, scriptPath, format);
    if (result.skipped) continue;
    if (!result.ok) {
      renderFailed++;
      console.error(`::error::render failed for ${scriptPath}`);
      continue;
    }
    rendered++;
    // --output: copy the canonical render to the requested location.
    if (outputOverride && result.outputPath) {
      const outDir = dirname(outputOverride);
      if (outDir) mkdirSync(outDir, { recursive: true });
      copyFileSync(result.outputPath, outputOverride);
      console.log(`Copied render to --output: ${outputOverride}`);
    }
    // Dispatched, NOT awaited — the loop moves straight on to the next
    // render while this QA runs in the background.
    pendingQA.push(qaOne(runId, result));
  }

  console.log(`\nRendered ${rendered} video(s), ${renderFailed} render failure(s). Waiting on ${pendingQA.length} QA task(s)...`);
  const qaResults = await Promise.all(pendingQA);
  const qaFailed = qaResults.filter((r) => !r.gatePass);
  for (const r of qaResults) {
    console.log(`QA ${r.gatePass ? "PASS" : "FAIL"} (${r.stage}): ${r.outputPath}`);
  }

  // PART 9 — slop-check's own verdict never gates the job (warn-only), but
  // its child process must still be allowed to finish and log before this
  // process exits, or "log every verdict" wouldn't reliably hold on a run
  // that finishes right after its last render's QA does.
  const slopChecks = qaResults.map((r) => r.slopCheckPromise).filter(Boolean);
  const visionChecks = qaResults.map((r) => r.visionQaPromise).filter(Boolean);
  const geminiReviews = qaResults.map((r) => r.geminiReviewPromise).filter(Boolean);
  const pendingBg = [...slopChecks, ...visionChecks, ...geminiReviews];
  if (pendingBg.length) {
    console.log(`Waiting on ${slopChecks.length} slop-check + ${visionChecks.length} vision-qa + ${geminiReviews.length} gemini-review task(s)...`);
    await Promise.all(pendingBg);
  }

  for (const r of qaFailed) {
    if (existsSync(r.outputPath)) {
      try {
        rmSync(r.outputPath);
        console.log(`Removed QA-failed video from renders output: ${r.outputPath}`);
      } catch (e) {
        console.warn(`Failed to remove QA-failed video ${r.outputPath}:`, e.message);
      }
    }
  }

  const successfulCount = rendered - qaFailed.length;

  console.log(
    `\n=== SUMMARY === rendered=${rendered} renderFailed=${renderFailed} qaChecked=${qaResults.length} qaFailed=${qaFailed.length} successful=${successfulCount}`
  );

  if (successfulCount === 0) {
    console.error("::error::0 videos successfully rendered and passed QA - nothing for publish to upload.");
    process.exit(1);
  }
  if (renderFailed > 0) {
    console.warn(`WARN: ${renderFailed} render(s) failed, but ${successfulCount} video(s) succeeded and passed QA. Continuing with successful channels.`);
  }
  if (qaFailed.length > 0) {
    console.warn(`WARN: ${qaFailed.length} rendered video(s) failed their QA gate and were excluded from publishing.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
