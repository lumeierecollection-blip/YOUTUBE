/**
 * Daily YouTube Niche Engagement — runs a human-paced daily routine for
 * each configured channel:
 *
 *   • watch  : pull details for `--watch-count` in-niche Shorts
 *              (NOTE: the Data API cannot register real views — the actual
 *              "watching" of a Short happens on a device. This step pulls
 *              each Short's data and paces like a real viewing session.)
 *   • like   : `videos.rate` on the first `--like-count` of those
 *   • comment: `commentThreads.insert` on the first `--comment-count`
 *              (requires the youtube.force-ssl scope — see README note)
 *
 * Humanization (to avoid bot-like patterns):
 *   • random delay between every action with natural variance
 *   • random jitter before the session starts so daily timing varies
 *   • never re-likes / re-comments a video it already engaged within the
 *     cooldown window (state kept per channel)
 *   • never touches the channel's own uploads
 *
 * Usage:
 *   node src/utils/youtube-engage.js <channel-id|all> [--watch-count 25]
 *       [--like-count 10] [--comment-count 3] [--cooldown-days 30]
 *       [--start-jitter-min 20] [--dry-run]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getAccessToken } from "./youtube-auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

const API = "https://www.googleapis.com/youtube/v3";
const SHORTS_MAX = 60; // seconds
const FALLBACK_MAX = 240; // seconds

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(min + Math.random() * (max - min));

function loadChannel(channelId) {
  const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  const channel = (data.channels || data).find((c) => c.channel_id === channelId);
  if (!channel) throw new Error(`Channel "${channelId}" not found`);
  return channel;
}

function buildQueries(channel) {
  const sources = [channel.niche, ...(channel.tags || []), ...(channel.content_pillars || [])]
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  const queries = new Set();
  for (const s of sources) {
    queries.add(s);
    const words = s.split(/\s+/);
    if (words.length > 2) queries.add(words.slice(0, 3).join(" "));
    if (words.length > 4) queries.add(words.slice(0, 2).join(" "));
  }
  return [...queries].slice(0, 6);
}

function durationSeconds(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return (parseInt(m?.[1] || 0) * 3600) + (parseInt(m?.[2] || 0) * 60) + parseInt(m?.[3] || 0);
}

function statePath(channelId) {
  return join(ROOT, "data", "run-logs", channelId, "engagement-state.json");
}

function loadState(channelId) {
  const p = statePath(channelId);
  if (!existsSync(p)) return { videos: {}, last_run: null };
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return { videos: {}, last_run: null };
  }
}

function saveState(channelId, state) {
  mkdirSync(dirname(statePath(channelId)), { recursive: true });
  writeFileSync(statePath(channelId), JSON.stringify(state, null, 2));
}

async function searchCandidates(channel, token, want) {
  const queries = buildQueries(channel);
  const seen = new Map();

  for (const q of queries) {
    if (seen.size >= want * 3) break;
    const url = `${API}/search?part=snippet&type=video&q=${encodeURIComponent(q)}&videoDuration=short&maxResults=10&order=relevance&safeSearch=moderate`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (!res.ok) throw new Error(`search failed: ${json.error?.message || res.status}`);
    for (const item of json.items || []) {
      if (item.snippet.channelId === channel.youtube_channel_id) continue;
      if (!seen.has(item.id.videoId)) seen.set(item.id.videoId, item.snippet);
    }
  }

  const ids = [...seen.keys()].slice(0, want * 3);
  if (ids.length === 0) return [];

  const vres = await fetch(`${API}/videos?part=snippet,contentDetails,statistics&id=${ids.join(",")}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const vjson = await vres.json();
  if (!vres.ok) throw new Error(`videos.list failed: ${vjson.error?.message || vres.status}`);

  return (vjson.items || [])
    .map((v) => ({
      id: v.id,
      title: v.snippet.title,
      channel_title: v.snippet.channelTitle,
      channel_id: v.snippet.channelId,
      duration: durationSeconds(v.contentDetails.duration),
      view_count: parseInt(v.statistics?.viewCount || 0),
    }))
    .filter((v) => v.duration > 0 && v.duration <= FALLBACK_MAX)
    .sort((a, b) => {
      const aShort = a.duration <= SHORTS_MAX ? 0 : 1;
      const bShort = b.duration <= SHORTS_MAX ? 0 : 1;
      return aShort - bShort;
    });
}

function shortTopic(video) {
  return video.title
    .replace(/\s*#\S+/g, "")
    .replace(/[|,](.*)$/, "")
    .replace(/[-–—:]\s*[^-–—:]*$/, "")
    .trim()
    .slice(0, 90);
}

function buildComment(video, channel, idx) {
  const topic = shortTopic(video);
  const niche = (channel.niche || channel.channel_name).toLowerCase();
  const drafts = [
    `Great video on ${topic} — the pacing made it really easy to follow.`,
    `Really nice breakdown of ${topic}. Exactly the kind of ${niche} content I was looking for.`,
    `${topic} — didn't expect that ending. Well put together.`,
    `Just got this recommended and it did not disappoint. Great stuff on ${topic}.`,
    `Appreciate the clear explanation of ${topic} here. Really helpful.`,
    `This is a genuinely interesting angle on ${topic}. Thanks for posting.`,
    `Nice one — ${topic} is such a rabbit hole, and this summed it up well.`,
  ];
  return drafts[idx % drafts.length];
}

async function likeVideo(token, videoId) {
  const res = await fetch(`${API}/videos/rate?rating=like&id=${videoId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

async function postComment(token, videoId, text) {
  const res = await fetch(`${API}/commentThreads?part=snippet`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      snippet: { videoId, topLevelComment: { snippet: { textOriginal: text } } },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status}`);
  return json.id;
}

async function engageChannel(channelId, opts) {
  const { watchCount, likeCount, commentCount, cooldownDays, startJitterMin, dryRun, fast } = opts;
  const channel = loadChannel(channelId);
  const state = loadState(channelId);
  const token = await getAccessToken(channel);

  console.log(`\n═══════════════════════════════════════`);
  console.log(`  ${channel.channel_id} — ${channel.channel_name}`);
  console.log(`  Niche: ${channel.niche}`);
  console.log(`  Plan: watch ${watchCount} | like ${likeCount} | comment ${commentCount}`);
  console.log(`═══════════════════════════════════════`);

  const cooldownMs = cooldownDays * 24 * 3600 * 1000;
  const now = Date.now();
  const fresh = (v) => {
    const rec = state.videos[v.id];
    return !rec || (now - Date.parse(rec.last_seen || rec.liked || rec.commented || now)) > cooldownMs;
  };

  const candidates = await searchCandidates(channel, token, watchCount);
  const pool = candidates.filter(fresh).slice(0, watchCount);

  if (pool.length === 0) {
    console.log(`  No fresh in-niche Shorts available (${state.videos ? Object.keys(state.videos).length : 0} already engaged).`);
    return { watched: 0, liked: 0, commented: 0 };
  }

  // Session start jitter so daily timing isn't identical
  if (startJitterMin > 0 && !fast) {
    const jitter = rand(0, startJitterMin * 60 * 1000);
    console.log(`  Session jitter: starting in ${Math.round(jitter / 60000 * 10) / 10} min`);
    await sleep(jitter);
  }

  // "WATCH" — pull each Short's details, paced like a real viewing session
  console.log(`  Watching ${pool.length} Short(s):`);
  for (const v of pool) {
    state.videos[v.id] = state.videos[v.id] || {};
    state.videos[v.id].last_seen = new Date().toISOString();
    console.log(`   • ${v.title} [${Math.round(v.duration)}s, ${v.channel_title}]`);
    if (!fast) await sleep(rand(9000, 26000));
  }

  if (dryRun) {
    console.log(`\n  DRY-RUN: would like ${Math.min(likeCount, pool.length)} and comment on ${Math.min(commentCount, pool.length)}:`);
    pool.slice(0, commentCount).forEach((v, i) => {
      console.log(`    - "${buildComment(v, channel, i)}"`);
    });
    console.log("  (state not saved in dry-run)");
    return { watched: pool.length, liked: 0, commented: 0 };
  }

  // LIKE
  let liked = 0;
  const likeTargets = pool.slice(0, likeCount);
  for (const v of likeTargets) {
    if (await likeVideo(token, v.id)) {
      state.videos[v.id].liked = new Date().toISOString();
      liked++;
      console.log(`  ✓ Liked ${v.id}`);
    } else {
      console.log(`  ~ Already liked or failed: ${v.id}`);
    }
    if (!fast) await sleep(rand(6000, 18000));
  }

  // COMMENT
  let commented = 0;
  const commentTargets = pool.slice(0, commentCount);
  for (let i = 0; i < commentTargets.length; i++) {
    const v = commentTargets[i];
    const text = buildComment(v, channel, i);
    try {
      const id = await postComment(token, v.id, text);
      state.videos[v.id].commented = new Date().toISOString();
      commented++;
      console.log(`  ✓ Commented ${v.id} -> ${id}`);
    } catch (err) {
      console.log(`  ✗ Comment failed ${v.id}: ${err.message}`);
    }
    if (!fast) await sleep(rand(20000, 60000));
  }

  state.last_run = new Date().toISOString();
  saveState(channelId, state);
  console.log(`  Done: watched ${pool.length} | liked ${liked} | commented ${commented}`);
  return { watched: pool.length, liked, commented };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const getOpt = (flag, def) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? parseInt(args[idx + 1], 10) : def;
  };
  const opts = {
    watchCount: getOpt("--watch-count", 25),
    likeCount: getOpt("--like-count", 10),
    commentCount: getOpt("--comment-count", 3),
    cooldownDays: getOpt("--cooldown-days", 30),
    startJitterMin: getOpt("--start-jitter-min", 20),
    dryRun,
    fast: args.includes("--fast"),
  };

  const target = args.find((a) => !a.startsWith("--"));
  if (!target) {
    console.error("Usage: node youtube-engage.js <channel-id|all> [--watch-count 25] [--like-count 10] [--comment-count 3] [--start-jitter-min 20] [--dry-run] [--fast]");
    process.exit(1);
  }

  const channels = target === "all"
    ? (JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8")).channels || [])
        .filter((c) => c.youtube_channel_id && c.youtube_credentials_path)
    : [loadChannel(target)];

  let total = { watched: 0, liked: 0, commented: 0 };
  for (let i = 0; i < channels.length; i++) {
    const r = await engageChannel(channels[i].channel_id, opts);
    total.watched += r.watched;
    total.liked += r.liked;
    total.commented += r.commented;
    if (i < channels.length - 1) {
      await sleep(rand(30000, 120000));
    }
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`  TOTAL (${channels.length} channels): watched ${total.watched} | liked ${total.liked} | commented ${total.commented}`);
  console.log(`═══════════════════════════════════════`);
}

main().catch((err) => {
  console.error(`\nERROR: ${err.message}`);
  process.exit(1);
});
