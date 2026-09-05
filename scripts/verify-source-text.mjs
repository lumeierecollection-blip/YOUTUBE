#!/usr/bin/env node
/**
 * Checks that every asset source records the text its API actually returns,
 * under the field name that API actually uses.
 *
 * Why: fetch-library.js used to drop `title` on the floor when writing the
 * manifest, so nothing downstream could justify a photo choice from the
 * source's own words. The per-beat reasoning stage treats source-provided text
 * as the ONLY admissible evidence that a picture matches a script line, so a
 * source that silently loses its text turns every beat into an unmatched gap.
 *
 * Each parser is fed a response shaped like its API's, carrying a marker
 * string. The marker must come back under the right key, and no key may be
 * invented for text the API did not send.
 *
 *   node scripts/verify-source-text.mjs
 */
import { parseLocItem } from "../src/skills/asset-sourcing/sources/loc.js";
import { parseMetObject } from "../src/skills/asset-sourcing/sources/met.js";
import { parseNaraRecord } from "../src/skills/asset-sourcing/sources/nara.js";
import { parseNasaItem } from "../src/skills/asset-sourcing/sources/nasa.js";
import { parseOpenverseResult } from "../src/skills/asset-sourcing/sources/openverse.js";
import { parsePexelsPhoto } from "../src/skills/asset-sourcing/sources/pexels.js";
import { parseRawpixelItem } from "../src/skills/asset-sourcing/sources/rawpixel.js";
import { parseSmithsonianRow } from "../src/skills/asset-sourcing/sources/smithsonian.js";
import { parseUnsplashPhoto } from "../src/skills/asset-sourcing/sources/unsplash.js";
import { parseWikimediaResponse } from "../src/skills/asset-sourcing/sources/wikimedia.js";

const M = "MARKER-TEXT";
const IMG = "https://example.test/a.jpg";

const cases = [
  ["loc", () => parseLocItem({ title: M, id: "http://www.loc.gov/item/1/", image_url: [IMG],
      rights: "public domain" }), { title: M }],
  ["met", () => parseMetObject({ title: M, objectURL: "https://www.metmuseum.org/art/1",
      primaryImage: IMG, isPublicDomain: true }), { title: M }],
  ["nara", () => parseNaraRecord({ record: { title: M, naId: "1",
      digitalObjects: [{ objectUrl: IMG }] } }), { title: M }],
  ["nasa", () => parseNasaItem({ data: [{ title: M, nasa_id: "1" }],
      links: [{ href: IMG, rel: "preview" }] }), { title: M }],
  ["openverse", () => parseOpenverseResult({ title: M, url: IMG, foreign_landing_url: "https://x.test/1",
      license: "cc0", width: 3000, height: 2000 }), { title: M }],
  ["pexels", () => parsePexelsPhoto({ alt: M, url: "https://www.pexels.com/photo/1/",
      src: { original: IMG }, width: 3000, height: 2000, photographer: "P" }), { alt: M }],
  ["rawpixel", () => parseRawpixelItem({ id: "1", url: "https://www.rawpixel.com/image/1",
      style_uri: "https://img.rawpixel.test/{}/a.jpg",
      metadata: { title: M, licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/" },
      width: 3000, height: 2000 }), { title: M }],
  ["smithsonian", () => parseSmithsonianRow({ title: M, id: "1",
      content: { descriptiveNonRepeating: { guid: "https://n2t.test/1",
        online_media: { media: [{ type: "Images", usage: { access: "CC0" },
          resources: [{ label: "High-resolution image", url: IMG }] }] } } } }), { title: M }],
  ["unsplash", () => parseUnsplashPhoto({ alt_description: M, description: M + "-DESC",
      urls: { raw: IMG }, links: { html: "https://unsplash.com/photos/1" },
      width: 3000, height: 2000, user: { name: "U" } }), { alt: M, description: M + "-DESC" }],
  ["wikimedia", () => parseWikimediaResponse({ query: { pages: { 1: { title: `File:${M}.jpg`,
      imageinfo: [{ url: IMG, width: 3000, height: 2000, extmetadata: {
        LicenseShortName: { value: "CC0" },
        ImageDescription: { value: `<p>${M}-DESC</p>` } } }] } } } })[0],
   { title: `File:${M}.jpg`, description: `${M}-DESC` }],
];

let failed = 0;
for (const [name, run, expect] of cases) {
  let got;
  try { got = run(); } catch (e) { console.log(`FAIL  ${name.padEnd(12)} parser threw: ${e.message}`); failed++; continue; }
  if (!got) { console.log(`FAIL  ${name.padEnd(12)} parser returned nothing (fixture rejected)`); failed++; continue; }
  const st = got.sourceText;
  if (!st) { console.log(`FAIL  ${name.padEnd(12)} no sourceText`); failed++; continue; }

  const wrong = Object.entries(expect).filter(([k, v]) => st[k] !== v);
  // A key holding text the API never sent would be fabricated evidence.
  const extra = Object.keys(st).filter((k) => !(k in expect) && st[k]);
  if (wrong.length || extra.length) {
    console.log(`FAIL  ${name.padEnd(12)} ${wrong.length ? `wrong/missing ${wrong.map(([k]) => k).join(",")} ` : ""}${extra.length ? `invented ${extra.join(",")}` : ""}`);
    console.log(`      got: ${JSON.stringify(st)}`);
    failed++;
  } else {
    console.log(`PASS  ${name.padEnd(12)} ${Object.keys(expect).join(", ")}`);
  }
}
console.log(failed ? `\n${failed} source(s) FAILED` : "\nOK — all 10 sources record their API's own text, under its own field name.");
process.exit(failed ? 1 : 0);
