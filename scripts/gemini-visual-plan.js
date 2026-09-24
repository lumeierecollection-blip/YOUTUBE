#!/usr/bin/env node
/**
 * Gemini Visual Planner — pre-render direction.
 *
 * Gemini reads the full script and voiceover timing, then decides for
 * each beat: what visual headline to show (NOT the transcript), what
 * treatment/mechanism to use, and why. The output is a visual-plan.json
 * that the render system consumes to override the default director.
 *
 * Usage:
 *   node scripts/gemini-visual-plan.js --script <path> --srt <path> --channel <id> --out <plan.json>
 *   node scripts/gemini-visual-plan.js --script <path> --srt <path> --channel <id> --out <plan.json> --corrections <prev-review.json>
 *
 * --corrections   Feed the previous Gemini review's corrections back in
 *                 so the plan is refined rather than regenerated.
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
// The vocabulary is GENERATED into the prompt from scene-primitives.js, never
// restated by hand. Hand-maintained duplicates are what put three
// conflicting word budgets in three files and cost two channels their runs.
import {
  vocabularyDigest, validateScene,
} from "../src/skills/remotion-render/visual/scene-primitives.js";
import {
  condenseToPhrase, validateNarrativePhrase, wordCount, toSingleLine,
  TYPO_TARGET_MAX_WORDS, TYPO_HARD_MAX_WORDS, TYPO_MOMENTS, TYPO_MAX_BEAT_SHARE,
} from "../src/skills/remotion-render/visual/narrative-typography.js";
import {
  compactCapabilityDigest, compileScene, isMechanismBased, mechanismToCapability,
} from "../src/skills/remotion-render/visual/capability-compiler.js";
import { callGemini as callGeminiApi } from "../src/lib/gemini-client.js";

const { enforceCaps, describe: describeMechanisms, TYPOGRAPHY } = createRequire(import.meta.url)("./plan-caps.cjs");

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

/**
 * Enforce the narrative-typography contract on a returned plan, in place.
 *
 * Deterministic repair, not advice: any phrase that will go on screen is
 * normalised to ONE line within the word budget, and the reasons it was
 * out of contract are recorded so the post-render review and the local
 * auditor can attribute the failure. Semantic quality ("is this a GOOD
 * piece of emphasis?") stays with Gemini — this only fixes what is
 * measurable.
 */
function enforceTypographyContract(beats, sentences) {
  const repaired = [];
  const violations = [];
  let textBeats = 0;

  beats.forEach((b, i) => {
    const narration = sentences[i]?.text || null;
    const td = b.typography_direction && typeof b.typography_direction === "object"
      ? b.typography_direction : null;
    const hasText = !!(td?.phrase) || b.mechanism === "TYPOGRAPHY"
      || (b.direction?.typography && String(b.direction.typography).toLowerCase() !== "none");
    if (!hasText) {
      // A beat with no on-screen text must not carry a stale phrase.
      b.typography_direction = null;
      return;
    }
    textBeats++;

    const source = td?.phrase || b.visual_headline || b.direction?.typography || "";
    const check = validateNarrativePhrase(source, { narration });
    const finalPhrase = check.ok ? toSingleLine(source) : check.normalized;

    if (!check.ok || finalPhrase !== toSingleLine(source)) {
      repaired.push({ index: i, before: toSingleLine(source), after: finalPhrase, reasons: check.reasons });
    }
    if (!check.ok) violations.push({ index: i, reasons: check.reasons });

    // The renderer draws beat.text / visual_headline, so both carry the
    // corrected single-line phrase.
    b.visual_headline = finalPhrase;
    b.typography_direction = {
      phrase: finalPhrase,
      why: td?.why || null,
      moment: TYPO_MOMENTS.includes(td?.moment) ? td.moment : "statement",
      single_line: true,
      not_a_headline: true,
      not_a_transcript: true,
      relation_to_visual: td?.relation_to_visual || null,
      enforced: !check.ok ? check.reasons : undefined,
    };
    if (b.direction) b.direction.typography = finalPhrase;
  });

  return {
    textBeats,
    textBeatShare: beats.length ? textBeats / beats.length : 0,
    repaired, violations,
  };
}

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.split("=").slice(1).join("=") : fallback;
}

function parseSrt(srtText) {
  return srtText.split(/\n\n+/).map((block) => {
    const lines = block.trim().split("\n");
    if (lines.length < 3) return null;
    const [start, end] = lines[1].split(" --> ").map((t) => {
      const [h, m, rest] = t.trim().split(":");
      const [s, ms] = rest.split(",");
      return (+h * 3600) + (+m * 60) + +s + +ms / 1000;
    });
    return { start, end, text: lines.slice(2).join(" ") };
  }).filter(Boolean);
}

// Interpolated into the prompt below. It was computed and never used, so
// Gemini composed without ever seeing the primitive, anchor or motion
// names — run 35933424177 dropped 5/6 ch-1 compositions for invented words
// like motion "converge".
const VOCABULARY = vocabularyDigest();
{
  const lib = VOCABULARY.split("\n").find((l) => l.startsWith("LIBRARY"));
  console.log(`[vocab] library_shape exposes ${lib ? lib.split(" | ").length : 0} drawings to the planner`);
}

