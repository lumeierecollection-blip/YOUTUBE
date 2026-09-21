// render-and-qa-enhanced.js — OpenCode as primary thinker, Gemini as challenger
//
// FLOW:
//   1. OpenCode generates visual intent (primary creative thinker)
//   2. Confidence gate: if >=80% beats are high-confidence, skip Gemini challenge
//   3. Gemini challenges the intent only when confidence is mixed/low
//   4. If NEEDS_CHANGE, apply deltas and re-challenge (max 1 iteration)
//   5. Render with Remotion
//   6. Compare execution vs intent (deterministic)
//   7. Gemini final review ONLY if post-render audit is MEDIUM/HIGH risk
//
// TOKEN BUDGET:
//   Normal video (high confidence + NORMAL audit): 0 Gemini calls
//   Challenged video: 1 Gemini call (challenge only)
//   Risky video: 1-2 Gemini calls (challenge + post-render review)
//   Old flow: 2+ Gemini calls per video (plan + review)
import "dotenv/config";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, copyFileSync, writeFileSync } from "node:fs";
import { join, dirname, basename, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Script paths ──
const RENDER_JS = join(ROOT, "src", "skills", "remotion-render", "render.js");
const GEMINI_REVIEW_JS = join(__dirname, "gemini-frame-review.js");
const OPENCODE_INTENT_JS = join(__dirname, "opencode-visual-intent.js");
const GEMINI_CHALLENGER_JS = join(__dirname, "gemini-visual-challenger.js");
const EXECUTION_COMPARATOR_JS = join(__dirname, "execution-comparator.js");
const LOCAL_AUDIT_JS = join(__dirname, "local-audit.js");
const MAX_ATTEMPTS = 4;

// ── Helpers ──
function flag(argv, name) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; }
function loadChannelIds(override) {
  if (override) return [override];
  return JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8")).channels.map(c => String(c.id));
}
function findScripts(ch) {
  const d = join(ROOT, "data", "research", ch);
  if (!existsSync(d)) return [];
  return readdirSync(d).filter(f => f.endsWith("-script.json")).map(f => join(d, f));
}
function fmt(p) { return p.endsWith("-shorts-script.json") ? "shorts" : "longform"; }
function audioFor(ch, p) { return join(ROOT, "data", "tts", ch, basename(p, ".json") + "-vo.mp3"); }
function outPath(ch, p, f) {
  const slug = basename(p, ".json").replace(/-script$/, "");
  return join(ROOT, "data", "renders", ch, slug + "-" + f + "-" + new Date().toISOString().slice(0,10) + ".mp4");
}
function run(cmd, args, label) {
  return new Promise(r => {
    const c = spawn(cmd, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let so = "", se = "";
    c.stdout.on("data", d => { so += d; process.stdout.write("[" + label + "] " + d); });
    c.stderr.on("data", d => { se += d; process.stderr.write("[" + label + "] " + d); });
    c.on("close", code => r({ code, stdout: so, stderr: se }));
  });
}

// ── OpenCode generates visual intent (PRIMARY THINKER) ──
async function opencodeIntent(channelId, scriptPath) {
  const intentDir = join(ROOT, "data", "visual-intents", channelId);
  mkdirSync(intentDir, { recursive: true });
  const intentPath = join(intentDir, basename(scriptPath, ".json") + "-intent.json");
  const audio = audioFor(channelId, scriptPath);
  const srtPath = join(dirname(audio), basename(audio, extname(audio)) + ".srt");

  const args = [OPENCODE_INTENT_JS, "--script", relative(ROOT, scriptPath), "--channel", channelId, "--out", intentPath];
  if (existsSync(srtPath)) args.push("--srt", srtPath);

  console.log("=== OPENCODE INTENT: " + channelId + " — " + basename(scriptPath) + " ===");
  const { code } = await run("node", args, "intent/" + channelId);
  return code === 0 && existsSync(intentPath) ? intentPath : null;
}

// ── Confidence gate: skip Gemini challenge if intent is high-confidence ──
function shouldSkipChallenge(intentPath) {
  try {
    const intent = JSON.parse(readFileSync(intentPath, "utf-8"));
    const beats = intent.beats || [];
    if (!beats.length) return false;
    const highCount = beats.filter(b => b.confidence === "high").length;
    const highRatio = highCount / beats.length;
    // Skip Gemini challenge if >=80% of beats are high-confidence
    if (highRatio >= 0.8) {
      console.log("Confidence gate: " + highCount + "/" + beats.length + " high (" + Math.round(highRatio*100) + "%) — skipping Gemini challenge");
      return true;
    }
    console.log("Confidence gate: " + highCount + "/" + beats.length + " high (" + Math.round(highRatio*100) + "%) — Gemini challenge needed");
    return false;
  } catch {
    return false;
  }
}

// ── Gemini challenges the intent (CHALLENGER/JUDGE) ──
async function geminiChallenge(channelId, scriptPath, intentPath) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) { console.log("No Gemini key — skipping challenge (intent stands)."); return { verdict: "MATCH", deltas: [] }; }

  const reviewDir = join(ROOT, "data", "visual-reviews", channelId);
  mkdirSync(reviewDir, { recursive: true });
  const reviewPath = join(reviewDir, basename(scriptPath, ".json") + "-challenge.json");

  const args = [GEMINI_CHALLENGER_JS, "--intent", intentPath, "--script", scriptPath, "--channel", channelId, "--out", reviewPath];
  console.log("=== GEMINI CHALLENGE: " + channelId + " — " + basename(scriptPath) + " ===");
  const { code } = await run("node", args, "challenge/" + channelId);

  if (code !== 0 || !existsSync(reviewPath)) return { verdict: "MATCH", deltas: [] };

  try {
    const review = JSON.parse(readFileSync(reviewPath, "utf-8"));
    return { verdict: review.verdict || "MATCH", deltas: review.deltas || [], score: review.overall_score };
  } catch {
    return { verdict: "MATCH", deltas: [] };
  }
}

