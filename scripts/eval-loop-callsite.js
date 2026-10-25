/**
 * eval-loop-callsite.js — the EVAL_LOOP_MODE call site of render-and-qa.js, as a
 * module so it can be tested (render-and-qa.js runs main() on import).
 *
 * WHERE IT RUNS: right after the deterministic canvas checks (Layer 1) have been
 * measured and BEFORE their early-return. A render that fails Layer 1 used to
 * `return backupAudit(...)` before this block was reached, so Layers 2 and 3 had
 * never produced a number in CI. Now the loop runs on every render in mode dry/live
 * — pass or fail — and records what Layers 2 and 3 saw.
 *
 * WHAT IT DOES: record, and — in LIVE mode only — revise. Layer 1 still gates: a video that failed
 * Layer 1 is rejected by the caller and never revised. When a Layer-1-passing video is judged below
 * the acceptance band, revise() (scripts/eval-revise.js) may return a layout patch for at most two
 * beats Layer 3 flagged — only if each names a visible defect and the patch is drawable as given.
 * Live renders the patched plan (rerender), re-runs Layer 1 on it (canvasCheck) and judges it again.
 * The revised video replaces the original only if it passes Layer 1 and Layer 3 does not score it
 * lower; otherwise the original is restored. Dry decides and records the patch, renders nothing.
 * Everything is in data/audit/eval-loop/<channel>/<run>.jsonl.
 */
import { basename, extname } from "node:path";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { runEvalLoop, loopEnabled, evalLoopMode, writeLoopAudit } from "./eval-retry-loop.js";
import { reviseBeats } from "./eval-revise.js";

const manifestOf = (mp4) => String(mp4).replace(/\.mp4$/, "-manifest.json");
const readManifestDefault = (mp4) => { try { return JSON.parse(readFileSync(manifestOf(mp4), "utf8")); } catch { return null; } };
// The original video (and its manifest) is set aside before the first live re-render, so it can be
// put back if the revision does not hold.
export const backupDefault = {
  save(mp4) { const b = { mp4: mp4.replace(/\.mp4$/, ".pre-revise.mp4"), manifest: manifestOf(mp4).replace(/\.json$/, ".pre-revise.json") }; copyFileSync(mp4, b.mp4); if (existsSync(manifestOf(mp4))) copyFileSync(manifestOf(mp4), b.manifest); return b; },
  restore(b, mp4) { copyFileSync(b.mp4, mp4); if (existsSync(b.manifest)) copyFileSync(b.manifest, manifestOf(mp4)); },
  promote(from, mp4) { if (from === mp4) return; copyFileSync(from, mp4); if (existsSync(manifestOf(from))) copyFileSync(manifestOf(from), manifestOf(mp4)); },
};

/**
 * @param {object}   a
 * @param {object}   a.plan            visual plan the render came from
 * @param {string}   a.scriptPath
 * @param {number}   a.attempt
 * @param {string|number} a.channelId
 * @param {string}   a.outputPath      the rendered MP4
 * @param {Array|null} a.layer1Failures  null/[] = Layer 1 passed; otherwise [{check}]
 * @param {Function} a.layer2Advisory  (outputPath) -> advisory object
 * @param {Function} a.judge           (outputPath, opts) -> Layer 3 result
 * @param {object}  [a.env]
 * @param {string}  [a.root]           audit root (tests)
 * @returns {Promise<null | {decision, auditPath, result, mode}>} null when the loop is off
 */
