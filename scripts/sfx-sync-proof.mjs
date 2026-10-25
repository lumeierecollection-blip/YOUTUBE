#!/usr/bin/env node
/**
 * sfx-sync-proof — do the SFX in a rendered MP4 land on their visible event, within 100 ms?
 *
 * Owner, 2026-10-09: "Verify SFX align to their word or beat within ±100 ms." canvas-sfx.js lands each file's
 * measured peak on the frame its event is scheduled at, and Layer 1 sfx-rules checks that arithmetic on the
 * manifest. This checks the RENDER: the audio track of the MP4 is decoded and, around each event, the time of the
 * loudest sample is compared with the event's frame. Run on a render that has only SFX in it (the shot proof:
 * no voiceover, no bed — scripts/qa-canvas-render.mjs --sfx), where the loudest thing near an event IS that sound.
 *
 *   node scripts/sfx-sync-proof.mjs --video out/shots/canvas-test.mp4 --manifest out/shots/canvas-test-manifest.json
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
const video = arg("video"), manifestPath = arg("manifest");
if (!video || !manifestPath) { console.error("usage: sfx-sync-proof.mjs --video <mp4> --manifest <manifest.json>"); process.exit(2); }
const m = JSON.parse(readFileSync(manifestPath, "utf8"));
const FPS = m.fps || 30, TOL_MS = 100, RATE = 22050, WIN_S = 0.3;
const sfx = m.sfx || [];
if (!sfx.length) { console.error("::error::the manifest records no SFX — nothing to prove"); process.exit(1); }

const dec = spawnSync("ffmpeg", ["-v", "error", "-i", video, "-vn", "-ac", "1", "-ar", String(RATE), "-f", "s16le", "pipe:1"], { maxBuffer: 1 << 28 });
if (dec.status !== 0 || !dec.stdout.length) { console.error(`::error::could not decode audio from ${video}: ${String(dec.stderr).slice(0, 200)}`); process.exit(1); }
const pcm = new Int16Array(dec.stdout.buffer, dec.stdout.byteOffset, dec.stdout.length >> 1);

let bad = 0;
for (const e of sfx) {
  const t = e.event_frame / FPS;
  const lo = Math.max(0, Math.floor((t - WIN_S) * RATE)), hi = Math.min(pcm.length, Math.floor((t + WIN_S) * RATE));
  let peak = 0, at = -1;
  for (let i = lo; i < hi; i++) { const v = Math.abs(pcm[i]); if (v > peak) { peak = v; at = i; } }
  if (at < 0 || peak < 400) { bad++; console.log(`FAIL ${e.role} beat ${e.beat}: no sound near ${t.toFixed(3)} s (peak ${peak})`); continue; }
  const err = Math.round((at / RATE - t) * 1000);
  const ok = Math.abs(err) <= TOL_MS;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${e.role.padEnd(8)} beat ${String(e.beat).padStart(2)}  event ${t.toFixed(3)} s  loudest sample ${(at / RATE).toFixed(3)} s  error ${err >= 0 ? "+" : ""}${err} ms (max ±${TOL_MS})`);
}
console.log(bad ? `${bad} of ${sfx.length} SFX out of sync` : `all ${sfx.length} SFX within ±${TOL_MS} ms of their event`);
process.exit(bad ? 1 : 0);
