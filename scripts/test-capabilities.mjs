#!/usr/bin/env node
/**
 * Capability System Tests — 13 test cases from eco.txt
 *
 * Tests the capability manifest, compiler, backward compatibility,
 * and semantic fallbacks.
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Test helpers
let passed = 0;
let failed = 0;
let current = "";

function section(name) {
  current = name;
  console.log(`\n  ${name}`);
}

function ok(condition, msg) {
  if (condition) {
    passed++;
    console.log(`    ✓ ${msg}`);
  } else {
    failed++;
    console.error(`    ✗ FAIL: ${msg}`);
  }
}

function eq(actual, expected, msg) {
  const pass = actual === expected;
  if (pass) {
    passed++;
    console.log(`    ✓ ${msg}`);
  } else {
    failed++;
    console.error(`    ✗ FAIL: ${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/* ── Load modules ──────────────────────────────────────────────────── */

// Convert Windows paths to file:// URLs for ESM
const toFileUrl = (p) => `file:///${p.replace(/\\/g, "/")}`;

const { generateCapabilityManifest, capabilityDigest, validateCapabilityCombination, primitivesForCapability, motionsForPrimitive } = await import(toFileUrl(join(ROOT, "src/skills/remotion-render/visual/capability-manifest.js")));
const { compileScene, isMechanismBased, mechanismToCapability, compactCapabilityDigest } = await import(toFileUrl(join(ROOT, "src/skills/remotion-render/visual/capability-compiler.js")));
const { validateScene, PRIMITIVES, ANCHORS, MOTIONS } = await import(toFileUrl(join(ROOT, "src/skills/remotion-render/visual/scene-primitives.js")));

/* ── Test Cases ────────────────────────────────────────────────────── */

console.log("\n=== CAPABILITY SYSTEM TESTS ===\n");

// 1. Capability manifest generates from PRIMITIVES
section("1. Capability manifest generates from PRIMITIVES");
const manifest = generateCapabilityManifest();
ok(manifest.version === "1.0.0", "has version");
ok(Object.keys(manifest.primitives).length === Object.keys(PRIMITIVES).length, "covers all primitives");
ok(Object.keys(manifest.scenes).length > 0, "has scene capabilities");
ok(manifest.typography, "has typography capability");
ok(manifest.canvas.width === 1080, "has canvas width");
ok(manifest.safeArea.width > 0, "has safe area");

// 2. Capability digest is human-readable
section("2. Capability digest is human-readable");
const digest = capabilityDigest();
ok(digest.includes("## WHAT REMOTION CAN CONSTRUCT"), "has header");
ok(digest.includes("Primitive Capabilities"), "has primitives section");
ok(digest.includes("Scene Capabilities"), "has scenes section");
ok(digest.includes("Composition Rules"), "has rules section");
ok(digest.includes("block"), "mentions block primitive");
ok(digest.includes("growth"), "mentions growth capability");

// 3. Compact capability digest for prompts
section("3. Compact capability digest for prompts");
const compact = compactCapabilityDigest();
ok(compact.includes("## VISUAL CAPABILITIES"), "has header");
ok(compact.includes("growth:"), "has growth event");
ok(compact.includes("depletion:"), "has depletion event");
ok(compact.includes("comparison:"), "has comparison event");
ok(compact.includes("typographic_emphasis:"), "has typography");
ok(compact.includes("max 7 words"), "mentions word limit");

// 4. Capability combination validation
section("4. Capability combination validation");
const validCombo = validateCapabilityCombination(["growth", "field"]);
ok(validCombo.ok, "growth + field is valid");
const invalidCombo = validateCapabilityCombination(["accumulation"]);
ok(!invalidCombo.ok, "accumulation alone is invalid (requires block/stack/document/silhouette)");
ok(invalidCombo.issues.length > 0, "has issue list");

// 5. Primitives for capability lookup
section("5. Primitives for capability lookup");
const growPrims = primitivesForCapability("grow");
ok(growPrims.includes("bar"), "bar can grow");
ok(growPrims.includes("block"), "block can grow");
const drainPrims = primitivesForCapability("drain");
ok(drainPrims.includes("vessel"), "vessel can drain");
const crowdPrims = primitivesForCapability("crowd");
ok(crowdPrims.includes("silhouette"), "silhouette can crowd");

