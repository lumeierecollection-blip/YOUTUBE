#!/usr/bin/env node
/**
 * sfx-cc0.mjs — the SFX palette: RECORDED sounds, CC0, fetched with no API key.
 *
 * Source: Remotion's SFX library (https://www.remotion.dev/docs/sfx). Every file there names the
 * recording it came from (Freesound / kenney.nl) and its licence, Creative Commons 0; the contributor
 * guide (https://www.remotion.dev/docs/contributing/sfx) requires CC0 and WAV. Checked 2026-10-09,
 * per file, on each file's own docs page (quoted in SFX_SOURCES). Not used:
 *   - sfx-elements (tryelements.dev): "CC0" in a subtitle, but no author or origin for any sound —
 *     provenance unknown, so not taken (CLAUDE.md: no sound that did not come from an actual source).
 *   - Freesound's API: its free tier is non-commercial. (A Freesound recording reached through
 *     Remotion's CDN is that recording under its own CC0 licence.)
 *
 *   node scripts/sfx-cc0.mjs fetch   download each missing file into public/sfx/cc0/ (the runner's
 *                                    cache keeps them across runs) and write CREDITS.json there
 *   node scripts/sfx-cc0.mjs judge   THE GATE: Gemini listens to every file and answers whether it is a
 *                                    real recording or a robotic tone (defined below) -> verdicts.json.
 *                                    Only "recorded" files may play (render.js); a video that plays any
 *                                    other fails Layer 1 sfx-recorded (local-audit.cjs).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CC0_DIR = join(ROOT, "src", "skills", "remotion-render", "public", "sfx", "cc0");
export const VERDICTS = join(CC0_DIR, "verdicts.json");
// The verdicts are ALSO kept in the repository (owner, 2026-10-10): the CI cache for sfx/cc0 has a static key, and GitHub never overwrites a
// cache key, so the verdicts written by one job were never restored by the next. Every channel's judge job then re-sent all three files
// (3 files x 3 votes = 9 Gemini audio calls per channel per board). The file is keyed by each recording's sha256, so committing it is safe:
// the same bytes get the same verdict without a call. The pipeline commits data/sfx/verdicts.json after the judge step.
export const TRACKED_VERDICTS = join(ROOT, "data", "sfx", "verdicts.json");

/** Every sound the palette may play. `file` is what canvas-sfx.js names (sfx/cc0/<file>). */
export const SFX_SOURCES = Object.freeze([
  { file: "whoosh.wav", url: "https://remotion.media/whoosh.wav", title: "Woosh", author: "1bob", source: "https://freesound.org/s/831936/", license: "CC0 1.0", page: "https://www.remotion.dev/docs/sfx/whoosh", seconds: 0.154 },
  { file: "whip.wav", url: "https://remotion.media/whip.wav", title: "SWSH_Badminton Racquet_Recording_01_JW Audio", author: "JW_Audio", source: "https://freesound.org/s/838766/", license: "CC0 1.0", page: "https://www.remotion.dev/docs/sfx/whip", seconds: 0.173 },
  { file: "draw-knife.wav", url: "https://remotion.media/page-turn.wav", title: "Draw Knife 1 (served by Remotion as 'page-turn')", author: "Kenney", source: "https://kenney.nl", license: "CC0 1.0", page: "https://www.remotion.dev/docs/sfx/page-turn", seconds: 0.4 },
  { file: "shutter.wav", url: "https://remotion.media/shutter-modern.wav", title: "DSLR Shutter fast 006.wav", author: "ristooooo1", source: "https://freesound.org/s/539136/", license: "CC0 1.0", page: "https://www.remotion.dev/docs/sfx/shutter-modern", seconds: 0.489 },
  { file: "switch.wav", url: "https://remotion.media/switch.wav", title: "UI Audio - Switch 35", author: "Kenney", source: "https://kenney.nl", license: "CC0 1.0", page: "https://www.remotion.dev/docs/sfx/ui-switch", seconds: 0.33 },
]);

/** The definition the judge answers to (the owner's, 2026-10-09). */
export const ROBOTIC = "ROBOTIC means any of: a pure sine, square, triangle or sawtooth tone; formant-less synthesis (an oscillator, not a physical event); audible text-to-speech artifacts; a loop click or a hard digital edge at the start or end. RECORDED means a microphone captured a physical event (air moving, an object, a mechanism), with the natural noise, decay and room that come with it.";

