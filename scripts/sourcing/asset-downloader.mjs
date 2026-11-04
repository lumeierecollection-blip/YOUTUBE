#!/usr/bin/env node
/**
 * asset-downloader.mjs — download and license-verify assets for one video.
 *
 * For every downloaded asset retains:
 *   - original source URL, original title, creator/author, license,
 *     attribution requirements, retrieval date, file checksum,
 *     intended narration beat, relevance explanation.
 *
 * Cache keys combine channel + video/topic + subject/query + source,
 * so a new video never inherits another video's visual identity.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const UA = "YOUTUBE-pipeline/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; asset downloader)";

function arg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
function slugify(s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "asset"; }

async function getJson(url, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) { last = e; await new Promise(r => setTimeout(r, 800 * (i + 1))); }
  }
  throw last;
}

/** Relevance check: does this Commons result actually match the intended subject?
 * For named people, require the surname in the title. For other subjects,
 * require at least one key query term in title or description.
 * Prevents "Charlie Hills" matching "Charlie Russell" (a different person). */
function isRelevant({ kind, query, narration, info }) {
  const title = String(info.title || "").toLowerCase().replace(/^file:/, "").replace(/[_-]/g, " ");
  const desc = String(info.description || "").toLowerCase();
  const combined = title + " " + desc;
  const qTerms = String(query || "").toLowerCase().split(/\s+/).filter(w => w.length > 4);

  if (kind === "person") {
    // For named people, require the surname in the title (rejects Charlie Russell for Charlie Hills).
    const nameTokens = String(narration || "").split(/\s+/).filter(w => /[A-Z]/.test(w));
    const surname = nameTokens[nameTokens.length - 1] || "";
    if (surname && !title.includes(surname.toLowerCase())) return false;
    return qTerms.length === 0 || qTerms.some(t => combined.includes(t));
  }
  // Non-person: require at least TWO meaningful query terms in title or description.
  // This rejects tangentially-matched documents (e.g. an MBE thesis for "AI model faster").
  const matches = qTerms.filter(t => combined.includes(t));
  return matches.length >= Math.min(2, qTerms.length);
}

function normalizeLicense(raw) {
  const s = String(raw || "").trim();
  if (/^public domain$/i.test(s) || /^pd(?:-|$)/i.test(s)) return { ok: true, license: "Public domain" };
  if (/^cc0(?:\s|$)/i.test(s)) return { ok: true, license: "CC0" };
  if (/^cc by(?:-sa)?(?:\s+\d+(?:\.\d+)?)?$/i.test(s)) return { ok: true, license: s };
  if (/^no restrictions$/i.test(s)) return { ok: true, license: "No restrictions" };
  return { ok: false, license: s || "(none)" };
}

async function getCommonsInfo(title) {
  const t = title.startsWith("File:") ? title : `File:${title}`;
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600&titles=${encodeURIComponent(t)}`;
  const j = await getJson(url);
  const page = Object.values(j?.query?.pages || {})[0];
  if (!page || page.missing !== undefined || !page.imageinfo?.[0]) return { ok: false, why: "Commons file not found" };
  const ii = page.imageinfo[0];
  const md = ii.extmetadata || {};
  const strip = v => String(v?.value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const lic = normalizeLicense(strip(md.LicenseShortName));
  if (!lic.ok) return { ok: false, why: `licence not explicit PD/CC: ${lic.license}` };
  const restrictions = strip(md.Restrictions);
  if (/trademark|personality|non-free|fair use/i.test(restrictions)) return { ok: false, why: `restrictions: ${restrictions}` };
  return {
    ok: true, page, ii, md,
    license: lic.license, licenseUrl: strip(md.LicenseUrl),
    creator: strip(md.Artist) || strip(md.Credit) || "Unknown author",
    credit: strip(md.Credit),
    description: strip(md.ImageDescription),
    thumburl: ii.thumburl, url: ii.url,
    width: ii.width, height: ii.height, mime: ii.mime,
  };
}

async function download(url, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, accept: "image/*" }, redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get("content-type") || "";
      if (!/^image\//i.test(type)) throw new Error(`unexpected content-type ${type}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) { last = e; await new Promise(r => setTimeout(r, 900 * (i + 1))); }
  }
  throw last;
}

