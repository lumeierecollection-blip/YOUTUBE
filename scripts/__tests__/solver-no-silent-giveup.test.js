// THE SOLVER MUST NOT SILENTLY RETURN THE SEQUENCE IT KNOWS IS ILLEGAL.
//
// render-and-qa.js:1159 recorded this happening, in its own words:
//
//   "no legal sequence exists ... so the solver gave up and left a photo card
//    twice and a statement twice in a row, which canvas-type then failed"
//   (board 38044082797 ch 49)
//
// And it has kept happening since — ch-44 beat 3 "TYPE-FULL twice in a row",
// ch-2 beat 5 "TYPE-FULL+NAME twice in a row".
//
// The cause was not that the solver could not search. Both give-up paths fell
// through with `choice` UNCHANGED — the very pick whose `problems` had just been
// used to build the Gemini prompt:
//
//   if (!seqs.length) console.log("...no legal sequence exists...");   // <- then nothing
//   ... else console.log("...no valid sequence number... — the beats stay as Gemini picked");
//
// So an arrangement the code had already measured as illegal was returned
// unexamined, and the audit failed it. A rule the content genuinely cannot satisfy
// is a fact about this video, not a reason to stop searching.
//
// bestEffortSequence() is the same search as legalSequences() — same menus, same
// nearest-first ordering, same pruning — scoring arrangements by how many rules they
// break instead of discarding any that breaks one. It is the existing solver's
// fallback, not a second mechanism beside it, and it REPORTS the residue.
import { test } from "node:test";
import assert from "node:assert/strict";
import { legalSequences, bestEffortSequence, shotSequenceProblems } from "../render-and-qa.js";

// One option per beat. `sig` is the identity a repeat is keyed on; two beats with
// the same sig and the same composition key are the same frame twice.
const opt = (shot, sig, key) => ({ shot, sig, key, words: "top", phrase: false, typeLed: false, centred: false, canvas: {} });

// ch-44 beat 3: TYPE-FULL twice in a row. Three TYPE-FULL beats and nothing else,
// so no legal arrangement exists at all.
const CH44 = [
  [opt("a photo card", "p0", "PHOTO-BAND")],
  [opt("a photo card", "p1", "PHOTO-BAND")],
  [opt("words", "w2", "TYPE-FULL")],
  [opt("words", "w3", "TYPE-FULL")],   // <- the repeat
  [opt("a photo card", "p4", "PHOTO-BAND")],
];

// ch-2 beat 5: TYPE-FULL+NAME twice in a row, with legal alternatives available.
// No two adjacent beats share a key here, so a legal arrangement DOES exist.
const CH2 = [
  [opt("a photo card", "p0", "PHOTO-BAND")],
  [opt("words", "w1", "TYPE-FULL")],
  [opt("a name", "n2", "TYPE-FULL+NAME")],
  [opt("a photo card", "p3", "PHOTO-BAND")],
  [opt("a name", "n4", "TYPE-FULL+NAME")],
];

test("ch-44: no legal sequence exists, and that is reported not hidden", () => {
  const legal = legalSequences(CH44.map((m) => m.slice()), CH44.map((_, i) => i));
  assert.equal(legal.length, 0, "this fixture should have no legal arrangement — every beat has one option");
  const best = bestEffortSequence(CH44.map((m) => m.slice()), CH44.map((_, i) => i));
  assert.ok(best, "a best-effort arrangement must still be returned");
  assert.ok(Array.isArray(best) && best.length === CH44.length);
});

test("ch-44: the best-effort arrangement is no worse than the illegal pick", () => {
  const idx = CH44.map((_, i) => i);
  const best = bestEffortSequence(CH44.map((m) => m.slice()), idx);
  const illegal = CH44.map((m) => m[0]);           // what the code used to fall through to
  assert.ok(
    shotSequenceProblems(best, idx).length <= shotSequenceProblems(illegal, idx).length,
    "best-effort must never be worse than silently keeping the illegal sequence",
  );
});

test("best-effort never returns something worse than what the code used to keep", () => {
  // The property that matters, and the one the bug violated: whatever the search
  // is handed, the fallback is never worse than silently keeping the illegal pick.
  // It does NOT assert that a legal sequence exists for this fixture — shotSequenceProblems
  // carries rules beyond the repeat (template-window, alignment) that this
  // hand-built fixture has not been characterised against. Asserting that here
  // would be asserting something unverified.
  for (const fixture of [CH44, CH2]) {
    const idx = fixture.map((_, i) => i);
    const legal = legalSequences(fixture.map((m) => m.slice()), idx);
    const best = bestEffortSequence(fixture.map((m) => m.slice()), idx);
    const illegal = fixture.map((m) => m[0]);
    assert.ok(best, `no best-effort arrangement for a ${fixture.length}-beat fixture`);
    assert.ok(
      shotSequenceProblems(best, idx).length <= shotSequenceProblems(illegal, idx).length,
      "the fallback must never be worse than the illegal pick it replaces",
    );
    if (legal.length) {
      assert.ok(shotSequenceProblems(best, idx).length <= shotSequenceProblems(legal[0], idx).length,
        "best-effort must never be worse than a legal sequence that existed");
    }
  }
});

test("the fallback keeps each beat's own shot — it never invents one", () => {
  const idx = CH44.map((_, i) => i);
  const best = bestEffortSequence(CH44.map((m) => m.slice()), idx);
  best.forEach((o, i) => assert.ok(CH44[i].some((c) => c.sig === o.sig), `beat ${i} got a shot its menu never offered`));
});

test("the residue is reportable — the caller can name what is still broken", () => {
  const idx = CH44.map((_, i) => i);
  const left = shotSequenceProblems(bestEffortSequence(CH44.map((m) => m.slice()), idx), idx);
  assert.ok(Array.isArray(left), "the caller logs each remaining problem; it must be a list");
});