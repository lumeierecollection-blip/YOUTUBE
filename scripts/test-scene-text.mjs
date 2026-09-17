/**
 * Regression tests for the scene-text chokepoint.
 *
 * Every assertion here is pinned to a DEFECT OBSERVED IN A REAL RENDER —
 * run 35261545735 (ch2, barnes-v-felix-excessive-force-pre-seizure), which
 * failed the frame-audit gate 2/4 frames and whose artifact frames showed
 * three further hard-rule violations the gate does not measure.
 *
 *   node scripts/test-scene-text.mjs
 */

import {
  ensureTextContrast, contrastRatio, sceneTextInventory, isEngineVocabulary,
  normaliseLabel, drawsNarrativeText, parseHex, toHex,
  TEXT_AA_FLOOR, TEXT_TARGET_CONTRAST, ACCENT_TEXT_TARGET_CONTRAST,
  ANTIALIAS_SAMPLE_RATIO, TEXT_SURFACES,
} from "../src/skills/remotion-render/visual/scene-text.js";
import {
  isHeadlineLike, isShoutedCaps,
} from "../src/skills/remotion-render/visual/narrative-typography.js";

let failed = 0;
let passed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; } else { failed++; console.log(`  FAIL  ${msg}`); }
};
const section = (s) => console.log(`\n${s}`);

/** Composite a fill over a ground at alpha, the way the compositor does. */
function composite(fgHex, bgHex, alpha) {
  const f = parseHex(fgHex);
  const b = parseHex(bgHex);
  return toHex(f.map((c, i) => c * alpha + b[i] * (1 - alpha)));
}

// Channel 2's real declared colours (config/channels.json).
const BG = "#0F0F1A";
const ACCENT = "#F5536B";

section("1. Accent text gets headroom for its own anti-aliased edges");
{
  // The observed failure: one fill, two different sampled readings in the
  // SAME video. frame-02 sampled rgb(200,82,110) = 4.43:1 (FAIL), frame-03
  // sampled 5.60:1 (PASS). The flat colour was never the problem.
  const flatDeclared = contrastRatio(ACCENT, BG);
  ok(flatDeclared >= TEXT_AA_FLOOR,
    "ch2's declared accent passes when measured FLAT (so the colour was never wrong)");
  ok(flatDeclared * ANTIALIAS_SAMPLE_RATIO < TEXT_AA_FLOOR,
    "...but fails once glyph anti-aliasing is applied — this is the real defect");

  const derived = ensureTextContrast(ACCENT, BG, ACCENT_TEXT_TARGET_CONTRAST);
  ok(contrastRatio(derived, BG) * ANTIALIAS_SAMPLE_RATIO >= TEXT_AA_FLOOR,
    "derived accentText still clears AA after worst-case anti-alias loss");
  ok(derived !== ACCENT, "derived accentText differs from the declared accent");

  // Channel identity must survive: same hue family, just brighter.
  const [r0, g0, b0] = parseHex(ACCENT);
  const [r1, g1, b1] = parseHex(derived);
  ok(r1 >= r0 && g1 >= g0 && b1 >= b0, "derivation only brightens (hue preserved, nothing substituted)");
  ok(r1 > g1 && r1 > b1, "still a red/rose accent — channel identity intact");

  // A channel that already has headroom must render exactly what it declared.
  ok(ensureTextContrast("#FFFFFF", BG, ACCENT_TEXT_TARGET_CONTRAST) === "#FFFFFF",
    "a colour that already clears the target is returned UNCHANGED");
}

section("2. The 2.30:1 translucent-text failure cannot recur");
{
  // StateChangeScene drew ed.text at opacity 0.7 inside a group at 0.65.
  const effective = 0.7 * 0.65;
  ok(Math.abs(effective - 0.455) < 0.001, "the two alphas compounded to 0.455 effective");

  const brightFill = "#E8E8F0";
  const composited = composite(brightFill, BG, effective);
  ok(contrastRatio(composited, BG) < TEXT_AA_FLOOR,
    "a bright fill at that alpha composites BELOW AA (reproduces the gate rejection)");

  // The fix: de-emphasis is a colour, validated, at full opacity.
  const quiet = ensureTextContrast("#8A8AA0", BG, TEXT_TARGET_CONTRAST);
  ok(contrastRatio(quiet, BG) * ANTIALIAS_SAMPLE_RATIO >= TEXT_AA_FLOOR,
    "the solid quiet role clears AA after anti-alias loss");
  ok(contrastRatio(quiet, BG) < contrastRatio("#FFFFFF", BG),
    "...while still reading as de-emphasised (dimmer than full white)");
}

