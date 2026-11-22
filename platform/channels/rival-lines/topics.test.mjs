import test from "node:test";
import assert from "node:assert/strict";
import { SEED, WEIGHTS, coverage, dataScoreOf, discover, mergeBacklog, normalise, scoreTopic } from "./topics.mjs";

const fake = (comps, matches) => async (path) => (path === "competitions.json" ? comps : matches[path] || []);
const comps = [{ competition_id: 43, season_id: 106, competition_name: "FIFA World Cup", season_name: "2022" }, { competition_id: 11, season_id: 21, competition_name: "La Liga", season_name: "2009/2010" }];
const matches = { "matches/43/106.json": [{ home_team: { home_team_name: "Argentina" }, away_team: { away_team_name: "France" } }, { home_team: { home_team_name: "Spain" }, away_team: { away_team_name: "Japan" } }], "matches/11/21.json": Array.from({ length: 35 }, () => ({ home_team: { home_team_name: "Barcelona" }, away_team: { away_team_name: "X" } })) };

test("weights sum to one", () => assert.equal(Math.round(Object.values(WEIGHTS).reduce((a, b) => a + b, 0) * 1000) / 1000, 1));
test("every seed topic carries all six editorial scores and a coverage query", () => {
  assert.ok(SEED.length >= 10);
  for (const t of SEED) { assert.ok(t.coverage.competition, t.id); for (const k of ["story", "audience", "significance", "visual", "evidence", "feasibility"]) assert.ok(t.editorial_scores[k] >= 1 && t.editorial_scores[k] <= 5, `${t.id}.${k}`); }
});
test("score uses measured data availability, so no data lowers the score", () => {
  const t = SEED[0];
  assert.ok(scoreTopic(t, 5) > scoreTopic(t, 0));
  assert.equal(scoreTopic({ ...t, editorial_scores: { story: 5, audience: 5, significance: 5, visual: 5, evidence: 5, feasibility: 5 } }, 5), 100);
});
test("coverage counts matches for a named team and for a whole competition", async () => {
  assert.deepEqual((await coverage({ competition: "FIFA World Cup", seasons: ["2022"], team: "Argentina" }, fake(comps, matches))).matches, 1);
  assert.deepEqual((await coverage({ competition: "FIFA World Cup", seasons: ["2022"], team: null }, fake(comps, matches))).matches, 2);
  const none = await coverage({ competition: "UEFA Champions League", seasons: ["2016/2017"], team: "Barcelona" }, fake(comps, matches));
  assert.equal(none.available, false);
  assert.equal(dataScoreOf(none), 0);
  assert.equal(dataScoreOf({ available: true, matches: 35 }), 5);
});
test("a backlog never repeats a story, by id or by normalised title", () => {
  const b = [{ id: "a", title: "Argentina vs France!" }];
  const r = mergeBacklog(b, [{ id: "a", title: "x" }, { id: "c", title: "argentina vs france" }, { id: "d", title: "Something new" }]);
  assert.deepEqual(r.added, ["d"]);
  assert.equal(normalise("Leicester City's Title"), "leicester city s title");
});
test("discover ranks by score and records coverage", async () => {
  const { backlog } = await discover({ get: fake(comps, matches) });
  assert.equal(backlog.length, SEED.length);
  for (let i = 1; i < backlog.length; i++) assert.ok(backlog[i - 1].score >= backlog[i].score);
  assert.ok(backlog.find((t) => t.id === "argentina-france-2022").coverage_result.available);
  assert.equal(backlog.find((t) => t.id === "liverpool-milan-2005").coverage_result.available, false);
});
