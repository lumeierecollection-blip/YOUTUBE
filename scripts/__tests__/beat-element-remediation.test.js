import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  remediateBlockingBeats,
  blockingBeats,
  buildElementPrompt,
  parseAnswer,
  validate,
  isMainModule,
  ADDRESSABLE_ELEMENTS,
} from "../beat-element-remediation.js";

// A four-beat plan in the shape the challenger reviews: full-canvas beats, each
// with the fields a beat actually renders from.
const BEATS = [
  { visual_type: "TYPE", kind: "TYPE", headline: "1.5 MILLION ARRESTS", lead_in: "In 2019" },
  { visual_type: "COUNTER", kind: "EDITORIAL", headline: "160,000 JOBS", data: { value: 160000, label: "jobs" } },
  { visual_type: "TYPE", kind: "TYPE", headline: "AND START BECOMING A MACHINE" },
  { visual_type: "MAP", kind: "EDITORIAL", headline: "WHERE THE JOBS WENT", data: { place: "US" } },
];
const SENTENCES = [
  "The justice system made 1.5 million arrests that year.",
  "It also created 160,000 jobs.",
  "By 2030 the machines ask whether humans start becoming a machine.",
  "Here is where the jobs went.",
];

// Beat 1 is rejected for a reason that lives in `data.value`, not in its
// headline — the case a per-beat generic instruction cannot express.
const REVIEW = {
  beats: [
    { beat_index: 0, verdict: "OK", reason: "shows the figure" },
    { beat_index: 1, verdict: "MISMATCH", reason: "the number contradicts the sentence", sentence: SENTENCES[1] },
    { beat_index: 2, verdict: "WEAK", reason: "generic" },
    { beat_index: 3, verdict: "OK", reason: "the map matches" },
  ],
};

describe("blockingBeats", () => {
  it("treats only MISMATCH and CONTRADICTION as blocking", () => {
    assert.deepEqual(blockingBeats(REVIEW).map((b) => b.beat_index), [1]);
  });

  it("returns nothing for a clean review", () => {
    assert.deepEqual(blockingBeats({ beats: [{ beat_index: 0, verdict: "OK" }] }), []);
  });
});

