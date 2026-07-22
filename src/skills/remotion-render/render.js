/**
 * Remotion Render — Main entry point for rendering videos.
 *
 * Usage:
 *   node render.js shorts <channel-id> <script-path> <tts-audio-path>
 *   node render.js longform <channel-id> <script-path> <tts-audio-path>
 *
 * Reads channel config for style, maps to Remotion composition,
 * renders to output directory.
 */

import { readFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..", "..");

function loadChannel(channelId) {
  const channelsPath = join(ROOT, "config", "channels.json");
  const channels = JSON.parse(readFileSync(channelsPath, "utf-8"));
  const channel = channels.find((c) => c.channel_id === channelId);
  if (!channel) throw new Error(`Channel "${channelId}" not found`);
  return channel;
}

function loadScript(scriptPath) {
  const fullPath = join(ROOT, scriptPath.replace(/\//g, "\\"));
  return readFileSync(fullPath, "utf-8");
}

function parseScriptSections(scriptContent) {
  const sections = [];
  const lines = scriptContent.split("\n");
  let currentSection = null;

  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+(.+?)\s*\((.+?)\)/);
    if (sectionMatch) {
      if (currentSection) sections.push(currentSection);
      currentSection = {
        name: sectionMatch[1],
        timing: sectionMatch[2],
        content: [],
      };
      continue;
    }

    if (currentSection && line.trim() && !line.startsWith("#")) {
      currentSection.content.push(line.trim());
    }
  }

  if (currentSection) sections.push(currentSection);
  return sections;
}

function getCompositionForStyle(style, format) {
  const compositions = {
    "cinematic-documentary": {
      shorts: "CinematicDocumentaryShorts",
      longform: "CinematicDocumentaryLongform",
    },
    minimal: {
      shorts: "MinimalShorts",
      longform: "MinimalLongform",
    },
    "motion-graphics": {
      shorts: "MotionGraphicsShorts",
      longform: "MotionGraphicsLongform",
    },
  };

  return compositions[style]?.[format] || "MinimalLongform";
}

function renderVideo(composition, outputPath, props) {
  const propsJson = JSON.stringify(props).replace(/"/g, '\\"');

  const cmd = [
    "npx",
    "remotion",
    "render",
    composition,
    outputPath,
    `--props="${propsJson}"`,
    "--codec=h264",
    "--concurrency=2",
  ].join(" ");

  console.log(`Rendering: ${composition}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Command: ${cmd}`);

  try {
    execSync(cmd, {
      cwd: __dirname,
      stdio: "inherit",
      timeout: 600000, // 10 min timeout
    });
    console.log(`\nRender complete: ${outputPath}`);
  } catch (err) {
    console.error(`Render failed: ${err.message}`);
    process.exit(1);
  }
}

function main() {
  const [format, channelId, scriptPath, ttsAudioPath] = process.argv.slice(2);

  if (!format || !channelId || !scriptPath) {
    console.error(
      "Usage: node render.js <shorts|longform> <channel-id> <script-path> [tts-audio-path]"
    );
    process.exit(1);
  }

  const channel = loadChannel(channelId);
  const scriptContent = loadScript(scriptPath);
  const sections = parseScriptSections(scriptContent);

  const composition = getCompositionForStyle(channel.style, format);

  const aspectRatio = format === "shorts" ? "9:16" : "16:9";
  const fps = 30;
  const durationSeconds =
    format === "shorts"
      ? 60
      : sections.length * 120; // rough estimate: 2 min per section

  const outputDir = join(ROOT, "data", "renders", channelId);
  mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().slice(0, 10);
  const topic = scriptPath.split("/").pop()?.replace(/\.(md|txt)$/, "") || "video";
  const outputPath = join(outputDir, `${topic}-${timestamp}.mp4`);

  const props = {
    channelId: channel.channel_id,
    style: channel.style,
    format: format,
    sections: sections,
    ttsAudioPath: ttsAudioPath || null,
    thumbnailStyle: channel.thumbnail_style,
    tone: channel.tone,
  };

  renderVideo(composition, outputPath, props);
}

main();
