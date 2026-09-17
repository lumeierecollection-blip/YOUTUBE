/**
 * Proves the local auditor is no longer BLIND to object-first scene text.
 *
 * This is the regression test for the worst defect found in run
 * 35261545735: the render manifest recorded `text: []` for every
 * object-first mechanism, so auditTypography() reported "0 violations" on a
 * video whose frames showed a two-headline STATE_CHANGE beat with three
 * section labels. The gate caught it only by accident, via contrast.
 *
 * The test drives auditTypography() with the REAL beats of that run under
 * both manifest shapes and asserts the old one was blind and the new one
 * is not. No video needed.
 *
 *   node scripts/test-scene-text-audit.mjs
 */

import { auditTypography } from "./local-visual-auditor.js";
import { sceneTextInventory } from "../src/skills/remotion-render/visual/scene-text.js";

let failed = 0;
let passed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; } else { failed++; console.log(`  FAIL  ${msg}`); }
};

/** The six beats of barnes-v-felix-excessive-force-pre-seizure, as rendered. */
const SCENES = [
  ["TYPOGRAPHY", {}, "Ignore everything until the shot"],
  ["STATE_CHANGE", { objects: [
    { role: "expected", label: "The Full Encounter" },
    { role: "actual", label: "Final Two Seconds" }] }, null],
  ["ACTION_CONSEQUENCE", { objects: [
    { role: "cause", label: "Officers fired" },
    { role: "effect", label: "Court split" }] }, null],
  ["VISIBLE_CONSUMPTION", { objects: [
    { role: "consumed", label: "Two seconds to decide" }] }, null],
  ["STRUCTURAL_BREAKDOWN", { objects: [{ label: "Fourth Amendment" }] }, null],
  ["PROPORTIONAL_OBJECTS", { objects: [{ label: "Two seconds" }] }, null],
];

function manifest({ withInventory }) {
  return {
    width: 1080,
    height: 1920,
    beats: SCENES.map(([mechanism, scene, text], index) => {
      const inv = withInventory ? sceneTextInventory(mechanism, scene, text) : [];
      return {
        index,
        mechanism,
        // The old shape: only TypographyScene's phrase was ever recorded.
        text: mechanism === "TYPOGRAPHY" && text ? [text] : [],
        on_screen_text: inv,
        draws_text: inv.length > 0,
        narrative_text: inv.filter((t) => t.role === "narrative").map((t) => t.text),
        banned_text: inv.filter((t) => t.role === "banned").map((t) => t.text),
      };
    }),
  };
}

console.log("\n1. The old manifest shape was blind");
{
  const r = auditTypography(manifest({ withInventory: false }), { beats: [] }, null);
  ok(r.ok, "audit ran");
  ok(r.textBeats === 1, `saw only 1 text beat of 6 (got ${r.textBeats})`);
  ok(r.issues.length === 0,
    `reported ZERO issues on a video with a two-headline beat (got ${r.issues.length}) — this is the blindness`);
}

console.log("2. The new manifest shape sees the text that is actually drawn");
{
  const r = auditTypography(manifest({ withInventory: true }), { beats: [] }, null);
  ok(r.textBeats === 3, `sees 3 narrative-text beats of 6 (got ${r.textBeats})`);
  ok(r.issues.length > 0, "raises issues where the old shape raised none");

  const stacked = r.issues.filter((i) => /narrative lines/.test(i.problem));
  ok(stacked.length === 2, `flags BOTH stacked-narrative beats — STATE_CHANGE and ACTION_CONSEQUENCE (got ${stacked.length})`);
  ok(stacked.every((i) => i.owner === "PLAN_COMPLIANCE"),
    "stacked lines are owned by PLAN_COMPLIANCE (the renderer built the wrong structure)");

  const b1 = stacked.find((i) => i.beat === 1);
  ok(!!b1, "beat 1 is named explicitly");
  ok(b1 && /The Full Encounter/.test(b1.problem) && /Final Two Seconds/.test(b1.problem),
    "the offending strings are quoted, so the correction loop knows what to change");

  // The selectivity rule must measure NARRATIVE text, not chart labels —
  // otherwise every beat with an axis label would trip it.
  const share = r.issues.filter((i) => /of beats carry on-screen text/.test(i.problem));
  ok(share.length === 1, "the text-share rule fires once, on narrative text only");
}

console.log("3. Engine vocabulary is reported as a compliance failure");
{
  const withBanned = {
    width: 1080, height: 1920,
    beats: [{
      index: 0, mechanism: "STATE_CHANGE",
      text: [], on_screen_text: [], draws_text: true,
      narrative_text: ["Final Two Seconds"],
      banned_text: ["EXPECTED", "REALITY"],
    }],
  };
  const r = auditTypography(withBanned, { beats: [] }, null);
  const banned = r.issues.filter((i) => /internal mechanism vocabulary/.test(i.problem));
  ok(banned.length === 2, `both banned labels are flagged (got ${banned.length})`);
  ok(banned.every((i) => i.owner === "PLAN_COMPLIANCE"), "owned by PLAN_COMPLIANCE");
}

console.log("4. A clean video still passes");
{
  const clean = {
    width: 1080, height: 1920,
    beats: [
      { index: 0, mechanism: "TYPOGRAPHY", text: ["Ignore everything until the shot"],
        on_screen_text: [], draws_text: true, narrative_text: ["Ignore everything until the shot"], banned_text: [] },
      { index: 1, mechanism: "VISIBLE_CONSUMPTION", text: [],
        on_screen_text: [], draws_text: true, narrative_text: [], banned_text: [] },
      { index: 2, mechanism: "STRUCTURAL_BREAKDOWN", text: [],
        on_screen_text: [], draws_text: true, narrative_text: [], banned_text: [] },
      { index: 3, mechanism: "PROPORTIONAL_OBJECTS", text: [],
        on_screen_text: [], draws_text: true, narrative_text: [], banned_text: [] },
    ],
  };
  const r = auditTypography(clean, { beats: [] }, null);
  ok(r.textBeats === 1, "one narrative-text beat in four");
  ok(r.issues.length === 0, `no issues on a compliant video (got ${r.issues.length}: ${r.issues.map((i) => i.problem).join(" | ")})`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