describe("per-element remediation", () => {
  it("asks once per blocking beat, and never about a beat that passed", async () => {
    const asked = [];
    await remediateBlockingBeats({
      beats: BEATS, sentences: SENTENCES, review: REVIEW,
      ask: async (prompt) => { asked.push(prompt); return { content: '{"element":"data","replacement":"\\u00a0160,000 jobs","reason":"matches the sentence"}' }; },
    });
    assert.equal(asked.length, 1, "one sub-task per blocking beat");
    assert.match(asked[0], /Beat 1 was rejected as MISMATCH/);
    assert.doesNotMatch(asked[0], /Beat 0 was rejected/);
    assert.doesNotMatch(asked[0], /Beat 3 was rejected/);
  });

  it("names the element the sub-task chose, in the shape the re-planner reads", async () => {
    const { corrections, unresolved } = await remediateBlockingBeats({
      beats: BEATS, sentences: SENTENCES, review: REVIEW,
      ask: async () => ({ element: "data", replacement: "\u00a0160,000 jobs", reason: "matches the sentence" }),
    });
    assert.equal(unresolved.length, 0);
    assert.equal(corrections.length, 1);
    const c = corrections[0];
    assert.equal(c.beat, 1);
    assert.equal(c.element, "data");
    // gemini-visual-plan.js:668 renders `${c.scene || c.beat}: ${c.problem} -> Fix: ${c.fix}`.
    assert.ok(c.beat !== undefined && c.problem && c.fix, "correction must carry beat/problem/fix");
    assert.match(c.problem, /MISMATCH on data/);
  });

  it("spends no call at all when nothing was blocked", async () => {
    let calls = 0;
    const { corrections } = await remediateBlockingBeats({
      beats: BEATS, sentences: SENTENCES,
      review: { beats: [{ beat_index: 0, verdict: "OK" }, { beat_index: 2, verdict: "WEAK" }] },
      ask: async () => { calls++; return { content: "{}" }; },
    });
    assert.equal(calls, 0);
    assert.equal(corrections.length, 0);
  });

  // The failure enforceAdjustments() was written to catch: a correction that
  // names a field no beat renders from lets the re-planner answer while
  // producing a byte-identical video.
  it("rejects an element a beat does not render from, and does not fall back to approving", async () => {
    const { corrections, unresolved } = await remediateBlockingBeats({
      beats: BEATS, sentences: SENTENCES, review: REVIEW,
      ask: async () => ({ content: '{"element":"camera_tilt","replacement":"low angle","reason":"better"}' }),
    });
    assert.equal(corrections.length, 0);
    assert.equal(unresolved.length, 1);
    assert.match(unresolved[0].why, /not one a beat renders from/);
  });

  it("rejects an addressable element that is not on this beat", async () => {
    const { corrections, unresolved } = await remediateBlockingBeats({
      beats: BEATS, sentences: SENTENCES, review: REVIEW,
      ask: async () => ({ content: '{"element":"motion_tier","replacement":"fast","reason":"snappier"}' }),
    });
    assert.equal(corrections.length, 0);
    assert.match(unresolved[0].why, /not on this beat/);
  });

  it("records a sub-task that could not name a field, rather than inventing one", async () => {
    const { corrections, unresolved } = await remediateBlockingBeats({
      beats: BEATS, sentences: SENTENCES, review: REVIEW,
      ask: async () => ({ content: '{"element":null,"replacement":"","reason":"cannot tell"}' }),
    });
    assert.equal(corrections.length, 0);
    assert.equal(unresolved[0].why, "no element named");
  });

  it("records a sub-task that threw, rather than reading silence as agreement", async () => {
    const { corrections, unresolved } = await remediateBlockingBeats({
      beats: BEATS, sentences: SENTENCES, review: REVIEW,
      ask: async () => { throw new Error("quota_exhausted"); },
    });
    assert.equal(corrections.length, 0);
    assert.match(unresolved[0].why, /sub-task failed: quota_exhausted/);
  });

  it("records an unparseable answer", async () => {
    const { corrections, unresolved } = await remediateBlockingBeats({
      beats: BEATS, sentences: SENTENCES, review: REVIEW,
      ask: async () => ({ content: "I think the headline is too loud." }),
    });
    assert.equal(corrections.length, 0);
    assert.equal(unresolved[0].why, "unparseable answer");
  });

  it("reports a verdict naming a beat the plan does not have", async () => {
    const { corrections, unresolved } = await remediateBlockingBeats({
      beats: BEATS, sentences: SENTENCES,
      review: { beats: [{ beat_index: 99, verdict: "CONTRADICTION", reason: "x" }] },
      ask: async () => ({ content: '{"element":"headline","replacement":"y"}' }),
    });
    assert.equal(corrections.length, 0);
    assert.match(unresolved[0].why, /does not have/);
  });

  it("handles several blocking beats independently", async () => {
    const review = {
      beats: [
        { beat_index: 1, verdict: "MISMATCH", reason: "wrong number" },
        { beat_index: 3, verdict: "CONTRADICTION", reason: "wrong place" },
      ],
    };
    const seen = [];
    const { corrections } = await remediateBlockingBeats({
      beats: BEATS, sentences: SENTENCES, review,
      ask: async (p) => {
        seen.push(p);
        const isMap = /Beat 3 was rejected/.test(p);
        return { content: isMap
          ? '{"element":"data","replacement":"\\u00a7the EU","reason":"sentence says the EU"}'
          : '{"element":"data","replacement":"\\u00a0160,000 jobs","reason":"matches the sentence"}' };
      },
    });
    assert.equal(seen.length, 2);
    assert.deepEqual(corrections.map((c) => c.beat).sort(), [1, 3]);
    assert.deepEqual(corrections.map((c) => c.element), ["data", "data"]);
  });
});

describe("the sub-task prompt", () => {
  it("separates role, objective, constraints and input into labelled blocks", () => {
    const prompt = buildElementPrompt({ ...BEATS[1], __index: 1, __verdict: "MISMATCH", __reason: "r" }, SENTENCES[1], ["data", "headline"], "MISMATCH", "r");
    for (const label of ["ROLE", "OBJECTIVE", "CONSTRAINTS", "INPUT", "RESPONSE"]) {
      assert.ok(prompt.includes(label), `missing ${label} block`);
    }
    assert.ok(prompt.indexOf("ROLE") < prompt.indexOf("OBJECTIVE"), "ROLE must come before OBJECTIVE");
    assert.ok(prompt.indexOf("OBJECTIVE") < prompt.indexOf("CONSTRAINTS"), "OBJECTIVE must come before CONSTRAINTS");
    assert.ok(prompt.indexOf("CONSTRAINTS") < prompt.indexOf("INPUT"), "CONSTRAINTS must come before INPUT");
  });

  // Zero-shot: a small model copies data points out of worked examples and into
  // its answer (docs/V2-NARRATIVE-SCRIPT-GREEN.md, qwen2.5:3b repeating the
  // prompt's example sentence). Exactly one element key may appear — the
  // response template — so an example cannot be added back unnoticed.
  it("carries no worked example", () => {
    const prompt = buildElementPrompt({ ...BEATS[1], __index: 1, __verdict: "MISMATCH", __reason: "r" }, SENTENCES[1], ["data"], "MISMATCH", "r");
    assert.equal((prompt.match(/"element"/g) || []).length, 1);
    assert.doesNotMatch(prompt, /Example:/i);
    assert.doesNotMatch(prompt, /e\.g\./i);
  });

  it("shows the current value of every addressable element it was given", () => {
    const prompt = buildElementPrompt({ ...BEATS[1], __index: 1, __verdict: "MISMATCH", __reason: "r" }, SENTENCES[1], ["data", "headline"], "MISMATCH", "r");
    assert.match(prompt, /data = \{"value":160000,"label":"jobs"\}/);
    assert.match(prompt, /headline = 160,000 JOBS/);
  });

  it("does not offer an element the caller did not pass", () => {
    const prompt = buildElementPrompt({ ...BEATS[1], __index: 1, __verdict: "MISMATCH", __reason: "r" }, SENTENCES[1], ["data"], "MISMATCH", "r");
    assert.match(prompt, /available elements: data/);
    assert.doesNotMatch(prompt, /motion_tier =/);
  });
});

