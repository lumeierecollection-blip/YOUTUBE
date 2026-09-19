// render-and-qa-enhanced.js - Part 1: imports and helpers
import "dotenv/config";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, copyFileSync } from "node:fs";
import { join, dirname, basename, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RENDER_JS = join(ROOT, "src", "skills", "remotion-render", "render.js");
const VIDEO_REVIEW_JS = join(__dirname, "video-review.js");
const FRAME_AUDIT_JS = join(__dirname, "frame-audit.js");
const SLOP_CHECK_JS = join(__dirname, "slop-check.js");
const GEMINI_REVIEW_JS = join(__dirname, "gemini-frame-review.js");
const GEMINI_PLAN_ENHANCED_JS = join(__dirname, "gemini-visual-plan-enhanced.js");
const LOCAL_AUDIT_JS = join(__dirname, "local-audit.js");
const MAX_CORRECTION_LOOPS = 3;
function flag(argv, name) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; }
function loadChannelIds(override) { if (override) return [override]; return JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8")).channels.map(c => String(c.id)); }
function findScripts(ch) { const d = join(ROOT, "data", "research", ch); if (!existsSync(d)) return []; return readdirSync(d).filter(f => f.endsWith("-script.json")).map(f => join(d, f)); }
function fmt(p) { return p.endsWith("-shorts-script.json") ? "shorts" : "longform"; }
function audioFor(ch, p) { return join(ROOT, "data", "tts", ch, basename(p, ".json") + "-vo.mp3"); }
function outPath(ch, p, f) { const slug = basename(p, ".json").replace(/-script$/, ""); return join(ROOT, "data", "renders", ch, slug + "-" + f + "-" + new Date().toISOString().slice(0,10) + ".mp4"); }
function run(cmd, args, label) {
  return new Promise(r => {
    const c = spawn(cmd, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let so = "", se = "";
    c.stdout.on("data", d => { so += d; process.stdout.write("[" + label + "] " + d); });
    c.stderr.on("data", d => { se += d; process.stderr.write("[" + label + "] " + d); });
    c.on("close", code => r({ code, stdout: so, stderr: se }));
  });
}
/* ── Enhanced Gemini Visual Planning ── */
async function geminiPlan(channelId, scriptPath, correctionsPath) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) { console.log("No Gemini key — skipping plan."); return null; }
  const planDir = join(ROOT, "data", "visual-plans", channelId);
  mkdirSync(planDir, { recursive: true });
  const planPath = join(planDir, basename(scriptPath, ".json") + "-visual-plan.json");
  const audio = audioFor(channelId, scriptPath);
  const srtPath = join(dirname(audio), basename(audio, extname(audio)) + ".srt");
  const args = [GEMINI_PLAN_ENHANCED_JS, "--script", relative(ROOT, scriptPath), "--channel", channelId, "--out", planPath];
  if (existsSync(srtPath)) args.push("--srt", srtPath);
  if (correctionsPath && existsSync(correctionsPath)) args.push("--corrections", correctionsPath);
  console.log("=== GEMINI PLAN (enhanced): " + channelId + " — " + basename(scriptPath) + " ===");
  const { code } = await run("node", args, "plan/" + channelId);
  return code === 0 ? planPath : null;
}

async function renderOne(channelId, scriptPath, format) {
  const audio = audioFor(channelId, scriptPath);
  if (!existsSync(audio)) { console.warn("No VO at " + audio + " — skipping."); return { skipped: true }; }
  console.log("=== RENDER: " + channelId + " — " + basename(scriptPath) + " ===");
  const { code } = await run("node", [RENDER_JS, format, channelId, relative(ROOT, scriptPath), relative(ROOT, audio)], "render/" + channelId);
  if (code !== 0) return { skipped: false, ok: false };
  const out = outPath(channelId, scriptPath, format);
  return existsSync(out) ? { skipped: false, ok: true, outputPath: out, channelId, scriptPath, audio } : { skipped: false, ok: false };
}

async function qaOne(runId, rendered) {
  const { outputPath, channelId, scriptPath, audio } = rendered;
  const reviewDir = join(ROOT, "data", "audit", "render-review", runId, basename(outputPath, ".mp4"));
  mkdirSync(reviewDir, { recursive: true });
  const review = await run("node", [VIDEO_REVIEW_JS, outputPath, "--frames", "10", "--out", reviewDir], "review/" + channelId);
  if (review.code !== 0) return { outputPath, gatePass: false, stage: "video-review", reviewDir };
  const audit = await run("node", [FRAME_AUDIT_JS, reviewDir], "audit/" + channelId);

  // Local deterministic audit (no Gemini tokens)
  let risk = "UNKNOWN";
  await run("node", [LOCAL_AUDIT_JS, "--video", outputPath, "--channel", String(channelId)], "local-audit/" + channelId);
  const lrDir = join(ROOT, "data", "audit", "local-audit");
  if (existsSync(lrDir)) {
    const reps = readdirSync(lrDir).filter(f => f.includes(String(channelId)) && f.endsWith("-audit.json")).sort().reverse();
    if (reps.length) { try { risk = JSON.parse(readFileSync(join(lrDir, reps[0]), "utf-8")).risk || "UNKNOWN"; } catch {} }
  }
  console.log("Local audit risk: " + risk);

  // Risk-based Gemini review
  let geminiReviewPromise = null;
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (risk === "NORMAL") {
    console.log("NORMAL — skipping Gemini review (saves tokens)");
  } else if (audit.code === 0 && key) {
    console.log(risk + " — running Gemini review");
    const srtPath = join(dirname(audio), basename(audio, extname(audio)) + ".srt");
    const args = ["--video", outputPath, "--script", scriptPath, "--channel", String(channelId), "--fix"];
    if (existsSync(srtPath)) args.push("--srt", srtPath);
    geminiReviewPromise = run("node", [GEMINI_REVIEW_JS, ...args], "gemini/" + channelId);
  }

  const slopCheckPromise = run("node", [SLOP_CHECK_JS, outputPath, channelId, scriptPath, audio], "slop/" + channelId);
  return { outputPath, gatePass: true, stage: "frame-audit", reviewDir, risk, slopCheckPromise, geminiReviewPromise };
}
function findGeminiReview(ch, sp) {
  const slug = basename(sp, ".json").replace(/-script$/, "");
  const dir = join(ROOT, "data", "audit", "gemini-review");
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).filter(x => x.includes(slug) && x.endsWith(".json")).sort().reverse();
  return f.length ? join(dir, f[0]) : null;
}

