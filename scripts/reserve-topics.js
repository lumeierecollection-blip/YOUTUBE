#!/usr/bin/env node
/**
 * Stage A output handler — validates and reserves the topics Claude
 * returned, then writes data/topic-log.json exactly once (before the
 * research-and-script matrix fans out, avoiding concurrent commits to the
 * same file).
 *
 * Implements:
 *   SCR-09 — slug not already present in topic-log.json for that channel
 *   SCR-11 — no two channels received the same slug this run
 *
 * Usage: node scripts/reserve-topics.js <path-to-topics.json>
 * Exit: non-zero (with a message on stderr) if either gate fails — the
 * whole discovery step should fail loudly rather than commit a bad log.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const require = createRequire(import.meta.url);
const topicLog = require(join(ROOT, "src", "utils", "topic-log.cjs"));

function loadChannels() {
  const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  const channels = data.channels || data;
  const byId = new Map(channels.map((c) => [String(c.id), c]));
  return byId;
}

function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: node scripts/reserve-topics.js <path-to-topics.json>");
    process.exit(1);
  }

  const parsed = JSON.parse(readFileSync(path, "utf-8"));
  const topics = parsed.topics || parsed;
  if (!Array.isArray(topics) || topics.length === 0) {
    console.error("reserve-topics: no topics in input — nothing to reserve.");
    process.exit(1);
  }

  const channelsById = loadChannels();

  // SCR-11 — no two channels share a slug this run.
  const slugToChannels = new Map();
  for (const t of topics) {
    if (!slugToChannels.has(t.slug)) slugToChannels.set(t.slug, []);
    slugToChannels.get(t.slug).push(t.channel_id);
  }
  const collisions = [...slugToChannels.entries()].filter(([, ids]) => ids.length > 1);
  if (collisions.length > 0) {
    console.error("SCR-11 FAILED — the same slug was assigned to more than one channel this run:");
    for (const [slug, ids] of collisions) {
      console.error(`  "${slug}" -> channels ${ids.join(", ")}`);
    }
    process.exit(1);
  }

  // SCR-09 — slug not already used for that channel.
  const alreadyUsed = topics.filter((t) => topicLog.isDuplicate(t.channel_id, t.topic));
  if (alreadyUsed.length > 0) {
    console.error("SCR-09 FAILED — the following topics are duplicates of a topic already used for that channel:");
    for (const t of alreadyUsed) {
      console.error(`  channel ${t.channel_id}: "${t.topic}" (slug "${t.slug}")`);
    }
    process.exit(1);
  }

  // Reserve. One process, one set of writes, one commit — no concurrent
  // matrix jobs touching this file (that's what caused the original bug's
  // sibling risk; see CHECK-REGISTER SCR-11).
  let reserved = 0;
  for (const t of topics) {
    const channel = channelsById.get(t.channel_id);
    const res = topicLog.reserveTopic(t.channel_id, t.topic, {
      channel_name: channel?.channel_name,
      niche: channel?.niche,
      // Store the slug the matrix actually uses for this topic's artifact
      // filenames, not slugify(topic) — see reserveTopic's header note.
      slug: t.slug,
    });
    if (res.added) reserved++;
    console.log(`channel ${t.channel_id}: reserved "${t.topic}" (slug "${t.slug}")`);
  }

  console.log(`\nReserved ${reserved}/${topics.length} topics.`);
}

main();
