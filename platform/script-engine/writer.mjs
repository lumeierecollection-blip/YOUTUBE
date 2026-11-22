/**
 * writer.mjs: blueprint + claims -> script package. Several hooks are written, the strongest HONEST one is
 * chosen by code (hooks.mjs). Duration is computed from the voice's measured words per minute; a story that
 * does not fit is narrowed by the engine, never read faster. Shorts follow WATCH; long form is a separate
 * prompt and separate limits.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ask } from "./llm.mjs";
import { CLICKBAIT } from "./channels.mjs";
import { FORMULAS, chooseHook } from "./hooks.mjs";
import { estimateSeconds, capacityWords } from "./duration.mjs";
import { prompt } from "./prompt.mjs";
import { ROOT, assertValid } from "./schema.mjs";
import { norm, wordCount } from "./text.mjs";

const method = (mode) => readFileSync(join(ROOT, `prompts/script-engine/method-${mode === "short" ? "short" : "long"}.md`), "utf8");

export function writerStructureProblems(out, { blueprint, claims, profile }) {
  const p = [];
  const ids = new Set(claims.map((c) => c.claim_id));
  if (!Array.isArray(out?.sentences) || !out.sentences.length) return ["sentences must be a non-empty array"];
  if (!Array.isArray(out.hook_options) || out.hook_options.length < 2) p.push("hook_options needs at least two different hooks");
  const order = blueprint.beats.map((b) => b.beat_id);
  let last = -1;
  const seen = new Set();
  out.sentences.forEach((s, i) => {
    const at = `sentence ${i + 1}`;
    for (const k of ["beat_id", "text", "role", "link_from_previous", "on_screen_text"]) if (typeof s[k] !== "string" || !s[k].trim()) p.push(`${at}: "${k}" is required`);
    if (!Array.isArray(s.claim_ids)) p.push(`${at}: claim_ids must be an array`);
    const bi = order.indexOf(s.beat_id);
    if (bi < 0) p.push(`${at}: beat_id "${s.beat_id}" is not in the blueprint`);
    else { if (bi < last) p.push(`${at}: beats must stay in blueprint order`); last = Math.max(last, bi); seen.add(s.beat_id); }
    for (const c of s.claim_ids || []) if (!ids.has(c)) p.push(`${at}: claim ${c} does not exist`);
    if (wordCount(s.text) > profile.maxSentenceWords) p.push(`${at}: ${wordCount(s.text)} words; the limit is ${profile.maxSentenceWords}`);
  });
  for (const b of order) if (!seen.has(b)) p.push(`beat ${b} has no sentence; every blueprint beat must be told`);
  if (out.sentences.length > profile.maxSentences) p.push(`${out.sentences.length} sentences; the limit is ${profile.maxSentences}`);
  return p;
}

/** Hook list as the engine will record it: scores and honesty computed by code, not trusted from the model. */
export function pickHook(hookOptions, { claims, blueprint, sentencesText, profile, reject }) {
  const payoffBeat = blueprint.beats.find((b) => b.role === "payoff");
  return chooseHook(hookOptions.map((h) => ({ text: norm(h.text), family: FORMULAS.includes(h.family) ? h.family : "the-question", honest: h.honest !== false, claim_ids: Array.isArray(h.claim_ids) ? h.claim_ids : [] })), {
    claims, payoff: sentencesText.payoff || payoffBeat?.purpose, central_question: blueprint.central_question, profile, reject,
  });
}