function buildPlanPrompt(sentences, corrections) {
  const sentenceList = sentences.map((s, i) =>
    `[${i}] (${s.start.toFixed(1)}s-${s.end.toFixed(1)}s) "${s.text}"`
  ).join("\n");

  let correctionBlock = "";
  if (corrections?.length) {
    correctionBlock = `\n\nPREVIOUS REVIEW CORRECTIONS — apply these fixes:\n` +
      corrections.map((c) => `  ${c.scene || c.beat}: ${c.problem} → Fix: ${c.fix || c.action}`).join("\n") +
      `\n\nAdjust your plan to address every correction above.\n`;
  }

  const CAPABILITIES = compactCapabilityDigest();

  return `You are the VISUAL DIRECTOR for a YouTube Shorts video (vertical 1080x1920, ~60s).

THE FUNDAMENTAL RULE: Never visualize a sentence. Visualize what the sentence is DOING.
The video is not a collection of scenes — it is one continuous visual argument.

For each sentence, answer these questions BEFORE choosing visual events:
- What is the IMPORTANT OBJECT in this sentence?
- What ACTION happens to it?
- What CHANGES?
- What should the viewer UNDERSTAND without audio?
- What can be SHOWN instead of told?
- What should REMAIN from the previous beat?

VISUAL HEADLINE RULES:
- The on-screen text is NOT the transcript. It is ONE SHORT VISUAL THOUGHT (max 5-6 words).
- Typography should behave like a designed object, not a document.
- Numbers must have physical meaning — don't just float "22.4 WEEKS" alone.
- Example: Transcript "Only forty-seven percent of Americans can handle a four-hundred-dollar emergency" → Visual headline: "47% CAN'T COVER $400"

## VISUAL CAPABILITIES — what you compose from

Instead of picking a mechanism, you describe VISUAL EVENTS. The system maps your events to buildable primitives.

${CAPABILITIES}

## PRIMITIVE VOCABULARY — the only kinds, anchors and motions the renderer builds

${VOCABULARY}

## HOW TO COMPOSE

For each beat, declare:
1. "visual_events": what happens visually (the EVENTS, not the template)
2. "capabilities": which capabilities you're using (for validation)
3. "composition": the specific primitives on screen (REQUIRED)

The "visual_events" field is your creative direction. The "composition" field is
what the viewer literally sees. Compose it from the primitive vocabulary above;
the system builds exactly what you declare and rejects anything it cannot build.

Rules that are enforced, not advisory:
- A scene must cover at least 35% of the frame. A beat carrying one text
  line and nothing else is REJECTED — that is the single defect this
  vocabulary exists to remove. Reach the floor with real objects (a grid, a
  field, a stack with a real count, documents), never by enlarging text.
- Declare "field" FIRST when you want depth; it is the ground plane and
  stops objects reading as though they float in a void.
- "emphasis: true" marks the ONE object carrying the beat. Everything else
  is structure. Do not mark several.
- The primitives are abstract shapes, so an unlabelled block cannot tell
  the viewer WHAT it is. The frame review asks "would a viewer with the
  sound off get this sentence's point from what is drawn?" — in QA run
  35916464573 every unlabelled-block beat failed it ("abstract blocks do
  not represent the Strait of Hormuz"), and the one beat that passed was a
  bar labelled with the sentence's subject against a 0-100% scale.
  Do not select icons. Describe the subject as a data relationship: what
  quantity, what comparison, what process, what location.
  To DRAW the sentence's subject, use "library_shape" with a "name" from
  the LIBRARY list (exact spelling): a court ruling -> "courthouse column"
  or "court document"; money moving -> "money trail" or "cash notes"; a
  process -> "concept node", "link path", "process arrow". Pair it with
  the abstract primitives that carry the quantity or relation. If nothing
  in LIBRARY fits, compose from the abstract primitives alone — never
  invent a name.
  PLACES are real maps drawn from real borders. When the sentence is about a
  country or a US state, use one of these, and set "label" to that place's
  name exactly as the narration says it (e.g. "Venezuela", "Florida"):
    "map-region-highlight" — the region outlined, then filled (default)
    "map-markers"          — the region plus "count" markers (a real number
                             from the sentence: 12 sites, 5 raids)
    "map-route"            — movement between two places; label "A → B"
    "map-outline" / "map-label" — the region without the fill
  A map draws its own label; the label must be the place, not a headline.
  Cities, provinces outside the US and invented regions are NOT drawable —
  a map whose label is not a country or US state is rejected.
  HYPHENS ARE ONLY FOR THOSE FIVE MAP NAMES. Every other LIBRARY name is
  space-separated, exactly as printed in the LIBRARY list below — "process
  arrow", not "process-arrow"; "case file folder", not "case-file-folder";
  "gauge dial", not "gauge-dial". Copy the spelling from LIBRARY verbatim;
  do not hyphenate a name because the map names nearby are hyphenated. A
  name validateScene rejects drops that beat's whole composition.
  The "emphasis" object ALWAYS carries a 1-3 word "label" naming the
  specific thing, place, group, or quantity from THIS sentence ("Hormuz",
  "Tenants", "$2M fine", "9 years"). When the sentence relates two things
  (A vs B, A causes B, A moves to B), label both, so the relation reads
  without sound. Structure (field, grid, rule, background stacks) stays
  unlabelled. At most 3 labels per beat. A label is a name or a number
  taken from the sentence — never a headline, never a sentence fragment,
  never a generic word like "CAUSE", "EFFECT", "EXPECTED", "ACTUAL",
  "RESEARCH", "TERMS", "MATRIX".
- "count" must be a real quantity from the narration where one exists — 12
  plants, 8 states, 3 filings. It is a visible number, so an invented count
  is an invented fact.
- Vary the composition across beats. Six beats that all declare the same
  objects is the template monoculture this replaces.

NARRATIVE TYPOGRAPHY — READ THIS BEFORE WRITING ANY TYPOGRAPHY BEAT.

Typography is NARRATIVE EMPHASIS, NOT HEADLINE DESIGN. The narrator explains,
the visual demonstrates, the typography EMPHASISES — the three layers must not
repeat each other. A typography beat should make the viewer think "what is the
narrator saying? — oh, I see what the visual is showing me."

It must NEVER look like: a news headline, an article title, a presentation
slide, a title card, a lower third, a subtitle/caption track, a paragraph, a
thumbnail, or a section heading.

HARD RULES (a plan that breaks these is rejected before rendering):
- ONE LINE. Never two lines, never a headline + subheadline, never stacked
  text, never a title + supporting sentence. If the phrase will not fit on one
  line, WRITE A SHORTER PHRASE — do not expect the renderer to shrink it.
- 2-7 WORDS. 8-9 is unusual. More than ${TYPO_HARD_MAX_WORDS} words is narration, not emphasis.
- ONE THOUGHT, centred in the frame.
- NEVER the narration verbatim, and never a near-restatement of it. Typography
  is not a transcript and not subtitles.
- NO generic headline/topic labels: "The Problem", "The Solution", "The Hidden
  Cost", "Why This Happens", "The Psychology Behind It", "Financial Mistakes",
  "Consumer Behavior" — these are prohibited unless the phrase genuinely
  functions as spoken narrative emphasis.
- The phrase animates as ONE object. Do not ask for word-by-word/karaoke reveal.

GOOD (narrative emphasis):   "Why does this keep happening?" · "You barely
notice it." · "One purchase at a time." · "Do I need it?" · "$34 MILLION" ·
"Need it — or want it?"
BAD (headline/subtitle):     "The Hidden Psychological Cost Of Modern Consumer
Behavior" · "THE SHOCKING TRUTH ABOUT WHY PEOPLE KEEP SPENDING" · "Most people
don't realize how much money they're losing every month"

TYPOGRAPHY IS SELECTIVE, NOT THE DEFAULT. The rhythm is:
HOOK (one centred line) -> VISUAL STORYTELLING (no text) -> RE-HOOK (one line
at a real turn in the narration) -> VISUAL CONSEQUENCE -> maybe a KEY FACT
("$34 MILLION") -> back to visual storytelling.
Do NOT put typography in every beat. TEXT -> TEXT -> TEXT -> TEXT is a failure.

ANTI-LAZINESS: typography is NOT the fallback for a beat you could not think
of a visual for. If you cannot think of a visual, that is not permission to put
a big sentence in the centre of the screen — think harder about the object, the
action, the consequence, the document, the map, the environment.

THE GRAPH / NUMBER RULE (this is what makes videos feel generic — obey it):
- A number appearing in a sentence is NOT a reason to reach for evidence. Ask
  what the number MEANS and show that: "$1,400 drained per year" is money leaving a
  wallet (depletion), "gas up 24.6%" is a pump price climbing (growth),
  "50% vs 66%" is two things of different size (comparison).
- Reach for a chart/bar/figure ONLY when the sentence is genuinely ABOUT quantitative
  comparison, trend, or measurement AND no physical/spatial form communicates it better.
- If removing the narration would leave only a floating number or a headline, the visual
  is decorative — pick an object-first event instead.

THE MUTED TEST: for every beat, if the viewer had no audio, would the visual still carry
real information — an object, a change, a comparison, a consequence? If it would look
identical under almost any other sentence, it is monoculture. Reject it and re-choose.

DISTRIBUTION RULES (a plan that violates these will be rejected downstream):
- Across the whole video, AT MOST ~1 in 3 beats may be TEXT-FORWARD (typographic_emphasis
  + evidence combined). The majority MUST be object-first visual events.
- typographic_emphasis is for the opening hook and the closing CTA — typically 2 beats total,
  rarely more. Do not use it for ordinary statements; find what the statement SHOWS.
- NEVER repeat the same visual event more than twice in a row, and do not alternate
  headline/figure/headline/figure — that reads as one template on repeat.
- Use AT LEAST 5 distinct visual events across the video, drawn mostly from the object-first
  family. Consecutive beats should differ in VISUAL FORM, not just in event name.
- The first beat MUST be a strong hook; the last beat a clear CTA or payoff.
- Use carries_forward when an object continues (a sum shown, then consumed) so the visual
  argument flows rather than resetting each beat.

YOU ARE A DIRECTOR, NOT A TEMPLATE PICKER. For every beat you must write real
direction — describe the visual EVENT, not "which template". The "direction"
block below is the AUTHORITATIVE intent: after the video renders, you will be
shown the actual frames and asked whether they executed exactly this direction,
so make it specific and answerable. Lazy direction ("show a graph of the
numbers", "display the text") is structurally invalid — fill every field
concretely:
- subject: what the composition primitives LITERALLY show on screen (e.g. "A gauge
  showing 3.4%", "Two bars labelled Annual and Core", "A stack of 3 blocks") —
  NOT a real-world scene description. The renderer draws abstract shapes, not
  photographs.
- environment: where this lives (dim archival desk; clean data void; a kitchen counter).
- action_start / action_end: the visual STATE at the beat's start and at its end —
  what physically changes across the ~4s (one claim form -> a towering stack).
- camera: what the camera does (hold; slow push-in on the total; track back as the
  stack grows; orbit).
- motion: how things move and with what weight (claims land faster and heavier;
  a number ticks up then slams; a bar cracks and shards fall).
- typography: the ONLY text on screen and where (e.g. "$34 MILLION", upper third) —
  never the sentence.
- sound: the semantic accent this beat wants (paper impacts; a lock snap; silence).
- consequence: what the viewer should FEEL/understand from the visual event.
- muted_read: what a viewer with NO audio would understand from this beat alone.
- why_visual: why THIS visual represents THIS narration and could not be swapped
  onto any other sentence.
- graph_justified: true ONLY if the beat is genuinely about quantitative
  comparison/trend/measurement AND no physical form communicates it better;
  otherwise false. If false, you may not choose evidence as a bar/graph.

DO NOT pick a familiar event merely because it is easy to render. Direct the
strongest visual event first; capabilities are only the closest EXECUTION mapping for
the renderer, and the post-render review will check whether the render actually
delivered your directed event.

CRITICAL: The direction.subject MUST describe what the composition primitives
will literally show on screen — NOT a real-world scene that cannot be rendered.
For example, if composition uses {kind: "gauge", label: "3.4%"}, then direction.subject
must be "A gauge showing 3.4%" — NOT "A digital economic gauge showing a cooling
temperature". The renderer draws abstract primitives, not photographs. The review
compares direction.subject against what the primitives actually render, so a
direction that describes a real-world scene will always FAIL plan-compliance.

FOR EVERY BEAT THAT PUTS TEXT ON SCREEN (typographic_emphasis capability, or any beat whose
direction.typography is not "none") you MUST fill "typography_direction":
  phrase              the EXACT short phrase, one line, 2-7 words
  why                 why this phrase matters to the narration
  moment              one of: ${TYPO_MOMENTS.join(" | ")}
  single_line         must be true
  not_a_headline      must be true — confirm it is narrative emphasis, not a title/label
  not_a_transcript    must be true — confirm it is not the narration restated
  relation_to_visual  how the phrase relates to (and does NOT merely describe) the visual
For beats with NO on-screen text, set "typography_direction": null.

SCRIPT SENTENCES:
${sentenceList}
${correctionBlock}
Respond ONLY with JSON (no markdown fences):
{
  "beats": [
    {
      "index": 0,
      "visual_headline": "<SHORT on-screen text — NOT the transcript, max 5-6 words>",
      "reason": "<what the sentence is DOING and why this visual shows it>",
      "emphasis_words": ["<key words to highlight>"],
      "visual_events": [
        {
          "type": "<growth|depletion|comparison|revelation|structure_break|accumulation|population|evidence|contrast|causation>",
          "label": "<optional label for the event>",
          "magnitude": "<optional number/value if applicable>"
        }
      ],
      "capabilities": ["<list of capabilities used: growth, depletion, comparison, etc.>"],
      "objects": {
        "label_a": "<for contrast: before label>",
        "label_b": "<for contrast: after label>",
        "figure": "<for evidence: the number>",
        "cause": "<for causation: cause label>",
        "effect": "<for causation: effect label>"
      },
      "composition": {
        "objects": [
          { "kind": "<primitive>", "anchor": "<anchor>", "motion": "<motion>" },
          { "kind": "<countable primitive>", "count": 12, "anchor": "<anchor>", "motion": "<motion>", "label": "<short label>" },
          { "kind": "library_shape", "name": "<exact name from LIBRARY>", "anchor": "<anchor>", "motion": "<motion>", "label": "<short label>", "emphasis": true }
        ]
      },
      "carries_forward": "<object/concept that persists into the next beat, or null>",
      "emotional_weight": "<calm|building|sharp|heavy|urgent>",
      "typography_direction": {
        "phrase": "<exact one-line phrase, 2-7 words — or omit this whole object if the beat has no text>",
        "why": "<why this phrase matters to the narration>",
        "moment": "<hook|re_hook|key_fact|contradiction|question|statement>",
        "single_line": true,
        "not_a_headline": true,
        "not_a_transcript": true,
        "relation_to_visual": "<how it relates to the visual scene without describing it>"
      },
      "direction": {
        "narrative_purpose": "<what this beat must accomplish in the argument>",
        "subject": "<LITERALLY what the composition primitives show — not a real-world scene>",
        "environment": "<where it lives>",
        "action_start": "<visual state at beat start>",
        "action_end": "<visual state at beat end>",
        "camera": "<hold|push_in|pull_back|track|orbit|tilt — what it does>",
        "motion": "<how things move and with what weight>",
        "typography": "<the only on-screen text and its position, or 'none'>",
        "sound": "<semantic sound accent, or 'silence'>",
        "consequence": "<what the viewer should feel/understand>",
        "muted_read": "<what a viewer with no audio understands from this beat>",
        "why_visual": "<why this visual is specific to THIS narration>",
        "graph_justified": false
      }
    }
  ]
}`;
}

