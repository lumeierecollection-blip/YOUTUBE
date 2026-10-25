// Topics are ranked by whether their subjects can be shown (scripts/lib/imagery-score.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { subjectIllustrated, scoreTopic, rankTopics } from "../lib/imagery-score.mjs";

const str = (v) => ({ rank: "normal", mainsnak: { datavalue: { type: "string", value: v } } });
const human = [{ rank: "normal", mainsnak: { datavalue: { type: "wikibase-entityid", value: { id: "Q5" } } } }];
// Fake Wikidata + Wikipedia: orgs with a logo, people with an image, a Wikipedia article with a commons / local lead image.
const WD = {
  "Marvel Comics": { id: "Q1", claims: { P154: [str("Marvel.svg")] } },
  "Alex Mashinsky": { id: "Q2", claims: { P31: human, P18: [str("Mashinsky.jpg")] } },
  "No Logo Corp": { id: "Q3", claims: {} },
};
const deps = (wiki = {}) => ({
  getJson: async (url) => {
    if (url.includes("wbsearchentities")) { const q = decodeURIComponent(url.split("search=")[1]); return WD[q] ? { search: [{ id: WD[q].id, label: q, description: "x" }] } : { search: [] }; }
    const id = url.match(/ids=([^&]+)/)?.[1]; const hit = Object.values(WD).find((w) => w.id === id); return { entities: hit ? { [id]: { claims: hit.claims } } : {} };
  },
  summaryOf: async (n) => wiki[n] || null,
});

test("an organisation with a Wikidata logo, a person with a Wikidata image: illustrated", async () => {
  assert.equal((await subjectIllustrated("Marvel Comics", deps())).ok, true);
  assert.equal((await subjectIllustrated("Alex Mashinsky", deps())).ok, true);
});

test("a Wikipedia lead image counts only if it is on Commons (a free file); a local en.wikipedia upload is non-free", async () => {
  const free = { "Some Agency": { type: "standard", title: "Some Agency", originalimage: { source: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Seal.png" } } };
  const nonfree = { "Some Agency": { type: "standard", title: "Some Agency", originalimage: { source: "https://upload.wikimedia.org/wikipedia/en/a/ab/Seal.png" } } };
  assert.equal((await subjectIllustrated("Some Agency", deps(free))).ok, true);
  assert.equal((await subjectIllustrated("Some Agency", deps(nonfree))).ok, false);
});

test("a subject nothing knows (the board's city councils and consultants): not illustrated", async () => {
  for (const n of ["East Lansing City Council", "Catherine Hulme", "No Logo Corp", ""]) assert.equal((await subjectIllustrated(n, deps())).ok, false, n);
});

test("scoreTopic counts the listed subjects; ranking puts the best-illustrated first and drops nothing", async () => {
  const topics = [
    { topic: "Local council story", subjects: ["East Lansing City Council", "Catherine Hulme"] },
    { topic: "Crypto CEO banned", subjects: ["Alex Mashinsky", "Marvel Comics", "Nobody"] },
    { topic: "No subjects listed" },
    { topic: "One known subject", subjects: ["Marvel Comics"] },
  ];
  const scores = []; for (const t of topics) scores.push(await scoreTopic(t, deps()));
  assert.deepEqual(scores.map((s) => `${s.illustrated}/${s.subjects}`), ["0/2", "2/3", "0/0", "1/1"]);
  const ranked = rankTopics(topics, scores);
  assert.deepEqual(ranked.map((t) => t.topic), ["Crypto CEO banned", "One known subject", "No subjects listed", "Local council story"]);
  assert.equal(ranked.length, topics.length);
});

test("equal scores keep discovery's order; no scores at all leaves the order alone", () => {
  const t = [{ topic: "a" }, { topic: "b" }, { topic: "c" }];
  assert.deepEqual(rankTopics(t, []).map((x) => x.topic), ["a", "b", "c"]);
  const sc = [{ subjects: 1, illustrated: 1, fraction: 1 }, { subjects: 1, illustrated: 1, fraction: 1 }, { subjects: 1, illustrated: 1, fraction: 1 }];
  assert.deepEqual(rankTopics(t, sc).map((x) => x.topic), ["a", "b", "c"]);
});
