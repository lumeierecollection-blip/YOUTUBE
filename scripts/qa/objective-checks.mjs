// Objective (ffprobe / ffmpeg only, no model) checks on a rendered MP4. Every function returns defects (scripts/qa/defects.mjs shape).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { makeDefect } from "./defects.mjs";
import { DURATION_RANGE_SECONDS } from "../gate-script.js";

// 1080x1920 is hard-coded in the manifest written by src/skills/remotion-render/render.js (width/height); renderScale may shrink it.
export const EXPECTED_SIZE = { shorts: { width: 1080, height: 1920 }, longform: { width: 1920, height: 1080 } };

const run = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const D = (check, severity, p) => makeDefect({ id: `obj:${check}${p.t_start != null ? `@${p.t_start.toFixed(2)}` : ""}`, check, source: "objective", severity, ...p });

export function probe(video) {
  const r = run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", video]);
  if (r.status !== 0) throw new Error(`ffprobe failed: ${(r.stderr || "").slice(0, 200)}`);
  const j = JSON.parse(r.stdout);
  const v = (j.streams || []).find((s) => s.codec_type === "video") || null;
  const a = (j.streams || []).find((s) => s.codec_type === "audio") || null;
  const num = (x) => (x == null || x === "N/A" ? null : Number(x));
  const [fn, fd] = String(v?.r_frame_rate || "0/1").split("/").map(Number);
  return {
    width: v?.width ?? null, height: v?.height ?? null, fps: fd ? fn / fd : null,
    videoDuration: num(v?.duration) ?? num(j.format?.duration), audioDuration: a ? num(a.duration) ?? num(j.format?.duration) : null,
    duration: num(j.format?.duration), hasVideo: !!v, hasAudio: !!a,
  };
}

export function checkContainer(info, { format = "shorts", expected, durationRange, fps = 30, durationTolerance = 2, avTolerance = 0.3 } = {}) {
  const out = [];
  const want = expected || EXPECTED_SIZE[format] || EXPECTED_SIZE.shorts;
  if (!info.hasVideo) return [D("video-stream", "blocker", { expected: "a video stream", actual: "none", evidence: "ffprobe found no video stream", t_start: 0 })];
  const ar = info.width / info.height, wantAr = want.width / want.height;
  if (Math.abs(ar - wantAr) / wantAr > 0.005) {
    out.push(D("aspect", "blocker", { t_start: 0, t_end: info.duration, expected: `${want.width}x${want.height} (${wantAr.toFixed(3)})`, actual: `${info.width}x${info.height} (${ar.toFixed(3)})`, evidence: "aspect ratio differs from the channel format" }));
  } else if (info.width !== want.width || info.height !== want.height) {
    // Same aspect, different size: a deliberate renderScale is possible (manifest.renderScale), so this is not a blocker.
    out.push(D("resolution", "minor", { t_start: 0, t_end: info.duration, expected: `${want.width}x${want.height}`, actual: `${info.width}x${info.height}`, evidence: "same aspect, scaled resolution (renderScale?)" }));
  }
  const range = durationRange || DURATION_RANGE_SECONDS[format] || DURATION_RANGE_SECONDS.shorts;
  if (info.duration != null && (info.duration < range.min - durationTolerance || info.duration > range.max + durationTolerance)) {
    out.push(D("duration", "major", { t_start: 0, t_end: info.duration, expected: `${range.min}-${range.max}s (+/-${durationTolerance}s)`, actual: `${info.duration.toFixed(2)}s`, evidence: "duration outside the format's range" }));
  }
  if (info.fps != null && Math.abs(info.fps - fps) > 0.01) {
    out.push(D("fps", "major", { t_start: 0, expected: `${fps} fps`, actual: `${info.fps.toFixed(3)} fps`, evidence: "frame rate differs" }));
  }
  if (!info.hasAudio) {
    out.push(D("audio-stream", "blocker", { t_start: 0, t_end: info.duration, expected: "an audio stream", actual: "none", evidence: "ffprobe found no audio stream" }));
  } else if (info.videoDuration != null && info.audioDuration != null && Math.abs(info.videoDuration - info.audioDuration) > avTolerance) {
    out.push(D("av-duration", "major", { t_start: Math.min(info.videoDuration, info.audioDuration), t_end: Math.max(info.videoDuration, info.audioDuration), expected: `|video-audio| <= ${avTolerance}s`, actual: `video ${info.videoDuration.toFixed(2)}s, audio ${info.audioDuration.toFixed(2)}s`, evidence: "stream durations differ" }));
  }
  return out;
}

const filterLog = (video, vf, af) => {
  const args = ["-hide_banner", "-nostats", "-i", video];
  if (vf) args.push("-vf", vf, "-an");
  if (af) args.push("-af", af, "-vn");
  return run("ffmpeg", [...args, "-f", "null", "-"]).stderr || "";
};

export function checkBlackFrames(video, { minDuration = 0.5 } = {}) {
  const log = filterLog(video, `blackdetect=d=${minDuration}:pix_th=0.10`);
  return [...log.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)/g)].map((m) =>
    D("blank-frames", "blocker", { t_start: +m[1], t_end: +m[2], expected: "no black frames", actual: `black for ${(m[2] - m[1]).toFixed(2)}s`, evidence: `blackdetect d=${minDuration}` }));
}

