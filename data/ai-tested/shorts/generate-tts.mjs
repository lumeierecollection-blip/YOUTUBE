import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname);
const scriptsDir = path.join(root, "scripts");
const audioDir = path.join(root, "audio");
fs.mkdirSync(audioDir, { recursive: true });

const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith(".json")).sort();
for (const f of files) {
  const story = JSON.parse(fs.readFileSync(path.join(scriptsDir, f), "utf8"));
  const out = path.join(audioDir, `${story.id}.mp3`);
  if (fs.existsSync(out)) { console.log("exists", out); continue; }
  const text = story.script.replace(/\n/g, " ").replace(/"/g, '\\"');
  console.log("TTS", story.id);
  try {
    execFileSync("edge-tts", ["--voice", story.voice || "en-US-AndrewNeural", "--text", story.script, "--write-media", out], { stdio: "inherit", shell: process.platform === "win32" });
  } catch (e) {
    console.error("edge-tts failed, trying python -m edge_tts", e.message);
    execFileSync("python", ["-m", "edge_tts", "--voice", story.voice || "en-US-AndrewNeural", "--text", story.script, "--write-media", out], { stdio: "inherit", shell: process.platform === "win32" });
  }
}
console.log("TTS done");
