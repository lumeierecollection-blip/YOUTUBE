// plan-props: Gemini proposes a prop per beat; only generic, photographable, non-person objects survive.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProps, planProps } from "../lib/plan-props.mjs";

test("a courthouse and a gavel are props; a named court, a person, an icon, text and an idea are not", () => {
  const v = validateProps([{ object: "courthouse", building: true }, { object: "Southwark Crown Court" }, { object: "judge" }, { object: "gavel icon" }, { object: "newspaper" }, { object: "justice" }, { object: "gavel" }],
    [{ name: "Southwark Crown Court", type: "building" }]);
  assert.deepEqual(v.kept.map((p) => p.object), ["courthouse", "gavel"]);
  assert.equal(v.kept[0].building, true);
  assert.equal(v.dropped.length, 5);
});

test("planProps maps Gemini's answer per beat and returns nothing invented when Gemini does not answer", async () => {
  const beats = [{ index: 0, sentence: "The house sold for $2 million.", named_entities: [] }, { index: 1, sentence: "Savings fell.", named_entities: [] }];
  const m = await planProps({ topic: "t", beats, ask: async () => ({ beats: [{ index: 0, props: [{ object: "house", building: true }] }, { index: 1, props: [{ object: "piggy bank" }] }] }) });
  assert.deepEqual(m.get(0).kept.map((p) => p.object), ["house"]);
  assert.deepEqual(m.get(1).kept.map((p) => p.object), ["piggy bank"]);
  const none = await planProps({ topic: "t", beats, ask: async () => ({ error: "quota_exhausted" }) });
  assert.deepEqual(none.get(0).kept, []);
});

test("a beat naming a place gets no generic building prop (board 38889577784 ch-26); a named court still gets a courthouse", () => {
  const city = validateProps([{ object: "apartment building", building: true }, { object: "stack of cash" }], [{ name: "Alexandria", type: "place" }]);
  assert.deepEqual(city.kept.map((p) => p.object), ["stack of cash"]);
  const court = validateProps([{ object: "courthouse", building: true }], [{ name: "Southwark Crown Court", type: "building" }]);
  assert.deepEqual(court.kept.map((p) => p.object), ["courthouse"]);
});
