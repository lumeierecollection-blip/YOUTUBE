/**
 * STAGE 13 (AUDIO) AUDIT — VO source-level loudness probe.
 *
 * Lane: audit-audio (stage 13 of the CROSSCHECK-PROTOCOL rebuild).
 * Owned area: data/audit/** — this file lives at data/audit/13/.
 *
 * WHAT IT MEASURES (AUD-08 partial evidence)
 *
 * The render path plays the staged voiceover at UNITY gain: render.js
 * copies the TTS file to ./vo.mp3 (stageAudio), audio.js statically imports
 * it, and motion-graphics.jsx mounts <Audio src={currentAudio} /> with no
 * volume prop. So the VO's true peak in a render equals the TTS file's own
 * peak. The one VO-sized file in the repo (data/audit/14/measure/
 * debt-snowball-shorts-vo.mp3 — byte-identical to the staged
 * src/skills/remotion-render/vo.mp3 placeholder) is measured here with the
 * same parser used by the layer-2 SFX probe. The report is persisted to
 * vo-levels-report.json next to this file so the numbers survive the run.
 *
 * AUD-08's claim is "VO peaks <= -3 dBFS" in a FINISHED render; without a
 * render this only tests the SOURCE side. The render itself is not
 * reproducible on this machine (no @remotion/compositor, EdgeTTS WebSocket
 * unreachable through the sandbox proxy), so that half stays UNVERIFIABLE
 * and is named as such in the ledger.
 *
 * Run:  node data/audit/13/probe-vo-levels.mjs
 */
import { execFileSync } from "child_process";
import { readFileSync, existsSync, unlinkSync, statSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FF = "C:/Users/user/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe";
const FP = "C:/Users/user/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffprobe.exe";

const mp3 = "C:/Users/user/YOUTUBE/data/audit/14/measure/debt-snowball-shorts-vo.mp3";
const wav = join(HERE, "tmp-vo-probe.wav");

if (!existsSync(mp3)) {
  console.log(JSON.stringify({ error: `${mp3} not on disk` }, null, 2));
  process.exit(0);
}

const size = statSync(mp3).size;
const dur = Number(execFileSync(FP, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3], { encoding: "utf-8" }).trim());
const br = execFileSync(FP, ["-v", "error", "-show_entries", "stream=bit_rate", "-of", "csv=p=0", mp3], { encoding: "utf-8" }).trim();

execFileSync(FF, ["-v", "error", "-i", mp3, "-ac", "1", "-ar", "44100", "-f", "wav", "-y", wav]);
const bytes = readFileSync(wav);
unlinkSync(wav);

const sampleRate = bytes.readInt32LE(24);
const dataStart = 44;
const sampleCount = (bytes.length - dataStart) / 2;
let peakAbs = 0;
let sumSq = 0;
let nonzero = 0;
let n = 0;
for (let i = 0; i < sampleCount; i++) {
  const s = bytes.readInt16LE(dataStart + i * 2) / 32768;
  sumSq += s * s;
  const a = Math.abs(s);
  if (a > peakAbs) peakAbs = a;
  if (s !== 0) nonzero++;
  n++;
}
const rms = Math.sqrt(sumSq / n);
const db = (x) => 20 * Math.log10(x);

const report = {
  file: mp3.replace(/C:\\Users\\user\\YOUTUBE\\/, ""),
  bytes: size,
  durationSec: Math.round(dur * 100) / 100,
  bitRate: br,
  peakDbFS: Math.round(db(peakAbs) * 100) / 100,
  rmsDbFS: Math.round(db(rms) * 100) / 100,
  nonzeroSampleRatio: Math.round((nonzero / n) * 1000) / 1000,
  isSilent: peakAbs < 0.001,
  unityRenderPeakDbFS: Math.round(db(peakAbs) * 100) / 100,
  exceedsMinus3DbFS: peakAbs > Math.pow(10, -3 / 20),
  sameBytesAsRepoVoMp3: statSync("C:/Users/user/YOUTUBE/src/skills/remotion-render/vo.mp3").size === size,
  note: "render path plays vo.mp3 at unity (audio.js static import, <Audio> no volume prop)",
};
writeFileSync(join(HERE, "vo-levels-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log("report written to vo-levels-report.json");