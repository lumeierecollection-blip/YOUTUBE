#!/usr/bin/env node
/**
 * opencode-visual-intent.js — OpenCode as primary visual thinker.
 *
 * Reads the script and SRT timing, generates a VISUAL INTENT DOCUMENT
 * that describes what each beat should SHOW (not how to render it).
 * This is the PRIMARY visual decision — Gemini reviews it as a challenger.
 *
 * Usage:
 *   node scripts/opencode-visual-intent.js --script <path> --srt <path> --channel <id> --out <intent.json>
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function arg(name, fallback = null) {
  const i = process.argv.indexOf("--" + name);
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find(a => a.startsWith("--" + name + "="));
  return eq ? eq.split("=").slice(1).join("=") : fallback;
}

function parseSrt(srtText) {
  return srtText.split(/\n\n+/).map(block => {
    const lines = block.trim().split("\n");
    if (lines.length < 3) return null;
    const match = lines[1].match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!match) return null;
    const start = parseInt(match[1])*3600 + parseInt(match[2])*60 + parseInt(match[3]) + parseInt(match[4])/1000;
    const end = parseInt(match[5])*3600 + parseInt(match[6])*60 + parseInt(match[7]) + parseInt(match[8])/1000;
    return { start, end, text: lines.slice(2).join(" ").trim() };
  }).filter(Boolean);
}

function buildIntentPrompt(sentences, channelConfig) {
  const sentenceList = sentences.map((s, i) =>
    `[${i}] (${s.start.toFixed(1)}s-${s.end.toFixed(1)}s) "${s.text}"`
  ).join("\n");

  const niche = channelConfig?.niche || "general";
  const style = channelConfig?.style || "motion-graphics";

  return `You are the VISUAL DIRECTOR for a YouTube Shorts video.
Channel niche: ${niche}
Visual style: ${style}

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

DISTRIBUTION RULES:
- AT MOST ~1 in 3 beats may be TEXT-FORWARD. The majority MUST be object-first visual events.
- typographic_emphasis is for the opening hook and closing CTA — typically 2 beats total.
- NEVER repeat the same visual event more than twice in a row.
- Use AT LEAST 5 distinct visual events across the video.
- The first beat MUST be a strong hook; the last beat a clear CTA or payoff.

SCRIPT SENTENCES:
${sentenceList}

Respond ONLY with JSON (no markdown fences):
{
  "visual_argument": "<ONE sentence describing the overall visual story arc>",
  "beats": [
    {
      "index": 0,
      "narrative_purpose": "<what this beat must accomplish in the argument>",
      "visual_event": "<WHAT HAPPENS VISUALLY — the event, not the template>",
      "key_object": "<the IMPORTANT OBJECT in this beat>",
      "transformation": "<what CHANGES from start to end>",
      "visual_headline": "<SHORT on-screen text — NOT the transcript, max 5-6 words, or null if no text>",
      "muted_read": "<what a viewer with NO audio understands from this beat>",
      "consequence": "<what the viewer should FEEL/understand>",
      "carries_forward": "<object/concept that persists into the next beat, or null>",
      "confidence": "<high|medium|low — how confident you are this visual event serves the narration>"
    }
  ]
}`;
}

async function callOpenCode(prompt, maxTokens) {
  const agentScript = join(ROOT, "scripts", "opencode-agent.js");
  const agent = "pipeline-visual-intent";
  const model = process.env.OPENCODE_MODELS?.split(",")[0] || "cerebras/gpt-oss-120b";

  console.log(`  OpenCode: agent=${agent}, model=${model}`);

  const tmpDir = mkdtempSync(join(tmpdir(), "visual-intent-"));
  const promptFile = join(tmpDir, "prompt.txt");
  writeFileSync(promptFile, prompt, "utf-8");

  // Write a minimal schema for validation
  const schemaFile = join(tmpDir, "schema.json");
  writeFileSync(schemaFile, JSON.stringify({
    type: "object",
    required: ["visual_argument", "beats"],
    properties: {
      visual_argument: { type: "string" },
      beats: {
        type: "array",
        items: {
          type: "object",
          required: ["index", "narrative_purpose", "visual_event", "key_object", "transformation", "muted_read", "consequence"],
          properties: {
            index: { type: "integer" },
            narrative_purpose: { type: "string" },
            visual_event: { type: "string" },
            key_object: { type: "string" },
            transformation: { type: "string" },
            visual_headline: { type: ["string", "null"] },
            muted_read: { type: "string" },
            consequence: { type: "string" },
            carries_forward: { type: ["string", "null"] },
            confidence: { type: "string", enum: ["high", "medium", "low"] }
          }
        }
      }
    }
  }, null, 2), "utf-8");

  try {
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

    try { rmSync(tmpDir, { recursive: true }); } catch {}

    if (result.error) {
      console.error(`  OpenCode spawn error: ${result.error.message}`);
      return null;
    }

    if (result.stderr) {
      console.error(`  OpenCode stderr: ${result.stderr.slice(0, 500)}`);
    }

    const output = result.stdout?.trim();
    if (!output) {
      console.error("  OpenCode: no output");
      return null;
    }

    const jsonStart = output.lastIndexOf("{");
    if (jsonStart === -1) {
      console.error("  OpenCode: no JSON found in output");
      return null;
    }

    const parsed = JSON.parse(output.slice(jsonStart));
    const intent = parsed.structured_output;
    if (intent?.beats) {
      console.log(`  OpenCode: generated intent with ${intent.beats.length} beats`);
      return intent;
    }

    console.error("  OpenCode: response missing 'beats' key");
    return null;
  } catch (e) {
    console.error(`  OpenCode error: ${e.message}`);
    try { rmSync(tmpDir, { recursive: true }); } catch {}
    return null;
  }
}

async function main() {
  const scriptPath = arg("script");
  const srtPath = arg("srt");
  const channelId = arg("channel");
  const outPath = arg("out");

  if (!scriptPath || !outPath) {
    console.error("Usage: opencode-visual-intent.js --script <path> --srt <path> --channel <id> --out <intent.json>");
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
    sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10).map((s, i) => ({
      start: i * 5, end: (i + 1) * 5, text: s.trim(),
    }));
    console.log(`Script parsed: ${sentences.length} sentences (no SRT)`);
  }

  if (!sentences.length) {
    console.error("No sentences found in script/SRT.");
    process.exit(2);
  }

  // Load channel config
  let channelConfig = null;
  if (channelId) {
    try {
      const config = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
      channelConfig = config.channels.find(c => String(c.id) === String(channelId));
    } catch {}
  }

  console.log(`Generating visual intent from OpenCode for ${sentences.length} beats...`);
  const prompt = buildIntentPrompt(sentences, channelConfig);
  const maxTokens = Math.min(16384, 2000 + sentences.length * 400);
  const intent = await callOpenCode(prompt, maxTokens);

  if (!intent || !intent.beats) {
    console.error("Failed to generate visual intent from OpenCode.");
    process.exit(1);
  }

  const result = {
    generatedAt: new Date().toISOString(),
    source: "opencode",
    channel: channelId,
    totalBeats: intent.beats.length,
    visual_argument: intent.visual_argument,
    beats: intent.beats,
  };

  writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n");
  console.log(`Visual intent written: ${outPath}`);
  console.log(`  Visual argument: ${result.visual_argument}`);
  console.log(`  Beats: ${result.totalBeats}`);

  // Report confidence distribution
  const confidences = { high: 0, medium: 0, low: 0 };
  for (const b of intent.beats) {
    confidences[b.confidence || "medium"]++;
  }
  console.log(`  Confidence: ${confidences.high} high, ${confidences.medium} medium, ${confidences.low} low`);
}

main().catch(e => {
  console.error(`Fatal error: ${e.message}`);
  process.exit(1);
});