async function renderWithCorrectionLoop(channelId, scriptPath, format, runId, outputOverride) {
  let correctionsPath = null, lastResult = null;
  for (let attempt = 1; attempt <= MAX_CORRECTION_LOOPS; attempt++) {
    console.log("\n=== ATTEMPT " + attempt + "/" + MAX_CORRECTION_LOOPS + ": " + basename(scriptPath) + " ===");
    await geminiPlan(channelId, scriptPath, correctionsPath);
    const result = await renderOne(channelId, scriptPath, format);
    if (result.skipped) return { skipped: true };
    if (!result.ok) return { skipped: false, ok: false };
    if (outputOverride && result.outputPath) {
      try { mkdirSync(dirname(outputOverride), { recursive: true }); copyFileSync(result.outputPath, outputOverride); } catch {}
    }
    lastResult = result;
    const qa = await qaOne(runId, result);
    await Promise.all([qa.slopCheckPromise, qa.geminiReviewPromise].filter(Boolean));
    const geminiReport = findGeminiReview(channelId, scriptPath);
    let verdict = "UNKNOWN";
    if (geminiReport) { try { const r = JSON.parse(readFileSync(geminiReport, "utf-8")); verdict = r.wholeVideoResult?.verdict || r.verdict || "UNKNOWN"; } catch {} }
    console.log("Verdict (attempt " + attempt + "): " + verdict);
    if (verdict === "APPROVED" || attempt === MAX_CORRECTION_LOOPS) {
      return { skipped: false, ok: true, outputPath: result.outputPath, attempt, geminiVerdict: verdict, qaGatePass: qa.gatePass, localAuditRisk: qa.risk };
    }
    console.log("Not approved — feeding corrections back");
    correctionsPath = geminiReport;
    try { rmSync(result.outputPath); } catch {}
  }
  return { skipped: false, ok: lastResult?.ok || false, outputPath: lastResult?.outputPath, attempt: MAX_CORRECTION_LOOPS, geminiVerdict: "NOT_APPROVED", qaGatePass: false };
}

async function main() {
  const argv = process.argv.slice(2);
  const chOverride = flag(argv, "--channel");
  const spOverride = flag(argv, "--script");
  const outOverride = flag(argv, "--output");
  const dryRun = argv.includes("--dry-run");
  const runId = process.env.GITHUB_RUN_ID || String(Date.now());
  let work = [];
  if (spOverride) {
    const sp = join(ROOT, relative(ROOT, spOverride));
    work = [{ channelId: chOverride || basename(dirname(sp)), scriptPath: sp }];
  } else {
    for (const ch of loadChannelIds(chOverride)) for (const sp of findScripts(ch)) work.push({ channelId: ch, scriptPath: sp });
  }
  if (dryRun) {
    console.log("DRY RUN — " + work.length + " script(s):");
    for (const { channelId: ch, scriptPath: sp } of work) {
      const f = fmt(sp), a = audioFor(ch, sp);
      console.log("  ch " + ch + " " + f + "  script=" + relative(ROOT, sp) + "  audio=" + (existsSync(a) ? "OK" : "MISSING"));
    }
    process.exit(0);
  }
  let rendered = 0, failed = 0; const results = [];
  for (const { channelId: ch, scriptPath: sp } of work) {
    const r = await renderWithCorrectionLoop(ch, sp, fmt(sp), runId, outOverride);
    if (r.skipped) continue;
    if (!r.ok) { failed++; continue; }
    rendered++; results.push(r);
    console.log("  Done: " + basename(r.outputPath) + " attempt=" + r.attempt + " verdict=" + r.geminiVerdict + " risk=" + (r.localAuditRisk||"?"));
  }
  const qaFailed = results.filter(r => !r.qaGatePass);
  for (const r of qaFailed) { if (r.outputPath && existsSync(r.outputPath)) try { rmSync(r.outputPath); } catch {} }
  const ok = rendered - qaFailed.length;
  console.log("\n=== SUMMARY === rendered=" + rendered + " failed=" + failed + " qaFailed=" + qaFailed.length + " successful=" + ok);
  for (const r of results) console.log("  " + basename(r.outputPath||"?") + ": risk=" + (r.localAuditRisk||"?") + " verdict=" + r.geminiVerdict + " qa=" + (r.qaGatePass?"PASS":"FAIL"));
  if (ok === 0) { console.error("0 videos passed QA."); process.exit(1); }
}
main().catch(e => { console.error(e); process.exit(1); });