#!/usr/bin/env node
/**
 * fetch-library.js — PART 5. Builds the asset library OFFLINE, ahead of any
 * render. render.js / select.js never call this or touch the network — see
 * select.js's header and CHECK-REGISTER AST-13 ("no network at render
 * time"), which this extends to images the same way it already covered
 * fonts/icons.
 *
 * Usage:
 *   node fetch-library.js <channel-id> <query terms...> [--count N] [--mode bw|color]
 *
 * Searches every configured source (skipping ones with no API key set),
 * filters to PD/CC0/CC-BY/Pexels/Unsplash licenses only, downloads at >=2x
 * stage resolution, treats each (treat.js — rembg cutout or full-bleed),
 * and appends the result to data/asset-library/index.json. Treated files
 * are copied into public/asset-library/<channel-id>/ so the Remotion
 * composition can staticFile() them exactly like the existing b-roll set.
 *
 * NOT wired into daily-pipeline.yml's per-run hot path — this is a
 * separate, occasional build step (run manually or on its own schedule) so
 * the library grows without adding network calls or rembg's CPU cost to
 * every daily render.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import * as wikimedia from "./sources/wikimedia.js";
import * as met from "./sources/met.js";
import * as nasa from "./sources/nasa.js";
import * as loc from "./sources/loc.js";
import * as nara from "./sources/nara.js";
import * as smithsonian from "./sources/smithsonian.js";
import * as pexels from "./sources/pexels.js";
import * as unsplash from "./sources/unsplash.js";
import { isAllowedLicense, normalizeLicense } from "./licenses.js";
import { downloadFile } from "./http.js";
import { treatAsset } from "./treat.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..");

const MANIFEST_PATH = join(ROOT, "data", "asset-library", "index.json");
const RAW_DIR = join(ROOT, "data", "asset-library", "raw");
const PUBLIC_DIR = join(ROOT, "src", "skills", "remotion-render", "public", "asset-library");
const MIN_WIDTH = 2160; // PART 5 — 2x the 1080-wide shorts stage, minimum

const SOURCES = { wikimedia, met, nasa, loc, nara, smithsonian, pexels, unsplash };

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) return { version: 1, assets: [] };
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
  } catch {
    return { version: 1, assets: [] };
  }
}

function saveManifest(manifest) {
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true });
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
}

function loadChannel(channelId) {
  const data = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
  const channel = (data.channels || []).find((c) => c.channel_id === channelId || String(c.id) === channelId);
  if (!channel) throw new Error(`channel not found: ${channelId}`);
  return channel;
}

async function searchAll(query, count) {
  const settled = await Promise.allSettled(
    Object.entries(SOURCES).map(async ([name, mod]) => ({ name, results: await mod.search(query, { count }) }))
  );
  const candidates = [];
  for (const s of settled) {
    if (s.status === "fulfilled") {
      candidates.push(...s.value.results);
    } else {
      console.warn(`[asset-sourcing] source failed, continuing without it: ${s.reason && s.reason.message}`);
    }
  }
  return candidates;
}

async function resolveOriginal(candidate) {
  // NASA's search response only carries a preview thumbnail; the full-res
  // original needs a second request per item (see nasa.js).
  if (candidate.sourceApi === "nasa" && candidate._nasaId) {
    const orig = await nasa.fetchOriginal(candidate._nasaId);
    if (orig) return { ...candidate, downloadUrl: orig };
  }
  return candidate;
}

function slugify(text) {
  return String(text || "asset")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "asset";
}

async function main() {
  const argv = process.argv.slice(2);
  const channelId = argv[0];
  const flagIdx = argv.findIndex((a) => a.startsWith("--"));
  const queryTerms = argv.slice(1, flagIdx === -1 ? undefined : flagIdx);
  const query = queryTerms.join(" ");
  const countFlag = argv.indexOf("--count");
  const count = countFlag >= 0 ? parseInt(argv[countFlag + 1], 10) : 4;
  const modeFlag = argv.indexOf("--mode");

  if (!channelId || !query) {
    console.error("Usage: node fetch-library.js <channel-id> <query terms...> [--count N] [--mode bw|color]");
    process.exit(1);
  }

  const channel = loadChannel(channelId);
  // PART 6 — "Two treatment modes... Pick per channel." An explicit
  // channels.json field wins; otherwise default by bg_mode, matching the
  // pairing the rebuild spec itself suggests (editorial B&W / full-color
  // product-on-white).
  const mode = modeFlag >= 0 ? argv[modeFlag + 1] : channel.asset_treatment || (channel.bg_mode === "white" ? "color" : "bw");
  if (mode !== "bw" && mode !== "color") {
    console.error(`Invalid --mode "${mode}" — must be "bw" or "color"`);
    process.exit(1);
  }

  console.log(`Searching 8 sources for "${query}" (channel ${channel.channel_id}, mode=${mode})...`);
  const rawCandidates = await searchAll(query, count);
  const licensed = rawCandidates.filter((c) => isAllowedLicense(c.license));
  console.log(`${rawCandidates.length} candidates found, ${licensed.length} pass the license filter.`);

  const manifest = loadManifest();
  const seen = new Set(manifest.assets.map((a) => a.downloadUrl));
  let added = 0;

  for (const raw of licensed) {
    if (added >= count) break;
    if (seen.has(raw.downloadUrl)) continue;
    let candidate;
    try {
      candidate = await resolveOriginal(raw);
    } catch (e) {
      console.warn(`  skip (couldn't resolve original): ${raw.title || raw.downloadUrl} — ${e.message}`);
      continue;
    }

    const slug = `${slugify(query)}-${slugify(candidate.title || candidate.sourceApi)}-${added}`;
    const ext = extname(new URL(candidate.downloadUrl).pathname) || ".jpg";
    const rawPath = join(RAW_DIR, channel.channel_id, `${slug}${ext}`);

    try {
      await downloadFile(candidate.downloadUrl, rawPath);
    } catch (e) {
      console.warn(`  skip (download failed): ${candidate.title || candidate.downloadUrl} — ${e.message}`);
      continue;
    }

    const meta = await sharp(rawPath).metadata();
    if (!meta.width || meta.width < MIN_WIDTH) {
      console.warn(`  skip (under ${MIN_WIDTH}px min: got ${meta.width}px): ${candidate.title || rawPath}`);
      rmSync(rawPath, { force: true });
      continue;
    }

    let treated;
    try {
      const treatDir = join(RAW_DIR, channel.channel_id, "treated");
      treated = await treatAsset({ inputPath: rawPath, outputDir: treatDir, slug, mode });
    } catch (e) {
      console.warn(`  skip (treatment failed): ${candidate.title || rawPath} — ${e.message}`);
      continue;
    }

    const publicDir = join(PUBLIC_DIR, channel.channel_id);
    mkdirSync(publicDir, { recursive: true });
    const publicFilename = `${slug}${extname(treated.path)}`;
    copyFileSync(treated.path, join(publicDir, publicFilename));
    const publicRelPath = `asset-library/${channel.channel_id}/${publicFilename}`;

    manifest.assets.push({
      id: slug,
      channelId: channel.channel_id,
      query,
      sourceApi: candidate.sourceApi,
      sourceUrl: candidate.sourceUrl,
      downloadUrl: candidate.downloadUrl,
      license: normalizeLicense(candidate.license),
      attribution: candidate.attribution,
      publicPath: publicRelPath,
      treatment: treated.treatment,
      mode,
      width: treated.width || meta.width,
      height: treated.height || meta.height,
      fetchedAt: new Date().toISOString(),
    });
    seen.add(candidate.downloadUrl);
    added++;
    console.log(`  + ${slug} (${candidate.sourceApi}, ${candidate.license}, treatment=${treated.treatment})`);
  }

  saveManifest(manifest);
  console.log(`Added ${added} asset(s). Manifest now has ${manifest.assets.length} total. -> ${MANIFEST_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
