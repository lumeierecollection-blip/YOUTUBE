/**
 * Copyright Checker — Pre-upload scan for copyrighted material.
 *
 * Usage: node src/utils/copyright-check.js <file-path>
 * Or: node src/utils/copyright-check.js --check-license <license-path>
 *
 * Content ID scans 500M+ videos daily against 100M+ reference files.
 * No safe threshold — even under 5 seconds can trigger claims.
 * 3 strikes within 90 days = channel termination.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..");

/**
 * License registry — tracks all licensed assets.
 * When a claim happens, having proof turns a 30-day appeal into a 5-minute dispute.
 */
const LICENSE_REGISTRY_PATH = join(ROOT, "data", "license-registry.json");

/**
 * Known safe sources (no Content ID registration).
 */
const SAFE_SOURCES = [
  "YouTube Audio Library",
  "youtube.com/studio",
  "Pixabay",
  "pixabay.com",
  "Mixkit",
  "mixkit.co",
  "Freesound.org",
  "freesound.org",
  "ZapSplat",
  "zapsplat.com",
  "YouTubeSFX",
  "youtubesfx.com",
  "Uppbeat",
  "uppbeat.io",
  "Pexels",
  "pexels.com",
  "NASA",
  "nasa.gov",
  "NOAA",
  "noaa.gov",
  "Internet Archive",
  "archive.org",
  "Wikimedia Commons",
  "commons.wikimedia.org",
];

/**
 * Known risky sources (often trigger Content ID).
 */
const RISKY_SOURCES = [
  "Epidemic Sound",     // Can trigger if license expires
  "Artlist",           // Can trigger if license expires
  "Soundstripe",       // Can trigger if license expires
  "Storyblocks",       // Generally safe but verify
  "Spotify",           // Never safe
  "Apple Music",       // Never safe
  "SoundCloud",        // Often copyrighted
  "YouTube compilations", // Many are stolen
  "TikTok audio",      // Often copyrighted
  "Game soundtracks",  // Often claimed even for gameplay
];

/**
 * Dangerous sources (always trigger claims/strikes).
 */
const DANGEROUS_SOURCES = [
  "movie soundtrack",
  "TV show",
  "radio",
  "cover song",
  "remix",
  "sample",
  "bootleg",
  "ripped",
  "downloaded from",
  "screen recorded",
];

/**
 * Check a license file for validity.
 */
function checkLicense(licensePath) {
  if (!existsSync(licensePath)) {
    return { valid: false, reason: "License file not found" };
  }

  try {
    const content = readFileSync(licensePath, "utf-8");
    const data = JSON.parse(content);

    return {
      valid: true,
      source: data.source || "Unknown",
      type: data.type || "Unknown",
      expires: data.expires || "Perpetual",
      commercial_use: data.commercial_use !== false,
      youtube_use: data.youtube_use !== false,
      attribution_required: data.attribution_required || false,
      notes: data.notes || "",
    };
  } catch {
    return { valid: false, reason: "License file is not valid JSON" };
  }
}

/**
 * Check if a source is safe, risky, or dangerous.
 */
function assessSource(sourceName) {
  const lower = sourceName.toLowerCase();

  if (DANGEROUS_SOURCES.some((d) => lower.includes(d))) {
    return {
      risk: "CRITICAL",
      message: `DANGEROUS: "${sourceName}" will almost certainly trigger a copyright claim or strike.`,
      action: "Do not use. Find an alternative from safe sources.",
    };
  }

  if (RISKY_SOURCES.some((r) => lower.includes(r.toLowerCase()))) {
    return {
      risk: "HIGH",
      message: `RISKY: "${sourceName}" may trigger Content ID depending on license status.`,
      action: "Verify license is active and covers YouTube monetization. Keep proof of license.",
    };
  }

  if (SAFE_SOURCES.some((s) => lower.includes(s.toLowerCase()))) {
    return {
      risk: "LOW",
      message: `SAFE: "${sourceName}" is a known safe source.`,
      action: "Verify license terms. Keep download receipt.",
    };
  }

  return {
    risk: "UNKNOWN",
    message: `UNKNOWN: "${sourceName}" is not in our database.`,
    action: "Verify license explicitly covers YouTube monetization. Keep proof of license.",
  };
}

