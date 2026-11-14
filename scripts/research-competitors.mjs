#!/usr/bin/env node
// Read-only competitor scan via YouTube Data API v3 (YOUTUBE_API_KEY). Prints PUBLIC stats only.
// Limits (stated plainly): the API cannot tell whether a video is faceless, cannot return frames or
// transcripts; those judgements are made afterwards from titles/channels and are labelled unverified.
const KEY = process.env.YOUTUBE_API_KEY;
if (!KEY) { console.log("NO YOUTUBE_API_KEY"); process.exit(0); }
const DAYS = Number(process.env.WINDOW_DAYS || 10);
const after = new Date(Date.now() - DAYS * 864e5).toISOString();
const Q = {
  "ch-01 Hidden Past": ["untold history documentary", "forgotten history cover-up"],
  "ch-02 AI Tested": ["AI tool review tested", "new AI tool vs comparison"],
  "ch-03 Court & Spotlight": ["celebrity lawsuit explained", "celebrity feud court ruling"],
  "ch-04 Rival Lines": ["football rivalry explained", "football tactics explained"],
};
const api = async (p, o) => { const r = await fetch(`https://www.googleapis.com/youtube/v3/${p}?${new URLSearchParams({ ...o, key: KEY })}`); const j = await r.json(); if (j.error) throw new Error(j.error.message); return j; };
const iso = (d) => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d) || []; return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0); };
console.log(`window: ${after} .. now (${DAYS}d)`);
for (const [ch, qs] of Object.entries(Q)) for (const kind of ["short", "long"]) {
  const ids = new Set();
  for (const q of qs) { try {
    const s = await api("search", { part: "id", type: "video", q, publishedAfter: after, order: "viewCount", maxResults: "25", relevanceLanguage: "en", videoDuration: kind === "short" ? "short" : "medium" });
    s.items.forEach((i) => ids.add(i.id.videoId)); } catch (e) { console.log("ERR search", e.message); } }
  if (!ids.size) { console.log(`## ${ch} ${kind}: none`); continue; }
  const v = await api("videos", { part: "snippet,statistics,contentDetails", id: [...ids].join(",") });
  const cids = [...new Set(v.items.map((i) => i.snippet.channelId))];
  const subs = {}; for (let k = 0; k < cids.length; k += 50) (await api("channels", { part: "statistics", id: cids.slice(k, k + 50).join(",") })).items.forEach((c) => subs[c.id] = c.statistics.hiddenSubscriberCount ? null : +c.statistics.subscriberCount);
  const rows = v.items.map((i) => ({ id: i.id, t: i.snippet.title, c: i.snippet.channelTitle, d: i.snippet.publishedAt.slice(0, 10), s: iso(i.contentDetails.duration), v: +i.statistics.viewCount || 0, l: +i.statistics.likeCount || 0, subs: subs[i.snippet.channelId] }))
    .filter((r) => kind === "short" ? r.s <= 180 : r.s >= 480).sort((a, b) => b.v - a.v).slice(0, 12);
  console.log(`## ${ch} ${kind} (top ${rows.length} by views, ${DAYS}d)`);
  for (const r of rows) console.log(`${r.v}v | ${r.subs ?? "?"}subs | x${r.subs ? (r.v / r.subs).toFixed(2) : "?"} | ${r.d} | ${r.s}s | ${r.c} | ${r.t.slice(0, 90)} | https://youtu.be/${r.id}`);
}
