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
import { analyzeBeat, seriesFrom, unitKind, extractNumbers } from "./semantics.js";
import { grammarForChannel, grammarBias } from "./channel-grammar.js";
import { subjectPhrase, clausePhrase, entityLabels, predicatePhrase, completeClause, bestClause, clauses, wordsIn, MAX_SUPPORTING_WORDS } from "./text-budget.js";
import { composeShot } from "./composition.js";

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
    case "DATA_CHART": {
      const points = (analysis.series.length ? analysis.series : payload.pairs || []).slice(0, 5);
      // WHICH BAR THE SENTENCE IS ABOUT.
      //
      // The scene fell back to `Math.max(findIndex(s => s.highlight), 0)`,
      // so when the script did not flag a point — which is every script,
      // because nothing in this pipeline sets `highlight` — it emphasised
      // the FIRST bar. On a real fixture reading "forty in the north, sixty
      // five in the south, thirty in the east and ninety in the west" with
      // an anchor token of "ninety", it picked out NORTH=40.
      //
      // The anchor token is the word the narration actually leans on, so
      // the bar it names is the bar to emphasise. Matched by VALUE (the
      // token is usually the number) and then by LABEL. Nothing is
      // invented: if neither matches, no bar is flagged and the scene
      // emphasises none rather than guessing.
      const token = String(beat.anchor_token || "").toLowerCase();
      if (token && points.length && !points.some((p) => p.highlight)) {
        // extractNumbers already composes spelled-out numerals ("ninety",
        // "five hundred and forty"), which is how a script written to be
        // read aloud states a figure. Reusing it beats writing a second,
        // weaker parser here — that duplication is what put "5" and "100"
        // on screen for "five hundred dollars" once already.
        const tokenValues = new Set(extractNumbers(token).map((n) => n.value));
        const named = points.findIndex(
          (p) => tokenValues.has(Number(p.value)) || (p.label && token.includes(String(p.label).toLowerCase()))
        );
        if (named >= 0) points[named] = { ...points[named], highlight: true };
      }
      supporting.series = points;
      break;
    }
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
      // What actually happened at the end of the span. Two bare years on an
      // axis date an event the picture never names; this is that event, in
      // the script's own words.
      supporting.event = (() => {
        const src = analysis.context || analysis.text;
        const cl = clauses(src);
        return predicatePhrase(cl.length > 1 ? cl[cl.length - 1] : src, 3);
      })();
      break;
    case "PROCESS":
      supporting.stages = payload.stages || 3;
      // The thing that MOVES through the stages. Naming the travelling
      // object is what separates "a sequence of three anonymous boxes" from
      // a process with a subject; the stages themselves stay numbered,
      // since the narration rarely names them and inventing names for them
      // would be inventing content.
      // Sentence, not fragment — on a fragment this returned "EVERY",
      // "THREE", "SEPARATE", i.e. whichever word the chunk happened to
      // start on.
      supporting.subject = subjectPhrase(analysis.context || analysis.text, 1);
      break;
    case "INTERFACE_SIMULATION":
      // What is being operated on, for the query field. Without it the
      // field can only show a generic "QUERY" placeholder, which is the
      // same greeked-content problem in smaller form.
      supporting.subject = subjectPhrase(analysis.context || analysis.text, 1);
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

/**
 * A stable per-beat number the scenes use to pick a COMPOSITION VARIANT.
 *
 * PART 13 / PART 30. A strategy firing twice in one video drew a
 * pixel-identical composition both times — on a real legal script
 * DOCUMENT_EVIDENCE took three beats and the viewer saw the same page, the
 * same ruled lines and the same highlighted clause three times.
 *
 * It lives HERE, on the plan, rather than only inside the JSX, for two
 * reasons: the render report can then say which variant each beat got (so
 * "the video is templated" is a number, not an impression), and node tests
 * can check the distribution without importing .jsx.
 *
 * DETERMINISTIC — hashed from the beat's own identity. Re-rendering a
 * script must produce a byte-identical video, so there is no Math.random
 * anywhere in this path.
 */
