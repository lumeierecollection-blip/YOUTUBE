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
const geminiKey = () => process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_2;

async function callGemini(model, text) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey()}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { temperature: 0, maxOutputTokens: 2048 } }), signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  const j = await r.json();
  return (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
}

async function callOpenAiStyle(url, key, model, text) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model, temperature: 0, max_tokens: 2048, messages: [{ role: "user", content: text }] }), signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  const j = await r.json();
  return String(j.choices?.[0]?.message?.content || "").trim();
}

const CANDIDATES = [
  { name: "Gemini 3.5 Flash", id: "gemini-3.5-flash", available: () => !!geminiKey(), ask: (t) => callGemini("gemini-3.5-flash", t), pause: 4500 },
  { name: "Gemini 3.5 Flash-Lite", id: "gemini-3.5-flash-lite", available: () => !!geminiKey(), ask: (t) => callGemini("gemini-3.5-flash-lite", t), pause: 4500 },
  { name: "GPT-OSS 120B", id: "openai/gpt-oss-120b", available: () => !!process.env.GROQ_API_KEY, ask: (t) => callOpenAiStyle("https://api.groq.com/openai/v1/chat/completions", process.env.GROQ_API_KEY, "openai/gpt-oss-120b", t), pause: 2500 },
];

async function askWithRetry(model, text) {
  for (let attempt = 1; ; attempt++) {
    try { return await model.ask(text); }
    catch (e) { if (attempt >= 4) throw e; await sleep((e.status === 429 ? 20000 : 5000) * attempt); }
  }
}

/** The first whole number in the reply. A reply with no number is marked wrong. */
const parse = (reply) => { const m = String(reply).match(/-?\d+/); return m ? Number(m[0]) : null; };

export async function runExperiment({ runUrl, now = new Date(), log = console.error }) {
  const seed = 20261109;
  const questions = [...WORDS.map(([word, letter]) => ({ group: "real", word, letter })), ...randomStrings(10, 24, seed).map(([word, letter]) => ({ group: "random", word, letter }))].map((q) => ({ ...q, correct: count(q.word, q.letter), prompt: prompt(q.word, q.letter) }));
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
    models.push({ name: m.name, id: m.id, correct: score(), real: score("real"), random: score("random"), answers });
    log(`[experiment] ${m.name}: ${score()}/${questions.length}`);
  }
  if (models.length < 2) throw new Error(`only ${models.length} model(s) answered every question; a comparison needs at least 2`);
  models.sort((a, b) => b.correct - a.correct);
  const date = now.toISOString().slice(0, 10);
  const example = questions[0];
  const exampleReplies = models.map((m) => ({ model: m.name, reply: m.answers[0].reply, answer: m.answers[0].answer, ok: m.answers[0].ok }));
  // The widest miss across all models, so the video can show a real wrong answer if one exists.
  const miss = models.flatMap((m) => m.answers.filter((a) => !a.ok && a.answer !== null).map((a) => ({ ...a, model: m.name, error: Math.abs(a.answer - a.correct) }))).sort((a, b) => b.error - a.error)[0] || null;
  const line = {
    design: `On ${date}, an automated test sent ${questions.length} letter-counting questions to each of ${models.length} AI models: ${models.map((m) => m.name).join(", ")}. Ten questions used real English words and ten used random strings of 24 letters.`,
    check: "Each model was told to reply with only the number, and code that counted the letters marked every reply right or wrong.",
    example: `Asked how many times the letter "${example.letter}" appears in "${example.word}", where the correct answer is ${example.correct}, ${exampleReplies.map((r) => `${r.model} answered ${r.answer ?? "with no number"}`).join(" and ")}.`,
    miss: miss ? `The widest miss came from ${miss.model}: asked to count the letter "${miss.letter}" in the random string "${miss.word}", it answered ${miss.answer}, and the correct answer is ${miss.correct}.` : null,
  };
  const scoreLine = (m) => `${m.name} got ${m.correct} of ${questions.length} questions right.`;
  const splitLine = (m) => `${m.name} scored ${m.real} of 10 on real words and ${m.random} of 10 on random letter strings.`;
  const text = [line.design, line.check, line.example, ...models.map(scoreLine), ...models.map(splitLine), line.miss].filter(Boolean).join("\n\n");
  const url = runUrl;
  const claim = (claim_id, sentence, editorial_status = "measured_statistic") => ({ claim_id, claim: sentence, source_id: "s1", source_url: url, published: date, excerpt: sentence, confidence: "high", context: "Measured in this production's own test; results can differ between runs and the models change over time.", editorial_status });
  const claims = [claim("design", line.design, "demonstrated_feature"), claim("check", line.check, "demonstrated_feature"), claim("example", line.example), ...models.map((m, i) => claim(`score${i}`, scoreLine(m))), ...models.map((m, i) => claim(`split${i}`, splitLine(m))), ...(line.miss ? [claim("miss", line.miss)] : [])];
  return { date, total: questions.length, models, questions, example: { ...example, replies: exampleReplies }, miss, report_text: text, claims, sources: [{ source_id: "s1", url, published: date, title: "AI Tested letter-count test run" }] };
}

/** Which picture explains a claim. The script's own claim citations decide which scene a sentence lands on. */
export const sceneKindOfClaim = (id) => (id === "design" || id === "check" ? "setup" : id === "example" ? "terminal" : id.startsWith("score") ? "score" : id.startsWith("split") ? "split" : id === "miss" ? "miss" : null);
