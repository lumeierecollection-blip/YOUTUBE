#!/usr/bin/env node
/**
 * verify-person-image.cjs — does this photo show the named person, as the
 * subject of the frame? (owner's rule, 2026-09-30: "a named person in the
 * script must be shown as that person or not shown at all".)
 *
 *   verifyPersonImage(imagePath, personName, { sourceUrl })
 *     -> { verdict: "match" | "reject", reason, has_face, identity, framing,
 *          face_fraction, text_overlay, provider, cached }
 *
 * A vision model answers the owner's three questions (has_face / identity /
 * framing) plus two more for the candidate rules: how much of the image the
 * face covers, and whether there is a watermark or text overlay. The image
 * is used ONLY if
 *     has_face === true AND identity === "MATCH" AND framing === "PORTRAIT"
 *     AND face_fraction >= PERSON_MIN_FACE_FRACTION (default 0.15)
 *     AND text_overlay === false
 * Anything else is a reject: UNSURE, NO_MATCH, SCENE, GROUP, no face, a
 * malformed answer, and "no provider answered" all reject — an unverified
 * photo never reaches the render.
 *
 * Providers, cheapest first: Groq $GROQ_VISION_MODEL (qwen/qwen3.8-27b) ->
 * Gemini gemini-3.5-flash-lite -> Ollama $OLLAMA_VISION_MODEL (qwen2.5vl:3b).
 * A provider that errors or answers malformed JSON falls to the next.
 *
 * Cache: src/skills/remotion-render/public/entities/verified.json, keyed by
 * the person's slug. The entry holds the latest ACCEPTED photo's verdict
 * (verified_at, source_url, provider, verdict, framing) and, under
 * `rejected`, every rejected source URL with its verdict — so a rejected
 * candidate is not re-sent on the next run. A cached verdict is reused only
 * for the same source URL and for 30 days.
 *
 * Where this stops (stated plainly):
 *   - identity is the model's recognition of a public figure's face, not a
 *     biometric match; a small model can be wrong. The frame reviewer checks
 *     the rendered frame again (scripts/gemini-frame-review.js wrong-person).
 *   - face_fraction is the model's estimate, not a face detector's box: no
 *     face detector is installed in this repo or in CI. A tight 15% rule will
 *     reject some head-and-shoulders portraits whose face covers ~10%; the
 *     threshold is PERSON_MIN_FACE_FRACTION.
 *
 * CLI: node scripts/verify-person-image.cjs --image path.jpg --name "Jerome Powell" [--url https://...]
 */
"use strict";
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join, dirname } = require("node:path");

const ROOT = join(__dirname, "..");
const CACHE = join(ROOT, "src", "skills", "remotion-render", "public", "entities", "verified.json");
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;
const MIN_FACE = () => Number(process.env.PERSON_MIN_FACE_FRACTION || 0.15);

const slug = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);

function loadCache() { try { return JSON.parse(readFileSync(CACHE, "utf8")); } catch { return {}; } }
function saveCache(c) { mkdirSync(dirname(CACHE), { recursive: true }); writeFileSync(CACHE, JSON.stringify(c, null, 2) + "\n"); }

function promptFor(name) {
  return `You are verifying a stock photo against a named person.

Person: ${name}

Look at the image. Answer three questions:

1. Is there a visible human face in this image?
   YES or NO.

2. Is the person named "${name}" recognizable?
   Match this face against your knowledge of the public
   figure with that name.
   MATCH, NO_MATCH, or UNSURE.

3. Is this image a portrait — meaning the person is the
   primary subject of the frame?
   PORTRAIT, SCENE, or GROUP.

Two more, for the image rules:

4. What fraction of the whole image area does the largest face cover
   (forehead to chin, ear to ear)? A number from 0 to 1.

5. Does the image carry a watermark, a logo overlay, a caption or any other
   text drawn over the photograph? true or false.

Return JSON only:
{
  "has_face": true | false,
  "identity": "MATCH" | "NO_MATCH" | "UNSURE",
  "framing": "PORTRAIT" | "SCENE" | "GROUP",
  "face_fraction": 0.0,
  "text_overlay": true | false
}`;
}

// A well-formed answer, normalized; null when the model did not answer the questions.
function normalize(a) {
  if (!a || typeof a !== "object" || a.error) return null;
  const has = a.has_face === true || String(a.has_face).toUpperCase() === "YES" || a.has_face === "true";
  const hasNo = a.has_face === false || String(a.has_face).toUpperCase() === "NO" || a.has_face === "false";
  const identity = String(a.identity || "").toUpperCase().replace(/[\s-]/g, "_");
  const framing = String(a.framing || "").toUpperCase();
  if (!(has || hasNo) || !["MATCH", "NO_MATCH", "UNSURE"].includes(identity) || !["PORTRAIT", "SCENE", "GROUP"].includes(framing)) return null;
  const ff = Number(a.face_fraction);
  return {
    has_face: has, identity, framing,
    face_fraction: Number.isFinite(ff) ? Math.max(0, Math.min(1, ff)) : null,
    text_overlay: a.text_overlay === true || String(a.text_overlay).toLowerCase() === "true",
  };
}

/** The verdict rule. Returns null for a pass, else the rejection reason. */
function rejectReason(v) {
  if (!v.has_face) return "no visible face";
  if (v.identity !== "MATCH") return v.identity;                     // NO_MATCH / UNSURE
  if (v.framing !== "PORTRAIT") return v.framing;                    // SCENE / GROUP
  if (v.face_fraction == null) return "face size not reported";
  if (v.face_fraction < MIN_FACE()) return `face covers ${(v.face_fraction * 100).toFixed(0)}% of the image (< ${(MIN_FACE() * 100).toFixed(0)}%)`;
  if (v.text_overlay) return "watermark / text overlay";
  return null;
}

