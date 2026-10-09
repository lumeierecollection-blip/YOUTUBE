/**
 * entity-coverage — NOTHING SPOKEN GOES UNREPRESENTED (owner, 2026-10-09).
 *
 * "Every beat that names something gets a visual of that thing. A words-only beat is only allowed when the sentence
 * names no entity at all." The map, enforced here rather than left to taste:
 *
 *   country / region        its flag, or a map with THAT region highlighted
 *   city / place            a map with a pin, or a verified photo of it
 *   person                  a verified portrait, or a non-identifying person plate (never a name in type alone)
 *   year / date             a date card (a stated figure drawn alone), or a point on a timeline
 *   span of time            a time-scale graphic (a track with its ends)
 *   number / amount         a stat card or a chart that draws THAT figure
 *   organisation / outlet   its logo, a verified photo of it, or an organisation plate
 *   object                  its cutout or its drawn icon
 *
 * `entitiesOf` reads a beat's sentence (+ the planner's named entities); `coverageOf` reads what the beat DREW
 * (the manifest canvas); `checkEntityCoverage` fails every beat that names an entity and shows none of them.
 * A near-match does not count: "France" is not satisfied by a generic Europe map, only by France highlighted.
 * Where it stops: this is the MANIFEST's answer. scripts/gemini-frame-review.js --entity-check asks Gemini the same
 * question of the rendered frame, and the contact sheet is the last word.
 */
import { quantitiesOf, knownPlacesOf } from "./canvas-grounding.js";
import { resolveRegion } from "../src/skills/remotion-render/visual/geo-regions.js";

const MONTH = "(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)";
const DATE_RE = new RegExp(`\\b(?:${MONTH}\\.?\\s+(?:\\d{1,2}(?:st|nd|rd|th)?,?\\s+)?(?:1[89]|20)\\d{2}|${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\b|(?:1[89]|20)\\d{2})\\b`, "g");
const SPELLED = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|a few|several|many";
const SPAN_RE = new RegExp(`\\b(\\d[\\d,]*(?:\\.\\d+)?|${SPELLED})[-\\s]+(years?|months?|weeks?|days?|hours?|minutes?|decades?|centuries)\\b(?![-\\s]+old\\b)`, "gi");
const FROM_TO_RE = new RegExp(`\\b(?:from|between)\\s+((?:1[89]|20)\\d{2})\\s+(?:to|and|until|through|[-\\u2013])\\s+((?:1[89]|20)\\d{2})\\b`, "i");

const ORG = new Set(["organization", "company", "institution", "building", "outlet", "agency"]);
export const typeOf = (t) => { const x = String(t || "").toLowerCase(); return ORG.has(x) ? "organization" : x === "person" || x === "place" ? x : x; };
export const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\b(the|of|a|an|and)\b/g, " ").replace(/\s+/g, " ").trim();
/** Two names for one entity: equal, or one holds all the other's words ("Texas Rangers" ~ "the Texas Rangers"). */
export function sameName(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const tx = x.split(" "), ty = y.split(" ");
  const [small, big] = tx.length <= ty.length ? [tx, ty] : [ty, tx];
  return small.length >= 1 && small.every((w) => big.includes(w)) && small.join("").length >= 4;
}

