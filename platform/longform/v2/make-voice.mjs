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
const ch = slug.startsWith("hidden-past") ? "hidden-past" : slug.startsWith("ai-tested") ? "ai-tested" : slug.startsWith("rival-lines") ? "rival-lines" : slug;
const VOICE = { "hidden-past": "en-GB-RyanNeural", "ai-tested": "en-US-AndrewNeural", "rival-lines": "en-GB-RyanNeural" };
// one short direction each (a long note can be read aloud; see src/utils/video-tone.js). History: calm and unhurried like the reference (112 wpm); football: relaxed and curious.
const STYLE = {
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
  for (let attempt = 1; attempt <= 5 && !r; attempt++) {
    try {
      const x = await narrate({ text, edgeVoice: VOICE[ch], outDir: OUT, name: `section${gi}`, style: STYLE[ch], gravity: null });
      if (hasGemini && !String(x.engine).startsWith("gemini")) { last = `engine ${x.engine}: ${x.notes.join(" | ").slice(0, 200)}`; console.log("retry: not Gemini", last); rmSync(x.mp3, { force: true }); await new Promise((s) => setTimeout(s, attempt * 20000)); continue; }
      r = x;
    } catch (e) { last = String(e.message).slice(0, 200); console.log("retry:", last); await new Promise((s) => setTimeout(s, attempt * 20000)); }
  }
  if (!r) throw new Error(`voice section ${gi} failed after 5 tries (${last}); refusing to mix engines`);
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
  log.sections.push({ gi, engine: r.engine, beats: group.map((b) => b.id), words: allTok, seconds: +total.toFixed(1), wpm: Math.round(allTok / (total / 60)) });
  console.log(`section ${gi}: ${r.engine}, ${allTok} words, ${total.toFixed(1)} s (${Math.round(allTok / (total / 60))} wpm), beats ${group.map((b) => b.id).join(",")}`);
  rmSync(r.mp3, { force: true }); rmSync(lev, { force: true });
}
log.finished = new Date().toISOString();
writeFileSync(join(OUT, "voice-log.json"), JSON.stringify(log, null, 1));
