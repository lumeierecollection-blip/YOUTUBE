/**
 * MOTION-GRAPHICS-MANUAL.md E1 — vendor Lucide icons.
 *
 * Copies the union of every motion-graphics channel's icon_map (plus the
 * defaults) from `lucide-static` into `public/icons/`, normalised per E1.3:
 * width/height stripped (size set at render), `viewBox="0 0 24 24"` kept,
 * `stroke="currentColor"`, and the `stroke-width` attribute removed so A4.3
 * can set it at render time.
 *
 * The whole set is checked up front; any unresolved name fails loudly before
 * a single file is written (A4.7: no silent fallback).
 *
 *   node src/skills/remotion-render/vendor-icons.js
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..");

const config = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8"));
const channels = (config.channels || config).filter((c) => c && c.style === "motion-graphics");

const iconNames = new Set();
for (const channel of channels) {
  const map = channel.icon_map;
  if (!map) {
    console.error(`FAIL: ${channel.channel_name} (id ${channel.id}) has no icon_map`);
    process.exit(1);
  }
  iconNames.add(map.default);
  for (const icon of Object.values(map.terms || {})) iconNames.add(icon);
}

const lucideDir = join(ROOT, "node_modules", "lucide-static", "icons");
const available = new Set(readdirSync(lucideDir).map((f) => f.replace(/\.svg$/, "")));

const missing = [...iconNames].filter((n) => !available.has(n));
if (missing.length > 0) {
  console.error(`FAIL: ${missing.length} icon(s) not in lucide-static: ${missing.join(", ")}`);
  process.exit(1);
}

const outDir = join(__dirname, "public", "icons");
mkdirSync(outDir, { recursive: true });

let written = 0;
for (const name of [...iconNames].sort()) {
  const source = readFileSync(join(lucideDir, `${name}.svg`), "utf-8");
  const svg = source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+class="[^"]*"/g, "")
    .replace(/\s+width="[^"]*"/g, "")
    .replace(/\s+height="[^"]*"/g, "")
    .replace(/\s+stroke-width="[^"]*"/g, "")
    .replace(/\s*>\s*$/m, ">\n")
    .trim();
  writeFileSync(join(outDir, `${name}.svg`), svg + "\n", "utf-8");
  written++;
}

console.log(`Vendored ${written} icons to ${outDir}`);
console.log("Sources: lucide-static v" + JSON.parse(readFileSync(join(ROOT, "node_modules", "lucide-static", "package.json"), "utf-8")).version + " (ISC) / Feather icons (MIT). Recorded in THIRD_PARTY_LICENSES.md.");
