// Loudness-normalises the raw render to -14 LUFS (two-pass loudnorm plus limiter) and writes the final mp4.
// usage: node finish.mjs <episode_dir> <name>   (reads out/video-raw.mp4, writes out/<name>.mp4)
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const out = path.join(path.resolve(process.argv[2]), "out");
const name = process.argv[3] || "episode";
const src = path.join(out, "video-raw.mp4");
const dst = path.join(out, `${name}.mp4`);
const r1 = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", src, "-vn", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
const m = (r1.stderr || "").match(/\{[\s\S]*?"target_offset"[\s\S]*?\}/);
if (!m) throw new Error("loudnorm pass 1 gave no measurement");
const s = JSON.parse(m[0]);
const af = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${s.input_i}:measured_TP=${s.input_tp}:measured_LRA=${s.input_lra}:measured_thresh=${s.input_thresh}:offset=${s.target_offset}:linear=true,alimiter=limit=0.84:attack=3:release=40:level=false`;
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", src, "-c:v", "copy", "-af", af, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", dst], { stdio: "inherit" });
const r2 = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", dst, "-vn", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
const m2 = (r2.stderr || "").match(/\{[\s\S]*?"target_offset"[\s\S]*?\}/);
console.log(`loudness before ${s.input_i} LUFS, after ${m2 ? JSON.parse(m2[0]).input_i : "unmeasured"} LUFS`);
console.log(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,width,height,r_frame_rate,duration", "-of", "default=nw=1", dst], { encoding: "utf8" }));
