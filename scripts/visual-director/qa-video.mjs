#!/usr/bin/env node
// Deterministic visual QA for a visual-director render (CI only).
//
// The critic (scripts/visual-director/critic.mjs) answers the semantic
// questions; this module answers the questions a model should not be trusted
// with alone: is there a picture at all, is any beat missing, is the video a
// slideshow, is it silent, is a material still a placeholder? It reads the
// MP4 itself (ffprobe/ffmpeg), the frame index the critic saw, the renderer's
// shot/sfx sidecars and the materials report, and writes one JSON report.
//
//   node scripts/visual-director/qa-video.mjs --video <mp4> --direction <d.json> \
//     --frames <frames-index.json> --shots <mp4.shots.json> --sfx <mp4.sfx.json> \
//     --materials <materials-report.json> --out <qa-deterministic.json>
//
// Exit 0 = every deterministic check passed; 1 = at least one failed; 2 = bad input.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const round = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;

/** Parse ffmpeg's blackdetect log lines. */
export function parseBlackdetect(text) {
  const out = [];
  for (const m of String(text || "").matchAll(/black_start:\s*([\d.]+)\s+black_end:\s*([\d.]+)\s+black_duration:\s*([\d.]+)/g)) {
    out.push({ start: +m[1], end: +m[2], duration: +m[3] });
  }
  return out;
}

/** Parse ffmpeg's freezedetect log lines. A freeze that runs to EOF only logs freeze_start, so the video duration closes it. */
export function parseFreezedetect(text, duration = null) {
  const out = [];
  const lines = String(text || "").split(/\r?\n/);
  let cur = null;
  for (const line of lines) {
    const s = /freeze_start:\s*([\d.]+)/.exec(line);
    if (s) { cur = { start: +s[1], end: null, duration: null }; continue; }
    const e = /freeze_end:\s*([\d.]+)/.exec(line);
    if (e && cur) { cur.end = +e[1]; cur.duration = round(cur.end - cur.start, 3); out.push(cur); cur = null; continue; }
    const d = /freeze_duration:\s*([\d.]+)/.exec(line);
    if (d && cur) { cur.duration = +d[1]; }
  }
  if (cur && cur.end == null) {
    // Still frozen when the file ended: ffmpeg never prints freeze_end.
    const end = duration != null && duration > cur.start ? duration : cur.start + (cur.duration || 0);
    cur.end = end;
    cur.duration = round(end - cur.start, 3);
    out.push(cur);
  }
  return out;
}

/** Parse ffmpeg's volumedetect summary. */
export function parseVolumedetect(text) {
  const t = String(text || "");
  const mean = /mean_volume:\s*(-?[\d.]+) dB/.exec(t);
  const max = /max_volume:\s*(-?[\d.]+) dB/.exec(t);
  return { mean_db: mean ? +mean[1] : null, max_db: max ? +max[1] : null };
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  return { ok: r.status === 0, status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

export function probeVideo(video) {
  const r = run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-show_entries",
    "stream=index,codec_type,codec_name,width,height,r_frame_rate", "-of", "json", video]);
  if (!r.ok) return { ok: false, error: (r.stderr || "ffprobe failed").slice(0, 500) };
  const j = JSON.parse(r.stdout || "{}");
  const v = (j.streams || []).find((s) => s.codec_type === "video");
  const a = (j.streams || []).find((s) => s.codec_type === "audio");
  const [num, den] = String(v?.r_frame_rate || "0/1").split("/").map(Number);
  return {
    ok: true,
    duration: Number(j.format?.duration) || null,
    width: v?.width ?? null, height: v?.height ?? null,
    fps: den ? round(num / den, 3) : null,
    video_codec: v?.codec_name ?? null,
    audio_codec: a?.codec_name ?? null,
  };
}

export function scanBlack(video) {
  const r = run("ffmpeg", ["-nostdin", "-v", "info", "-i", video, "-vf", "blackdetect=d=0.5:pix_th=0.10", "-an", "-f", "null", "-"]);
  return parseBlackdetect(r.stderr);
}

export function scanFreeze(video, duration = null) {
  const r = run("ffmpeg", ["-nostdin", "-v", "info", "-i", video, "-vf", "freezedetect=n=0.003:d=3", "-an", "-f", "null", "-"]);
  return parseFreezedetect(r.stderr, duration);
}

