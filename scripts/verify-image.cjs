#!/usr/bin/env node
/**
 * verify-image.cjs — the three-question verifier for every fetched PNG (a
 * cutout, a logo, a money image) — owner's spec 2026-10-03, part E.
 *
 *   verifyImage(png, { scene, entity, type, logo, money })
 *     -> { accept, shows, kind, quality, flat, seen, provider, reason }
 *
 * The owner's prompt, verbatim (E.1), with two additions:
 *   - logo: true adds ONE line telling the model that the logo artwork IS the
 *     literal subject. Without it, the owner's question 2 classes every logo as
 *     FIGURATIVE ("a drawing, diagram, or symbol") and no logo could pass.
 *   - money: true adds the owner's flatness question (G.3): FLAT | ANGLED.
 * Accepted only when (E.2): shows === "YES" AND kind === "LITERAL" AND
 * quality === "CLEAN" (AND flat === "FLAT" for money). Anything else — CLOSE,
 * NO, FIGURATIVE, META, DIRTY, ANGLED, a malformed answer, no provider — is a
 * rejection with its reason; the caller tries the next candidate.
 *
 * Providers: verify-cutout-image.cjs askProviders (Groq vision -> Gemini
 * flash-lite -> Ollama qwen2.5vl:3b). "No provider answered" is retried twice,
 * 15 s apart. Nothing is cached: every image is verified each time it is used.
 *
 * Portraits of named people keep verify-person-image.cjs (identity + a
 * visible face), and full-bleed place / building photos keep
 * verify-place-image.cjs (MATCH only).
 *
 * Where this stops: one vision model's reading of one image.
 */
"use strict";
const { existsSync } = require("node:fs");
const { askProviders, imageDataUrl } = require("./verify-cutout-image.cjs");

function promptFor({ scene, entity, type, logo = false, money = false }) {
  // Task 2.2 — a company/institution logo is verified with the owner's exact
  // three-answer identity prompt, not the generic image rubric.
  if (logo) {
    return `You are verifying a company logo.

Company: "${entity}"

Look at the image. Answer:

1. Copy the words written on the logo, exactly as printed (Latin letters only; empty if it has none).
2. What company or brand does this logo represent? Go by what it SAYS, not by the name above.
3. Is it the logo of "${entity}" specifically?
   MATCH — this is the logo of the named company
   SIMILAR — this is the logo of a different company with a similar name
   DIFFERENT — this is not a logo, or is a different company entirely
   A seal or emblem whose words name a different place, district, branch or body (a "District of Columbia" court seal for a Florida court) is DIFFERENT.

Return JSON only:
{
  "text": "...",
  "recognized": "...",
  "verdict": "MATCH" | "SIMILAR" | "DIFFERENT"
}`;
  }
  return `You are verifying an image against what the sentence needs.

What the beat needs: "${String(scene || `${entity}`).slice(0, 400)}"
The specific subject: "${entity}" (type: ${type})
Look at the image and answer:

1. Does this image show the subject named?
   YES — the image shows the exact entity or object
   CLOSE — related but not the exact thing
   NO — different thing entirely

2. Is the image literal or figurative?
   LITERAL — a real photo of the thing
   FIGURATIVE — a drawing, diagram, or symbol
   META — a visual metaphor (a shield for "protection")

3. Is the image clean?
   CLEAN — no watermark, no visible crop edge, no
   background bleed, no torn alpha edge, no JPEG
   artifacts around the subject
   DIRTY — has any of those defects
${money ? `
4. Is the bill or coin centered, flat, and fully visible
   (no edges cut off)?
   FLAT — centered, flat, all edges visible
   ANGLED — perspective, folded, or partially cut off
` : ""}
Return JSON only:
{
  "shows": "YES" | "CLOSE" | "NO",
  "kind": "LITERAL" | "FIGURATIVE" | "META",
  "quality": "CLEAN" | "DIRTY",${money ? `\n  "flat": "FLAT" | "ANGLED",` : ""}
  "seen": "short phrase describing the image"
}`;
}