section("3. The gate's own threshold is untouched");
{
  ok(TEXT_AA_FLOOR === 4.5, "AA floor stays 4.5:1 — the fix adds headroom, it does not relax the gate");
  ok(TEXT_TARGET_CONTRAST > TEXT_AA_FLOOR, "the render targets MORE contrast than the gate demands");
}

section("4. Engine vocabulary never reaches the screen");
{
  // Every one of these was a literal <text> node in a scene body.
  for (const v of ["EXPECTED", "REALITY", "EXPECTED → ACTUAL", "CONSUMED",
                   "CAUSE", "RESULT", "Before / After", "expected->actual"]) {
    ok(isEngineVocabulary(v), `"${v}" is flagged as engine vocabulary`);
  }
  ok(normaliseLabel("EXPECTED → ACTUAL") === "expected actual", "arrows normalise away");
  // Real content must survive.
  for (const v of ["Final Two Seconds", "Two seconds to decide", "Ignore everything until the shot"]) {
    ok(!isEngineVocabulary(v), `"${v}" is NOT flagged`);
  }
}

section("5. The manifest can no longer be blind to object-first text");
{
  // The exact scene from the failing run's beat 1.
  const scene = {
    mechanism: "STATE_CHANGE",
    objects: [
      { role: "expected", label: "The Full Encounter" },
      { role: "actual", label: "Final Two Seconds" },
    ],
  };
  const inv = sceneTextInventory("STATE_CHANGE", scene, null);
  ok(inv.length === 2, "STATE_CHANGE reports its 2 strings (the manifest said text: [])");
  ok(inv.every((t) => t.role === "narrative"), "both are narrative-role, so the phrase contract applies");
  ok(drawsNarrativeText("STATE_CHANGE"), "STATE_CHANGE is known to draw narrative text");

  // A banned string is REPORTED, not silently dropped — the auditor must see it.
  const withBanned = sceneTextInventory("STATE_CHANGE",
    { objects: [{ role: "expected", label: "EXPECTED" }, { role: "actual", label: "Final Two Seconds" }] }, null);
  ok(withBanned.some((t) => t.role === "banned"), "engine vocabulary surfaces as role:banned rather than vanishing");

  // Value-role figures are exempt from the word budget; they are data.
  const consumption = sceneTextInventory("VISIBLE_CONSUMPTION",
    { objects: [{ role: "consumed", label: "Two seconds to decide" }] }, null);
  ok(consumption[0].role === "value", "VISIBLE_CONSUMPTION's figure is value-role, not a narrative phrase");

  // TYPOGRAPHY still reports the centred phrase.
  const typo = sceneTextInventory("TYPOGRAPHY", {}, "Ignore everything until the shot");
  ok(typo.length === 1 && typo[0].role === "narrative", "TYPOGRAPHY reports its one narrative line");

  // An unknown mechanism draws nothing rather than guessing.
  ok(sceneTextInventory("NOT_A_MECHANISM", scene, "x").length === 0, "unknown mechanism reports no text");

  // Empty / whitespace strings are not counted as text.
  ok(sceneTextInventory("TYPOGRAPHY", {}, "   ").length === 0, "blank text is not an on-screen string");
}

section("6. Shouted-caps headlines are rejected; acronyms are not");
{
  // The failing run's FIRST attempt planned this and the contract passed it.
  ok(isShoutedCaps("SCOTUS SMASHES THE RULE"), '"SCOTUS SMASHES THE RULE" is shouted caps');
  ok(isHeadlineLike("SCOTUS SMASHES THE RULE"), "...and isHeadlineLike now rejects it");
  ok(!isShoutedCaps("What SCOTUS actually said"), "an acronym inside sentence case is fine");
  ok(!isShoutedCaps("NOT GUILTY"), "short 2-word caps emphasis is allowed");
  ok(!isHeadlineLike("Ignore everything until the shot"), "the phrase that DID render correctly still passes");
  ok(!isHeadlineLike("Two seconds to decide"), "a good narrative phrase still passes");
}

section("7. Every declared text surface is well-formed");
{
  const ROLES = new Set(["narrative", "value", "quiet"]);
  for (const [mech, surfaces] of Object.entries(TEXT_SURFACES)) {
    ok(Array.isArray(surfaces) && surfaces.length > 0, `${mech} declares at least one surface`);
    for (const s of surfaces) {
      ok(ROLES.has(s.role), `${mech}: role "${s.role}" is a known role`);
      ok(typeof s.source === "string" && s.source.length > 0, `${mech}: surface has a source`);
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
