/**
 * Long-form assembly. Narration is made one chapter at a time (a 20-40 minute script is too long for one TTS call and one failure would lose it all),
 * then the chapter tracks are joined with a short pause and their word timings shifted onto one clock, so the existing buildTimeline() can time
 * every scene and caption exactly as it does for a Short. The voice is never sped up: each chapter is voiced at its natural pace.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { durationOf, narrate } from "../production/index.mjs";

/** chapters -> one flat scene list, the global scene index of every sentence, and where each chapter starts in that list. */
export function flattenScenes(chapters) {
  const scenes = [], sceneOfSentence = [], sentences = [], chapterFirstScene = [];
  for (const [ci, c] of chapters.entries()) {
    const base = scenes.length; chapterFirstScene.push(base);
    c.scenes.forEach((s, k) => scenes.push({ ...s, chapter: ci, chapter_title: c.title, id: `c${ci + 1}s${k + 1}` }));
    for (const s of c.sentences) { sentences.push({ ...s, chapter: ci }); sceneOfSentence.push(base + s.scene); }
  }
  // Scenes nobody speaks in cannot be timed from the voice; refuse rather than show them for zero frames.
  const used = new Set(sceneOfSentence);
  const unused = scenes.filter((_, i) => !used.has(i)).map((s) => s.id);
  if (unused.length) throw new Error(`scenes with no sentence: ${unused.join(", ")}`);
  return { scenes, sceneOfSentence, sentences, chapterFirstScene };
}

/** parts: [{ seconds, words:[{text,start,end}], sentences:[{text,start,end}] }] -> one narration-shaped object on a single clock. */
export function mergeNarrations(parts, gap = 0.6) {
  let offset = 0; const words = [], sentences = [], chapterStarts = [];
  parts.forEach((p, i) => {
    chapterStarts.push(offset);
    for (const w of p.words) words.push({ ...w, start: w.start + offset, end: w.end + offset });
    for (const s of p.sentences) sentences.push({ ...s, start: s.start + offset, end: s.end + offset });
    offset += p.seconds + (i < parts.length - 1 ? gap : 0);
  });
  return { words, sentences, seconds: offset, chapterStarts };
}

const stamp = (s) => { const t = Math.floor(s), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = String(t % 60).padStart(2, "0"); return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`; };
/** YouTube chapter list for the description. YouTube needs the first at 0:00, at least 3 chapters, each at least 10 seconds long. */
export function youtubeChapters(chapters, startsSeconds, totalSeconds) {
  if (chapters.length < 3) throw new Error("YouTube chapters need at least 3 chapters");
  const lines = chapters.map((c, i) => {
    const start = i === 0 ? 0 : startsSeconds[i], end = i + 1 < chapters.length ? startsSeconds[i + 1] : totalSeconds;
    if (end - start < 10) throw new Error(`chapter "${c.title}" is ${(end - start).toFixed(1)} s; YouTube chapters must be at least 10 s`);
    return `${stamp(start)} ${c.title}`;
  });
  return lines.join("\n");
}

/** Voices each chapter, joins them with silence, and returns a narration object buildTimeline() accepts. */
export async function narrateChapters({ chapters, outDir, edgeVoice, gravity, voice, gap = 0.6, log = console.log }) {
  const parts = [];
  for (const [i, c] of chapters.entries()) {
    const text = c.sentences.map((s) => s.text).join(" ");
    let n;
    for (let take = 1; take <= 3; take++) {
      n = await narrate({ text, edgeVoice, outDir, name: `vo-${String(i + 1).padStart(2, "0")}`, gravity, voice });
      if (n.sentences.length === c.sentences.length) break;
      log(`chapter ${i + 1} take ${take}: voice produced ${n.sentences.length} sentences for ${c.sentences.length}; voicing again`);
    }
    if (n.sentences.length !== c.sentences.length) throw new Error(`chapter "${c.title}": voice produced ${n.sentences.length} sentences for ${c.sentences.length}`);
    log(`chapter ${i + 1}/${chapters.length} "${c.title}": ${n.seconds.toFixed(1)} s, ${n.wpm} wpm, ${n.engine}`);
    parts.push(n);
  }
  const merged = mergeNarrations(parts, gap), list = join(outDir, ".vo-list.txt"), silence = join(outDir, ".gap.mp3"), mp3 = join(outDir, "voice-track.mp3");
  spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(gap), silence]);
  writeFileSync(list, parts.flatMap((p, i) => [`file '${p.mp3.replace(/\\/g, "/")}'`, ...(i < parts.length - 1 ? [`file '${silence.replace(/\\/g, "/")}'`] : [])]).join("\n"));
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "160k", mp3], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`joining chapter voices failed: ${r.stderr}`);
  const seconds = durationOf(mp3), wordCount = merged.words.length;
  if (Math.abs(seconds - merged.seconds) > 1.5) throw new Error(`joined voice is ${seconds.toFixed(1)} s but the chapter timings add to ${merged.seconds.toFixed(1)} s`);
  return { mp3, seconds, words: merged.words, sentences: merged.sentences, chapterStarts: merged.chapterStarts, engine: [...new Set(parts.map((p) => p.engine))].join("+"), word_count: wordCount, wpm: Math.round((wordCount / seconds) * 600) / 10, playback_speed: 1, notes: parts.flatMap((p) => p.notes || []) };
}
