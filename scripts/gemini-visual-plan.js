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
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.split("=").slice(1).join("=") : fallback;
}

function getApiKey() {
  return process.env.GEMINI_API_KEY
    || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    || process.env.VISION_API_KEY
    || null;
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

function callGemini(apiKey, prompt, maxTokens) {
  const base = "https://generativelanguage.googleapis.com/v1beta/openai";
  const model = "gemini-3.5-flash-lite";
  const body = JSON.stringify({
    model, max_tokens: maxTokens, temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  // Retry up to 2 times on JSON parse failure (truncated response)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = execFileSync("curl", [
        "-sS", "--max-time", "120",
        "-H", "Content-Type: application/json",
        "-H", `Authorization: Bearer ${apiKey}`,
        "-d", "@-",
        `${base}/chat/completions`,
      ], { input: body, encoding: "utf-8" });

      const parsed = JSON.parse(res);
      if (!parsed.choices || !parsed.choices[0] || !parsed.choices[0].message) {
        console.error(`Gemini API: unexpected response structure (attempt ${attempt})`);
        continue;
      }

      const raw = parsed.choices[0].message.content.trim()
        .replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();

      // Try to parse the JSON
      const plan = JSON.parse(raw);
      if (plan && plan.beats) return plan;

      console.error(`Gemini API: response missing "beats" key (attempt ${attempt})`);
    } catch (e) {
      const msg = String(e.message || e).slice(0, 300);
      console.error(`Gemini API error (attempt ${attempt}): ${msg}`);
      if (attempt < 2) {
        // Wait before retry
        execFileSync("sleep", ["2"]);
      }
    }
  }
  return null;
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

  return `You are the VISUAL DIRECTOR for a YouTube Shorts video (vertical 1080x1920, ~60s).

THE FUNDAMENTAL RULE: Never visualize a sentence. Visualize what the sentence is DOING.
The video is not a collection of scenes — it is one continuous visual argument.

For each sentence, answer these questions BEFORE choosing the treatment:
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

THE MECHANISMS split into two families. Read this before choosing:

  OBJECT-FIRST (a visual object is the hero; text only labels it) — PREFER THESE:
  - STATE_CHANGE: Something expected is contrasted with something actual (before/after).
  - ACTION_CONSEQUENCE: A causes B — show the chain of cause and effect.
  - PHYSICAL_GROWTH: Something increases — show the thing itself growing.
  - VISIBLE_CONSUMPTION: Something is depleted — show it disappearing.
  - SURFACE_AND_BENEATH: Official truth hides a deeper reality — show the reveal.
  - PROPORTIONAL_OBJECTS: Two quantities compared — show relative scale.
  - STRUCTURAL_BREAKDOWN: Something deteriorates or breaks down.

  TEXT-FORWARD (the frame is dominated by words/a number) — USE SPARINGLY:
  - TYPOGRAPHY: The words themselves ARE the point (hooks, conclusions, CTAs). Punchy headline only.
  - EVIDENCE_FIGURE: A specific number/statistic is presented as evidence.

THE GRAPH / NUMBER RULE (this is what makes videos feel generic — obey it):
- A number appearing in a sentence is NOT a reason to reach for EVIDENCE_FIGURE. Ask
  what the number MEANS and show that: "$1,400 drained per year" is money leaving a
  wallet (VISIBLE_CONSUMPTION), "gas up 24.6%" is a pump price climbing (PHYSICAL_GROWTH),
  "50% vs 66%" is two things of different size (PROPORTIONAL_OBJECTS).
- Reach for a chart/bar/figure ONLY when the sentence is genuinely ABOUT quantitative
  comparison, trend, or measurement AND no physical/spatial form communicates it better.
- If removing the narration would leave only a floating number or a headline, the visual
  is decorative — pick an object-first mechanism instead.

THE MUTED TEST: for every beat, if the viewer had no audio, would the visual still carry
real information — an object, a change, a comparison, a consequence? If it would look
identical under almost any other sentence, it is monoculture. Reject it and re-choose.

DISTRIBUTION RULES (a plan that violates these will be rejected downstream):
- Across the whole video, AT MOST ~1 in 3 beats may be TEXT-FORWARD (TYPOGRAPHY +
  EVIDENCE_FIGURE combined). The majority MUST be object-first mechanisms.
- TYPOGRAPHY is for the opening hook and the closing CTA — typically 2 beats total,
  rarely more. Do not use it for ordinary statements; find what the statement SHOWS.
- NEVER repeat the same mechanism more than twice in a row, and do not alternate
  headline/figure/headline/figure — that reads as one template on repeat.
- Use AT LEAST 5 distinct mechanisms across the video, drawn mostly from the object-first
  family. Consecutive beats should differ in VISUAL FORM, not just in mechanism name.
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
- subject: the specific thing on screen (a stack of Medicare claim forms; a fuel
  pump display; a shredded 2020 budget) — NOT "a chart" or "text".
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
  otherwise false. If false, you may not choose EVIDENCE_FIGURE as a bar/graph.

DO NOT pick a familiar mechanism merely because it is easy to render. Direct the
strongest visual event first; mechanism is only the closest EXECUTION mapping for
the renderer, and the post-render review will check whether the render actually
delivered your directed event.

SCRIPT SENTENCES:
${sentenceList}
${correctionBlock}
Respond ONLY with JSON (no markdown fences):
{
  "beats": [
    {
      "index": 0,
      "visual_headline": "<SHORT on-screen text — NOT the transcript, max 5-6 words>",
      "mechanism": "<closest execution mechanism from the families above>",
      "reason": "<what the sentence is DOING and why this mechanism shows it>",
      "emphasis_words": ["<key words to highlight>"],
      "objects": {
        "label_a": "<for STATE_CHANGE: expected label>",
        "label_b": "<for STATE_CHANGE: actual label>",
        "figure": "<for EVIDENCE_FIGURE: the number>",
        "cause": "<for ACTION_CONSEQUENCE: cause label>",
        "effect": "<for ACTION_CONSEQUENCE: effect label>"
      },
      "carries_forward": "<object/concept that persists into the next beat, or null>",
      "emotional_weight": "<calm|building|sharp|heavy|urgent>",
      "direction": {
        "narrative_purpose": "<what this beat must accomplish in the argument>",
        "subject": "<the specific thing on screen — never 'a chart'/'text'>",
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

function main() {
  const scriptPath = arg("script");
  const srtPath = arg("srt");
  const channelId = arg("channel");
  const outPath = arg("out");
  const correctionsPath = arg("corrections");

  if (!scriptPath || !outPath) {
    console.error("Usage: gemini-visual-plan.js --script <path> --srt <path> --channel <id> --out <plan.json>");
    process.exit(2);
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("No Gemini API key — visual planning SKIPPED.");
    process.exit(0);
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
  // headline-only estimate — ~440 tokens/beat plus headroom, capped at
  // 12288. A script needing more beats than that fits is a pacing problem
  // in the script/caption split, not something to fix here.
  const maxTokens = Math.min(12288, 1500 + sentences.length * 440);
  const plan = callGemini(apiKey, prompt, maxTokens);

  if (!plan || !plan.beats) {
    console.error("Failed to get visual plan from Gemini.");
    process.exit(1);
  }

  const result = {
    generatedAt: new Date().toISOString(),
    channel: channelId,
    iteration: corrections?.length ? "correction" : "initial",
    totalBeats: plan.beats.length,
    beats: plan.beats,
    mechanismDistribution: {},
  };

  for (const b of plan.beats) {
    result.mechanismDistribution[b.mechanism] = (result.mechanismDistribution[b.mechanism] || 0) + 1;
  }

  writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n");
  console.log(`Visual plan written: ${outPath}`);
  console.log(`  Beats: ${plan.beats.length}`);
  console.log(`  Mechanisms: ${JSON.stringify(result.mechanismDistribution)}`);

  for (const b of plan.beats) {
    console.log(`  [${b.index}] ${b.mechanism}: "${b.visual_headline}" — ${b.reason}`);
  }
}

main();
