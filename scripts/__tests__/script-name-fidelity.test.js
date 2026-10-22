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

// Run 39611317543: these fragments filled every re-ask with false SCR-18 MAJORs.
test("a leading adverb glued to a researched name is not an unknown name", () => {
  const { blockers, majors } = nameFidelityProblems(
    script("Then Michelle Singletary wrote about it."),
    RESEARCH,
  );
  assert.deepEqual(blockers, []);
  assert.deepEqual(majors, []);
});

test("a researched name followed by a month is not an unknown name", () => {
  const { blockers, majors } = nameFidelityProblems(
    script("The Washington Post October column said rates rise."),
    RESEARCH,
  );
  assert.deepEqual(blockers, []);
  assert.deepEqual(majors, []);
});

test("two research words side by side that are not a researched name still warn", () => {
  const { majors } = nameFidelityProblems(script("It ran in the Washington Reserve."), RESEARCH);
  assert.equal(majors.length, 1);
  assert.match(majors[0], /Washington Reserve/);
});

test("an adverb in front of a near-miss still blocks", () => {
  const { blockers } = nameFidelityProblems(script("Then Michelle Singletry wrote."), RESEARCH);
  assert.equal(blockers.length, 1);
});

test("no research artifact means no name check", () => {
  const { blockers, majors } = nameFidelityProblems(script("Anyone can write anything."), null);
  assert.deepEqual(blockers, []);
  assert.deepEqual(majors, []);
});
