#!/usr/bin/env node
/**
 * Single-channel topic reservation for the per-channel pipeline.
 *
 * Usage: node scripts/reserve-topic-single.js <channel_id> <topic> <slug>
 *
 * Exit codes:
 *   0 — reserved successfully
 *   2 — duplicate detected (SCR-09); caller should skip this channel today,
 *       not fail the pipeline
 *   1 — argument/IO error
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const require = createRequire(import.meta.url);
const topicLog = require(join(ROOT, "src", "utils", "topic-log.cjs"));

const [, , channelId, topic, slug] = process.argv;
if (!channelId || !topic || !slug) {
  console.error("Usage: node scripts/reserve-topic-single.js <channel_id> <topic> <slug>");
  process.exit(1);
}

if (topicLog.isDuplicate(channelId, topic)) {
  // Exit 2: graceful skip — caller treats this as "no video today", not an error.
  console.error(`SCR-09: channel ${channelId} — "${topic}" is a duplicate of a recently-used topic. Skipping this channel today.`);
  process.exit(2);
}

const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
const channels = data.channels || data;
const channel = channels.find((c) => String(c.id) === String(channelId));

topicLog.reserveTopic(channelId, topic, {
  channel_name: channel?.channel_name,
  niche: channel?.niche,
  slug,
});

console.log(`channel ${channelId}: reserved "${topic}" (slug "${slug}")`);
