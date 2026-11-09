/**
 * legacy.mjs: runs scripts from the OLD pipeline (data/research/<ch>/<slug>-shorts-script.json + <slug>.json)
 * through the new gates, so a stored script can be judged by the same rules as a new one.
 *
 * Honest limits of the adapter:
 *  - old research has no page text, so a claim's "excerpt" is the research fact itself, not a page quotation;
 *  - old scripts record no claim_ids, so each sentence is mapped to the research facts it overlaps most
 *    (>= half of its content words); a sentence matching nothing gets no claim and is judged as unsupported;
 *  - old scripts record no transitions, so link_from_previous is a neutral placeholder. Only the rules that
 *    read the narration itself can fire on it; the transition rule (CON-01) is tested separately.
 */
import { estimateSeconds } from "./duration.mjs";
import { content, norm, numbers, sentences } from "./text.mjs";

const SECTION_ROLE = { hook: "opening", setup: "context", rehook: "development", payoff: "payoff", close: "ending" };

export function claimsFromResearch(research, { categoryFor = (fact) => (/\d/.test(fact) ? "measured_statistic" : "demonstrated_feature") } = {}) {
  const claims = [];
  const add = (claim, url, name) => claims.push({ claim_id: `c${claims.length + 1}`, claim: norm(claim), source_id: name || url, source_url: url, published: null, excerpt: norm(claim), confidence: "high", context: "", contradictory_evidence: [], editorial_status: categoryFor(claim) });
  for (const k of research.key_facts || []) add(k.fact, k.source_url, k.source_name);
  for (const n of research.numbers || []) add(`${n.label}: ${n.value} ${n.unit}`, n.source_url, n.source_url);
  return claims;
}

export function fromLegacy(script, research, { channelKey = "ai-tested", central_question, topic = script.topic_slug, thesis, wpm = 150 } = {}) {
  const claims = claimsFromResearch(research);
  const sents = [];
  for (const sec of script.sections) for (const text of sentences(sec.voiceover)) {
    const want = new Set(content(text));
    const scored = claims.map((c) => { const have = new Set(content(c.claim)); const shared = [...want].filter((w) => have.has(w)).length; return { id: c.claim_id, shared, frac: want.size ? shared / want.size : 0 }; }).filter((x) => x.shared >= 3 && x.frac >= 0.5).sort((a, b) => b.shared - a.shared).slice(0, 2);
    sents.push({ sentence_id: `s${sents.length + 1}`, beat_id: sec.id, text, role: sec.id, claim_ids: scored.map((x) => x.id), link_from_previous: sents.length ? "adapter placeholder: the legacy format records no transition" : "opening", on_screen_text: sec.text_overlay?.text || "" });
  }
  const beats = script.sections.map((sec, i) => ({ beat_id: sec.id, role: SECTION_ROLE[sec.id] || "development", purpose: `${sec.id} section of the legacy script, serving the question ${central_question}`, claim_ids: [...new Set(sents.filter((s) => s.beat_id === sec.id).flatMap((s) => s.claim_ids))], link_from_previous: i ? "explanation" : "none" }));
  const blueprint = { central_question, thesis: thesis || central_question.replace(/\?$/, ""), why_it_matters: "legacy", viewer_start: "legacy", viewer_end: "legacy", key_evidence: [...new Set(beats.flatMap((b) => b.claim_ids))], beats, questions_raised: [], conclusion: thesis || central_question.replace(/\?$/, "") };
  const used = new Set(sents.flatMap((s) => s.claim_ids));
  const usedClaims = claims.filter((c) => used.has(c.claim_id));
  const total = sents.map((s) => s.text).join(" ");
  const pkg = {
    channel: channelKey, topic, format: "short", target_seconds: 27, blueprint,
    hook_options: [{ text: script.hook, family: "the-statistic", honest: true }, { text: script.hook, family: "the-question", honest: true }], selected_hook: sents[0].text, sentences: sents,
    payoff: sents.filter((s) => s.beat_id === "payoff").map((s) => s.text).join(" "), ending: sents.filter((s) => s.beat_id === "close").map((s) => s.text).join(" "), cta: null,
    sources: [...new Map(usedClaims.map((c) => [c.source_url, { source_id: c.source_id, url: c.source_url, published: null }])).values()], claims: usedClaims,
    duration_estimate_s: estimateSeconds(total, wpm), quality_report: { status: "legacy" },
  };
  return { pkg, claims, numbersIn: numbers };
}
