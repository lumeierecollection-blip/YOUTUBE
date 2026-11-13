#!/usr/bin/env node
/**
 * Long-form episode renderer (new, Phase 4). Turns a v2 episode storyboard (platform/longform/v2/episodes/<channel>.mjs) into a 1920x1080 MP4:
 *   1. voice: one edge-tts clip per beat (cached; nothing re-voiced if the mp3 already exists), beat length = voice length + pad
 *   2. visuals: each beat rendered with the real LF2Scene component for exactly that length (cached per beat, written to .tmp then renamed)
 *   3. join: beats chained with short crossfades (ffmpeg xfade; the storyboard's bespoke LF2Tx transitions are NOT used here - a known limit)
 *   4. audio: voice + one licensed music bed ducked under the voice (bed chosen per channel in MUSIC below), two-pass loudnorm to -14 LUFS
 * Usage: node platform/longform/v2/render-episode.mjs <channel> [--beats H01,H02] [--max-beats N] [--no-join]
 * Output: output/longform-prod/<channel>/ (voice/, beats/, episode.mp4, render-log.json). Nothing here uploads.
 * Known limits are written into render-log.json, not hidden.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { narrate } from "../../production/index.mjs";
import { ROOT } from "../../preview/lib.mjs";
import { autoCredit } from "./credits.mjs";

const ch = process.argv[2];
const argv = process.argv.slice(3);
const opt = (n) => { const i = argv.indexOf(`--${n}`); return i > -1 ? argv[i + 1] : null; };
const ONLY = opt("beats")?.split(","), MAX = Number(opt("max-beats") || 0), NOJOIN = argv.includes("--no-join");
const FPS = 30, PAD = 0.55, XF = 0.4;
const VOICE = { "hidden-past": "en-GB-RyanNeural", "ai-tested": "en-US-AndrewNeural" };
// Music chosen by subject, never by availability (see docs/longform/SOUND-LIBRARY-REGISTER.md; MUSIC_TECH is rejected as a comedy track).
const MUSIC = { "hidden-past": "MUSIC_HISTORY_DOC", "ai-tested": "MUSIC_ATMOS_DARK" };
if (!VOICE[ch]) { console.error("channel must be one of", Object.keys(VOICE)); process.exit(1); }

const REMOTION = join(ROOT, "src/skills/remotion-render");
const OUT = join(ROOT, "output/longform-prod", ch), VDIR = join(OUT, "voice"), BDIR = join(OUT, "beats");
for (const d of [OUT, VDIR, BDIR]) mkdirSync(d, { recursive: true });
const THEMES = JSON.parse(readFileSync(join(ROOT, "config/longform-v2.json"), "utf8"));
const { EPISODE: ep } = await import(`./episodes/${ch}.mjs`);
let beats = ep.beats; if (ONLY) beats = beats.filter((b) => ONLY.includes(b.id)); if (MAX) beats = beats.slice(0, MAX);

const run = (cmd, args, o = {}) => spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28, ...o });
const dur = (f) => Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).stdout.trim());
const log = { channel: ch, title: ep.title, started: new Date().toISOString(), beats: [], notes: [] };

// scene props exactly as the stills spec builds them (platform/longform/stills/specs.mjs sceneProps)
function sceneProps(scene) {
  const t = THEMES[ch], p = { ch, t, ...scene };
  const ac = autoCredit(ch, scene); if (ac.length) p.autoCredit = ac;
  if (ch === "hidden-past") {
    if (scene.type === "map") p.theme = t.map;
    if (scene.type === "roster") p.groups = t.countries;
    if (scene.type === "chart") p.accent = t.accent;
  }
  return p;
}

// ---- 1. voice (Gemini TTS when a key is present, edge-tts as the recorded fallback; one clip per beat, cached)
const GRAV = { "hidden-past": "serious", "ai-tested": "serious" };
for (const b of beats) {
  const mp3 = join(VDIR, `${b.id}.mp3`);
  if (!existsSync(mp3) || dur(mp3) < 0.5) {
    const r = await narrate({ text: b.vo, edgeVoice: VOICE[ch], outDir: VDIR, name: `${b.id}.tmp`, gravity: GRAV[ch] });
    renameSync(r.mp3, mp3); renameSync(r.wordsFile, join(VDIR, `${b.id}.words.json`));
    log.notes.push(`voice ${b.id}: ${r.engine}, ${r.wpm} wpm`);
  }
  b._voice = mp3; b._len = dur(mp3) + PAD;
  console.log("voice", b.id, b._len.toFixed(1), "s");
}

// ---- 2. visuals
const { bundle } = await import(pathFor("@remotion/bundler")), { openBrowser, renderMedia, selectComposition } = await import(pathFor("@remotion/renderer"));
function pathFor(m) { return pathToFileURL(createRequire(join(REMOTION, "package.json")).resolve(m)).href; }
const { findChrome } = await import(pathToFileURL(join(REMOTION, "find-chrome.js")).href);
const chrome = findChrome();
if (!existsSync(join(REMOTION, "vo.mp3"))) run("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "1", join(REMOTION, "vo.mp3")]);
const serveUrl = await bundle({ entryPoint: join(REMOTION, "Root.jsx"), publicDir: join(REMOTION, "public"), onProgress: () => {} });
const browser = await openBrowser("chrome", { ...(chrome ? { browserExecutable: chrome } : {}), chromiumOptions: { gl: "swangle" } });
for (const b of beats) {
  const final = join(BDIR, `${b.id}.mp4`);
  if (existsSync(final) && Math.abs(dur(final) - b._len) < 0.3) { console.log("beat cached", b.id); continue; }
  const t0 = Date.now(), props = sceneProps(b.scene), frames = Math.ceil(b._len * FPS);
  const composition = await selectComposition({ serveUrl, id: "LF2Scene", inputProps: props, puppeteerInstance: browser, timeoutInMilliseconds: 180000 });
  composition.durationInFrames = frames;
  const tmp = join(BDIR, `${b.id}.tmp.mp4`);
  await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: tmp, inputProps: props, puppeteerInstance: browser, muted: true, everyNthFrame: 2, concurrency: Number(process.env.CONC || 1), crf: 20, pixelFormat: "yuv420p", timeoutInMilliseconds: 180000 });
  renameSync(tmp, final);
  const sec = (Date.now() - t0) / 1000;
  log.beats.push({ id: b.id, type: b.scene.type, seconds: +b._len.toFixed(2), frames, render_s: +sec.toFixed(1) });
  console.log("beat", b.id, b.scene.type, `${frames} frames in ${sec.toFixed(0)} s`);
}
await browser.close({ silent: true });
if (NOJOIN) { writeFileSync(join(OUT, "render-log.json"), JSON.stringify(log, null, 2)); process.exit(0); }

// ---- 3. join: video chain with crossfades; voice chain with the matching overlap
const n = beats.length, inputs = [], vf = [], af = [];
beats.forEach((b, i) => { inputs.push("-i", join(BDIR, `${b.id}.mp4`)); });
beats.forEach((b) => inputs.push("-i", b._voice));
const norm = beats.map((_, i) => `[${i}:v]fps=${FPS}[n${i}]`);
vf.push(...norm);
let vlab = "[n0]", acc = beats[0]._len;
for (let i = 1; i < n; i++) { vf.push(`${vlab}[n${i}]xfade=transition=fade:duration=${XF}:offset=${(acc - XF).toFixed(3)}[v${i}]`); vlab = `[v${i}]`; acc += beats[i]._len - XF; }
// voice: each clip starts where its beat's video starts (after the previous overlap), padded to its beat length
let start = 0; const adel = [];
beats.forEach((b, i) => { adel.push(`[${n + i}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=${Math.round(start * 1000)}|${Math.round(start * 1000)}[a${i}]`); start += b._len - XF; });
const total = acc;
const voiceOut = join(OUT, "voice-track.wav");
let r = run("ffmpeg", ["-y", "-v", "error", ...beats.map((b) => ["-i", b._voice]).flat(), "-filter_complex", `${adel.map((s, i) => s.replace(`[${n + i}:a]`, `[${i}:a]`)).join(";")};${beats.map((_, i) => `[a${i}]`).join("")}amix=inputs=${n}:normalize=0:duration=longest[o]`, "-map", "[o]", "-t", total.toFixed(2), "-ar", "48000", voiceOut]);
if (r.status !== 0) { console.error(r.stderr); process.exit(3); }
const silent = join(OUT, "video-silent.tmp.mp4");
r = run("ffmpeg", ["-y", "-v", "error", ...beats.map((b) => ["-i", join(BDIR, `${b.id}.mp4`)]).flat(), "-filter_complex", vf.join(";"), "-map", vlab, "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS), silent]);
if (r.status !== 0) { console.error(r.stderr); process.exit(3); }

// ---- 4. audio mix: music bed (-20 dB, ducked by sidechain from voice), fades, two-pass loudnorm
const musicFile = join(ROOT, "platform/longform/v2/audio/beds", `${MUSIC[ch]}.mp3`);
const pre = join(OUT, "premaster.wav");
r = run("ffmpeg", ["-y", "-v", "error", "-i", voiceOut, "-stream_loop", "-1", "-i", musicFile, "-filter_complex",
  `[1:a]atrim=0:${total.toFixed(2)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=-19dB,afade=t=in:d=3,afade=t=out:st=${(total - 5).toFixed(2)}:d=5[mus];[0:a]asplit=2[vo][key];[mus][key]sidechaincompress=threshold=0.04:ratio=3:attack=30:release=600[duck];[vo][duck]amix=inputs=2:normalize=0:duration=first[mx]`, "-map", "[mx]", "-ar", "48000", pre]);
if (r.status !== 0) { console.error(r.stderr); process.exit(4); }
const m = run("ffmpeg", ["-hide_banner", "-nostats", "-i", pre, "-af", "loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json", "-f", "null", "-"]).stderr;
const J = JSON.parse(m.slice(m.lastIndexOf("{"), m.lastIndexOf("}") + 1));
const master = join(OUT, "master.wav");
r = run("ffmpeg", ["-y", "-v", "error", "-i", pre, "-af", `loudnorm=I=-14:TP=-1.5:LRA=9:measured_I=${J.input_i}:measured_TP=${J.input_tp}:measured_LRA=${J.input_lra}:measured_thresh=${J.input_thresh}:offset=${J.target_offset}:linear=true,alimiter=limit=0.89:level=false`, "-ar", "48000", master]);
if (r.status !== 0) { console.error(r.stderr); process.exit(4); }

// ---- final mux, written to a temp name then renamed
const tmpFinal = join(OUT, "episode.tmp.mp4");
r = run("ffmpeg", ["-y", "-v", "error", "-i", silent, "-i", master, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", tmpFinal]);
if (r.status !== 0) { console.error(r.stderr); process.exit(5); }
renameSync(tmpFinal, join(OUT, "episode.mp4"));
log.notes.push("transitions are ffmpeg crossfades, not the storyboard's LF2Tx transitions", "music bed chosen from the licensed library by subject; not auditioned by ear", `music: ${MUSIC[ch]}`);
log.finished = new Date().toISOString(); log.total_s = +total.toFixed(1);
writeFileSync(join(OUT, "render-log.json"), JSON.stringify(log, null, 2));
console.log("DONE", join(OUT, "episode.mp4"), total.toFixed(1), "s");
