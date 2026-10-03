#!/usr/bin/env node
/**
 * fetch-trending.cjs — this week's most-popular YouTube videos for a
 * channel's category, as a topic signal for discovery (prompts/discover-topics.md).
 *
 *   node scripts/fetch-trending.cjs <channel-id> [--force]
 *     -> data/trending/<ch>.json           top 10 of the last 7 days by velocity
 *        data/trending/<ch>-keywords.json  words in >= 5 of all fetched titles
 *        data/trending/<ch>-entities.json  named entities of the top 5 titles (scripts/trending-entities.cjs)
 *
 * Source: YouTube Data API v3 videos.list chart=mostPopular (1 quota unit a
 * call; 10,000 a day). VidIQ is NOT used: its API needs a paid Max plan and
 * there is no VidIQ key in this repo.
 *
 * chart=mostPopular takes no publishedAfter, so the 7-day window and the
 * velocity rank (viewCount / days since publish) are applied here.
 * Cached 12 h per channel (fetched_at); --force refetches.
 *
 * Never fails the run: no YOUTUBE_API_KEY, 403, 429, quota or network error
 * -> a log line and exit 0 with no file written (the pipeline falls back to
 * unseeded discovery). A trending title is a topic SIGNAL, not a fact: every
 * fact still comes from the research stage's own search (CLAUDE.md).
 */
"use strict";
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "data", "trending");
const CACHE_MS = 12 * 3600 * 1000;
const WEEK_MS = 7 * 24 * 3600 * 1000;
// Channel -> YouTube video category (owner's mapping, 2026-10-02).
const CATEGORY = { 1: 27, 2: 25, 9: 25, 26: 25, 44: 27, 48: 28 };
const STOP = new Set("the a an and or but of to in on for with at by from is are was were be been this that these those it its as into about how why what when who your you my our we they he she his her their not no new vs after over more most just all can will has have had do does did i me".split(" "));

const log = (m) => console.log(`[trending] ${m}`);

function keywords(titles, min = 5) {
  const counts = new Map();
  for (const t of titles) {
    const seen = new Set(String(t).toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).map((w) => w.replace(/^['-]+|['-]+$/g, "")).filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)));
    for (const w of seen) counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1]).map(([term, titles]) => ({ term, titles }));
}

async function main() {
  const ch = String(process.argv[2] || "").trim();
  const force = process.argv.includes("--force");
  if (!ch) { console.error("Usage: node scripts/fetch-trending.cjs <channel-id> [--force]"); process.exit(2); }
  const category = CATEGORY[Number(ch)];
  if (!category) { log(`ch-${ch}: no category mapping, skipped (unseeded discovery)`); return; }
  const file = join(OUT, `${ch}.json`);
  if (!force && existsSync(file)) {
    try {
      const prev = JSON.parse(readFileSync(file, "utf8"));
      const age = Date.now() - Date.parse(prev.fetched_at);
      if (age < CACHE_MS) {
        log(`ch-${ch}: cached ${(age / 3600000).toFixed(1)} h ago (${prev.videos.length} videos), not refetched`);
        await require("./trending-entities.cjs").writeEntities(ch);
        return;
      }
    } catch { /* refetch */ }
  }
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) { log(`ch-${ch}: YOUTUBE_API_KEY missing, falling back to unseeded research`); return; }
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&videoCategoryId=${category}&maxResults=50&key=${encodeURIComponent(key)}`;
  let json;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = json?.error?.errors?.[0]?.reason || json?.error?.message || `HTTP ${res.status}`;
      log(`ch-${ch}: api unavailable (HTTP ${res.status} ${reason}), falling back to unseeded research`);
      return;
    }
  } catch (e) {
    log(`ch-${ch}: api unavailable (${e.message}), falling back to unseeded research`);
    return;
  }
  const items = json.items || [];
  const now = Date.now();
  const recent = items.map((v) => {
    const pub = Date.parse(v.snippet?.publishedAt);
    const days = Math.max(1 / 24, (now - pub) / 86400000);
    const views = Number(v.statistics?.viewCount || 0);
    return { id: v.id, title: v.snippet?.title || "", tags: (v.snippet?.tags || []).slice(0, 15), viewCount: views,
      publishedAt: v.snippet?.publishedAt, channelTitle: v.snippet?.channelTitle || "", velocity: Math.round(views / days), _pub: pub };
  }).filter((v) => Number.isFinite(v._pub) && now - v._pub <= WEEK_MS);
  const top = recent.sort((a, b) => b.velocity - a.velocity).slice(0, 10).map(({ _pub, ...v }) => v);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(file, JSON.stringify({ fetched_at: new Date().toISOString(), channel: ch, category, source: "youtube-data-api-v3", videos: top }, null, 2) + "\n");
  const kw = keywords(items.map((v) => v.snippet?.title || ""));
  writeFileSync(join(OUT, `${ch}-keywords.json`), JSON.stringify({ fetched_at: new Date().toISOString(), channel: ch, category, from_titles: items.length, min_titles: 5, keywords: kw }, null, 2) + "\n");
  log(`ch-${ch}: fetched ${items.length}, kept ${recent.length} (last 7 days), top ${top.length} by velocity; ${kw.length} hot term(s)`);
  // Named entities of the top 5 titles -> data/trending/<ch>-entities.json, the research stage's subjects (task 3.1).
  await require("./trending-entities.cjs").writeEntities(ch);
}

module.exports = { keywords };
if (require.main === module) main().catch((e) => { log(`unexpected error (${e.message}), falling back to unseeded research`); process.exit(0); });
