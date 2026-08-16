/**
 * select.js — PART 5's render-time half: "Selection at render time is a
 * plain file read — no live API calls in daily-pipeline.yml's hot path."
 *
 * Pure — no network, no child_process, no rembg. Reads the manifest
 * fetch-library.js built offline and picks the best keyword match for a
 * given channel. This is what render.js calls, mirroring how broll.js's
 * resolveBrollFiles already works for the hand-curated fixture manifests.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..");
const MANIFEST_PATH = join(ROOT, "data", "asset-library", "index.json");

const STOPWORDS = new Set(["a", "an", "the", "of", "and", "or", "for", "with", "on", "in", "to", "is", "are"]);

function keywordsOf(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

export function loadAssetManifest() {
  if (!existsSync(MANIFEST_PATH)) return { version: 1, assets: [] };
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
  } catch {
    return { version: 1, assets: [] };
  }
}

/**
 * Pick the manifest entry for `channelId` whose query/id best overlaps the
 * cue text's keywords. Returns null (never a wrong-topic guess) when there
 * is no entry for this channel or no keyword overlap at all — matching
 * broll.js's "an unmatched cue resolves to nothing" rule.
 */
export function selectAsset(channelId, cueText, { manifest = null } = {}) {
  const lib = manifest || loadAssetManifest();
  const pool = lib.assets.filter((a) => a.channelId === channelId);
  if (!pool.length) return null;

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
