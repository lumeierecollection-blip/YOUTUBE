#!/usr/bin/env node
/**
 * Entity pictures for an SX Short (owner, 19 Nov 2026: "we need to see the people... not just stock... create a system that does this,
 * not just for this video"). For every entity the spec lists (S.ENTITIES = [{ id, wiki: "<English Wikipedia title>", kind: "person" |
 * "org" | "place" }]) it takes the picture Wikidata itself attaches to that article's item: P18 (image) for people and places, P154 (logo)
 * for organisations. That is the person's own curated photo, not a keyword search (a Commons search for "Chris Olah" returned a railway
 * station). The file goes through the licence check in platform/production/commons.mjs; people are then cut out by cutout.py (prep step).
 * Output: output/sx/<slug>/entities.json { id: { name, kind, img, cut, credit } }; an entity with no free picture is recorded as missing
 * and the shot shows the name alone, never a stand-in face.
 * Usage: node platform/shorts-sx/entities.mjs <slug>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { commonsAsset } from "../production/commons.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../.."), slug = process.argv[2], S = await import(`./specs/${slug}.mjs`);
const DIR = join(ROOT, "src/skills/remotion-render/public/lf2/ai-tested"), OUT = join(ROOT, "output/sx", slug); mkdirSync(OUT, { recursive: true });
const attPath = join(DIR, "ATTRIBUTIONS.json"), att = existsSync(attPath) ? JSON.parse(readFileSync(attPath, "utf8")) : {};
const UA = { "User-Agent": "YouTubeAutomationPreview/1.0 (github actions)" };
const get = async (u) => { for (let a = 1; a <= 4; a++) { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(30000) }); if (r.ok) return r.json(); await new Promise((ok) => setTimeout(ok, a * 8000)); } throw new Error(`HTTP error for ${u}`); };

async function wikidataFile(title, prop) {
  const p = await get(`https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&redirects=1&format=json&titles=${encodeURIComponent(title)}`);
  const qid = Object.values(p.query.pages)[0]?.pageprops?.wikibase_item; if (!qid) return { qid: null, file: null };
  const c = await get(`https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&entity=${qid}&property=${prop}`);
  const v = c.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value; return { qid, file: v ? `File:${v}` : null };
}

const out = {};
for (const e of S.ENTITIES || []) {
  const id = `en-${e.id}`, name = e.name || (e.wiki || e.id).replace(/ \(.*\)$/, "");
  try {
    if (att[id] && existsSync(join(DIR, att[id].file))) { out[e.id] = { name, kind: e.kind, img: `lf2/ai-tested/${att[id].file}`, credit: att[id].credit_line }; console.log(e.id, "already here"); continue; }
    // e.file: an exact Commons file for someone with no Wikipedia article (Jack Clark, Anthropic co-founder: a CC0 photo titled with his name)
    const { qid, file } = e.file ? { qid: null, file: e.file } : e.wiki ? await wikidataFile(e.wiki, e.kind === "org" ? "P154" : "P18") : { qid: null, file: null };
    if (!file) { out[e.id] = { name, kind: e.kind, missing: `no ${e.kind === "org" ? "logo (P154)" : "image (P18)"} on Wikidata ${qid || "(no item)"}` }; console.log("MISSING", e.id, out[e.id].missing); continue; }
    const { file: f, entry } = await commonsAsset({ title: file, dir: DIR, id, claim: `${name} (Wikidata ${qid} ${e.kind === "org" ? "P154" : "P18"})`, role: "entity picture", minBytes: e.kind === "org" ? 400 : 8000 });
    att[id] = { ...entry, file: basename(f), credit_line: `${entry.author}, ${entry.licence}, via Wikimedia Commons`, authenticity: "authentic", wikidata: qid };
    writeFileSync(attPath, JSON.stringify(att, null, 1));
    out[e.id] = { name, kind: e.kind, img: `lf2/ai-tested/${basename(f)}`, credit: att[id].credit_line };
    console.log(e.id, "->", basename(f), "|", att[id].credit_line);
  } catch (err) { out[e.id] = { name, kind: e.kind, missing: String(err.message).slice(0, 120) }; console.log("FAILED", e.id, out[e.id].missing); }
  await new Promise((r) => setTimeout(r, 4000));
}
// people (and any asset the spec asks for) get a background-removed copy, made by the prep step's cutout.py run
const cuts = Object.entries(out).filter(([, v]) => v.kind === "person" && v.img).map(([, v]) => v.img).concat((S.CUTOUTS || []).map((id) => att[id] && `lf2/ai-tested/${att[id].file}`).filter(Boolean));
writeFileSync(join(OUT, "cutouts.txt"), cuts.map((p) => join("src/skills/remotion-render/public", p)).join("\n") + "\n");   // final newline: the shell `while read` loop skipped the last line without it (Altman, 19 Nov 2026)
writeFileSync(join(OUT, "entities.json"), JSON.stringify(out, null, 1));
console.log(`entities ${slug}: ${Object.values(out).filter((v) => v.img).length}/${Object.keys(out).length} with a picture; ${cuts.length} to cut out`);
