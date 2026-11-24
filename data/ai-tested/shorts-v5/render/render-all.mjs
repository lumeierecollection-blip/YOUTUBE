import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname);
const plansDir = path.resolve(root, "../plans");
const scriptsDir = path.resolve(root, "../scripts");
const audioDir = path.resolve(root, "../audio");
const assetsDir = path.resolve(root, "../assets");
const outDir = path.resolve(root, "../out");
const publicDir = path.resolve(root, "public");
for (const d of ["audio", "logos", "photos", "sfx"]) fs.mkdirSync(path.join(publicDir, d), { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  for (const f of fs.readdirSync(src)) {
    const s = path.join(src, f), d = path.join(dst, f);
    if (fs.statSync(s).isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyDir(s, d); }
    else fs.copyFileSync(s, d);
  }
}
copyDir(audioDir, path.join(publicDir, "audio"));
copyDir(path.join(assetsDir, "logos"), path.join(publicDir, "logos"));
copyDir(path.join(assetsDir, "photos"), path.join(publicDir, "photos"));
copyDir(path.join(assetsDir, "sfx"), path.join(publicDir, "sfx"));

function sanitizeAssetRef(v) {
  if (!v || typeof v !== "string") return v;
  const known = ["openai","google","meta","anthropic","nvidia","huggingface","spacex","claude","gemini"];
  const base = v.replace(/^logos\//, "").replace(/^photos\//, "").replace(/\.(svg|png|jpg|jpeg|webp)$/i, "").replace(/-logo$/, "").replace(/_logo$/, "").replace(/-white$/, "");
  if (known.includes(base)) return base; // renderer resolves to logos/<base>-white.svg
  return v;
}
function sanitizePlan(plan) {
  for (const b of plan.beats || []) {
    if (Array.isArray(b.assets)) b.assets = b.assets.map(sanitizeAssetRef);
    if (b.photo && typeof b.photo === "string") {
      const p = b.photo.replace(/^photos\//, "");
      const base = p.replace(/\.(png|jpg|jpeg|webp|svg)$/i, "").replace(/-logo$/, "").replace(/_logo$/, "");
      const known = ["openai","google","meta","anthropic","nvidia","huggingface","spacex","claude","gemini"];
      if (known.includes(base)) b.assets = Array.from(new Set([...(b.assets||[]), base]));
      else b.photo = p;
    }
  }
  return plan;
}

const files = fs.readdirSync(plansDir).filter(f => f.endsWith(".plan.json")).sort();
for (const f of files) {
  const plan = sanitizePlan(JSON.parse(fs.readFileSync(path.join(plansDir, f), "utf8").replace(/^\uFEFF/, "")));
  const id = plan.id;
  const audioPath = path.join(audioDir, `${id}.mp3`);
  let dur = plan.beats.reduce((a, b) => a + (Number(b.dur) || 0), 0) || 30;
  if (fs.existsSync(audioPath)) {
    try {
      const out = execFileSync("ffprobe", ["-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1", audioPath], { encoding: "utf8" }).trim();
      const d = parseFloat(out);
      if (Number.isFinite(d) && d > 5) dur = d;
    } catch {}
  }
  const planned = plan.beats.reduce((a,b)=>a+(Number(b.dur)||0),0) || dur;
  const scale = dur / planned;
  let cursor = 0;
  plan.beats = plan.beats.map((b) => {
    const sd = Math.max(0.8, (Number(b.dur) || 2) * scale);
    const t = cursor; cursor += sd;
    return { ...b, t: +t.toFixed(3), dur: +sd.toFixed(3) };
  });
  if (plan.beats.length) {
    const last = plan.beats[plan.beats.length - 1];
    const end = last.t + last.dur;
    if (end < dur) last.dur = +(dur - last.t + 0.2).toFixed(3);
  }
  plan.duration_target_sec = dur;
  const props = JSON.stringify({ plan, audioSrc: `audio/${id}.mp3`, audioDurationSec: dur });
  const outFile = path.join(outDir, `${id}-${plan.slug}.mp4`);
  console.log(`Rendering ${id} -> ${outFile} (dur=${dur}s)`);
  execFileSync("npx", ["remotion", "render", "src/index.ts", `Short-${id}`, outFile, "--props", props, "--codec=h264", "--crf=18", "--audio-bitrate=192k"], {
    cwd: root, stdio: "inherit", shell: process.platform === "win32"
  });
}
console.log("All renders complete");
