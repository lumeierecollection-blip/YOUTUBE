/**
 * TTS Utility — Generates voiceover audio using EdgeTTS (free, no provider key).
 *
 * Usage: node src/utils/tts.js <channel-id> [script-path]
 * Output: data/tts/<channel-id>/<topic>-vo.mp3 (+ matching .srt subtitles)
 *
 * Natural narration settings so the voiceover does NOT sound robotic:
 *  - rate:  -8%  (slower, measured documentary pace)
 *  - pitch: +2Hz (slight warmth)
 * Per-channel overrides can be set via channel.tts_rate / channel.tts_pitch
 * in channels.json; EdgeTTS voices per channel live in channel.tts_voice.
 * Default voice: en-US-GuyNeural
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..");

/**
 * Parse script into segments for TTS.
 * Extracts spoken content only (no stage directions, no brackets).
 */
function parseScriptForTTS(scriptContent) {
  const lines = scriptContent.split("\n");
  const segments = [];
  let currentSection = "intro";

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines, comments, separators, stage directions
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("---")) continue;
    if (trimmed.startsWith("[")) continue; // stage directions
    if (trimmed.startsWith("SOURCE:")) continue;
    if (trimmed.startsWith("NOTES:")) continue;
    if (trimmed.startsWith("|")) continue; // table rows
    if (trimmed.startsWith("##")) {
      const sectionMatch = trimmed.match(/##\s+(.+)/);
      if (sectionMatch) currentSection = sectionMatch[1];
      continue;
    }

    // Extract spoken text (remove surrounding quotes if present)
    let text = trimmed;
    if (text.startsWith('"') && text.endsWith('"')) {
      text = text.slice(1, -1);
    }

    if (text.length > 5) {
      segments.push({ section: currentSection, text });
    }
  }

  return segments;
}

/**
 * Generate TTS audio using edge-tts CLI.
 * Falls back to noting the dependency if edge-tts is not installed.
 * Uses natural rate/pitch so the delivery is not robotic, and writes an SRT
 * subtitle file for caption sync.
 */
async function generateTTS(segments, voice, outputDir, topic, settings = {}) {
  const fullText = segments.map((s) => s.text).join("\n\n");

  // Save text for reference
  const textPath = join(outputDir, `${topic}-vo-text.txt`);
  writeFileSync(textPath, fullText);

  // Try edge-tts
  const audioPath = join(outputDir, `${topic}-vo.mp3`);
  const srtPath = join(outputDir, `${topic}-vo.srt`);

  const rate = settings.rate || "-8%"; // slower = more natural documentary pacing
  const pitch = settings.pitch || "+2Hz"; // slight warmth

  try {
    // edge-tts --voice en-US-GuyNeural --rate -8% --pitch +2Hz --text "..." --write-media output.mp3
    const escapedText = fullText.replace(/"/g, '\\"').replace(/\n/g, " ");
    const args =
      `--voice "${voice}" ` +
      `--rate "${rate}" --pitch "${pitch}" ` +
      `--text "${escapedText}" ` +
      `--write-media "${audioPath}" ` +
      `--write-subtitles "${srtPath}"`;

    // Prefer `edge-tts` CLI; fall back to `python -m edge_tts` (CLI may be off PATH).
    const cmds = [`edge-tts ${args}`, `python -m edge_tts ${args}`];
    let lastErr = null;
    for (const cmd of cmds) {
      try {
        execSync(cmd, { stdio: "pipe", timeout: 120000 });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr) throw lastErr;
    console.log(`TTS audio saved: ${audioPath}`);
    console.log(`TTS subtitles saved: ${srtPath}`);
    console.log(`Delivery: voice=${voice} rate=${rate} pitch=${pitch}`);
    return audioPath;
  } catch (err) {
    console.log(`\n⚠️  edge-tts CLI not available or failed.`);
    console.log(`Install: pip install edge-tts`);
    console.log(`\nText saved to: ${textPath}`);
    console.log(`Voice: ${voice}`);
    console.log(`Rate: ${rate}, Pitch: ${pitch}`);
    console.log(`Segments: ${segments.length}`);
    console.log(`Total words: ${fullText.split(/\s+/).length}`);

    // Save a manifest for manual TTS generation
    const manifest = {
      voice,
      segments: segments.length,
      total_words: fullText.split(/\s+/).length,
      text_file: textPath,
      audio_output: audioPath,
      generated_at: new Date().toISOString(),
      status: "pending_tts",
    };
    writeFileSync(
      join(outputDir, `${topic}-tts-manifest.json`),
      JSON.stringify(manifest, null, 2)
    );
    return null;
  }
}

/**
 * Parse a JSON script (script-writer schema) into spoken segments.
 * Uses each section's `voiceover` text.
 */
function parseJsonScript(script) {
  const segments = [];
  for (const section of script.sections || []) {
    if (!section.voiceover || !section.voiceover.trim()) continue;
    const text = section.voiceover.replace(/\s*\n\s*/g, " ").trim();
    if (text.length > 5) {
      segments.push({ section: section.id || section.timing || "section", text });
    }
  }
  return segments;
}

function main() {
  const channelId = process.argv[2];
  const scriptPath = process.argv[3];

  if (!channelId) {
    console.error("Usage: node tts.js <channel-id> [script-path]");
    process.exit(1);
  }

  // Load channel config
  const channelsPath = join(ROOT, "config", "channels.json");
  const channelsData = JSON.parse(readFileSync(channelsPath, "utf-8"));
  const channel = (channelsData.channels || channelsData).find((c) => c.channel_id === channelId);
  if (!channel) {
    console.error(`Channel "${channelId}" not found`);
    process.exit(1);
  }

  const voice = channel.tts_voice || "en-US-GuyNeural";

  // If script path provided, generate TTS for that script
  if (scriptPath) {
    const fullPath = join(ROOT, scriptPath.replace(/\//g, "\\"));
    const scriptContent = readFileSync(fullPath, "utf-8");
    const isJson = fullPath.toLowerCase().endsWith(".json");
    const segments = isJson ? parseJsonScript(JSON.parse(scriptContent)) : parseScriptForTTS(scriptContent);
    const topic = scriptPath.split("/").pop()?.replace(/\.(md|txt|json)$/, "") || "video";

    const outDir = join(ROOT, "data", "tts", channelId);
    mkdirSync(outDir, { recursive: true });

    generateTTS(segments, voice, outDir, topic, {
      rate: channel.tts_rate,
      pitch: channel.tts_pitch,
    });
    return;
  }

  // Otherwise, show pending TTS jobs
  const ttsDir = join(ROOT, "data", "tts", channelId);
  if (!existsSync(ttsDir)) {
    console.log(`No TTS data for ${channelId}. Provide a script path to generate.`);
    return;
  }

  console.log(`TTS directory: ${ttsDir}`);
  console.log(`Voice: ${voice}`);
}

main();
