/**
 * A real test, run during the render: the same letter-counting questions go to each available model,
 * and code that knows the right answer marks them. The channel reports what it measured here, so a
 * claim in the video can be traced to a reply in `experiment.json`.
 */
const WORDS = [["strawberry", "r"], ["mississippi", "s"], ["banana", "a"], ["bookkeeper", "o"], ["committee", "t"], ["onomatopoeia", "o"], ["raspberry", "r"], ["occurrence", "c"], ["assessment", "s"], ["bubblegum", "b"]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const count = (word, letter) => [...word].filter((c) => c === letter).length;

function randomStrings(n, len, seed) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  return Array.from({ length: n }, () => {
    const word = Array.from({ length: len }, () => "abcdeghilmnoprst"[Math.floor(rnd() * 16)]).join("");
    return [word, word[Math.floor(rnd() * len)]];
  });
}

const prompt = (word, letter) => `How many times does the letter "${letter}" appear in "${word}"? Reply with only the number.`;
const geminiKeys = () => ["GEMINI_API_KEY_1", "GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4"].map((k) => process.env[k]).filter(Boolean);
const geminiKey = () => geminiKeys()[0];
const exhausted = new Set();

async function callGemini(model, text) {
  // Quota is per key and model, so a 429 moves on to the next key.
  let last;
  for (const key of geminiKeys()) {
    if (exhausted.has(key + model)) continue;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { temperature: 0, maxOutputTokens: 2048 } }), signal: AbortSignal.timeout(60000) });
    if (r.ok) { const j = await r.json(); return (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim(); }
    last = Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
    if (r.status !== 429) throw last;
    exhausted.add(key + model);
  }
  throw last || Object.assign(new Error("no Gemini key left for this model"), { status: 429 });
}

async function callOpenAiStyle(url, key, model, text) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model, temperature: 0, max_tokens: 2048, messages: [{ role: "user", content: text }] }), signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  const j = await r.json();
  return String(j.choices?.[0]?.message?.content || "").trim();
}

export const CANDIDATES = [
  { name: "Gemini 3.5 Flash", speak: "Google's Gemini Flash", id: "gemini-3.5-flash", available: () => !!geminiKey(), ask: (t) => callGemini("gemini-3.5-flash", t), pause: 4500 },
  { name: "Gemini 3.5 Flash-Lite", speak: "Google's Flash-Lite", id: "gemini-3.5-flash-lite", available: () => !!geminiKey(), ask: (t) => callGemini("gemini-3.5-flash-lite", t), pause: 4500 },
  { name: "GPT-OSS 120B", speak: "OpenAI's GPT-OSS", id: "openai/gpt-oss-120b", available: () => !!process.env.GROQ_API_KEY, ask: (t) => callOpenAiStyle("https://api.groq.com/openai/v1/chat/completions", process.env.GROQ_API_KEY, "openai/gpt-oss-120b", t), pause: 2500 },
];

export async function askWithRetry(model, text) {
  for (let attempt = 1; ; attempt++) {
    try { return await model.ask(text); }
    catch (e) { if (attempt >= 4) throw e; await sleep((e.status === 429 ? 20000 : 5000) * attempt); }
  }
}

/** The first whole number in the reply. A reply with no number is marked wrong. */
const parse = (reply) => { const m = String(reply).match(/-?\d+/); return m ? Number(m[0]) : null; };

export function buildQuestions() {
  const seed = 20261109;
  return [...WORDS.map(([word, letter]) => ({ group: "real", word, letter })), ...randomStrings(10, 24, seed).map(([word, letter]) => ({ group: "random", word, letter }))].map((q) => ({ ...q, correct: count(q.word, q.letter), prompt: prompt(q.word, q.letter) }));
}

/** Asks every available model every question. Returns only the raw results; assemble() turns them into claims. */
export async function measure({ runUrl, now = new Date(), log = console.error }) {
  const questions = buildQuestions();
  const models = [];
  for (const m of CANDIDATES.filter((c) => c.available())) {
    const answers = [];
    try {
      for (const q of questions) {
        const reply = await askWithRetry(m, q.prompt);
        const answer = parse(reply);
        answers.push({ word: q.word, letter: q.letter, group: q.group, correct: q.correct, reply: reply.slice(0, 200), answer, ok: answer === q.correct });
        await sleep(m.pause);
      }
    } catch (e) { log(`[experiment] ${m.name} dropped: ${e.message} after ${answers.length} answers`); continue; }
    const score = (g) => answers.filter((a) => a.ok && (!g || a.group === g)).length;
    models.push({ name: m.name, speak: m.speak, id: m.id, correct: score(), real: score("real"), random: score("random"), answers });
    log(`[experiment] ${m.name}: ${score()}/${questions.length}`);
  }
  if (models.length < 2) throw new Error(`only ${models.length} model(s) answered every question; a comparison needs at least 2`);
  models.sort((a, b) => b.correct - a.correct);
  return { date: now.toISOString().slice(0, 10), run_url: runUrl, models };
}

