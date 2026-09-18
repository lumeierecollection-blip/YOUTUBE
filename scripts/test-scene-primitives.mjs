/**
 * The composable scene vocabulary: buildable by construction, occupied by
 * construction.
 *
 * This replaces the nine hardcoded scene functions that were the whole
 * visual language. Sixteen of sixteen Gemini verdicts across runs
 * 35293642808, 35317469026 and 35319923732 blamed RENDER_TECHNICAL —
 * "template monoculture... repetitive text-heavy headline slides" — and it
 * was right: nine templates that all draw text plus a shape on a flat
 * ground cannot produce a varied video however they are re-planned.
 *
 * The assertions below are pinned to frames that actually shipped.
 *
 *   node scripts/test-scene-primitives.mjs
 */

import {
  PRIMITIVES, ANCHORS, MOTIONS, ASPECT,
  isPrimitive, isMotion, primitiveNames,
  validateScene, estimateCoverage, layoutScene, objectRect, normalizeScene,
  vocabularyDigest, MIN_SCENE_COVERAGE, MAX_SCENE_COVERAGE,
  SAFE, SAFE_W, SAFE_H,
} from "../src/skills/remotion-render/visual/scene-primitives.js";

let failed = 0;
let passed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; } else { failed++; console.log(`  FAIL  ${msg}`); }
};
const section = (s) => console.log(`\n${s}`);

section("1. The void frames that actually shipped are now INVALID");
{
  // ch48 frame-00: "2030: ZERO HUMAN WORKERS" alone on black.
  const oneLine = { objects: [{ kind: "figure", label: "2030: ZERO HUMAN WORKERS" }] };
  const r1 = validateScene(oneLine);
  ok(!r1.ok, "a single text object is rejected");
  ok(r1.coverage < MIN_SCENE_COVERAGE, `its coverage (${r1.coverage}) is under the floor`);
  ok(r1.errors.some((e) => /empty-frame defect/.test(e)), "the error names the defect and how to fix it");

  // ch48 frame-01: two labels and two rules.
  const twoLabels = { objects: [
    { kind: "rule" }, { kind: "rule" },
    { kind: "bar", label: "Device Solutions" }, { kind: "bar", label: "AX/PI Robotics" },
  ] };
  ok(!validateScene(twoLabels).ok, "two labels plus two rules is rejected");

  ok(!validateScene({ objects: [] }).ok, "an empty scene is rejected");
  ok(!validateScene(null).ok, "a non-object scene is rejected");
}

section("2. Real compositions are VALID");
{
  const scenes = {
    "stack with pieces falling": { objects: [
      { kind: "field" }, { kind: "stack", count: 12, label: "Automated lines", emphasis: true },
      { kind: "block", count: 6, motion: "fall", anchor: "right" }] },
    "vessel draining beside a figure": { objects: [
      { kind: "field" }, { kind: "vessel", motion: "drain", anchor: "left", label: "Capacity" },
      { kind: "figure", label: "17.4/s", anchor: "right" }] },
    "grid with silhouettes lost": { objects: [
      { kind: "grid", label: "Workforce", motion: "fill" },
      { kind: "silhouette", count: 10, motion: "fall", anchor: "right", emphasis: true }] },
    "documents splitting with a counter": { objects: [
      { kind: "field" }, { kind: "document", count: 3, motion: "split", anchor: "left" },
      { kind: "counter", label: "3x", anchor: "right", emphasis: true }] },
  };
  for (const [name, scene] of Object.entries(scenes)) {
    const r = validateScene(scene);
    ok(r.ok, `${name} is valid (errors: ${r.errors.join("; ")})`);
    ok(r.coverage >= MIN_SCENE_COVERAGE, `${name} clears the coverage floor (${r.coverage})`);
    ok(r.coverage <= MAX_SCENE_COVERAGE, `${name} is not cluttered (${r.coverage})`);
  }
}

section("3. Unbuildable declarations are rejected with an actionable reason");
{
  const cases = [
    [{ objects: [{ kind: "cinematic_vibes" }] }, /unknown primitive/, "an invented primitive"],
    [{ objects: [{ kind: "grid", count: 5 }, { kind: "field" }] }, /not countable/, "count on a non-countable"],
    [{ objects: [{ kind: "vessel", count: 99 }, { kind: "field" }] }, /exceeds max/, "count over the max"],
    [{ objects: [{ kind: "field" }, { kind: "grid", count: 5 }] }, /not countable but count is 5/, "a count above 1 on a non-countable"],
    [{ objects: [{ kind: "field" }, { kind: "grid", anchor: "outer_space" }] }, /unknown anchor/, "an invented anchor"],
    [{ objects: [{ kind: "field" }, { kind: "grid", motion: "explode" }] }, /unknown motion/, "an invented motion"],
    [{ objects: [{ kind: "field" }, { kind: "grid", scale: 9 }] }, /scale must be/, "an out-of-range scale"],
  ];
  for (const [scene, re, label] of cases) {
    const r = validateScene(scene);
    ok(!r.ok, `${label} is rejected`);
    ok(r.errors.some((e) => re.test(e)), `${label}: the error explains what to use instead`);
  }
  // Every error names the offender, so a correction can be acted on.
  const r = validateScene({ objects: [{ kind: "nope" }] });
  ok(r.errors.some((e) => /objects\[0\]/.test(e)), "errors name the offending index");
}

