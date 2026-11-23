#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function arg(name, def=null){ const i=process.argv.indexOf(`--${name}`); return i>-1?process.argv[i+1]:def; }
const root = path.resolve(arg("root", "."));
const scriptsDir = path.join(root, "scripts");
const plansDir = path.join(root, "plans");
const treatmentsDir = path.join(root, "treatments");
const recordsDir = path.join(root, "production-records");
for (const d of [plansDir, treatmentsDir, recordsDir]) fs.mkdirSync(d, { recursive: true });
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadLLM(){ try { return await import(pathToFileURL(path.join(repoRoot, "src/lib/llm.js")).href); } catch(e){ return {error:String(e)}; } }
function readJson(p){ return JSON.parse(fs.readFileSync(p,"utf8").replace(/^\uFEFF/,"")); }
function list(dir,ext){ return fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.endsWith(ext)).sort():[]; }
function writeJson(p,obj){ fs.writeFileSync(p, JSON.stringify(obj,null,2)); }

const llm = await loadLLM();
const canLLM = !llm.error && typeof llm.callLLM === "function" && (!llm.llmConfigured || llm.llmConfigured());
const scriptFiles = list(scriptsDir, ".json");
const report = [];

for (const sf of scriptFiles) {
  const script = readJson(path.join(scriptsDir, sf));
  const base = `${script.id}-${script.slug}`;
  const planPath = path.join(plansDir, `${base}.plan.json`);
  const treatPath = path.join(treatmentsDir, `${base}.treatment.json`);
  const recPath = path.join(recordsDir, `${base}.director.json`);
  const seedPlan = fs.existsSync(planPath) ? readJson(planPath) : null;
  const seedTreat = fs.existsSync(treatPath) ? readJson(treatPath) : null;

  if (!canLLM) {
    const rec = {id:script.id, slug:script.slug, stage:"director", status:"llm_unavailable", reason:llm.error||"not configured", usedSeed:true, at:new Date().toISOString()};
    writeJson(recPath, rec); report.push(rec); console.log(base, rec.status); continue;
  }

  const prompt = [
    "You are the Gemini creative director for an AI Tested YouTube Short (9:16).",
    "Create an original, story-specific visual treatment and executable beat-by-beat plan.",
    "Return ONLY JSON with keys: creative_treatment(object), plan(object), self_critique(object), approved(boolean).",
    "creative_treatment must include: concept, visual_language, hook_visual, escalation, payoff, asset_requirements(array), constraints(array).",
    "plan must include: id, slug, title, concept, sources, cta, visual_identity, beats(array).",
    "Each beat must include: t,dur,narration,kicker,visual,headline,sub,accent,bg,assets(array), and optional photo,photo_credit,left,right,cta.",
    "Rules: no debug labels, no repeated generic template, every beat has visual change, hook visually strong in first 2s, bridge escalates, visuals match narration, factual only.",
    "Use only these visual types: full_bleed_type,hero_cutout,warning_panel,split_compare,kinetic_type,stat_counter,stamp_document,legal_stack,quote_card,final_question,product_card,logo_grid,evidence_board,tool_card.",
    `SCRIPT: ${JSON.stringify(script)}`,
    `SEED_TREATMENT: ${JSON.stringify(seedTreat)}`,
    `SEED_PLAN: ${JSON.stringify(seedPlan)}`
  ].join("\n");

  let rec = {id:script.id, slug:script.slug, stage:"director", status:"failed", at:new Date().toISOString()};
  try {
    const res = await llm.callLLM([{role:"user", content:[{type:"text", text:prompt}]}], {maxTokens:3200}, "v5-director");
    const obj = res?.content && typeof res.content === "object" ? res.content : res;
    if (llm.isProviderError?.(res) || !obj || !obj.plan || !Array.isArray(obj.plan.beats)) {
      rec.status = "llm_error"; rec.detail = res?.error || "invalid_response"; rec.rawType = typeof obj;
    } else {
      obj.plan.id = script.id; obj.plan.slug = script.slug; obj.plan.title = script.title; obj.plan.sources = script.sources; obj.plan.cta = script.cta;
      // sanitize beats
      obj.plan.beats = obj.plan.beats.map((b,i)=>({
        t:Number(b.t)||0, dur:Math.max(0.8,Number(b.dur)||2), narration:String(b.narration||script.script||"").slice(0,240),
        kicker:String(b.kicker||`BEAT ${i+1}`).slice(0,40), visual:String(b.visual||"full_bleed_type"),
        headline:String(b.headline||"").slice(0,60), sub:String(b.sub||"").slice(0,90),
        accent:String(b.accent||"#111111"), bg:String(b.bg||"#FAFAF8"),
        assets:Array.isArray(b.assets)?b.assets.filter(Boolean).slice(0,5):[],
        ...(b.photo?{photo:b.photo}:{}), ...(b.photo_credit?{photo_credit:b.photo_credit}:{}),
        ...(b.left?{left:b.left}:{}), ...(b.right?{right:b.right}:{}), ...(b.cta?{cta:b.cta}:{})
      }));
      writeJson(planPath, obj.plan);
      if (obj.creative_treatment) writeJson(treatPath, {id:script.id, slug:script.slug, title:script.title, ...obj.creative_treatment, approved:!!obj.approved, self_critique:obj.self_critique||null, at:new Date().toISOString()});
      rec.status = "ok"; rec.approved = !!obj.approved; rec.beats = obj.plan.beats.length;
    }
  } catch(e){ rec.status="exception"; rec.detail=String(e); }
  writeJson(recPath, rec); report.push(rec); console.log(base, rec.status);
}
writeJson(path.join(recordsDir,"director-summary.json"), {at:new Date().toISOString(), canLLM, report});
console.log("director done", report.length);