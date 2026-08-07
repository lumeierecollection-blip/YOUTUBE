// AUDIT-TYPE — Stage 2 upstream font build fetcher.
// Downloads the CURRENT Google Fonts woff2 build for the mg-roster families
// (the second, independent binary source for the tnum audit) into the temp
// dir. Uses the css2 API exactly as fetch-fonts.js does (Chrome UA => the
// variable-font serving path the repo's own vendoring tool uses).
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = process.env.TEMP_AUDIT_FONTS || join(process.env.TEMP || "/tmp", "opencode", "fonts-upstream");
mkdirSync(OUT, { recursive: true });

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// family -> requested weights (400 and 700, mirroring fetch-fonts.js WEIGHTS)
const FAMILIES = {
  Inter: [400, 700],
  "DM Sans": [400, 700],
  "Roboto Condensed": [400, 700],
  Nunito: [400, 700],
  "JetBrains Mono": [400, 700],
  Lora: [400, 700],
  "Fira Sans": [400, 700], // not vendored in repo; checking upstream feature set for the fallback record
};

async function getCss(family, weights) {
  const fam = family.replace(/ /g, "+");
  const url = `https://fonts.googleapis.com/css2?family=${fam}:wght@${weights.join(";")}&display=swap`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${family}: css2 status ${res.status}`);
  return res.text();
}

function urlFor(css, weight) {
  const blocks = css.split("@font-face");
  for (const b of blocks) {
    if (!b.includes(`font-weight: ${weight};`)) continue;
    const m = b.match(/url\((https:\/\/[^)]+\.woff2)\)/);
    if (m) return m[1];
  }
  return null;
}

async function main() {
  const manifest = {};
  for (const [family, weights] of Object.entries(FAMILIES)) {
    const css = await getCss(family, weights);
    const entry = {};
    for (const w of weights) {
      const url = urlFor(css, w);
      if (!url) { console.log(`${family} ${w}: no url`); continue; }
      const slug = family.replace(/\s+/g, "");
      const dest = join(OUT, `${slug}-${w}.woff2`);
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`${family} ${w}: download ${res.status}`);
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      entry[w] = { url, bytes: (await import("node:fs")).statSync(dest).size };
      console.log(`ok ${family} ${w}: ${entry[w].bytes} bytes`);
    }
    manifest[family] = entry;
  }
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("OUT:", OUT);
}
main().catch((e) => { console.error(e); process.exit(1); });
