/**
 * Image asset resolution for IMAGE_BEAT scenes.
 *
 * RULE (world.txt Part 1.3):
 *   "The content layer decides what to show. The library only provides the file."
 *
 * The content layer (visual director) decides which assets are needed.
 * This module only resolves them to file paths. It must never force
 * a library match when the content layer didn't request one.
 *
 * Sources, tried in order per cue:
 *   1. data/asset-library/index.json (asset-sourcing skill) via lookupAsset()
 *   2. The legacy hand-curated broll-manifest-<channelId>.json fixtures
 *
 * Both are plain file reads. No network, no rembg, nothing at render time.
 */
import { resolveBrollFiles } from "./broll.js";
import { loadAssetManifest, lookupAsset } from "../asset-sourcing/select.js";

/**
 * Resolve image assets for beats. The content layer specifies which assets
 * are needed; this module returns file paths.
 *
 * @param {Array} cues - Array of cue objects with {id?, text?, channelId?}
 * @param {string} channelId - Channel ID for scoping
 * @param {string} topicSlug - Topic slug for legacy broll
 * @returns {Array<{path: string, treatment: "cutout"|"fullbleed", mode: string|null, credit: string|null}>}
 */
export function resolveImageAssets(cues, channelId, topicSlug) {
  if (!cues || !Array.isArray(cues) || cues.length === 0) return [];

  const manifest = loadAssetManifest();
  const out = [];
  const seenPaths = new Set();

  for (const cue of cues) {
    // NEW: If the content layer specified an asset ID, look it up directly
    if (cue.id) {
      const asset = lookupAsset(cue.id, { manifest });
      if (asset && !seenPaths.has(asset.path)) {
        out.push({
          path: asset.path,
          treatment: asset.treatment,
          mode: null,
          credit: asset.credit,
        });
        seenPaths.add(asset.path);
      }
      continue;
    }

    // LEGACY: If the content layer only provided text, fall back to broll
    // (the old keyword-matching path is deprecated — see select.js)
  }

  // Legacy fixture manifests are untreated raw photos — always rendered
  // full-bleed (the composition's pre-existing behaviour), no attribution
  // metadata carried by that system.
  const legacy = resolveBrollFiles(cues, channelId, topicSlug);
  for (const path of legacy) {
    if (seenPaths.has(path)) continue;
    out.push({ path, treatment: "fullbleed", mode: null, credit: null });
    seenPaths.add(path);
  }

  return out;
}
