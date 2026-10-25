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
 * EVAL_LOOP_MODE: off (default) | dry | live.
 *
 * `off` is the daily-cron default and must leave the pipeline byte-identical to
 * before this loop existed. `dry` runs the loop to a decision and records what
 * it WOULD do without touching the video. `live` acts.
 *
 * Reading the env var rather than a config field on purpose: turning a
 * decision-maker loose in production should be a one-word change at the call
 * site, and greppable in the workflow file.
 */
export const EVAL_LOOP_MODES = Object.freeze(["off", "dry", "live"]);

export function evalLoopMode(env = process.env) {
  const raw = String(env.EVAL_LOOP_MODE ?? "").trim().toLowerCase();
  if (raw === "") return "off";
  if (!EVAL_LOOP_MODES.includes(raw)) {
    throw new Error(`EVAL_LOOP_MODE="${env.EVAL_LOOP_MODE}" is not one of ${EVAL_LOOP_MODES.join(", ")}. Refusing to guess.`);
  }
  return raw;
}

export function loopEnabled(env = process.env) {
  return evalLoopMode(env) !== "off";
}

/**
 * Audit record for the loop's decision. Separate from the Layer 3 provenance in
 * data/audit/layer3/: that file records what the JUDGE saw, this records what
 * the LOOP decided to do about it.
 *
 * In dry mode `would_rerender` is populated and `rendered` stays empty — the
 * difference between the two is the whole point of the mode.
 */
