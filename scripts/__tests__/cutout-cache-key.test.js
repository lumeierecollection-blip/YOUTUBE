import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { cutoutCacheKey, CUTOUT_VERIFIER_VERSION } = createRequire(import.meta.url)("../verify-cutout-image.cjs");

const A = Buffer.from("image-a-jpeg-bytes"), B = Buffer.from("image-b-jpeg-bytes");
const MODELS = ["groq-x", "gemini-3.5-flash-lite"];

test("two different images produce different keys", () => {
  assert.notEqual(cutoutCacheKey(A, "gavel"), cutoutCacheKey(B, "gavel"));
});

test("the same image with a bumped verifier version produces a different key (a fresh verification)", () => {
  const now = cutoutCacheKey(A, "gavel", CUTOUT_VERIFIER_VERSION, MODELS);
  const bumped = cutoutCacheKey(A, "gavel", CUTOUT_VERIFIER_VERSION + ".next", MODELS);
  assert.notEqual(now, bumped);
});

test("the same image with a different model in the chain, or a different concept name, is a fresh key", () => {
  const base = cutoutCacheKey(A, "gavel", CUTOUT_VERIFIER_VERSION, MODELS);
  assert.notEqual(base, cutoutCacheKey(A, "gavel", CUTOUT_VERIFIER_VERSION, ["other-model", "gemini-3.5-flash-lite"]));
  assert.notEqual(base, cutoutCacheKey(A, "padlock", CUTOUT_VERIFIER_VERSION, MODELS));
});

test("the same inputs always give the same key (so a stored verdict can be reused)", () => {
  assert.equal(cutoutCacheKey(A, "gavel", CUTOUT_VERIFIER_VERSION, MODELS), cutoutCacheKey(Buffer.from("image-a-jpeg-bytes"), "gavel", CUTOUT_VERIFIER_VERSION, MODELS));
});
