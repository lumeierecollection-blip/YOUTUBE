/**
 * Copies a run's outputs to the automation/previews branch and rebuilds previews/index.md. Called
 * after every stage, so a channel's output appears without waiting for the others. MP4s stay in the
 * run's Actions artifact; the branch holds what is small enough to browse. Without GITHUB_ACTIONS
 * this does nothing, so a local dry run cannot touch the branch.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BRANCH = "automation/previews";
const MAX_FILE_BYTES = 6e6;
const git = (dir, args) => spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });

function latestByChannel(root) {
  const rows = [];
  if (!existsSync(root)) return rows;
  for (const key of readdirSync(root).sort()) {
    const dir = join(root, key);
    if (!statSync(dir).isDirectory()) continue;
    const runs = readdirSync(dir).filter((r) => existsSync(join(dir, r, "preview-meta.json"))).map((r) => ({ r, meta: JSON.parse(readFileSync(join(dir, r, "preview-meta.json"), "utf8")) })).sort((a, b) => a.meta.timestamp.localeCompare(b.meta.timestamp));
    if (!runs.length) continue;
    const last = runs.at(-1);
    const ok = runs.filter((x) => x.meta.status === "ok").at(-1);
    const has = (n) => (existsSync(join(dir, last.r, n)) ? `[${n}](${key}/${last.r}/${n})` : "");
    rows.push({ key, agent: last.meta.agent, stage: last.meta.stage, status: last.meta.status, at: last.meta.timestamp, sheet: has("contact-sheet.jpg"), script: has("script-draft.md"), plan: has("scene-plan.json"), blocker: last.meta.error || "", lastOk: ok ? ok.meta.timestamp : "none", run: last.r });
  }
  return rows;
}

function index(root) {
  const rows = latestByChannel(root);
  const md = ["# Production preview index", "", `Rebuilt ${new Date().toISOString()}. Updated when a stage finishes; this is not a live stream. MP4s are in each run's GitHub Actions artifact.`, "", "| Channel | Agent | Stage | Status | Updated | Contact sheet | Script | Scene plan | Last success | Blocker |", "|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.key} | ${r.agent} | ${r.stage} | ${r.status} | ${r.at} | ${r.sheet} | ${r.script} | ${r.plan} | ${r.lastOk} | ${String(r.blocker).replace(/\|/g, "/").replace(/\n/g, " ")} |`), ""].join("\n");
  writeFileSync(join(root, "index.md"), md);
  writeFileSync(join(root, "index.json"), JSON.stringify({ rebuilt_at: new Date().toISOString(), channels: rows }, null, 2));
}

export function publish({ key, runId, outDir }) {
  if (!process.env.GITHUB_ACTIONS) return;
  const repo = process.env.GITHUB_WORKSPACE, wt = join(repo, ".previews-worktree");
  try {
    if (!existsSync(wt)) {
      git(repo, ["config", "user.name", "preview-bot"]); git(repo, ["config", "user.email", "preview-bot@users.noreply.github.com"]);
      if (git(repo, ["fetch", "--depth=1", "origin", BRANCH]).status === 0) git(repo, ["worktree", "add", "-B", BRANCH, wt, "FETCH_HEAD"]);
      else git(repo, ["worktree", "add", "--orphan", "-b", BRANCH, wt]);
    }
    for (let attempt = 1; attempt <= 5; attempt++) {
      git(wt, ["fetch", "--depth=1", "origin", BRANCH]);
      git(wt, ["reset", "--hard", "FETCH_HEAD"]);
      const target = join(wt, "previews", key, runId);
      rmSync(target, { recursive: true, force: true });
      mkdirSync(target, { recursive: true });
      cpSync(outDir, target, { recursive: true, filter: (src) => statSync(src).isDirectory() || (!src.endsWith(".mp4") && statSync(src).size <= MAX_FILE_BYTES) });
      index(join(wt, "previews"));
      git(wt, ["add", "-A"]);
      if (git(wt, ["diff", "--cached", "--quiet"]).status === 0) return;
      git(wt, ["commit", "-m", `preview ${key} ${runId}`]);
      if (git(wt, ["push", "origin", `HEAD:${BRANCH}`]).status === 0) return;
    }
    console.error("preview publish: could not push after 5 attempts");
  } catch (e) { console.error(`preview publish failed: ${e.message}`); }
}
