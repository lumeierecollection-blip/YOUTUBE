/**
 * Shorts Optimization — YouTube Shorts algorithm and production rules.
 *
 * Usage: node src/utils/shorts.js <channel-id> <topic>
 * Output: data/research/<channel-id>/<topic>-shorts-spec.json
 *
 * Shorts have a SEPARATE recommendation system from long-form.
 * Key signals: swipe-away rate, completion rate, engagement.
 * 70%+ "viewed" rate triggers wider distribution.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__filename, "..", "..");

/**
 * Shorts algorithm rules (2026).
 */
const ALGORITHM_RULES = {
  ranking_signals: [
    { signal: "Swipe-away rate", importance: "HIGHEST", description: "What % swiped past without watching. Under 30% swipe-away = strong." },
    { signal: "Completion rate", importance: "HIGH", description: "Percentage who watch to the final frame. 60%+ is target." },
    { signal: "Average percentage viewed", importance: "HIGH", description: "How much of total video average viewer watched. 85-95% is good." },
    { signal: "Rewatch rate", importance: "MEDIUM", description: "Did viewers replay the Short? >100% = viral potential." },
    { signal: "Engagement", importance: "MEDIUM", description: "Likes, comments, shares, saves. Likes-to-views ratio is quality multiplier." },
    { signal: "Subscription rate", importance: "MEDIUM", description: "Unique to YouTube — Shorts that drive subs get promoted more." },
  ],
  distribution_pipeline: [
    { step: 1, name: "Seed audience", description: "YouTube shows to small group (100-1000 viewers) based on topic/channel signals" },
    { step: 2, name: "Test (24-72 hours)", description: "Measures swipe-away, hook retention, completion, engagement, rewatch" },
    { step: 3, name: "Decision", description: "If clears threshold for niche + length → expand. If not → stop." },
    { step: 4, name: "Expansion loop", description: "Progressively larger audience segments, each re-testing" },
    { step: 5, name: "Plateau", description: "All Shorts plateau. 3-7 day view window is natural lifecycle." },
  ],
  critical_thresholds: {
    viewed_rate_trigger: "70%+",
    hook_retention_target: "50%+ past 3 seconds",
    completion_rate_target: "60%+",
    first_3_seconds_rule: "If viewer doesn't swipe in first 2s, probability of full completion increases 60%",
  },
  distribution_tiers: {
    tier_1: "< 50% viewed → algorithm stops testing within 1,000 views",
    tier_2: "50-70% viewed → standard distribution (1K-10K views)",
    tier_3: "70%+ viewed → expanded distribution (10K-100K+ views)",
  },
};

/**
 * Shorts production specs.
 */