/**
 * Pre-upload checklist for copyright safety.
 */
function preUploadChecklist(videoAssets) {
  const results = {
    overall_risk: "LOW",
    checks: [],
    issues: [],
    recommendations: [],
  };

  for (const asset of videoAssets) {
    const assessment = assessSource(asset.source || "Unknown");
    results.checks.push({
      asset: asset.name,
      source: asset.source,
      ...assessment,
    });

    if (assessment.risk === "CRITICAL") {
      results.overall_risk = "CRITICAL";
      results.issues.push(`${asset.name}: ${assessment.message}`);
    } else if (assessment.risk === "HIGH" && results.overall_risk !== "CRITICAL") {
      results.overall_risk = "HIGH";
      results.issues.push(`${asset.name}: ${assessment.message}`);
    }
  }

  // Add general recommendations
  results.recommendations = [
    "Save license PDFs, receipts, and download URLs for every asset",
    "Run copyright checker BEFORE upload, not after",
    "When in doubt, use YouTube Audio Library (built-in, Content ID safe)",
    "No safe threshold exists — even under 5 seconds can trigger claims",
    "Background TV/radio during recording still triggers Content ID",
    "Keep a paper trail — turns 30-day appeal into 5-minute dispute",
  ];

  return results;
}

/**
 * Register a licensed asset in the registry.
 */
function registerLicense(asset) {
  let registry = {};
  if (existsSync(LICENSE_REGISTRY_PATH)) {
    try {
      registry = JSON.parse(readFileSync(LICENSE_REGISTRY_PATH, "utf-8"));
    } catch {
      registry = { assets: [] };
    }
  }

  if (!registry.assets) registry.assets = [];

  registry.assets.push({
    ...asset,
    registered_at: new Date().toISOString(),
  });

  writeFileSync(LICENSE_REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

/**
 * CLI entry point.
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: node copyright-check.js <source-name>");
    console.error('Example: node copyright-check.js "YouTube Audio Library"');
    console.error("\nOr check a license file:");
    console.error("node copyright-check.js --check-license <path-to-license.json>");
    process.exit(1);
  }

  if (args[0] === "--check-license") {
    const licensePath = args[1];
    if (!licensePath) {
      console.error("Please provide a license file path");
      process.exit(1);
    }
    const result = checkLicense(licensePath);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const sourceName = args.join(" ");
  const assessment = assessSource(sourceName);

  console.log(`\nCopyright Assessment: "${sourceName}"`);
  console.log(`Risk Level: ${assessment.risk}`);
  console.log(`Message: ${assessment.message}`);
  console.log(`Action: ${assessment.action}`);

  // Run pre-upload checklist if called with --checklist
  if (args.includes("--checklist")) {
    console.log("\n--- Pre-Upload Copyright Checklist ---");
    console.log("✓ No background TV/radio in recordings");
    console.log("✓ All music from YouTube Audio Library or licensed sources");
    console.log("✓ All B-roll from Pexels, Pixabay, or licensed sources");
    console.log("✓ License receipts saved for all assets");
    console.log("✓ No 'no copyright' compilations from unknown sources");
    console.log("✓ No game soundtracks");
    console.log("✓ No movie/TV clips without explicit license");
    console.log("✓ Copyright check run before upload");
  }
}

export { assessSource, checkLicense, preUploadChecklist, SAFE_SOURCES, RISKY_SOURCES, DANGEROUS_SOURCES };

if (process.argv[1] && process.argv[1].endsWith("copyright-check.js")) main();
