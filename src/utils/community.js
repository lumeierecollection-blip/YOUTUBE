/**
 * Community Tab Strategy — Automated community post planning.
 *
 * Usage: node src/utils/community.js <channel-id>
 * Output: data/research/<channel-id>/community-strategy.json
 *
 * Community tab available at 500+ subscribers.
 * Keeps subscribers active between uploads, boosts engagement.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..");

/**
 * Community post types and their purposes.
 */
const POST_TYPES = {
  poll: {
    name: "Poll",
    description: "Multiple choice questions for audience engagement",
    best_for: ["Audience research", "Engagement boost", "Content ideation"],
    frequency: "2-3 per week",
    rules: [
      "Ask about viewer preferences for upcoming content",
      "Use 2-4 options (not more — decision fatigue)",
      "Keep options clear and distinct",
      "Always related to channel niche",
      "Results inform content calendar",
    ],
    examples: {
      science: "Which topic should we cover next?",
      crime: "Which case should we investigate?",
      food: "What should we try cooking next?",
    },
  },
  image: {
    name: "Image Post",
    description: "Photos, graphics, behind-the-scenes",
    best_for: ["Behind-the-scenes", "Teasers", "Memes", "Data visualizations"],
    frequency: "2-3 per week",
    rules: [
      "Use channel color palette and branding",
      "Include text overlay for context",
      "Tease upcoming content",
      "Show behind-the-scenes of research/production",
      "Share relevant data or infographics",
    ],
  },
  text: {
    name: "Text Post",
    description: "Plain text updates, questions, discussions",
    best_for: ["Announcements", "Questions", "Discussion starters", "Hot takes"],
    frequency: "1-2 per week",
    rules: [
      "Keep under 200 characters for mobile readability",
      "Ask questions to drive comments",
      "Share interesting facts from research",
      "Make announcements about upload schedule",
    ],
  },
  video_link: {
    name: "Video Link",
    description: "Promote existing videos from the channel",
    best_for: ["Back catalog promotion", "Re-sharing evergreen content", "New upload announcement"],
    frequency: "1-2 per week",
    rules: [
      "Add context — why should they watch this?",
      "Link to evergreen content that's still relevant",
      "Pair with a compelling reason to click",
      "Don't spam — max 1-2 video links per week",
    ],
  },
};

/**
 * Generate a weekly community posting schedule.
 */
function generateWeeklySchedule(channel) {
  const niche = channel.niche || "";

  return {
    monday: {
      type: "poll",
      purpose: "Week start engagement + content research",
      example: `Quick poll: What ${niche.toLowerCase()} topic should we dive into this week?`,
    },
    tuesday: {
      type: "image",
      purpose: "Tease upcoming video",
      example: `Research preview: We're working on something incredible about ${niche.toLowerCase()}. New video coming Thursday!`,
    },
    wednesday: {
      type: "text",
      purpose: "Mid-week engagement",
      example: `Fun fact from our research: Did you know something surprising about ${niche.toLowerCase()}?`,
    },
    thursday: {
      type: "video_link",
      purpose: "New upload announcement",
      example: `NEW VIDEO: [Title]. Link in the community tab — drop your thoughts below!`,
    },
    friday: {
      type: "poll",
      purpose: "Weekend content planning",
      example: `Weekend poll: Which of these ${niche.toLowerCase()} topics interests you most?`,
    },
    saturday: {
      type: "image",
      purpose: "Behind-the-scenes / weekend content",
      example: `Behind the scenes of our ${niche.toLowerCase()} research process.`,
    },
    sunday: {
      type: "text",
      purpose: "Week wrap-up / preview",
      example: `This week's uploads recap. What was your favorite? Next week we're covering...`,
    },
  };
}

/**
 * Generate engagement templates per niche.
 */
function generateEngagementTemplates(channel) {
  const niche = channel.niche || "";

  return {
    discussion_starters: [
      `What's the most interesting thing you've learned about ${niche.toLowerCase()} recently?`,
      `Hot take: [statement related to niche]. Agree or disagree?`,
      `If you could ask an expert about ${niche.toLowerCase()}, what would you ask?`,
      `What's a common misconception about ${niche.toLowerCase()} that drives you crazy?`,
    ],
    content_teasers: [
      `Research mode: We're digging into something fascinating about ${niche.toLowerCase()} this week. Stay tuned.`,
      `Behind the scenes: The research process for our next video involves [interesting detail].`,
      `Coming soon: A topic we've been wanting to cover for months. It's about [tease].`,
    ],
    community_building: [
      `Shoutout to everyone who suggested last week's topic. The response was incredible.`,
      `We hit [milestone]! Thank you all for being part of this ${niche.toLowerCase()} community.`,
      `Quick question for our regulars: What keeps you coming back?`,
    ],
  };
}

/**
 * Full community strategy generation.
 */
function generateCommunityStrategy(channel) {
  return {
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    channel_id: channel.channel_id,
    channel_name: channel.channel_name,
    niche: channel.niche,

    requirements: {
      minimum_subscribers: 500,
      channel_standing: "No active community strikes",
      notes: "Community tab unlocks at 500 subscribers. Use it to keep audience engaged between uploads.",
    },

    post_types: POST_TYPES,
    weekly_schedule: generateWeeklySchedule(channel),
    engagement_templates: generateEngagementTemplates(channel),

    strategy: {
      posting_frequency: "5-7 posts per week (1 per day minimum)",
      best_times: "Match your upload schedule — post when audience is active",
      purpose: [
        "Keep subscribers active between uploads",
        "Boost engagement signals for algorithm",
        "Research audience preferences for content calendar",
        "Build community loyalty and returning viewers",
        "Tease upcoming content to build anticipation",
      ],
      metrics_to_track: [
        "Poll participation rate",
        "Comment engagement on posts",
        "Click-through to videos from community posts",
        "Subscriber growth after community engagement",
      ],
    },

    rules: [
      "Always use channel branding (colors, font, voice)",
      "Stay on-topic — posts should relate to niche",
      "Don't spam — quality over quantity",
      "Respond to comments on community posts",
      "Use polls to inform content calendar",
      "Tease but don't spoil upcoming content",
      "Pin best community posts to channel page",
    ],
  };
}

/**
 * CLI entry point.
 */
function main() {
  const channelId = process.argv[2];

  if (!channelId) {
    console.error("Usage: node community.js <channel-id>");
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

  const strategy = generateCommunityStrategy(channel);

  const outDir = join(ROOT, "data", "research", channelId);
  mkdirSync(outDir, { recursive: true });

  const outPath = join(outDir, "community-strategy.json");
  writeFileSync(outPath, JSON.stringify(strategy, null, 2));

  console.log(`Community strategy saved: ${outPath}`);
  console.log(`\nWeekly schedule generated (${Object.keys(strategy.weekly_schedule).length} days)`);
  console.log(`Post types: ${Object.keys(strategy.post_types).length}`);
  console.log(`Engagement templates: ${Object.values(strategy.engagement_templates).flat().length}`);
}

export { generateCommunityStrategy, POST_TYPES };

main();