describe("validate", () => {
  const beat = { ...BEATS[1], __index: 1, __verdict: "MISMATCH", __reason: "r" };

  it("accepts an addressable element present on the beat", () => {
    const out = validate(beat, { element: "headline", replacement: "  160,000 NEW JOBS  " });
    assert.equal(out.element, "headline");
    assert.equal(out.replacement, "160,000 NEW JOBS", "surrounding whitespace is trimmed");
    assert.equal(out.correction.fix.includes("headline"), true);
  });

  it("rejects an empty replacement even when the element is valid", () => {
    assert.match(validate(beat, { element: "headline", replacement: "   " }).error, /no replacement value/);
  });

  it("rejects a non-object answer", () => {
    assert.equal(validate(beat, null).error, "unparseable answer");
  });

  it("rejects an element outside the addressable set", () => {
    assert.equal(validate(beat, { element: "canvas", replacement: "x" }).error.includes("not one a beat renders from"), true);
  });
});

describe("parseAnswer", () => {
  // The shape a healthy Gemini key actually returns: gemini-client.js:240
  // documents callGemini as returning the PARSED object. Reading this as a
  // string returned null, and a live run answered, spent 326 tokens and still
  // reported "unparseable answer".
  it("accepts an already-parsed answer object", () => {
    assert.deepEqual(parseAnswer({ element: "data", replacement: "x" }), { element: "data", replacement: "x" });
    assert.deepEqual(parseAnswer({ element: null, replacement: "", reason: "no" }), { element: null, replacement: "", reason: "no" });
  });

  it("accepts a parsed object nested under content", () => {
    assert.deepEqual(parseAnswer({ content: { element: "headline", replacement: "y" } }), { element: "headline", replacement: "y" });
  });

  it("reads a JSON body from a content string", () => {
    assert.deepEqual(parseAnswer({ content: '{"element":"data","replacement":"x"}' }), { element: "data", replacement: "x" });
  });

  it("strips markdown fences", () => {
    assert.deepEqual(parseAnswer({ content: '```json\n{"element":"data","replacement":"x"}\n```' }), { element: "data", replacement: "x" });
    assert.deepEqual(parseAnswer('```\n{"element":"data","replacement":"x"}\n```'), { element: "data", replacement: "x" });
  });

  it("returns null for a provider error object, so a failure is never a proposal", () => {
    assert.equal(parseAnswer({ source: "gemini", error: "quota_exhausted", detail: "429" }), null);
    assert.equal(parseAnswer({ source: "ollama", error: "empty_answer" }), null);
  });

  it("returns null for prose", () => {
    assert.equal(parseAnswer({ content: "the headline reads badly" }), null);
    assert.equal(parseAnswer("the headline reads badly"), null);
  });

  it("returns null for nothing", () => {
    assert.equal(parseAnswer({}), null);
    assert.equal(parseAnswer(null), null);
    assert.equal(parseAnswer(undefined), null);
    assert.equal(parseAnswer({ content: "" }), null);
  });
});

describe("isMainModule", () => {
  // Regression: an unguarded process.argv[1].replace() threw on import under
  // `node -e`, while `node --test` (which always supplies argv[1]) stayed green.
  it("is false when there is no entry script", () => {
    assert.equal(isMainModule(["node"]), false);
    assert.equal(isMainModule(["node", undefined]), false);
    assert.equal(isMainModule([]), false);
    assert.equal(isMainModule(undefined), false);
  });

  it("is false for some other script, including a copy with the same name", () => {
    assert.equal(isMainModule(["node", "scripts/gemini-visual-plan.js"]), false);
    assert.equal(isMainModule(["node", "C:/somewhere/else/beat-element-remediation.js"]), false);
  });

  it("is true for this file run directly", () => {
    assert.equal(isMainModule(["node", new URL("../beat-element-remediation.js", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")]), true);
  });
});

describe("ADDRESSABLE_ELEMENTS", () => {
  // renderedAs() in render-and-qa.js:645 decides whether an applied directive
  // changes anything a beat renders from. The two lists must not drift apart.
  it("excludes the fields the planner cannot act on", () => {
    for (const excluded of ["canvas", "photo", "persists_from", "match_cut_prev"]) {
      assert.equal(ADDRESSABLE_ELEMENTS.includes(excluded), false, `${excluded} must not be addressable`);
    }
  });

  it("has no duplicates", () => {
    assert.equal(new Set(ADDRESSABLE_ELEMENTS).size, ADDRESSABLE_ELEMENTS.length);
  });
});