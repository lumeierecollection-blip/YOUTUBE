/**
 * Thumbnail Maker — Generates thumbnail specs and canvas-based thumbnails
 * for YouTube videos based on channel style + script hook.
 *
 * Usage: node src/skills/thumbnail-maker/generate.js <channel-id> <script-path>
 * Output: data/thumbnails/<channel-id>/<topic>-thumb.png + <topic>-thumb-spec.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..", "..");

/**
 * Extract the hook line from a script file.
 *
 * script-writer's real output is JSON (sections[] with an "id":"hook"
 * entry) \u2014 that's tried first. The regex-based markdown parsing below is
 * kept only as a fallback for legacy markdown-format scripts; running it
 * directly against JSON text previously matched whichever quoted field
 * happened to come first (often "visual_cue"), not the actual hook.
 */
function extractHook(scriptContent) {
  try {
    const script = JSON.parse(scriptContent);
    const sections = script.sections || [];
    const hookSection =
      sections.find((s) => (s.id || "").toLowerCase() === "hook") || sections[0];
    const voiceover = hookSection?.voiceover?.trim();
    if (voiceover) {
      const sentenceEnd = voiceover.search(/[.!?]/);
      return sentenceEnd > 0 ? voiceover.slice(0, sentenceEnd + 1) : voiceover.slice(0, 150);
    }
  } catch {
    // Not JSON \u2014 fall through to markdown parsing below.
  }

  // Normalize smart/curly quotes to straight quotes
  const normalized = scriptContent
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");

  // Try to find a HOOK section — capture first sentence only
  const hookMatch = normalized.match(
    /HOOK[^:]*:\s*\n[^"]*"([^"]{10,150}?[.!?])/i
  );
  if (hookMatch) return hookMatch[1];

  // Fallback: first quoted string — capture first sentence only
  const lines = normalized.split("\n");
  for (const line of lines) {
    if (line.trim().startsWith("[")) continue;
    if (line.trim().startsWith("#")) continue;
    if (line.trim().startsWith("---")) continue;
    const quoteMatch = line.match(/"([^"]{10,150}?[.!?])/);
    if (quoteMatch) return quoteMatch[1];
  }

  // Fallback: first non-empty, non-comment, non-bracket line
  const fallback = lines.filter(
    (l) =>
      l.trim() &&
      !l.startsWith("#") &&
      !l.startsWith("---") &&
      !l.trim().startsWith("[")
  );
  const firstLine = fallback[0]?.trim() || "Untitled";
  // Truncate at first sentence
  const sentenceEnd = firstLine.search(/[.!?]/);
  return sentenceEnd > 0 ? firstLine.slice(0, sentenceEnd + 1) : firstLine.slice(0, 150);
}

/**
 * Generate thumbnail text (3-6 words max, bold, readable at small size).
 * Extracts the core punch from the hook.
 */
function generateThumbnailText(hook) {
  // Strip leading quotes and clean
  let clean = hook.replace(/^["']|["']$/g, "").trim();

  // Pattern 1: Dollar figures — most punchy for thumbnails
  const dollarMatch = clean.match(/\$[\d.]+\s*(?:billion|million|B|M|K)/i);
  if (dollarMatch) {
    return dollarMatch[0].toUpperCase();
  }

  // Pattern 2: Company/subject name + dramatic word
  const companyPatterns = [
    /([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s+(?:killed|dead|destroyed|collapsed|failed|doomed|gone|bankrupt)/i,
    /(?:How|Why)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)/i,
    /([A-Z][A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(?:death|fall|collapse|downfall|end)/i,
  ];
  for (const pat of companyPatterns) {
    const m = clean.match(pat);
    if (m) {
      const name = m[1] || m[0];
      const words = name.split(/\s+/).filter((w) => w.length > 1);
      if (words.length <= 4) return words.join(" ").toUpperCase();
      return words.slice(0, 4).join(" ").toUpperCase();
    }
  }

  // Pattern 3: Numbers/quantities
  const numMatch = clean.match(/(\d[\d,]*)\s*(?:years|stores|employees|people|billion|million)/i);
  if (numMatch) {
    return numMatch[0].toUpperCase();
  }

  // Pattern 4: Known brand names (case-insensitive search)
  const brands = ["Toys R Us", "Amazon", "Walmart", "Blockbuster", "Kodak", "Nokia", "WeWork", "FTX", "Theranos", "Enron"];
  for (const brand of brands) {
    if (clean.toLowerCase().includes(brand.toLowerCase())) {
      return brand.toUpperCase();
    }
  }

  // Fallback: take first 3-4 significant words
  const stopWords = new Set(["the", "and", "for", "was", "but", "not", "its", "a", "an", "is", "it", "to", "of", "in", "on", "at", "by", "more", "than", "just", "like"]);
  const words = clean.split(/\s+/).filter(
    (w) => w.length > 2 && !stopWords.has(w.toLowerCase())
  );
  return words.slice(0, 4).join(" ").toUpperCase();
}

/**
 * Generate a thumbnail spec JSON (used before canvas rendering).
 * This produces the layout instructions; actual PNG generation
 * requires canvas dependencies (sharp or node-canvas).
 */
function generateThumbnailSpec(channel, hook, thumbnailText, format) {
  const style = channel.thumbnail_style || {};
  const isShort = format === "shorts";

  return {
    meta: {
      channel_id: channel.channel_id,
      format: format,
      created_at: new Date().toISOString(),
    },
    canvas: {
      width: 1280,
      height: 720,
      format: "png",
      max_filesize_kb: 2048,
    },
    background: {
      type: "gradient",
      colors: [style.primary_color || "#0D1117", style.secondary_color || "#1A1F2E"],
      direction: "diagonal",
    },
    elements: [
      {
        type: "text",
        content: thumbnailText,
        position: { x: "center", y: "center" },
        font: {
          family: style.font || "Inter",
          weight: 900,
          size: isShort ? 64 : 80,
          color: style.accent_color || "#C9A227",
          shadow: { color: "#000000", blur: 12, offset_y: 4 },
        },
        max_width: 1000,
      },
      {
        type: "text",
        content: hook.slice(0, 60),
        position: { x: "center", y: "bottom", margin: 60 },
        font: {
          family: style.font || "Inter",
          weight: 400,
          size: 28,
          color: "#FFFFFF",
          shadow: { color: "#000000", blur: 8, offset_y: 2 },
        },
        max_width: 1000,
        opacity: 0.85,
      },
    ],
    style_notes: style.style_notes || "Dark moody background, gold accent, clean typography",
    hook_source: hook,
  };
}

/**
 * Main entry point
 */
function main() {
  const [channelId, scriptPath, format = "longform"] = process.argv.slice(2);

  if (!channelId || !scriptPath) {
    console.error("Usage: node generate.js <channel-id> <script-path> [shorts|longform]");
    process.exit(1);
  }

  // Load channel config
  const channelsPath = join(ROOT, "config", "channels.json");
  const channelsData = JSON.parse(readFileSync(channelsPath, "utf-8"));
  const channels = channelsData.channels || channelsData;
  const channel = channels.find((c) => String(c.id) === channelId || c.channel_id === channelId);
  if (!channel) {
    console.error(`Channel "${channelId}" not found in config.`);
    process.exit(1);
  }

  // Read script
  const scriptContent = readFileSync(
    join(ROOT, ...scriptPath.split(/[\/\\]/)),
    "utf-8"
  );

  // Extract hook and generate text
  const hook = extractHook(scriptContent);
  const thumbnailText = generateThumbnailText(hook);

  // Generate spec
  const spec = generateThumbnailSpec(channel, hook, thumbnailText, format);

  // Save spec — namespaced by topic slug (derived from the script filename)
  // so a new video's thumbnail never clobbers a previous one for the same
  // channel; render-thumb.js already expects and globs "<slug>-thumb-spec.json".
  const scriptBase = scriptPath.split(/[\/\\]/).pop().replace(/\.(json|md|txt)$/, "");
  const topicSlug = scriptBase.replace(/-script$/, "");
  const outDir = join(ROOT, "data", "thumbnails", channelId);
  mkdirSync(outDir, { recursive: true });
  const specFile = join(outDir, `${topicSlug}-thumb-spec.json`);
  writeFileSync(specFile, JSON.stringify(spec, null, 2));

  console.log(`Thumbnail spec saved: ${specFile}`);
  console.log(`Hook: ${hook}`);
  console.log(`Thumbnail text: ${thumbnailText}`);
  console.log(`\nNext: Render this spec to PNG using canvas API or sharp.`);
}

main();
