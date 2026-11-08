/**
 * Discovery: fetch real signals, have a model group them into candidates tied to those signals,
 * measure each candidate, score it, and pick the winner. Every source's outcome is recorded,
 * including the ones that failed, so a thin result is visible rather than hidden.
 */
import { join } from "node:path";
import { CONFIG, StageError, askJson, fetchWithTimeout, log, slugify, writeJson } from "./lib.mjs";
import { rejections, scoreCandidate, similarity } from "./score.mjs";

const decode = (s) => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const tag = (xml, name) => (xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i")) || [])[1];
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

function parseFeed(xml, kind) {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  return blocks.map((b) => {
    const atomLink = (b.match(/<link[^>]*href="([^"]+)"/i) || [])[1];
    const url = decode(tag(b, "link")) || atomLink || "";
    const sourceUrl = (b.match(/<source[^>]*url="([^"]+)"/i) || [])[1];
    const when = Date.parse(decode(tag(b, "pubDate") || tag(b, "updated") || tag(b, "published") || ""));
    return { title: decode(tag(b, "title")), url, domain: hostOf(sourceUrl || url), published_ms: Number.isFinite(when) ? when : null, kind };
  }).filter((x) => x.title && x.published_ms);
}

async function source(report, name, fn) {
  try {
    const items = await fn();
    report.push({ source: name, ok: true, items: items.length });
    return items;
  } catch (e) {
    report.push({ source: name, ok: false, error: String(e.message).slice(0, 120) });
    return [];
  }
}

const getText = async (url) => {
  const r = await fetchWithTimeout(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
};
const getJson = async (url, opts) => {
  const r = await fetchWithTimeout(url, opts);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

const newsSearch = async (q, days) => parseFeed(await getText(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:${days}d&hl=en-US&gl=US&ceid=US:en`), "news");

/** Wave 2 widens the net to the channel's content pillars over 14 days. */
async function collectSignals(channel, nowMs, wave = 1) {
  const report = [];
  const tasks = [];
  const queries = wave === 1 ? channel.news_queries : channel.pillars;
  for (const q of queries) {
    tasks.push(source(report, `google-news:${q}`, () => newsSearch(q, wave === 1 ? 7 : 14)));
  }
  for (const f of channel.feeds) tasks.push(source(report, `feed:${hostOf(f)}`, async () => parseFeed(await getText(f), "feed")));
  for (const sub of channel.reddit) {
    tasks.push(source(report, `reddit:${sub}`, async () => {
      const j = await getJson(`https://www.reddit.com/r/${sub}/top.json?t=week&limit=25`);
      return j.data.children.map((c) => ({ title: c.data.title, url: `https://www.reddit.com${c.data.permalink}`, domain: "reddit.com", published_ms: c.data.created_utc * 1000, points: c.data.score, kind: "reddit" }));
    }));
  }
  tasks.push(source(report, "hacker-news", async () => {
    const since = Math.floor((nowMs - 7 * 86400e3) / 1000);
    const j = await getJson(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(channel.hn_query)}&tags=story&numericFilters=created_at_i>${since},points>40&hitsPerPage=40`);
    return j.hits.map((h) => ({ title: h.title, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, domain: hostOf(h.url) || "news.ycombinator.com", published_ms: h.created_at_i * 1000, points: h.points, kind: "hn" }));
  }));
  tasks.push(source(report, "google-trends", async () => parseFeed(await getText("https://trends.google.com/trending/rss?geo=US"), "trends").map((x) => ({ ...x, domain: "trends.google.com" }))));
  if (channel.treatment === "vox") {
    const d = new Date(nowMs);
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0"), dd = String(d.getUTCDate()).padStart(2, "0");
    tasks.push(source(report, "wikipedia-on-this-day", async () => {
      const j = await getJson(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/${mm}/${dd}`);
      return j.events.map((e) => ({ title: `${e.year}: ${e.text}`, url: e.pages?.[0]?.content_urls?.desktop?.page || "https://en.wikipedia.org", domain: "wikipedia.org", published_ms: nowMs, kind: "anniversary" }));
    }));
  }
  const all = (await Promise.all(tasks)).flat();
  const seen = new Set();
  const items = all.filter((x) => { const k = x.title.toLowerCase().slice(0, 70); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (b.points || 0) - (a.points || 0) || b.published_ms - a.published_ms).slice(0, 110)
    .map((x, i) => ({ ...x, id: i }));
  return { items, report };
}

