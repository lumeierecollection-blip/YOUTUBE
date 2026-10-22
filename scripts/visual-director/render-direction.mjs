#!/usr/bin/env node
/**
 * render-direction.mjs — render a RESOLVED scene direction (schemas/scene-direction.json) through Remotion's
 * DirectedShots composition (src/skills/remotion-render/shots/).
 *
 *   node scripts/visual-director/render-direction.mjs --direction <direction.json> --out <video.mp4>
 *        [--audio <voiceover.mp3|wav>] [--words <word-timings.json>] [--proof] [--focus <focus.json>]
 *        [--no-captions] [--scale 0.5] [--frames-only]
 *
 *   --audio    the voiceover. Without it a SILENT track the length of the direction is generated with ffmpeg
 *              (said in the log and in <out>.shots.json "audio": "silent").
 *   --words    [{word, start, end}] seconds. Without it, word timings are SYNTHESISED by spreading each beat's
 *              sentence evenly over [t_start, t_end] (said in the log and "words": "synthetic").
 *   --proof    proof mode: a material whose resolved.status != "verified" renders as a marked placeholder.
 *              Without --proof (production) such a direction is refused: exit 2 before anything renders.
 *   --focus    { "<material id>": {"x":0..1, "y":0..1} } — the schema has no focus point; without one a close
 *              framing centres on the material's centre.
 *   --frames-only  write the props + sidecars and stop (no browser); used by tests.
 *
 * Sidecars next to <out>: .shots.json (every shot's frame window, camera, text slot — the CI frame extractor reads
 * the boundaries from it), .sfx.json (every sfx cue: mapped to a committed file or recorded as unmapped),
 * .credits.json (credit lines for the drawn materials, the existing credits.js rule).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname, extname, isAbsolute, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import Ajv from "ajv";
import { resolveChannel } from "../lib/channel-lookup.mjs";
import { paletteFor } from "../../src/skills/remotion-render/clone/clone-palette.js";
import { scheduleShots, FPS } from "../../src/skills/remotion-render/shots/geometry.js";
import { eventAt } from "../../src/skills/remotion-render/shots/mechanisms.js";
import { mapSfx } from "../../src/skills/remotion-render/shots/sfx-map.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const RR = join(ROOT, "src", "skills", "remotion-render");
const require = createRequire(import.meta.url);

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const flag = (k) => argv.includes(`--${k}`);

function compositorDir() {
  const pkg = process.platform === "win32" ? "@remotion/compositor-win32-x64-msvc" : process.platform === "darwin" ? (process.arch === "arm64" ? "@remotion/compositor-darwin-arm64" : "@remotion/compositor-darwin-x64") : "@remotion/compositor-linux-x64-gnu";
  try { return dirname(require.resolve(`${pkg}/package.json`)); } catch { return null; }
}
const COMP = compositorDir();
const bin = (name) => {
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  if (COMP && existsSync(join(COMP, exe))) return join(COMP, exe);
  return name;
};
const runBin = (name, args) => spawnSync(bin(name), args, { encoding: "utf-8", env: { ...process.env, LD_LIBRARY_PATH: COMP || "" } });

function probe(file) {
  const r = runBin("ffprobe", ["-v", "error", "-show_entries", "stream=width,height,pix_fmt,duration:format=duration", "-of", "json", file]);
  if (r.status !== 0) throw new Error(`ffprobe failed on ${file}: ${r.stderr}`);
  const j = JSON.parse(r.stdout);
  const st = (j.streams || [])[0] || {};
  return { w: st.width, h: st.height, pix: st.pix_fmt || "", duration: parseFloat(j.format?.duration || st.duration || "0") };
}

/** Resolve resolved.file: absolute, repo-relative, or relative to the renderer's public/ directory. */
function findFile(f) {
  if (!f) return null;
  for (const c of [isAbsolute(f) ? f : null, join(ROOT, f), join(RR, "public", f)]) if (c && existsSync(c)) return c;
  return null;
}