const up = (v) => String(v || "").toUpperCase().trim();
function normalizer(money, logo = false) {
  return (a) => {
    if (!a || typeof a !== "object" || a.error) return null;
    // Logo identity verdict (Task 2.2): accept MATCH only.
    if (logo) {
      const verdict = up(a.verdict);
      const recognized = String(a.recognized || "").trim().slice(0, 160);
      if (!["MATCH", "SIMILAR", "DIFFERENT"].includes(verdict) || !recognized) return null;
      return { shows: "YES", kind: "LITERAL", quality: "CLEAN", seen: recognized, verdict, recognized, text: String(a.text || "").trim().slice(0, 200) };
    }
    const shows = up(a.shows), kind = up(a.kind), quality = up(a.quality), flat = money ? up(a.flat) : null;
    const seen = String(a.seen || "").trim().slice(0, 160);
    if (!["YES", "CLOSE", "NO"].includes(shows) || !["LITERAL", "FIGURATIVE", "META"].includes(kind) || !["CLEAN", "DIRTY"].includes(quality) || !seen) return null;
    if (money && !["FLAT", "ANGLED"].includes(flat)) return null;
    return { shows, kind, quality, flat, seen };
  };
}
/**
 * Does the logo's own printed text name something else? Board 39031532519 ch-26: the Wikipedia file for the "U.S. District Court for the Southern
 * District of Florida" was the DISTRICT OF COLUMBIA court's seal, and the model, handed the name, answered MATCH. So the words printed on the logo are
 * checked here too: when they carry distinguishing words (not "united states district court"), at least one must be a distinguishing word of the
 * entity, or the text must spell its initials ("T.P.L.F" for the Tigray People's Liberation Front). A logo with no Latin text is not judged here.
 */
const LOGO_GENERIC = new Set("united states the for and of de la del des court courts district department ministry office bureau agency national federal state government official seal emblem inc llc ltd corp corporation company group holdings international university college school institute association society council committee commission board authority republic kingdom party front foundation bank city county est established since".split(" "));
const logoWords = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3);
function logoTextContradicts(text, entity) {
  const said = logoWords(text).filter((w) => !LOGO_GENERIC.has(w));
  const own = logoWords(entity).filter((w) => !LOGO_GENERIC.has(w));
  if (!said.length || !own.length) return null;
  const initials = String(entity || "").split(/[\s-]+/).filter((w) => /^[A-Za-z]/.test(w) && !/^(of|the|for|and|de|la)$/i.test(w)).map((w) => w[0].toUpperCase()).join("");
  if (initials.length >= 2 && String(text).toUpperCase().replace(/[^A-Z]/g, "").includes(initials)) return null;
  const close = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));
  return said.some((w) => own.some((o) => close(w, o))) ? null : `the logo reads "${String(text).slice(0, 80)}", which names none of "${entity}"`;
}

/** The owner's rule (E.2, G.3): YES and LITERAL and CLEAN (and FLAT for money). */
function judge(v, money, logo = false) {
  if (logo) {
    const accept = v.verdict === "MATCH";
    return { accept, reason: accept ? "MATCH" : `${v.verdict} (saw "${v.recognized}")` };
  }
  const why = [];
  if (v.shows !== "YES") why.push(`shows=${v.shows}`);
  if (v.kind !== "LITERAL") why.push(`kind=${v.kind}`);
  if (v.quality !== "CLEAN") why.push(`quality=${v.quality}`);
  if (money && v.flat !== "FLAT") why.push(`flat=${v.flat}`);
  return { accept: why.length === 0, reason: why.join(", ") || "YES, LITERAL, CLEAN" + (money ? ", FLAT" : "") };
}

async function verifyImage(png, opts = {}) {
  const money = !!opts.money;
  const logo = !!opts.logo;
  if (!existsSync(png)) return { accept: false, reason: `no image at ${png}`, seen: "" };
  const messages = [{ role: "user", content: [
    { type: "text", text: promptFor({ ...opts, type: opts.type || "object" }) },
    { type: "image_url", image_url: { url: await imageDataUrl(png) } },
  ] }];
  const norm = normalizer(money, logo);
  let r = await askProviders(messages, norm);
  for (let k = 0; k < 2 && !r.v; k++) { await new Promise((res) => setTimeout(res, 15000)); r = await askProviders(messages, norm); }
  if (!r.v) return { accept: false, reason: "no vision provider answered", seen: "", provider: null, unavailable: true };
  const verdict = { ...r.v, ...judge(r.v, money, logo), provider: r.provider };
  const wrongText = logo && verdict.accept ? logoTextContradicts(r.v.text, opts.entity) : null;
  return wrongText ? { ...verdict, accept: false, reason: wrongText } : verdict;
}

/** A money object (G): bills, coins, cash — gets the flatness question. */
const MONEY_RE = /\b(dollar|bill|bills|banknote|bank note|note|notes|cash|currency|coin|coins|euro|pound|yen|rupee|peso|money)\b/i;
const isMoney = (name) => MONEY_RE.test(String(name || "").replace(/-/g, " ")) && !/\b(statement|card|receipt|wallet|jar|piggy)\b/i.test(String(name || ""));

module.exports = { verifyImage, promptFor, normalizer, judge, isMoney, logoTextContradicts };

if (require.main === module) {
  require("dotenv/config");
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
  verifyImage(arg("image"), { entity: arg("entity"), type: arg("type") || "object", scene: arg("scene"), logo: process.argv.includes("--logo"), money: process.argv.includes("--money") })
    .then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.accept ? 0 : 1); });
}
