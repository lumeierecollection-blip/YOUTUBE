#!/usr/bin/env node
/**
 * resolve-scene.cjs — a beat's scene, sourced (owner's scene-resolver spec,
 * 2026-10-02). The planner describes the picture (scene_description) and
 * lists what the sentence names (named_entities); this decides where each
 * named thing comes from and checks it before it is used.
 *
 *   sceneEntities({ beat, sentence })            -> [{ type, name, from }]
 *   resolveSceneEntity({ channel, beatIndex, entity, context })
 *     -> { ok: true, kind, photo: { asset, entity, kind, view, w, h, credit, source, source_url, license } }
 *      | { ok: false, kind, why }
 *
 * Source order (task 2.3):
 *   person        Wikipedia summary lead image -> Wikipedia search -> Commons
 *                 portraits, each through the identity check
 *                 (entity-assets.cjs resolvePerson / verify-person-image.cjs).
 *                 NEVER Pixabay.
 *   place         Wikipedia summary -> Wikipedia search / page photos ->
 *   building      Commons -> Pixabay (photos tagged with every name token),
 *                 each through verify-place-image.cjs (MATCH only).
 *   organization  Wikipedia -> Commons (a photo of ITS building), MATCH only.
 *                 Not Pixabay: the spec's last step for an organization, "a
 *                 photo of the organization's building type", is a generic
 *                 photo standing in for a named entity, which CLAUDE.md and
 *                 the same spec's "never substitute a generic photo" forbid.
 *   object        the cutout path (fetch-cutout-once.cjs), resolved by the
 *                 caller's concept block — not here.
 *   number        drawn natively — not fetched.
 * Nothing found and verified -> ok:false: the caller draws the beat as type
 * with the entity's name, never a stand-in.
 *
 * Task 2.2 — a proper name the scene_description mentions but
 * named_entities missed is added ONLY when the beat's SENTENCE names it too
 * (CLAUDE.md: nothing the narration does not say), and only when its
 * Wikipedia summary says what kind of thing it is (person / building / place /
 * organization); otherwise it is skipped and logged.
 *
 * Where this stops: the verdicts are vision models' readings, not ground
 * truth; the entity type of an added name comes from Wikipedia's one-line
 * description and a word list.
 */
