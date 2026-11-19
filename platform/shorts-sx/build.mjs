#!/usr/bin/env node
/**
 * SX Shorts: turns a spec (platform/shorts-sx/specs/<slug>.mjs) + the narration's real word timings (output/sx/<slug>/words.json, faster-whisper)
 * + fetched assets into Remotion props (output/sx/<slug>/props.json) for the SX composition (src/skills/remotion-render/channels/sx).
 * Captions show the SCRIPT's own words (aligned to the transcription by anchors), never the transcriber's spelling.
 * Key shots come from the spec; between them a new picture is added every ~0.45 s (v1) / ~0.5 s (v3), the measured reference rhythm.
 * Usage: node platform/shorts-sx/build.mjs <slug>
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../.."), PUB = join(ROOT, "src/skills/remotion-render/public");
const slug = process.argv[2], S = await import(`./specs/${slug}.mjs`), OUT = join(ROOT, "output/sx", slug); mkdirSync(OUT, { recursive: true });
const FPS = 30, norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const toks = S.SCRIPT.split(/\s+/).filter(Boolean).map((raw) => ({ raw, key: /^\*.*\*[.,!?:;]*$/.test(raw), w: raw.replace(/\*/g, "") }));
const W = JSON.parse(readFileSync(join(OUT, "words.json"), "utf8"));

// anchors: script token i <-> transcribed word j where the normalised text matches, in order; other tokens are interpolated between anchors
const anc = [[-1, 0, W[0].t0]]; let j = 0;
toks.forEach((t, i) => { const n = norm(t.w); if (!n) return; for (let k = j; k < Math.min(W.length, j + 6); k++) if (norm(W[k].w) === n) { anc.push([i, W[k].t0, W[k].t1]); j = k + 1; return; } });
anc.push([toks.length, W[W.length - 1].t1, W[W.length - 1].t1]);
for (let a = 0; a < anc.length - 1; a++) { const [i0, s0] = anc[a], [i1, s1] = anc[a + 1]; for (let i = i0 + 1; i < i1; i++) { const k = (i - i0) / (i1 - i0); toks[i].t0 = s0 + (s1 - s0) * k; } if (i0 >= 0) toks[i0].t0 = s0; }
toks.forEach((t, i) => { t.t1 = i + 1 < toks.length ? toks[i + 1].t0 : W[W.length - 1].t1; });
console.log(`aligned ${anc.length - 2}/${toks.length} script words to the transcription`);

// phrases: up to 3 words, broken at punctuation (the references show 1-3 words at a time)
let p = 0, n = 0;
const words = toks.map((t, i) => { const o = { w: t.w.replace(/[*]/g, ""), t0: +t.t0.toFixed(3), t1: +t.t1.toFixed(3), p, i, key: t.key }; if (t.key) Object.assign(o, S.KEYS[norm(t.w)] || {}, { w: o.w.replace(/[.,!?:;]+$/, "") }); n++; if (n >= 3 || /[.,!?:;]$/.test(t.w)) { p++; n = 0; } return o; });

const foot = (id) => (existsSync(join(PUB, `lf2/footage/${id}.mp4`)) ? `lf2/footage/${id}.mp4` : null);
const att = (() => { try { return JSON.parse(readFileSync(join(PUB, "lf2/ai-tested/ATTRIBUTIONS.json"), "utf8")); } catch { return {}; } })();
const photo = (id) => (att[id] && existsSync(join(PUB, "lf2/ai-tested", att[id].file)) ? { img: `lf2/ai-tested/${att[id].file}`, credit: att[id].credit_line } : null);
const cap = (id, phrase) => { const f = join(PUB, "sx", slug, `${id}.json`); if (!existsSync(f)) return null; const m = JSON.parse(readFileSync(f, "utf8")), r = (m.rects || {})[phrase]; if (!r || !r.length) return null;
  // zoomed on the quoted line like the reference captures: a 760-px-wide window of the page around the phrase
  const cx = Math.max(0, Math.min(r[0].x - 90, m.viewport.width - 760));
  return { img: `sx/${slug}/${id}-0.png`, pw: m.viewport.width, cw: 760, cx, cy: Math.max(0, r[0].y - 170), ch: 560, rects: r, credit: "Wikipedia (CC BY-SA 4.0), captured " + m.captured.slice(0, 10) }; };
