// node scripts/test-animations.mjs — the animation library (visual/animations.js) and the planner rules (visual/animation-plan.js).
import {
  ANIMATIONS, TEXT_ENTRANCES, EXITS, BAR, PIE, LINE, NUMBER, LEGACY, NAMED_COUNT, familyOf, animationById,
  entrance, exitState, barState, pieState, lineState, numberState, countValue, countDownStart, rollOffset, bounceOut, backOut, elasticOut, unitOf, entranceSeconds,
} from "../src/skills/remotion-render/visual/animations.js";
import { animationsFor, allowedFor, hash } from "../src/skills/remotion-render/visual/animation-plan.js";

let bad = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};
const ok = (name, cond) => eq(name, !!cond, true);

// The vocabulary the brief lists.
eq("15 text entrances", TEXT_ENTRANCES.map((a) => a.id), ["TYPE_IN", "MASK_SWEEP", "SLIDE_FROM_L", "SLIDE_FROM_R", "DROP_IN", "RISE_FROM_BASE", "SCALE_UP", "SCALE_PUNCH", "FADE_LIFT", "BLUR_IN", "LETTER_STAGGER", "WORD_STAGGER", "SPLIT_REVEAL", "WHIP_IN", "CUT_IN"]);
eq("6 exits", EXITS.map((a) => a.id), ["FADE_OUT", "SLIDE_OUT_L", "SLIDE_OUT_R", "SCALE_DOWN", "MASK_CLOSE", "CUT_OUT"]);
eq("7 bar", BAR.map((a) => a.id), ["BAR_GROW", "BAR_DROP", "BAR_SPLIT", "BAR_STACK", "BAR_PULSE", "BAR_WAVE", "BAR_COMPARE"]);
eq("4 pie", PIE.map((a) => a.id), ["PIE_SWEEP", "PIE_POP", "PIE_ROTATE", "PIE_FROM_TOP"]);
eq("3 line", LINE.map((a) => a.id), ["LINE_DRAW", "LINE_DROP", "LINE_DOT_FIRST"]);
eq("6 number", NUMBER.map((a) => a.id), ["COUNT_UP", "COUNT_DOWN", "ROLL_DIGIT", "FLIP_CARD", "SNAP_IN", "SCALE_IMPACT"]);
eq("41 named animations (>= 30)", NAMED_COUNT, 41);
eq("ids are unique", new Set(ANIMATIONS.map((a) => a.id)).size, ANIMATIONS.length);
eq("the pre-rebuild motions are kept", LEGACY.map((a) => a.id), ["CROP_OPEN", "WORD_FLY", "SLIDE_LAND", "EMPHASIS_SCALE"]);
eq("staggers: letters 40 ms, words 80 ms", [unitOf("LETTER_STAGGER"), unitOf("WORD_STAGGER"), entranceSeconds("LETTER_STAGGER", 11) - entranceSeconds("LETTER_STAGGER", 1), entranceSeconds("WORD_STAGGER", 6) - entranceSeconds("WORD_STAGGER", 1)].map((v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v)), ["letter", "word", 0.4, 0.4]);
eq("families: MASK_SWEEP and SPLIT_REVEAL are both mask", [familyOf("MASK_SWEEP"), familyOf("SPLIT_REVEAL")], ["mask", "mask"]);

