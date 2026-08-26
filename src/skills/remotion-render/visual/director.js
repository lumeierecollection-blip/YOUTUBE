/**
 * The visual director — "what should the viewer SEE?" (PART 5).
 *
 * PURE module, no model call (PART 24).
 *
 *   AUTHORED BEAT -> [ DIRECTOR ] -> VISUAL PLAN -> states.js -> SCENE
 *
 * THREE INPUT PATHS, IN STRICT PRIORITY ORDER (PART 13)
 *
 *   1. AUTHORED   beat.visual{} — the writer said what it means. Primary.
 *   2. DETERMINISTIC  semantics.js read the writer's full sentence + the
 *      gate-checked data. Secondary. This is what actually runs on every
 *      script in the repo today, since none carry beat.visual yet.
 *   3. EMERGENCY  nothing legible -> CINEMATIC_STATEMENT. Never an icon.
 *
 * The old 7-word-fragment classifier (beats.js classifyBeat) does not
 * appear in this chain at all. It still decides ARCHETYPE for unauthored
 * beats upstream, but it no longer decides what gets drawn — which was the
 * core PART 13 complaint.
 *
 * WHY ARCHETYPE IS AN INPUT AND NOT THE ANSWER
 *
 * `archetype: HERO_NUMBER` used to mean "draw a giant number". Here it is
 * demoted to one piece of evidence: it says a magnitude matters in this
 * beat, and the director's job is to find the CONCEPT that magnitude lives
 * inside (PART 6). Only if no concept can be found does the number become
 * the composition — and even then via SCALE_COMPARISON, which gives it
 * something to be big *against*, rather than a bare numeral.
 */

import { STRATEGIES, STRATEGY_PREFERENCE, TERMINAL_STRATEGY, getStrategy } from "./strategies.js";
import { analyzeBeat, seriesFrom, unitKind } from "./semantics.js";
import { grammarForChannel, grammarBias } from "./channel-grammar.js";

/** Minimum confidence a deterministic reading needs before it may render. */
const MIN_CONFIDENCE = 0.5;

/**
 * Archetype -> a small score nudge toward strategies that archetype is
 * evidence for. Never decisive on its own.
 */
const ARCHETYPE_AFFINITY = {
  HERO_NUMBER: { GEOSPATIAL_RADIUS: 0.1, ACCUMULATION: 0.1, SCALE_COMPARISON: 0.08, TRANSFORMATION: 0.06 },
  PROGRESS: { DATA_CHART: 0.16, TRANSFORMATION: 0.12, TIMELINE: 0.06 },
  CONTRAST: { COMPARISON: 0.16, BEFORE_AFTER: 0.14 },
  RELATION: { CAUSE_EFFECT: 0.16, RELATIONSHIP: 0.12 },
  TERM_DEFINE: { DOCUMENT_EVIDENCE: 0.12 },
  IMAGE_BEAT: { IMAGE_EVIDENCE: 0.3 },
  LIST_ITEM: {},
  STATEMENT: {},
};

/**
 * Does the strategy have what it needs to render honestly? Returns null
 * when satisfied, or a human-readable reason when not — that string is
 * what lands in the render report (PART 19), so it has to say something
 * an engineer can act on.
 */
