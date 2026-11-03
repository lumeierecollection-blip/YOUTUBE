#!/usr/bin/env node
/**
 * Download Historical Images from Wikimedia Commons
 * 
 * This script automatically searches Wikimedia Commons for historical
 * images related to Margaret Clitherow, Guy Fawkes, and the Gunpowder Plot.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

// Subjects to search for historical images
const SEARCH_TERMS = [
  "Margaret Clitherow",
  "Guy Fawkes portrait",
  "Gunpowder Plot conspirators",
  "Elizabethan execution",
  "Catholic priest hiding",
  "16th century English family",
  "York Minster historical",
  "1605 Gunpowder Plot manuscript"
];

// Wikimedia Commons API endpoint
const API_ENDPOINT = "https://commons.wikimedia.org/w/api.php";

/**
 * Search Wikimedia Commons for images
 */
async function searchCommons(searchTerm, limit = 5) {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: `filetype:bitmap ${searchTerm}`,
    srnamespace: 6, // File namespace
    srlimit: limit,
    format: "json"
  });

  const url = `${API_ENDPOINT}?${params.toString()}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.query?.search || [];
  } catch (e) {
    console.error(`Search failed for "${searchTerm}":`, e.message);
    return [];
  }
}

/**
 * Get image details including license and attribution
 */
async function getImageInfo(imageTitle) {
  const params = new URLSearchParams({
    action: "query",
    prop: "imageinfo",
    titles: imageTitle,
    iiprop: "url|extmetadata",
    format: "json"
  });

  const url = `${API_ENDPOINT}?${params.toString()}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    const page = Object.values(data.query?.pages || {})[0];
    return page?.imageinfo?.[0] || null;
  } catch (e) {
    console.error(`Image info failed for "${imageTitle}":`, e.message);
    return null;
  }
}

/**
 * Download an image file
 */
async function downloadImage(fileUrl, outputPath) {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const buffer = await response.arrayBuffer();
    require('fs').writeFileSync(outputPath, Buffer.from(buffer));
    return true;
  } catch (e) {
    console.error(`Download failed for ${fileUrl}:`, e.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const outputDir = join(ROOT, "data", "editor", "assets", "1");
  mkdirSync(outputDir, { recursive: true });

  const manifest = {
    generated_at: new Date().toISOString(),
    channel_id: "1",
    images: [],
    source: "Wikimedia Commons",
    total_requested: 0,
    total_downloaded: 0
  };

  console.log("[image-download] Starting Wikimedia Commons image acquisition");
  console.log("[image-download] Output directory:", outputDir);

  for (const [index, term] of SEARCH_TERMS.entries()) {
    console.log(`[image-download] Searching for: ${term}`);
    
    const results = await searchCommons(term, 3);
    
    for (const result of results) {
      manifest.total_requested++;
      
      const title = result.title.replace(/^File:/, "");
      console.log(`[image-download] Found: ${title}`);
      
      const info = await getImageInfo(title);
      if (!info) continue;

      const metadata = info.extmetadata;
      const license = metadata?.license?.value || "Unknown";
      const artist = metadata?.artist?.value || "Unknown";
      const credit = metadata?.credit?.value || "";
      
      // Check if license is acceptable (Public Domain, CC0, CC BY, CC BY-SA)
      const acceptableLicense = 
        license.includes("Public Domain") ||
        license.includes("CC0") ||
        license.includes("CC BY") ||
        license.includes("PD-");
      
      if (!acceptableLicense) {
        console.log(`[image-download] Skipping "${title}" - license: ${license}`);
        continue;
      }

      const filename = `img-${String(index + 1).padStart(2, '0')}-${title.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 50)}.jpg`;
      const outputPath = join(outputDir, filename);

      console.log(`[image-download] Downloading: ${info.url?.value || info.thumbs?.small?.source}`);
      
      const success = await downloadImage(info.url?.value || info.thumbs?.small?.source, outputPath);
      
      if (success) {
        manifest.total_downloaded++;
        manifest.images.push({
          id: `img-${String(index + 1).padStart(2, '0')}`,
          filename,
          subject: term,
          title,
          source: "Wikimedia Commons",
          source_url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title)}`,
          download_url: info.url?.value || info.thumbs?.small?.source,
          creator: artist,
          license,
          attribution: credit || artist,
          verification_status: "downloaded",
          search_term: term
        });
        console.log(`[image-download] Downloaded: ${filename}`);
      }
    }
  }

  // Write manifest
  const manifestPath = join(outputDir, "asset-manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.log(`[image-download] Complete: ${manifest.total_downloaded}/${manifest.total_requested} images downloaded`);
  console.log(`[image-download] Manifest saved to: ${manifestPath}`);
  
  return manifest;
}

main().catch(e => {
  console.error("[image-download] Failed:", e.message);
  process.exit(1);
});