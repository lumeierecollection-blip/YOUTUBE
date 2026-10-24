// Independent-source domains for a candidate topic, BEFORE research runs (validate-discovery.js).
//
// What this is not: the research-quality gate. SCR-02 in scripts/gate-research.js still requires
// >=2 (and its own thresholds) distinct domains from the real Stage B search results and is
// unchanged. This is a cheap pre-filter that stops a topic with no findable independent sources
// from being reserved.
//
// Why not DuckDuckGo alone: its instant-answer API returns at most one AbstractURL, almost always
// the encyclopedia, and nothing for most video-style topics, so "2 domains" could not realistically
// be met. Sources here: DuckDuckGo (every URL it returns) plus the external references cited by the
// top Wikipedia articles for the topic.
//
// Every outcome is explicit: "ok" (>=2 independent domains), "insufficient" (lookups worked, fewer
// than 2 found) or "lookup_failed" (no lookup returned usable data, so the count means nothing).

const MULTI_PART_SUFFIXES = new Set([
  "co.uk", "org.uk", "gov.uk", "ac.uk", "me.uk", "ltd.uk", "plc.uk", "nhs.uk",
  "com.au", "net.au", "org.au", "gov.au", "edu.au",
  "co.nz", "org.nz", "govt.nz",
  "co.za", "org.za", "gov.za", "ac.za", "net.za",
  "co.in", "org.in", "gov.in", "ac.in", "nic.in",
  "co.jp", "or.jp", "go.jp", "ac.jp",
  "com.br", "gov.br", "org.br",
  "com.cn", "gov.cn", "org.cn", "edu.cn",
  "com.mx", "com.ar", "com.tr", "com.sg", "com.hk", "co.kr", "co.il", "co.ke", "co.id",
]);

// Domains that are the lookup machinery itself, or resolvers/archives that point at someone else's
// page: they are not an independent source.
const NOT_A_SOURCE = new Set([
  "wikimedia.org", "wikidata.org", "mediawiki.org", "wikimediafoundation.org",
  "archive.org", "archive.is", "archive.ph", "doi.org", "dx.doi.org", "web.archive.org",
  "duckduckgo.com", "google.com", "bing.com", "bit.ly", "t.co", "goo.gl",
]);

export function registrableDomain(url) {
  let host;
  try {
    const raw = String(url ?? "").trim();
    if (!raw) return null;
    const withScheme = raw.startsWith("//") ? `https:${raw}` : raw;
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    host = u.hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
  if (!host || !host.includes(".") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return null;
  const parts = host.split(".");
  if (parts.some((p) => !p)) return null;
  const last2 = parts.slice(-2).join(".");
  if (parts.length >= 3 && MULTI_PART_SUFFIXES.has(last2)) return parts.slice(-3).join(".");
  return last2;
}

export function independentDomains(urls) {
  const out = new Set();
  for (const u of urls || []) {
    const d = registrableDomain(u);
    if (d && !NOT_A_SOURCE.has(d)) out.add(d);
  }
  return [...out];
}

export function urlsFromDuckDuckGo(data) {
  if (!data || typeof data !== "object") return [];
  const urls = [];
  if (typeof data.AbstractURL === "string") urls.push(data.AbstractURL);
  for (const r of Array.isArray(data.Results) ? data.Results : []) if (r && typeof r.FirstURL === "string") urls.push(r.FirstURL);
  const walk = (items) => {
    for (const t of Array.isArray(items) ? items : []) {
      if (t && typeof t.FirstURL === "string") urls.push(t.FirstURL);
      if (t && Array.isArray(t.Topics)) walk(t.Topics);
    }
  };
  walk(data.RelatedTopics);
  return urls;
}

export function urlsFromWikipediaExtlinks(data) {
  const pages = data?.query?.pages;
  const list = Array.isArray(pages) ? pages : pages && typeof pages === "object" ? Object.values(pages) : [];
  const urls = [];
  for (const p of list) for (const l of Array.isArray(p?.extlinks) ? p.extlinks : []) {
    if (typeof l?.url === "string") urls.push(l.url);
    else if (typeof l?.["*"] === "string") urls.push(l["*"]);
  }
  return urls;
}

const DDG = "https://api.duckduckgo.com/";
const WIKI = "https://en.wikipedia.org/w/api.php";

// getJson(url) must resolve to parsed JSON or null (null = the lookup failed or returned nothing usable).
export async function collectSourceDomains(topic, getJson, { need = 2, wikiTitles = 3 } = {}) {
  const query = `${topic?.topic ?? ""} ${topic?.angle ?? ""}`.trim();
  if (!query) return { status: "lookup_failed", pass: false, domains: [], lookups: 0, answered: 0 };
  const domains = new Set();
  let lookups = 0;
  let answered = 0;
  const ask = async (url) => {
    lookups += 1;
    let data = null;
    try { data = await getJson(url); } catch { data = null; }
    if (data && typeof data === "object") answered += 1;
    return data;
  };

  for (const q of [query, `${query} study`, `${query} report`]) {
    if (domains.size >= need) break;
    const data = await ask(`${DDG}?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`);
    for (const d of independentDomains(urlsFromDuckDuckGo(data))) domains.add(d);
  }

  if (domains.size < need) {
    const found = await ask(`${WIKI}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${wikiTitles}&format=json&formatversion=2`);
    const titles = (Array.isArray(found?.query?.search) ? found.query.search : []).map((s) => s?.title).filter((t) => typeof t === "string" && t);
    if (titles.length) {
      const ext = await ask(`${WIKI}?action=query&prop=extlinks&ellimit=60&titles=${encodeURIComponent(titles.join("|"))}&format=json&formatversion=2`);
      for (const d of independentDomains(urlsFromWikipediaExtlinks(ext))) domains.add(d);
    }
  }

  const list = [...domains];
  const status = list.length >= need ? "ok" : answered === 0 ? "lookup_failed" : "insufficient";
  return { status, pass: status === "ok", domains: list, lookups, answered };
}
