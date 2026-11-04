#!/usr/bin/env node
/**
 * cache-isolation.mjs — enforce cache keys and reuse policy.
 *
 * A cache must NEVER cause a new video to inherit the previous video's
 * visual identity. Keys combine:
 *   - Channel ID
 *   - Video ID / unique production ID (slug)
 *   - Topic identity
 *   - Asset subject / query
 *   - Source identity
 *   - Relevant asset metadata (license, dimensions)
 *
 * Separate categories:
 *   - brand        : logos, colours, typography — reusable within a channel
 *   - channel      : channel-specific reusable assets, not topic-bound
 *   - video        : assets sourced for a specific video's topic (default: NOT reusable across videos)
 *   - temp         : temporary production files — never reused
 *
 * Brand elements, logos and channel identity may be reused.
 * A photograph of a person, event, product or location must not
 * automatically be reused simply because it exists in the cache.
 * For repeated topics / follow-up episodes, reuse is appropriate where
 * the same subject is genuinely relevant; that decision is recorded.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const CACHE_ROOT = resolve(ROOT, "data", "sourcing-cache");

const CACHE_CATEGORIES = ["brand", "channel", "video", "temp"];

function slugify(s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "item"; }

function cacheDir(category, channel, videoSlug) {
  return resolve(CACHE_ROOT, category, `ch-${channel}`, videoSlug || "shared");
}

function manifestPath(category, channel, videoSlug) {
  return join(cacheDir(category, channel, videoSlug), "manifest.json");
}

/** Build a cache key that encodes channel + topic + subject + source + metadata. */
function buildKey({ channel, videoSlug, topic, subject, query, source, license, width, height }) {
  const parts = [
    "cache:v1",
    `channel:${channel}`,
    `video:${videoSlug || "shared"}`,
    `topic:${topic || ""}`,
    `subject:${subject || ""}`,
    `query:${query || ""}`,
    `source:${source || ""}`,
    `license:${license || ""}`,
    `size:${width || 0}x${height || 0}`,
  ].filter(Boolean);
  return createHash("sha256").update(parts.join("::")).digest("hex");
}

/** Record an asset in the video-specific cache. Returns the cache entry. */
function recordAsset({ category, channel, videoSlug, topic, asset }) {
  const dir = cacheDir(category, channel, videoSlug);
  mkdirSync(dir, { recursive: true });
  const mp = manifestPath(category, channel, videoSlug);
  const man = existsSync(mp) ? JSON.parse(readFileSync(mp, "utf8")) : { version: 1, category, channel, videoSlug, topic, assets: [], updatedAt: null };
  const entry = {
    key: asset.key || buildKey({ channel, videoSlug, topic, subject: asset.subject, query: asset.query, source: asset.source, license: asset.license, width: asset.width, height: asset.height }),
    ...asset,
    recordedAt: new Date().toISOString(),
  };
  // Replace any existing entry with the same key (idempotent), else append.
  const idx = man.assets.findIndex(a => a.key === entry.key);
  if (idx >= 0) man.assets[idx] = entry; else man.assets.push(entry);
  man.updatedAt = new Date().toISOString();
  writeFileSync(mp, JSON.stringify(man, null, 2));
  return entry;
}

/** Look up an asset in the cache by key. Returns null if absent. */
function lookupAsset({ category, channel, videoSlug, key }) {
  const mp = manifestPath(category, channel, videoSlug);
  if (!existsSync(mp)) return null;
  const man = JSON.parse(readFileSync(mp, "utf8"));
  return man.assets.find(a => a.key === key) || null;
}

/** List all cached assets for a channel in a category (for repetition reporting). */
function listChannelAssets({ category, channel }) {
  const base = resolve(CACHE_ROOT, category, `ch-${channel}`);
  if (!existsSync(base)) return [];
  const out = [];
  for (const vid of readdirSync(base)) {
    const mp = join(base, vid, "manifest.json");
    if (existsSync(mp)) {
      try {
        const man = JSON.parse(readFileSync(mp, "utf8"));
        for (const a of man.assets || []) out.push({ ...a, videoSlug: vid });
      } catch { /* ignore unreadable manifests */ }
    }
  }
  return out;
}

/**
 * Decide whether an asset may be reused for a new video.
 * Returns { allowed: boolean, reason: string }.
 * Default: video-category assets are NOT reusable across videos.
 * Brand/channel assets ARE reusable within a channel.
 * Justified reuse (same subject, documented reason) is allowed.
 */
function canReuse({ category, channel, videoSlug, subject, reason, isJustified = false }) {
  // Brand and channel assets are reusable within the channel.
  if (category === "brand" || category === "channel") {
    return { allowed: true, reason: `${category} asset reused within channel ${channel}` };
  }
  // Temp assets are never reused.
  if (category === "temp") {
    return { allowed: false, reason: "temp assets are never reused" };
  }
  // Video-category assets: only reusable when justified (same subject, documented reason).
  if (!isJustified) {
    return { allowed: false, reason: `video-category asset for "${subject}" not reused without documented justification` };
  }
  return { allowed: true, reason: `justified reuse: ${reason}` };
}

/**
 * Check repetition risk: how many recent videos on this channel already use
 * an asset with this subject/query. Used by QA to flag unjustified repetition.
 */
function repetitionCount({ category, channel, subject, query, excludeVideoSlug }) {
  const assets = listChannelAssets({ category, channel });
  let count = 0;
  const videos = new Set();
  for (const a of assets) {
    const match = a.subject === subject || (query && a.query === query);
    if (match && a.videoSlug !== excludeVideoSlug) {
      count++;
      videos.add(a.videoSlug);
    }
  }
  return { count, videos: [...videos] };
}

export { buildKey, recordAsset, lookupAsset, listChannelAssets, canReuse, repetitionCount, cacheDir, manifestPath, CACHE_CATEGORIES };

if (require.main === module) {
  const op = process.argv[2];
  if (op === "list") {
    const category = process.argv[3] || "video";
    const channel = process.argv[4] || "1";
    console.log(JSON.stringify(listChannelAssets({ category, channel }), null, 2));
  } else if (op === "rep") {
    console.log(JSON.stringify(repetitionCount({ category: process.argv[3] || "video", channel: process.argv[4] || "1", subject: process.argv[5] || "", query: process.argv[6] || "" }), null, 2));
  } else {
    console.error("usage: node cache-isolation.mjs list <category> <channel> | rep <category> <channel> <subject> [query]");
    process.exit(1);
  }
}