export function assemble({ channel, topic, blueprint, claims, out, hooks, wpm, format }) {
  const sentences = out.sentences.map((s, i) => ({
    sentence_id: `s${i + 1}`, beat_id: s.beat_id, text: norm(s.text), role: norm(s.role), claim_ids: [...new Set(s.claim_ids)],
    link_from_previous: i === 0 ? "opening" : norm(s.link_from_previous), on_screen_text: norm(s.on_screen_text || ""),
  }));
  const ids = new Set(claims.map((c) => c.claim_id));
  if (hooks.selected && norm(hooks.selected.text) !== sentences[0].text) {
    sentences[0].text = hooks.selected.text;
    sentences[0].claim_ids = hooks.selected.claim_ids.filter((c) => ids.has(c));
  }
  const textOf = (role) => sentences.filter((s) => blueprint.beats.find((b) => b.beat_id === s.beat_id)?.role === role).map((s) => s.text).join(" ");
  const used = new Set(sentences.flatMap((s) => s.claim_ids));
  const usedClaims = claims.filter((c) => used.has(c.claim_id));
  const total = sentences.map((s) => s.text).join(" ");
  const pkg = {
    channel: channel.key, topic, format: channel.format, target_seconds: channel.profile.targetSeconds, blueprint,
    hook_options: hooks.options.map((h) => ({ text: h.text, family: h.family, honest: h.honest, score: h.score })),
    selected_hook: sentences[0].text, sentences, payoff: textOf("payoff"), ending: textOf("ending"), cta: typeof out.cta === "string" && out.cta.trim() ? norm(out.cta) : null,
    sources: [...new Map(usedClaims.map((c) => [c.source_id, { source_id: c.source_id, url: c.source_url, published: c.published ?? null }])).values()],
    claims: usedClaims, duration_estimate_s: estimateSeconds(total, wpm.wpm), quality_report: { status: "pending" },
  };
  return pkg;
}

export async function writeScript(ctx, { channel, topic, blueprint, claims, wpm, previous = null, issues = [], targetSeconds = channel.profile.targetSeconds, avoid = [], hookReject = null }) {
  const profile = channel.profile;
  const maxWords = capacityWords(targetSeconds, wpm.wpm);
  const claimsText = claims.map((c) => ({ claim_id: c.claim_id, category: c.editorial_status, claim: c.claim, source_words: c.excerpt }));
  const revision = previous
    ? `REVISION. Here is your previous draft, followed by the problems found by code and by an independent reviewer. Fix EVERY problem. Keep every sentence that has no problem word for word. Do not add facts. If a problem says the script is too long, remove detail; never remove a blueprint beat and never assume a faster voice.\nPREVIOUS DRAFT:\n${JSON.stringify({ hook_options: previous.hook_options.map(({ text, family }) => ({ text, family })), sentences: previous.sentences.map(({ beat_id, text, role, claim_ids, link_from_previous, on_screen_text }) => ({ beat_id, text, role, claim_ids, link_from_previous, on_screen_text })) }, null, 1)}\nPROBLEMS:\n${issues.map((i) => `- ${i.sentence_ids?.length ? `[${i.sentence_ids.join(",")}] ` : ""}${i.problem}${i.fix ? ` Fix: ${i.fix}` : ""}`).join("\n")}`
    : "";
  const user = prompt("writer", {
    format_label: profile.mode === "short" ? "YouTube Short" : "long-form YouTube video", channel_name: channel.name, editorial: channel.editorial, voice: channel.voice, guidance: channel.guidance,
    method: method(profile.mode), blueprint, claims: claimsText, max_words: String(maxWords), wpm: String(wpm.wpm), target_seconds: String(Math.round(targetSeconds)),
    max_sentence_words: String(profile.maxSentenceWords), hook_count: profile.mode === "short" ? "4" : "3", formulas: FORMULAS.join(", "), hook_words: String(profile.hookMaxWords),
    per_beat: profile.mode === "short" ? "2" : "8", revision,
  });
  const { value: out, provider, model } = await ask(ctx, {
    role: "writer", tag: previous ? "writer-revise" : "writer", user, avoid, maxTokens: profile.mode === "short" ? 7000 : 14000, temperature: 0.5,
    check: (v) => writerStructureProblems(v, { blueprint, claims, profile }),
  });
  const body = out.sentences.map((s) => s.text).join(" ");
  const hooks = pickHook(out.hook_options, { claims, blueprint, sentencesText: { payoff: out.sentences.filter((s) => blueprint.beats.find((b) => b.beat_id === s.beat_id)?.role === "payoff").map((s) => s.text).join(" ") }, profile, reject: hookReject });
  if (!hooks.selected) return { pkg: null, hooks, provider, model, raw: out, noHonestHook: hooks.options.flatMap((h) => h.dishonest_reasons.map((r) => `"${h.text}": ${r}`)).slice(0, 8) };
  const pkg = assemble({ channel, topic, blueprint, claims, out, hooks, wpm, format: channel.format });
  const stock = pkg.sentences.filter((s) => CLICKBAIT.test(s.text)).map((s) => s.sentence_id);
  return { pkg, hooks, provider, model, raw: out, stockPhrases: stock, maxWords, words: wordCount(body) };
}

export function validatePackage(pkg) {
  return assertValid("script-package", pkg);
}
