/**
 * Shared production steps every channel uses after the script is approved.
 *
 * The narration file is the single source of timing: scenes, captions and contact-sheet labels are
 * all derived from its measured word timings. Nothing here changes playback speed. A script that
 * runs long has to be rewritten, because this code will not make it fit.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const FPS = 30;
export const NATURAL_WPM_MAX = 200; // measured across the whole narration; faster than this is no longer natural speech
const probe = (file, entries, stream = "") => execFileSync("ffprobe", ["-v", "error", ...(stream ? ["-select_streams", stream] : []), "-show_entries", entries, "-of", "csv=p=0", file]).toString().trim();
export const durationOf = (f) => Number(probe(f, "format=duration"));

function geminiVoice(edgeVoice, gravity, voice = null) {
  return import(pathToFileURL(join(ROOT, "src/utils/gemini-voice.js")).href).then((m) => m.geminiVoiceFor(edgeVoice, voice, gravity));
}

/**
 * Generates narration at the voice's own pace and returns its word timings. Gemini's TTS is tried first,
 * because the owner judged edge-tts robotic; edge-tts is the fallback and the result says which ran.
 */
export async function narrate({ text, edgeVoice, outDir, name = "voice-track", gravity = null, style = null, voice = null }) {
  const input = join(outDir, `.${name}.txt`), mp3 = join(outDir, `${name}.mp3`), srt = join(outDir, `.${name}.srt`), wordsFile = join(outDir, `${name}-words.json`);
  writeFileSync(input, text);
  const hasGemini = ["GEMINI_API_KEY_1", "GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4"].some((k) => process.env[k]);
  let engine = null;
  const notes = [];
  if (hasGemini && process.env.TTS_PROVIDER !== "edge") {
    const g = await geminiVoice(edgeVoice, gravity, voice);
    const r = spawnSync("python3", [join(ROOT, "src/utils/tts_gemini.py"), "--voice", g.voice, "--style", style || g.style, "--file", input, "--mp3", mp3, "--srt", srt, "--words", wordsFile], { encoding: "utf8", timeout: 600000, cwd: ROOT });
    if (r.status === 0 && existsSync(wordsFile)) engine = `gemini:${g.voice}`;
    else notes.push(`gemini tts failed: ${String(r.stderr || r.stdout).trim().split("\n").at(-1).slice(0, 200)}`);
  }
  if (!engine) {
    for (let attempt = 1; attempt <= 4 && !engine; attempt++) {
      const r = spawnSync("python3", [join(ROOT, "src/utils/tts_words.py"), "--voice", edgeVoice, "--rate", "+0%", "--pitch", "+0Hz", "--file", input, "--mp3", mp3, "--srt", srt, "--words", wordsFile], { encoding: "utf8", timeout: 180000, cwd: ROOT });
      if (r.status === 0 && existsSync(wordsFile)) engine = `edge:${edgeVoice}`;
      else { notes.push(`edge attempt ${attempt}: ${String(r.stderr).trim().split("\n").at(-1).slice(0, 160)}`); spawnSync("sleep", [String(attempt * 15)]); }
    }
  }
  rmSync(input, { force: true }); rmSync(srt, { force: true });
  if (!engine) throw new Error(`no voice could be generated: ${notes.join(" | ")}`);
  const timing = JSON.parse(readFileSync(wordsFile, "utf8"));
  const seconds = durationOf(mp3);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return { mp3, wordsFile, seconds, engine, notes, words: timing.words, sentences: timing.sentences, word_count: wordCount, wpm: Math.round((wordCount / seconds) * 600) / 10, playback_speed: 1 };
}

/**
 * Scenes and captions from the real narration. `sceneOfSentence[i]` is the index of the scene that sentence i belongs to.
 * The last scene holds briefly after the voice stops, so the final thought is not cut off.
 */
export function buildTimeline({ narration, sceneOfSentence, sceneMeta, tail = 0.45, maxWordsPerCaption = 5 }) {
  const { sentences, words, seconds } = narration;
  if (sentences.length !== sceneOfSentence.length) throw new Error(`narration has ${sentences.length} sentences but the scene map has ${sceneOfSentence.length}`);
  const total = Math.ceil((seconds + tail) * FPS);
  const firsts = [];
  sceneOfSentence.forEach((sc, i) => { if (firsts[sc] === undefined) firsts[sc] = i; });
  const scenes = sceneMeta.map((m, sc) => {
    const from = sc === 0 ? 0 : Math.round(sentences[firsts[sc]].start * FPS);
    const nextFirst = firsts[sc + 1];
    const to = nextFirst === undefined ? total : Math.round(sentences[nextFirst].start * FPS);
    return { ...m, from, to, start_s: from / FPS, end_s: to / FPS };
  });
  const captions = [];
  let group = [];
  const flush = () => { if (group.length) { captions.push({ text: group.map((w) => w.text).join(" "), from: Math.round(group[0].start * FPS), to: Math.round(group.at(-1).end * FPS) + 3, words: group.map((w) => ({ text: w.text, from: Math.round(w.start * FPS) })) }); group = []; } };
  words.forEach((w, i) => { group.push(w); const ends = /[.!?,;:]$/.test(w.text); const nextGap = words[i + 1] ? words[i + 1].start - w.end : 9; if (group.length >= maxWordsPerCaption || ends || nextGap > 0.35) flush(); });
  flush();
  for (let i = 0; i < captions.length - 1; i++) captions[i].to = Math.min(captions[i].to, captions[i + 1].from);
  return { scenes, captions, durationInFrames: total, duration_s: total / FPS };
}

