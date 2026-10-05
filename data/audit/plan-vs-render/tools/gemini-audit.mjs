/**
 * Plan-vs-render audit (NOT pipeline code — audit only).
 * Step 3: for every beat, send the beat's scene_description + its 25/50/75% frames
 * to the SAME vision model the pipeline uses (gemini-3.5-flash-lite) and ask it
 * whether the render matches what it asked for.
 *
 * Usage: node gemini-audit.mjs ch-26|ch-49|ch-9|ch-44
 * Writes <channel>/audit.json and logs every response in the required format.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const MODEL = "gemini-3.5-flash-lite";

const channel = process.argv[2];
const dir = join("data/audit/plan-vs-render", channel);
const plan = JSON.parse(readFileSync(join(dir, "plan.json"), "utf8"));

const b64 = (p) => readFileSync(p).toString("base64");
const pngFrame = (p) => ({ type: "image_url", image_url: { url: `data:image/png;base64,${b64(p)}` } });

const PROMPT = (beat) => `You wrote a visual plan for a beat of a motion graphics video. Here is what you described:

Scene description: "${beat.scene_description}"
Sentence: "${beat.sentence}"

Here are three frames from the rendered video at 25%, 50%, and 75% through this beat.

Answer only these questions:

1. Does the rendered frame match what you described?
   YES — the rendered frame shows what you described
   PARTIAL — some elements match, some don't
   NO — the rendered frame is completely different from what you described

2. List every element you described that is present in the frame.

3. List every element you described that is missing from the frame.

4. List every element in the frame that you did not describe (things the renderer added that you did not ask for).

5. Is the timing right? For example, if you described "the line finishes drawing by the time the narrator says 'October'," does the line finish drawing at that moment?

Return JSON:
{
  "match": "YES" | "PARTIAL" | "NO",
  "present": ["..."],
  "missing": ["..."],
  "unexpected": ["..."],
  "timing_correct": true | false,
  "timing_note": "..."
}`;

async function ask(beat) {
  const frames = beat.frames.filter((f) => !f.error);
  if (!frames.length) return { match: "NO", present: [], missing: ["no frames could be extracted"], unexpected: [], timing_correct: false, timing_note: "no frames", error: true };
  const content = [{ type: "text", text: PROMPT(beat) }];
  for (const f of frames) content.push({ text: `Frame at ${f.frac * 100}% of the beat (t=${f.at}s):`, type: "text" }, pngFrame(f.path));
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, max_tokens: 900, temperature: 0, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) return { error: true, match: "NO", present: [], missing: [`gemini HTTP ${res.status}`], unexpected: [], timing_correct: false, timing_note: `HTTP ${res.status}` };
  const j = await res.json();
  const txt = j?.choices?.[0]?.message?.content || "";
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return { error: true, match: "NO", present: [], missing: ["unparseable answer"], unexpected: [], timing_correct: false, timing_note: txt.slice(0, 120), raw: txt };
  try { return JSON.parse(m[0]); } catch (e) { return { error: true, match: "NO", present: [], missing: ["invalid JSON"], unexpected: [], timing_correct: false, timing_note: m[0].slice(0, 160), raw: txt }; }
}

const results = [];
for (const beat of plan.beats) {
  const v = await ask(beat);
  results.push({ index: beat.index, ...v });
  const list = (a) => (Array.isArray(a) && a.length ? JSON.stringify(a) : "[]");
  console.log(`[audit] ${channel} beat ${beat.index}: match=${v.match}${v.error ? " (ERROR: " + v.missing[0] + ")" : ""}`);
  console.log(`      present: ${list(v.present)}`);
  console.log(`      missing: ${list(v.missing)}`);
  console.log(`      unexpected: ${list(v.unexpected)}`);
  console.log(`      timing: ${v.timing_correct}${v.timing_note ? " — " + String(v.timing_note).slice(0, 160) : ""}`);
}
writeFileSync(join(dir, "audit.json"), JSON.stringify({ channel, model: MODEL, results }, null, 2));
console.log(`[audit] ${channel}: ${results.length} beats -> ${dir}/audit.json`);