const SPEAK = Object.fromEntries(CANDIDATES.map((c) => [c.name, c.speak]));

/** Turns one measurement into the facts the script is built from. A reused measurement keeps its original run as the source. */
export function assemble({ date, run_url: runUrl, models: raw, reused_from = null }) {
  const questions = buildQuestions();
  const models = raw.map((m) => ({ ...m, speak: SPEAK[m.name] || m.name }));
  const example = questions[0];
  const exampleReplies = models.map((m) => ({ model: m.name, reply: m.answers[0].reply, answer: m.answers[0].answer, ok: m.answers[0].ok }));
  // The widest miss across all models, so the video can show a real wrong answer if one exists.
  const miss = models.flatMap((m) => m.answers.filter((a) => !a.ok && a.answer !== null).map((a) => ({ ...a, model: m.name, error: Math.abs(a.answer - a.correct) }))).sort((a, b) => b.error - a.error)[0] || null;
  // One figure per sentence: these are heard once, and the script is built from them.
  const sameAnswer = exampleReplies.every((r) => r.answer === exampleReplies[0].answer);
  const line = {
    design: `The test sent ${questions.length} letter-counting questions to ${models.length === 2 ? "two" : "three"} AI models.`,
    groups: "Half used real English words, and half used random strings of letters.",
    check: "Each model had to reply with only a number, and code that counted the letters marked every reply.",
    example: sameAnswer && exampleReplies[0].ok ? `Every model counted ${example.correct} ${example.letter.toUpperCase()}s in ${example.word}, which is correct.` : exampleReplies.map((r, i) => `${models[i].speak} counted ${r.answer ?? "nothing usable"} ${example.letter.toUpperCase()}s in ${example.word}.`).join(" "),
    miss: miss ? `${models.find((m) => m.name === miss.model).speak} counted ${miss.answer} ${miss.letter.toUpperCase()}s in ${miss.group === "real" ? miss.word : "one random string"}, when the answer was ${miss.correct}.` : null,
  };
  const scoreLine = (m) => `${m.speak} got ${m.correct} of ${questions.length} right.`;
  const realLine = (m) => `On real words, ${m.speak} got ${m.real} of 10.`;
  const randomLine = (m) => `On random letters, ${m.speak} got ${m.random} of 10.`;
  const text = [line.design, line.groups, line.check, line.example, ...models.map(scoreLine), ...models.map(realLine), ...models.map(randomLine), line.miss].filter(Boolean).join("\n\n");
  const url = runUrl;
  const claim = (claim_id, sentence, editorial_status = "measured_statistic") => ({ claim_id, claim: sentence, source_id: "s1", source_url: url, published: date, excerpt: sentence, confidence: "high", context: `Measured in this production's own test on ${date}; results can differ between runs and the models change over time. Models: ${models.map((m) => m.name).join(", ")}.`, editorial_status });
  const claims = [claim("design", line.design, "demonstrated_feature"), claim("design_groups", line.groups, "demonstrated_feature"), claim("check", line.check, "demonstrated_feature"), claim("example", line.example), ...models.map((m, i) => claim(`score${i}`, scoreLine(m))), ...models.map((m, i) => claim(`split_real${i}`, realLine(m))), ...models.map((m, i) => claim(`split_random${i}`, randomLine(m))), ...(line.miss ? [claim("miss", line.miss)] : [])];
  return { date, reused_from, run_url: runUrl, total: questions.length, models, questions, example: { ...example, replies: exampleReplies }, miss, report_text: text, claims, sources: [{ source_id: "s1", url, published: date, title: "AI Tested letter-count test run" }] };
}

/** Which picture explains a claim. The script's own claim citations decide which scene a sentence lands on. */
export const sceneKindOfClaim = (id) => (id.startsWith("design") || id === "check" ? "setup" : id === "example" ? "terminal" : id.startsWith("score") ? "score" : id.startsWith("split") ? "split" : id === "miss" ? "miss" : null);
