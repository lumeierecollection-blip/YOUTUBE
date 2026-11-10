/**
 * AI Tested follow-up to the letter-counting video: "Why do some AI models fail at counting letters, and what fixes it?"
 * The same 20 questions (10 real words, 10 random strings, same seed) go to each available model twice: once plainly, once asking the
 * model to spell the word out letter by letter before counting. Code that knows the right answer marks every reply. The token counts come
 * from Gemini's own tokenizer through its countTokens endpoint. Nothing here is assumed: if spelling out does not help, the run stops.
 */
import { CANDIDATES, askWithRetry, buildQuestions } from "./experiment.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const plainParse = (reply) => { const m = String(reply).match(/-?\d+/); return m ? Number(m[0]) : null; };
const spellParse = (reply) => { const all = [...String(reply).matchAll(/ANSWER:\s*(\d+)/gi)]; return all.length ? Number(all.at(-1)[1]) : null; };
export const spellPrompt = (word, letter) => `Spell "${word}" one letter at a time, separated by hyphens. Then count how many times the letter "${letter}" appears. Finish with exactly: ANSWER: <number>`;

const geminiKeys = () => ["GEMINI_API_KEY_1", "GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4"].map((k) => process.env[k]).filter(Boolean);

/** Token count of a string under Gemini's tokenizer (a measured value from the API). */
export async function countTokens(text) {
  for (const key of geminiKeys()) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:countTokens?key=${key}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text }] }] }), signal: AbortSignal.timeout(30000) });
    if (r.ok) return (await r.json()).totalTokens;
  }
  throw new Error("could not count tokens: no Gemini key answered");
}

export async function measure({ runUrl, now = new Date(), log = console.error }) {
  const questions = buildQuestions();
  const models = [];
  for (const m of CANDIDATES.filter((c) => c.available())) {
    const plain = [], spelled = [];
    try {
      for (const q of questions) {
        const pr = await askWithRetry(m, q.prompt); plain.push({ word: q.word, letter: q.letter, group: q.group, correct: q.correct, reply: pr.slice(0, 160), answer: plainParse(pr), ok: plainParse(pr) === q.correct }); await sleep(m.pause);
        const sr = await askWithRetry(m, spellPrompt(q.word, q.letter)); spelled.push({ word: q.word, letter: q.letter, group: q.group, correct: q.correct, reply: sr.slice(0, 320), answer: spellParse(sr), ok: spellParse(sr) === q.correct }); await sleep(m.pause);
      }
    } catch (e) { log(`[spellout] ${m.name} dropped: ${e.message}`); continue; }
    const sc = (rows, g) => rows.filter((a) => a.ok && (!g || a.group === g)).length;
    models.push({ name: m.name, speak: m.speak, id: m.id, plain: sc(plain), spelled: sc(spelled), plain_real: sc(plain, "real"), plain_random: sc(plain, "random"), spelled_real: sc(spelled, "real"), spelled_random: sc(spelled, "random"), plain_answers: plain, spelled_answers: spelled });
    log(`[spellout] ${m.name}: plain ${sc(plain)}/20, spelled ${sc(spelled)}/20`);
  }
  if (models.length < 2) throw new Error(`only ${models.length} model(s) completed; a comparison needs at least 2`);
  const example = questions[0];
  const tokens = { word: example.word, letters: example.word.length, tokens: await countTokens(example.word) };
  if (!(tokens.tokens < tokens.letters)) throw new Error(`expected "${example.word}" to be fewer tokens than letters, got ${tokens.tokens} tokens for ${tokens.letters} letters`);
  return { date: now.toISOString().slice(0, 10), run_url: runUrl, models, tokens, example: { word: example.word, letter: example.letter, correct: example.correct } };
}

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
export const say = (n) => (n <= 20 ? ONES[n] : n < 30 ? `twenty-${ONES[n - 20]}` : n < 40 ? `thirty${n === 30 ? "" : `-${ONES[n - 30]}`}` : String(n));

