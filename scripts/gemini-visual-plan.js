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

MECHANISM SELECTION — choose based on what the sentence IS DOING:
- TYPOGRAPHY: The words themselves ARE the point (hooks, conclusions, CTAs). Punchy headline only.
- STATE_CHANGE: Something expected is contrasted with something actual (before/after).
- EVIDENCE_FIGURE: A specific number/statistic is presented as evidence.
- ACTION_CONSEQUENCE: A causes B — show the chain of cause and effect.
- PHYSICAL_GROWTH: Something increases — show the thing itself growing.
- VISIBLE_CONSUMPTION: Something is depleted — show it disappearing.
- SURFACE_AND_BENEATH: Official truth hides a deeper reality — show the reveal.
- PROPORTIONAL_OBJECTS: Two quantities compared — show relative scale.
- STRUCTURAL_BREAKDOWN: Something deteriorates or breaks down.

CONTINUITY RULES:
- NEVER repeat the same mechanism more than 2 times in a row.
- Use AT LEAST 4 different mechanisms across the video. Variety keeps the viewer engaged.
- Consider what carries forward: if beat 2 shows a money amount, and beat 3 shows it being consumed, mark "carries_forward" so the visual system knows to keep the object.
- The first beat MUST be a strong hook.
- The last beat should be a clear CTA or payoff.

CRITICAL: Do NOT default to headline-only typography for every beat. The viewer must SEE the idea, not just READ it. Use mechanisms that create visual representations of the concepts.

SCRIPT SENTENCES:
${sentenceList}
${correctionBlock}
Respond ONLY with JSON (no markdown fences):
{
  "beats": [
    {
      "index": 0,
      "visual_headline": "<SHORT 1-line text — NOT the transcript>",
      "mechanism": "<mechanism name>",
      "reason": "<what the sentence is DOING and why this mechanism shows it>",
      "emphasis_words": ["<key words to highlight>"],
      "objects": {
        "label_a": "<for STATE_CHANGE: expected label>",
        "label_b": "<for STATE_CHANGE: actual label>",
        "figure": "<for EVIDENCE_FIGURE: the number>",
        "cause": "<for ACTION_CONSEQUENCE: cause label>",
        "effect": "<for ACTION_CONSEQUENCE: effect label>"
      },
      "carries_forward": "<what object/concept from this beat should persist into the next beat, or null>",
      "emotional_weight": "<calm|building|sharp|heavy|urgent>"
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
  // Fixed at 4000 regardless of beat count used to truncate mid-JSON on
  // longer scripts (observed in production: a 51-beat shorts script came
  // back as "Unexpected end of JSON input" / a snapped property name a few
  // hundred beats in) — each beat's JSON object runs well over 4000/14
  // tokens once headline+reason+objects are filled in, so bigger scripts
  // need proportionally more room. Capped at 8192 (safe ceiling for this
  // model tier); a script needing more beats than that fits is a pacing
  // problem in the script/caption split, not something to fix here.
  const maxTokens = Math.min(8192, 1500 + sentences.length * 130);
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
