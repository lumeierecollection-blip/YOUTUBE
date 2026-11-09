/**
 * Model access for the engine, in one place.
 *
 * An `llm` is an async function ({ role, tag, system, user, avoid, maxTokens, temperature })
 *   -> { value, provider, error, chain, wait_ms? }
 * The live one wraps callLLMWithProvenance from src/lib/llm.js. Tests pass a stub with the same shape.
 *
 * Writer and critic are different roles. The live llm pins a provider per call (FORCE_PROVIDER, the repo's own
 * mechanism) so the critic can be sent to a provider other than the writer's. If only one provider has a key,
 * the critic still runs as its own call with its own prompt, and the quality report says
 * `same_provider: true`; that is stated, not hidden.
 */
import { parseJson } from "./text.mjs";

export class ProviderExhausted extends Error {
  constructor(role, detail, chain = []) { super(`no provider could answer for ${role}: ${detail}`); this.kind = "provider_exhausted"; this.role = role; this.detail = detail; this.chain = chain; }
}
export class BadModelOutput extends Error {
  constructor(role, detail) { super(`${role} gave unusable output: ${detail}`); this.kind = "bad_model_output"; this.role = role; this.detail = detail; }
}

const hasKey = {
  gemini: () => !!(process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY_3 || process.env.GEMINI_API_KEY_4 || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
  "ollama-cloud": () => !!process.env.OLLAMA_API_KEY,
  openrouter: () => !!process.env.OPENROUTER_API_KEY,
  groq: () => !!process.env.GROQ_API_KEY,
};
/** Preference per role. Writer: Gemini first (the repo's rule: Gemini writes, others judge). Critic: anything else first. */
const ORDER = {
  writer: ["gemini", "openrouter", "ollama-cloud", "groq"],
  critic: ["groq", "ollama-cloud", "openrouter", "gemini"],
  judge: ["gemini", "groq", "ollama-cloud", "openrouter"],
};
/** When a role runs on Gemini it asks for a different Gemini model than the writer (default gemini-3.5-flash-lite): a separate model call, and a separate per-model quota. */
const GEMINI_MODEL = { critic: "gemini-3.8-flash", judge: "gemini-3.6-flash" };
const QUOTA = new Set(["quota_exhausted", "unavailable", "budget_exhausted", "no_key"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function liveLLM({ log = console.error } = {}) {
  return async function llm({ role = "writer", tag = "script-engine", system, user, avoid = [], maxTokens = 3500, temperature = 0.3 }) {
    const { callLLMWithProvenance, isProviderError } = await import("../../src/lib/llm.js");
    const order = (ORDER[role] || ORDER.writer).filter((p) => hasKey[p]());
    const preferred = order.filter((p) => !avoid.includes(p));
    const attempts = [...preferred, ...order.filter((p) => avoid.includes(p))];
    const chain = [];
    const messages = [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: user }];
    for (const provider of attempts) {
      for (let pass = 0; pass < 2; pass++) {
        const prev = process.env.FORCE_PROVIDER;
        process.env.FORCE_PROVIDER = provider;
        let r;
        try { r = await callLLMWithProvenance(messages, { maxTokens, temperature, keepAlive: 0, noCache: true, ...(provider === "gemini" && GEMINI_MODEL[role] ? { model: GEMINI_MODEL[role] } : {}) }, `script-engine-${tag}`); }
        catch (e) { r = { value: { error: "hard_error", detail: e.message }, provider, error: "hard_error", chain: [provider] }; }
        finally { if (prev === undefined) delete process.env.FORCE_PROVIDER; else process.env.FORCE_PROVIDER = prev; }
        const failed = r.error || isProviderError(r.value);
        if (!failed) return { value: r.value, provider, model: provider === "gemini" ? (GEMINI_MODEL[role] || "gemini-3.5-flash-lite") : null, error: null, chain: [...chain, provider], same_provider: avoid.includes(provider) };
        const kind = r.error || r.value?.error || "error";
        const detail = String(r.value?.detail || "");
        const hint = detail.match(/try again in (?:(\d+)m)?([\d.]+)s/i);
        const waitS = hint ? (Number(hint[1] || 0) * 60 + Number(hint[2])) : 0;
        if (kind === "quota_exhausted" && waitS > 0 && waitS <= 45 && pass === 0) { log(`[script-engine] ${provider} asks for ${waitS}s; waiting once`); await sleep(waitS * 1000 + 500); continue; }
        chain.push(`${provider}:${kind}`);
        log(`[script-engine] ${role}/${tag}: ${provider} ${kind} ${detail.slice(0, 100)}`);
        break;
      }
    }
    const kinds = chain.map((c) => c.split(":")[1]);
    return { value: null, provider: null, error: kinds.length && kinds.every((k) => QUOTA.has(k)) ? "quota_exhausted" : kinds.length ? "provider_error" : "no_provider_configured", chain };
  };
}

/**
 * One validated model call: parse JSON, run `check(value) -> string[]` problems, and on a bad answer retry
 * ONCE with the problems quoted back. A provider that cannot answer throws ProviderExhausted; a model that
 * keeps answering badly throws BadModelOutput. Neither is ever turned into a pass.
 */
export async function ask(ctx, { role, tag, system, user, check = () => [], avoid = [], maxTokens, temperature }) {
  const calls = ctx.calls ?? (ctx.calls = []);
  let prompt = user;
  let lastProblems = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const t0 = Date.now();
    const r = await ctx.llm({ role, tag, system, user: prompt, avoid, maxTokens, temperature });
    const rec = { role, tag, attempt, provider: r.provider, model: r.model ?? null, chain: r.chain, ms: Date.now() - t0, error: r.error || null, same_provider: !!r.same_provider };
    calls.push(rec);
    if (r.error || r.value == null) throw new ProviderExhausted(role, r.error || "empty answer", r.chain);
    const value = parseJson(r.value);
    const problems = value == null ? ["the answer was not valid JSON"] : check(value);
    if (!problems.length) { rec.ok = true; return { value, provider: r.provider, model: r.model ?? null, same_provider: !!r.same_provider }; }
    rec.ok = false; rec.problems = problems.slice(0, 6);
    lastProblems = problems;
    prompt = `${user}\n\nYour previous answer was rejected for these reasons. Fix every one and return the complete JSON again:\n- ${problems.slice(0, 10).join("\n- ")}`;
  }
  throw new BadModelOutput(role, lastProblems.slice(0, 4).join("; "));
}
