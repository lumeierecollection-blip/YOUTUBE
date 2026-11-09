import assert from "node:assert/strict";
import { test } from "node:test";
import { contract, unknownKeywords, validate } from "./schema.mjs";

test("every module imports", async () => {
  for (const m of ["text", "schema", "llm", "channels", "prompt", "sources", "claims", "blueprint", "duration", "hooks", "writer", "continuity", "critic", "traceability", "engine", "legacy"]) await import(`./${m}.mjs`);
});

test("the contracts use only JSON-Schema keywords the engine's validator implements", () => {
  for (const n of ["claim-record", "critique", "scene-plan", "script-package", "story-blueprint"]) assert.deepEqual(unknownKeywords(contract(n)), [], n);
});

test("the validator rejects what the contracts forbid", () => {
  assert.ok(validate("claim-record", { claim_id: "c1" }).length >= 5);
  assert.ok(validate("critique", { reviewer: "x", verdict: "maybe", scores: {}, unexplained_claims: [], contradictions: [], required_corrections: [], findings: [] }).some((e) => /verdict/.test(e)));
  assert.ok(validate("story-blueprint", { central_question: "q" }).length > 5);
  const ok = { claim_id: "c1", claim: "x", source_id: "s", source_url: "u", excerpt: "e", confidence: "high", editorial_status: "established_fact" };
  assert.deepEqual(validate("claim-record", ok), []);
  assert.ok(validate("claim-record", { ...ok, confidence: "sure" }).length === 1);
});
