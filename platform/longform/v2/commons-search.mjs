#!/usr/bin/env node
/** Finds candidate Wikimedia Commons photographs for a query and shows licence, author, size and description (licence filter = platform/production/commons.mjs ALLOWED).
 * It only LISTS candidates. Nothing is downloaded until a person (or the episode author) picks one and calls commonsAsset().
 * Usage: node platform/longform/v2/commons-search.mjs "query" [limit] */
import { commonsMeta } from "../../production/commons.mjs";
const q = process.argv[2], limit = Number(process.argv[3] || 10);
const u = new URL("https://commons.wikimedia.org/w/api.php");
for (const [k, v] of Object.entries({ action: "query", list: "search", srsearch: `${q} filetype:bitmap`, srnamespace: "6", srlimit: String(limit), format: "json" })) u.searchParams.set(k, v);
const r = await fetch(u, { headers: { "User-Agent": "YouTubeAutomationPreview/1.0 (candidate search; licences read from the API)" } });
const j = await r.json();
for (const hit of j.query.search) {
  try { const m = await commonsMeta(hit.title); console.log(`${hit.title}\n   ${m.licence} | ${m.author} | ${m.width}x${m.height} | ${(m.description || "").slice(0, 140)}`); }
  catch (e) { console.log(`${hit.title}\n   REFUSED: ${String(e.message).slice(0, 110)}`); }
}
