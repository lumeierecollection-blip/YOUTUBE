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
import { sceneTextInventory } from "../src/skills/remotion-render/visual/scene-text.js";

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

console.log("5. A text-free beat draws no NARRATIVE label either");
{
  // Clearing the typography phrase was not enough. A beat Gemini directed
  // text-free still had its mechanism draw expected/actual (or cause/effect)
  // labels, because those live on scene.objects rather than in
  // typography_direction. Gemini reported exactly that in run 35356611503:
  // "Text was incorrectly inserted into intermediate beats that
  // specifically directed no on-screen text", headline=4. It asked for
  // silence and the renderer talked over it.
  const visualPlan = { beats: [
    { index: 0, mechanism: "TYPOGRAPHY", visual_headline: "Document everything",
      typography_direction: { phrase: "Document everything" }, objects: {} },
    { index: 1, mechanism: "STATE_CHANGE", visual_headline: "", typography_direction: null,
      objects: { label_a: "Divided courts", label_b: "Unanimous ruling" } },
    { index: 2, mechanism: "ACTION_CONSEQUENCE", visual_headline: "", typography_direction: null,
      objects: { cause: "Filing made", effect: "Claim denied" } },
    { index: 3, mechanism: "EVIDENCE_FIGURE", visual_headline: "", typography_direction: null,
      objects: { figure: "31.35M" } },
  ] };
  const { beats } = direct(cues, { seed: 2, visualPlan });

  const inv = (b) => sceneTextInventory(b.scene.mechanism, b.scene, b.text);
  const narrative = (b) => inv(b).filter((t) => t.role === "narrative" && t.text).map((t) => t.text);
  const values = (b) => inv(b).filter((t) => t.role === "value" && t.text).map((t) => t.text);

  ok(narrative(beats[0]).length === 1, "the directed beat keeps its phrase");
  for (const i of [1, 2, 3]) {
    ok(narrative(beats[i]).length === 0,
      `text-free beat ${i} draws no narrative string (got ${JSON.stringify(narrative(beats[i]))})`);
  }
  ok(beats.filter((b) => narrative(b).length).length === 1, "exactly one beat carries narrative text");

  // A FIGURE is data, not a phrase, and must survive a text-free beat —
  // the first version of this fix cleared it because EVIDENCE_FIGURE's
  // object id carries both a value and a narrative surface.
  ok(values(beats[3]).some((v) => v.includes("31.35M")),
    `the measured figure survives and counts as value (got ${JSON.stringify(values(beats[3]))})`);
  ok(narrative(beats[3]).length === 0, "...and is not counted as a narrative phrase");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
