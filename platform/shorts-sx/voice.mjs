#!/usr/bin/env node
/** Narration for an SX Short: Gemini TTS (edge-tts fallback) through platform/production/index.mjs narrate(). Brisk by DELIVERY, never sped up
 *  (owner rule). Output: output/sx/<slug>/voice.mp3. Usage: node platform/shorts-sx/voice.mjs <slug> */
import { mkdirSync, renameSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { narrate } from "../production/index.mjs";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../.."), slug = process.argv[2], S = await import(`./specs/${slug}.mjs`);
const OUT = join(ROOT, "output/sx", slug); mkdirSync(OUT, { recursive: true });
// first render: 183 and 141 wpm against the references 214 and 172; faster DELIVERY is asked for, the audio is never sped up
// 19 Nov 2026 owner: "speaking too fast... rushing", must be clearly audible -> calm, clear delivery at about 150 wpm for both styles
// calm prompts measured 105-120 wpm whatever number is asked; scripts are sized for that (about 51 words for 30 s)
// S.VOICE_STYLE overrides per Short (owner, 20 Nov 2026: 48% swipe-away; copy the reference pace, v3 = 172 wpm)
const style = S.VOICE_STYLE || "Say it clearly, like a friendly, confident explainer: an unhurried but lively pace of about 165 words a minute, every word easy to hear, a short pause at each full stop, light emphasis on names, years and numbers. Never rushed:";
// owner rule 30 s max: Gemini takes of one script vary in pace, so a take that would run past 29.5 s is re-taken (up to 3 takes, the
// fastest kept). The audio itself is never sped up.
const text = S.SCRIPT.replace(/\*/g, ""), n = text.split(/\s+/).length, secs = (w) => (n / w) * 60 + 0.7;
let best = null;
for (let take = 1; take <= 3; take++) {
  const r = await narrate({ text, edgeVoice: "en-US-AndrewNeural", outDir: OUT, name: `voice.take${take}`, style });
  console.log(`take ${take}: ${r.engine}, ${r.wpm} wpm, ~${secs(r.wpm).toFixed(1)} s`);
  if (!best || r.wpm > best.wpm) best = r;
  if (secs(r.wpm) <= 29.5) break;
}
renameSync(best.mp3, join(OUT, "voice.mp3"));
console.log(`voice ${slug}: ${best.engine}, ${best.wpm} wpm`);