async function imageDataUrl(imagePath) {
  let buf = readFileSync(imagePath);
  try {
    const sharp = require("sharp");
    buf = await sharp(buf).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  } catch { /* send the original bytes */ }
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

async function askProviders(messages) {
  const tried = [];
  // Google first (owner's 2026-10-08 brief): Gemini across every key, then every sibling
  // model (src/lib/gemini-client.js), before any other provider. This was Groq first.
  // 1. Gemini flash-lite (maxTokens 1024: a sibling reasoning model spends from the same budget).
  try {
    const { callGemini } = await import("../src/lib/gemini-client.js");
    const g = await callGemini(messages, { model: "gemini-3.5-flash-lite", maxTokens: 1024, temperature: 0, noCache: true, tag: "verify" });
    const v = normalize(g);
    if (v) return { provider: "gemini", v, tried };
    tried.push(`gemini: ${g?.error ? `${g.error} ${String(g.detail || "").slice(0, 100)}` : "malformed answer"}`);
  } catch (e) { tried.push(`gemini: ${e.message}`); }
  // 2. Groq (vision model).
  try {
    const groq = require("./groq-client.cjs");
    const g = await groq.callGroq(messages, { maxTokens: 300, temperature: 0 });
    const v = normalize(g);
    if (v) return { provider: "groq", v, tried };
    tried.push(`groq: ${g?.error ? `${g.error} ${String(g.detail || "").slice(0, 100)}` : "malformed answer"}`);
  } catch (e) { tried.push(`groq: ${e.message}`); }
  // 3. Ollama (local vision model).
  try {
    const ollama = require("./ollama-client.cjs");
    const o = await ollama.callOllama(messages, { maxTokens: 300, temperature: 0 });
    const v = normalize(o);
    if (v) return { provider: "ollama", v, tried };
    tried.push(`ollama: ${o?.error ? `${o.error} ${String(o.detail || "").slice(0, 100)}` : "malformed answer"}`);
  } catch (e) { tried.push(`ollama: ${e.message}`); }
  return { provider: null, v: null, tried };
}

async function verifyPersonImage(imagePath, personName, { sourceUrl = null, useCache = true } = {}) {
  const key = slug(personName);
  const cache = loadCache();
  const entry = cache[key] || {};
  const fresh = (e) => e && e.verified_at && Date.now() - Date.parse(e.verified_at) < MAX_AGE_MS;
  if (useCache && sourceUrl) {
    if (entry.source_url === sourceUrl && entry.verdict === "MATCH" && fresh(entry)) {
      console.log(`[verify] ${personName}: cached ${entry.provider}, verdict=MATCH`);
      return { verdict: "match", reason: null, identity: "MATCH", framing: entry.framing, provider: entry.provider, cached: true };
    }
    const rej = entry.rejected?.[sourceUrl];
    if (fresh(rej)) {
      console.log(`[verify] ${personName}: cached ${rej.provider}, verdict=${rej.verdict} (rejected)`);
      return { verdict: "reject", reason: rej.reason || rej.verdict, identity: rej.verdict, framing: rej.framing, provider: rej.provider, cached: true };
    }
  }
  if (!existsSync(imagePath)) return { verdict: "reject", reason: `no image at ${imagePath}`, provider: null, cached: false };
  const messages = [{ role: "user", content: [
    { type: "text", text: promptFor(personName) },
    { type: "image_url", image_url: { url: await imageDataUrl(imagePath) } },
  ] }];
  const { provider, v, tried } = await askProviders(messages);
  if (!v) {
    console.log(`[verify] ${personName}: no provider answered — rejected (${tried.join(" | ")})`);
    return { verdict: "reject", reason: "no vision provider answered", provider: null, cached: false };
  }
  const why = rejectReason(v);
  console.log(`[verify] ${personName}: ${provider}, verdict=${v.identity}, framing=${v.framing}, face=${v.face_fraction == null ? "?" : `${(v.face_fraction * 100).toFixed(0)}%`}${v.text_overlay ? ", text overlay" : ""}${why ? ` -> reject (${why})` : " -> MATCH"}`);
  // Task 3.3 — [person] rejection logging in the spec format.
  if (why) console.log(`[person] ${personName}: rejected (${why}, framing=${v.framing}, identity=${v.identity})`);
  else console.log(`[person] ${personName}: accepted (MATCH, framing=${v.framing}, face=${v.face_fraction == null ? "?" : `${(v.face_fraction * 100).toFixed(0)}%`})`);
  if (sourceUrl) {
    const now = new Date().toISOString();
    const next = { ...entry, rejected: { ...(entry.rejected || {}) } };
    if (!why) Object.assign(next, { verified_at: now, source_url: sourceUrl, provider, verdict: "MATCH", framing: v.framing });
    else next.rejected[sourceUrl] = { verified_at: now, provider, verdict: v.identity, framing: v.framing, reason: why };
    cache[key] = next;
    saveCache(cache);
  }
  return { verdict: why ? "reject" : "match", reason: why, ...v, provider, cached: false };
}

module.exports = { verifyPersonImage, rejectReason, normalize, promptFor };

if (require.main === module) {
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
  require("dotenv/config");
  verifyPersonImage(arg("image"), arg("name"), { sourceUrl: arg("url"), useCache: !process.argv.includes("--no-cache") })
    .then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.verdict === "match" ? 0 : 1); })
    .catch((e) => { console.error(e); process.exit(2); });
}
