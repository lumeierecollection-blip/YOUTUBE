/**
 * Regression tests on scripts that really shipped from the old pipeline, plus labelled constructed cases.
 *
 * REAL fixtures (fixtures/real): written by the old pipeline for the AI Tested channel.
 *   muse-spaces, muse-voice, workers: from `gh run download 42585427400` (Two-Channel Autopilot, run of 2026-11-09)
 *   employer: data/research/2/employer-cheat-sheet-workplace-laws-october-2026-shorts-script.json in this repo
 * CONSTRUCTED cases are marked CONSTRUCTED in their test names. "Officers prepared on September 18. Who engineered
 * this takeover?" was quoted in the brief but appears in none of the files available, so it is constructed here.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { channelConfig } from "./channels.mjs";
import { deterministicGates } from "./engine.mjs";
import { blocking } from "./continuity.mjs";
import { fromLegacy } from "./legacy.mjs";
import { buildPackage, claim } from "./testkit.mjs";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures/real");
const load = (n) => [JSON.parse(readFileSync(join(DIR, `${n}.script.json`), "utf8")), JSON.parse(readFileSync(join(DIR, `${n}.research.json`), "utf8"))];
const WPM = { wpm: 150, source: "default" };
const ai = channelConfig("ai-tested", "short");
const ids = (j, ...res) => res.map((re) => j.pkg.sentences.find((s) => re.test(s.text)).sentence_id).join();

function judge(name, question) {
  const [script, research] = load(name);
  const { pkg, claims } = fromLegacy(script, research, { channelKey: "ai-tested", central_question: question });
  const found = deterministicGates(pkg, { claims, channel: ai, wpm: WPM });
  const rules = (id) => found.filter((f) => f.rule === id);
  return { pkg, claims, found, rules, blocked: blocking(found).length > 0, textOf: (f) => f.sentence_ids.map((i) => pkg.sentences.find((s) => s.sentence_id === i)?.text) };
}

test("REAL muse-spaces: 'Check pinning custom spaces to main tabs.' ends the script with something never introduced", () => {
  const j = judge("muse-spaces", "What can Meta's Muse Spaces do?");
  assert.ok(j.blocked, "a script advancing from here would be a regression");
  const end = j.rules("CON-04").find((f) => f.sentence_ids.includes("s7"));
  assert.ok(end, "ending that introduces new material must be caught");
  assert.match(end.problem, /ending brings in something the listener has not heard/);
  // 'Who reported this feature live from Hyderabad?' follows 'Meta launched Spaces ...' with no link: disconnected facts
  assert.ok(j.rules("CON-02").some((f) => f.sentence_ids.join() === "s2,s3"), "disconnected facts s2 -> s3");
  assert.ok(j.rules("CON-03").some((f) => /this feature/.test(f.problem)), "'this feature' has no antecedent");
});

test("REAL muse-voice: 'Meta launched in 1 country, the United States.' follows a non sequitur; the hook's '2 models' is never delivered", () => {
  const j = judge("muse-voice", "What does Meta's Muse Voice do?");
  assert.ok(j.blocked);
  assert.ok(j.rules("CON-02").some((f) => f.sentence_ids.join() === "s4,s5"), "'But Muse Voice handles tasks...' -> 'Meta launched in 1 country' jumps");
  assert.ok(j.rules("CON-12").some((f) => /hook says 2/.test(f.problem)), "misleading hook: 2 models promised, never explained");
  assert.ok(j.rules("CON-16").length >= 1, "'1 country' filler count");
  assert.ok(j.rules("TRC-06").some((f) => /"all"/.test(f.problem)), "'Check all 3 platforms' is stronger than the claim");
});

test("REAL workers: 'Remember the 16 percent combined return rate across both nations.' brings a new figure into the ending", () => {
  const j = judge("workers", "How many workers replaced by AI are asked back?");
  assert.ok(j.blocked);
  const end = j.rules("CON-04").find((f) => f.sentence_ids.includes("s7"));
  assert.ok(end && /figure 16/.test(end.problem), "new figure 16 in the ending");
  assert.ok(j.rules("CON-03").some((f) => /both nations/.test(f.problem)), "'both nations' refers to nothing established");
  assert.ok(j.rules("CON-04").some((f) => f.severity === "critical" && f.sentence_ids.includes("s6")), "'They also secure 33 percent transparency.' states a figure and cites no claim");
  assert.ok(j.rules("CON-11").some((f) => f.sentence_ids.includes("s3")), "'Why do they return to work?' is never answered: unresolved promise");
  assert.ok(j.rules("CON-14").some((f) => f.sentence_ids.includes("s1")), "'You might be shocked' hook is clickbait");
});

test("REAL employer: unrelated state jumps, an unanswered question, a hook figure no claim holds, and 31.6 s against a 29 s limit", () => {
  const j = judge("employer", "Which workplace laws take effect in October?");
  assert.ok(j.blocked);
  assert.ok(j.rules("CON-02").some((f) => f.sentence_ids.join() === ids(j, /Maryland/, /District/)), "Maryland -> District of Columbia with nothing between");
  assert.ok(j.rules("CON-11").some((f) => f.sentence_ids.includes(ids(j, /Maryland/))), "'Where does Maryland stand ...?' is dropped");
  assert.ok(j.rules("TRC-03").some((f) => /figure 12/.test(f.problem)), "'12 states' appears in no claim");
  assert.ok(j.rules("DUR-01").some((f) => /31\.6s/.test(f.problem)), "duration beyond the Shorts limit is a blocking finding");
  assert.ok(j.rules("CON-06").some((f) => f.sentence_ids.join() === ids(j, /ADP/, /Connecticut employers face/)), "ADP and the next sentence state the same Connecticut rule twice");
});

test("CONSTRUCTED: 'Officers prepared on September 18. Who engineered this takeover?' (quoted in the brief, not in any available file)", () => {
  const claims = [claim("c1", "Officers prepared a takeover on September 18, 1992.", { status: "established_fact" }), claim("c2", "The plan was led by a colonel named Aldous Reyes.", { status: "established_fact" })];
  const pkg = buildPackage({
    channel: "world-view", topic: "The 1992 takeover", question: "Who led the 1992 takeover?", thesis: "A colonel led the 1992 takeover of the capital",
    claims, beats: [{ id: "b1", claims: ["c1"], purpose: "opens on the date the takeover was prepared for the question" }, { id: "b2", claims: ["c2"], purpose: "names who led the takeover answering the question" }, { id: "b3", claims: ["c2"], purpose: "payoff names the leader of the takeover" }, { id: "b4", claims: [], purpose: "ending recaps who led the takeover" }],
    sentences: [
      { beat: "b1", text: "Officers prepared on September 18.", claims: ["c1"], link: "opening" },
      { beat: "b2", text: "Who engineered this takeover?", claims: [], link: "asks the question the first sentence leaves open" },
      { beat: "b3", text: "A colonel named Aldous Reyes led the plan.", claims: ["c2"], link: "answers who was behind it" },
      { beat: "b4", text: "That is the 1992 takeover.", claims: [], link: "closes on the event" },
    ],
  });
  const ch = channelConfig("world-view", "short");
  const f = deterministicGates(pkg, { claims, channel: ch, wpm: WPM });
  assert.ok(f.some((x) => x.rule === "CON-03" && /this takeover/.test(x.problem)), "'this takeover' was never mentioned before");
  assert.ok(f.some((x) => x.rule === "CON-02" && x.sentence_ids.join() === "s1,s2"), "the first two sentences share nothing");
  assert.ok(blocking(f).length > 0);
});

test("CONSTRUCTED: an empty or generic transition is a missing transition", () => {
  const claims = [claim("c1", "The lighthouse opened in 1871 on the northern cape."), claim("c2", "The lighthouse closed in 1990 after automation.")];
  const mk = (link) => buildPackage({
    channel: "hidden-past", topic: "Cape Lighthouse", question: "Why did the Cape Lighthouse close?", thesis: "Automation closed the Cape Lighthouse in 1990",
    claims, beats: [{ id: "b1", claims: ["c1"], purpose: "opens on the lighthouse for the question of why it closed" }, { id: "b2", claims: ["c2"], purpose: "shows the closure answering why it closed" }, { id: "b3", claims: ["c2"], purpose: "payoff: automation closed the lighthouse" }, { id: "b4", claims: [], purpose: "ending on the closure of the lighthouse" }],
    sentences: [
      { beat: "b1", text: "The lighthouse opened in 1871 on the northern cape.", claims: ["c1"] },
      { beat: "b2", text: "It closed in 1990 after automation.", claims: ["c2"], link },
      { beat: "b3", text: "Automation closed the lighthouse in 1990.", claims: ["c2"], link: "states the answer to why it closed" },
      { beat: "b4", text: "That is why the lighthouse closed.", claims: [], link: "restates the answer to why it closed" },
    ],
  });
  const ch = channelConfig("hidden-past", "short");
  for (const bad of ["", "next", "Also.", "and then"]) assert.ok(deterministicGates(mk(bad), { claims, channel: ch, wpm: WPM }).some((x) => x.rule === "CON-01" && x.severity === "major"), `link "${bad}"`);
  assert.ok(!deterministicGates(mk("shows what happened to the lighthouse after it opened"), { claims, channel: ch, wpm: WPM }).some((x) => x.rule === "CON-01" && x.severity === "major"));
});

test("a hand-written GOOD script on the real workers research passes every deterministic gate (hand-written, claims from the real research)", () => {
  const [, research] = load("workers");
  const claims = fromLegacy({ hook: "", sections: [{ id: "hook", voiceover: "x." }] }, research, { central_question: "x?" }).claims.map((c) => ({ ...c, editorial_status: "established_fact" }));
  const byText = (re) => claims.find((c) => re.test(c.claim)).claim_id;
  const us = byText(/19 percent of respondents/), uk = byText(/^In the United Kingdom, 13 percent/), both = byText(/^Across both the United States and the United Kingdom combined/);
  const pkg = buildPackage({
    channel: "world-view", topic: "Workers replaced by AI who were asked back", question: "How many workers replaced by AI were asked back?",
    thesis: "About one in five U.S. workers replaced by AI were asked back, a bit more than in the United Kingdom", claims, wpm: 150,
    beats: [
      { id: "b1", claims: [us], purpose: "opens on the U.S. share of workers replaced by AI who were asked back" },
      { id: "b2", claims: [uk], purpose: "compares the U.K. share of workers asked back", link: "comparison" },
      { id: "b3", claims: [both], purpose: "gives the combined share of workers asked back", link: "explanation" },
      { id: "b4", claims: [us, both], purpose: "ends on the U.S. share against the combined share", link: "comparison" },
    ],
    sentences: [
      { beat: "b1", text: "In one survey, 19 percent of U.S. workers replaced by AI were asked to return.", claims: [us], osd: "19% asked back" },
      { beat: "b2", text: "In the United Kingdom, the rate was 13 percent.", claims: [uk], link: "compares that rate with the rate for the United Kingdom", osd: "UK: 13%" },
      { beat: "b3", text: "Across the two countries combined, the rate was 16 percent.", claims: [both], link: "combines the two rates into one number", osd: "Combined: 16%" },
      { beat: "b4", text: "So the U.S. rate of 19 percent sits above the combined 16 percent.", claims: [us, both], link: "returns to the first rate now that the combined rate is known", osd: "19% vs 16%" },
    ],
  });
  const found = deterministicGates(pkg, { claims, channel: channelConfig("world-view", "short"), wpm: { wpm: 150, source: "measured" } });
  assert.deepEqual(blocking(found).map((f) => `${f.rule} ${f.problem}`), []);
});
