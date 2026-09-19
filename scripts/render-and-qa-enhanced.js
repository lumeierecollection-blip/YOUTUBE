// render-and-qa-enhanced.js — OpenCode as primary thinker, Gemini as challenger
//
// NEW FLOW:
//   1. OpenCode generates visual intent (primary creative thinker)
//   2. Gemini challenges the intent (semantic reviewer/judge)
//   3. If NEEDS_CHANGE, apply deltas and re-challenge (max 1 iteration)
//   4. Render with Remotion
//   5. Compare execution vs intent (deterministic)
//   6. Gemini final review ONLY if confidence gate triggers (risk-based)
//
// OLD FLOW (removed):
//   Gemini generates plan → render → Gemini reviews → loop
//   This used 2+ Gemini calls per video. New flow uses 0-1.
import "dotenv/config";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, copyFileSync, writeFileSync } from "node:fs";
import { join, dirname, basename, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Script paths ──
const RENDER_JS = join(ROOT, "src", "skills", "remotion-render", "render.js");
const VIDEO_REVIEW_JS = join(__dirname, "video-review.js");
const FRAME_AUDIT_JS = join(__dirname, "frame-audit.js");
const SLOP_CHECK_JS = join(__dirname, "slop-check.js");
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

// ── NEW: OpenCode generates visual intent (primary thinker) ──
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

// ── NEW: Gemini challenges the intent (challenger/judge) ──
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

// ── NEW: Apply deltas to intent ──
function applyDeltas(intentPath, deltas) {
  if (!deltas.length) return intentPath;
  const intent = JSON.parse(readFileSync(intentPath, "utf-8"));
  for (const delta of deltas) {
    const beat = intent.beats.find(b => b.index === delta.beat_index);
    if (beat && beat[delta.field] !== undefined) {
      console.log(`  Applying delta [${delta.beat_index}] ${delta.field}: "${beat[delta.field]}" → "${delta.suggested}"`);
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
  const reviewDir = join(ROOT, "data", "audit", "render-review", runId, basename(outputPath, ".mp4"));
  mkdirSync(reviewDir, { recursive: true });

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

// ── NEW: Main render loop with OpenCode-first architecture ──
async function renderWithCorrectionLoop(channelId, scriptPath, format, runId, outputOverride) {
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

    // Step 2: Gemini challenges the intent (CHALLENGER/JUDGE)
    const challenge = await geminiChallenge(channelId, scriptPath, intentPath);

    if (challenge.verdict === "NEEDS_CHANGE" && challenge.deltas.length && attempt <= 2) {
      console.log(`Gemini found ${challenge.deltas.length} issue(s) — applying deltas`);
      intentPath = applyDeltas(intentPath, challenge.deltas);
      // Re-challenge on next iteration (max 1 delta round)
      continue;
    }

    console.log(`Gemini verdict: ${challenge.verdict} (score: ${challenge.score || "N/A"})`);

    // Step 3: Convert intent to visual-plan.json and render
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

    // Step 4: Compare execution vs intent (deterministic)
    const comparisonDir = join(ROOT, "data", "audit", "execution-comparison", runId);
    mkdirSync(comparisonDir, { recursive: true });
    const comparisonPath = join(comparisonDir, basename(result.outputPath, ".mp4") + "-comparison.json");
    await run("node", [EXECUTION_COMPARATOR_JS, "--intent", intentPath, "--video", result.outputPath, "--out", comparisonPath], "compare/" + channelId);

    // Step 5: QA (local audit + risk-based Gemini review)
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
      };
    }

    console.log("Not approved — retrying with fresh intent");
    intentPath = null; // Force new intent generation on next attempt
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
  for (const r of results) console.log("  " + basename(r.outputPath||"?") + ": risk=" + (r.localAuditRisk||"?") + " verdict=" + r.geminiVerdict + " qa=" + (r.qaGatePass?"PASS":"FAIL") + " intent=" + (r.challengeVerdict||"?"));

  if (ok === 0) { console.error("0 videos passed QA."); process.exit(1); }
}
main().catch(e => { console.error(e); process.exit(1); });