/**
 * A DIRECTED beat with no phrase must render TEXT-FREE.
 *
 * This is the assertion that makes enforcement real. visual-director.js
 * used to fall back to condenseToPhrase(text) — the narration sentence —
 * whenever no phrase was directed, which silently undid every
 * REMOVE_TYPOGRAPHY directive: run 35290591724 applied and VERIFIED "at
 * most 2 beats carry text" on three consecutive attempts while the auditor
 * kept measuring 4 of 6, because clearing the phrase put the transcript
 * back on screen. A directive the render undoes is not enforcement.
 *
 * The fallback is still correct for an UNDIRECTED beat, and that is
 * asserted too — removing it entirely would leave keyword-planned beats
 * with no text at all.
 *
 *   node scripts/test-director-textfree.mjs
 */
import { direct } from "../src/skills/remotion-render/visual-engine/director/visual-director.js";

let failed = 0, passed = 0;
const ok = (c, m) => { if (c) passed++; else { failed++; console.log(`  FAIL  ${m}`); } };

const NARRATION = "Employers must document every accommodation request carefully.";
const cues = [0, 1, 2, 3].map((i) => ({
  text: NARRATION, startFrame: i * 200, durationFrames: 200, words: [],
}));
const textOf = (b) => String(b.text || "").trim();

console.log("\n1. A directed beat with a cleared phrase draws nothing");
{
  const visualPlan = { beats: [
    { index: 0, mechanism: "TYPOGRAPHY", visual_headline: "Document everything",
      typography_direction: { phrase: "Document everything" }, objects: {} },
    { index: 1, mechanism: "STATE_CHANGE", visual_headline: "", typography_direction: null, objects: {} },
    { index: 2, mechanism: "EVIDENCE_FIGURE", visual_headline: "", typography_direction: null, objects: {} },
    { index: 3, mechanism: "PROPORTIONAL_OBJECTS", visual_headline: "", typography_direction: null, objects: {} },
  ] };
  const { beats } = direct(cues, { seed: 1, visualPlan });

  ok(textOf(beats[0]) === "Document everything", "the directed phrase is drawn verbatim");
  for (const i of [1, 2, 3]) {
    ok(textOf(beats[i]) === "", `beat ${i} draws no text (got ${JSON.stringify(textOf(beats[i]))})`);
    ok(!textOf(beats[i]).includes("accommodation"), `beat ${i} does not fall back to the narration`);
  }
  ok(beats.filter((b) => textOf(b)).length === 1, "exactly 1 of 4 beats carries text");
}

console.log("2. An UNDIRECTED beat still gets the condensed fallback");
{
  // No visualPlan at all: the deterministic classifier chose the scene, and
  // a condensed phrase is the best text available.
  const { beats } = direct(cues, { seed: 1 });
  ok(textOf(beats[0]).length > 0, "an undirected beat still draws text");
  ok(textOf(beats[0]) !== NARRATION, "...condensed, not the raw sentence (Bible TYP-04)");
}

console.log("3. Enforcement math holds end to end");
{
  // 6 beats, REDUCE_TEXT_BEATS max 2 -> at most 2 may carry text.
  const six = [0, 1, 2, 3, 4, 5].map((i) => ({ text: NARRATION, startFrame: i * 200, durationFrames: 200, words: [] }));
  const visualPlan = { beats: six.map((_, i) => (
    i < 2
      ? { index: i, mechanism: "TYPOGRAPHY", visual_headline: `Phrase ${i}`, typography_direction: { phrase: `Phrase ${i}` }, objects: {} }
      : { index: i, mechanism: "STATE_CHANGE", visual_headline: "", typography_direction: null, objects: {} }
  )) };
  const { beats } = direct(six, { seed: 1, visualPlan });
  const n = beats.filter((b) => textOf(b)).length;
  ok(n === 2, `2 of 6 beats carry text after enforcement (got ${n})`);
  ok(n / beats.length <= 0.4, `text-beat share ${Math.round((n / beats.length) * 100)}% is within the 40% cap`);
}

console.log("4. The director does not refill labels that enforcement cleared");
{
  // The last leak, and the fourth instance of the same `||` fallback bug.
  // applyDirective() defaulted label_a/label_b/cause/effect to "EXPECTED"/
  // "ACTUAL"/"CAUSE"/"EFFECT", surface/beneath to "REALITY", and the
  // proportional pair to "A"/"B". So REMOVE_TYPOGRAPHY cleared a label, the
  // fallback put a banned word straight back, and the manifest counted it as
  // narrative text — runs 35293642808 and 35317469026 applied and VERIFIED
  // every directive while the auditor measured an unchanged text-beat share
  // on all three attempts (57/57/57 ch1, 44/44/44 ch44).
  const visualPlan = { beats: [
    { index: 0, mechanism: "TYPOGRAPHY", visual_headline: "Scripted leaders lose the room",
      typography_direction: { phrase: "Scripted leaders lose the room" }, objects: {} },
    { index: 1, mechanism: "STATE_CHANGE", visual_headline: "", typography_direction: null, objects: { label_a: "", label_b: "" } },
    { index: 2, mechanism: "ACTION_CONSEQUENCE", visual_headline: "", typography_direction: null, objects: { cause: "", effect: "" } },
    { index: 3, mechanism: "SURFACE_AND_BENEATH", visual_headline: "", typography_direction: null, objects: { label_a: "", label_b: "" } },
  ] };
  const { beats } = direct(cues, { seed: 7, visualPlan });

  const BANNED = /^(EXPECTED|ACTUAL|CAUSE|EFFECT|REALITY|A|B)$/;
  for (const b of beats) {
    for (const o of (b.scene && b.scene.objects) || []) {
      ok(!BANNED.test(String(o.label).trim()),
        `no banned/placeholder label reintroduced (got ${JSON.stringify(o.label)} on ${b.scene.mechanism})`);
    }
  }
  const textBeats = beats.filter((b) => textOf(b)).length;
  ok(textBeats === 1, `only the beat that kept its phrase carries text (got ${textBeats})`);
  ok(textOf(beats[0]) === "Scripted leaders lose the room", "that beat's phrase is intact");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
