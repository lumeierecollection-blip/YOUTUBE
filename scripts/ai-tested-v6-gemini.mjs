#!/usr/bin/env node
// AI Tested Shorts v6: Gemini creative direction, frame/audio review, targeted corrections, acceptance.
//
//   node scripts/ai-tested-v6-gemini.mjs director-pre   [--root DIR]
//   node scripts/ai-tested-v6-gemini.mjs loop           [--root DIR]   (review -> final direction -> correct -> rerender)
//   node scripts/ai-tested-v6-gemini.mjs accept         [--root DIR]
//
// Every judgement is bound to the sha256 of the exact mp4 it looked at, and every model call is pinned to Gemini
// (FORCE_PROVIDER=gemini): a failure is recorded as a failure, never answered by another provider and never skipped.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

process.env.FORCE_PROVIDER = "gemini";
if (!process.env.MAX_TOKENS_PER_VIDEO) process.env.MAX_TOKENS_PER_VIDEO = "20000000";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cmd = process.argv[2];
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const root = path.resolve(arg("root", path.join(repoRoot, "data/ai-tested/shorts-v5")));
const plansDir = path.join(root, "plans");
const scriptsDir = path.join(root, "scripts");
const factsDir = path.join(root, "facts");
const outDir = path.join(root, "out");
const qaDir = path.join(root, "qa");
const recDir = path.join(root, "production-records");
const reviewsRoot = path.join(root, "reviews");
const publicDir = path.join(root, "render", "public");
const MODEL = process.env.GEMINI_REVIEW_MODEL || "gemini-3.5-flash";
for (const d of [qaDir, recDir, reviewsRoot]) fs.mkdirSync(d, { recursive: true });

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, "")); } catch { return null; } };
const writeJson = (p, o) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(o, null, 2)); };
const list = (d, ext) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith(ext)).sort() : []);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const sh = (c, a, o = {}) => spawnSync(c, a, { encoding: "utf8", maxBuffer: 1 << 28, ...o });
const imgPart = (p) => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${fs.readFileSync(p).toString("base64")}` } });

function parseJsonLoose(v) {
  if (v && typeof v === "object") return v;
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(s); } catch { /* fall through */ }
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return null;
}

const llm = await import(pathToFileURL(path.join(repoRoot, "src/lib/llm.js")).href);
const lib = await import(pathToFileURL(path.join(root, "plan-lib.mjs")).href);

/** One pinned Gemini call with retries. Throws if Gemini cannot answer with parseable JSON. */
async function ask(parts, tag, maxTokens = 8000) {
  if (!llm.llmConfigured()) throw new Error("no Gemini key configured");
  let last = "no attempt";
  const maxAttempts = parseInt(process.env.GEMINI_MAX_ATTEMPTS || "8", 10);
  const attemptTimeoutMs = parseInt(process.env.GEMINI_ATTEMPT_TIMEOUT_MS || "240000", 10);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let timer;
    try {
      const call = llm.callLLMWithProvenance([{ role: "user", content: parts }], { maxTokens, model: MODEL, noCache: true, _noOllamaFirst: true, temperature: 0.2 }, tag);
      const res = await Promise.race([
        call,
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`gemini attempt timed out after ${attemptTimeoutMs}ms`)), attemptTimeoutMs); }),
      ]);
      if (res.provider !== "gemini") throw new Error(`answered by ${res.provider}, not gemini`);
      if (res.error || llm.isProviderError(res.value)) last = `provider error: ${res.error || res.value?.error} ${String(res.value?.detail || "").slice(0, 200)}`;
      else {
        const v = res.value;
        const obj = typeof v?.content === "string" ? parseJsonLoose(v.content) : parseJsonLoose(v);
        if (obj && typeof obj === "object") return { obj, provider: "gemini", model: MODEL, chain: res.chain };
        last = "unparseable JSON: " + JSON.stringify(v).slice(0, 200);
      }
    } catch (e) {
      last = String(e?.message || e).slice(0, 300);
    } finally {
      clearTimeout(timer);
    }
    console.error(`[${tag}] attempt ${attempt} failed: ${last}`);
    await sleep(Math.min(attempt * 30000, 150000));
  }
  throw new Error(`gemini failed after retries: ${last}`);
}

const SCENE_GUIDE = `Scene fields (a beat is {scene, narration, kicker<=30, headline<=46, sub, hl[], ghost, callouts[], transition, media[], logos[], items[], ...}):
type_slam: media role bg, logos[{id,label}], callouts, ghost, hl, sub.
cutout_hero: media role cutout, items[{label,value,note,color}], ghost.
logo_wall: logos[{id,label,color}], sub = counter label.
stat_hero: stat{value,prefix,suffix,decimals,label,dots,ghost,derived}, items[{label,value,color}], sub.
line_chart: chart{series[{name,color,points[{x,y}]}],yMax,prefix,unit,xTitle,note}.
bar_chart: chart{rows[{label,values[{name,v,color}]}],yMax,prefix,unit,ratio,ratioLabel,note}.
timeline: items[{label,value,note,color}] (>=3).
compare: compare{left,right{title,logo,color,tag,rows[{k,v}]},vs,win}.
screenshot: media[0] real screenshot, crops[{x,y,w,h,label}] fractions (max 2).
manifest: items[{label,value,color,strike}], sub = window title, callouts, media role bg.
document: doc{title,sub,stamp,clauses[]}.
question: headline, sub, cta.
Transitions: cut wipe push slide zoom flash iris. Theme keys: mode bg bg2 ink muted accent accent2 accent3 panel panelInk line texture(grid|scan|dots|paper|hazard|none) display(anton|mono|outfit|serif|inter).
Audio: music/ambience {src,volume,fadeIn,fadeOut,duck}; sfx [{src,beat,offset,volume,dur,purpose}].`;

// ---------------------------------------------------------------- plans / facts helpers
const planFiles = () => list(plansDir, ".plan.json");
const loadPlan = (f) => readJson(path.join(plansDir, f));
const baseOf = (p) => `${p.id}-${p.slug}`;
const factsOf = (p) => readJson(path.join(factsDir, `${p.id}.facts.json`));
const scriptOf = (p) => readJson(path.join(scriptsDir, `${baseOf(p)}.json`));
const factsDigest = (f) => ({
  facts: (f?.facts || []).map((x) => ({ id: x.id, claim: x.claim || x.statement || x.text, source: x.source || x.url })),
  numbers: f?.numbers, timeline: f?.timeline,
});

function validate(plan, usePublic) {
  return lib.validatePlan(plan, { publicDir: usePublic, script: scriptOf(plan).script, facts: factsOf(plan) });
}

const verdictOk = (o) => o && o.approved === true && !(o.required_changes || o.concerns || []).some((c) => /blocker|high/i.test(String(c.severity)));

// ---------------------------------------------------------------- DIRECTOR (pre-render)
async function directorPre() {
  const plans = planFiles().map(loadPlan);
  const digest = plans.map((p) => ({ id: p.id, title: p.title, look: p.theme && { mode: p.theme.mode, bg: p.theme.bg, accent: p.theme.accent, texture: p.theme.texture, display: p.theme.display }, scenes: (p.beats || []).map((b) => b.scene), music: p.audio?.music?.src, ambience: p.audio?.ambience?.src }));
  let failed = 0;
  for (const plan of plans) {
    const base = baseOf(plan);
    const det = validate(plan, path.join(root, "assets"));
    // The Bonta cutout is generated earlier in the same job, so it must exist by now; any error is a real error.
    const rec = readJson(path.join(recDir, `${base}.director.json`)) || {};
    if (!det.ok) {
      rec.pre = { status: "deterministic_fail", approved: false, errors: det.errors, at: new Date().toISOString() };
      writeJson(path.join(recDir, `${base}.director.json`), rec);
      console.error(`${base}: plan validation failed\n - ${det.errors.join("\n - ")}`);
      failed++; continue;
    }
    const script = scriptOf(plan);
    const prompt = [
      "You are the creative director of the AI Tested YouTube Shorts channel (1080x1920, fast, factual, visual-first AI news).",
      "Review this PRE-RENDER blueprint before anything is rendered. Remotion will execute it exactly. Decide whether it will make a finished, professional Short.",
      "Check: hook in the first 2 seconds; scene-by-scene progression and payoff; a meaningful visual event about every second; assets that are real and relevant (logos, photos, screenshots, cutouts); graphs that use only real facts; transitions; SFX/music/ambience plan matches events; typography and palette; and DISTINCT identity versus the other four videos listed below (same AI Tested brand, different treatment).",
      "Fact discipline: every number on screen must trace to the facts file. Flag any claim presented as proven that the facts only report as alleged.",
      `Return ONLY JSON: {"approved":boolean,"verdict":string,"distinctness_score":0-10,"hook_ok":boolean,"required_changes":[{"beat":number|null,"severity":"blocker|high|medium|low","field":string,"change":string}],"direction_notes":[string]}. Approve only if there are no blocker/high required_changes.`,
      `SCRIPT:\n${script.script}`,
      `FACTS:\n${JSON.stringify(factsDigest(factsOf(plan)))}`,
      `BLUEPRINT:\n${JSON.stringify(plan)}`,
      `OTHER FOUR VIDEOS (for distinctness):\n${JSON.stringify(digest.filter((d) => d.id !== plan.id))}`,
      `DETERMINISTIC VALIDATION: passed. Warnings: ${JSON.stringify(det.warns)}`,
    ].join("\n\n");
    try {
      const r = await ask([{ type: "text", text: prompt }], "v6-director-pre", 6000);
      const approved = verdictOk(r.obj);
      rec.pre = { status: "ok", approved, provider: r.provider, model: r.model, verdict: r.obj.verdict, distinctness_score: r.obj.distinctness_score, required_changes: r.obj.required_changes || [], direction_notes: r.obj.direction_notes || [], plan_sha256: crypto.createHash("sha256").update(JSON.stringify(plan)).digest("hex"), at: new Date().toISOString() };
      console.log(`${base}: director-pre approved=${approved} distinct=${r.obj.distinctness_score}`);
      if (!approved) { failed++; console.error(JSON.stringify(r.obj.required_changes, null, 1)); }
    } catch (e) {
      rec.pre = { status: "gemini_failed", approved: false, error: String(e.message || e), at: new Date().toISOString() };
      console.error(`${base}: director-pre FAILED: ${e.message}`); failed++;
    }
    writeJson(path.join(recDir, `${base}.director.json`), rec);
  }
  if (failed) { fs.writeFileSync(path.join(recDir, "DIRECTOR_FAILED.txt"), `${failed} blueprint(s) not approved; see *.director.json\n`); process.exit(1); }
  console.log("director-pre: all blueprints approved");
}

// ---------------------------------------------------------------- evidence extraction
function extractEvidence(mp4, base) {
  const fdir = path.join(qaDir, "frames", base);
  fs.rmSync(fdir, { recursive: true, force: true });
  fs.mkdirSync(fdir, { recursive: true });
  const e1 = sh("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", mp4, "-vf", "fps=1,scale=540:-1", "-q:v", "4", path.join(fdir, "f%03d.jpg")]);
  const e2 = sh("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", mp4, "-t", "2.5", "-vf", "fps=4,scale=360:-1", "-q:v", "4", path.join(fdir, "h%02d.jpg")]);
  fs.mkdirSync(path.join(qaDir, "contact-sheets"), { recursive: true });
  const sheet = path.join(qaDir, "contact-sheets", `${base}.jpg`);
  const e3 = sh("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", mp4, "-vf", "fps=1,scale=270:-1,tile=6x8", "-frames:v", "1", "-q:v", "3", sheet]);
  for (const e of [e1, e2, e3]) if (e.status !== 0) throw new Error("ffmpeg evidence extraction failed: " + e.stderr);
  const fr = list(fdir, ".jpg");
  return { fdir, sheet, frames: fr.filter((f) => f.startsWith("f")), hook: fr.filter((f) => f.startsWith("h")) };
}

function beatAt(timing, t) {
  const bs = timing?.beats || [];
  return bs.findIndex((b) => t >= b.t && t < b.t + b.dur);
}

function audioListen(mp4, base) {
  const f = path.join(qaDir, `${base}.audio16k.mp3`);
  const e = sh("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", mp4, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", f]);
  if (e.status !== 0) throw new Error("audio extract failed");
  return { type: "input_audio", input_audio: { data: fs.readFileSync(f).toString("base64"), format: "mp3" } };
}

// ---------------------------------------------------------------- REVIEW
const SCORE_KEYS = ["hook", "composition_fill", "motion_density", "storytelling", "asset_quality", "typography_readability", "graphics_accuracy", "sound_plan_fit", "distinct_identity"];

async function reviewOne(plan, outRevDir) {
  const base = baseOf(plan);
  const mp4 = path.join(outDir, `${base}.mp4`);
  const review = { id: plan.id, slug: plan.slug, title: plan.title, status: "not_reviewed", pass: false, provider: null, model: MODEL, reviewedAt: new Date().toISOString() };
  if (!fs.existsSync(mp4)) { review.reason = "no_mp4"; writeJson(path.join(outRevDir, `${base}.review.json`), review); return review; }
  review.mp4_sha256 = sha256(mp4);
  const ev = extractEvidence(mp4, base);
  const timing = readJson(path.join(outDir, `${base}.timing.json`));
  const audio = readJson(path.join(outDir, `${base}.audio.json`));
  const metrics = readJson(path.join(qaDir, `${base}.metrics.json`));
  const dur = parseFloat(sh("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]).stdout) || 0;
  const rubric = [
    "You are a harsh, specific senior motion-graphics reviewer for an AI Tested YouTube Short (1080x1920, vertical). You are looking at REAL frames from the rendered mp4, one per second (labelled with time and beat), a 4-fps hook strip, and a contact sheet.",
    "Judge the render, not the intent. Anchor every judgement to timestamps. Score 0-10 where 5 = amateur template, 7 = broadcast-quality Short, 9+ = exceptional (rare). Do not inflate scores.",
    "Look for: weak hook in the first 2s; text that does not match narration at that time; top-heavy layouts or tiny graphics floating in empty canvas; text clipped, overlapping or below mobile-safe size; logos wrong/missing; cutout halos or wrong crops; charts whose values/labels disagree with the data or narration; static stretches longer than ~2s with no visual event; repetitive template feel; palette/typography clashes; sound plan that does not fit what is on screen.",
    `Return ONLY JSON: {"observations":[{"t":number,"saw":string}] (at least 10, spread over the whole video, describing what is actually visible),"scores":{${SCORE_KEYS.map((k) => `"${k}":0-10`).join(",")}},"issues":[{"t":number,"beat":number,"severity":"blocker|high|medium|low","category":string,"problem":string,"fix_field":string,"fix":string}],"strengths":[string],"summary":string,"pass":boolean}.`,
    "fix_field is the plan field to change, e.g. beats[3].headline, beats[2].items, theme.accent, audio.music.volume. Only mark pass true if every score >= 7 and there are no blocker/high issues.",
    `TITLE: ${plan.title}`,
    `NARRATION (spoken script): ${scriptOf(plan).script}`,
    `DURATION: ${dur.toFixed(1)}s`,
    `BEAT TIMING: ${JSON.stringify((timing?.beats || []).map((b) => ({ beat: b.i, scene: b.scene, from: b.t, to: +(b.t + b.dur).toFixed(2), narration: b.narration })))}`,
    `PLAN (what the director intended): ${JSON.stringify({ concept: plan.concept, creative_direction: plan.creative_direction, theme: plan.theme, beats: plan.beats })}`,
    `FACTS the video may show: ${JSON.stringify(factsDigest(factsOf(plan)))}`,
    `SFX PLAN (absolute times): ${JSON.stringify((timing?.sfx || []).map((s) => ({ t: s.t, src: s.src, purpose: s.purpose })))}`,
    `MEASURED AUDIO: ${JSON.stringify(audio)}`,
    `MEASURED VISUAL METRICS: ${JSON.stringify(metrics && { busy_mean: metrics.busy_mean, top_share_mean: metrics.top_share_mean, lower_share_mean: metrics.lower_share_mean, change_mean: metrics.change_mean, longest_static_s: metrics.longest_static_s, bad: metrics.bad })}`,
  ].join("\n");
  const parts = [{ type: "text", text: rubric }, { type: "text", text: "CONTACT SHEET, one tile per second left-to-right, top-to-bottom:" }, imgPart(ev.sheet)];
  for (const f of ev.hook) { parts.push({ type: "text", text: `HOOK t=${((parseInt(f.slice(1)) - 1) / 4).toFixed(2)}s` }); parts.push(imgPart(path.join(ev.fdir, f))); }
  for (const f of ev.frames) {
    const t = parseInt(f.slice(1)) - 1;
    const bi = beatAt(timing, t + 0.5);
    parts.push({ type: "text", text: `FRAME t=${t}s${bi >= 0 ? ` beat ${bi} (${timing.beats[bi].scene})` : ""}` });
    parts.push(imgPart(path.join(ev.fdir, f)));
  }
  try {
    const r = await ask(parts, "v6-review", 12000);
    const o = r.obj;
    const scores = o.scores || {};
    const obs = Array.isArray(o.observations) ? o.observations.filter((x) => Number.isFinite(Number(x.t)) && Number(x.t) <= dur + 1 && String(x.saw || "").length > 12) : [];
    const issues = (Array.isArray(o.issues) ? o.issues : []).map((i) => ({ ...i, source: "frames" }));
    Object.assign(review, { provider: r.provider, model: r.model, observations: o.observations, scores, strengths: o.strengths || [], summary: o.summary || "", model_pass: o.pass === true });
    if (obs.length < 8) { review.reason = `invalid_review: only ${obs.length} usable timestamped observations (frames not demonstrably viewed)`; review.issues = issues; }
    else if (SCORE_KEYS.some((k) => !Number.isFinite(Number(scores[k])))) { review.reason = "invalid_review: missing scores"; review.issues = issues; }
    else {
      review.status = "reviewed";
      // audio: try to actually listen. Not every Gemini route accepts audio input; record exactly what happened.
      try {
        const ap = audioListen(mp4, base);
        const ar = await ask([{ type: "text", text: `Listen to the audio of this ${dur.toFixed(0)}s vertical news Short. Narration script: "${scriptOf(plan).script}". Evaluate: narration clear and complete; background music audible but not covering speech; sound effects present, in sync, not harsh/clipped; ambience; overall mix balance and any distortion. Return ONLY JSON {"heard":true|false,"narration_clear":boolean,"music_audible":boolean,"sfx_audible":boolean,"mix_balance_ok":boolean,"issues":[{"t":number,"severity":"blocker|high|medium|low","problem":string,"fix_field":string,"fix":string}],"summary":string}` }, ap], "v6-audio", 3000);
        review.audio_listen = { status: "ok", ...ar.obj };
        if (ar.obj.heard === true) for (const i of ar.obj.issues || []) issues.push({ ...i, source: "audio", category: "audio" });
      } catch (e) { review.audio_listen = { status: "unavailable", detail: String(e.message || e).slice(0, 300) }; }
      review.issues = issues;
      const lowScores = SCORE_KEYS.filter((k) => Number(scores[k]) < 7);
      const blocking = issues.filter((i) => /blocker|high/i.test(String(i.severity)));
      review.pass = lowScores.length === 0 && blocking.length === 0;
      review.low_scores = lowScores;
    }
  } catch (e) { review.reason = "gemini_failed"; review.detail = String(e.message || e); review.issues = []; }
  writeJson(path.join(outRevDir, `${base}.review.json`), review);
  return review;
}

// ---------------------------------------------------------------- DIRECTOR (final, after review)
async function directorFinal(plan, review) {
  const base = baseOf(plan);
  const mp4 = path.join(outDir, `${base}.mp4`);
  const sheet = path.join(qaDir, "contact-sheets", `${base}.jpg`);
  const rec = readJson(path.join(recDir, `${base}.director.json`)) || {};
  const out = { status: "gemini_failed", approved: false, mp4_sha256: sha256(mp4), at: new Date().toISOString() };
  const parts = [{ type: "text", text: [
    "You are the creative director who signed off the blueprint for this AI Tested Short. Now you see the RENDERED result's review. Give final sign-off only if you would publish this under the AI Tested brand today.",
    `Return ONLY JSON {"approved":boolean,"verdict":string,"concerns":[{"beat":number|null,"severity":"blocker|high|medium|low","field":string,"change":string}]}.`,
    `BLUEPRINT NOTES: ${JSON.stringify(rec.pre?.direction_notes || [])}`,
    `REVIEW SCORES: ${JSON.stringify(review.scores)} SUMMARY: ${review.summary}`,
    `REVIEW ISSUES: ${JSON.stringify(review.issues)}`,
    `NARRATION: ${scriptOf(plan).script}`,
    "Contact sheet of the actual render, one tile per second:",
  ].join("\n") }, imgPart(sheet)];
  try {
    const r = await ask(parts, "v6-director-final", 4000);
    Object.assign(out, { status: "ok", approved: verdictOk(r.obj), provider: r.provider, model: r.model, verdict: r.obj.verdict, concerns: r.obj.concerns || [] });
  } catch (e) { out.error = String(e.message || e); }
  rec.final = out;
  writeJson(path.join(recDir, `${base}.director.json`), rec);
  return out;
}

// ---------------------------------------------------------------- CORRECT (targeted patches)
const FORBIDDEN_BEAT_FIELDS = new Set(["narration", "t", "dur", "evidence", "id"]);
function tokens(p) { return [...String(p).matchAll(/([^.\[\]]+)|\[(\d+)\]/g)].map((m) => (m[2] !== undefined ? Number(m[2]) : m[1])); }
function allowedPath(tk) {
  if (!tk.length) return false;
  if (tk[0] === "beats") return typeof tk[1] === "number" && tk.length >= 3 && !FORBIDDEN_BEAT_FIELDS.has(tk[2]);
  if (tk[0] === "theme") return tk.length >= 2;
  if (tk[0] === "audio") return ["music", "ambience", "sfx"].includes(tk[1]);
  return tk[0] === "creative_direction" || tk[0] === "concept";
}
function applyOp(plan, op) {
  const tk = tokens(op.path);
  if (!allowedPath(tk)) throw new Error(`path not allowed: ${op.path}`);
  let cur = plan;
  for (let i = 0; i < tk.length - 1; i++) { if (cur[tk[i]] === undefined || cur[tk[i]] === null) { if (op.op === "set") cur[tk[i]] = typeof tk[i + 1] === "number" ? [] : {}; else throw new Error(`no such path ${op.path}`); } cur = cur[tk[i]]; }
  const last = tk[tk.length - 1];
  if (op.op === "set") cur[last] = op.value;
  else if (op.op === "append") { if (!Array.isArray(cur[last])) throw new Error("append target not an array"); cur[last].push(op.value); }
  else if (op.op === "remove") { if (Array.isArray(cur) && typeof last === "number") cur.splice(last, 1); else delete cur[last]; }
  else throw new Error(`unknown op ${op.op}`);
}

async function correctOne(plan, planFile, issues, cycle) {
  const base = baseOf(plan);
  const rec = { base, cycle, issues_in: issues.length, attempts: [], applied: [], rejected: [], plan_changed: false };
  const original = JSON.stringify(plan);
  let work = JSON.parse(original);
  let feedback = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const prompt = [
      "You are the creative director fixing a rendered AI Tested Short by patching its blueprint JSON. Fix the listed issues with the SMALLEST set of concrete patches that will visibly change the render. Do not change narration or evidence ids. Do not invent facts, numbers, logos or images: use only values present in the FACTS and assets already in the plan/manifest.",
      `Return ONLY JSON {"patches":[{"op":"set|append|remove","path":"beats[2].headline","value":any,"why":string}],"notes":string}. Paths: beats[i].<field> (not narration/t/dur/evidence), theme.<key>, audio.music|ambience|sfx, creative_direction.*, concept. A scene change must supply every field the new scene needs.`,
      SCENE_GUIDE,
      `ISSUES TO FIX:\n${JSON.stringify(issues)}`,
      feedback && `YOUR PREVIOUS PATCHES WERE REJECTED:\n${feedback}`,
      `FACTS:\n${JSON.stringify(factsDigest(factsOf(plan)))}`,
      `CURRENT PLAN:\n${JSON.stringify(work)}`,
    ].filter(Boolean).join("\n\n");
    let r;
    try { r = await ask([{ type: "text", text: prompt }], "v6-correct", 12000); } catch (e) { rec.attempts.push({ attempt, error: String(e.message || e) }); rec.error = String(e.message || e); break; }
    const trial = JSON.parse(JSON.stringify(work));
    const applied = [], rejected = [];
    for (const op of Array.isArray(r.obj.patches) ? r.obj.patches : []) {
      try { applyOp(trial, op); applied.push(op); } catch (e) { rejected.push({ op, error: String(e.message || e) }); }
    }
    const v = validate(trial, publicDir);
    rec.attempts.push({ attempt, applied: applied.length, rejected, validation_errors: v.errors });
    if (!applied.length) { feedback = `No applicable patches. Rejected: ${JSON.stringify(rejected)}`; continue; }
    if (!v.ok) { feedback = `Validation errors after applying: ${v.errors.join("; ")}. Rejected ops: ${JSON.stringify(rejected)}`; continue; }
    work = trial; rec.applied = applied; rec.rejected = rejected; rec.notes = r.obj.notes;
    break;
  }
  if (work && work.audio && Array.isArray(work.audio.sfx)) work.audio.sfx = work.audio.sfx.filter(s => s && typeof s === "object");
  if (work && Array.isArray(work.beats)) work.beats = work.beats.filter(b => b && typeof b === "object");
  if (JSON.stringify(work) !== original) { fs.writeFileSync(planFile, JSON.stringify(work, null, 2)); rec.plan_changed = true; }
  return rec;
}

// ---------------------------------------------------------------- LOOP
function runRender(ids) {
  console.log(`=== rerender ${ids.join(",")} ===`);
  const r = spawnSync("node", ["render-all.mjs"], { cwd: path.join(root, "render"), stdio: "inherit", env: { ...process.env, ONLY_IDS: ids.join(",") } });
  return r.status === 0;
}
function runQa() {
  const r = spawnSync("python", [path.join(root, "qa-verify.py"), outDir, qaDir], { cwd: root, stdio: "inherit" });
  return r.status === 0;
}

async function loop() {
  const maxCycles = parseInt(process.env.LOOP_MAX_CYCLES || "6", 10);
  const deadline = Date.now() + parseFloat(process.env.LOOP_MAX_MINUTES || "200") * 60000;
  const state = readJson(path.join(recDir, "loop-state.json")) || { cycles: [] };
  let stalled = 0, blocker = null;
  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    if (Date.now() > deadline) { blocker = "time budget exhausted"; break; }
    console.log(`\n=== CYCLE ${cycle}/${maxCycles} ===`);
    runQa();
    const revDir = path.join(reviewsRoot, `cycle-${cycle}`);
    fs.mkdirSync(revDir, { recursive: true });
    const entries = [];
    let geminiBlocked = false;
    for (const f of planFiles()) {
      const plan = loadPlan(f);
      const base = baseOf(plan);
      const mp4 = path.join(outDir, `${base}.mp4`);
      const entry = { f, plan, base, issues: [], done: false };
      const metrics = readJson(path.join(qaDir, `${base}.metrics.json`));
      const techBad = fs.existsSync(mp4) && metrics ? metrics.bad || [] : [fs.existsSync(mp4) ? "BAD technical QA produced no metrics" : "BAD no mp4 rendered"];
      for (const b of techBad) entry.issues.push({ source: "technical_qa", severity: "high", problem: b, fix: "change layout/motion/audio plan so this measured check passes" });
      const prev = readJson(path.join(recDir, `${base}.director.json`));
      const prevRev = readJson(path.join(reviewsRoot, "final", `${base}.review.json`));
      const sha = fs.existsSync(mp4) ? sha256(mp4) : null;
      const unchanged = sha && prevRev?.mp4_sha256 === sha && prevRev.pass === true && prev?.final?.mp4_sha256 === sha && prev.final.approved === true && !techBad.length;
      if (unchanged) { entry.done = true; entries.push(entry); console.log(`${base}: already approved for this exact render`); continue; }
      if (!fs.existsSync(mp4)) { entries.push(entry); continue; }
      const review = await reviewOne(plan, revDir);
      entry.review = review;
      if (review.status !== "reviewed") {
        console.error(`${base}: review not valid (${review.reason})`);
        if (review.reason === "gemini_failed") geminiBlocked = true;
        else entry.issues.push({ source: "review_invalid", severity: "high", problem: review.reason, fix: "make the frames clearer and more complete so every moment is legible" });
      } else {
        for (const i of review.issues || []) if (/blocker|high|medium/i.test(String(i.severity))) entry.issues.push(i);
        if (!review.pass && !entry.issues.length) entry.issues.push({ source: "review_scores", severity: "high", problem: `scores below 7: ${(review.low_scores || []).join(", ")}`, fix: "raise those aspects" });
        if (review.pass && !techBad.length) {
          const fin = await directorFinal(plan, review);
          if (fin.status !== "ok") geminiBlocked = true;
          else if (!fin.approved) for (const c of fin.concerns || []) entry.issues.push({ source: "director_final", severity: c.severity || "high", problem: c.change, fix: c.change, beat: c.beat, fix_field: c.field });
          else { entry.done = true; fs.mkdirSync(path.join(reviewsRoot, "final"), { recursive: true }); writeJson(path.join(reviewsRoot, "final", `${base}.review.json`), review); }
          if (fin.status === "ok" && !fin.approved && !entry.issues.length) entry.issues.push({ source: "director_final", severity: "high", problem: fin.verdict || "director did not approve", fix: "address director verdict" });
        }
      }
      entries.push(entry);
    }
    const summary = entries.map((e) => ({ base: e.base, done: e.done, issues: e.issues.length, review_pass: e.review?.pass ?? null }));
    state.cycles.push({ cycle, summary, at: new Date().toISOString() });
    writeJson(path.join(recDir, "loop-state.json"), state);
    console.log(JSON.stringify(summary));
    if (geminiBlocked) { blocker = "Gemini could not answer after retries (external blocker)"; break; }
    if (entries.every((e) => e.done)) { console.log("ALL VIDEOS APPROVED FOR THEIR CURRENT RENDERS"); break; }
    const changedIds = [];
    for (const e of entries.filter((x) => !x.done)) {
      if (!e.issues.length) continue;
      const rec = await correctOne(e.plan, path.join(plansDir, e.f), e.issues, cycle);
      writeJson(path.join(revDir, `${e.base}.correction.json`), rec);
      console.log(`${e.base}: correction changed=${rec.plan_changed} applied=${rec.applied.length}`);
      if (rec.plan_changed) changedIds.push(e.plan.id);
    }
    if (!changedIds.length) { stalled++; console.error(`no plan changed this cycle (stalled ${stalled})`); if (stalled >= 2) { blocker = "corrections stalled: Gemini produced no valid change for two cycles"; break; } continue; }
    stalled = 0;
    if (!runRender(changedIds)) { blocker = "rerender failed; see render logs"; break; }
  }
  if (blocker) { fs.writeFileSync(path.join(recDir, "LOOP_BLOCKER.txt"), blocker + "\n"); console.error("LOOP STOPPED:", blocker); }
  process.exit(blocker ? 1 : 0);
}

// ---------------------------------------------------------------- ACCEPT
function accept() {
  const statuses = [];
  let allApproved = true;
  for (const f of planFiles()) {
    const plan = loadPlan(f);
    const base = baseOf(plan);
    const mp4 = path.join(outDir, `${base}.mp4`);
    const exists = fs.existsSync(mp4);
    const sha = exists ? sha256(mp4) : null;
    let rendered = false, probeInfo = null;
    if (exists) {
      const p = sh("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate:format=duration,size", "-of", "json", mp4]);
      try { probeInfo = JSON.parse(p.stdout); } catch { probeInfo = null; }
      const v = probeInfo?.streams?.find((s) => s.codec_type === "video"), a = probeInfo?.streams?.find((s) => s.codec_type === "audio");
      rendered = !!(v && a && v.width === 1080 && v.height === 1920 && Number(probeInfo.format.size) > 200000 && parseFloat(probeInfo.format.duration) > 12);
    }
    const metrics = readJson(path.join(qaDir, `${base}.metrics.json`));
    const technical = rendered && !!metrics && (metrics.bad || []).length === 0;
    const review = readJson(path.join(reviewsRoot, "final", `${base}.review.json`));
    const geminiReview = !!(review && review.status === "reviewed" && review.pass === true && review.provider === "gemini" && review.mp4_sha256 === sha);
    const dir = readJson(path.join(recDir, `${base}.director.json`));
    const director = !!(dir?.pre?.approved && dir.pre.provider === "gemini" && dir?.final?.approved && dir.final.provider === "gemini" && dir.final.mp4_sha256 === sha);
    const finalApproved = rendered && technical && geminiReview && director;
    if (!finalApproved) allApproved = false;
    statuses.push({ id: plan.id, slug: plan.slug, title: plan.title, mp4_sha256: sha, bytes: probeInfo ? Number(probeInfo.format.size) : null, duration_s: probeInfo ? parseFloat(probeInfo.format.duration) : null, RENDERED: rendered, TECHNICAL_QA_PASSED: technical, GEMINI_REVIEW_PASSED: geminiReview, DIRECTOR_APPROVED: director, FINAL_APPROVED: finalApproved, review_scores: review?.scores || null });
  }
  const report = { generatedAt: new Date().toISOString(), allApproved, statuses, loop_blocker: fs.existsSync(path.join(recDir, "LOOP_BLOCKER.txt")) ? fs.readFileSync(path.join(recDir, "LOOP_BLOCKER.txt"), "utf8").trim() : null };
  writeJson(path.join(recDir, "acceptance.json"), report);
  writeJson(path.join(root, "acceptance.json"), report);
  console.log(JSON.stringify(report, null, 2));
  if (!allApproved) { console.error("ACCEPTANCE FAILED: not every video is FINAL_APPROVED"); process.exit(1); }
  console.log("ACCEPTANCE PASSED");
}

if (cmd === "director-pre") await directorPre();
else if (cmd === "loop") await loop();
else if (cmd === "accept") accept();
else { console.error("usage: ai-tested-v6-gemini.mjs director-pre|loop|accept [--root DIR]"); process.exit(2); }
