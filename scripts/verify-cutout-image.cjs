#!/usr/bin/env node
/**
 * verify-cutout-image.cjs — is this isolated PNG literally the object its concept names?
 *
 *   verifyCutoutImage(pngPath, concept)
 *     -> { verdict: "MATCH" | "FIGURATIVE" | "DIFFERENT" | "UNRECOGNIZABLE" | "NONE",
 *          literal, recognizable, seen, provider }
 *
 * Why: the geometric checks (scripts/cutout_lib.py) prove an image is
 * ISOLATED, not that it is the RIGHT object. The old library shipped a wooden
 * box as "coin-stack", a postage stamp as "magnifying-glass" and a sun dial as
 * "calendar"; all passed isolation. This runs after rembg, on the PNG that
 * would render.
 *
 * Rule (owner's spec 2026-10-02): accepted only when the model answers
 * verdict === "LITERAL" AND recognizable === true (returned as "MATCH").
 * FIGURATIVE, DIFFERENT, LITERAL-but-not-recognizable, a malformed answer and
 * "no provider answered" (NONE) all reject.
 *
 * CACHE (owner decision, 2026-10-10; replaces the 2026-10-02 "nothing is cached"). The original intent was that every DISTINCT image is
 * verified, and it survives a cache keyed on the image: the key is the sha256 of the exact JPEG the model sees, plus the concept name,
 * the verifier version and the model chain. A different image, name, verifier version or model is a new key and a fresh verification.
 * A NONE (no provider answered) is never stored, so an outage is retried. The cache is .cache/cutout-verify (restored in CI).
 *
 * Providers, the same chain as verify-person-image.cjs: Groq
 * $GROQ_VISION_MODEL (qwen/qwen3.8-27b) -> Gemini gemini-3.5-flash-lite ->
 * Ollama $OLLAMA_VISION_MODEL (qwen2.5vl:3b). A provider that errors or
 * answers malformed JSON falls to the next.
 *
 * Where this stops: the verdict is a vision model's reading of one image,
 * not ground truth; a small model can be wrong in either direction. The
 * transparent ground is flattened onto white before sending (as JPEG, a
 * transparent PNG would otherwise arrive on black and hide dark objects).
 *
 * CLI: node scripts/verify-cutout-image.cjs --image gavel.png --name gavel
 */
