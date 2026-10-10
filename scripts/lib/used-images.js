/**
 * used-images.js — NO IMAGE TWICE IN ONE VIDEO (owner, 2026-10-08 / 2026-10-09), one set for every
 * path that attaches a visual in render-and-qa.js resolveCanvas: entity photo, logo, money cutout,
 * document scan, the bundled fallback surface, concept cutout (bank) and concept cutout (live).
 *
 * An image is identified by its ASSET PATH and by its SOURCE (the page / file it was fetched from).
 * The asset path alone is not an identity: fetch-cutout-once.cjs writes every live cutout to
 * cutouts-live/<channel>/<beat>-<concept>.png and resolve-scene.cjs writes logos the same way, so
 * one Pixabay picture fetched for "gold bar" on beat 2, "gold bars" on beat 4 and "gold tiger" on
 * beat 6 (a different slug each time: the run cache misses) is three different asset paths — and a
 * filter keyed by path let it through three times. Its Pixabay page URL is the same each time.
 *
 * WHERE THIS STOPS: two different uploads of the same picture (a re-post on another Pixabay page,
 * a Commons duplicate) have different sources and different paths; nothing here compares pixels.
 */

// A source is an identity only if it names ONE image: a bare domain ("https://en.wikipedia.org",
// moneyCandidates' fallback page) would mark every later image from that site as used.
const specific = (s) => typeof s === "string" && s.trim() !== "" && (!/^https?:\/\//i.test(s) || /^https?:\/\/[^/]+\/[^?#\s]+/i.test(s));

/**
 * A MARK is an entity's own logo (visual.logo === true). It identifies the entity, it does not decorate a beat, so the rule above is about
 * everything BUT marks: a second sentence naming the same organization shows its logo again. Applied as it was, the rule turned every repeat
 * into a typed name (board 38044082797: SHRM, Financial Stability Board and MIT each had their logo on one beat and their name in type on the
 * others — the owner, 2026-10-10: "I want logos, not writing"). Photos, cutouts, scans and the bundled surface are still never repeated.
 */
export const isMark = (v) => !!v && v.logo === true;

/** The identity keys of a visual: { asset, source_url } (either may be missing). */
export function imageKeys(v) {
  if (!v) return [];
  return [v.asset, specific(v.source_url) ? v.source_url : null].filter(Boolean).map(String);
}

/**
 * createUsedImages(log) -> { reused(v, what), add(v), keep(visuals, what) }
 *   reused(v, what) — true (and logged) when any key of v was already shown on an earlier beat
 *   add(v)          — record v's keys (call for every visual a beat ends up drawing)
 *   keep(list, what) — the visuals of one beat that are new, each recorded as it is kept, so two
 *                     names on the same beat resolving to one picture also keep only the first.
 *                     Drawn symbols (no asset, no source) are not images and always pass.
 */
export function createUsedImages(log = () => {}) {
  const seen = new Set();
  const reused = (v, what = "image") => {
    if (isMark(v)) return false;   // a mark is shown again whenever its entity is named again
    const hit = imageKeys(v).find((k) => seen.has(k));
    if (hit) log(`[no-repeat] ${what} ${v.asset || hit} already shown on an earlier beat${hit !== v.asset ? ` (same source: ${hit})` : ""} — not used again`);
    return !!hit;
  };
  const add = (v) => { if (isMark(v)) return; for (const k of imageKeys(v)) seen.add(k); };
  const keep = (list, what = "image") => (list || []).filter((v) => {
    if (!imageKeys(v).length) return true;
    if (reused(v, what)) return false;
    add(v);
    return true;
  });
  return { reused, add, keep, has: (k) => seen.has(k) };
}
