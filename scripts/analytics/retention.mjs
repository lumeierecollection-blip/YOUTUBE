#!/usr/bin/env node
/**
 * Read-only audience-retention report: where in each video viewers stop watching.
 *
 *   node scripts/analytics/retention.mjs --slots 01,02,03,04 --out retention --max 15
 *
 * For every slot that has CHANNEL_NN_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN in the environment it lists the channel's most recent
 * uploads, and for each PUBLIC video asks the YouTube Analytics API for views, average view duration and percentage, and the retention
 * curve (audienceWatchRatio by elapsedVideoTimeRatio: 100 points from the start to the end of the video).
 * It writes retention.json and RETENTION.md. It never uploads, edits or changes a video, and never prints a token.
 *
 * What this report can and cannot say (kept honest on purpose):
 * - audienceWatchRatio is the share of the video's views still watching at that point. It can be above 1 where viewers replay (Shorts loop).
 * - The Shorts feed's "viewed vs swiped away" figure is NOT in this API; it is only in YouTube Studio. A weak hook shows here as a low
 *   ratio in the first seconds, but the swipe rate itself has to be read in Studio.
 * - YouTube returns no curve for a video with too few views. Such videos are listed as "no curve yet", never estimated.
 * - Private videos have no audience, so they are skipped.
 * - The segment names (hook, bridge, body, close) are fixed time bands for a 35 to 40 second Short, not read from each script.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const SLOTS = arg("slots", "01,02,03,04").split(",").map((s) => s.trim().padStart(2, "0"));
const OUT = arg("out", "retention"), MAX = Number(arg("max", "15"));
const API = "https://www.googleapis.com/youtube/v3", AN = "https://youtubeanalytics.googleapis.com/v2/reports";
const get = async (url, token) => { const r = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`HTTP ${r.status} ${j.error?.message || ""}`.trim()); return j; };

async function accessToken(slot) {
  const id = process.env[`CHANNEL_${slot}_CLIENT_ID`], secret = process.env[`CHANNEL_${slot}_CLIENT_SECRET`], refresh = process.env[`CHANNEL_${slot}_REFRESH_TOKEN`];
  if (!(id && secret && refresh)) return null;
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }), signal: AbortSignal.timeout(30000) });
  const j = await r.json();
  if (!j.access_token) throw new Error(`token refresh failed: ${j.error || `HTTP ${r.status}`}`);
  return j.access_token;
}
const seconds = (iso) => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || ""); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };

/** Fixed bands for a short video: the first 3 seconds are the hook, up to 30% the bridge into the story, up to 80% the body, then the close. */
export function bands(duration) { const h = Math.min(0.2, 3 / Math.max(duration, 1)); return [["hook", 0, h], ["bridge", h, 0.3], ["body", 0.3, 0.8], ["close", 0.8, 1]]; }

/** curve: [[ratio 0..1, audienceWatchRatio], ...] in order. Returns where viewers leave. */
export function diagnose(curve, duration) {
  if (!curve || curve.length < 10) return null;
  const at = (x) => curve.reduce((best, p) => (Math.abs(p[0] - x) < Math.abs(best[0] - x) ? p : best))[1];
  const start = curve[0][1];
  let worst = { drop: 0, from: 0 };
  for (let i = 1; i < curve.length; i++) { const drop = curve[i - 1][1] - curve[i][1]; if (drop > worst.drop) worst = { drop, from: curve[i - 1][0] }; }
  const segs = bands(duration).map(([name, a, b]) => ({ name, from_s: +(a * duration).toFixed(1), to_s: +(b * duration).toFixed(1), lost: +(at(a) - at(b)).toFixed(3), lost_per_second: +((at(a) - at(b)) / Math.max(0.5, (b - a) * duration)).toFixed(4) }));
  const weakest = [...segs].sort((x, y) => y.lost_per_second - x.lost_per_second)[0];
  return { start: +start.toFixed(3), at_3s: +at(Math.min(1, 3 / Math.max(duration, 1))).toFixed(3), at_25: +at(0.25).toFixed(3), at_50: +at(0.5).toFixed(3), at_75: +at(0.75).toFixed(3), at_end: +curve.at(-1)[1].toFixed(3), steepest_drop: { at_s: +(worst.from * duration).toFixed(1), lost: +worst.drop.toFixed(3) }, segments: segs, weakest_segment: weakest.name };
}

