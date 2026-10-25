#!/usr/bin/env node
/**
 * The viewer's read of a script (validate-script-clarity.cjs part 2): Gemini reads it as someone who knows nothing about the story.
 *
 *   node scripts/check-script-clarity.mjs <script.json> [research.json]
 *     prints ONE JSON line: { what_happened, who, where, when, question, answered, answer, unclear: [{ n, text, why }] } or { error }
 *
 * Owner, 2026-10-16: scripts were ambiguous ("Yet as soon as she started, the dream unraveled." with nobody named), opened a question and never closed it,
 * and left out the context (what happened, to whom, where, when). The research is given so the reader can tell a gap in the SCRIPT from a gap in the
 * facts, but it judges only what the script itself says to a viewer.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { callGemini } from "../src/lib/gemini-client.js";

const require = createRequire(import.meta.url);
const { sentences } = require("./validate-script.cjs");

const [scriptPath, researchPath] = process.argv.slice(2);
const out = (o) => { console.log(JSON.stringify(o)); process.exit(0); };
let script, research = null;
try { script = JSON.parse(readFileSync(scriptPath, "utf8")); } catch (e) { out({ error: `script unreadable: ${e.message}` }); }
try { if (researchPath) research = JSON.parse(readFileSync(researchPath, "utf8")); } catch { /* the script alone is judged */ }

const rows = [];
for (const sec of script.sections || []) for (const s of sentences(sec.voiceover || "")) rows.push(`${rows.length + 1}. [${sec.id}] ${s}`);
if (!rows.length) out({ error: "script has no sentences" });
const facts = research ? [research.strongest_angle, ...(research.key_facts || []).map((f) => f.fact)].filter(Boolean).map((f) => `- ${f}`).join("\n") : "(none given)";

const prompt = `You are a viewer who knows NOTHING about this story. You hear this 45-second narration once, sentence by sentence.

NARRATION (numbered, with its section):
${rows.join("\n")}

(For your reference only — the facts the writer had. Judge the NARRATION, not these:)
${facts}

Answer as that viewer:
- what_happened: in one sentence, the event the narration reports (who did what, to whom, where, when) — or null if the narration never says it.
- who / where / when: as the narration states them, or null.
- question: the question or mystery the narration opens for the viewer (the thing it makes you want to know), or null if it opens none.
- answered: true only if a LATER sentence plainly answers that question; false if it is left open, hinted at, or answered vaguely.
- answer: the sentence number that answers it, or null.
- unclear: every sentence a viewer could not follow — a "he", "she", "they", "it", "this" or "that" whose person or thing has not been named; a
  sentence that only comments and says nothing ("That's a shocking reality."); a jump that skips a step the viewer needs; a term never explained.
  For each: {"n": <sentence number>, "text": "<the sentence>", "why": "<what the viewer cannot tell, in a few words>"}. Empty if every sentence is clear.

Return ONE JSON object and nothing else:
{"what_happened": "...", "who": "...", "where": "...", "when": "...", "question": "...", "answered": true, "answer": 7, "unclear": []}`;

const r = await callGemini([{ role: "user", content: prompt }], { model: process.env.SCRIPT_GEMINI_MODEL || "gemini-3.5-flash-lite", maxTokens: 1500, temperature: 0, noCache: true, tag: `clarity ch-${script.channel_id ?? "?"}` });
if (!r || r.error || typeof r !== "object" || !("answered" in r)) out({ error: r && r.error ? `${r.error}` : "malformed answer" });
out({
  what_happened: r.what_happened || null, who: r.who || null, where: r.where || null, when: r.when || null,
  question: r.question || null, answered: r.answered === true, answer: r.answer ?? null,
  unclear: Array.isArray(r.unclear) ? r.unclear.filter((u) => u && Number(u.n) >= 1 && Number(u.n) <= rows.length) : [],
});
