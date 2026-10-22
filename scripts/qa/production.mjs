// The production QA loop (render-and-qa.js -> here -> loop.mjs). Render -> inspect -> repair -> re-render.
//
//   QA_LOOP=off       nothing runs.
//   QA_LOOP=advisory  (production default) attempt 1 is inspected and the repairs it WOULD apply are
//                     computed and written to the report; nothing is re-rendered, no verdict changes.
//   QA_LOOP=enforce   repairs are applied and the video re-rendered until pass / no-progress /
//                     unresolved / budget; the BEST attempt (fewest blockers, then blocker+major) is
//                     what render-and-qa.js continues with. Its remaining blockers fail the video.
//
// Budgets: QA_MAX_ATTEMPTS (renders incl. the first, default 3), QA_MAX_MS (default 20 min),
// QA_MAX_COST_UNITS (re-renders, default 2; a post repair costs 0).
//
// What is inspected: objective-checks.mjs (container, aspect/resolution, duration, fps, A/V,
// black, freeze, silence, true peak, SRT timing, missing media) + the Layer-1 canvas checks
// (local-audit.cjs --canvas-only, run by the caller and passed in as stdout) + render failure.
// Vision: this loop makes NO model call. The report says `vision: not_run` with the reason; the
// frame review that runs later in render-and-qa.js gates separately (stage frame-review).
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { makeDefect, writeDefectReport, sortDefects } from "./defects.mjs";
import { runObjectiveChecks, probe } from "./objective-checks.mjs";
import { planRiskFrames, extractRiskFrames } from "./risk-frames.mjs";
import { runQaLoop } from "./loop.mjs";
import { repairFor, applyPlanRepairs, clampSrt, limitAudio } from "./repairs.mjs";

export function qaMode(env = process.env) {
  const m = String(env.QA_LOOP || "advisory").toLowerCase();
  return ["enforce", "advisory", "off"].includes(m) ? m : "advisory";
}

export function qaBudgets(env = process.env) {
  const n = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return { maxAttempts: Math.floor(n(env.QA_MAX_ATTEMPTS, 3)), maxMs: n(env.QA_MAX_MS, 20 * 60 * 1000), maxCostUnits: n(env.QA_MAX_COST_UNITS, 2) };
}

