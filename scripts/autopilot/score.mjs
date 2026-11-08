/**
 * Topic scoring. Momentum, reach and source quality are computed only from fetched evidence.
 * Curiosity, relevance and visual potential are a model's editorial ratings (recorded as such).
 * A signal that could not be fetched is dropped from its factor and the remaining parts are
 * re-weighted; a factor with no evidence at all scores 0. No value is estimated.
 */
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const DEV_TERMS = /\b(api|apis|sdk|protocol|kubernetes|middleware|compiler|inference server|vector database|tokeniz|mcp|airflow|devops|microservice)\b/i;

const weighted = (parts) => {
  const live = parts.filter(([v]) => v !== null && v !== undefined && Number.isFinite(v));
  const total = live.reduce((n, [, w]) => n + w, 0);
  return total ? live.reduce((n, [v, w]) => n + v * w, 0) / total : 0;
};

export const tokens = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 3));

export function similarity(a, b) {
  const x = tokens(a), y = tokens(b);
  if (!x.size || !y.size) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / Math.min(x.size, y.size);
}

export function scoreCandidate(c, { channel, weights, nowMs = Date.now() }) {
  const ev = c.evidence || [];
  const newestH = ev.length ? Math.min(...ev.map((e) => (nowMs - e.published_ms) / 3600e3)) : Infinity;
  const recency = c.anniversary ? 70 : Number.isFinite(newestH) ? clamp(100 - (Math.max(0, newestH - 24) / (13 * 24)) * 100) : 0;
  const domains = new Set(ev.map((e) => e.domain));
  const social = ev.reduce((n, e) => n + (e.points || 0), 0);
  const hasSocial = ev.some((e) => e.points != null);
  const wiki = c.wikipedia;
  const momentum = weighted([
    [recency, 0.45],
    [clamp((domains.size / 4) * 100), 0.3],
    [hasSocial ? clamp((Math.log10(social + 1) / 3) * 100) : null, 0.15],
    [wiki?.ratio != null ? clamp(((wiki.ratio - 1) / 2) * 100) : null, 0.1],
  ]);
  const yt = c.youtube;
  const reach = weighted([
    [yt?.median_views != null ? clamp((Math.log10(yt.median_views + 1) / 6) * 100) : null, 0.6],
    [wiki?.daily_views != null ? clamp((Math.log10(wiki.daily_views + 1) / 5) * 100) : null, 0.4],
  ]);
  const curiosity = clamp(Number(c.ratings?.curiosity || 0) * 10);
  let relevance = clamp(Number(c.ratings?.relevance || 0) * 10);
  if (channel.treatment === "motion-graphics" && DEV_TERMS.test(c.topic)) relevance = clamp(relevance - 30);
  const visual = c.commons_hits != null
    ? weighted([[clamp(Number(c.ratings?.visual || 0) * 10), 0.5], [clamp((c.commons_hits / 8) * 100), 0.5]])
    : clamp(Number(c.ratings?.visual || 0) * 10);
  const trusted = [...domains].filter((d) => channel.trusted_domains.some((t) => d === t || d.endsWith("." + t)));
  const sourceQuality = clamp((trusted.length / 2) * 70 + (domains.size >= 2 ? 30 : 0));
  const factors = { momentum, reach, curiosity, relevance, visual, source_quality: sourceQuality };
  const total = Object.entries(weights).reduce((n, [k, w]) => n + (factors[k] * w) / 100, 0);
  return { factors: Object.fromEntries(Object.entries(factors).map(([k, v]) => [k, Math.round(v)])), total: Math.round(total * 10) / 10, newest_hours: Number.isFinite(newestH) ? Math.round(newestH) : null, domains: [...domains], trusted_domains: trusted };
}

/** Reasons a scored candidate must not be produced. Empty means eligible. */
export function rejections(c, score, { history, minScore, nowMs = Date.now(), windowDays, requireImages = false }) {
  const out = [];
  if (!c.anniversary && (score.newest_hours === null || score.newest_hours > 14 * 24)) out.push("stale: no evidence from the last 14 days");
  if (score.domains.length < 2 && !c.anniversary) out.push("fewer than 2 independent source domains");
  if (!score.trusted_domains.length) out.push("no trusted source");
  if (c.explainable_30s === false) out.push("cannot be explained in 30 seconds");
  if (score.factors.reach === 0) out.push("no reach evidence (too obscure or unmeasured)");
  if (score.factors.visual < 40) out.push("visually weak");
  if (requireImages && !(c.commons_hits >= 6)) out.push(`too few freely licensed images (${c.commons_hits ?? 0} on Wikimedia Commons)`);
  if (score.total < minScore) out.push(`score ${score.total} below ${minScore}`);
  const cutoff = nowMs - windowDays * 86400e3;
  for (const h of history) {
    if (h.at_ms < cutoff) continue;
    if (similarity(c.topic, h.topic) >= 0.5) { out.push(`too similar to recent topic: ${h.topic}`); break; }
  }
  return out;
}
