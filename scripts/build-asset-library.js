#!/usr/bin/env node
/**
 * Build config/assets/semantic-library.json from the authored semantics and the
 * drawing registry.
 *
 *   node scripts/build-asset-library.js
 *   node scripts/build-asset-library.js --check
 *
 * ANYTHING REGISTERED BUT NOT AUTHORED IS AN ERROR, NEVER A DEFAULT. A drawing
 * with generated metadata would match on its own name and nothing else, which
 * is keyword matching again wearing a schema. The build fails and names it.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OBJ = join(ROOT, "src", "skills", "remotion-render", "compositions", "objects");
const OUT = join(ROOT, "config", "assets", "semantic-library.json");
const CHECK = process.argv.includes("--check");

/** Every drawing the renderer can actually produce, read from source. */
function registered() {
  const names = new Set();
  for (const f of readdirSync(OBJ).filter((f) => f.endsWith(".jsx"))) {
    for (const m of readFileSync(join(OBJ, f), "utf-8").matchAll(/registerObject\("([^"]+)"/g)) {
      names.add(m[1]);
    }
  }
  return [...names].sort();
}

const src = JSON.parse(readFileSync(join(ROOT, "config", "assets", "semantic-library.source.json"), "utf-8"));
const drawings = registered();
const authored = src.assets;

const missing = drawings.filter((n) => !authored[n]);
const orphan = Object.keys(authored).filter((n) => !drawings.includes(n));
if (missing.length || orphan.length) {
  if (missing.length) console.error(`${missing.length} drawing(s) with no authored semantics: ${missing.join(", ")}`);
  if (orphan.length) console.error(`${orphan.length} authored entry(ies) with no drawing: ${orphan.join(", ")}`);
  console.error("\nA drawing with generated metadata matches on its own name and nothing else, which is keyword matching again. Author it in config/assets/semantic-library.source.json.");
  process.exit(1);
}

const assets = drawings.map((name) => {
  const a = authored[name];
  return {
    id: name.replace(/\s+/g, "-"),
    name,
    category: "procedural",
    subcategory: (a.topics && a.topics[0]) || "general",
    concepts: a.concepts,
    synonyms: a.synonyms,
    visualMeaning: a.visualMeaning,
    compatibleTopics: a.topics,
    incompatibleTopics: a.avoid,
    /**
     * Provenance. Every one of these is drawn by this repo in code, so there is
     * no third-party licence to honour and no attribution owed. When the
     * expansion loop starts adding sourced images this field is what carries
     * their licence, and a mixed library needs it on every entry from the start.
     */
    source: "procedural",
    sourceUrl: null,
    license: "own-work",
    attribution: null,
    dimensions: null,
    aspectRatio: 1.02,
    animationCapabilities: ["appear", "grow", "descend", "settle", "vanish", "split", "transform"],
    provisional: false,
  };
});

const doc = {
  version: 1,
  generated_by: "scripts/build-asset-library.js",
  topics: src.topics,
  count: assets.length,
  assets,
};
const text = JSON.stringify(doc, null, 1) + "\n";
if (CHECK) {
  const same = existsSync(OUT) && readFileSync(OUT, "utf-8") === text;
  console.log(same ? "semantic-library.json is up to date" : "semantic-library.json is STALE");
  process.exit(same ? 0 : 1);
}
writeFileSync(OUT, text);
console.log(`semantic library: ${assets.length} asset(s), ${src.topics.length} topics.`);
