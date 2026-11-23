import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname);
const scriptsDir = path.join(root, "scripts");
const audioDir = path.join(root, "audio");
fs.mkdirSync(audioDir, { recursive: true });

function tts(story, out) {
  const voice = story.voice || "en-US-AndrewNeural";
  const text = story.script;
  const attempts = [
    () => execFileSync("edge-tts", ["--voice", voice, "--text", text, "--write-media", out], { stdio: "inherit", shell: process.platform === "win32" }),
    () => execFileSync("python", ["-m", "edge_tts", "--voice", voice, "--text", text, "--write-media", out], { stdio: "inherit", shell: process.platform === "win32" }),
  ];
  let last;
  for (let i = 0; i < 3; i++) {
    for (const a of attempts) {
      try { a(); if (fs.existsSync(out) && fs.statSync(out).size > 1000) return; } catch (e) { last = e; }
    }
    console.log(`retry ${i + 1} for ${story.id}`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
  }
  throw last || new Error("TTS failed");
}

for (const f of fs.readdirSync(scriptsDir).filter(f => f.endsWith(".json")).sort()) {
  const story = JSON.parse(fs.readFileSync(path.join(scriptsDir, f), "utf8").replace(/^\uFEFF/, ""));
  const out = path.join(audioDir, `${story.id}.mp3`);
  if (fs.existsSync(out) && fs.statSync(out).size > 1000) { console.log("exists", out); continue; }
  console.log("TTS", story.id);
  tts(story, out);
}
console.log("TTS done");
