/**
 * YouTube Publish — Uploads rendered videos via YouTube Data API v3,
 * sets visibility to private, and auto-publishes after 1 hour.
 *
 * BLOCKED: Requires YouTube Data API OAuth credentials.
 * TODO: Set up GCP project + OAuth credentials, then remove this stub.
 *
 * Usage: node run.js <channel-id>
 * Output: Uploads video, logs to data/run-logs/
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
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
  const channelsData = JSON.parse(readFileSync(channelsPath, "utf-8"));
  const channels = channelsData.channels || channelsData;
  const channel = channels.find((c) => String(c.id) === channelId || c.channel_id === channelId);
  if (!channel) {
    console.error(`Channel "${channelId}" not found`);
    process.exit(1);
  }

  // Check for render output
  const rendersDir = join(ROOT, "data", "renders", channelId);
  if (!existsSync(rendersDir)) {
    console.log(`No renders found for ${channelId}. Run render first.`);
    process.exit(0);
  }

  const renders = readdirSync(rendersDir).filter((f) => f.endsWith(".mp4"));
  if (renders.length === 0) {
    console.log(`No .mp4 files found in ${rendersDir}`);
    process.exit(0);
  }

  // Check for API credentials
  const hasApiCreds = channel.youtube_channel_id && channel.youtube_channel_id !== "" && channel.youtube_channel_id !== "SET_ME";

  if (!hasApiCreds) {
    console.log(`\n[YOUTUBE-PUBLISH] Channel: ${channelId}`);
    console.log(`Found ${renders.length} rendered video(s):`);
    renders.forEach((r) => console.log(`  - ${r}`));
    console.log(`\n⚠️  BLOCKED: YouTube API credentials not configured.`);
    console.log(`\nTo enable publishing:`);
    console.log(`1. Create OAuth 2.0 credentials in GCP console`);
    console.log(`2. Download credentials JSON`);
    console.log(`3. Set as GitHub secret: YT_OAUTH_${channelId.toUpperCase().replace(/-/g, "_")}`);
    console.log(`4. Update channels.json with youtube_channel_id`);
    console.log(`\nVideos are ready for manual upload:`);
    renders.forEach((r) => {
      console.log(`  ${join(rendersDir, r)}`);
    });
    return;
  }

  // TODO: Implement actual YouTube Data API v3 upload
  // - videos.insert: Upload video file with metadata
  // - Set privacyStatus: "private"
  // - Schedule auto-publish after publish_delay_hours
  // - Log upload to data/run-logs/

  console.log(`\n[YOUTUBE-PUBLISH] API available for ${channelId} — implementation pending.`);
  console.log(`Videos ready: ${renders.join(", ")}`);
}

main();
