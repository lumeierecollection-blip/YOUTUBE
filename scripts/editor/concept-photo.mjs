/**
 * A real photograph for a sentence that names no one: "pilots flying fatigued" -> a cockpit photo, "port ledgers" -> an archive.
 *
 *   1. ONE model call per video turns every sentence into a short Commons search phrase for something photographable (an object,
 *      a place, an activity) or null. It is told never to name a person, brand or logo.
 *   2. Wikimedia Commons is searched for that phrase; the first result that is a JPEG photograph under a free licence, large enough,
 *      and not named like a logo / map / chart / screenshot / document wins. Its credit is recorded.
 * The photo is only ever a picture of the CONCEPT. A named person, place or organization still goes through entity-assets (a verified
 * photo of that entity or none), and a concept photo is never presented as one.
 */
import { createRequire } from "module";
import { join } from "path";
import { mkdirSync, writeFileSync } from "fs";

const require = createRequire(import.meta.url);
const COMMONS = "https://commons.wikimedia.org/w/api.php";
const UA = "YOUTUBE-pipeline/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; concept photos)";
const MIN_SIDE = 900;
const BAD_NAME = /logo|icon|map|flag|diagram|chart|graph|screenshot|poster|cover|stamp|coin|signature|banner|infographic|\bpdf\b|\bsvg\b|scan|page|book|manuscript|portrait|selfie|crowd|nude|swim|bikini|advert|billboard|ad_/i;
const FREE = /^(cc0|cc[- ]by|cc[- ]by[- ]sa|public domain|pd|ogl|gfdl|attribution)/i;

/** {first:[...], second:[...]}: the two phrases for each sentence (a plain string counts as the first). */
export function parseQueryPairs(answer, count) {
  let obj = answer;
  if (answer && typeof answer.content === "string") {
    const m = answer.content.match(/\{[\s\S]*\}/);
    try { obj = m ? JSON.parse(m[0]) : null; } catch { obj = null; }
  }
  const first = new Array(count).fill(null);
  const second = new Array(count).fill(null);
  const src = obj && (obj.sentences || obj.queries || obj);
  const clean0 = (v) => (typeof v === "string" && v.trim() && !/^none$/i.test(v.trim()) ? v.trim().slice(0, 60) : null);
  const story = obj && Array.isArray(obj.story) ? [...new Set(obj.story.map(clean0).filter(Boolean))].slice(0, 8) : [];
  const topic = obj && typeof obj.subject === "string" ? obj.subject.trim().slice(0, 120) : "";
  if (!src || typeof src !== "object") return { first, second, story, topic };
  const clean = (v) => (typeof v === "string" && v.trim() && !/^none$/i.test(v.trim()) ? v.trim().slice(0, 60) : null);
  for (let i = 0; i < count; i++) {
    const v = Array.isArray(src) ? src[i] : src[String(i)];
    if (Array.isArray(v)) { first[i] = clean(v[0]); second[i] = clean(v[1]); if (second[i] === first[i]) second[i] = null; } else first[i] = clean(v);
  }
  return { first, second, story, topic };
}

export function parseQueries(answer, count) {
  return parseQueryPairs(answer, count).first;
}

export function conceptPrompt({ sentences, topic, niche }) {
  return `You are the picture editor of a short documentary video about: ${topic || "the story"} (channel niche: ${niche || "general"}).
Read the WHOLE script first. Every picture must belong to this one story, so that the sequence of pictures explains the video as a whole: where it happens, what
is at stake, the objects and places involved. Never a stock image that fits any video.
1. "subject": the video's subject in 3-8 words (place + thing + time if the script gives them).
2. "sentences": for EACH numbered sentence, two different 2-5 word Wikimedia Commons search phrases for a REAL PHOTOGRAPH of what that sentence says, inside the subject's world.
   Keep the subject's place or thing in the phrase when it matters ("California wildfire smoke", not "fire"). Be specific to the claim: for "storms flooded the coast"
   use "flooded street storm" and "storm waves pier", NOT "beach". The two phrases show different things (a wide view, then a detail).
3. "story": 6 more phrases for photographs of the subject as a whole (landmarks, equipment, locations, daily life), used where a sentence has nothing photographable.
Rules: never a person's name, a brand, a logo, a screenshot, a chart or a map; no abstract words ("success", "growth"); use null for a phrase when nothing photographable fits.
Answer ONLY JSON like {"subject":"...","sentences":{"0":["airline cockpit","pilot checklist"],"1":["tide mill",null]},"story":["...","..."]}.

${sentences.map((s, i) => `${i}. ${s}`).join("\n")}`;
}

async function getJson(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, signal: ctl.signal });
    return res.ok ? await res.json() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

