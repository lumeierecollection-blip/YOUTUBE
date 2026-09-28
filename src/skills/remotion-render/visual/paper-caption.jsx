/**
 * PaperCaption — word-level kinetic caption on the paper, synced to the
 * voiceover's real word timings (beat.spoken, from Edge WordBoundary via
 * tts.js; frames relative to the beat).
 *
 *   - each word pops in AT the frame it is spoken: 3 frames, scale
 *     0.86 -> 1.0 and translateY 8px -> 0; words already spoken stay at
 *     opacity 1;
 *   - the emphasis word, after landing, scales to 1.08 over 4 frames,
 *     holds 0.3 s, and returns to 1.0 over 4 frames;
 *   - words are grouped into lines of up to 2 rows (a chunk); a chunk is
 *     replaced by the next when its first word is spoken; the last chunk
 *     holds 0.4 s after the last word ends, then clears;
 *   - caption zone (paper y ~76-92%), caption font (italic
 *     serif), ink colour. No background box.
 *
 * Where this stops: chunks are split by a fixed word count and at sentence
 * punctuation, estimated from character counts — not measured text width.
 * fitSize-style shrinking keeps long words inside the paper.
 */
import React from "react";
import { PAPER, ZONES, INK } from "./paper-layout.js";
import { captionSize } from "./paper-text.js";

const SERIF = "'Playfair Display', Georgia, serif";
const norm = (w) => String(w || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function chunk(words, maxChars) {
  const out = [];
  let cur = [], chars = 0;
  for (const w of words) {
    const len = w.text.length + 1;
    if (cur.length && chars + len > maxChars) { out.push(cur); cur = []; chars = 0; }
    cur.push(w); chars += len;
    if (/[.!?;:]$/.test(w.text) && chars > maxChars * 0.5) { out.push(cur); cur = []; chars = 0; }
  }
  if (cur.length) out.push(cur);
  return out;
}

export function PaperCaption({ words, local, fps = 30, emphasis, top, bounds = ZONES.CAPTION }) {
  if (!Array.isArray(words) || !words.length) {
    throw new Error("PaperCaption: beat has no word timings — the plan must be regenerated with the voiceover's word boundaries");
  }
  const H = PAPER.h;
  // Fit contract: the caption's box is the inner box's width, 4 px clear of
  // it; a word too long for a row shrinks the caption (italic serif, ~0.52
  // em per character, plus the emphasis word's 1.08 pop).
  const width = bounds.w - 8;
  // paper-text.js captionSize(): the same number render.js records.
  const size = captionSize(words, width);
  const perRow = Math.floor(width / (size * 0.5));
  const chunks = chunk(words, perRow * 2);
  // The chunk on screen: the last one whose first word has been spoken.
  let ci = -1;
  chunks.forEach((c, i) => { if (local >= c[0].from) ci = i; });
  if (ci < 0) return null;
  const last = words[words.length - 1];
  if (ci === chunks.length - 1 && local > last.to + Math.round(0.4 * fps)) return null;
  const cur = chunks[ci];
  const emph = norm(emphasis);
  const hold = Math.round(0.3 * fps);
  return (
    <div style={{ position: "absolute", left: bounds.x + 4, top: top ?? H * 0.7, width, textAlign: "center",
      font: `italic 500 ${size}px ${SERIF}`, color: INK, lineHeight: 1.3 }}>
      {cur.map((w, i) => {
        const since = local - w.from;
        if (since < 0) return <span key={i} style={{ display: "inline-block", marginRight: size * 0.34, opacity: 0 }}>{w.text}</span>;
        const e = Math.min(1, since / 3);
        let scale = 0.86 + 0.14 * e;
        const ty = 8 * (1 - e);
        if (emph && norm(w.text).includes(emph)) {
          const t = since - 3;
          if (t >= 0 && t < 4) scale = 1 + 0.08 * (t / 4);
          else if (t >= 4 && t < 4 + hold) scale = 1.08;
          else if (t >= 4 + hold && t < 8 + hold) scale = 1.08 - 0.08 * ((t - 4 - hold) / 4);
        }
        return (
          <span key={i} style={{ display: "inline-block", marginRight: size * 0.34, opacity: 1,
            transform: `translateY(${ty.toFixed(2)}px) scale(${scale.toFixed(4)})`, transformOrigin: "center bottom",
            fontWeight: emph && norm(w.text).includes(emph) ? 700 : 500 }}>{w.text}</span>
        );
      })}
    </div>
  );
}

export default PaperCaption;