// Every entrance ends at rest (the settled frame is the static layout) and starts hidden or displaced.
for (const a of TEXT_ENTRANCES) {
  const end = entrance(a.id, 1), start = entrance(a.id, 0);
  ok(`${a.id}: rests at p=1`, end.o === 1 && end.dx === 0 && end.dy === 0 && end.s === 1 && end.blur === 0 && end.rx === 1);
  ok(`${a.id}: is not the settled frame at p=0`, start.o < 1 || start.dx !== 0 || start.dy !== 0 || start.s !== 1 || start.blur > 0 || start.rx < 1 || start.ry < 1);
  ok(`${a.id}: opacity stays in 0..1 all along`, [0, 0.1, 0.3, 0.6, 0.9, 1].every((p) => { const e = entrance(a.id, p); return e.o >= 0 && e.o <= 1.0001; }));
}
for (const a of EXITS) {
  ok(`${a.id}: starts at rest`, exitState(a.id, 0).o === 1);
  ok(`${a.id}: ends gone (opacity 0 or fully closed)`, exitState(a.id, 1).o === 0 || exitState(a.id, 1).rx === 0);
}
// Charts and numbers.
for (const id of BAR.map((a) => a.id)) {
  const end = barState(id, 1, 1, 3, { primary: 0, sec: 0 });
  ok(`${id}: bars end at their value (grow ~1, no offset)`, Math.abs(end.grow - 1) < 0.02 && Math.abs(end.dy) < 1);
  ok(`${id}: bars start empty or off-screen`, barState(id, 0, 1, 3).grow <= 0.001 || barState(id, 0, 1, 3).dy < -100 || barState(id, 0, 1, 3).o === 0);
  ok(`${id}: never overshoots past 1.12`, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].every((t) => barState(id, t, 0, 3, { primary: 0 }).grow <= 1.12));
}
for (const id of PIE.map((a) => a.id)) ok(`${id}: the ring ends whole (arc 1 at count 1, no offset)`, (() => { const e = pieState(id, 1, 1); return Math.abs(e.arc - 1) < 1e-6 && e.rot === 0 && Math.abs(e.dy) < 1 && Math.abs(e.ringScale - 1) < 0.001 && Math.abs(e.explode) < 0.5; })());
for (const id of LINE.map((a) => a.id)) ok(`${id}: line drawn, dots down at the end`, (() => { const e = lineState(id, 1, 2, 3); return e.draw === 1 && e.dot >= 0.999 && Math.abs(e.dropY) < 1; })());
eq("COUNT_UP rises from 0", [countValue("COUNT_UP", 105, 0, 0), countValue("COUNT_UP", 105, 0, 1)], [0, 105]);
eq("COUNT_DOWN falls from the same digit count", [countDownStart(105, 0), countValue("COUNT_DOWN", 105, 0, 0), countValue("COUNT_DOWN", 105, 0, 1)], [999, 999, 105]);
eq("COUNT_DOWN keeps the decimals", countDownStart(1.4, 1), 9.9);
ok("COUNT_DOWN never passes below the figure", [0, 0.3, 0.6, 1].every((c) => countValue("COUNT_DOWN", 34, 0, c) >= 34));
eq("ROLL_DIGIT rests on its digit", rollOffset(1, 0, 7), 0);
ok("ROLL_DIGIT's right-most digit lands first", rollOffset(0.5, 0, 5) < rollOffset(0.5, 3, 5));
for (const id of ["FLIP_CARD", "SNAP_IN", "SCALE_IMPACT"]) { const e = numberState(id, 1); ok(`${id}: the figure ends unscaled, unturned`, e.s === 1 && e.rotX === 0 && e.o === 1 && e.dy === 0); }
ok("SCALE_IMPACT starts big (flat: 1.5x, lands once, no ringing)", numberState("SCALE_IMPACT", 0.05).s > 1.3 && numberState("SCALE_IMPACT", 0.6).s === 1);
ok("easings: bounce, back and elastic end on 1", [bounceOut(1), backOut(1), elasticOut(1)].every((v) => Math.abs(v - 1) < 1e-9));

