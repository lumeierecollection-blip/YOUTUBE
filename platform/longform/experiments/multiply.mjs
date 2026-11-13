#!/usr/bin/env node
/**
 * AI Tested long-form sample: a REAL test, run on the GitHub runner. "At what size does AI multiplication break?"
 * Every available model multiplies two random n-digit numbers, n = 2..10, ten problems per size, answer-only. Then the sizes 6..10 again
 * (five problems each) with "show your working". Code using BigInt marks every reply. Every raw reply is kept in the output JSON, so each
 * figure in the episode traces to a reply. Nothing is retried to improve a score: a retry happens only on a transport error.
 * Models: whatever answers on the day (Gemini via the existing runner; Cerebras-hosted models listed live from its /v1/models). The file
 * records which were available. Usage: node platform/longform/experiments/multiply.mjs <out.json>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { CANDIDATES, askWithRetry } from "../../channels/ai-tested/experiment.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let seed = 20261113;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const nDigit = (n) => { let s = String(1 + Math.floor(rnd() * 9)); while (s.length < n) s += Math.floor(rnd() * 10); return s; };
export function buildProblems() {
  const direct = [], worked = [];
  for (let n = 2; n <= 10; n++) for (let i = 0; i < 10; i++) { const a = nDigit(n), b = nDigit(n); direct.push({ digits: n, a, b, correct: (BigInt(a) * BigInt(b)).toString(), mode: "direct", prompt: `What is ${a} × ${b}? Reply with only the number, no words and no working.` }); }
  for (let n = 6; n <= 10; n++) for (let i = 0; i < 5; i++) { const p = direct.filter((d) => d.digits === n)[i]; worked.push({ ...p, mode: "worked", prompt: `What is ${p.a} × ${p.b}? Work it out step by step, then give the final answer on the last line as: ANSWER: <number>` }); }
  return [...direct, ...worked];
}
const digitsOnly = (s) => s.replace(/[,_\s.](?=\d)/g, "");
export function parseAnswer(reply, mode) {
  const text = String(reply || "");
  if (mode === "worked") { const m = /ANSWER:\s*\**\s*([\d,._\s]+)/i.exec(text); if (m) return digitsOnly(m[1].trim()).replace(/\D/g, "") || null; const all = digitsOnly(text).match(/\d{4,}/g); return all ? all.at(-1) : null; }
  const m = digitsOnly(text).match(/\d+/); return m ? m[0] : null;
}

async function cerebrasModels() {
  const key = process.env.CEREBRAS_API_KEY; if (!key) return [];
  try {
    const r = await fetch("https://api.cerebras.ai/v1/models", { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) return [];
    const ids = ((await r.json()).data || []).map((m) => m.id);
    const ask = (id) => async (text) => {
      const q = await fetch("https://api.cerebras.ai/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model: id, temperature: 0, max_tokens: 4096, messages: [{ role: "user", content: text }] }), signal: AbortSignal.timeout(90000) });
      if (!q.ok) throw Object.assign(new Error(`HTTP ${q.status}`), { status: q.status });
      return String((await q.json()).choices?.[0]?.message?.content || "").trim();
    };
    return ids.slice(0, 3).map((id) => ({ name: id, id: `cerebras/${id}`, host: "Cerebras", ask: ask(id), pause: 6000, listed: ids }));
  } catch { return []; }
}

/** Other text models the Google key can call on the day (listed live, so no model name is assumed): open Gemma models and other Flash tiers. */
async function googleListed() {
  const keys = ["GEMINI_API_KEY_1", "GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4"].map((k) => process.env[k]).filter(Boolean);
  if (!keys.length || !process.env.LIST_GOOGLE) return [];
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${keys[0]}`, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) return [];
    const all = ((await r.json()).models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => m.name.replace("models/", ""));
    console.error("google models listed:", all.join(", "));
    const pick = all.filter((id) => /gemma|flash|pro/.test(id) && !/image|tts|audio|live|embed|vision|exp|preview|learn|latest|thinking/.test(id)).slice(0, 12);
    const ask = (id) => async (text) => {
      let last;
      for (const key of keys) {
        const q = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent?key=${key}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { temperature: 0, maxOutputTokens: 4096 } }), signal: AbortSignal.timeout(90000) });
        if (q.ok) return ((await q.json()).candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
        last = Object.assign(new Error(`HTTP ${q.status}`), { status: q.status });
        if (q.status !== 429) throw last;
      }
      throw last;
    };
    return pick.map((id) => ({ name: id, id, host: "Google AI Studio", ask: ask(id), pause: 4500 }));
  } catch { return []; }
}

if (process.argv[1] && process.argv[1].endsWith("multiply.mjs")) {
  const out = process.argv[2] || "output/longform-experiment/multiply.json", problems = buildProblems();
  const skip = (process.env.SKIP_MODELS || "").split(",").filter(Boolean);
  const models = [...CANDIDATES.filter((c) => c.available()).map((c) => ({ ...c, host: c.id.startsWith("gemini") ? "Google AI Studio" : "Groq" })), ...(await googleListed()), ...(await cerebrasModels())].filter((m, i, all) => !skip.includes(m.id) && all.findIndex((x) => x.id === m.id) === i);
  console.error("models:", models.map((m) => m.id).join(", ") || "NONE");
  const results = [];
  for (const m of models) {
    const answers = []; let dropped = null;
    for (const p of problems) {
      try { const reply = await askWithRetry(m, p.prompt), answer = parseAnswer(reply, p.mode); answers.push({ digits: p.digits, mode: p.mode, a: p.a, b: p.b, correct: p.correct, reply: reply.slice(0, p.mode === "worked" ? 1500 : 200), answer, ok: answer === p.correct }); }
      catch (e) { dropped = `${e.message} after ${answers.length} answers`; break; }
      await sleep(m.pause);
    }
    const by = (mode) => Object.fromEntries([...new Set(answers.filter((a) => a.mode === mode).map((a) => a.digits))].map((d) => { const s = answers.filter((a) => a.mode === mode && a.digits === d); return [d, { right: s.filter((a) => a.ok).length, of: s.length }]; }));
    results.push({ name: m.name, id: m.id, host: m.host, complete: !dropped && answers.length === problems.length, dropped, direct: by("direct"), worked: by("worked"), answers });
    console.error(m.id, dropped ? `DROPPED: ${dropped}` : "complete", JSON.stringify(by("direct")));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ test: "n-digit multiplication, n=2..10", date: new Date().toISOString(), run_url: process.env.RUN_URL || null, seed: 20261113, problems: problems.length, method: "temperature 0; one attempt per problem; retries only on transport errors; marked by BigInt code", models: results }, null, 1));
  }
  if (!results.some((r) => r.answers.length)) { console.error("no model answered"); process.exit(1); }
}
