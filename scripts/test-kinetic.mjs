#!/usr/bin/env node
// Unit tests for visual/kinetic.js (kinetic typography: markup, layout, entrances, emphasis, schedule, numbers).
import { parseMarkup, markWords, layoutWords, fitWords, popEntrances, popState, ENTRANCES, wordEntrance, wordSchedule, wordExit, numberMode, numberPop, numberRoll, digitRoll, fitNumberBleed, microMotion, stackSettle } from "../src/skills/remotion-render/visual/kinetic.js";
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

// entrances: the pop family only
const W = (t, emph = false) => ({ text: t, emph });
const words = [W("The"), W("fraud", true), W("cost"), W("investors")];
yes("headline: the emphasis word POP_EMPHASIS, the rest POP_STANDARD", JSON.stringify(popEntrances(words)) === JSON.stringify(["POP_STANDARD", "POP_EMPHASIS", "POP_STANDARD", "POP_STANDARD"]));
yes("labels pop soft", popEntrances(words, { group: "label" }).every((e) => e === "POP_SOFT"));
yes("the hook / CTA pops hard by default", popEntrances(words, { edge: true }).every((e) => e === "POP_HARD"));
yes("POP_HARD off the hook / CTA falls back to standard", popEntrances(words, { style: "POP_HARD" }).every((e) => e === "POP_STANDARD"));
yes("POP_LETTER / POP_WORD_STACK apply to every word", popEntrances(words, { style: "POP_LETTER" }).every((e) => e === "POP_LETTER") && popEntrances(words, { style: "POP_WORD_STACK" }).every((e) => e === "POP_WORD_STACK"));
yes("every entrance is a pop", ENTRANCES.every((n) => n.startsWith("POP_")) && ENTRANCES.length === 6);

const e = (n, f) => wordEntrance(n, f);
const peak = (n, frames) => Math.max(...Array.from({ length: frames * 4 + 1 }, (_, k) => e(n, k / 4).s));
yes("POP_STANDARD: 0.92 -> 1.0, y 8 -> 0, landed at frame 6, never past 1 (no overshoot)", Math.abs(popState("POP_STANDARD", 0.001).s - 0.92) < 0.01 && e("POP_STANDARD", 6).s === 1 && e("POP_STANDARD", 6).dy === 0 && peak("POP_STANDARD", 6) <= 1);
yes("POP_EMPHASIS: 0.75 -> 1.0 over 10 frames, never past 1", Math.abs(popState("POP_EMPHASIS", 0.001).s - 0.75) < 0.01 && peak("POP_EMPHASIS", 10) <= 1 && e("POP_EMPHASIS", 10).s === 1);
yes("POP_SOFT: 0.95 -> 1.0 in 4 frames", Math.abs(popState("POP_SOFT", 0.001).s - 0.95) < 0.01 && e("POP_SOFT", 4).s === 1);
yes("POP_HARD: 0.6 -> 1.0 over 12 frames, never past 1", Math.abs(popState("POP_HARD", 0.001).s - 0.6) < 0.01 && peak("POP_HARD", 12) <= 1 && e("POP_HARD", 12).s === 1);
yes("POP_LETTER: letters 30 ms apart", wordEntrance("POP_LETTER", 2, { letter: 0 }).o > 0 && wordEntrance("POP_LETTER", 2, { letter: 5 }).o === 0);
yes("no entrance slides, rotates, blurs or wipes", ENTRANCES.every((n) => Array.from({ length: 13 }, (_, f) => e(n, f)).every((s) => s.dx === 0 && s.rot === 0 && s.blur === 0 && s.reveal === 1)));
yes("a pop is not a slow fade: full opacity by 45% of the pop", e("POP_STANDARD", 2.8).o === 1 && e("POP_HARD", 5.5).o === 1);
yes("nothing is visible before its pop starts", ENTRANCES.every((n) => e(n, 0).o === 0));
yes("word stack settles after the last word lands and holds", stackSettle(12, 12 + 6 + 8) === 0 && stackSettle(12, 12 + 6 + 8 + 12) === 1);
yes("micro-motion: none — a landed word stays put", (() => { for (let f = 0; f < 200; f++) { const m = microMotion(f, 2); if (m.s !== 1 || m.dx !== 0 || m.dy !== 0) return false; } return true; })());

for (const [n, dur] of [[3, 90], [5, 120], [7, 150], [4, 60]]) {
  const s = wordSchedule(n, dur);
  yes(`schedule ${n} words / ${dur} frames: all landed by 40%`, s.enter[n - 1] + 8 <= dur * 0.4 + 0.01, `stagger ${s.stagger.toFixed(1)}f${s.tight ? " (tight)" : ""}`);
  yes(`schedule ${n}/${dur}: exits in the last 30%, the last one done by the end`, s.exit[0] >= dur * 0.7 - 0.01 && s.exit[n - 1] + s.exitFrames <= dur + 0.01);
}
yes("each word pops 4-6 frames after the previous when the beat allows", (() => { const s = wordSchedule(4, 150); return s.stagger >= 4 && s.stagger <= 6; })());
yes("exit is a mask, not a fade", wordExit(4).clip > 0 && wordExit(4).dy < 0 && wordExit(8).clip === 1);

yes("a year pops, never rolls", numberMode("2019") === "pop");
yes("an article / section number pops, never rolls", numberMode("Section 12") === "pop" && numberMode("357-A") === "pop");
yes("a quantity pops then rolls", numberMode("$105M") === "pop_roll" && numberMode("34%") === "pop_roll");
yes("number pop: 1.3 -> 1.0 over 8 frames, never under 1 (no settle)", Math.abs(numberPop(0.001).s - 1.3) < 0.01 && numberPop(8).s === 1 && Math.min(...Array.from({ length: 33 }, (_, k) => numberPop(k / 4).s)) >= 1);
yes("roll: nothing until the pop settles, done 20 frames later", numberRoll(8) === 0 && numberRoll(28) === 1 && numberRoll(18) > 0 && numberRoll(18) < 1);
yes("digit slots roll from 0 to their digit", digitRoll(0, 0, 7) === 0 && digitRoll(1, 0, 7) === 7 && digitRoll(1, 3, 5) === 5 && digitRoll(0.5, 3, 5) < digitRoll(0.5, 0, 5));

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