function imageSize(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return { mime: "image/png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { mime: "image/jpeg", height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  throw new Error("not a JPEG or PNG");
}

function cacheKey(channel, videoSlug, subject, query, source) {
  const parts = [channel, videoSlug, subject, query, source].filter(Boolean);
  return createHash("sha256").update(parts.join("::")).digest("hex").slice(0, 16);
}

async function main() {
  const reportPath = arg("report");
  const channel = arg("channel") || "1";
  const videoSlug = arg("slug") || "video";
  const outDir = arg("out") || resolve(ROOT, "data", "sourcing-cache", `ch-${channel}`, videoSlug, "licensed-assets");
  const channelKey = `ch-${channel}`;

  if (!reportPath) { console.error("usage: node scripts/sourcing/asset-downloader.mjs --report <path> --channel <id> --slug <slug> [--out <dir>]"); process.exit(1); }
  const absReport = resolve(reportPath);
  if (!existsSync(absReport)) { console.error(`report not found: ${absReport}`); process.exit(1); }

  const report = JSON.parse(readFileSync(absReport, "utf8"));
  mkdirSync(outDir, { recursive: true });

  const downloaded = [];
  const errors = [];
  const seenHashes = new Set();
  const seenTitles = new Set();

  for (const beat of report.beats || []) {
    for (const cand of beat.candidates || []) {
      if (seenTitles.has(cand.title)) continue;
      try {
        const info = await getCommonsInfo(cand.title);
        if (!info.ok) { errors.push({ beat: beat.beat, title: cand.title, why: info.why }); continue; }
      if (!isRelevant({ kind: beat.kind, query: beat.query, narration: beat.narration, info })) {
        errors.push({ beat: beat.beat, title: cand.title, why: "not relevant to intended subject (rejected)" });
        continue;
      }
        const buf = await download(info.thumburl || info.url);
        const size = imageSize(buf);
        if (size.width < 240 || size.height < 240) { errors.push({ beat: beat.beat, title: cand.title, why: `too small ${size.width}x${size.height}` }); continue; }
        const hash = createHash("sha256").update(buf).digest("hex");
        if (seenHashes.has(hash)) { errors.push({ beat: beat.beat, title: cand.title, why: "duplicate content (sha256)" }); continue; }
        seenHashes.add(hash);
        seenTitles.add(cand.title);

        const ext = size.mime === "image/png" ? ".png" : ".jpg";
        const file = `${slugify(beat.query)}-${hash.slice(0,8)}${ext}`;
        const filePath = join(outDir, file);
        writeFileSync(filePath, buf);

        downloaded.push({
          id: `asset-${downloaded.length + 1}`,
          beat: beat.beat,
          query: beat.query,
          kind: beat.kind,
          narration: beat.narration,
          file, filePath: resolve(outDir, file),
          filename: file,
          source: "Wikimedia Commons",
          sourceUrl: cand.sourceUrl,
          pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(cand.title.replace(/ /g, "_"))}`,
          originalTitle: cand.title,
          creator: info.creator,
          license: info.license,
          licenseUrl: info.licenseUrl,
          attribution: `${info.creator} / Wikimedia Commons, ${info.license}`,
          credit: info.credit,
          description: info.description,
          downloadUrl: info.thumburl || info.url,
          mime: size.mime, width: size.width, height: size.height, bytes: buf.length,
          sha256: hash,
          relevance: `Beat ${beat.beat} (“${beat.narration}”): ${cand.snippet}`,
          retrievedAt: new Date().toISOString(),
          cacheKey: cacheKey(channelKey, videoSlug, beat.kind, beat.query, "Wikimedia Commons"),
          rightsStatus: "clear",
        });
        break; // one asset per beat
      } catch (e) {
        errors.push({ beat: beat.beat, title: cand.title, why: e.message });
      }
    }
  }

  const manifest = {
    schema: "licensed-assets-manifest/v1",
    channel: channelKey,
    videoSlug,
    generatedAt: new Date().toISOString(),
    sourceReport: absReport,
    totalRequested: (report.beats || []).length,
    totalDownloaded: downloaded.length,
    errors,
    assets: downloaded,
  };
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  const attrs = [
    "# Asset attributions",
    "",
    `Channel: ${channelKey}  Video: ${videoSlug}  Generated: ${new Date().toISOString()}`,
    "",
    ...downloaded.map((a, n) => [
      `${n + 1}. Beat ${a.beat} — ${a.kind}`,
      `   - File: \`${a.filename}\` (${a.width}x${a.height})`,
      `   - Attribution: ${a.attribution}`,
      `   - Licence: ${a.license}${a.licenseUrl ? ` — ${a.licenseUrl}` : ""}`,
      `   - Source: ${a.sourceUrl}`,
      `   - SHA-256: ${a.sha256}`,
      `   - Relevance: ${a.relevance}`,
      `   - Retrieved: ${a.retrievedAt}`,
      "",
    ].join("\n")),
  ];
  writeFileSync(join(outDir, "ATTRIBUTIONS.md"), attrs.join("\n"));

  console.log(`[asset-downloader] ${downloaded.length} assets downloaded, ${errors.length} errors -> ${outDir}`);
  console.log(`[asset-downloader] manifest -> ${join(outDir, "manifest.json")}`);
}

main().catch(e => { console.error(e); process.exit(1); });
