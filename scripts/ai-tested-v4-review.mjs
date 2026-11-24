#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function arg(name, def = null) { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : def; }
const root = path.resolve(arg("root", "."));
const outDir = path.resolve(root, arg("out", "reviews"));
const force = process.argv.includes("--force");
fs.mkdirSync(outDir, { recursive: true });
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadLLM() {
  try { return await import(pathToFileURL(path.join(repoRoot, "src/lib/llm.js")).href); } catch (e) { return { error: String(e) }; }
}
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "")); } catch { return null; } }
function list(dir, ext) { return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(ext)).sort() : []; }
function imgPart(p) { const b = fs.readFileSync(p).toString("base64"); return { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b}` } }; }
function evenly(arr, n) { if (arr.length <= n) return arr; const out = []; for (let i = 0; i < n; i++) out.push(arr[Math.round(i * (arr.length - 1) / Math.max(1, n - 1))]); return [...new Set(out)]; }

const llm = await loadLLM();
const plans = list(path.join(root, "plans"), ".plan.json").map(f => readJson(path.join(root, "plans", f))).filter(Boolean);
const summary = [];

for (const plan of plans) {
  const base = `${plan.id}-${plan.slug}`;
  const contact = path.join(root, "qa/contact-sheets", `${base}.jpg`);
  const framesDir = path.join(root, "qa/frames", base);
  const frames = list(framesDir, ".jpg").map(f => path.join(framesDir, f));
  const sampled = evenly(frames, 24);
  const reportPath = path.join(outDir, `${base}.review.json`);
  const mdPath = path.join(outDir, `${base}.review.md`);
  const script = readJson(path.join(root, "scripts", `${base}.json`));
  const treatment = readJson(path.join(root, "treatments", `${base}.treatment.json`));
  const qaTxtPath = path.join(root, "qa", `${base}.mp4.txt`);
  const qaTxt = fs.existsSync(qaTxtPath) ? fs.readFileSync(qaTxtPath, "utf8").slice(0, 2000) : "";
  const existing = !force ? readJson(reportPath) : null;
  if (existing?.status === "reviewed" && existing?.pass === true) {
    summary.push({ id: plan.id, slug: plan.slug, status: existing.status, pass: true, reason: existing.reason || null, visual_score: existing.visual_score ?? null });
    console.log(base, "skip-pass");
    continue;
  }
  let review = { id: plan.id, slug: plan.slug, title: plan.title, status: "not_reviewed", reason: null, findings: [], issues: [], strengths: [], pass: false, reviewedAt: new Date().toISOString(), evidence: { contactSheet: fs.existsSync(contact), frameCount: frames.length, sampledFrames: sampled.map(f => path.basename(f)) } };

  if (!fs.existsSync(contact) && sampled.length === 0) {
    review.reason = "no_frames";
  } else if (llm.error || typeof llm.callLLM !== "function") {
    review.reason = "llm_unavailable"; review.detail = llm.error || "callLLM missing";
  } else if (llm.llmConfigured && !llm.llmConfigured()) {
    review.reason = "llm_not_configured";
  } else {
    const prompt = [
      "You are a harsh Gemini creative reviewer for an AI Tested YouTube Short (1080x1920).",
      "Review the actual rendered frames against the script, approved plan, and treatment. Judge the real visual output, not intent.",
      "Return ONLY JSON with keys: pass(boolean), summary(string), issues(array of {beat,severity,problem,fix,timestamp}), strengths(array), visual_score(number 0-10), audio_notes(string), central_composition_ok(boolean), repetition_ok(boolean), storytelling_ok(boolean), assets_ok(boolean), motion_ok(boolean).",
      "Fail if any of these are true: weak hook in first 2s; repetitive/template feel across videos or beats; top-heavy or small central content; main subject not prominent/centered; visuals don't match narration; graphs unreadable/inaccurate/fabricated; debug/duplicate/stale text; poor progression/payoff; missing or irrelevant key assets/logos/photos; poor background removal/cutout quality; robotic/cheap motion; sound design feels absent/generic/misaligned based on plan evidence; obvious production defects; mobile readability problems.",
      "Be specific and timestamped. Do not pass mediocre work. If evidence is insufficient, fail with reason in issues.",
      `TITLE: ${plan.title}`,
      `SCRIPT: ${script?.script || ""}`,
      `CONCEPT: ${plan.concept || ""}`,
      `TREATMENT: ${JSON.stringify(treatment || {})}`,
      `PLAN_BEATS: ${JSON.stringify(plan.beats || [])}`,
      `TECH_QA: ${qaTxt}`,
      "EVIDENCE: contact sheet and timestamped sampled frames below. Audio may not be directly audible; evaluate audio plan/sfx timing from evidence and state uncertainty clearly in audio_notes."
    ].join("\n");
    const content = [{ type: "text", text: prompt }];
    if (fs.existsSync(contact)) { content.push({ type: "text", text: "Contact sheet (whole video overview):" }); content.push(imgPart(contact)); }
    for (const f of sampled) {
      const name = path.basename(f, ".jpg");
      content.push({ type: "text", text: `Frame ~${name}s/index ${name}` });
      content.push(imgPart(f));
    }
    try {
      const res = await llm.callLLM([{ role: "user", content }], { maxTokens: 1600 }, "v5-review");
      if (llm.isProviderError?.(res)) {
        // one retry after short backoff for transient provider errors
        await new Promise(r => setTimeout(r, 15000));
        const res2 = await llm.callLLM([{ role: "user", content }], { maxTokens: 1600 }, "v5-review-retry");
        if (llm.isProviderError?.(res2)) {
          review.reason = "llm_error"; review.detail = res2?.error || res2;
        } else {
          const obj2 = res2?.content && typeof res2.content === "object" ? res2.content : res2;
          if (!obj2 || typeof obj2 !== "object") { review.reason = "invalid_response"; review.detail = obj2; }
          else { review = { ...review, status: "reviewed", ...obj2 }; review.pass = obj2.pass === true; review.issues = Array.isArray(obj2.issues) ? obj2.issues : []; review.strengths = Array.isArray(obj2.strengths) ? obj2.strengths : []; }
        }
      } else {
        const obj = res?.content && typeof res.content === "object" ? res.content : res;
        if (!obj || typeof obj !== "object") { review.reason = "invalid_response"; review.detail = obj; }
        else {
          review = { ...review, status: "reviewed", ...obj };
          review.pass = obj.pass === true;
          review.issues = Array.isArray(obj.issues) ? obj.issues : [];
          review.strengths = Array.isArray(obj.strengths) ? obj.strengths : [];
        }
      }
    } catch (e) {
      review.reason = "exception"; review.detail = String(e);
    }
  }

  fs.writeFileSync(reportPath, JSON.stringify(review, null, 2));
  const issues = Array.isArray(review.issues) ? review.issues : [];
  const strengths = Array.isArray(review.strengths) ? review.strengths : [];
  const md = [
    `# Review ${base}`,
    `- Status: ${review.status}`,
    `- Pass: ${review.pass}`,
    `- Visual score: ${review.visual_score ?? "n/a"}`,
    `- Central composition ok: ${review.central_composition_ok ?? "n/a"}`,
    `- Repetition ok: ${review.repetition_ok ?? "n/a"}`,
    review.summary ? `- Summary: ${review.summary}` : "",
    review.reason ? `- Reason: ${review.reason}` : "",
    review.audio_notes ? `- Audio notes: ${review.audio_notes}` : "",
    "",
    "## Issues",
    ...(issues.length ? issues.map(i => `- [${i.severity || "med"}] ${i.timestamp || ""} beat ${i.beat || "?"}: ${i.problem} -> ${i.fix}`) : ["- None reported"]),
    "",
    "## Strengths",
    ...(strengths.length ? strengths.map(s => `- ${s}`) : ["- None reported"]),
  ].filter(Boolean).join("\n");
  fs.writeFileSync(mdPath, md);
  summary.push({ id: plan.id, slug: plan.slug, status: review.status, pass: review.pass, reason: review.reason || null, visual_score: review.visual_score ?? null });
  console.log(base, review.status, review.pass, review.reason || "");
}

fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify({ generatedAt: new Date().toISOString(), summary }, null, 2));
console.log("Wrote", summary.length, "reviews");
