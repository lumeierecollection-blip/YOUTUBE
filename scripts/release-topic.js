#!/usr/bin/env node
/**
 * Release a topic reservation made earlier in the same prep job.
 *
 * Usage: node scripts/release-topic.js <channel_id> <slug>
 *
 * Reserve runs before research and script. When a later stage fails or the
 * job is cancelled, no video is made, but the reservation used to stay in
 * data/topic-log.json and block that topic for 90 days as a "duplicate".
 * Removes only the entry with this exact slug. Exit 0 whether or not it was
 * present (a release is idempotent); exit 1 on argument/IO errors.
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const topicLog = require(join(__dirname, "..", "src", "utils", "topic-log.cjs"));

const [, , channelId, slug] = process.argv;
if (!channelId || !slug) {
  console.error("Usage: node scripts/release-topic.js <channel_id> <slug>");
  process.exit(1);
}

const log = topicLog.loadTopicLog();
const key = topicLog.normalizeChannelId(channelId);
const entry = log.channels?.[key];
const before = entry?.used_topics?.length || 0;
if (entry?.used_topics) entry.used_topics = entry.used_topics.filter((t) => t.slug !== slug);
const removed = before - (entry?.used_topics?.length || 0);
if (removed) topicLog.saveTopicLog(log);
console.log(`channel ${channelId}: released ${removed} reservation(s) for "${slug}"`);
