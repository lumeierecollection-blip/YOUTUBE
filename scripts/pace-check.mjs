#!/usr/bin/env node
/**
 * pace-check — is the screen ever static inside a beat? (owner, 2026-10-09: "something happening about every half
 * second ... a beat with no movement for more than 1.0 second is a failed beat.")
 *
 * The video is sampled every 0.25 s (4 fps, 135x240 grey, the caption band cut off — the word caption always moves and
 * would hide a static picture). For each beat the mean absolute pixel change between consecutive samples is measured; an
 * interval whose change is under STATIC (the video codec's own noise floor) is STATIC, and a run of static intervals is
 * a static stretch. A beat fails when its longest stretch is over MAX_STATIC_S (1.0 s). The first interval of a beat
 * (the pop-in across the boundary) is not counted.
 *
 *   node scripts/pace-check.mjs --video v.mp4 --manifest m.json [--json out.json]
 * Exported: paceOf(video, manifest) -> { beats: [{ index, longest_s, status }], longest_s, avg_beat_s, fail: [...] }
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SAMPLE_S = 0.25, MAX_STATIC_S = 1.0, STATIC = 0.45, W = 135, H = 240, CAPTION_ROW = Math.floor((1450 / 1920) * H);

function frames(video) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", video, "-vf", `fps=${1 / SAMPLE_S},scale=${W}:${H},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 28 });
  if (r.status !== 0 || !r.stdout.length) throw new Error(`could not decode ${video}: ${String(r.stderr).slice(0, 160)}`);
  const n = Math.floor(r.stdout.length / (W * H));
  return Array.from({ length: n }, (_, i) => r.stdout.subarray(i * W * H, (i + 1) * W * H));
}
const diff = (a, b) => { let s = 0; const end = CAPTION_ROW * W; for (let i = 0; i < end; i++) s += Math.abs(a[i] - b[i]); return s / end; };

export function paceOf(video, manifest) {
  const fr = frames(video);
  const beats = manifest.beats || [];
  const out = beats.map((b, k) => {
    const t0 = b.start_sec ?? 0, t1 = t0 + (b.duration_sec ?? 0);
    const i0 = Math.ceil(t0 / SAMPLE_S) + 1, i1 = Math.min(fr.length - 1, Math.floor((t1 - 0.2) / SAMPLE_S));   // skip the boundary's pop; stay clear of the next beat's
    let run = 0, longest = 0;
    const ds = [];
    for (let i = i0; i <= i1; i++) { const d = diff(fr[i - 1], fr[i]); ds.push(d); run = d < STATIC ? run + 1 : 0; longest = Math.max(longest, run); }
    const longest_s = longest * SAMPLE_S;
    return { index: b.index ?? k, duration_s: +(b.duration_sec ?? 0).toFixed(2), longest_s, mean_change: ds.length ? +(ds.reduce((a, c) => a + c, 0) / ds.length).toFixed(2) : null, status: longest_s > MAX_STATIC_S ? "STATIC" : "ok" };
  });
  const durs = beats.map((b) => b.duration_sec || 0);
  return { beats: out, longest_s: Math.max(0, ...out.map((o) => o.longest_s)), avg_beat_s: durs.length ? +(durs.reduce((a, c) => a + c, 0) / durs.length).toFixed(2) : null, fail: out.filter((o) => o.status === "STATIC") };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
  const r = paceOf(arg("video"), JSON.parse(readFileSync(arg("manifest"), "utf8")));
  for (const b of r.beats) console.log(`beat ${String(b.index).padStart(2)}  ${b.duration_s.toFixed(1)} s  longest static ${b.longest_s.toFixed(2)} s  mean change ${b.mean_change}  ${b.status}`);
  console.log(`longest static stretch ${r.longest_s.toFixed(2)} s; average beat ${r.avg_beat_s} s; ${r.fail.length} beat(s) static for more than ${MAX_STATIC_S} s`);
  if (arg("json")) writeFileSync(arg("json"), JSON.stringify(r, null, 2) + "\n");
  process.exit(r.fail.length ? 1 : 0);
}