"use strict";
const { existsSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { join } = require("node:path");

// The owner's prompt, verbatim (2026-10-02, "FIX 3 — STRICT VERIFICATION").
function promptFor(name) {
  const concept = String(name).replace(/-/g, " ");
  return `You are verifying an isolated object against a concept.

Concept: "${concept}"

Look at the image (transparent background, single object).

Answer three questions:

1. What does this image literally show? Answer in 3–5 words.
   Example: "wooden gavel on block" or "stack of copper coins".
2. Is that object the exact thing named by the concept?
   LITERAL — same object, same form. A gavel is a gavel.
   FIGURATIVE — related but a substitute. A hammer for a
   gavel. A sundial for a calendar.
   DIFFERENT — unrelated.
3. Would a viewer recognize this as "${concept}" if they saw
   it alone with no label? YES or NO.

Return JSON only:
{
"seen": "...",
"verdict": "LITERAL" | "FIGURATIVE" | "DIFFERENT",
"recognizable": true | false
}`;
}

// A well-formed answer, normalized; null when the model did not answer.
// verdict: "MATCH" only for LITERAL AND recognizable; otherwise the model's
// verdict (FIGURATIVE / DIFFERENT), or "UNRECOGNIZABLE" for a literal object
// a viewer would not name unaided. Every caller accepts MATCH only.
function normalize(a) {
  if (!a || typeof a !== "object" || a.error) return null;
  const raw = String(a.verdict || "").toUpperCase().trim();
  const seen = String(a.seen || "").trim();
  const rec = a.recognizable === true || String(a.recognizable).toLowerCase() === "true" || String(a.recognizable).toUpperCase() === "YES";
  const recNo = a.recognizable === false || String(a.recognizable).toLowerCase() === "false" || String(a.recognizable).toUpperCase() === "NO";
  if (!["LITERAL", "FIGURATIVE", "DIFFERENT"].includes(raw) || !seen || !(rec || recNo)) return null;
  const verdict = raw === "LITERAL" ? (rec ? "MATCH" : "UNRECOGNIZABLE") : raw;
  return { verdict, seen: seen.slice(0, 160), literal: raw, recognizable: rec };
}

async function imageJpegBuf(pngPath) {
  let buf = readFileSync(pngPath);
  try {
    const sharp = require("sharp");
    buf = await sharp(buf).flatten({ background: "#ffffff" }).resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  } catch { /* send the original bytes */ }
  return buf;
}
async function imageDataUrl(pngPath) {
  return `data:image/jpeg;base64,${(await imageJpegBuf(pngPath)).toString("base64")}`;
}

// The verifier's version: bump it when the prompt, the answer parser or the model changes, so every stored verdict is re-asked.
const CUTOUT_VERIFIER_VERSION = "2026-10-10.1";
const CUTOUT_CACHE_DIR = join(__dirname, "..", ".cache", "cutout-verify");
function verifierModels() {
  return [process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b", "gemini-3.5-flash-lite"];
}
/** sha256 over the exact JPEG bytes, the concept name, the verifier version and the model chain. Pure. */
function cutoutCacheKey(jpeg, name, version = CUTOUT_VERIFIER_VERSION, models = verifierModels()) {
  const image = createHash("sha256").update(jpeg).digest("hex");
  return createHash("sha256").update(JSON.stringify({ image, name: String(name), version, models })).digest("hex");
}

// `norm`: the answer parser (verify-place-image.cjs passes its own).
async function askProviders(messages, norm = normalize) {
  const tried = [];
  // Google first (owner's 2026-10-08 brief): Gemini across every key, then every sibling
  // model (src/lib/gemini-client.js), before any other provider. This was Groq first.
  // 1. Gemini flash-lite (maxTokens 1024: a sibling reasoning model spends from the same budget).
  try {
    const { callGemini } = await import("../src/lib/gemini-client.js");
    const g = await callGemini(messages, { model: "gemini-3.5-flash-lite", maxTokens: 1024, temperature: 0, noCache: true, tag: "verify-cutout" });
    const v = norm(g);
    if (v) return { provider: "gemini", v, tried };
    tried.push(`gemini: ${g?.error ? `${g.error} ${String(g.detail || "").slice(0, 100)}` : "malformed answer"}`);
  } catch (e) { tried.push(`gemini: ${e.message}`); }
  // 2. Groq (vision model). Its free tier rate-limits per minute and says how
  // long to wait ("try again in 16.9s"): wait that out (<= 30 s, twice) rather
  // than reject — run 36944700437 lost 72 verifications to these 429s.
  try {
    const groq = require("./groq-client.cjs");
    for (let k = 0; k < 3; k++) {
      const g = await groq.callGroq(messages, { maxTokens: 200, temperature: 0 });
      const v = norm(g);
      if (v) return { provider: "groq", v, tried };
      const wait = Number((String(g?.detail || "").match(/try again in ([\d.]+)s/) || [])[1]);
      if (g?.error === "quota_exhausted" && Number.isFinite(wait) && wait <= 30 && k < 2) { await new Promise((r) => setTimeout(r, (wait + 1) * 1000)); continue; }
      tried.push(`groq: ${g?.error ? `${g.error} ${String(g.detail || "").slice(0, 100)}` : "malformed answer"}`);
      break;
    }
  } catch (e) { tried.push(`groq: ${e.message}`); }
  // 3. Ollama (local vision model).
  try {
    const ollama = require("./ollama-client.cjs");
    const o = await ollama.callOllama(messages, { maxTokens: 200, temperature: 0 });
    const v = norm(o);
    if (v) return { provider: "ollama", v, tried };
    tried.push(`ollama: ${o?.error ? `${o.error} ${String(o.detail || "").slice(0, 100)}` : "malformed answer"}`);
  } catch (e) { tried.push(`ollama: ${e.message}`); }
  return { provider: null, v: null, tried };
}

async function verifyCutoutImage(pngPath, name) {
  if (!existsSync(pngPath)) return { verdict: "NONE", seen: `no image at ${pngPath}`, provider: null };
  const jpeg = await imageJpegBuf(pngPath);
  const key = cutoutCacheKey(jpeg, name);
  const file = join(CUTOUT_CACHE_DIR, `${key}.json`);
  if (existsSync(file)) {
    try {
      const hit = JSON.parse(readFileSync(file, "utf8"));
      console.log(`[cutout] ${name}: answered from the cache (key ${key.slice(0, 12)}…, verifier ${CUTOUT_VERIFIER_VERSION})`);
      return { ...hit.result, cached: true };
    } catch { /* unreadable entry: ask again */ }
  }
  const messages = [{ role: "user", content: [
    { type: "text", text: promptFor(name) },
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` } },
  ] }];
  const { provider, v, tried } = await askProviders(messages);
  if (!v) {
    console.log(`[cutout] ${name}: no vision provider answered — rejected (${tried.join(" | ")})`);
    return { verdict: "NONE", seen: "no vision provider answered", provider: null };
  }
  const result = { ...v, provider };
  try {
    mkdirSync(CUTOUT_CACHE_DIR, { recursive: true });
    writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), version: CUTOUT_VERIFIER_VERSION, result }, null, 2) + "\n");
  } catch { /* a cache that cannot be written is a verdict that is asked again, never a wrong one */ }
  return result;
}

module.exports = { verifyCutoutImage, normalize, promptFor, askProviders, imageDataUrl, cutoutCacheKey, CUTOUT_VERIFIER_VERSION };

if (require.main === module) {
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
  require("dotenv/config");
  verifyCutoutImage(arg("image"), arg("name"))
    .then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.verdict === "MATCH" ? 0 : 1); })
    .catch((e) => { console.error(e); process.exit(2); });
}