// The planner rules.
const mk = (n, f) => Array.from({ length: n }, (_, i) => ({ composition: "TYPE-FULL", headlineChars: 24, headlineWords: 4, kickerChars: 12, kickerWords: 2, labelChars: 14, labelWords: 3, number: true, quantity: true, chart: null, last: i === n - 1, ...(f ? f(i) : {}) }));
const roles = ["headline", "kicker", "number", "label", "chart"];
function checkRun(name, items, seed) {
  const run = animationsFor(items, { seed });
  const problems = [];
  run.beats.forEach((b, i) => {
    const it = items[i];
    // 1. one animation per element, every present element has one
    for (const r of roles) {
      const present = r === "headline" ? it.headlineChars : r === "kicker" ? it.kickerChars : r === "label" ? it.labelChars : r === "number" ? it.number : it.chart;
      if (present && !b[r]) problems.push(`beat ${i}: ${r} has no animation`);
      if (!present && b[r]) problems.push(`beat ${i}: ${r} animated but absent`);
    }
    // 2. no family repeated on the same element in consecutive beats
    if (i > 0) for (const r of roles) if (b[r] && run.beats[i - 1][r] && familyOf(b[r]) === familyOf(run.beats[i - 1][r])) problems.push(`beat ${i}: ${r} family ${familyOf(b[r])} repeats`);
    // 3. text families distinct inside a beat
    const fams = ["headline", "kicker", "label"].filter((r) => b[r]).map((r) => familyOf(b[r]));
    if (new Set(fams).size !== fams.length) problems.push(`beat ${i}: text families collide ${fams}`);
    if (b.exit) { if (!b[b.exit.element]) problems.push(`beat ${i}: exit on an absent element`); if (familyOf(b.exit.id) === familyOf(b[b.exit.element])) problems.push(`beat ${i}: exit shares its element's family`); }
  });
  eq(`${name}: rules hold (${run.relaxed.length} relaxation(s))`, problems, []);
  return run;
}
checkRun("12 beats, every element", mk(12), "a");
checkRun("12 beats, headlines only", mk(12, () => ({ kickerChars: 0, labelChars: 0, number: false })), "b");
checkRun("chart/number beats", mk(10, (i) => ({ chart: ["BAR", "PIE", "LINE", "GAUGE"][i % 4], number: i % 2 === 0, quantity: i % 4 !== 0 })), "c");
for (let k = 0; k < 20; k++) {
  const items = mk(8 + (k % 5), (i) => ({ kickerChars: (i + k) % 3 ? 10 : 0, labelChars: (i * k) % 2 ? 12 : 0, number: (i + k) % 4 === 0, quantity: (i + k) % 8 !== 0, chart: (i + k) % 5 === 0 ? ["BAR", "PIE", "LINE", "GAUGE"][(i + k) % 4] : null, headlineChars: 8 + ((i * 7 + k) % 40), headlineWords: 1 + ((i + k) % 6) }));
  checkRun(`fuzz ${k}`, items, `seed${k}`);
}
// Reproducible, and different for different seeds.
const s1 = animationsFor(mk(8), { seed: "x" }).beats, s2 = animationsFor(mk(8), { seed: "x" }).beats, s3 = animationsFor(mk(8), { seed: "y" }).beats;
eq("same seed, same plan", s1, s2);
ok("different seed, different plan", JSON.stringify(s1) !== JSON.stringify(s3));
// The 3-beat window: the same headline animation is not reused within three beats while the vocabulary allows.
const run = animationsFor(mk(12), { seed: "w" });
const reuse = run.beats.flatMap((b, i) => [1, 2, 3].filter((d) => i - d >= 0 && run.beats[i - d].headline === b.headline).map(() => i));
eq("no headline animation within 3 beats of itself", reuse, []);
eq("recent_animations holds at most three beats", run.recent.every((r, i) => r.length <= 3 * 8), true);
// The vocabulary is spread: a 12-beat video uses many distinct animations.
ok("a 12-beat video uses >= 20 distinct animations", Object.keys(run.used).length >= 20);
// Constraints on what may be chosen.
ok("a one-word headline never gets WORD_STAGGER", !allowedFor("headline", { headlineChars: 8, headlineWords: 1 }).includes("WORD_STAGGER"));
ok("a long headline never gets LETTER_STAGGER / TYPE_IN", !allowedFor("headline", { headlineChars: 60, headlineWords: 9 }).some((id) => id === "LETTER_STAGGER" || id === "TYPE_IN"));
ok("a year (not a quantity) never counts", !allowedFor("number", { quantity: false }).some((id) => id.startsWith("COUNT")));
eq("a gauge never rotates", allowedFor("chart", { chart: "GAUGE" }).includes("PIE_ROTATE"), false);
eq("the major TYPE-FULL beat keeps its flying words", allowedFor("headline", { headlineChars: 20, headlineWords: 4, majorWords: true }), ["WORD_FLY"]);
ok("hash is stable", hash("a|1|headline|X") === hash("a|1|headline|X"));

console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
