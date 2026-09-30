/**
 * KineticText — the renderer for kinetic.js. A phrase is drawn word by word:
 * every word is its own inline box with its own weight, colour, entrance,
 * emphasis and exit. Lines are real inline text (the browser sets the spaces
 * and the kerning); a word that has not arrived has no width, a word that is
 * growing pushes its neighbours, so the line reflows as words arrive.
 *
 * Never a whole-block fade or a block transform: the only transforms are per
 * word (and per letter for letter_stagger).
 */
import React from "react";
import {
  FPS, wordEntrance, entranceFrames, emphasisState, microMotion, wordSchedule, wordExit, pickEntrances, ENTRANCE_FRAMES, EMPHASIS,
} from "./kinetic.js";
import { easeOut, easeInOut } from "./animations.js";

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

/** Per-word cross-frame motion for the hook / CTA: words travel across the frame; one is oversized on the way. */
function crossState(i, f, big) {
  const d = 18, p = clamp01(f / d);
  if (f <= 0) return { dx: 0, dy: 0, s: 1, rot: 0, blur: 0, o: 0, reveal: 1 };
  const side = i % 2 ? 1 : -1, e = easeOut(p);
  return { dx: side * 1100 * (1 - e), dy: side * -60 * (1 - e), s: big ? 1 + 0.9 * Math.sin(Math.PI * Math.min(1, p * 1.05)) * (1 - p * 0.15) : 1, rot: side * 5 * (1 - e), blur: 0, o: clamp01(f / 2), reveal: 1 };
}

/**
 * b: a box { x, y, w, h, size, align, words?/rows? | lines }.
 * timing (frames from the beat's start): start, resolveBy, exitAt.
 * entrances: one name per word (pickEntrances); falls back to a deterministic pick.
 * mode "cross": the hook / CTA composition.
 */
export function KineticText({
  b, color, accent, local, dur, entrances, start = 0, resolveBy = 0.4, exitAt = 0.7, mode = null, font, lineHeight, tracking = 0,
  upper = false, baseWeight = 500, seed = "", beat = 0, family = "serif",
}) {
  const rows = rowsOf(b, baseWeight);
  const flat = rows.flat();
  const n = flat.length;
  if (!n) return null;
  const right = b.align === "right";
  const lh = lineHeight ?? b.size * 0.95;
  const ent = entrances && entrances.length >= n ? entrances : pickEntrances(n, { seed, beat });
  const sched = wordSchedule(n, dur, { start, resolveBy, exitAt, entrance: mode === "cross" ? 18 : 8 });
  const bigWord = mode === "cross" ? (flat.findIndex((w) => w.emph) >= 0 ? flat.findIndex((w) => w.emph) : flat.reduce((m, w, i) => (w.text.length > flat[m].text.length ? i : m), 0)) : -1;
  let wi = 0;
  return (
    <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h }}>
      {rows.map((row, li) => (
        <div key={li} style={{ height: lh, lineHeight: `${lh}px`, whiteSpace: "nowrap", textAlign: right ? "right" : "left", fontFamily: font, fontSize: b.size, letterSpacing: tracking, fontOpticalSizing: "auto", textTransform: upper ? "uppercase" : "none" }}>
          {row.map((w, k) => {
            const i = wi++;
            const f = local - sched.enter[i];
            const name = ent[i];
            const started = f > 0;
            const nLet = [...w.text].length;
            const landed = f >= (mode === "cross" ? 18 : entranceFrames(name, nLet)) + 0.5;
            const em = w.emph ? emphasisState(f - (mode === "cross" ? 18 : entranceFrames(name, nLet))) : { s: 1, accent: 0 };
            const arrive = started ? easeOut(clamp01(f / 6)) : 0;
            const en = mode === "cross" ? crossState(i, f, i === bigWord) : wordEntrance(name, f);
            const mm = landed ? microMotion(f, i) : { s: 1, dx: 0, dy: 0 };
            const fx = local - sched.exit[i];
            const ex = fx > 0 ? wordExit(fx, sched.exitFrames) : { dy: 0, clip: 0 };
            const gone = ex.clip >= 0.999;
            // colour: an accent word takes the accent as its emphasis window opens; an emphasis-only word borrows it through the window
            const mix = w.accent ? (w.emph ? clamp01((f - (mode === "cross" ? 18 : entranceFrames(name, nLet))) / EMPHASIS.grow) : 1) : em.accent;
            const col = mixColor(color, accent || color, mix);
            const scale = en.s * em.s * mm.s;
            const naturalW = (w.w ?? 0) / 1.03;
            const style = {
              display: started ? "inline-block" : "none", position: "relative", verticalAlign: "top",
              width: started && !(arrive >= 1 && em.s === 1) && naturalW ? naturalW * arrive * em.s : undefined,
              visibility: started && !gone ? "visible" : "hidden",
              transformOrigin: right ? "100% 60%" : "0% 60%",
              transform: `translate(${(en.dx + mm.dx).toFixed(2)}px, ${(en.dy + mm.dy + ex.dy * lh).toFixed(2)}px) rotate(${en.rot.toFixed(2)}deg) scale(${scale.toFixed(4)})`,
              filter: en.blur > 0.2 ? `blur(${en.blur.toFixed(1)}px)` : "none",
              opacity: en.o,
              clipPath: ex.clip > 0 ? `inset(0 0 ${(ex.clip * 100).toFixed(1)}% 0)` : en.reveal < 1 ? `inset(-10% ${((1 - en.reveal) * 100).toFixed(1)}% -10% -5%)` : "none",
              fontWeight: w.weight, color: col,
            };
            if (name === "letter_stagger" && mode !== "cross" && f < entranceFrames(name, nLet) + 1 && fx <= 0) {
              return (
                <React.Fragment key={k}>
                  {k > 0 && started ? " " : ""}<span style={{ ...style, opacity: 1, transform: "none", clipPath: "none", width: undefined, display: started ? "inline-block" : "none" }}>
                    {[...w.text].map((ch, j) => {
                      const s = wordEntrance("letter_stagger", f, { letter: j });
                      return <span key={j} style={{ display: "inline-block", opacity: s.o, transform: `translateY(${s.dy.toFixed(2)}px)` }}>{ch}</span>;
                    })}
                  </span>
                </React.Fragment>
              );
            }
            return <React.Fragment key={k}>{k > 0 && started ? " " : ""}<span style={style}>{w.text}</span></React.Fragment>;
          })}
        </div>
      ))}
    </div>
  );
}