/** The entities a beat's sentence names: [{ type, name, region? }] (person / organization / place / date / span / number). */
export function entitiesOf({ sentence = "", named_entities = [] } = {}) {
  const out = [];
  const push = (e) => { if (e.name && !out.some((o) => o.type === e.type && sameName(o.name, e.name))) out.push(e); };
  for (const e of Array.isArray(named_entities) ? named_entities : []) {
    const type = typeOf(e?.type);
    if (!["person", "place", "organization"].includes(type)) continue;
    push({ type, name: String(e.name).trim(), ...(type === "place" && resolveRegion(e.name) ? { region: resolveRegion(e.name) } : {}) });
  }
  for (const p of knownPlacesOf(sentence)) { const region = resolveRegion(p); if (region) push({ type: "place", name: p, region }); }
  const text = String(sentence || "");
  const spans = [...text.matchAll(SPAN_RE)].map((m) => ({ name: m[0].trim(), at: m.index, end: m.index + m[0].length }));
  const ft = text.match(FROM_TO_RE);
  if (ft) push({ type: "span", name: `${ft[1]}-${ft[2]}`, ends: [ft[1], ft[2]] });
  for (const s of spans) push({ type: "span", name: s.name });
  const inSpan = (i) => spans.some((s) => i >= s.at && i < s.end) || (ft && i >= ft.index && i < ft.index + ft[0].length);
  for (const m of text.matchAll(DATE_RE)) if (!inSpan(m.index)) push({ type: "date", name: m[0] });
  const dateAt = [...text.matchAll(DATE_RE)].map((m) => [m.index, m.index + m[0].length]);
  for (const q of quantitiesOf(text)) {
    const i = text.indexOf(q.value);
    if (i < 0 || inSpan(i) || dateAt.some(([a, b]) => i >= a && i < b)) continue;
    const v = q.value.trim();
    // A figure the sentence STATES, not a count word or an identifier: "J-1 visa", "1 powerful program", "Directive 26-12".
    if (/[A-Za-z]-$/.test(text.slice(Math.max(0, i - 2), i)) || /^\d{1,2}-\d/.test(text.slice(i))) continue;
    if (/^[\d,.]+[-\s]*(?:year|month|week|day|hour|minute)s?\b/i.test(text.slice(i))) continue;   // an age or a duration modifier is a span, not a figure
    if (!/[$€£%]|percent|thousand|million|billion|trillion|\b[kKmMbB]\b/i.test(v) && Number(v.replace(/[^\d.]/g, "")) < 10) continue;
    push({ type: "number", name: v });
  }
  return out;
}

/** The entity the sentence is ABOUT, when it names several: person > organization > place > span > date > number. */
const RANK = ["person", "organization", "place", "span", "date", "number"];
export const primaryOf = (ents, hint = null) => (hint && ents.find((e) => sameName(e.name, hint))) || [...ents].sort((a, b) => RANK.indexOf(a.type) - RANK.indexOf(b.type))[0] || null;

const digits = (s) => String(s || "").replace(/[^\d.]/g, "");
const flatData = (d) => JSON.stringify(d || {}).toLowerCase();

/** What the beat drew, from its manifest canvas: { kind, names[], regions[] } entries. */
export function drawnOf(c) {
  const out = [];
  if (!c) return out;
  if (c.photo) out.push({ kind: c.photo.kind === "person" || c.photo.view === "person" ? "portrait" : "photo", name: c.photo.entity, region: c.photo.region || null });
  for (const v of c.concept_visuals || []) out.push({ kind: v.logo ? "logo" : v.class === "symbol" ? "symbol" : v.class === "cutout" ? "cutout" : v.class || "visual", name: v.name });
  if (c.art?.kind === "plates" && Array.isArray(c.art.names)) for (const nm of c.art.names) out.push({ kind: "plate-organization", name: nm });
  else if (c.art) {
    const k = c.art.kind;
    out.push({ kind: k === "flag" ? "flag" : k === "span" ? "span" : k === "date" ? "figure" : k, name: c.art.name, region: c.art.region || null, ends: c.art.ends || null, text: c.art.text || c.art.name });
  }
  if (c.composition === "MAP-CENTERED" && c.data?.place) out.push({ kind: "map", name: c.data.place, region: resolveRegion(c.data.place) });
  if (["NUMBER-FULL", "NUMBER-STAT"].includes(c.composition) && c.data?.value) out.push({ kind: "figure", name: String(c.data.value), text: `${c.data.value} ${c.data.label || ""}` });
  if (c.composition === "DATA-FULL" || c.composition === "COMPARISON-SPLIT" || c.composition === "TIMELINE" || c.composition === "LIST-BUILD" || c.composition === "PROCESS-FULL") out.push({ kind: "chart", name: c.visual_type, data: flatData(c.data) });
  return out;
}

