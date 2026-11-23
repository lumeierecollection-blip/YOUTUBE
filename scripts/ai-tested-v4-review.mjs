#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function arg(name, def=null){ const i=process.argv.indexOf(`--${name}`); return i>-1?process.argv[i+1]:def; }
const root = path.resolve(arg("root", "."));
const outDir = path.resolve(root, arg("out", "reviews"));
fs.mkdirSync(outDir, { recursive: true });
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadLLM(){
  try {
    const mod = await import(pathToFileURL(path.join(repoRoot, "src/lib/llm.js")).href);
    return mod;
  } catch (e) {
    return { error: String(e) };
  }
}

function readJson(p){ return JSON.parse(fs.readFileSync(p,"utf8").replace(/^\uFEFF/,"")); }
function list(dir, ext){ return fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.endsWith(ext)).sort():[]; }
function imgPart(p){ const b=fs.readFileSync(p).toString("base64"); return {type:"image_url", image_url:{url:`data:image/jpeg;base64,${b}`}}; }

const llm = await loadLLM();
const plans = list(path.join(root,"plans"), ".plan.json").map(f=>readJson(path.join(root,"plans",f)));
const summary = [];

for (const plan of plans) {
  const base = `${plan.id}-${plan.slug}`;
  const contact = path.join(root,"qa/contact-sheets",`${base}.jpg`);
  const framesDir = path.join(root,"qa/frames",base);
  const frames = list(framesDir, ".jpg").slice(0,8).map(f=>path.join(framesDir,f));
  const reportPath = path.join(outDir, `${base}.review.json`);
  const mdPath = path.join(outDir, `${base}.review.md`);
  let review = { id: plan.id, slug: plan.slug, title: plan.title, status: "not_reviewed", reason: null, findings: [], pass: false };

  if (!fs.existsSync(contact) && frames.length===0) {
    review.reason = "no_frames";
  } else if (llm.error || typeof llm.callLLM !== "function") {
    review.reason = "llm_unavailable";
    review.detail = llm.error || "callLLM missing";
  } else if (llm.llmConfigured && !llm.llmConfigured()) {
    review.reason = "llm_not_configured";
  } else {
    const prompt = [
      "You are reviewing an AI Tested YouTube Short against its visual plan.",
      "Return ONLY JSON with keys: pass(boolean), summary(string), issues(array of {beat,severity,problem,fix}), strengths(array of strings).",
      "Be specific and harsh. Check: hook visual strength, beat-to-visual match, repetition/template feel, text readability, prominence of subject, pacing/progression, payoff/CTA clarity.",
      `TITLE: ${plan.title}`,
      `CONCEPT: ${plan.concept}`,
      "BEATS:",
      ...plan.beats.map((b,i)=>`${i+1}. [${b.t}-${(b.t+b.dur).toFixed(1)}s] ${b.narration} | visual=${b.visual} | headline=${b.headline} | sub=${b.sub||""}`)
    ].join("\n");
    const content = [{type:"text", text: prompt}];
    if (fs.existsSync(contact)) content.push({type:"text", text:"Contact sheet:"}), content.push(imgPart(contact));
    for (const f of frames.slice(0,6)) content.push({type:"text", text:`Frame ${path.basename(f)}`}), content.push(imgPart(f));
    try {
      const res = await llm.callLLM([{role:"user", content}], {maxTokens:1200}, "v4-review");
      if (llm.isProviderError && llm.isProviderError(res)) {
        review.reason = "llm_error"; review.detail = res;
      } else {
        const obj = res?.content && typeof res.content === "object" ? res.content : res;
        review = { ...review, status: "reviewed", ...obj };
        review.pass = !!obj.pass;
      }
    } catch (e) {
      review.reason = "exception"; review.detail = String(e);
    }
  }

  fs.writeFileSync(reportPath, JSON.stringify(review, null, 2));
  const md = [`# Review ${base}`, `- Status: ${review.status}`, `- Pass: ${review.pass}`, review.summary?`- Summary: ${review.summary}`:"", review.reason?`- Reason: ${review.reason}`:"", "", "## Issues", ...(Array.isArray(review.issues)&&review.issues.length?review.issues.map(i=>`- [${i.severity||"med"}] beat ${i.beat||"?"}: ${i.problem} -> ${i.fix}`):["- None reported"]), "", "## Strengths", ...(Array.isArray(review.strengths)&&review.strengths.length?review.strengths.map(s=>`- ${s}`):["- None reported"])].join("\n");
  fs.writeFileSync(mdPath, md);
  summary.push({id:plan.id, slug:plan.slug, status:review.status, pass:review.pass, reason:review.reason||null});
  console.log(base, review.status, review.pass, review.reason||"");
}

fs.writeFileSync(path.join(outDir,"summary.json"), JSON.stringify({generatedAt:new Date().toISOString(), summary}, null, 2));
console.log("Wrote", summary.length, "reviews");
