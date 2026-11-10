/**
 * AI Tested: "Can AI pick a random number?" Each available model is asked 30 times for a random number from 1 to 10, and 30 times for
 * one from 1 to 100, at the default chat temperature (1.0), so repeated asks can differ. Code counts the replies. A fair pick would land on
 * each of 1-10 about 3 times in 30 (30 / 10). The story is only told if the measurement supports it: a number that dominates.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const geminiKeys = () => ["GEMINI_API_KEY_1", "GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4"].map((k) => process.env[k]).filter(Boolean);
const exhausted = new Set();
const T = 1.0;

async function callGemini(model, text) {
  let last;
  for (const key of geminiKeys()) {
    if (exhausted.has(key + model)) continue;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { temperature: T, maxOutputTokens: 512 } }), signal: AbortSignal.timeout(60000) });
    if (r.ok) { const j = await r.json(); return (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim(); }
    last = Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
    if (r.status !== 429) throw last;
    exhausted.add(key + model);
  }
  throw last || Object.assign(new Error("no Gemini key left for this model"), { status: 429 });
}
async function callGroq(model, text) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY}` }, body: JSON.stringify({ model, temperature: T, max_tokens: 512, messages: [{ role: "user", content: text }] }), signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return String((await r.json()).choices?.[0]?.message?.content || "").trim();
}
export const MODELS = [
  { name: "Gemini 3.5 Flash", speak: "Google's Gemini Flash", id: "gemini-3.5-flash", available: () => geminiKeys().length > 0, ask: (t) => callGemini("gemini-3.5-flash", t), pause: 3500 },
  { name: "Gemini 3.5 Flash-Lite", speak: "Google's Flash-Lite", id: "gemini-3.5-flash-lite", available: () => geminiKeys().length > 0, ask: (t) => callGemini("gemini-3.5-flash-lite", t), pause: 3500 },
  { name: "GPT-OSS 120B", speak: "OpenAI's GPT-OSS", id: "openai/gpt-oss-120b", available: () => !!process.env.GROQ_API_KEY, ask: (t) => callGroq("openai/gpt-oss-120b", t), pause: 1800 },
];
async function askWithRetry(model, text) {
  for (let attempt = 1; ; attempt++) {
    try { return await model.ask(text); } catch (e) { if (attempt >= 3 || (e.status === 429 && /no Gemini key/.test(e.message))) throw e; await sleep((e.status === 429 ? 20000 : 5000) * attempt); }
  }
}
export const promptFor = (hi) => `Pick a random number between 1 and ${hi}. Reply with only the number.`;
const parse = (reply, hi) => { const m = String(reply).match(/\d+/); const n = m ? Number(m[0]) : null; return n >= 1 && n <= hi ? n : null; };
export const ASKS = 30;

export async function measure({ runUrl, now = new Date(), log = console.error }) {
  const models = [];
  for (const m of MODELS.filter((c) => c.available())) {
    const out = { name: m.name, speak: m.speak, id: m.id, r10: [], r100: [] };
    try {
      for (const [hi, key] of [[10, "r10"], [100, "r100"]]) for (let i = 0; i < ASKS; i++) { const reply = await askWithRetry(m, promptFor(hi)); out[key].push(parse(reply, hi)); await sleep(m.pause); }
    } catch (e) { log(`[random] ${m.name} dropped: ${e.message} after ${out.r10.length}+${out.r100.length} replies`); continue; }
    models.push(out);
    log(`[random] ${m.name}: 1-10 top ${JSON.stringify(top(out.r10, 1))}, 1-100 top ${JSON.stringify(top(out.r100, 3))}`);
  }
  if (models.length < 2) throw new Error(`only ${models.length} model(s) completed; a comparison needs at least 2`);
  return { date: now.toISOString().slice(0, 10), run_url: runUrl, temperature: T, asks: ASKS, models };
}

/** The most common valid replies, ties broken by the smaller number. */
export function top(replies, n = 3) {
  const c = new Map();
  for (const r of replies) if (r !== null) c.set(r, (c.get(r) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, n).map(([value, count]) => ({ value, count }));
}
export const histogram = (replies, hi) => Array.from({ length: hi }, (_, i) => replies.filter((r) => r === i + 1).length);

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
export const say = (n) => (n <= 20 ? ONES[n] : n < 100 ? `${["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"][Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ""}` : String(n));
const times = (n) => (n === 1 ? "once" : `${say(n)} times`);

/** Claims, script, scenes and composition data, all built from the measured counts. */
export function plan(exp) {
  const ms = exp.models.map((m) => ({ ...m, h10: histogram(m.r10, 10), t10: top(m.r10, 1)[0], t100: top(m.r100, 3) }));
  const sevens = ms.filter((m) => m.t10.value === 7 && m.t10.count >= 0.4 * exp.asks);
  if (!sevens.length) throw new Error(`no model clearly favoured seven (top picks: ${ms.map((m) => `${m.name}: ${m.t10.value} x${m.t10.count}`).join("; ")}); this story is not supported`);
  const url = exp.run_url, date = exp.date, n2 = ms.length === 3 ? "three" : "two", fair = exp.asks / 10;
  const claim = (claim_id, text, status = "measured_statistic", source = "s1") => ({ claim_id, claim: text, source_id: source, source_url: source === "s1" ? url : "https://en.wikipedia.org/wiki/Blue%E2%80%93seven_phenomenon", published: date, excerpt: text, confidence: source === "s1" ? "high" : "medium", context: source === "s1" ? `Measured in this production's own test on ${date} at temperature ${exp.temperature} (a typical chat setting); results differ between runs. Models: ${ms.map((m) => m.name).join(", ")}.` : "Wikipedia, Blue-seven phenomenon: the effect is reported for the US and its existence is disputed.", editorial_status: status });
  const claims = [
    claim("design", `Each of ${n2} models was asked ${exp.asks} times for a random number from 1 to 10, and ${exp.asks} times for one from 1 to 100.`, "demonstrated_feature"),
    claim("fair", `A fair random pick from 1 to 10 would land on each number about ${fair} times in ${exp.asks}.`, "demonstrated_feature"),
    ...ms.map((m, i) => claim(`top${i}`, `${m.speak} replied ${m.t10.value} ${m.t10.count} times out of ${exp.asks} when asked for a number from 1 to 10.`)),
    ...ms.map((m, i) => claim(`hundred${i}`, `From 1 to 100, ${m.speak}'s most common reply was ${m.t100[0].value}, ${m.t100[0].count} times out of ${exp.asks}.`)),
    claim("blue7", "A reported effect called the blue-seven phenomenon says that most people in the US pick seven when asked for a random single-digit number; its existence is disputed.", "later_interpretation", "wiki-b7"),
  ];
  const V = (text, claim_ids = []) => ({ text, claim_ids });
  const NR = { allow_no_claim: true, editorial: "question, transition or recommendation drawn from the measured results" };
  const slots = [
    { id: "hook", scene: 0, ...NR, variants: [V("Can AI pick a random number?")] },
    { id: "design", scene: 1, variants: [V(`We asked ${n2} models for a number from one to ten, ${say(exp.asks)} times each.`, ["design"]), V(`${n2[0].toUpperCase()}${n2.slice(1)} models, one to ten, ${say(exp.asks)} times each.`, ["design"])] },
    { id: "fair", scene: 1, variants: [V(`A fair pick lands on each number about ${say(fair)} times.`, ["fair"])] },
    ...ms.map((m, i) => ({ id: `top${i}`, scene: 2, variants: [V(`${m.speak} said ${say(m.t10.value)}, ${times(m.t10.count)} out of ${say(exp.asks)}.`, [`top${i}`]), V(`${m.speak} said ${say(m.t10.value)}, ${times(m.t10.count)}.`, [`top${i}`])] })),
    { id: "notrandom", scene: 2, optional: true, ...NR, variants: [V("A random pick would vary, but this did not.")] },
    { id: "hundred0", scene: 3, variants: [V(`From one to a hundred, ${ms[0].speak} chose ${say(ms[0].t100[0].value)} most often, ${times(ms[0].t100[0].count)}.`, ["hundred0"])] },
    ...ms.slice(1).map((m, i) => ({ id: `hundred${i + 1}`, scene: 3, optional: true, variants: [V(`${m.speak} chose ${say(m.t100[0].value)} most often, ${times(m.t100[0].count)}.`, [`hundred${i + 1}`])] })),
    { id: "blue7", scene: 4, variants: [V("People reportedly do it too: the blue-seven effect.", ["blue7"])] },
    { id: "tip1", scene: 5, ...NR, variants: [V("For a fair draw, use dice, or ask AI to write code.")] },
    { id: "tip2", scene: 5, ...NR, variants: [V("Never let it pick your giveaway winner.")] },
  ];
  const scenes = [
    { kind: "hook3", treatment: "kinetic-question", objective: "Pose the question over the numbers one to ten", background: "white" },
    { kind: "setup3", treatment: "process-diagram", objective: "Show the prompt, the number of asks and what a fair pick would look like", background: "white" },
    { kind: "hist", treatment: "bar-chart", objective: "Show each model's thirty replies as a count per number from one to ten against the fair line", background: "white" },
    { kind: "hist100", treatment: "bar-chart", objective: "Show each model's most common replies from one to a hundred", background: "white" },
    { kind: "why", treatment: "quote-card", objective: "Show the Wikipedia statement that people reportedly favour seven too, with its caveat", background: "white" },
    { kind: "tip", treatment: "verdict-panel", objective: "Close with what to do instead: dice, or code that uses a random function", background: "accent panel" },
  ];
  const data = { date, asks: exp.asks, fair, temperature: exp.temperature, prompt10: promptFor(10), models: ms.map((m) => ({ name: m.name, speak: m.speak, id: m.id, h10: m.h10, top10: m.t10, top100: m.t100, h100_top: m.t100 })) };
  return { claims, slots, scenes, data, sources: [{ source_id: "s1", url, published: date, title: "AI Tested random-number test run" }, { source_id: "wiki-b7", url: "https://en.wikipedia.org/wiki/Blue%E2%80%93seven_phenomenon", published: date, title: "Blue-seven phenomenon (Wikipedia)" }] };
}