section("4. Layout gives every object a NON-OVERLAPPING rect");
{
  // The first composed preview drew a grid and ten silhouettes on top of
  // each other as an unreadable blob, because anchors alone do not reserve
  // space.
  const scene = { objects: [
    { kind: "field" },
    { kind: "grid", label: "Workforce" },
    { kind: "silhouette", count: 10, anchor: "right" },
    { kind: "figure", label: "17.4/s", anchor: "bottom" },
  ] };
  const placed = layoutScene(scene.objects);
  ok(placed.length === scene.objects.length, "every object is placed");

  const overlap = (a, b) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const boxes = placed.filter((p) => p.obj.kind !== "field").map((p) => p.rect);
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      ok(!overlap(boxes[i], boxes[j]), `placed objects ${i} and ${j} do not overlap`);
    }
  }
  // The field is the ground and spans the whole safe rect.
  const field = placed.find((p) => p.obj.kind === "field");
  ok(field.rect.w === SAFE_W && field.rect.h === SAFE_H, "field spans the safe rect");

  // Nothing may be placed outside the safe area — Shorts UI covers it.
  for (const { obj, rect } of placed) {
    ok(rect.x >= SAFE.left - 0.5 && rect.x + rect.w <= SAFE.right + 0.5,
      `${obj.kind} stays inside the horizontal safe bounds`);
    ok(rect.y >= SAFE.top - 0.5 && rect.y + rect.h <= SAFE.bottom + 0.5,
      `${obj.kind} stays inside the vertical safe bounds`);
  }
  // Declaration order is draw order, so a field declared first stays behind.
  ok(placed[0].obj.kind === "field", "declaration order is preserved for z-order");
}

section("5. Coverage is monotonic and bounded");
{
  const cov = (objs) => estimateCoverage(objs);
  ok(cov([{ kind: "block" }]) < cov([{ kind: "block", count: 20 }]),
    "more of a countable primitive covers more");
  ok(cov([{ kind: "figure" }]) < cov([{ kind: "grid" }]),
    "a grid covers more than a lone figure");
  ok(cov([{ kind: "grid", scale: 0.3 }]) < cov([{ kind: "grid", scale: 1.8 }]),
    "scale affects coverage");
  ok(cov([]) === 0, "nothing covers nothing");
  const huge = cov(Array(12).fill({ kind: "grid" }));
  ok(huge <= 1, `coverage never exceeds 1 (got ${huge})`);
}

section("6. The vocabulary is internally consistent");
{
  for (const [kind, spec] of Object.entries(PRIMITIVES)) {
    ok(typeof spec.area === "number" && spec.area > 0 && spec.area <= 1, `${kind}: area is a sane fraction`);
    ok(typeof spec.note === "string" && spec.note.length > 8, `${kind}: has a description for the prompt`);
    ok(ASPECT[kind] > 0, `${kind}: declares an aspect ratio for layout`);
    if (spec.countable) ok(Number.isInteger(spec.maxCount) && spec.maxCount > 1, `${kind}: countable declares maxCount`);
    ok(isPrimitive(kind), `${kind}: recognised by isPrimitive`);
  }
  for (const m of MOTIONS) ok(isMotion(m), `motion ${m} is recognised`);
  ok(!isPrimitive("nope") && !isMotion("nope"), "unknown names are not recognised");
  ok(Object.keys(ANCHORS).length >= 8, "there are enough anchors to compose with");

  // The prompt digest must be generated, never hand-maintained — three
  // conflicting word budgets in three files is what hand-maintenance costs.
  const digest = vocabularyDigest();
  for (const kind of primitiveNames()) ok(digest.includes(kind), `digest advertises ${kind}`);
  for (const m of MOTIONS) ok(digest.includes(m), `digest advertises motion ${m}`);
  ok(digest.includes(String((MIN_SCENE_COVERAGE * 100).toFixed(0))), "digest states the coverage floor");
}

section("7. Harmless redundancy is a WARNING, never a rejection");
{
  // Run 35356611503 rejected 0/6 beats in the first CI test of this path,
  // and every rejection was cosmetic: the prompt's JSON example showed
  // every field on every object, so the model sent count:1 and a label on
  // `field`. Neither changes what is drawn. A contract that fails on a
  // harmless extra key is too brittle to survive a model paraphrasing it.
  const realWorld = [
    ["count:1 + label on field", { objects: [
      { kind: "field", count: 1, label: "Ground" },
      { kind: "stack", count: 10, label: "Courts", emphasis: true }] }],
    ["count:1 on grid", { objects: [{ kind: "field" }, { kind: "grid", count: 1, label: "Workforce" }] }],
    ["count:1 on counter", { objects: [{ kind: "field" }, { kind: "grid" }, { kind: "counter", count: 1, label: "3x" }] }],
    ["label on rule", { objects: [{ kind: "field" }, { kind: "grid" }, { kind: "rule", label: "divider" }] }],
  ];
  for (const [name, scene] of realWorld) {
    const r = validateScene(scene);
    ok(r.ok, `${name} is accepted (errors: ${r.errors.join("; ")})`);
    ok(r.warnings.length > 0, `${name} still reports what was dropped`);
  }

  // Normalisation must actually remove the field, not just tolerate it.
  const { scene: norm, dropped } = normalizeScene({ objects: [{ kind: "field", count: 1, label: "x" }] });
  ok(norm.objects[0].count === undefined, "redundant count is stripped");
  ok(norm.objects[0].label === undefined, "undrawable label is stripped");
  ok(dropped.length === 2, "both drops are reported");
  // The input must not be mutated — the planner keeps its own copy.
  const input = { objects: [{ kind: "field", count: 1 }] };
  normalizeScene(input);
  ok(input.objects[0].count === 1, "normalizeScene does not mutate its input");

  // And the strictness that MATTERS survives: a count above 1 means the
  // model wanted several and would get one.
  ok(!validateScene({ objects: [{ kind: "field" }, { kind: "grid", count: 5 }] }).ok,
    "count:5 on a non-countable is still an error");
  ok(!validateScene({ objects: [{ kind: "figure", label: "one line" }] }).ok,
    "the coverage floor still rejects a text-only beat");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
