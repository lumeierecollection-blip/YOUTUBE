#!/usr/bin/env node
/** Narration for an SX Short: Gemini TTS (edge-tts fallback) through platform/production/index.mjs narrate(). Brisk by DELIVERY, never sped up
 *  (owner rule). Output: output/sx/<slug>/voice.mp3. Usage: node platform/shorts-sx/voice.mjs <slug> */
import { mkdirSync, renameSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { narrate } from "../production/index.mjs";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../.."), slug = process.argv[2], S = await import(`./specs/${slug}.mjs`);
const OUT = join(ROOT, "output/sx", slug); mkdirSync(OUT, { recursive: true });
const style = S.STYLE === "v1" ? "Say in a fast, punchy, curious American voice, like a creator explaining something surprising, no pauses between sentences:" : "Say in a confident, brisk American storytelling voice, quick but clear, with emphasis on the names, years and numbers:";
const r = await narrate({ text: S.SCRIPT.replace(/\*/g, ""), edgeVoice: "en-US-AndrewNeural", outDir: OUT, name: "voice.tmp", style });
renameSync(r.mp3, join(OUT, "voice.mp3"));
console.log(`voice ${slug}: ${r.engine}, ${r.wpm} wpm`);
