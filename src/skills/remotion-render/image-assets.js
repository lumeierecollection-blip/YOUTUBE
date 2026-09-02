/**
 * Image asset resolution for IMAGE_BEAT scenes — PART 5/6 of the
 * motion-graphics rebuild layered on top of the existing broll.js system.
 *
 * Two sources, tried in order per cue:
 *   1. data/asset-library/index.json (asset-sourcing skill — rembg-treated
 *      cutouts/full-bleeds with real license + attribution) via select.js.
 *   2. The legacy hand-curated b-roll-manifest-<channelId>.json fixtures
 *      (broll.js) — untreated raw photos, rendered full-bleed as before.
 *
 * Both are plain file reads. No network, no rembg, nothing at render time
 * — see select.js's header for why that boundary matters.
 */
import { resolveBrollFiles } from "./broll.js";
import { selectAsset, loadAssetManifest } from "../asset-sourcing/select.js";

/**
 * @returns {Array<{path: string, treatment: "cutout"|"fullbleed", mode: string|null, credit: string|null}>}
 */
export function resolveImageAssets(cues, channelId, topicSlug) {
  if (!cues || !Array.isArray(cues) || cues.length === 0) return [];

  const manifest = loadAssetManifest();
  const out = [];
  const seenPaths = new Set();

  for (const cue of cues) {
    const asset = selectAsset(channelId, cue, { manifest });
    if (asset && !seenPaths.has(asset.publicPath)) {
      out.push({
        path: asset.publicPath,
        treatment: asset.treatment,
        mode: asset.mode || null,
        credit: asset.attribution || null,
      });
      seenPaths.add(asset.publicPath);
    }
  }

  // Broaden-and-retry: none of this section's own cues matched anything in
  // the asset-library manifest. Before giving up on the manifest entirely,
  // retry once against the video's overall topic (topicSlug, already a
  // parameter here) — a broader term than any single cue phrase, on the
  // theory that a topic-relevant photo beats no photo. Still routed through
  // select.js's own keyword-overlap match (never a blind first-asset
  // guess), and still per-channel scoped.
  if (out.length === 0 && topicSlug) {
    const broadCue = String(topicSlug).replace(/[-_]+/g, " ").trim();
    if (broadCue) {
      const asset = selectAsset(channelId, broadCue, { manifest });
      if (asset && !seenPaths.has(asset.publicPath)) {
        out.push({
          path: asset.publicPath,
          treatment: asset.treatment,
          mode: asset.mode || null,
          credit: asset.attribution || null,
        });
        seenPaths.add(asset.publicPath);
      }
    }
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
