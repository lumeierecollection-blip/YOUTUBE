/**
 * Caption Integration — Generates and manages captions/subtitles.
 *
 * Usage: node src/utils/captions.js <channel-id> <audio-path>
 * Output: data/tts/<channel-id>/<topic>-captions.srt
 *
 * EdgeTTS generates SRT files alongside audio. This module:
 * - Validates SRT quality
 * - Formats for YouTube (burned-in for Shorts, upload for long-form)
 * - Applies styling rules from BBC/Netflix standards
 * - Ensures accessibility compliance
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..");

/**
 * SRT parsing — reads and validates SRT format.
 */
function parseSRT(srtContent) {
  const blocks = srtContent.trim().split(/\n\n+/);
  const captions = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;

    const index = parseInt(lines[0], 10);
    const timecode = lines[1];
    const text = lines.slice(2).join(" ");

    // Parse timecodes
    const match = timecode.match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    );
    if (!match) continue;

    captions.push({
      index,
      start: match[1],
      end: match[2],
      text: text.trim(),
      duration_ms: timecodeToMs(match[2]) - timecodeToMs(match[1]),
    });
  }

  return captions;
}

/**
 * Convert timecode to milliseconds.
 */
function timecodeToMs(timecode) {
  const [h, m, rest] = timecode.split(":");
  const [s, ms] = rest.split(",");
  return (
    parseInt(h) * 3600000 +
    parseInt(m) * 60000 +
    parseInt(s) * 1000 +
    parseInt(ms)
  );
}

/**
 * Convert milliseconds to SRT timecode.
 */
