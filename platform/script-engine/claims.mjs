/**
 * claims.mjs: fetched research -> claim records (platform/contracts/claim-record.schema.json).
 * The model proposes; code disposes. A claim survives only if its excerpt is verbatim in the fetched source,
 * its numbers and names occur in that excerpt, and its category is one of the channel's claim_categories.
 */
import { ask } from "./llm.mjs";
import { describeCategory } from "./channels.mjs";
import { prompt } from "./prompt.mjs";
import { assertValid, validate } from "./schema.mjs";
import { sourceView } from "./sources.mjs";
import { capitalised, contains, content, norm, numbers, overlap, wordCount } from "./text.mjs";

export class InsufficientEvidence extends Error {
  constructor(detail, dropped) { super(`insufficient grounded claims: ${detail}`); this.kind = "blocked_input"; this.dropped = dropped; }
}

/** Why a proposed claim is not acceptable, or null. Pure; used by the model path and by the tests. */
export function groundingProblem(c, { sourceById, categories, topic = "" }) {
  const src = sourceById.get(c.source_id);
  if (!src) return `source_id "${c.source_id}" is not a fetched source`;
  const claim = norm(c.claim), excerpt = norm(c.excerpt);
  if (wordCount(claim) < 5 || wordCount(claim) > 45) return "claim is not one sentence of 5 to 45 words";
  if (excerpt.length < 25) return "excerpt is under 25 characters";
  if (!contains(src.text, excerpt)) return "excerpt is not verbatim in the fetched source";
  const missing = numbers(claim).filter((n) => !numbers(excerpt).includes(n));
  if (missing.length) return `claim has number(s) the excerpt does not hold: ${missing.join(", ")}`;
  const allowed = `${excerpt} ${topic} ${src.title || ""}`.toLowerCase();
  for (const name of capitalised(claim)) {
    for (const w of name.split(/\s+/).filter((x) => x.length > 2)) if (!allowed.includes(w.replace(/[^\w'-]/g, "").toLowerCase())) return `name "${name}" is not in the excerpt`;
  }
  if (!categories.includes(c.editorial_status)) return `"${c.editorial_status}" is not one of this channel's claim categories`;
  if (!["high", "medium", "low"].includes(c.confidence)) return "confidence must be high, medium or low";
  return null;
}

export async function extractClaims(ctx, { channel, topic, angle, sources, minClaims = 6, maxPassageChars = 6000 }) {
  const sourceById = new Map(sources.map((s) => [s.source_id, s]));
  const terms = [topic, angle];
  const user = prompt("claims", {
    channel_name: channel.name, editorial: channel.editorial, topic, angle,
    categories: channel.categories.map((c) => `- ${c}: ${describeCategory(c)}`).join("\n"),
    sources: sources.map((s) => sourceView(s, terms, maxPassageChars)),
  });
  const { value } = await ask(ctx, {
    role: "writer", tag: "claims", user, maxTokens: 5000, temperature: 0.1,
    check: (v) => (Array.isArray(v?.claims) && v.claims.length ? [] : ["answer must be {\"claims\":[...]} with at least one claim"]),
  });
  const kept = [], dropped = [];
  for (const c of value.claims) {
    const why = groundingProblem(c, { sourceById, categories: channel.categories, topic });
    if (why) { dropped.push({ claim: c.claim, reason: why }); continue; }
    if (kept.some((k) => overlap(k.claim, c.claim).jaccard > 0.8)) { dropped.push({ claim: c.claim, reason: "duplicate of a kept claim" }); continue; }
    const src = sourceById.get(c.source_id);
    kept.push({
      claim_id: `c${kept.length + 1}`, claim: norm(c.claim), source_id: c.source_id, source_url: src.url, published: src.published ?? null,
      excerpt: norm(c.excerpt), confidence: c.confidence, context: norm(c.context || ""),
      contradictory_evidence: Array.isArray(c.contradictory_evidence) ? c.contradictory_evidence.map(norm) : [], editorial_status: c.editorial_status,
    });
  }
  for (const k of kept) assertValid("claim-record", k);
  if (kept.length < minClaims) throw new InsufficientEvidence(`${kept.length} of ${value.claims.length} proposed claims were grounded (need ${minClaims})`, dropped);
  const usedSources = [...new Set(kept.map((k) => k.source_id))];
  return { claims: kept, dropped, sources: usedSources.map((id) => ({ source_id: id, url: sourceById.get(id).url, published: sourceById.get(id).published ?? null })) };
}

/** Records are checked again wherever a script is judged, so a hand-built or legacy record cannot slip through. */
export function claimRecordProblems(claims) {
  const out = [];
  const ids = new Set();
  for (const c of claims) {
    out.push(...validate("claim-record", c));
    if (ids.has(c.claim_id)) out.push(`duplicate claim_id ${c.claim_id}`);
    ids.add(c.claim_id);
    if (c.excerpt && c.claim && content(c.claim).length && overlap(c.claim, c.excerpt).shared === 0) out.push(`${c.claim_id}: claim shares no content with its excerpt`);
  }
  return out;
}