async function main() {
  const scriptPath = arg("script");
  const srtPath = arg("srt");
  const channelId = arg("channel");
  const outPath = arg("out");
  const correctionsPath = arg("corrections");

  if (!scriptPath || !outPath) {
    console.error("Usage: gemini-visual-plan.js --script <path> --srt <path> --channel <id> --out <plan.json>");
    process.exit(2);
  }

  let sentences = [];
  const srt = srtPath && existsSync(srtPath) ? srtPath : (srtPath ? join(ROOT, srtPath) : null);
  if (srt && existsSync(srt)) {
    sentences = parseSrt(readFileSync(srt, "utf-8").replace(/\r\n/g, "\n"));
    console.log(`SRT loaded: ${sentences.length} sentences`);
  } else {
    const scriptData = JSON.parse(readFileSync(join(ROOT, scriptPath), "utf-8"));
    const text = scriptData.voiceover_text || scriptData.script || "";
    sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10).map((s, i) => ({
      start: i * 5, end: (i + 1) * 5, text: s.trim(),
    }));
    console.log(`Script parsed: ${sentences.length} sentences (no SRT)`);
  }

  if (!sentences.length) {
    console.error("No sentences found in script/SRT.");
    process.exit(2);
  }

  let corrections = null;
  if (correctionsPath && existsSync(correctionsPath)) {
    const review = JSON.parse(readFileSync(correctionsPath, "utf-8"));
    corrections = review.corrections || review.wholeVideoResult?.corrections || [];
    if (corrections.length) {
      console.log(`Applying ${corrections.length} correction(s) from previous review`);
    }
  }

  console.log(`Requesting visual plan from Gemini for ${sentences.length} beats...`);
  const prompt = buildPlanPrompt(sentences, corrections);
  // Token budget scales with beat count so the JSON never truncates
  // mid-object (a 51-beat script once came back as "Unexpected end of JSON
  // input"). Each beat now carries the full director "direction" block
  // (~13 fields), so the per-beat budget is much larger than the old
  // headline-only estimate — ~600 tokens/beat plus headroom, capped at
  // 16384. A script needing more beats than that fits is a pacing problem
  // in the script/caption split, not something to fix here.
  // Raised from 600/beat: QA run 35931611864 got '{ "beats": [...' that
  // would not parse on 4 of 6 channels (5-6 beats, 5000-5600 tokens) — the
  // answer is cut off at the budget. describeShape() logs the answer's
  // length and tail so a cut-off is visible in the log, not guessed.
  const maxTokens = Math.min(16384, 2000 + sentences.length * 1500);
  let geminiResult = normalizePlanResponse(
    await callGeminiApi([{ role: "user", content: prompt }], { maxTokens, temperature: 0.2 }));

  // CI runs showed Gemini intermittently answering without a top-level
  // "beats" key (a bare array, a wrapper key, or JSON behind prose). The
  // client caches whatever it got, so a plain retry would replay the same
  // bad answer — the one retry below bypasses the cache and restates the
  // required shape. Still no beats after that → exit 1, nothing invented.
  if (!geminiResult?.beats) {
    console.error(`Gemini plan attempt 1 had no 'beats' — got: ${describeShape(geminiResult)}. Retrying once uncached.`);
    const strict = prompt + "\n\nReturn ONLY one JSON object whose top-level key is \"beats\" (an array with exactly " + sentences.length + " entries, one per sentence, in order). No prose, no markdown fences, no other top-level keys.";
    geminiResult = normalizePlanResponse(
      await callGeminiApi([{ role: "user", content: strict }], { maxTokens, temperature: 0.2, noCache: true }));
  }

  // No OpenCode fallback here any more: OpenCode isn't installed in the
  // render job, so it only ever failed with ENOENT and buried Gemini's real
  // error. A failed Gemini plan exits non-zero; render-and-qa.js then runs
  // the local planner and logs that it did.
  const plan = geminiResult?.beats ? geminiResult : null;
  if (!plan || !plan.beats) {
    console.error(`Gemini plan failed: ${geminiResult?.error || "response had no 'beats' — got: " + describeShape(geminiResult)}`);
    process.exit(1);
  }

  // ── ENFORCE THE NARRATIVE-TYPOGRAPHY CONTRACT ─────────────────────────
  // The prose rules above are not trusted on their own. Every phrase the
  // plan puts on screen is normalised to a single line inside the word
  // budget, and blocking violations (headline/topic label, transcript
  // restatement, over-cap length) are reported and repaired here so the
  // renderer and the manifest both carry the corrected phrase.
  const typoReport = enforceTypographyContract(plan.beats, sentences);
  if (typoReport.repaired.length) {
    console.warn(`::warning::narrative-typography: repaired ${typoReport.repaired.length} phrase(s)`);
    for (const r of typoReport.repaired) {
      console.warn(`  beat ${r.index}: "${r.before}" -> "${r.after}"  (${r.reasons.join("; ")})`);
    }
  }
  if (typoReport.textBeatShare > TYPO_MAX_BEAT_SHARE) {
    console.warn(`::warning::narrative-typography: ${Math.round(typoReport.textBeatShare * 100)}% of beats carry on-screen text (max ${Math.round(TYPO_MAX_BEAT_SHARE * 100)}%) — typography should be selective, not the default`);
  }
  console.log(`Narrative typography: ${typoReport.textBeats}/${plan.beats.length} text beats, ${typoReport.repaired.length} repaired, ${typoReport.violations.length} violation(s)`);

  // ── COMPILE CAPABILITY-BASED DIRECTIVES ─────────────────────────────
  // Convert Gemini's creative visual specification into buildable scenes.
  // This is where the capability compiler validates and normalizes.
  const compilationReport = [];
  for (const b of plan.beats) {
    // Backward compatibility: convert mechanism-based to capability-based
    if (isMechanismBased(b) && !b.visual_events) {
      const converted = mechanismToCapability(b);
      if (converted) {
        b.visual_events = converted.visual_events;
        b.capabilities = converted.capabilities;
      }
    }

    // Compile the directive into a validated scene
    const { scene, warnings, errors } = compileScene(
      b,
      sentences[b.index]?.text || "",
      b.index,
      plan.beats.length
    );

    if (errors.length) {
      compilationReport.push({ beat: b.index, errors, warnings });
    }
    if (warnings.length) {
      for (const w of warnings) {
        console.warn(`::warning::beat ${b.index} compilation: ${w}`);
      }
    }

    // Attach compiled scene if available
    if (scene) {
      b.compiledScene = scene;
    }
  }
  console.log(`Capability compilation: ${compilationReport.length} issue(s) across ${plan.beats.length} beats`);

  // COMPOSITION VALIDATION — at plan time, before anything renders.
  //
  // A declaration the renderer cannot build is worth nothing, and an
  // unbuildable directive that still "applies" is the failure mode this
  // pipeline already had (REMOVE_TYPOGRAPHY applied, verified, and was
  // silently undone). So each beat's composition is checked here and the
  // errors become corrections for the next planning pass — which is where
  // RENDER_TECHNICAL finally becomes actionable instead of a verdict nobody
  // can act on.
  // Vocabulary synonyms Gemini keeps using, mapped to the primitive
  // vocabulary's own words (scene-primitives.js MOTIONS/ANCHORS). Run
  // 35835281167 rejected 15 compositions at render time for exactly these:
  // motion "static"/"none", anchor "ground". Only exact synonyms are mapped;
  // anything else still fails validation.
  const MOTION_SYNONYMS = { static: "hold", none: "hold", still: "hold", fixed: "hold", idle: "hold",
    growth: "grow", fade_in: "appear", fadein: "appear", slide_up: "rise", slide_down: "fall" };
  const ANCHOR_SYNONYMS = { ground: "bottom", floor: "bottom", middle: "center", centre: "center" };
  for (const b of plan.beats) {
    for (const o of b.composition?.objects || []) {
      const m = String(o.motion || "").toLowerCase();
      const a = String(o.anchor || "").toLowerCase();
      if (MOTION_SYNONYMS[m]) { console.log(`[vocab] beat ${b.index}: motion "${o.motion}" -> "${MOTION_SYNONYMS[m]}"`); o.motion = MOTION_SYNONYMS[m]; }
      if (ANCHOR_SYNONYMS[a]) { console.log(`[vocab] beat ${b.index}: anchor "${o.anchor}" -> "${ANCHOR_SYNONYMS[a]}"`); o.anchor = ANCHOR_SYNONYMS[a]; }
    }
  }

  const compositionIssues = [];
  let composedBeats = 0;
  for (const b of plan.beats) {
    if (!b.composition || !Array.isArray(b.composition.objects) || !b.composition.objects.length) {
      compositionIssues.push({
        beat: b.index,
        problem: "no composition declared — the beat has nothing to render but text",
        fix: "declare composition.objects using the primitive vocabulary; a scene must cover at least 35% of the frame",
      });
      continue;
    }
    const v = validateScene(b.composition);
    b.compositionCoverage = v.coverage;
    b.compositionValid = v.ok;
    if (!v.ok) {
      for (const e of v.errors) {
        compositionIssues.push({ beat: b.index, problem: e, fix: "re-compose this beat from the declared primitives" });
      }
    } else {
      composedBeats++;
    }
    for (const w of v.warnings) {
      console.warn(`::warning::beat ${b.index} composition: ${w}`);
    }
  }
  console.log(`Composition: ${composedBeats}/${plan.beats.length} beats buildable, ${compositionIssues.length} issue(s)`);
  for (const i of compositionIssues.slice(0, 10)) {
    console.warn(`  beat ${i.beat}: ${String(i.problem).split(" — ")[0]}`);
  }

  // ── CAPS: TYPOGRAPHY 1–2, NO MECHANISM OVER 40% ──────────────────────
  // Applied here, before the plan is written, not in the QA correction loop
  // (which --skip-qa bypasses). A beat's effective mechanism is the one the
  // director will render: its explicit `mechanism`, else the mechanism its
  // capability directive compiles to. A beat with neither cannot be
  // directed, so the plan is rejected rather than handed to the renderer.
  // compileScene() labels every capability-built scene "CAPABILITY" — a
  // placeholder, not what the beat shows. Counting that label made 6 of 7
  // beats one "mechanism" and the cap then forced them onto legacy scenes
  // (run 35817394030, ch-2). A capability beat is identified by its primary
  // capability instead.
  const effectiveOf = (b) => {
    if (b.mechanism) return b.mechanism;
    const m = b.compiledScene?.mechanism;
    if (!m) return null;
    if (m !== "CAPABILITY") return m;
    const cap = (b.capabilities || [])[0] || b.visual_events?.[0]?.type;
    return cap ? `CAPABILITY:${cap}` : null;
  };
  const effective = plan.beats.map(effectiveOf);
  const undirectable = effective.map((m, i) => (m ? -1 : i)).filter((i) => i >= 0);
  if (undirectable.length) {
    console.error(`Plan rejected: beat(s) ${undirectable.join(", ")} compile to no mechanism.`);
    process.exit(1);
  }
  let capped;
  try {
    capped = enforceCaps(effective);
  } catch (e) {
    console.error(`Plan rejected: ${e.message}`);
    process.exit(1);
  }
  for (const c of capped.changes) {
    const b = plan.beats[c.beat];
    // Setting `mechanism` routes this beat through applyDirective() with the
    // capped mechanism instead of the capability compiler.
    b.mechanism = c.to;
    b.cap_reassigned = { from: c.from, why: c.why };
    if (c.to === TYPOGRAPHY) {
      // A TYPOGRAPHY beat with no phrase would render an empty frame.
      const phrase = b.typography_direction?.phrase || b.visual_headline
        || (sentences[c.beat]?.text || "").split(/\s+/).slice(0, 6).join(" ");
      b.visual_headline = b.visual_headline || phrase;
      b.typography_direction = { ...(b.typography_direction || {}), phrase };
    }
    console.log(`[caps] beat ${c.beat}: ${c.from} -> ${c.to} (${c.why})`);
  }
  console.log(`Mechanisms after caps: ${describeMechanisms(capped.mechanisms)}`);

  // A TYPOGRAPHY beat renders the typography scene; a composition on it is
  // never drawn. Cap-reassigned hooks kept Gemini's composition, which then
  // failed the coverage floor at render time and was "rejected — falling
  // back to mechanism" (ch-48 beat 0, run 35833174133). Drop it here, and
  // drop its issues from the report.
  capped.mechanisms.forEach((m, i) => {
    if (m === TYPOGRAPHY && plan.beats[i].composition) {
      plan.beats[i].composition = null;
      plan.beats[i].compositionValid = null;
    }
  });
  const typoBeats = new Set(capped.mechanisms.map((m, i) => (m === TYPOGRAPHY ? plan.beats[i].index ?? i : -1)));
  for (let k = compositionIssues.length - 1; k >= 0; k--) {
    if (typoBeats.has(compositionIssues[k].beat)) compositionIssues.splice(k, 1);
  }
  composedBeats = plan.beats.filter((b) => b.composition && b.compositionValid).length;

  // A composition that still fails validation is removed HERE, at plan
  // time, with its reason recorded on the beat (composition_dropped) and
  // counted in the plan. The beat renders its mechanism scene by plan
  // decision. Previously the renderer discovered the same thing at render
  // time and fell back silently mid-render.
  const dropped = [];
  for (const b of plan.beats) {
    if (b.composition && b.compositionValid === false) {
      const reasons = compositionIssues.filter((i) => i.beat === b.index).map((i) => String(i.problem).split(" — ")[0]);
      b.composition_dropped = { reasons, coverage: b.compositionCoverage ?? null };
      b.composition = null;
      dropped.push(b.index);
      console.log(`[plan] beat ${b.index}: composition dropped at plan time (${reasons[0] || "invalid"}) — renders its mechanism scene`);
    }
  }
  if (dropped.length) console.log(`[plan] ${dropped.length} composition(s) dropped at plan time: beats ${dropped.join(", ")}`);

  const result = {
    generatedAt: new Date().toISOString(),
    channel: channelId,
    iteration: corrections?.length ? "correction" : "initial",
    totalBeats: plan.beats.length,
    beats: plan.beats,
    composedBeats,
    compositionIssues,
    compilationReport,
    capabilityDistribution: {},
    mechanismDistribution: describeMechanisms(capped.mechanisms),
    compositionsDropped: dropped,
  };

  // Track capability usage instead of mechanism distribution
  for (const b of plan.beats) {
    const caps = b.capabilities || [];
    for (const cap of caps) {
      result.capabilityDistribution[cap] = (result.capabilityDistribution[cap] || 0) + 1;
    }
  }

  writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n");
  console.log(`Visual plan written: ${outPath}`);
  console.log(`  Beats: ${plan.beats.length}`);
  console.log(`  Capabilities: ${JSON.stringify(result.capabilityDistribution)}`);

  for (const b of plan.beats) {
    const caps = (b.capabilities || []).join(", ");
    console.log(`  [${b.index}] ${caps || "typography"}: "${b.visual_headline}" — ${b.reason}`);
  }
}