function msToTimecode(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mill = ms % 1000;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${mill.toString().padStart(3, "0")}`;
}

/**
 * Validate caption quality.
 * BBC/Netflix standards: max 42 chars per line, 2 lines max, 1-7 seconds display.
 */
function validateCaptions(captions) {
  const issues = [];
  const MAX_CHARS_PER_LINE = 42;
  const MAX_LINES = 2;
  const MIN_DURATION_MS = 1000;
  const MAX_DURATION_MS = 7000;

  for (const cap of captions) {
    // Check line length
    const lines = cap.text.split("\n");
    if (lines.length > MAX_LINES) {
      issues.push({
        type: "TOO_MANY_LINES",
        caption: cap.index,
        detail: `Caption ${cap.index} has ${lines.length} lines (max ${MAX_LINES})`,
      });
    }

    for (const line of lines) {
      if (line.length > MAX_CHARS_PER_LINE) {
        issues.push({
          type: "LINE_TOO_LONG",
          caption: cap.index,
          detail: `Caption ${cap.index} has line with ${line.length} chars (max ${MAX_CHARS_PER_LINE})`,
        });
      }
    }

    // Check duration
    if (cap.duration_ms < MIN_DURATION_MS) {
      issues.push({
        type: "TOO_SHORT",
        caption: cap.index,
        detail: `Caption ${cap.index} displayed for ${cap.duration_ms}ms (min ${MIN_DURATION_MS}ms)`,
      });
    }

    if (cap.duration_ms > MAX_DURATION_MS) {
      issues.push({
        type: "TOO_LONG",
        caption: cap.index,
        detail: `Caption ${cap.index} displayed for ${cap.duration_ms}ms (max ${MAX_DURATION_MS}ms)`,
      });
    }

    // Check for empty text
    if (!cap.text || cap.text.trim().length === 0) {
      issues.push({
        type: "EMPTY_CAPTION",
        caption: cap.index,
        detail: `Caption ${cap.index} has empty text`,
      });
    }
  }

  return {
    valid: issues.length === 0,
    total_captions: captions.length,
    issues,
    quality_score: Math.max(0, 100 - issues.length * 5),
  };
}

/**
 * Optimize captions for YouTube upload.
 * Splits long lines, adjusts timing, removes formatting.
 */
function optimizeForYouTube(captions) {
  return captions.map((cap) => {
    let text = cap.text;

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, "");

    // Remove speaker labels (keep text)
    text = text.replace(/^\[.*?\]\s*/g, "");

    // Split long lines at natural break points
    if (text.length > 42) {
      const words = text.split(/\s+/);
      let line1 = "";
      let line2 = "";

      for (const word of words) {
        if (line1.length + word.length + 1 <= 42) {
          line1 += (line1 ? " " : "") + word;
        } else {
          line2 += (line2 ? " " : "") + word;
        }
      }

      text = line2 ? `${line1}\n${line2}` : line1;
    }

    return { ...cap, text };
  });
}

/**
 * Generate SRT content from captions array.
 */
function generateSRT(captions) {
  return captions
    .map((cap, i) => `${i + 1}\n${cap.start} --> ${cap.end}\n${cap.text}`)
    .join("\n\n");
}

/**
 * Generate burned-in caption styling for Shorts.
 * Returns CSS/styling config for Remotion rendering.
 */
function generateBurnedInStyle(channel) {
  const colors = channel.colors || {};

  return {
    font_family: "Impact, Arial Black, sans-serif",
    font_size: "48px",
    font_weight: "bold",
    color: "#FFFFFF",
    stroke_color: "#000000",
    stroke_width: "3px",
    background_color: "rgba(0,0,0,0.6)",
    position: "bottom-center",
    max_width: "90%",
    text_align: "center",
    text_transform: "uppercase",
    letter_spacing: "1px",
    safe_area: {
      bottom: "15%",
      left: "5%",
      right: "5%",
    },
    notes: [
      "Burned-in captions for Shorts (platforms strip external caption files)",
      "Large, bold, high-contrast text for mobile viewing",
      "All-caps for readability at small sizes",
      "Black stroke ensures readability against any background",
      "Position in safe area — avoid bottom 12.5% (duration badge)",
    ],
  };
}

/**
 * Full caption generation workflow.
 */
function generateCaptions(audioPath, channel) {
  const channelDir = dirname(audioPath);
  const topic = basename(audioPath).replace(/-vo\.mp3$/, "");
  const srtPath = join(channelDir, `${topic}-captions.srt`);

  // Check if SRT already exists (EdgeTTS generates it alongside audio)
  let captions = [];
  let validation = { valid: false, issues: [] };

  if (existsSync(srtPath)) {
    const srtContent = readFileSync(srtPath, "utf-8");
    captions = parseSRT(srtContent);
    validation = validateCaptions(captions);
  } else {
    // Try to generate with edge-tts
    try {
      const textPath = join(channelDir, `${topic}-vo-text.txt`);
      if (existsSync(textPath)) {
        const text = readFileSync(textPath, "utf-8");
        const voice = channel.tts_voice || "en-US-GuyNeural";
        const cmd = `edge-tts --voice "${voice}" --text "${text.replace(/"/g, '\\"').replace(/\n/g, " ")}" --write-media "${audioPath}" --write-subtitles "${srtPath}"`;
        execSync(cmd, { stdio: "pipe", timeout: 120000 });

        if (existsSync(srtPath)) {
          const srtContent = readFileSync(srtPath, "utf-8");
          captions = parseSRT(srtContent);
          validation = validateCaptions(captions);
        }
      }
    } catch {
      // EdgeTTS not available
    }
  }

  // Optimize for YouTube
  const optimized = captions.length > 0 ? optimizeForYouTube(captions) : [];
  const optimizedSRT = optimized.length > 0 ? generateSRT(optimized) : "";

  // Save optimized SRT
  if (optimizedSRT) {
    const optimizedPath = join(channelDir, `${topic}-captions-optimized.srt`);
    writeFileSync(optimizedPath, optimizedSRT);
  }

  return {
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    channel_id: channel.channel_id,
    topic,
    srt_path: srtPath,
    caption_count: captions.length,
    validation,
    optimized_srt_path: optimizedSRT
      ? join(channelDir, `${topic}-captions-optimized.srt`)
      : null,
    burned_in_style: generateBurnedInStyle(channel),
    youtube_upload: {
      auto_captions: "YouTube will generate auto-captions, but they're only 90-95% accurate",
      manual_captions: "Upload the optimized SRT for accurate captions",
      benefits: [
        "80% higher completion rates",
        "12% more views",
        "70%+ of Americans watch with captions",
        "Accessibility compliance (ADA, WCAG, EAA)",
        "Better SEO (YouTube indexes caption text)",
      ],
    },
  };
}

/**
 * CLI entry point.
 */
function main() {
  const channelId = process.argv[2];
  const audioPath = process.argv[3];

  if (!channelId) {
    console.error("Usage: node captions.js <channel-id> [audio-path]");
    process.exit(1);
  }

  const channelsPath = join(ROOT, "config", "channels.json");
  const data = JSON.parse(readFileSync(channelsPath, "utf-8"));
  const channels = data.channels || data;
  const channel = channels.find((c) => c.channel_id === channelId);
  if (!channel) {
    console.error(`Channel "${channelId}" not found`);
    process.exit(1);
  }

  if (audioPath) {
    const result = generateCaptions(audioPath, channel);
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Show burned-in style for reference
    const style = generateBurnedInStyle(channel);
    console.log("Burned-in caption style for Shorts:");
    console.log(JSON.stringify(style, null, 2));
  }
}

export { parseSRT, validateCaptions, optimizeForYouTube, generateSRT, generateBurnedInStyle, generateCaptions };

if (process.argv[1] && process.argv[1].endsWith("captions.js")) main();