async function fetchAll() {
  mkdirSync(CC0_DIR, { recursive: true });
  const credits = [];
  for (const s of SFX_SOURCES) {
    const out = join(CC0_DIR, s.file);
    if (!existsSync(out)) {
      const res = await fetch(s.url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`${s.url}: HTTP ${res.status}`);
      writeFileSync(out, Buffer.from(await res.arrayBuffer()));
      console.log(`[sfx] fetched ${s.url} -> sfx/cc0/${s.file}`);
    } else console.log(`[sfx] cached sfx/cc0/${s.file}`);
    const buf = readFileSync(out);
    const sha256 = createHash("sha256").update(buf).digest("hex");
    const w = wavPeak(buf);
    const t = tonality(buf);
    credits.push({ ...s, sha256, ...w, tonality: t });
    console.log(`[sfx] ${s.file}: ${w.duration_ms} ms, loudest sample at ${w.peak_ms} ms (${w.peak_dbfs} dBFS); spectral flatness ${t.flatness}, top-3-bin power ${(t.top3_power_share * 100).toFixed(1)}%`);
  }
  // CC0 asks for no attribution; the provenance is recorded anyway.
  writeFileSync(join(CC0_DIR, "CREDITS.json"), JSON.stringify({ fetched_at: new Date().toISOString(), credits }, null, 2) + "\n");
  console.log(`[sfx] ${credits.length} CC0 file(s) ready; credits: sfx/cc0/CREDITS.json`);
}

/**
 * A PCM / float WAV's length and the time of its loudest sample — the moment a sound "hits", which
 * canvas-sfx.js lands on the visible event (a whoosh peaks mid-file, a shutter at its first click).
 */
export function wavPeak(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") throw new Error("not a RIFF/WAVE file");
  let fmt = null, data = null;
  for (let o = 12; o + 8 <= buf.length;) {
    const id = buf.toString("ascii", o, o + 4), size = buf.readUInt32LE(o + 4);
    if (id === "fmt ") fmt = { tag: buf.readUInt16LE(o + 8), ch: buf.readUInt16LE(o + 10), rate: buf.readUInt32LE(o + 12), bits: buf.readUInt16LE(o + 22), sub: size >= 40 ? buf.readUInt16LE(o + 32) : 0 };
    if (id === "data") data = { start: o + 8, size: Math.min(size, buf.length - o - 8) };
    o += 8 + size + (size & 1);
  }
  if (!fmt || !data) throw new Error("WAV without fmt/data chunk");
  const bps = fmt.bits / 8, frame = bps * fmt.ch, n = Math.floor(data.size / frame);
  const float = fmt.tag === 3 || (fmt.tag === 0xfffe && fmt.sub === 3); // WAVE_FORMAT_IEEE_FLOAT, plain or extensible
  const read = (off) => float ? buf.readFloatLE(off)
    : bps === 2 ? buf.readInt16LE(off) / 32768 : bps === 3 ? buf.readIntLE(off, 3) / 8388608 : bps === 4 ? buf.readInt32LE(off) / 2147483648 : (buf.readUInt8(off) - 128) / 128;
  let peak = 0, at = 0;
  for (let i = 0; i < n; i++) for (let c = 0; c < fmt.ch; c++) { const v = Math.abs(read(data.start + i * frame + c * bps)); if (v > peak) { peak = v; at = i; } }
  return { duration_ms: Math.round((n / fmt.rate) * 1000), peak_ms: Math.round((at / fmt.rate) * 1000), peak_dbfs: peak > 0 ? Math.round(20 * Math.log10(peak) * 10) / 10 : -Infinity, rate: fmt.rate, channels: fmt.ch, bits: fmt.bits };
}

/**
 * A measurement that does not depend on any model: how tonal the sound is. Spectral flatness (geometric / arithmetic
 * mean of the power spectrum around the loudest sample; ~0 for a pure tone, toward 1 for noise) and the share of the
 * power in the three strongest bins (a sine puts nearly all of it there). Reported beside Gemini's verdict —
 * evidence, not a second gate.
 */