main().catch((e) => {
  console.error(`Fatal error: ${e.message}`);
  process.exit(1);
});

// Gemini's structured-JSON output frequently carries a literal control
// character (newline, tab) inside a string value -- valid as text, invalid
// as JSON, where the spec requires \n / \t. A long "reason" or narrative
// field is exactly where the model is prone to this. Walks the text with a
// small string-aware state machine and escapes control characters found
// INSIDE a string literal only; everything outside a string (the
// insignificant whitespace JSON already allows between tokens) is left
// untouched, so this cannot turn valid JSON into something different.
function escapeStrayControlCharsInStrings(text) {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = text.charCodeAt(i);
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
      } else if (ch === "\\") {
        out += ch;
        escaped = true;
      } else if (ch === '"') {
        out += ch;
        inString = false;
      } else if (code < 0x20) {
        out += code === 0x0a ? "\\n" : code === 0x0d ? "\\r" : code === 0x09 ? "\\t" : `\\u${code.toString(16).padStart(4, "0")}`;
      } else {
        out += ch;
      }
    } else {
      if (ch === '"') inString = true;
      out += ch;
    }
  }
  return out;
}

// The second common LLM-JSON defect, distinct from the one above: a comma
// immediately before a closing `]`/`}`, which every major model occasionally
// emits when it lists items and stops without deleting the last separator.
// Strict JSON forbids it ("Unexpected token ']'" is V8's error for exactly
// this). Same string-aware walk as escapeStrayControlCharsInStrings so a
// comma that happens to sit inside a string value (part of real text, not
// JSON structure) is never touched.
function stripTrailingCommasOutsideStrings(text) {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; out += ch; continue; }
    if (ch === ",") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === "]" || text[j] === "}") continue; // drop this comma
    }
    out += ch;
  }
  return out;
}