// ── Apply deltas to intent ──
function applyDeltas(intentPath, deltas) {
  if (!deltas.length) return intentPath;
  const intent = JSON.parse(readFileSync(intentPath, "utf-8"));
  for (const delta of deltas) {
    const beat = intent.beats.find(b => b.index === delta.beat_index);
    if (beat && beat[delta.field] !== undefined) {
      console.log("  Applying delta [" + delta.beat_index + "] " + delta.field + ": \"" + beat[delta.field] + "\" -> \"" + delta.suggested + "\"");
      beat[delta.field] = delta.suggested;
    }
  }
  const correctedPath = intentPath.replace("-intent.json", "-corrected-intent.json");
  writeFileSync(correctedPath, JSON.stringify(intent, null, 2) + "\n");
  return correctedPath;
}

// ── Convert intent to visual-plan.json format for Remotion ──
function intentToVisualPlan(intentPath, outPath) {
  const intent = JSON.parse(readFileSync(intentPath, "utf-8"));
  const plan = {
    generatedAt: new Date().toISOString(),
    source: "opencode-intent",
    totalBeats: intent.beats.length,
    beats: intent.beats.map(b => ({
      index: b.index,
      visual_headline: b.visual_headline || null,
      reason: b.narrative_purpose,
      visual_events: [{ type: "custom", label: b.visual_event }],
      capabilities: ["custom"],
      composition: { objects: [{ kind: "field", anchor: "center", motion: "none" }] },
      carries_forward: b.carries_forward || null,
      direction: {
        narrative_purpose: b.narrative_purpose,
        subject: b.visual_event,
        environment: "dynamic",
        action_start: b.key_object,
        action_end: b.transformation,
        camera: "hold",
        motion: "dynamic",
        typography: b.visual_headline || "none",
        sound: "semantic",
        consequence: b.consequence,
        muted_read: b.muted_read,
        why_visual: b.visual_event,
        graph_justified: false,
      },
      compiledScene: null,
    })),
  };
  writeFileSync(outPath, JSON.stringify(plan, null, 2) + "\n");
  return outPath;
}

// ── Render one video ──
async function renderOne(channelId, scriptPath, format) {
  const audio = audioFor(channelId, scriptPath);
  if (!existsSync(audio)) { console.warn("No VO at " + audio + " — skipping."); return { skipped: true }; }
  console.log("=== RENDER: " + channelId + " — " + basename(scriptPath) + " ===");
  const { code } = await run("node", [RENDER_JS, format, channelId, relative(ROOT, scriptPath), relative(ROOT, audio)], "render/" + channelId);
  if (code !== 0) return { skipped: false, ok: false };
  const out = outPath(channelId, scriptPath, format);
  return existsSync(out) ? { skipped: false, ok: true, outputPath: out, channelId, scriptPath, audio } : { skipped: false, ok: false };
}

