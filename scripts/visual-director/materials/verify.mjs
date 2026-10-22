/**
 * verify.mjs — the literal question, asked of one downloaded candidate:
 *
 *   "Does this image show: <must_show>? Answer YES/NO/PARTLY + one line of what it actually shows"
 *
 * The question is about what the SCENE needs the picture to show (must_show), not the entity's name:
 * that is the whole fix. Run 39817297912's Bayeux video was filled with pictures "of Bayeux"; asked
 * "does this show the Bayeux Tapestry panel with Halley's comet?" a town photo is NO.
 *
 * Providers: reused, not rebuilt — scripts/verify-cutout-image.cjs askProviders() (Gemini via
 * src/lib/gemini-client.js first, then OpenRouter / Groq / Ollama Cloud, OLLAMA_FIRST honoured) and
 * imageDataUrl() (flatten + downscale to JPEG). The parser below is this question's own, the same
 * pattern verify-place-image.cjs uses with its MATCH/CLOSE/WRONG question.
 *
 * Accept rule: YES only. PARTLY and NO are logged with what the model saw and the next candidate is
 * tried. "No provider answered" is retried once after 15 s and then reported as UNAVAILABLE (never
 * cached, never accepted).
 *
 * Where this stops: one vision model's reading of one image. A model that does not know what the
 * Bayeux Tapestry's comet panel looks like can be wrong either way; the critic re-checks the rendered
 * frame against must_show (docs/VISUAL-DIRECTOR.md question 5).
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

export function verifyPrompt(mustShow) {
  const m = String(mustShow).trim();
  return `Does this image show: ${m}? Answer YES/NO/PARTLY + one line of what it actually shows.

YES    — the image itself depicts exactly that: the specific thing, not a similar one.
PARTLY — it shows part of it, a related thing, or the right subject without what the description requires
         (the right building but not the named part; the right object but a modern replica; a map of the wrong period).
NO     — it shows something else: a generic example of that kind of thing, a look-alike, a different place or
         object, a text page or a logo when a picture was asked for.

Return JSON only:
{"answer": "YES" | "NO" | "PARTLY", "seen": "<one line: what the image actually shows>"}`;
}

/** The model's answer, normalized; null when it did not answer the question. Pure. */
export function normalizeAnswer(a) {
  if (!a || typeof a !== "object" || a.error) return null;
  const answer = String(a.answer || a.verdict || "").toUpperCase().trim();
  const seen = String(a.seen || "").replace(/\s+/g, " ").trim();
  if (!["YES", "NO", "PARTLY"].includes(answer) || !seen) return null;
  return { answer, seen: seen.slice(0, 200) };
}

/** verifyMaterial(file, mustShow) -> { answer: YES|NO|PARTLY|UNAVAILABLE, seen, provider, tried? } */
export async function verifyMaterial(file, mustShow, { sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const { askProviders, imageDataUrl } = require("../../verify-cutout-image.cjs");
  const messages = [{ role: "user", content: [
    { type: "text", text: verifyPrompt(mustShow) },
    { type: "image_url", image_url: { url: await imageDataUrl(file) } },
  ] }];
  let r = await askProviders(messages, normalizeAnswer);
  if (!r.v) { await sleep(15000); r = await askProviders(messages, normalizeAnswer); }
  if (!r.v) return { answer: "UNAVAILABLE", seen: "no vision provider answered", provider: null, tried: r.tried || [] };
  return { ...r.v, provider: r.provider };
}
