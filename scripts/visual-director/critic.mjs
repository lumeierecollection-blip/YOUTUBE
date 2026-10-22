#!/usr/bin/env node
// Visual-director critic (docs/VISUAL-DIRECTOR.md "Critic question set"). CI only: a vision model
// looks at the CI-extracted frames of each scene and answers the full question set, including
// DELETE (the scene's idea is wrong, start over). It is never told to preserve existing work.
//
//   node scripts/visual-director/critic.mjs --direction <d.json> --frames <frames-index.json> --out <critic.json> [--round N]
//
// Model: VD_CRITIC_MODEL (default gemini-3.8-flash) through src/lib/gemini-client.js callGemini
// (key rotation, sibling models, OpenRouter for the same Google model). Every answer is validated
// with ajv; one corrective retry; then the scene is recorded as `invalid` with the errors.
// No key / no answer -> `not_run` with the reason. A verdict is NEVER fabricated: a scene the
// critic did not answer has verdict null and the loop treats it as unresolved, not as KEEP.
//
// Deterministic escalation (recorded, not hidden): when the model says KEEP but its own answers
// say the scene fails (understood_muted = "no", template_or_decorative = "yes", or
// material_believable_and_correct = "no"), the effective verdict is REBUILD and
// `escalated` carries the reason. A lenient model must not be able to keep a scene it just failed.
import Ajv from "ajv";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const SCENE_SCHEMA = {
  type: "object",
  required: ["beat_index", "visibly_happening", "relationship_communicated", "understood_muted", "template_or_decorative",
    "material_believable_and_correct", "camera_contributes", "verdict", "what_to_change", "delete_reason"],
  additionalProperties: true,
  properties: {
    beat_index: { type: "integer", minimum: 0 },
    visibly_happening: { type: "string", minLength: 3 },
    relationship_communicated: { type: "string", minLength: 1 },
    understood_muted: { enum: ["yes", "partly", "no"] },
    template_or_decorative: yesNoWhy(),
    material_believable_and_correct: yesNoWhy(),
    camera_contributes: yesNoWhy(),
    verdict: { enum: ["KEEP", "REBUILD", "DELETE"] },
    what_to_change: { type: ["string", "null"] },
    delete_reason: { type: ["string", "null"] },
  },
  allOf: [
    { if: { properties: { verdict: { const: "REBUILD" } } }, then: { properties: { what_to_change: { type: "string", minLength: 10 } } } },
    { if: { properties: { verdict: { const: "DELETE" } } }, then: { properties: { delete_reason: { type: "string", minLength: 10 } } } },
  ],
};
function yesNoWhy() {
  return { type: "object", required: ["answer", "why"], additionalProperties: false,
    properties: { answer: { enum: ["yes", "no"] }, why: { type: "string", minLength: 3 } } };
}
export const WHOLE_SCHEMA = {
  type: "object",
  required: ["template_alternation", "template_alternation_why", "whole_mute_test", "whole_mute_test_why", "worst_beats"],
  additionalProperties: true,
  properties: {
    template_alternation: { enum: ["yes", "partly", "no"] },
    template_alternation_why: { type: "string", minLength: 3 },
    whole_mute_test: { enum: ["yes", "partly", "no"] },
    whole_mute_test_why: { type: "string", minLength: 3 },
    worst_beats: { type: "array", items: { type: "integer" } },
  },
};
const ajv = new Ajv({ allErrors: true, strict: false });
const vScene = ajv.compile(SCENE_SCHEMA);
const vWhole = ajv.compile(WHOLE_SCHEMA);
const errs = (v) => (v.errors || []).map((e) => `${e.instancePath || "/"} ${e.message}`);
export function validateScene(x) { const ok = vScene(x); return { valid: !!ok, errors: ok ? [] : errs(vScene) }; }
export function validateWhole(x) { const ok = vWhole(x); return { valid: !!ok, errors: ok ? [] : errs(vWhole) }; }

/** The verdict the loop acts on. Pure; tested. */
export function effectiveVerdict(a) {
  if (!a || !a.verdict) return { verdict: null, escalated: null };
  if (a.verdict !== "KEEP") return { verdict: a.verdict, escalated: null };
  const why = [];
  if (a.understood_muted === "no") why.push("critic answered understood_muted=no");
  if (a.template_or_decorative?.answer === "yes") why.push(`critic answered template_or_decorative=yes (${a.template_or_decorative.why})`);
  if (a.material_believable_and_correct?.answer === "no") why.push(`critic answered material_believable_and_correct=no (${a.material_believable_and_correct.why})`);
  return why.length ? { verdict: "REBUILD", escalated: `KEEP overridden: ${why.join("; ")}` } : { verdict: "KEEP", escalated: null };
}

