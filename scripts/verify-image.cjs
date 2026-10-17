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
 * Providers: vision-providers.cjs (Ollama by default). "No provider answered"
 * is retried twice, 15 s apart. Nothing is cached: every image is verified
 * each time it is used. An accepted image then gets a second, blind pass (see
 * blindCheck) that does not tell the model what the concept is.
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

// ── second pass: a BLIND description (owner's spec 2026-10-18, "stricter selection") ──
// The three questions above name the subject, and a small vision model leans toward
// "YES" when it is told what to expect. After they accept, the model is asked again
// WITHOUT the concept — "what is the main subject?" — and the answer must name the
// concept (shared word stem, else a text-model same-object check). A "yes, it's a
// piggy bank" that the blind pass calls "clay pot" is rejected; the caller then tries
// its next candidate, which is how the wrong image is swapped for the right one.
const STEM = (w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const STOPW = new Set(["the", "and", "with", "for", "from", "isolated", "of", "a", "an", "photo", "image", "picture", "on", "in", "white", "background"]);
const stems = (s) => new Set(String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOPW.has(w)).map(STEM));

const blindPrompt = () => `Look at the image. What is the single main subject? Name it in 2 to 5 words.
Describe only what is visible. Do not guess a brand or a purpose.

Return JSON only:
{
"subject": "..."
}`;
const normBlind = (a) => {
  if (!a || typeof a !== "object" || a.error) return null;
  const subject = String(a.subject || "").trim().slice(0, 120);
  return subject ? { subject } : null;
};

async function sameThing(subject, entity) {
  const a = stems(subject), b = stems(entity);
  for (const w of b) if (a.has(w)) return { same: true, how: "shared word" };
  try {
    const ollama = require("./ollama-client.cjs");
    const r = await ollama.callOllama([{ role: "user", content: `Two noun phrases: A = "${subject}", B = "${entity}".
Does A name the same kind of physical object as B (a synonym or a more specific kind of B counts; a related but different object does not)?
Return JSON only: {"same": true | false}` }], { maxTokens: 30, temperature: 0, capKind: "challenger" });
    if (r && typeof r.same === "boolean") return { same: r.same, how: "text model" };
  } catch { /* fall through */ }
  return { same: false, how: "no answer" };
}

async function blindCheck(png, entity) {
  const messages = [{ role: "user", content: [
    { type: "text", text: blindPrompt() },
    { type: "image_url", image_url: { url: await imageDataUrl(png) } },
  ] }];
  const r = await askProviders(messages, normBlind);
  if (!r.v) return { ok: false, subject: "", why: "blind pass: no vision provider answered" };
  const t = await sameThing(r.v.subject, entity);
  return { ok: t.same, subject: r.v.subject, why: t.same ? `blind pass saw "${r.v.subject}" (${t.how})` : `blind pass saw "${r.v.subject}", not "${entity}"` };
}

function promptFor({ scene, entity, type, logo = false, money = false }) {
  // Task 2.2 — a company/institution logo is verified with the owner's exact
  // three-answer identity prompt, not the generic image rubric.
  if (logo) {
    return `You are verifying a company logo.

Company: "${entity}"

Look at the image. Answer:

1. What company or brand does this logo represent?
2. Is it the logo of "${entity}" specifically?
   MATCH — this is the logo of the named company
   SIMILAR — this is the logo of a different company with a similar name
   DIFFERENT — this is not a logo, or is a different company entirely

Return JSON only:
{
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
      return { shows: "YES", kind: "LITERAL", quality: "CLEAN", seen: recognized, verdict, recognized };
    }
    const shows = up(a.shows), kind = up(a.kind), quality = up(a.quality), flat = money ? up(a.flat) : null;
    const seen = String(a.seen || "").trim().slice(0, 160);
    if (!["YES", "CLOSE", "NO"].includes(shows) || !["LITERAL", "FIGURATIVE", "META"].includes(kind) || !["CLEAN", "DIRTY"].includes(quality) || !seen) return null;
    if (money && !["FLAT", "ANGLED"].includes(flat)) return null;
    return { shows, kind, quality, flat, seen };
  };
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
  const out = { ...r.v, ...judge(r.v, money, logo), provider: r.provider };
  if (out.accept && !logo && process.env.VERIFY_BLIND !== "0") {
    const b = await blindCheck(png, opts.entity);
    out.blind = b.subject;
    if (!b.ok) return { ...out, accept: false, reason: b.why };
    out.reason = `${out.reason}; ${b.why}`;
  }
  return out;
}

/** A money object (G): bills, coins, cash — gets the flatness question. */
const MONEY_RE = /\b(dollar|bill|bills|banknote|bank note|note|notes|cash|currency|coin|coins|euro|pound|yen|rupee|peso|money)\b/i;
const isMoney = (name) => MONEY_RE.test(String(name || "").replace(/-/g, " ")) && !/\b(statement|card|receipt|wallet|jar|piggy)\b/i.test(String(name || ""));

module.exports = { verifyImage, promptFor, normalizer, judge, isMoney, blindCheck, sameThing };

if (require.main === module) {
  require("dotenv/config");
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
  verifyImage(arg("image"), { entity: arg("entity"), type: arg("type") || "object", scene: arg("scene"), logo: process.argv.includes("--logo"), money: process.argv.includes("--money") })
    .then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.accept ? 0 : 1); });
}
