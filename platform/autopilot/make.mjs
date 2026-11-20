#!/usr/bin/env node
/** Autopilot generator (owner, 20 Nov 2026: runs on its own, Shorts twice a day, long forms every 2 days, every mention shown, pictures that make sense).
 *  node make.mjs short|long   -> takes the first unused topic of data/autopilot/<mode>-queue.json, fetches its Wikipedia text, has Gemini write the script
 *  STRICTLY from that text plus one picture request per named thing, sources the pictures (auto-source.mjs, vision-scored), writes the spec/episode file,
 *  the upload metadata and the plan, and prints "SLUG=<slug>" for the workflow. Facts come only from the fetched text (repo hard rule). No picture is invented:
 *  a mention with no good picture becomes a text card. Needs GEMINI_API_KEY*. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../.."), mode = process.argv[2];
const J = (p, d) => (existsSync(join(ROOT, p)) ? JSON.parse(readFileSync(join(ROOT, p), "utf8")) : d), W = (p, c) => { mkdirSync(dirname(join(ROOT, p)), { recursive: true }); writeFileSync(join(ROOT, p), typeof c === "string" ? c : JSON.stringify(c, null, 1)); };
const queue = J(`data/autopilot/${mode}-queue.json`, []), done = J("data/autopilot/done.json", []);
const topic = queue.find((t) => !done.includes(t.id)); if (!topic) { console.error("queue empty: add topics to data/autopilot/" + mode + "-queue.json"); process.exit(3); }
const KEYS = ["GEMINI_API_KEY", "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4"].map((k) => process.env[k]).filter(Boolean);
// each model has its own free quota: when one is used up (429) the next one answers
const MODELS = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-lite-latest"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ask(prompt) {
  for (let pass = 0; pass < 5; pass++) { for (const model of MODELS) for (const key of KEYS) { try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.4 } }) });
    if (!r.ok) { console.error("gemini", r.status, (await r.text()).slice(0, 160)); continue; } const raw = await r.json(); const txt = raw.candidates?.[0]?.content?.parts?.map((x) => x.text || "").join("") || ""; let j = null; try { j = JSON.parse(txt.replace(/^```json\s*|```\s*$/g, "")); } catch { console.error("unparseable", txt.slice(0, 120), JSON.stringify(raw.promptFeedback || raw.candidates?.[0]?.finishReason || "").slice(0, 100)); } if (j) return j; } catch (e) { console.error("ask error", String(e).slice(0, 100)); } } await sleep(8000 * (pass + 1)); }
  throw new Error("model gave no answer");
}
async function source() {
  let out = "";
  for (const t of topic.sources) { const r = await (await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(t)}`, { headers: { "User-Agent": "research-client/1.0" } })).json(); const p = Object.values(r.query.pages)[0]; out += `\n### ${p.title}\n${(p.extract || "").slice(0, mode === "long" ? 22000 : 9000)}\n`; await sleep(800); }
  return out;
}
const SRC = await source(), slug = `${mode === "short" ? "ai-tested-" : "hidden-past-"}${topic.id}`;
const RULES = `RULES: use ONLY facts, names, numbers and dates that appear in SOURCE TEXT; never add anything from memory. Every person, place, object, date, number or organisation named in a sentence gets its OWN visual,
cut on the word. Visual kinds: {"kind":"photo","at":"<the exact script word where the mention starts>","q":"<2-4 plain search keywords an image library would match, e.g. 'airport departure board'>","desc":"<literal picture description; for a named public figure/place/object use its full name, e.g. 'Admiral George Rooke portrait'; for a private individual NEVER use their name: describe a plain stand-in (e.g. 'man with suitcase at airport')>"},
{"kind":"number","at":"<word>","value":"<as written>","label":"<what it counts>"}, {"kind":"year","at":"<word>","value":"<year>"}, {"kind":"text","at":"<word>","value":"<short phrase>"} (text only for abstract lesson lines).
Never two visuals with the same desc. Plain spoken English, no markdown.`;
let plan;
if (mode === "short") {
  plan = await ask(`Write a YouTube Short (a 26-second narration, 66-74 words) for a channel about AI that is tested honestly. Topic: ${topic.title}. ${topic.format || ""}
Structure (copied from the reference Shorts that work): line 1 = a dated or numbered hook fact; then 3-4 short story beats; the payoff; a two-line lesson; end with ONE question to the viewer.
${RULES}
Return JSON {"title":"<=70 chars, no clickbait lies","description":"2 sentences + the source line","tags":["..."],"script":"...","shots":[ one visual per mention, 18-24 shots, in spoken order ]}.
SOURCE TEXT:${SRC}`);
} else {
  const outline = await ask(`Outline a ${topic.minutes || 20}-minute history documentary titled "${topic.title}", in this exact structure: cold open (dated scene + a scale fact), the puzzle as one question, the usual answer granted, why it is not enough, promise of named moments, 7-9 chronological chapters each ending on an open question, a layered verdict, one closing line. Use only SOURCE TEXT.
Return JSON {"chapters":[{"title":"...","points":["...","..."]}]} (first chapter is the cold open, last is the verdict).
SOURCE TEXT:${SRC}`);
  const beats = [];
  for (const [i, ch] of outline.chapters.entries()) {
    const r = await ask(`Write chapter ${i + 1}/${outline.chapters.length} "${ch.title}" of the documentary "${topic.title}": about 330 words of narration (calm, past tense, dates and places), covering: ${ch.points.join("; ")}.
Split it into beats of 1-2 sentences. ${RULES}
Return JSON {"beats":[{"vo":"1-2 sentences","label":"short caption (<=5 words) or empty","visuals":[ one per named mention in that beat, 1-3 ]}]}.
SOURCE TEXT:${SRC}`);
    for (const b of r.beats || []) beats.push({ ...b, chapter: i + 1, chTitle: ch.title });
  }
  plan = { title: topic.title, description: `${topic.title}. Every fact comes from: ${topic.sources.map((s) => "Wikipedia, " + s.replace(/_/g, " ")).join("; ")}. Pictures: credited on screen. Narration is a synthetic voice.`, tags: topic.tags || [], beats };
}
// pictures: one search job per photo mention, sourced and vision-scored on this runner
const chDir = mode === "short" ? "ai-tested" : "hidden-past", jobs = [];
const mentions = mode === "short" ? plan.shots : plan.beats.flatMap((b) => b.visuals || []);
let n = 0; for (const m of mentions) if (m.kind === "photo") { m.id = `${topic.id.slice(0, 10)}-${String(++n).padStart(2, "0")}`; jobs.push({ id: m.id, q: m.q || m.desc, desc: m.desc }); }
W(`data/autopilot/jobs-${slug}.json`, jobs);
const sr = spawnSync("node", [join(ROOT, "platform/longform/v2/auto-source.mjs"), join(ROOT, `data/autopilot/jobs-${slug}.json`), chDir], { stdio: "inherit", env: process.env, cwd: ROOT });
const missing = new Set(J(`src/skills/remotion-render/public/lf2/${chDir}/_missing.json`, []));
const q = (s) => JSON.stringify(s);
if (mode === "short") {
  const words = plan.script.split(/\s+/), norm = (w) => w.toLowerCase().replace(/[^a-z0-9$]/g, ""); let pos = 0; const shots = [];
  for (const m of plan.shots) { let i = pos; while (i < words.length && norm(words[i]) !== norm(m.at)) i++; if (i >= words.length) continue; pos = i + 1;
    if (m.kind === "photo" && !missing.has(m.id)) shots.push({ at: m.at, kind: "full", photo: m.id, cap: m.desc.length < 40 ? m.desc : "" });
    else if (m.kind === "number") shots.push({ at: m.at, kind: "stat", value: m.value, label: m.label || "" });
    else if (m.kind === "year") shots.push({ at: m.at, kind: "stat", value: m.value, label: "" });
    else shots.push({ at: m.at, kind: "page", page: m.value || m.desc || m.at }); }
  W(`platform/shorts-sx/specs/${slug}.mjs`, `// Autopilot Short (${new Date().toISOString().slice(0, 10)}): ${topic.title}. Script written from fetched Wikipedia text only (${topic.sources.join(", ")}); pictures sourced and vision-scored.
export const STYLE = "v3", CALM = true, FILL = false, TAG = null, CTA = null, ENTITIES = [], CUTOUTS = [], KEYS = {}, CAPTURES = [], PHOTOS = [], FOOTAGE = [], FOOTAGE_REQUIRE = /x^/;
export const VOICE_STYLE = "Say it like a sharp, confident YouTube Shorts narrator telling a surprising true story: brisk and energetic, about 172 words a minute, every word clear, tiny pauses only at full stops, punch on names, years and numbers:";
export const SCRIPT = ${q(plan.script)};
export const SOURCES = ${q(Object.fromEntries(topic.sources.map((s, i) => ["S" + i, { title: "Wikipedia: " + s.replace(/_/g, " "), url: "https://en.wikipedia.org/wiki/" + s, retrieved: new Date().toISOString().slice(0, 10) }])))};
export const SHOTS = ${JSON.stringify(shots, null, 1)};
`);
  W(`platform/longform/v2/episodes/sx-${slug}.mjs`, `export { FOOTAGE, FOOTAGE_REQUIRE } from "../../../shorts-sx/specs/${slug}.mjs";\n`);
  W(`data/uploads/${slug}/episode-meta.json`, { title: plan.title.slice(0, 90) + " #shorts", description: `${plan.description}\n\nSource: ${topic.sources.map((s) => "Wikipedia, " + s.replace(/_/g, " ")).join("; ")}.\nPhotos credited on file. Narration is a synthetic voice.\n\n#AI #AITested #shorts`, tags: [...(plan.tags || []), "AI", "shorts"] });
  W("data/uploads/short-plan.json", { dir: slug, slot: "02", expect_channel: "AI Tested", category: "28", slug, branch: `auto-${topic.id}` });
} else {
  const att = J(`src/skills/remotion-render/public/lf2/${chDir}/ATTRIBUTIONS.json`, {}), P = (id) => `lf2/${chDir}/${att[id].file}`, C = (id) => att[id].credit_line;
  const out = plan.beats.map((b, i) => { const vs = b.visuals || [], ph = vs.filter((v) => v.kind === "photo" && !missing.has(v.id)), nu = vs.find((v) => v.kind === "number" || v.kind === "year");
    const ban = i === 0 || plan.beats[i - 1].chapter !== b.chapter ? { text: b.chTitle, date: `CHAPTER ${b.chapter}` } : b.label ? { text: b.label } : null;
    let scene; if (nu && !ph.length) scene = { type: "fxstat", value: nu.value, label: nu.label || b.label || "", banner: ban };
    else if (ph.length === 1) scene = { type: "fxphoto", image: P(ph[0].id), credit: C(ph[0].id), banner: ban };
    else if (ph.length > 1) scene = { type: "fxcards", cards: ph.slice(0, 3).map((v, k) => ({ image: P(v.id), x: [[560], [250, 1030], [130, 700, 1270]][Math.min(ph.length, 3) - 1][k], y: [150, 190, 200][Math.min(ph.length, 3) - 1], w: [800, 640, 520][Math.min(ph.length, 3) - 1], h: [620, 560, 480][Math.min(ph.length, 3) - 1], rot: [-2, 3, -4][k % 3], caption: v.desc.length < 36 ? v.desc : "" })), banner: ban, credits: ph.slice(0, 3).map((v) => C(v.id)).join(" · ") };
    else scene = { type: "fxpage", title: b.chTitle, lines: [b.vo.split(/(?<=[.!?])\s/)[0].slice(0, 140)], banner: ban };
    return { id: `A${String(i + 1).padStart(2, "0")}`, part: b.chTitle, src: ["S0"], vo: b.vo, scene }; });
  W(`platform/longform/v2/episodes/${slug}.mjs`, `// Autopilot long form (${new Date().toISOString().slice(0, 10)}): ${topic.title}. Narration written from fetched Wikipedia text only; pictures sourced and vision-scored.
export const SOURCES = ${q(Object.fromEntries(topic.sources.map((s, i) => ["S" + i, { title: "Wikipedia: " + s.replace(/_/g, " "), url: "https://en.wikipedia.org/wiki/" + s, retrieved: new Date().toISOString().slice(0, 10) }])))};
export const EPISODE = { channel: "hidden-past", slug: ${q(slug)}, theme: "fx-doc", title: ${q(topic.title)}, target_minutes: ${topic.minutes || 20}, blurb: [${q(plan.description)}], sound: { bed: null }, beats: ${JSON.stringify(out, null, 1)} };
`);
  W(`data/uploads/${slug}/episode-meta.json`, { title: topic.title.slice(0, 100), description: plan.description, tags: plan.tags || [] });
  W("data/uploads/long-plan.json", { dir: slug, slot: "01", expect_channel: "Hidden Past", category: "27", slug });
}
W("data/autopilot/done.json", [...done, topic.id]);
console.log(`SLUG=${slug}\nMISSING=${[...missing].join(",")}\nSOURCING_EXIT=${sr.status}`);
