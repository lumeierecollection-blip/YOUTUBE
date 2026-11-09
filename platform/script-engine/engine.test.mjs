/**
 * Engine behaviour with a STUBBED model. Everything here is CONSTRUCTED: the source page is invented text about an
 * invented tool ("Quill Router"), so no real fact is asserted. What is tested is the control flow: what may advance,
 * what must stop, and how failures are classified.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBlueprint, BlueprintRejected, blueprintIssues, maxBeatsFor, unservingBeats } from "./blueprint.mjs";
import { channelConfig } from "./channels.mjs";
import { extractClaims, groundingProblem, InsufficientEvidence } from "./claims.mjs";
import { effectiveVerdict, QUESTIONS } from "./critic.mjs";
import { runEngine } from "./engine.mjs";
import { chooseHook, hookScore } from "./hooks.mjs";
import { scriptedLLM } from "./testkit.mjs";
import { validate } from "./schema.mjs";
import { writerStructureProblems } from "./writer.mjs";
import { sceneTraceability } from "./traceability.mjs";

const WPM = { wpm: 170, source: "measured", voice: "en-US-AndrewNeural" };
const TEXT = [
  "Quill Router is a command line tool that sends each prompt to the cheapest model that can answer it. Its first release shipped on 3 March 2026.",
  "To use it, a developer lists models in a file called router.yaml, each with a price per million tokens. Quill Router then reads the prompt length and picks the cheapest listed model whose context window fits.",
  "In the project's own benchmark of 500 prompts, the router cut spending by 41 percent compared with sending every prompt to the largest model.",
  "The project says answer quality stayed the same, but the benchmark has not been repeated by anyone outside the project.",
  "The tool is written in Rust and runs on Linux, macOS and Windows.",
].join("\n");
const SOURCES = [{ source_id: "s1", url: "https://example.test/quill-router", title: "Quill Router (constructed test page)", published: "2026-03-04", text: TEXT }];
const X = (s) => TEXT.split(/(?<=\.)\s+/).find((p) => p.includes(s));

const rawClaim = (claim, excerpt, status, extra = {}) => ({ claim, source_id: "s1", excerpt, confidence: "high", editorial_status: status, context: "", contradictory_evidence: [], ...extra });
const GOOD_CLAIMS = {
  claims: [
    rawClaim("Quill Router sends each prompt to the cheapest model that can answer it.", X("sends each prompt"), "demonstrated_feature"),
    rawClaim("A developer lists models and their prices per million tokens in a file called router.yaml.", X("lists models in a file"), "demonstrated_feature"),
    rawClaim("Quill Router reads the prompt length and picks the cheapest listed model whose context window fits.", X("reads the prompt length"), "demonstrated_feature"),
    rawClaim("In the project's benchmark of 500 prompts, the router cut spending by 41 percent compared with sending every prompt to the largest model.", X("benchmark of 500"), "measured_statistic"),
    rawClaim("The project says answer quality stayed the same, and the benchmark has not been repeated outside the project.", X("The project says answer quality"), "marketing_claim"),
    rawClaim("Quill Router is written in Rust and runs on Linux, macOS and Windows.", X("written in Rust"), "demonstrated_feature"),
    rawClaim("The first release of Quill Router shipped on 3 March 2026.", "Its first release shipped on 3 March 2026.", "demonstrated_feature"),
    // The next three must be dropped by code:
    rawClaim("Quill Router cut spending by 60 percent.", X("benchmark of 500"), "measured_statistic"),
    rawClaim("Quill Router was praised by developers everywhere.", "Developers everywhere praised the router in a widely read thread.", "marketing_claim"),
    rawClaim("Quill Router is a command line tool.", X("sends each prompt"), "established_fact"),
  ],
};

const BLUEPRINT = {
  central_question: "How does Quill Router cut model spending by 41 percent?", thesis: "Quill Router sends each prompt to the cheapest listed model that fits, which cut spending by 41 percent in the project's own test",
  why_it_matters: "It shows where the saving comes from and how far the evidence goes.", viewer_start: "Has not heard of Quill Router.", viewer_end: "Knows how it picks a model and that the 41 percent figure is the project's own.",
  key_evidence: ["c1", "c3", "c4", "c5"],
  beats: [
    { beat_id: "b1", role: "opening", purpose: "Open on the 41 percent saving and what Quill Router does to get it", claim_ids: ["c4", "c1"], link_from_previous: "none" },
    { beat_id: "b2", role: "development", purpose: "Explain how Quill Router chooses the cheapest model that fits each prompt", claim_ids: ["c2", "c3"], link_from_previous: "explanation" },
    { beat_id: "b3", role: "payoff", purpose: "Show the 41 percent result and the limit on trusting it", claim_ids: ["c4", "c5"], link_from_previous: "consequence" },
    { beat_id: "b4", role: "ending", purpose: "Return to the opening question: where the saving comes from", claim_ids: [], link_from_previous: "evidence" },
  ],
  questions_raised: [{ question: "How does Quill Router cut model spending by 41 percent?", raised_in: "b1", answered_in: "b3" }],
  conclusion: "Quill Router saves money by choosing the cheapest model that fits each prompt.",
};
const BP_CHECK = { beats: BLUEPRINT.beats.map((b) => ({ beat_id: b.beat_id, serves: true, link_true: true, reason: "ok" })), answers_question: true, fits_length: true, gaps: [], narrow_to: "" };

const S = (beat, text, claim_ids, link, on) => ({ beat_id: beat, text, role: "states a point", claim_ids, link_from_previous: link, on_screen_text: on });
const SENTENCES = [
  S("b1", "How does Quill Router cut model spending by 41 percent?", ["c4"], "opening", "41% cheaper?"),
  S("b1", "It sends each prompt to the cheapest model that can answer it.", ["c1"], "answers the question by saying what the tool does", "Cheapest model"),
  S("b2", "A developer lists models and prices; Quill Router picks the cheapest that fits.", ["c2", "c3"], "explains how the tool decides which model gets the prompt", "One file of prices"),
  S("b3", "Picking the cheapest model cut spending 41 percent in the project's own test of 500 prompts.", ["c4"], "gives the result of that picking, which answers the opening question", "500 prompts: 41%"),
  S("b3", "The project says quality held, though no one outside it has repeated the test.", ["c5"], "adds the limit on how far that result can be trusted", "Own test only"),
  S("b4", "So Quill Router saves money by choosing the cheapest model that fits, by the project's own count.", ["c4"], "returns to the opening question and answers it", "Pick the cheapest"),
];
const HOOKS = [
  { text: "How does Quill Router cut model spending by 41 percent?", family: "the-question", honest: true, claim_ids: ["c4"] },
  { text: "Quill Router cut model spending by 41 percent in its own test.", family: "the-statistic", honest: true, claim_ids: ["c4"] },
  { text: "This tool saved 90 percent on model costs.", family: "the-impossible", honest: true, claim_ids: ["c4"] },
  { text: "You won't believe how Quill Router cuts model costs.", family: "the-reveal", honest: true, claim_ids: [] },
];
const WRITER = { hook_options: HOOKS, sentences: SENTENCES, cta: null };
const CONT_OK = { findings: [], understood_when_heard_once: true, confusion: [] };
const answers = (over = {}) => Object.fromEntries(QUESTIONS.map((q) => [q, { ok: true, note: "", ...(over[q] || {}) }]));
const CRIT_OK = { verdict: "approve", scores: { coherence: 9, factual_support: 9, hook_effectiveness: 8, retention_pacing: 8, visual_alignment: 8 }, answers: answers(), unexplained_claims: [], contradictions: [], required_corrections: [], findings: [] };
const CRIT_REVISE = { ...CRIT_OK, verdict: "revise", scores: { ...CRIT_OK.scores, coherence: 6 }, answers: answers({ no_missing_explanations: { ok: false, note: "s5: who is 'the project'?" } }), required_corrections: ["s5: say who the project is"], findings: [{ severity: "major", category: "unexplained_name", sentence_ids: ["s5"], problem: "'the project' is not identified", fix: "Say Quill Router's project." }] };

const base = (extra = {}) => ({ claims: GOOD_CLAIMS, blueprint: BLUEPRINT, "blueprint-check": BP_CHECK, writer: WRITER, continuity: CONT_OK, critic: CRIT_OK, ...extra });
const run = (handlers, opts = {}) => runEngine({ channelKey: "ai-tested", topic: "Quill Router", angle: "how it cuts model spending", sources: SOURCES, llm: scriptedLLM(handlers, opts.stub), wpm: WPM, ...opts.engine });

test("claims: a claim survives only if its excerpt is verbatim in the fetched page and its numbers and category hold", async () => {
  const ch = channelConfig("ai-tested", "short");
  const res = await extractClaims({ llm: scriptedLLM({ claims: GOOD_CLAIMS }), calls: [] }, { channel: ch, topic: "Quill Router", angle: "x", sources: SOURCES });
  assert.equal(res.claims.length, 7);
  assert.equal(res.dropped.length, 3);
  assert.match(res.dropped[0].reason, /number\(s\) the excerpt does not hold: 60/);
  assert.match(res.dropped[1].reason, /not verbatim/);
  assert.match(res.dropped[2].reason, /not one of this channel's claim categories/);
  assert.deepEqual(res.claims.map((c) => c.claim_id), ["c1", "c2", "c3", "c4", "c5", "c6", "c7"]);
  for (const c of res.claims) assert.deepEqual(validate("claim-record", c), []);
  assert.ok(res.claims.every((c) => c.source_url === "https://example.test/quill-router"));
});

test("claims: too few grounded claims blocks the topic instead of inventing facts", async () => {
  const ch = channelConfig("ai-tested", "short");
  await assert.rejects(extractClaims({ llm: scriptedLLM({ claims: { claims: GOOD_CLAIMS.claims.slice(7) } }), calls: [] }, { channel: ch, topic: "Quill Router", angle: "x", sources: SOURCES }), InsufficientEvidence);
  const r = await run({ claims: { claims: GOOD_CLAIMS.claims.slice(7) } });
  assert.equal(r.status, "blocked_input");
  assert.equal(r.package, undefined);
});

test("a name the excerpt does not hold is rejected", () => {
  const sourceById = new Map([["s1", SOURCES[0]]]);
  const p = groundingProblem(rawClaim("Quill Router was built by Marta Okafor.", X("sends each prompt"), "demonstrated_feature"), { sourceById, categories: ["demonstrated_feature"], topic: "Quill Router" });
  assert.match(p, /name "Marta Okafor"/);
});

test("APPROVED: a good script passes every gate on one draft, reviewed by a different provider than the writer", async () => {
  const llm = scriptedLLM(base());
  const r = await runEngine({ channelKey: "ai-tested", topic: "Quill Router", angle: "x", sources: SOURCES, llm, wpm: WPM });
  assert.equal(r.status, "approved", JSON.stringify(r.report.rounds.at(-1)?.deterministic?.findings?.filter((f) => f.severity !== "minor"), null, 1));
  assert.deepEqual(validate("script-package", r.package), []);
  assert.equal(r.package.quality_report.status, "approved");
  assert.equal(r.package.quality_report.independent_provider, true);
  assert.match(r.package.quality_report.approved_by, /^critic\/groq$/);
  assert.match(r.package.quality_report.written_by, /^writer\/gemini$/);
  assert.equal(r.report.providers.writer.includes("groq"), false);
  assert.ok(r.package.duration_estimate_s <= 29, `${r.package.duration_estimate_s}s`);
  assert.equal(llm.counts.critic, 1);
  assert.equal(llm.counts.continuity, 1);
  assert.deepEqual(llm.log.find((l) => l.tag === "critic").avoid, ["gemini"], "the critic is told to avoid the writer's provider");
  assert.equal(r.scene_seeds.seeds.length, r.package.sentences.length);
  // dishonest hooks are listed but never chosen, whatever their score
  const opts = r.package.hook_options;
  assert.equal(opts.length, 4);
  assert.equal(opts.find((h) => /90 percent/.test(h.text)).honest, false);
  assert.equal(opts.find((h) => /won't believe/.test(h.text)).honest, false);
  assert.ok(opts.find((h) => h.text === r.package.selected_hook).honest);
});

test("hooks: the highest-scoring hook loses if it is not honest", () => {
  const claims = [{ claim_id: "c1", claim: "Quill Router cut spending by 41 percent", excerpt: "cut spending by 41 percent" }];
  const ctx = { claims, payoff: "In the test, spending fell 41 percent for Quill Router", central_question: "How does Quill Router cut spending?", profile: channelConfig("ai-tested", "short").profile };
  const options = [{ text: "Quill Router cut your bills by 97 percent overnight?", family: "the-statistic", honest: true }, { text: "How does Quill Router cut spending by 41 percent?", family: "the-question", honest: true }];
  assert.ok(hookScore(options[0].text).total >= 0);
  const r = chooseHook(options, ctx);
  assert.equal(r.selected.text, options[1].text);
  assert.match(r.options[0].dishonest_reasons.join(), /97 is in no claim/);
});

test("REVISION: a critic's required corrections go back to the writer, and the revised draft is reviewed again", async () => {
  const REVISED = { ...WRITER, sentences: SENTENCES.map((s, i) => (i === 4 ? { ...s, text: "The Quill Router team says quality held; no one else has repeated the test." } : s)) };
  const llm = scriptedLLM(base({ critic: [CRIT_REVISE, CRIT_OK], "writer-revise": REVISED }));
  const r = await runEngine({ channelKey: "ai-tested", topic: "Quill Router", angle: "x", sources: SOURCES, llm, wpm: WPM });
  assert.equal(r.status, "approved");
  assert.equal(llm.counts.critic, 2);
  assert.equal(llm.counts["writer-revise"], 1);
  assert.match(llm.log.find((l) => l.tag === "writer-revise").user, /say who the project is/);
  assert.match(r.package.sentences[4].text, /Quill Router team/);
  assert.equal(r.report.rounds.length, 2);
  assert.equal(r.drafts.length, 2, "the first draft is kept beside the revision");
});

test("REJECTED: a critic that never approves ends the loop after the allowed revisions, with no package released", async () => {
  const llm = scriptedLLM(base({ critic: CRIT_REVISE, "writer-revise": WRITER }));
  const r = await runEngine({ channelKey: "ai-tested", topic: "Quill Router", angle: "x", sources: SOURCES, llm, wpm: WPM, maxRevisions: 2 });
  assert.equal(r.status, "rejected");
  assert.equal(r.package, undefined);
  assert.equal(r.report.unreviewed_script_released, false);
  assert.equal(llm.counts.critic, 3);
  assert.equal(llm.counts["writer-revise"], 2);
  assert.equal(r.rejected_draft.quality_report.status, "rejected");
});

test("an approve that contradicts the critic's own answers is demoted to revise", () => {
  const c = { ...CRIT_OK, answers: answers({ sounds_human: { ok: false, note: "reads like a template" } }) };
  const e = effectiveVerdict(c);
  assert.equal(e.verdict, "revise");
  assert.equal(e.overridden, true);
  assert.match(e.reasons.join(), /sounds_human/);
  assert.equal(effectiveVerdict({ ...CRIT_OK, scores: { ...CRIT_OK.scores, factual_support: 7 } }).verdict, "revise");
  assert.equal(effectiveVerdict({ ...CRIT_OK, unexplained_claims: ["s3"] }).verdict, "revise");
});

test("a writer can never approve itself: verdicts inside the writer's output are ignored and the critic is still required", async () => {
  const sneaky = { ...WRITER, verdict: "approve", critique: { verdict: "approve" }, quality_report: { status: "approved" } };
  const llm = scriptedLLM(base({ writer: sneaky, critic: { __error: "quota_exhausted" } }));
  const r = await runEngine({ channelKey: "ai-tested", topic: "Quill Router", angle: "x", sources: SOURCES, llm, wpm: WPM });
  assert.equal(r.status, "blocked_provider");
  assert.equal(r.package, undefined, "an unreviewed script is not released");
  assert.equal(r.report.blocked.role, "critic");
  const ok = await run(base({ writer: sneaky }));
  assert.equal(ok.status, "approved");
  assert.equal(JSON.stringify(ok.package).includes('"verdict"'), false, "nothing the writer asserted about itself reaches the package");
});

test("when only one provider has a key the critic is still a separate call, and the report says so", async () => {
  const r = await run(base(), { stub: { providers: { writer: "gemini", critic: "gemini", judge: "gemini" } } });
  assert.equal(r.status, "approved");
  assert.equal(r.package.quality_report.independent_provider, false);
  assert.match(r.report.caveats.join(" "), /same provider as the writer/);
});

test("quota exhaustion is classified as blocked_provider, never as a quality failure and never as a pass", async () => {
  for (const [tag, role] of [["claims", "writer"], ["blueprint", "writer"], ["writer", "writer"], ["continuity", "judge"], ["critic", "critic"]]) {
    const r = await run(base({ [tag]: { __error: "quota_exhausted" } }));
    assert.equal(r.status, "blocked_provider", tag);
    assert.equal(r.report.blocked.role, role, tag);
    assert.equal(r.package, undefined, tag);
  }
});

test("a provider that keeps returning unusable JSON is blocked_model", async () => {
  const r = await run(base({ continuity: { findings: "nothing", understood_when_heard_once: "yes" } }));
  assert.equal(r.status, "blocked_model");
  assert.equal(r.package, undefined);
});

test("deterministic failures stop the script BEFORE any model review is spent", async () => {
  const JUMP = { ...WRITER, sentences: SENTENCES.map((s, i) => (i === 2 ? { ...s, text: "Who reported this feature live from Hyderabad?", claim_ids: [] } : i === 5 ? { ...s, text: "Check pinning custom spaces to main tabs.", claim_ids: ["c6"] } : s)) };
  const llm = scriptedLLM(base({ writer: JUMP, "writer-revise": JUMP }));
  const r = await runEngine({ channelKey: "ai-tested", topic: "Quill Router", angle: "x", sources: SOURCES, llm, wpm: WPM, maxRevisions: 1 });
  assert.equal(r.status, "rejected");
  assert.equal(llm.counts.continuity, undefined);
  assert.equal(llm.counts.critic, undefined);
  assert.ok(r.findings.some((f) => f.rule === "CON-04" || f.rule === "CON-03" || f.rule === "CON-02"));
});

test("a model continuity review that finds a critical problem blocks narration", async () => {
  const llm = scriptedLLM(base({ continuity: { findings: [{ severity: "critical", category: "abrupt_topic_change", sentence_ids: ["s3"], problem: "s3 jumps to the file format with no reason", fix: "Say why the file matters." }], understood_when_heard_once: false, confusion: ["s3"] }, "writer-revise": WRITER }));
  const r = await runEngine({ channelKey: "ai-tested", topic: "Quill Router", angle: "x", sources: SOURCES, llm, wpm: WPM, maxRevisions: 1 });
  assert.equal(r.status, "rejected");
  assert.equal(llm.counts.critic, undefined, "the critic is not asked about a script continuity already blocked");
  assert.match(llm.log.find((l) => l.tag === "writer-revise").user, /s3 jumps to the file format/);
});

test("DURATION: a story too long for the length is narrowed (new blueprint), never read faster", async () => {
  const filler = (t) => S("b2", t, ["c3"], "adds more detail on how the tool picks", "More detail");
  const LONG = { ...WRITER, sentences: [...SENTENCES.slice(0, 3), filler("Each time a prompt arrives the router measures how long it is and compares that length with every model."), filler("Any model whose context window is too small for the prompt is dropped from the list before prices are compared."), ...SENTENCES.slice(3)] };
  const llm = scriptedLLM(base({ writer: [LONG, WRITER], blueprint: [BLUEPRINT, BLUEPRINT] }));
  const r = await runEngine({ channelKey: "ai-tested", topic: "Quill Router", angle: "x", sources: SOURCES, llm, wpm: WPM });
  assert.equal(r.status, "approved");
  assert.equal(r.report.narrowings, 1);
  assert.equal(llm.counts.blueprint, 2);
  assert.match(llm.log.filter((l) => l.tag === "blueprint")[1].user, /Narrower than/);
  assert.equal(r.report.wpm.wpm, 170, "the measured rate was used, unchanged");
});

test("blueprint: a beat that does not serve the central question is removed; a plan that cannot answer the question is rejected", async () => {
  const claims = (await extractClaims({ llm: scriptedLLM({ claims: GOOD_CLAIMS }), calls: [] }, { channel: channelConfig("ai-tested", "short"), topic: "Quill Router", angle: "x", sources: SOURCES })).claims;
  claims.push({ claim_id: "c8", claim: "The mascot is a blue heron named Pip.", excerpt: "The mascot is a blue heron named Pip.", editorial_status: "demonstrated_feature", confidence: "high", source_id: "s1", source_url: "u" });
  const OFF = { ...BLUEPRINT, beats: [BLUEPRINT.beats[0], { beat_id: "b1x", role: "context", purpose: "A tangent about the heron mascot", claim_ids: ["c8"], link_from_previous: "comparison" }, ...BLUEPRINT.beats.slice(1)] };
  assert.deepEqual(unservingBeats(OFF, claims), ["b1x"]);
  const ch = channelConfig("ai-tested", "short");
  const ctx = { llm: scriptedLLM({ blueprint: OFF, "blueprint-check": BP_CHECK }), calls: [] };
  const res = await buildBlueprint(ctx, { channel: ch, topic: "Quill Router", angle: "x", claims, capacityWords: 76, targetSeconds: 27 });
  assert.ok(!res.blueprint.beats.some((b) => b.beat_id === "b1x"));
  assert.equal(res.removed[0].beat_id, "b1x");
  const model = scriptedLLM({ blueprint: BLUEPRINT, "blueprint-check": { ...BP_CHECK, beats: BP_CHECK.beats.map((b) => (b.beat_id === "b2" ? { ...b, serves: false, reason: "off question" } : b)) } });
  const res2 = await buildBlueprint({ llm: model, calls: [] }, { channel: ch, topic: "Quill Router", angle: "x", claims, capacityWords: 76, targetSeconds: 27 }).catch((e) => e);
  assert.ok(res2 instanceof BlueprintRejected || !res2.blueprint?.beats.some((b) => b.beat_id === "b2"), "the model's verdict removes the beat");
  const NO_PAYOFF = { ...BLUEPRINT, beats: BLUEPRINT.beats.map((b) => (b.role === "payoff" ? { ...b, role: "development" } : b)) };
  await assert.rejects(buildBlueprint({ llm: scriptedLLM({ blueprint: NO_PAYOFF, "blueprint-check": BP_CHECK }), calls: [] }, { channel: ch, topic: "Quill Router", angle: "x", claims, capacityWords: 76, targetSeconds: 27 }), BlueprintRejected);
});

test("blueprint: no narration is written when the blueprint is rejected", async () => {
  const BAD = { ...BLUEPRINT, central_question: "Quill Router" };
  const llm = scriptedLLM(base({ blueprint: BAD }));
  const r = await runEngine({ channelKey: "ai-tested", topic: "Quill Router", angle: "x", sources: SOURCES, llm, wpm: WPM });
  assert.equal(r.status, "rejected_blueprint");
  assert.equal(llm.counts.writer, undefined);
  assert.equal(llm.counts.blueprint, 3);
});

test("blueprint deterministic checks: unanswered questions, unknown claims, beats beyond what the length holds", () => {
  const claims = [{ claim_id: "c1" }, { claim_id: "c2" }, { claim_id: "c3" }, { claim_id: "c4" }, { claim_id: "c5" }].map((c) => ({ ...c, claim: "x", excerpt: "x", editorial_status: "demonstrated_feature" }));
  const ch = channelConfig("ai-tested", "short");
  const bad = { ...BLUEPRINT, questions_raised: [{ question: "q", raised_in: "b3", answered_in: "b1" }], beats: BLUEPRINT.beats.map((b, i) => (i === 1 ? { ...b, claim_ids: ["c99"] } : b)) };
  const issues = blueprintIssues(bad, { claims, profile: ch.profile, channel: ch, maxBeats: 3 });
  const codes = issues.map((i) => i.message);
  assert.ok(codes.some((m) => /answered before it is raised/.test(m)));
  assert.ok(codes.some((m) => /claim c99 does not exist/.test(m)));
  assert.ok(codes.some((m) => /do not fit the length/.test(m)));
  assert.equal(maxBeatsFor(ch.profile, 76), 5);
  assert.equal(maxBeatsFor(ch.profile, 30), 3, "a very short script still needs the minimum beats");
});

test("LONG FORM is a separate path: it does not inherit Shorts pacing or the WATCH method", async () => {
  const short = channelConfig("ai-tested", "short"), long = channelConfig("rival-lines", "match_analysis");
  assert.equal(short.profile.mode, "short");
  assert.equal(long.profile.mode, "long");
  assert.ok(long.profile.maxSentenceWords > short.profile.maxSentenceWords);
  assert.ok(long.profile.maxSeconds > 100 && short.profile.maxSeconds <= 29);
  assert.ok(long.profile.minBeats > short.profile.minBeats);
  const sentence = { beat_id: "b1", text: Array(26).fill("word").join(" ") + ".", role: "r", claim_ids: [], link_from_previous: "opening", on_screen_text: "x" };
  const out = { hook_options: [{}, {}], sentences: [sentence] };
  const bp = { beats: [{ beat_id: "b1" }] };
  assert.ok(writerStructureProblems(out, { blueprint: bp, claims: [], profile: short.profile }).some((p) => /limit is 20/.test(p)));
  assert.ok(!writerStructureProblems(out, { blueprint: bp, claims: [], profile: long.profile }).some((p) => /words; the limit/.test(p)));
  const { readFileSync } = await import("node:fs");
  const { ROOT } = await import("./schema.mjs");
  const ms = readFileSync(`${ROOT}/prompts/script-engine/method-short.md`, "utf8"), ml = readFileSync(`${ROOT}/prompts/script-engine/method-long.md`, "utf8");
  assert.match(ms, /WATCH/); assert.doesNotMatch(ml, /WATCH/); assert.match(ml, /separate path from Shorts/);
  assert.throws(() => channelConfig("rival-lines", "short"), /does not offer format/);
});

test("scene plans built from an approved script trace back to the script", async () => {
  const r = await run(base());
  assert.equal(r.status, "approved");
  const plan = {
    channel: "ai-tested", production_run: "t", format: "short",
    scenes: r.scene_seeds.seeds.map((s) => ({ ...s, visual_objective: "Show the sentence's subject", treatment: "t", background: "white", skill: "k", assets: [], animation: "fade", transition: "cut" })),
  };
  assert.deepEqual(sceneTraceability(plan, r.package, r.package.claims).filter((f) => f.severity !== "minor"), []);
});

test("LONG FORM end to end: a long-form channel runs the long path (CONSTRUCTED length overrides so the tiny test script fits)", async () => {
  const lf = { claims: GOOD_CLAIMS.claims.map((c) => ({ ...c, editorial_status: c.editorial_status === "measured_statistic" ? "measured_statistic" : "established_fact" })) };
  const five = { ...BLUEPRINT, beats: [BLUEPRINT.beats[0], BLUEPRINT.beats[1], { beat_id: "b2b", role: "development", purpose: "Explain that the tool reads the prompt length before it picks the cheapest model", claim_ids: ["c3"], link_from_previous: "explanation" }, BLUEPRINT.beats[2], BLUEPRINT.beats[3]] };
  const sentences = [...SENTENCES.slice(0, 3), S("b2b", "Quill Router reads the prompt length before it picks the cheapest listed model.", ["c3"], "explains the second half of how the tool picks a model", "Reads the length"), ...SENTENCES.slice(3)];
  const llm = scriptedLLM({ claims: lf, blueprint: five, "blueprint-check": { ...BP_CHECK, beats: five.beats.map((b) => ({ beat_id: b.beat_id, serves: true, link_true: true, reason: "ok" })) }, writer: { ...WRITER, sentences }, continuity: CONT_OK, critic: CRIT_OK });
  const r = await runEngine({ channelKey: "rival-lines", format: "match_analysis", topic: "Quill Router", angle: "x", sources: SOURCES, llm, wpm: WPM, profileOverrides: { targetSeconds: 40, minSeconds: 15, maxSeconds: 60 } });
  assert.equal(r.status, "approved", JSON.stringify(r.report.rounds.at(-1)?.deterministic?.findings?.filter((f) => f.severity !== "minor"), null, 1) + JSON.stringify(r.report.blueprint?.history ?? r.issues ?? r.error));
  assert.equal(r.package.format, "match_analysis");
  assert.match(llm.log.find((l) => l.tag === "writer").user, /separate path from Shorts/);
  assert.doesNotMatch(llm.log.find((l) => l.tag === "writer").user, /WATCH framework/);
});
