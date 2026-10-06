// Does the REFERENCE footage itself pass middle-zone-filled?
// Reimplements local-audit.cjs:653 middleZoneFilled's arithmetic exactly:
//   W=270 H=480, y0=floor(620/1920*480)=155, y1=ceil(1340/1920*480)=335
//   row counts if >=3 of 270 px have luma < 235 (non-map)
//   best of {62%, 90%} through the beat, taken as a share of (y1-y0)
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const W = 270, H = 480;
const Y0 = Math.floor((620 / 1920) * H), Y1 = Math.ceil((1340 / 1920) * H);
const ROWS = Y1 - Y0;
const OUT = "data/audit/mzf";
mkdirSync(OUT, { recursive: true });
console.log(`zone rows y=${Y0}..${Y1} (${ROWS} rows), floor 15% = ${(ROWS * 0.15).toFixed(1)} rows\n`);

function rawAt(file, t) {
  const r = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", t.toFixed(3), "-i", file,
    "-frames:v", "1", "-vf", `scale=${W}:${H},format=rgb24`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 27 });
  return r.length === W * H * 3 ? r : null;
}

function fillPct(buf) {
  let rows = 0;
  for (let y = Y0; y < Y1; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const l = 0.299 * buf[o] + 0.587 * buf[o + 1] + 0.114 * buf[o + 2];
      if (l < 235) n++;
    }
    if (n >= 3) rows++;
  }
  return rows / ROWS;
}

const GROUPS = {
  "ch-05 Broadsheet (newspaper-collage)": [
    "research/4_5917850534521349135.mp4",
    "research/4_5917850534521349251.mp4",
    "research/4_5917850534521349262.mp4",
  ],
  "ch-10 Margin Note (editorial-serif-light)": ["research/4_5917850534521349264.mp4"],
  "ch-06 Archive Room (archival-montage)": ["research/4_5917850534521349255.mp4"],
  "ch-08 Ledger (stepped-timeline)": ["research/4_5917850534521349257.mp4"],
  "BASELINE ch-02 Legal Brief (built)": [
    "data/audit/a1-ci/c2q/approved-review/california-no-robo-bosses-act-ai-discipline-shorts-shorts-2026-10-06.mp4",
  ],
};

for (const [label, files] of Object.entries(GROUPS)) {
  const all = [];
  for (const f of files) {
    let dur = 0;
    try {
      dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).trim());
    } catch { continue; }
    if (!Number.isFinite(dur) || dur <= 0) continue;
    // 9 pseudo-beats spread across the video, matching the renderer's beat cadence
    const n = Math.min(9, Math.max(3, Math.round(dur / 3)));
    const vals = [];
    for (let i = 0; i < n; i++) {
      const t = (dur * (i + 0.5)) / n;
      const buf = rawAt(f, t);
      if (!buf) continue;
      const pct = fillPct(buf);
      vals.push(pct);
      all.push(pct);
    }
    const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
    const below = vals.filter((v) => v < 0.15).length;
    console.log(`${label}\n  ${f.split("/").pop().padEnd(42)} frames=${vals.length} mean=${(mean * 100).toFixed(1)}% below15%=${below}/${vals.length}  ${vals.map((v) => (v * 100).toFixed(0)).join(",")}`);
  }
  if (all.length) {
    const sorted = [...all].sort((a, b) => a - b);
    const p10 = sorted[Math.floor(0.10 * sorted.length)];
    const below = all.filter((v) => v < 0.15).length;
    console.log(`  >> GROUP: n=${all.length} mean=${(100 * all.reduce((a, b) => a + b, 0) / all.length).toFixed(1)}% p10=${(p10 * 100).toFixed(1)}% below15%=${below}/${all.length} (${(100 * below / all.length).toFixed(0)}%)\n`);
  }
}