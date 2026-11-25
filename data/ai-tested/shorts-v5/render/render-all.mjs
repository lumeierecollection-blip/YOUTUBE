import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseVtt, syncBeats, validatePlan } from "../plan-lib.mjs";

const root = path.resolve(import.meta.dirname);
const shorts = path.resolve(root, "..");
const plansDir = path.join(shorts, "plans");
const scriptsDir = path.join(shorts, "scripts");
const factsDir = path.join(shorts, "facts");
const audioDir = path.join(shorts, "audio");
const assetsDir = path.join(shorts, "assets");
const stillsOnly = process.env.STILLS_ONLY === "1";
const outDir = path.join(shorts, stillsOnly ? "out-preview" : "out");
const timedDir = path.join(shorts, "plans-timed");
const publicDir = path.join(root, "public");
const only = (process.env.ONLY_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
for (const d of ["audio", "logos", "photos", "sfx", "sfx2", "music", "ambience"]) fs.mkdirSync(path.join(publicDir, d), { recursive: true });
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(timedDir, { recursive: true });

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const s = path.join(src, f), d = path.join(dst, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
copyDir(audioDir, path.join(publicDir, "audio"));
for (const d of ["logos", "photos", "sfx", "sfx2", "music", "ambience"]) copyDir(path.join(assetsDir, d), path.join(publicDir, d));

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
const probe = (args) => spawnSync("ffprobe", ["-v", "error", ...args], { encoding: "utf8" }).stdout.trim();

function imageSize(rel) {
  const p = path.join(publicDir, rel);
  if (!fs.existsSync(p)) return null;
  const o = probe(["-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", p]);
  const [w, h] = o.split(",").map(Number);
  return w && h ? { w, h } : null;
}

function loudnorm(inFile, outFile) {
  const r1 = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", inFile, "-vn", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
  const m = (r1.stderr || "").match(/\{[\s\S]*?"target_offset"[\s\S]*?\}/);
  if (!m) throw new Error("loudnorm pass 1 produced no stats: " + (r1.stderr || "").slice(-400));
  const s = JSON.parse(m[0]);
  const af = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${s.input_i}:measured_TP=${s.input_tp}:measured_LRA=${s.input_lra}:measured_thresh=${s.input_thresh}:offset=${s.target_offset}:linear=true,alimiter=limit=0.89:level=false`;
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", inFile, "-c:v", "copy", "-af", af, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", outFile], { stdio: "inherit" });
  return { measured: s };
}

function audioQa(file) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" });
  const t = r.stderr || "";
  const sum = t.slice(t.lastIndexOf("Summary:"));
  const pick = (re) => { const m = sum.match(re); return m ? parseFloat(m[1]) : null; };
  const vol = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" }).stderr || "";
  const vm = (re) => { const m = vol.match(re); return m ? parseFloat(m[1]) : null; };
  return { integrated_lufs: pick(/I:\s+(-?[\d.]+)\s+LUFS/), lra: pick(/LRA:\s+(-?[\d.]+)\s+LU/), true_peak_dbtp: pick(/Peak:\s+(-?[\d.]+)\s+dBFS/), mean_volume_db: vm(/mean_volume:\s+(-?[\d.]+)/), max_volume_db: vm(/max_volume:\s+(-?[\d.]+)/) };
}

const files = fs.readdirSync(plansDir).filter(f => f.endsWith(".plan.json")).sort();
const failures = [];
const validation = {};
for (const f of files) {
  let plan;
  try { plan = readJson(path.join(plansDir, f)); } catch (e) { failures.push({ file: f, error: "plan JSON invalid: " + e.message }); continue; }
  const id = plan.id;
  if (only.length && !only.includes(id)) continue;
  const base = `${id}-${plan.slug}`;
  try {
    const script = readJson(path.join(scriptsDir, `${base}.json`));
    const factsP = path.join(factsDir, `${id}.facts.json`);
    const facts = fs.existsSync(factsP) ? readJson(factsP) : null;
    if (!facts) throw new Error(`facts file missing: ${factsP}`);
    const audioPath = path.join(audioDir, `${id}.mp3`);
    if (!fs.existsSync(audioPath)) throw new Error("narration mp3 missing (run generate-tts.mjs)");
    const dur = parseFloat(probe(["-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audioPath]));
    if (!Number.isFinite(dur) || dur < 5) throw new Error("bad narration duration");
    const vttPath = path.join(audioDir, `${id}.vtt`);
    const cues = fs.existsSync(vttPath) ? parseVtt(fs.readFileSync(vttPath, "utf8")) : [];
    for (const b of plan.beats) for (const m of b.media || []) { const sz = imageSize(m.src); if (sz) { m.w = sz.w; m.h = sz.h; } }
    const sync = syncBeats(plan, script.script, cues, dur);
    if (sync.mode !== "vtt") console.warn(`[${id}] narration sync fell back to ${sync.mode}: ${sync.notes.join("; ")}`);
    const v = validatePlan(plan, { publicDir, script: script.script, facts });
    validation[id] = { ...v, sync };
    fs.writeFileSync(path.join(timedDir, `${base}.timed.json`), JSON.stringify(plan, null, 2));
    if (!v.ok) throw new Error("plan validation failed:\n - " + v.errors.join("\n - "));
    if (v.warns.length) console.warn(`[${id}] warnings:\n - ` + v.warns.join("\n - "));
    const propsFile = path.join(timedDir, `${base}.props.json`);
    fs.writeFileSync(propsFile, JSON.stringify({ plan, audioSrc: `audio/${id}.mp3`, audioDurationSec: dur }));
    const raw = path.join(outDir, `.${base}.raw.mp4`);
    const outFile = path.join(outDir, `${base}.mp4`);
    for (const p of [raw, outFile]) if (fs.existsSync(p)) fs.unlinkSync(p);
    console.log(`Rendering ${id} (${dur.toFixed(2)}s narration, ${plan.beats.length} beats, stills_only=${stillsOnly})`);
    const args = ["remotion", "render", "src/index.ts", `Short-${id}`, raw, `--props=${propsFile}`, "--codec=h264", stillsOnly ? "--crf=30" : "--crf=17", "--audio-bitrate=192k", "--log=warn"];
    if (stillsOnly) args.push("--scale=0.5");
    execFileSync("npx", args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
    if (stillsOnly) { fs.renameSync(raw, outFile); }
    else {
      const ln = loudnorm(raw, outFile);
      fs.unlinkSync(raw);
      const qa = audioQa(outFile);
      fs.writeFileSync(path.join(outDir, `${base}.audio.json`), JSON.stringify({ ...qa, pre_master: ln.measured, sfx_events: (plan.audio.sfx || []).length, music: plan.audio.music?.src, ambience: plan.audio.ambience?.src }, null, 2));
      console.log(`[${id}] audio`, JSON.stringify(qa));
    }
    fs.writeFileSync(path.join(outDir, `${base}.timing.json`), JSON.stringify({ narration_sec: dur, sync_mode: sync.mode, beats: plan.beats.map((b, i) => ({ i, scene: b.scene, t: b.t, dur: b.dur, narration: b.narration })), sfx: plan.audio.sfx }, null, 2));
  } catch (e) {
    console.error(`RENDER FAILED ${id}:`, e?.message || e);
    for (const p of [path.join(outDir, `.${base}.raw.mp4`)]) try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
    failures.push({ id, slug: plan.slug, error: String(e?.message || e).slice(0, 2500) });
  }
}
fs.writeFileSync(path.join(outDir, "PLAN_VALIDATION.json"), JSON.stringify(validation, null, 2));
if (failures.length) {
  fs.writeFileSync(path.join(outDir, "RENDER_FAILURES.json"), JSON.stringify(failures, null, 2));
  console.error("Some renders failed:", failures.map(f => f.id || f.file).join(","));
  process.exit(1);
}
console.log("All renders complete");
