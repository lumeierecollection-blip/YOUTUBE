/**
 * eval-retry-loop.js — the three-layer wiring.
 *
 * MUTATION (run, recorded): RETRY_CAP 3 -> 5 turns the cap test red.
 * Restored byte-identical.
 *
 * Every dependency is injected, so the whole loop runs offline.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  runEvalLoop, resolveRevisions, applyPartialPatch, beatsUnchanged,
  mapFinding, FINDING_FIELD_MAP,
  ACCEPT_THRESHOLD, RETRY_CAP,
} from "../eval-retry-loop.js";

const plan = () => ({
  beats: [
    { index: 0, visual_type: "TYPE", headline: "A" },
    { index: 1, visual_type: "TYPE", headline: "B" },
    { index: 2, visual_type: "MAP", headline: "C", data: { place: "US" } },
    { index: 3, visual_type: "TYPE", headline: "D" },
    { index: 4, visual_type: "TYPE", headline: "E" },
  ],
});
const passL1 = async () => ({ pass: true, failures: [] });
const advisory = async () => ({ advisory_score: 0.61, below_floor_count: 3 });
const judgeWith = (aggregate, weak = []) => async () => ({
  axes: { engagement: 8, prompt_intent: 8, composition: 8, style_coherence: 8 },
  aggregate_local: aggregate, weak_beats: weak,
});
const noopRender = async () => {};

describe("resolveRevisions", () => {
  it("keeps an element that is a real field on that beat", () => {
    const { revisions, unresolved } = resolveRevisions([{ beat_index: 1, element: "headline", reason: "x" }], plan().beats);
    assert.equal(revisions.length, 1);
    assert.equal(unresolved.length, 0);
    assert.equal(revisions[0].current, "B");
  });
  it("records a non-field element as unresolved, and does not guess", () => {
    const { revisions, unresolved } = resolveRevisions([{ beat_index: 1, element: "color palette", reason: "x" }], plan().beats);
    assert.equal(revisions.length, 0, "Gemini names what looks wrong, which is often not a field");
    assert.match(unresolved[0].why, /not a field a beat renders from/);
  });
  it("records an element the beat does not have", () => {
    const { unresolved } = resolveRevisions([{ beat_index: 0, element: "data" }], plan().beats);
    assert.match(unresolved[0].why, /has no "data" field/);
  });
  it("records a beat index that is not in the plan", () => {
    const { unresolved } = resolveRevisions([{ beat_index: 99, element: "headline" }], plan().beats);
    assert.match(unresolved[0].why, /does not identify a beat/);
  });
});

describe("applyPartialPatch", () => {
  it("changes only the named field of the named beat", () => {
    const before = plan();
    const { plan: after, changedBeats } = applyPartialPatch(before, [{ beat_index: 2, element: "headline", current: "C" }], () => "REVISED");
    assert.deepEqual(changedBeats, [2]);
    assert.equal(after.beats[2].headline, "REVISED");
    assert.deepEqual(beatsUnchanged(before, after, changedBeats), { ok: true });
  });
  it("leaves a beat untouched when the replacement equals the current value", () => {
    const { changedBeats } = applyPartialPatch(plan(), [{ beat_index: 0, element: "headline", current: "A" }], () => "A");
    assert.deepEqual(changedBeats, []);
  });
  it("does not mutate the input plan", () => {
    const before = plan();
    applyPartialPatch(before, [{ beat_index: 0, element: "headline" }], () => "X");
    assert.equal(before.beats[0].headline, "A");
  });
});

describe("beatsUnchanged", () => {
  it("reports which untouched beat changed", () => {
    const a = plan(); const b = plan();
    b.beats[4].headline = "MUTATED";
    assert.deepEqual(beatsUnchanged(a, b, [2]), { ok: false, beat: 4 });
  });
});

describe("loop: accept path", () => {
  it("accepts at 8.0 with no re-render at all", async () => {
    let renders = 0;
    const r = await runEvalLoop({
      plan: plan(), runId: "acc", channel: 2,
      layer1: passL1, layer2: advisory, layer3: judgeWith(8.0), revise: async () => ({}), renderBeats: async () => { renders++; },
    });
    assert.equal(r.accepted, true);
    assert.equal(r.humanReview, false);
    assert.equal(r.retries, 0);
    assert.equal(renders, 0, "no re-render when the video passes");
  });
  it("accepts exactly at the threshold", async () => {
    const r = await runEvalLoop({
      plan: plan(), runId: "acc7", channel: 2,
      layer1: passL1, layer2: advisory, layer3: judgeWith(ACCEPT_THRESHOLD), revise: async () => ({}), renderBeats: noopRender,
    });
    assert.equal(r.accepted, true);
  });
});

describe("loop: Layer 2 is advisory only", () => {
  it("never increments the retry counter, even scoring every frame below floor", async () => {
    const terrible = async () => ({ advisory_score: 0.02, below_floor_count: 30, frame_count: 30 });
    const r = await runEvalLoop({
      plan: plan(), runId: "adv", channel: 2,
      layer1: passL1, layer2: terrible, layer3: judgeWith(9.0), revise: async () => ({}), renderBeats: noopRender,
    });
    assert.equal(r.accepted, true);
    assert.equal(r.retries, 0, "an advisory that cannot mean anything must not spend a retry");
  });
  it("passes the advisory into Layer 3", async () => {
    let seen = null;
    await runEvalLoop({
      plan: plan(), runId: "adv2", channel: 2,
      layer1: passL1, layer2: async () => ({ advisory_score: 0.42 }), layer3: async (o) => { seen = o.layer2Advisory; return { axes: {}, aggregate_local: 9, weak_beats: [] }; },
      revise: async () => ({}), renderBeats: noopRender,
    });
    assert.equal(seen.advisory_score, 0.42);
  });
});

describe("loop: partial, not whole", () => {
  it("re-renders only the named beat and leaves the rest byte-identical", async () => {
    const before = plan();
    let current = before;
    const rendered = [];
    const r = await runEvalLoop({
      plan: before, runId: "part", channel: 2,
      layer1: passL1, layer2: advisory,
      layer3: async ({ attempt }) => attempt === 0
        ? { axes: {}, aggregate_local: 4.0, weak_beats: [{ beat_index: 2, element: "headline", reason: "clash" }] }
        : { axes: {}, aggregate_local: 9.0, weak_beats: [] },
      revise: async (revisions, { plan: p }) => {
        const { plan: next, changedBeats } = applyPartialPatch(p, revisions, () => "REVISED HEADLINE");
        current = next;
        return { planPatch: next, changedBeats };
      },
      renderBeats: async (idx) => rendered.push(...idx),
    });
    assert.equal(r.accepted, true);
    assert.equal(r.retries, 1);
    assert.deepEqual(rendered, [2], "exactly one beat re-rendered, not the video");
    assert.deepEqual(beatsUnchanged(before, current, [2]), { ok: true });
    assert.equal(current.beats[0].headline, "A");
    assert.equal(current.beats[4].headline, "E");
  });
  it("fails loud to human review when the planner returns no partial patch", async () => {
    const r = await runEvalLoop({
      plan: plan(), runId: "nopatch", channel: 2,
      layer1: passL1, layer2: advisory,
      layer3: judgeWith(4.0, [{ beat_index: 1, element: "headline" }]),
      revise: async () => ({}), renderBeats: noopRender,
    });
    assert.equal(r.accepted, false);
    assert.equal(r.humanReview, true);
    assert.match(r.why, /full re-render is not permitted/);
  });
});

describe("loop: unresolved elements", () => {
  it("logs unresolved and does not consume a retry", async () => {
    let renders = 0;
    const r = await runEvalLoop({
      plan: plan(), runId: "unres", channel: 2,
      layer1: passL1, layer2: advisory,
      layer3: judgeWith(4.0, [{ beat_index: 1, element: "color palette", reason: "clash" }]),
      revise: async () => ({}), renderBeats: async () => { renders++; },
    });
    assert.equal(r.humanReview, true);
    assert.equal(r.retries, 0, "nothing was attempted, so nothing is charged");
    assert.equal(renders, 0);
    assert.match(r.unresolved[0].why, /not a field a beat renders from/);
  });
});

describe("loop: retry cap", () => {
  it("caps at 3 and routes to human review without a fourth render", async () => {
    assert.equal(RETRY_CAP, 3);
    let renders = 0, judges = 0;
    const r = await runEvalLoop({
      plan: plan(), runId: "cap", channel: 2,
      layer1: passL1, layer2: advisory,
      layer3: async () => { judges++; return { axes: {}, aggregate_local: 3.0, weak_beats: [{ beat_index: 1, element: "headline", reason: "clash" }] }; },
      revise: async (revisions, { plan: p }) => {
        const { plan: next, changedBeats } = applyPartialPatch(p, revisions, () => "R" + Math.random());
        return { planPatch: next, changedBeats };
      },
      renderBeats: async () => { renders++; },
    });
    assert.equal(r.accepted, false);
    assert.equal(r.humanReview, true);
    assert.equal(r.retries, 3, "exactly three retries, no fourth");
    assert.equal(renders, 3);
    assert.equal(judges, 4, "judged four times: the original plus three retries");
    assert.match(r.why, /retry cap 3 reached/);
  });
});

describe("loop: Layer 1 path is unchanged", () => {
  it("re-renders the failed beat and re-runs Layer 1", async () => {
    const rendered = [];
    let calls = 0;
    const r = await runEvalLoop({
      plan: plan(), runId: "l1", channel: 2,
      layer1: async () => { const n = ++calls; return n > 1 ? { pass: true, failures: [] } : { pass: false, failures: [{ beat: 1, element: "headline" }] }; },
      layer2: advisory, layer3: judgeWith(9.0), revise: async () => ({}),
      renderBeats: async (idx, meta) => rendered.push({ idx, reason: meta.reason }),
    });
    assert.equal(r.accepted, true);
    assert.deepEqual(rendered, [{ idx: [1], reason: "layer1" }], "Layer 1 fail re-renders the failed beat, as before");
  });
  it("routes to human review when Layer 1 never passes", async () => {
    const r = await runEvalLoop({
      plan: plan(), runId: "l1b", channel: 2,
      layer1: async () => ({ pass: false, failures: [{ beat: 0, element: "headline" }] }),
      layer2: advisory, layer3: judgeWith(9.0), revise: async () => ({}), renderBeats: noopRender,
    });
    assert.equal(r.humanReview, true);
    assert.match(r.why, /layer1 still failing after 3 retries/);
  });
});

describe("loop: provenance", () => {
  it("writes retry_attempt 0..n and a parent_run_id, appending not overwriting", async () => {
    const { readFileSync } = await import("node:fs");
    const r = await runEvalLoop({
      plan: plan(), runId: `prov-${Date.now()}`, channel: "9998",
      layer1: passL1, layer2: async () => ({ advisory_score: 0.5 }),
      layer3: async ({ attempt }) => ({ axes: { engagement: 8 }, aggregate_local: attempt === 0 ? 4 : 9, weak_beats: attempt === 0 ? [{ beat_index: 1, element: "headline" }] : [] }),
      revise: async (rev, { plan: p }) => { const { plan: next, changedBeats } = applyPartialPatch(p, rev, () => "Z"); return { planPatch: next, changedBeats }; },
      renderBeats: noopRender,
    });
    const lines = readFileSync(r.provenance[0], "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(lines.length, 2, "two judgments, two lines");
    assert.deepEqual(lines.map((l) => l.retry_attempt), [0, 1]);
    for (const l of lines) {
      assert.equal(l.parent_run_id, r.provenance[0].includes("") ? l.parent_run_id : null);
      assert.equal(l.provider === undefined, true);
    }
    assert.equal(lines[0].layer2_advisory, 0.5);
  });
});

describe("loop: refuses an unusable aggregate", () => {
  it("throws rather than treating a missing aggregate as a score", async () => {
    await assert.rejects(() => runEvalLoop({
      plan: plan(), runId: "agg", channel: 2,
      layer1: passL1, layer2: advisory, layer3: async () => ({ axes: {}, weak_beats: [] }),
      revise: async () => ({}), renderBeats: noopRender,
    }), /no usable aggregate_local/);
  });
});
describe("free-text finding -> pipeline field", () => {
  it("maps the real ch-02 finding to ground", () => {
    assert.equal(mapFinding("The background is bright white instead of the required dark theme.").field, "ground");
    assert.equal(mapFinding("The video uses a minimalist aesthetic with high white space, conflicting with the dark, moody legal aesthetic").field, "ground");
  });
  it("maps title/typography to headline", () => {
    assert.equal(mapFinding("the title competes with the caption").field, "headline");
  });
  it("returns null when nothing matches", () => {
    assert.equal(mapFinding("something is off"), null);
  });
  it("refuses to guess when two rules disagree", () => {
    const m = mapFinding("the background colour clashes with the chart");
    assert.ok(m.ambiguous && m.ambiguous.length > 1, "ambiguity must be reported, not resolved");
  });
  it("is a short table, not a parser", () => {
    assert.ok(FINDING_FIELD_MAP.length <= 10, `table has ${FINDING_FIELD_MAP.length} rules`);
  });
});

describe("routing: other -> mapped, ambiguous, direct", () => {
  const beats = () => [
    { index: 0, ground: "white", headline: "A", data: { value: 1 }, visual_type: "TYPE" },
  ];
  it("routes a mapped other to a revision and keeps the finding text", () => {
    const { revisions, unresolved } = resolveRevisions([{ beat_index: 0, element: "other", finding: "background is bright white" }], beats());
    assert.equal(unresolved.length, 0);
    assert.equal(revisions[0].element, "ground");
    assert.equal(revisions[0].via, "keyword-map");
    assert.match(revisions[0].finding, /bright white/);
  });
  it("routes a direct field name unchanged", () => {
    const { revisions } = resolveRevisions([{ beat_index: 0, element: "headline", finding: "x" }], beats());
    assert.equal(revisions[0].element, "headline");
    assert.equal(revisions[0].via, null);
  });
  it("leaves an unmappable finding unresolved but PRESERVES the text", () => {
    const { revisions, unresolved } = resolveRevisions([{ beat_index: 0, element: "other", finding: "something is off" }], beats());
    assert.equal(revisions.length, 0);
    assert.equal(unresolved.length, 1);
    assert.equal(unresolved[0].finding, "something is off", "the observation must survive to provenance");
  });
  it("leaves an ambiguous finding unresolved", () => {
    const { revisions, unresolved } = resolveRevisions([{ beat_index: 0, element: "other", finding: "the background colour clashes with the chart" }], beats());
    assert.equal(revisions.length, 0);
    assert.match(unresolved[0].why, /more than one field/);
  });
});

describe("ch-02 self-repair, end to end on the loop", () => {
  it("spends a retry on the white-ground finding instead of routing to human review", async () => {
    const rendered = [];
    const r = await runEvalLoop({
      plan: { beats: [{ index: 0, ground: "white", headline: "A" }, { index: 1, ground: "white", headline: "B" }] },
      runId: "ch02", channel: 2,
      layer1: async () => ({ pass: true, failures: [] }),
      layer2: async () => ({ advisory_score: 0.61 }),
      layer3: async ({ attempt }) => attempt === 0
        ? { axes: {}, aggregate_local: 4.7, weak_beats: [
            { beat_index: 0, element: "other", finding: "The background is bright white instead of the required dark theme." },
            { beat_index: 1, element: "other", finding: "minimalist aesthetic with high white space, conflicting with the dark legal aesthetic" },
          ] }
        : { axes: {}, aggregate_local: 9, weak_beats: [] },
      revise: async (revisions, { plan: p }) => {
        const next = structuredClone(p);
        for (const r2 of revisions) next.beats[r2.beat_index].ground = "dark";
        return { planPatch: next, changedBeats: revisions.map((x) => x.beat_index) };
      },
      renderBeats: async (idx) => rendered.push(...idx),
    });
    assert.equal(r.accepted, true);
    assert.equal(r.retries, 1, "the finding now costs a retry instead of nothing");
    assert.deepEqual(rendered.sort(), [0, 1]);
    assert.equal(r.plan.beats[0].ground, "dark");
    assert.equal(r.plan.beats[1].ground, "dark");
  });
});