// ── QA: local audit + risk-based Gemini review ──
async function qaOne(runId, rendered) {
  const { outputPath, channelId, scriptPath, audio } = rendered;

  // Local deterministic audit (no Gemini tokens)
  let risk = "UNKNOWN";
  await run("node", [LOCAL_AUDIT_JS, "--video", outputPath, "--channel", String(channelId)], "local-audit/" + channelId);
  const lrDir = join(ROOT, "data", "audit", "local-audit");
  if (existsSync(lrDir)) {
    const reps = readdirSync(lrDir).filter(f => f.includes(String(channelId)) && f.endsWith("-audit.json")).sort().reverse();
    if (reps.length) { try { risk = JSON.parse(readFileSync(join(lrDir, reps[0]), "utf-8")).risk || "UNKNOWN"; } catch {} }
  }
  console.log("Local audit risk: " + risk);

  // Risk-based Gemini review (ONLY for MEDIUM/HIGH risk)
  let geminiReviewPromise = null;
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (risk === "NORMAL") {
    console.log("NORMAL — skipping Gemini post-render review (saves tokens)");
  } else if (key) {
    console.log(risk + " — running Gemini post-render review");
    const srtPath = join(dirname(audio), basename(audio, extname(audio)) + ".srt");
    const args = ["--video", outputPath, "--script", scriptPath, "--channel", String(channelId), "--fix"];
    if (existsSync(srtPath)) args.push("--srt", srtPath);
    geminiReviewPromise = run("node", [GEMINI_REVIEW_JS, ...args], "gemini/" + channelId);
  }

  return { outputPath, gatePass: true, stage: "local-audit", risk, geminiReviewPromise };
}

function findGeminiReview(ch, sp) {
  const slug = basename(sp, ".json").replace(/-script$/, "");
  const dir = join(ROOT, "data", "audit", "gemini-review");
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).filter(x => x.includes(slug) && x.endsWith(".json")).sort().reverse();
  return f.length ? join(dir, f[0]) : null;
}

