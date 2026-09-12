/**
 * Resolve one Iconify icon's raw SVG body, on the Node side only.
 *
 * This is deliberately not imported by anything that runs inside the Remotion
 * browser bundle. The four @iconify-json packages are 16MB combined; bundling
 * all four into the page a headless Chrome renders would drag every render
 * for the sake of the one icon each beat actually uses. Instead the plan
 * builder (qa-scripts/render-sentences.mjs) resolves the body here, in Node,
 * and writes the resolved `{body, width, height}` straight into the beat, so
 * the plan JSON is self-contained and the browser side never touches npm
 * icon packages at all — the same reason palette and fonts are baked into
 * the plan rather than re-derived by the composition.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..", "..", "..");

const cache = new Map(); // iconSet -> parsed icons.json

function loadSet(iconSet) {
  if (cache.has(iconSet)) return cache.get(iconSet);
  const p = join(ROOT, "node_modules", "@iconify-json", iconSet, "icons.json");
  const json = JSON.parse(readFileSync(p, "utf-8"));
  cache.set(iconSet, json);
  return json;
}

/**
 * @param {string} iconSet e.g. "mdi"
 * @param {string} iconName e.g. "cave-entrance" (the raw Iconify name, hyphens kept)
 * @returns {{body: string, width: number, height: number}}
 */
export function getIconBody(iconSet, iconName) {
  const set = loadSet(iconSet);
  const entry = set.icons[iconName];
  if (!entry) throw new Error(`icon "${iconName}" not found in set "${iconSet}"`);
  return {
    body: entry.body,
    width: entry.width || set.width || 24,
    height: entry.height || set.height || 24,
  };
}
