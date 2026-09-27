#!/usr/bin/env node
/**
 * local-audit.cjs — deterministic BACKUP audit for a rendered video.
 *
 * Runs ONLY when one of the AI stages (challenger, Gemini frame review,
 * beat check) fails or cannot produce a verdict (render-and-qa.js
 * backupAudit()). No model, no network. Its verdict never approves a video
 * for upload: PASS routes the video to data/renders/approved-review/ for a
 * human, FAIL routes it to data/renders/rejected/. It exists so a video is
 * not lost when a checker was wrong or a Gemini call timed out — not as a
 * way to ship.
 *
 * Not the same tool as scripts/local-audit.js (the risk-level auditor used
 * by risk-based-review.js / render-and-qa-enhanced.js). This one answers a
 * fixed list of yes/no questions:
 *
 *   frames-nonempty   every beat's midpoint frame PNG is > 15 KB
 *   frames-centered   every beat's centre 200x200 crop differs from its
 *                     top-left 100x100 crop by > 5 (mean 0-255 luma)
 *   beat-durations    every beat's duration matches its SRT cue ±0.1s
 *                     (the plan carries no timings; render.js times beats
 *                     from the SRT cues, so the cue IS the plan's timing)
 *   library-names     every library_shape name in the plan is in the
 *                     object library registry
 *   beat-sentence-mechanism  every beat has an SRT sentence and a mechanism
 *   typography-count  TYPOGRAPHY beats: 1 or 2
 *   mechanism-share   no effective mechanism over 40% of beats (effective =
 *                     TYPOGRAPHY, or CAPABILITY:<first capability> — the same
 *                     key the planner's mechanismDistribution uses)
 *   av-duration       audio within 1s of video
 *
 * Usage:
 *   node scripts/local-audit.cjs --video <mp4> --manifest <render-manifest.json>
 *     --plan <visual-plan.json> --srt <vo.srt> --audio <vo.mp3> [--out <json>]
 * Exit: 0 PASS, 1 FAIL, 2 could not run (missing input).
 */
"use strict";

const { spawnSync } = require("node:child_process");
const { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, rmSync } = require("node:fs");
const { join, dirname, basename } = require("node:path");
const { pathToFileURL } = require("node:url");
const { tmpdir } = require("node:os");

const ROOT = join(__dirname, "..");
const MIN_FRAME_BYTES = 15 * 1024;
const MIN_CENTER_DIFF = 5;
const DURATION_TOL = 0.1;
const AV_TOL = 1.0;
const MAX_MECH_SHARE = 0.4;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
}

function resolveFfmpeg() {
  const bin = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const local = join(ROOT, "node_modules", "ffmpeg-static", bin);
  return existsSync(local) ? local : bin;
}
const FFMPEG = resolveFfmpeg();

function mediaDuration(file) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-i", file], { encoding: "utf8" });
  const m = String(r.stderr || "").match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null;
}