"use strict";
const { mkdirSync, renameSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const E = require("./entity-assets.cjs");
const Wikidata = require("./lib/wikidata.cjs");
const { verifyPlaceImage } = require("./verify-place-image.cjs");
const { verifyImage } = require("./verify-image.cjs");

const UA = "YOUTUBE-pipeline/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; scene resolver)";
const runMemo = new Map();   // per process: `${type}:${name}` -> Promise<result>
// A month, a year, a quarter or a weekday — a date, never a place / building / organization.
const DATE_RE = /^(?:(?:early|mid|late)[- ])?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|q[1-4]|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b[\s\d,]*$|^(?:19|20)\d{2}s?$/i;

const say = (tag, lines) => console.log(`[resolve] ${tag}\n${lines.map((l) => `    → ${l}`).join("\n")}`);

// ── accumulation fallbacks (Task 2, Change A) ───────────────────────────
// capability-manifest.js declares accumulation.requires = [block, stack,
// document, silhouette], so a beat whose capability list is "accumulation" asks
// for assets nothing in the public sources will ever have. Two beats in a row
// (ch-2 beat 9, ch-44 beat 5) logged "accumulation requires silhouette/stack"
// and had nothing to draw. These are the bundled stand-ins, so the beat renders
// something honest instead of falling back to a bare TYPE card:
//   silhouette -> public/silhouettes/generic.png  (a plain black figure)
//   document   -> public/documents/generic.png   (a plain page)
//   stack      -> NOT fetched: the caller draws a horizontal bar chart from the
//                 sentence's own numbers (see stackToBarChart), because a pile of
//                 invented rectangles would assert a quantity the narration never
//                 states.
const FALLBACK_ASSETS = Object.freeze({
  silhouette: "silhouettes/generic.png",
  document: "documents/generic.png",
  block: "documents/generic.png",
});

/** The bundled stand-in for `kind`, or null when there is none (stack). */
async function fallbackAsset(kind, channel, beatIndex) {
  // OFF (owner, 2026-10-10: "a sample photo presented as the real thing fails"): the bundled generic silhouette / document is a sample, not a
  // fetched image of the thing the sentence names. A failed fetch now falls to an honest typographic treatment (the name in type, a
  // plate) — never to a stand-in picture. scripts/local-audit.cjs `image-sources` refuses any of these files on screen.
  console.log(`[resolve] ch-${channel} beat ${beatIndex}: no verified source image for "${kind}" — no stand-in; the beat is set in type`);
  return null;
  // eslint-disable-next-line no-unreachable
  const rel = FALLBACK_ASSETS[String(kind || "").toLowerCase()];
  if (!rel) return null;
  const abs = join(E.PUBLIC, rel);
  if (!require("node:fs").existsSync(abs)) {
    console.log(`[resolve] fallback ${kind}: bundled asset missing at ${rel}`);
    return null;
  }
  const { w, h } = await sizeOf(abs);
  console.log(`[resolve] ch-${channel} beat ${beatIndex}: fallback ${kind} -> ${rel} (${w}x${h}), no verified source image`);
  return { ok: true, kind: "fallback", fallback: kind, photo: { asset: rel, entity: kind, kind: "fallback", view: "cutout", w, h, source: "bundled", source_url: null, license: "CC0 (drawn in-repo)" } };
}

/**
 * A `stack` is not fetched. The accumulation claim is arithmetic — many small
 * amounts becoming one total — so the honest drawing is a bar chart of the
 * sentence's own figures. Returns a BAR visual_type when the sentence grounds
 * two or more numbers, else null.
 */
function stackToBarChart(sentence) {
  const { quantitiesOf } = require("./canvas-grounding.js");
  const qs = quantitiesOf(String(sentence || "")).slice(0, 4);
  if (qs.length < 2) return null;
  const bars = qs.map((q) => ({
    label: String(q.label || "").replace(/[$\d.,%]+/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 3).join(" ") || "item",
    value: String(q.value),
  }));
  return { visual_type: "BAR", data: { bars } };
}

async function sizeOf(abs) {
  try { const m = await require("sharp")(abs).metadata(); return { w: m.width || null, h: m.height || null }; } catch { return { w: null, h: null }; }
}

// ── person: the existing verified path ────────────────────────────────
async function resolvePersonScene(tag, name, context) {
  const lines = [];
  const r = await E.resolveEntity({ type: "person", name, context });
  if (!r.ok) {
    lines.push(`${(r.attempts || []).slice(0, 4).join(" ; ") || r.why}`, `no verified portrait — rendering as TYPE with the name only`);
    say(tag, lines);
    return { ok: false, kind: "person", why: r.why };
  }
  const { w, h } = await sizeOf(join(E.PUBLIC, r.asset));
  lines.push(`${r.source || "wikipedia"}${r.cached ? " (cached, re-verified)" : ""}, image found (${r.file_title || r.asset})`, `verified MATCH${r.verified_by ? ` (${r.verified_by})` : ""}`, `rendering as portrait, middle zone`);
  say(tag, lines);
  return { ok: true, kind: "person", photo: { asset: r.asset, entity: name, kind: "person", view: "person", w, h, credit: r.credit, source: r.source || "wikipedia", source_url: r.source_url, license: r.license, verified_as: r.page_title ? `${r.page_title}${r.description ? ` (${r.description})` : ""}` : null } };
}

// ── place / building / organization ───────────────────────────────────
async function resolvePlaceScene(tag, type, name, context) {
  const lines = [];
  const ex = E.expandName(type, name);
  // An acronym with no unambiguous expansion is not a name anything can be looked up by
  // ("AI", "ED" — CI run 37074911159): refused, and no name card is made of it.
  if (ex.refuse) { lines.push(ex.refuse, `not a resolvable name — no photo, no name card`); say(tag, lines); return { ok: false, kind: type, why: ex.refuse, refused: true }; }
  const q = ex.name;
  // The verifier is told WHAT the entity is (its Wikipedia description): asked only "Does this
  // image show G7?", it passed the headquarters of "G7 AGRI JAPAN CO., LTD." for the Group of
  // Seven (CI run 37088913234 ch-9). A namesake is now a different thing: WRONG.
  const desc = await describe(q);
  const vq = desc ? `${q} (${desc})` : q;
  if (desc) lines.push(`verifying as "${vq}"`);
  if (ex.note) lines.push(ex.note);
  const dir = E.DIR[type] || "orgs";
  const rel = `entities/${dir}/${E.slug(name)}.jpg`;
  const tmp = join(E.PUBLIC, "entities", dir, `.candidate-${E.slug(name)}.jpg`);
  mkdirSync(join(E.PUBLIC, "entities", dir), { recursive: true });
  const view = type === "place" ? "scene" : "building";
  const done = (src, info, v, extra = {}) => {
    renameSync(tmp, join(E.PUBLIC, rel));
    lines.push(`rendering as ${type === "place" ? "SCENE-FULL" : "ARCHITECTURE"}, full-bleed`);
    say(tag, lines);
    return sizeOf(join(E.PUBLIC, rel)).then(({ w, h }) => ({ ok: true, kind: type, photo: { asset: rel, entity: name, kind: type, view, w, h, source: src, seen: v.seen, verified_as: vq, ...extra } }));
  };
  // 1-3: Wikipedia summary, Wikipedia search / page photos, Wikimedia Commons.
  const { candidates, tried } = await E.entityCandidates(type, q, context);
  const why = tried.find((t) => t.startsWith("wikipedia summary"));
  if (!candidates.some((c) => c.source === "wikipedia summary")) lines.push(`wikipedia summary, no usable image${why ? ` (${why.replace(/^wikipedia summary: /, "")})` : ""}`);
  if (candidates.length) lines.push(`wikipedia / wikimedia commons, ${candidates.length} candidate(s)`);
  for (const [i, c] of candidates.entries()) {
    const bad = await E.downloadTo(c.info, tmp);
    if (bad) { lines.push(`candidate ${i + 1} (${c.source}) REJECTED: ${bad}`); continue; }
    const v = await verifyPlaceImage(tmp, vq);
    if (v.verdict === "MATCH") {
      lines.push(`candidate ${i + 1} (${c.source}: ${c.info.title}) verified MATCH (${v.seen})`);
      const artist = (c.info.artist || "").slice(0, 80);
      return done(c.source, c.info, v, { credit: `Photo: ${artist ? `${artist} / ` : ""}Wikimedia Commons, ${c.info.license}`, source_url: c.info.descurl || c.info.url, license: c.info.license });
    }
    lines.push(`candidate ${i + 1} (${c.source}: ${c.info.title}) REJECTED: ${v.verdict === "NONE" ? "verifier unavailable" : v.verdict} (${v.seen})`);
    rmSync(tmp, { force: true });
  }
  // 4: Pixabay — places and buildings only, photos tagged with every token of the name, verified the same way.
  if (type === "place" || type === "building") {
    const { pixabay, wordsOf } = require("./fetch-cutout-once.cjs");
    const want = wordsOf(q);
    const r = await pixabay(q, (m) => lines.push(`pixabay: ${m}`));
    const hits = (r.hits || []).filter((h) => { const tags = new Set(wordsOf(h.tags)); return want.length && want.every((w) => tags.has(w)) && Math.min(h.imageWidth || 0, h.imageHeight || 0) >= 900; }).slice(0, 3);
    lines.push(`pixabay, ${hits.length} candidate(s)${r.why ? ` (${r.why})` : ""}`);
    for (const [i, h] of hits.entries()) {
      try {
        const res = await fetch(h.largeImageURL || h.webformatURL, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30000) });
        if (!res.ok) { lines.push(`pixabay candidate ${i + 1} REJECTED: download HTTP ${res.status}`); continue; }
        await require("sharp")(Buffer.from(await res.arrayBuffer())).rotate().resize({ width: 1400, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toFile(tmp);
      } catch (e) { lines.push(`pixabay candidate ${i + 1} REJECTED: ${e.message}`); continue; }
      const v = await verifyPlaceImage(tmp, vq);
      if (v.verdict === "MATCH") {
        lines.push(`pixabay candidate ${i + 1} verified MATCH (${v.seen})`);
        return done("pixabay", null, v, { credit: `Photo: ${h.user ? `${h.user} / ` : ""}Pixabay`, source_url: h.pageURL, license: "Pixabay Content License" });
      }
      lines.push(`pixabay candidate ${i + 1} REJECTED: ${v.verdict === "NONE" ? "verifier unavailable" : v.verdict} (${v.seen}) ${h.pageURL}`);
      rmSync(tmp, { force: true });
    }
  }
  lines.push(`"${name}" not found in any source, rendering as TYPE with name only`);
  say(tag, lines);
  return { ok: false, kind: type, why: "no verified photo" };
}

// ── company / institution (owner's spec 2026-10-03, part B) ──────────
// Source order: the Wikipedia article's infobox logo, then its lead image ->
// Wikimedia Commons "<name> logo" (seal / mark for a standards body) ->
// Commons / the article's photos of its headquarters (a trade show: its hall
// or floor) -> nothing: a name card. Never Pixabay for a named organization's
// logo. A logo must be FREE on Commons (a non-free, fair-use logo hosted only
// on English Wikipedia is not used). An SVG is converted to a 1024 px PNG with
// its transparency (part F) and saved beside the live cutouts; every logo is
// verified with the three questions (verify-image.cjs, logo: true) when
// fetched AND when reused.
const LOGO_WORDS = /\b(logo|logotype|wordmark|seal|emblem|insignia|mark|badge|crest)\b/i;
async function infoboxLogo(title) {
  const j = await E.getJson(`https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=wikitext&section=0&redirects=1&page=${encodeURIComponent(title)}`);
  const w = j?.parse?.wikitext?.["*"] || "";
  const m = w.match(/\|\s*(?:logo|image_logo|logo_image|seal|image_seal|logo_file)\s*=\s*(?:\[\[)?\s*(?:File:|Image:)?\s*([^|\]\n{}<]+?\.(?:svg|png|jpe?g|gif))/i);
  return m ? m[1].trim() : null;
}
async function wikiSummary(name) {
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, "_"))}?redirect=true`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const s = await r.json();
    return s.type === "disambiguation" ? null : s;
  } catch { return null; }
}
// A Commons file -> a transparent PNG at public/cutouts-live/<channel>/<beat>-<slug>-logo.png.
async function logoPng(info, channel, beatIndex, name) {
  const dir = join(E.PUBLIC, "cutouts-live", String(channel));
  mkdirSync(dir, { recursive: true });
  const file = `${beatIndex}-${E.slug(name)}-logo.png`;
  const abs = join(dir, file);
  const svg = /svg/i.test(info.mime || "") || /\.svg$/i.test(info.title || "");
  const res = await fetch(svg ? info.url : (info.thumb || info.url), { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const sharp = require("sharp");
  // SVG: rasterised at a density that gives >= 1024 px across, transparent background kept.
  const img = svg ? sharp(buf, { density: 300 }) : sharp(buf);
  await img.resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: !svg }).ensureAlpha().png().toFile(abs);
  const m = await sharp(abs).metadata();
  return { asset: `cutouts-live/${channel}/${file}`, abs, w: m.width, h: m.height, svg };
}
// An all-caps company / institution name is often the name itself, not an abbreviation of
// one: "POSCO", "DGIST" were refused as acronyms (CI run 37114977307 ch-48) and lost their
// logos. Such a name (3+ letters) is looked up when Wikipedia has an article for it — not a
// disambiguation page — whose description says it IS a company / institution. "AI" (2
// letters; the article is "artificial intelligence") stays refused. The logo verifier still
// decides what renders.
async function brandName(type, name, ex) {
  const bare = String(name || "").trim().replace(/^the\s+/i, "").replace(/\./g, "");
  if (!/^[A-Z&]{3,6}$/.test(bare)) return ex;
  const s = await wikiSummary(bare);
  if (!s) return ex;
  const text = `${s.description || ""} ${String(s.extract || "").split(/\.\s/)[0]}`;
  const kinds = KIND_WORDS.filter(([k]) => k === "company" || k === "institution");
  const hit = kinds.find(([, re]) => re.test(text));
  if (!hit) return { refuse: `${ex.refuse}; Wikipedia's "${s.title}" is not described as a company or institution ("${String(s.description || "").slice(0, 60)}")` };
  return { name: s.title, note: `"${bare}" is the ${hit[0]} Wikipedia calls "${s.title}" (${String(s.description || "").slice(0, 80)})` };
}
async function resolveOrgScene(tag, type, name, context, channel, beatIndex, scene) {
  const lines = [];
  let ex = E.expandName("organization", name);
  if (ex.refuse) ex = await brandName(type, name, ex);
  if (ex.refuse) { lines.push(ex.refuse, `not a resolvable name — no logo, no name card`); say(tag, lines); return { ok: false, kind: type, why: ex.refuse, refused: true }; }
  const q = ex.name;
  if (ex.note) lines.push(ex.note);
  const nt = E.tokens(q);
  const logos = [], seenFiles = new Set();
  const addLogo = (fileTitle, source) => { const t = fileTitle.startsWith("File:") ? fileTitle : `File:${fileTitle}`; if (!seenFiles.has(t)) { seenFiles.add(t); logos.push({ title: t, source }); } };
  // 1. Wikipedia: the infobox logo, then the article's lead image (often the logo itself).
  const s = await wikiSummary(q);
  if (s) {
    const lf = await infoboxLogo(s.title);
    if (lf) addLogo(lf, "wikipedia infobox");
    if (s.originalimage?.source) {
      const lead = E.fileNameOf(s.originalimage.source);
      if (LOGO_WORDS.test(lead.replace(/[_-]/g, " ")) || /\.(svg|png)$/i.test(lead)) addLogo(lead, "wikipedia lead image");
    }
    if (!logos.length) lines.push(`wikipedia "${s.title}", no logo in the infobox`);
  } else lines.push(`wikipedia, no article for "${q}"`);
  // 1b. Wikidata: the item's own logo / seal (P154, P8972, P158, P94), matched exactly on label or alias (scripts/lib/wikidata.cjs). A Commons
  // file like every other candidate: the licence check, conversion and verifier below judge it.
  try {
    const wd = await Wikidata.find(q, { type: "organization", getJson: E.getJson }) || (q !== name ? await Wikidata.find(name, { type: "organization", getJson: E.getJson }) : null);
    if (wd) { for (const f of wd.logos) addLogo(f, `wikidata ${wd.id}`); lines.push(`wikidata ${wd.id} "${wd.label}" (${wd.matched}${wd.description ? `: ${wd.description.slice(0, 50)}` : ""}): ${wd.logos.length} logo file(s)`); }
    else lines.push(`wikidata: no exact item with a logo for "${q}"`);
  } catch (e) { lines.push(`wikidata unavailable (${e.message})`); }
  // 2. Commons: "<name> logo" (a standards body's seal / mark too).
  for (const suffix of type === "institution" ? [" logo", " seal"] : [" logo"]) {
    const cj = await E.getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=10&srsearch=${encodeURIComponent(`"${q}"${suffix}`)}`);
    for (const h of cj?.query?.search || []) {
      const ft = E.tokens(h.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""));
      if (nt.every((t) => ft.includes(t)) && LOGO_WORDS.test(h.title.replace(/[_-]/g, " "))) addLogo(h.title, "wikimedia commons");
    }
  }
  if (logos.length) lines.push(`${logos.length} logo candidate(s): ${logos.map((l) => l.source).join(", ")}`);
  for (const [i, l] of logos.slice(0, 8).entries()) {
    const info = await E.fileInfo(l.title);
    if (!info) { lines.push(`logo ${i + 1} (${l.source}) REJECTED: not on Wikimedia Commons (a non-free logo is not used)`); continue; }
    if (/non-?free|fair use/i.test(info.license || "") || !info.license) { lines.push(`logo ${i + 1} (${l.source}) REJECTED: licence "${info.license || "none"}" is not free`); continue; }
    let png;
    try { png = await logoPng(info, channel, beatIndex, q); } catch (e) { lines.push(`logo ${i + 1} (${l.source}) REJECTED: ${e.message}`); continue; }
    // Task 6.1 — every fetched image passes through rembg so the render never
    // shows a white box behind the logo. A failed quality gate rejects the
    // candidate and tries the next.
    {
      const { removeBackground } = require("./rembg-process.cjs");
      const rembgOut = png.abs.replace(/\.png$/i, "-rembg.png");
      const rb = await removeBackground(png.abs, rembgOut);
      if (!rb.ok) {
        lines.push(`logo ${i + 1} (${l.source}) REJECTED: rembg ${rb.reason}`);
        rmSync(png.abs, { force: true }); rmSync(rembgOut, { force: true }); continue;
      }
      try { require("node:fs").renameSync(rembgOut, png.abs); } catch { png.abs = rembgOut; }
    }
    const v = await verifyImage(png.abs, { entity: q, type: `${type} logo`, scene, logo: true });
    if (!v.accept) {
      lines.push(`logo ${i + 1} (${l.source}: ${info.title}${png.svg ? ", SVG -> PNG" : ""}) REJECTED (${v.reason}, saw "${v.seen}")`);
      console.log(`[logo] ch-${channel} beat ${beatIndex} "${q}": candidate ${i + 1} rejected (${v.reason}, saw "${v.seen}")`);
      rmSync(png.abs, { force: true });
      continue;
    }
    lines.push(`logo ${i + 1} (${l.source}: ${info.title}${png.svg ? ", SVG -> PNG" : ""}) verified (${v.reason})`, `rendering as cutout, middle zone`);
    console.log(`[logo] ch-${channel} beat ${beatIndex} "${q}": candidate ${i + 1} accepted (${v.reason}, saw "${v.seen}")`);
    say(tag, lines);
    return { ok: true, kind: type, logo: { name: q, asset: png.asset, abs: png.abs, w: png.w, h: png.h, source: l.source, source_url: info.descurl || info.url, license: info.license, seen: v.seen } };
  }
  // 3. A photo of its headquarters (a trade show: its hall / floor), as for a building.
  const r = await resolvePlaceScene(`${tag} (photo)`, "organization", name, context);
  // The "photo" the verifier passed IS the organisation's logo / emblem / seal: Wikipedia's lead
  // image for "Soran University" is its logo (a .jpg, so the file-name test above missed it),
  // and it was drawn full-bleed as a building (CI run 37126933290 ch-44 beat 1; the review
  // called it irrelevant stock imagery). It is shown as what it is — the logo hero, upright,
  // with its source credit — never as a full-bleed building photo.
  if (r.ok && /\b(logo|emblem|seal|crest|coat of arms|wordmark|insignia)\b/i.test(String(r.photo?.seen || ""))) {
    // The same licence rule as every logo above: a non-free (fair-use) logo is not used.
    if (/non-?free|fair use/i.test(r.photo.license || "") || !r.photo.license) {
      lines.push(`the verified photo is the ${type}'s logo, but its licence "${r.photo.license || "none"}" is not free — rendering as name card`);
      say(tag, lines);
      return { ok: false, kind: type, why: "the only image is a non-free logo" };
    }
    try {
      const sharp = require("sharp");
      const dir = join(E.PUBLIC, "cutouts-live", String(channel));
      mkdirSync(dir, { recursive: true });
      const file = `${beatIndex}-${E.slug(q)}-logo.png`, abs = join(dir, file);
      await sharp(join(E.PUBLIC, r.photo.asset)).trim({ threshold: 18 }).resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).ensureAlpha().png().toFile(abs);
      const m = await sharp(abs).metadata();
      lines.push(`the verified photo is the ${type}'s logo ("${r.photo.seen}") — rendering as the logo hero, not a full-bleed photo`);
      say(tag, lines);
      return { ok: true, kind: type, logo: { name: q, asset: `cutouts-live/${channel}/${file}`, abs, w: m.width, h: m.height, source: r.photo.source || "wikipedia", source_url: r.photo.source_url || null, license: r.photo.license || null, seen: r.photo.seen } };
    } catch (e) { lines.push(`logo conversion failed (${e.message}) — rendering as name card`); say(tag, lines); return { ok: false, kind: type, why: "logo conversion failed" }; }
  }
  if (r.ok) return { ...r, kind: type };
  lines.push(`no verified logo or photo — rendering as name card`);
  say(tag, lines);
  return { ok: false, kind: type, why: "no verified logo or photo" };
}

