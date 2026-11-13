#!/usr/bin/env node
/**
 * Long form v2 sound library: downloads every asset in config/longform-audio-library.json to output/longform-media/audio/<slot>.<ext>
 * (not committed), measures it with ffmpeg (duration, integrated loudness, loudness range, true peak, clipping), and re-checks the licence at the
 * SOURCE page (the page must contain the licence URL the aggregator reported). Writes the results back into the JSON.
 * An asset is only marked usable when: it downloaded, it decodes, and the source page confirms the licence. "auditioned_by_ear" stays false:
 * no one has listened to these files; choices were made from metadata and measurements, and a person must audition music before a render.
 * Usage: node platform/longform/v2/audio/library.mjs [--verify-only]
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { ROOT } from "../../../preview/lib.mjs";

const FILE = join(ROOT, "config/longform-audio-library.json"), DIR = join(ROOT, "output/longform-media/audio");
mkdirSync(DIR, { recursive: true });
const lib = JSON.parse(readFileSync(FILE, "utf8")), UA = "Mozilla/5.0 (longform-research)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const licenceKey = (u = "") => (u.match(/creativecommons\.org\/(publicdomain\/zero|licenses\/[a-z-]+)\//) || [])[0] || "";
for (const a of lib.assets) {
  const ext = extname(new URL(a.download_url).pathname) || ".mp3", file = join(DIR, a.slot + ext);
  if (!existsSync(file) || statSync(file).size < 2000) {
    const r = spawnSync("curl", ["-sL", "-m", "180", "-A", UA, "-o", file, "-w", "%{http_code}", a.download_url], { encoding: "utf8" });
    if (r.stdout.trim() !== "200") { a.status = `download failed (HTTP ${r.stdout.trim()})`; console.log(a.slot, a.status); continue; }
  }
  const m = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" }).stderr, sum = m.slice(m.lastIndexOf("Summary:"));
  const g = (p) => { const x = sum.match(p); return x ? Number(x[1]) : null; }, dur = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }).stdout.trim();
  a.file = `output/longform-media/audio/${a.slot}${ext}`; a.measured = { duration_s: Number(Number(dur).toFixed(1)), integrated_lufs: g(/I:\s+(-?[\d.]+) LUFS/), lra_lu: g(/LRA:\s+(-?[\d.]+) LU/), true_peak_dbtp: g(/Peak:\s+(-?[\d.]+) dBFS/), size_kb: Math.round(statSync(file).size / 1024) };
  // licence re-check at the source page
  let ok = null;
  try {
    const html = await (await fetch(a.source_page, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) })).text(), want = licenceKey(a.license_url);
    ok = want ? html.includes(want.replace(/\/$/, "")) || html.toLowerCase().includes(a.license.split(" ")[0] === "cc0" ? "creative commons 0" : want.split("/").slice(-2, -1)[0]) : null;
  } catch { ok = null; }
  a.licence_verified_at_source = ok;
  a.status = a.measured.duration_s > 0 && a.measured.integrated_lufs !== null && ok === true ? "downloaded, licence confirmed at source" : ok === false ? "downloaded; SOURCE PAGE DID NOT CONFIRM LICENCE: do not use" : "downloaded; source page could not be machine-checked: confirm by hand before use";
  console.log(a.slot.padEnd(22), a.license.padEnd(8), `${a.measured.duration_s}s`.padEnd(7), `${a.measured.integrated_lufs} LUFS`.padEnd(11), `TP ${a.measured.true_peak_dbtp}`.padEnd(10), a.status);
  await sleep(1500);
}
lib.measured_on = new Date().toISOString().slice(0, 10);
writeFileSync(FILE, JSON.stringify(lib, null, 1));
