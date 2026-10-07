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
// Bare channel id (the form daily-pipeline-v2.yml:116 produces by stripping
// "ch-" and leading zeros) -> YouTube video category. Owner's mapping.
//   5  ch-05 Broadsheet   "True Crime & Investigative Journalism"  -> 25 News & Politics
//   6  ch-06 Archive Room "Cold Cases & Unsolved Mysteries"        -> 24 Entertainment
//   8  ch-08 Ledger       "Financial History & Institutional Collapse" -> 27 Education
//   10 ch-10 Margin Note  "Concept Explainers & Intellectual History"   -> 27 Education
// 6 moved 27 -> 24 and 8 moved 25 -> 27 when the niches widened on
// 2026-10-07. Cold cases are a documentary/entertainment genre, not schooling;
// Ledger's pillars are timeline and formation ("institutional timeline
// breakdowns", "corporate formation stories"), which is history, even though
// "institutional collapse" reads current-affairs.
// 48 is NOT dead: channels.json has no row with id=48, but it does have
// channel_id "ch-48" (Cold Case DNA), and this map is keyed by bare id.
const CATEGORY = { 1: 27, 2: 25, 5: 25, 6: 24, 8: 27, 9: 25, 10: 27, 26: 25, 44: 27, 48: 28 };
const STOP = new Set("the a an and or but of to in on for with at by from is are was were be been this that these those it its as into about how why what when who your you my our we they he she his her their not no new vs after over more most just all can will has have had do does did i me".split(" "));

const log = (m) => console.log(`[trending] ${m}`);

const { resolveChannel, normalizeChannelId } = require("./lib/channel-lookup.cjs");
const bareId = normalizeChannelId;

function loadChannels(cfgPath = join(ROOT, "config", "channels.json")) {
  try { return JSON.parse(readFileSync(cfgPath, "utf-8")).channels || []; }
  catch { return []; }
}

// Channel resolution is scripts/lib/channel-lookup.cjs -- the one implementation. A
// dispatch key names a row only when BOTH id namespaces in channels.json agree with
// it; a key with no such row (ch-48, ch-50) is ambiguous and is skipped here, never
// guessed. This file used to carry its own KNOWN_COLLISIONS copy of that guard and a
// first-match findChannel, which resolved key 26 to Harmony and key 44 to Photosyn.
function findChannel(bare, channels) {
  try { return resolveChannel(bare, channels); }
  catch (e) { log(`ch-${bare}: ${e.message}`); return null; }
}

// Reject candidates with no lexical overlap with the channel's own niche terms.
// The category filter alone is too broad: YouTube's mostPopular for 25 returns
// whatever is popular in News & Politics, which put a video about music-vibe
// coding tools on a newspaper-history channel. Keyword overlap only, no
// embeddings. If nothing survives, keep the closest category candidate rather
// than failing -- an off-niche signal still beats no signal at all.
const NICHE_STOP = new Set("the a an and or but of to in on for with at by from is are was were be been this that these those it its as into about how why what when who your you my our we they he she his her their not no new vs after over more most just all can will has have had do does did i me & vs".split(" "));
const nicheTerms = (niche, pillars) =>
  [...new Set(`${niche || ""} ${(pillars || []).join(" ")}`.toLowerCase()
    .replace(/[^a-z\s]/g, " ").split(/\s+/).map((w) => w.trim()).filter((w) => w.length >= 4 && !NICHE_STOP.has(w)))];

function nicheMatch(video, terms) {
  if (!terms.length) return true; // no niche on the channel -> filter skipped, as before
  const hay = `${video.title} ${(video.tags || []).join(" ")} ${video.channelTitle || ""}`.toLowerCase();
  return terms.some((t) => hay.includes(t));
}

// The seam main() actually calls: rank by velocity, drop the _pub scratch key,
// then niche-filter, then take the top 10. Exported and tested directly so the
// filter's WIRING is covered, not just its helper.
function rankAndFilter(recent, chCfg, limit = 10) {
  const ranked = [...recent].sort((a, b) => b.velocity - a.velocity).map(({ _pub, ...v }) => v);
  const terms = nicheTerms(chCfg?.niche, chCfg?.content_pillars);
  const { kept, dropped, fallback } = applyNicheFilter(ranked, terms);
  return { top: kept.slice(0, limit), dropped, fallback, terms };
}

function applyNicheFilter(top, terms) {
  if (!terms.length) return { kept: top, dropped: 0, fallback: false };
  const kept = top.filter((v) => nicheMatch(v, terms));
  if (kept.length) return { kept, dropped: top.length - kept.length, fallback: false };
  log("no_niche_match — keeping the closest category candidate (filter found nothing)");
  return { kept: top.slice(0, 1), dropped: top.length - 1, fallback: true };
}

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
  const channels = loadChannels();
  const chCfg = findChannel(ch, channels);
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
  const { top, dropped, fallback, terms: nTerms } = rankAndFilter(recent, chCfg);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(file, JSON.stringify({ fetched_at: new Date().toISOString(), channel: ch, category, source: "youtube-data-api-v3", niche_filter: { terms: nTerms.length, dropped, fallback }, videos: top }, null, 2) + "\n");
  const kw = keywords(items.map((v) => v.snippet?.title || ""));
  writeFileSync(join(OUT, `${ch}-keywords.json`), JSON.stringify({ fetched_at: new Date().toISOString(), channel: ch, category, from_titles: items.length, min_titles: 5, keywords: kw }, null, 2) + "\n");
  log(`ch-${ch}: fetched ${items.length}, kept ${recent.length} (last 7 days), top ${top.length} by velocity; ${kw.length} hot term(s)`);
  // Named entities of the top 5 titles -> data/trending/<ch>-entities.json, the research stage's subjects (task 3.1).
  await require("./trending-entities.cjs").writeEntities(ch);
}

module.exports = { keywords, CATEGORY, bareId, loadChannels, findChannel, nicheTerms, nicheMatch, applyNicheFilter, rankAndFilter, main };
if (require.main === module) main().catch((e) => { log(`unexpected error (${e.message}), falling back to unseeded research`); process.exit(0); });
