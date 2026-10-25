"use strict";
/**
 * FAIR-USE LOGOS, for identification only (owner's decision, 2026-10-10).
 *
 * A named organisation's real mark is shown when no Commons-licensed one exists — a non-free logo hosted only on English Wikipedia — under these
 * rules, each enforced here or at the caller:
 *   - Only a file English Wikipedia itself files as a non-free LOGO (its category / its {{Non-free logo}} template). Not a photo, not a poster.
 *   - Only for the organisation the sentence NAMES, on the beat that names it (the caller: resolveOrgScene, entity-bound). Never decoration.
 *   - Unaltered and low-resolution: the caller rasterises it no larger than FAIR_USE_MAX_SIDE.
 *   - Recorded PER USE in the credits manifest: the fair-use basis, the rationale as English Wikipedia's file page states it, the rights holder,
 *     the file page URL and the article it identifies (creditEntries in src/skills/remotion-render/credits.js).
 *   - Where neither licence can be satisfied the organisation's NAME is set in type: no box, no invented initials (MarkPlate).
 *
 * Where this stops: this is a policy and a record, not legal advice. The rationale is whatever the Wikipedia file page says; a file with no
 * parsable rationale is refused rather than given a made-up one. The holder falls back to "the trademark owner named on the file page" when
 * the page carries none in a field we can read.
 */
const FAIR_USE_MAX_SIDE = 600;
const LICENSE_LABEL = "Fair use (non-free logo, identification only)";

const clean = (s) => String(s || "")
  .replace(/\{\{[^{}]*\}\}/g, " ").replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1").replace(/'''?/g, "").replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ").trim();
const field = (wikitext, names) => {
  for (const n of names) {
    const m = String(wikitext || "").match(new RegExp(`\\|\\s*${n}\\s*=\\s*([^\\n]*(?:\\n(?!\\s*[|}])[^\\n]*)*)`, "i"));
    const v = m && clean(m[1]);
    if (v) return v;
  }
  return "";
};

/** Is this English-Wikipedia file page a non-free LOGO with a stated rationale? Returns the record or { refuse }. */
function parseFairUse({ wikitext, categories = [], artist = "" }) {
  const isLogo = categories.some((c) => /non-?free logos?/i.test(c)) || /\{\{\s*(?:non-?free logo|non-?free use rationale logo|logo rationale)/i.test(wikitext || "");
  if (!isLogo) return { refuse: "English Wikipedia does not file it as a non-free logo" };
  const purpose = field(wikitext, ["Purpose", "Use", "Description"]);
  const article = field(wikitext, ["Article", "Used in"]);
  if (!purpose && !article) return { refuse: "the file page states no rationale" };
  const holder = field(wikitext, ["Owner", "Copyright holder", "Copyright", "Author", "Artist"]) || clean(artist) || "the trademark owner named on the file page";
  return { article: article || null, rationale: (purpose || `Identification of ${article}`).slice(0, 400), holder: holder.slice(0, 160) };
}

/** Candidate file title -> { info, fair_use } or { refuse }. `getJson` is entity-assets.getJson. */
async function fairUseInfo(fileTitle, getJson) {
  const t = fileTitle.startsWith("File:") ? fileTitle : `File:${fileTitle}`;
  const j = await getJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=imageinfo|categories|revisions&iiprop=url|size|mime|extmetadata&iiurlwidth=${FAIR_USE_MAX_SIDE}&rvprop=content&rvslots=main&cllimit=60&titles=${encodeURIComponent(t)}`);
  const page = Object.values(j?.query?.pages || {})[0];
  const ii = page?.imageinfo?.[0];
  if (!page || !ii) return { refuse: "no English Wikipedia file page" };
  const wikitext = page.revisions?.[0]?.slots?.main?.["*"] || page.revisions?.[0]?.["*"] || "";
  const md = ii.extmetadata || {};
  const r = parseFairUse({ wikitext, categories: (page.categories || []).map((c) => c.title || ""), artist: md.Artist?.value || "" });
  if (r.refuse) return r;
  return {
    info: { title: page.title, url: ii.url, thumb: ii.thumburl || ii.url, width: ii.width, height: ii.height, mime: ii.mime, license: LICENSE_LABEL, descurl: ii.descriptionurl },
    fair_use: { basis: "fair use", purpose: "identification of the organisation named in the sentence only", rationale: r.rationale, article: r.article, holder: r.holder, file_page: ii.descriptionurl, retrieved: new Date().toISOString().slice(0, 10) },
  };
}

module.exports = { FAIR_USE_MAX_SIDE, LICENSE_LABEL, parseFairUse, fairUseInfo };