function unmetNeed(strategy, payload, analysis, ctx) {
  const def = getStrategy(strategy);
  if (!def) return "strategy is not registered";
  const series = analysis.series;

  for (const need of def.dataNeeds || []) {
    switch (need) {
      case "value":
        if (!Number.isFinite(payload.value) && !analysis.numbers.length) return "no numeric value available";
        break;
      case "unit:distance": {
        const kind = payload.unit ? unitKind(payload.unit) : null;
        const anyDistance = analysis.numbers.some((n) => n.kind === "distance");
        if (kind !== "distance" && !anyDistance) return "no distance-unit value to draw a boundary with";
        break;
      }
      case "total":
        if (!Number.isFinite(payload.total)) return "no total value to accumulate toward";
        break;
      case "from":
        if (!Number.isFinite(payload.from)) return "no starting value to transform from";
        break;
      case "to":
        if (!Number.isFinite(payload.to)) return "no end value to transform to";
        break;
      case "series>=2":
        // A qualitative opposition ("X argued, but Y disagreed") is a real
        // two-sided comparison with no magnitudes to plot, so COMPARISON
        // can render it as opposed positions. DATA_CHART cannot: bars on a
        // zero-origin axis need actual values, and inventing them to fill
        // the axis is exactly the dishonesty ENC-06/ENC-08 exist to stop.
        if (strategy === "COMPARISON" && payload.qualitative && payload.left && payload.right) break;
        if (series.length < 2 && !(payload.pairs && payload.pairs.length >= 2)) {
          return `needs >=2 real series points${strategy === "COMPARISON" ? " or two opposed positions" : ""}, has ${series.length}`;
        }
        break;
      case "events>=2":
        if (!(payload.years && payload.years.length >= 1)) return "no dated events to place on an axis";
        break;
      case "stages>=2":
        if (!(payload.stages >= 2)) return "no stage count to lay out";
        break;
      case "nodes>=2":
        break; // RelationshipScene derives nodes from text; always satisfiable
      case "asset":
        if (!ctx.asset) return "no sourced image asset resolved for this section";
        break;
      default:
        break;
    }
  }
  return null;
}

/** Normalize a writer-authored visual block into an internal plan payload. */
function fromAuthored(beat, analysis, ctx) {
  const v = beat && beat.visual;
  if (!v || typeof v !== "object") return null;
  const strategy = String(v.strategy || "").toUpperCase().trim();
  if (!STRATEGIES[strategy]) {
    return {
      rejected: true,
      reason: `authored visual.strategy "${v.strategy}" is not a registered strategy`,
    };
  }

  const payload = {
    ...(v.data && typeof v.data === "object" ? v.data : {}),
    concept: v.concept || null,
    primaryHint: v.primary || null,
    secondary: Array.isArray(v.secondary) ? v.secondary : [],
    asset: v.asset || null,
  };
  // The writer may name the concept but leave the numbers to the data
  // block that the gates already check; fill from there.
  if (!Number.isFinite(payload.value) && analysis.numbers.length) payload.value = analysis.numbers[0].value;

  const unmet = unmetNeed(strategy, payload, analysis, ctx);
  if (unmet) return { rejected: true, reason: `authored ${strategy} unusable: ${unmet}`, strategy };
  return { strategy, payload };
}

/**
 * Evidence read from the surrounding section rather than the beat itself
 * is real but weaker — it may belong to a neighbouring sentence. Discount
 * it enough that any self-evident beat outranks it.
 */
const CONTEXT_PENALTY = 0.22;

/**
 * Variety pressure (PART 17 — "identical scene templates" is a named
 * defect). A channel grammar plus a broad detector can make one strategy
 * win every beat: on a real legal script, DOCUMENT_EVIDENCE took 5 of 8
 * beats, because almost every sentence in a legal video mentions a court,
 * a ruling or a law. The result reads as templated even though each frame
 * is individually correct.
 *
 * This mirrors the archetype anti-repetition rule the classifier already
 * had (no archetype more than twice consecutively), applied to strategies.
 * It only ever changes NEAR-TIES — a beat with strong evidence for a
 * strategy still gets it, however often it has just been used, because
 * rendering a worse-fitting visual for variety's sake would be the same
 * dishonesty in a different direction.
 */
const REPEAT_PENALTY = 0.14;
const RUN_PENALTY = 0.3;

function repeatPenalty(strategy, recent) {
  if (!recent || !recent.length) return 0;
  if (recent[0] === strategy && recent[1] === strategy) return -RUN_PENALTY;
  if (recent[0] === strategy) return -REPEAT_PENALTY;
  return 0;
}