async function channelReport(slot) {
  const token = await accessToken(slot);
  if (!token) return { slot, status: "no credentials" };
  const ch = (await get(`${API}/channels?part=snippet,contentDetails,statistics&mine=true`, token)).items?.[0];
  if (!ch) return { slot, status: "no channel for this token" };
  const list = await get(`${API}/playlistItems?part=contentDetails&maxResults=${Math.min(50, MAX)}&playlistId=${ch.contentDetails.relatedPlaylists.uploads}`, token);
  const ids = (list.items || []).map((i) => i.contentDetails.videoId);
  const vids = ids.length ? (await get(`${API}/videos?part=snippet,status,statistics,contentDetails&id=${ids.join(",")}`, token)).items || [] : [];
  const today = new Date().toISOString().slice(0, 10), out = [];
  for (const v of vids) {
    const row = { id: v.id, title: v.snippet.title, published: v.snippet.publishedAt.slice(0, 10), privacy: v.status.privacyStatus, duration_s: seconds(v.contentDetails.duration), views: Number(v.statistics.viewCount || 0), likes: Number(v.statistics.likeCount || 0), comments: Number(v.statistics.commentCount || 0) };
    if (row.privacy !== "public") { row.note = "not public: no audience data"; out.push(row); continue; }
    const q = `ids=channel==MINE&startDate=${row.published}&endDate=${today}&filters=video==${v.id}`;
    try {
      const s = await get(`${AN}?${q}&metrics=views,averageViewDuration,averageViewPercentage,subscribersGained,likes,shares`, token);
      const r = s.rows?.[0];
      if (r) Object.assign(row, { analytics_views: r[0], average_view_duration_s: r[1], average_view_percentage: r[2], subscribers_gained: r[3], shares: r[5] });
      const c = await get(`${AN}?${q}&metrics=audienceWatchRatio&dimensions=elapsedVideoTimeRatio`, token);
      const curve = (c.rows || []).map(([x, y]) => [x, y]);
      row.curve = curve;
      row.diagnosis = diagnose(curve, row.duration_s);
      if (!row.diagnosis) row.note = "no curve yet: YouTube has too few views to report retention";
    } catch (e) { row.note = `analytics unavailable: ${String(e.message).slice(0, 160)}`; }
    out.push(row);
  }
  return { slot, status: "ok", channel: ch.snippet.title, subscribers: Number(ch.statistics.subscriberCount || 0), videos: out };
}

function markdown(reports) {
  const pct = (x) => `${Math.round(x * 100)}%`;
  const L = ["# Retention report", "", `Generated ${new Date().toISOString()}. Read-only. "Still watching" is YouTube's audienceWatchRatio: the share of views still playing at that point (above 100% means replays).`, "The Shorts swipe-away rate is not available from this API; read it in YouTube Studio.", ""];
  for (const r of reports) {
    L.push(`## Slot ${r.slot}: ${r.channel || r.status}`, "");
    if (r.status !== "ok") continue;
    const withCurve = r.videos.filter((v) => v.diagnosis);
    if (withCurve.length) {
      const tallies = {}; for (const v of withCurve) tallies[v.diagnosis.weakest_segment] = (tallies[v.diagnosis.weakest_segment] || 0) + 1;
      L.push(`Weakest part across ${withCurve.length} video(s) with a curve: ${Object.entries(tallies).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} (${n})`).join(", ")}.`, "");
    }
    for (const v of r.videos) {
      L.push(`### ${v.title}`, `https://youtu.be/${v.id} · ${v.published} · ${v.privacy} · ${v.duration_s}s · ${v.views} views`);
      if (v.average_view_percentage != null) L.push(`Average viewed: ${v.average_view_percentage.toFixed(1)}% (${v.average_view_duration_s}s). Subscribers gained: ${v.subscribers_gained}.`);
      if (v.diagnosis) { const d = v.diagnosis; L.push(`Still watching: start ${pct(d.start)}, at 3s ${pct(d.at_3s)}, 25% ${pct(d.at_25)}, 50% ${pct(d.at_50)}, 75% ${pct(d.at_75)}, end ${pct(d.at_end)}.`, `Steepest single drop: ${pct(d.steepest_drop.lost)} at ${d.steepest_drop.at_s}s.`, "", "| Part | Seconds | Viewers lost | Lost per second |", "|---|---|---|---|", ...d.segments.map((s) => `| ${s.name}${s.name === d.weakest_segment ? " (weakest)" : ""} | ${s.from_s}-${s.to_s} | ${pct(s.lost)} | ${(s.lost_per_second * 100).toFixed(1)}% |`)); }
      if (v.note) L.push(`Note: ${v.note}.`);
      L.push("");
    }
  }
  return L.join("\n");
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/analytics/retention.mjs")) {
  const reports = [];
  for (const slot of SLOTS) { try { reports.push(await channelReport(slot)); } catch (e) { reports.push({ slot, status: `error: ${String(e.message).slice(0, 200)}` }); } }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "retention.json"), JSON.stringify({ generated_at: new Date().toISOString(), reports }, null, 2));
  const md = markdown(reports);
  writeFileSync(join(OUT, "RETENTION.md"), md);
  console.log(md);
}
