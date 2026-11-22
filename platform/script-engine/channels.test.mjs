/** Per-channel editorial rules, from config/channel-registry.json. All sentences and claims here are CONSTRUCTED. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { CHANNEL_RULES, channelConfig, registry } from "./channels.mjs";
import { QUESTIONS, critiqueProblems } from "./critic.mjs";
import { blueprintIssues } from "./blueprint.mjs";
import { buildPackage, claim } from "./testkit.mjs";

const run = (key, items, claims, blueprint) => {
  const sentences = items.map((t, i) => ({ sentence_id: `s${i + 1}`, text: t[0], claim_ids: t[1] || [] }));
  const claimsOf = (s) => s.claim_ids.map((id) => claims.find((c) => c.claim_id === id));
  return CHANNEL_RULES[key].script({ sentences, claimsOf, claims, blueprint });
};
const ids = (f) => f.map((x) => x.rule);

test("every registry channel has editorial rules and every claim category a rule names is one the registry gives that channel", () => {
  for (const c of registry().channels) {
    assert.ok(CHANNEL_RULES[c.key]?.guidance.length > 40, `${c.key} guidance`);
    assert.equal(typeof CHANNEL_RULES[c.key].script, "function");
  }
  const used = { "ai-tested": ["demonstrated_feature", "marketing_claim", "measured_statistic"], "hidden-past": ["later_interpretation"], "red-space-facts": ["hypothetical", "scientific_model", "observation", "artistic_interpretation"], "dopamine-loop": ["established_fact"], "gray-matter": ["causation", "correlation"], "rival-lines": ["estimate_from_video"], "court-and-spotlight": ["allegation", "charge", "disputed_claim", "speculation", "conviction", "proven_fact", "public_statement"], "world-view": ["historical_interpretation", "allegation", "political_claim", "propaganda", "scholarly_disagreement", "speculation", "public_opinion"] };
  for (const [k, cats] of Object.entries(used)) { const own = registry().channels.find((c) => c.key === k).claim_categories; for (const x of cats) assert.ok(own.includes(x), `${k}: ${x}`); }
});

test("AI Tested: a vendor claim is attributed; a script must show what the tool actually does", () => {
  const cs = [claim("c1", "The tool cuts costs by 41 percent", { status: "marketing_claim" }), claim("c2", "The tool lists models in router.yaml", { status: "demonstrated_feature" })];
  assert.ok(ids(run("ai-tested", [["The tool cuts costs by 41 percent.", ["c1"]], ["It lists models in a file.", ["c2"]]], cs)).includes("AIT-1"));
  assert.ok(!ids(run("ai-tested", [["The project says it cuts costs by 41 percent.", ["c1"]], ["It lists models in a file.", ["c2"]]], cs)).includes("AIT-1"));
  assert.ok(ids(run("ai-tested", [["The project says it cuts costs.", ["c1"]]], [cs[0]])).includes("AIT-3"), "announcement only: no demonstrated feature");
  assert.ok(ids(run("ai-tested", [["We tested it on 10 prompts.", ["c2"]]], cs)).includes("AIT-2"), "a test that no claim records");
});

test("Hidden Past: later interpretation is not told as the record; no manufactured mystery", () => {
  const cs = [claim("c1", "The device was a calendar", { status: "later_interpretation" })];
  assert.ok(ids(run("hidden-past", [["The device was a calendar.", ["c1"]]], cs)).includes("HP-1"));
  assert.ok(!ids(run("hidden-past", [["Researchers suggest the device was a calendar.", ["c1"]]], cs)).includes("HP-1"));
  assert.ok(ids(run("hidden-past", [["The shocking secret they don't want you to know.", []]], cs)).includes("HP-2"));
});

test("Red Space Facts: hypotheticals, models and artwork are labelled as such", () => {
  const cs = [claim("c1", "Mars would lose its air", { status: "hypothetical" }), claim("c2", "Mars has a thin air", { status: "scientific_model" }), claim("c3", "Mars glows red", { status: "artistic_interpretation" })];
  const f = ids(run("red-space-facts", [["Mars loses its air.", ["c1"]], ["Mars has thin air.", ["c2"]], ["Mars glows red.", ["c3"]]], cs));
  assert.deepEqual(f, ["RSF-1", "RSF-2", "RSF-3"]);
  assert.deepEqual(ids(run("red-space-facts", [["If Mars lost its air, it would freeze.", ["c1"]], ["Models calculate thin air.", ["c2"]], ["An artist's illustration shows red.", ["c3"]]], cs)), []);
});

test("Dopamine Loop: the feeling comes first and the viewer is never diagnosed", () => {
  const cs = [claim("c1", "Reward anticipation raises dopamine", { status: "established_fact" })];
  assert.ok(ids(run("dopamine-loop", [["You probably have an anxiety disorder.", []], ["Reward anticipation raises dopamine.", ["c1"]], ["That is why.", []]], cs)).includes("DL-1"));
  assert.ok(ids(run("dopamine-loop", [["Reward anticipation raises dopamine.", ["c1"]], ["That is the science.", []], ["Now you know.", []]], cs)).includes("DL-2"));
  assert.deepEqual(ids(run("dopamine-loop", [["You feel a pull toward the phone before you decide.", []], ["Reward anticipation raises dopamine.", ["c1"]], ["That pull is the anticipation.", []]], cs)), []);
});

test("Gray Matter: terms are defined where first used; correlation is not worded as causation", () => {
  const cs = [claim("c1", "Poor sleep is linked to weaker recall", { status: "correlation" }), claim("c2", "The hippocampus stores new memories", { status: "causation" })];
  const f = run("gray-matter", [["Poor sleep causes weaker recall.", ["c1"]], ["The hippocampus matters here.", ["c2"]]], cs);
  assert.deepEqual(ids(f).sort(), ["GM-1", "GM-2", "GM-3"]);
  assert.deepEqual(ids(run("gray-matter", [["Poor sleep is linked to weaker recall.", ["c1"]], ["The hippocampus, a seahorse-shaped part of the brain, stores new memories.", ["c2"]]], cs)), []);
});

test("Rival Lines: an estimate is labelled as one, and the thesis is an argument", () => {
  const cs = [claim("c1", "Liverpool pressed high", { status: "estimate_from_video" })];
  assert.ok(ids(run("rival-lines", [["Liverpool pressed high.", ["c1"]]], cs, { thesis: "Liverpool pressed high and won the game by pressing" })).includes("RL-1"));
  assert.ok(ids(run("rival-lines", [["Tracking suggests Liverpool pressed high.", ["c1"]]], cs, { thesis: "Why did they win?" })).includes("RL-2"));
  assert.deepEqual(ids(run("rival-lines", [["Tracking suggests Liverpool pressed high.", ["c1"]]], cs, { thesis: "Liverpool won because the late pressing changed the shape of the match" })), []);
});

test("Court & Spotlight: allegation, evidence, statement and outcome stay apart", () => {
  const cs = [claim("c1", "She was charged with fraud", { status: "charge" }), claim("c2", "She was convicted of obstruction", { status: "conviction" })];
  const f = run("court-and-spotlight", [["She committed fraud.", ["c1"]]], cs);
  assert.ok(ids(f).includes("CS-1") && ids(f).includes("CS-2") && ids(f).includes("CS-3"));
  assert.deepEqual(ids(run("court-and-spotlight", [["Prosecutors charged her with fraud.", ["c1"]], ["A jury convicted her of obstruction.", ["c2"]]], cs)), []);
});

test("World View: contested views are attributed, groups are not one actor, at most four quotations", () => {
  const cs = [claim("c1", "The invasion was a defensive act", { status: "political_claim" })];
  assert.ok(ids(run("world-view", [["The invasion was a defensive act.", ["c1"]]], cs)).includes("WV-1"));
  assert.ok(ids(run("world-view", [["Officials said the invasion was a defensive act.", ["c1"]]], cs)).length === 0);
  assert.ok(ids(run("world-view", [["The Russians wanted the canal.", []]], cs)).includes("WV-2"));
  const q = ['"one two three"', '"four five six"', '"seven eight nine"', '"ten eleven twelve"', '"alpha beta gamma"'].map((x) => [`He said ${x}.`, []]);
  assert.ok(ids(run("world-view", q, cs)).includes("WV-3"));
});

test("channel identity beats a hook score: a hook the channel forbids is rejected however it scores", async () => {
  const { chooseHook } = await import("./hooks.mjs");
  const cs = [claim("c1", "Reward anticipation raises dopamine", { status: "established_fact" })];
  const ctx = { claims: cs, payoff: "Reward anticipation raises dopamine in the brain", central_question: "Why does anticipation feel good?", profile: channelConfig("dopamine-loop", "short").profile, reject: (h) => CHANNEL_RULES["dopamine-loop"].script({ sentences: [{ sentence_id: "hook", text: h.text, claim_ids: [] }], claimsOf: () => [], claims: cs }).some((x) => x.severity === "critical") };
  const r = chooseHook([{ text: "You have a dopamine disorder and anticipation proves it?", family: "the-warning", honest: true }, { text: "Why does anticipation feel good before you get the reward?", family: "the-question", honest: true }], ctx);
  assert.equal(r.selected.text, "Why does anticipation feel good before you get the reward?");
});

test("Dopamine Loop and Court & Spotlight blueprints enforce their channel structure", () => {
  const dl = channelConfig("dopamine-loop", "short");
  const claims = [claim("c1", "Reward anticipation raises dopamine", { status: "established_fact" }), claim("c2", "The reward system includes the striatum", { status: "established_fact" })];
  const bp = (purpose) => ({ central_question: "Why does anticipation feel good before the reward?", thesis: "Anticipation raises dopamine before any reward arrives in the brain", why_it_matters: "w", viewer_start: "a", viewer_end: "b", key_evidence: ["c1"], conclusion: "Anticipation raises dopamine before the reward.", questions_raised: [], beats: [{ beat_id: "b1", role: "opening", purpose, claim_ids: ["c1"], link_from_previous: "none" }, { beat_id: "b2", role: "development", purpose: "Explain the reward system answering the question", claim_ids: ["c2"], link_from_previous: "explanation" }, { beat_id: "b3", role: "payoff", purpose: "Show anticipation raises dopamine answering the question", claim_ids: ["c1"], link_from_previous: "consequence" }, { beat_id: "b4", role: "ending", purpose: "Return to the feeling and the question of anticipation", claim_ids: [], link_from_previous: "evidence" }] });
  const issues = (b) => blueprintIssues(b, { claims, profile: dl.profile, channel: dl, maxBeats: 5 }).filter((i) => i.code === "channel");
  assert.equal(issues(bp("States that dopamine is a neurotransmitter in the reward system")).length, 1);
  assert.equal(issues(bp("Opens on the feeling of wanting something before you have it, the question of anticipation")).length, 0);
  const cs = channelConfig("court-and-spotlight", "investigation");
  const a = [claim("c1", "She was charged", { status: "charge" }), claim("c2", "She was charged again", { status: "charge" })];
  const b2 = { ...bp("x"), beats: bp("x").beats.map((b) => ({ ...b, claim_ids: b.role === "ending" ? [] : ["c1"] })) };
  assert.ok(blueprintIssues(b2, { claims: a, profile: cs.profile, channel: cs, maxBeats: 8 }).some((i) => i.code === "channel" && /no outcome/.test(i.message)));
});

test("the critique must answer all thirteen questions and satisfy critique.schema.json", () => {
  const { pkg } = { pkg: buildPackage({ channel: "ai-tested", topic: "t", question: "Why is the sky blue today?", thesis: "t", claims: [claim("c1", "x y z")], beats: [{ id: "b1", claims: ["c1"], purpose: "p p p p p" }, { id: "b2", claims: ["c1"], purpose: "p p p p p" }, { id: "b3", claims: ["c1"], purpose: "p p p p p" }], sentences: [{ beat: "b1", text: "One.", claims: ["c1"] }, { beat: "b2", text: "Two.", claims: [], link: "l l l l" }, { beat: "b3", text: "Three.", claims: [], link: "l l l l" }] }) };
  const base = { verdict: "approve", scores: { coherence: 9, factual_support: 9, hook_effectiveness: 9, retention_pacing: 9, visual_alignment: 9 }, unexplained_claims: [], contradictions: [], required_corrections: [], findings: [], answers: Object.fromEntries(QUESTIONS.map((q) => [q, { ok: true, note: "" }])) };
  assert.deepEqual(critiqueProblems(base, pkg), []);
  assert.equal(QUESTIONS.length, 13);
  const { answers, ...noAnswers } = base;
  assert.equal(critiqueProblems(noAnswers, pkg).length, 13);
  assert.ok(critiqueProblems({ ...base, scores: { ...base.scores, coherence: 11 } }, pkg).some((p) => /coherence/.test(p)));
  assert.ok(critiqueProblems({ ...base, findings: [{ severity: "major", category: "made_up", sentence_ids: ["s9"], problem: "p", fix: "f" }] }, pkg).some((p) => /made_up|s9/.test(p)));
  assert.ok(critiqueProblems({ ...base, verdict: "revise" }, pkg).some((p) => /revise verdict must list/.test(p)));
});