export function checkFrozen(video, { minDuration = 3 } = {}) {
  const log = filterLog(video, `freezedetect=n=-60dB:d=${minDuration}`);
  const starts = [...log.matchAll(/freeze_start: ([\d.]+)/g)].map((m) => +m[1]);
  const ends = [...log.matchAll(/freeze_end: ([\d.]+)/g)].map((m) => +m[1]);
  return starts.map((s, i) => D("frozen-frames", "major", { t_start: s, t_end: ends[i] ?? null, expected: `no frozen run > ${minDuration}s`, actual: ends[i] != null ? `frozen ${(ends[i] - s).toFixed(2)}s` : "frozen to the end", evidence: "freezedetect" }));
}

export function checkAudio(video, { maxSilence = 1.5, silenceDb = -50, peakLimitDb = -0.1 } = {}) {
  const out = [];
  const sl = filterLog(video, null, `silencedetect=noise=${silenceDb}dB:d=${maxSilence}`);
  const starts = [...sl.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
  const ends = [...sl.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  starts.forEach((s, i) => out.push(D("audio-silence", "major", { t_start: s, t_end: ends[i] ?? null, expected: `no silence > ${maxSilence}s`, actual: ends[i] != null ? `silent ${(ends[i] - s).toFixed(2)}s` : "silent to the end", evidence: `silencedetect ${silenceDb}dB` })));
  const eb = filterLog(video, null, "ebur128=peak=true");
  const pk = /True peak:[\s\S]*?Peak:\s+(-?[\d.]+|-inf)\s+dBFS/.exec(eb);
  if (pk && pk[1] !== "-inf" && Number(pk[1]) > peakLimitDb) {
    out.push(D("audio-clipping", "major", { t_start: null, expected: `true peak <= ${peakLimitDb} dBTP`, actual: `${pk[1]} dBTP`, evidence: "ebur128 true peak" }));
  }
  return out;
}

export function parseSrt(text) {
  const toS = (h, m, s, ms) => +h * 3600 + +m * 60 + +s + +ms / 1000;
  return [...String(text).replace(/\r/g, "").matchAll(/(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)[^\n]*\n([\s\S]*?)(?=\n\n|\n*$)/g)]
    .map((m) => ({ start: toS(m[1], m[2], m[3], m[4]), end: toS(m[5], m[6], m[7], m[8]), text: m[9].trim() }));
}

export function checkCaptions(srtText, videoDuration, { maxGap = 2.5 } = {}) {
  const cues = parseSrt(srtText), out = [];
  if (!cues.length) return [D("captions", "major", { t_start: null, expected: "at least one caption cue", actual: "0 cues", evidence: "SRT has no cues" })];
  cues.forEach((c, i) => {
    if (c.end <= c.start) out.push(D("captions-timing", "major", { t_start: c.start, t_end: c.end, expected: "end after start", actual: `${c.start}-${c.end}`, evidence: `cue ${i + 1} "${c.text.slice(0, 40)}"` }));
    if (videoDuration != null && c.start >= videoDuration) out.push(D("captions-past-end", "major", { t_start: c.start, t_end: c.end, expected: `cue before ${videoDuration.toFixed(2)}s`, actual: `starts ${c.start.toFixed(2)}s`, evidence: `cue ${i + 1}` }));
    else if (videoDuration != null && c.end > videoDuration + 0.1) out.push(D("captions-past-end", "minor", { t_start: c.start, t_end: c.end, expected: `cue ends by ${videoDuration.toFixed(2)}s`, actual: `ends ${c.end.toFixed(2)}s`, evidence: `cue ${i + 1}` }));
    const p = cues[i - 1];
    if (p && c.start < p.end - 0.01) out.push(D("captions-overlap", "major", { t_start: c.start, t_end: p.end, expected: "cues do not overlap", actual: `overlap ${(p.end - c.start).toFixed(2)}s`, evidence: `cues ${i} and ${i + 1}` }));
    else if (p && c.start - p.end > maxGap) out.push(D("captions-gap", "minor", { t_start: p.end, t_end: c.start, expected: `gap <= ${maxGap}s`, actual: `${(c.start - p.end).toFixed(2)}s`, evidence: `cues ${i} and ${i + 1}` }));
  });
  return out;
}

// Plans reference assets as paths relative to src/skills/remotion-render/public (local-audit.cjs image-sources): beats[].canvas.{photo,art,art.items[],concept_visuals[]}.asset.
export function checkMissingMedia(manifest, publicDir) {
  const out = [];
  (manifest?.beats || []).forEach((b, i) => {
    const c = b.canvas || {};
    const refs = [c.photo?.asset, c.art?.asset, ...(c.art?.items || []).map((x) => x?.asset), ...(c.concept_visuals || []).map((x) => x?.asset)].filter(Boolean);
    for (const asset of refs) {
      if (existsSync(join(publicDir, asset))) continue;
      out.push(D("missing-media", "blocker", { beat_index: i, t_start: b.start_sec ?? null, t_end: b.start_sec != null ? b.start_sec + (b.duration_sec || 0) : null, expected: `file ${asset}`, actual: "not on disk", evidence: `beat ${i} references ${asset}` }));
    }
  });
  return out;
}

export function runObjectiveChecks(video, opts = {}) {
  const info = probe(video);
  const out = checkContainer(info, opts);
  if (info.hasVideo) out.push(...checkBlackFrames(video, opts.black), ...checkFrozen(video, opts.freeze));
  if (info.hasAudio) out.push(...checkAudio(video, opts.audio));
  if (opts.srtPath && existsSync(opts.srtPath)) out.push(...checkCaptions(readFileSync(opts.srtPath, "utf8"), info.duration, opts.captions));
  if (opts.manifest && opts.publicDir) out.push(...checkMissingMedia(opts.manifest, opts.publicDir));
  return out;
}