export async function recordEvalLoop({ plan, scriptPath, attempt, channelId, outputPath, layer1Failures, layer2Advisory, judge, env = process.env, root, log = console.log, logError = console.error,
  inkSpans = null, rerender = null, canvasCheck = null, callModel = null, styleSpec = null, judgeSpec = null, readManifest = readManifestDefault, backup = backupDefault }) {
  if (!loopEnabled(env)) return null;
  const mode = evalLoopMode(env);
  const t0 = Date.now();
  const runId = `${basename(scriptPath, extname(scriptPath))}-a${attempt}`;
  const failures = (layer1Failures || []).map((f) => (typeof f === "string" ? { check: f } : f));
  const layer1Pass = failures.length === 0;
  const wouldRerender = [];
  // What the loop is judging NOW: the original render, then — live — each revised render.
  const cur = { outputPath, failures, inkSpans, lastJudged: null };
  let originalAggregate = null, saved = null;
  const rendered = [];
  let result = null;
  try {
    result = await runEvalLoop({
      plan, runId, channel: channelId,
      recordOnLayer1Fail: true,
      reviseWeakBeats: true,
      layer1: async () => ({ pass: cur.failures.length === 0, failures: cur.failures }),
      // Layer 2: CLIP similarity to the shared references + clone-suspicion verdict. Advisory; one
      // that cannot run reports why and the loop carries on without a number.
      layer2: async () => {
        try {
          const l2 = await layer2Advisory(cur.outputPath);
          log(`[layer2] advisory_score ${l2.advisory_score.toFixed(4)} (floor ${l2.threshold.toFixed(4)}), ${l2.frame_count} frames, ${l2.below_floor_count} below the floor, style_match ${l2.style_match} (clone frames ${l2.clone_frames}, reference ceiling ${l2.reference_ceiling.toFixed(4)}, best ${l2.candidate_max?.toFixed(4)}; references ${l2.reference_source})`);
          return l2;
        } catch (e) {
          logError(`[layer2] could not run: ${e.message}`);
          return { advisory_score: null, style_match: null, note: `layer 2 could not run: ${e.message}` };
        }
      },
      layer3: async ({ layer2Advisory: l2 }) => {
        const j = await judge(cur.outputPath, { channelId, layer2Advisory: l2?.advisory_score ?? null, styleMatch: l2?.style_match ?? null });
        cur.lastJudged = j;
        if (originalAggregate === null) originalAggregate = Number(j?.aggregate_local);
        return j;
      },
      revise: async (revisions, { plan: p, judged }) => {
        if (!callModel) return { planPatch: null, record: { flagged: [], accepted: [], rejected: [], reason: "no reviser model wired at this call site" } };
        return reviseBeats({ plan: p, weakBeats: judged?.weak_beats, manifest: readManifest(cur.outputPath), inkSpans: cur.inkSpans,
          layer1: { pass: cur.failures.length === 0, failures: cur.failures }, layer3: judged, styleSpec, judgeSpec, callModel, log });
      },
      renderBeats: async (indices, meta) => {
        if (mode === "dry") { wouldRerender.push(...indices); return "halt"; }
        if (!rerender || !canvasCheck) throw new Error("live re-render is not wired at this call site (rerender / canvasCheck)");
        if (!saved) saved = backup.save(outputPath);
        let r;
        // A re-render that fails can leave a partial file (or none) at the output path: the original
        // goes back at once, before the error reaches the loop.
        try { r = await rerender(meta.planPatch, { attempt: meta.attempt, beats: indices }); }
        catch (e) { try { backup.restore(saved, outputPath); } catch (e2) { logError(`[eval-loop:live] restore after a failed re-render failed: ${e2.message}`); } throw e; }
        cur.outputPath = r.outputPath;
        const cc = await canvasCheck(r.outputPath);
        cur.failures = (cc.failures || []).map((f) => (typeof f === "string" ? { check: f } : f));
        cur.inkSpans = cc.inkSpans || null;
        rendered.push(...indices);
        log(`[eval-loop:live] re-rendered beat(s) ${indices.join(", ")} -> ${r.outputPath} (layer1 ${cur.failures.length ? "FAIL: " + cur.failures.map((f) => f.check).join(",") : "pass"})`);
      },
      onEvent: (type, d) => log(`[eval-loop:${mode}] ${type} ${JSON.stringify(d)}`),
    });
  } catch (e) {
    // The loop is an addition; it must never be able to fail a render.
    logError(`[eval-loop:${mode}] could not run: ${e.message}`);
    result = { accepted: false, humanReview: true, error: e.message };
  }
  // Live, after a re-render: the revision ships only if it passed Layer 1 and was not judged lower.
  let shipped = rendered.length ? null : "original";
  if (rendered.length) {
    const agg = Number(cur.lastJudged?.aggregate_local);
    const keep = cur.failures.length === 0 && Number.isFinite(agg) && (!Number.isFinite(originalAggregate) || agg >= originalAggregate);
    try {
      if (keep) { backup.promote(cur.outputPath, outputPath); shipped = "revised"; }
      else { backup.restore(saved, outputPath); shipped = "original (restored)"; }
    } catch (e) { logError(`[eval-loop:live] could not ${keep ? "keep the revision" : "restore the original"}: ${e.message}`); shipped = keep ? "revised (copy failed)" : "unknown (restore failed)"; }
    log(`[eval-loop:live] shipped: ${shipped} — revised layer1 ${cur.failures.length ? "FAIL" : "pass"}, aggregate ${Number.isFinite(agg) ? agg : "-"} vs original ${Number.isFinite(originalAggregate) ? originalAggregate : "-"}`);
  }
  const decision = result?.accepted ? "accept" : result?.shipsAsRendered ? "ship_as_rendered" : result?.humanReview ? "human_review" : "retry";
  const l2 = result?.layer2 ?? result?.layer2_advisory ?? null;
  const record = {
    channel: channelId, runId, mode, decision,
    retries_spent: result?.retries ?? 0,
    weak_beats: result?.events?.filter((e) => e.type === "layer3-fail") ?? [],
    would_rerender: wouldRerender, rendered,
    shipped,
    revise: [...(result?.events || []).filter((e) => e.type === "revised" || e.type === "empty-patch"), ...(result?.revise ? [{ type: "record", ...result.revise }] : [])],
    unresolved: result?.unresolved ?? [],
    why: result?.why ?? result?.error ?? null,
    duration_ms: Date.now() - t0,
    layer1_result: result?.layer1_result ?? { pass: layer1Pass, failures },
    layer2: l2 ? {
      advisory_score: l2.advisory_score ?? null, frame_count: l2.frame_count ?? null,
      below_floor_count: l2.below_floor_count ?? null, timestamps_below_floor: l2.timestamps_below_floor ?? null,
      style_match: l2.style_match ?? null, clone_frames: l2.clone_frames ?? null, note: l2.note ?? null,
    } : null,
    layer3: result?.layer3 ?? (Number.isFinite(result?.aggregate_local) ? { aggregate_local: result.aggregate_local, axes: result.axes ?? null } : null),
  };
  const auditPath = writeLoopAudit(record, root ? { root } : undefined);
  log(`[eval-loop-record] ${JSON.stringify(record)}`);
  log(`[eval-loop:${mode}] ${decision} (layer1 ${layer1Pass ? "pass" : "FAIL: " + failures.map((f) => f.check).join(",")}) — retries=${result?.retries ?? 0} audit=${auditPath}`);
  return { decision, auditPath, result, mode };
}
