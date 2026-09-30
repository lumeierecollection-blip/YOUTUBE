#!/usr/bin/env node
// Unit tests for visual/kinetic.js (kinetic typography: markup, layout, entrances, emphasis, schedule, numbers).
import { parseMarkup, markWords, layoutWords, fitWords, pickEntrances, ENTRANCES, wordEntrance, emphasisState, wordSchedule, wordExit, numberMode, scaleImpact, fitNumberBleed, microMotion, EMPHASIS_FRAMES } from "../src/skills/remotion-render/visual/kinetic.js";
import { numberParts, numberSlots } from "../src/skills/remotion-render/visual/typography.js";
let fail = 0;
const yes = (name, ok, extra = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`); if (!ok) fail++; };

const w = parseMarkup("The <bold>cost</bold> of <accent>borrowing</accent>");
yes("markup: four words, cost bold, borrowing accent", w.length === 4 && w[1].weight === 700 && !w[1].accent && w[3].accent && w[0].weight === 500);
const auto = markWords("Investors lost heavily", []);
yes("auto marks: one accent+emphasis word (the longest content word)", auto.filter((x) => x.accent).length === 1 && auto.find((x) => x.accent).text === "heavily" || auto.find((x) => x.accent)?.text === "Investors");
yes("planner marks win", markWords("The fraud cost investors", ["fraud"]).find((x) => x.emph).text === "fraud");
yes("mixed weight in one phrase", new Set(markWords("Why the rule breaks now", []).map((x) => x.weight)).size === 2);

const L = fitWords(markWords("Why the 50/30/20 rule breaks"), 984, { max: 360, maxLines: 5, maxHeight: 1100 });
yes("fit: no line wider than the box", L.lines.every((ln) => ln.reduce((a, i, k) => a + L.words[i].w + (k ? L.space : 0), 0) <= 984 + 1), `size ${L.size}, ${L.lines.length} lines`);
const R = layoutWords(markWords("a bb ccc"), 100, 2000, { align: "right" });
yes("right alignment ends flush", Math.abs(R.words[2].x + R.words[2].w - R.width) < 0.01);

// entrances: never twice in a row along a line, never the same at a position in consecutive beats, all from the nine
let prev = [], hist = [], bad = 0;
for (let b = 0; b < 30; b++) {
  const n = 2 + (b % 5), p = pickEntrances(n, { seed: "t", beat: b, prev, history: hist });
  p.forEach((e, i) => { if (!ENTRANCES.includes(e) || e === p[i - 1] || e === prev[i]) bad++; hist[i] = [...(hist[i] || []), e]; });
  prev = p;
}
yes("entrances: 30 beats, no adjacent repeat, no same-position repeat", bad === 0);
yes("entrances deterministic", JSON.stringify(pickEntrances(5, { seed: "x", beat: 3 })) === JSON.stringify(pickEntrances(5, { seed: "x", beat: 3 })));
yes("a position uses every entrance before reusing one", (() => { let pv = [], h = [], seen = new Set(); for (let b = 0; b < 9; b++) { const p = pickEntrances(1, { seed: "u", beat: b, prev: pv, history: h }); seen.add(p[0]); h[0] = [...(h[0] || []), p[0]]; pv = p; } return seen.size === 9; })());

const e = (n, f) => wordEntrance(n, f);
yes("slide_in_left: from -40 px, settled in 8 frames", e("slide_in_left", 0.05).dx < -35 && Math.abs(e("slide_in_left", 8).dx) < 0.01);
yes("drop_in: from -30 px, overshoots by 2 px", e("drop_in", 0.05).dy < -25 && Math.max(...Array.from({ length: 9 }, (_, f) => e("drop_in", f).dy)) > 1.5);
yes("rise_up: from 20 px below", e("rise_up", 0.05).dy > 15);
yes("scale_punch: 0.8 -> 1.06 -> 1.0", e("scale_punch", 0.05).s < 0.85 && Math.max(...Array.from({ length: 9 }, (_, f) => e("scale_punch", f).s)) > 1.05 && e("scale_punch", 8).s === 1);
yes("blur_in: 10 px -> 0 over 10 frames", e("blur_in", 0.05).blur > 8 && e("blur_in", 10).blur === 0);
yes("rotate_in: -6 deg -> 0", e("rotate_in", 0.05).rot < -5 && e("rotate_in", 9).rot === 0);
yes("mask_sweep reveals left to right", e("mask_sweep", 1).reveal < 0.3 && e("mask_sweep", 9).reveal === 1);
yes("letter_stagger: letters 30 ms apart", e("letter_stagger", 0.1).o < 1 && wordEntrance("letter_stagger", 2, { letter: 5 }).o === 0);
yes("no entrance is a plain fade (each moves or masks)", ENTRANCES.every((n) => { const s = e(n, 1.5); return s.dx || s.dy || s.s !== 1 || s.rot || s.blur || s.reveal < 1 || n === "letter_stagger"; }));

yes("emphasis: 1.15 in 4 frames, hold 6, settle to 1.0", emphasisState(4).s === 1.15 && emphasisState(9).s === 1.15 && emphasisState(EMPHASIS_FRAMES).s === 1 && emphasisState(2).s > 1 && emphasisState(2).s < 1.15);
yes("emphasis: accent through the window", emphasisState(6).accent === 1 && emphasisState(EMPHASIS_FRAMES).accent === 0);
yes("micro-motion: 0.5% scale, <= 1 px drift", (() => { let s = 0, d = 0; for (let f = 0; f < 200; f++) { const m = microMotion(f, 2); s = Math.max(s, Math.abs(m.s - 1)); d = Math.max(d, Math.abs(m.dy)); } return s <= 0.0051 && d <= 1.01 && s > 0.002; })());

for (const [n, dur] of [[3, 90], [5, 120], [7, 150], [4, 60]]) {
  const s = wordSchedule(n, dur);
  yes(`schedule ${n} words / ${dur} frames: all landed by 40%`, s.enter[n - 1] + 8 <= dur * 0.4 + 0.01, `stagger ${s.stagger.toFixed(1)}f${s.tight ? " (tight)" : ""}`);
  yes(`schedule ${n}/${dur}: exits in the last 30%, the last one done by the end`, s.exit[0] >= dur * 0.7 - 0.01 && s.exit[n - 1] + s.exitFrames <= dur + 0.01);
}
yes("stagger is 4-8 frames when the beat allows", (() => { const s = wordSchedule(4, 150); return s.stagger >= 4 && s.stagger <= 8; })());
yes("exit is a mask, not a fade", wordExit(4).clip > 0 && wordExit(4).dy < 0 && wordExit(8).clip === 1);

yes("a year never counts", numberMode("2019") === "scale_impact");
yes("an article / section number never counts", numberMode("Section 12") === "scale_impact" && numberMode("357-A") === "scale_impact");
yes("a quantity picks a mode, never the same twice in a row", (() => { let pv = null; for (let i = 0; i < 20; i++) { const m = numberMode("$105M", { beat: i, seed: "s", prev: pv }); if (m === pv) return false; pv = m; } return true; })());
yes("scale_impact: 0.6 -> 1.4 -> 1.0", Math.abs(scaleImpact(0) - 0.6) < 0.01 && Math.max(...Array.from({ length: 21 }, (_, i) => scaleImpact(i / 20))) > 1.38 && scaleImpact(1) === 1);

for (const v of ["$105M", "34%", "5", "1,250", "$127 million"]) {
  const parts = numberParts(v);
  const f = fitNumberBleed((s) => numberSlots(parts, s), 984, { max: 1100, min: 120 });
  const slots = numberSlots(parts, f.size).slots;
  const solid = slots.filter((x) => !["suffix", "percent", "post"].includes(x.kind));
  const solidW = solid.length ? solid[solid.length - 1].x + solid[solid.length - 1].w : 0;
  yes(`number ${v}: digits inside the frame, only the unit may bleed`, solidW <= 984 + 1 && f.width <= 984 + slots.filter((x) => ["suffix", "percent", "post"].includes(x.kind)).reduce((a, x) => a + x.w, 0) * 0.5 + 1, `size ${f.size}, bleed ${f.bleed}`);
}
console.log(fail ? `${fail} FAILED` : "all pass");
process.exit(fail ? 1 : 0);