export function synthWords(direction) {
  const out = [];
  for (const b of direction.beats) {
    const ws = b.sentence.split(/\s+/).filter(Boolean);
    const span = Math.max(0.1, b.t_end - b.t_start), step = span / ws.length;
    ws.forEach((w, i) => out.push({ word: w.replace(/[^\p{L}\p{N}%$£€'.,-]/gu, ""), start: +(b.t_start + i * step).toFixed(3), end: +(b.t_start + (i + 0.9) * step).toFixed(3) }));
  }
  return out;
}

export async function main() {
  const dirPath = arg("direction");
  const outPath = resolve(arg("out", "out/vd-shots/video.mp4"));
  if (!dirPath) { console.error("usage: render-direction.mjs --direction <file> --out <mp4> [--audio f] [--words f] [--proof]"); process.exit(64); }
  const proof = flag("proof");
  const direction = JSON.parse(readFileSync(dirPath, "utf-8"));

  // 1. schema
  const ajv = new Ajv({ allErrors: true, strict: false, useDefaults: true });
  const validate = ajv.compile(JSON.parse(readFileSync(join(ROOT, "schemas", "scene-direction.json"), "utf-8")));
  if (!validate(direction)) {
    console.error("[render-direction] direction is not schema-valid:\n" + ajv.errorsText(validate.errors, { separator: "\n" }));
    process.exit(3);
  }

  // 2. channel: font and every colour from config/channels.json
  const ch = resolveChannel(direction.channel_id);
  const roles = paletteFor(ch.clone?.profile ? { ground: ch.clone.profile.ground } : {}, ch);
  const palette = { ...roles, ground: (ch.clone && ch.clone.ground) || (ch.colors && ch.colors.bg) || roles.ground };
  const channel = { id: ch.channel_id, font: `"${ch.font || "Inter"}", Inter, sans-serif`, palette };

  // 3. materials
  const stem = basename(outPath, extname(outPath));
  const pubRel = `vd-shots/${stem}`;
  const pubDir = join(RR, "public", ...pubRel.split("/"));
  mkdirSync(pubDir, { recursive: true });
  mkdirSync(dirname(outPath), { recursive: true });
  const focus = arg("focus") ? JSON.parse(readFileSync(arg("focus"), "utf-8")) : {};
  const materials = {};
  const refused = [];
  const assumptions = [];
  for (const b of direction.beats) for (const s of b.shots) for (const m of s.materials) {
    if (m.kind === "data" || materials[m.id]) continue;
    const status = m.resolved?.status || "missing";
    const file = status === "verified" ? findFile(m.resolved.file) : null;
    if (status !== "verified" || !file) {
      refused.push(`${s.id}/${m.id}: ${status}${status === "verified" ? " but file not found: " + m.resolved.file : ""}`);
      materials[m.id] = { status: status === "verified" ? "missing" : status, w: 1080, h: 1920, focus: { x: 0.5, y: 0.5 } };
      continue;
    }
    const ext = extname(file).toLowerCase() || ".jpg";
    copyFileSync(file, join(pubDir, `${m.id}${ext}`));
    const pr = probe(file);
    if (!focus[m.id]) assumptions.push(`${m.id}: no focus point (schema has none) -> centre`);
    materials[m.id] = {
      status: "verified", src: `${pubRel}/${m.id}${ext}`, w: pr.w, h: pr.h, alpha: /rgba|bgra|argb|abgr|ya8|ya16|rgba64/.test(pr.pix),
      focus: focus[m.id] || { x: 0.5, y: 0.5 }, credit: m.resolved.credit || null, license: m.resolved.license || null, source_url: m.resolved.source_url || null,
    };
  }
  if (refused.length) {
    console.error(`[render-direction] ${refused.length} material(s) not verified:\n  ${refused.join("\n  ")}`);
    if (!proof) { console.error("[render-direction] production mode: refusing to render an unverified material (use --proof for a marked placeholder)"); process.exit(2); }
    console.error("[render-direction] PROOF MODE: those materials render as marked placeholders");
  }

  // 4. audio
  const lastEnd = Math.max(...direction.beats.map((b) => b.t_end));
  let audioRel = null, audioKind = "voiceover", duration = lastEnd + 0.4;
  if (arg("audio")) {
    const a = resolve(arg("audio"));
    const ext = extname(a) || ".mp3";
    copyFileSync(a, join(pubDir, `vo${ext}`));
    audioRel = `${pubRel}/vo${ext}`;
    duration = Math.max(duration, probe(a).duration + 0.2);
  } else {
    audioKind = "silent";
    const r = runBin("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", String(duration), join(pubDir, "vo.wav")]);
    if (r.status !== 0) throw new Error(`could not generate the silent track: ${r.stderr}`);
    audioRel = `${pubRel}/vo.wav`;
    console.log(`[render-direction] no --audio: rendering over a SILENT ${duration.toFixed(1)} s track`);
  }
  const totalFrames = Math.ceil(duration * FPS);

  // 5. word timings + captions (the production page builder)
  let words, wordsKind = "voiceover";
  if (arg("words")) words = JSON.parse(readFileSync(arg("words"), "utf-8"));
  else { words = synthWords(direction); wordsKind = "synthetic"; console.log("[render-direction] no --words: word timings SYNTHESISED evenly across each beat"); }
  let captions = [];
  if (!flag("no-captions")) {
    const { buildCaptionPages } = await import("../../src/skills/remotion-render/compositions/beats.js");
    captions = buildCaptionPages(words.map((w) => ({ text: w.word, fromMs: Math.round(w.start * 1000), toMs: Math.round(w.end * 1000) })), { fps: FPS });
  }

  // 6. schedule (the same function the composition uses) -> sfx cues + shot boundaries
  const sched = scheduleShots(direction, FPS, totalFrames);
  const sfxRecord = [], sfx = [];
  for (const s of sched) {
    if (!s.shot.sfx) continue;
    const at = s.from + Math.round(s.dur * eventAt(s.beat.mechanism.family));
    const hit = mapSfx(s.shot.sfx, s.shot.transition_out);
    sfxRecord.push({ shot: s.shot.id, cue: s.shot.sfx, atFrame: at, file: hit ? `sfx/${hit.file}` : null, mapped: !!hit });
    if (hit) sfx.push({ file: hit.file, db: hit.db, atFrame: at, trigger: s.shot.id });
  }

  // 7. credits (credits.js rule, over the materials actually drawn)
  const { creditEntries } = await import("../../src/skills/remotion-render/credits.js");
  const credits = creditEntries({ beats: direction.beats.map((b) => ({ index: b.beat_index, canvas: { concept_visuals: b.shots.flatMap((s) => s.materials).filter((m) => materials[m.id]?.status === "verified").map((m) => ({ asset: materials[m.id].src, name: m.id, license: materials[m.id].license, credit: materials[m.id].credit, source_url: materials[m.id].source_url })) } })) });

  const props = { direction, materials, words, captions, audio: audioRel, sfx, channel, proof, totalFrames };
  const base = outPath.replace(/\.mp4$/i, "");
  writeFileSync(`${base}.props.json`, JSON.stringify(props, null, 1));
  writeFileSync(`${base}.shots.json`, JSON.stringify({
    fps: FPS, totalFrames, audio: audioKind, words: wordsKind, proof, assumptions, refused,
    shots: sched.map((s) => ({ id: s.shot.id, beat: s.beatIndex, from: s.from, to: s.from + s.dur, family: s.beat.mechanism.family, move: s.shot.camera.move, transition_out: s.shot.transition_out || "cut" })),
  }, null, 1));
  writeFileSync(`${base}.sfx.json`, JSON.stringify({ note: "shot sfx cues; mapped ones play through visual/audio-mix.js SfxPalette, unmapped ones are only recorded here", cues: sfxRecord }, null, 1));
  writeFileSync(`${base}.credits.json`, JSON.stringify({ lines: credits.lines, all: Object.entries(materials).filter(([, m]) => m.status === "verified").map(([id, m]) => ({ id, credit: m.credit, license: m.license, source_url: m.source_url })) }, null, 1));
  console.log(`[render-direction] ${sched.length} shots, ${totalFrames} frames; sidecars at ${base}.*.json`);
  if (flag("frames-only")) return;

  // 8. render
  const VO = join(RR, "vo.mp3");
  if (!existsSync(VO)) runBin("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "2", "-c:a", "libmp3lame", VO]); // audio.js imports it at bundle time
  const { bundle } = await import("@remotion/bundler");
  const { selectComposition, renderMedia } = await import("@remotion/renderer");
  const { findChrome } = await import("../../src/skills/remotion-render/find-chrome.js");
  const browserExecutable = findChrome();
  const serveUrl = await bundle({ entryPoint: join(RR, "Root.jsx"), publicDir: join(RR, "public"), onProgress: () => {} });
  const composition = await selectComposition({ serveUrl, id: "DirectedShots", inputProps: props, browserExecutable });
  const t0 = Date.now();
  let last = 0;
  await renderMedia({
    serveUrl, composition: { ...composition, durationInFrames: totalFrames }, codec: "h264", audioCodec: "aac", inputProps: props,
    outputLocation: outPath, browserExecutable, imageFormat: "jpeg", crf: 20, pixelFormat: "yuv420p",
    scale: parseFloat(arg("scale", "1")), concurrency: Math.max(1, parseInt(process.env.RENDER_CONCURRENCY || "4", 10)),
    timeoutInMilliseconds: 120000,
    onProgress: ({ renderedFrames }) => { if (Date.now() - last > 5000) { last = Date.now(); console.log(`[progress] ${renderedFrames}/${totalFrames}`); } },
  });
  console.log(`[render-direction] rendered ${outPath} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
