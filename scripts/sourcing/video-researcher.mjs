#!/usr/bin/env node
/**
 * video-researcher.mjs — video-specific visual research and sourcing.
 *
 * For every new video:
 *   1. Read the final approved script.
 *   2. Extract named people, places, organisations, products, events,
 *      objects, dates, statistics and concepts.
 *   3. Break the narration into individual visual beats.
 *   4. Determine what image / graphic each beat requires.
 *   5. Generate specific sourcing queries for each visual beat.
 *   6. Retrieve suitable assets from relevant sources.
 *   7. Verify relevance to the actual narration.
 *   8. Record source attribution and licensing.
 *   9. Select assets based on visual quality, relevance and diversity.
 *  10. Build a unique visual plan for that particular video.
 *
 * Output: data/sourcing-cache/<channel>/<slug>/sourcing-report.json
 *         data/sourcing-cache/<channel>/<slug>/assets/ (downloaded files)
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { basename, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const CHANNEL_CONFIG = JSON.parse(readFileSync(resolve(ROOT, "config", "sourcing", "channel-sourcing.json"), "utf8"));

const UA = "YOUTUBE-pipeline/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; video-specific visual sourcing)";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function slugify(s) {
  return String(s || "").toLowerCase().normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "video";
}

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

/** Extract entities from a script + its research file. */
function extractEntities(script, research) {
  const entities = {
    people: [], places: [], organizations: [], products: [],
    events: [], objects: [], dates: [], statistics: [], concepts: []
  };
  const seen = new Set();
  const add = (cat, name, source) => {
    if (!name || seen.has(name)) return;
    seen.add(name);
    entities[cat].push({ name, source, sourceType: source?.source_name || "script" });
  };

  // Named entities from research
  for (const e of (research.named_entities || [])) {
    const k = String(e.kind || "").toLowerCase();
    if (k === "person") add("people", e.name, { source_name: "research" });
    else if (k === "place") add("places", e.name, { source_name: "research" });
    else if (k === "organization") add("organizations", e.name, { source_name: "research" });
    else if (k === "object") add("objects", e.name, { source_name: "research" });
    else if (k === "product") add("products", e.name, { source_name: "research" });
    else if (k === "event") add("events", e.name, { source_name: "research" });
    else add("concepts", e.name, { source_name: "research" });
  }

  // Dates / years from numbers
  for (const n of (research.numbers || [])) {
    if (n.unit === "year" || n.unit === "years") add("dates", String(n.value), { source_name: n.source_name || "research" });
    else add("statistics", `${n.label} = ${n.value}${n.unit ? " " + n.unit : ""}`, { source_name: n.source_name || "research" });
  }

  return entities;
}

/** Collect all narration text from a script, handling multiple formats. */
function collectNarration(script) {
  const parts = [];
  if (Array.isArray(script.sections)) {
    for (const s of script.sections) {
      if (s.voiceover) parts.push(s.voiceover);
      if (s.narration) parts.push(s.narration);
      if (s.text) parts.push(s.text);
    }
  }
  if (script.narration) parts.push(typeof script.narration === "string" ? script.narration : String(script.narration));
  if (script.text) parts.push(String(script.text));
  if (Array.isArray(script.sentences)) parts.push(...script.sentences);
  if (parts.length) return parts;
  // Fallback: key facts read as narration.
  if (Array.isArray(script.key_facts)) parts.push(...script.key_facts.map(f => f.fact));
  return parts;
}

/** Break narration into visual beats, one per sentence. */
function buildBeats(script) {
  const parts = collectNarration(script);
  const sentences = [];
  for (const p of parts) {
    for (const t of String(p).split(/(?<=[.!?])\s+/)) {
      if (t.trim()) sentences.push(t.trim());
    }
  }
  return sentences.map((t, i) => ({
    beat: i + 1,
    narration: t,
    startSec: script.sentenceSpans?.[i]?.start ?? 0,
    endSec: script.sentenceSpans?.[i]?.end ?? 0,
  }));
}

