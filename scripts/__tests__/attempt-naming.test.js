// Attempt/resume numbering and output naming for render-and-qa.js. Pure functions; nothing is rendered.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basePlanPath, enforcedPlanPathFor, revisedPlanPathFor, correctionsPathFor, outputPathFor } from "../lib/attempt-naming.mjs";

const PLAN = "data/plans/ch-1/topic-visual-plan.json";

test("enforced plan name carries the attempt number", () => {
  assert.equal(enforcedPlanPathFor(PLAN, 1), "data/plans/ch-1/topic-visual-plan-enforced-attempt1.json");
});

test("attempt 2 enforced on top of attempt 1's plan does not stack suffixes", () => {
  const a1 = enforcedPlanPathFor(PLAN, 1);
  assert.equal(enforcedPlanPathFor(a1, 2), "data/plans/ch-1/topic-visual-plan-enforced-attempt2.json");
  assert.equal(enforcedPlanPathFor(enforcedPlanPathFor(a1, 2), 3), "data/plans/ch-1/topic-visual-plan-enforced-attempt3.json");
});

test("revised plan names are flat too and mixed chains collapse to the original plan", () => {
  const r = revisedPlanPathFor(enforcedPlanPathFor(PLAN, 1), 2, 1);
  assert.equal(r, "data/plans/ch-1/topic-visual-plan-revised-a2-1.json");
  assert.equal(basePlanPath(r), PLAN);
  assert.equal(basePlanPath(PLAN), PLAN, "an original plan is left alone");
});

test("the suffix is only stripped at the end of a .json name", () => {
  assert.equal(basePlanPath("a/b-enforced-attempt1-notes.json"), "a/b-enforced-attempt1-notes.json");
});

test("every attempt of a run gets a distinct corrections file, and the naming-check file is distinct from the general one", () => {
  const names = new Set();
  for (const a of [1, 2, 3]) for (const kind of ["", "naming"]) names.add(correctionsPathFor("/r", "99", "/x/topic-script.json", a, kind).replace(/\\/g, "/"));
  assert.equal(names.size, 6);
  assert.ok(names.has("/r/data/audit/corrections/99/topic-script-attempt2.json"));
  assert.ok(names.has("/r/data/audit/corrections/99/topic-script-attempt3-naming.json"));
});

test("corrections files of different runs never collide", () => {
  assert.notEqual(correctionsPathFor("/r", "1", "s.json", 1), correctionsPathFor("/r", "2", "s.json", 1));
});

test("the output path is the same for every attempt on one day (the superseded MP4 is removed, not queued)", () => {
  const d = new Date("2026-10-24T08:15:00Z");
  const p = (att) => outputPathFor("/r", "ch-1", `/x/topic-script.json`, "short", d);
  assert.equal(p(1), p(3));
  assert.equal(p(1).replace(/\\/g, "/"), "/r/data/renders/ch-1/topic-short-2026-10-24.mp4");
});

test("known limit: a run that crosses 00:00 UTC changes the output name between attempts", () => {
  const before = outputPathFor("/r", "ch-1", "t-script.json", "short", new Date("2026-10-24T23:59:59Z"));
  const after = outputPathFor("/r", "ch-1", "t-script.json", "short", new Date("2026-10-25T00:00:01Z"));
  assert.notEqual(before, after);
});

test("render-and-qa.js uses the helpers and no longer builds these names inline", () => {
  const src = readFileSync(new URL("../render-and-qa.js", import.meta.url), "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  assert.match(src, /attempt-naming\.mjs/);
  assert.doesNotMatch(src, /-enforced-attempt\$\{/);
  assert.doesNotMatch(src, /-revised-a\$\{/);
  assert.doesNotMatch(src, /-attempt\$\{attempt\}(-naming)?\.json/);
});