export function scanVolume(video) {
  const r = run("ffmpeg", ["-nostdin", "-v", "info", "-i", video, "-af", "volumedetect", "-vn", "-f", "null", "-"]);
  return parseVolumedetect(r.stderr);
}

/** The final direction's beat count and last t_end. */
export function timelineFacts(direction) {
  const beats = direction?.beats || [];
  return { beats: beats.length, last_end: beats.reduce((m, b) => Math.max(m, Number(b.t_end) || 0), 0) };
}

/**
 * Pure evaluation of every deterministic check. Inputs are already-parsed
 * documents; the caller does the ffmpeg work. Returns { pass, checks }.
 */
export function evaluateVisualQa({ video, direction, framesIndex, shotsDoc, sfxDoc, materialsReport, probe, black, freeze, volume, expected }) {
  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: !!pass, detail: String(detail ?? "") });
  const beats = direction?.beats || [];
  const beatIdx = beats.map((b) => b.beat_index);
  const tl = timelineFacts(direction);

  add("video.exists", video?.exists, video?.exists ? `${video.path} (${video.bytes} bytes)` : "no MP4");
  add("video.probe", probe?.ok, probe?.ok ? `${probe.width}x${probe.height} @ ${probe.fps} fps, ${probe.duration}s, ${probe.video_codec}/${probe.audio_codec || "no audio"}` : probe?.error);
  const portrait = probe?.ok && probe.width > 0 && probe.height > 0 && probe.height > probe.width && Math.abs(probe.width / probe.height - 9 / 16) < 0.03;
  add("video.portrait_1080x1920", portrait && probe.width >= 720 && probe.height >= 1280, probe?.ok ? `${probe.width}x${probe.height}` : "no probe");
  const want = expected ?? (tl.last_end ? tl.last_end + 0.4 : null);
  const durOk = probe?.ok && Number.isFinite(probe.duration) && probe.duration >= 3 && (want == null || Math.abs(probe.duration - want) <= Math.max(2, want * 0.08));
  add("video.duration_matches_timeline", durOk, probe?.ok ? `video ${round(probe.duration)}s, timeline ${round(want)}s` : "no probe");
  add("video.has_audio", !!probe?.audio_codec, probe?.audio_codec || "no audio stream");
  add("video.not_silent", volume?.mean_db != null && volume.mean_db > -45, volume?.mean_db != null ? `mean ${volume.mean_db} dB, max ${volume.max_db} dB` : "volumedetect gave no mean");
  const badBlack = (black || []).filter((b) => b.duration >= 1.0);
  add("video.no_empty_black", badBlack.length === 0, badBlack.length ? badBlack.map((b) => `${b.start}-${b.end}s`).join(", ") : "no black segment >= 1.0s");
  const badFreeze = (freeze || []).filter((f) => (f.duration ?? (f.end - f.start)) >= 3.0);
  add("video.not_a_slideshow", badFreeze.length === 0, badFreeze.length ? badFreeze.map((f) => `${round(f.start)}-${round(f.end)}s`).join(", ") : "no freeze >= 3.0s");

  add("frames.contact_sheet", !!framesIndex?.sheet && existsSync(framesIndex.sheet), framesIndex?.sheet || "no contact sheet");
  const perBeat = new Map();
  for (const f of framesIndex?.frames || []) perBeat.set(f.beat_index, (perBeat.get(f.beat_index) || 0) + 1);
  const missingFrames = beatIdx.filter((i) => (perBeat.get(i) || 0) < 3);
  add("frames.every_beat_inspected", missingFrames.length === 0, missingFrames.length ? `beats with <3 frames: ${missingFrames.join(", ")}` : `${framesIndex?.frames?.length || 0} frames across ${beatIdx.length} beats`);

  const shots = shotsDoc?.shots || [];
  const shotsByBeat = new Map();
  for (const s of shots) shotsByBeat.set(s.beat, (shotsByBeat.get(s.beat) || 0) + 1);
  const noShots = beatIdx.filter((i) => !shotsByBeat.get(i));
  add("timeline.every_beat_has_a_shot", noShots.length === 0, noShots.length ? `beats without a shot: ${noShots.join(", ")}` : `${shots.length} shots`);
  const families = [...new Set(shots.map((s) => s.family).filter(Boolean))];
  const moves = [...new Set(shots.map((s) => s.move).filter(Boolean))];
  const moving = shots.filter((s) => s.move && s.move !== "hold").length;
  const familiesWanted = Math.min(2, beats.length);
  add("timeline.not_one_template", families.length >= familiesWanted && moves.length >= Math.min(2, shots.length),
    `${families.length} families (${families.join(", ")}), ${moves.length} camera moves (${moves.join(", ")})`);
  add("timeline.motion_is_executed", moving >= Math.ceil(beats.length / 2) && moving > 0,
    `${moving}/${shots.length} shots move the camera; ${shots.filter((s) => (s.transition_out || "cut") !== "cut").length} non-cut transitions`);
  const mappedSfx = (sfxDoc?.cues || []).filter((c) => c.mapped && c.file).length;
  add("timeline.effects_executed", moving > 0 || mappedSfx > 0 || shots.some((s) => (s.transition_out || "cut") !== "cut"),
    `${moving} camera moves, ${mappedSfx} mapped SFX cues, ${(sfxDoc?.cues || []).length} total cues`);

  const mat = materialsReport?.summary || null;
  const mats = (materialsReport?.beats || []).flatMap((b) => b.materials || []);
  const unverified = mats.filter((m) => m.status !== "verified");
  add("materials.coverage", !!mat && mat.missing === 0 && mat.unverified === 0 && mat.verified === mat.materials,
    mat ? `${mat.verified}/${mat.materials} verified, ${mat.missing} missing, ${mat.unverified} unverified` : "no materials report");
  add("materials.all_verified", unverified.length === 0, unverified.length ? `${unverified.length} not verified: ${unverified.slice(0, 5).map((m) => m.material_id || m.id).join(", ")}` : "every material verified");

  add("render.production_mode", shotsDoc?.proof === false, shotsDoc?.proof === false ? "proof=false" : `proof=${shotsDoc?.proof}`);
  add("render.no_placeholders", (shotsDoc?.refused || []).length === 0, (shotsDoc?.refused || []).length ? `${shotsDoc.refused.length} refused material(s)` : "no refused materials");

  return { pass: checks.every((c) => c.pass), checks };
}

