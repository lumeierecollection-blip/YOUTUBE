/**
 * Publisher pages for the research stage, used only when web search is down. Every entry is text
 * really fetched from its URL, so ollama-agent's rule that a cited URL must have been shown to
 * the model still holds. Pages that refuse the request are skipped.
 */
import { fetchWithTimeout, log } from "./lib.mjs";

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const clean = (s) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&rsquo;|&apos;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/\s+/g, " ").trim();

async function bingNews(query) {
  try {
    const r = await fetchWithTimeout(`https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`);
    if (!r.ok) return [];
    const xml = await r.text();
    return [...xml.matchAll(/<link>([^<]+apiclick[^<]+)<\/link>/g)].map((m) => {
      try { return new URL(m[1].replace(/&amp;/g, "&")).searchParams.get("url"); } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}

async function pageText(url) {
  try {
    const r = await fetchWithTimeout(url, { headers: { accept: "text/html" } }, 15000, 0);
    if (!r.ok || !/html/.test(r.headers.get("content-type") || "")) return null;
    const html = (await r.text()).replace(/<(script|style|nav|footer|aside)[\s\S]*?<\/\1>/gi, " ");
    const title = clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
    const paragraphs = [...html.matchAll(/<p[\s>][\s\S]*?<\/p>/gi)].map((m) => clean(m[0])).filter((p) => p.length > 60);
    const text = paragraphs.join(" ").slice(0, 1500);
    return text.length >= 400 ? { url, title, text } : null;
  } catch { return null; }
}

async function wikipediaExtract(title) {
  if (!title) return null;
  try {
    const r = await fetchWithTimeout(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|info&inprop=url&explaintext=1&exintro=1&redirects=1&titles=${encodeURIComponent(title)}`);
    if (!r.ok) return null;
    const p = Object.values((await r.json()).query?.pages || {})[0];
    return p?.extract?.length >= 300 ? { url: p.fullurl, title: p.title, text: p.extract.slice(0, 1500) } : null;
  } catch { return null; }
}

/** Returns search-result text in the format ollama-agent reads, or null without two independent domains. */
export async function retrievePages(topic) {
  const direct = (topic.evidence || []).map((e) => e.url).filter((u) => /^https?:/.test(u) && !/news\.google\.com|reddit\.com/.test(u));
  const candidates = [...new Set([...direct, ...(await bingNews(topic.youtube_query || topic.topic))])].slice(0, 14);
  const fetched = (await Promise.all(candidates.map(pageText))).filter(Boolean);
  const wiki = await wikipediaExtract(topic.wikipedia_title);
  if (wiki) fetched.push(wiki);
  const seen = new Set();
  const pages = fetched.filter((p) => { const d = hostOf(p.url); if (seen.has(d)) return false; seen.add(d); return true; }).slice(0, 6);
  log("research", `fallback retrieval: ${pages.length} page(s) from ${seen.size} domain(s)`);
  if (seen.size < 2) return null;
  return pages.map((p) => `Title: ${p.title}\nURL: ${p.url}\nText: ${p.text}`).join("\n\n");
}
