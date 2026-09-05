/**
 * Performance Tracking — Tracks channel performance via YouTube Analytics API
 * 
 * BLOCKED: Requires YouTube Analytics API OAuth credentials.
 * TODO: Set up GCP project + OAuth credentials, then implement.
 *
 * Usage: node run.js <channel-id> [daily|weekly|monthly]
 * Output: Performance reports to data/performance/
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..", "..");

function main() {
  const channelId = process.argv[2];
  const period = process.argv[3] || "daily";

  if (!channelId) {
    console.error("Usage: node run.js <channel-id> [daily|weekly|monthly]");
    process.exit(1);
  }

  // Load channel config
  const channelsPath = join(ROOT, "config", "channels.json");
  const channelsData = JSON.parse(readFileSync(channelsPath, "utf-8"));
  const channels = channelsData.channels || channelsData;
  const channel = channels.find((c) => String(c.id) === channelId || c.channel_id === channelId);
  
  if (!channel) {
    console.error(`Channel "${channelId}" not found`);
    process.exit(1);
  }

  // Check for API credentials
  const hasApiCreds = channel.youtube_channel_id && channel.youtube_channel_id !== "SET_ME";

  if (!hasApiCreds) {
    console.log(`\n[PERFORMANCE-TRACKING] Channel: ${channelId}`);
    console.log(`\n⚠️  BLOCKED: YouTube Analytics API credentials not configured.`);
    console.log(`\nTo enable performance tracking:`);
    console.log(`1. Create OAuth 2.0 credentials in GCP console`);
    console.log(`2. Enable YouTube Analytics API`);
    console.log(`3. Set as GitHub secret: YT_ANALYTICS_${channelId.toUpperCase().replace(/-/g, "_")}`);
    console.log(`4. Update channels.json with youtube_channel_id`);
    console.log(`\nOnce configured, this module will:`);
    console.log(`- Pull views, watch time, subscriber gains`);
    console.log(`- Compare against competitor benchmarks`);
    console.log(`- Generate weekly learning reports`);
    console.log(`- Feed data into niche-discovery and script-writer`);
    return;
  }

  // TODO: Implement YouTube Analytics API integration
  // - YouTube Analytics API: reports.query
  // - Metrics: views, watchTime, subscriberGains, estimatedRevenue
  // - Dimensions: video, day, week
  // - Compare against competitor benchmarks
  // - Generate performance reports

  console.log(`\n[PERFORMANCE-TRACKING] API available for ${channelId} — implementation pending.`);
}

main();