// Accepts the shapes Gemini has actually returned for a plan and maps each
// to {beats:[...]}; anything else is returned untouched so the caller fails.
//
// PART: when the embedded JSON fails to parse, this used to swallow the
// exception and fall through silently, so every parse failure surfaced to
// the caller as the generic "no beats" -- indistinguishable from Gemini
// never having sent JSON at all. Measured on CI run 36011611536: ch-1 and
// ch-2's retry both got real, complete-looking `{"beats": [...` text back
// (10971 and 13447 chars) and were still reported as no-beats. The actual
// parse errors were never logged, so there was nothing to fix.
//
// Now a parse failure retries against a chain of safe, targeted repairs --
// each one fixes a specific, well-known LLM-JSON defect and cannot change
// the meaning of text that was already valid. Run 36016703842 (after the
// first repair shipped) showed the SECOND defect this chain now also
// covers: ch-9's retry got 13480 real chars back and still failed with
// "Unexpected token ']'" -- a trailing comma the control-char pass doesn't
// touch. If every repair fails, the real SyntaxError is attached so
// describeShape can show it instead of an indistinguishable "no beats".
const JSON_REPAIRS = [
  (text) => text,
  escapeStrayControlCharsInStrings,
  (text) => stripTrailingCommasOutsideStrings(escapeStrayControlCharsInStrings(text)),
];