/** Is `e` shown by what the beat drew? { covered, by } — `by` names the visual that answers it. */
export function coverageOf(c, e) {
  const drawn = drawnOf(c);
  const hit = (d, why) => ({ covered: true, by: `${d.kind}${d.name ? ` "${d.name}"` : ""}${why ? ` (${why})` : ""}` });
  for (const d of drawn) {
    if (e.type === "place") {
      if (d.kind === "flag" && e.region && d.region === e.region) return hit(d, "flag");
      if (d.kind === "map" && e.region && d.region === e.region) return hit(d, "highlighted");
      if ((d.kind === "map" || d.kind === "photo") && !e.region && sameName(d.name, e.name)) return hit(d);
      if (d.kind === "photo" && e.region && sameName(d.name, e.name)) return hit(d);
    } else if (e.type === "person") {
      if ((d.kind === "portrait" || d.kind === "photo" || d.kind === "plate-person") && sameName(d.name, e.name)) return hit(d);
    } else if (e.type === "organization") {
      if (["logo", "photo", "plate-organization", "cutout"].includes(d.kind) && sameName(d.name, e.name)) return hit(d);
    } else if (e.type === "number") {
      const want = digits(e.name);
      if (want && (digits(d.text || "").includes(want) || (d.data && d.data.includes(want)))) return hit(d, "the figure");
    } else if (e.type === "date") {
      const y = (e.name.match(/(?:1[89]|20)\d{2}/) || [])[0];
      if (d.kind === "figure" && y && String(d.text).includes(y)) return hit(d, "date card");
      if (d.kind === "chart" && y && d.data && d.data.includes(y)) return hit(d, "timeline");
    } else if (e.type === "span") {
      if (d.kind === "span" && (sameName(d.name, e.name) || (e.ends && d.ends && e.ends.every((x) => d.ends.includes(x))))) return hit(d, "time scale");
      if (d.kind === "chart" && e.ends && e.ends.every((x) => d.data && d.data.includes(x))) return hit(d, "timeline");
    }
  }
  // An object the sentence names: any cutout / icon whose name shares a word with the entity.
  return { covered: false, by: null };
}

/** Is the beat words only: typography with no picture, figure, photo, map, logo, plate or icon? */
export function wordsOnly(c) {
  if (!c) return true;
  if (drawnOf(c).length) return false;
  return true;
}

/**
 * The gate. `beats`: [{ index, sentence, named_entities, canvas }] (a render manifest's beats, or a resolved plan's).
 * Returns { failures: [{ beat, sentence, entities, why }], rows, wordsOnlyBeats }.
 */
export function checkEntityCoverage(beats) {
  const failures = [], rows = [];
  beats.forEach((b, i) => {
    const c = b.canvas || {};
    const ents = entitiesOf({ sentence: b.sentence ?? c.sentence ?? b.narration ?? "", named_entities: b.named_entities ?? c.named_entities ?? c.entities ?? [] });
    const hint = c.photo?.entity || c.data?.entity || null;
    const primary = primaryOf(ents, hint);
    if (!ents.length) { rows.push({ beat: i, entities: [], covered: null, note: wordsOnly(c) ? "words only — names nothing" : "names nothing" }); return; }
    const results = ents.map((e) => ({ e, ...coverageOf(c, e) }));
    const ok = results.some((r) => r.covered);
    rows.push({ beat: i, entities: ents.map((e) => `${e.type}:${e.name}`), primary: primary ? `${primary.type}:${primary.name}` : null, covered: ok, by: results.find((r) => r.covered)?.by || null });
    if (!ok) failures.push({ beat: i, sentence: String(b.sentence ?? c.sentence ?? b.narration ?? "").slice(0, 120), entities: ents.map((e) => `${e.type} "${e.name}"`), why: wordsOnly(c) ? "words only, but the sentence names an entity" : `draws ${drawnOf(c).map((d) => d.kind).join(" + ")}, none of it the entity` });
  });
  return { failures, rows, wordsOnlyBeats: rows.filter((r) => r.note?.startsWith("words only")).length };
}

// node scripts/entity-coverage.js <resolved-plan.json | render-manifest.json>
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const { readFileSync } = await import("node:fs");
  const j = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const r = checkEntityCoverage(j.beats || []);
  for (const row of r.rows) console.log(`beat ${row.beat}: ${row.entities.length ? `${row.entities.join(" | ")} -> ${row.covered ? `OK by ${row.by}` : "NOT COVERED"}` : row.note}`);
  console.log(`${r.failures.length} beat(s) name an entity and show none of it${r.failures.length ? ":" : ""}`);
  for (const f of r.failures) console.log(`  beat ${f.beat}: ${f.entities.join(", ")} — ${f.why} — "${f.sentence}"`);
  process.exit(r.failures.length ? 1 : 0);
}
