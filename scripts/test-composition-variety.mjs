// node scripts/test-composition-variety.mjs — the composition variety rule (scripts/composition-variety.js).
import * as V from "./composition-variety.js";
let bad = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`); };

// B.1: 3 of 10, never under the hook + CTA.
eq("max TYPE beats: 10 -> 3, 6 -> 2, 12 -> 4", [V.maxTypeBeats(10), V.maxTypeBeats(6), V.maxTypeBeats(12)], [3, 2, 4]);
const T = true, F = false;
eq("5/10 TYPE, two adjacent pairs", V.varietyReport([T, T, F, T, T, F, T, F, F, T]), { n: 10, count: 6, max: 3, adjacent: [1, 4], excess: 3, ok: false });
eq("hook + one + CTA, none adjacent: ok", V.varietyReport([T, F, F, T, F, F, F, F, F, T]).ok, true);
eq("convert order: adjacent first (never the hook / CTA), then excess", V.beatsToConvert([T, T, F, T, T, F, T, F, F, T]), [1, 4, 3, 6]);
eq("a name card (skip) is converted last", V.beatsToConvert([T, T, T, F, T], (i) => i === 1), [2, 1]);
eq("the CTA next to a TYPE beat: the beat before it converts", V.beatsToConvert([T, F, F, T, T]), [3]);

// isTypeCanvas: a hero visual or a photo is not typography; a name card is.
eq("TYPE-FULL statement is TYPE", V.isTypeCanvas({ composition: "TYPE-FULL" }), true);
eq("TYPE-FULL + hero cutout is visual", V.isTypeCanvas({ composition: "TYPE-FULL", concept_visuals: [{ name: "gavel" }] }), false);
eq("a name card is TYPE", V.isTypeCanvas({ composition: "TYPE-FULL", name_card: { name: "Gabe Bult" } }), true);
eq("DATA-FULL is visual", V.isTypeCanvas({ composition: "DATA-FULL" }), false);

// B.4 fallbacks, in order.
eq("a rise -> TREND up, labelled with its subject", V.trendOf("Mortgage rates rose again this week."), { direction: "up", label: "Mortgage rates", verb: "rose" });
eq("a fall -> TREND down", V.trendOf("Home sales fell sharply in Ohio.")?.direction, "down");
eq("no rise / fall -> null", V.trendOf("The court heard the case."), null);
eq("risk -> warning triangle", V.symbolFor("This puts every account at risk."), "warning-triangle");
eq("approval -> checkmark", V.symbolFor("The board approved the merger."), "checkmark");
eq("no stated meaning -> null", V.symbolFor("The meeting is on Tuesday."), null);
eq("key nouns: first and last noun-like content words", V.keyNouns("Leadership now means listening to customers."), ["Leadership", "customers"]);
{
  // The key-nouns last resort is off by default (CI runs 37803694366 / 37810883817: every
  // one beat-check looked at failed); COMPOSITION_KEYNOUNS=on restores it.
  const f = V.fallbacksFor("Higher rates lead to fewer home sales, a risk for builders.");
  eq("fallback order: process, trend, symbol (key nouns off)", f.map((x) => x.kind), ["process", "trend", "symbol"]);
  eq("a pure abstraction gets no fallback by default (stays TYPE)", V.fallbacksFor("Strong leadership changes company culture.").map((x) => x.kind), []);
  process.env.COMPOSITION_KEYNOUNS = "on";
  eq("fallback order with key nouns on: process, trend, symbol, keynouns", V.fallbacksFor("Higher rates lead to fewer home sales, a risk for builders.").map((x) => x.kind), ["process", "trend", "symbol", "keynouns"]);
  eq("key nouns on: a pure abstraction gets only the last resort", V.fallbacksFor("Strong leadership changes company culture.").map((x) => x.kind), ["keynouns"]);
  delete process.env.COMPOSITION_KEYNOUNS;
}
eq("one noun-like word: no fallback at all (the beat stays TYPE, logged)", V.fallbacksFor("This changes everything about leadership.").map((x) => x.kind), []);

// C.4: the planner's entrance styles stand as written; only a beat it left open is filled, and a
// filled beat differs from its neighbour. (Before: the planner's "together, together" was rewritten.)
{
  const s = V.assignEntranceStyles(["together", "together", "bogus", "staggered", "staggered"]);
  eq("entrance styles: the planner's kept, the open one filled", s, ["together", "together", "visual-first", "staggered", "staggered"]);
  const f = V.assignEntranceStyles([null, null, null, null]);
  eq("left open: none repeats its neighbour", f.every((x, i) => i === 0 || x !== f[i - 1]), true);
}
// Task 5.4: the planner's animation family stands; an open beat is filled.
{
  const a = V.assignAnimationFamilies([{ visual_type: "TYPE", animation_family: "slide-in" }, { visual_type: "TYPE", animation_family: "slide-in" }, { visual_type: "COUNTER" }]);
  eq("animation families: the planner's kept", a, ["slide-in", "slide-in", "count-up"]);
}

console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
