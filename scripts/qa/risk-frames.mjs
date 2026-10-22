// Risk-frame selection: the timestamps most likely to hide a defect, with the reason each was picked.
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";


export function planRiskFrames({ duration, beats = [], textChanges = [], transitions = [], extra = [], fps = 30, max = 24, settle = 0.35 }) {
  const f = 1 / fps;
  const cand = [];
  const add = (t, reason) => { if (Number.isFinite(t)) cand.push({ t: Math.min(Math.max(t, 0), Math.max(0, duration - f)), reason }); };
  beats.forEach((b, i) => {
    if (i > 0) { add(b.start - 2 * f, `beat ${i - 1} end`); add(b.start + 2 * f, `beat ${i} start`); }
    add(b.start + settle, `beat ${i} settled`);
  });
  transitions.forEach((x) => add(x.t + (x.dur || 0) / 2, "mid-transition"));
  textChanges.forEach((t) => add(t + 0.2, "text change +0.2s"));
  extra.forEach((t) => add(t, "extra"));
  if (!cand.length) add(duration / 2, "midpoint");
  // dedupe frames closer than one frame, merging reasons
  cand.sort((a, b) => a.t - b.t);
  const merged = [];
  for (const c of cand) {
    const last = merged[merged.length - 1];
    if (last && c.t - last.t < f) { if (!last.reasons.includes(c.reason)) last.reasons.push(c.reason); } else merged.push({ t: +c.t.toFixed(3), reasons: [c.reason] });
  }
  if (merged.length <= max) return merged;
  // cap: keep the most-reasoned frames first, then spread the rest evenly in time
  const keep = new Set([...merged].sort((a, b) => b.reasons.length - a.reasons.length).slice(0, Math.floor(max / 2)));
  const rest = merged.filter((m) => !keep.has(m));
  const step = rest.length / (max - keep.size);
  for (let k = 0; k < max - keep.size; k++) keep.add(rest[Math.floor(k * step)]);
  return merged.filter((m) => keep.has(m));
}

// Extract one JPEG per planned frame and a labelled contact sheet (ffmpeg tile + drawtext). Returns {frames:[{t,reasons,path}], sheet}.
export function extractRiskFrames(video, planned, outDir, { width = 270, cols = 6 } = {}) {
  mkdirSync(outDir, { recursive: true });
  const frames = [];
  planned.forEach((p, i) => {
    const path = join(outDir, `risk-${String(i).padStart(2, "0")}-${p.t.toFixed(2)}s.jpg`);
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-ss", String(p.t), "-i", video, "-frames:v", "1", "-q:v", "3", path], { encoding: "utf8" });
    if (r.status === 0) frames.push({ ...p, path });
  });
  let sheet = null;
  if (frames.length) {
    sheet = join(outDir, "risk-contact-sheet.jpg");
    const rows = Math.ceil(frames.length / cols);
    const inputs = frames.flatMap((fr) => ["-i", fr.path]);
    const labelled = frames.map((fr, i) => `[${i}:v]scale=${width}:-2,drawtext=text='${fr.t.toFixed(2)}s':x=6:y=6:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.7[v${i}]`);
    const tileFilter = `${labelled.join(";")};${frames.map((_, i) => `[v${i}]`).join("")}concat=n=${frames.length}:v=1:a=0,tile=${cols}x${rows}`;
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", tileFilter, "-frames:v", "1", "-q:v", "3", sheet], { encoding: "utf8" });
    if (r.status !== 0) sheet = null;
  }
  return { frames, sheet };
}
