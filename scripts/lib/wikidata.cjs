/**
 * wikidata.cjs — an entity's OWN mark and picture, from Wikidata's structured claims.
 *
 * Why (owner, 2026-10-10: "I want logos, not writing"): the Commons text search finds a logo only when its file name carries every word of
 * the entity's name, and Wikipedia's infobox only when the article has one. Wikidata states it outright — P154 logo image, P8972 small
 * logo, P158 seal, P94 coat of arms, P18 image — and matches on ALIASES, so "Low Taek Jho" finds Jho Low's item and "Department of the
 * Treasury" the US one. The file names it returns are Commons files: they go through the SAME free-licence check, conversion and
 * verifier as every other candidate (resolve-scene.cjs resolveOrgScene, entity-assets.cjs personCandidates). Nothing here is trusted on
 * its own.
 *
 * Where it stops: an item is taken only on an EXACT label / alias match (case and punctuation folded) and, for an organisation, only if it
 * is not a human, for a person only if it is (P31 Q5). A name that matches nothing exactly returns nothing: no guessing by closeness.
 * getJson is injected so this runs offline in tests.
 */
const API = "https://www.wikidata.org/w/api.php";
const fold = (s) => String(s || "").toLowerCase().replace(/[’'`]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const NOT_AN_ENTITY = /disambiguation|wikimedia (category|list|template)|scientific article/i;
// property -> what the file is
const LOGO_PROPS = ["P154", "P8972", "P158", "P94"], IMAGE_PROPS = ["P18"];
const HUMAN = "Q5";

const claimFiles = (claims, props) => {
  const out = [];
  for (const p of props) {
    const list = (claims?.[p] || []).filter((c) => c.rank !== "deprecated" && c.mainsnak?.datavalue?.type === "string");
    // a logo with an END time (P582) is a former one: current ones first, preferred rank before normal
    const score = (c) => (c.qualifiers?.P582 ? 2 : 0) + (c.rank === "preferred" ? -1 : 0);
    for (const c of [...list].sort((a, b) => score(a) - score(b))) out.push(String(c.mainsnak.datavalue.value));
  }
  return [...new Set(out)];
};
const isHuman = (claims) => (claims?.P31 || []).some((c) => c.mainsnak?.datavalue?.value?.id === HUMAN);

/**
 * find(name, { type: "organization" | "person", getJson, limit }) ->
 *   { id, label, description, logos: ["Name.svg"], images: ["Photo.jpg"], matched: "label" | "alias" } | null
 */
async function find(name, { type = "organization", getJson, limit = 6 } = {}) {
  if (typeof getJson !== "function" || !String(name || "").trim()) return null;
  const want = fold(name);
  if (!want) return null;
  const sj = await getJson(`${API}?action=wbsearchentities&format=json&language=en&uselang=en&type=item&limit=${limit}&search=${encodeURIComponent(String(name).trim())}`);
  const hits = (sj?.search || []).filter((h) => h?.id && !NOT_AN_ENTITY.test(h.description || ""))
    .filter((h) => fold(h.label) === want || (h.aliases || []).some((a) => fold(a) === want) || fold(h.match?.text) === want);
  if (!hits.length) return null;
  const ids = hits.slice(0, 3).map((h) => h.id);
  const ej = await getJson(`${API}?action=wbgetentities&format=json&props=claims&ids=${ids.join("|")}`);
  for (const h of hits.slice(0, 3)) {
    const claims = ej?.entities?.[h.id]?.claims;
    if (!claims) continue;
    const human = isHuman(claims);
    if ((type === "person") !== human) continue;   // a person's name must reach a person, an organisation's must not
    const logos = type === "person" ? [] : claimFiles(claims, LOGO_PROPS);
    const images = claimFiles(claims, IMAGE_PROPS);
    if (!logos.length && !images.length) continue;
    return { id: h.id, label: h.label || name, description: h.description || "", logos, images, matched: fold(h.label) === want ? "label" : "alias" };
  }
  return null;
}

module.exports = { find, fold, claimFiles, isHuman };