export function variantSeed(beat) {
  const key = `${beat && beat.startFrame}|${(beat && (beat.anchorToken || beat.text)) || ""}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/**
 * The one short phrase a scene may print, per strategy.
 *
 * Most strategies return nothing: a chart with a dimension on it, a
 * boundary with a measurement, a process with numbered stages — none of
 * them need a sentence, and the budget's normal answer is zero words.
 */
function supportingPhraseFor(strategy, payload, analysis, beat) {
  switch (strategy) {
    case "VISUAL_METAPHOR":
      // Names the thing the field is acting on.
      return subjectPhrase(analysis.text, 3);
    case "CINEMATIC_STATEMENT": {
      // The writer's own on-screen label if they gave a short one, since
      // that is a deliberate authored choice; otherwise the beat's
      // strongest content words.
      const authored = beat.authoredText && String(beat.authoredText).trim();
      if (authored && authored.length <= 28) return authored.toUpperCase();
      // This strategy exists to put a statement on screen, so unlike the
      // others it may not return nothing — but it must not return word
      // salad either. subjectPhrase gave "FIVE HUNDRED DOLLARS END" and
      // "REST SPLIT EVERYONE" on the fixtures. Verbatim: a whole clause if
      // one fits, otherwise the strongest one trimmed.
      // The SECTION sentence, not the beat fragment: beats are ~7-word
      // chunks, so analysis.text routinely starts mid-clause and the label
      // came out as "BANK AND THE EXCHANGE ALL DEPEND…".
      const src = analysis.context || analysis.text;
      // The full 8-word budget here, not 6: this strategy's whole job is to
      // put a statement on screen, and a clause that fits WHOLE at 8 beats a
      // tidier one truncated at 6 ("TWENTY SMALL PURCHASES QUIETLY BECAME
      // FIVE…"). Ellipsis only when no clause fits at all.
      return completeClause(src, MAX_SUPPORTING_WORDS) || bestClause(src, MAX_SUPPORTING_WORDS).toUpperCase();
    }
    case "DOCUMENT_EVIDENCE":
      // A QUOTATION, so the wording is kept verbatim and only the length is
      // capped — this used to run to ten words, which is a subtitle.
      return clausePhrase(analysis.text, 7);

    /**
     * THESE THREE USED TO RETURN "" — and that is why their frames were
     * empty.
     *
     * The old comment here read "a process with numbered stages needs no
     * sentence, and the budget's normal answer is zero words". Measured on
     * rendered anchor frames, the answer that produced was: PROCESS drew
     * three anonymous boxes labelled "1" "2" "3" at 2.7% ink, TIMELINE drew
     * two flags labelled only with years, and INTERFACE_SIMULATION drew
     * greeked grey bars where text should be. Nothing on screen said what
     * the line was ABOUT, so the picture could not carry meaning and the
     * narration had to — which is the "animated transcript" failure the
     * caption default was turned off to avoid, arrived at from the other
     * side.
     *
     * One phrase, from the script's own words, inside the same 8-word
     * budget everything else obeys. It is the verb of the line, not its
     * subject (see predicatePhrase), because the verb is the claim.
     */
    case "PROCESS":
    case "TIMELINE":
    case "INTERFACE_SIMULATION": {
      /**
       * FROM THE SECTION SENTENCE, NOT THE BEAT FRAGMENT.
       *
       * Beats are ~7-word chunks of a spoken line (compositions/beats.js
       * chunkTextClauseAware), so `analysis.text` here is routinely half a
       * clause: "separate stages, and a failure at any". Extracting a label
       * from that produces word salad — "EVERY REQUEST SYSTEM", "UNTIL 2015
       * WHEN" — which is worse on screen than no label at all. The sentence
       * the fragment came from is what the viewer is actually hearing, and
       * it is already on the plan as `context`.
       */
      const source = analysis.context || analysis.text;
      const cl = clauses(source);
      // The operative clause is usually the last one ("X runs this way,
      // and THEN A FAILURE STOPS IT"); fall back to the whole line.
      const operative = cl.length > 1 ? cl[cl.length - 1] : source;
      // predicate first (the claim), then a clause that fits WHOLE, then
      // nothing. Never subjectPhrase here: stripping stopwords out of a
      // narration line yields "PURCHASES NEVER PROBLEM" — checked against
      // the finance and strategies fixtures before this changed. A scene
      // with no printable phrase draws none; these three all carry their
      // own labels regardless.
      return predicatePhrase(operative, 4) || completeClause(source, 6);
    }
    default:
      return "";
  }
}

function finalize(strategy, payload, analysis, beat, ctx, provenance, fallbacks, rejected = []) {
  const def = getStrategy(strategy);
  const supporting = buildSupporting(strategy, payload, analysis, beat);

  // The exact text the scene will draw, decided HERE so it can be counted.
  // Three scene files used to extract this themselves with three different
  // limits (3, 3 and ten words), and nothing outside the JSX could see the
  // result — so "the picture is printing the narration" was unmeasurable.
  // See visual/text-budget.js.
  supporting.phrase = supportingPhraseFor(strategy, payload, analysis, beat);
  if (strategy === "RELATIONSHIP") supporting.labels = entityLabels(analysis.text, 5);
  if (strategy === "COMPARISON" && supporting.qualitative) {
    // Two opposed positions, one per panel. Four words each: the scene used
    // to take eight from each side, which is sixteen words on screen — a
    // sentence broken across two boxes, not two labels.
    supporting.leftPhrase = subjectPhrase(supporting.left, 4);
    supporting.rightPhrase = subjectPhrase(supporting.right, 4);
  }
  supporting.words =
    wordsIn(supporting.phrase) +
    wordsIn(supporting.labels) +
    wordsIn(supporting.leftPhrase) +
    wordsIn(supporting.rightPhrase) +
    // Counted like every other drawn string: these are new (TIMELINE's
    // event, PROCESS's travelling subject) and a budget that silently
    // ignored them would be measuring the wrong picture.
    wordsIn(supporting.event) +
    wordsIn(supporting.subject);

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
    // Which composition variant the scene should draw, and how many the
    // scene declares it has. mg-package.js overwrites `variant` with an
    // ordinal once it can see all the beats; this hash is the value a plan
    // built in isolation (a single-beat clip render, a test) gets.
    variant: variantSeed(beat),
    variantCount: def.variants || 1,
  };
}

/**
 * Attach the art-direction shot to a plan.
 *
 * Separate from finalize() because the SHOT depends on the variant ordinal,
 * and only mg-package.js knows that — it is assigned across a strategy's
 * uses in one video. Calling this after the ordinal is set is what lets the
 * second COMPARISON in a script be framed differently from the first.
 */
export function attachShot(plan) {
  if (!plan || !plan.strategy) return plan;
  plan.shot = composeShot(plan.strategy, plan);
  return plan;
}
