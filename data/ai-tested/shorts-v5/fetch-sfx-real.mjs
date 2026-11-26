// Downloads real, CC0 sound effects found through the Openverse audio API (Freesound previews) into assets/sfx2,
// peak-normalises each to -3 dBFS, trims to maxDur with a short fade, and writes assets/sfx2/SOURCES.json
// (title, creator, licence, source page, Openverse id). Nothing here is synthesised. Not auditioned by ear.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "assets", "sfx2");
fs.mkdirSync(outDir, { recursive: true });

const PICKS = [
  { file: "whoosh_quick.mp3", id: "34ba7605-bc18-4609-909c-87e4dc25bba9", maxDur: 1.0, role: "short clean whoosh for cuts and slides" },
  { file: "whoosh_swipe.mp3", id: "b7ae7822-8ec5-4a82-b6f8-d539b51caa61", maxDur: 0.6, role: "swipe for sweeps and map opens" },
  { file: "boom_hit.mp3", id: "4c99d7d3-4987-46f3-9637-bfd9b4cc66b9", maxDur: 1.6, role: "hard hit on a cut to the key verb" },
  { file: "slam.mp3", id: "b0268d44-39b2-42b7-ad52-2572b3a66c54", maxDur: 1.4, role: "bassy slam for a heavy landing" },
  { file: "thud_medium.mp3", id: "cf6310c4-6e77-4f81-a946-89126065ece7", maxDur: 1.0, role: "medium thud for a word landing" },
  { file: "glitch_vhs.mp3", id: "632037d6-c1fd-47ae-91bc-67d60723feb8", maxDur: 1.2, role: "glitch on a glitch cut" },
  { file: "glitch_corrupt.mp3", id: "cf912290-c563-49b4-827a-6d577cf4b69d", maxDur: 1.3, role: "data corruption for the breach word" },
  { file: "rev_cymbal.mp3", id: "16cb6afc-853e-4546-a842-8e391ce56e1f", maxDur: 2.0, role: "reverse swell into a reveal" },
  { file: "bass_drop.mp3", id: "af807b88-5d74-48e6-9a8d-cb579aac9ecd", maxDur: 3.0, role: "final bass drop on the closing question" },
  { file: "error_beep.mp3", id: "a7f0e1bc-5a53-4aae-9340-a80f9f5e461b", maxDur: 0.6, role: "computer error for a failed test" },
  { file: "switch_click.mp3", id: "54d1af5d-4be2-4ae5-8330-19ab19ee8d71", maxDur: 0.4, role: "light switch for a hard cut to dark" },
  { file: "chime.mp3", id: "adb6e260-e493-43fd-a56e-8ceb4f477fe2", maxDur: 0.8, role: "soft chime for a calm statement" },
];

const sh = (c, a) => spawnSync(c, a, { encoding: "utf8", maxBuffer: 1 << 26 });
const log = [];
for (const p of PICKS) {
  const meta = await (await fetch(`https://api.openverse.org/v1/audio/${p.id}/`, { headers: { "User-Agent": "ai-tested-sfx/1.0" } })).json();
  if (!["cc0", "pdm", "by"].includes(meta.license)) throw new Error(`${p.file}: licence ${meta.license} refused`);
  const raw = path.join(outDir, `.raw-${p.file}`);
  const res = await fetch(meta.url);
  if (!res.ok) throw new Error(`${p.file}: download HTTP ${res.status}`);
  fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  const vd = sh("ffmpeg", ["-hide_banner", "-i", raw, "-t", String(p.maxDur), "-af", "volumedetect", "-f", "null", "-"]);
  const m = /max_volume:\s*(-?[\d.]+) dB/.exec(vd.stderr);
  const gain = m ? -3 - parseFloat(m[1]) : 0;
  const fade = Math.min(0.15, p.maxDur / 4);
  const dst = path.join(outDir, p.file);
  const r = sh("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", raw, "-t", String(p.maxDur), "-af", `volume=${gain.toFixed(2)}dB,afade=t=out:st=${(p.maxDur - fade).toFixed(2)}:d=${fade.toFixed(2)}`, "-ar", "44100", "-ac", "2", "-b:a", "160k", dst]);
  fs.unlinkSync(raw);
  if (r.status !== 0) throw new Error(`${p.file}: ffmpeg ${r.stderr}`);
  log.push({ file: p.file, role: p.role, title: meta.title, creator: meta.creator, license: `${meta.license} ${meta.license_version}`, license_url: meta.license_url, source_page: meta.foreign_landing_url, download_url: meta.url, openverse_id: p.id, gain_db: +gain.toFixed(2), max_dur_s: p.maxDur, auditioned_by_ear: false });
  console.log(`ok ${p.file} <- "${meta.title}" by ${meta.creator} (${meta.license}) gain ${gain.toFixed(1)} dB`);
}
const srcPath = path.join(outDir, "SOURCES.json");
const prev = fs.existsSync(srcPath) ? JSON.parse(fs.readFileSync(srcPath, "utf8")) : [];
const keep = prev.filter((x) => !log.some((l) => l.file === x.file));
fs.writeFileSync(srcPath, JSON.stringify([...keep, ...log], null, 1));
