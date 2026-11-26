// Schema 7 plan builder: a hand/agent-authored storyboard ("board") plus the word-level VTT of the
// narration becomes a timed plan the Remotion engine renders. Nothing here invents content: every
// time comes from the VTT, every asset must exist on disk, every number must trace to a facts file.
import fs from "node:fs";
import path from "node:path";
import { parseVtt } from "./plan-lib.mjs";

const norm = (s) => String(s || "").toLowerCase().replace(/[‘’´`]/g, "'").replace(/[^a-z0-9$%.' ]+/g, " ").replace(/\s+/g, " ").trim();
export const toks = (s) => norm(s).replace(/[.']/g, "").split(" ").filter(Boolean);

export const BAR_COLOURS = ["yellow", "blue", "cyan", "red"];
export const ENTERS = ["cut", "flash", "glitch", "flicker"];
export const PIC_ENTERS = ["glitch", "slide-l", "slide-r", "slide-u", "slide-d", "fade", "pop", "cut"];
export const PLATES = ["paper", "dark", "char"];

/** One time per script word, from word-level cues. Cues must match the script word for word. */
export function wordTimeline(cues, script) {
  const sw = toks(script);
  const raw = [];
  for (const c of cues) {
    const cw = toks(c.text);
    cw.forEach((w, k) => {
      const span = (c.end - c.start) / cw.length;
      raw.push({ w, t0: c.start + k * span, t1: c.start + (k + 1) * span });
    });
  }
  // edge-tts can split one script token across cues ("5", ".", "2's" for "5.2's"); merge until it equals the script token.
  const tl = [];
  let ri = 0;
  for (const s of sw) {
    if (ri >= raw.length) break;
    if (raw[ri].w === s) { tl.push(raw[ri++]); continue; }
    let acc = raw[ri].w, j = ri + 1;
    while (j < raw.length && s.startsWith(acc) && acc !== s) acc += raw[j++].w;
    if (acc === s) { tl.push({ w: s, t0: raw[ri].t0, t1: raw[j - 1].t1 }); ri = j; } else tl.push(raw[ri++]);
  }
  const bad = [];
  if (tl.length !== sw.length) bad.push(`VTT has ${tl.length} words, script has ${sw.length}`);
  for (let i = 0; i < Math.min(tl.length, sw.length); i++) if (tl[i].w !== sw[i]) { bad.push(`word ${i}: VTT "${tl[i].w}" vs script "${sw[i]}"`); break; }
  return { tl, sw, bad };
}

function findPhrase(sw, phrase, from, to) {
  const p = toks(phrase);
  if (!p.length) return -1;
  for (let i = from; i + p.length <= to; i++) {
    let ok = true;
    for (let k = 0; k < p.length; k++) if (sw[i + k] !== p[k]) { ok = false; break; }
    if (ok) return i;
  }
  return -1;
}

const r3 = (n) => +n.toFixed(3);

/**
 * board: { id, slug, title, audio:{music,ambience,sfx:[{src, beat?, cue?, offset?, t?, volume, dur, purpose}]}, beats:[...] }
 * beat.from: phrase where the beat begins in the narration. text[].say / pics[].cue / sfx cue: phrases inside the beat.
 */
export function buildPlan(board, { script, cues, audioDur, imageSize }) {
  const errors = [], warns = [];
  const E = (m) => errors.push(m);
  const { tl, sw, bad } = wordTimeline(cues, script);
  bad.forEach(E);
  if (bad.length) return { plan: null, errors, warns };
  const lead = 0.08;
  const end = audioDur + 0.5;
  const starts = [];
  let cursor = 0;
  board.beats.forEach((b, i) => {
    if (i === 0 && !b.from) { starts.push(0); return; }
    const pos = findPhrase(sw, b.from, cursor, sw.length);
    if (pos < 0) { E(`beat ${b.id}: from-phrase "${b.from}" not found after word ${cursor}`); starts.push(cursor); return; }
    starts.push(pos); cursor = pos + 1;
  });
  const beatT = starts.map((s, i) => (i === 0 ? 0 : r3(Math.max(0, tl[s].t0 - lead))));
  const beats = board.beats.map((b, i) => {
    const t = beatT[i];
    const wFrom = starts[i];
    const wTo = i + 1 < starts.length ? starts[i + 1] : sw.length;
    const rel = (abs) => r3(Math.max(0, abs - t));
    const text = (b.text || []).map((x, j) => {
      const pos = findPhrase(sw, x.say, wFrom, wTo);
      if (pos < 0) { E(`beat ${b.id} text ${j}: say-phrase "${x.say}" not inside the beat's narration`); return null; }
      const n = toks(x.say).length;
      const showWords = (x.show ?? x.say).split(/\s+/).filter(Boolean);
      const times = showWords.map((_, k) => rel(tl[pos + Math.min(n - 1, Math.floor((k * n) / showWords.length))].t0));
      const { say, show, ...rest } = x;
      return { ...rest, words: showWords.join(" "), times };
    }).filter(Boolean);
    const pics = (b.pics || []).map((p, j) => {
      const { cue, ...rest } = p;
      let at = rest.at ?? 0;
      if (cue) {
        const pos = findPhrase(sw, cue, wFrom, wTo);
        if (pos < 0) E(`beat ${b.id} pic ${j}: cue "${cue}" not in the beat's narration`); else at = rel(tl[pos].t0);
      }
      let aspect = rest.aspect;
      const file = rest.src;
      if (file && imageSize) { const sz = imageSize(file); if (sz) aspect = sz.w / sz.h; else E(`beat ${b.id} pic ${j}: image missing ${file}`); }
      if (rest.logo) aspect = aspect || 1;
      if (!aspect) E(`beat ${b.id} pic ${j}: no aspect`);
      return { ...rest, at, aspect };
    });
    const out = { ...b, t, dur: r3((i + 1 < beatT.length ? beatT[i + 1] : end) - t), text, pics };
    delete out.from;
    if (b.widget && b.widget.cue) { /* widget times are already beat-relative; cue shifts them */
      const pos = findPhrase(sw, b.widget.cue, wFrom, wTo);
      if (pos < 0) E(`beat ${b.id} widget: cue "${b.widget.cue}" not in the beat's narration`);
      else out.widget = shiftWidget(b.widget, rel(tl[pos].t0));
      delete out.widget?.cue;
    }
    return out;
  });
  const sfx = (board.audio?.sfx || []).map((s, j) => {
    let t = s.t;
    if (s.beat !== undefined) {
      const bi = beats.findIndex((b) => b.id === s.beat);
      if (bi < 0) { E(`sfx ${j}: unknown beat ${s.beat}`); return null; }
      t = beats[bi].t + (s.offset || 0);
      if (s.cue) {
        const pos = findPhrase(sw, s.cue, starts[bi], bi + 1 < starts.length ? starts[bi + 1] : sw.length);
        if (pos < 0) E(`sfx ${j}: cue "${s.cue}" not in beat ${s.beat}`); else t = tl[pos].t0 + (s.offset || 0);
      }
    }
    if (!Number.isFinite(t)) { E(`sfx ${j}: no time`); return null; }
    const { beat, cue, offset, ...rest } = s;
    return { ...rest, t: r3(Math.max(0, t)) };
  }).filter(Boolean).filter((s) => s.t < end);
  const plan = {
    schema: 7, id: board.id, slug: board.slug, title: board.title,
    words: tl.map((x) => ({ w: x.w, t0: r3(x.t0), t1: r3(x.t1) })),
    beats, audio: { music: board.audio?.music, ambience: board.audio?.ambience, bed: board.audio?.bed, sfx },
    asset_manifest: board.asset_manifest || [], blueprint: board.blueprint || null,
  };
  return { plan, errors, warns };
}