function sceneBrief(beat) {
  const shots = (beat.shots || []).map((s) => ({
    id: s.id, duration_s: s.duration_s, camera: `${s.camera?.move}: ${s.camera?.from} -> ${s.camera?.to} (${s.camera?.motivation})`,
    action: s.action, text: s.text?.words || null,
    must_show: (s.materials || []).map((m) => `${m.kind}: ${m.must_show}${m.resolved ? ` [resolver: ${m.resolved.status}${m.resolved.verdict ? ` - ${m.resolved.verdict}` : ""}]` : ""}`),
  }));
  return { sentence: beat.sentence, mechanism: beat.mechanism?.family, construction: beat.mechanism?.construction, mute_test: beat.mute_test, shots };
}

export function buildScenePrompt(beat) {
  return `You are a harsh motion-design critic reviewing ONE scene of a narrated vertical YouTube Short. You see frames sampled from the RENDERED video (labelled "b<beat> <shot> <time>s <start|mid|end|cadence>"). You cannot hear it.

The scene was supposed to make this narration sentence land visually:
"${beat.sentence}"

What the director intended (judge the PIXELS against it; the intent earns no credit by itself):
${JSON.stringify(sceneBrief(beat), null, 1)}

Answer from what the frames actually show, not from the intent:
1. visibly_happening: what is literally on screen and what moves/changes across the frames.
2. relationship_communicated: what relationship or change it communicates ("none" if nothing).
3. understood_muted: could a viewer with sound off understand what the director's mute_test says? yes / partly / no.
4. template_or_decorative: is it decorative, a generic infographic, a reusable template card, stock filler or AI-looking? answer yes/no + why.
5. material_believable_and_correct: are the pictures believable AND do they literally show what must_show names? yes/no + why.
6. camera_contributes: does the camera movement add meaning (not just drift)? yes/no + why.
7. verdict: KEEP (works as is), REBUILD (the idea is right but the construction fails; say concretely what to change), or DELETE (the idea is wrong for this sentence; say why, so it is re-directed from scratch).

You are not asked to save this scene. Nobody's work needs protecting. If it is weak, say REBUILD; if the idea is wrong, say DELETE. Do not suggest cosmetic patches (glow, extra labels, particles, colour); a rebuild is a new construction.

Return ONE JSON object, nothing else:
{"beat_index":${beat.beat_index},"visibly_happening":"...","relationship_communicated":"...","understood_muted":"yes|partly|no","template_or_decorative":{"answer":"yes|no","why":"..."},"material_believable_and_correct":{"answer":"yes|no","why":"..."},"camera_contributes":{"answer":"yes|no","why":"..."},"verdict":"KEEP|REBUILD|DELETE","what_to_change":"... or null","delete_reason":"... or null"}`;
}

export function buildWholePrompt(direction) {
  const lines = direction.beats.map((b) => `b${b.beat_index} [${b.mechanism?.family}] ${b.sentence}`).join("\n");
  return `You are a harsh motion-design critic. The image is the contact sheet of a whole rendered vertical YouTube Short: for each shot, its start, middle and end frame, labelled "b<beat> <shot> <time>s <kind>", in time order. The narration, beat by beat:
${lines}

Answer from the pixels:
- template_alternation: does the video read as a template alternation (e.g. TEXT card -> CHART -> TEXT card -> icon), i.e. the same few layouts recycled, rather than scenes constructed for each sentence? yes / partly / no, and why.
- whole_mute_test: with sound off, would a viewer follow what the video is about and what happens? yes / partly / no, and why.
- worst_beats: the beat indices that most need to be rebuilt or deleted (may be empty).
You are not asked to preserve anything.

Return ONE JSON object: {"template_alternation":"yes|partly|no","template_alternation_why":"...","whole_mute_test":"yes|partly|no","whole_mute_test_why":"...","worst_beats":[...]}`;
}

