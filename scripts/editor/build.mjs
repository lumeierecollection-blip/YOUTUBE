#!/usr/bin/env node
/**
 * Build a renderable editor timeline from a scene plan.
 *
 *   node scripts/editor/build.mjs \
 *     --plan scripts/editor/plans/aberfan.json \
 *     --audio data/editor/audio/aberfan.mp3 \
 *     --whisper data/editor/audio/aberfan.json \
 *     --out data/editor/timelines/aberfan.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { execFileSync } from "child_process";
import { buildTimeline } from "./timeline.mjs";
import { buildCaptions } from "./captions.mjs";

const ROOT = resolve(new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => {
  if (x.startsWith("--")) a.push([x.slice(2), arr[i + 1]]);
  return a;
}, []));
const need = (k) => { if (!args[k]) throw new Error(`missing --${k}`); return args[k]; };

const planPath = resolve(need("plan"));
const audioPath = resolve(need("audio"));
const outPath = resolve(need("out"));
const plan = JSON.parse(readFileSync(planPath, "utf8"));
const script = plan.script ? JSON.parse(readFileSync(resolve(plan.script), "utf8")) : null;
const whisper = args.whisper ? JSON.parse(readFileSync(resolve(args.whisper), "utf8")) : null;

const audioDuration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", audioPath], { encoding: "utf8" }).trim());
const captions = buildCaptions({ script, whisper, duration: audioDuration });
const replacements = plan.caption_replacements || {};
const normalize = (value) => Object.entries(replacements).reduce((text, [from, to]) => text.split(from).join(to), String(value ?? ""));
for (const cue of captions) {
  cue.text = normalize(cue.text);
  for (const word of cue.words || []) word.text = normalize(word.text);
}
const timeline = buildTimeline(plan, { audioDuration, captions });
timeline.metadata.plan = planPath;
timeline.metadata.audio_duration_sec = audioDuration;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(timeline, null, 2) + "\n");
console.log(`[editor-build] ${timeline.id}: ${timeline.durationInFrames} frames (${audioDuration.toFixed(3)}s), ${timeline.layers.length} layers, ${timeline.captions.length} caption cues, ${timeline.metadata.unique_assets.length} unique assets -> ${outPath}`);