/**
 * Looks for independent reporting of a proposed story. A headline counts only if it shares most
 * of the topic's significant words, so a merely related article cannot inflate the source count.
 */
async function corroborate(c, nowMs) {
  try {
    const found = await newsSearch(c.youtube_query || c.topic, 14);
    const known = new Set(c.evidence.map((e) => e.url));
    const extra = found.filter((x) => !known.has(x.url) && similarity(x.title, c.topic) >= 0.5 && nowMs - x.published_ms < 14 * 86400e3).slice(0, 8);
    return [...c.evidence, ...extra];
  } catch { return c.evidence; }
}

async function wikipediaSignal(title, nowMs) {
  if (!title) return null;
  const day = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(title.replace(/ /g, "_"))}/daily/${day(nowMs - 30 * 86400e3)}/${day(nowMs - 86400e3)}`;
  try {
    const j = await getJson(url);
    const v = j.items.map((i) => i.views);
    if (v.length < 14) return null;
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const recent = avg(v.slice(-7)), prior = avg(v.slice(0, -7));
    return { title, daily_views: Math.round(recent), ratio: prior ? Math.round((recent / prior) * 100) / 100 : null };
  } catch { return null; }
}

/** Real competing videos for the topic: what is already out there, and how many views it gets. */
async function youtubeSignal(query, nowMs) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  try {
    const after = new Date(nowMs - 60 * 86400e3).toISOString();
    const s = await getJson(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&order=relevance&publishedAfter=${after}&q=${encodeURIComponent(query)}&key=${key}`);
    const ids = s.items.map((i) => i.id.videoId);
    if (!ids.length) return { median_views: 0, competitors: [] };
    const v = await getJson(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids.join(",")}&key=${key}`);
    const rows = v.items.map((x) => ({ id: x.id, title: x.snippet.title, channel: x.snippet.channelTitle, views: Number(x.statistics.viewCount || 0) })).sort((a, b) => b.views - a.views);
    const sorted = rows.map((r) => r.views).sort((a, b) => a - b);
    return { median_views: sorted[Math.floor(sorted.length / 2)] || 0, competitors: rows.slice(0, 6) };
  } catch (e) { return { error: String(e.message).slice(0, 80) }; }
}

async function commonsHits(query) {
  try {
    const j = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srlimit=20&format=json&srsearch=${encodeURIComponent(query)}`);
    return j.query.search.length;
  } catch { return null; }
}

