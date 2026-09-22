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
import { spawnSync } from "node:child_process";
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

const VOCABULARY = vocabularyDigest();

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
- "label" only where a thing NEEDS naming. Labels are annotation; the
  objects carry the meaning. A scene where every object is labelled is a
  text slide with extra steps. MOST OBJECTS SHOULD HAVE NO LABEL — let the
  visual shape, size, and motion communicate. Labels are LAST RESORT, not
  the default.
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
          { "kind": "<countable primitive>", "count": 12, "anchor": "<anchor>", "motion": "<motion>", "label": "<short label>", "emphasis": true }
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

/**
 * OpenCode fallback — when Gemini API is unavailable, use the OpenCode agent
 * (Cerebras or other provider) to generate the visual plan.
 * Calls opencode-agent.js with the visual planning prompt and schema.
 */
async function callOpenCodeFallback(prompt, maxTokens) {
  const agentScript = join(ROOT, "scripts", "opencode-agent.js");
  const schemaFile = join(ROOT, "schemas", "visual-plan.json");
  const agent = "pipeline-visual-plan";

  // Get model from environment (same as pipeline uses)
  const model = process.env.OPENCODE_MODELS?.split(",")[0] || "cerebras/gpt-oss-120b";

  console.log(`  OpenCode fallback: agent=${agent}, model=${model}`);

  try {
    // Write prompt to a temp file (opencode-agent.js reads via --prompt-file)
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const tmpDir = mkdtempSync(join(tmpdir(), "visual-plan-"));
    const promptFile = join(tmpDir, "prompt.txt");
    writeFileSync(promptFile, prompt, "utf-8");

    const result = spawnSync("node", [
      agentScript,
      "--prompt-file", promptFile,
      "--schema-file", schemaFile,
      "--agent", agent,
      "--model", model,
      "--max-retries", "2",
    ], {
      encoding: "utf-8",
      timeout: 5 * 60 * 1000,
      env: process.env,
      maxBuffer: 16 * 1024 * 1024,
    });

    // Clean up temp file
    try { rmSync(tmpDir, { recursive: true }); } catch {}

    if (result.error) {
      console.error(`  OpenCode fallback spawn error: ${result.error.message}`);
      return null;
    }

    if (result.stderr) {
      console.error(`  OpenCode fallback stderr: ${result.stderr.slice(0, 500)}`);
    }

    // Parse the output — opencode-agent.js returns {"structured_output": ...}
    const output = result.stdout?.trim();
    if (!output) {
      console.error("  OpenCode fallback: no output");
      return null;
    }

    // Find the JSON in the output (may have log lines before it)
    const jsonStart = output.lastIndexOf("{");
    if (jsonStart === -1) {
      console.error("  OpenCode fallback: no JSON found in output");
      return null;
    }

    const parsed = JSON.parse(output.slice(jsonStart));
    const plan = parsed.structured_output;
    if (plan?.beats) {
      console.log(`  OpenCode fallback: generated plan with ${plan.beats.length} beats`);
      return plan;
    }

    console.error("  OpenCode fallback: response missing 'beats' key");
    return null;
  } catch (e) {
    console.error(`  OpenCode fallback error: ${e.message}`);
    return null;
  }
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
  const maxTokens = Math.min(16384, 2000 + sentences.length * 600);
  let geminiResult = await callGeminiApi([{ role: "user", content: prompt }], { maxTokens, temperature: 0.2 });

  // The Gemini client returns {content: "..."} where content is a JSON string.
  // Parse it to get the actual plan object.
  if (geminiResult?.content && typeof geminiResult.content === "string") {
    try {
      const parsed = JSON.parse(geminiResult.content);
      if (parsed?.beats) geminiResult = parsed;
    } catch {
      // Content was not valid JSON — keep as-is, will trigger fallback
    }
  }

  // ── OpenCode fallback when Gemini is unavailable ──────────────────
  if (geminiResult?.error || !geminiResult?.beats) {
    const geminiErr = geminiResult?.error || "missing 'beats' key";
    console.warn(`Gemini API unavailable (${geminiErr}) — falling back to OpenCode agent...`);
    geminiResult = await callOpenCodeFallback(prompt, maxTokens);
  }

  const plan = geminiResult?.beats ? geminiResult : null;
  if (!plan || !plan.beats) {
    console.error("Failed to get visual plan from both Gemini and OpenCode.");
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
    console.warn(`  beat ${i.beat}: ${i.problem}`);
  }

  // ── CAPS: TYPOGRAPHY 1–2, NO MECHANISM OVER 40% ──────────────────────
  // Applied here, before the plan is written, not in the QA correction loop
  // (which --skip-qa bypasses). A beat's effective mechanism is the one the
  // director will render: its explicit `mechanism`, else the mechanism its
  // capability directive compiles to. A beat with neither cannot be
  // directed, so the plan is rejected rather than handed to the renderer.
  const effective = plan.beats.map((b) => b.mechanism || b.compiledScene?.mechanism || null);
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
