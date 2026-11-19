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
const style = S.STYLE === "v1" ? "Say very fast and punchy, like an energetic short-form creator, about 210 words a minute, no pauses between sentences:" : "Say fast and confident, like a quick-cut short-form storyteller, about 175 words a minute, short pauses only, emphasis on names, years and numbers:";
// owner rule 35-40 s: Gemini takes of one script vary 155-217 wpm, so a take that would run past 39.5 s is re-taken (up to 3 takes, the
// fastest kept); a short take is held to 35.2 s by build.mjs. The audio itself is never sped up.
const text = S.SCRIPT.replace(/\*/g, ""), n = text.split(/\s+/).length, secs = (w) => (n / w) * 60 + 0.7;
let best = null;
for (let take = 1; take <= 3; take++) {
  const r = await narrate({ text, edgeVoice: "en-US-AndrewNeural", outDir: OUT, name: `voice.take${take}`, style });
  console.log(`take ${take}: ${r.engine}, ${r.wpm} wpm, ~${secs(r.wpm).toFixed(1)} s`);
  if (!best || r.wpm > best.wpm) best = r;
  if (secs(r.wpm) <= 39.5) break;
}
renameSync(best.mp3, join(OUT, "voice.mp3"));
console.log(`voice ${slug}: ${best.engine}, ${best.wpm} wpm`);