export function writeLoopAudit({ channel, runId, mode, decision, weak_beats = [], retries_spent = 0, would_rerender = [], rendered = [], duration_ms, why = null, unresolved = [], layer1_result = null, layer2 = null, layer3 = null, shipped = null, revise = null }, { root = ROOT } = {}) {
  const dir = join(root, "data", "audit", "eval-loop", String(channel));
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${runId}.jsonl`);
  appendFileSync(path, JSON.stringify({
    ts: new Date().toISOString(), mode, decision, channel: String(channel), run_id: runId,
    layer1_result, layer2, layer3, shipped, revise,
    retries_spent, would_rerender, rendered, weak_beats, unresolved, why, duration_ms,
  }) + "\n");
  return path;
}

/**
 * Free-text finding -> pipeline field.
 *
 * Gemini reports in its own vocabulary. On the one real defect Layer 3 has found
 * (ch-02's white ground against a dark legal spec) it said "color palette" and
 * "visual style" — neither is a field, so both were unresolved and the loop was
 * inert on the only defect it has evidence for.
 *
 * So an `element: "other"` finding gets ONE keyword pass over this table. Rules
 * are deliberately few and each names the field it produces, because a long
 * table stops being a mapping and becomes a parser that will confidently
 * mis-route. A rule only fires when its keywords are present; a finding that
 * matches nothing, or matches two rules pointing at DIFFERENT fields, stays
 * unresolved. Ambiguity resolves to human review, never to a guess.
 *
 * ground is the field that matters most here: it is a real beat field, read by
 * renderedAs() through `canvas`, and it is what a white-versus-dark complaint is
 * actually about.
 */
export const FINDING_FIELD_MAP = Object.freeze([
  { field: "ground", keywords: ["background", "backdrop", "ground", "palette", "colour", "color", "white space", "whitespace", "aesthetic"] },
  { field: "headline", keywords: ["headline", "title", "heading", "typography hierarchy"] },
  { field: "lead_in", keywords: ["lead-in", "lead in", "kicker", "subhead", "sub-head"] },
  { field: "composition", keywords: ["composition", "layout", "balance", "spacing", "alignment"] },
  { field: "visual_type", keywords: ["chart", "graph", "map", "counter", "number", "diagram", "visual type"] },
  { field: "data", keywords: ["data", "figure", "value", "statistic", "number is wrong", "incorrect figure"] },
  { field: "motion_tier", keywords: ["motion", "timing", "pacing", "animation", "stutter"] },
]);

/**
 * Map one free-text finding to a field, or null.
 * Returns { field, via } on a confident single match, { ambiguous: [...] } when
 * two rules disagree, and null when nothing matches.
 */
export function mapFinding(finding) {
  const text = String(finding || "").toLowerCase();
  if (!text.trim()) return null;
  const hits = [];
  for (const rule of FINDING_FIELD_MAP) {
    if (rule.keywords.some((k) => text.includes(k))) hits.push(rule.field);
  }
  const distinct = [...new Set(hits)];
  if (distinct.length === 0) return null;
  if (distinct.length > 1) return { ambiguous: distinct };
  return { field: distinct[0] };
}

/**
 * Resolve Layer 3 weak beats into revisions.
 *
 * Direct field names route straight through. `element: "other"` gets one
 * keyword pass over FINDING_FIELD_MAP; a confident match routes to a retry, an
 * ambiguous or empty one stays unresolved — but the free-text `finding` is
 * always preserved, so a human reading provenance sees the observation even
 * when the loop cannot act on it.
 */
export function resolveRevisions(weakBeats, beats) {
  const revisions = [];
  const unresolved = [];
  for (const wb of weakBeats || []) {
    const beatIndex = Number.isInteger(wb.beat_index) ? wb.beat_index : null;
    const element = String(wb.element || "").trim();
    const finding = wb.finding || wb.reason || "";
    const base = { beat_index: beatIndex, axis: wb.axis || null, finding, reason: wb.reason || null };

    if (beatIndex === null || beatIndex < 0 || !beats || beats[beatIndex] === undefined) {
      unresolved.push({ ...wb, finding, why: `beat_index ${wb.beat_index} does not identify a beat in the plan` });
      continue;
    }

    let target = element;
    let via = null;
    if (!ADDRESSABLE_ELEMENTS.includes(element)) {
      const m = mapFinding(finding);
      if (m?.field) { target = m.field; via = "keyword-map"; }
      else if (m?.ambiguous) {
        unresolved.push({ ...base, why: `finding matches more than one field (${m.ambiguous.join(", ")}) — not guessed` });
        continue;
      } else {
        unresolved.push({ ...base, why: `element "${element || "(empty)"}" is not a field a beat renders from, and no keyword mapped the finding` });
        continue;
      }
    }

    if (!(target in beats[beatIndex])) {
      unresolved.push({ ...base, element: target, why: `beat ${beatIndex} has no "${target}" field to revise` });
      continue;
    }
    revisions.push({ ...base, element: target, via, current: beats[beatIndex][target] });
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
  recordOnLayer1Fail = false,
  // The reviser (scripts/eval-revise.js) decides what is revisable from the beat's facts, so with this
  // set a weak beat that has a beat_index reaches revise() even when no plan field matched its words.
  reviseWeakBeats = false,
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
      if (recordOnLayer1Fail) {
        // Record-only: Layer 1 has already decided (the caller rejects the video). Layers 2 and 3
        // still run ONCE so the judgement is on record, and nothing is retried or re-rendered.
        // Neither layer can fail this path — a layer that throws is recorded as not having run.
        const layer1_result = { pass: false, failures: failed };
        let l2 = {};
        try { l2 = (await layer2({ plan: current, attempt })) || {}; } catch (e) { l2 = { advisory_score: null, note: `layer 2 could not run: ${e.message}` }; }
        emit("layer2-advisory", { attempt, advisory_score: l2.advisory_score ?? null });
        let judged = null, l3Error = null;
        try { judged = await layer3({ plan: current, layer2Advisory: l2, attempt }); } catch (e) { l3Error = e.message; }
        const agg = Number(judged?.aggregate_local);
        if (Number.isFinite(agg)) {
          provenance.push(writeProvenance(runId, attempt, {
            ts: new Date().toISOString(), channel, attempt, aggregate_local: agg,
            axes: judged.axes || null, weak_beats: judged.weak_beats || [],
            layer2_advisory: l2.advisory_score ?? null, layer1_result,
          }));
          emit("layer3-recorded", { attempt, aggregate_local: agg });
        } else {
          emit("layer3-not-recorded", { attempt, why: l3Error || "no usable aggregate_local" });
        }
        const ids = failed.map((f) => f.check).filter(Boolean).join(", ") || "see the canvas-checks log";
        return {
          accepted: false, humanReview: true, layer1Failed: true, retries: 0,
          why: `layer 1 failed (${ids}); layers 2 and 3 recorded, not acted on`,
          layer1_result, layer2: l2, layer3: Number.isFinite(agg) ? { aggregate_local: agg, axes: judged.axes || null } : { error: l3Error || "no usable aggregate_local" },
          aggregate_local: Number.isFinite(agg) ? agg : undefined, axes: judged?.axes,
          events, unresolved, provenance, plan: current, layer2_advisory: l2,
        };
      }
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
    // What the judge said, carried on every return below so the audit record has the axes and
    // the beats it named (the nothing-revisable return used to drop the axes: CI run 37703727115).
    const l3 = { aggregate_local: aggregate, axes: judged?.axes || null, weak_beats: judged?.weak_beats || [] };
    if (!Number.isFinite(aggregate)) throw new Error(`layer3 returned no usable aggregate_local: ${JSON.stringify(judged).slice(0, 200)}`);
    provenance.push(writeProvenance(runId, attempt, {
      ts: new Date().toISOString(), channel, attempt, aggregate_local: aggregate,
      axes: judged.axes || null, weak_beats: judged.weak_beats || [],
      layer2_advisory: layer2Advisory.advisory_score ?? null, layer1_result: { pass: true, failures: [] },
    }));

    if (aggregate >= acceptThreshold) {
      emit("accept", { attempt, aggregate_local: aggregate });
      return { accepted: true, humanReview: false, retries: counter.retries, aggregate_local: aggregate, axes: judged.axes, events, unresolved, provenance, plan: current, layer2_advisory: layer2Advisory, layer3: l3 };
    }

    const { revisions, unresolved: unres } = resolveRevisions(judged.weak_beats, current.beats);
    unresolved.push(...unres);
    emit("layer3-fail", { attempt, aggregate_local: aggregate, revisions: revisions.length, unresolved: unres.length });

    // Unresolved elements attempted nothing, so they must not spend a retry.
    const indexed = (judged.weak_beats || []).some((w) => Number.isInteger(w?.beat_index) && !w.unresolved);
    if (!revisions.length && !(reviseWeakBeats && indexed)) {
      emit("nothing-revisable", { attempt });
      return { accepted: false, humanReview: true, why: `aggregate ${aggregate.toFixed(2)} below ${acceptThreshold} but no weak beat named a revisable element`, retries: counter.retries, aggregate_local: aggregate, events, unresolved, provenance, plan: current, layer2_advisory: layer2Advisory, layer3: l3 };
    }
    if (counter.retries + 1 > retryCap) {
      return { accepted: false, humanReview: true, why: `retry cap ${retryCap} reached at aggregate ${aggregate.toFixed(2)}`, retries: counter.retries, aggregate_local: aggregate, events, unresolved, provenance, plan: current, layer2_advisory: layer2Advisory, layer3: l3 };
    }

    // The planner returns a PARTIAL patch: the full plan with only the named
    // fields changed. It is applied as-is; the loop never re-plans a beat it
    // was not asked about.
    const patch = await revise(revisions, { plan: current, attempt, judged });
    if (!patch?.planPatch) {
      // An empty patch from the reviser is an answer, not a failure: no flagged beat has a visible
      // defect a legal layout change fixes, so the video ships as rendered.
      if (patch?.record) {
        emit("empty-patch", { attempt, reason: patch.record.reason });
        return { accepted: false, humanReview: false, shipsAsRendered: true, why: `empty patch: ${patch.record.reason}`, revise: patch.record, retries: counter.retries, aggregate_local: aggregate, events, unresolved, provenance, plan: current, layer2_advisory: layer2Advisory, layer3: l3 };
      }
      return { accepted: false, humanReview: true, why: "planner returned no partial plan patch; a full re-render is not permitted", retries: counter.retries, events, unresolved, provenance, plan: current, layer2_advisory: layer2Advisory, layer3: l3 };
    }
    current = patch.planPatch;
    const changedBeats = [...new Set((patch.changedBeats || revisions.map((r) => r.beat_index)))];
    if (patch.record) emit("revised", { attempt, beats: changedBeats, accepted: patch.record.accepted, rejected: patch.record.rejected });
    emit("partial-rerender", { attempt, beats: changedBeats });
    const rendered = await renderBeats(changedBeats, { reason: "layer3", attempt, planPatch: current });
    // Dry: the patch is decided and recorded; nothing is rendered, so there is nothing new to judge.
    if (rendered === "halt") return { accepted: false, humanReview: false, wouldRerender: changedBeats, why: `dry: would re-render beat(s) ${changedBeats.join(", ")}`, revise: patch.record ?? null, retries: counter.retries, aggregate_local: aggregate, events, unresolved, provenance, plan: current, layer2_advisory: layer2Advisory, layer3: l3 };
    counter.retries++;
  }
}

export { applyPartialPatch as _applyPartialPatch };