export function tonality(buf) {
  const { samples, rate } = wavSamples(buf);
  const N = 4096;
  let at = 0, pk = 0; for (let i = 0; i < samples.length; i++) if (Math.abs(samples[i]) > pk) { pk = Math.abs(samples[i]); at = i; }
  const start = Math.max(0, Math.min(samples.length - N, at - N / 2));
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) { const v = samples[start + i] ?? 0; re[i] = v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))); }
  for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; } }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) {
      const wr = Math.cos(ang * k), wi = Math.sin(ang * k), a = i + k, b = i + k + len / 2;
      const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
    }
  }
  const pow = []; for (let i = 1; i < N / 2; i++) pow.push(re[i] * re[i] + im[i] * im[i] + 1e-18);
  const sum = pow.reduce((a, b) => a + b, 0), geo = Math.exp(pow.reduce((a, b) => a + Math.log(b), 0) / pow.length), top3 = [...pow].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
  return { flatness: +(geo / (sum / pow.length)).toExponential(2), top3_power_share: +(top3 / sum).toFixed(3), rate };
}

/** { "cc0/<file>": frames from the start to the loudest sample } from CREDITS.json (empty if not fetched). */
export function peakFrames(fps = 30) {
  try { return Object.fromEntries(JSON.parse(readFileSync(join(CC0_DIR, "CREDITS.json"), "utf8")).credits.map((c) => [`cc0/${c.file}`, Math.round((c.peak_ms / 1000) * fps)])); } catch { return {}; }
}

/** The credit line for a played file ("cc0/<file>"): source URL, author, licence, the URL it came from. */
export function creditFor(file) {
  const f = String(file || "").replace(/^cc0\//, "");
  const s = SFX_SOURCES.find((x) => x.file === f);
  return s ? { title: s.title, author: s.author, source: s.source, license: s.license, url: s.url } : null;
}

/** A WAV (any PCM depth or float, any channel count) as mono samples in -1..1 + its rate. */
export function wavSamples(buf) {
  let fmt = null, data = null;
  for (let o = 12; o + 8 <= buf.length;) {
    const id = buf.toString("ascii", o, o + 4), size = buf.readUInt32LE(o + 4);
    if (id === "fmt ") fmt = { tag: buf.readUInt16LE(o + 8), ch: buf.readUInt16LE(o + 10), rate: buf.readUInt32LE(o + 12), bits: buf.readUInt16LE(o + 22), sub: size >= 40 ? buf.readUInt16LE(o + 32) : 0 };
    if (id === "data") data = { start: o + 8, size: Math.min(size, buf.length - o - 8) };
    o += 8 + size + (size & 1);
  }
  if (!fmt || !data) throw new Error("WAV without fmt/data chunk");
  const bps = fmt.bits / 8, frame = bps * fmt.ch, n = Math.floor(data.size / frame);
  const float = fmt.tag === 3 || (fmt.tag === 0xfffe && fmt.sub === 3);
  const read = (off) => float ? buf.readFloatLE(off) : bps === 2 ? buf.readInt16LE(off) / 32768 : bps === 3 ? buf.readIntLE(off, 3) / 8388608 : bps === 4 ? buf.readInt32LE(off) / 2147483648 : (buf.readUInt8(off) - 128) / 128;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) { let v = 0; for (let c = 0; c < fmt.ch; c++) v += read(data.start + i * frame + c * bps); out[i] = v / fmt.ch; }
  return { samples: out, rate: fmt.rate };
}
/** A 16-bit mono WAV from samples in -1..1. */
export function wavFromSamples(samples, rate) {
  const n = samples.length, b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return b;
}
/** The sound three times with half a second of silence between: a 150 ms click gives a listener little to go on. */
export function padded(buf) {
  const { samples, rate } = wavSamples(buf), gap = Math.round(rate * 0.5);
  const out = new Float32Array(samples.length * 3 + gap * 4);
  for (let k = 0; k < 3; k++) out.set(samples, gap + k * (samples.length + gap));
  return wavFromSamples(out, rate);
}

