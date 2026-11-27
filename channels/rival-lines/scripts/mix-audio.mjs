// Builds the episode's final audio: narration + ducked music beds + CC0 sound effects, from out/soundtrack.json (pick-audio.mjs).
// usage: node mix-audio.mjs <episode_dir>   -> <episode_dir>/out/mix.mp3 and out/mix-report.json
// Needs ffmpeg and network (the beds are downloaded from their licensed source, cached under the OS temp dir, never committed).
// Chain follows platform/longform/v2/audio/mix-demo.sh: voice two-pass loudnorm to -16 LUFS, beds attenuated then sidechain-ducked
// by the voice, effects placed by delay, final two-pass loudnorm to -14 LUFS / -1.5 dBTP plus a limiter. Not auditioned by ear.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { SFX_SOURCES, CC0_DIR } from "../../../scripts/sfx-cc0.mjs";

const ep = path.resolve(process.argv[2] || "");
const audioDir = path.resolve(import.meta.dirname, "..", "audio");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const rules = readJson(path.join(audioDir, "selection-rules.json"));
const plan = readJson(path.join(ep, "out", "soundtrack.json"));
const narration = path.join(ep, "audio", "narration.mp3");
const work = path.join(ep, "out", "_mix"); fs.mkdirSync(work, { recursive: true });
const cache = path.join(os.tmpdir(), "rival-lines-beds"); fs.mkdirSync(cache, { recursive: true });
const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"] });

async function download(url, to) {
  if (fs.existsSync(to) && fs.statSync(to).size > 50000) return;
  const res = await fetch(url, { signal: AbortSignal.timeout(120000), redirect: "follow" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  fs.writeFileSync(to, Buffer.from(await res.arrayBuffer()));
}
function loud(file, target) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", `loudnorm=I=${target.i}:TP=${target.tp}:LRA=${target.lra}:print_format=json`, "-f", "null", "-"], { encoding: "utf8" });
  const m = (r.stderr || "").match(/\{[\s\S]*?"target_offset"[\s\S]*?\}/);
  if (!m) throw new Error(`loudnorm gave no measurement for ${file}`);
  return JSON.parse(m[0]);
}
const norm = (s, t) => `loudnorm=I=${t.i}:TP=${t.tp}:LRA=${t.lra}:measured_I=${s.input_i}:measured_TP=${s.input_tp}:measured_LRA=${s.input_lra}:measured_thresh=${s.input_thresh}:offset=${s.target_offset}:linear=true`;
function maxVolume(file) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
  const m = (r.stderr || "").match(/max_volume:\s*(-?[\d.]+) dB/);
  return m ? parseFloat(m[1]) : 0;
}

// 1 voice stem
const voiceT = { i: rules.voice_lufs, tp: -2, lra: 7 };
const vo = path.join(work, "vo.wav");
ff(["-i", narration, "-af", `${norm(loud(narration, voiceT), voiceT)},apad=whole_dur=${plan.duration_s}`, "-ar", "48000", "-ac", "2", vo]);

// 2 inputs: beds, then effects
const inputs = [vo]; const chains = []; const mixLabels = ["vo", "duck"]; const xf = rules.bed_crossfade_s;
const bedLabels = [];
for (let k = 0; k < plan.beds.length; k++) {
  const b = plan.beds[k];
  const f = path.join(cache, `${b.track_id}.mp3`);
  await download(b.download_url, f);
  const gain = rules.bed_lufs_under_voice - b.measured.mean_db;
  const len = b.t1 - b.t0 + xf, at = Math.max(0, b.t0 - xf / 2);
  const idx = inputs.push(f) - 1;
  const loop = b.loops ? "aloop=loop=-1:size=2000000000," : "";
  chains.push(`[${idx}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=start=${b.start_in_track_s},asetpts=PTS-STARTPTS,${loop}atrim=0:${len.toFixed(2)},volume=${gain.toFixed(1)}dB,afade=t=in:d=${xf},afade=t=out:st=${(len - xf).toFixed(2)}:d=${xf},adelay=${Math.round(at * 1000)}|${Math.round(at * 1000)}[bed${k}]`);
  bedLabels.push(`[bed${k}]`);
}
chains.push(`${bedLabels.join("")}amix=inputs=${bedLabels.length}:normalize=0:duration=longest[beds]`);
chains.push(`[0:a]asplit=2[vo][key]`);
chains.push(`[beds][key]sidechaincompress=threshold=0.05:ratio=2.5:attack=30:release=500[duck]`);
const sfxLabels = [];
const fetched = {};
for (let k = 0; k < plan.sfx.length; k++) {
  const e = plan.sfx[k];
  if (!fetched[e.file]) {
    const src = SFX_SOURCES.find((s) => s.file === e.file);
    if (!src) throw new Error(`sfx ${e.file} is not in the CC0 palette (scripts/sfx-cc0.mjs)`);
    fs.mkdirSync(CC0_DIR, { recursive: true });
    const p = path.join(CC0_DIR, e.file); await download(src.url, p);
    fetched[e.file] = { path: p, max: maxVolume(p) };
  }
  const idx = inputs.push(fetched[e.file].path) - 1;
  const ms = Math.round(e.t * 1000), g = e.peak_db - fetched[e.file].max;
  chains.push(`[${idx}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${g.toFixed(1)}dB,adelay=${ms}|${ms}[sx${k}]`);
  sfxLabels.push(`[sx${k}]`);
}
const labels = `[vo][duck]${sfxLabels.join("")}`;
chains.push(`${labels}amix=inputs=${2 + sfxLabels.length}:normalize=0:duration=first[mx]`);
const pre = path.join(work, "premaster.wav");
ff([...inputs.flatMap((f) => ["-i", f]), "-filter_complex", chains.join(";"), "-map", "[mx]", "-ar", "48000", pre]);

// 3 final stage
const fin = rules.final;
const s = loud(pre, fin);
const mix = path.join(ep, "out", "mix.mp3");
ff(["-i", pre, "-af", `${norm(s, fin)},alimiter=limit=0.89:level=false`, "-ar", "48000", "-b:a", "192k", mix]);
const after = loud(mix, fin);
const voiceOnly = loud(vo, { i: -16, tp: -2, lra: 7 });
const report = {
  episode: plan.episode, beds: plan.beds.map((b) => ({ act: b.act, title: b.title, creator: b.creator, licence: b.licence, t0: b.t0, t1: b.t1, looped: b.loops })), sfx_count: plan.sfx.length,
  loudness: { voice_stem_lufs: +voiceOnly.input_i, premaster_lufs: +s.input_i, premaster_tp: +s.input_tp, final_lufs: +after.input_i, final_tp: +after.input_tp, final_lra: +after.input_lra },
  not_auditioned_by_ear: true,
};
fs.writeFileSync(path.join(ep, "out", "mix-report.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report.loudness));
