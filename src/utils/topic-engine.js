/**
 * Topic Engine — Autonomous topic selection with no-repeat enforcement.
 * 
 * Every time the pipeline runs, this picks a fresh topic for each channel
 * from the channel's content_pillars, researching it in real-time via web search.
 * 
 * Usage: node src/utils/topic-engine.js <channel-id>
 * Output: topic details for the pipeline to research and script
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..");
const TOPIC_LOG = join(ROOT, "data", "topic-log.json");

function loadTopicLog() {
  if (existsSync(TOPIC_LOG)) {
    return JSON.parse(readFileSync(TOPIC_LOG, "utf-8"));
  }
  return { channels: {} };
}

function saveTopicLog(log) {
  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(TOPIC_LOG, JSON.stringify(log, null, 2));
}

function loadChannel(channelId) {
  const data = JSON.parse(
    readFileSync(join(ROOT, "config", "channels.json"), "utf-8")
  );
  const channels = data.channels || data;
  const numId = parseInt(channelId, 10);
  return channels.find((c) => c.id === numId || c.channel_id === channelId);
}

function getExistingResearch(channelId) {
  const dir = join(ROOT, "data", "research", channelId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}

function pickFreshTopic(channel, topicLog) {
  const pillars = channel.content_pillars || [];
  const usedForChannel = topicLog.channels?.[String(channel.id)]?.used_topics || [];
  const allUsed = new Set(
    Object.values(topicLog.channels || {}).flatMap(ch => ch.used_topics || [])
  );

  // Try pillars that haven't been used much
  const pillarPriority = [...pillars].sort((a, b) => {
    const aCount = usedForChannel.filter((t) =>
      t.toLowerCase().includes(a.split(" ")[0].toLowerCase())
    ).length;
    const bCount = usedForChannel.filter((t) =>
      t.toLowerCase().includes(b.split(" ")[0].toLowerCase())
    ).length;
    return aCount - bCount;
  });

  // Return the freshest pillar with instructions to research it
  for (const pillar of pillarPriority) {
    const recentTopics = usedForChannel.slice(-10);
    const pillarUsed = recentTopics.some((t) =>
      t.toLowerCase().includes(pillar.split(" ")[0].toLowerCase())
    );
    if (!pillarUsed) {
      return {
        pillar,
        instruction: `Research a specific, engaging topic within the "${pillar}" category for the ${channel.niche} niche. Pick a real, researchable subject — a specific company, event, person, or phenomenon. Make it dramatic and engaging for YouTube. The topic must be UNIQUE — check the topic log to ensure it hasn't been used before across ANY channel.`,
        channel_id: channel.channel_id,
        niche: channel.niche,
        style: channel.style,
        tone: channel.tone,
      };
    }
  }

  // All pillars used recently — pick least-used overall
  const leastUsed = pillarPriority[0];
  return {
    pillar: leastUsed,
    instruction: `Research a NEW specific topic within "${leastUsed}" for the ${channel.niche} niche. All pillars have been used recently, so pick a fresh angle or sub-topic. Must be unique across ALL channels.`,
    channel_id: channel.channel_id,
    niche: channel.niche,
    style: channel.style,
    tone: channel.tone,
  };
}

function recordTopic(channelId, topic, topicLog) {
  if (!topicLog.channels) topicLog.channels = {};
  if (!topicLog.channels[channelId]) {
    topicLog.channels[channelId] = { used_topics: [], last_generated: null };
  }
  topicLog.channels[channelId].used_topics.push(topic);
  topicLog.channels[channelId].last_generated = new Date().toISOString();

  saveTopicLog(topicLog);
}

function main() {
  const channelId = process.argv[2];
  if (!channelId) {
    console.error("Usage: node topic-engine.js <channel-id>");
    process.exit(1);
  }

  const channel = loadChannel(channelId);
  if (!channel) {
    console.error(`Channel "${channelId}" not found`);
    process.exit(1);
  }

  const topicLog = loadTopicLog();
  const existingResearch = getExistingResearch(channelId);

  console.log(`\n=== TOPIC ENGINE: ${channel.channel_name} (${channelId}) ===`);
  console.log(`Niche: ${channel.niche}`);
  console.log(`Style: ${channel.style}`);
  console.log(`Existing research files: ${existingResearch.length}`);
  console.log(`Topics used for this channel: ${(topicLog.channels?.[String(channel.id)]?.used_topics || []).length}`);

  const selection = pickFreshTopic(channel, topicLog);

  console.log(`\n--- SELECTED ---`);
  console.log(`Pillar: ${selection.pillar}`);
  console.log(`Instruction: ${selection.instruction}`);

  // Output as JSON for pipeline consumption
  const output = {
    ...selection,
    timestamp: new Date().toISOString(),
    status: "ready_for_research",
  };

  console.log(`\n--- JSON ---`);
  console.log(JSON.stringify(output, null, 2));
}

// Export for use by pipeline
export { pickFreshTopic, recordTopic, loadTopicLog, saveTopicLog, loadChannel };

main();
