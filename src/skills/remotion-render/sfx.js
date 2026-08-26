/**
 * SFX resolution — Node-side, runs in render.js before bundling (same
 * pattern as image-assets.js's resolveImageAssets for B-roll).
 *
 * CHECK-REGISTER.md AUD-01 — sfx_cue is extracted from the script
 * (render.js toContentSections) but was never read again: assigned to
 * `sfxCue` and dropped. This closes that gap using the ONLY real,
 * licensed SFX inventory that exists in this repo (src/audio/sfx-manifest.json,
 * 24 files: Kenney CC0 + Mixkit "free commercial use" — see that file for
 * per-file source/license). It does not fabricate channel-specific sounds:
 * channels.json's sfx_profile.primary_sfx wishlist (e.g. "cash-register-ding",
 * "coin-drop") names sounds that were never actually sourced — matching
 * against them would either silently pick an unrelated file or require
 * inventing a mapping with no real audio behind it. Real tag-overlap against
 * the vendored manifest is preferred over that;  a channel-style fallback
 * (never a fabricated per-cue guess) covers a cue with no tag match.
 */
import { readFileSync, existsSync, copyFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(__dirname, "..", "..", "audio", "sfx-manifest.json");
const SOURCE_ROOT = join(__dirname, "..", "..", "audio");
const PUBLIC_SFX_ROOT = join(__dirname, "public", "sfx");

// Where each manifest file actually lives on disk under src/audio/, since
// the manifest only records which CATEGORY (bucket the renderer plays it
// from) a file belongs to, not its real source folder.
const SOURCE_DIR_BY_SOURCE = {
  "Mixkit": null, // resolved per-category below (transitions/ambient split across categories)
  "Kenney Interface Sounds": "kenney_interface/Audio",
  "Kenney Impact Sounds": "kenney_impact/Audio",
};

let cachedManifest = null;
function loadManifest() {
  if (cachedManifest) return cachedManifest;
  if (!existsSync(MANIFEST_PATH)) return null;
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
  const lib = raw.sfx_library;
  const files = [];
  for (const [category, cat] of Object.entries(lib.categories || {})) {
    for (const f of cat.files || []) {
      files.push({ category, name: f.name, tags: f.tags || [], source: f.source });
    }
  }
  cachedManifest = { files, styleMapping: lib.style_mapping || {} };
  return cachedManifest;
}

const bareWord = (w) => String(w || "").replace(/[^a-z0-9]/gi, "").toLowerCase();

function tagOverlapScore(cueWords, tags) {
  let score = 0;
  for (const tag of tags) {
    const bareTag = bareWord(tag);
    if (bareTag && cueWords.has(bareTag)) score += 1;
  }
  return score;
}

// Stable, deterministic pick (no Math.random — a re-render of the same
// script must choose the same file) among a category's files, spread by a
// hash of the caller's own key so different sections don't all land on
// file #0.
function stableIndex(key, length) {
  let h = 0;
  for (const ch of String(key || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return length ? h % length : 0;
}

/**
 * Resolve a beat/section's free-text sfx_cue (e.g. "Low sub-bass drone
 * fading in. Distant drip echoes.") to a real vendored file, or fall back
 * to the channel style's recommended category when no cue text or no tag
 * overlap exists. `key` is any stable identifier (section id/text) used
 * only to vary the deterministic fallback pick — never randomness.
 * Returns { relativePath, publicPath } or null.
 */
export function resolveSfxCue(cueText, style, key) {
  const manifest = loadManifest();
  if (!manifest || manifest.files.length === 0) return null;

  const cueWords = new Set(
    String(cueText || "")
      .split(/\s+/)
      .map(bareWord)
      .filter(Boolean)
  );

  let best = null;
  let bestScore = 0;
  if (cueWords.size > 0) {
    for (const f of manifest.files) {
      const score = tagOverlapScore(cueWords, f.tags);
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }
  }

  if (!best) {
    const recommended = (manifest.styleMapping[style] && manifest.styleMapping[style].recommended_sounds) || ["ui"];
    const candidates = manifest.files.filter((f) => recommended.includes(f.category));
    if (candidates.length === 0) return null;
    best = candidates[stableIndex(key, candidates.length)];
  }

  const relativePath = `sfx/${best.category}/${best.name}`;
  return {
    relativePath,
    publicPath: join(PUBLIC_SFX_ROOT, best.category, best.name),
    matched: bestScore > 0,
    tags: best.tags,
  };
}

/**
 * Ensure the resolved file actually exists under public/sfx/ (copying it
 * from src/audio/ on first use) — the manifest and the renderer's public
 * assets can drift, so this is checked at render time rather than assumed
 * from a one-time manual copy.
 */
export function ensureSfxAvailable(resolved) {
  if (!resolved || existsSync(resolved.publicPath)) return resolved;
  const manifest = loadManifest();
  const file = manifest.files.find((f) => `sfx/${f.category}/${f.name}` === resolved.relativePath);
  if (!file) return null;
  const sourceDir = SOURCE_DIR_BY_SOURCE[file.source] || file.category;
  const sourcePath = join(SOURCE_ROOT, sourceDir, file.name);
  if (!existsSync(sourcePath)) {
    console.warn(`SFX: "${file.name}" listed in sfx-manifest.json but not found at ${sourcePath} — skipping.`);
    return null;
  }
  mkdirSync(dirname(resolved.publicPath), { recursive: true });
  copyFileSync(sourcePath, resolved.publicPath);
  return resolved;
}
