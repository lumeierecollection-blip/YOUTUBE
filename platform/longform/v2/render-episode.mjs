#!/usr/bin/env node
/**
 * Long-form episode renderer (new, Phase 4). Turns a v2 episode storyboard (platform/longform/v2/episodes/<channel>.mjs) into a 1920x1080 MP4:
 *   1. voice: one edge-tts clip per beat (cached; nothing re-voiced if the mp3 already exists), beat length = voice length + pad
 *   2. visuals: each beat rendered with the real LF2Scene component for exactly that length (cached per beat, written to .tmp then renamed)
 *   3. join: beats chained with short crossfades (ffmpeg xfade; the storyboard's bespoke LF2Tx transitions are NOT used here - a known limit)
 *   4. audio: voice + a few light sound effects from the channel cue rules (no music bed), two-pass loudnorm to -14 LUFS
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

const slug = process.argv[2], ch = slug.startsWith("hidden-past") ? "hidden-past" : slug.startsWith("ai-tested") ? "ai-tested" : slug.startsWith("rival-lines") ? "rival-lines" : slug; // slug = episode file name; ch = the channel it belongs to
const argv = process.argv.slice(3);
const opt = (n) => { const i = argv.indexOf(`--${n}`); return i > -1 ? argv[i + 1] : null; };
const ONLY = opt("beats")?.split(","), MAX = Number(opt("max-beats") || 0), SHARD = opt("shard"), NOJOIN = argv.includes("--no-join") || Boolean(SHARD); // --shard i/n renders only beats whose index % n == i and never joins (a later job joins)
const FPS = 30, PAD = 0.55, XF = 0.4;
const VOICE = { "hidden-past": "en-GB-RyanNeural", "ai-tested": "en-US-AndrewNeural", "rival-lines": "en-GB-RyanNeural" }; // Rival Lines: British, deep male voice (owner, 10 Nov 2026)
if (!VOICE[ch]) { console.error("channel must be one of", Object.keys(VOICE)); process.exit(1); }

const REMOTION = join(ROOT, "src/skills/remotion-render");
const OUT = join(ROOT, "output/longform-prod", slug), VDIR = join(OUT, "voice"), BDIR = join(OUT, "beats");
for (const d of [OUT, VDIR, BDIR]) mkdirSync(d, { recursive: true });
const THEMES = JSON.parse(readFileSync(join(ROOT, "config/longform-v2.json"), "utf8"));
const { EPISODE: ep } = await import(`./episodes/${slug}.mjs`);
let beats = ep.beats; if (ONLY) beats = beats.filter((b) => ONLY.includes(b.id)); if (MAX) beats = beats.slice(0, MAX);
if (SHARD) { const [si, sn] = SHARD.split("/").map(Number); beats = beats.filter((_, i) => i % sn === si); }

const run = (cmd, args, o = {}) => spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28, ...o });
const dur = (f) => Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).stdout.trim());
const log = { channel: ch, title: ep.title, started: new Date().toISOString(), beats: [], notes: [] };

// scene props exactly as the stills spec builds them (platform/longform/stills/specs.mjs sceneProps)
function sceneProps(scene) {
  const t = THEMES[ch], p = { ch, t, ...scene };
  if (scene.credit) p.t = { ...t, credit: scene.credit }; // per-scene data credit (club stories: sources are not StatsBomb)
  const ac = autoCredit(ch, scene); if (ac.length) p.autoCredit = ac;
  if (ch === "hidden-past") {
    if (scene.type === "map") p.theme = t.map;
    if (scene.type === "roster") p.groups = t.countries;
    if (scene.type === "chart") p.accent = t.accent;
  }
  return p;
}

// ---- 1. voice (Gemini TTS when a key is present, edge-tts as the recorded fallback; one clip per beat, cached)
const GRAV = { "hidden-past": "serious", "ai-tested": "serious", "rival-lines": "serious" };
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

// ---- 4. audio: narration plus a few light sound effects, placed by the channel's cue rules (config/longform-cue-rules.json). No music bed:
// the first cloud render's piano bed sounded like random noise to the owner, so there is none. Levels follow data/sfx-library.json (SFX well under the voice).
const SFXDIR = join(ROOT, "platform/longform/v2/audio/sfx");
const CUE = JSON.parse(readFileSync(join(ROOT, "config/longform-cue-rules.json"), "utf8"));
const LIBA = Object.fromEntries(JSON.parse(readFileSync(join(ROOT, "config/longform-audio-library.json"), "utf8")).assets.map((a) => [a.slot, a]));
const vLUFS = Number([...run("ffmpeg", ["-hide_banner", "-nostats", "-i", voiceOut, "-af", "ebur128", "-f", "null", "-"]).stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)?.[1]);
const starts = []; { let t0 = 0; for (const b of beats) { starts.push(t0); t0 += b._len - XF; } }
const events = [];
for (const rule of CUE.rules[ch] || []) {
  if (!["action", "accent"].includes(rule.type) || !String(rule.asset).startsWith("SFX_")) continue;
  for (const [i, b] of beats.entries()) {
    if (rule.scene && !rule.scene.includes(b.scene.type)) continue;
    let off = rule.offset_s || 0;
    if (rule.vo) {
      const m = new RegExp(rule.vo, "i").exec(b.vo); if (!m) continue;
      const wf = join(VDIR, `${b.id}.words.json`), w = existsSync(wf) ? (JSON.parse(readFileSync(wf, "utf8")).words || []) : [];
      const k = b.vo.slice(0, m.index).split(/\s+/).filter(Boolean).length; off = w[k]?.start ?? off;
    }
    if (rule.min_gap_s && starts[i] + off - (rule._last ?? -1e9) < rule.min_gap_s) continue; rule._last = starts[i] + off;
    events.push({ asset: rule.asset, at: starts[i] + off, rel: CUE.levels_db_rel_speech[rule.type], why: rule.purpose, beat: b.id });
    if (rule.first) break;
  }
}
// one soft whoosh where a new part of the story starts (not at every cut)
beats.forEach((b, i) => { if (i && b.part !== beats[i - 1].part) events.push({ asset: "SFX_WHOOSH", at: Math.max(0, starts[i] - 0.1), rel: -18, why: `new part: ${b.part}`, beat: b.id }); });
// the SFX library says "max 4 per 5 minutes": keep a part-change whoosh only if the previous kept whoosh is at least 45 s earlier (the chapter-change whooshes carry no story; the action and accent cues always stay)
{ let lastW = -1e9; events.sort((a, b) => a.at - b.at); const kept = []; for (const e of events) { if (e.asset === "SFX_WHOOSH") { if (e.at - lastW < 45) continue; lastW = e.at; } kept.push(e); } events.length = 0; events.push(...kept); }
const sfxFile = (a) => [".mp3", ".wav", ".ogg"].map((x) => join(SFXDIR, a + x)).find(existsSync);
const MUSICDIR = join(ROOT, "platform/longform/v2/audio/music");
const pre = join(OUT, "premaster.wav");
const sfxIn = [], sfxF = [];
events.forEach((e, j) => {
  const f = sfxFile(e.asset), len = e.asset === "SFX_KEYBOARD" ? 4 : 3, ms = Math.round(e.at * 1000);
  e.gain_db = +Math.min(6, vLUFS + e.rel - (LIBA[e.asset]?.measured?.integrated_lufs ?? -16)).toFixed(1);
  sfxIn.push("-i", f);
  sfxF.push(`[${j + 1}:a]atrim=0:${len},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=${e.gain_db}dB,afade=t=in:d=0.03,afade=t=out:st=${len - 0.7}:d=0.7,adelay=${ms}|${ms}[s${j}]`);
});
log.sfx = events;
// ---- music bed (owner, 14 Nov 2026: documentary-style background music under every video). One licensed track, looped with 4 s crossfades to the video length,
// set to bed_rel_db under the narration loudness, ducked further by sidechain compression while the voice speaks, dipped before a verdict, faded in and out.
const SND = ep.sound || null, bedIn = [], bedChain = []; let bedLabel = null;
if (SND?.bed) {
  const mf = join(MUSICDIR, `${SND.bed}.mp3`), md = dur(mf), XFB = 4, copies = Math.max(1, Math.ceil((total - XFB) / (md - XFB)));
  const mLUFS = LIBA[SND.bed]?.measured?.integrated_lufs ?? -12, gain = +(vLUFS + (SND.bed_rel_db ?? -22) - mLUFS).toFixed(1), bi = events.length + 1;
  for (let c = 0; c < copies; c++) bedIn.push("-i", mf);
  const idx = Array.from({ length: copies }, (_, c) => bi + c);
  let chain = `[${idx[0]}:a]aformat=sample_rates=48000:channel_layouts=stereo[b0]`;
  let last = "[b0]"; for (let c = 1; c < copies; c++) { bedChain.push(`[${idx[c]}:a]aformat=sample_rates=48000:channel_layouts=stereo[bx${c}]`); bedChain.push(`${last}[bx${c}]acrossfade=d=${XFB}:c1=tri:c2=tri[b${c}]`); last = `[b${c}]`; }
  const dips = []; beats.forEach((b, i) => { if ((SND.dip_scenes || []).includes(b.scene.type)) dips.push([starts[i], starts[i] + 1.6]); });
  const dipExpr = dips.reduce((acc, [a, b2]) => `if(between(t,${(a - 0.35).toFixed(2)},${(b2 + 0.6).toFixed(2)}),if(lt(t,${a.toFixed(2)}),1-0.88*(t-${(a - 0.35).toFixed(2)})/0.35,if(lt(t,${b2.toFixed(2)}),0.12,0.12+0.88*(t-${b2.toFixed(2)})/0.6)),${acc})`, "1");
  bedChain.unshift(chain);
  bedChain.push(`${last}atrim=0:${total.toFixed(2)},asetpts=PTS-STARTPTS,volume=${gain}dB,volume='${dipExpr}':eval=frame,afade=t=in:d=3,afade=t=out:st=${Math.max(0, total - 6).toFixed(2)}:d=6[bed0]`);
  bedChain.push(`[bed0][vcopy]sidechaincompress=threshold=0.02:ratio=6:attack=20:release=450:makeup=1[bed1]`);
  bedLabel = "[bed1]";
  log.music = { slot: SND.bed, track_s: +md.toFixed(1), loops: copies, level_db_rel_voice: SND.bed_rel_db ?? -22, applied_gain_db: gain, dips: dips.map(([a]) => +a.toFixed(1)), attribution: LIBA[SND.bed]?.attribution, source: LIBA[SND.bed]?.source_page };
  writeFileSync(join(OUT, "credits.txt"), `Music: ${LIBA[SND.bed]?.attribution || SND.bed}
Source: ${LIBA[SND.bed]?.source_page || ""}
`);
}
const sfxNames = events.map((_, j) => `[s${j}]`).join(""), nMix = events.length + 1 + (bedLabel ? 1 : 0);
const mixGraph = [...sfxF, ...bedChain, `[0:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[v0][vcopy]`, `[v0]${sfxNames}${bedLabel || ""}amix=inputs=${nMix}:normalize=0:duration=first[mx]`].join(";");
r = run("ffmpeg", ["-y", "-v", "error", "-i", voiceOut, ...sfxIn, ...bedIn, "-filter_complex", mixGraph, "-map", "[mx]", "-ar", "48000", pre]);
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
log.notes.push("transitions are ffmpeg crossfades, not the storyboard's LF2Tx transitions", "no music bed (owner: the piano bed sounded like noise); a few light SFX only; nothing auditioned by ear");
log.finished = new Date().toISOString(); log.total_s = +total.toFixed(1);
writeFileSync(join(OUT, "render-log.json"), JSON.stringify(log, null, 2));
console.log("DONE", join(OUT, "episode.mp4"), total.toFixed(1), "s");
