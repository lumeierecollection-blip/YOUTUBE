/**
 * LAYOUT-SYSTEM.md §8.4 step 2 verification — "a .shots.txt renders for a
 * fixture". PURE Node. Exits non-zero if any expectation is violated.
 */

import { validateShotSpec, validateShotSpecs } from "./schema.js";
import { shotsToEnglish } from "./toEnglish.js";

let failed = 0;
let passed = 0;

function check(label, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ok  ${label}`);
  } else {
    failed++;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── Fixture: the Part 2.1 example, verbatim ─────────────────────────────────

const b07 = {
  id: "b07",
  archetype: "PROGRESS",
  startFrame: 412,
  durationInFrames: 84,
  anchorTokenIndex: 3,
  layers: [
    {
      role: "kicker",
      slot: "kicker",
      content: { index: 2, label: "The Deep Dive" },
      enter: { pattern: "RISE", atFrame: 0 },
      exit: { pattern: "NONE" },
    },
    {
      role: "chart",
      slot: "stage",
      align: "bottom-left",
      content: {
        unit: "%",
        series: [
          { label: "2019", value: 12 },
          { label: "2024", value: 47, highlight: true },
        ],
      },
      enter: { pattern: "CHART_BUILD", atFrame: "anchor-4" },
      exit: { pattern: "FADE", atFrame: "end-6" },
    },
    {
      role: "headline",
      slot: "headline",
      align: "left",
      content: { text: "Reported cases, share of total" },
      fit: { maxSize: 84, minSize: 64, maxLines: 2 },
      enter: { pattern: "RISE", atFrame: "anchor+8" },
      exit: { pattern: "FADE", atFrame: "end-6" },
    },
  ],
};

// ── Schema ──────────────────────────────────────────────────────────────────

console.log("schema — valid specs");
const ok = validateShotSpec(b07);
check("Part 2.1 example validates", ok.valid, ok.errors.join(" | "));
const okMany = validateShotSpecs([b07]);
check("validateShotSpecs([]) validates", okMany.valid, okMany.errors.join(" | "));

console.log("schema — invalid specs are rejected");
const badAtFrame = validateShotSpec({ ...b07, id: "x1", layers: [{ ...b07.layers[0], enter: { pattern: "RISE", atFrame: "later" } }] });
check("bad atFrame 'later' rejected", !badAtFrame.valid && /atFrame/.test(badAtFrame.errors.join(" ")), badAtFrame.errors.join(" "));
const badAlign = validateShotSpec({ ...b07, id: "x2", layers: [{ ...b07.layers[1], align: "somewhere" }] });
check("bad align rejected", !badAlign.valid && /align/.test(badAlign.errors.join(" ")), badAlign.errors.join(" "));
const badSlot = validateShotSpec({ ...b07, id: "x3", layers: [{ ...b07.layers[0], slot: "canvas" }] });
check("unknown slot rejected", !badSlot.valid && /slot/.test(badSlot.errors.join(" ")), badSlot.errors.join(" "));
const badArchetype = validateShotSpec({ ...b07, id: "x4", archetype: "SPLICE" });
check("bad archetype rejected", !badArchetype.valid && /archetype/.test(badArchetype.errors.join(" ")), badArchetype.errors.join(" "));
const badFit = validateShotSpec({ ...b07, id: "x5", layers: [{ ...b07.layers[2], fit: { maxSize: 0, minSize: 64, maxLines: 0 } }] });
check("bad fit rejected", !badFit.valid && /fit/.test(badFit.errors.join(" ")), badFit.errors.join(" "));
const noLayers = validateShotSpec({ ...b07, id: "x6", layers: [] });
check("empty layers rejected", !noLayers.valid && /layers/.test(noLayers.errors.join(" ")), noLayers.errors.join(" "));
const missingExit = validateShotSpec({ ...b07, id: "x7", layers: [{ ...b07.layers[0], exit: undefined }] });
check("missing exit rejected", !missingExit.valid && /exit/.test(missingExit.errors.join(" ")), missingExit.errors.join(" "));

// ── toEnglish ───────────────────────────────────────────────────────────────

console.log("toEnglish — .shots.txt renders for a fixture");
const english = shotsToEnglish([b07]);
const lines = english.trimEnd().split("\n");
check("header line renders", lines[0] === "b07  PROGRESS  412+84", lines[0]);
check("kicker line renders", /kicker.*in kicker/.test(lines[1]) && /rise at 0/.test(lines[1]) && !/fade/.test(lines[1]), lines[1]);
check("chart line renders", /chart.*in stage, bottom-left/.test(lines[2]) && /chart_build at anchor-4/.test(lines[2]) && /fade at end-6/.test(lines[2]), lines[2]);
check("headline line renders", /headline.*in headline, left, fit 84\/64\/2/.test(lines[3]) && /rise at anchor\+8/.test(lines[3]), lines[3]);
check("trailing newline", english.endsWith("\n"));
check("blank line separates shots", shotsToEnglish([b07, b07]).includes("\n\n"));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
