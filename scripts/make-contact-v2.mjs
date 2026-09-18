import sharp from "sharp";
import { readdirSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createRequire } from "module";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const require2 = createRequire(import.meta.url);

function findFFmpeg() {
  const binName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  try {
    const pkg = process.platform === "win32" ? "@remotion/compositor-win32-x64-msvc" : "@remotion/compositor-linux-x64-gnu";
    const compositorPkg = require2.resolve(`${pkg}/package.json`);
    const candidate = join(dirname(compositorPkg), binName);
    if (existsSync(candidate)) return candidate;
  } catch {}
  return "ffmpeg";
}

const FFMPEG = findFFmpeg();
const VIDEO = join(ROOT, "data/renders/1/september-2026-hidden-inflation-50-30-20-budget-shorts-shorts-2026-09-11.mp4");
const OUT_DIR = join(ROOT, "data/renders/1/directed-v8-frames");
mkdirSync(OUT_DIR, { recursive: true });

const srtText = readFileSync(join(ROOT, "data/tts/1/september-2026-hidden-inflation-50-30-20-budget-shorts-script-vo.srt"), "utf-8");
const FPS = 30;
const toFrames = (t) => {
  const [h, m, rest] = t.split(":");
  const [s, ms] = rest.split(",");
  return Math.round(((+h * 3600) + (+m * 60) + +s + +ms / 1000) * FPS);
};
const cuesParsed = srtText.split(/\n\n+/).map((b) => b.trim().split("\n")).filter((l) => l.length >= 3).map((l) => {
  const [a, b] = l[1].split(" --> ");
  return { startFrame: toFrames(a), endFrame: toFrames(b), text: l.slice(2).join(" ") };
});
cuesParsed.forEach((c, i) => {
  c.durationInFrames = Math.max(12, (cuesParsed[i + 1] ? cuesParsed[i + 1].startFrame : c.endFrame) - c.startFrame);
});

const cues = cuesParsed.map(c => c.text);

// Extract frames at midpoint of each beat
for (let i = 0; i < cuesParsed.length; i++) {
  const midFrame = cuesParsed[i].startFrame + Math.floor(cuesParsed[i].durationInFrames / 2);
  const timeSec = (midFrame / FPS).toFixed(3);
  const outFile = join(OUT_DIR, `d${i.toString().padStart(2, "0")}.png`);
  execSync(`"${FFMPEG}" -y -ss ${timeSec} -i "${VIDEO}" -frames:v 1 -q:v 2 "${outFile}"`, { stdio: "pipe" });
  console.log(`d${i}: frame ${midFrame} (${timeSec}s) — ${cuesParsed[i].text.slice(0, 50)}...`);
}

const files = readdirSync(OUT_DIR).filter(f => f.match(/^d\d{2}\.png$/)).sort();
const COLS = 4;
const ROWS = Math.ceil(files.length / COLS);
const THUMB_W = 270;
const THUMB_H = 480;
const PAD = 8;
const LABEL_H = 24;
const CELL_H = THUMB_H + LABEL_H;
const SHEET_W = COLS * (THUMB_W + PAD) + PAD;
const SHEET_H = ROWS * (CELL_H + PAD) + PAD;

const composites = [];
for (let i = 0; i < files.length; i++) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const x = PAD + col * (THUMB_W + PAD);
  const y = PAD + row * (CELL_H + PAD);

  const thumb = await sharp(join(OUT_DIR, files[i]))
    .resize(THUMB_W, THUMB_H, { fit: "cover" })
    .toBuffer();

  composites.push({ input: thumb, left: x, top: y });

  const text = cues[i] || "";
  const short = text.length > 35 ? text.slice(0, 35) + "..." : text;
  const escaped = short.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const labelSvg = Buffer.from(`<svg width="${THUMB_W}" height="${LABEL_H}">
    <rect width="${THUMB_W}" height="${LABEL_H}" fill="#111"/>
    <text x="4" y="17" font-family="sans-serif" font-size="12" fill="#fff">d${i} — ${escaped}</text>
  </svg>`);
  composites.push({ input: labelSvg, left: x, top: y + THUMB_H });
}

await sharp({
  create: { width: SHEET_W, height: SHEET_H, channels: 4, background: { r: 17, g: 17, b: 17, alpha: 1 } }
})
  .composite(composites)
  .png()
  .toFile(join(OUT_DIR, "contact-sheet-v8.png"));

console.log(`Contact sheet: ${join(OUT_DIR, "contact-sheet-v5.png")}`);
