#!/usr/bin/env node
/**
 * slop-check.js — PART 9 of the motion-graphics rebuild. See ANTI-SLOP.md
 * for the full bar and why this is measured checks + an optional cold
 * model pass rather than a vision-model review (the pipeline's configured
 * provider has no vision support — ANTI-SLOP.md explains).
 *
 * Usage:
 *   node scripts/slop-check.js <video.mp4> <channel-id> <script-path> [audio-path] [--with-model-review]
 *
 * Reuses video-review.js's frame extraction (spawned exactly like
 * render-and-qa.js already spawns it for frame-audit.js) and mg-package.js
 * /beats.js's existing gates (gateMgHeadlineOverlap, gateCaptions) rather
 * than re-implementing what's already real and tested.
 *
 * Exit code is always 0 (warn-only — see ANTI-SLOP.md's rationale); the
 * verdict is in stdout, data/audit/slop-check.log, and the returned JSON
 * (when imported as a module via runSlopCheck()).
 */
import { spawn } from "node:child_process";
import { readFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { buildMgPackage, gateMgHeadlineOverlap } from "../src/skills/remotion-render/compositions/mg-package.js";
import { gateCaptions, chunkTextClauseAware } from "../src/skills/remotion-render/compositions/beats.js";
import { resolveImageAssets } from "../src/skills/remotion-render/image-assets.js";
import { narrationSections } from "../src/utils/script-narration.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const VIDEO_REVIEW_JS = join(__dirname, "video-review.js");
const MG_JSX_PATH = join(ROOT, "src", "skills", "remotion-render", "compositions", "motion-graphics.jsx");
const LOG_PATH = join(ROOT, "data", "audit", "slop-check.log");

// ─────────────────────────────────────────────────────────────────────────────
// Rebuilding the mg package from the same inputs render.js used — mirrors
// render.js's loadChannel/loadScript/toContentSections/findSrtPath exactly
// (render.js can't be imported directly: it runs main() unconditionally at
// import time as a CLI entry script). Keep these in sync if render.js's
// versions change.
// ─────────────────────────────────────────────────────────────────────────────
function loadChannel(channelId) {
  const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  const channels = data.channels || data;
  const numId = parseInt(channelId, 10);
  const channel = channels.find((c) => c.id === numId || c.channel_id === channelId);
  if (!channel) throw new Error(`Channel "${channelId}" not found`);
  return channel;
}

function loadScript(scriptPath) {
  const fullPath = join(ROOT, ...String(scriptPath).split(/[\/\\]/));
  return JSON.parse(readFileSync(fullPath, "utf-8"));
}

function toContentSections(script) {
  const sections = narrationSections(script);
  return sections
    .filter((s) => s.voiceover && s.voiceover.trim())
    .map((s) => ({
      id: s.id,
      timing: s.timing,
      voiceover: s.voiceover,
      content: chunkTextClauseAware(s.voiceover, 7),
      bRoll: Array.isArray(s.b_roll) ? s.b_roll : null,
    }));
}

function findSrtPath(audioPath) {
  if (!audioPath || !existsSync(join(ROOT, audioPath))) return null;
  const full = join(ROOT, audioPath);
  const dir = dirname(full);
  const base = basename(audioPath).replace(/\.[^.]+$/, "");
  const exact = join(dir, `${base}.srt`);
  return existsSync(exact) ? exact : null;
}

function rebuildMgPackage(channelId, scriptPath, audioPath) {
  const channel = loadChannel(channelId);
  const script = loadScript(scriptPath);
  const sections = toContentSections(script);
  for (const section of sections) {
    section.bRollFiles = resolveImageAssets(section.bRoll || [], channel.channel_id || channelId, script.topic_slug);
  }
  const srtPath = findSrtPath(audioPath);
  const srtText = srtPath ? readFileSync(srtPath, "utf-8") : "";
  return buildMgPackage(srtText, {
    sections,
    bRollFiles: sections.flatMap((s) => s.bRollFiles || []),
    imageForSection: (idx) => (sections[idx] && sections[idx].bRollFiles && sections[idx].bRollFiles[0]) || null,
    revealPlacement: channel.script_template && channel.script_template.reveal_placement,
    silenceTechnique: channel.sfx_profile && channel.sfx_profile.silence_technique,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Frame extraction — reuses video-review.js exactly as render-and-qa.js does.
// ─────────────────────────────────────────────────────────────────────────────
function runChild(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", () => {});
    child.on("close", (code) => resolve({ code, stdout }));
  });
}

async function extractFrames(videoPath, outDir) {
  mkdirSync(outDir, { recursive: true });
  const { code } = await runChild("node", [VIDEO_REVIEW_JS, videoPath, "--frames", "10", "--out", outDir]);
  if (code !== 0) return null;
  return JSON.parse(readFileSync(join(outDir, "manifest.json"), "utf-8"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Row 3 — "No frame >40% empty." Foreground = any pixel differing from the
// frame's own median-margin background colour by more than frame-audit's
// own FG_DIFF threshold, sampled over the WHOLE frame (frame-audit only
// samples specific zones).
// ─────────────────────────────────────────────────────────────────────────────
async function checkFrameEmptiness(frames) {
  const FG_DIFF = 20;
  const results = [];
  for (const f of frames) {
    const { data, info } = await sharp(f.file).resize(270, 480).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    // Background estimate: the four corner pixels (cheap, matches
    // frame-audit's own "margins are background" assumption).
    const corners = [
      [0, 0],
      [info.width - 1, 0],
      [0, info.height - 1],
      [info.width - 1, info.height - 1],
    ].map(([x, y]) => {
      const i = (y * info.width + x) * info.channels;
      return [data[i], data[i + 1], data[i + 2]];
    });
    const bg = [0, 1, 2].map((c) => Math.round(corners.reduce((a, p) => a + p[c], 0) / corners.length));
    let fg = 0;
    const total = info.width * info.height;
    for (let i = 0; i < total; i++) {
      const o = i * info.channels;
      if (Math.abs(data[o] - bg[0]) > FG_DIFF || Math.abs(data[o + 1] - bg[1]) > FG_DIFF || Math.abs(data[o + 2] - bg[2]) > FG_DIFF) fg++;
    }
    const emptyFraction = 1 - fg / total;
    results.push({ file: f.file, emptyFraction, pass: emptyFraction <= 0.4 });
  }
  return { pass: results.every((r) => r.pass), results };
}

// Row 5 — edge-bleed presence (weak signal, see ANTI-SLOP.md).
async function checkEdgeBleed(frames) {
  const FG_DIFF = 20;
  const results = [];
  for (const f of frames) {
    const { data, info } = await sharp(f.file).resize(270, 480).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const bgPx = [0, (info.width - 1)].map((x) => {
      const i = (5 * info.width + x) * info.channels; // near-top row, away from any edge content
      return [data[i], data[i + 1], data[i + 2]];
    });
    const bg = [0, 1, 2].map((c) => Math.round((bgPx[0][c] + bgPx[1][c]) / 2));
    let touches = false;
    for (const x of [0, info.width - 1]) {
      for (let y = 0; y < info.height; y++) {
        const o = (y * info.width + x) * info.channels;
        if (Math.abs(data[o] - bg[0]) > FG_DIFF || Math.abs(data[o + 1] - bg[1]) > FG_DIFF || Math.abs(data[o + 2] - bg[2]) > FG_DIFF) {
          touches = true;
          break;
        }
      }
      if (touches) break;
    }
    results.push({ file: f.file, edgeTouch: touches });
  }
  const anyBleed = results.some((r) => r.edgeTouch);
  return { pass: anyBleed, results, note: "weak signal — see ANTI-SLOP.md row 5" };
}

// Row 4 — every non-LIST_ITEM beat's scene carries real visual content.
function checkSceneHasVisual(beats) {
  const VISUAL_KEYS = ["icon", "image", "series", "a", "b", "before", "after", "value", "item"];
  const failures = [];
  for (const b of beats) {
    if (b.archetype === "LIST_ITEM") continue;
    const scene = b.scene || {};
    const hasVisual = VISUAL_KEYS.some((k) => scene[k] != null && scene[k] !== "" && !(Array.isArray(scene[k]) && scene[k].length === 0));
    if (!hasVisual) failures.push(`beat "${b.text}" (${b.archetype}) has no visual content in scene`);
  }
  return { pass: failures.length === 0, failures };
}

// Row 6 — flag (warn) image beats that look like untreated legacy photos.
function checkImageTreatment(beats) {
  const warnings = [];
  for (const b of beats) {
    if (b.archetype !== "IMAGE_BEAT" || !b.scene || !b.scene.image) continue;
    if (!b.scene.credit) {
      warnings.push(`beat "${b.text}": image "${b.scene.image}" has no attribution — likely an untreated legacy b-roll fixture, not asset-sourcing/treat.js output`);
    }
  }
  return { pass: warnings.length === 0, warnings };
}

// Row 9 — no two adjacent non-LIST_ITEM beats share an archetype.
function checkEntranceDiversity(beats) {
  const filtered = beats.filter((b) => b.archetype !== "LIST_ITEM");
  const failures = [];
  for (let i = 1; i < filtered.length; i++) {
    if (filtered[i].archetype === filtered[i - 1].archetype) {
      failures.push(`beats "${filtered[i - 1].text}" and "${filtered[i].text}" are both ${filtered[i].archetype}`);
    }
  }
  return { pass: failures.length === 0, failures };
}

// Rows 7/8/11 — static regression guards over motion-graphics.jsx. Run
// once per invocation (not per-frame) since these are code properties, not
// render properties — a Tier-1 static lint per CHECK-REGISTER.md §1.
function checkStaticSource() {
  const src = readFileSync(MG_JSX_PATH, "utf-8");
  const noHexagon = !/hexagon|connector-?line|connectorLine/i.test(src);
  const rawInterpolateCalls = [...src.matchAll(/(\w+)\s*\(\s*frame[^)]*interpolate\(/g)];
  // A simpler, direct scan: every `interpolate(` call site must be inside
  // the ease()/easeScale() function bodies, i.e. it should appear exactly
  // twice in the whole file (their two definitions) — any third occurrence
  // is a raw, unwrapped interpolate() call bypassing the default bezier
  // easing, which is what "no linear motion" is actually guarding against.
  const interpolateCallCount = (src.match(/\binterpolate\(/g) || []).length;
  const noRawInterpolate = interpolateCallCount <= 2;
  const kickerFn = /function Kicker\(/.exec(src);
  let kickerNoScaffolding = true;
  if (kickerFn) {
    const kickerBody = src.slice(kickerFn.index, src.indexOf("\n}", kickerFn.index));
    // The kicker must not reference channelName or a free-text section
    // label prop — only sectionNumber (a number).
    kickerNoScaffolding = !/channelName|sectionLabel/.test(kickerBody);
  }
  return {
    pass: noHexagon && noRawInterpolate && kickerNoScaffolding,
    noHexagon,
    noRawInterpolate: { pass: noRawInterpolate, interpolateCallCount },
    kickerNoScaffolding,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Optional cold model pass — see ANTI-SLOP.md's "Why this isn't a vision-
// model review". Off by default; --with-model-review opts in. Unverified
// against a live Cerebras call (see ANTI-SLOP.md) — best-effort.
// ─────────────────────────────────────────────────────────────────────────────
async function coldModelReview(evidence) {
  const opencodeAgent = join(ROOT, "scripts", "opencode-agent.js");
  const promptPath = join(ROOT, "prompts", "slop-check-review.md");
  if (!existsSync(promptPath) || !process.env.OPENCODE_MODELS) {
    return { ran: false, reason: "no prompts/slop-check-review.md or OPENCODE_MODELS unset" };
  }
  const { code, stdout } = await runChild("node", [
    opencodeAgent,
    "--prompt-file", promptPath,
    "--schema-file", join(ROOT, "schemas", "slop-check-review.json"),
    "--model", process.env.OPENCODE_MODELS,
  ]);
  if (code !== 0) return { ran: true, ok: false, raw: stdout.slice(0, 2000) };
  try {
    const parsed = JSON.parse(stdout);
    return { ran: true, ok: true, verdict: parsed.structured_output };
  } catch {
    return { ran: true, ok: false, raw: stdout.slice(0, 2000) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────
export async function runSlopCheck(videoPath, channelId, scriptPath, audioPath, { withModelReview = false } = {}) {
  const reviewDir = join(ROOT, "data", "audit", "slop-check", basename(videoPath, extname(videoPath)));
  const manifest = await extractFrames(videoPath, reviewDir);
  const frames = manifest ? manifest.frames : [];

  let mg = null;
  let mgError = null;
  try {
    mg = rebuildMgPackage(channelId, scriptPath, audioPath);
  } catch (e) {
    mgError = e.message;
  }

  const rows = {};
  if (frames.length) {
    rows.frameEmptiness = await checkFrameEmptiness(frames);
    rows.edgeBleed = await checkEdgeBleed(frames);
  }
  if (mg) {
    rows.sceneHasVisual = checkSceneHasVisual(mg.beats);
    rows.imageTreatment = checkImageTreatment(mg.beats);
    rows.entranceDiversity = checkEntranceDiversity(mg.beats);
    rows.duplicatedFact = gateMgHeadlineOverlap(mg.beats);
    rows.captionBreaks = gateCaptions(mg.pages);
  }
  rows.staticSource = checkStaticSource();

  if (withModelReview) {
    rows.modelReview = await coldModelReview({ mg: mg ? { beats: mg.beats.length } : null, rows });
  }

  const failingRows = Object.entries(rows)
    .filter(([, r]) => r.pass === false)
    .map(([name]) => name);

  const verdict = {
    video: videoPath,
    channelId,
    scriptPath,
    timestamp: new Date().toISOString(),
    mgError,
    rows,
    failingRows,
    overallPass: failingRows.length === 0,
  };

  mkdirSync(dirname(LOG_PATH), { recursive: true });
  appendFileSync(
    LOG_PATH,
    JSON.stringify({ timestamp: verdict.timestamp, video: videoPath, overallPass: verdict.overallPass, failingRows }) + "\n"
  );

  return verdict;
}

async function main() {
  const argv = process.argv.slice(2);
  const withModelReview = argv.includes("--with-model-review");
  const [videoPath, channelId, scriptPath, audioPath] = argv.filter((a) => !a.startsWith("--"));
  if (!videoPath || !channelId || !scriptPath) {
    console.error("Usage: node scripts/slop-check.js <video.mp4> <channel-id> <script-path> [audio-path] [--with-model-review]");
    process.exit(2);
  }
  const verdict = await runSlopCheck(videoPath, channelId, scriptPath, audioPath, { withModelReview });
  console.log(JSON.stringify(verdict, null, 2));
  console.log(`\nslop-check: ${verdict.overallPass ? "PASS" : "FAIL"} (warn-only — see ANTI-SLOP.md)`);
  if (!verdict.overallPass) console.log("Failing rows:", verdict.failingRows.join(", "));
  // Always exit 0 — ANTI-SLOP.md's warn-only rule.
  process.exit(0);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(0); // warn-only — a crash in the checker is not a render failure
  });
}