const VCRED = "Pixabay · illustrative";

function realise(s) {
  const o = { ...s }; delete o.at;
  if (s.media) { const v = foot(s.media); if (v) Object.assign(o, { video: v, credit: VCRED }); else if (s.kind === "full" || s.kind === "inset" || s.kind === "year") o.kind = s.kind === "year" ? "page" : "paper"; }
  if (s.photo) { const ph = photo(s.photo); if (ph) Object.assign(o, ph); else o.kind = "paper"; }
  if (s.kind === "logo") { const ph = photo(s.logo); if (ph) Object.assign(o, ph); else Object.assign(o, { kind: "paper" }); }
  if (s.kind === "cta" && s.logos) o.logos = s.logos.map((id) => photo(id)?.img).filter(Boolean);
  if (s.kind === "capture") { const c = cap(s.capture, s.phrase); if (c) Object.assign(o, c); else Object.assign(o, { kind: "page", page: s.phrase }); }
  if (o.kind === "year" && !o.video && !o.img) o.kind = "page", (o.page = s.year);
  return o;
}

// key shots, resolved to the first matching word after the previous one
const shots = []; let from = 0;
for (const s of S.SHOTS) { const i = toks.findIndex((t, k) => k >= from && norm(t.w) === norm(s.at)); if (i < 0) { console.log("shot word not found:", s.at); continue; } shots.push({ ...realise(s), f0: Math.round(toks[i].t0 * FPS), wi: i }); from = i + 1; }
// fill: a new picture every ~0.45/0.5 s between key shots, on word starts, cycling the pool
// first render measured 0.81 / 1.06 s per shot; the references cut every 0.49-0.53 s
const gap = S.STYLE === "v1" ? 0.35 : 0.38, out = []; let q = 0;
const v1 = (k) => [{ kind: "inset", w: 640 + (k % 3) * 120, top: 480 + (k % 4) * 60, mat: k % 2 === 0 }, { kind: "paper" }, { kind: "full" }, { kind: "inset", w: 900, top: 520 }, { kind: "paper" }][k % 5];
for (let a = 0; a < shots.length; a++) {
  out.push(shots[a]); const end = a + 1 < shots.length ? shots[a + 1].f0 : Math.round(words[words.length - 1].t1 * FPS);
  if (shots[a].kind === "cta") continue;
  // captures, white pages and strobe key words hold (as in the references), but never longer than 1.5 s before the rhythm resumes
  let last = shots[a].f0 + (shots[a].kind === "capture" || shots[a].kind === "page" || shots[a].strobe ? Math.round(1.0 * FPS) - Math.round(gap * FPS) : 0);
  for (const w of words) { const f0 = Math.round(w.t0 * FPS); if (f0 <= last + gap * FPS || f0 >= end - 6) continue;
    const base = S.STYLE === "v1" ? v1(q) : { kind: "full" }, id = S.POOL[q % S.POOL.length]; q++;
    const s = base.kind === "paper" ? base : realise({ ...base, media: id }); out.push({ ...s, f0, auto: true }); last = f0; }
}
out.sort((x, y) => x.f0 - y.f0);
const frames = Math.round((words[words.length - 1].t1 + 0.7) * FPS);
const props = { styleName: S.STYLE, words, shots: out, tag: S.TAG || null, cta: S.CTA || null, frames };
writeFileSync(join(OUT, "props.json"), JSON.stringify(props));
const gaps = out.slice(1).map((s, i) => (s.f0 - out[i].f0) / FPS);
console.log(`${slug}: ${words.length} words, ${out.length} shots (${shots.length} key), mean ${(gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(2)} s, ${frames} frames (${(frames / FPS).toFixed(1)} s)`);
