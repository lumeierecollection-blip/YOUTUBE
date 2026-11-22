// The multi-PNG render fixture: eight distinct synthetic PNGs (square, 16:9, 9:16, 4:3, 3:2, 3:1, two with alpha),
// file names with spaces, parentheses, '#', '&', '%' and non-ASCII letters, and nine beats that draw them. The last
// beat deliberately REUSES the previous beat's picture: the renderer draws whatever the plan says (keeping a picture
// from repeating is the resolver's job, scripts/lib/used-images.js), so the fixture shows the render copes with it.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { syntheticPng } from "./synthetic-png.mjs";

export const SUBDIR = "qa-synth";

export const IMAGES = [
  { file: "wide 16x9 final.png", w: 1600, h: 900, hue: 10 },
  { file: "cutout alpha #1.png", w: 900, h: 1100, hue: 50, disc: true },
  { file: "tall 9x16.png", w: 720, h: 1280, hue: 90 },
  { file: "cutout (alpha) 2 & more.png", w: 1000, h: 1000, hue: 130, disc: true },
  { file: "square card.png", w: 800, h: 800, hue: 170 },
  { file: "panorama 3x1.png", w: 1800, h: 600, hue: 210 },
  { file: "café ünï 4x3.png", w: 1024, h: 768, hue: 250 },
  { file: "100% real 3x2.png", w: 1200, h: 800, hue: 290 },
];

// [composition, image index, spoken sentence]. Compositions never repeat on consecutive beats.
const BEATS = [
  ["PHOTO-BAND", 0, "Test image one is a wide frame."],
  ["HERO-LOW", 1, "Test image two is a cutout with a clear edge."],
  ["PHOTO-CARD", 2, "Test image three is a tall frame."],
  ["HERO-OVER", 3, "Test image four is a second cutout."],
  ["PHOTO-EDGE", 4, "Test image five is a square frame."],
  ["PHOTO-INSET", 5, "Test image six is a panorama."],
  ["SCENE-LOW", 6, "Test image seven has an accented name."],
  ["PHOTO-STRIP", 7, "Test image eight has a percent sign in its name."],
  ["PHOTO-BAND", 7, "Test image eight is shown again on purpose."],
];

// Beats that carry the "Source: <credit>" line the renderer draws bottom-right from frame 40 of the beat (full-canvas.jsx).
export const SOURCE_CREDIT = "Synthetic test source";
const CREDIT_BEATS = new Set([0, 1, 6]);

export function buildFixture(images = IMAGES) {
  const meta = images.map((i) => ({ ...i, asset: `${SUBDIR}/${i.file}`, alpha: !!i.disc }));
  const beats = BEATS.map(([composition, k, text], n) => {
    const im = meta[k];
    const c = im.disc
      ? { visual_type: "TYPE", composition, shot: composition, concept_visuals: [{ name: `synthetic-${k + 1}`, class: "cutout", asset: im.asset, w: im.w, h: im.h }], headline: `Synthetic cutout ${k + 1}`, motion_tier: "medium" }
      : { visual_type: "PHOTO", composition, shot: composition, photo: { asset: im.asset, entity: `Synthetic image ${k + 1}`, kind: "place", view: "place", w: im.w, h: im.h, credit: "Synthetic test image" }, headline: `Synthetic image ${k + 1}`, motion_tier: "medium" };
    if (CREDIT_BEATS.has(n)) c.source_credit = SOURCE_CREDIT;
    return { text, c, fixture: { image: k, reuse: n > 0 && BEATS[n - 1][1] === k, headline: c.headline, source_credit: c.source_credit || null } };
  });
  return { images: meta, beats };
}

// The same beats with the drawn text overlays removed: headline, source credit, and the photo's entity name, which the layout
// draws as the headline when there is no headline (canvas-layout.js: `photo.entity || headline`). Run 40081807406 showed the
// baseline still carrying the headline until the entity was dropped too. Rendered beside the real one, the difference inside a
// text box is what the text added (see the overlay checks in check-multi-png-render.mjs).
export function plainBeats(beats) {
  return beats.map(({ text, c }) => {
    const { headline, source_credit, ...rest } = c;
    if (rest.photo) { const { entity, ...photo } = rest.photo; rest.photo = photo; }
    return { text, c: rest };
  });
}

// Writes the PNGs under <publicDir>/qa-synth/ and returns the fixture with each image's signature colour.
export function writeFixture(publicDir, images = IMAGES) {
  const fx = buildFixture(images);
  const dir = join(publicDir, SUBDIR);
  mkdirSync(dir, { recursive: true });
  fx.images.forEach((im) => {
    const { png, signature } = syntheticPng(im);
    writeFileSync(join(dir, im.file), png);
    im.signature = signature;
  });
  return fx;
}