// 6. Motions for primitive lookup
section("6. Motions for primitive lookup");
const blockMotions = motionsForPrimitive("block");
ok(blockMotions.includes("fall"), "block can fall");
ok(blockMotions.includes("grow"), "block can grow");
const vesselMotions = motionsForPrimitive("vessel");
ok(vesselMotions.includes("fill"), "vessel can fill");
ok(vesselMotions.includes("drain"), "vessel can drain");
const fieldMotions = motionsForPrimitive("field");
ok(fieldMotions.includes("reveal"), "field can reveal");

// 7. Compile capability-based directive
section("7. Compile capability-based directive");
const { scene: growthScene, errors: growthErrors } = compileScene({
  capabilities: ["growth"],
  visual_events: [{ type: "growth", label: "COST", magnitude: "24.6%" }],
  reason: "showing cost increase",
  subject: "gasoline",
}, "Gasoline prices surged by 24.6%", 0, 5);
ok(growthScene, "growth scene compiled");
ok(growthErrors.length === 0, "no compilation errors");
ok(growthScene.objects.length > 0, "scene has objects");
ok(growthScene.mechanism === "CAPABILITY", "mechanism is CAPABILITY");

// 8. Compile comparison directive
section("8. Compile comparison directive");
const { scene: compScene } = compileScene({
  capabilities: ["comparison"],
  visual_events: [{ type: "comparison", labelA: "50%", labelB: "66%", scaleA: 0.75, scaleB: 1 }],
  reason: "comparing two proportions",
}, "50% vs 66% of Americans", 2, 5);
ok(compScene, "comparison scene compiled");
ok(compScene.objects.length === 2, "has two objects");

// 9. Compile depletion directive
section("9. Compile depletion directive");
const { scene: depScene } = compileScene({
  capabilities: ["depletion"],
  visual_events: [{ type: "depletion", label: "$1,400" }],
  reason: "showing money drained",
}, "Gas costs drain $1,400 per year", 3, 5);
ok(depScene, "depletion scene compiled");
ok(depScene.objects.some(o => o.kind === "vessel" || o.kind === "bar"), "has a vessel or bar");

// 10. Backward compatibility: mechanism to capability
section("10. Backward compatibility: mechanism to capability");
const converted = mechanismToCapability({
  mechanism: "STATE_CHANGE",
  objects: { label_a: "Expected", label_b: "Actual" },
});
ok(converted, "converted mechanism to capability");
ok(converted.capabilities.includes("contrast"), "has contrast capability");
ok(converted.visual_events[0].type === "contrast", "has contrast event");
ok(converted.visual_events[0].before === "Expected", "preserves before label");
ok(converted.visual_events[0].after === "Actual", "preserves after label");

// 11. isMechanismBased detection
section("11. isMechanismBased detection");
ok(isMechanismBased({ mechanism: "STATE_CHANGE" }), "detects mechanism-based");
ok(!isMechanismBased({ visual_events: [] }), "detects capability-based");
ok(!isMechanismBased(null), "null is not mechanism-based");

// 12. Compile with fallback for unknown event type
section("12. Compile with fallback for unknown event type");
const { scene: unknownScene, warnings: unknownWarnings } = compileScene({
  capabilities: ["unknown_cap"],
  visual_events: [{ type: "unknown_type" }],
  reason: "test unknown",
}, "test sentence", 0, 1);
ok(unknownScene, "still produces a scene");
ok(unknownWarnings.some(w => w.includes("Unknown")), "warns about unknown type");

// 13. Typography beat compiles correctly
section("13. Typography beat compiles correctly");
const { scene: typoScene } = compileScene({
  capabilities: ["typographic_emphasis"],
  visual_events: [],
  reason: "opening hook",
  typography: { role: "primary", style: "question", emphasis_words: ["why"] },
}, "Why does this keep happening?", 0, 5);
ok(typoScene, "typography scene compiled");
ok(typoScene.typography.role === "primary", "typography role is primary");
ok(typoScene.typography.style === "question", "typography style is question");

/* ── Summary ───────────────────────────────────────────────────────── */

console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
