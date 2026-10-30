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

export function parseQueries(answer, count) {
  let obj = answer;
  if (answer && typeof answer.content === "string") {
    const m = answer.content.match(/\{[\s\S]*\}/);
    try { obj = m ? JSON.parse(m[0]) : null; } catch { obj = null; }
  }
  const out = new Array(count).fill(null);
  const src = obj && (obj.queries || obj);
  if (!src || typeof src !== "object") return out;
  for (let i = 0; i < count; i++) {
    const v = Array.isArray(src) ? src[i] : src[String(i)];
    if (typeof v === "string" && v.trim() && !/^none$/i.test(v.trim())) out[i] = v.trim().slice(0, 60);
  }
  return out;
}

export function conceptPrompt({ sentences, topic, niche }) {
  return `You choose photographs for a short documentary video about: ${topic || "the story"} (channel niche: ${niche || "general"}).
For EACH numbered sentence give a 2-4 word search phrase for Wikimedia Commons that finds a REAL PHOTOGRAPH of something a camera can capture which makes the
sentence's subject visible: an object, a place, a workplace, an activity, a piece of equipment (e.g. "airline cockpit", "tide mill", "factory floor robot arm").
Rules: never a person's name, a brand, a logo, a screenshot, a chart or a map; no abstract words ("success", "growth"); if nothing photographable fits, use null.
Answer ONLY JSON like {"0":"airline cockpit","1":null}.

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
    return parseQueries(await ask(conceptPrompt({ sentences, topic, niche })), sentences.length);
  } catch (e) {
    console.error(`[concept-photo] model call failed (${e.message}); no concept photos this run`);
    return new Array(sentences.length).fill(null);
  }
}

export function defaultAsk() {
  return async (prompt) => {
    const { callLLM } = await import("../../src/lib/llm.js");
    return callLLM([{ role: "user", content: prompt }], { maxTokens: 600, temperature: 0, keepAlive: 0 }, "concept-photo");
  };
}

export { require };