/** `[canvas] FAIL <id> — beat 0: ...; beat 3: ...` (local-audit.cjs main) -> one defect per failing beat. */
export function canvasDefects(stdout, manifest = null) {
  const out = [];
  const beats = manifest?.beats || [];
  for (const m of String(stdout || "").matchAll(/\[canvas\] FAIL (\S+) — ([^\n]*)/g)) {
    const [, id, detail] = m;
    const parts = detail.split(/;\s+/);
    const perBeat = parts.map((p) => [/^beat (\d+)/.exec(p), p]).filter(([b]) => b);
    if (!perBeat.length) { out.push(makeDefect({ id: `canvas:${id}`, check: id, source: "audit", severity: "major", evidence: detail.slice(0, 300), expected: "check passes", actual: "FAIL" })); continue; }
    const seen = new Set();
    for (const [b, p] of perBeat) {
      const i = Number(b[1]);
      if (seen.has(i)) { out.find((d) => d.id === `canvas:${id}:${i}`).evidence += `; ${p}`; continue; }
      seen.add(i);
      const beat = beats[i] || {};
      const t0 = beat.start_sec ?? null;
      const d = makeDefect({ id: `canvas:${id}:${i}`, check: id, source: "audit", severity: "major", beat_index: i, t_start: t0, t_end: t0 != null ? t0 + (beat.duration_sec || 0) : null, evidence: p.slice(0, 300), expected: "check passes", actual: "FAIL" });
      if (id === "entity-coverage") d.entities = [...p.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
      out.push(d);
    }
  }
  return out;
}

/** Every defect of one render, each with its repair (or null). */
export function inspectRender({ videoPath, manifest = null, srtPath = null, canvasStdout = "", canvasCode = 0, format = "shorts", publicDir = null, renderError = null }) {
  if (renderError || !videoPath || !existsSync(videoPath)) {
    return [makeDefect({ id: "obj:render-failure", check: "render-failure", source: "objective", severity: "blocker", evidence: String(renderError || "no MP4 on disk"), expected: "a rendered MP4", actual: "none" })];
  }
  const defects = [
    ...runObjectiveChecks(videoPath, { format, fps: manifest?.fps || 30, srtPath, manifest, publicDir }),
    ...canvasDefects(canvasStdout, manifest),
  ];
  if (canvasCode !== 0 && canvasCode !== 1) defects.push(makeDefect({ id: "canvas:could-not-run", check: "canvas-checks", source: "audit", severity: "major", evidence: `local-audit --canvas-only exited ${canvasCode}`, expected: "canvas checks run", actual: "could not run" }));
  for (const d of defects) if (!d.repair) d.repair = repairFor(d);
  return defects;
}

const scopes = (defects) => new Set(defects.filter((d) => d.severity !== "minor" && d.repair).map((d) => d.repair.scope));

/**
 * Run the loop on an already-rendered attempt 1.
 *   first        { videoPath, planPath, canvasStdout, canvasCode }
 *   rerender(planPath, n) -> same shape (or { error })  - re-renders + re-runs the canvas checks
 *   canvasCheck(videoPath) -> { stdout, code }          - canvas checks only (after a post repair)
 *   rebuildCanvas(beat) -> canvas                       - render-and-qa.js canvasContentFor
 *   sentences[i]                                        - the SRT sentence of beat i (TYPE-card text)
 */
export async function runProductionQa({ mode = qaMode(), budgets = qaBudgets(), first, rerender, canvasCheck = null, rebuildCanvas = null, sentences = [], srtPath = null, format = "shorts", publicDir = null, log = console.log, now = Date.now }) {
  const stem = basename(first.videoPath, ".mp4");
  const outDir = dirname(first.videoPath);
  const vision = { status: "not_run", reason: "the QA loop makes no model call; the frame review later in render-and-qa.js gates separately (stage frame-review)" };
  if (mode === "off") return { mode, skipped: true };

  const canonical = first.videoPath;
  const ctxs = new Map();
  const history = new Map();
  const repairsLog = [];
  const manifestOf = (v) => { try { return JSON.parse(readFileSync(v.replace(/\.mp4$/, "-manifest.json"), "utf8")); } catch { return null; } };
  const inspect = (ctx) => inspectRender({ ...ctx, manifest: manifestOf(ctx.videoPath || ""), srtPath, format, publicDir, renderError: ctx.error });

  let pending = null; // what attempt n+1 renders from
  const render = async (n) => {
    if (n === 1) { ctxs.set(1, { ...first, attempt: 1 }); return ctxs.get(1); }
    let ctx;
    if (pending.rerender) {
      // The renderer writes to the canonical path, so the previous attempt is snapshotted first (best-attempt revert needs it).
      const prev = ctxs.get(n - 1);
      if (prev?.videoPath === canonical && existsSync(canonical)) {
        const snap = canonical.replace(/\.mp4$/, `.qa-a${n - 1}.mp4`);
        copyFileSync(canonical, snap);
        try { copyFileSync(canonical.replace(/\.mp4$/, "-manifest.json"), snap.replace(/\.mp4$/, "-manifest.json")); } catch { /* no manifest */ }
        prev.videoPath = snap;
      }
      const r = await rerender(pending.planPath, n).catch((e) => ({ error: e.message }));
      ctx = { ...r, planPath: r.planPath || pending.planPath, attempt: n };
    } else {
      // post repair only: same plan, the MP4 fixed in place under a new name, canvas re-measured
      const prev = ctxs.get(n - 1);
      ctx = { ...prev, videoPath: pending.videoPath, attempt: n };
      if (canvasCheck) { const c = await canvasCheck(ctx.videoPath); ctx.canvasStdout = c.stdout; ctx.canvasCode = c.code; }
    }
    ctxs.set(n, ctx);
    return ctx;
  };

  const repair = async (defects, ctx, n) => {
    const actionable = defects.filter((d) => d.severity !== "minor" && d.repair);
    const sc = scopes(defects);
    const entry = { attempt: n, plan: [], input: [], post: [] };
    let rerenderNeeded = false, changed = false, escalates = false;
    let planPath = ctx.planPath;
    if (sc.has("plan") && ctx.planPath && existsSync(ctx.planPath)) {
      const plan = JSON.parse(readFileSync(ctx.planPath, "utf8"));
      const r = applyPlanRepairs(plan, actionable, { sentences, history, rebuildCanvas });
      entry.plan = r.applied;
      escalates = r.escalates;
      if (r.changed) {
        planPath = ctx.planPath.replace(/(-qa-a\d+)?\.json$/, `-qa-a${n + 1}.json`);
        if (mode === "enforce") writeFileSync(planPath, JSON.stringify(r.plan, null, 2) + "\n");
        rerenderNeeded = changed = true;
      }
    }
    if (sc.has("input") && srtPath && existsSync(srtPath)) {
      const dur = (() => { try { return probe(ctx.videoPath).duration; } catch { return null; } })();
      const r = clampSrt(readFileSync(srtPath, "utf8"), dur);
      entry.input = r.fixes;
      if (r.changed) { if (mode === "enforce") { copyFileSync(srtPath, `${srtPath}.pre-qa`); writeFileSync(srtPath, r.text); } rerenderNeeded = changed = true; }
    }
    let videoPath = ctx.videoPath;
    if (sc.has("post") && !rerenderNeeded) {
      videoPath = ctx.videoPath.replace(/(\.qa-a\d+)?\.mp4$/, `.qa-a${n + 1}.mp4`);
      if (mode === "enforce") {
        copyFileSync(ctx.videoPath, videoPath);
        try { copyFileSync(ctx.videoPath.replace(/\.mp4$/, "-manifest.json"), videoPath.replace(/\.mp4$/, "-manifest.json")); } catch { /* no manifest */ }
        const r = limitAudio(videoPath);
        entry.post.push(r.changed ? "audio limiter -1 dBFS" : `audio limiter failed: ${r.error}`);
        changed = r.changed;
      } else { entry.post.push("audio limiter -1 dBFS (not applied: advisory)"); changed = true; }
    }
    repairsLog.push(entry);
    pending = { rerender: rerenderNeeded, planPath, videoPath };
    if (mode !== "enforce") return { changed: false, proposed: changed, entry }; // advisory: stop after attempt 1
    return { changed, cost: rerenderNeeded ? 1 : 0, entry, escalates };
  };

  const result = await runQaLoop({ render, inspect, repair, budgets: mode === "enforce" ? budgets : { ...budgets, maxAttempts: 2 }, now, log });
  if (mode !== "enforce" && result.status === "unresolved") result.status = repairsLog[0]?.plan.length || repairsLog[0]?.input.length || repairsLog[0]?.post.length ? "advisory-repairs-proposed" : "advisory-no-repair";
  const best = ctxs.get(result.best_attempt);
  const bestDefects = result.attempts.find((a) => a.attempt === result.best_attempt).defects;

  // The best attempt ships from the canonical path (render-and-qa.js continues with it).
  if (mode === "enforce" && best.videoPath && best.videoPath !== canonical && existsSync(best.videoPath)) {
    copyFileSync(best.videoPath, canonical);
    try { copyFileSync(best.videoPath.replace(/\.mp4$/, "-manifest.json"), canonical.replace(/\.mp4$/, "-manifest.json")); } catch { /* no manifest */ }
    log(`[qa-loop] attempt ${result.best_attempt} is the best: ${basename(best.videoPath)} -> ${basename(canonical)}`);
    best.videoPath = canonical;
  }
  // Risk frames + contact sheet on the attempt that ships.
  let frames = [], sheet = null;
  try {
    const man = manifestOf(best.videoPath);
    const info = probe(best.videoPath);
    const beats = (man?.beats || []).map((b) => ({ start: b.start_sec, end: (b.start_sec ?? 0) + (b.duration_sec || 0) })).filter((b) => Number.isFinite(b.start));
    const extra = bestDefects.filter((d) => d.t_start != null && d.severity !== "minor").map((d) => d.t_start + Math.min(0.2, Math.max(0, (d.t_end ?? d.t_start) - d.t_start) / 2));
    ({ frames, sheet } = extractRiskFrames(best.videoPath, planRiskFrames({ duration: info.duration, beats, extra, fps: man?.fps || 30, max: 24 }), join(outDir, `${stem}-qa-frames`)));
  } catch (e) { log(`[qa-loop] risk frames not extracted: ${e.message}`); }

  const blockers = bestDefects.filter((d) => d.severity === "blocker");
  for (const d of bestDefects) d.status = "unresolved";
  const fixedEarlier = result.attempts.filter((a) => a.attempt < result.best_attempt).flatMap((a) => a.defects).filter((d) => !bestDefects.some((b) => b.id === d.id)).map((d) => ({ ...d, status: "repaired" }));
  const meta = {
    mode, status: result.status, best_attempt: result.best_attempt, reverted_to_best: result.reverted_to_best, budgets,
    total_ms: result.total_ms, total_cost: result.total_cost, vision,
    attempts: result.attempts.map((a) => ({ attempt: a.attempt, video: ctxs.get(a.attempt)?.videoPath ? basename(ctxs.get(a.attempt).videoPath) : null, plan: ctxs.get(a.attempt)?.planPath ? basename(ctxs.get(a.attempt).planPath) : null, blockers: a.defects.filter((d) => d.severity === "blocker").length, majors: a.defects.filter((d) => d.severity === "major").length, regressions: a.regressions, duration_ms: a.duration_ms })),
    repairs: repairsLog, regressions: result.attempts.flatMap((a) => a.regressions.map((r) => ({ attempt: a.attempt, defect: r }))),
    risk_frames: frames.map((f) => ({ t: f.t, reasons: f.reasons, path: basename(f.path) })), contact_sheet: sheet ? basename(sheet) : null,
  };
  const report = writeDefectReport(outDir, `${stem}-qa-loop`, [...bestDefects, ...fixedEarlier], meta);
  // The markdown gets the loop summary on top (writeDefectReport only tabulates defects).
  const md = readFileSync(report.mdPath, "utf8");
  const head = [`QA loop: mode **${mode}**, status **${result.status}**, best attempt ${result.best_attempt}/${result.attempts.length}, ${result.total_cost} re-render(s), ${(result.total_ms / 1000).toFixed(0)} s. Vision: ${vision.status} (${vision.reason}).`, "",
    ...meta.attempts.map((a) => `- attempt ${a.attempt}: ${a.blockers} blocker, ${a.majors} major${a.regressions.length ? `, regressions: ${a.regressions.join(", ")}` : ""} (${a.video})`),
    ...repairsLog.map((r) => `- repairs after attempt ${r.attempt}: ${[...r.plan.map((p) => `beat ${p.beat_index}: ${p.notes.join(" / ")}`), ...r.input, ...r.post].join("; ") || "none applicable"}`),
    sheet ? `- contact sheet: ${basename(sheet)} (${frames.length} risk frames)` : "- contact sheet: not produced", ""].join("\n");
  writeFileSync(report.mdPath, md.replace(/\n\n/, `\n\n${head}\n`));
  log(`[qa-loop] ${mode}: ${result.status}; best attempt ${result.best_attempt}; ${blockers.length} blocker(s), ${bestDefects.length - blockers.length} other unresolved; report ${basename(report.jsonPath)}`);
  return { mode, ...result, best, bestDefects: sortDefects(bestDefects), blockers, report, frames, sheet, vision };
}