// ── is the Wikipedia subject the person the sentence talks about? ─────
// A portrait verified MATCH for a NAME can still be the wrong person: "A twenty-two-year-old
// man named David Rivera just pleaded guilty to a crypto heist" got the congressman David
// Rivera's official portrait (CI run 37114977307 ch-26 beat 2, beat check "wrong-person").
// The face verifier only knows the name; this compares the sentence with what Wikipedia says
// the page is about. Only SAME keeps the portrait; DIFFERENT, UNSURE, a malformed answer or
// no answer -> name card (fail closed: a name card is never the wrong face).
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// "a man named X", "a 22-year-old called X": the script introduces the person by name, so
// they are not someone a general reader already knows — not the namesake Wikipedia covers.
const introducedByName = (name, sentence) =>
  new RegExp(`\\b(?:named|called|identified as|who goes by)\\s+${escRe(name)}\\b`, "i").test(sentence);
function samePersonPrompt(name, sentence, about) {
  return `Sentence from a news script: "${sentence}"\n` +
    `Wikipedia article "${about.title}": ${about.description || "(no description)"}. ${String(about.extract || "").slice(0, 500)}\n` +
    `Is the ${name} in the sentence the same person the Wikipedia article is about, not a namesake? ` +
    `Answer SAME, DIFFERENT, or UNSURE. Reply as JSON: {"verdict":"SAME|DIFFERENT|UNSURE","why":"<one short clause>"}`;
}
function normalizeSame(a) {
  const v = String(a?.verdict || "").trim().toUpperCase();
  return ["SAME", "DIFFERENT", "UNSURE"].includes(v) ? { verdict: v, why: String(a?.why || "").slice(0, 160) } : null;
}
const sameMemo = new Map();
async function samePerson(name, sentence, r) {
  if (!sentence) return { verdict: "SAME", why: "no sentence to compare" };
  if (introducedByName(name, sentence)) return { verdict: "DIFFERENT", why: `the sentence introduces "${name}" by name (a private individual, not the Wikipedia subject)` };
  const k = `${name}\u0000${sentence}`;
  if (!sameMemo.has(k)) sameMemo.set(k, (async () => {
    const s = await wikiSummary(r.page_title || name);
    if (!s) return { verdict: "UNSURE", why: "no Wikipedia summary to compare against" };
    const about = { title: s.title, description: s.description || r.description || "", extract: s.extract || "" };
    const { askProviders } = require("./verify-cutout-image.cjs");
    const a = await askProviders([{ role: "user", content: samePersonPrompt(name, sentence, about) }], normalizeSame);
    return a.v ? { ...a.v, provider: a.provider, about: `${about.title}: ${about.description}` }
      : { verdict: "UNSURE", why: `no provider answered (${a.tried.join("; ").slice(0, 160)})` };
  })());
  return sameMemo.get(k);
}

