// For every catalogued channel: top 5 by views (within the newest 250 long videos), the 5 most recent, and the 30th newest (for upload
// cadence). Fetches upload date, channel name and subscriber count per video (yt-dlp, no download) and the thumbnail (i.ytimg.com).
// Output: cat/<cid>.json, thumbs/<cid>/<id>.jpg. Collected on the date written into each file.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const idx = readFileSync("cat/_index.psv", "utf8").trim().split("\n").map((l) => l.split("|"));
const only = process.argv[2];
for (const [niche, cid] of idx) {
  if (only && only !== niche) continue;
  const out = `cat/${cid}.json`; if (existsSync(out)) continue;
  const rows = readFileSync(`cat/${cid}.psv`, "utf8").trim().split("\n").map((l) => { const [i, id, v, d, , ...t] = l.split("|"); return { i: +i, id, views: +v || 0, dur: +d || 0, title: t.join("|") }; }).filter((r) => r.dur >= 240);
  const recent30 = rows.slice(0, 30).map((r) => r.views).sort((a, b) => a - b), base = recent30[recent30.length >> 1] || 1;
  const top = [...rows].sort((a, b) => b.views - a.views).slice(0, 5), rec = rows.slice(0, 5), probe = [...new Map([...top, ...rec, rows[Math.min(29, rows.length - 1)]].map((r) => [r.id, r])).values()];
  let channel = null, subs = null;
  mkdirSync(`thumbs/${cid}`, { recursive: true });
  for (const r of probe) {
    try {
      const o = execFileSync("python", ["-m", "yt_dlp", "--no-warnings", "-q", "--skip-download", "--print", "%(upload_date)s|%(channel)s|%(channel_follower_count)s|%(like_count)s|%(comment_count)s", `https://www.youtube.com/watch?v=${r.id}`], { encoding: "utf8", timeout: 90000 }).trim().split("|");
      r.date = o[0]; channel = o[1]; subs = +o[2] || subs; r.likes = +o[3] || null; r.comments = +o[4] || null;
    } catch { r.date = null; }
    try { execFileSync("curl", ["-s", "-f", "-o", `thumbs/${cid}/${r.id}.jpg`, `https://i.ytimg.com/vi/${r.id}/maxresdefault.jpg`]); } catch { try { execFileSync("curl", ["-s", "-o", `thumbs/${cid}/${r.id}.jpg`, `https://i.ytimg.com/vi/${r.id}/hqdefault.jpg`]); } catch {} }
  }
  const p30 = rows[Math.min(29, rows.length - 1)], d = (s) => s ? new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`) : null;
  const span = d(rec[0].date) && d(p30.date) ? (d(rec[0].date) - d(p30.date)) / 86400000 : null;
  const res = { niche, cid, channel, subs, collected: new Date().toISOString().slice(0, 10), long_videos_listed: rows.length, median_views_recent30: base, uploads_per_month: span ? +((Math.min(29, rows.length - 1) / span) * 30.4).toFixed(1) : null, median_duration_min: +(rows.slice(0, 30).map((r) => r.dur).sort((a, b) => a - b)[15] / 60 || 0).toFixed(1),
    top: top.map((r) => ({ ...r, x_median: +(r.views / base).toFixed(1) })), recent: rec.map((r) => ({ ...r, x_median: +(r.views / base).toFixed(2) })),
    outliers_recent60: rows.slice(0, 60).filter((r) => r.views >= base * 2.5).map((r) => ({ id: r.id, title: r.title, views: r.views, x_median: +(r.views / base).toFixed(1) })), titles: rows.map((r) => `${r.views}|${r.title}`) };
  writeFileSync(out, JSON.stringify(res, null, 1));
  console.log(niche, channel, subs, "median30", base, "uploads/mo", res.uploads_per_month, "outliers", res.outliers_recent60.length);
}
