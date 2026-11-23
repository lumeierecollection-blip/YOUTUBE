import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname);
const scriptsDir = path.resolve(root, "../scripts");
const audioDir = path.resolve(root, "../audio");
const assetsDir = path.resolve(root, "../assets");
const outDir = path.resolve(root, "../out");
const publicDir = path.resolve(root, "public");
for (const d of ["audio", "logos", "photos"]) fs.mkdirSync(path.join(publicDir, d), { recursive: true });
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

const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith(".json")).sort();
for (const f of files) {
  const story = JSON.parse(fs.readFileSync(path.join(scriptsDir, f), "utf8"));
  const id = story.id;
  const audioPath = path.join(audioDir, `${id}.mp3`);
  let dur = story.duration_target_sec;
  if (fs.existsSync(audioPath)) {
    try {
      const out = execFileSync("ffprobe", ["-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1", audioPath], { encoding: "utf8" }).trim();
      const d = parseFloat(out);
      if (Number.isFinite(d) && d > 5) dur = d;
    } catch {}
  }
  const props = JSON.stringify({ story, audioSrc: `audio/${id}.mp3`, audioDurationSec: dur });
  const outFile = path.join(outDir, `${id}-${story.slug}.mp4`);
  console.log(`Rendering ${id} -> ${outFile} (dur=${dur}s)`);
  execFileSync("npx", ["remotion", "render", "src/index.ts", `Short-${id}`, outFile, "--props", props, "--codec=h264", "--crf=18", "--audio-bitrate=192k"], {
    cwd: root, stdio: "inherit", shell: process.platform === "win32"
  });
}
console.log("All renders complete");
