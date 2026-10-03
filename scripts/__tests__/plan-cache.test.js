import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planCacheKey, getCachedPlan, setCachedPlan } from "../plan-cache.js";

describe("plan-cache", () => {
  it("generates deterministic cache keys", () => {
    const key1 = planCacheKey(null, null, "ch1", { style: "minimal", colors: { primary: "#000" }, font: "Inter", bg_mode: "black", asset_treatment: "color" });
    const key2 = planCacheKey(null, null, "ch1", { style: "minimal", colors: { primary: "#000" }, font: "Inter", bg_mode: "black", asset_treatment: "color" });
    assert.equal(key1, key2, "Same inputs should produce same key");
  });

  it("different channel configs produce different keys", () => {
    const key1 = planCacheKey(null, null, "ch1", { style: "minimal", colors: { primary: "#000" }, font: "Inter", bg_mode: "black", asset_treatment: "color" });
    const key2 = planCacheKey(null, null, "ch1", { style: "cinematic-documentary", colors: { primary: "#FFF" }, font: "Space Grotesk", bg_mode: "white", asset_treatment: "bw" });
    assert.notEqual(key1, key2, "Different configs should produce different keys");
  });

  it("returns null for cache miss", () => {
    const result = getCachedPlan("nonexistent-key-12345");
    assert.equal(result, null, "Cache miss should return null");
  });

  it("caches and retrieves plans", () => {
    const key = "test-plan-key-" + Date.now();
    const plan = { beats: [{ index: 0, visual_headline: "test" }] };
    setCachedPlan(key, plan);
    const retrieved = getCachedPlan(key);
    assert.deepEqual(retrieved, plan, "Cached plan should match original");
  });
});