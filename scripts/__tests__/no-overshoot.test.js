// NO BOUNCES (owner, 2026-10-10: "they're just weird bounces on what's on the screen. I hate that."). Every animated value in the
// renderer is sampled across its whole entrance: it may only move TOWARD its final value and stop there. Overshoot (passing the
// target and coming back), springs, wobbles and settles fail. Zero tolerance. The per-element easing and the measured overshoot
// are printed (node --test prints console.log), so the report can quote them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { popState, ENTRANCES, countProgress, microMotion } from "../../src/skills/remotion-render/visual/kinetic.js";
import { popInState, popOutState, POP } from "../../src/skills/remotion-render/visual/pop-groups.js";
import { entrance, barState, pieState, lineState, numberState, ANIMATIONS } from "../../src/skills/remotion-render/visual/animations.js";

const N = 240;
const steps = Array.from({ length: N + 1 }, (_, k) => k / N);
/** The largest excursion past `target` in the direction of travel from `start`, for a sampled series. */
function overshoot(series, start, target) {
  const dir = Math.sign(target - start) || 1;
  return Math.max(0, ...series.map((v) => (v - target) * dir));
}
/** Does the series ever move AWAY from its target after approaching it (a wobble / settle)? Returns the largest reversal. */
function reversal(series, start, target) {
  const dir = Math.sign(target - start) || 1;
  let best = 0, maxSoFar = -Infinity;
  for (const v of series) { const p = (v - start) * dir; if (p > maxSoFar) maxSoFar = p; best = Math.max(best, maxSoFar - p); }
  return best;
}
const report = [];
const judge = (name, easing, series, start, target) => {
  const o = overshoot(series, start, target), r = reversal(series, start, target);
  report.push(`${name.padEnd(34)} ${easing.padEnd(34)} overshoot ${o.toFixed(4)}  reversal ${r.toFixed(4)}`);
  assert.ok(o <= 1e-9, `${name}: overshoots its target by ${o}`);
  assert.ok(r <= 1e-9, `${name}: moves away from its target by ${r} after approaching it (wobble / settle)`);
};

test("word pops (every POP style): scale and rise arrive and stop", () => {
  for (const st of [...ENTRANCES, "NUMBER"]) {
    const frames = 24;
    const fr = Array.from({ length: frames * 8 + 1 }, (_, k) => 0.01 + (k / 8));
    const sc = fr.map((f) => popState(st, f).s), dy = fr.map((f) => popState(st, f).dy);
    judge(`word pop ${st} scale`, "ease-out (cubic-bezier .16,1,.3,1)", sc, sc[0], 1);
    judge(`word pop ${st} rise`, "ease-out", dy, dy[0], 0);
  }
});

test("landed words do not wobble (micro-motion is still)", () => {
  for (let f = 0; f < 200; f++) { const m = microMotion(f, 3); assert.deepEqual([m.s, m.dx, m.dy], [1, 0, 0]); }
  report.push(`${"landed word".padEnd(34)} ${"still".padEnd(34)} overshoot 0.0000  reversal 0.0000`);
});

test("beat transition group pop: arrives and stops (no 1.04 peak)", () => {
  const fr = Array.from({ length: 81 }, (_, k) => k / 8);
  const sIn = fr.map((f) => popInState(f).s);
  judge("group pop-in scale", "ease-out (cubic)", sIn, POP.S0, 1);
  const sOut = fr.map((f) => popOutState(f).s);
  judge("group pop-out scale", "linear", sOut, 1, POP.S0);
});

test("text entrances (the animation library): none passes its target", () => {
  for (const a of ANIMATIONS.filter((x) => ["stagger", "mask", "slide", "drop", "scale", "fade", "cut", "crop", "fly"].includes(x.family))) {
    const st = steps.map((p) => entrance(a.id, p));
    for (const k of ["dx", "dy", "s", "rot", "blur", "o"]) {
      const series = st.map((x) => x[k]).filter((v) => Number.isFinite(v));
      if (series.length < 2 || series.every((v) => v === series[0])) continue;
      judge(`entrance ${a.id} ${k}`, a.id === "WHIP_IN" ? "cubic-bezier(.05,.9,.1,1)" : "ease-out / ease-in-out / linear", series, series[0], series[series.length - 1]);
    }
  }
});

test("charts, pies, lines and numbers: none passes its target", () => {
  for (const a of ANIMATIONS.filter((x) => String(x.family).startsWith("bar"))) for (let i = 0; i < 3; i++) {
    judge(`bar ${a.id} #${i} grow`, "ease-out", steps.map((t) => barState(a.id, t, i, 3).grow), 0, 1);
    const dy = steps.map((t) => barState(a.id, t, i, 3).dy);
    if (dy.some((v) => v !== 0)) judge(`bar ${a.id} #${i} drop`, "ease-in-out", dy, dy[0], 0);
  }
  for (const a of ANIMATIONS.filter((x) => String(x.family).startsWith("pie"))) {
    judge(`pie ${a.id} ring`, "ease-in-out", steps.map((t) => pieState(a.id, t, t).ringScale), pieState(a.id, 0, 0).ringScale, 1);
    judge(`pie ${a.id} arc`, "ease-out / ease-in-out", steps.map((t) => pieState(a.id, t, t).arc), 0, 1);
  }
  for (const a of ANIMATIONS.filter((x) => String(x.family).startsWith("line"))) for (let i = 0; i < 3; i++) {
    judge(`line ${a.id} dot #${i}`, "ease-out", steps.map((t) => lineState(a.id, t, i, 3).dot), 0, 1);
  }
  for (const id of ["FLIP_CARD", "SNAP_IN", "SCALE_IMPACT"]) {
    const s = steps.map((p) => numberState(id, p).s);
    judge(`number ${id} scale`, "ease-out / ease-in", s, s[0], 1);
  }
  judge("number count-up", "ease-out (decelerates, no bounce)", Array.from({ length: 301 }, (_, f) => countProgress(f, 300, 0)), 0, 1);
});

test("the renderer's own drawing code has no time-driven oscillation", () => {
  const src = readFileSync(new URL("../../src/skills/remotion-render/visual/full-canvas.jsx", import.meta.url), "utf8").split(/\r?\n/);
  const bad = src.map((l, i) => [i + 1, l]).filter(([, l]) => /Math\.(sin|cos)\(/.test(l) && /(local|fps|frame)/.test(l) && !/^\s*\/\//.test(l));
  assert.deepEqual(bad.map(([n, l]) => `${n}: ${l.trim().slice(0, 100)}`), [], "a sin/cos of time in full-canvas.jsx");
  assert.ok(!/backOut|bounceOut|elasticOut/.test(src.join("\n")), "a spring curve in full-canvas.jsx");
});

test("report", () => { console.log("\n" + report.join("\n")); });
