import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname);
const scriptsDir = path.resolve(root, "../scripts");
const audioDir = path.resolve(root, "../audio");
const outDir = path.resolve(root, "../out");
const publicAudio = path.resolve(root, "public/audio");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(publicAudio, { recursive: true });
// copy audio into public for Remotion staticFile
if (fs.existsSync(audioDir)) {
  for (const f of fs.readdirSync(audioDir).filter(x => x.endsWith('.mp3'))) {
    fs.copyFileSync(path.join(audioDir, f), path.join(publicAudio, f));
  }
}

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
