#!/usr/bin/env node

/**
 * Topic Log — single source of truth for "which topics have already been used
 * per channel". Prevents the system from producing the same subject twice.
 *
 * Used by:
 *   - src/utils/pipeline.js     (selects + reserves the next topic)
 *   - src/skills/script-writer/run.js  (reserves after writing a script)
 *   - src/pipeline/run.cjs      (recommends the next unused topic)
 *
 * CommonJS so it can be loaded synchronously by both CJS and ESM (createRequire).
 *
 * CLI:
 *   node src/utils/topic-log.cjs <channel> list          # show used topics
 *   node src/utils/topic-log.cjs <channel> pick <t1>|<t2>...  # first unused candidate (no write)
 *   node src/utils/topic-log.cjs <channel> reserve "<topic>"
 *   node src/utils/topic-log.cjs status
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const LOG_PATH = path.join(ROOT, 'data', 'topic-log.json');

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'of', 'to', 'in', 'on', 'with',
  'your', 'you', 'how', 'why', 'what', 'who', 'when', 'where', 'do', 'does',
  'is', 'are', 'was', 'were', 'it', 'its', 'this', 'that', 'these', 'those',
  'vs', 'versus', 'really', 'actually', 'so', 'their', 'they', 'we', 'our',
]);

function normalizeChannelId(channelId) {
  const str = String(channelId).trim();
  if (/^\d+$/.test(str)) return String(parseInt(str, 10));
  return str;
}

function normalizeTopic(topic) {
  return String(topic || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function slugify(topic, maxLen = 60) {
  const slug = normalizeTopic(topic).replace(/\s+/g, '-');
  return slug.slice(0, maxLen).replace(/-$/, '');
}

function tokenize(topic) {
  return normalizeTopic(topic)
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w));
}

function jaccard(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

function loadTopicLog() {
  if (!fs.existsSync(LOG_PATH)) {
    return { version: '1.0.0', description: 'Tracks all topics used per channel to prevent duplicates.', channels: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  } catch (err) {
    throw new Error(`topic-log.json is corrupt: ${err.message}`);
  }
}

function saveTopicLog(log) {
  if (!fs.existsSync(path.dirname(LOG_PATH))) fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

function ensureEntry(log, channelId) {
  const key = normalizeChannelId(channelId);
  if (!log.channels[key]) {
    log.channels[key] = { channel_name: '', niche: '', used_topics: [], last_generated: null };
  }
  return log.channels[key];
}

/**
 * Returns true when `topic` (exact slug, normalized string, or strong token
 * overlap) has already been used for the channel.
 */
function isDuplicate(channelId, topic) {
  const log = loadTopicLog();
  const entry = log.channels[normalizeChannelId(channelId)];
  if (!entry || !Array.isArray(entry.used_topics) || entry.used_topics.length === 0) return false;

  const norm = normalizeTopic(topic);
  const toks = tokenize(topic);
  return entry.used_topics.some((u) => {
    const used = typeof u === 'string' ? { topic: u } : u;
    if (normalizeTopic(used.topic) === norm) return true;
    if (used.slug && used.slug === slugify(topic)) return true;
    if (slugify(used.topic) === slugify(topic)) return true;
    return jaccard(toks, tokenize(used.topic)) >= 0.6;
  });
}

function usedTopics(channelId) {
  const log = loadTopicLog();
  const entry = log.channels[normalizeChannelId(channelId)];
  return entry && Array.isArray(entry.used_topics) ? entry.used_topics : [];
}

/**
 * Returns the first candidate that is NOT a duplicate. Returns null when every
 * candidate has already been used.
 */
function pickNextTopic(channelId, candidates) {
  const seen = new Set();
  for (const c of candidates) {
    const topic = typeof c === 'string' ? c : c.topic;
    if (!topic || !String(topic).trim()) continue;
    const key = normalizeTopic(topic);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!isDuplicate(channelId, topic)) return topic;
  }
  return null;
}

