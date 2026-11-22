#!/usr/bin/env node
/** Rights-aware Wikimedia Commons discovery for Rival Lines (ch-51) only. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://commons.wikimedia.org/w/api.php";
const UA = "RivalLinesEditorial/1.0 (football documentary asset research; contact via repository owner)";
const s = (x) => String(x ?? "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

export function licenseFromMetadata(meta = {}) {
  const name = s(meta.LicenseShortName?.value || meta.License?.value || "");
  const url = s(meta.LicenseUrl?.value || "");
  const low = `${name} ${url}`.toLowerCase();
  if (/public domain|cc0|creative commons zero/.test(low)) return { name: name || "Public domain / CC0", url, basis: /cc0/.test(low) ? "creative-commons" : "public-domain" };
  if (/creativecommons\.org\/licenses\/by-sa|cc by-sa|attribution-sharealike/.test(low)) return { name: name || "CC BY-SA", url, basis: "creative-commons" };
  if (/creativecommons\.org\/licenses\/by\/|cc by|attribution 4\.0|attribution 3\.0/.test(low)) return { name: name || "CC BY", url, basis: "creative-commons" };
  return { name: name || null, url, basis: null };
}

export function normalizeCandidate(page) {
  const ii = page?.imageinfo?.[0];
  if (!ii) return null;
  const meta = ii.extmetadata || {};
  const lic = licenseFromMetadata(meta);
  const mime = String(ii.mime || "").toLowerCase();
  const kind = mime.startsWith("video/") ? "match-footage" : mime.startsWith("image/") ? "player-photo" : null;
  if (!kind) return null;
  return {
    id: `commons:${String(page.title || "").replace(/^File:/, "")}`,
    source: "Wikimedia Commons",
    title: String(page.title || "").replace(/^File:/, ""),
    kind,
    mime,
    source_url: ii.descriptionurl || ii.thumburl || ii.url || null,
    download_url: ii.thumburl || ii.url || null,
    width: Number(ii.thumbwidth || ii.width) || null,
    height: Number(ii.thumbheight || ii.height) || null,
    description: s(meta.ImageDescription?.value || ""),
    artist: s(meta.Artist?.value || "") || null,
    credit: s(meta.Credit?.value || "") || null,
    license: lic.name,
    license_url: lic.url || null,
    rights: { basis: lic.basis, evidence_url: lic.url || ii.descriptionurl || null, permitted_use: null, status: "unverified" },
    verification: { status: "unverified", evidence: "Not yet matched visually against the named player, match, or event.", verified_by: "", verified_at: null },
  };
}

export async function searchCommons({ query, mediaKind = "any", count = 30, fetchImpl = fetch }) {
  if (!String(query || "").trim()) throw new Error("A specific player / club / match query is required.");
  const q = new URLSearchParams({ action: "query", format: "json", origin: "*", list: "search", srnamespace: "6", srlimit: String(Math.min(50, Math.max(1, count))), srsearch: query });
  const res = await fetchImpl(`${API}?${q}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Wikimedia Commons search returned HTTP ${res.status}`);
  const j = await res.json();
  const titles = (j?.query?.search || []).map((x) => x.title).filter(Boolean);
  if (!titles.length) return [];
  const info = new URLSearchParams({ action: "query", format: "json", prop: "imageinfo", iiprop: "url|mime|size|extmetadata", iiurlwidth: "1600", titles: titles.join("|") });
  const ir = await fetchImpl(`${API}?${info}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) });
  if (!ir.ok) throw new Error(`Wikimedia Commons metadata returned HTTP ${ir.status}`);
  const ij = await ir.json();
  return Object.values(ij?.query?.pages || {}).map(normalizeCandidate).filter(Boolean)
    .filter((x) => mediaKind === "any" || (mediaKind === "video" ? x.kind === "match-footage" : x.kind === "player-photo"));
}

function cliValue(k) { const i = process.argv.indexOf(`--${k}`); return i < 0 ? null : process.argv[i + 1] || null; }
async function main() {
  const query = cliValue("query"), mediaKind = cliValue("kind") || "any";
  const out = cliValue("out") || join(ROOT, "data", "rival-lines", "discovery", "commons-candidates.json");
  if (!query) throw new Error('Usage: node scripts/rival-lines-assets.mjs --query "Player club match moment" [--kind video|photo|any] [--out file.json]');
  const candidates = await searchCommons({ query, mediaKind });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ channel_id: "ch-51", query, searched_at: new Date().toISOString(), candidates }, null, 2) + "\n");
  console.log(`[rival-lines-assets] ${candidates.length} Commons candidate(s) written to ${out}; all candidates remain unverified until identity, match relevance, and rights are evidenced.`);
  if (!candidates.length) process.exitCode = 2;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { console.error(`[rival-lines-assets] ${e.message}`); process.exit(1); });
