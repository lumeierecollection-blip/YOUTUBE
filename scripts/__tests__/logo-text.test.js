import test from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";
const { logoTextContradicts, normalizer } = createRequire(import.meta.url)("../verify-image.cjs");

test("a court seal naming another district is refused (board 39031532519 ch-26)", () => {
  const why = logoTextContradicts("UNITED STATES DISTRICT COURT DISTRICT OF COLUMBIA", "U.S. District Court for the Southern District of Florida");
  assert.match(why, /names none of/);
});

test("the right seal, an acronym emblem, a wordmark and a text-less logo pass", () => {
  assert.strictEqual(logoTextContradicts("UNITED STATES DISTRICT COURT SOUTHERN DISTRICT OF FLORIDA", "U.S. District Court for the Southern District of Florida"), null);
  assert.strictEqual(logoTextContradicts("T.P.L.F", "Tigray People's Liberation Front"), null);
  assert.strictEqual(logoTextContradicts("VERITAS HARVARD", "Harvard Business School"), null);
  assert.strictEqual(logoTextContradicts("", "Eurojust"), null);
  assert.strictEqual(logoTextContradicts("UNITED STATES DISTRICT COURT", "U.S. District Court for the Southern District of Florida"), null);
});

test("the logo answer keeps the printed text", () => {
  const v = normalizer(false, true)({ text: "DISTRICT OF COLUMBIA", recognized: "US District Court", verdict: "MATCH" });
  assert.strictEqual(v.text, "DISTRICT OF COLUMBIA");
});
