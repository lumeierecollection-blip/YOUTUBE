/**
 * Trend Research — Fetches trending topics from YouTube Data API v3
 * to inform topic selection for each channel.
 *
 * BLOCKED: Requires YouTube Data API credentials.
 * TODO: Set up GCP project + OAuth credentials, then remove this stub.
 *
 * Usage: node run.js <channel-id>
 * Output: data/trends/<channel-id>/trending.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..", "..");

function main() {
  const channelId = process.argv[2];
  if (!channelId) {
    console.error("Usage: node run.js <channel-id>");
    process.exit(1);
  }

  // Load channel config
  const channelsPath = join(ROOT, "config", "channels.json");
  const channels = JSON.parse(readFileSync(channelsPath, "utf-8"));
  const channel = channels.find((c) => c.channel_id === channelId);
  if (!channel) {
    console.error(`Channel "${channelId}" not found`);
    process.exit(1);
  }

  // Check for API credentials
  const hasApiCreds = process.env.YOUTUBE_API_KEY || channel.youtube_channel_id !== "SET_ME";

  if (!hasApiCreds) {
    console.log(`\n[TREND-RESEARCH] Channel: ${channelId}`);
    console.log(`Niche: ${channel.niche} / ${channel.niche_sub}`);
    console.log(`\n⚠️  BLOCKED: YouTube Data API credentials not configured.`);
    console.log(`\nTo enable trend research:`);
    console.log(`1. Create a GCP project at https://console.cloud.google.com`);
    console.log(`2. Enable the YouTube Data API v3`);
    console.log(`3. Create an API key or OAuth credentials`);
    console.log(`4. Set YOUTUBE_API_KEY env var or update channels.json`);
    console.log(`\nFalling back to content pillars for topic selection:`);
    channel.content_pillars.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p}`);
    });

    // Generate placeholder trend file
    const outDir = join(ROOT, "data", "trends", channelId);
    mkdirSync(outDir, { recursive: true });
    const trendData = {
      meta: {
        channel_id: channelId,
        generated_at: new Date().toISOString(),
        api_available: false,
        fallback: "content_pillars",
      },
      trending_topics: [],
      content_pillars: channel.content_pillars,
      notes: "API credentials not available. Using content pillars as topic source.",
    };
    writeFileSync(join(outDir, "trending.json"), JSON.stringify(trendData, null, 2));
    return;
  }

  // TODO: Implement actual YouTube Data API v3 calls
  // - search.list: Find trending videos in niche
  // - videos.list: Get view counts, engagement metrics
  // - channels.list: Benchmark against competitors
  console.log(`\n[TREND-RESEARCH] API available for ${channelId} — implementation pending.`);
}

main();