const imgPart = (file) => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${readFileSync(file).toString("base64")}` } });

/** Default caller: gemini-client. Returns { value, model, usage } or { error, detail }. */
export async function geminiCall(messages, { model, maxTokens = 2000, tag = "vd-critic" } = {}) {
  const { callGemini } = await import("../../src/lib/gemini-client.js");
  const r = await callGemini(messages, { model, maxTokens, temperature: 0, noCache: true, tag, _noOllamaFirst: true });
  if (!r || r.error) return { error: r?.error || "no_answer", detail: r?.detail || "" };
  if (r.content && Object.keys(r).length === 1) return { error: "not_json", detail: String(r.content).slice(0, 300) };
  return { value: r, model: r.model || model, usage: r._usage || null };
}

function hasKey() {
  return !!(process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    || process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY_3 || process.env.GEMINI_API_KEY_4 || process.env.OPENROUTER_API_KEY);
}

/** Ask, validate, one corrective retry. Returns a record; never invents a verdict. */
async function ask({ call, prompt, images, validate, model }) {
  const usage = [];
  const content = [{ type: "text", text: prompt }, ...images.map(imgPart)];
  let messages = [{ role: "user", content }];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await call(messages, { model });
    if (r.usage) usage.push(r.usage);
    if (r.error) return { status: "not_run", reason: `${r.error}: ${String(r.detail || "").slice(0, 200)}`, model: r.model || model, usage, attempts: attempt };
    const v = validate(r.value);
    if (v.valid) return { status: "answered", answer: r.value, model: r.model || model, usage, attempts: attempt };
    if (attempt === 2) return { status: "invalid", reason: v.errors.join("; "), raw: r.value, model: r.model || model, usage, attempts: attempt };
    messages = [...messages, { role: "assistant", content: JSON.stringify(r.value) },
      { role: "user", content: `That JSON failed validation: ${v.errors.join("; ")}. Return the corrected JSON object only.` }];
  }
}

const sumUsage = (records) => records.flatMap((r) => r.usage || []).reduce((a, u) => ({
  prompt_tokens: a.prompt_tokens + (u.prompt_tokens || 0), completion_tokens: a.completion_tokens + (u.completion_tokens || 0),
  total_tokens: a.total_tokens + (u.total_tokens || 0), calls: a.calls + 1 }), { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, calls: 0 });

/** Up to `max` key frames of a beat (start/mid/end), spread over its shots. */
function keyFramesFor(index, b, max = 4) {
  const k = index.frames.filter((f) => f.beat_index === b && f.kind !== "cadence");
  if (k.length <= max) return k.map((f) => f.file);
  const step = k.length / max;
  return Array.from({ length: max }, (_, i) => k[Math.floor(i * step)].file);
}

export async function runCritic({ direction, index, round = 0, call = null, model = process.env.VD_CRITIC_MODEL || "gemini-3.8-flash", beats = null }) {
  const started = new Date().toISOString();
  const doc = { schema_version: 1, round, started, model, scenes: [], whole_video: null, usage_total: null };
  if (!call && !hasKey()) {
    const reason = "no Gemini/OpenRouter key in this environment";
    doc.status = "not_run";
    doc.scenes = direction.beats.map((b) => ({ beat_index: b.beat_index, status: "not_run", reason, verdict: null, effective_verdict: null }));
    doc.whole_video = { status: "not_run", reason };
    doc.usage_total = sumUsage([]);
    return doc;
  }
  call = call || geminiCall;
  for (const b of direction.beats) {
    if (beats && !beats.includes(b.beat_index)) continue;
    const strip = index.strips?.[b.beat_index];
    const images = [strip, ...keyFramesFor(index, b.beat_index)].filter((f) => f && existsSync(f));
    if (!images.length) { doc.scenes.push({ beat_index: b.beat_index, status: "not_run", reason: "no frames extracted for this beat", verdict: null, effective_verdict: null }); continue; }
    const rec = await ask({ call, prompt: buildScenePrompt(b), images, validate: validateScene, model });
    if (rec.status === "answered" && rec.answer.beat_index !== b.beat_index) rec.answer.beat_index = b.beat_index; // ids are ours, not the model's
    const eff = effectiveVerdict(rec.answer);
    doc.scenes.push({ beat_index: b.beat_index, sentence: b.sentence, images: images.length, ...rec,
      verdict: rec.answer?.verdict ?? null, effective_verdict: eff.verdict, escalated: eff.escalated });
  }
  if (index.sheet && existsSync(index.sheet)) {
    doc.whole_video = await ask({ call, prompt: buildWholePrompt(direction), images: [index.sheet], validate: validateWhole, model });
  } else doc.whole_video = { status: "not_run", reason: "no contact sheet" };
  doc.usage_total = sumUsage([...doc.scenes, doc.whole_video]);
  const answered = doc.scenes.filter((s) => s.status === "answered").length;
  doc.status = answered === doc.scenes.length ? "complete" : answered ? "partial" : "not_run";
  doc.finished = new Date().toISOString();
  return doc;
}

function arg(name, def = null) { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; }

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("visual-director/critic.mjs")) {
  const d = arg("direction"), f = arg("frames"), out = arg("out");
  if (!d || !f || !out) { console.error("usage: critic.mjs --direction <d.json> --frames <frames-index.json> --out <critic.json> [--round N]"); process.exit(2); }
  const doc = await runCritic({ direction: JSON.parse(readFileSync(d, "utf8")), index: JSON.parse(readFileSync(f, "utf8")), round: Number(arg("round", "0")) });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(doc, null, 2));
  for (const s of doc.scenes) console.log(`b${s.beat_index}: ${s.status} ${s.effective_verdict || ""}${s.escalated ? " (escalated)" : ""} ${s.reason || ""}`);
  console.log(`critic ${doc.status}; tokens ${doc.usage_total.total_tokens} in ${doc.usage_total.calls} calls`);
}
