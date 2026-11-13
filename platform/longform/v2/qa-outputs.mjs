#!/usr/bin/env node
/** Technical QA of the finished files for a channel: size, duration, codecs, loudness, true peak, long silences. Usage: node qa-outputs.mjs <channel>. Writes output/longform-prod/<channel>/qa.json; exit 1 if any file fails. */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";
const slug = process.argv[2], BASE = join(ROOT, "output/longform-prod", slug);
const run = (c, a) => spawnSync(c, a, { encoding: "utf8", maxBuffer: 1 << 28 });
function probe(f, want) {
  const j = JSON.parse(run("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", f]).stdout || "{}");
  const v = (j.streams || []).find((s) => s.codec_type === "video"), a = (j.streams || []).find((s) => s.codec_type === "audio"), d = Number(j.format?.duration || 0);
  const e = run("ffmpeg", ["-hide_banner", "-nostats", "-i", f, "-af", "ebur128=peak=true,silencedetect=n=-50dB:d=3", "-f", "null", "-"]).stderr;
  const I = Number([...e.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)?.[1]), TP = Number([...e.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].at(-1)?.[1]), sil = (e.match(/silence_start/g) || []).length;
  const decode = run("ffmpeg", ["-v", "error", "-i", f, "-f", "null", "-"]).stderr.trim();
  const fails = [];
  if (!v || !a) fails.push("missing video or audio stream");
  if (v && (v.width !== want.w || v.height !== want.h)) fails.push(`size ${v.width}x${v.height}, wanted ${want.w}x${want.h}`);
  if (d < want.min || d > want.max) fails.push(`duration ${d.toFixed(1)}s outside ${want.min}-${want.max}s`);
  if (!(I > -17 && I < -11)) fails.push(`loudness ${I} LUFS outside -17..-11`);
  if (TP > -0.9) fails.push(`peak ${TP} dBFS (clipping risk)`);
  if (sil) fails.push(`${sil} silent stretch(es) of 3 s or more`);
  if (decode) fails.push(`decode errors: ${decode.slice(0, 120)}`);
  return { file: f.replace(ROOT, ""), width: v?.width, height: v?.height, codec: v?.codec_name, audio: a?.codec_name, seconds: +d.toFixed(2), LUFS: I, peak_dBFS: TP, silences: sil, bytes: statSync(f).size, pass: fails.length === 0, fails };
}
const out = [];
const ep = join(BASE, "episode.mp4"); if (existsSync(ep)) out.push(probe(ep, { w: 1920, h: 1080, min: 120, max: 900 })); else out.push({ file: "episode.mp4", pass: false, fails: ["missing"] });
const sh = join(BASE, "shorts"); if (existsSync(sh)) for (const d of readdirSync(sh)) { const f = join(sh, d, "short.mp4"); if (existsSync(f)) out.push(probe(f, { w: 1080, h: 1920, min: 22, max: 41 })); }
const th = join(BASE, "thumbnails"); if (existsSync(th)) for (const f of readdirSync(th).filter((x) => x.endsWith(".jpg"))) { const s = statSync(join(th, f)).size; const j = run("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", join(th, f)]).stdout.trim(); out.push({ file: `thumbnails/${f}`, size: j, bytes: s, pass: j === "1280,720" && s < 2e6, fails: j === "1280,720" && s < 2e6 ? [] : [`thumbnail ${j}, ${s} bytes`] }); }
writeFileSync(join(BASE, "qa.json"), JSON.stringify(out, null, 2));
for (const r of out) console.log(r.pass ? "PASS" : "FAIL", r.file, r.fails.join("; "));
process.exit(out.every((r) => r.pass) ? 0 : 1);
