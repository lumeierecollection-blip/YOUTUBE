// A DATE WITH NO YEAR IS STILL A DATE ON THE FRAME.
//
// Board 38411644598:
//
//   ch-10 beat 2: date "November 12" — draws figure, none of it the entity
//   ch-8  beat 3: date "June 25"     — draws figure, none of it the entity
//
// entity-coverage.js required a four-digit year to match a date at all:
//
//   const y = (e.name.match(/(?:1[89]|20)\d{2}/) || [])[0];
//   if (d.kind === "figure" && y && String(d.text).includes(y)) return hit(d, "date card");
//
// "November 12" has no year, so y was undefined, both guards failed, and a date
// that was plainly drawn was reported as not drawn. The check was reading a
// narrower shape than the artifact — the eighth instance of that class here.
//
// WITH a year the year is still required. WITHOUT one the MONTH and the DAY must
// both be present, so the day alone cannot match an unrelated figure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { coverageOf } from "../entity-coverage.js";

const canvas = (text) => ({ composition: "ENTITY-ART", art: { kind: "figure", name: text, text } });

test("ch-10's real date is recognised when it is drawn", () => {
  const r = coverageOf(canvas("November 12"), { type: "date", name: "November 12" });
  assert.ok(r.covered, `a drawn date reported as uncovered: ${JSON.stringify(r)}`);
});

test("ch-8's real date is recognised when it is drawn", () => {
  assert.ok(coverageOf(canvas("June 25"), { type: "date", name: "June 25" }).covered);
});

test("a yearless date still needs the DAY, not just the month", () => {
  assert.ok(!coverageOf(canvas("November"), { type: "date", name: "November 12" }).covered,
    "a bare month name must not satisfy a date");
});

test("a yearless date still needs the MONTH, not just the day", () => {
  // The day alone would match any figure carrying that number — exactly the
  // mistake this check exists to catch.
  assert.ok(!coverageOf(canvas("12"), { type: "date", name: "November 12" }).covered,
    "a bare day must not satisfy a date");
});

test("an unrelated figure of the same shape fails", () => {
  assert.ok(!coverageOf(canvas("June 1"), { type: "date", name: "June 25" }).covered);
});

test("a date WITH a year still requires the year", () => {
  const c = canvas("September 28, 2026");
  assert.ok(coverageOf(c, { type: "date", name: "September 28, 2026" }).covered);
  assert.ok(!coverageOf(canvas("September 28"), { type: "date", name: "September 28, 2026" }).covered,
    "the year must not be dropped from a dated sentence");
});

test("the month may be abbreviated on the frame", () => {
  assert.ok(coverageOf(canvas("Nov 12"), { type: "date", name: "November 12" }).covered);
  assert.ok(coverageOf(canvas("Jun 25"), { type: "date", name: "June 25" }).covered);
});

test("a day of the month is not confused with a year", () => {
  // "June 25" must not be read as needing the year 25, nor as a bare 25.
  assert.ok(coverageOf(canvas("June 25"), { type: "date", name: "June 25" }).covered);
});