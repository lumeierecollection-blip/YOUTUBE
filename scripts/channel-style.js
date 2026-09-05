#!/usr/bin/env node
/**
 * Prints a channel's style ("minimal" | "motion-graphics" |
 * "cinematic-documentary") to stdout. Used by the workflow to pick which
 * script schema/prompt Stage C should use for a given channel.
 *
 * Usage: node scripts/channel-style.js <channel-id>
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const channelId = process.argv[2];
if (!channelId) {
  console.error("Usage: node scripts/channel-style.js <channel-id>");
  process.exit(1);
}

const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
const channels = data.channels || data;
const channel = channels.find((c) => String(c.id) === String(channelId) || c.channel_id === channelId);
if (!channel) {
  console.error(`Channel "${channelId}" not found`);
  process.exit(1);
}

process.stdout.write(channel.style || "minimal");
