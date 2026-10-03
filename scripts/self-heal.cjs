#!/usr/bin/env node
/**
 * Self-heal — runs as the last job of daily-pipeline-v2.yml when any job
 * failed (`if: failure()`).
 *
 * What it does:
 *   1. Pulls the logs of every failed job in THIS run from the GitHub API
 *      (the job logs are complete even while the run itself is still open).
 *   2. Classifies the first real failure into a known class.
 *   3. If a fixer exists for that class AND every file it changed is in
 *      ALLOWED_PATHS (and none is in FORBIDDEN_PATHS), commits, pushes, and
 *      re-dispatches the workflow — at most MAX_RETRIGGERS_PER_HOUR times.
 *   4. Otherwise writes data/ci-runs/blocked-<class>.txt with the exact
 *      error lines and exits non-zero. The workflow uploads data/ci-runs/.
 *
 * Where the guarantee stops — stated plainly: no automatic fixer is
 * implemented yet for any class. Every failure seen on this pipeline so far
 * (dependency conflicts, model output, render crashes) needed a root-cause
 * change a regex rewrite can't make safely, and the rules for this job are
 * "fix the root cause or block — never substitute a default, skip a step,
 * or silence a check". So today this job diagnoses and blocks; it never
 * edits code. FIXERS is the extension point, and the scope guard and
 * retrigger cap below are enforced for anything added to it.
 *
 * Env: GH_TOKEN (actions:read + contents:write), GITHUB_REPOSITORY,
 *      GITHUB_RUN_ID, GITHUB_REF_NAME.
 */

const { writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "data", "ci-runs");
const WORKFLOW = "daily-pipeline-v2.yml";
const MAX_RETRIGGERS_PER_HOUR = 5;

/* ── Scope ────────────────────────────────────────────────────────── */

const ALLOWED_PATHS = [
  "scripts/render-and-qa.js",
  "scripts/local-visual-plan.cjs",
  "scripts/gemini-visual-plan.js",
  "scripts/ollama-client.cjs",
  "src/skills/remotion-render/visual-engine/beat-interpreter.js",
  "src/skills/remotion-render/visual-engine/director/visual-director.js",
  ".github/workflows/daily-pipeline-v2.yml",
  "package.json", // dependencies and overrides only — see packageJsonChangeIsScoped()
  "config/priority-channels.json",
];

const FORBIDDEN_PATTERNS = [
  /^src\/skills\/remotion-render\/.*\.jsx$/,
  /^src\/skills\/remotion-render\/.*\.tsx$/,
  /^src\/skills\/remotion-render\/Root\.jsx$/,
  /^src\/skills\/remotion-render\/index\.ts$/,
  /(^|\/)(primitives?|scenes?|layout|captions?|styles?)(\/|\.|-)/i,
  /^public\//,
  /^src\/skills\/remotion-render\/public\//,
  /^config\/channels\.json$/,
];

function scopeViolations(files) {
  const bad = [];
  for (const f of files) {
    if (FORBIDDEN_PATTERNS.some((re) => re.test(f))) bad.push(`${f} (forbidden)`);
    else if (!ALLOWED_PATHS.includes(f)) bad.push(`${f} (not in allowed list)`);
    else if (f === "package.json" && !packageJsonChangeIsScoped()) bad.push(`${f} (changed outside dependencies/overrides)`);
  }
  return bad;
}

function packageJsonChangeIsScoped() {
  const before = JSON.parse(git(["show", "HEAD:package.json"]));
  const after = JSON.parse(require("node:fs").readFileSync(join(ROOT, "package.json"), "utf-8"));
  for (const k of ["dependencies", "devDependencies", "overrides"]) { delete before[k]; delete after[k]; }
  return JSON.stringify(before) === JSON.stringify(after);
}

/* ── Classification ───────────────────────────────────────────────── */

// First match wins; ordered from most to least specific.
const CLASSES = [
  ["remotion-version-conflict", /_currentValue|Invalid hook call|more than one copy of React/i],
  ["no-visual-plan", /No visual plan at|no visual plan loaded/i],
  ["beat-without-mechanism", /Beat \d+ has no mechanism/],
  ["plan-caps", /Plan rejected:|violates the 1–2 rule|exceeds 40%/],
  ["silent-video", /silence detection failed|no audio stream/i],
  ["duration-drift", /drifts [\d.]+s \(max/],
  ["empty-frame", /beat-0 frame is [\d.]+ KB|empty-frame/i],
  ["prep-model-output", /All models failed|could not extract valid JSON|schema validation failed/],
  ["ollama-server", /address already in use|Ollama at .* not reachable|model .* not present/],
  ["missing-prep-artifact", /Artifact not found for name: prep-/],
  ["timeout", /exceeded the maximum execution time|The job running on runner .* has exceeded/i],
  ["tts", /TTS failed after/],
  ["upload", /Publish to YouTube|invalid_grant|quotaExceeded/i],
];

function classify(log) {
  for (const [name, re] of CLASSES) {
    const m = log.match(re);
    if (m) return { name, match: m[0] };
  }
  return { name: "unclassified", match: null };
}

// Extension point: { [className]: () => boolean /* true if files changed */ }.
// Deliberately empty — see header.
const FIXERS = {};

/* ── GitHub helpers ───────────────────────────────────────────────── */

function gh(args, opts = {}) {
  return execFileSync("gh", args, { cwd: ROOT, encoding: "utf-8", maxBuffer: 256 * 1024 * 1024, ...opts });
}
function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf-8" });
}

