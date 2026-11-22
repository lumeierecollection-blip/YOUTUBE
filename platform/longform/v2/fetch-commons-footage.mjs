#!/usr/bin/env node
/**
 * REAL match footage from Wikimedia Commons, short segments only (never whole videos). The episode exports COMMONS = { queries: [...], perFile, seg, max }.
 * Keeps only files whose licence is CC0, public domain or plain CC BY (attribution only: no share-alike, no non-commercial, no no-derivatives), whose title or description is
 * about the sport, and that run at least 10 s. For each kept file it cuts up to `perFile` segments of `seg` seconds at spread-out offsets (ffmpeg seeks over HTTP, so a
 * 1 GB file is never downloaded whole), scales to 1280x720, removes the audio and writes public/lf2/footage/cm-<n>.mp4, in the order found (the episode's queries are ordered
 * most relevant first, so low numbers are the best clips). Author, licence and page are recorded in footage-commons-<slug>.json; render-episode draws the credit on screen.
 * Usage: node platform/longform/v2/fetch-commons-footage.mjs <episode-slug>   (run on GitHub: it needs network and ffmpeg)
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../preview/lib.mjs";

const slug = process.argv[2];
const { COMMONS } = await import(`./episodes/${slug}.mjs`);
if (!COMMONS) { console.log("no COMMONS list in", slug); process.exit(0); }
const UA = "YouTubeAutomationPreview/1.0 (licensed footage search; contact via GitHub repo)";
const OUT = join(ROOT, "src/skills/remotion-render/public/lf2/footage"); mkdirSync(OUT, { recursive: true });
const LIC_OK = /^(CC0|Public domain|CC BY (2\.0|2\.5|3\.0|4\.0))$/i;
const TOPIC = COMMONS.topic || /football|soccer|penalty|goalkeeper|shoot-?out|world cup|euro 20|league/i, NOT = COMMONS.not || /beach|futsal|american|rugby|gridiron|nfl|college|flag football|amputee|blind|handball|aussie|australian rules|gaelic/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (params) => { for (let t = 0; t < 6; t++) { const r = await fetch("https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ ...params, format: "json" }), { headers: { "User-Agent": UA } }); if (r.status === 429) { await sleep(20000 * (t + 1)); continue; } if (!r.ok) throw new Error("commons " + r.status); return r.json(); } throw new Error("commons rate limit"); };

const titles = [];
for (const q of COMMONS.queries) {
  const j = await api({ action: "query", list: "search", srsearch: `${q} filetype:video`, srnamespace: "6", srlimit: "30" });
  for (const h of j.query.search) if (!titles.includes(h.title)) titles.push(h.title);
  await sleep(2500);
}
console.log(titles.length, "candidate files");
const cands = [];
for (let i = 0; i < titles.length; i += 20) {
  const j = await api({ action: "query", titles: titles.slice(i, i + 20).join("|"), prop: "imageinfo", iiprop: "extmetadata|size|mime|url|metadata", iiextmetadatafilter: "LicenseShortName|Artist|ImageDescription|ObjectName" });
  for (const p of Object.values(j.query.pages)) {
    const ii = p.imageinfo?.[0]; if (!ii) continue;
    const em = ii.extmetadata || {}, lic = em.LicenseShortName?.value || "", desc = (em.ImageDescription?.value || "").replace(/<[^>]+>/g, ""), artist = (em.Artist?.value || "").replace(/<[^>]+>/g, "").trim();
    const dur = Number((ii.metadata || []).find((m) => m.name === "duration")?.value || 0);
    if (!LIC_OK.test(lic) || !TOPIC.test(p.title + " " + desc) || NOT.test(p.title + " " + desc) || dur < 10 || !ii.url) continue;
    cands.push({ title: p.title, lic, artist, dur, url: ii.url, page: "https://commons.wikimedia.org/wiki/" + encodeURIComponent(p.title.replace(/ /g, "_")), size: ii.size });
  }
  await sleep(2500);
}
// shoot-out files first, then the rest in the order the queries found them
const rank = (c) => (/penalt|shoot/i.test(c.title) ? 0 : 1);
cands.sort((a, b) => rank(a) - rank(b));
console.log(cands.length, "usable files:\n" + cands.map((c) => `  ${c.lic} | ${c.artist.slice(0, 30)} | ${Math.round(c.dur)} s | ${c.title.slice(0, 80)}`).join("\n"));

const manifest = []; let n = 0; const MAXN = COMMONS.max || 36, SEG = COMMONS.seg || 7, PER = COMMONS.perFile || 3;
for (const c of cands) {
  if (n >= MAXN) break;
  const starts = Array.from({ length: Math.min(PER, Math.max(1, Math.floor(c.dur / (SEG + 2)))) }, (_, i, a) => Math.max(0, Math.min(c.dur - SEG - 1, Math.round(((i + 0.5) / a.length) * c.dur - SEG / 2))));
  for (const ss of starts) {
    if (n >= MAXN) break;
    const id = `cm-${n}`, dest = join(OUT, `${id}.mp4`);
    const x = spawnSync("ffmpeg", ["-y", "-v", "error", "-user_agent", UA, "-ss", String(ss), "-i", c.url, "-t", String(SEG), "-an", "-vf", "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=30", "-c:v", "libx264", "-crf", "25", "-preset", "veryfast", "-pix_fmt", "yuv420p", dest], { encoding: "utf8", timeout: 240000 });
    if (x.status !== 0 || !existsSync(dest)) { console.log("skip segment", id, c.title.slice(0, 50), String(x.stderr).slice(0, 120)); continue; }
    manifest.push({ id, file: `lf2/footage/${id}.mp4`, ss, seconds: SEG, source_file: c.title, page: c.page, author: c.artist, licence: c.lic, credit: `Footage: ${c.artist.slice(0, 48) || "unknown author"}, ${c.lic}, via Wikimedia Commons`, episode: slug });
    console.log(id, "<-", c.title.slice(0, 60), "@", ss, "s"); n++;
  }
}
writeFileSync(join(OUT, `footage-commons-${slug}.json`), JSON.stringify(manifest, null, 1));
console.log("wrote", manifest.length, "clips");
