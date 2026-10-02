#!/usr/bin/env node
/**
 * verify-place-image.cjs — does this photo show the named place, building or
 * organization?
 *
 *   verifyPlaceImage(imagePath, name) -> { verdict: "MATCH" | "CLOSE" | "WRONG" | "NONE", seen, provider }
 *
 * The owner's question (scene-resolver spec 2026-10-02, task 2.4), verbatim:
 * "Does this image show {{place_name}}? Answer MATCH, CLOSE, or WRONG." —
 * with a JSON answer format so the reply can be read. Accepted only for
 * MATCH; CLOSE, WRONG, a malformed answer and "no provider answered" (NONE)
 * all reject, and the caller tries its next source. A generic photo of the
 * KIND of place (any courthouse for "the Miami federal courthouse", any
 * skyline for "Miami") is not the place: CLOSE at best.
 *
 * Providers: the cutout verifier's chain (verify-cutout-image.cjs
 * askProviders): Groq vision -> Gemini flash-lite -> Ollama qwen2.5vl:3b.
 * Nothing is cached: every photo is checked each time it is about to be used.
 *
 * Where this stops: one vision model's reading of one image. A model that
 * does not know what a place looks like can answer either way; the frame
 * reviewer checks the rendered frame again.
 *
 * CLI: node scripts/verify-place-image.cjs --image miami.jpg --name "Miami, Florida"
 */
"use strict";
const { existsSync } = require("node:fs");
const { askProviders, imageDataUrl } = require("./verify-cutout-image.cjs");

function promptFor(name) {
  return `Does this image show ${String(name).trim()}? Answer MATCH, CLOSE, or WRONG.

MATCH — it is ${String(name).trim()} itself.
CLOSE — a similar or related place, or a generic example of that kind of place, not this one.
WRONG — something else.

Return JSON only:
{
"seen": "<what the image shows, 3-8 words>",
"verdict": "MATCH" | "CLOSE" | "WRONG"
}`;
}

function normalize(a) {
  if (!a || typeof a !== "object" || a.error) return null;
  const verdict = String(a.verdict || "").toUpperCase().trim();
  const seen = String(a.seen || "").trim();
  if (!["MATCH", "CLOSE", "WRONG"].includes(verdict) || !seen) return null;
  return { verdict, seen: seen.slice(0, 160) };
}

async function verifyPlaceImage(imagePath, name) {
  if (!existsSync(imagePath)) return { verdict: "NONE", seen: `no image at ${imagePath}`, provider: null };
  const messages = [{ role: "user", content: [
    { type: "text", text: promptFor(name) },
    { type: "image_url", image_url: { url: await imageDataUrl(imagePath) } },
  ] }];
  let r = await askProviders(messages, normalize);
  // "No provider answered" is retried twice, 15 s apart (free-tier rate limits), then rejects.
  for (let k = 0; k < 2 && !r.v; k++) { await new Promise((res) => setTimeout(res, 15000)); r = await askProviders(messages, normalize); }
  if (!r.v) return { verdict: "NONE", seen: "no vision provider answered", provider: null, tried: r.tried };
  return { ...r.v, provider: r.provider };
}

module.exports = { verifyPlaceImage, normalize, promptFor };

if (require.main === module) {
  require("dotenv/config");
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
  verifyPlaceImage(arg("image"), arg("name")).then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.verdict === "MATCH" ? 0 : 1); });
}
