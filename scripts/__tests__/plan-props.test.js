// plan-props: Gemini proposes a prop per beat; only generic, photographable, non-person objects that are LITERALLY what the sentence says survive.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProps, planProps, isLiteral } from "../lib/plan-props.mjs";

test("a courthouse and a gavel are props; a named court, a person, an icon, text and an idea are not", () => {
  const v = validateProps([{ object: "courthouse", building: true }, { object: "Southwark Crown Court" }, { object: "judge" }, { object: "gavel icon" }, { object: "newspaper" }, { object: "justice" }, { object: "gavel" }],
    [{ name: "Southwark Crown Court", type: "building" }], "He was sentenced at Southwark Crown Court.");
  assert.deepEqual(v.kept.map((p) => p.object), ["courthouse", "gavel"]);
  assert.equal(v.kept[0].building, true);
  assert.equal(v.dropped.length, 5);
});

test("planProps maps Gemini's answer per beat and returns nothing invented when Gemini does not answer", async () => {
  const beats = [{ index: 0, sentence: "The house sold for $2 million.", named_entities: [] }, { index: 1, sentence: "Their savings fell.", named_entities: [] }];
  const m = await planProps({ topic: "t", beats, ask: async () => ({ beats: [{ index: 0, props: [{ object: "house", building: true }] }, { index: 1, props: [{ object: "piggy bank" }] }] }) });
  assert.deepEqual(m.get(0).kept.map((p) => p.object), ["house"]);
  assert.deepEqual(m.get(1).kept.map((p) => p.object), ["piggy bank"]);
  const none = await planProps({ topic: "t", beats, ask: async () => ({ error: "quota_exhausted" }) });
  assert.deepEqual(none.get(0).kept, []);
});

test("a beat naming a place gets no generic building prop (board 38889577784 ch-26); a named court still gets a courthouse", () => {
  const city = validateProps([{ object: "apartment building", building: true }, { object: "stack of cash" }], [{ name: "Alexandria", type: "place" }], "He paid $2 million for an apartment in Alexandria.");
  assert.deepEqual(city.kept.map((p) => p.object), ["stack of cash"]);
  const court = validateProps([{ object: "courthouse", building: true }], [{ name: "Southwark Crown Court", type: "building" }], "The trial opened at Southwark Crown Court.");
  assert.deepEqual(court.kept.map((p) => p.object), ["courthouse"]);
});

test("owner 2026-10-16 'gold bars, but it's a house': a prop is what the sentence says, in Gemini's order; a symbol is refused", () => {
  const v = validateProps([{ object: "gold bars" }, { object: "house", building: true }, { object: "treasure chest" }], [], "FBI agents found gold bars hidden in his house.");
  assert.deepEqual(v.kept.map((p) => p.object), ["gold bars", "house"]);
  assert.match(v.dropped[0], /treasure chest: not something the sentence says/);
  // the metaphors boards 38889577784 / 38890511624 failed their beat checks on
  for (const [object, sentence] of [["compass", "These tactics help negotiators achieve better outcomes."], ["padlock", "He misled lenders to secure the funds."],
    ["hourglass", "The pattern went on for ten years."], ["anchor", "Confidence gives workers stability."], ["alarm clock", "Workers check their accounts every morning."],
    ["mailbox", "Women connected their stories of abuse."], ["jigsaw puzzle", "Katie Shonk calls it creative problem solving."], ["electrical transformer", "Global energy flow shifted east."]])
    assert.equal(isLiteral(object, sentence), null, `${object} for "${sentence}"`);
});

test("the plain physical form of what the sentence says passes; a word that only looks alike does not", () => {
  assert.ok(isLiteral("gavel", "Rush pleaded guilty on Tuesday."));
  assert.ok(isLiteral("courthouse", "The case went to federal court."));
  assert.ok(isLiteral("dollar bills", "He stole $40 million from the agency."));
  assert.ok(isLiteral("fuel pump", "Diesel exports to China doubled."));
  assert.ok(isLiteral("apartment building", "Tenants won new protections."));
  assert.ok(isLiteral("microscope", "DNA tests identified the remains."));
  assert.equal(isLiteral("office desk", "Police officers raided the home."), null);   // office is not officers
  assert.equal(isLiteral("pillow", "Patients take the pills daily."), null);        // pillow is not pills
  assert.equal(isLiteral("film camera", "Crime scene investigators arrived."), null); // a crime scene is not a film scene
  assert.equal(isLiteral("pill bottle", "Mental accounting shapes how we spend."), null);
});

test("board 39031532519: a police station / badge is an object, not a person; an activity word no longer qualifies office furniture", () => {
  const s = "Lexington Police reopened the case and expanded the department's cold case unit with two detectives.";
  assert.deepEqual(validateProps([{ object: "police station", building: true }, { object: "police officer" }], [], s).kept.map((k) => k.object), ["police station"]);
  assert.equal(isLiteral("wooden desk", "Deepak Malhotra published research detailing four strategies for making concessions."), null);
  assert.equal(isLiteral("laptop", "Katie Shonk analyzed business skills regarding how negotiators avoid capitulation."), null);
  assert.ok(isLiteral("desk", "The company closed its Boston office."));
});

test("test run 39037009215 ch-6: the tool of a dig is literal; luminol's spray bottle is; a magnifying glass is still a symbol", () => {
  assert.ok(isLiteral("shovel", "The FBI brought heavy machinery and excavators to dig up the backyard."));
  assert.ok(isLiteral("excavator", "Philadelphia Police and the FBI excavated 417 West Chew Avenue."));
  assert.ok(isLiteral("spray bottle", "What did luminol reveal inside the house?"));
  assert.equal(isLiteral("magnifying glass", "What did luminol reveal inside the house?"), null);
});
