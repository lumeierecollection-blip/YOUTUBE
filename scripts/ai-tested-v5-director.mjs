#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function arg(name, def = null) { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : def; }
const root = path.resolve(arg("root", "."));
const scriptsDir = path.join(root, "scripts");
const plansDir = path.join(root, "plans");
const treatmentsDir = path.join(root, "treatments");
const recordsDir = path.join(root, "production-records");
for (const d of [plansDir, treatmentsDir, recordsDir]) fs.mkdirSync(d, { recursive: true });
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadLLM() { try { return await import(pathToFileURL(path.join(repoRoot, "src/lib/llm.js")).href); } catch (e) { return { error: String(e) }; } }
function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "")); }
function list(dir, ext) { return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(ext)).sort() : []; }
function writeJson(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function parseJsonLoose(v) {
  if (v && typeof v === "object") return v;
  if (typeof v !== "string") return null;
  let s = v.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

const llm = await loadLLM();
const canLLM = !llm.error && typeof llm.callLLM === "function" && (!llm.llmConfigured || llm.llmConfigured());
const scriptFiles = list(scriptsDir, ".json");
const report = [];

if (!canLLM) {
  const rec = { stage: "director", status: "llm_unavailable", reason: llm.error || "not configured", at: new Date().toISOString() };
  writeJson(path.join(recordsDir, "director-summary.json"), rec);
  writeJson(path.join(recordsDir, "DIRECTOR_FAILED.txt".replace('.txt','.json')), rec);
  fs.writeFileSync(path.join(recordsDir, "DIRECTOR_FAILED.txt"), "LLM unavailable for mandatory Gemini director\n");
  console.error("DIRECTOR FAILED: LLM unavailable");
  process.exit(1);
}

for (const sf of scriptFiles) {
  const script = readJson(path.join(scriptsDir, sf));
  const base = `${script.id}-${script.slug}`;
  const planPath = path.join(plansDir, `${base}.plan.json`);
  const treatPath = path.join(treatmentsDir, `${base}.treatment.json`);
  const recPath = path.join(recordsDir, `${base}.director.json`);
  const rawPath = path.join(recordsDir, `${base}.director.raw.json`);
  const seedPlan = fs.existsSync(planPath) ? readJson(planPath) : null;
  const seedTreat = fs.existsSync(treatPath) ? readJson(treatPath) : null;
  const existingRec = fs.existsSync(recPath) ? readJson(recPath) : null;
  if (existingRec?.status === "ok" && existingRec?.approved === true && seedPlan?.beats?.length >= 3) {
    const rec = { ...existingRec, reused: true, at: existingRec.at || new Date().toISOString() };
    writeJson(recPath, rec); report.push(rec); console.log(base, "reused-ok"); continue;
  }

  const prompt = [
    "You are the Gemini creative director for an AI Tested YouTube Short (1080x1920, 9:16). You must originate the visual direction for THIS specific story. Seed material is reference only; do not copy it verbatim.",
    "Return ONLY JSON with keys: creative_treatment(object), plan(object), self_critique(object), approved(boolean).",
    "creative_treatment must include: concept, visual_identity, storytelling_approach, hook_visual, escalation, payoff, asset_requirements(array of {type,subject,source_hint,transparent_bg,scene}), constraints(array), motion_direction(object), audio_direction(object), central_composition(object), typography(object), color_palette(array), rendering_requirements(object).",
    "motion_direction must include: visual_event_schedule(array of {t,dur,event,animation,easing}), rhythm, staging_notes, transitions(array of {t,type,purpose}).",
    "audio_direction must include: music_direction, ambience_direction, sfx_events(array of {t,src,volume,dur,purpose}), narration_protection, silence_moments(array), mix_notes(object).",
    "plan must include: id,slug,title,concept,sources,cta,visual_identity,duration_target_sec,beats(array),audio(object with music{src?,volume?} and sfx array {src,t,volume,dur,purpose}), asset_manifest(array of {file,type,source,license,scene,transparent,resolution,status}).",
    "Each beat must include: t,dur,narration,kicker,visual,headline,sub,accent,bg,bg_image(optional),assets(array),photo(optional),photo_credit(optional),focal(object {x,y,w,h_pct}),motion(array),transition(optional),sfx(optional array), and optional left,right,cta,chart,timeline.",
    "Allowed visual types: full_bleed_type,hero_cutout,photo,full_bleed_photo,warning_panel,split_compare,kinetic_type,stat_counter,stamp_document,legal_stack,quote_card,final_question,product_card,logo_grid,evidence_board,tool_card,bar_chart,line_graph,timeline,progress_bar.",
    "For bar_chart/line_graph include chart={type,unit,points:[{label,value,color}]}. For timeline include timeline={steps:[...]} or timeline=[...]. Use real values only; never fabricate data.",
    "Use only real SFX src values from the library: sfx/whoosh.mp3,sfx/riser.mp3,sfx/click.ogg,sfx/click-soft.ogg,sfx/tick.ogg,sfx/tick-tight.ogg,sfx/hit.ogg,sfx/impact.ogg,sfx/thud.ogg,sfx/sweep.ogg,sfx/glitch.ogg,sfx/reveal.ogg,sfx/confirm.ogg,sfx/error.ogg,sfx/switch.ogg,sfx/drop.ogg,sfx/bell.ogg. Never invent SFX filenames.",
    "Rules: no camera moves/zooms/pans; no debug labels; no repetitive generic template; strong hook in first 2s; every beat has meaningful visual change; central prominent mobile composition; use real relevant logos/photos/cutouts where story references real entities; specify background removal needs for photos; no fabricated facts/quotes/stats; if data is unavailable do not invent chart data.",
    "The plan must be executable by Remotion. Every visual/asset/sfx you specify must be realistic for the renderer and asset pipeline.",
    `SCRIPT: ${JSON.stringify(script)}`,
    `SEED_TREATMENT_REFERENCE_ONLY: ${JSON.stringify(seedTreat)}`,
    `SEED_PLAN_REFERENCE_ONLY: ${JSON.stringify(seedPlan)}`
  ].join("\n");

  let rec = { id: script.id, slug: script.slug, stage: "director", status: "failed", at: new Date().toISOString(), attempts: [] };
  let ok = false;
  for (let attempt = 1; attempt <= 8 && !ok; attempt++) {
    try {
      const res = await llm.callLLM([{ role: "user", content: [{ type: "text", text: prompt }] }], { maxTokens: 4000 }, "v5-director");
      writeJson(rawPath, { attempt, at: new Date().toISOString(), res });
      const obj = parseJsonLoose(res?.content) || parseJsonLoose(res);
      const plan = obj?.plan;
      if (llm.isProviderError?.(res) || !plan || !Array.isArray(plan.beats) || plan.beats.length < 3) {
        const detail = res?.error || (llm.isProviderError?.(res) ? "provider_error" : "invalid_response");
        const transient = /503|429|unavailable|high demand|timeout|ECONN|temporar|rate/i.test(String(detail));
        rec.attempts.push({ attempt, status: "invalid", detail, transient });
        await sleep(transient ? Math.min(150000, 20000 * attempt) : 4000 * attempt);
        continue;
      }
      plan.id = script.id; plan.slug = script.slug; plan.title = script.title; plan.sources = script.sources; plan.cta = script.cta;
      plan.beats = plan.beats.map((b, i) => ({
        t: Number(b.t) || 0, dur: Math.max(0.8, Number(b.dur) || 2), narration: String(b.narration || script.script || "").slice(0,280),
        kicker: String(b.kicker || `BEAT ${i + 1}`).slice(0, 40), visual: String(b.visual || "full_bleed_type"),
        headline: String(b.headline || "").slice(0, 70), sub: String(b.sub || "").slice(0, 120),
        accent: String(b.accent || "#111111"), bg: String(b.bg || "#FAFAF8"),
        ...(b.bg_image ? { bg_image: String(b.bg_image) } : {}),
        assets: Array.isArray(b.assets) ? b.assets.filter(Boolean).slice(0, 8) : [],
        focal: b.focal && typeof b.focal === "object" ? b.focal : { x: 0.5, y: 0.52, w: 0.72, h_pct: 0.62 },
        motion: Array.isArray(b.motion) ? b.motion.slice(0, 12) : [],
        ...(b.photo ? { photo: String(b.photo) } : {}), ...(b.photo_credit ? { photo_credit: String(b.photo_credit) } : {}),
        ...(b.left ? { left: b.left } : {}), ...(b.right ? { right: b.right } : {}), ...(b.cta ? { cta: b.cta } : {}),
        ...(b.chart ? { chart: b.chart } : {}), ...(b.timeline ? { timeline: b.timeline } : {}),
        ...(b.transition ? { transition: b.transition } : {}),
        ...(Array.isArray(b.sfx) ? { sfx: b.sfx.filter(Boolean).slice(0, 8) } : {})
      }));
      plan.audio = plan.audio && typeof plan.audio === "object" ? plan.audio : {};
      plan.audio.sfx = Array.isArray(plan.audio.sfx) ? plan.audio.sfx.filter(s => s && s.src).slice(0, 60).map(s => ({ src: String(s.src), t: Number(s.t)||0, volume: Math.max(0,Math.min(1,Number(s.volume)||0.2)), dur: Math.max(0.05,Number(s.dur)||0.3), purpose: String(s.purpose||"") })) : [];
      if (plan.audio.music && typeof plan.audio.music === "object") plan.audio.music = { src: String(plan.audio.music.src||""), volume: Math.max(0,Math.min(1,Number(plan.audio.music.volume)||0.08)) };
      if (Array.isArray(plan.asset_manifest)) plan.asset_manifest = plan.asset_manifest.slice(0, 60);
      writeJson(planPath, plan);
      const treatment = { id: script.id, slug: script.slug, title: script.title, ...(obj.creative_treatment || {}), motion_direction: obj.creative_treatment?.motion_direction || obj.motion_direction || null, audio_direction: obj.creative_treatment?.audio_direction || obj.audio_direction || null, self_critique: obj.self_critique || null, approved: !!obj.approved, at: new Date().toISOString() };
      writeJson(treatPath, treatment);
      rec.status = obj.approved === true ? "ok" : "unapproved";
      rec.approved = obj.approved === true;
      rec.beats = plan.beats.length; rec.attempt = attempt;
      if (obj.approved === true) { ok = true; }
      else { rec.attempts.push({ attempt, status: "unapproved", detail: "Gemini returned approved=false" }); await sleep(1200 * attempt); }
    } catch (e) {
      rec.attempts.push({ attempt, status: "exception", detail: String(e) });
      await sleep(1500 * attempt);
    }
  }
  if (!ok) {
    rec.status = "failed";
    writeJson(recPath, rec);
    report.push(rec);
    console.error(base, "DIRECTOR FAILED");
    writeJson(path.join(recordsDir, "director-summary.json"), { at: new Date().toISOString(), canLLM, report, failedSoFar: report.filter(r=>r.status!=="ok"||r.approved!==true).map(r=>r.id) });
    fs.writeFileSync(path.join(recordsDir, "DIRECTOR_FAILED.txt"), `Director failed for ${report.filter(r=>r.status!=="ok"||r.approved!==true).map(r=>r.id).join(",")}\n`);
    continue;
  }
  writeJson(recPath, rec);
  report.push(rec);
  console.log(base, rec.status, "approved=" + rec.approved);
}

const failed = report.filter(r => r.status !== "ok" || r.approved !== true);
writeJson(path.join(recordsDir, "director-summary.json"), { at: new Date().toISOString(), canLLM, report, allOk: failed.length === 0, failed: failed.map(r => r.id) });
if (failed.length) {
  fs.writeFileSync(path.join(recordsDir, "DIRECTOR_FAILED.txt"), `Director failed for ${failed.map(r => r.id).join(",")}\n`);
  console.error("DIRECTOR FAILED for", failed.map(r => r.id).join(","));
  process.exit(1);
}
console.log("director done", report.length);
