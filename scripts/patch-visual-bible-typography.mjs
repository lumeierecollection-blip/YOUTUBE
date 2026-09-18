#!/usr/bin/env node
/**
 * One-shot, idempotent patch: install the NARRATIVE TYPOGRAPHY doctrine into
 * config/visual-bible.json.
 *
 * Done as a script rather than by hand because the Bible is a large JSON
 * document and three existing rules actively CONTRADICT the new direction
 * (TYP-01 permitted a second "supporting line"; TYP-05 said "do not center
 * everything by default"; TYP-06 described a primary/secondary/tertiary text
 * hierarchy — i.e. a headline + subhead structure). Those are rewritten, and
 * the narrative-vs-headline rules are added, so no future agent can read the
 * Bible and reintroduce headline typography.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BIBLE = join(ROOT, "config", "visual-bible.json");
const b = JSON.parse(readFileSync(BIBLE, "utf-8"));

b.version = 4.0;

/* ── Rewrite the rules that contradicted narrative typography ───────── */

b.rules["TYP-01"] = {
  name: "single-line-narrative-typography",
  category: "TYPOGRAPHY",
  severity: "CRITICAL",
  description:
    "On-screen text is ONE LINE. Exactly one. There is no 'primary line plus a short supporting line', no headline+subheadline, no stacked text, no title+sentence, no paragraph, no bullets, no second text block. The unit is ONE SHORT SPOKEN THOUGHT of 2-7 words (8-9 unusual, never more than 9). If a phrase will not fit on one line it must be REWRITTEN SHORTER — never shrunk until tiny and never wrapped onto a second line.",
  pass: "Exactly one line of text, 2-7 words, one thought, fits the safe width at a readable size.",
  fail: "Two or more lines, headline+subhead, stacked text, a wrapped phrase, a paragraph, or text shrunk small to make it fit.",
};

b.rules["TYP-05"] = {
  name: "narrative-typography-centred",
  category: "COMPOSITION",
  severity: "HIGH",
  description:
    "Narrative typography is CENTRED BY DEFAULT — horizontally across the safe width and vertically within the usable safe region. This supersedes the earlier 'do not center everything' guidance, which was written for a headline/label system that no longer exists. Centre is the default because the phrase is a single spoken thought held at the optical centre of the frame, not a caption, lower third or title card. Deviate only when the visual composition genuinely requires it (e.g. the phrase must sit with a specific object).",
  pass: "Phrase is centred in the safe area, or is deliberately placed to integrate with a specific visual object.",
  fail: "Text drifting to arbitrary positions, pinned to the top/bottom like a headline or lower third, or placed with no compositional reason.",
};

b.rules["TYP-06"] = {
  name: "one-thought-no-text-hierarchy",
  category: "VISUAL_HIERARCHY",
  severity: "HIGH",
  description:
    "There is no primary/secondary/tertiary TEXT hierarchy, because there is only ever one line. Hierarchy lives between the LAYERS — narration explains, the visual demonstrates, the typography emphasises — not between sizes of text. Emphasis inside the phrase is carried by COLOUR on a key word, never by adding another text tier.",
  pass: "One line, one thought; emphasis (if any) is a colour accent on a key word.",
  fail: "Multiple text sizes/tiers on screen, a subhead, a kicker, a label above a headline.",
};

/* ── New rules: the distinction itself ──────────────────────────────── */

b.rules["TYP-09"] = {
  name: "narrative-not-headline",
  category: "TYPOGRAPHY",
  severity: "CRITICAL",
  description:
    "NARRATIVE TYPOGRAPHY is required; HEADLINE TYPOGRAPHY is prohibited. Narrative typography is short, one line, centred, selective, tied to the narration, emphasises an idea, works alongside the visual, and does NOT summarise the beat. Headline typography is a section title, article title, topic label, explanatory heading, or title/subtitle structure — it is banned from this visual language. Specifically prohibited unless the phrase genuinely functions as spoken emphasis: 'The Problem', 'The Solution', 'The Hidden Cost', 'Why This Happens', 'The Psychology Behind It', 'Financial Mistakes', 'Consumer Behavior'. The phrase must read as something a person is SAYING or ASKING, not as a heading over content.",
  pass: "The phrase reads as narrative emphasis a narrator could speak ('You barely notice it.', 'Do I need it?', '$34 MILLION', 'Need it — or want it?').",
  fail: "Title-case topic labels, section headings, article titles, 'The <Adjective> <Noun>' constructions, or any phrase that functions as a heading over the beat.",
};

