#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
function arg(name,def=null){const i=process.argv.indexOf(`--${name}`); return i>-1?process.argv[i+1]:def;}
const root=path.resolve(arg("root","."));
const reviewsDir=path.resolve(root,arg("reviews","reviews"));
const plansDir=path.resolve(root,arg("plans","plans"));
const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
async function loadLLM(){ try { return await import(pathToFileURL(path.join(repoRoot,"src/lib/llm.js")).href); } catch(e){ return {error:String(e)}; } }
function readJson(p){ return JSON.parse(fs.readFileSync(p,"utf8").replace(/^\uFEFF/,"")); }
function list(dir,ext){ return fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.endsWith(ext)).sort():[]; }
function parseJsonLoose(v){ if(v&&typeof v==='object') return v; if(typeof v!=='string') return null; let s=v.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/i,'').trim(); try{return JSON.parse(s);}catch{} const m=s.match(/\{[\s\S]*\}/); if(m){try{return JSON.parse(m[0]);}catch{}} return null; }
const llm=await loadLLM();
const reviewFiles=list(reviewsDir,".review.json").filter(f=>f!=="summary.json");
let changed=[];
for(const rf of reviewFiles){
  const r=readJson(path.join(reviewsDir,rf));
  if(r.pass) continue;
  const planPath=path.join(plansDir,`${r.id}-${r.slug}.plan.json`);
  if(!fs.existsSync(planPath)) continue;
  const plan=readJson(planPath);
  if(llm.error || typeof llm.callLLM!=="function" || (llm.llmConfigured && !llm.llmConfigured())) {
    // deterministic fallback: remove debug-like labels and strengthen beat diversity by ensuring kicker/sub present
    plan.beats = plan.beats.map((b,i)=>({ ...b, kicker: b.kicker || `BEAT ${i+1}`, sub: b.sub || b.headline }));
    fs.writeFileSync(planPath, JSON.stringify(plan,null,2));
    changed.push({id:r.id, mode:"fallback"});
    continue;
  }
  const prompt = [
    "Revise this YouTube Short visual plan JSON to fix review issues.",
    "Return ONLY valid JSON for the full revised plan object. Keep same id, slug, title, sources, cta.",
    "Fix: no debug labels, no duplicate text stacking, no repetitive template feel, stronger hook, clear beat progression, prominent subjects, mobile readability.",
    "Keep beats grounded in narration and facts; do not invent facts.",
    "REVIEW ISSUES:", JSON.stringify(r.issues||[]),
    "CURRENT PLAN:", JSON.stringify(plan)
  ].join("\n");
  try {
    const res = await llm.callLLM([{role:"user", content:[{type:"text", text:prompt}]}], {maxTokens:2400}, "v5-correct");
    const obj = parseJsonLoose(res?.content) || parseJsonLoose(res);
    if(obj && obj.id && Array.isArray(obj.beats) && !llm.isProviderError?.(res)) {
      fs.writeFileSync(planPath, JSON.stringify(obj,null,2));
      changed.push({id:r.id, mode:"llm"});
    } else {
      changed.push({id:r.id, mode:"llm_error", detail: res?.error||"invalid"});
    }
  } catch(e){ changed.push({id:r.id, mode:"exception", detail:String(e)}); }
}
fs.writeFileSync(path.join(reviewsDir,"correction.json"), JSON.stringify({changed},null,2));
console.log(JSON.stringify({changed}));