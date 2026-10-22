#!/usr/bin/env node
// Frame + contact-sheet extraction for the visual-director critic loop (CI only).
//
//   node scripts/visual-director/frames.mjs --video <round.mp4> --direction <direction.json> --out <dir> [--cadence 0.5]
//
// For every beat (scene) of the direction: one frame at the start, middle and end of each shot,
// plus one every --cadence seconds across the beat. Each frame is a JPEG labelled (burned in) with
// "b<beat> <shot id> <t>s <kind>". Produces:
//   <out>/frames/<beat>-<n>.jpg     every frame
//   <out>/strips/beat-<n>.jpg       one strip per scene (all of that scene's frames, in time order)
//   <out>/contact-sheet.jpg         one sheet for the round (the start/mid/end frames of every shot)
//   <out>/frames-index.json         { video, duration, frames:[{beat_index, shot_id, t, kind, file}], strips:{n:file}, sheet }
//
// Known limit: shot times are taken from the DIRECTION (beat t_start + cumulative shot duration_s,
// clipped to the beat). If the renderer drifts from the direction's timeline the labels will be off
// by that drift; a render manifest with real shot times (--manifest, { shots:[{id, t_start, t_end}] })
// overrides them when the renderer writes one.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const r3 = (x) => Math.round(x * 1000) / 1000;

/** Shot windows for a beat: [{shot_id, start, end}] laid end to end from t_start, clipped to t_end. */
export function shotWindows(beat, manifestShots = null) {
  const out = [];
  let t = Number(beat.t_start);
  const end = Number(beat.t_end);
  for (const s of beat.shots || []) {
    const m = manifestShots && manifestShots.find((x) => x.id === s.id);
    if (m && Number.isFinite(m.t_start) && Number.isFinite(m.t_end)) { out.push({ shot_id: s.id, start: m.t_start, end: m.t_end }); continue; }
    const a = Math.min(t, end), b = Math.min(t + Number(s.duration_s || 0), end);
    if (b > a) out.push({ shot_id: s.id, start: a, end: b });
    t += Number(s.duration_s || 0);
  }
  // The director's shot durations may not sum to the beat; the remainder belongs to the last shot.
  if (out.length && out[out.length - 1].end < end && !manifestShots) out[out.length - 1].end = end;
  if (!out.length && end > beat.t_start) out.push({ shot_id: `b${beat.beat_index}s?`, start: Number(beat.t_start), end });
  return out;
}

/**
 * Plan every frame time for a direction. Pure; tested.
 * Start/end frames sit `edge` seconds inside the shot so a hard cut never lands on the neighbour.
 */
export function planFrameTimes(direction, { cadence = 0.5, edge = 0.06, duration = Infinity, manifest = null } = {}) {
  const frames = [];
  const shotsManifest = manifest?.shots || null;
  for (const beat of direction.beats || []) {
    const wins = shotWindows(beat, shotsManifest);
    const seen = new Set();
    const add = (t, shot_id, kind) => {
      const tt = r3(Math.max(0, Math.min(t, duration - 0.04)));
      const k = tt.toFixed(2);
      if (seen.has(k)) return;
      seen.add(k);
      frames.push({ beat_index: beat.beat_index, shot_id, t: tt, kind });
    };
    for (const w of wins) {
      const e = Math.min(edge, (w.end - w.start) / 4);
      add(w.start + e, w.shot_id, "start");
      add((w.start + w.end) / 2, w.shot_id, "mid");
      add(w.end - e, w.shot_id, "end");
    }
    if (cadence > 0 && wins.length) {
      for (let t = wins[0].start; t < wins[wins.length - 1].end; t += cadence) {
        const w = wins.find((x) => t >= x.start && t < x.end) || wins[wins.length - 1];
        add(t, w.shot_id, "cadence");
      }
    }
  }
  frames.sort((a, b) => a.beat_index - b.beat_index || a.t - b.t);
  return frames;
}

export function probeDuration(video) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", video], { encoding: "utf8" });
  const d = parseFloat(r.stdout);
  return Number.isFinite(d) ? d : null;
}

const label = (f) => `b${f.beat_index} ${f.shot_id} ${f.t.toFixed(2)}s ${f.kind}`.replace(/[:'\\%]/g, " ");

function ff(args) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${(r.stderr || "").slice(0, 400)}`);
}

/** Tile a list of jpgs (same size) into one image, `cols` across. */
function tile(files, out, cols) {
  const n = files.length;
  const c = Math.min(cols, n), rows = Math.ceil(n / c);
  const inputs = files.flatMap((f) => ["-i", f]);
  // Pad the grid with black so tile= never waits for frames that do not exist.
  const filt = `${files.map((_, i) => `[${i}:v]`).join("")}concat=n=${n}:v=1:a=0,tile=${c}x${rows}:padding=4:color=black`;
  ff([...inputs, "-filter_complex", filt, "-frames:v", "1", "-q:v", "3", out]);
}

export function extractFrames({ video, direction, outDir, cadence = 0.5, width = 216, manifest = null }) {
  const framesDir = join(outDir, "frames"), stripsDir = join(outDir, "strips");
  mkdirSync(framesDir, { recursive: true }); mkdirSync(stripsDir, { recursive: true });
  const duration = probeDuration(video);
  if (!duration) throw new Error(`ffprobe could not read a duration from ${video}`);
  const planned = planFrameTimes(direction, { cadence, duration, manifest });
  const counters = {};
  const frames = [];
  for (const f of planned) {
    counters[f.beat_index] = (counters[f.beat_index] || 0) + 1;
    const file = join(framesDir, `b${String(f.beat_index).padStart(2, "0")}-${String(counters[f.beat_index]).padStart(3, "0")}.jpg`);
    ff(["-ss", String(f.t), "-i", video, "-frames:v", "1",
      "-vf", `scale=${width}:-2,drawtext=text='${label(f)}':x=4:y=4:fontsize=13:fontcolor=white:box=1:boxcolor=black@0.75`, "-q:v", "3", file]);
    frames.push({ ...f, file });
  }
  const strips = {};
  const beats = [...new Set(frames.map((f) => f.beat_index))];
  for (const b of beats) {
    const fs = frames.filter((f) => f.beat_index === b).map((f) => f.file);
    const out = join(stripsDir, `beat-${String(b).padStart(2, "0")}.jpg`);
    tile(fs, out, 8);
    strips[b] = out;
  }
  const keyFrames = frames.filter((f) => f.kind !== "cadence").map((f) => f.file);
  const sheet = join(outDir, "contact-sheet.jpg");
  if (keyFrames.length) tile(keyFrames, sheet, 9);
  const index = { video, duration, cadence, frames, strips, sheet: keyFrames.length ? sheet : null, note: manifest ? "shot times from render manifest" : "shot times from direction timeline" };
  writeFileSync(join(outDir, "frames-index.json"), JSON.stringify(index, null, 2));
  return index;
}

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const video = arg("video"), dir = arg("direction"), out = arg("out");
  if (!video || !dir || !out) { console.error("usage: frames.mjs --video <mp4> --direction <direction.json> --out <dir> [--cadence 0.5] [--manifest <m.json>]"); process.exit(2); }
  const manifestPath = arg("manifest");
  const idx = extractFrames({ video, direction: JSON.parse(readFileSync(dir, "utf8")), outDir: out, cadence: Number(arg("cadence", "0.5")),
    manifest: manifestPath && existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null });
  console.log(`frames: ${idx.frames.length}, strips: ${Object.keys(idx.strips).length}, sheet: ${idx.sheet ? relative(process.cwd(), idx.sheet) : "none"}`);
}
