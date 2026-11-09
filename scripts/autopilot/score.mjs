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

// Words that open or fill many headlines, so sharing them says nothing about the story.
const GENERIC = /^(new|first|ancient|lost|secret|hidden|how|why|what|the|chatgpt|openai|google|gemini|claude|anthropic|history|years?|battle|discovery|discovered|great|world|royal|empire|kingdom|mystery|story|naval|attack|tomb|city|american|british|german|french|roman|egyptian|meta|apple|microsoft|amazon)$/i;
// Headlines are in Title Case, so a capital letter alone does not make a name. These never count as one.
const TITLE_WORDS = /^(a|an|and|are|as|at|be|been|but|by|can|could|did|do|does|for|from|had|has|have|her|his|if|in|into|is|it|its|may|might|must|my|no|not|now|of|on|or|our|over|she|their|these|they|this|those|to|under|us|was|we|were|when|where|who|will|with|would|you|your|ai|one|two|three|about|after|against|almost|before|behind|between|during|every|inside|never|really|should|without|tragic|deadly|strange|forgotten|famous|bloody|brutal|final|greatest|largest|biggest|people|money|power|artificial|intelligence|agents?|models?|tools?|users?|prices?|assistant|robots?|banks?|account|passwords?|security|update|release|launch|report|review|million|billion|ransom|mistake|ancient|modern|empire|secret|scandal|disaster|journey|machine|weapon|invasion|escape)$/i;
// Only the one-shared-name shortcut uses this. A rare real name it catches (Reading, Flanders) still faces the word-overlap check.
const COMMON_ENDING = /(ing|ed|tion|sion|ment|ness|ous|ive|ful|ally|ial|ical|ers|ly)$/i;
const names = (s) => new Set((String(s).match(/\b[A-Z][a-zA-Z0-9]+/g) || []).filter((w) => !GENERIC.test(w) && !TITLE_WORDS.test(w)).map((w) => w.toLowerCase()));

export function similarity(a, b) {
  const x = tokens(a), y = tokens(b);
  if (!x.size || !y.size) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  let sharedNames = 0;
  const ny = names(b);
  for (const w of names(a)) if (ny.has(w)) sharedNames++;
  // Two shared proper names mean the same story even when the rest of the headline differs.
  if (sharedNames >= 2) return Math.max(0.75, shared / Math.min(x.size, y.size));
  // One distinctive proper name is enough: "Battle of Taranto" and "The 1940 Taranto Raid" are one story.
  if ([...names(a)].some((w) => ny.has(w) && w.length >= 6 && !COMMON_ENDING.test(w))) return Math.max(0.6, shared / Math.min(x.size, y.size));
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
