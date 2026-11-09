// QA for the Red Space Facts preview. Writes qa-report.json and scene-*.jpg into the run.
// Checks the MP4 itself (duration, size, fps, audio), that the 3D is animated (frame differences
// inside a scene), that frames are not blank, and that every claim record is consistent.
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const sharp = createRequire(import.meta.url)("sharp");
const STATUSES = ["observation", "scientific_model", "hypothetical", "artistic_interpretation"];

const probe = (file) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]).toString());
const grab = (video, at, out) => execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", at.toFixed(3), "-i", video, "-frames:v", "1", out]);

async function stats(file) {
  const { data, info } = await sharp(file).resize(108, 192).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0; for (const v of data) sum += v;
  const mean = sum / data.length;
  let varSum = 0; for (const v of data) varSum += (v - mean) ** 2;
  return { data, mean, std: Math.sqrt(varSum / data.length), n: info.width * info.height * info.channels };
}
const diff = (a, b) => { let d = 0; for (let i = 0; i < a.data.length; i++) d += Math.abs(a.data[i] - b.data[i]); return d / a.data.length; };

export async function runQa({ tools, video, timing, sample, rate, maxRate, maxSeconds, expectedFrames }) {
  const failures = [], notes = [];
  const info = probe(video);
  const v = info.streams.find((s) => s.codec_type === "video"), a = info.streams.find((s) => s.codec_type === "audio");
  const duration = Number(info.format.duration);
  const fps = v.avg_frame_rate.split("/").reduce((x, y) => x / y);
  if (!(duration <= maxSeconds)) failures.push(`duration ${duration.toFixed(2)}s exceeds ${maxSeconds}s`);
  if (v.width !== 1080 || v.height !== 1920) failures.push(`size ${v.width}x${v.height}, expected 1080x1920`);
  if (Math.abs(fps - 30) > 0.01) failures.push(`fps ${fps}, expected 30`);
  if (!a) failures.push("no audio stream in the MP4");
  if (rate > maxRate) failures.push(`voice rate +${rate}% exceeds +${maxRate}%`);
  const vol = execFileSync("ffmpeg", ["-i", video, "-af", "volumedetect", "-vn", "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const mean = Number(((vol.match(/mean_volume: (-?[0-9.]+)/) || [])[1]));
  if (!(mean > -40)) failures.push(`voice is not audible in the MP4 (mean ${mean} dB; silence is about -91 dB)`);

  const scenes = [];
  for (const [i, t] of timing.entries()) {
    const span = t.end_s - t.start_s;
    const f1 = join(tools.outDir, `.qa-a-${i}.png`), f2 = join(tools.outDir, `.qa-b-${i}.png`);
    const at1 = t.start_s + span * 0.5, at2 = t.start_s + span * 0.5 + 0.4;
    grab(video, at1, f1); grab(video, Math.min(at2, duration - 0.05), f2);
    const s1 = await stats(f1), s2 = await stats(f2);
    const motion = diff(s1, s2);
    const jpg = join(tools.outDir, `scene-${t.id}.jpg`);
    grab(video, t.start_s + span * 0.72, join(tools.outDir, `.qa-j-${i}.png`));
    await sharp(join(tools.outDir, `.qa-j-${i}.png`)).jpeg({ quality: 88 }).toFile(jpg);
    for (const f of [f1, f2, join(tools.outDir, `.qa-j-${i}.png`)]) rmSync(f, { force: true });
    const blank = s1.std < 6;
    if (blank) failures.push(`${t.id}: frame is blank (std ${s1.std.toFixed(1)})`);
    // 0.4 s apart: a still would give ~0. Captions alone move little, so the threshold is low but non-zero.
    if (motion < 0.25) failures.push(`${t.id}: looks static (mean abs diff ${motion.toFixed(2)} over 0.4 s)`);
    scenes.push({ id: t.id, start_s: +t.start_s.toFixed(2), end_s: +t.end_s.toFixed(2), voice_s: +t.voice_s.toFixed(2), frame_mean: +s1.mean.toFixed(1), frame_std: +s1.std.toFixed(1), motion_diff_0p4s: +motion.toFixed(2), jpg: `scene-${t.id}.jpg` });
  }

  // Claim records: every claim has an allowed status, a source URL that is in sources, and every scene claim exists.
  const srcUrls = new Set(sample.sources.map((s) => s.url)), ids = new Set(sample.claims.map((c) => c.claim_id));
  for (const c of sample.claims) {
    if (!STATUSES.includes(c.editorial_status)) failures.push(`${c.claim_id}: status "${c.editorial_status}" not one of ${STATUSES.join(", ")}`);
    if (!srcUrls.has(c.source_url)) failures.push(`${c.claim_id}: source_url not in sources`);
    if (!c.excerpt) failures.push(`${c.claim_id}: no excerpt`);
  }
  for (const s of sample.scenes) for (const id of s.claim_ids) if (!ids.has(id)) failures.push(`${s.scene_id}: unknown claim ${id}`);
  if (sample.narration_provisional !== true) failures.push("narration not marked provisional");
  const hyp = sample.claims.filter((c) => c.editorial_status === "hypothetical").map((c) => c.claim_id);
  notes.push(`hypothetical claims: ${hyp.join(", ")} (shown only in s5/s6 under HYPOTHETICAL labels)`);
  notes.push("Narration is provisional (hand-planned, not from the script engine). Voice is generated speech, not a human recording.");
  notes.push("Checks here are mechanical. A person must still look at the frames: label overlaps, orbit proportions and texture look are not machine-verified.");

  const report = {
    passed: failures.length === 0, failures, notes,
    duration_s: +duration.toFixed(3), width: v.width, height: v.height, fps, frames_expected: expectedFrames, has_audio: !!a,
    voice: { engine: "Gemini TTS, natural pace", playback_speed: 1, mean_volume_db: mean, provisional_narration: true },
    sources_fetched: sample.sources.map((s) => s.url),
    claims: sample.claims.map((c) => ({ claim_id: c.claim_id, editorial_status: c.editorial_status, source_url: c.source_url })),
    scenes,
  };
  tools.write("qa-report.json", report);
  return report;
}
