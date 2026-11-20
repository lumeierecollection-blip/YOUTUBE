#!/usr/bin/env node
/**
 * Long-form voice, ONE continuous take per section.
 * Before this, every beat (about 10 s) was its own text-to-speech request, so the delivery restarted every beat and a failed request silently fell back to a
 * different engine: the owner heard "multiple conversations at once" and a robotic read. Here consecutive beats are grouped into sections of about 170 words,
 * each section is read in ONE request with one voice and one short style note, loudness-matched, and cut back into per-beat files at the pause between beats.
 * A failed request is retried; it is never replaced by another engine, so one episode never mixes voices. Parallel render shards download these files instead of
 * generating their own (otherwise each shard would read the same lines differently).
 * Usage: node platform/longform/v2/make-voice.mjs <episode-slug>.   Output: output/longform-prod/<slug>/voice/<beat>.mp3, <beat>.words.json, voice-log.json
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { narrate } from "../../production/index.mjs";
import { ROOT } from "../../preview/lib.mjs";

const slug = process.argv[2];
const ch = ["hidden-past", "ai-tested", "rival-lines", "fx-stick", "fx-toon", "fx-doc"].find((c) => slug.startsWith(c)) || slug;
const VOICE = { "hidden-past": "en-GB-RyanNeural", "ai-tested": "en-US-AndrewNeural", "rival-lines": "en-GB-RyanNeural", "fx-stick": "en-US-AndrewNeural", "fx-toon": "en-US-BrianNeural", "fx-doc": "en-US-GuyNeural" };
// one short direction each (a long note can be read aloud; see src/utils/video-tone.js). History: calm and unhurried like the reference (112 wpm); football: relaxed and curious.
const STYLE = {
  "fx-stick": "Read this as a young, wry first-person storyteller on a YouTube animation channel, natural American English: conversational, quick but clear, amused at your own bad luck, warm, never theatrical:",
  "fx-toon": "Read this as an energetic second-person narrator on an animated YouTube story channel, natural American English: bright, playful, punchy short lines, a clear steady pace, real warmth at the end:",
  "fx-doc": "Say in a calm, unhurried documentary narrator voice, warm, with natural pauses and gentle emphasis on the key words:",
  "hidden-past": "Say in a calm, unhurried British documentary narrator's voice, warm, with natural pauses and gentle emphasis on the key words:",
  "rival-lines": "Say in a relaxed, curious British voice, like explaining something interesting to a friend, with natural pauses and emphasis:",
};
const MAX_WORDS = Number(process.env.VOICE_SECTION_WORDS || 170);
const tok = (t) => (t.match(/\S+/g) || []).filter((x) => /[\w']/.test(x));
const run = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28 });
const dur = (f) => Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).stdout.trim());

const { EPISODE: ep } = await import(`./episodes/${slug}.mjs`);
const OUT = join(ROOT, "output/longform-prod", slug, "voice");
mkdirSync(OUT, { recursive: true });
const hasGemini = ["GEMINI_API_KEY_1", "GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4"].some((k) => process.env[k]);

const BEATS = process.env.VOICE_MAX_BEATS ? ep.beats.slice(0, Number(process.env.VOICE_MAX_BEATS)) : ep.beats;
const groups = []; let cur = [], w = 0;
for (const b of BEATS) { const n = tok(b.vo).length; if (cur.length && w + n > MAX_WORDS) { groups.push(cur); cur = []; w = 0; } cur.push(b); w += n; }
if (cur.length) groups.push(cur);

const log = { slug, sections: [], started: new Date().toISOString() };
for (const [gi, group] of groups.entries()) {
  if (group.every((b) => existsSync(join(OUT, `${b.id}.mp3`)) && dur(join(OUT, `${b.id}.mp3`)) > 0.5)) { console.log("section cached", gi); continue; }
  const text = group.map((b) => b.vo).join(" ");
  let r = null, last = "";
  const WAIT = [45, 90, 150, 240, 300, 300, 300, 300]; // seconds: Gemini TTS answers HTTP 429 (per-minute quota) when two takes or two runs ask close together
  for (let attempt = 1; attempt <= WAIT.length && !r; attempt++) {
    try {
      const x = await narrate({ text, edgeVoice: VOICE[ch], outDir: OUT, name: `section${gi}`, style: STYLE[ch], gravity: null });
      if (hasGemini && !String(x.engine).startsWith("gemini")) { last = `engine ${x.engine}: ${x.notes.join(" | ").slice(0, 200)}`; console.log("retry: not Gemini", last); rmSync(x.mp3, { force: true }); await new Promise((s) => setTimeout(s, WAIT[attempt - 1] * 1000)); continue; }
      r = x;
    } catch (e) { last = String(e.message).slice(0, 200); console.log("retry:", last); await new Promise((s) => setTimeout(s, WAIT[attempt - 1] * 1000)); }
  }
  if (!r) throw new Error(`voice section ${gi} failed after 8 tries (${last}); refusing to mix engines`);
  // level-match the take, then cut at the middle of the pause between beats
  const lev = join(OUT, `section${gi}.lev.mp3`);
  run("ffmpeg", ["-y", "-v", "error", "-i", r.mp3, "-af", "loudnorm=I=-20:LRA=9:TP=-2", "-ar", "24000", "-ac", "1", "-b:a", "160k", lev]);
  const words = r.words, total = dur(lev), allTok = group.reduce((n, b) => n + tok(b.vo).length, 0);
  let idx = 0; const spans = [];
  for (const b of group) {
    const n = tok(b.vo).length, a0 = Math.round((idx / allTok) * words.length), a1 = Math.max(a0 + 1, Math.round(((idx + n) / allTok) * words.length));
    idx += n; const ws = words.slice(a0, a1); spans.push({ b, first: ws[0].start, last: ws[ws.length - 1].end, ws });
  }
  for (const [k, s] of spans.entries()) {
    const t0 = k === 0 ? 0 : (spans[k - 1].last + s.first) / 2, t1 = k === spans.length - 1 ? total : (s.last + spans[k + 1].first) / 2;
    const mp3 = join(OUT, `${s.b.id}.mp3`);
    run("ffmpeg", ["-y", "-v", "error", "-ss", t0.toFixed(3), "-to", t1.toFixed(3), "-i", lev, "-ar", "24000", "-ac", "1", "-b:a", "160k", mp3]);
    writeFileSync(join(OUT, `${s.b.id}.words.json`), JSON.stringify({ version: 1, source: `${r.engine} section ${gi}`, words: s.ws.map((x) => ({ ...x, start: +(x.start - t0).toFixed(3), end: +(x.end - t0).toFixed(3) })) }));
  }
  await new Promise((s) => setTimeout(s, 20000)); // breathe between takes to stay under the per-minute quota
  log.sections.push({ gi, engine: r.engine, beats: group.map((b) => b.id), words: allTok, seconds: +total.toFixed(1), wpm: Math.round(allTok / (total / 60)) });
  console.log(`section ${gi}: ${r.engine}, ${allTok} words, ${total.toFixed(1)} s (${Math.round(allTok / (total / 60))} wpm), beats ${group.map((b) => b.id).join(",")}`);
  rmSync(r.mp3, { force: true }); rmSync(lev, { force: true });
}
log.finished = new Date().toISOString();
writeFileSync(join(OUT, "voice-log.json"), JSON.stringify(log, null, 1));
