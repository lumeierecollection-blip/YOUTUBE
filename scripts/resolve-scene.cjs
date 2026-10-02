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
const { verifyPlaceImage } = require("./verify-place-image.cjs");

const UA = "YOUTUBE-pipeline/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; scene resolver)";
const runMemo = new Map();   // per process: `${type}:${name}` -> Promise<result>

const say = (tag, lines) => console.log(`[resolve] ${tag}\n${lines.map((l) => `    → ${l}`).join("\n")}`);

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
  return { ok: true, kind: "person", photo: { asset: r.asset, entity: name, kind: "person", view: "person", w, h, credit: r.credit, source: r.source || "wikipedia", source_url: r.source_url, license: r.license } };
}

// ── place / building / organization ───────────────────────────────────
async function resolvePlaceScene(tag, type, name, context) {
  const lines = [];
  const ex = E.expandName(type, name);
  if (ex.refuse) { lines.push(ex.refuse, `rendering as TYPE with the name only`); say(tag, lines); return { ok: false, kind: type, why: ex.refuse }; }
  const q = ex.name;
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
    return sizeOf(join(E.PUBLIC, rel)).then(({ w, h }) => ({ ok: true, kind: type, photo: { asset: rel, entity: name, kind: type, view, w, h, source: src, seen: v.seen, ...extra } }));
  };
  // 1-3: Wikipedia summary, Wikipedia search / page photos, Wikimedia Commons.
  const { candidates, tried } = await E.entityCandidates(type, q, context);
  const why = tried.find((t) => t.startsWith("wikipedia summary"));
  if (!candidates.some((c) => c.source === "wikipedia summary")) lines.push(`wikipedia summary, no usable image${why ? ` (${why.replace(/^wikipedia summary: /, "")})` : ""}`);
  if (candidates.length) lines.push(`wikipedia / wikimedia commons, ${candidates.length} candidate(s)`);
  for (const [i, c] of candidates.entries()) {
    const bad = await E.downloadTo(c.info, tmp);
    if (bad) { lines.push(`candidate ${i + 1} (${c.source}) REJECTED: ${bad}`); continue; }
    const v = await verifyPlaceImage(tmp, q);
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
      const v = await verifyPlaceImage(tmp, q);
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

/** Resolve one named entity of a beat. Memoized per run (the same entity in two beats is fetched and verified once). */
async function resolveSceneEntity({ channel, beatIndex, entity, context = "" }) {
  const type = String(entity?.type || "").toLowerCase(), name = String(entity?.name || "").trim();
  const tag = `ch-${channel} beat ${beatIndex}: entity ${type} "${name}"`;
  if (!name || !["person", "place", "building", "organization"].includes(type)) return { ok: false, kind: type, why: "not a real-world entity type" };
  const key = `${type}:${name.toLowerCase()}`;
  if (runMemo.has(key)) {
    const r = await runMemo.get(key);
    console.log(`[resolve] ${tag}\n    → ${r.ok ? `already resolved and verified this run (${r.photo.asset})` : "already failed this run, rendering as TYPE with name only"}`);
    return r;
  }
  const job = type === "person" ? resolvePersonScene(tag, name, context) : resolvePlaceScene(tag, type, name, context);
  runMemo.set(key, job);
  return job;
}

// ── task 2.2: names the scene_description mentions ────────────────────
const KIND_WORDS = [
  ["person", /\b(born|politician|economist|businessman|businesswoman|executive|chief executive|ceo|chair(man|woman|person)?|governor|president|prime minister|minister|secretary|senator|judge|justice|lawyer|attorney|journalist|actor|actress|singer|footballer|cricketer|player|writer|author|scientist|activist|banker|investor|entrepreneur|official|diplomat|general|commander)\b/i],
  ["building", /\b(building|courthouse|tower|skyscraper|headquarters|stadium|cathedral|church|mosque|temple|museum|palace|bridge|station|airport|hotel|hospital|prison|castle|capitol|house|hall|arena|factory|plant|refinery|dam)\b/i],
  ["place", /\b(city|town|country|state|province|region|county|capital|island|village|district|neighbou?rhood|municipality|territory|metropolitan|borough|port)\b/i],
  ["organization", /\b(company|corporation|agency|organi[sz]ation|bank|institution|court|department|ministry|bureau|commission|council|party|university|regulator|authority|federal reserve|central bank|banking|union|association|fund|board)\b/i],
];
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
    const kind = await kindOf(n);
    if (!kind) { log(`[resolve] beat ${beat.index}: "${n}" (from scene_description) — Wikipedia does not say what it is, skipped`); continue; }
    list.push({ type: kind, name: n, from: "scene_description" });
    known.push(low);
    log(`[resolve] beat ${beat.index}: added ${kind} "${n}" from scene_description (the sentence names it)`);
  }
  return list;
}

module.exports = { resolveSceneEntity, sceneEntities, properNames, kindOf, _resetRunMemo: () => runMemo.clear() };

if (require.main === module) {
  require("dotenv/config");
  const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : null; };
  resolveSceneEntity({ channel: arg("channel") || "0", beatIndex: arg("beat") || "0", entity: { type: arg("type"), name: arg("name") }, context: arg("context") || "" })
    .then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.ok ? 0 : 1); });
}
