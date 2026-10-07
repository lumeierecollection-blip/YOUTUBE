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
 * WHAT IT DOES NOT DO: route. Layer 1 still gates: a video that failed Layer 1 is
 * still rejected by the caller. The loop's accept / retry / human_review decision is
 * data in data/audit/eval-loop/<channel>/<run>.jsonl, and `layer1_result` in that
 * record says whether Layer 1 passed. Nothing here can ship, block, or delete a video.
 */
import { basename, extname } from "node:path";
import { runEvalLoop, loopEnabled, evalLoopMode, writeLoopAudit } from "./eval-retry-loop.js";

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
export async function recordEvalLoop({ plan, scriptPath, attempt, channelId, outputPath, layer1Failures, layer2Advisory, judge, env = process.env, root, log = console.log, logError = console.error }) {
  if (!loopEnabled(env)) return null;
  const mode = evalLoopMode(env);
  const t0 = Date.now();
  const runId = `${basename(scriptPath, extname(scriptPath))}-a${attempt}`;
  const failures = (layer1Failures || []).map((f) => (typeof f === "string" ? { check: f } : f));
  const layer1Pass = failures.length === 0;
  const wouldRerender = [];
  let result = null;
  try {
    result = await runEvalLoop({
      plan, runId, channel: channelId,
      recordOnLayer1Fail: true,
      layer1: async () => ({ pass: layer1Pass, failures }),
      // Layer 2: CLIP similarity to the shared references + clone-suspicion verdict. Advisory; one
      // that cannot run reports why and the loop carries on without a number.
      layer2: async () => {
        try {
          const l2 = await layer2Advisory(outputPath);
          log(`[layer2] advisory_score ${l2.advisory_score.toFixed(4)} (floor ${l2.threshold.toFixed(4)}), ${l2.frame_count} frames, ${l2.below_floor_count} below the floor, style_match ${l2.style_match} (clone frames ${l2.clone_frames}, reference ceiling ${l2.reference_ceiling.toFixed(4)}, best ${l2.candidate_max?.toFixed(4)}; references ${l2.reference_source})`);
          return l2;
        } catch (e) {
          logError(`[layer2] could not run: ${e.message}`);
          return { advisory_score: null, style_match: null, note: `layer 2 could not run: ${e.message}` };
        }
      },
      layer3: async ({ layer2Advisory: l2 }) => judge(outputPath, { channelId, layer2Advisory: l2?.advisory_score ?? null, styleMatch: l2?.style_match ?? null }),
      revise: async () => ({ planPatch: null }),
      renderBeats: async (indices, meta) => {
        if (mode === "dry") { wouldRerender.push(...indices); return; }
        throw new Error(`partial re-render of beats ${indices.join(",")} (${meta.reason}) is not expressible at this call site — a full re-render is not permitted`);
      },
      onEvent: (type, d) => log(`[eval-loop:${mode}] ${type} ${JSON.stringify(d)}`),
    });
  } catch (e) {
    // The loop is an addition; it must never be able to fail a render.
    logError(`[eval-loop:${mode}] could not run: ${e.message}`);
    result = { accepted: false, humanReview: true, error: e.message };
  }
  const decision = result?.accepted ? "accept" : result?.humanReview ? "human_review" : "retry";
  const l2 = result?.layer2 ?? result?.layer2_advisory ?? null;
  const auditPath = writeLoopAudit({
    channel: channelId, runId, mode, decision,
    retries_spent: result?.retries ?? 0,
    weak_beats: result?.events?.filter((e) => e.type === "layer3-fail") ?? [],
    would_rerender: wouldRerender, rendered: [],
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
  }, root ? { root } : undefined);
  log(`[eval-loop:${mode}] ${decision} (layer1 ${layer1Pass ? "pass" : "FAIL: " + failures.map((f) => f.check).join(",")}) — retries=${result?.retries ?? 0} audit=${auditPath}`);
  return { decision, auditPath, result, mode };
}