// ── is the photographed place the place the SCRIPT talks about? ───────
// The place verifier checks the image against the Wikipedia article it was found under; nothing
// checked that article against the script. CI run 37766249863 ch-26 beat 5 drew Alexandria,
// EGYPT for Alexandria, Virginia (Layer 3 and the reviser saw it; every gate passed it). Same
// shape as samePerson: the sentence AND the script's other place words vs what Wikipedia says
// the page is. Only SAME keeps the photo; DIFFERENT / UNSURE / no answer -> no photo (the beat
// falls down the ladder). The verdict rides on the photo (place_check) for the pre-ship gate.
function samePlacePrompt(name, sentence, script, about) {
  return `Sentence from a news script: "${sentence}"\n` +
    `The whole script, for where it is set: "${String(script || "").slice(0, 1500)}"\n` +
    `Wikipedia article "${about.title}": ${about.description || "(no description)"}. ${String(about.extract || "").slice(0, 500)}\n` +
    `Is "${name}" in the sentence the same real-world place (same city / region / country the script is about) as the Wikipedia article — not a namesake somewhere else? ` +
    `Answer SAME, DIFFERENT, or UNSURE. Reply as JSON: {"verdict":"SAME|DIFFERENT|UNSURE","why":"<one short clause>"}`;
}
const samePlaceMemo = new Map();
async function samePlace(name, sentence, script, r) {
  const k = `${name}\u0000${sentence}\u0000${String(script || "").slice(0, 300)}`;
  if (!samePlaceMemo.has(k)) samePlaceMemo.set(k, (async () => {
    const title = String(r.photo?.verified_as || "").replace(/\s*\(.*\)\s*$/, "") || name;
    const s = await wikiSummary(title);
    if (!s) return { verdict: "UNSURE", why: "no Wikipedia summary to compare against" };
    const about = { title: s.title, description: s.description || "", extract: s.extract || "" };
    const { askProviders } = require("./verify-cutout-image.cjs");
    const a = await askProviders([{ role: "user", content: samePlacePrompt(name, sentence, script, about) }], normalizeSame);
    return a.v ? { ...a.v, provider: a.provider, about: `${about.title}: ${about.description}` }
      : { verdict: "UNSURE", why: `no provider answered (${a.tried.join("; ").slice(0, 160)})` };
  })());
  return samePlaceMemo.get(k);
}

