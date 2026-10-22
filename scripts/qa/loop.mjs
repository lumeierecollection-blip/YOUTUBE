// Render -> inspect -> repair controller. Pure: render/inspect/repair/now/log are injected.
//   render(attempt)            -> ctx (anything; passed to inspect and repair)
//   inspect(ctx, attempt)      -> defects[] (scripts/qa/defects.mjs shape)
//   repair(defects, ctx, n)    -> { changed: boolean, cost?: number }
//   revert(bestAttempt)        -> optional; called once at the end if the best attempt is not the last render
// Stops: pass (no blocker/major) | unresolved (repair changed nothing) | budget-exhausted | no-progress (same blocker/major set twice).
const bad = (defects) => defects.filter((d) => d.severity === "blocker" || d.severity === "major");
const key = (d) => `${d.check}|${d.scene_id ?? ""}|${d.beat_index ?? ""}`;
const sigOf = (defects) => bad(defects).map(key).sort().join(";");
const sceneOf = (d) => `${d.scene_id ?? ""}|${d.beat_index ?? ""}`;
const score = (defects) => [defects.filter((d) => d.severity === "blocker").length, bad(defects).length];
const better = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

export async function runQaLoop({ render, inspect, repair, revert = null, budgets = {}, now = Date.now, log = () => {} }) {
  const { maxAttempts = 3, maxMs = Infinity, maxCostUnits = Infinity } = budgets;
  const t0 = now();
  const attempts = [];
  let cost = 0, best = null, status = null;

  for (let n = 1; ; n++) {
    const a0 = now();
    const ctx = await render(n);
    const defects = await inspect(ctx, n);
    const rec = { attempt: n, defects, repairs: null, duration_ms: 0, cost: 0, regressions: [] };
    attempts.push(rec);

    const prev = attempts[n - 2];
    if (prev) {
      const hadBlocker = new Set(prev.defects.filter((d) => d.severity === "blocker").map(sceneOf));
      const prevScenes = new Set(prev.defects.map(sceneOf));
      rec.regressions = defects.filter((d) => d.severity === "blocker" && !hadBlocker.has(sceneOf(d)) && !prevScenes.has(sceneOf(d))).map(key);
    }
    const sc = score(defects);
    if (!best || better(sc, best.score)) best = { attempt: n, score: sc, defects };

    const finish = (s) => { rec.duration_ms = now() - a0; status = s; };
    if (!bad(defects).length) { finish("pass"); log(`[qa-loop] attempt ${n}: pass`); break; }
    if (prev && sigOf(prev.defects) === sigOf(defects)) { finish("no-progress"); log(`[qa-loop] attempt ${n}: same defect set as attempt ${n - 1}`); break; }
    if (n >= maxAttempts || now() - t0 >= maxMs || cost >= maxCostUnits) { finish("budget-exhausted"); log(`[qa-loop] attempt ${n}: budget exhausted`); break; }

    const r = (await repair(defects, ctx, n)) || { changed: false };
    rec.repairs = r;
    rec.cost = r.cost || 0;
    cost += rec.cost;
    rec.duration_ms = now() - a0;
    log(`[qa-loop] attempt ${n}: ${bad(defects).length} blocker/major, repair changed=${!!r.changed} cost=${rec.cost}`);
    if (!r.changed) { status = "unresolved"; break; }
  }

  const last = attempts[attempts.length - 1].attempt;
  const reverted = best.attempt !== last;
  if (reverted && revert) await revert(best.attempt);
  return {
    status,
    best_attempt: best.attempt,
    reverted_to_best: reverted,
    attempts,
    total_ms: now() - t0,
    total_cost: cost,
    unresolved: bad(best.defects),
  };
}
