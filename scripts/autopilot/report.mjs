/** Telegram notices, performance collection and the owner dashboard. */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG, STATE_DIR, fetchWithTimeout, log, readJson, writeJson } from "./lib.mjs";
import { accessToken, ytGet } from "./deliver.mjs";
import { formatSast, nextSlots } from "./schedule.mjs";

const ATTENTION_TELEGRAM = "Telegram is not configured: add the TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID repository secrets.";

export function addAttention(ledger, text) {
  if (!ledger.attention.includes(text)) ledger.attention.push(text);
}

/** Sends one concise message, or records once that Telegram is not set up. Never throws. */
export async function notify(ledger, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) { addAttention(ledger, ATTENTION_TELEGRAM); log("notify", `(not sent) ${text}`); return false; }
  ledger.attention = ledger.attention.filter((a) => a !== ATTENTION_TELEGRAM);
  try {
    const r = await fetchWithTimeout(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }) });
    if (!r.ok) { log("notify", `Telegram HTTP ${r.status}`); return false; }
    return true;
  } catch (e) { log("notify", `Telegram error: ${e.name}`); return false; }
}

const perfPath = () => join(STATE_DIR, "autopilot", "performance.json");

/** Collects what the API really returns. A metric that cannot be read stays absent, never estimated. */
export async function collectPerformance(ledger) {
  const perf = readJson(perfPath(), { videos: {}, analytics_status: {} });
  for (const channelId of Object.keys(CONFIG.channels)) {
    const uploads = ledger.uploads.filter((u) => u.channel === channelId);
    if (!uploads.length) continue;
    let token;
    try { token = await accessToken(channelId); } catch (e) { perf.analytics_status[channelId] = { available: false, reason: e.message }; continue; }
    for (let i = 0; i < uploads.length; i += 50) {
      const batch = uploads.slice(i, i + 50);
      try {
        const j = await ytGet(`videos?part=statistics,status,contentDetails&id=${batch.map((u) => u.video_id).join(",")}`, token);
        for (const v of j.items || []) perf.videos[v.id] = { ...(perf.videos[v.id] || {}), channel: channelId, privacy: v.status.privacyStatus, views: Number(v.statistics.viewCount || 0), likes: Number(v.statistics.likeCount || 0), comments: Number(v.statistics.commentCount || 0), collected_at: new Date().toISOString() };
      } catch (e) { log("analytics", e.message); }
    }
    const today = new Date().toISOString().slice(0, 10), start = uploads.map((u) => u.uploaded_at.slice(0, 10)).sort()[0];
    try {
      const r = await fetchWithTimeout(`https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${start}&endDate=${today}&metrics=views,averageViewDuration,averageViewPercentage,subscribersGained&dimensions=video&sort=-views&maxResults=200`, { headers: { authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (!r.ok) throw new Error(`${r.status} ${j.error?.message || ""}`);
      for (const [id, views, avd, avp, subs] of j.rows || []) if (perf.videos[id]) Object.assign(perf.videos[id], { average_view_duration_s: avd, average_view_percentage: avp, subscribers_gained: subs, analytics_views: views });
      perf.analytics_status[channelId] = { available: true, checked_at: new Date().toISOString() };
    } catch (e) {
      perf.analytics_status[channelId] = { available: false, reason: String(e.message).slice(0, 200), checked_at: new Date().toISOString() };
      addAttention(ledger, `YouTube Analytics is unavailable for channel ${channelId}: re-authorising with the yt-analytics.readonly scope would enable retention data.`);
    }
  }
  writeJson(perfPath(), perf);
  return perf;
}

/** Evidence for the topic chooser. A pillar needs 3 public videos before anything is claimed about it. */
export function learnedSummary(ledger, channelId) {
  const perf = readJson(perfPath(), { videos: {} });
  const byPillar = {};
  for (const u of ledger.uploads.filter((x) => x.channel === channelId)) {
    const p = perf.videos[u.video_id];
    if (!p || p.privacy !== "public" || !u.pillar) continue;
    (byPillar[u.pillar] ||= []).push(p.views);
  }
  const lines = Object.entries(byPillar).filter(([, v]) => v.length >= 3).map(([k, v]) => [k, [...v].sort((a, b) => a - b)[v.length >> 1], v.length]).sort((a, b) => b[1] - a[1]).map(([k, m, n]) => `${k}: median ${m} views over ${n} videos`);
  return lines.join("; ");
}

export function writeDashboard(ledger, perf, nowMs = Date.now()) {
  const next = nextSlots(nowMs, 4);
  const lastFor = (id) => ledger.uploads.filter((u) => u.channel === id).at(-1);
  const channelBlock = (id, c) => {
    const u = lastFor(id);
    const slots = Object.entries(ledger.slots).filter(([, s]) => s.channel === id).sort((a, b) => (b[1].updated_at || "").localeCompare(a[1].updated_at || ""));
    const latest = slots[0]?.[1];
    const p = u ? perf.videos?.[u.video_id] : null;
    const a = perf.analytics_status?.[id];
    return `## ${c.name}
| | |
|---|---|
| Last successful video | ${u ? `[${u.title}](${u.url}) (${u.uploaded_at.slice(0, 16)} UTC)` : "none yet"} |
| Latest production | ${latest ? `${latest.status}${latest.stage ? ` at ${latest.stage}` : ""}, attempts ${latest.attempts}` : "none yet"} |
| Selected topic and score | ${latest?.topic ? `${latest.topic} (${latest.score}/100)` : "n/a"} |
| QA | ${latest?.qa || "n/a"} |
| Upload | ${u ? `${u.video_id}, privacy verified: ${u.privacy_status}` : "n/a"} |
| Performance | ${p ? `${p.views} views, ${p.likes} likes, ${p.comments} comments (${p.privacy})${p.average_view_percentage != null ? `, ${p.average_view_percentage}% average viewed` : ""}` : "n/a"} |
| Analytics | ${a ? (a.available ? "available" : `unavailable: ${a.reason}`) : "not checked"} |
`;
  };
  const md = `# YouTube Autopilot

Updated ${formatSast(nowMs)}

**Next productions:** ${next.map((s) => `${CONFIG.channels[s.channel].name} ${formatSast(s.at)}`).join(", ") || "none in the next 8 days"}

${Object.entries(CONFIG.channels).map(([id, c]) => channelBlock(id, c)).join("\n")}
## Needs your attention
${ledger.attention.length ? ledger.attention.map((a) => `- ${a}`).join("\n") : "Nothing."}
`;
  writeFileSync(join(STATE_DIR, "autopilot", "DASHBOARD.md"), md);
  return md;
}
