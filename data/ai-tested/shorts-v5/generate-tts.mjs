import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname);
const scriptsDir = path.join(root, "scripts");
const audioDir = path.join(root, "audio");
fs.mkdirSync(audioDir, { recursive: true });
const py = process.platform === "win32" ? "python" : "python3";

function tts(story, out) {
  const vtt = out.replace(/\.mp3$/, ".vtt");
  const txt = out.replace(/\.mp3$/, ".txt");
  fs.writeFileSync(txt, story.script, "utf8");
  let last;
  for (let i = 0; i < 4; i++) {
    try {
      execFileSync(py, [path.join(root, "tts-words.py"), story.voice || "en-US-AndrewNeural", txt, out, vtt], { stdio: "inherit" });
      if (fs.statSync(out).size > 1000 && fs.statSync(vtt).size > 100) return;
    } catch (e) { last = e; }
    console.log(`retry ${i + 1} for ${story.id}`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 4000);
  }
  throw last || new Error("TTS failed for " + story.id);
}

for (const f of fs.readdirSync(scriptsDir).filter((f) => f.endsWith(".json")).sort()) {
  const story = JSON.parse(fs.readFileSync(path.join(scriptsDir, f), "utf8").replace(/^﻿/, ""));
  const out = path.join(audioDir, `${story.id}.mp3`);
  console.log("TTS", story.id);
  tts(story, out);
}
console.log("TTS done");