function extractPng(video, t, out) {
  const r = spawnSync(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-ss", t.toFixed(3), "-i", video, "-frames:v", "1", out]);
  return r.status === 0 && existsSync(out);
}

// Mean luma (0-255) of a crop, read as raw 8-bit gray from ffmpeg.
function cropMean(video, t, w, h, x, y) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-ss", t.toFixed(3), "-i", video,
    "-frames:v", "1", "-vf", `crop=${w}:${h}:${x}:${y},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 24 });
  const buf = r.stdout;
  if (r.status !== 0 || !buf || !buf.length) return null;
  let s = 0;
  for (const v of buf) s += v;
  return s / buf.length;
}

function parseSrt(text) {
  const toSec = (ts) => { const [h, m, rest] = ts.split(":"); return +h * 3600 + +m * 60 + +rest.replace(",", "."); };
  return text.replace(/\r/g, "").split(/\n\s*\n/).map((block) => {
    const lines = block.trim().split("\n");
    const tl = lines.find((l) => l.includes("-->"));
    if (!tl) return null;
    const [a, b] = tl.split("-->").map((s) => toSec(s.trim()));
    return { start: a, end: b, text: lines.slice(lines.indexOf(tl) + 1).join(" ").trim() };
  }).filter(Boolean);
}

async function main() {
  const video = arg("video"), manifestPath = arg("manifest"), planPath = arg("plan");
  const srtPath = arg("srt"), audio = arg("audio"), out = arg("out");
  const missing = [["video", video], ["manifest", manifestPath], ["plan", planPath], ["srt", srtPath], ["audio", audio]]
    .filter(([, p]) => !p || !existsSync(p)).map(([n, p]) => `${n}=${p || "(none)"}`);
  if (missing.length) {
    console.error(`[local-audit] cannot run — missing input: ${missing.join(", ")}`);
    process.exit(2);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  const cues = parseSrt(readFileSync(srtPath, "utf8"));
  const beats = manifest.beats || [];
  const W = manifest.width || 1080, H = manifest.height || 1920;
  const { LIBRARY_NAMES } = await import(pathToFileURL(join(ROOT, "src", "skills", "remotion-render", "visual", "library-names.js")).href);

  const checks = [];
  const add = (id, bad, okDetail) => checks.push({ id, pass: bad.length === 0, detail: bad.length ? bad.join("; ") : okDetail });

  // Frames: one per beat, at its midpoint.
  const work = join(tmpdir(), `local-audit-${process.pid}`);
  mkdirSync(work, { recursive: true });
  const sizeBad = [], centerBad = [];
  beats.forEach((b, i) => {
    const t = (b.start_sec ?? 0) + (b.duration_sec ?? 0) / 2;
    const png = join(work, `beat-${i}.png`);
    if (!extractPng(video, t, png)) { sizeBad.push(`beat ${i}: frame at ${t.toFixed(2)}s could not be extracted`); centerBad.push(`beat ${i}: no frame`); return; }
    const bytes = statSync(png).size;
    if (bytes <= MIN_FRAME_BYTES) sizeBad.push(`beat ${i}: ${(bytes / 1024).toFixed(1)} KB`);
    const center = cropMean(video, t, 200, 200, Math.floor((W - 200) / 2), Math.floor((H - 200) / 2));
    const corner = cropMean(video, t, 100, 100, 0, 0);
    if (center === null || corner === null) centerBad.push(`beat ${i}: crop failed`);
    else if (Math.abs(center - corner) <= MIN_CENTER_DIFF) centerBad.push(`beat ${i}: centre ${center.toFixed(1)} vs corner ${corner.toFixed(1)}`);
  });
  try { rmSync(work, { recursive: true, force: true }); } catch {}
  add("frames-nonempty", sizeBad, `${beats.length}/${beats.length} beat frames > 15 KB`);
  add("frames-centered", centerBad, `${beats.length}/${beats.length} beats have centre content`);

  const durBad = [];
  if (cues.length !== beats.length) durBad.push(`${beats.length} beats vs ${cues.length} SRT cues`);
  beats.forEach((b, i) => {
    const c = cues[i];
    if (!c) return;
    const want = c.end - c.start;
    if (Math.abs((b.duration_sec ?? 0) - want) > DURATION_TOL) durBad.push(`beat ${i}: ${b.duration_sec}s vs cue ${want.toFixed(2)}s`);
  });
  add("beat-durations", durBad, `every beat within ±${DURATION_TOL}s of its cue`);

  const libBad = [];
  (plan.beats || []).forEach((b) => (b.composition?.objects || []).forEach((o, j) => {
    if (o?.kind === "library_shape" && !LIBRARY_NAMES.includes(o.name)) libBad.push(`beat ${b.index} objects[${j}]: "${o.name}"`);
  }));
  add("library-names", libBad, "every library_shape name is registered");

  const smBad = [];
  beats.forEach((b, i) => {
    if (!cues[i] || !cues[i].text) smBad.push(`beat ${i}: no sentence`);
    if (!b.mechanism) smBad.push(`beat ${i}: no mechanism`);
  });
  add("beat-sentence-mechanism", smBad, "every beat has a sentence and a mechanism");

  const planByIndex = new Map((plan.beats || []).map((b) => [b.index, b]));
  const effective = beats.map((b, i) => {
    if (b.mechanism !== "CAPABILITY") return b.mechanism || "NONE";
    const caps = planByIndex.get(b.index ?? i)?.capabilities || [];
    return `CAPABILITY:${caps[0] || "?"}`;
  });
  const typo = effective.filter((m) => m === "TYPOGRAPHY").length;
  add("typography-count", typo >= 1 && typo <= 2 ? [] : [`${typo} TYPOGRAPHY beats`], `${typo} TYPOGRAPHY beat(s)`);

  const counts = {};
  for (const m of effective) counts[m] = (counts[m] || 0) + 1;
  const over = Object.entries(counts).filter(([, n]) => beats.length && n / beats.length > MAX_MECH_SHARE)
    .map(([m, n]) => `${m} ${n}/${beats.length} (${Math.round((100 * n) / beats.length)}%)`);
  add("mechanism-share", over, `max share ${beats.length ? Math.round((100 * Math.max(...Object.values(counts))) / beats.length) : 0}%`);

  const vDur = mediaDuration(video), aDur = mediaDuration(audio);
  add("av-duration", vDur === null || aDur === null ? ["could not read a duration"]
    : Math.abs(vDur - aDur) > AV_TOL ? [`video ${vDur.toFixed(2)}s vs audio ${aDur.toFixed(2)}s`] : [],
    `video ${vDur?.toFixed(2)}s, audio ${aDur?.toFixed(2)}s`);

  const pass = checks.every((c) => c.pass);
  for (const c of checks) console.log(`[local-audit] ${c.pass ? "PASS" : "FAIL"} ${c.id} — ${c.detail}`);
  console.log(`[local-audit] VERDICT: ${pass ? "PASS" : "FAIL"} (${checks.filter((c) => c.pass).length}/${checks.length} checks)`);
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ video: basename(video), pass, checks }, null, 2) + "\n");
  }
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(`[local-audit] cannot run — ${e.stack || e}`); process.exit(2); });
