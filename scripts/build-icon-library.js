#!/usr/bin/env node
/**
 * Build config/assets/icon-library.json — the match-time index for every
 * Iconify icon installed as a dependency.
 *
 *   node scripts/build-icon-library.js
 *
 * WHY THIS EXISTS. The 109 procedural drawings in compositions/objects/ were
 * measured against a real Iconify render and lost: a hand-drawn spider and
 * centipede did not read at Shorts scale, the Iconify equivalents did (see
 * data/renders/iconify-proof.png). This indexes @iconify-json/{game-icons,
 * mdi,tabler,ph} — 27,165 icons installed offline, 16MB total — so the
 * existing semantic matcher (visual-engine/assets/match.js) can select an
 * icon exactly the way it already selects a procedural drawing.
 *
 * WHAT IS AND ISN'T INVENTED HERE. `synonyms` come only from the icon's own
 * name and Iconify's own alias list. `concepts` come only from the category
 * groupings Iconify itself publishes (mdi ships 61 real categories; the other
 * three sets ship none, so their icons carry no concepts and rely on name and
 * synonym hits alone). No visualMeaning prose, no compatibleTopics, no
 * incompatibleTopics are authored per icon — that would mean hand-writing
 * semantics for 27,165 entries, which is the ≥2000-with-rich-metadata problem
 * this repo has already tried and abandoned once (see the source-json comment
 * history in config/assets/semantic-library.source.json). Leaving those
 * fields empty is honest: it means an icon's topic multiplier defaults to
 * 0.45 (visual-engine/assets/match.js) instead of the boosted 1.6x a
 * hand-tagged procedural asset can reach, and no icon can hard-reject on
 * incompatibleTopics because none is claimed. A false match is still bounded
 * by MATCH_THRESHOLD; there is simply no hand-authored guardrail beyond that
 * for this set, and that limit is real, not hidden.
 *
 * SET PRIORITY ON A NAME COLLISION. If two sets publish the same spaced-out
 * name (mdi and tabler both have "volcano"), only one can occupy that name
 * in the library — `beat.focal` is a name string, and two assets sharing a
 * name make resolution ambiguous. MIT/Apache sets are tried before the CC BY
 * set so a no-attribution icon wins whenever one exists; ties within licence
 * tier keep whichever set is scanned first, in SETS order below.
 *
 * LICENCE. game-icons is CC BY 3.0 and every icon record from it therefore
 * carries `attribution` — {name, url} its images require in-video credit.
 * mdi, tabler and ph are Apache-2.0 / MIT / MIT — `attribution` is null.
 * The daily pipeline is responsible for collecting `attribution` off every
 * icon actually used in a render and putting it in the video description;
 * that collection step does not exist yet (tracked, not built in this pass).
 */

/**
 * STYLE WORDS ARE NOT CONTENT. Icon-set naming convention appends the
 * rendering variant to the subject — "close-thick", "sun-clock-outline",
 * "home-filled" — and a naive tokenizer treats "thick" or "outline" as a
 * synonym of the icon exactly like it treats "close" or "sun". Measured
 * on the cave script: "Air thick with hydrogen sulfide" matched mdi's
 * close-thick icon (an X/cancel glyph in a bold stroke) at a score that beat
 * every real candidate, because "thick" is that icon's own name token and
 * the sentence's own most distinctive word — a pure stroke-weight label
 * standing in for gas density. These words are stripped from both the
 * matchable name and the synonym list before an icon is indexed; they are
 * never given to the scorer as evidence of anything.
 *
 * Stripping also deduplicates real content: "cave-entrance" and (if it
 * existed) "cave-entrance-outline" both reduce to the same canonical name,
 * so only one entry is kept for what is visually the same subject in a
 * different line weight — the intended behaviour of the cross-set
 * `droppedAsDuplicateName` de-dup above, now also catching duplicates
 * within a single set that the plain icon name didn't previously reveal.
 */
