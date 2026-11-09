/**
 * critic.mjs: an independent review. A different ROLE (own prompt, own call) and, where a second provider has
 * a key, a different PROVIDER from the writer. The critic's answer must satisfy critique.schema.json and the
 * thirteen questions; code, not the critic, decides whether "approve" is allowed to stand. Nothing the writer
 * says about its own work is ever read as approval.
 */
import { ask } from "./llm.mjs";
import { CATEGORIES } from "./continuity.mjs";
import { prompt } from "./prompt.mjs";
import { validate } from "./schema.mjs";

export const QUESTIONS = ["makes_sense", "sections_follow", "no_unsupported_claims", "no_misleading_claims", "hook_represents_video", "natural_transitions", "sounds_human", "no_repetition", "no_missing_explanations", "ending_delivers", "visuals_correspond", "right_for_channel", "realistic_duration"];
export const THRESHOLDS = { coherence: 8, factual_support: 8, hook_effectiveness: 7, retention_pacing: 7, visual_alignment: 7 };

export function critiqueProblems(v, pkg) {
  const p = validate("critique", { reviewer: "x", ...v });
  const ids = new Set(pkg.sentences.map((s) => s.sentence_id));
  for (const q of QUESTIONS) if (typeof v?.answers?.[q]?.ok !== "boolean") p.push(`answers.${q}.ok must be true or false`);
  for (const x of v?.findings || []) for (const i of x.sentence_ids || []) if (!ids.has(i)) p.push(`finding names sentence "${i}" which does not exist`);
  if (v?.verdict === "revise" && !(v.required_corrections || []).length && !(v.findings || []).length) p.push("a revise verdict must list required_corrections or findings");
  return p;
}

/**
 * The verdict that stands. A critic's "approve" is demoted to "revise" whenever its own answers say otherwise.
 * (The reverse is not applied: code never promotes a script the critic rejected.)
 */
export function effectiveVerdict(c) {
  const reasons = [];
  for (const q of QUESTIONS) if (c.answers[q].ok === false) reasons.push(`${q}: ${c.answers[q].note || "not ok"}`);
  for (const [k, min] of Object.entries(THRESHOLDS)) if (c.scores[k] < min) reasons.push(`${k} ${c.scores[k]} is under ${min}`);
  for (const x of c.findings) if (x.severity === "critical" || x.severity === "major") reasons.push(`${x.severity} finding: ${x.problem}`);
  if (c.unexplained_claims.length) reasons.push(`${c.unexplained_claims.length} unexplained claim(s)`);
  if (c.contradictions.length) reasons.push(`${c.contradictions.length} contradiction(s)`);
  const verdict = c.verdict === "approve" && !reasons.length ? "approve" : "revise";
  return { verdict, overridden: c.verdict === "approve" && verdict === "revise", reasons };
}

export async function critique(ctx, { pkg, claims, channel, known = [], writerProvider, wpm, limit }) {
  const avoid = writerProvider ? [writerProvider] : [];
  const { value, provider, same_provider } = await ask(ctx, {
    role: "critic", tag: "critic", avoid, maxTokens: 3500, temperature: 0,
    user: prompt("critic", {
      channel_name: channel.name, editorial: channel.editorial, guidance: channel.guidance, central_question: pkg.blueprint.central_question, thesis: pkg.blueprint.thesis,
      claims: claims.map((c) => ({ claim_id: c.claim_id, category: c.editorial_status, claim: c.claim, source_words: c.excerpt })),
      sentences: pkg.sentences.map((s) => ({ id: s.sentence_id, text: s.text, claims: s.claim_ids, because: s.link_from_previous, on_screen: s.on_screen_text })),
      hooks: pkg.hook_options.map((h) => `"${h.text}" (${h.family}, ${h.honest ? "honest" : "rejected"})`).join(" | "), estimate: String(pkg.duration_estimate_s), wpm: String(wpm.wpm), limit: String(limit),
      known: known.length ? known.map((k) => `[${k.sentence_ids.join(",")}] ${k.problem}`).join("\n") : "(none)", categories: CATEGORIES.join(", "),
    }),
    check: (v) => critiqueProblems(v, pkg),
  });
  const reviewer = `critic/${provider}`;
  const record = { reviewer, verdict: value.verdict, scores: value.scores, unexplained_claims: value.unexplained_claims, contradictions: value.contradictions, required_corrections: value.required_corrections, findings: value.findings, answers: value.answers };
  const eff = effectiveVerdict(record);
  const out = { ...record, verdict: eff.verdict, critic_verdict: value.verdict, verdict_overridden: eff.overridden, blocking_reasons: eff.reasons, provider, same_provider: !!same_provider, writer_provider: writerProvider || null };
  return out;
}
