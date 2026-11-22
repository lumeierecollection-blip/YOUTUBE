/**
 * Fetching real source pages. Nothing here invents text: a source is whatever the server returned, and
 * claims.mjs later refuses any excerpt that is not a verbatim substring of it.
 * Wikipedia is read through its extracts API (plain text of the current revision); other pages are fetched
 * as HTML and reduced to text. A page that cannot be fetched is reported, never replaced.
 */
import { norm, content } from "./text.mjs";

const UA = "YOUTUBE-script-engine/1.0 (https://github.com/lumeierecollection-blip/YOUTUBE; research preview)";

async function get(url, { timeoutMs = 25000, retries = 2 } = {}) {
  let last;
  for (let i = 0; i <= retries; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { redirect: "follow", signal: ctl.signal, headers: { "user-agent": UA, accept: "text/html,application/json" } });
      if (r.ok) return r;
      last = new Error(`HTTP ${r.status} for ${url}`);
      if (r.status < 500 && r.status !== 429) break;
    } catch (e) { last = e; } finally { clearTimeout(t); }
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  throw last;
}

export function htmlToText(html) {
  return String(html)
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h\d|tr|br|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

export async function fetchSource({ source_id, url }) {
  const wiki = url.match(/^https:\/\/([a-z]+)\.wikipedia\.org\/wiki\/(.+)$/);
  if (wiki) {
    const title = decodeURIComponent(wiki[2]);
    const api = `https://${wiki[1]}.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=extracts%7Crevisions&explaintext=1&exsectionformat=plain&rvprop=timestamp&titles=${encodeURIComponent(title)}`;
    const j = await (await get(api)).json();
    const page = Object.values(j.query?.pages || {})[0];
    if (!page || page.missing !== undefined || !page.extract) throw new Error(`Wikipedia has no extract for "${title}"`);
    return { source_id, url, title: page.title, published: page.revisions?.[0]?.timestamp?.slice(0, 10) ?? null, text: page.extract.replace(/\n{2,}/g, "\n"), fetched_at: new Date().toISOString() };
  }
  const html = await (await get(url)).text();
  const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || url).trim();
  return { source_id, url, title, published: html.match(/(?:article:published_time|datePublished)["']?\s*(?:content=|:)\s*["'](\d{4}-\d{2}-\d{2})/i)?.[1] ?? null, text: htmlToText(html), fetched_at: new Date().toISOString() };
}

/**
 * The model sees a budgeted selection, not the whole page: the opening paragraphs plus the paragraphs that
 * best match the topic terms, in page order. Every excerpt is still checked against the FULL text.
 */
export function selectPassages(text, terms, maxChars = 6000) {
  const paras = text.split("\n").map((p) => p.trim()).filter((p) => p.length > 40);
  const want = new Set(content(terms.join(" ")));
  const scored = paras.map((p, i) => {
    const w = content(p);
    const hit = w.filter((x) => want.has(x)).length;
    return { i, p, score: hit / Math.sqrt(w.length + 8) + (i < 2 ? 5 : 0) };
  }).sort((a, b) => b.score - a.score);
  const keep = [];
  let used = 0;
  for (const s of scored) {
    if (used + s.p.length > maxChars) continue;
    keep.push(s); used += s.p.length;
    if (used > maxChars - 200) break;
  }
  return keep.sort((a, b) => a.i - b.i).map((s) => s.p).join("\n");
}

export const sourceView = (s, terms, maxChars) => ({ source_id: s.source_id, url: s.url, title: s.title, published: s.published, passages: selectPassages(s.text, terms, maxChars) });
export const looksFetched = (s) => !!(s && s.url && norm(s.text).length > 400);