b.rules["TYP-10"] = {
  name: "typography-is-selective",
  category: "HEADLINE_MONOCULTURE",
  severity: "HIGH",
  description:
    "Typography is ONE treatment among many, not the visual system and not the fallback for a hard beat. The rhythm is HOOK (one line) -> visual storytelling (no text) -> RE-HOOK at a real turn -> visual consequence -> maybe a KEY FACT -> back to visual. TEXT -> TEXT -> TEXT -> TEXT is a failure. If no meaningful visual comes to mind, the answer is NOT a big sentence in the centre of the screen. No more than ~40% of beats may carry on-screen text.",
  pass: "Text beats are a minority and each appears at a genuine narrative moment; the majority of beats carry a non-text visual.",
  fail: "Most beats carry text, typography used as the default treatment, or typography substituting for an absent visual idea.",
};

b.rules["TYP-11"] = {
  name: "typography-does-not-describe-the-visual",
  category: "SEMANTIC_MISMATCH",
  severity: "HIGH",
  description:
    "The three layers must not repeat each other. Typography must not caption or describe what the viewer is already seeing, and must not restate the narration. Narration explains the idea, the visual demonstrates it, the typography emphasises it. Example — narration: 'Your brain isn't asking whether you need it, it's asking whether you want it'; typography: 'Need it — or want it?'; visual: the purchase decision itself. Not 'THE PSYCHOLOGY OF CONSUMER DESIRE', which is a headline describing the topic.",
  pass: "Phrase emphasises the idea while the visual independently demonstrates it; removing either would lose information.",
  fail: "Phrase describes/labels the on-screen visual, or restates the narration, or could be swapped onto any other sentence.",
};

/* ── Strengthen the existing anti-subtitle / anti-karaoke rules ──────── */

b.rules["TYP-04"].description +=
  " Narrative typography is never the spoken line: not verbatim, and not a near-restatement of it (high word overlap with the narration is a subtitle even if reworded).";
b.rules["TYP-08"].description +=
  " The phrase behaves as ONE compositional object: it enters, holds and leaves as a unit. No per-word reveal, no bouncing words, no individually highlighted words, no kinetic-caption behaviour.";

/* ── Quality test + failure category ────────────────────────────────── */

b.quality_tests = b.quality_tests || {};
b.quality_tests.NARRATIVE_TYPOGRAPHY_TEST = {
  question:
    "Does the on-screen text behave as NARRATIVE EMPHASIS according to the visual direction — one short centred line that emphasises the narration and works alongside the visual — rather than as a headline, a section label, a subtitle/transcript, or a generic text block?",
  fail_if: [
    "more than one line of text, or a headline+subhead structure",
    "more than 9 words, or the narration restated",
    "a topic label / section heading / article title",
    "text that merely describes the visual already on screen",
    "text present with no narrative reason for emphasis",
    "word-by-word or karaoke-style animation",
  ],
};
if (!b.failure_categories.includes("NARRATIVE_TYPOGRAPHY")) {
  b.failure_categories.push("NARRATIVE_TYPOGRAPHY");
}

/* ── Teach the review prompts the distinction ───────────────────────── */

const TYPO_REVIEW_BLOCK =
  "\n\nNARRATIVE TYPOGRAPHY CHECK (do NOT ask 'does the text look good?'): For every frame with on-screen text, decide whether it behaves as NARRATIVE EMPHASIS (one short centred line, 2-7 words, emphasising what the narrator is saying, working alongside a visual that independently demonstrates the idea) or as PROHIBITED HEADLINE/SUBTITLE typography (two or more lines; headline+subhead; a section/topic label such as 'The Problem' or 'The Psychology Behind It'; the narration restated; text that merely describes the visual; text present with no narrative reason; word-by-word animation). Report which, and say WHY.";

if (b.prompts?.scene_review && !b.prompts.scene_review.includes("NARRATIVE TYPOGRAPHY CHECK")) {
  b.prompts.scene_review = b.prompts.scene_review.replace(
    /(\n*Respond ONLY with JSON)/,
    `${TYPO_REVIEW_BLOCK}$1`
  );
}
if (b.prompts?.whole_video_review && !b.prompts.whole_video_review.includes("NARRATIVE TYPOGRAPHY CHECK")) {
  b.prompts.whole_video_review = b.prompts.whole_video_review.replace(
    /(\n*Respond ONLY with JSON)/,
    `${TYPO_REVIEW_BLOCK} Also report typography_frequency: what share of beats carry on-screen text, and whether typography is being used as a default treatment rather than selective emphasis.$1`
  );
}

b.principle = String(b.principle || "") +
  " Typography is narrative emphasis, never headline design: one short centred line that emphasises what the narrator is saying, while the visual independently demonstrates it.";

writeFileSync(BIBLE, JSON.stringify(b, null, 2) + "\n");
console.log(`Visual Bible -> v${b.version}; rules: ${Object.keys(b.rules).length}; typography rules: ${Object.keys(b.rules).filter((k) => k.startsWith("TYP")).length}`);
console.log(`scene_review patched: ${b.prompts.scene_review.includes("NARRATIVE TYPOGRAPHY CHECK")}`);
console.log(`whole_video_review patched: ${b.prompts.whole_video_review.includes("NARRATIVE TYPOGRAPHY CHECK")}`);