/** Claims, script, scenes and the data the composition draws, all built from the measured numbers. */
export function plan(exp) {
  const ms = exp.models, total = 20;
  const gain = (m) => m.spelled - m.plain;
  const star = [...ms].sort((a, b) => gain(b) - gain(a))[0];
  const sumPlain = ms.reduce((a, m) => a + m.plain, 0), sumSpelled = ms.reduce((a, m) => a + m.spelled, 0), sumGain = sumSpelled - sumPlain;
  // The story is "spelling it out fixes it": stop if that is not what the measurement shows.
  if (gain(star) < 3 || ms.some((m) => m.spelled < m.plain) || star.spelled < 18) throw new Error(`spelling out did not clearly help (best gain ${gain(star)}; spelled scores ${ms.map((m) => m.spelled).join("/")}; plain ${ms.map((m) => m.plain).join("/")})`);
  const others = ms.filter((m) => m !== star);
  const url = exp.run_url, date = exp.date, n3 = ms.length === 3 ? "three" : "two";
  const claim = (claim_id, text, status = "measured_statistic", source = "s1") => ({ claim_id, claim: text, source_id: source, source_url: source === "s1" ? url : "https://en.wikipedia.org/wiki/Large_language_model", published: date, excerpt: text, confidence: "high", context: source === "s1" ? `Measured in this production's own test on ${date}; results can differ between runs and as models update. Models: ${ms.map((m) => m.name).join(", ")}. Marking: code compares the number in each reply (for the spell-out prompt, the number after "ANSWER:") with the true count.` : "Wikipedia, Large language model, Tokenization section.", editorial_status: status });
  const claims = [
    claim("design", `${n3} models answered the same ${total} letter-counting questions twice: once plainly and once asked to spell the word out letter by letter first.`, "demonstrated_feature"),
    claim("plain", `${star.speak} got ${star.plain} of ${total} right when asked plainly.`),
    claim("spelled", `${star.speak} got ${star.spelled} of ${total} right when it spelled the word out first.`),
    ...(star.spelled_random > star.plain_random ? [claim("split", `${star.speak} got ${star.plain_random} of 10 random letter strings right when asked plainly and ${star.spelled_random} of 10 when it spelled them out first.`)] : []),
    ...others.map((m, i) => claim(`other${i}`, m.plain === m.spelled ? `${m.speak} got ${m.plain} of ${total} right both ways.` : `${m.speak} went from ${m.plain} to ${m.spelled} of ${total}.`)),
    claim("tokens", `Gemini's tokenizer reads "${exp.tokens.word}" as ${exp.tokens.tokens} tokens, not ${exp.tokens.letters} letters.`),
    claim("tokenize", "Language models turn text into numbered tokens, using methods such as byte-pair encoding, before processing it.", "established_fact", "wiki-llm"),
  ];
  const S = (text, scene, claim_ids = []) => ({ text, scene, claim_ids, ...(claim_ids.length ? {} : { allow_no_claim: true, editorial: "question, transition or recommendation drawn from the measured results" }) });
  const sentences = [
    S("Why do some AI models fail at counting letters?", 0),
    S(`We asked ${n3} models twenty questions, once plainly, once spelling it out first.`, 1, ["design"]),
    S("A real reply: it spells the word, then counts.", 2, ["design"]),
    S(`Asked plainly, ${star.speak} got ${say(star.plain)} right.`, 3, ["plain"]),
    S(`Spelling first, ${say(star.spelled)}.`, 4, ["spelled"]),
    ...(star.spelled_random > star.plain_random ? [S(`On random letters, ${say(star.plain_random)} of ten became ${say(star.spelled_random)}.`, 4, ["split"])] : []),
    ...others.map((m, i) => S(m.plain === m.spelled ? `${m.speak} was perfect either way.` : `${m.speak} went from ${say(m.plain)} to ${say(m.spelled)}.`, 4, [`other${i}`])),
    S("Why: models read tokens, not letters.", 5, ["tokenize"]),
    S(`${exp.tokens.word[0].toUpperCase()}${exp.tokens.word.slice(1)} is ${say(exp.tokens.tokens)} tokens, but ${say(exp.tokens.letters)} letters.`, 5, ["tokens"]),
    S("Same models, same questions, one change.", 6, ["design"]),
    S("So make the model spell it out first.", 6),
  ];
  const scenes = [
    { kind: "hook2", treatment: "kinetic-question", objective: "Pose the question over a real test word with its matching letters lighting up", background: "white" },
    { kind: "ask2", treatment: "process-diagram", objective: "Show the two prompts, the plain question and the spell-it-out-first question", background: "white" },
    { kind: "reply", treatment: "terminal-demo", objective: "Show a real reply in which the model spells the word out and then counts", background: "dark terminal" },
    { kind: "plainscore", treatment: "bar-chart", objective: "Show each model's score on the plain question out of twenty", background: "white" },
    { kind: "fixscore", treatment: "before-after-bars", objective: "Show each model's plain score beside its spell-out-first score, and the total gain", background: "white" },
    { kind: "why", treatment: "token-vs-letters-diagram", objective: "Show how many tokens the test word is against its letters, as counted by the tokenizer", background: "white" },
    { kind: "close2", treatment: "verdict-panel", objective: "Close with the answer: make the model spell it out first, with every model's before and after", background: "accent panel" },
  ];
  const starReply = star.spelled_answers.find((a) => a.word === exp.example.word) || star.spelled_answers[0];
  const data = { date, total, tokens: exp.tokens, example: { word: exp.example.word, letter: exp.example.letter, correct: exp.example.correct, plain_prompt: `How many times does the letter "${exp.example.letter}" appear in "${exp.example.word}"? Reply with only the number.`, spell_prompt: spellPrompt(exp.example.word, exp.example.letter), reply_model: star.name, reply: starReply.reply, reply_answer: starReply.answer, reply_ok: starReply.ok },
    models: ms.map((m) => ({ name: m.name, speak: m.speak, id: m.id, plain: m.plain, spelled: m.spelled })), sum: { plain: sumPlain, spelled: sumSpelled, gain: sumGain }, star: star.name };
  return { claims, sentences, scenes, data, sources: [{ source_id: "s1", url, published: date, title: "AI Tested spell-out test run" }, { source_id: "wiki-llm", url: "https://en.wikipedia.org/wiki/Large_language_model", published: date, title: "Large language model (Wikipedia)" }], star, sumGain };
}