function generateShortsSpec(topic, channel) {
  const niche = channel.niche || "";

  return {
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    topic,
    channel_id: channel.channel_id,

    // ─── Specs ───
    specs: {
      max_length: "3 minutes (180 seconds)",
      optimal_length: "15-45 seconds",
      orientation: "9:16 vertical (square works but less immersive)",
      resolution: "1080x1920",
      aspect_ratio: "9:16",
      format: "MP4 (H.264)",
    },

    // ─── Algorithm ───
    algorithm: ALGORITHM_RULES,

    // ─── Hook Rules (First 3 Seconds) ───
    hook: {
      critical_window: "First 2-3 seconds determine everything",
      rules: [
        "Start with movement or speech mid-sentence — never silent intro",
        "Show the most dramatic visual FIRST, explain second",
        "Use text overlay in first 1 second for context",
        "Max 0.2 seconds silence in first 3 seconds",
        "Start with punchy SFX synced to first word",
      ],
      hook_types: [
        { type: "Final Result First", description: "Show the end result, then reveal how", example: "POV: You just discovered..." },
        { type: "Questionable Truth", description: "State something surprising or counterintuitive", example: "This is actually dangerous..." },
        { type: "Visual Pattern Interrupt", description: "Something unexpected happens immediately", example: "Unexpected transformation" },
        { type: "Negative Hook", description: "What NOT to do", example: "Stop doing this with your..." },
        { type: "Curiosity Gap", description: "Open a question that demands watching", example: "Wait for it..." },
      ],
    },

    // ─── Audio ───
    audio: {
      max_silence_gap_first_3s: "0.2 seconds",
      max_silence_gap_after_3s: "0.3-0.4 seconds",
      minimum_layers: 3,
      layers: ["voice", "rhythm_bed", "punctuation_sounds"],
      punctuation_frequency: "Every ~2.1 seconds",
      music_bpm_info: "95-110",
      music_bpm_entertainment: "120-130",
      sfx_density: "0.5-1 per second (maximum density)",
      opening_sfx: "Start with punchy SFX synced to first word",
      winning_sounds: ["Vine Boom", "Metal Pipe Clang", "Discord Notification", "whoosh", "impact hit"],
    },

    // ─── Visual ───
    visual: {
      motion: "Constant motion — never static frames",
      cuts: "Fast cuts every 1-2 seconds",
      text_overlay: "Large, bold, center-screen, appears in first 0.5s",
      zoom: "Dynamic zoom/push-in on key moments",
      captions: "Burned-in (platforms strip external caption files)",
      safe_zones: "Keep text away from bottom 15% (UI) and top 10% (status bar)",
    },

    // ─── Metadata ───
    metadata: {
      title: "Under 40 characters, keyword-rich, clear about content",
      description: "2-3 sentences with relevant keywords",
      hashtags: "#Shorts + 2-3 niche-specific hashtags",
      thumbnail: "Custom thumbnail — appears in search/channel page",
      notes: "Shorts have search-based discovery too. Optimize titles for search.",
    },

    // ─── Strategy ───
    strategy: {
      posting_frequency: "3-5 Shorts per week (not daily)",
      best_times: "Test and find optimal for your audience",
      cross_posting: "Repost to TikTok, Instagram Reels, Facebook Reels",
      funnel: "Shorts = top of funnel. Drive subscribers who watch long-form.",
      series: "Create series that reward returning viewers",
      community_tab: "Pin comment with subscribe CTA on best-performing Shorts",
    },

    // ─── Shorts vs Long-Form Differences ───
    differences_from_longform: {
      algorithm: "Completely separate recommendation system",
      subscribers: "Do NOT automatically see your Shorts in main feed",
      watch_time: "Shorts watch time does NOT count toward 4,000 hours",
      monetization: "Pooled revenue model, ~45% goes to music licensing",
      rpm: "$0.03-$0.10 per 1,000 views (vs $5+ for long-form)",
      thumbnails: "Custom thumbnails appear in search/channel page",
      discovery: "Shorts shelf, Home screen, Search, Suggested",
    },

    // ─── Monetization ───
    monetization: {
      requirement: "1,000 subs + 10M Shorts views in 90 days (or 4,000 watch hours)",
      revenue_model: "Pooled — YouTube takes ~45% for music licensing",
      rpm_range: "$0.03-$0.10 per 1,000 views",
      tip: "Original audio earns more per view than licensed music",
      strategy: "Shorts grow audience, long-form earns ad revenue, brand deals do heavy lifting",
    },
  };
}

/**
 * CLI entry point.
 */
function main() {
  const channelId = process.argv[2];
  const topic = process.argv[3];

  if (!channelId || !topic) {
    console.error("Usage: node shorts.js <channel-id> <topic>");
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

  const spec = generateShortsSpec(topic, channel);

  const outDir = join(ROOT, "data", "research", channelId);
  mkdirSync(outDir, { recursive: true });

  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const outPath = join(outDir, `${slug}-shorts-spec.json`);
  writeFileSync(outPath, JSON.stringify(spec, null, 2));

  console.log(`Shorts spec saved: ${outPath}`);
  console.log(`\nKey rules:`);
  console.log(`  Optimal length: ${spec.specs.optimal_length}`);
  console.log(`  Max silence first 3s: ${spec.audio.max_silence_gap_first_3s}`);
  console.log(`  SFX density: ${spec.audio.sfx_density}`);
  console.log(`  Viewed rate target: ${spec.algorithm.critical_thresholds.viewed_rate_trigger}`);
}

export { generateShortsSpec, ALGORITHM_RULES };

main();
