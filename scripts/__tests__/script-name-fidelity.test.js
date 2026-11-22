import test from "node:test";
import assert from "node:assert/strict";
import { nameFidelityProblems } from "../gate-script.js";

const RESEARCH = {
  topic_slug: "michelle-singletary-debt-raises-october-2026",
  strongest_angle: "The Washington Post columnist Michelle Singletary explained the Federal Reserve's expected rate rise.",
  key_facts: [
    {
      fact: "The Washington Post columnist Michelle Singletary wrote that the Federal Reserve is expected to raise rates in October 2026.",
      source_url: "https://www.washingtonpost.com/example",
      source_name: "The Washington Post",
    },
  ],
  numbers: [],
  quotes: [],
  named_entities: [
    { name: "Michelle Singletary", kind: "person" },
    { name: "The Washington Post", kind: "organization" },
    { name: "Federal Reserve", kind: "organization" },
  ],
};

const script = (voiceover) => ({
  hook: voiceover,
  sections: [{ id: "hook", voiceover }],
  sources_used: [],
});

test("a near-miss of a researched organisation is a BLOCKER naming the correct spelling", () => {
  const { blockers } = nameFidelityProblems(script("The Washington Pest reported the change."), RESEARCH);
  assert.equal(blockers.length, 1);
  assert.match(blockers[0], /The Washington Pest/);
  assert.match(blockers[0], /The Washington Post/);
});

test("a near-miss of a person's name is a BLOCKER", () => {
  const { blockers } = nameFidelityProblems(script("Michelle Singletry wrote about the rate rise."), RESEARCH);
  assert.equal(blockers.length, 1);
  assert.match(blockers[0], /Singletry/);
  assert.match(blockers[0], /Michelle Singletary/);
});

test("the research's own spellings pass with no blockers or warnings", () => {
  const { blockers, majors } = nameFidelityProblems(
    script("Michelle Singletary wrote in The Washington Post about the Federal Reserve."),
    RESEARCH,
  );
  assert.deepEqual(blockers, []);
  assert.deepEqual(majors, []);
});

test("a multi-word capitalised name the research never states is a MAJOR, not a blocker", () => {
  const { blockers, majors } = nameFidelityProblems(
    script("Michelle Singletary cited the Bank of Nowhere."),
    RESEARCH,
  );
  assert.deepEqual(blockers, []);
  assert.equal(majors.length, 1);
  assert.match(majors[0], /Bank of Nowhere/);
});

test("a sentence-initial date or ordinary capitalised word is not a name warning", () => {
  const { blockers, majors } = nameFidelityProblems(
    script("On September 18, the Federal Reserve moved."),
    RESEARCH,
  );
  assert.deepEqual(blockers, []);
  assert.deepEqual(majors, []);
});

test("no research artifact means no name check", () => {
  const { blockers, majors } = nameFidelityProblems(script("Anyone can write anything."), null);
  assert.deepEqual(blockers, []);
  assert.deepEqual(majors, []);
});

// ── Recovery-branch additions. CI runs 39961381904 and 39790127811 logged dozens of SCR-18 lines and ZERO near-miss blockers: title-case phrases the
// research never states ("Royal Seal Discovery", "Ancient Egyptian") are MAJOR warnings, and gate-script.js is not run with --strict, so they never
// rejected a script. These tests pin that split so neither half can drift: warnings stay warnings, typos stay blockers.
const withTitle = (voiceover, title) => ({ ...script(voiceover), youtube: { title } });

test("title-case phrases the research never states are MAJOR warnings only (the shape the CI logs showed), never blockers", () => {
  const { blockers, majors } = nameFidelityProblems(withTitle("The Federal Reserve moved.", "Royal Seal Discovery Changes History"), RESEARCH);
  assert.deepEqual(blockers, []);
  assert.ok(majors.some((m) => /Royal Seal Discovery/.test(m)), "the phrase is still reported");
});

test("the bar is not lowered: a typo of a researched name inside a title is still a BLOCKER", () => {
  const { blockers } = nameFidelityProblems(withTitle("The Federal Reserve moved.", "Michelle Singletry explains the rate rise"), RESEARCH);
  assert.equal(blockers.length, 1);
  assert.match(blockers[0], /Singletry/);
});

test("KNOWN LIMIT: in a fully Title Case string the capitalised run is longer than the name, so a typo is only a MAJOR warning", () => {
  // Every word is capitalised, so "Why Michelle Singletry Is Worried" is one five-token run that matches no two-word research name and SCR-18 cannot
  // see the typo. The voiceover, which is what is spoken and rendered, is not Title Case and is checked the same way as the test above.
  const { blockers, majors } = nameFidelityProblems(withTitle("The Federal Reserve moved.", "Why Michelle Singletry Is Worried"), RESEARCH);
  assert.deepEqual(blockers, []);
  assert.equal(majors.length, 1);
});

test("one typo is reported once however many strings repeat it", () => {
  const s = { ...script("Michelle Singletry spoke."), youtube: { title: "Michelle Singletry spoke", description: "Michelle Singletry spoke." } };
  assert.equal(nameFidelityProblems(s, RESEARCH).blockers.length, 1);
});

test("KNOWN LIMIT: a sentence-initial plural of a researched name word is read as a near-miss (one edit, same first letter)", () => {
  // "Reserves" is ordinary English, but the research name is "Federal Reserve" and the check only sees one edit from "reserve". It is a BLOCKER, so the
  // writer is asked to reword. Left as is: exempting a trailing "s" would also let through a real one-letter typo, and no CI run has hit this.
  const { blockers } = nameFidelityProblems(script("Reserves fell sharply in October."), RESEARCH);
  assert.equal(blockers.length, 1);
  assert.match(blockers[0], /Reserves/);
});

test("a lowercase mid-sentence word is never a name, however close it is to a researched one", () => {
  const { blockers, majors } = nameFidelityProblems(script("The bank's reserves fell in October."), RESEARCH);
  assert.deepEqual(blockers, []);
  assert.deepEqual(majors, []);
});

// Run 40899483670, ch-1: "Mesopotamian" (the adjective) was a BLOCKER against the research's "Mesopotamia" on attempts 1-7.
const MESO = { ...RESEARCH, named_entities: [...RESEARCH.named_entities, { name: "Mesopotamia", kind: "place" }], key_facts: [{ fact: "Weights from Mesopotamia reached Ireland.", source_url: "https://example.org", source_name: "Example" }] };

test("an adjective form of a researched place (Mesopotamian for Mesopotamia) is not a near-miss blocker", () => {
  const { blockers } = nameFidelityProblems(script("Mesopotamian weighing technology reached Ireland."), MESO);
  assert.deepEqual(blockers, []);
});

test("the exemption is narrow: a one-letter substitution of the same place is still a BLOCKER", () => {
  const { blockers } = nameFidelityProblems(script("Mesopotamie weighing technology reached Ireland."), MESO);
  assert.equal(blockers.length, 1);
  assert.match(blockers[0], /Mesopotamia/);
});

test("the exemption does not cover other one-edit shapes (an extra letter that is not a trailing n)", () => {
  const { blockers } = nameFidelityProblems(script("Mesopotamiax weighing technology reached Ireland."), MESO);
  assert.equal(blockers.length, 1);
});