/** Resolve one named entity of a beat. Memoized per run (the same entity in two beats is fetched and verified once). */
async function resolveSceneEntity(args) {
  const r = await resolveSceneEntityRaw(args);
  // Every PHOTO of a place / building / organisation's building is checked against the script
  // (a logo is the organisation's own mark, not a place; a person has samePerson).
  if (!r?.ok || !r.photo || r.logo || String(args.entity?.type || "").toLowerCase() === "person") return r;
  const name = String(args.entity?.name || "").replace(/\s*\([^)]*\)/g, "").trim();
  const same = await samePlace(name, args.sentence || "", args.script || "", r);
  console.log(`[resolve] ch-${args.channel} beat ${args.beatIndex}: same place as the script? ${same.verdict}${same.provider ? ` (${same.provider})` : ""}: ${same.why}${same.about ? ` [${same.about}]` : ""}${same.verdict === "SAME" ? "" : " — photo dropped, the beat falls down the ladder"}`);
  if (same.verdict !== "SAME") return { ok: false, kind: r.kind, why: `not confirmed as the script's place: ${same.verdict} — ${same.why}` };
  return { ...r, photo: { ...r.photo, place_check: { verdict: same.verdict, why: same.why, about: same.about || null } } };
}
async function resolveSceneEntityRaw({ channel, beatIndex, entity, context = "", scene = null, sentence = "" }) {
  // "Ontario Landlord and Tenant Board (LTB)": a bracketed acronym is not part of the name
  // any source files it under (CI run 37067332714 ch-2: every lookup missed).
  const type = String(entity?.type || "").toLowerCase(), name = String(entity?.name || "").replace(/\s*\([^)]*\)/g, "").trim();
  const tag = `ch-${channel} beat ${beatIndex}: entity ${type} "${name}"`;
  // Task 2 Change A: an asset-kind request (silhouette / document / block / stack)
  // is not a real-world entity — there is nothing to look it up. It is answered
  // from the bundled stand-ins, or, for a stack, converted to a bar chart.
  const kind = String(entity?.type || entity?.kind || "").toLowerCase();
  if (["silhouette", "document", "block", "stack"].includes(kind)) {
    if (kind === "stack") {
      const bar = stackToBarChart(sentence);
      if (bar) {
        console.log(`[resolve] ch-${channel} beat ${beatIndex}: stack not fetched — converted to a horizontal bar chart of the sentence's own numbers ${JSON.stringify(bar.data.bars)}`);
        return { ok: false, kind: "stack", why: "stack drawn as a bar chart of the sentence's numbers", converted: bar };
      }
      console.log(`[resolve] ch-${channel} beat ${beatIndex}: stack not fetched and the sentence names fewer than two figures — no image`);
      return { ok: false, kind: "stack", why: "no figures to chart" };
    }
    const fb = await fallbackAsset(kind, channel, beatIndex);
    return fb || { ok: false, kind, why: `no bundled fallback for ${kind}` };
  }
  if (!name || !["person", "place", "building", "organization", "company", "institution"].includes(type)) return { ok: false, kind: type, why: "not a real-world entity type" };
  // A real-world entity is a PROPER name: "field office" (typed as a building by the planner)
  // was resolved to a Taiwanese "MJIB Penghu County Field Office" and verified MATCH as "a
  // field office" (CI run 37110620556 ch-2 beat 2) — a generic photo for a common noun.
  if (!/\p{Lu}/u.test(name)) {
    console.log(`[resolve] ${tag}\n    → "${name}" is not a proper name (no capital letter) — not looked up, no name card`);
    return { ok: false, kind: type, why: "not a proper name", refused: true };
  }
  // A date is not a place or an organization ("September 2026" typed as a place — CI run
  // 37079127196 ch-44): refused, no lookup, no name card.
  if (DATE_RE.test(name)) {
    console.log(`[resolve] ${tag}\n    → a date, not a ${type} — no photo, no name card`);
    return { ok: false, kind: type, why: "a date, not an entity", refused: true };
  }
  const key = `${type}:${name.toLowerCase()}`;
  if (runMemo.has(key)) {
    const r = await runMemo.get(key);
    // A logo PNG is verified again before it is reused (part F.2).
    if (r.ok && r.logo) {
      const v = await verifyImage(r.logo.abs, { entity: r.logo.name, type: `${type} logo`, scene, logo: true });
      console.log(`[resolve] ${tag}\n    → reuse of ${r.logo.asset} ${v.accept ? `ACCEPTED (${v.reason})` : `REJECTED (${v.reason}, saw "${v.seen}") — rendering as name card`}`);
      return v.accept ? r : { ok: false, kind: type, why: `reused logo rejected: ${v.reason}` };
    }
    console.log(`[resolve] ${tag}\n    → ${r.ok ? `already resolved and verified this run (${r.photo.asset})` : "already failed this run, rendering as TYPE with name only"}`);
    return r;
  }
  if (type === "person") {
    // The portrait is memoized per name; whether it is the sentence's person is per sentence.
    if (!runMemo.has(key)) runMemo.set(key, resolvePersonScene(tag, name, context));
    const r = await runMemo.get(key);
    if (!r.ok) return r;
    const same = await samePerson(name, sentence, r);
    console.log(`[resolve] ${tag}\n    → same person as the sentence? ${same.verdict}${same.provider ? ` (${same.provider})` : ""}: ${same.why}${same.about ? ` [${same.about}]` : ""}${same.verdict === "SAME" ? "" : " — portrait dropped, rendering as name card"}`);
    return same.verdict === "SAME" ? r : { ok: false, kind: "person", why: `namesake: ${same.why}` };
  }
  const job = type === "company" || type === "institution" ? resolveOrgScene(tag, type, name, context, channel, beatIndex, scene)
    : resolvePlaceScene(tag, type, name, context);
  runMemo.set(key, job);
  return job;
}

