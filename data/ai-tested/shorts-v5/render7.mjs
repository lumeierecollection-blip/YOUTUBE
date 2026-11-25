// Schema-7 pipeline: board (storyboard) + word-level VTT -> timed plan -> validation -> Remotion render -> loudnorm -> QA.
// Run from data/ai-tested/shorts-v5. Env: STILLS_ONLY=1 (half scale, low quality, never a deliverable), ONLY_IDS=21,22, PLAN_ONLY=1.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseVtt } from "./plan-lib.mjs";
import { buildPlan, validatePlan7 } from "./plan7-lib.mjs";

const shorts = path.resolve(import.meta.dirname);
const root = path.join(shorts, "render");
const publicDir = path.join(root, "public");
const stillsOnly = process.env.STILLS_ONLY === "1";
const planOnly = process.env.PLAN_ONLY === "1";
const outDir = path.join(shorts, stillsOnly ? "out-preview" : "out");
const timedDir = path.join(shorts, "plans-timed");
const only = (process.env.ONLY_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
for (const d of [outDir, timedDir, publicDir]) fs.mkdirSync(d, { recursive: true });

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) { const s = path.join(src, f), d = path.join(dst, f); fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d); }
}
copyDir(path.join(shorts, "audio"), path.join(publicDir, "audio"));
for (const d of ["logos", "photos", "sfx", "sfx2", "music", "ambience", "v7"]) copyDir(path.join(shorts, "assets", d), path.join(publicDir, d));

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
const probe = (args) => spawnSync("ffprobe", ["-v", "error", ...args], { encoding: "utf8" }).stdout.trim();
const imageSize = (rel) => {
  const p = path.join(publicDir, rel);
  if (!fs.existsSync(p)) return null;
  const [w, h] = probe(["-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", p]).split(",").map(Number);
  return w && h ? { w, h } : null;
};

function loudnorm(inFile, outFile) {
  const r1 = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", inFile, "-vn", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
  const m = (r1.stderr || "").match(/\{[\s\S]*?"target_offset"[\s\S]*?\}/);
  if (!m) throw new Error("loudnorm pass 1 produced no stats: " + (r1.stderr || "").slice(-400));
  const s = JSON.parse(m[0]);
  const af = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${s.input_i}:measured_TP=${s.input_tp}:measured_LRA=${s.input_lra}:measured_thresh=${s.input_thresh}:offset=${s.target_offset}:linear=true,alimiter=limit=0.89:level=false`;
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", inFile, "-c:v", "copy", "-af", af, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", outFile], { stdio: "inherit" });
  return s;
}
function audioQa(file) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" });
  const sum = (r.stderr || "").slice((r.stderr || "").lastIndexOf("Summary:"));
  const pick = (re) => { const m = sum.match(re); return m ? parseFloat(m[1]) : null; };
  return { integrated_lufs: pick(/I:\s+(-?[\d.]+)\s+LUFS/), lra: pick(/LRA:\s+(-?[\d.]+)\s+LU/), true_peak_dbtp: pick(/Peak:\s+(-?[\d.]+)\s+dBFS/) };
}

const boardFiles = fs.readdirSync(path.join(shorts, "boards")).filter((f) => /^\d+\.board\.mjs$/.test(f)).sort();
const failures = [], validation = {};
for (const bf of boardFiles) {
  const id = bf.split(".")[0];
  if (only.length && !only.includes(id)) continue;
  let board;
  try {
    board = (await import(pathToFileURL(path.join(shorts, "boards", bf)).href)).default;
    const manifestP = path.join(shorts, "assets", "manifests", `${id}.v7.assets.json`);
    if (fs.existsSync(manifestP)) board.asset_manifest = readJson(manifestP);
    const base = `${id}-${board.slug}`;
    const script = readJson(path.join(shorts, "scripts", `${base}.json`)).script;
    const facts = readJson(path.join(shorts, "facts", `${id}.facts.json`));
    const mp3 = path.join(shorts, "audio", `${id}.mp3`);
    const dur = parseFloat(probe(["-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", mp3]));
    const cues = parseVtt(fs.readFileSync(path.join(shorts, "audio", `${id}.vtt`), "utf8"));
    const { plan, errors } = buildPlan(board, { script, cues, audioDur: dur, imageSize });
    if (errors.length || !plan) throw new Error("plan build failed:\n - " + errors.join("\n - "));
    const v = validatePlan7(plan, { publicDir, facts });
    validation[id] = v;
    fs.writeFileSync(path.join(timedDir, `${base}.plan7.json`), JSON.stringify(plan, null, 2));
    if (v.warns.length) console.warn(`[${id}] warnings:\n - ` + v.warns.join("\n - "));
    if (!v.ok) throw new Error("plan validation failed:\n - " + v.errors.join("\n - "));
    if (planOnly) { console.log(`[${id}] plan ok: ${plan.beats.length} beats, ${plan.audio.sfx.length} sfx`); continue; }
    const propsFile = path.join(timedDir, `${base}.props7.json`);
    fs.writeFileSync(propsFile, JSON.stringify({ plan, audioSrc: `audio/${id}.mp3`, audioDurationSec: dur }));
    const raw = path.join(outDir, `.${base}.raw.mp4`), outFile = path.join(outDir, `${base}.mp4`);
    for (const p of [raw, outFile]) if (fs.existsSync(p)) fs.unlinkSync(p);
    console.log(`Rendering ${id} (${dur.toFixed(2)}s, ${plan.beats.length} beats, stills_only=${stillsOnly})`);
    const args = ["remotion", "render", "src/index.ts", `Short-${id}`, raw, `--props=${propsFile}`, "--codec=h264", "--pixel-format=yuv420p", stillsOnly ? "--crf=30" : "--crf=17", "--audio-bitrate=192k", "--log=warn"];
    if (stillsOnly) args.push("--scale=0.5");
    execFileSync("npx", args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
    if (stillsOnly) fs.renameSync(raw, outFile);
    else {
      const pre = loudnorm(raw, outFile);
      fs.unlinkSync(raw);
      const qa = audioQa(outFile);
      fs.writeFileSync(path.join(outDir, `${base}.audio.json`), JSON.stringify({ ...qa, pre_master: pre, sfx_events: plan.audio.sfx.length, distinct_sfx: new Set(plan.audio.sfx.map((s) => s.src)).size, music: plan.audio.music?.src, ambience: plan.audio.ambience?.src }, null, 2));
      console.log(`[${id}] audio`, JSON.stringify(qa));
    }
    fs.writeFileSync(path.join(outDir, `${base}.timing.json`), JSON.stringify({ narration_sec: dur, beats: plan.beats.map((b) => ({ id: b.id, t: b.t, dur: b.dur })), sfx: plan.audio.sfx }, null, 2));
  } catch (e) {
    console.error(`FAILED ${id}:`, e?.message || e);
    failures.push({ id, error: String(e?.message || e).slice(0, 3000) });
  }
}
fs.writeFileSync(path.join(outDir, "PLAN_VALIDATION.json"), JSON.stringify(validation, null, 2));
if (failures.length) { fs.writeFileSync(path.join(outDir, "RENDER_FAILURES.json"), JSON.stringify(failures, null, 2)); console.error("Failed:", failures.map((f) => f.id).join(",")); process.exit(1); }
console.log("All done");