/** Rank every deterministic reading and take the best that can render. */
function fromDeterministic(analysis, beat, ctx) {
  const grammar = ctx.grammar;
  const affinity = ARCHETYPE_AFFINITY[beat.archetype] || {};
  const recent = ctx.recent || [];
  const considered = [];

  for (const strategy of STRATEGY_PREFERENCE) {
    const signal = analysis.signals[strategy];
    if (!signal) continue;
    const base = Number(signal.confidence) || 0;
    const score =
      base + (affinity[strategy] || 0) + grammarBias(grammar, strategy) + repeatPenalty(strategy, recent);
    considered.push({ strategy, score, base, signal });
  }

  // Section-context readings, for beats whose own words carry nothing —
  // overwhelmingly the fragment-classifier beats on legacy scripts that
  // predate authored beats[] entirely.
  if (analysis.contextSignals) {
    for (const strategy of STRATEGY_PREFERENCE) {
      const signal = analysis.contextSignals[strategy];
      if (!signal) continue;
      if (considered.some((c) => c.strategy === strategy)) continue;
      const base = (Number(signal.confidence) || 0) - CONTEXT_PENALTY;
      const score =
        base + (affinity[strategy] || 0) + grammarBias(grammar, strategy) + repeatPenalty(strategy, recent);
      considered.push({ strategy, score, base, signal, fromContext: true });
    }
  }

  // IMAGE_EVIDENCE has no text detector — it is decided by whether a real
  // sourced asset exists for this section, which is a fact, not a reading.
  if (ctx.asset) {
    considered.push({
      strategy: "IMAGE_EVIDENCE",
      score: 0.55 + (affinity.IMAGE_EVIDENCE || 0) + grammarBias(grammar, "IMAGE_EVIDENCE"),
      base: 0.55,
      signal: { confidence: 0.55 },
    });
  }

  considered.sort((a, b) => b.score - a.score);

  const rejected = [];
  for (const cand of considered) {
    if (cand.score < MIN_CONFIDENCE) {
      rejected.push({ strategy: cand.strategy, reason: `confidence ${cand.score.toFixed(2)} below ${MIN_CONFIDENCE}` });
      continue;
    }
    const payload = { ...cand.signal, asset: ctx.asset || null };
    const unmet = unmetNeed(cand.strategy, payload, analysis, ctx);
    if (unmet) {
      rejected.push({ strategy: cand.strategy, reason: unmet });
      continue;
    }
    return { strategy: cand.strategy, payload, score: cand.score, fromContext: !!cand.fromContext, rejected };
  }
  return { strategy: null, rejected };
}

/**
 * Build the supporting figures a scene puts on screen. Numbers stay
 * SUBORDINATE (PART 6): this is what a scene renders as a label inside its
 * own composition, never as the composition.
 */
function buildSupporting(strategy, payload, analysis, beat) {
  const unit = payload.unit || (beat.data && beat.data.unit) || "";
  const supporting = { unit };

  switch (strategy) {
    case "GEOSPATIAL_RADIUS":
      supporting.value = payload.value;
      supporting.label = `${payload.value}${/^m$|met/i.test(unit) ? "m" : ` ${unit}`}`.trim().toUpperCase();
      supporting.subjects = payload.subjects || null;
      break;
    case "ACCUMULATION":
      supporting.total = payload.total;
      // countKnown separates "the script said twenty purchases" from "the
      // script said many small purchases". The scene draws a plausible
      // quantity either way, but only LABELS a count when one was stated.
      supporting.countKnown = Number.isFinite(payload.count) && payload.count >= 2;
      supporting.count = supporting.countKnown
        ? payload.count
        : Math.min(14, Math.max(6, Math.round((payload.total || 60) / 45)));
      supporting.unit = payload.totalUnit || unit;
      break;
    case "TRANSFORMATION":
      supporting.from = payload.from;
      supporting.to = payload.to;
      supporting.labels = payload.labels || null;
      break;
    case "DATA_CHART":
      supporting.series = (analysis.series.length ? analysis.series : payload.pairs || []).slice(0, 5);
      break;
    case "COMPARISON":
      supporting.series = (analysis.series.length ? analysis.series : payload.pairs || []).slice(0, 5);
      // Two opposed positions rather than two magnitudes — the scene
      // switches register on this.
      if (payload.qualitative) {
        supporting.qualitative = true;
        supporting.left = payload.left;
        supporting.right = payload.right;
        supporting.pivot = payload.pivot;
      }
      break;
    case "TIMELINE":
      supporting.years = payload.years || [];
      break;
    case "PROCESS":
      supporting.stages = payload.stages || 3;
      break;
    case "CAUSE_EFFECT":
      supporting.cause = payload.cause || "";
      supporting.effect = payload.effect || "";
      supporting.marker = payload.marker || "";
      break;
    case "SCALE_COMPARISON":
      supporting.value = Number.isFinite(payload.value)
        ? payload.value
        : analysis.numbers.length
          ? analysis.numbers[0].value
          : null;
      break;
    default:
      if (analysis.numbers.length) supporting.value = analysis.numbers[0].value;
      break;
  }
  return supporting;
}

