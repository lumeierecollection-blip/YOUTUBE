/**
 * TTS Utility — Generates voiceover audio using EdgeTTS (free, no provider key).
 *
 * Usage: node src/utils/tts.js <channel-id> [script-path]
 * Output: data/tts/<channel-id>/<topic>-vo.mp3
 *
 * EdgeTTS voices per channel are configured in channels.json (tts_voice field).
 * Default: en-US-GuyNeural
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
 * Handles both JSON scripts (from script-writer) and plain text/markdown.
 */
function parseScriptForTTS(scriptContent, isJson = false) {
  if (isJson) {
    try {
      const script = JSON.parse(scriptContent);
      const segments = [];
      if (script.sections) {
        for (const section of script.sections) {
          if (section.voiceover) {
            // Split voiceover into paragraphs
            const paragraphs = section.voiceover.split(/\n\n+/).filter(p => p.trim());
            for (const para of paragraphs) {
              segments.push({ section: section.id, text: para.trim() });
            }
          }
        }
      }
      return segments;
    } catch (e) {
      // Fall through to text parsing
    }
  }

  // Plain text / markdown parsing
  const lines = scriptContent.split("\n");
  const segments = [];
  let currentSection = "intro";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("---")) continue;
    if (trimmed.startsWith("[")) continue;
    if (trimmed.startsWith("SOURCE:")) continue;
    if (trimmed.startsWith("NOTES:")) continue;
    if (trimmed.startsWith("|")) continue;
    if (trimmed.startsWith("##")) {
      const sectionMatch = trimmed.match(/##\s+(.+)/);
      if (sectionMatch) currentSection = sectionMatch[1];
      continue;
    }

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
 */
async function generateTTS(segments, voice, outputDir, topic) {
  const fullText = segments.map((s) => s.text).join("\n\n");

  // Save text for reference
  const textPath = join(outputDir, `${topic}-vo-text.txt`);
  writeFileSync(textPath, fullText);

  // Try edge-tts
  const audioPath = join(outputDir, `${topic}-vo.mp3`);

  try {
    // python -m edge_tts --voice en-US-GuyNeural --text "..." --write-media output.mp3
    const escapedText = fullText.replace(/"/g, '\\"').replace(/\n/g, " ");
    const cmd = `python -m edge_tts --voice "${voice}" --text "${escapedText}" --write-media "${audioPath}"`;

    execSync(cmd, { stdio: "pipe", timeout: 120000 });
    console.log(`TTS audio saved: ${audioPath}`);
    return audioPath;
  } catch (err) {
    console.log(`\n⚠️  edge-tts CLI not available or failed.`);
    console.log(`Install: pip install edge-tts`);
    console.log(`\nText saved to: ${textPath}`);
    console.log(`Voice: ${voice}`);
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

function main() {
  const channelId = process.argv[2];
  const scriptPath = process.argv[3];

  if (!channelId) {
    console.error("Usage: node tts.js <channel-id> [script-path]");
    process.exit(1);
  }

  // Load channel config
  const channelsPath = join(ROOT, "config", "channels.json");
  const data = JSON.parse(readFileSync(channelsPath, "utf-8"));
  const channels = data.channels || data;
  const numId = parseInt(channelId, 10);
  const channel = channels.find((c) => c.id === numId || c.channel_id === channelId);
  if (!channel) {
    console.error(`Channel "${channelId}" not found`);
    process.exit(1);
  }

  const voice = channel.tts_voice || "en-US-GuyNeural";

  // If script path provided, generate TTS for that script
  if (scriptPath) {
    const fullPath = join(ROOT, scriptPath.replace(/\//g, "\\"));
    const scriptContent = readFileSync(fullPath, "utf-8");
    const isJson = scriptPath.endsWith(".json");
    const segments = parseScriptForTTS(scriptContent, isJson);
    const topic = scriptPath.split(/[\/\\]/).pop()?.replace(/\.(json|md|txt)$/, "") || "video";

    const outDir = join(ROOT, "data", "tts", channelId);
    mkdirSync(outDir, { recursive: true });

    generateTTS(segments, voice, outDir, topic).catch(err => {
      console.error(`TTS failed: ${err.message}`);
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
