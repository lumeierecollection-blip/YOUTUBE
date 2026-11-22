import { test } from "node:test";
import assert from "node:assert/strict";
import { checkFigureDensity } from "../validate-discovery.js";

const topic = { topic: "Port congestion", angle: "cost per container" };
const rich = { Abstract: "Costs rose 40% to $5,200 over 18 months, or 3 times the 2019 level of 1,400 units; 12000 boxes waited 9 days." };

test("figures: an answered lookup with enough figures passes", async () => {
  const r = await checkFigureDensity(topic, async () => rich);
  assert.equal(r.status, "ok");
  assert.equal(r.pass, true);
  assert.ok(r.figures >= 8, `figures ${r.figures}`);
});

test("figures: lookups that answer with too few figures are 'insufficient', not 'failed'", async () => {
  const r = await checkFigureDensity(topic, async () => ({ Abstract: "A port is a place for ships." }));
  assert.equal(r.status, "insufficient");
  assert.equal(r.pass, false);
  assert.equal(r.answered, r.lookups);
});

test("figures: no lookup answering is 'lookup_failed', never 'zero figures'", async () => {
  const r = await checkFigureDensity(topic, async () => null);
  assert.equal(r.status, "lookup_failed");
  assert.equal(r.pass, false);
  assert.equal(r.answered, 0);
  assert.equal(r.lookups, 8);
});

test("figures: a mix of answered and unanswered lookups that still falls short is 'insufficient'", async () => {
  let n = 0;
  const r = await checkFigureDensity(topic, async () => (n++ % 2 ? null : { Abstract: "Nothing numeric here." }));
  assert.equal(r.status, "insufficient");
  assert.ok(r.answered > 0 && r.answered < r.lookups);
});

test("figures: the loop stops as soon as 8 figures are reached", async () => {
  let calls = 0;
  const r = await checkFigureDensity(topic, async () => { calls++; return rich; });
  assert.equal(r.pass, true);
  assert.ok(calls <= 2, `made ${calls} lookups`);
});

test("KNOWN LIMIT: the count is per pattern kind (one hit each), so 'figures' is not a count of distinct numbers", async () => {
  let first = true;
  const r = await checkFigureDensity(topic, async () => {
    if (!first) return null;
    first = false;
    return { Abstract: "1,100 2,200 3,300 4,400 5,500 6,600 7,700 8,800 9,900 10,100 11,100 12,100" };
  });
  assert.ok(r.figures <= 2, `a dozen formatted numbers in one answer counted ${r.figures}`);
});
