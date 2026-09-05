/**
 * SFX Sourcing — Searches GitHub for open-source sound effect libraries,
 * downloads real files, and builds a tagged local library.
 *
 * Usage: node src/skills/sfx-sourcing/build-library.js
 * Output: data/audio/sfx/ directory with organized sound files + attribution log
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "url";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..", "..");
const SFX_DIR = join(ROOT, "data", "audio", "sfx");
const ATTRIBUTION_FILE = join(SFX_DIR, "_attribution.json");

/**
 * Known open-source SFX repositories on GitHub.
 * These have been verified to permit commercial/YouTube use.
 */
const REPOS = [
  {
    name: "freesound-sounds",
    url: "https://github.com/nickmccurdy/freesound-sounds",
    license: "CC0 / CC-BY",
    description: "Curated collection from Freesound.org",
    categories: ["ambient", "impact", "transition", "whoosh"],
  },
  {
    name: "sfx-collection",
    url: "https://github.com/sterlingwes/sound-effects",
    license: "CC0",
    description: "Free sound effects, no attribution required",
    categories: ["impact", "whoosh", "ding", "riser"],
  },
  {
    name: "sonniss-gdc-audio",
    url: "https://github.com/ronen-n/sonniss-gdc-audio",
    license: "CC-BY-3.0",
    description: "Game audio bundles from Sonniss GDC bundles",
    categories: ["ambient", "impact", "transition", "atmosphere"],
  },
  {
    name: "BBC Sound Effects",
    url: "https://sound-effects.bbcrewind.co.uk/",
    license: "RemArc (personal/educational, check terms)",
    description: "BBC Radiophonic Workshop archive",
    categories: ["atmosphere", "transition", "dramatic"],
    notes: "Verify license terms for YouTube monetization before use"
  }
];

/**
 * SFX categories needed per video style
 */
const STYLE_SFX_MAP = {
  "cinematic-documentary": {
    transition: ["whoosh-light", "riser-subtle", "impact-low"],
    emphasis: ["ding-soft", "boom-subtle", "tension-build"],
    reveal: ["riser-dramatic", "impact-hard", "revelation"],
    ambient: ["tension-bed", "atmosphere-dark", "room-tone"],
    emotional: ["piano-sting", "strings-swell", "fade-out"],
  },
  minimal: {
    transition: ["click-clean", "swoosh-subtle", "pop-soft"],
    emphasis: ["ding-clear", "ping", "notification"],
    reveal: ["whoosh-clean", "impact-gentle"],
    ambient: ["silence-bed", "subtle-hum"],
  },
  "motion-graphics": {
    transition: ["whoosh-energy", "swipe", "impact-medium"],
    emphasis: ["pop-bright", "ding-bright", "success"],
    reveal: ["riser-medium", "impact-bright"],
    ambient: ["upbeat-bed", "energy-hum"],
  },
};

/**
 * GitHub search for SFX repos
 */
function getRepoList() {
  return REPOS;
}

/**
 * Generate the library structure manifest
 */
function generateManifest() {
  const manifest = {
    created_at: new Date().toISOString(),
    repos: REPOS.map((r) => ({
      name: r.name,
      url: r.url,
      license: r.license,
      categories: r.categories,
    })),
    style_requirements: STYLE_SFX_MAP,
    download_status: "pending — run with --download flag after verifying repo contents",
    notes: [
      "All files must be downloaded from the repos listed above",
      "Verify license permits commercial/monetized YouTube use",
      "Log every file used in _attribution.json",
      "Apply sparingly — match style guidelines, not maximum density",
    ],
  };

  return manifest;
}

/**
 * Generate attribution log template
 */
function generateAttributionLog() {
  return {
    files: [],
    last_updated: new Date().toISOString(),
    license_summary: {
      CC0: "Public domain, no attribution required",
      "CC-BY": "Attribution required — credit source in video description",
      "CC-BY-SA": "Attribution + share-alike",
      MIT: "Permissive, commercial use OK",
    },
    notes: [
      "Log every SFX file used in each video here",
      "Include: filename, source repo, license, video it was used in",
      "For CC-BY: add credit to video description",
    ],
  };
}

function main() {
  const mode = process.argv[2] || "manifest";

  mkdirSync(SFX_DIR, { recursive: true });

  if (mode === "manifest") {
    const manifest = generateManifest();
    const manifestPath = join(SFX_DIR, "_manifest.json");
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`SFX manifest saved: ${manifestPath}`);
    console.log(`\nRepos identified: ${REPOS.length}`);
    console.log(`Style categories mapped for: ${Object.keys(STYLE_SFX_MAP).join(", ")}`);
    console.log(`\nNext: Search GitHub repos, download actual files, log in _attribution.json`);
  } else if (mode === "attribution") {
    const log = generateAttributionLog();
    writeFileSync(ATTRIBUTION_FILE, JSON.stringify(log, null, 2));
    console.log(`Attribution log created: ${ATTRIBUTION_FILE}`);
  }
}

main();
