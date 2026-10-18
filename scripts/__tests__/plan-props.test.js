// plan-props: Gemini proposes a prop per beat; only generic, photographable, non-person objects that are LITERALLY what the sentence says survive.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProps, planProps, isLiteral, depictsOf } from "../lib/plan-props.mjs";

test("a courthouse and a gavel are props; a named court, a person, an icon, text and an idea are not", () => {
  const v = validateProps([{ object: "courthouse", building: true }, { object: "Southwark Crown Court" }, { object: "judge" }, { object: "gavel icon" }, { object: "newspaper" }, { object: "justice" }, { object: "gavel" }],
    [{ name: "Southwark Crown Court", type: "building" }], "He was sentenced at Southwark Crown Court.");
  assert.deepEqual(v.kept.map((p) => p.object), ["courthouse", "gavel"]);
  assert.equal(v.kept[0].building, true);
  assert.equal(v.dropped.length, 5);
});

test("planProps maps Gemini's answer per beat and returns nothing invented when Gemini does not answer", async () => {
  const beats = [{ index: 0, sentence: "The house sold for $2 million.", named_entities: [] }, { index: 1, sentence: "Their savings fell.", named_entities: [] }];
  const m = await planProps({ topic: "t", beats, ask: async () => ({ beats: [{ index: 0, props: [{ object: "house", depicts: "The house sold", building: true }] }, { index: 1, props: [{ object: "piggy bank", depicts: "Their savings" }] }] }) });
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
  // since 2026-10-18 a generic officer is a (captioned) prop on a beat that names no person; never on one that does
  assert.deepEqual(validateProps([{ object: "police station", building: true }, { object: "police officer" }], [], s).kept.map((k) => k.object), ["police station", "police officer"]);
  assert.deepEqual(validateProps([{ object: "police station", building: true }, { object: "police officer" }], [{ name: "Jane Doe", type: "person" }], s).kept.map((k) => k.object), ["police station"]);
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

test("board 39031532519 ch-1 (owner 2026-10-17 'random PNGs'): a money word no longer admits a calculator, a wallet or a credit card", () => {
  const s0 = "Your debt payments grow eight times faster than your take-home pay.";
  const s3 = "The Washington Post reports debt payments grow eight times faster.";
  for (const o of ["calculator", "wallet", "credit card", "briefcase", "piggy bank"]) assert.equal(isLiteral(o, s3), null, `${o} for "${s3}"`);
  for (const o of ["pen", "notebook", "folder"]) assert.equal(isLiteral(o, s3), null, `${o}: "reports" is news, not paperwork`);
  assert.ok(isLiteral("stack of cash", s0));                                   // pay -> cash
  assert.equal(isLiteral("microphone", "In October 2026, columnist Michelle Singletary launched Dollars and Sense at The Washington Post."), null);
  assert.ok(isLiteral("microphone", "Her podcast featured a family tackling student debt."));
  assert.equal(isLiteral("backpack", "Her podcast featured a family tackling $100,000 in student debt."), null);
  assert.equal(isLiteral("police car", "Researchers investigated the claims."), null);
  assert.equal(isLiteral("fire truck", "Workers reported burnout."), null);
});

test("strict (planProps): a prop is judged against the words it says it depicts; it must cite real words of the sentence", () => {
  const s = "Agents seized $2 million in cash and a calculator ledger from his office.";
  assert.equal(depictsOf("seized $2 million", s), "seized $2 million");
  assert.equal(depictsOf("financial records", s), null);
  const v = validateProps([{ object: "stack of cash", depicts: "$2 million in cash" }, { object: "desk", depicts: "$2 million" }, { object: "gavel", depicts: "the trial" },
    { object: "office chair" }, { object: "desk", depicts: "from his office" }], [], s, { strict: true });
  assert.deepEqual(v.kept.map((k) => k.object), ["stack of cash", "desk"]);
  assert.match(v.dropped[0], /desk: not what "\$2 million" shows/);
  assert.match(v.dropped[1], /gavel: "depicts" .* is not words of the sentence/);
  assert.match(v.dropped[2], /office chair: no "depicts"/);
});

// owner, 2026-10-18: props also EXPLAIN what is said ("visualizing what is being talked about, explaining visually what is going on"), not only name it
test("an EXPLAINING prop is kept when it quotes the claim it explains and says what it shows", () => {
  const s = "Debt payments now eat most of the raise workers got this year.";
  const { kept } = validateProps([{ role: "explains", object: "unpaid bills", explains: "debt payments now eat most of the raise", shows: "the bills that take the raise" }], [], s, { strict: true });
  assert.equal(kept.length, 1);
  assert.equal(kept[0].role, "explains");
  assert.equal(kept[0].explains, "debt payments now eat most of the raise");
});

test("an EXPLAINING prop is refused without a real claim, without 'shows', or when it is a stock symbol", () => {
  const s = "Leaders at Davos debated what drives real impact in modern organisations.";
  const bad = [
    { role: "explains", object: "conference table", explains: "nothing like the sentence at all here", shows: "a table" },
    { role: "explains", object: "conference table", explains: "debated what drives real impact" },
    { role: "explains", object: "compass", explains: "what drives real impact", shows: "direction" },
    { role: "explains", object: "lightbulb", explains: "what drives real impact", shows: "an idea" },
    { role: "explains", object: "businessman portrait", explains: "leaders at Davos debated", shows: "a leader" },   // a close-up; a stranger in full is allowed since 2026-10-18 (test below)
  ];
  const { kept, dropped } = validateProps(bad, [], s, { strict: true });
  assert.deepEqual(kept, []);
  assert.equal(dropped.length, 5, dropped.join("\n"));
});

test("a 'named' prop is still judged by the literal rules (no role = named)", () => {
  const { kept, dropped } = validateProps([{ object: "calculator", depicts: "debt payments" }], [], "Debt payments grow eight times faster than pay.", { strict: true });
  assert.deepEqual(kept, []);
  assert.equal(dropped.length, 1);
});

test("owner 2026-10-18: a generic person is a prop only on a beat that names no person, and is flagged for the on-screen caption; a face is never one", () => {
  const s = "Most workers spend the raise before it arrives.";
  const free = validateProps([{ role: "explains", object: "worker counting coins", explains: "workers spend the raise", shows: "the raise going out as fast as it comes" }, { role: "explains", object: "worker face", explains: "workers spend the raise", shows: "a worker" }], [], s, { strict: true });
  assert.deepEqual(free.kept.map((p) => p.object), ["worker counting coins"]);
  assert.equal(free.kept[0].person, true);
  assert.match(free.dropped.join(" | "), /face or portrait/);
  const named = validateProps([{ role: "explains", object: "worker counting coins", explains: "workers spend the raise", shows: "the raise going out" }], [{ name: "Katie Shonk", type: "person" }], "Katie Shonk says most workers spend the raise before it arrives.", { strict: true });
  assert.deepEqual(named.kept, []);
  assert.match(named.dropped[0], /names a person/);
  const obj = validateProps([{ role: "named", object: "gold bars", depicts: "found gold bars" }], [], "Agents found gold bars.", { strict: true });
  assert.equal(obj.kept[0].person, undefined);
});

test("run 39169019904: one common word shared with a multi-word name no longer refuses a generic prop; a one-word brand still does", () => {
  const s = "Restaurant Brands International will sell restaurants to local operators.";
  const rbi = [{ name: "Restaurant Brands International", type: "organization" }];
  assert.deepEqual(validateProps([{ role: "explains", object: "restaurant interior", explains: "sell restaurants to local operators", shows: "the restaurants being sold" }], rbi, s, { strict: true }).kept.map((k) => k.object), ["restaurant interior"]);
  assert.match(validateProps([{ object: "restaurant brands" }], rbi, s).dropped[0], /names a specific entity/);
  assert.match(validateProps([{ object: "apple iphone" }], [{ name: "Apple", type: "organization" }], "Apple sold more phones.").dropped[0], /names a specific entity/);
});
