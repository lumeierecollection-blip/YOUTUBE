#!/usr/bin/env node
/**
 * Renders an SX Short (props: output/sx/<slug>/props.json) with Remotion, in shards on GitHub.
 *   node platform/shorts-sx/render.mjs <slug> --shard i/n   -> output/sx/<slug>/parts/part-<i>.mp4 (frames [i*F/n, (i+1)*F/n))
 *   node platform/shorts-sx/render.mjs <slug> --join         -> output/sx/<slug>/short.mp4 (parts concatenated + the narration, -14 LUFS)
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../.."), REMOTION = join(ROOT, "src/skills/remotion-render");
const slug = process.argv[2], OUT = join(ROOT, "output/sx", slug), PARTS = join(OUT, "parts"); mkdirSync(PARTS, { recursive: true });
const props = JSON.parse(readFileSync(join(OUT, "props.json"), "utf8"));
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : null; };

if (process.argv.includes("--join")) {
  const parts = readdirSync(PARTS).filter((f) => /^part-\d+\.mp4$/.test(f)).sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5)));
  writeFileSync(join(PARTS, "list.txt"), parts.map((f) => `file '${join(PARTS, f).replace(/\\/g, "/")}'`).join("\n"));
  // two-pass loudnorm (measured, then linear): the one-pass filter left the Shorts at -15.4 / -16.0 LUFS
  const LN = "loudnorm=I=-14:TP=-1.5:LRA=11";
  const m = JSON.parse((spawnSync("ffmpeg", ["-hide_banner", "-i", join(OUT, "voice.mp3"), "-af", `${LN}:print_format=json`, "-f", "null", "-"], { encoding: "utf8" }).stderr.match(/\{[\s\S]*?\}/) || ["{}"])[0]);
  const vf = m.input_i ? `${LN}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true` : LN;
  // SFX (owner, 19 Nov 2026: the Shorts must have SFX), placed from the shot timeline. Files are CC0 / Mixkit free licence, credits in
  // public/sfx/CREDITS.md and public/sfx/interface-kenney/LICENSE.txt. Levels sit under the voice (measured voice at -14 LUFS).
  const SFX = { whoosh: ["sfx/whoosh.mp3", 0.55], thud: ["sfx/impact.mp3", 0.7], pop: ["sfx/pop.mp3", 0.45], tick: ["sfx/number-count.mp3", 0.3], sweep: ["sfx/interface-kenney/maximize_001.wav", 0.25], chime: ["sfx/reveal.mp3", 0.5] };
  const ev = [];
  // calm Shorts (owner, 19 Nov 2026: the first SFX were "not good at all"): real recordings, CC0 (Remotion SFX library, sources in
  // scripts/sfx-cc0.mjs): a camera shutter as a photo appears, a page turn for page captures, a switch for logos, a soft whoosh otherwise.
  if (props.calm) for (const n of ["shutter-modern", "page-turn", "switch", "whoosh"]) { const f = join(REMOTION, "public/sfx/cc0", `${n}.wav`);   // git-ignored: fetched like scripts/sfx-cc0.mjs does
    if (!existsSync(f)) { mkdirSync(dirname(f), { recursive: true }); const r = await fetch(`https://remotion.media/${n}.wav`, { signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error(`sfx ${n}: HTTP ${r.status}`); writeFileSync(f, Buffer.from(await r.arrayBuffer())); } }
  if (props.calm) { Object.assign(SFX, { shutter: ["sfx/cc0/shutter-modern.wav", 0.22], page: ["sfx/cc0/page-turn.wav", 0.35], click: ["sfx/cc0/switch.wav", 0.3], swish: ["sfx/cc0/whoosh.wav", 0.28] });
    props.shots.forEach((s, i) => { if (!i) return; const t = s.f0 / 30, k = s.kind;
      ev.push([k === "capture" || k === "page" ? "page" : k === "logo" || k === "brand" ? "click" : s.img && !s.video ? "shutter" : "swish", Math.max(0, t - 0.04)]); }); }
  else for (const s of props.shots) {
    const t = s.f0 / 30;
    if (s.auto) ev.push(["tick", t]);
    else if (s.kind === "cta") ev.push(["chime", t]);
    else if (s.strobe || s.kind === "brand" || s.kind === "year") ev.push(["thud", t], ["whoosh", Math.max(0, t - 0.08)]);
    else ev.push(["whoosh", Math.max(0, t - 0.08)]);
    if (s.kind === "capture") ev.push(["sweep", t + 0.2]);
  }
  if (!props.calm) for (const w of props.words) if (w.key) ev.push(["pop", w.t0]);
  ev.sort((a, b) => a[1] - b[1]);
  const kept = ev.filter((e, i) => !ev.slice(0, i).some((p) => p[0] === e[0] && e[1] - p[1] < 0.12));   // no doubled hits
  const used = [...new Set(kept.map((e) => e[0]))], ins = [], fc = [`[1:a]${vf}[v]`], mix = ["[v]"];
  used.forEach((k, ui) => { ins.push("-i", join(REMOTION, "public", SFX[k][0])); const mine = kept.filter((e) => e[0] === k);
    fc.push(`[${ui + 2}:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=${mine.length}${mine.map((_, j) => `[${k}${j}]`).join("")}`);
    mine.forEach((e, j) => { const ms = Math.round(e[1] * 1000); fc.push(`[${k}${j}]adelay=${ms}|${ms},volume=${SFX[k][1]}[${k}d${j}]`); mix.push(`[${k}d${j}]`); }); });
  fc.push(`${mix.join("")}amix=inputs=${mix.length}:normalize=0:duration=longest,alimiter=limit=0.89,apad[a]`);
  console.log(`sfx: ${kept.length} events (${used.map((k) => `${k} ${kept.filter((e) => e[0] === k).length}`).join(", ")})`);
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(PARTS, "list.txt"), "-i", join(OUT, "voice.mp3"), ...ins, "-filter_complex", fc.join(";"), "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", join(OUT, "short.mp4")], { stdio: "inherit" });
  console.log(`joined ${parts.length} parts -> ${join(OUT, "short.mp4")}`); process.exit(r.status);
}
const [si, sn] = (arg("shard") || "0/1").split("/").map(Number), F = props.frames, a = Math.floor((si * F) / sn), b = Math.floor(((si + 1) * F) / sn) - 1;
const req = createRequire(join(REMOTION, "package.json")), imp = (m) => import(pathToFileURL(req.resolve(m)).href);
const { bundle } = await imp("@remotion/bundler"), { renderMedia, selectComposition } = await imp("@remotion/renderer");
const { findChrome } = await import(pathToFileURL(join(REMOTION, "find-chrome.js")).href), chrome = findChrome();
// Root.jsx imports ./vo.mp3; a fresh checkout has none (it is git-ignored), so make the same 1 s silent placeholder render-episode.mjs makes
if (!existsSync(join(REMOTION, "vo.mp3"))) spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "1", join(REMOTION, "vo.mp3")]);
const serveUrl = await bundle({ entryPoint: join(REMOTION, "Root.jsx"), publicDir: join(REMOTION, "public"), onProgress: () => {} });
const composition = await selectComposition({ serveUrl, id: "SX", inputProps: props, timeoutInMilliseconds: 180000, ...(chrome ? { browserExecutable: chrome } : {}) });
composition.durationInFrames = F;
// Chrome sometimes fails to start on a runner ("Timed out after 25000 ms while trying to connect to the browser", runs 44436176648,
// 44493239812, 44512615699): retry the shard up to 3 times instead of failing the run
for (let attempt = 1; ; attempt++) try { await renderMedia({ composition, serveUrl, codec: "h264", inputProps: props, frameRange: [a, b], outputLocation: join(PARTS, `part-${si}.mp4`), crf: 16, pixelFormat: "yuv420p", concurrency: 2, timeoutInMilliseconds: 180000, chromiumOptions: { gl: "swangle" }, ...(chrome ? { browserExecutable: chrome } : {}) }); break; } catch (e) { if (attempt >= 3 || !/connect to the browser|Target closed|Protocol error/i.test(String(e.message))) throw e; console.log(`shard ${si}: browser start failed (attempt ${attempt}), retrying`); }
console.log(`shard ${si}/${sn}: frames ${a}-${b} -> part-${si}.mp4`);