async function api(path, raw = false) {
  // Direct fetch, not `gh api`: gh refuses to print a response containing
  // terminal escape sequences, and job logs are full of them — every log
  // came back as a fetch error and nothing classified (run 35817394030).
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: "application/vnd.github+json" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return raw ? res.text() : res.json();
}

async function failedJobLogs(repo, runId) {
  const { jobs = [] } = await api(`repos/${repo}/actions/runs/${runId}/jobs?per_page=100`);
  const failed = jobs.filter((j) => j.conclusion === "failure" && j.name !== "self-heal");
  const logs = [];
  for (const j of failed) {
    let text;
    try {
      text = (await api(`repos/${repo}/actions/jobs/${j.id}/logs`, true)).replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, "");
    } catch (e) {
      text = `(could not fetch log: ${e.message})`;
    }
    logs.push({ name: j.name, text });
  }
  return logs;
}

function errorLines(text) {
  return text.split("\n")
    .filter((l) => /##\[error\]|::error::|Error:|TypeError|All models failed|failed/i.test(l))
    .map((l) => l.replace(/^\S+Z /, ""))
    .slice(0, 40);
}

function recentSelfHealDispatches(repo) {
  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  const runs = JSON.parse(gh(["api", `repos/${repo}/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&created=>=${since}&per_page=100`, "--jq", "[.workflow_runs[] | select(.actor.login == \"github-actions[bot]\")] | length"]).trim() || "0");
  return runs;
}

/* ── Main ─────────────────────────────────────────────────────────── */

function writeBlocker(cls, body) {
  mkdirSync(OUT_DIR, { recursive: true });
  const file = join(OUT_DIR, `blocked-${cls}.txt`);
  writeFileSync(file, body);
  console.log(`Wrote ${file}`);
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  const ref = process.env.GITHUB_REF_NAME;
  if (!repo || !runId) {
    console.error("self-heal runs inside GitHub Actions only (GITHUB_REPOSITORY / GITHUB_RUN_ID unset).");
    process.exit(2);
  }

  console.log(`=== SELF-HEAL: run ${runId} on ${ref} ===`);
  const logs = await failedJobLogs(repo, runId);
  if (!logs.length) {
    console.log("No failed jobs found — nothing to diagnose.");
    return;
  }

  // Classify on the first failed job whose log matches a known class.
  let cls = { name: "unclassified", match: null };
  let source = logs[0];
  for (const l of logs) {
    const c = classify(l.text);
    if (c.name !== "unclassified") { cls = c; source = l; break; }
  }
  console.log(`Failed jobs: ${logs.map((l) => l.name).join(", ")}`);
  console.log(`Classified as: ${cls.name}${cls.match ? ` (matched "${cls.match}")` : ""} in ${source.name}`);

  const fixer = FIXERS[cls.name];
  const report = [
    `Run: https://github.com/${repo}/actions/runs/${runId}`,
    `Class: ${cls.name}`,
    `Matched: ${cls.match || "(none)"}`,
    `Failed jobs: ${logs.map((l) => l.name).join(", ")}`,
    "",
    `Error lines from ${source.name}:`,
    ...errorLines(source.text),
    "",
  ];

  if (!fixer) {
    report.push("No automatic fixer exists for this class. Nothing was modified.");
    writeBlocker(cls.name, report.join("\n") + "\n");
    process.exit(1);
  }

  const changed = fixer();
  const files = git(["diff", "--name-only"]).split("\n").filter(Boolean);
  if (!changed || !files.length) {
    report.push("Fixer ran but changed nothing.");
    writeBlocker(cls.name, report.join("\n") + "\n");
    process.exit(1);
  }
  const bad = scopeViolations(files);
  if (bad.length) {
    git(["checkout", "--", "."]);
    report.push("Fix required files outside the allowed scope — reverted, nothing committed:", ...bad.map((b) => `  ${b}`));
    writeBlocker(cls.name, report.join("\n") + "\n");
    process.exit(1);
  }
  const recent = recentSelfHealDispatches(repo);
  if (recent >= MAX_RETRIGGERS_PER_HOUR) {
    git(["checkout", "--", "."]);
    report.push(`Retrigger cap reached (${recent} self-heal dispatches in the last hour, max ${MAX_RETRIGGERS_PER_HOUR}).`);
    writeBlocker("retrigger-cap", report.join("\n") + "\n");
    process.exit(1);
  }

  git(["add", "--", ...files]);
  git(["-c", "user.name=pipeline-bot", "-c", "user.email=pipeline@youtube-automation.local",
    "commit", "-m", `self-heal: ${cls.name} (run ${runId})`]);
  git(["push", "origin", `HEAD:${ref}`]);
  gh(["workflow", "run", WORKFLOW, "--ref", ref]);
  console.log(`Committed ${files.join(", ")} and re-dispatched ${WORKFLOW} on ${ref}.`);
}

main().catch((e) => {
  console.error(`self-heal crashed: ${e.stack || e.message}`);
  process.exit(1);
});