function normalizePlanResponse(r) {
  if (!r || r.error) return r;
  if (Array.isArray(r)) return { beats: r };
  if (Array.isArray(r.beats)) return r;
  if (typeof r.content === "string") {
    const m = r.content.match(/[\[{][\s\S]*[\]}]/);
    if (m) {
      let lastError = null;
      for (const repair of JSON_REPAIRS) {
        try {
          return normalizePlanResponse(JSON.parse(repair(m[0])));
        } catch (e) {
          lastError = e;
        }
      }
      return { ...r, _parseError: lastError.message };
    }
    return r;
  }
  for (const v of Object.values(r)) {
    if (v && typeof v === "object" && !Array.isArray(v) && Array.isArray(v.beats)) return v;
  }
  return r;
}

function describeShape(r) {
  if (!r) return String(r);
  if (r.error) return "error " + String(r.error).slice(0, 200);
  if (typeof r.content === "string") {
    const parseNote = r._parseError ? ` [JSON parse failed: ${r._parseError}]` : "";
    return `text (${r.content.length} chars)${parseNote} ${JSON.stringify(r.content.slice(0, 120))} ... ends ${JSON.stringify(r.content.slice(-120))}`;
  }
  return (Array.isArray(r) ? "array" : "object keys [" + Object.keys(r).join(",") + "]");
}