const strip = (v) => String(v?.value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** Search Commons for a phrase; return up to `limit` acceptable photo records, best first. */
export async function searchCommons(query, limit = 3, fetchJson = getJson) {
  const u = `${COMMONS}?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=15&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=2200`;
  const j = await fetchJson(u);
  const pages = Object.values(j?.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  const out = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || ii.mime !== "image/jpeg") continue;
    const title = String(p.title || "").replace(/^File:/, "");
    if (BAD_NAME.test(title)) continue;
    if (Math.min(ii.width || 0, ii.height || 0) < MIN_SIDE) continue;
    const md = ii.extmetadata || {};
    const license = strip(md.LicenseShortName) || strip(md.UsageTerms);
    if (!license || /non-?free|fair use/i.test(license) || !FREE.test(license)) continue;
    const artist = strip(md.Artist).slice(0, 80);
    out.push({ title, url: ii.url, thumb: ii.thumburl || ii.url, width: ii.thumbwidth || ii.width, height: ii.thumbheight || ii.height, license, artist,
      page: ii.descriptionurl, credit: `Photo: ${artist ? `${artist} / ` : ""}Wikimedia Commons, ${license}` });
    if (out.length >= limit) break;
  }
  return out;
}

export async function downloadPhoto(rec, destAbs) {
  const res = await fetch(rec.thumb, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error("not a JPEG");
  mkdirSync(join(destAbs, ".."), { recursive: true });
  writeFileSync(destAbs, buf);
  return buf;
}

/** Ask the model once for every sentence's phrase. `ask(prompt)` is injected so the tests need no provider. */
export async function conceptQueries({ sentences, topic, niche, ask }) {
  try {
    return parseQueryPairs(await ask(conceptPrompt({ sentences, topic, niche })), sentences.length);
  } catch (e) {
    console.error(`[concept-photo] model call failed (${e.message}); no concept photos this run`);
    return { first: new Array(sentences.length).fill(null), second: new Array(sentences.length).fill(null), story: [], topic: "" };
  }
}

export function defaultAsk() {
  return async (prompt) => {
    const { callLLM } = await import("../../src/lib/llm.js");
    return callLLM([{ role: "user", content: prompt }], { maxTokens: 1800, temperature: 0, keepAlive: 0 }, "concept-photo");
  };
}

/**
 * Look at the downloaded photo before it is used. It must (a) clearly show the subject of THIS sentence, (b) show no identifiable
 * real person (a stranger's face over an unrelated claim misrepresents them), (c) not be mostly readable text, a logo, a screenshot or a chart.
 * Fails CLOSED: no answer, or an unparseable one, rejects the photo.
 */
export function visionPrompt({ sentence, query, topic = "" }) {
  return `A documentary video${topic ? ` about "${topic}"` : ""} narrates this sentence: "${sentence}"
We are considering this photograph (found with the search phrase "${query}") to show on screen while it is spoken.
Answer ONLY JSON: {"shows_subject": true|false, "identifiable_person": true|false, "mostly_text_or_logo": true|false, "what_it_shows": "<8 words>"}
shows_subject = (it must also belong to the video's subject above, not just the sentence) a viewer would say the photo shows the specific thing the sentence claims or describes. A photo of only the place or the general setting does not count
(a sunny beach does not illustrate "California storms"; a generic skyline does not illustrate "the bank collapsed"). If you would hesitate, answer false.
identifiable_person = a real person's face is recognisable or clearly the focus (crowds far away and silhouettes are false).
mostly_text_or_logo = readable text, a logo, a screenshot, a document, a map or a chart fills the frame.`;
}

export function parseVerdict(answer) {
  let obj = answer;
  if (answer && typeof answer.content === "string") {
    const m = answer.content.match(/\{[\s\S]*\}/);
    try { obj = m ? JSON.parse(m[0]) : null; } catch { obj = null; }
  }
  if (!obj || typeof obj !== "object" || typeof obj.shows_subject !== "boolean") return { ok: false, why: "no usable verdict" };
  if (!obj.shows_subject) return { ok: false, why: `does not show the subject (${obj.what_it_shows || "?"})` };
  if (obj.identifiable_person !== false) return { ok: false, why: "shows an identifiable person" };
  if (obj.mostly_text_or_logo !== false) return { ok: false, why: "mostly text, a logo, a screenshot or a chart" };
  return { ok: true, why: obj.what_it_shows || "" };
}

/** askVision({prompt, imageBase64}) -> the model's answer. Injected for tests. */
export async function verifyConceptPhoto({ sentence, query, topic = "", jpeg, askVision }) {
  try {
    return parseVerdict(await askVision({ prompt: visionPrompt({ sentence, query, topic }), imageBase64: jpeg.toString("base64") }));
  } catch (e) {
    return { ok: false, why: `vision check failed: ${e.message}` };
  }
}

export function defaultAskVision() {
  return async ({ prompt, imageBase64 }) => {
    const { callLLM } = await import("../../src/lib/llm.js");
    return callLLM([{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }] }], { maxTokens: 300, temperature: 0, keepAlive: 0 }, "concept-photo-vision");
  };
}
