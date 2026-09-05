/**
 * End Screen & Cards Generator — Produces optimized end screen configs.
 *
 * Usage: node src/utils/endscreen.js <channel-id> <topic-slug> [--type long-form|shorts]
 * Output: data/research/<channel-id>/<topic>-endscreen.json
 *
 * Based on 2026 research:
 * - End screens boost session time 20-35%
 * - Playlist links add ~3.2 extra minutes per session
 * - "Best for viewer" beats "Newest upload"
 * - Silent end screens underperform — pair with verbal CTA
 * - Healthy click rate: 3-7%, series content hits 8-10%
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..");

/**
 * Generate end screen configuration for long-form videos.
 * Last 5-20 seconds, up to 4 clickable elements.
 */
function generateLongFormEndScreen(topic, channel) {
  const niche = channel.niche || "";
  const channelName = channel.channel_name || "";

  return {
    type: "long-form",
    placement: {
      start_seconds_before_end: 15,
      duration_seconds: 15,
      notes: "End screen elements appear in last 5-20 seconds. Leave clean visual space in final 15-20 seconds.",
    },
    elements: [
      {
        type: "video",
        position: "left",
        selection: "best_for_viewer",
        notes: "YouTube picks the video most likely to keep the viewer watching. Always use 'Best for viewer' over 'Newest upload'.",
      },
      {
        type: "playlist",
        position: "right",
        playlist_id: "SET_ME",
        selection: "related_playlist",
        notes: "Link to a playlist in the same niche. Playlist links add ~3.2 extra minutes per session.",
      },
      {
        type: "subscribe",
        position: "center-bottom",
        notes: "Subscribe button. Place center-bottom to avoid overlapping video elements.",
      },
    ],
    verbal_cta: {
      timing: "Start 5-10 seconds before end screen appears",
      script_patterns: [
        `If you found this interesting, check out this video next — it covers a related topic in ${niche.toLowerCase()} that you won't want to miss.`,
        `Watch this next video to continue learning about ${niche.toLowerCase()}. It's the perfect follow-up to what we just covered.`,
        `Don't stop here — this next video goes even deeper. Click it now while it's on screen.`,
      ],
      notes: "Silent end screens underperform. ALWAYS pair with verbal CTA telling viewers what to click and why.",
    },
    design: {
      background: "semi-transparent overlay matching channel colors",
      text_overlay: "WATCH NEXT",
      font: channel.font || "Montserrat Bold",
      colors: channel.colors || {},
      notes: "Leave bottom-right corner clear (duration badge). Keep design clean and consistent with channel branding.",
    },
    best_practices: [
      "Plan end screen BEFORE filming — leave clean visual space in final 15-20 seconds",
      "Use 'Best for viewer' algorithm selection, not 'Newest upload'",
      "Always include verbal CTA — never silent end screens",
      "Link to related content in same niche/topic cluster (+40% session depth)",
      "Test different configurations — measure click rate in YouTube Analytics",
      "Healthy click rate: 3-7%, series content hits 8-10%",
      "Don't send viewers to unrelated content — breaks session",
      "Consistent placement across videos builds viewer recognition",
    ],
  };
}

/**
 * Generate Shorts end screen configuration.
 * Shorts are different — no traditional end screens, but CTA overlays work.
 */
function generateShortsEndScreen(topic, channel) {
  const niche = channel.niche || "";

  return {
    type: "shorts",
    placement: {
      notes: "Shorts don't support traditional end screens. Use text overlays and verbal CTAs instead.",
      cta_timing: "Last 3-5 seconds",
    },
    elements: [
      {
        type: "text_overlay",
        text: "SUBSCRIBE",
        position: "center",
        timing: "last 2 seconds",
        notes: "Simple, direct CTA. Shorts viewers don't read long text.",
      },
      {
        type: "verbal_cta",
        text: `Follow for more ${niche.toLowerCase()}!`,
        timing: "last 3-5 seconds",
        notes: "Quick verbal CTA. Don't interrupt the content flow.",
      },
    ],
    funnel_strategy: {
      description: "Shorts are top-of-funnel. Use them to drive subscribers who then watch long-form.",
      tactics: [
        "Tease long-form content: 'Full video on the channel'",
        "Create series that reward returning viewers",
        "Pin comment with subscribe CTA on best-performing Shorts",
        "Cross-promote: 'Watch the full deep dive on my channel'",
      ],
    },
  };
}

