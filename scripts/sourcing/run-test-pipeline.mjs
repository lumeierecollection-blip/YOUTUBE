#!/usr/bin/env node
/**
 * run-test-pipeline.mjs — run the full video-specific sourcing pipeline for
 * one test video: research -> download -> visual plan -> treatment selection -> QA.
 *
 * Usage:
 *   node scripts/sourcing/run-test-pipeline.mjs --channel <id> --script <path> --research <path> --slug <slug>
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

function arg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }

function run(cmd, args, label) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("d", d => { out += d; process.stdout.write(`[${label}] ${d}`); });
    child.stderr.on("d", d => { err += d; process.stderr.write(`[${label}] ${d}`); });
    child.on("close", code => resolve({ code, stdout: out, stderr: err }));
  });
}

async function main() {
  const channel = arg("channel") || "1";
  const script = arg("script");
  const research = arg("research");
  const explicitSlug = arg("slug");
  let slug = explicitSlug || "video";
  // Derive slug from script topic_slug to match the researcher's output directory.
  if (!explicitSlug && existsSync(resolve(script))) {
    try { const s = JSON.parse(readFileSync(resolve(script), "utf8")); if (s.topic_slug) slug = s.topic_slug; } catch { /* use default */ }
  }
  const out = arg("out") || resolve(ROOT, "data", "sourcing-cache", `ch-${channel}`, slug);
  const qaOut = arg("qaout") || resolve(ROOT, "data", "qa-reports", `ch-${channel}`, slug);

  if (!script) { console.error("usage: --script <path> --research <path> --channel <id> --slug <slug>"); process.exit(1); }
  if (!existsSync(resolve(script))) { console.error(`script not found: ${script}`); process.exit(1); }
  if (!existsSync(resolve(research))) { console.error(`research not found: ${research}`); process.exit(1); }

  mkdirSync(out, { recursive: true });
  mkdirSync(qaOut, { recursive: true });

  const report = resolve(out, "sourcing-report.json");
  const manifest = resolve(out, "licensed-assets", "manifest.json");
  const plan = resolve(out, "visual-plan.json");
  const qaReport = resolve(qaOut, "qa-report.json");

  console.log(`\n===== PIPELINE: ch-${channel} / ${slug} =====`);

  // Step 1: research
  const r1 = await run("node", [resolve(ROOT, "scripts/sourcing/video-researcher.mjs"),
    "--script", script, "--channel", channel, "--research", research, "--out", resolve(ROOT, "data", "sourcing-cache", `ch-${channel}`)],
    "researcher");
  if (r1.code !== 0) throw new Error(`researcher failed`);

  // Step 2: download
  const r2 = await run("node", [resolve(ROOT, "scripts/sourcing/asset-downloader.mjs"),
    "--report", report, "--channel", channel, "--slug", slug, "--out", resolve(out, "licensed-assets")],
    "downloader");
  if (r2.code !== 0) throw new Error(`downloader failed`);

  // Step 3: visual plan
  const r3 = await run("node", [resolve(ROOT, "scripts/sourcing/visual-plan-generator.mjs"),
    "--report", report, "--assets", manifest, "--channel", channel, "--slug", slug, "--out", out],
    "plan-generator");
  if (r3.code !== 0) throw new Error(`plan-generator failed`);

  // Step 4: treatment selection
  const r4 = await run("node", [resolve(ROOT, "scripts/graphics/visual-treatment-selector.mjs"),
    "--plan", plan, "--channel", channel, "--slug", slug, "--out", qaOut],
    "treatment-selector");
  if (r4.code !== 0) throw new Error(`treatment-selector failed`);

  // Step 5: QA
  const r5 = await run("node", [resolve(ROOT, "scripts/qa/repetition-detector.mjs"),
    "--plan", plan, "--assets", manifest, "--channel", channel, "--slug", slug, "--out", qaOut, "--recent", "5"],
    "qa-detector");
  if (r5.code !== 0) console.warn(`QA reported issues (exit ${r5.code}) — see report`);

  // Read results
  const planData = JSON.parse(readFileSync(plan, "utf8"));
  const qaData = JSON.parse(readFileSync(qaReport, "utf8"));
  const manifestData = JSON.parse(readFileSync(manifest, "utf8"));

  console.log(`\n===== RESULT: ch-${channel} / ${slug} =====`);
  console.log(`Assets sourced: ${manifestData.totalDownloaded}, unique: ${new Set(manifestData.assets.map(a => a.sha256)).size}`);
  console.log(`Beats: ${planData.totalBeats}, unique assets in plan: ${planData.uniqueAssets}`);
  console.log(`Graphic types: ${planData.graphicTypesUsed.join(", ")}`);
  console.log(`QA verdict: ${qaData.verdict} (${qaData.findingCount} findings, ${qaData.highSeverity} high)`);

  return {
    channel, slug,
    assetsSourced: manifestData.totalDownloaded,
    uniqueAssets: new Set(manifestData.assets.map(a => a.sha256)).size,
    relevantBeats: planData.totalBeats,
    graphicTypes: planData.graphicTypesUsed,
    qaVerdict: qaData.verdict,
    qaFindings: qaData.findingCount,
    qaHigh: qaData.highSeverity,
    planPath: plan,
    qaReportPath: qaReport,
    assetsPath: manifest,
  };
}

main().then(r => {
  console.log("\nPIPELINE COMPLETE", JSON.stringify(r, null, 2));
  process.exit(0);
}).catch(e => { console.error("PIPELINE FAILED:", e.message); process.exit(1); });
