// The naming check's second look: a beat fails only if it fails on two different frames (scripts/lib/naming-looks.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { isFail, settleNaming } from "../lib/naming-looks.mjs";

const pass = (i) => ({ beat_index: i, verdict: "PASS", names: [{ shown: "x", expected: "x", ok: true }] });
const fail = (i, shown = "95 million curos") => ({ beat_index: i, verdict: "FAIL", names: [{ shown, expected: "95 million euros", ok: false, problem: "spelling" }] });

test("a one-off misread is cleared by the second look", () => {
  const out = settleNaming([pass(0), fail(1)], new Map([[1, pass(1)]]));
  assert.equal(isFail(out[1]), false);
  assert.equal(out[1].cleared_by_second_look, true);
  assert.equal(out[1].first_look.names[0].shown, "95 million curos");
});

test("a real misspelling fails both looks and stays failed", () => {
  const out = settleNaming([fail(1, "Gemany")], new Map([[1, fail(1, "Gemany")]]));
  assert.equal(isFail(out[0]), true);
  assert.ok(out[0].second_look);
});

test("a PASS verdict that lists a failing name still counts as a failure", () => {
  assert.equal(isFail({ verdict: "PASS", names: [{ ok: false }] }), true);
});

test("passing beats are never touched; a missing second answer keeps the first verdict; no second look returns the input", () => {
  const v = [pass(0), fail(1)];
  assert.equal(settleNaming(v, new Map([[0, fail(0)]]))[0], v[0], "a passing beat stays as it was");
  assert.equal(settleNaming(v, new Map())[1], v[1], "no second answer: the first verdict stands");
  assert.equal(settleNaming(v, null), v);
});

// ── Credit lines are not entity names (run 39961381904 ch-1) ──────────────────────────────────────────────────────────────────────────────
import { creditLinesOf, isCreditLineRead, dropCreditLineNames, setAsideCreditLines, namingCorrections, namingRetryDecision } from "../lib/naming-looks.mjs";

const CREDIT = "Photo: George Frederic Watts / Wikimedia Commons, Public domain";
// The verdicts the CI run produced for beat 4, verbatim (naming.json of run 39961381904): the portrait IS Petrie; the credit names its painter.
const watts = (extra = {}) => ({ beat_index: 4, verdict: "FAIL", names: [
  { shown: "5000 years", expected: "5000 years", ok: true, problem: "" },
  { shown: "George Frederic Watts", expected: "William Matthew Flinders Petrie", ok: false, problem: "Photo credit names George Frederic Watts instead of William Matthew Flinders Petrie" }], ...extra });

test("creditLinesOf reads the credit and the source line the renderer drew on a beat", () => {
  assert.deepEqual(creditLinesOf({ photo: { credit: CREDIT }, source_credit: "commons.wikimedia.org", concept_visuals: [{ credit: "Photo: A / Pixabay" }, {}] }),
    [CREDIT, "commons.wikimedia.org", "Photo: A / Pixabay"]);
  assert.deepEqual(creditLinesOf(null), []);
  assert.deepEqual(creditLinesOf({ photo: { credit: null } }), []);
});

test("the Watts credit line is set aside: the correct Petrie portrait no longer fails the video", () => {
  const out = dropCreditLineNames(watts(), [CREDIT]);
  assert.equal(isFail(out), false);
  assert.equal(out.verdict, "PASS");
  assert.equal(out.credit_line_set_aside, true);
  const w = out.names.find((n) => n.shown === "George Frederic Watts");
  assert.equal(w.credit_line, true);
});

test("without the credit on the beat the same reading still fails (the bar is unchanged)", () => {
  assert.equal(isFail(dropCreditLineNames(watts(), [])), true);
  assert.equal(isFail(dropCreditLineNames(watts(), ["Photo: Someone Else / Pixabay"])), true);
  assert.equal(isFail(dropCreditLineNames(watts(), undefined)), true);
});

test("a real misnaming next to a credit line still fails: only the credit-line name is set aside", () => {
  const v = { beat_index: 4, verdict: "FAIL", names: [
    { shown: "Flinders Petri", expected: "Flinders Petrie", ok: false, problem: "spelling" },
    { shown: "George Frederic Watts", expected: "x", ok: false, problem: "credit" }] };
  const out = dropCreditLineNames(v, [CREDIT]);
  assert.equal(isFail(out), true);
  assert.equal(out.names.filter((n) => n.ok === false).length, 1);
  assert.equal(out.names.find((n) => n.ok === false).shown, "Flinders Petri");
});