function candidatePrompt(channel, items, learned, exclude = []) {
  const list = items.map((x) => `${x.id} | ${x.kind} | ${x.domain} | ${Math.round((Date.now() - x.published_ms) / 3600e3)}h ago${x.points ? ` | ${x.points} pts` : ""} | ${x.title}`).join("\n");
  return `You pick stories for the YouTube Shorts channel "${channel.name}".
Audience: ${channel.audience_note}
Content pillars: ${channel.pillars.join("; ")}.
${learned ? `What this channel's own data shows so far: ${learned}\n` : ""}
${exclude.length ? `Already considered and not usable, do not propose these again:\n${exclude.map((t) => `- ${t}`).join("\n")}\n\n` : ""}Below are real items fetched today (id | kind | domain | age | title). Propose up to 12 candidate video topics. Keep each field short.

Rules:
- Each candidate must be grounded in the listed items. Put their ids in evidence_ids, and only group items that report the same story.
- Prefer stories an ordinary person would stop scrolling for, and that fit a 30-second Short.
- Do not invent anything that is not implied by the items.
- anniversary=true only when the story rests on a "anniversary" item.
- ratings are your editorial judgement, 0-10: curiosity (strength of the opening hook), relevance (fit to this audience), visual (can it be shown, not just told).
- wikipedia_title is the exact English Wikipedia article most central to the story, or "" if none.
- commons_query is a short Wikimedia Commons search for real historical images of the subject (use "" for technology topics).

Items:
${list}

Return JSON: {"candidates":[{"topic":"...","pillar":"...","evidence_ids":[1,2],"hook":"one line","anniversary":false,"explainable_30s":true,"ratings":{"curiosity":0,"relevance":0,"visual":0},"wikipedia_title":"","commons_query":"","youtube_query":"short search phrase"}]}`;
}

async function scoreWave({ channel, items, ledger, learned, exclude, nowMs }) {
  const raw = await askJson(candidatePrompt(channel, items, learned, exclude), "autopilot-discover");
  const byId = new Map(items.map((x) => [x.id, x]));
  const history = ledger.topics.filter((t) => t.channel === channel.id);
  const proposals = (raw.candidates || []).map((c) => ({ ...c, evidence: (c.evidence_ids || []).map((id) => byId.get(Number(id))).filter(Boolean) })).filter((c) => c.topic && c.evidence.length);
  const scored = [];
  for (const c of proposals) {
    const [evidence, wikipedia, youtube, hits] = await Promise.all([
      corroborate(c, nowMs),
      wikipediaSignal(c.wikipedia_title, nowMs),
      youtubeSignal(c.youtube_query || c.topic, nowMs),
      channel.treatment === "vox" && c.commons_query ? commonsHits(c.commons_query) : null,
    ]);
    const cand = { ...c, evidence, wikipedia, youtube: youtube?.error ? null : youtube, commons_hits: hits };
    const score = scoreCandidate(cand, { channel, weights: CONFIG.score_weights, nowMs });
    const rejected = rejections(cand, score, { history, minScore: CONFIG.min_topic_score, nowMs, windowDays: CONFIG.similarity_window_days });
    scored.push({ ...cand, score, rejected });
  }
  return scored;
}

/**
 * Returns every eligible candidate, best first. Fails only after two discovery waves found
 * nothing eligible, with each candidate's rejection reasons recorded in candidates.json.
 */
export async function discover({ channel, ledger, dir, learned, nowMs = Date.now() }) {
  const all = [], reports = [];
  for (const wave of [1, 2]) {
    const { items, report } = await collectSignals(channel, nowMs, wave);
    reports.push({ wave, item_count: items.length, sources: report });
    log("discover", `wave ${wave}: ${items.length} items from ${report.filter((r) => r.ok).length}/${report.length} sources`);
    if (items.length < 8) continue;
    const scored = await scoreWave({ channel, items, ledger, learned, exclude: all.map((c) => c.topic), nowMs });
    for (const c of scored) if (!all.some((x) => similarity(x.topic, c.topic) >= 0.6)) all.push({ ...c, wave });
    if (all.some((c) => !c.rejected.length)) break;
  }
  all.sort((a, b) => b.score.total - a.score.total);
  writeJson(join(dir, "candidates.json"), { generated_at: new Date(nowMs).toISOString(), waves: reports, candidates: all });
  const eligible = all.filter((c) => !c.rejected.length);
  if (!eligible.length) {
    const best = all[0];
    throw new StageError("discover", best ? `discovery failure: ${all.length} candidates, none eligible. Best "${best.topic}" (${best.score.total}): ${best.rejected.join("; ")}` : "discovery failure: no candidate could be tied to fetched evidence");
  }
  log("discover", `${eligible.length} eligible of ${all.length}; top "${eligible[0].topic}" ${eligible[0].score.total}`);

  const withAngle = async (winner) => {
    const angle = await askJson(`A Short is being made about: "${winner.topic}".
Existing popular videos on it:
${(winner.youtube?.competitors || []).map((v) => `- ${v.title} (${v.views} views)`).join("\n") || "(none found)"}
Find one distinctive angle that none of those titles takes. It must be supportable by news reporting, and must not copy their titles or structure.
Return JSON: {"angle":"one sentence","what_others_do":"one sentence"}`, "autopilot-angle");
    const selected = { ...winner, slug: slugify(winner.topic), angle: angle.angle, what_others_do: angle.what_others_do };
    writeJson(join(dir, "selected-topic.json"), selected);
    return selected;
  };
  return { eligible, withAngle };
}
