#!/usr/bin/env node
/**
 * eval-retry-loop.js — the wiring across Layer 1, Layer 2 and Layer 3.
 *
 * Flow:
 *   render
 *     -> layer1   pass/fail. fail -> re-render the failed element, then layer1 again.
 *     -> layer2   advisory score only. NEVER gates, NEVER increments the counter.
 *     -> layer3   aggregate_local >= ACCEPT -> accept
 *                 aggregate_local <  ACCEPT -> partial retry of the named elements
 *     cap 3 retries, then human review, fail loud.
 *
 * ── Why Layer 2 sits where it sits ──────────────────────────────────────
 *
 * Layer 2 is an advisory because measurement said it has to be. A blank frame
 * scores 0.68-0.81 against the reference family versus a 0.4570 floor, so any
 * threshold permissive enough to allow style variation also passes a blank
 * frame. If it counted as a gate it would either never fire or fire on
 * everything. So it reports a number, that number goes into Layer 3's prompt,
 * and it never touches the retry counter — otherwise every render would spend a
 * retry on a signal that cannot mean anything.
 *
 * ── Why partial only ────────────────────────────────────────────────────
 *
 * A retry re-renders the beats Layer 3 named, element by element, and returns
 * the rest of the plan untouched. Full re-render is not permitted: it discards
 * the beats that already passed, and the evidence for why that matters is in
 * render-and-qa.js:1736 - a whole re-plan fixed the rejected beats and
 * rewrote beats that had passed (run 36416582506: ch-1 beat 0 then beat 4;
 * ch-44 beat 5 then beat 9).
 *
 * An element outside ADDRESSABLE_ELEMENTS cannot be revised: it names something
 * no beat renders from, so "revising" it would produce a byte-identical render
 * while reporting a retry. Those are recorded unresolved and do NOT consume a
 * retry, because nothing was attempted.
 *
 * Every dependency is injected so the whole loop is testable offline.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ADDRESSABLE_ELEMENTS } from "./beat-element-remediation.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const ACCEPT_THRESHOLD = 7.0;
export const RETRY_CAP = 3;

/**
 * The element vocabulary a partial re-render may address.
 *
 * Sourced from renderedAs() in render-and-qa.js — the fields a beat actually
 * renders from — rather than from Layer 3's own vocabulary. Layer 3 names what
 * looks wrong ("color palette", "visual style"), which is frequently NOT a
 * field: those become unresolved, deliberately.
 */
export function resolveRevisions(weakBeats, beats) {
  const revisions = [];
  const unresolved = [];
  for (const wb of weakBeats || []) {
    const beatIndex = Number.isInteger(wb.beat_index) ? wb.beat_index : null;
    const element = String(wb.element || "").trim();
    if (!ADDRESSABLE_ELEMENTS.includes(element)) {
      unresolved.push({ ...wb, why: `element "${element || "(empty)"}" is not a field a beat renders from` });
      continue;
    }
    if (beatIndex === null || beatIndex < 0 || !beats || beats[beatIndex] === undefined) {
      unresolved.push({ ...wb, why: `beat_index ${wb.beat_index} does not identify a beat in the plan` });
      continue;
    }
    if (!(element in beats[beatIndex])) {
      unresolved.push({ ...wb, why: `beat ${beatIndex} has no "${element}" field to revise` });
      continue;
    }
    revisions.push({ beat_index: beatIndex, element, current: beats[beatIndex][element], axis: wb.axis || null, reason: wb.reason || null });
  }
  return { revisions, unresolved };
}

/**
 * Apply revisions to a plan, touching ONLY the named fields.
 * Returns a new plan plus the beat indices actually changed, so a caller can
 * re-render those beats and prove the others are byte-identical.
 */
export function applyPartialPatch(plan, revisions, replacementFor) {
  const next = structuredClone(plan);
  const changedBeats = [];
  for (const r of revisions) {
    const b = next.beats[r.beat_index];
    if (!b) continue;
    const replacement = replacementFor(r);
    if (replacement === undefined || replacement === null) continue;
    if (JSON.stringify(b[r.element]) === JSON.stringify(replacement)) continue;
    b[r.element] = replacement;
    if (!changedBeats.includes(r.beat_index)) changedBeats.push(r.beat_index);
  }
  return { plan: next, changedBeats };
}

/** Unchanged beats must come back byte-identical. */
export function beatsUnchanged(before, after, except) {
  const exceptSet = new Set(except || []);
  for (let i = 0; i < (before.beats || []).length; i++) {
    if (exceptSet.has(i)) continue;
    if (JSON.stringify(before.beats[i]) !== JSON.stringify(after.beats[i])) return { ok: false, beat: i };
  }
  return { ok: true };
}