test("a stray word or a different name is not mistaken for the credit; a bare FAIL that listed nobody is not cleared", () => {
  assert.equal(isCreditLineRead("Egypt", [CREDIT]), false);
  assert.equal(isCreditLineRead("Wa", [CREDIT]), false);
  assert.equal(isCreditLineRead("Watt", [CREDIT]), false, "a partial word is a different (mis)spelling, not the credit");
  assert.equal(isCreditLineRead("George Frederic Watts", [CREDIT]), true);
  assert.equal(isCreditLineRead("george frederic watts / wikimedia commons", [CREDIT]), true);
  assert.equal(isCreditLineRead(CREDIT, [CREDIT]), true);
  assert.equal(isFail(dropCreditLineNames({ beat_index: 1, verdict: "FAIL", names: [] }, [CREDIT])), true);
});

test("setAsideCreditLines works per beat and survives a string beat_index from the model", () => {
  const credits = new Map([[4, [CREDIT]]]);
  const out = setAsideCreditLines([{ beat_index: 0, verdict: "PASS", names: [] }, watts({ beat_index: "4" })], credits);
  assert.equal(out[0].verdict, "PASS");
  assert.equal(isFail(out[1]), false);
  // a credit recorded for another beat does not excuse this one
  assert.equal(isFail(setAsideCreditLines([watts()], new Map([[2, [CREDIT]]]))[0]), true);
});

test("end to end through the second look: a credit-line failure on both looks is cleared, a real one is not", () => {
  const credits = new Map([[4, [CREDIT]]]);
  const first = setAsideCreditLines([watts()], credits);
  const second = new Map([[4, setAsideCreditLines([watts()], credits)[0]]]);
  assert.equal(isFail(settleNaming(first, second)[0]), false);
  const real = { beat_index: 4, verdict: "FAIL", names: [{ shown: "Gemany", expected: "Germany", ok: false, problem: "spelling" }] };
  assert.equal(isFail(settleNaming(setAsideCreditLines([real], credits), new Map([[4, setAsideCreditLines([real], credits)[0]]]))[0]), true);
});

test("namingCorrections turns real failures into planner corrections and ignores passes", () => {
  const c = namingCorrections([{ beat_index: 0, verdict: "PASS", names: [] }, { beat_index: 3, verdict: "FAIL", names: [{ shown: "Gemany", expected: "Germany", ok: false, problem: "spelling" }] }]);
  assert.equal(c.length, 1);
  assert.equal(c[0].beat, "beat 3");
  assert.equal(c[0].owner, "NAMING");
  assert.match(c[0].problem, /"Gemany".*"Germany"/);
  assert.ok(c[0].fix);
});

test("namingRetryDecision: a real failure earns a re-plan only while an attempt and the time budget remain", () => {
  const report = { beats: [{ beat_index: 3, verdict: "FAIL", names: [{ shown: "Gemany", expected: "Germany", ok: false, problem: "spelling" }] }] };
  const base = { code: 1, report, attempt: 1, maxAttempts: 3, elapsedMs: 10 * 60e3, nextAttemptMs: 8 * 60e3, budgetMs: 25 * 60e3 };
  const ok = namingRetryDecision(base);
  assert.equal(ok.retry, true);
  assert.equal(ok.corrections.length, 1);
  assert.equal(namingRetryDecision({ ...base, attempt: 3 }).retry, false, "the last attempt holds the video");
  assert.match(namingRetryDecision({ ...base, attempt: 3 }).why, /no attempt left/);
  assert.equal(namingRetryDecision({ ...base, elapsedMs: 20 * 60e3 }).retry, false, "over the time budget");
  assert.match(namingRetryDecision({ ...base, elapsedMs: 20 * 60e3 }).why, /time budget/);
  assert.equal(namingRetryDecision({ ...base, code: 3 }).retry, false, "a check that could not run is not fixed by a re-render");
  assert.equal(namingRetryDecision({ ...base, code: 0 }).retry, false);
  assert.equal(namingRetryDecision({ ...base, report: { beats: [] } }).retry, false, "nothing to correct");
  assert.equal(namingRetryDecision({ ...base, report: null }).retry, false);
});

test("KNOWN LIMIT: a headline that wrongly says the credited name is indistinguishable from the credit at name level", () => {
  // The reader reports only the text it saw, not where on the frame. If the headline wrongly reads "George Frederic Watts" while the credit also says it,
  // the name is set aside. The sentence-vs-headline check for the headline text itself is unaffected: a misspelling or a different name still fails.
  const v = { beat_index: 4, verdict: "FAIL", names: [{ shown: "George Frederic Watts", expected: "William Matthew Flinders Petrie", ok: false, problem: "headline names the wrong person" }] };
  assert.equal(isFail(dropCreditLineNames(v, [CREDIT])), false, "documented gap: not caught by this check");
  assert.equal(isFail(dropCreditLineNames(v, [])), true, "with no credit on the beat it fails");
});
