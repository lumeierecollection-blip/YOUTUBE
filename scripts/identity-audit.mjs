#!/usr/bin/env node
/**
 * identity-audit — who is a Commons file of? (owner, 2026-10-10: a wrong face captioned as a name is the same class as a wrong place.)
 *
 *   node scripts/identity-audit.mjs --file "File:Inde Navarrette at ... .jpg" --person "Inde Navarrette" --other "Chase Sui Wonders"
 *
 * Answers, from the Commons and Wikipedia APIs (not from a model):
 *   - the file's own title, description, Artist, categories, uploader and upload date
 *   - which Wikipedia articles USE the file (imageusage) and which other wikis (globalusage): the article it sits in is the strongest evidence
 *   - the Wikidata item for each named person and its P18 (image) file
 * Prints a verdict per name: "file names it" / "file used by its article" / "file used by another person's article" / "no evidence".
 * Reports only; changes nothing.
 */
const UA = "youtube-automation/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; identity audit)";
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const fileTitle = arg("file"), person = arg("person"), other = arg("other");
const get = async (url) => { const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); };
const COMMONS = "https://commons.wikimedia.org/w/api.php", EN = "https://en.wikipedia.org/w/api.php", WD = "https://www.wikidata.org/w/api.php";
const strip = (v) => String(v?.value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const out = { file: fileTitle, person, other };
const fi = await get(`${COMMONS}?action=query&format=json&prop=imageinfo|categories|imageinfo&iiprop=url|user|timestamp|extmetadata|size&cllimit=max&titles=${encodeURIComponent(fileTitle)}`);
const page = Object.values(fi.query?.pages || {})[0] || {};
const ii = page.imageinfo?.[0] || {};
const md = ii.extmetadata || {};
out.commons = {
  title: page.title, uploader: ii.user, uploaded: ii.timestamp, size: [ii.width, ii.height],
  description: strip(md.ImageDescription), artist: strip(md.Artist), credit: strip(md.Credit), license: strip(md.LicenseShortName),
  categories: (page.categories || []).map((c) => c.title.replace(/^Category:/, "")),
  page: ii.descriptionurl,
};
const iu = await get(`${EN}?action=query&format=json&list=imageusage&iutitle=${encodeURIComponent(fileTitle)}&iulimit=50`);
out.en_wikipedia_uses = (iu.query?.imageusage || []).map((x) => x.title);
const gu = await get(`${COMMONS}?action=query&format=json&prop=globalusage&gulimit=50&titles=${encodeURIComponent(fileTitle)}`);
const gp = Object.values(gu.query?.pages || {})[0] || {};
out.global_uses = (gp.globalusage || []).map((x) => `${x.wiki}:${x.title}`);

out.people = {};
for (const name of [person, other].filter(Boolean)) {
  const s = await get(`${WD}?action=wbsearchentities&format=json&language=en&type=item&limit=5&search=${encodeURIComponent(name)}`);
  const hit = (s.search || []).find((h) => String(h.label || "").toLowerCase() === name.toLowerCase()) || (s.search || [])[0] || null;
  let p18 = null, desc = null;
  if (hit) {
    const e = await get(`${WD}?action=wbgetentities&format=json&props=claims|descriptions&ids=${hit.id}`);
    const ent = e.entities?.[hit.id] || {};
    desc = ent.descriptions?.en?.value || null;
    p18 = ent.claims?.P18?.[0]?.mainsnak?.datavalue?.value || null;
  }
  const wp = await get(`${EN}?action=query&format=json&prop=pageimages&piprop=name&titles=${encodeURIComponent(name)}&redirects=1`);
  const wpage = Object.values(wp.query?.pages || {})[0] || {};
  out.people[name] = { wikidata: hit ? hit.id : null, description: desc, wikidata_image: p18 ? `File:${p18}` : null, wikipedia_lead_image: wpage.pageimage || null };
}

const sameFile = (a, b) => a && b && a.replace(/^File:/, "").replace(/_/g, " ").toLowerCase() === b.replace(/^File:/, "").replace(/_/g, " ").toLowerCase();
const verdict = {};
for (const name of [person, other].filter(Boolean)) {
  const p = out.people[name];
  const tokens = name.toLowerCase().split(/\s+/);
  const titleNames = tokens.every((t) => String(fileTitle).toLowerCase().includes(t));
  const articleUses = out.en_wikipedia_uses.filter((t) => t.toLowerCase() === name.toLowerCase());
  const otherArticle = out.en_wikipedia_uses.filter((t) => other && t.toLowerCase() === other.toLowerCase());
  verdict[name] = {
    file_title_names_person: titleNames,
    used_on_own_article: articleUses.length > 0,
    used_on_other_persons_article: otherArticle.length > 0 && name !== other,
    wikidata_image_is_this_file: sameFile(p.wikidata_image, fileTitle),
    wikipedia_lead_is_this_file: sameFile(p.wikipedia_lead_image, fileTitle.replace(/^File:/, "")),
  };
}
out.verdict = verdict;
console.log(JSON.stringify(out, null, 2));
