// The owner's template rule (2026-10-08): across any three consecutive beats, at most ONE of
// {corner label, bottom phrase, type-led layout} may repeat.
// And (2026-10-09, the loophole): no device may appear on more than two consecutive beats.
import { test } from "node:test";
import assert from "node:assert/strict";
import { templateCheck, enforceChrome, repeatsIn, runsIn } from "../template-check.js";

const d = (s) => s.split(" ").map((t) => ({ label: t.includes("L"), phrase: t.includes("P"), typeLed: t.includes("T") }));

test("the old chassis (label + phrase on every beat) FAILS", () => {
  const r = templateCheck(d("LP LPT LP LPT LP"));
  assert.equal(r.pass, false);
  assert.equal(r.windows.length, 3);
});

test("one device repeating is allowed; two is the template", () => {
  assert.deepEqual(repeatsIn(d("T T -")), ["typeLed"]);
  assert.equal(templateCheck(d("T T - T T")).pass, true);
  assert.equal(templateCheck(d("LT LT -")).pass, false);
  assert.equal(templateCheck(d("L - P L - P")).pass, true);
});

// The loophole: under the 2026-10-08 rule alone a corner label on EVERY beat passed, because only
// one device repeated in each window. Each of these passed the old check and must fail now.
test("no device may appear on more than two consecutive beats — each device independently", () => {
  for (const s of ["L L L", "L L L L L L L L L", "P P P", "T T T", "L LP L", "- L L L -", "LT L PL"]) {
    const r = templateCheck(d(s));
    assert.equal(r.pass, false, `${s} must fail`);
    assert.ok(r.windows.some((w) => w.run.length === 1), `${s}: the failing window names the device that ran`);
  }
  assert.deepEqual(runsIn(d("L L L")), ["label"]);
  assert.deepEqual(runsIn(d("LP LP L")), ["label"]);
  // Two in a row is still allowed, for every device, and alternating runs stay legal.
  for (const s of ["L L - L L - L L", "P P - P P", "T T - T T", "L T L T L T", "L - L - L"]) assert.equal(templateCheck(d(s)).pass, true, `${s} must pass`);
});

test("a manifest beat with no chrome record fails closed", () => {
  assert.equal(templateCheck({ beats: [{ canvas: {} }, { canvas: {} }, { canvas: {} }] }).pass, false);
});

test("enforceChrome removes chrome only, until every window passes", () => {
  for (const s of ["LP LPT LP LPT LP", "LP LP LP LP LP LP", "L - L - L", "L L L L L", "P P P", "LP LP LP"]) {
    const items = d(s);
    const { keep, dropped, unfixable } = enforceChrome(items);
    const after = items.map((x, i) => ({ ...x, ...keep[i] }));
    assert.equal(unfixable.length, 0, s);
    assert.equal(templateCheck(after).pass, true, `${s} -> ${JSON.stringify(after)}`);
    keep.forEach((k, i) => { if (k.label) assert.ok(items[i].label); if (k.phrase) assert.ok(items[i].phrase); });
    assert.ok(dropped.every((x) => items[x.beat][x.device === "phrase" ? "phrase" : "label"]));
  }
});

test("enforceChrome reports a type-led run of three as unfixable — removal cannot break it", () => {
  for (const s of ["PT PT PT", "LPT LPT LPT LPT", "T T T"]) {
    const items = d(s);
    const { keep, unfixable } = enforceChrome(items);
    const after = items.map((x, i) => ({ ...x, ...keep[i] }));
    assert.ok(unfixable.length > 0, s);
    assert.ok(unfixable.every((u) => u.device === "typeLed"));
    // The manifest check still fails it (not loosened) — and ONLY on the type-led run.
    const r = templateCheck(after);
    assert.equal(r.pass, false, s);
    assert.ok(r.windows.every((w) => w.run.join() === "typeLed" && w.repeating.join() === "typeLed"), `${s} -> ${JSON.stringify(r.windows)}`);
  }
});

test("enforceChrome keeps chrome that is already legal", () => {
  const { dropped } = enforceChrome(d("L T P - L T P"));
  assert.equal(dropped.length, 0);
});
