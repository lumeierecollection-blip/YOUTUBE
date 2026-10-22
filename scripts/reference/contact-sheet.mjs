/**
 * contact-sheet — timestamped grids of extracted frames. Each tile is labelled "<frame id>  mm:ss.ss" (ffmpeg drawtext).
 * ffmpeg only: no new dependency.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const FONTS = [
  "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
];

export function mmss(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

/** Pure. Grid geometry for the video's orientation. */
export function layoutFor(orientation) {
  return orientation === "vertical" ? { cols: 4, rows: 3, tw: 270, th: 480 } : { cols: 3, rows: 4, tw: 426, th: 240 };
}

/** Pure. drawtext filter for one tile's label (colons escaped for the filter graph). */
export function labelFilter(label, font) {
  const esc = label.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "");
  const ff = font ? `fontfile='${font.replace(/:/g, "\\:")}':` : "";
  return `drawtext=${ff}text='${esc}':fontsize=20:fontcolor=white:box=1:boxcolor=black@0.75:boxborderw=4:x=4:y=4`;
}

/**
 * frames: [{id, t, file}]. Writes <outDir>/contact-01.jpg ... Returns [{file, frames:[ids], cols, rows}].
 */
export function makeContactSheets(frames, outDir, orientation = "vertical", perSheet) {
  const { cols, rows, tw, th } = layoutFor(orientation);
  perSheet = perSheet || cols * rows;
  mkdirSync(outDir, { recursive: true });
  const font = FONTS.find((f) => existsSync(f)) || null;
  const sheets = [];
  const tmp = mkdtempSync(join(tmpdir(), "refsheet-"));
  try {
    for (let s = 0; s * perSheet < frames.length; s++) {
      const group = frames.slice(s * perSheet, (s + 1) * perSheet);
      group.forEach((f, i) => {
        const vf = `scale=${tw}:${th}:force_original_aspect_ratio=decrease,pad=${tw}:${th}:(ow-iw)/2:(oh-ih)/2:black,${labelFilter(`${f.id}  ${mmss(f.t)}`, font)}`;
        const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", f.file, "-vf", vf, "-frames:v", "1", join(tmp, `t${String(i + 1).padStart(3, "0")}.png`)], { encoding: "utf8" });
        if (r.status !== 0) throw new Error(`contact tile ${f.id} failed: ${r.stderr}`);
      });
      const file = join(outDir, `contact-${String(s + 1).padStart(2, "0")}.jpg`);
      const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-framerate", "1", "-i", join(tmp, "t%03d.png"), "-vf", `tile=${cols}x${rows}:padding=4:color=gray`, "-frames:v", "1", "-q:v", "3", file], { encoding: "utf8" });
      if (r.status !== 0) throw new Error(`contact sheet ${s + 1} failed: ${r.stderr}`);
      sheets.push({ file, frames: group.map((f) => f.id), cols, rows });
      for (let i = 1; i <= group.length; i++) rmSync(join(tmp, `t${String(i).padStart(3, "0")}.png`), { force: true });
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  return sheets;
}
