import test from "node:test";
import assert from "node:assert/strict";
import { dedupeSections, isRepeat } from "../lib/dedupe-sentences.mjs";

// Board 39031532519 ch-44's script as it reached TTS.
const CH44 = [
  { id: "hook", voiceover: "Harvard Business School professor Deepak Malhotra published research detailing four strategies for making concessions." },
  { id: "setup", voiceover: "Harvard Business School professor Deepak Malhotra published research detailing four strategies for making concessions. Author Katie Shonk analyzed business skills regarding how negotiators avoid capitulation." },
  { id: "rehook", voiceover: "Katie Shonk analyzed business skills regarding how negotiators avoid capitulation." },
  { id: "payoff", voiceover: "Katie Shonk detailed best practices for trading concessions effectively with counterparts. Katie Shonk helped negotiators avoid capitulation or impasse." },
  { id: "close", voiceover: "Harvard Business School published this research detailing four strategies." },
];

test("an exact copy in a section that keeps another sentence is removed; copies that are each a section's only sentence are reported", () => {
  const r = dedupeSections(CH44);
  assert.deepEqual(r.removed.map((x) => x.section), ["setup"]);
  assert.equal(r.sections[1].voiceover, "Author Katie Shonk analyzed business skills regarding how negotiators avoid capitulation.");
  assert.equal(r.unfixable.length, 2);   // setup <-> rehook, hook <-> close
});

test("sentences that share a few names are not repeats", () => {
  assert.equal(isRepeat("Katie Shonk detailed best practices for trading concessions effectively with counterparts.", "Katie Shonk helped negotiators avoid capitulation or impasse."), false);
  assert.equal(isRepeat("Download the 30-second MP4 file from Claude Motion today.", "Claude Motion exports a 30-second explainer file."), false);
  assert.equal(isRepeat("Which eight members landed on the materially non-compliant list?", "Yet Switzerland and the European Union landed among eight materially non-compliant members."), false);
  assert.deepEqual(dedupeSections([{ id: "a", voiceover: "Police searched 1220 Chew Ave. in Olney. Police searched 1230 Chew Ave. in Olney too." }]).removed, []);
});

test("a clean script is untouched", () => {
  const r = dedupeSections([{ id: "hook", voiceover: "A bank failed on Friday." }, { id: "close", voiceover: "Check your deposit insurance today." }]);
  assert.equal(r.removed.length + r.unfixable.length, 0);
});