/**
 * plan a single beat.
 *
 * ctx: { channel, asset, sectionIndex }
 * returns a VisualPlan consumed by states.js and the scene router.
 */
export function planVisual(beat, ctx = {}) {
  const grammar = grammarForChannel(ctx.channel);
  const analysis = analyzeBeat(beat, { context: ctx.sectionText || "" });
  const fallbacks = [];
  const inner = { ...ctx, grammar };

  // ── 1. authored ────────────────────────────────────────────────────────
  const authored = fromAuthored(beat, analysis, inner);
  if (authored && !authored.rejected) {
    return finalize(authored.strategy, authored.payload, analysis, beat, inner, "authored", fallbacks);
  }
  if (authored && authored.rejected) {
    fallbacks.push({ from: authored.strategy || "authored", to: "deterministic", reason: authored.reason });
  }

  // ── 2. deterministic ───────────────────────────────────────────────────
  const det = fromDeterministic(analysis, beat, inner);
  if (det.strategy) {
    const plan = finalize(det.strategy, det.payload, analysis, beat, inner, "deterministic", fallbacks, det.rejected);
    // Surfaced in the render report so a low-evidence video is visible as
    // low-evidence rather than looking identical to a well-grounded one.
    plan.fromSectionContext = !!det.fromContext;
    return plan;
  }

  // ── 3. emergency ───────────────────────────────────────────────────────
  const why = det.rejected && det.rejected.length
    ? det.rejected.slice(0, 3).map((r) => `${r.strategy}: ${r.reason}`).join("; ")
    : "no visual signal in the beat text, data or assets";
  fallbacks.push({ from: "deterministic", to: TERMINAL_STRATEGY, reason: why });
  return finalize(TERMINAL_STRATEGY, {}, analysis, beat, inner, "emergency", fallbacks, det.rejected);
}

function finalize(strategy, payload, analysis, beat, ctx, provenance, fallbacks, rejected = []) {
  const def = getStrategy(strategy);
  const supporting = buildSupporting(strategy, payload, analysis, beat);

  // PART 8 — an icon is NEVER the hero. A strategy may declare that a small
  // glyph genuinely helps inside its composition (a map marker, UI chrome);
  // anything else gets "none". The scene decides whether to use it at all.
  const iconRole = def.iconRole === "secondary" ? "secondary" : "none";

  return {
    strategy,
    provenance, // "authored" | "deterministic" | "emergency"
    concept: payload.concept || def.intent,
    supporting,
    payload,
    iconRole,
    // Diagnostics carry the road not taken, so the render report can say
    // WHY a beat looks the way it does (PART 19).
    fallbacks,
    considered: (rejected || []).slice(0, 4),
    archetype: beat.archetype,
    text: analysis.text,
  };
}

/**
 * Convenience for tests and diagnostics: plan a whole beat array.
 */
export function planAll(beats, ctx = {}) {
  return beats.map((b) =>
    planVisual(b, { ...ctx, asset: ctx.assetForSection ? ctx.assetForSection(b.sectionIndex) : ctx.asset })
  );
}