// ── task 2.2: names the scene_description mentions ────────────────────
const KIND_WORDS = [
  ["person", /\b(born|politician|economist|businessman|businesswoman|executive|chief executive|ceo|chair(man|woman|person)?|governor|president|prime minister|minister|secretary|senator|judge|justice|lawyer|attorney|journalist|actor|actress|singer|footballer|cricketer|player|writer|author|scientist|activist|banker|investor|entrepreneur|official|diplomat|general|commander)\b/i],
  ["building", /\b(building|courthouse|tower|skyscraper|headquarters|stadium|cathedral|church|mosque|temple|museum|palace|bridge|station|airport|hotel|hospital|prison|castle|capitol|house|hall|arena|factory|plant|refinery|dam)\b/i],
  // Not a bare "state": "Safety" is "the state of being protected" (CI run 37079127196 ch-48).
  ["place", /\b(city|town|country|(?:u\.s\.|us|federal|sovereign) state|province|region|county|capital|island|village|district|neighbou?rhood|municipality|territory|metropolitan|borough|port)\b/i],
  // part B: an institution (agency, court, standards body, trade fair, international body) before a company.
  ["institution", /\b(agency|organi[sz]ation|institution|institute|college|academy|court|department|ministry|bureau|commission|council|party|university|regulator|regulatory|authority|federal reserve|central bank|banking system|union|association|fund|board|standards body|standards organization|trade fair|trade show|exhibition|forum)\b/i],
  ["company", /\b(company|corporation|manufacturer|multinational|conglomerate|firm|brand|startup|bank|retailer|automaker|carmaker|steelmaker|chipmaker|airline|insurer|exchange|maker of|developer of|provider of)\b/i],
];
// The one-line Wikipedia description of a name ("Intergovernmental political forum"), or null.
async function describe(name) {
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, "_"))}?redirect=true`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const s = await r.json();
    return s.type === "disambiguation" ? null : (String(s.description || "").trim().slice(0, 120) || null);
  } catch { return null; }
}
async function kindOf(name) {
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, "_"))}?redirect=true`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const s = await r.json();
    if (s.type === "disambiguation") return null;
    const text = `${s.description || ""}`;
    for (const [k, re] of KIND_WORDS) if (re.test(text)) return k;
    return null;
  } catch { return null; }
}
// Capitalized runs ("Miami Federal Courthouse", "Jerome Powell"), "of"/"the"/"de" allowed inside.
function properNames(text) {
  const out = [];
  const re = /\b([A-Z][\p{L}.'-]+(?:\s+(?:of|the|de|del|da|von|van|and|for)?\s*[A-Z][\p{L}.'-]+)*)/gu;
  for (const m of String(text || "").matchAll(re)) {
    const s = m[1].trim();
    if (s.split(/\s+/).length === 1 && /^(A|An|The|This|That|These|Those|It|Its|In|On|At|With|Over|Under|Behind|Large|Small|Bold|Close|Exterior|Interior|Portrait|Photo|Kinetic|Word|Words|Numbers?|Chart|Map)$/.test(s)) continue;
    out.push(s.replace(/^(The|A|An)\s+/, ""));
  }
  return [...new Set(out)];
}
/**
 * The beat's entities: named_entities as the planner gave them (already checked against the
 * sentence by gemini-visual-plan.js), plus names the scene_description mentions that the
 * sentence also names and Wikipedia can type. `entityNamedInSentence` is the planner's own check.
 */
