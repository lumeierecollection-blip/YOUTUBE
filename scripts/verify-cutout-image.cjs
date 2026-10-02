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
 * "no provider answered" (NONE) all reject. Nothing is cached: every PNG is
 * verified every time it is about to be used.
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
const { existsSync, readFileSync } = require("node:fs");

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

async function imageDataUrl(pngPath) {
  let buf = readFileSync(pngPath);
  try {
    const sharp = require("sharp");
    buf = await sharp(buf).flatten({ background: "#ffffff" }).resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  } catch { /* send the original bytes */ }
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

async function askProviders(messages) {
  const tried = [];
  // 1. Groq (vision model). Its free tier rate-limits per minute and says how
  // long to wait ("try again in 16.9s"): wait that out (<= 30 s, twice) rather
  // than reject — run 36944700437 lost 72 verifications to these 429s.
  try {
    const groq = require("./groq-client.cjs");
    for (let k = 0; k < 3; k++) {
      const g = await groq.callGroq(messages, { maxTokens: 200, temperature: 0 });
      const v = normalize(g);
      if (v) return { provider: "groq", v, tried };
      const wait = Number((String(g?.detail || "").match(/try again in ([\d.]+)s/) || [])[1]);
      if (g?.error === "quota_exhausted" && Number.isFinite(wait) && wait <= 30 && k < 2) { await new Promise((r) => setTimeout(r, (wait + 1) * 1000)); continue; }
      tried.push(`groq: ${g?.error ? `${g.error} ${String(g.detail || "").slice(0, 100)}` : "malformed answer"}`);
      break;
    }
  } catch (e) { tried.push(`groq: ${e.message}`); }
  // 2. Gemini flash-lite.
  try {
    const { callGemini } = await import("../src/lib/gemini-client.js");
    const g = await callGemini(messages, { model: "gemini-3.5-flash-lite", maxTokens: 200, temperature: 0, noCache: true, tag: "verify-cutout" });
    const v = normalize(g);
    if (v) return { provider: "gemini", v, tried };
    tried.push(`gemini: ${g?.error ? `${g.error} ${String(g.detail || "").slice(0, 100)}` : "malformed answer"}`);
  } catch (e) { tried.push(`gemini: ${e.message}`); }
  // 3. Ollama (local vision model).
  try {
    const ollama = require("./ollama-client.cjs");
    const o = await ollama.callOllama(messages, { maxTokens: 200, temperature: 0 });
    const v = normalize(o);
    if (v) return { provider: "ollama", v, tried };
    tried.push(`ollama: ${o?.error ? `${o.error} ${String(o.detail || "").slice(0, 100)}` : "malformed answer"}`);
  } catch (e) { tried.push(`ollama: ${e.message}`); }
  return { provider: null, v: null, tried };
}

async function verifyCutoutImage(pngPath, name) {
  if (!existsSync(pngPath)) return { verdict: "NONE", seen: `no image at ${pngPath}`, provider: null };
  const messages = [{ role: "user", content: [
    { type: "text", text: promptFor(name) },
    { type: "image_url", image_url: { url: await imageDataUrl(pngPath) } },
  ] }];
  const { provider, v, tried } = await askProviders(messages);
  if (!v) {
    console.log(`[cutout] ${name}: no vision provider answered — rejected (${tried.join(" | ")})`);
    return { verdict: "NONE", seen: "no vision provider answered", provider: null };
  }
  return { ...v, provider };
}

module.exports = { verifyCutoutImage, normalize, promptFor };

if (require.main === module) {
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
  require("dotenv/config");
  verifyCutoutImage(arg("image"), arg("name"))
    .then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.verdict === "MATCH" ? 0 : 1); })
    .catch((e) => { console.error(e); process.exit(2); });
}
