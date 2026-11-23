#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function arg(name, def = null) { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : def; }
const root = path.resolve(arg("root", "."));
const reviewsDir = path.join(root, arg("reviews", "reviews/final"));
const outDir = path.join(root, "out");
const qaDir = path.join(root, "qa");
const recordsDir = path.join(root, "production-records");
fs.mkdirSync(recordsDir, { recursive: true });
fs.mkdirSync(reviewsDir, { recursive: true });

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "")); } catch { return null; } }
function list(dir, ext) { return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(ext)).sort() : []; }

const plans = list(path.join(root, "plans"), ".plan.json").map(f => readJson(path.join(root, "plans", f))).filter(Boolean);
const statuses = [];
let allApproved = true;

for (const plan of plans) {
  const base = `${plan.id}-${plan.slug}`;
  const mp4 = path.join(outDir, `${base}.mp4`);
  const qaTxt = path.join(qaDir, `${base}.mp4.txt`);
  const review = readJson(path.join(reviewsDir, `${base}.review.json`));
  const director = readJson(path.join(recordsDir, `${base}.director.json`));
  const rendered = fs.existsSync(mp4) && fs.statSync(mp4).size > 1000;
  const qaFailed = fs.existsSync(path.join(qaDir, "TECH_QA_FAILED.txt"));
  const technicalQa = rendered && fs.existsSync(qaTxt) && !fs.readFileSync(qaTxt, "utf8").includes("BAD") && !qaFailed;
  const geminiReviewPass = !!(review && review.status === "reviewed" && review.pass === true);
  const directorOk = !!(director && director.status === "ok" && director.approved === true);
  const finalApproved = rendered && technicalQa && geminiReviewPass && directorOk;
  if (!finalApproved) allApproved = false;
  statuses.push({
    id: plan.id, slug: plan.slug, title: plan.title,
    RENDERED: rendered,
    TECHNICAL_QA_PASSED: technicalQa,
    GEMINI_REVIEW_PASSED: geminiReviewPass,
    DIRECTOR_APPROVED: directorOk,
    FINAL_APPROVED: finalApproved,
    reviewStatus: review?.status || null,
    reviewPass: !!review?.pass,
    reviewReason: review?.reason || null,
    reviewSummary: review?.summary || null,
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  allApproved,
  definitionOfSuccess: "Five genuinely finished, Gemini-approved videos",
  statuses,
};
fs.writeFileSync(path.join(recordsDir, "acceptance.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(reviewsDir, "acceptance.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!allApproved) {
  console.error("ACCEPTANCE FAILED: not all videos are FINAL_APPROVED");
  process.exit(1);
}
console.log("ACCEPTANCE PASSED");