function writeProvenance(runId, attempt, record) {
  const dir = join(ROOT, "data", "audit", "layer3", String(record.channel));
  mkdirSync(dir, { recursive: true });
  const p = join(dir, `${runId}.jsonl`);
  appendFileSync(p, JSON.stringify({ retry_attempt: attempt, parent_run_id: runId, ...record }) + "\n");
  return p;
}

/**
 * Run the loop.
 *
 * layer1({plan})            -> { pass, failures }
 * layer2({plan, attempt})   -> { advisory_score, ... }   advisory only
 * layer3({plan, advisory})  -> { axes, aggregate_local, weak_beats, ... }
 * revise(revisions)         -> [{ beat_index, element, replacement }]
 * renderBeats(indices)      -> re-renders only those beats
 */
export async function runEvalLoop({
  plan, runId, channel,
  layer1, layer2, layer3, revise, renderBeats,
  acceptThreshold = ACCEPT_THRESHOLD, retryCap = RETRY_CAP,
  onEvent = () => {},
} = {}) {
  const counter = { retries: 0 };
  const unresolved = [];
  const provenance = [];
  let current = plan;
  let layer2Advisory = null;
  const events = [];

  const emit = (type, detail) => { events.push({ type, ...detail }); onEvent(type, detail); };

  for (let attempt = 0; ; attempt++) {
    const l1 = await layer1({ plan: current, attempt });
    if (!l1.pass) {
      const failed = l1.failures || [];
      emit("layer1-fail", { attempt, failures: failed.length });
      const indices = [...new Set(failed.map((f) => f.beat).filter((b) => Number.isInteger(b)))];
      await renderBeats(indices, { reason: "layer1", attempt });
      if (++counter.retries > retryCap) {
        return { accepted: false, humanReview: true, why: `layer1 still failing after ${retryCap} retries`, retries: counter.retries, events, unresolved, provenance, plan: current, layer2_advisory: layer2Advisory };
      }
      continue;
    }

    layer2Advisory = (await layer2({ plan: current, attempt })) || {};
    emit("layer2-advisory", { attempt, advisory_score: layer2Advisory.advisory_score ?? null });

    const judged = await layer3({ plan: current, layer2Advisory, attempt });
    const aggregate = Number(judged?.aggregate_local);
    if (!Number.isFinite(aggregate)) throw new Error(`layer3 returned no usable aggregate_local: ${JSON.stringify(judged).slice(0, 200)}`);
    provenance.push(writeProvenance(runId, attempt, {
      ts: new Date().toISOString(), channel, attempt, aggregate_local: aggregate,
      axes: judged.axes || null, weak_beats: judged.weak_beats || [],
      layer2_advisory: layer2Advisory.advisory_score ?? null,
    }));

    if (aggregate >= acceptThreshold) {
      emit("accept", { attempt, aggregate_local: aggregate });
      return { accepted: true, humanReview: false, retries: counter.retries, aggregate_local: aggregate, axes: judged.axes, events, unresolved, provenance, plan: current, layer2_advisory: layer2Advisory };
    }

    const { revisions, unresolved: unres } = resolveRevisions(judged.weak_beats, current.beats);
    unresolved.push(...unres);
    emit("layer3-fail", { attempt, aggregate_local: aggregate, revisions: revisions.length, unresolved: unres.length });

    // Unresolved elements attempted nothing, so they must not spend a retry.
    if (!revisions.length) {
      emit("nothing-revisable", { attempt });
      return { accepted: false, humanReview: true, why: `aggregate ${aggregate.toFixed(2)} below ${acceptThreshold} but no weak beat named a revisable element`, retries: counter.retries, aggregate_local: aggregate, events, unresolved, provenance, plan: current, layer2_advisory: layer2Advisory };
    }
    if (counter.retries + 1 > retryCap) {
      return { accepted: false, humanReview: true, why: `retry cap ${retryCap} reached at aggregate ${aggregate.toFixed(2)}`, retries: counter.retries, aggregate_local: aggregate, events, unresolved, provenance, plan: current, layer2_advisory: layer2Advisory };
    }

    // The planner returns a PARTIAL patch: the full plan with only the named
    // fields changed. It is applied as-is; the loop never re-plans a beat it
    // was not asked about.
    const patch = await revise(revisions, { plan: current, attempt });
    if (!patch?.planPatch) {
      return { accepted: false, humanReview: true, why: "planner returned no partial plan patch; a full re-render is not permitted", retries: counter.retries, events, unresolved, provenance, plan: current, layer2_advisory: layer2Advisory };
    }
    current = patch.planPatch;
    const changedBeats = [...new Set((patch.changedBeats || revisions.map((r) => r.beat_index)))];
    emit("partial-rerender", { attempt, beats: changedBeats });
    await renderBeats(changedBeats, { reason: "layer3", attempt });
    counter.retries++;
  }
}

export { applyPartialPatch as _applyPartialPatch };