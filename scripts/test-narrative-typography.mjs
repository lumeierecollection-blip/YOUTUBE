#!/usr/bin/env node
/**
 * Contract tests for NARRATIVE TYPOGRAPHY.
 *
 * Proves the system-level rules hold across the three layers that must agree:
 * the shared budget module, the renderer's single-line fit, and the planner's
 * enforcement. Pure functions only — renders nothing, calls no API, touches no
 * video. Run: node scripts/test-narrative-typography.mjs
 */
import {
  validateNarrativePhrase, condenseToPhrase, fitSingleLine, isHeadlineLike,
  isTranscriptLike, wordCount, toSingleLine, estimateEmWidth,
  TYPO_TARGET_MAX_WORDS, TYPO_HARD_MAX_WORDS, TYPO_MIN_READABLE_PX,
  TYPO_SAFE_WIDTH_FRACTION, TYPO_MAX_BEAT_SHARE,
} from "../src/skills/remotion-render/visual/narrative-typography.js";
import { direct } from "../src/skills/remotion-render/visual-engine/director/visual-director.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readFileSyncSafe = (rel) => readFileSync(join(ROOT, rel), "utf-8");

let pass = 0, fail = 0;
const results = [];
function check(name, cond, detail = "") {
  if (cond) { pass++; results.push(`  PASS  ${name}`); }
  else { fail++; results.push(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}

// The renderer's real budget: SAFE_SHORTS width 840 * TYPO_SAFE_WIDTH_FRACTION.
const SAFE_W = 888 - 48;
const FIT_W = SAFE_W * TYPO_SAFE_WIDTH_FRACTION;
const FIT_H = (1248 - 288) * 0.42;

/* 1. A valid narrative phrase passes, unchanged. */
{
  const phrase = "Need it — or want it?";
  const v = validateNarrativePhrase(phrase, { narration: "Your brain isn't asking whether you need it. It's asking whether you want it." });
  check("1. valid phrase passes validation", v.ok, v.reasons.join("; "));
  check("1. valid phrase is not mangled by condensing", condenseToPhrase(phrase) === phrase, `got "${condenseToPhrase(phrase)}"`);
  const fit = fitSingleLine(phrase, FIT_W, FIT_H);
  check("1. valid phrase renders on one line unchanged", fit.lines === 1 && fit.text === phrase && !fit.condensed, `got "${fit.text}"`);
  for (const good of ["Why does this keep happening?", "You barely notice it.", "One purchase at a time.", "Do I need it?", "$34 MILLION"]) {
    check(`1. good phrase accepted: "${good}"`, validateNarrativePhrase(good).ok, validateNarrativePhrase(good).reasons.join("; "));
  }
}

/* 2. A long headline-like phrase is rejected or condensed. */
{
  const bads = [
    "The Hidden Psychological Cost Of Modern Consumer Behavior",
    "THE SHOCKING TRUTH ABOUT WHY PEOPLE KEEP SPENDING",
    "Most people don't realize how much money they're losing every month",
  ];
  for (const bad of bads) {
    const v = validateNarrativePhrase(bad);
    check(`2. rejected: "${bad.slice(0, 38)}..."`, !v.ok, "validator accepted it");
    check(`2. condensed within budget: "${bad.slice(0, 28)}..."`,
      wordCount(v.normalized) <= TYPO_TARGET_MAX_WORDS && v.normalized !== toSingleLine(bad),
      `normalized="${v.normalized}" (${wordCount(v.normalized)} words)`);
  }
  for (const label of ["The Problem", "The Solution", "The Hidden Cost", "Why This Happens", "The Psychology Behind It", "Financial Mistakes", "Consumer Behavior"]) {
    check(`2. headline label detected: "${label}"`, isHeadlineLike(label), "not flagged");
  }
}

/* 3. A two-line typography instruction cannot produce two-line output. */
{
  const twoLine = "The Hidden Cost\nOf Everyday Spending";
  const fit = fitSingleLine(twoLine, FIT_W, FIT_H);
  check("3. newline collapsed — exactly one line", fit.lines === 1 && !/[\r\n]/.test(fit.text), `got ${JSON.stringify(fit.text)}`);
  check("3. multi-line input flagged by validator", !validateNarrativePhrase(twoLine).ok);
  check("3. toSingleLine removes all newlines", !/[\r\n]/.test(toSingleLine("a\nb\r\nc")));
  // Whatever the input, the fitted line always fits the width budget (=> nowrap cannot wrap).
  for (const s of [twoLine, "a".repeat(200), "Supercalifragilisticexpialidocious Antidisestablishmentarianism"]) {
    const f = fitSingleLine(s, FIT_W, FIT_H);
    check(`3. fitted line never exceeds width budget: "${s.slice(0, 20)}..."`,
      estimateEmWidth(f.text) * f.size <= FIT_W + 0.5,
      `width=${(estimateEmWidth(f.text) * f.size).toFixed(1)} > ${FIT_W.toFixed(1)}`);
  }
}

/* 4. A subtitle/transcript-like phrase is rejected or condensed. */
{
  const narration = "Two operators billed Medicare thirty four million dollars for fake orthotic braces";
  const verbatim = "Two operators billed Medicare thirty four million dollars";
  check("4. transcript restatement detected", isTranscriptLike(verbatim, narration), "not flagged");
  const v = validateNarrativePhrase(verbatim, { narration });
  check("4. transcript phrase rejected", !v.ok, v.reasons.join("; "));
  check("4. transcript phrase condensed", wordCount(v.normalized) <= TYPO_TARGET_MAX_WORDS, `${wordCount(v.normalized)} words`);
  check("4. over-cap length alone counts as transcript", isTranscriptLike("one two three four five six seven eight nine ten", null));
}

/* 5. Typography defaults to centred placement. */
{
  const src = readFileSyncSafe("src/skills/remotion-render/visual-engine/directed-scene.jsx");
  const scene = src.slice(src.indexOf("function TypographyScene"), src.indexOf("SCENE RENDERERS"));
  check("5. renderer centres horizontally (justifyContent center)", /justifyContent:\s*"center"/.test(scene));
  check("5. renderer centres vertically (alignItems center over full safe height)", /alignItems:\s*"center"/.test(scene) && /height:\s*SAFE_H/.test(scene));
  check("5. renderer text-aligns centre", /textAlign:\s*"center"/.test(scene));
  check("5. renderer no longer top-anchors to a third", !/SAFE_H\s*\*\s*0\.22/.test(scene));
}

/* 6. Typography cannot overflow the safe area. */
{
  const src = readFileSyncSafe("src/skills/remotion-render/visual-engine/directed-scene.jsx");
  // Ignore comment lines: the file explains in prose why layoutWords is gone.
  const codeLines = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
  check("6. TypographyScene uses fitSingleLine", /fitSingleLine\(/.test(src));
  check("6. no remaining call to the two-row layoutWords", !codeLines.some((l) => /layoutWords\s*\(/.test(l)),
    codeLines.filter((l) => /layoutWords\s*\(/.test(l)).join(" | "));
  check("6. two-row layoutWords helper is gone", !/function layoutWords/.test(src));
  check("6. line is nowrap (cannot wrap)", /whiteSpace:\s*"nowrap"/.test(src));
  // Long phrase: condensed rather than shrunk below the readable floor.
  const f = fitSingleLine("Most people don't realize how much money they're losing every single month", FIT_W, FIT_H);
  check("6. over-long phrase condensed, not shrunk to illegible", f.condensed && f.size >= TYPO_MIN_READABLE_PX, `size=${f.size.toFixed(1)} condensed=${f.condensed}`);
  check("6. condensed result is one line within width", f.lines === 1 && estimateEmWidth(f.text) * f.size <= FIT_W + 0.5);
}

/* 7. Frequency / monoculture rules still work. */
{
  check("7. beat-share cap is defined and sane", TYPO_MAX_BEAT_SHARE > 0 && TYPO_MAX_BEAT_SHARE <= 0.5, String(TYPO_MAX_BEAT_SHARE));
  const auditor = readFileSyncSafe("scripts/local-visual-auditor.js");
  check("7. auditor measures text-beat share", /textBeatShare/.test(auditor));
  check("7. auditor measures consecutive text runs", /longestTextRun/.test(auditor));
  check("7. auditor detects repeated phrases", /repeatedPhrases/.test(auditor));
  check("7. auditor flags multi-line / headline / transcript beats", /multiLineBeats/.test(auditor) && /headlineLikeBeats/.test(auditor) && /transcriptLikeBeats/.test(auditor));
  check("7. auditor risk includes typography", /narrative typography/i.test(auditor));
}

/* 8 & 9. A typography beat coexists with real visual treatments, and
   non-typography beats are NOT auto-converted to typography. */
{
  const fps = 30;
  const cues = [
    { text: "Two operators billed Medicare thirty four million dollars.", startFrame: 0, durationInFrames: 120, endFrame: 120 },
    { text: "The claims kept stacking up month after month.", startFrame: 120, durationInFrames: 120, endFrame: 240 },
    { text: "Do you notice it happening?", startFrame: 240, durationInFrames: 120, endFrame: 360 },
  ];
  const visualPlan = {
    beats: [
      { index: 0, mechanism: "PHYSICAL_GROWTH", visual_headline: "$34 MILLION",
        typography_direction: { phrase: "$34 MILLION", moment: "key_fact" },
        direction: { subject: "stack of claim forms", graph_justified: false } },
      { index: 1, mechanism: "VISIBLE_CONSUMPTION", visual_headline: "",
        typography_direction: null, direction: { subject: "draining ledger", typography: "none" } },
      { index: 2, mechanism: "TYPOGRAPHY", visual_headline: "Do I need it?",
        typography_direction: { phrase: "Do I need it?", moment: "question" },
        direction: { subject: "purchase decision" } },
    ],
  };
  const { beats } = direct(cues, { visualPlan, seed: 7 });
  check("8. directed plan produced all beats", beats.length === 3, `got ${beats.length}`);
  const mechs = beats.map((b) => b.treatment);
  check("8. typography beat coexists with non-text visual mechanisms",
    mechs.includes("TYPOGRAPHY") && mechs.some((m) => m && m !== "TYPOGRAPHY"), mechs.join(","));
  check("9. PHYSICAL_GROWTH beat stayed PHYSICAL_GROWTH (not converted to typography)",
    mechs[0] === "PHYSICAL_GROWTH", `got ${mechs[0]}`);
  check("9. VISIBLE_CONSUMPTION beat stayed VISIBLE_CONSUMPTION",
    mechs[1] === "VISIBLE_CONSUMPTION", `got ${mechs[1]}`);
  // Every rendered phrase is inside the narrative budget and one line.
  for (const b of beats) {
    const t = b.text || "";
    check(`8. beat ${b.beat_id} phrase within budget & single line ("${t}")`,
      !/[\r\n]/.test(t) && wordCount(t) <= TYPO_HARD_MAX_WORDS, `${wordCount(t)} words`);
  }
  check("9. director never emits the raw narration as on-screen text",
    !beats.some((b) => b.text && b.text === b.original_text && wordCount(b.text) > TYPO_TARGET_MAX_WORDS));
}

/* 10. Gemini's contract explicitly distinguishes narrative vs headline. */
{
  const planSrc = readFileSyncSafe("scripts/gemini-visual-plan.js");
  check("10. plan prompt states NARRATIVE EMPHASIS, NOT HEADLINE DESIGN", /NARRATIVE EMPHASIS, NOT HEADLINE DESIGN/.test(planSrc));
  check("10. plan prompt requires ONE LINE", /ONE LINE\./.test(planSrc));
  check("10. plan prompt sets the 2-7 word budget", /2-7 WORDS/.test(planSrc));
  check("10. plan prompt bans the generic headline labels", /The Psychology Behind It/.test(planSrc));
  check("10. plan prompt forbids transcript/subtitles", /not a transcript and not subtitles/i.test(planSrc));
  check("10. plan prompt marks typography as selective, not default", /TYPOGRAPHY IS SELECTIVE, NOT THE DEFAULT/.test(planSrc));
  check("10. plan prompt has the anti-laziness rule", /ANTI-LAZINESS/.test(planSrc));
  check("10. contract requires structured typography_direction fields",
    /typography_direction/.test(planSrc) && /not_a_headline/.test(planSrc) && /not_a_transcript/.test(planSrc) && /single_line/.test(planSrc));
  check("10. contract is enforced in code, not just prose", /enforceTypographyContract/.test(planSrc));

  const bible = JSON.parse(readFileSyncSafe("config/visual-bible.json"));
  check("10. Bible has narrative-not-headline rule (CRITICAL)",
    bible.rules["TYP-09"]?.name === "narrative-not-headline" && bible.rules["TYP-09"].severity === "CRITICAL");
  check("10. Bible TYP-01 forbids a second supporting line",
    /no 'primary line plus a short supporting line'/i.test(bible.rules["TYP-01"].description));
  check("10. Bible TYP-05 now centres by default", /CENTRED BY DEFAULT/.test(bible.rules["TYP-05"].description));
  check("10. Bible has selectivity rule", !!bible.rules["TYP-10"]);
  check("10. Bible review prompts ask the narrative-typography question",
    /NARRATIVE TYPOGRAPHY CHECK/.test(bible.prompts.scene_review) && /NARRATIVE TYPOGRAPHY CHECK/.test(bible.prompts.whole_video_review));

  const reviewSrc = readFileSyncSafe("scripts/gemini-frame-review.js");
  check("10. post-render review classifies typography behaviour", /typography_behaviour/.test(reviewSrc));
  check("10. post-render review does not ask 'does it look good'", /judge BEHAVIOUR, not looks/.test(reviewSrc));
  check("10. post-render review has HEADLINE/SUBTITLE/MULTI_LINE labels",
    /HEADLINE\s+—/.test(reviewSrc) && /SUBTITLE\s+—/.test(reviewSrc) && /MULTI_LINE\s+—/.test(reviewSrc));
  check("10. review routes typography failures to a verdict reason", /NARRATIVE_TYPOGRAPHY —/.test(reviewSrc));
}

console.log("\n═══ NARRATIVE TYPOGRAPHY CONTRACT TESTS ═══");
for (const r of results) console.log(r);
console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