// ── Main render loop with OpenCode-first architecture ──
async function renderWithCorrectionLoop(channelId, scriptPath, format, runId, outputOverride) {
  // Skip scripts without audio — don't waste intent generation on incomplete pipelines
  const audio = audioFor(channelId, scriptPath);
  if (!existsSync(audio)) { console.warn("No VO at " + audio + " — skipping."); return { skipped: true }; }

  let intentPath = null;
  let lastResult = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log("\n=== ATTEMPT " + attempt + "/" + MAX_ATTEMPTS + ": " + basename(scriptPath) + " ===");

    // Step 1: OpenCode generates visual intent (PRIMARY THINKER)
    if (!intentPath) {
      intentPath = await opencodeIntent(channelId, scriptPath);
      if (!intentPath) {
        console.error("Failed to generate visual intent from OpenCode.");
        return { skipped: false, ok: false };
      }
    }

    // Step 2: Confidence gate — skip Gemini if intent is high-confidence
    let challenge = { verdict: "MATCH", deltas: [] };
    if (shouldSkipChallenge(intentPath)) {
      console.log("Confidence gate PASSED — proceeding without Gemini challenge");
    } else {
      // Step 3: Gemini challenges the intent (CHALLENGER/JUDGE)
      challenge = await geminiChallenge(channelId, scriptPath, intentPath);

      if (challenge.verdict === "NEEDS_CHANGE" && challenge.deltas.length && attempt <= 2) {
        console.log("Gemini found " + challenge.deltas.length + " issue(s) — applying deltas");
        intentPath = applyDeltas(intentPath, challenge.deltas);
        continue;
      }
    }

    console.log("Gemini verdict: " + challenge.verdict + " (score: " + (challenge.score || "N/A") + ")");

    // Step 4: Convert intent to visual-plan.json and render
    const planDir = join(ROOT, "data", "visual-plans", channelId);
    mkdirSync(planDir, { recursive: true });
    const planPath = join(planDir, basename(scriptPath, ".json") + "-visual-plan.json");
    intentToVisualPlan(intentPath, planPath);

    const result = await renderOne(channelId, scriptPath, format);
    if (result.skipped) return { skipped: true };
    if (!result.ok) return { skipped: false, ok: false };

    if (outputOverride && result.outputPath) {
      try { mkdirSync(dirname(outputOverride), { recursive: true }); copyFileSync(result.outputPath, outputOverride); } catch {}
    }
    lastResult = result;

    // Step 5: Compare execution vs intent (deterministic)
    const comparisonDir = join(ROOT, "data", "audit", "execution-comparison", runId);
    mkdirSync(comparisonDir, { recursive: true });
    const comparisonPath = join(comparisonDir, basename(result.outputPath, ".mp4") + "-comparison.json");
    await run("node", [EXECUTION_COMPARATOR_JS, "--intent", intentPath, "--video", result.outputPath, "--out", comparisonPath], "compare/" + channelId);

    // Step 6: QA (local audit + risk-based Gemini review)
    const qa = await qaOne(runId, result);
    if (qa.geminiReviewPromise) await qa.geminiReviewPromise;

    const geminiReport = findGeminiReview(channelId, scriptPath);
    let verdict = "UNKNOWN";
    if (geminiReport) {
      try { const r = JSON.parse(readFileSync(geminiReport, "utf-8")); verdict = r.wholeVideoResult?.verdict || r.verdict || "UNKNOWN"; } catch {}
    }

    console.log("Verdict (attempt " + attempt + "): " + verdict);

    if (verdict === "APPROVED" || qa.risk === "NORMAL" || attempt === MAX_ATTEMPTS) {
      return {
        skipped: false, ok: true,
        outputPath: result.outputPath,
        attempt,
        geminiVerdict: verdict,
        qaGatePass: qa.gatePass,
        localAuditRisk: qa.risk,
        intentFile: intentPath,
        challengeVerdict: challenge.verdict,
        geminiCallsUsed: challenge.verdict === "MATCH" ? 0 : 1,
      };
    }

    console.log("Not approved — retrying with fresh intent");
    intentPath = null;
    try { rmSync(result.outputPath); } catch {}
  }

  return {
    skipped: false, ok: lastResult?.ok || false,
    outputPath: lastResult?.outputPath,
    attempt: MAX_ATTEMPTS,
    geminiVerdict: "NOT_APPROVED",
    qaGatePass: false,
  };
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
  let totalGeminiCalls = 0;
  for (const { channelId: ch, scriptPath: sp } of work) {
    const r = await renderWithCorrectionLoop(ch, sp, fmt(sp), runId, outOverride);
    if (r.skipped) continue;
    if (!r.ok) { failed++; continue; }
    rendered++; results.push(r);
    totalGeminiCalls += (r.geminiCallsUsed || 0);
    console.log("  Done: " + basename(r.outputPath) + " attempt=" + r.attempt + " verdict=" + r.geminiVerdict + " risk=" + (r.localAuditRisk||"?") + " gemini=" + (r.geminiCallsUsed||0));
  }

  const qaFailed = results.filter(r => !r.qaGatePass);
  for (const r of qaFailed) { if (r.outputPath && existsSync(r.outputPath)) try { rmSync(r.outputPath); } catch {} }

  const ok = rendered - qaFailed.length;
  console.log("\n=== SUMMARY === rendered=" + rendered + " failed=" + failed + " qaFailed=" + qaFailed.length + " successful=" + ok);
  console.log("=== GEMINI USAGE === " + totalGeminiCalls + " call(s) for " + rendered + " video(s) (avg " + (rendered ? (totalGeminiCalls/rendered).toFixed(1) : 0) + " per video)");
  for (const r of results) console.log("  " + basename(r.outputPath||"?") + ": risk=" + (r.localAuditRisk||"?") + " verdict=" + r.geminiVerdict + " qa=" + (r.qaGatePass?"PASS":"FAIL") + " gemini=" + (r.geminiCallsUsed||0));

  if (ok === 0) { console.error("0 videos passed QA."); process.exit(1); }
}
main().catch(e => { console.error(e); process.exit(1); });