const STYLE_WORDS = new Set(`
  outline outlined fill filled solid bold thick thin duotone duo twotone
  two tone sharp round rounded regular line lined mini micro small large
  alt alternate variant glyph light heavy black white simple detailed
  filled-outline stroke strokes
`.trim().split(/\s+/));

const stripStyle = (nameTokens) => {
  const kept = nameTokens.filter((t) => !STYLE_WORDS.has(t));
  return kept.length ? kept : nameTokens; // never reduce a name to nothing
};
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "config", "assets", "icon-library.json");

/** Preference order: no-attribution sets first, CC BY set last. */
const SETS = ["mdi", "tabler", "ph", "game-icons"];

const pkgDir = (set) => join(ROOT, "node_modules", "@iconify-json", set);
const readJson = (p) => JSON.parse(readFileSync(p, "utf-8"));

const tokens = (s) => String(s).toLowerCase().replace(/[-_]/g, " ").split(/\s+/).filter(Boolean);
const spaced = (iconName) => iconName.replace(/-/g, " ");

const byName = new Map(); // name -> asset, first writer (by SETS order) wins
let totalSeen = 0, dropped = 0;

for (const set of SETS) {
  const info = readJson(join(pkgDir(set), "info.json"));
  const icons = readJson(join(pkgDir(set), "icons.json"));
  let categories = {};
  try { categories = readJson(join(pkgDir(set), "metadata.json")).categories || {}; } catch { /* no metadata.json for this set */ }
  const catOf = new Map();
  for (const [cat, names] of Object.entries(categories)) for (const n of names) {
    if (!catOf.has(n)) catOf.set(n, []);
    catOf.get(n).push(cat);
  }
  const attribution = info.license?.spdx === "CC-BY-3.0"
    ? { name: info.author?.name || set, url: info.author?.url || null, license: info.license?.title, licenseUrl: info.license?.url }
    : null;

  const aliasesOf = new Map(); // canonical icon name -> [alias names]
  for (const [alias, target] of Object.entries(icons.aliases || {})) {
    const t = typeof target === "string" ? target : target.parent;
    if (!aliasesOf.has(t)) aliasesOf.set(t, []);
    aliasesOf.get(t).push(alias);
  }

  for (const iconName of Object.keys(icons.icons)) {
    totalSeen++;
    const contentTokens = stripStyle(tokens(iconName));
    const name = contentTokens.join(" ");
    if (byName.has(name)) { dropped++; continue; }
    const aliases = aliasesOf.get(iconName) || [];
    const cats = catOf.get(iconName) || [];
    const aliasSynonyms = aliases.map((a) => stripStyle(tokens(a)).join(" "));
    byName.set(name, {
      id: `icon:${set}:${iconName}`,
      name,
      category: "iconify",
      subcategory: cats[0] || set,
      concepts: cats,
      synonyms: [...new Set([...contentTokens, ...aliasSynonyms])].filter(Boolean),
      visualMeaning: "",
      compatibleTopics: [],
      incompatibleTopics: [],
      source: "iconify",
      iconSet: set,
      iconName,
      sourceUrl: info.author?.url || null,
      license: info.license?.title || null,
      attribution,
      dimensions: null,
      aspectRatio: 1,
      animationCapabilities: ["appear", "settle", "vanish"],
      provisional: false,
    });
  }
}

const assets = [...byName.values()];
const out = {
  version: 1,
  generated_by: "scripts/build-icon-library.js",
  sets: SETS,
  seen: totalSeen,
  droppedAsDuplicateName: dropped,
  count: assets.length,
  assets,
};
writeFileSync(OUT, JSON.stringify(out));
console.log(`${assets.length} icon(s) indexed from ${SETS.length} set(s) (${totalSeen} seen, ${dropped} dropped as duplicate names)`);
for (const s of SETS) console.log(`  ${s}: ${assets.filter((a) => a.iconSet === s).length} kept`);