/** Hard technical and timing gates on the real MP4. A failure here means the video does not ship. */
export function technicalQa({ video, narration, timeline, minSeconds = 24, maxSeconds = 30 }) {
  const failures = [], d = durationOf(video);
  const [width, height, rate, codec] = (() => { const v = probe(video, "stream=width,height,r_frame_rate,codec_name", "v:0").split(","); return [Number(v[1]), Number(v[2]), v[3], v[0]]; })();
  const [num, den] = rate.split("/").map(Number);
  const audioCodec = probe(video, "stream=codec_name", "a:0").replace(/,+$/, "");
  const log = (args) => spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...args, "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const vol = log(["-i", video, "-af", "volumedetect", "-vn"]);
  const maxVol = Number((vol.match(/max_volume: (-?[\d.]+)/) || [])[1]), meanVol = Number((vol.match(/mean_volume: (-?[\d.]+)/) || [])[1]);
  const black = (log(["-i", video, "-vf", "blackdetect=d=0.2:pix_th=0.02", "-an"]).match(/black_start/g) || []).length;
  const freeze = (log(["-i", video, "-vf", "freezedetect=n=0.0005:d=4", "-an"]).match(/freeze_start/g) || []).length;
  const check = (ok, why) => { if (!ok) failures.push(why); };
  check(d <= maxSeconds, `MP4 is ${d.toFixed(2)}s; the limit is ${maxSeconds}s`);
  check(d >= minSeconds, `MP4 is ${d.toFixed(2)}s; the target floor is ${minSeconds}s`);
  check(width === 1080 && height === 1920, `resolution ${width}x${height}`);
  check(den && num / den === 30, `frame rate ${rate}`);
  check(codec === "h264", `video codec ${codec}`);
  check(audioCodec === "aac", `audio codec ${audioCodec}`);
  check(Number.isFinite(meanVol) && meanVol > -35, `audio too quiet (${meanVol} dB mean)`);
  check(Number.isFinite(maxVol) && maxVol <= -0.1, `audio clipping (${maxVol} dB peak)`);
  check(black === 0, `${black} black segment(s)`);
  check(freeze === 0, `${freeze} frozen segment(s)`);
  check(narration.playback_speed === 1, "narration playback speed was altered");
  check(narration.wpm <= NATURAL_WPM_MAX, `narration runs ${narration.wpm} words a minute`);
  check(Math.abs(d - timeline.duration_s) < 0.5, `MP4 ${d.toFixed(2)}s disagrees with the timeline ${timeline.duration_s.toFixed(2)}s`);
  check(Math.abs(timeline.duration_s - narration.seconds) < 1.5, `timeline ${timeline.duration_s.toFixed(2)}s disagrees with the narration ${narration.seconds.toFixed(2)}s`);
  timeline.scenes.forEach((s, i) => {
    check(s.to > s.from, `scene ${s.id} has no length`);
    if (i) check(s.from === timeline.scenes[i - 1].to, `gap between scenes ${timeline.scenes[i - 1].id} and ${s.id}`);
  });
  check(timeline.scenes.at(-1).to === timeline.durationInFrames, "the last scene does not end with the video");
  return { pass: failures.length === 0, failures, duration_s: Number(d.toFixed(3)), width, height, frame_rate: rate, video_codec: codec, audio_codec: audioCodec, mean_volume_db: meanVol, max_volume_db: maxVol, black_segments: black, frozen_segments: freeze, narration: { engine: narration.engine, seconds: narration.seconds, words: narration.word_count, wpm: narration.wpm, playback_speed: narration.playback_speed, fallback_notes: narration.notes } };
}

/** Frames and a labelled sheet from the real video, using the timeline the video was built from. */
export async function publishFrames({ tools, video, timeline, objectiveOf }) {
  const outDir = tools.outDir;
  for (const s of timeline.scenes) execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", (s.start_s + (s.end_s - s.start_s) * 0.8).toFixed(2), "-i", video, "-frames:v", "1", "-q:v", "2", join(outDir, `scene-${s.id}.jpg`)]);
  return tools.contactSheet({ video, scenes: timeline.scenes.map((s) => ({ id: s.id, start_s: s.start_s, end_s: s.end_s, treatment: s.treatment || s.kind, objective: objectiveOf(s) })) });
}
