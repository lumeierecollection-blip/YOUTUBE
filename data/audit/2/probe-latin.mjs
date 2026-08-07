// Stage 2 probe: download the LATIN subset block (unicode-range U+0000-00FF...)
// for every channel-referenced family, for GSUB/tnum + digit verification.
// NOT the final vendoring tool — probe only.
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "probe");
mkdirSync(OUT, { recursive: true });

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const FAMILIES = ["Space Grotesk","Inter","Playfair Display","DM Sans","JetBrains Mono","Oswald","Nunito","Cormorant Garamond","Roboto Condensed","Bebas Neue","Fira Sans","Comic Neue","Noto Serif"];
const WEIGHTS = [400, 700];

function slug(name) { return name.replace(/\s+/g, ""); }

// parse a unicode-range value into a set of intervals [(lo,hi)]
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
  // latin block must cover U+0000-00FF at minimum (space, digits, A-Za-z)
  return ranges.some(([lo, hi]) => lo <= 0x20 && hi >= 0x7e);
}

async function latinUrl(family, weight) {
  const fam = family.replace(/ /g, "+");
  const url = `https://fonts.googleapis.com/css2?family=${fam}:wght@${weight}&display=swap`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${family}: CSS request failed (${res.status})`);
  const css = await res.text();
  const blocks = css.split("@font-face").slice(1);
  let found = null;
  for (const block of blocks) {
    if (!block.includes(`font-weight: ${weight};`)) continue;
    const ur = block.match(/unicode-range:\s*([^;]+);/);
    if (!ur) continue;
    if (coversLatin(parseRanges(ur[1]))) {
      const m = block.match(/url\((https:\/\/[^)]+\.woff2)\)/);
      if (m) { found = m[1]; break; }
    }
  }
  if (!found) throw new Error(`${family} w${weight}: no latin block found`);
  return found;
}

let ok = 0, fail = 0;
for (const family of FAMILIES) {
  for (const weight of WEIGHTS) {
    const file = `${slug(family)}-${weight}.woff2`;
    const dest = join(OUT, file);
    try {
      const url = await latinUrl(family, weight);
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`download ${res.status}`);
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      console.log(`ok ${file} ${url.slice(-50)}`);
      ok++;
    } catch (e) {
      console.log(`FAIL ${file}: ${e.message}`);
      fail++;
    }
  }
}
console.log(`\nprobe done: ${ok} ok, ${fail} fail -> ${OUT}`);