async function sceneEntities({ beat, sentence, entityNamedInSentence, log = console.log }) {
  const list = (Array.isArray(beat.named_entities) ? beat.named_entities : []).map((e) => ({ type: e.type, name: e.name, from: "planner" }));
  const known = list.map((e) => e.name.toLowerCase());
  for (const n of properNames(beat.scene_description)) {
    const low = n.toLowerCase();
    if (known.some((k) => k.includes(low) || low.includes(k))) continue;
    if (!entityNamedInSentence(n, sentence)) continue;
    // A proper name: capitalized in the SENTENCE too, somewhere other than its first word
    // ("Safety at risk" names nothing — CI run 37079127196 ch-48 made a "Safety" name card).
    const at = String(sentence || "").indexOf(n);
    if (at <= 0 || !/[A-Z]/.test(n[0])) { log(`[resolve] beat ${beat.index}: "${n}" (from scene_description) — not a proper name in the sentence, skipped`); continue; }
    const kind = await kindOf(n);
    if (!kind) { log(`[resolve] beat ${beat.index}: "${n}" (from scene_description) — Wikipedia does not say what it is, skipped`); continue; }
    list.push({ type: kind, name: n, from: "scene_description" });
    known.push(low);
    log(`[resolve] beat ${beat.index}: added ${kind} "${n}" from scene_description (the sentence names it)`);
  }
  return list;
}

module.exports = { wikiSummary, resolveSceneEntity, sceneEntities, properNames, kindOf, introducedByName, samePersonPrompt, normalizeSame, fallbackAsset, stackToBarChart, FALLBACK_ASSETS, _resetRunMemo: () => { runMemo.clear(); sameMemo.clear(); } };

if (require.main === module) {
  require("dotenv/config");
  const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : null; };
  resolveSceneEntity({ channel: arg("channel") || "0", beatIndex: arg("beat") || "0", entity: { type: arg("type"), name: arg("name") }, context: arg("context") || "" })
    .then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.ok ? 0 : 1); });
}
