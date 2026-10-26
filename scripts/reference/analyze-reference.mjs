#!/usr/bin/env node
/**
 * analyze-reference — reference video -> measured facts + contact sheets + (optional) vision creative-direction doc.
 *
 *   node scripts/reference/analyze-reference.mjs <video> [--out dir] [--mode standard|dense] [--dense 12.5-18]
 *        [--no-vision] [--scene-threshold 0.3] [--force]
 *
 * Output (default data/reference/analysis/<basename>/): metadata.json scenes.json samples.json frames/*.jpg contact-*.jpg
 * audio.json direction.json direction.md run-log.json. Idempotent: a stage is skipped when its output exists and the
 * video's size+mtime and the stage's parameters are unchanged (--force reruns). See docs/REFERENCE-ANALYSIS.md.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { probeVideo } from "./probe.mjs";
import { analyzeScenes } from "./scenes.mjs";
import { planSamples, extractPlan, denseWindowsFrom } from "./sample.mjs";
import { makeContactSheets } from "./contact-sheet.mjs";
import { analyzeAudio } from "./audio.mjs";
import { direct, directionToMarkdown } from "./direct.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function parseArgs(argv) {
  const o = { mode: "standard", threshold: 0.3, dense: [], noVision: false, force: false, out: null, video: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") o.out = argv[++i];
    else if (a === "--mode") o.mode = argv[++i];
    else if (a === "--dense") { const [x, y] = String(argv[++i]).split("-").map(Number); if (!(y > x)) throw new Error("--dense wants a-b seconds, e.g. 12.5-18"); o.dense.push([x, y]); }
    else if (a === "--scene-threshold") o.threshold = +argv[++i];
    else if (a === "--no-vision") o.noVision = true;
    else if (a === "--force") o.force = true;
    else if (a.startsWith("--")) throw new Error(`unknown option ${a}`);
    else o.video = a;
  }
  if (!o.video) throw new Error("usage: analyze-reference.mjs <video> [--out dir] [--mode standard|dense] [--dense a-b] [--no-vision] [--scene-threshold 0.3] [--force]");
  if (!["standard", "dense"].includes(o.mode)) throw new Error("--mode must be standard or dense");
  if (o.dense.length) o.mode = "dense";
  return o;
}

export async function analyze(opts) {
  const video = resolve(opts.video);
  const st = statSync(video);
  const out = resolve(opts.out || join(root, "data/reference/analysis", basename(video).replace(/\.[^.]+$/, "")));
  mkdirSync(out, { recursive: true });
  const logFile = join(out, "run-log.json");
  const prev = !opts.force && existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : { stages: {} };
  const log = { video, size_bytes: st.size, mtime_ms: st.mtimeMs, options: { mode: opts.mode, dense: opts.dense, scene_threshold: opts.threshold, no_vision: opts.noVision }, stages: {}, errors: [] };
  const base = { size: st.size, mtime: st.mtimeMs };
  const p = (f) => join(out, f);
  const readJ = (f) => JSON.parse(readFileSync(p(f), "utf8"));
  const writeJ = (f, v) => writeFileSync(p(f), JSON.stringify(v, null, 2) + "\n");

  // run one stage: skip when outputs exist and the key matches the previous run's
  const stage = async (name, key, files, fn) => {
    const k = JSON.stringify(key);
    const t0 = Date.now();
    if (!opts.force && prev.stages[name]?.key === k && files.every((f) => existsSync(p(f)))) { log.stages[name] = { key: k, skipped: true, ms: 0 }; return; }
    try { await fn(); log.stages[name] = { key: k, skipped: false, ms: Date.now() - t0 }; }
    catch (e) { log.stages[name] = { key: "", skipped: false, ms: Date.now() - t0, error: e.message }; log.errors.push(`${name}: ${e.message}`); writeJ("run-log.json", log); throw e; }
  };

  await stage("metadata", { ...base }, ["metadata.json"], async () => writeJ("metadata.json", probeVideo(video)));
  const meta = readJ("metadata.json");

  await stage("scenes", { ...base, th: opts.threshold }, ["scenes.json"], async () => writeJ("scenes.json", analyzeScenes(video, { threshold: opts.threshold, duration: meta.duration_s })));
  const scenes = readJ("scenes.json");

  const dw = opts.mode === "dense" ? [...denseWindowsFrom(scenes.novelty_events), ...opts.dense] : [];
  await stage("samples", { ...base, th: opts.threshold, mode: opts.mode, dw }, ["samples.json"], async () => {
    rmSync(p("frames"), { recursive: true, force: true });
    const plan = planSamples({ duration: meta.duration_s, cuts: scenes.cuts, mode: opts.mode, denseWindows: dw });
    const r = await extractPlan(video, plan, p("frames"));
    writeJ("samples.json", { mode: opts.mode, dense_windows: dw, planned: r.planned, kept: r.frames.length, dropped_duplicates: r.dropped, frames: r.frames.map((f) => ({ ...f, file: relative(out, f.file).replace(/\\/g, "/") })) });
  });
  const samples = readJ("samples.json");
  const frames = samples.frames.map((f) => ({ ...f, file: join(out, f.file) }));

  const sheetKey = { ...base, mode: opts.mode, n: frames.length, first: frames[0]?.id, dw };
  await stage("contact", sheetKey, ["contact-01.jpg", "contact-sheets.json"], async () => {
    for (let i = 1; i < 100; i++) rmSync(p(`contact-${String(i).padStart(2, "0")}.jpg`), { force: true });
    const sheets = makeContactSheets(frames, out, meta.orientation);
    writeJ("contact-sheets.json", sheets.map((s) => ({ ...s, file: basename(s.file) })));
  });
  const sheets = readJ("contact-sheets.json").map((s) => ({ ...s, file: p(s.file) }));

  await stage("audio", { ...base }, ["audio.json"], async () => writeJ("audio.json", analyzeAudio(video, meta)));
  const audio = readJ("audio.json");

  await stage("direction", { ...sheetKey, th: opts.threshold, nv: opts.noVision }, ["direction.json", "direction.md"], async () => {
    const r = await direct({ file: basename(video), size_bytes: st.size, metadata: meta, scenes, audio, frames, sheets, noVision: opts.noVision });
    writeJ("direction.json", r.doc);
    writeFileSync(p("direction.md"), directionToMarkdown(r.doc));
    log.vision = r.log;
  });
  if (log.vision === undefined && prev.vision !== undefined) log.vision = prev.vision;
  const dir = readJ("direction.json");
  log.direction_status = dir.direction.status;
  log.model = dir.direction.model;
  log.frames_sent_to_vision = dir.frames_sent.length;
  writeJ("run-log.json", log);
  return { out, direction: dir, log };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { out, log } = await analyze(parseArgs(process.argv.slice(2)));
    console.log(`analysis in ${out}: ${log.direction_status}; stages ${Object.entries(log.stages).map(([k, v]) => `${k}${v.skipped ? "(cached)" : `(${v.ms}ms)`}`).join(" ")}`);
  } catch (e) { console.error(e.message); process.exit(1); }
}
