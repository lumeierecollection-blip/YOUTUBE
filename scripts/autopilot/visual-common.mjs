/** Text fitting, the pre-render layout check, and timeline parts shared by both channel treatments. */
import { createRequire } from "node:module";
import { join } from "node:path";
import { ROOT, StageError, readJson } from "./lib.mjs";

export const FPS = 30, W = 1080, H = 1920;
export const sec = (t) => Math.round(Number(t) * FPS);
const { resolveChannel } = createRequire(import.meta.url)("../lib/channel-lookup.cjs");
export const channelStyle = (channelId) => resolveChannel(String(channelId));

// Deliberately generous per-character widths (em), measured against rendered frames of these fonts.
const charEm = (ch, mono) => (mono ? 0.6 : /[A-Z0-9]/.test(ch) ? 0.7 : ch === " " ? 0.3 : 0.56);
const widthOf = (s, size, { mono, tracking = 0 }) => [...s].reduce((n, ch) => n + (charEm(ch, mono) + tracking) * size, 0);

/** Word-wraps explicitly so the renderer cannot decide a different line count from the layout check. */
export function wrap(text, size, maxW, opts = {}) {
  const lines = [];
  for (const para of String(text).split("\n")) {
    let cur = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = cur ? `${cur} ${word}` : word;
      if (cur && widthOf(next, size, opts) > maxW) { lines.push(cur); cur = word; } else cur = next;
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

/** The largest size in [min,max] at which the text fits maxW in at most maxLines lines. Null if it never fits. */
export function fit(text, { maxW, maxLines, max, min, mono, tracking }) {
  for (let size = max; size >= min; size -= 2) {
    const lines = wrap(text, size, maxW, { mono, tracking });
    if (lines.length <= maxLines && lines.every((l) => widthOf(l, size, { mono, tracking }) <= maxW)) return { size, lines, text: lines.join("\n") };
  }
  return null;
}

export const SAFE = { left: 48, right: W - 48, top: 120, bottom: 1540 };

/**
 * Fails before any render is spent if a text box leaves the safe area or collides with
 * another text box on screen at the same time. Caption band and credits are placed by the builders.
 */
export function layoutCheck(layers, stage) {
  const texts = layers.filter((l) => l.type === "text" && l.box);
  const problems = [];
  for (const t of texts) {
    if (t.box.x0 < SAFE.left || t.box.x1 > SAFE.right || t.box.y0 < SAFE.top || t.box.y1 > SAFE.bottom) problems.push(`${t.id} outside the safe area`);
  }
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j];
    if (a.in >= b.out || b.in >= a.out) continue;
    if (a.box.x0 < b.box.x1 && b.box.x0 < a.box.x1 && a.box.y0 < b.box.y1 && b.box.y0 < a.box.y1) problems.push(`${a.id} overlaps ${b.id}`);
  }
  if (problems.length) throw new StageError(stage, `layout check failed: ${problems.slice(0, 6).join("; ")}`);
}

/** A text layer whose box is known. `slide` is vertical; `slideX` makes it travel in from the side. */
export function text(id, content, { x = 90, y, w = W - 180, size, weight = 700, color, align = "center", inF, outF, z, font, slide = 30, slideX = 0, tracking = 0, lineHeight = 1.12, mono = false }) {
  const span = Math.max(1, outF - inF);
  const reveal = Math.min(12, Math.max(4, Math.floor(span / 3)));
  const lines = content.split("\n");
  const textW = Math.max(...lines.map((l) => widthOf(l, size, { mono, tracking })));
  const h = lines.length * size * lineHeight;
  const x0 = align === "left" ? x : x + (w - textW) / 2;
  const keyframes = {
    opacity: [{ f: 0, v: 0, e: "outCubic" }, { f: reveal, v: 1 }, { f: span, v: 1 }],
    ty: [{ f: 0, v: slide, e: "outCubic" }, { f: reveal, v: 0 }, { f: span, v: 0 }],
    tx: [{ f: 0, v: slideX, e: "outCubic" }, { f: reveal, v: 0 }, { f: span, v: 0 }],
  };
  return {
    id, type: "text", text: content, rect: { x, y, w, h: Math.ceil(h) + 8 }, in: inF, out: outF, z,
    style: { font, size, weight, color, align, valign: "top", lineHeight, tracking, pad: 0 }, props: { opacity: 1, ty: slide, tx: slideX }, keyframes,
    box: { x0, x1: x0 + textW, y0: y, y1: y + h },
  };
}

export function solid(id, { x, y, w, h, background, inF, outF, z, opacity = 1, boxShadow, keyframes }) {
  const span = Math.max(1, outF - inF);
  return { id, type: "solid", rect: { x, y, w, h }, in: inF, out: outF, z, style: { background, boxShadow }, props: { opacity }, keyframes: keyframes || { opacity: [{ f: 0, v: 0, e: "outCubic" }, { f: Math.min(8, span), v: opacity }, { f: span, v: opacity }] } };
}

/** A full-canvas stroke that draws on. Visible from its first frame so a scene is never momentarily text-only. */
export function stroke(id, d, { color, width = 5, inF, outF, z, drawFrames = 16, delay = 0, fill = "none", tx }) {
  const span = Math.max(1, outF - inF);
  const end = Math.min(delay + drawFrames, span);
  const keyframes = { draw: [{ f: 0, v: 0, e: "linear" }, { f: Math.max(1, delay), v: 0 }, { f: end, v: 1, e: "inOutCubic" }, { f: span, v: 1 }] };
  if (tx) keyframes.tx = tx;
  return { id, type: "svg", rect: { x: 0, y: 0, w: W, h: H }, in: inF, out: outF, z, viewBox: [0, 0, W, H], props: { opacity: 1, draw: 0 }, paths: [{ d, fill, stroke: color, strokeWidth: width, strokeLinecap: "round", strokeLinejoin: "round" }], keyframes };
}

/** Scenes follow the narration: one per spoken sentence, merging any sentence too short to read. */
export function scenesFromWords(wordsPath) {
  const words = readJson(join(ROOT, wordsPath));
  const sentences = (words.sentences || []).map((s, i) => ({ index: i, text: s.text, start: s.start, end: s.end }));
  if (!sentences.length) throw new StageError("visual-plan", "no sentence timings in the narration");
  const merged = [];
  for (const s of sentences) {
    const last = merged.at(-1);
    if (last && last.end - last.start < 1.6) { last.text += " " + s.text; last.end = s.end; } else merged.push({ ...s });
  }
  return { words, scenes: merged.map((s, i) => ({ ...s, index: i, from: i === 0 ? 0 : s.start, to: i === merged.length - 1 ? null : merged[i + 1].start })) };
}

export function captions(words) {
  return (words.sentences || []).map((c, i) => {
    const ws = (words.words || []).filter((w) => w.sentence === i).map((w) => ({ text: w.text, start_f: sec(w.start), end_f: Math.max(sec(w.end), sec(w.start) + 1) }));
    const cue = { start_f: sec(c.start), end_f: Math.max(sec(c.end), sec(c.start) + 1), text: c.text };
    return { ...cue, words: ws.length ? ws : [{ text: c.text, start_f: cue.start_f, end_f: cue.end_f }] };
  });
}

export const stripForRender = (layers) => layers.map(({ box, ...l }) => l);
