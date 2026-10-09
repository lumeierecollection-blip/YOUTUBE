/**
 * KineticText — the renderer for kinetic.js. A phrase is drawn word by word:
 * every word is its own inline box with its own weight, colour, pop and exit.
 * Lines are real inline text (the browser sets the spaces and the kerning).
 *
 * Every word POPS IN PLACE (kinetic.js popState): its line is laid out at its
 * final width from the first frame — a word that has not popped yet is
 * invisible but already holds its place — so no word slides, and no line
 * reflows or shifts as later words arrive. Never a whole-block fade or a block
 * transform: the only transforms are per word (per letter for POP_LETTER).
 *
 * The hook / CTA "cross" mode (words flying 1100 px across the frame) is
 * retired: those beats pop hard (POP_HARD) in place instead.
 */
import React from "react";
import {
  wordEntrance, entranceFrames, microMotion, wordSchedule, wordExit, popEntrances, popName, stackSettle, LETTER_GAP_FRAMES,
} from "./kinetic.js";

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "")); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null; };
/** ink -> accent by t (both hex); anything else is returned as `a` / `b` at the halfway. */
export function mixColor(a, b, t) {
  const x = hex(a), y = hex(b);
  if (!x || !y) return t > 0.5 ? b : a;
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * clamp01(t))).join(",")})`;
}

/** rows of words (each { text, weight, accent, emph }) from a box: kinetic layout rows, else its plain lines. */
export function rowsOf(b, baseWeight = 500) {
  if (b.words && b.rows) return b.rows.map((ln) => ln.map((i) => b.words[i]));
  return (b.lines || []).map((l) => String(l).split(" ").filter(Boolean).map((t) => ({ text: t, weight: baseWeight, accent: false, emph: false })));
}

/**
 * b: a box { x, y, w, h, size, align, words?/rows? | lines }.
 * timing (frames from the beat's start): start, resolveBy, exitAt.
 * entrances: one pop name per word (kinetic.js popEntrances, planned by
 * scripts/anim-plan.js); missing or from an older plan -> computed here.
 * group: "headline" | "label" (labels pop soft). edge: the hook / CTA beat.
 */
export function KineticText({
  b, color, accent, local, dur, entrances, start = 0, resolveBy = 0.4, exitAt = 0.7, font, lineHeight, tracking = 0,
  upper = false, baseWeight = 500, group = "headline", edge = false, wordAt = null,
}) {
  const rows = rowsOf(b, baseWeight);
  const flat = rows.flat();
  const n = flat.length;
  if (!n) return null;
  const right = b.align === "right";
  const lh = lineHeight ?? b.size * 0.95;
  const ent = (entrances && entrances.length >= n ? entrances : popEntrances(flat, { group, edge })).map(popName);
  const letterBeat = ent.every((e) => e === "POP_LETTER");
  const stack = ent.every((e) => e === "POP_WORD_STACK");
  const sched = wordSchedule(n, dur, { start, resolveBy, exitAt, entrance: Math.max(...ent.map((e) => entranceFrames(e))) });
  // wordAt (visual/word-sync.js): each word pops on the frame the narrator SAYS it, not on an even stagger.
  if (Array.isArray(wordAt) && wordAt.length === n) wordAt.forEach((f, i) => { sched.enter[i] = Math.max(start, f); });
  // POP_LETTER: the letters run on as one chain across the phrase, 30 ms
  // apart (a word starts one letter-gap after the previous word's last letter).
  if (letterBeat) {
    let at = start;
    flat.forEach((w, i) => { sched.enter[i] = at; at += ([...w.text].length + 1) * LETTER_GAP_FRAMES; });
  }
  // POP_WORD_STACK: word i pops one row above word i-1, all at the left (or
  // right) edge, rising from the last line's row; once the last has settled
  // and held, every word moves to its place in the laid-out lines. Final
  // positions come from the kinetic layout (b.words x / y) when present,
  // else they are estimated from the row's order — which only matters while
  // the stack is moving: the settled frame is the real inline layout.
  const settle = stack ? stackSettle(sched.enter[n - 1] - start, local - start) : 1;
  let wi = 0;
  return (
    <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h }}>
      {rows.map((row, li) => (
        <div key={li} style={{ height: lh, lineHeight: `${lh}px`, whiteSpace: "nowrap", textAlign: b.align === "center" ? "center" : right ? "right" : "left", fontFamily: font, fontSize: b.size, letterSpacing: tracking, fontOpticalSizing: "auto", textTransform: upper ? "uppercase" : "none" }}>
          {row.map((w, k) => {
            const i = wi++;
            const f = local - sched.enter[i];
            const name = ent[i];
            const nLet = [...w.text].length;
            const landed = f >= entranceFrames(name, nLet) + 0.5;
            const en = wordEntrance(name, f);
            const mm = landed && settle >= 1 ? microMotion(f, i) : { s: 1, dx: 0, dy: 0 };
            const fx = local - sched.exit[i];
            const ex = fx > 0 ? wordExit(fx, sched.exitFrames) : { dy: 0, clip: 0 };
            const gone = ex.clip >= 0.999;
            // An accent word is the accent from the moment it pops.
            const col = mixColor(color, accent || color, w.accent ? 1 : 0);
            let sx = 0, sy = 0;
            if (stack && settle < 1) {
              const lastRow = (rows.length - 1) * lh;
              const fx0 = Number.isFinite(w.x) ? w.x : 0, fy0 = Number.isFinite(w.y) ? w.y : li * lh;
              const toX = right ? (Number.isFinite(w.w) ? b.w - w.w : 0) : b.align === "center" ? (Number.isFinite(w.w) ? (b.w - w.w) / 2 : 0) : 0;
              sx = (toX - fx0) * (1 - settle);
              sy = (lastRow - i * lh - fy0) * (1 - settle);
            }
            const style = {
              display: "inline-block", position: "relative", verticalAlign: "top",
              visibility: f > 0 && !gone ? "visible" : "hidden",
              transformOrigin: "50% 60%",
              transform: `translate(${(sx + mm.dx).toFixed(2)}px, ${(sy + en.dy + mm.dy + ex.dy * lh).toFixed(2)}px) scale(${(en.s * mm.s).toFixed(4)})`,
              opacity: en.o,
              clipPath: ex.clip > 0 ? `inset(0 0 ${(ex.clip * 100).toFixed(1)}% 0)` : "none",
              fontWeight: w.weight, color: col,
            };
            const sep = k > 0 ? " " : "";
            if (name === "POP_LETTER" && fx <= 0 && f < entranceFrames(name, nLet) + 1) {
              return (
                <React.Fragment key={k}>
                  {sep}<span style={{ ...style, opacity: 1, transform: "none", visibility: "visible" }}>
                    {[...w.text].map((ch, j) => {
                      const s = wordEntrance("POP_LETTER", f, { letter: j });
                      return <span key={j} style={{ display: "inline-block", opacity: s.o, transformOrigin: "50% 60%", transform: `translateY(${s.dy.toFixed(2)}px) scale(${s.s.toFixed(4)})` }}>{ch}</span>;
                    })}
                  </span>
                </React.Fragment>
              );
            }
            return <React.Fragment key={k}>{sep}<span style={style}>{w.text}</span></React.Fragment>;
          })}
        </div>
      ))}
    </div>
  );
}