export const JUDGE_VERSION = 2;
const NO_HEARING = /no (audio|sound)|not (detected|audible)|cannot (hear|detect)|can't (hear|detect)|silen|nothing (to|was)|unable to/i;
const QUESTION = `${ROBOTIC}\nAnswer ONLY with JSON: {"verdict": "recorded" | "robotic", "why": "<one sentence: what you hear>"}`;
const DESCRIBE = `Listen carefully, then decide. ${ROBOTIC}\nFirst name the physical event or instrument you hear and whether its pitch is steady or varying, whether it has noise, a decay and a room around it. Answer ONLY with JSON: {"heard": "<what you hear>", "steady_pure_pitch": true | false, "verdict": "recorded" | "robotic", "why": "<one sentence>"}`;

/** One vote: { verdict: "recorded" | "robotic" | "unjudged", why }. Hearing nothing is unjudged, never robotic. */
async function vote(buf, prompt, call) {
  const ans = await call([{ role: "user", content: [{ type: "text", text: prompt }, { type: "input_audio", input_audio: { data: buf.toString("base64"), format: "wav" } }] }]);
  // callGemini returns the parsed JSON when the reply is JSON, else { content }; read both.
  const text = typeof ans?.content === "string" ? ans.content : "";
  const v = String(ans?.verdict || (text.match(/"verdict"\s*:\s*"(recorded|robotic)"/i) || [])[1] || "").toLowerCase();
  const why = String(ans?.why || (text.match(/"why"\s*:\s*"([^"]*)"/) || [])[1] || "").slice(0, 200);
  if ((v === "recorded" || v === "robotic") && !NO_HEARING.test(why)) return { verdict: v, why };
  const seen = NO_HEARING.test(why) ? `heard nothing: ${why}` : ans?.error ? `${ans.error} ${String(ans.detail || "")}` : `no verdict in: ${JSON.stringify(ans).slice(0, 200)}`;
  return { verdict: "unjudged", why: seen.slice(0, 260) };
}

/**
 * One file's verdict: three listens — the file as it is, the file three times over with silence between, and a
 * describe-first question — and the majority of the conclusive ones decides. (CI run 37924535060: one listen at
 * temperature 0 called a real 154 ms whoosh and a real DSLR shutter "a pure synthesized sine wave", and the same
 * files "recorded" a run earlier — a single listen to a short click is not reliable.) Fewer than two conclusive
 * votes, or a tie, is "unjudged" and the file does not play.
 */
export async function judgeOne(file, call) {
  const raw = readFileSync(join(CC0_DIR, file));
  const votes = [await vote(raw, QUESTION, call), await vote(padded(raw), QUESTION, call), await vote(raw, DESCRIBE, call)];
  const rec = votes.filter((v) => v.verdict === "recorded").length, rob = votes.filter((v) => v.verdict === "robotic").length;
  const verdict = rec + rob < 2 || rec === rob ? "unjudged" : rec > rob ? "recorded" : "robotic";
  const pick = votes.find((v) => v.verdict === verdict) || votes[0];
  return { verdict, why: `${pick.why} [votes: ${votes.map((v) => v.verdict).join("/")}]`.slice(0, 300), votes, provider: verdict === "unjudged" ? null : "gemini" };
}
/** A verdict is reused only for the same bytes (sha256), the same judge version, and a settled answer (recorded or robotic). */
export function reusablePrior(prior, sha256) {
  return !!prior && prior.sha256 === sha256 && prior.judge_version === JUDGE_VERSION && (prior.verdict === "recorded" || prior.verdict === "robotic");
}
async function judgeAll() {
  // Google first: callGemini rotates every key, then the sibling models, before it gives up. Only
  // Gemini hears audio here — no other provider's answer may stand in (an unjudged file does not play).
  const { callGemini } = await import("../src/lib/gemini-client.js");
  const call = (messages) => callGemini(messages, { model: "gemini-3.5-flash", maxTokens: 2000, temperature: 0, noCache: true, tag: "sfx-judge" });
  const verdicts = {};
  let before = {};
  for (const f of [TRACKED_VERDICTS, VERDICTS]) {
    try { before = { ...JSON.parse(readFileSync(f, "utf8")).verdicts || {}, ...before }; } catch { /* missing: first run */ }
  }
  for (const s of SFX_SOURCES) {
    if (!existsSync(join(CC0_DIR, s.file))) { verdicts[s.file] = { verdict: "unjudged", why: "not fetched" }; continue; }
    // A verdict belongs to the file's CONTENT (sha256): the runner cache keeps verdicts.json with the files,
    // so a file Gemini already judged is not sent again (ten parallel render jobs x five audio calls were
    // part of what exhausted the keys on board 37919459134).
    const sha256 = createHash("sha256").update(readFileSync(join(CC0_DIR, s.file))).digest("hex");
    const prior = before[s.file];
    if (reusablePrior(prior, sha256)) {
      verdicts[s.file] = prior;
      console.log(`[sfx-judge] ${s.file}: ${prior.verdict.toUpperCase()} (judged earlier, same file) — ${prior.why}`);
      continue;
    }
    verdicts[s.file] = { ...(await judgeOne(s.file, call)), sha256, judge_version: JUDGE_VERSION };
    console.log(`[sfx-judge] ${s.file}: ${verdicts[s.file].verdict.toUpperCase()} — ${verdicts[s.file].why}`);
  }
  const doc = JSON.stringify({ judged_at: new Date().toISOString(), definition: ROBOTIC, verdicts }, null, 2) + "\n";
  writeFileSync(VERDICTS, doc);
  mkdirSync(join(ROOT, "data", "sfx"), { recursive: true });
  writeFileSync(TRACKED_VERDICTS, doc);
  const ok = Object.values(verdicts).filter((v) => v.verdict === "recorded").length;
  console.log(`[sfx-judge] ${ok}/${SFX_SOURCES.length} recorded; only those may play`);
}

/** A 16-bit mono PCM WAV of `wave(t)` (-1..1), `sec` long — the negative controls for selftest. */
export function synthWav(wave, sec = 0.4, rate = 44100) {
  const n = Math.floor(sec * rate), b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, wave(i / rate))) * 0.6 * 32767), 44 + i * 2);
  return b;
}

