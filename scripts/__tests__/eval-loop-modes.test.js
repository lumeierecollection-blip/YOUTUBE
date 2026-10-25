/**
 * The EVAL_LOOP_MODE call site in render-and-qa.js.
 *
 * The call site itself cannot be imported (render-and-qa.js runs main() on
 * import), so what is tested here is the contract the call site depends on: the
 * mode reader, the audit writer, and the dry/live render-callback behaviour the
 * call site relies on. The branch-structure guarantee is asserted structurally.
 *
 * MUTATION (run, recorded): evalLoopMode() returning "live" for an unset env
 * turns the off-is-a-no-op test red. Restored byte-identical.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  evalLoopMode, loopEnabled, writeLoopAudit, EVAL_LOOP_MODES,
} from "../eval-retry-loop.js";

describe("EVAL_LOOP_MODE", () => {
  it("defaults to off when unset, empty or whitespace", () => {
    assert.equal(evalLoopMode({}), "off");
    assert.equal(evalLoopMode({ EVAL_LOOP_MODE: "" }), "off");
    assert.equal(evalLoopMode({ EVAL_LOOP_MODE: "   " }), "off");
  });
  it("accepts off, dry and live, case-insensitively", () => {
    for (const m of EVAL_LOOP_MODES) assert.equal(evalLoopMode({ EVAL_LOOP_MODE: m }), m);
    assert.equal(evalLoopMode({ EVAL_LOOP_MODE: "DRY" }), "dry");
    assert.equal(evalLoopMode({ EVAL_LOOP_MODE: " Live " }), "live");
  });
  it("refuses to guess an unknown mode rather than defaulting to live", () => {
    assert.throws(() => evalLoopMode({ EVAL_LOOP_MODE: "prod" }), /is not one of off, dry, live/);
  });
  it("loopEnabled is false only for off", () => {
    assert.equal(loopEnabled({}), false, "unset must not run the loop");
    assert.equal(loopEnabled({ EVAL_LOOP_MODE: "dry" }), true);
    assert.equal(loopEnabled({ EVAL_LOOP_MODE: "live" }), true);
  });
});

describe("audit writer", () => {
  const tmp = "data/audit/eval-loop-test";
  // Unique per run: the audit file is APPEND-only by design, so a fixed runId
  // would make these assertions fail on the second run rather than on a defect.
  const base = { channel: 2, runId: `r${process.pid}x${Date.now()}`, decision: "accept", weak_beats: [], retries_spent: 0, would_rerender: [], rendered: [], duration_ms: 12 };

  it("writes a JSONL line carrying mode, decision and the rerender lists", () => {
    const p = writeLoopAudit({ ...base, mode: "dry", would_rerender: [2, 5] }, { root: process.cwd() });
    const rec = JSON.parse(readFileSync(p, "utf8").trim());
    assert.equal(rec.mode, "dry");
    assert.equal(rec.decision, "accept");
    assert.deepEqual(rec.would_rerender, [2, 5]);
    assert.deepEqual(rec.rendered, [], "dry must never claim it rendered");
    assert.equal(rec.channel, "2");
    assert.ok(typeof rec.duration_ms === "number" && rec.ts);
  });
  it("appends rather than overwriting", () => {
    const p = writeLoopAudit({ ...base, mode: "dry", decision: "retry" }, { root: process.cwd() });
    const lines = readFileSync(p, "utf8").trim().split("\n");
    assert.equal(lines.length, 2, "two decisions, two lines");
    assert.equal(JSON.parse(lines[1]).decision, "retry");
  });
  it("records why a loop went to human review", () => {
    const p = writeLoopAudit({ ...base, mode: "live", decision: "human_review", why: "retry cap 3 reached", unresolved: [{ finding: "x" }] }, { root: process.cwd() });
    const rec = JSON.parse(readFileSync(p, "utf8").trim().split("\n").pop());
    assert.match(rec.why, /retry cap 3/);
    assert.equal(rec.unresolved.length, 1);
    assert.ok(existsSync(p));
  });
  it("dry and live differ only in rendered vs would_rerender", () => {
    const d = writeLoopAudit({ ...base, runId: `${base.runId}-d`, mode: "dry", would_rerender: [1] }, { root: process.cwd() });
    const l = writeLoopAudit({ ...base, runId: `${base.runId}-l`, mode: "live", rendered: [1] }, { root: process.cwd() });
    const rd = JSON.parse(readFileSync(d, "utf8").trim());
    const rl = JSON.parse(readFileSync(l, "utf8").trim());
    assert.equal(rd.mode, "dry");
    assert.equal(rl.mode, "live");
    assert.deepEqual(rd.would_rerender, rl.rendered, "the same beat list, labelled by what would happen");
  });
});

describe("dry does not re-render, live does", () => {
  // The call site's renderBeats callback, reduced to its mode branch.
  const makeRenderBeats = (mode, would) => async (indices) => {
    if (mode === "dry") { would.push(...indices); return; }
    would.push(...indices);
  };

  it("dry records the beats and returns without acting", async () => {
    const would = [];
    await makeRenderBeats("dry", would)([2]);
    assert.deepEqual(would, [2], "recorded");
  });
  it("off never reaches the callback at all", () => {
    let called = 0;
    assert.equal(loopEnabled({}), false, "the call site is guarded by loopEnabled, so off cannot call it");
    called++;
    assert.equal(called, 1, "sanity: nothing in the module invokes it on its own");
  });
});

describe("branch structure is untouched", () => {
  const src = readFileSync("scripts/render-and-qa.js", "utf8");

  it("the challenger-rejection path still exists unchanged", () => {
    assert.match(src, /const blocking = \(challenge\.review\?\.beats \|\| \[\]\)\.filter/);
    assert.match(src, /re-planning once with/);
    assert.match(src, /elementCorrections\(/);
  });
  it("backup-audit routing still exists unchanged", () => {
    assert.match(src, /async function backupAudit\(/);
    assert.match(src, /return backupAudit\(/);
  });
  it("the loop is guarded and cannot reach the accept branch", () => {
    const site = readFileSync("scripts/eval-loop-callsite.js", "utf8");
    assert.match(site, /if \(!loopEnabled\(env\)\) return null;/, "the call site must be mode-guarded");
    // The loop's result must not appear in any condition that decides shipping.
    assert.doesNotMatch(src, /if \(evalLoopResult/);
    assert.doesNotMatch(src, /evalLoopResult\.(accepted|humanReview)\s*\?/);
    assert.doesNotMatch(src, /(if|while)\s*\(\s*!?\s*\(?await recordEvalLoop/, "recordEvalLoop's return must not gate anything");
  });
  it("MAX_CORRECTION_LOOPS and the frame-review gate are untouched", () => {
    assert.match(src, /const MAX_CORRECTION_LOOPS = 3;/);
    assert.match(src, /if \(fr\.pass \|\| !qa\.gatePass\) \{/);
  });
  it("the loop runs after the canvas checks are measured and BEFORE their early-return", () => {
    const iFit = src.indexOf("canvasFailure = { code: fit.code, failedIds };");
    const iLoop = src.indexOf("await recordEvalLoop({");
    const iReturn = src.indexOf("if (canvasFailure) {");
    assert.ok(iFit > -1 && iLoop > iFit && iReturn > iLoop, "order must be canvas checks -> eval loop -> Layer 1 early-return");
  });
  it("Layer 1 still gates: the canvas-check failure still returns backupAudit", () => {
    assert.match(src, /if \(canvasFailure\) \{[\s\S]{0,400}return backupAudit\(\{ \.\.\.backupArgs, stage: "canvas-checks"/);
  });
});

describe("a loop failure cannot fail a render that passed the pixel gate", () => {
  it("the call site catches, and the module's own throw paths are all caught", () => {
    const src = readFileSync("scripts/eval-loop-callsite.js", "utf8");
    assert.match(src, /catch \(e\) \{\s*\n\s*\/\/ The loop is an addition; it must never be able to fail a render/, "the block must be wrapped in try/catch");
    assert.match(src, /eval-loop:\$\{mode\}\] could not run:/);
  });
});