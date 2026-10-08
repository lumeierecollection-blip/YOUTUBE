// The owner's template rule (2026-10-08): across any three consecutive beats, at most ONE of
// {corner label, bottom phrase, type-led layout} may repeat.
import { test } from "node:test";
import assert from "node:assert/strict";
import { templateCheck, enforceChrome, repeatsIn } from "../template-check.js";

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

test("a manifest beat with no chrome record fails closed", () => {
  assert.equal(templateCheck({ beats: [{ canvas: {} }, { canvas: {} }, { canvas: {} }] }).pass, false);
});

test("enforceChrome removes chrome only, until every window passes", () => {
  for (const s of ["LP LPT LP LPT LP", "LPT LPT LPT LPT", "LP LP LP LP LP LP", "L - L - L", "PT PT PT"]) {
    const items = d(s);
    const { keep, dropped } = enforceChrome(items);
    const after = items.map((x, i) => ({ ...x, ...keep[i] }));
    assert.equal(templateCheck(after).pass, true, `${s} -> ${JSON.stringify(after)}`);
    keep.forEach((k, i) => { if (k.label) assert.ok(items[i].label); if (k.phrase) assert.ok(items[i].phrase); });
    assert.ok(dropped.every((x) => items[x.beat][x.device === "phrase" ? "phrase" : "label"]));
  }
});

test("enforceChrome keeps chrome that is already legal", () => {
  const { dropped } = enforceChrome(d("L T P - L T P"));
  assert.equal(dropped.length, 0);
});
