// Stage 2 vendoring tool (CLAIM-assets-001/003): download the LATIN subset
// (unicode-range covering U+0020-U+007E) for a list of families/weights from
// Google Fonts CSS2 into public/fonts, with the same <Family><weight>.woff2
// naming fetch-fonts.js uses. One weight per CSS2 request (a combined
// wght@400;700 request 400s for single-weight families like Bebas Neue).
// Missing weights (e.g. Bebas Neue 700) are skipped and reported.
//
// Usage: node data/audit/2/vendor-latin.mjs <families-file>
// families-file: newline-delimited family names
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "..", "..", "src", "skills", "remotion-render", "public", "fonts");
mkdirSync(OUT, { recursive: true });

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const WEIGHTS = [400, 700];

function slug(name) { return name.replace(/\s+/g, ""); }

function parseRanges(str) {
  const out = [];
  for (const part of str.split(",")) {
    const m = part.trim().match(/^U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?$/);
    if (!m) continue;
    const lo = parseInt(m[1], 16);
    const hi = m[2] ? parseInt(m[2], 16) : lo;
    out.push([lo, hi]);
  }
  return out;
}
function coversLatin(ranges) {
  return ranges.some(([lo, hi]) => lo <= 0x20 && hi >= 0x7e);
}

async function latinUrl(family, weight) {
  const fam = family.replace(/ /g, "+");
  const url = `https://fonts.googleapis.com/css2?family=${fam}:wght@${weight}&display=swap`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`CSS request failed (${res.status})`);
  const css = await res.text();
  const blocks = css.split("@font-face").slice(1);
  for (const block of blocks) {
    if (!block.includes(`font-weight: ${weight};`)) continue;
    const ur = block.match(/unicode-range:\s*([^;]+);/);
    if (!ur) continue;
    if (coversLatin(parseRanges(ur[1]))) {
      const m = block.match(/url\((https:\/\/[^)]+\.woff2)\)/);
      if (m) return m[1];
    }
  }
  throw new Error(`no latin block found for weight ${weight}`);
}

const families = readFileSync(process.argv[2], "utf-8")
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

let ok = 0, skip = 0, fail = 0;
for (const family of families) {
  for (const weight of WEIGHTS) {
    const file = `${slug(family)}-${weight}.woff2`;
    const dest = join(OUT, file);
    try {
      const url = await latinUrl(family, weight);
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`download failed (${res.status})`);
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      console.log(`ok   ${file}`);
      ok++;
    } catch (e) {
      if (String(e.message).includes("CSS request failed (400)")) {
        console.log(`skip ${file} — family has no weight ${weight}`);
        skip++;
      } else {
        console.log(`FAIL ${file}: ${e.message}`);
        fail++;
      }
    }
  }
}
console.log(`\nvendored: ${ok} ok, ${skip} skipped (missing weight), ${fail} fail -> ${OUT}`);