/**
 * Registers a topic as used. Idempotent — same topic is never added twice.
 * Also sets last_generated so a channel's most recent topic is queryable.
 *
 * `channelInfo.slug` (optional): the slug the rest of the pipeline actually
 * uses for this topic's artifact filenames (data/research/<ch>/<slug>.json,
 * renders, thumbnails, ...). Pass it whenever the caller has one. Without
 * it this falls back to slugify(topic), which is a DIFFERENT string — e.g.
 * topic "Mint shuts down: Best budgeting app replacements in 2024"
 * slugifies to "mint-shuts-down-best-budgeting-app-replacements-in-2024"
 * while the pipeline's real artifacts sit under the model-chosen
 * "mint-shutdown-2024-budget-app-switch". Storing the wrong one makes the
 * log unusable for locating a topic's files after the fact (already hit
 * once: a channel-2 topic had to be matched up by hand).
 *
 * Dedup is unaffected either way — isDuplicate() re-derives slugify(topic)
 * from the stored topic text rather than trusting the stored slug.
 */
function reserveTopic(channelId, topic, channelInfo = {}) {
  if (!topic || !String(topic).trim()) {
    throw new Error('reserveTopic requires a topic string');
  }
  const log = loadTopicLog();
  const key = normalizeChannelId(channelId);
  const entry = ensureEntry(log, key);
  if (channelInfo.channel_name) entry.channel_name = channelInfo.channel_name;
  if (channelInfo.niche) entry.niche = channelInfo.niche;

  const alreadyUsed = entry.used_topics.some(
    (u) => normalizeTopic(u.topic || u) === normalizeTopic(topic)
  );
  if (!alreadyUsed) {
    entry.used_topics.push({
      topic,
      slug: channelInfo.slug || slugify(topic),
      reserved_at: new Date().toISOString(),
    });
  }
  entry.last_generated = new Date().toISOString();
  saveTopicLog(log);
  return { channel_id: key, topic, added: !alreadyUsed, used_count: entry.used_topics.length };
}

function status() {
  const log = loadTopicLog();
  let total = 0;
  let withTopics = 0;
  for (const data of Object.values(log.channels)) {
    const count = data.used_topics?.length || 0;
    total += count;
    if (count > 0) withTopics++;
  }
  return { channels: Object.keys(log.channels).length, channels_with_topics: withTopics, total_topics_used: total };
}

// ─── CLI ───
function main() {
  const args = process.argv.slice(2);
  const channelId = args[0];
  const cmd = args[1] || 'status';

  if (cmd === 'status') {
    const s = status();
    console.log(`Channels tracked: ${s.channels}`);
    console.log(`Channels with topics: ${s.channels_with_topics}`);
    console.log(`Total topics used: ${s.total_topics_used}`);
    return;
  }

  if (!channelId) {
    console.error('Usage: node src/utils/topic-log.cjs <channel> list|pick|reserve ...');
    process.exit(1);
  }

  if (cmd === 'list') {
    const used = usedTopics(channelId);
    if (used.length === 0) {
      console.log(`Channel ${channelId}: no topics used yet`);
      return;
    }
    console.log(`Channel ${channelId} — used topics (${used.length}):`);
    used.forEach((u, i) => console.log(`  ${i + 1}. ${typeof u === 'string' ? u : u.topic}`));
    return;
  }

  if (cmd === 'pick') {
    const candidates = args.slice(2);
    const next = pickNextTopic(channelId, candidates);
    if (next === null) {
      console.log('No unused candidate found — all are duplicates.');
      process.exitCode = 1;
      return;
    }
    console.log(next);
    return;
  }

  if (cmd === 'reserve') {
    const topic = args.slice(2).join(' ');
    const res = reserveTopic(channelId, topic);
    console.log(res.added
      ? `Reserved "${res.topic}" for channel ${res.channel_id} (${res.used_count} total used).`
      : `Already used — no change (${res.used_count} total used).`);
    return;
  }

  console.error(`Unknown command: ${cmd}`);
  process.exit(1);
}

module.exports = {
  LOG_PATH,
  loadTopicLog,
  saveTopicLog,
  normalizeChannelId,
  normalizeTopic,
  slugify,
  isDuplicate,
  usedTopics,
  pickNextTopic,
  reserveTopic,
  status,
};

if (require.main === module) main();
