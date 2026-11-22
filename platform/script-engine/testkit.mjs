/**
 * Helpers for the tests only: a scripted stand-in for the model and a package builder.
 * Everything built here is CONSTRUCTED and labelled as such where it is used.
 */
import { estimateSeconds } from "./duration.mjs";
import { sentences as splitSentences } from "./text.mjs";

/**
 * handlers: { [tag]: value | (call, n) => value | [values by call index] }. A handler may return
 * { __error: "quota_exhausted" } to simulate a provider that cannot answer. `providers` names who answers a role.
 */
export function scriptedLLM(handlers, { providers = { writer: "gemini", critic: "groq", judge: "groq" } } = {}) {
  const counts = {};
  const log = [];
  const llm = async (call) => {
    const n = counts[call.tag] = (counts[call.tag] ?? 0) + 1;
    let h = handlers[call.tag];
    if (h === undefined) throw new Error(`stub has no handler for tag "${call.tag}"`);
    if (Array.isArray(h)) h = h[Math.min(n - 1, h.length - 1)];
    if (typeof h === "function") h = h(call, n);
    log.push({ tag: call.tag, role: call.role, n, avoid: call.avoid, user: call.user });
    if (h && h.__error) return { value: null, provider: null, error: h.__error, chain: [`stub:${h.__error}`] };
    const provider = providers[call.role] ?? "gemini";
    const same = (call.avoid || []).includes(provider);
    return { value: h, provider, error: null, chain: [provider], same_provider: same };
  };
  llm.log = log; llm.counts = counts;
  return llm;
}

const ROLE_BY_POS = (i, n) => (i === 0 ? "opening" : i === n - 1 ? "ending" : i === n - 2 ? "payoff" : "development");

/** beats: [{ id, role?, claims:[], link, purpose }]; sentences: [{ beat, text, claims:[], link, osd }] */
export function buildPackage({ channel = "ai-tested", topic, question, thesis, conclusion, claims, beats, sentences, hooks, wpm = 160, format = "short" }) {
  const bp = {
    central_question: question, thesis, why_it_matters: "It tells the viewer how much the tool could save them.", viewer_start: "Knows the tool exists.", viewer_end: "Understands what it does and what the evidence for it is.",
    key_evidence: [...new Set(beats.flatMap((b) => b.claims))], conclusion: conclusion || thesis,
    beats: beats.map((b, i) => ({ beat_id: b.id, role: b.role || ROLE_BY_POS(i, beats.length), purpose: b.purpose, claim_ids: b.claims, link_from_previous: i ? b.link || "explanation" : "none" })),
    questions_raised: [{ question, raised_in: beats[0].id, answered_in: beats.at(-2).id }],
  };
  const sents = sentences.map((s, i) => ({ sentence_id: `s${i + 1}`, beat_id: s.beat, text: s.text, role: s.role || "states a point", claim_ids: s.claims || [], link_from_previous: i ? s.link : "opening", on_screen_text: s.osd || "on screen" }));
  const used = new Set(sents.flatMap((s) => s.claim_ids));
  const usedClaims = claims.filter((c) => used.has(c.claim_id));
  const roleOf = (id) => bp.beats.find((b) => b.beat_id === id)?.role;
  return {
    channel, topic, format, target_seconds: 27, blueprint: bp,
    hook_options: hooks || [{ text: sents[0].text, family: "the-question", honest: true, score: 60 }, { text: `${sents[0].text.replace(/\?$/, "")}, in numbers?`, family: "the-statistic", honest: true, score: 50 }],
    selected_hook: sents[0].text, sentences: sents, payoff: sents.filter((s) => roleOf(s.beat_id) === "payoff").map((s) => s.text).join(" "), ending: sents.filter((s) => roleOf(s.beat_id) === "ending").map((s) => s.text).join(" "), cta: null,
    sources: [...new Map(usedClaims.map((c) => [c.source_id, { source_id: c.source_id, url: c.source_url, published: c.published ?? null }])).values()], claims: usedClaims,
    duration_estimate_s: estimateSeconds(sents.map((s) => s.text).join(" "), wpm), quality_report: { status: "pending" },
  };
}

export const claim = (id, text, { status = "established_fact", url = "https://example.test/page", excerpt = text, source = "s1" } = {}) => ({
  claim_id: id, claim: text, source_id: source, source_url: url, published: null, excerpt, confidence: "high", context: "", contradictory_evidence: [], editorial_status: status,
});

export { splitSentences };

// ---- A hand-written GOOD script on the REAL workers research (claims come from fixtures/real/workers.research.json) ----
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { claimsFromResearch } from "./legacy.mjs";

export function workersGood() {
  const research = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/real/workers.research.json"), "utf8"));
  const claims = claimsFromResearch(research).map((c) => ({ ...c, editorial_status: "established_fact" }));
  const id = (re) => claims.find((c) => re.test(c.claim)).claim_id;
  const us = id(/19 percent of respondents/), uk = id(/^In the United Kingdom, 13 percent/), both = id(/^Across both the United States and the United Kingdom combined/);
  const pkg = buildPackage({
    channel: "world-view", topic: "Workers replaced by AI who were asked back", question: "How many workers replaced by AI were asked back?",
    thesis: "About one in five U.S. workers replaced by AI were asked back, a bit more than in the United Kingdom", claims, wpm: 150,
    beats: [
      { id: "b1", claims: [us], purpose: "opens on the U.S. share of workers replaced by AI who were asked back" },
      { id: "b2", claims: [uk], purpose: "compares the U.K. share of workers asked back", link: "comparison" },
      { id: "b3", claims: [both], purpose: "gives the combined share of workers asked back", link: "explanation" },
      { id: "b4", claims: [us, both], purpose: "ends on the U.S. share against the combined share", link: "comparison" },
    ],
    sentences: [
      { beat: "b1", text: "In one survey, 19 percent of U.S. workers replaced by AI were asked to return.", claims: [us], osd: "19% asked back" },
      { beat: "b2", text: "In the United Kingdom, the rate was 13 percent.", claims: [uk], link: "compares that rate with the rate for the United Kingdom", osd: "UK: 13%" },
      { beat: "b3", text: "Across the two countries combined, the rate was 16 percent.", claims: [both], link: "combines the two rates into one number", osd: "Combined: 16%" },
      { beat: "b4", text: "So the U.S. rate of 19 percent sits above the combined 16 percent.", claims: [us, both], link: "returns to the first rate now that the combined rate is known", osd: "19% vs 16%" },
    ],
  });
  return { pkg, claims, ids: { us, uk, both } };
}