function shiftWidget(w, dt) {
  const j = JSON.parse(JSON.stringify(w));
  const walk = (o) => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === "object") for (const k of Object.keys(o)) { if (k === "at" && typeof o[k] === "number") o[k] = r3(o[k] + dt); else walk(o[k]); }
  };
  walk(j);
  return j;
}

const collectNums = (o, acc = [], inPoints = false) => {
  if (Array.isArray(o)) o.forEach((x) => collectNums(x, acc, inPoints));
  else if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o)) {
      if (["to", "value", "max"].includes(k) && typeof v === "number") acc.push(v);
      else if (k === "y" && inPoints && typeof v === "number") acc.push(v);
      else collectNums(v, acc, inPoints || k === "points");
    }
  }
  return acc;
};

/** Hard checks that turn the reference rules into gates (see production-v7/blueprint). */
export function validatePlan7(plan, ctx) {
  const { publicDir, facts, sfxDirs = [] } = ctx;
  const errors = [], warns = [];
  const E = (m) => errors.push(m), W = (m) => warns.push(m);
  const exists = (rel) => rel && (/^(https?:|data:)/.test(rel) || fs.existsSync(path.join(publicDir, String(rel).replace(/^\/+/, ""))));
  if (plan.schema !== 7) E("schema must be 7");
  const beats = plan.beats || [];
  if (beats.length < 8) E(`only ${beats.length} beats`);
  const factNums = new Set((facts?.numbers || []).map((n) => parseFloat(String(n.value).replace(/[^0-9.\-]/g, ""))).filter(Number.isFinite));
  let darkCount = 0;
  beats.forEach((b, i) => {
    const w = `beat ${b.id}`;
    if (!PLATES.includes(b.plate)) E(`${w}: plate ${b.plate}`);
    if (b.plate !== "paper") darkCount++;
    if (!ENTERS.includes(b.enter)) E(`${w}: enter ${b.enter}`);
    if (b.dur < 0.35) W(`${w}: very short (${b.dur}s)`);
    if (b.dur > 4.5) W(`${w}: ${b.dur}s without a change; reference changes about once a second`);
    let wordsOn = 0;
    for (const x of b.text) {
      const n = x.words.split(/\s+/).length;
      wordsOn += n;
      if (n > 7) E(`${w}: text item with ${n} words (reference shows at most ~4 per item)`);
      if (x.bar && !BAR_COLOURS.includes(x.bar)) E(`${w}: bar colour ${x.bar} outside the reference set`);
      if (x.size < 70) E(`${w}: text size ${x.size} too small`);
    }
    if (wordsOn > 10) W(`${w}: ${wordsOn} words on screen at once`);
    let big = 0;
    for (const p of b.pics) {
      if (p.src && !exists(p.src)) E(`${w}: picture missing ${p.src}`);
      if (p.logo && !exists(`logos/${p.logo}.svg`)) E(`${w}: logo missing logos/${p.logo}.svg`);
      if (p.logo && p.w < 0.3) E(`${w}: logo ${p.logo} only ${(p.w * 100).toFixed(0)}% of frame width (>=30% required)`);
      if (!p.logo && p.w < 0.45) W(`${w}: picture ${p.src} only ${(p.w * 100).toFixed(0)}% wide`);
      if (p.w >= 0.4) big++;
      if (p.y < 0.1 || p.y > 0.9) W(`${w}: picture centred near an edge (y=${p.y})`);
      if (p.enter && !PIC_ENTERS.includes(p.enter)) E(`${w}: picture enter ${p.enter}`);
    }
    if (b.bg && !exists(b.bg.src)) E(`${w}: bg missing ${b.bg.src}`);
    if (!b.widget && !big && !b.bg && b.plate === "paper" && wordsOn > 3) W(`${w}: type-only beat with ${wordsOn} words`);
    if (b.widget && facts) for (const n of collectNums(b.widget)) if (!factNums.has(n) && !b.widget.derived) W(`${w}: widget number ${n} is not in facts.numbers (derived values must be flagged derived:true)`);
    if (i > 0 && !b.pics.length && !b.widget && !b.bg && b.text.length && beats[i - 1].pics.length === 0 && !beats[i - 1].widget && !beats[i - 1].bg) W(`${w}: second text-only beat in a row`);
  });
  if (darkCount < 2) W("fewer than 2 dark plates; reference alternates every 3-5 s");
  const au = plan.audio || {};
  const sfx = au.sfx || [];
  if (au.bed === "none") { if (au.music?.src || au.ambience?.src) E('audio.bed "none" but music/ambience is set'); }
  else {
    if (!au.music?.src) E("audio.music missing"); else if (!exists(au.music.src)) E(`music missing ${au.music.src}`);
    if (!au.ambience?.src) W("no ambience bed"); else if (!exists(au.ambience.src)) E(`ambience missing ${au.ambience.src}`);
  }
  if (sfx.length < beats.length) E(`sfx plan thin: ${sfx.length} events for ${beats.length} beats`);
  const kinds = new Set(sfx.map((s) => s.src));
  if (kinds.size < 5) E(`only ${kinds.size} distinct sound effects (>=5 required; a single whoosh repeated is rejected)`);
  sfx.forEach((s, i) => { if (!exists(s.src)) E(`sfx ${i}: missing ${s.src}`); if (!s.purpose) E(`sfx ${i}: no purpose`); });
  const m = plan.asset_manifest || [];
  m.forEach((a, i) => { for (const k of ["file", "source", "licence", "scene", "resolution", "processing"]) if (!a[k]) E(`asset_manifest[${i}] missing ${k}`); });
  void sfxDirs;
  return { ok: errors.length === 0, errors, warns };
}