/**
 * THE JUDGE CAN FAIL: three obviously synthesized sounds (a sine, a square wave, a sawtooth sweep) go
 * through the same question and must come back "robotic". If the judge calls any of them recorded it is not
 * listening, and the job fails.
 */
async function selftest() {
  const { callGemini } = await import("../src/lib/gemini-client.js");
  const call = (messages) => callGemini(messages, { model: "gemini-3.5-flash", maxTokens: 2000, temperature: 0, noCache: true, tag: "sfx-judge" });
  const controls = {
    "control-sine.wav": (t) => Math.sin(2 * Math.PI * 440 * t),
    "control-square.wav": (t) => (Math.sin(2 * Math.PI * 330 * t) >= 0 ? 1 : -1),
    "control-saw-sweep.wav": (t) => 2 * ((220 + 400 * t) * t % 1) - 1,
  };
  mkdirSync(CC0_DIR, { recursive: true });
  let bad = 0;
  for (const [file, wave] of Object.entries(controls)) {
    writeFileSync(join(CC0_DIR, file), synthWav(wave));
    const v = await judgeOne(file, call);
    const t = tonality(readFileSync(join(CC0_DIR, file)));
    console.log(`[sfx-selftest] ${file}: spectral flatness ${t.flatness}, top-3-bin power ${(t.top3_power_share * 100).toFixed(1)}%`);
    const ok = v.verdict === "robotic";
    if (!ok) bad++;
    console.log(`[sfx-selftest] ${file}: ${v.verdict.toUpperCase()} (want ROBOTIC) — ${v.why}`);
  }
  if (bad) throw new Error(`the judge called ${bad} synthesized control(s) anything but robotic — it is not a gate`);
  console.log("[sfx-selftest] the judge rejects all three synthesized controls");
}

/** The files allowed to play ("cc0/<file>", as canvas-sfx.js names them): judged "recorded". */
export function recordedFiles() {
  try { const v = JSON.parse(readFileSync(VERDICTS, "utf8")).verdicts || {}; return new Set(Object.entries(v).filter(([, x]) => x.verdict === "recorded").map(([f]) => `cc0/${f}`)); } catch { return new Set(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cmd = process.argv[2];
  (cmd === "fetch" ? fetchAll() : cmd === "judge" ? judgeAll() : cmd === "selftest" ? selftest() : Promise.reject(new Error("usage: sfx-cc0.mjs fetch|judge|selftest")))
    .catch((e) => { console.error(`::error::[sfx] ${e.message}`); process.exit(1); });
}