/**
 * Generate card configuration (in-video cards).
 * Cards appear at 50-75% video mark, not too early.
 */
function generateCards(topic, channel, totalDurationSeconds = 600) {
  const niche = channel.niche || "";

  // Calculate card placement (50-75% of video)
  const midpoint = Math.floor(totalDurationSeconds * 0.5);
  const threeQuarter = Math.floor(totalDurationSeconds * 0.75);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return {
    cards: [
      {
        type: "playlist",
        position: formatTime(midpoint),
        position_percent: "50%",
        title: `More ${niche} Videos`,
        notes: "Mid-video card. Link to related playlist. Don't interrupt the hook — place after context is established.",
      },
      {
        type: "video",
        position: formatTime(Math.floor(totalDurationSeconds * 0.65)),
        position_percent: "65%",
        selection: "best_for_viewer",
        title: "Watch Next",
        notes: "Second card at peak engagement. Link to most relevant next video.",
      },
    ],
    rules: [
      "Place cards at 50-75% video mark — NOT during hook (first 30 sec)",
      "Maximum 5 cards per video (YouTube limit)",
      "Link to related content in same topic cluster (+40% session depth)",
      "Poll cards engage without leaving the video",
      "Don't place cards during key reveals — breaks immersion",
      "Each card should have a clear reason to click",
    ],
  };
}

/**
 * Full end screen generation.
 */
function generateEndScreen(topic, channel, type = "long-form", totalDuration = 600) {
  const endScreen = type === "shorts"
    ? generateShortsEndScreen(topic, channel)
    : generateLongFormEndScreen(topic, channel);

  const cards = type === "long-form"
    ? generateCards(topic, channel, totalDuration)
    : null;

  return {
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    topic,
    channel_id: channel.channel_id,
    video_type: type,
    end_screen: endScreen,
    cards,
    upload_checklist: {
      end_screen_added: false,
      verbal_cta_included: false,
      clean_visual_space_planned: false,
      elements_link_to_related_content: false,
      subscribe_button_included: true,
      ...(type === "long-form"
        ? { cards_at_50_75_percent: false, no_cards_during_hook: true }
        : {}),
    },
  };
}

/**
 * CLI entry point.
 */
function main() {
  const channelId = process.argv[2];
  const topic = process.argv[3];
  const type = process.argv.includes("--shorts") ? "shorts" : "long-form";

  if (!channelId || !topic) {
    console.error("Usage: node endscreen.js <channel-id> <topic> [--shorts]");
    process.exit(1);
  }

  const channelsPath = join(ROOT, "config", "channels.json");
  const data = JSON.parse(readFileSync(channelsPath, "utf-8"));
  const channels = data.channels || data;
  const numId = parseInt(channelId, 10);
  const channel = channels.find((c) => c.id === numId || c.channel_id === channelId);
  if (!channel) {
    console.error(`Channel "${channelId}" not found`);
    process.exit(1);
  }

  const config = generateEndScreen(topic, channel, type);

  const outDir = join(ROOT, "data", "research", channelId);
  mkdirSync(outDir, { recursive: true });

  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const outPath = join(outDir, `${slug}-endscreen.json`);
  writeFileSync(outPath, JSON.stringify(config, null, 2));

  console.log(`End screen config saved: ${outPath}`);
  console.log(`Type: ${type}`);
  console.log(`Elements: ${config.end_screen.elements.length}`);
  if (config.cards) {
    console.log(`Cards: ${config.cards.cards.length}`);
  }
}

export { generateEndScreen, generateLongFormEndScreen, generateShortsEndScreen, generateCards };

if (process.argv[1] && process.argv[1].endsWith("endscreen.js")) main();
