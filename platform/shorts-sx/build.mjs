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
// background-removed version of a credited photo (BiRefNet on GitHub, platform/production/cutout.py): same credit as the original
const cut = (id) => { const p = photo(id); if (!p) return null; const f = p.img.replace(/\.[a-z]+$/i, "-cutout.png"); return existsSync(join(PUB, f)) ? { img: f, credit: p.credit } : null; };
// one collage item: a photo, a cut-out, a logo, a page capture (top of the real page) or a clip; null if the file is missing
const item = (it) => {
  if (it.cut) { const c = cut(it.cut); return c && { ...it, img: c.img, cut: true, credit: c.credit }; }
  if (it.logo) { const p = photo(it.logo); return p && { ...it, img: p.img, logo: true, credit: p.credit }; }
  if (it.photo) { const p = photo(it.photo); return p && { ...it, img: p.img, credit: p.credit }; }
  if (it.page) { const f = `sx/${slug}/${it.page}-0.png`; return existsSync(join(PUB, f)) && { ...it, img: f, top: true, credit: "page capture" }; }
  if (it.media) { const v = foot(it.media); return v && { ...it, video: v, credit: VCRED }; }
  return null; };

// entity pictures resolved by entities.mjs (Wikidata P18 / P154, licence-checked); people also have a cut-out when cutout.py managed one
const ENT = (() => { try { return JSON.parse(readFileSync(join(OUT, "entities.json"), "utf8")); } catch { return {}; } })();
const entPic = (id) => { const e = ENT[id] || { name: id }; const c = e.img && e.img.replace(/\.[a-z]+$/i, "-cutout.png"); return { name: e.name, img: e.img || null, cut: c && existsSync(join(PUB, c)) ? c : null, credit: e.credit || null }; };
const cutOf = (id) => { const p = photo(id); if (!p) return null; const c = p.img.replace(/\.[a-z]+$/i, "-cutout.png"); return existsSync(join(PUB, c)) ? c : p.img; };

