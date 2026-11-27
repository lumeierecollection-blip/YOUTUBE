// InsiderForce-style single-video render (Short 25, Tabletop). Run from data/ai-tested/shorts-v5: node if/render-if.mjs
// Plan is built from the word-timed VTT so every text reveal follows the spoken word. No system, one video.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseVtt } from "../plan-lib.mjs";

const shorts = path.resolve(import.meta.dirname, "..");
const root = path.join(shorts, "render");
const publicDir = path.join(root, "public");
const outDir = path.join(shorts, "if", "out");
fs.mkdirSync(outDir, { recursive: true });

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) { const s = path.join(src, f), d = path.join(dst, f); fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d); }
}
copyDir(path.join(shorts, "assets", "sfx2"), path.join(publicDir, "sfx2"));
const ID0 = process.env.IF_ID || "25";
copyDir(path.join(shorts, "assets", "v7", ID0), path.join(publicDir, "v7", ID0));
fs.mkdirSync(path.join(publicDir, "if"), { recursive: true });
fs.copyFileSync(path.join(shorts, "if", "audio", `${ID0}.mp3`), path.join(publicDir, "if", `${ID0}.mp3`));

const probe = (args) => spawnSync("ffprobe", ["-v", "error", ...args], { encoding: "utf8" }).stdout.trim();
const dur = parseFloat(probe(["-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path.join(shorts, "if", "audio", `${ID0}.mp3`)]));
const cues = parseVtt(fs.readFileSync(path.join(shorts, "if", "audio", `${ID0}.vtt`), "utf8"));
const T = cues.map((c) => c.start);


const ID = process.env.IF_ID || "25";
const plan = { ...(await import(`./plans/${ID}.mjs`)).default(T), watermark: "AI Tested" };
const planScenes = plan.scenes, sfx = plan.sfx;
const propsFile = path.join(outDir, `if${ID0}.props.json`);
fs.writeFileSync(propsFile, JSON.stringify({ plan, audioSrc: `if/${ID0}.mp3`, audioDurationSec: dur }));
console.log(`plan: ${planScenes.length} scenes, ${sfx.length} sfx, narration ${dur.toFixed(2)}s`);

const raw = path.join(outDir, `.raw${ID0}.mp4`), outFile = path.join(outDir, `if${ID0}.mp4`);
execFileSync("npx", ["remotion", "render", "src/index.ts", `IF-${ID0}`, raw, `--props=${propsFile}`, "--codec=h264", "--pixel-format=yuv420p", "--crf=17", "--audio-bitrate=192k", "--log=warn"], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });

// Background song under narration + SFX, ducked by the voice. Skipped if the file is absent.
const song = path.join(shorts, "assets", "music", "bgsong.mp3");
let base = raw;
if (fs.existsSync(song) && process.env.NO_MUSIC !== "1") {
  const total = parseFloat(probe(["-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", raw]));
  const start = parseFloat(process.env.MUSIC_START || "0"), vol = process.env.MUSIC_VOL || "0.22";
  base = path.join(outDir, `.mix${ID0}.mp4`);
  const fc = `[1:a]volume=${vol},afade=t=in:d=0.8,afade=t=out:st=${(total - 1.8).toFixed(2)}:d=1.8[m];[0:a]asplit[v][k];[m][k]sidechaincompress=threshold=0.02:ratio=6:attack=15:release=350[md];[v][md]amix=inputs=2:normalize=0:duration=first[a]`;
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", raw, "-ss", String(start), "-t", total.toFixed(2), "-i", song, "-filter_complex", fc, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", base], { stdio: "inherit" });
  console.log(`music: bgsong.mp3 from ${start}s, vol ${vol}`);
}
const r1 = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", base, "-vn", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
const m = (r1.stderr || "").match(/\{[\s\S]*?"target_offset"[\s\S]*?\}/);
const s = JSON.parse(m[0]);
const af = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${s.input_i}:measured_TP=${s.input_tp}:measured_LRA=${s.input_lra}:measured_thresh=${s.input_thresh}:offset=${s.target_offset}:linear=true,alimiter=limit=0.78:attack=3:release=40:level=false`;
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", base, "-c:v", "copy", "-af", af, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", outFile], { stdio: "inherit" });
fs.unlinkSync(raw);
if (base !== raw) fs.unlinkSync(base);

// stills at the middle of each scene, native 1080x1920 and a contact sheet
const stillDir = path.join(outDir, "stills", ID0);
fs.mkdirSync(stillDir, { recursive: true });
planScenes.forEach((sc, k) => {
  const t = Math.min(dur - 0.1, Math.min(sc.t1, dur) - 0.25);
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", t.toFixed(2), "-i", outFile, "-frames:v", "1", path.join(stillDir, `s${String(k + 1).padStart(2, "0")}_${t.toFixed(1)}s.png`)]);
});
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-framerate", "1", "-pattern_type", "glob", "-i", path.join(stillDir, "s*.png"), "-vf", "scale=270:480,tile=8x2:padding=6:color=white", "-frames:v", "1", path.join(outDir, `contact${ID0}.png`)]);
console.log("done", outFile);