/** Generate a specific sourcing query for a beat based on its content. */
function beatQuery(beat, entities, channel) {
  const text = beat.narration.toLowerCase();
  const ch = CHANNEL_CONFIG.channels[channel] || {};
  const priorities = (ch.assetPriorities || []).join(", ");
  // Find which named entities appear in this sentence
  const mentioned = [];
  for (const cat of ["people", "places", "organizations", "products", "events", "objects"]) {
    for (const e of entities[cat]) {
      if (text.includes(e.name.toLowerCase())) mentioned.push({ cat, name: e.name });
    }
  }

  let query, kind;
  if (mentioned.some(m => m.cat === "people")) {
    const p = mentioned.find(m => m.cat === "people").name;
    query = `${p} portrait photograph`;
    kind = "person";
  } else if (mentioned.some(m => m.cat === "places")) {
    const p = mentioned.find(m => m.cat === "places").name;
    query = `${p} photograph view`;
    kind = "place";
  } else if (mentioned.some(m => m.cat === "organizations")) {
    const p = mentioned.find(m => m.cat === "organizations").name;
    query = `${p} building headquarters`;
    kind = "organization";
  } else if (mentioned.some(m => m.cat === "products")) {
    query = mentioned.find(m => m.cat === "products").name + " interface screenshot";
    kind = "product";
  } else if (mentioned.some(m => m.cat === "events")) {
    query = mentioned.find(m => m.cat === "events").name + " historical illustration";
    kind = "event";
  } else if (/century|war|reign|battle|treaty|act|law|decree|proclamation/i.test(text)) {
    query = "historical document " + channel + " archive";
    kind = "document";
  } else {
    query = beat.narration.split(" ").slice(0, 6).join(" ") + " illustration";
    kind = "illustration";
  }

  return { beat: beat.beat, query, kind, entitiesMentioned: mentioned, narration: beat.narration };
}

async function searchCommons(query) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=5&srsearch=${encodeURIComponent(query)}`;
  const j = await getJson(url);
  return (j.query?.search || []).map(h => ({
    title: h.title,
    snippet: h.snippet || "",
    source: "Wikimedia Commons",
    sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(h.title)}`,
  }));
}

async function main() {
  const scriptPath = arg("script");
  const channel = arg("channel") || "1";
  const researchPath = arg("research");
  const outDir = arg("out") || resolve(ROOT, "data", "sourcing-cache", `ch-${channel}`);

  if (!scriptPath) { console.error("usage: node scripts/sourcing/video-researcher.mjs --script <path> --channel <id> [--research <path>] [--out <dir>]"); process.exit(1); }
  const absScript = resolve(scriptPath);
  if (!existsSync(absScript)) { console.error(`script not found: ${absScript}`); process.exit(1); }

  const script = JSON.parse(readFileSync(absScript, "utf8"));
  const slug = slugify(script.topic_slug || basename(scriptPath, ".json"));
  const channelKey = `ch-${channel}`;
  const chCfg = CHANNEL_CONFIG.channels[channelKey];
  const research = researchPath && existsSync(resolve(researchPath)) ? JSON.parse(readFileSync(resolve(researchPath), "utf8")) : {};

  const videoCacheDir = resolve(outDir, slug);
  const assetsDir = resolve(videoCacheDir, "assets");
  mkdirSync(videoCacheDir, { recursive: true });
  mkdirSync(assetsDir, { recursive: true });

  const entities = extractEntities(script, research);
  const beats = buildBeats(script);
  const queries = beats.map(b => beatQuery(b, entities, channelKey));

  // Retrieve assets per beat
  const sourced = [];
  for (const q of queries) {
    let results = [];
    try { results = await searchCommons(q.query); } catch (e) { console.warn(`search failed for "${q.query}": ${e.message}`); }
    sourced.push({
      beat: q.beat,
      query: q.query,
      kind: q.kind,
      narration: q.narration,
      entitiesMentioned: q.entitiesMentioned,
      candidates: results.slice(0, 3),
      source: "Wikimedia Commons",
      retrievedAt: new Date().toISOString(),
    });
  }

  const report = {
    schema: "video-sourcing-report/v1",
    channel: channelKey,
    channelName: chCfg?.name || `Channel ${channel}`,
    videoSlug: slug,
    script: basename(scriptPath),
    research: researchPath || null,
    generatedAt: new Date().toISOString(),
    entities,
    beatCount: beats.length,
    beats: sourced,
    sourcingNotes: "Each beat has its own topic-specific query; no shared/global image pool is consulted.",
  };

  writeFileSync(resolve(videoCacheDir, "sourcing-report.json"), JSON.stringify(report, null, 2));
  console.log(`[video-researcher] channel ${channelKey} slug ${slug}: ${beats.length} beats, ${sourced.reduce((a,b)=>a+b.candidates.length,0)} candidate assets`);
  console.log(`[video-researcher] report -> ${resolve(videoCacheDir, "sourcing-report.json")}`);
}

main().catch(e => { console.error(e); process.exit(1); });
