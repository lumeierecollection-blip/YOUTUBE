#!/usr/bin/env node
/**
 * verify-cutout-image.cjs — is this isolated PNG the object its name says?
 *
 *   verifyCutoutImage(pngPath, cutoutName, { sourceUrl })
 *     -> { verdict: "MATCH" | "CLOSE" | "WRONG" | "NONE", seen, provider, cached }
 *
 * Why: the geometric checks (scripts/cutout_lib.py: coverage, edges, one
 * object, real transparency) prove an image is ISOLATED, not that it is the
 * RIGHT object. A previous build shipped a wooden box as "coin-stack", a
 * postage stamp as "magnifying-glass" and an ornament as "key"; all three
 * passed isolation. This runs AFTER rembg, on the PNG that would render — a
 * coin stack in a market photo can isolate to a crop of a crate.
 *
 * Rule: accepted only when verdict === "MATCH". CLOSE, WRONG, a malformed
 * answer and "no provider answered" (verdict NONE) all reject: an unverified
 * cutout is never saved.
 *
 * Providers, the same chain as verify-person-image.cjs: Groq
 * $GROQ_VISION_MODEL (qwen/qwen3.8-27b) -> Gemini gemini-3.5-flash-lite ->
 * Ollama $OLLAMA_VISION_MODEL (qwen2.5vl:3b). A provider that errors or
 * answers malformed JSON falls to the next.
 *
 * Cache: src/skills/remotion-render/public/cutouts/verified.json, keyed by
 * cutout name: { verified_at, source_url, provider, verdict, seen } for the
 * accepted image, and under `rejected` every rejected source URL with its
 * verdict. Same name + same source URL reuses the cached verdict.
 *
 * Where this stops: the verdict is a vision model's reading of one image,
 * not ground truth; a small model can be wrong in either direction. The
 * transparent ground is flattened onto white before sending (as JPEG, a
 * transparent PNG would otherwise arrive on black and hide dark objects).
 *
 * CLI: node scripts/verify-cutout-image.cjs --image coin-stack.png --name coin-stack [--url https://...] [--no-cache]
 */
"use strict";
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join, dirname } = require("node:path");

const ROOT = join(__dirname, "..");
const CACHE = process.env.CUTOUT_VERIFIED_PATH || join(ROOT, "src", "skills", "remotion-render", "public", "cutouts", "verified.json");

function loadCache() { try { return JSON.parse(readFileSync(CACHE, "utf8")); } catch { return {}; } }
function saveCache(c) { mkdirSync(dirname(CACHE), { recursive: true }); writeFileSync(CACHE, JSON.stringify(c, null, 2) + "\n"); }

function promptFor(name) {
  return `You are verifying an isolated object against a name.

Name: ${name}

Look at the image (transparent background, single object)
and answer:

1. What object does this image show?
   Answer in one short phrase, e.g. "a wooden box",
   "a stack of metal coins", "a postage stamp".

2. Does that object match "${name}"?
   MATCH — the image shows exactly the object the name
           describes
   CLOSE — the image shows a related object but not the
           exact thing (e.g. a drawing of a coin for
           "coin-stack")
   WRONG — the image shows a different object

3. Special cases for compound names:
   - "person-silhouette" must be a silhouette, not a photo
     of a person
   - "business-person" must show business attire, not any
     person
   - "dollar-sign" must show the $ symbol, not a $5 bill
   - "upward-arrow" must show an arrow, not any upward
     motion
   - "map-pin" must show a pin or marker, not a red ball
   - "warning-triangle" must show a triangle warning sign,
     not any warning

   If the object fails the compound-name test, answer WRONG.

Return JSON only:
{
  "seen": "short phrase describing the object",
  "verdict": "MATCH" | "CLOSE" | "WRONG"
}`;
}

// A well-formed answer, normalized; null when the model did not answer.
function normalize(a) {
  if (!a || typeof a !== "object" || a.error) return null;
  const verdict = String(a.verdict || "").toUpperCase().trim();
  const seen = String(a.seen || "").trim();
  if (!["MATCH", "CLOSE", "WRONG"].includes(verdict) || !seen) return null;
  return { verdict, seen: seen.slice(0, 160) };
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

async function verifyCutoutImage(pngPath, name, { sourceUrl = null, useCache = true } = {}) {
  const cache = loadCache();
  const entry = cache[name] || {};
  if (useCache && sourceUrl) {
    if (entry.source_url === sourceUrl && entry.verdict) {
      console.log(`[cutout] ${name}: cached ${entry.provider}, verdict=${entry.verdict}, saw "${entry.seen}"`);
      return { verdict: entry.verdict, seen: entry.seen, provider: entry.provider, cached: true };
    }
    const rej = entry.rejected?.[sourceUrl];
    if (rej) {
      console.log(`[cutout] ${name}: cached ${rej.provider}, verdict=${rej.verdict}, saw "${rej.seen}"`);
      return { verdict: rej.verdict, seen: rej.seen, provider: rej.provider, cached: true };
    }
  }
  if (!existsSync(pngPath)) return { verdict: "NONE", seen: `no image at ${pngPath}`, provider: null, cached: false };
  const messages = [{ role: "user", content: [
    { type: "text", text: promptFor(name) },
    { type: "image_url", image_url: { url: await imageDataUrl(pngPath) } },
  ] }];
  const { provider, v, tried } = await askProviders(messages);
  if (!v) {
    console.log(`[cutout] ${name}: no vision provider answered — rejected (${tried.join(" | ")})`);
    return { verdict: "NONE", seen: "no vision provider answered", provider: null, cached: false };
  }
  console.log(`[cutout] ${name}: ${provider}, verdict=${v.verdict}, saw "${v.seen}"`);
  if (sourceUrl) {
    const now = new Date().toISOString();
    const next = { ...entry, rejected: { ...(entry.rejected || {}) } };
    if (v.verdict === "MATCH") Object.assign(next, { verified_at: now, source_url: sourceUrl, provider, verdict: "MATCH", seen: v.seen });
    else next.rejected[sourceUrl] = { verified_at: now, provider, verdict: v.verdict, seen: v.seen };
    cache[name] = next;
    saveCache(cache);
  }
  return { ...v, provider, cached: false };
}

module.exports = { verifyCutoutImage, normalize, promptFor };

if (require.main === module) {
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
  require("dotenv/config");
  verifyCutoutImage(arg("image"), arg("name"), { sourceUrl: arg("url"), useCache: !process.argv.includes("--no-cache") })
    .then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.verdict === "MATCH" ? 0 : 1); })
    .catch((e) => { console.error(e); process.exit(2); });
}
