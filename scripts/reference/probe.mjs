/**
 * probe — ffprobe metadata of a reference video. parseProbe(json) is pure; probeVideo(path) runs ffprobe.
 */
import { spawnSync } from "node:child_process";

const rate = (s) => { if (!s) return null; const [a, b = "1"] = String(s).split("/"); const v = +a / +b; return Number.isFinite(v) && v > 0 ? +v.toFixed(3) : null; };

export function parseProbe(j) {
  const streams = j.streams || [];
  const v = streams.find((s) => s.codec_type === "video");
  const a = streams.find((s) => s.codec_type === "audio");
  if (!v) throw new Error("no video stream");
  const width = +v.width, height = +v.height;
  const duration = +(j.format?.duration ?? v.duration);
  return {
    duration_s: +duration.toFixed(3),
    fps: rate(v.avg_frame_rate) ?? rate(v.r_frame_rate),
    width, height,
    aspect: +(width / height).toFixed(4),
    orientation: height > width ? "vertical" : width > height ? "landscape" : "square",
    codec: v.codec_name,
    has_audio: !!a,
    audio_sample_rate: a ? +a.sample_rate : null,
    audio_channels: a ? +a.channels : null,
    audio_codec: a ? a.codec_name : null,
  };
}

export function probeVideo(path) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", path], { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`ffprobe failed for ${path}: ${r.stderr}`);
  return parseProbe(JSON.parse(r.stdout));
}