function realise(s) {
  const o = { ...s }; delete o.at;
  // owner, 19 Nov 2026: "don't fall to wiki screenshots, no one is going to read that" - page captures are refused in calm Shorts
  if (S.CALM && s.kind === "capture" && !s.allowCapture) throw new Error(`page screenshot at "${s.at}": not allowed in calm Shorts; show the thing itself (people, money, a number, a logo)`);
  if (s.kind === "people") { o.people = s.people.map((p) => { const e = entPic(p.ent); return { name: p.name || e.name, role: p.role || "", img: e.img }; }); o.credit = [...new Set(s.people.map((p) => entPic(p.ent).credit).filter(Boolean))].join(" · ").slice(0, 200); }
  if (s.kind === "person") { const e = entPic(s.ent); Object.assign(o, { name: s.name || e.name, img: e.img, cut: s.noCut ? null : e.cut, credit: e.credit }); if (!e.img) o.kind = "page", (o.page = o.name); }
  if (s.kind === "versus") { const pick = (x) => (x.ent ? entPic(x.ent).cut || entPic(x.ent).img : cutOf(x.photo)); Object.assign(o, { cutA: pick(s.a), cutB: pick(s.b), labA: s.a.label, labB: s.b.label }); o.credit = [s.a, s.b].map((x) => (x.ent ? entPic(x.ent).credit : photo(x.photo)?.credit)).filter(Boolean).join(" · "); }
  if ((s.kind === "money" || s.kind === "stat") && s.asset) { o.img = cutOf(s.asset); o.credit = photo(s.asset)?.credit; }
  if (s.media) { const v = foot(s.media); if (v) Object.assign(o, { video: v, credit: VCRED }); else if (s.kind === "full" || s.kind === "inset" || s.kind === "year") o.kind = s.kind === "year" ? "page" : "paper"; }
  if (s.photo) { const ph = photo(s.photo); if (ph) Object.assign(o, ph); else o.kind = "paper"; }
  if (s.photo2) { const ph = photo(s.photo2); if (ph) o.img2 = ph.img; else if (o.kind === "split") o.kind = "full"; }
  if (s.kind === "logo" || s.kind === "brand") { const ph = photo(s.logo); if (ph) Object.assign(o, ph); else Object.assign(o, { kind: "paper" }); }
  if (s.sil) { const c = cut(s.sil); if (c) o.sil = c.img; else delete o.sil; }
  if (s.kind === "cutout") { const c = cut(s.cut); if (c) Object.assign(o, c); else { const ph = photo(s.cut); Object.assign(o, ph ? { kind: "inset", mat: true, ...ph } : { kind: "paper" }); } }
  if (s.kind === "collage") { o.items = s.items.map(item).filter(Boolean); if (!o.items.length) o.kind = "paper"; else o.credit = [...new Set(o.items.map((i) => i.credit).filter((c) => c && c !== "page capture"))].join(" · ").slice(0, 160); }
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
// round 7 measured 0.61 / 0.76 s per shot against the references 0.49-0.53 s: tighter fill gap and shorter holds
const gap = S.STYLE === "v1" ? 0.33 : 0.2, out = []; let q = 0;
const v1 = (k) => [{ kind: "inset", w: 640 + (k % 3) * 120, top: 480 + (k % 4) * 60, mat: k % 2 === 0 }, { kind: "paper" }, { kind: "inset", w: 900, top: 520, mat: true }, { kind: "paper" }][k % 4];   // 19 Nov: no full-bleed stock in v1 (owner: not clean); the reference frames every picture
for (let a = 0; a < shots.length; a++) {
  out.push(shots[a]); const end = a + 1 < shots.length ? shots[a + 1].f0 : Math.round(words[words.length - 1].t1 * FPS);
  if (shots[a].kind === "cta" || S.FILL === false) continue;   // FILL false (calm Shorts): every picture is a chosen key shot, none repeat
  // captures, white pages and strobe key words hold (as in the references), but never longer than 1.5 s before the rhythm resumes
  let last = shots[a].f0 + (["capture", "page", "brand", "logo", "collage", "cutout"].includes(shots[a].kind) || shots[a].strobe ?   /* brand/logo/collage/cut-out hold too: at 0.2 s fill the Anthropic card lasted one frame */ Math.round(0.8 * FPS) - Math.round(gap * FPS) : 0);
  for (const w of words) { const f0 = Math.round(w.t0 * FPS); if (f0 <= last + gap * FPS || f0 >= end - 6) continue;
    const base = S.STYLE === "v1" ? v1(q) : { kind: "full" }, id = S.POOL[q % S.POOL.length]; q++;
    const s = base.kind === "paper" ? base : realise({ ...base, ...(id.startsWith("photo:") ? { photo: id.slice(6), pos: ["50% 30%", "40% 40%", "60% 35%"][q % 3] } : { media: id }) }); out.push({ ...s, f0, auto: true }); last = f0; }
}
out.sort((x, y) => x.f0 - y.f0);
// no doubling (owner, 19 Nov 2026): while a shot shows a word or number as a graphic, the same spoken word is left out of the captions.
// Numbers are compared by value: a run of spoken number words ("five thousand", "forty-seven percent", "965 billion dollars") is read as one
// number and hidden when that number is on screen ("$5,000", "47%", "$965B").
const NUM = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const MUL = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 }, UNIT = new Set(["percent", "dollars", "dollar"]);
const small = (w) => { const t = w.toLowerCase().replace(/[^a-z0-9.-]/g, ""); if (/^[0-9][0-9.]*$/.test(t)) return +t; const parts = t.split("-"); return parts.length && parts.every((x) => x in NUM) ? parts.reduce((a, x) => a + NUM[x], 0) : null; };
const shownNums = (txt) => [...txt.replace(/,/g, "").matchAll(/([0-9]+(?:\.[0-9]+)?)\s*(k|m|bn|b|thousand|million|billion|trillion)?/gi)].map(([, n, u]) => +n * ({ k: 1e3, m: 1e6, b: 1e9, bn: 1e9, thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 }[(u || "").toLowerCase()] || 1));
for (let i = 0; i < out.length; i++) {
  const sh = out[i], end = i + 1 < out.length ? out[i + 1].f0 : 1e9;
  const shown = [sh.cap, sh.year, sh.label, sh.lab1, sh.lab2, sh.labA, sh.labB, sh.page, sh.value, sh.unit, sh.name, sh.role, sh.title, ...(sh.people || []).flatMap((p) => [p.name, p.role])].filter(Boolean).join(" ");
  if (!shown || sh.cap) continue;   // a cap already replaces the captions for its shot
  const toks = new Set(shown.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)), nums = shownNums(shown);
  const inShot = words.filter((w) => { const f = Math.round(w.t0 * FPS); return f >= sh.f0 && f < end; });
  for (let k = 0; k < inShot.length; k++) {
    const w = inShot[k], n = norm(w.w);
    if (small(w.w) != null) {   // read the whole spoken number
      let v = 0, cur = small(w.w), m = k + 1;
      while (m < inShot.length) { const x = norm(inShot[m].w), sv = small(inShot[m].w); if (x in MUL) { cur = (cur || 1) * MUL[x]; if (MUL[x] >= 1e3) { v += cur; cur = 0; } m++; } else if (sv != null && cur % 100 === 0 && sv < 100) { cur += sv; m++; } else break; }
      v += cur;
      if (nums.some((x) => Math.abs(x - v) < 1e-6)) { for (let q = k; q < m; q++) inShot[q].hide = true; if (m < inShot.length && UNIT.has(norm(inShot[m].w))) inShot[m].hide = true; k = m - 1; continue; }
    }
    if (toks.has(n) || (n === "dollars" && shown.includes("$")) || (n === "percent" && shown.includes("%"))) w.hide = true;
  }
}
// owner rule since 19 Nov 2026: every Short 30 s max (voice.mjs re-takes a narration that would run longer)
const frames = Math.min(Math.round((words[words.length - 1].t1 + 0.7) * FPS), 30 * FPS);
if ((words[words.length - 1].t1 + 0.3) * FPS > frames) throw new Error(`narration runs ${words[words.length - 1].t1.toFixed(1)} s: over the 30 s limit, shorten the script`);
const props = { styleName: S.STYLE, words, shots: out, tag: S.TAG || null, cta: S.CTA || null, frames, calm: !!S.CALM };
// calm Shorts: no picture may appear twice (owner, 19 Nov 2026: "make sure that each time it's a different visual")
if (S.CALM) { const seen = new Map(); for (const x of out) { const k = [x.img, x.img2, x.video, ...(x.items || []).map((i) => i.img || i.video)].filter(Boolean).join("+") + (x.kind === "capture" ? `#${x.cy}` : ""); if (k && seen.has(k)) throw new Error(`picture used twice: ${k} at ${(seen.get(k) / FPS).toFixed(1)} s and ${(x.f0 / FPS).toFixed(1)} s`); if (k) seen.set(k, x.f0); } }
writeFileSync(join(OUT, "props.json"), JSON.stringify(props));
const gaps = out.slice(1).map((s, i) => (s.f0 - out[i].f0) / FPS);
console.log(`${slug}: ${words.length} words, ${out.length} shots (${shots.length} key), mean ${(gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(2)} s, ${frames} frames (${(frames / FPS).toFixed(1)} s)`);
