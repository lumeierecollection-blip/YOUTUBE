/**
 * sample — which frames of a reference to look at, extract them (JPEG, <=512 px wide), drop near-duplicates.
 *
 * Method adapted from bradautomates/claude-video (MIT): scene-change + uniform sampling, near-duplicate removal by 16x16
 * grayscale thumbnail distance, a hard frame cap, frames <=512 px wide. Reimplemented in Node; no code copied.
 * Never exports every frame of a video: standard caps at 60, dense at 200.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export const CAPS = { standard: 60, dense: 200 };
const PRI = { "cut-after": 0, "cut-before": 0, dense: 1, uniform: 2 };
const R = (x) => +x.toFixed(2);

/** Pure. Returns [{t, reason}] sorted by t, at most `cap`, cuts kept first, the rest thinned evenly. */
export function planSamples({ duration, cuts = [], mode = "standard", uniformEvery = 2, denseWindows = [], cap, cutPad = 0.15, denseFps = 4 }) {
  cap = cap ?? CAPS[mode] ?? CAPS.standard;
  const hi = Math.max(0, duration - 0.05);
  const clamp = (t) => Math.min(hi, Math.max(0, t));
  const raw = [];
  for (const c of cuts) {
    raw.push({ t: clamp(c - cutPad), reason: "cut-before" });
    raw.push({ t: clamp(c + cutPad), reason: "cut-after" });
  }
  for (let t = 0; t <= hi + 1e-9; t += uniformEvery) raw.push({ t: clamp(t), reason: "uniform" });
  if (mode === "dense") {
    for (const [a, b] of denseWindows) for (let t = Math.max(0, a); t <= Math.min(hi, b) + 1e-9; t += 1 / denseFps) raw.push({ t: clamp(t), reason: "dense" });
  }
  // collapse samples closer than 50 ms, keeping the higher-priority reason
  raw.sort((x, y) => x.t - y.t || PRI[x.reason] - PRI[y.reason]);
  const merged = [];
  for (const s of raw) {
    const last = merged[merged.length - 1];
    if (last && s.t - last.t < 0.05) { if (PRI[s.reason] < PRI[last.reason]) merged[merged.length - 1] = s; continue; }
    merged.push(s);
  }
  let out = merged;
  if (out.length > cap) {
    const keep = out.filter((s) => PRI[s.reason] === 0).slice(0, cap);
    const rest = out.filter((s) => PRI[s.reason] !== 0);
    const room = Math.max(0, cap - keep.length);
    const step = rest.length / Math.max(1, room);
    const thinned = room ? Array.from({ length: room }, (_, i) => rest[Math.floor(i * step)]) : [];
    out = [...keep, ...thinned].sort((x, y) => x.t - y.t);
  }
  return out.map((s, i) => ({ id: `f${String(i + 1).padStart(3, "0")}`, t: R(s.t), reason: s.reason }));
}

/** Pure. Dense windows (+-pad s) around strong novelty events; overlapping windows merged. */
export function denseWindowsFrom(events, { minNovelty = 0.1, pad = 0.5 } = {}) {
  const w = events.filter((e) => e.cut || e.novelty >= minNovelty).map((e) => [Math.max(0, e.t - pad), e.t + pad]);
  const out = [];
  for (const x of w.sort((a, b) => a[0] - b[0])) {
    const l = out[out.length - 1];
    if (l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]); else out.push([...x]);
  }
  return out.map(([a, b]) => [R(a), R(b)]);
}

/** Pure. Mean absolute difference (0-255) of two equal-length gray thumbnails. */
export function thumbDistance(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

/** Pure. Walk thumbs in time order; a frame within `threshold` of the last KEPT frame is a duplicate. */
export function dedupe(items, threshold = 1.5) {
  const kept = [], dropped = [];
  let last = null;
  for (const it of items) {
    if (last && thumbDistance(last.thumb, it.thumb) < threshold) dropped.push({ id: it.id, t: it.t, duplicate_of: last.id, distance: R(thumbDistance(last.thumb, it.thumb)) });
    else { kept.push(it); last = it; }
  }
  return { kept, dropped };
}

export function extractFrame(video, t, outFile, maxWidth = 512) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", video, "-frames:v", "1", "-vf", `scale='min(${maxWidth},iw)':-2`, "-q:v", "3", outFile], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`frame extract at ${t}s failed: ${r.stderr}`);
}

export function thumbOf(jpg) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", jpg, "-vf", "scale=16:16:flags=area,format=gray", "-f", "rawvideo", "-"], { maxBuffer: 1 << 20 });
  if (r.status !== 0 || r.stdout.length < 256) throw new Error(`thumbnail failed for ${jpg}: ${r.stderr}`);
  return new Uint8Array(r.stdout.subarray(0, 256));
}

/** Extract the plan, dedupe. Returns { frames:[{id,t,reason,file}], dropped:[...] }; dropped jpgs are deleted from disk. */
export async function extractPlan(video, plan, framesDir, { threshold = 1.5 } = {}) {
  const { unlinkSync } = await import("node:fs");
  mkdirSync(framesDir, { recursive: true });
  const items = plan.map((p) => {
    const file = join(framesDir, `${p.id}.jpg`);
    extractFrame(video, p.t, file);
    return { ...p, file, thumb: thumbOf(file) };
  });
  const { kept, dropped } = dedupe(items, threshold);
  for (const d of dropped) { try { unlinkSync(join(framesDir, `${d.id}.jpg`)); } catch { /* already gone */ } }
  return { frames: kept.map(({ thumb, ...f }) => f), dropped, planned: plan.length };
}
