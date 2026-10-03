/**
 * select.js — Asset lookup: given a specific asset ID, return the file path.
 *
 * The content layer (beat generator / visual director) decides WHAT asset is
 * needed. This module only provides the file path. It must never return a
 * design decision based on what the library has.
 *
 * NEW RULE (world.txt Part 1.3):
 *   "The content layer decides what to show. The library only provides the file."
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..");
const MANIFEST_PATH = join(ROOT, "data", "asset-library", "index.json");

/**
 * Load the asset manifest from disk.
 * Returns { version, assets } or empty manifest if not found.
 */
export function loadAssetManifest() {
  if (!existsSync(MANIFEST_PATH)) return { version: 1, assets: [] };
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
  } catch {
    return { version: 1, assets: [] };
  }
}

/**
 * Look up an asset by its ID. Returns the file path or null.
 * This is the PREFERRED way to use the library — the content layer
 * specifies the asset ID, and this function returns the file path.
 *
 * @param {string} assetId - The asset's unique ID
 * @param {Object} opts
 * @param {Object} [opts.manifest] - Pre-loaded manifest (optional)
 * @returns {{path: string, treatment: string, credit: string|null} | null}
 */
export function lookupAsset(assetId, { manifest = null } = {}) {
  const lib = manifest || loadAssetManifest();
  const asset = lib.assets.find((a) => a.id === assetId);
  if (!asset) return null;
  return {
    path: asset.publicPath,
    treatment: asset.treatment,
    credit: asset.attribution || null,
  };
}

/**
 * Look up multiple assets by their IDs. Returns an array of results.
 *
 * @param {string[]} assetIds - Array of asset IDs
 * @param {Object} opts
 * @param {Object} [opts.manifest] - Pre-loaded manifest (optional)
 * @returns {Array<{path: string, treatment: string, credit: string|null}>}
 */
export function lookupAssets(assetIds, { manifest = null } = {}) {
  const lib = manifest || loadAssetManifest();
  const out = [];
  const seen = new Set();
  for (const id of assetIds) {
    const asset = lib.assets.find((a) => a.id === id);
    if (asset && !seen.has(asset.publicPath)) {
      out.push({
        path: asset.publicPath,
        treatment: asset.treatment,
        credit: asset.attribution || null,
      });
      seen.add(asset.publicPath);
    }
  }
  return out;
}

/**
 * DEPRECATED — keyword-overlap matching.
 *
 * This function decides WHAT to show based on what the library has,
 * which is backwards. Use lookupAsset() instead: the content layer
 * specifies the asset ID, and the library returns the file path.
 *
 * Kept for backward compatibility during migration. Will be removed
 * once all callers use lookupAsset().
 */
export function selectAsset(channelId, cueText, { manifest = null } = {}) {
  const lib = manifest || loadAssetManifest();
  const pool = lib.assets.filter((a) => a.channelId === channelId);
  if (!pool.length) return null;

  const STOPWORDS = new Set(["a", "an", "the", "of", "and", "or", "for", "with", "on", "in", "to", "is", "are"]);
  const keywordsOf = (text) =>
    String(text || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

  const cueWords = new Set(keywordsOf(cueText));
  if (!cueWords.size) return null;

  let best = null;
  let bestScore = 0;
  for (const asset of pool) {
    const assetWords = keywordsOf(`${asset.query} ${asset.id}`);
    let score = 0;
    for (const w of assetWords) if (cueWords.has(w)) score++;
    if (score > bestScore) {
      bestScore = score;
      best = asset;
    }
  }
  return bestScore > 0 ? best : null;
}