export function qaVideo({ video, direction, framesIndex, shotsDoc, sfxDoc, materialsReport, expected }) {
  const v = {
    path: video, exists: existsSync(video),
    bytes: existsSync(video) ? statSync(video).size : 0,
  };
  if (!v.exists) return { pass: false, checks: [{ id: "video.exists", pass: false, detail: "no MP4" }], video: v };
  const probe = probeVideo(video);
  const black = scanBlack(video);
  const freeze = scanFreeze(video, probe?.duration ?? null);
  const volume = scanVolume(video);
  const report = evaluateVisualQa({ video: v, direction, framesIndex, shotsDoc, sfxDoc, materialsReport, probe, black, freeze, volume, expected });
  return { ...report, video: v, probe, black, freeze, volume };
}

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const video = arg("video"), direction = arg("direction"), frames = arg("frames"), shots = arg("shots"), sfx = arg("sfx"), materials = arg("materials"), out = arg("out");
  if (!video || !direction || !out) { console.error("usage: qa-video.mjs --video <mp4> --direction <d.json> --frames <frames-index.json> --shots <shots.json> --sfx <sfx.json> --materials <report.json> --out <qa.json>"); process.exit(2); }
  const rep = qaVideo({
    video,
    direction: readJson(direction),
    framesIndex: frames && existsSync(frames) ? readJson(frames) : null,
    shotsDoc: shots && existsSync(shots) ? readJson(shots) : null,
    sfxDoc: sfx && existsSync(sfx) ? readJson(sfx) : null,
    materialsReport: materials && existsSync(materials) ? readJson(materials) : null,
    expected: arg("expected") ? Number(arg("expected")) : null,
  });
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(out, JSON.stringify(rep, null, 2) + "\n");
  for (const c of rep.checks) console.log(`${c.pass ? "PASS" : "FAIL"} ${c.id}: ${c.detail}`);
  process.exit(rep.pass ? 0 : 1);
}
