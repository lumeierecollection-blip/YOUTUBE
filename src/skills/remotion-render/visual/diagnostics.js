/**
 * Visual QA metrics and warnings (PART 19 / PART 20).
 *
 * PURE module — every metric here is computed from the built package, with
 * no model call and no frame rendering. That matters: these numbers are
 * cheap enough to produce on every render, so a regression shows up in the
 * run that caused it rather than in a later audit.
 *
 * WHAT THESE ARE FOR
 *
 * The honest failure mode of a change like this is a renderer that LOOKS
 * rebuilt while most beats quietly still fall to the terminal fallback.
 * `statementRatio` and `genericFallbackRatio` are the two numbers that
 * make that impossible to hide, and `fallbackReasons` says exactly why
 * each one happened rather than leaving it to be guessed at.
 */

import { TERMINAL_STRATEGY } from "./strategies.js";
import { MAX_SUPPORTING_WORDS } from "./text-budget.js";

const FPS = 30;

/** A visual held with no state change longer than this reads as a stall. */
export const STATIC_WARN_FRAMES = 5 * FPS;

export function summarizeVisuals(beats, opts = {}) {
  const fps = opts.fps || FPS;
  const staged = (beats || []).filter((b) => b.archetype !== "LIST_ITEM");
  const planned = staged.filter((b) => b.visualPlan);
  const n = staged.length || 1;

  const byStrategy = {};
  const byProvenance = { authored: 0, deterministic: 0, emergency: 0 };
  const fallbackReasons = [];
  let iconHero = 0;
  let iconSecondary = 0;
  let visualStateCount = 0;
  let longestStatic = 0;
  let contextDerived = 0;
  let supportingWords = 0;
  let maxBeatWords = 0;
  let wordlessBeats = 0;

  for (const b of staged) {
    const plan = b.visualPlan;
    if (!plan) continue;
    byStrategy[plan.strategy] = (byStrategy[plan.strategy] || 0) + 1;
    if (plan.provenance in byProvenance) byProvenance[plan.provenance] += 1;
    if (plan.fromSectionContext) contextDerived += 1;

    for (const f of plan.fallbacks || []) {
      fallbackReasons.push({
        beat: (b.text || "").slice(0, 60),
        from: f.from,
        to: f.to,
        reason: f.reason,
      });
    }

    // PART 8 — an icon must never BE the visual. scene.iconRole is the
    // machine-checkable statement of that.
    const role = (b.scene && b.scene.iconRole) || "none";
    if (role === "secondary") iconSecondary += 1;
    // A beat that carries an icon but no plan is, by definition, the old
    // icon-hero path still being reachable.
    if (b.scene && b.scene.icon && role !== "secondary") iconHero += 1;

    // PART 6 — how many words this beat prints on screen. Narration lives
    // in the audio; supporting text is a label, not a subtitle.
    const words = (plan.supporting && plan.supporting.words) || 0;
    supportingWords += words;
    maxBeatWords = Math.max(maxBeatWords, words);
    if (words === 0) wordlessBeats += 1;

    const states = b.visualStates || [];
    visualStateCount += states.length;
    for (const s of states) longestStatic = Math.max(longestStatic, s.durationInFrames);
  }

  // Unplanned staged beats fall to the legacy archetype switch, whose
  // default IS the icon statement — count them as icon-hero risk.
  for (const b of staged) {
    if (!b.visualPlan && b.scene && b.scene.icon) iconHero += 1;
  }

  const totalFrames = staged.reduce((a, b) => a + (b.durationInFrames || 0), 0);
  const statementCount = byStrategy[TERMINAL_STRATEGY] || 0;

  const metrics = {
    visualBeatCount: staged.length,
    listItemBeatCount: (beats || []).length - staged.length,
    visualStateCount,
    averageBeatDurationSec: staged.length ? +(totalFrames / staged.length / fps).toFixed(2) : 0,
    averageStatesPerBeat: staged.length ? +(visualStateCount / staged.length).toFixed(2) : 0,
    longestStaticPeriodSec: +(longestStatic / fps).toFixed(2),

    // The four ratios PART 13 asks to be visible.
    authoredVisualPlanRatio: +(byProvenance.authored / n).toFixed(3),
    deterministicFallbackRatio: +(byProvenance.deterministic / n).toFixed(3),
    genericFallbackRatio: +(byProvenance.emergency / n).toFixed(3),
    statementRatio: +(statementCount / n).toFixed(3),
    iconHeroRatio: +(iconHero / n).toFixed(3),

    // PART 6 / PART 29. `textNarrationRatio` is the share of the spoken
    // words that also appear on screen — with captions off this should be
    // small; a video approaching 1.0 is an animated transcript again.
    supportingTextWords: supportingWords,
    averageWordsPerBeat: staged.length ? +(supportingWords / staged.length).toFixed(2) : 0,
    maxWordsOnOneBeat: maxBeatWords,
    wordlessBeatRatio: staged.length ? +(wordlessBeats / staged.length).toFixed(3) : 0,
    textNarrationRatio: (() => {
      const spoken = staged.reduce(
        (a, b) => a + String(b.text || "").trim().split(/\s+/).filter(Boolean).length, 0);
      return spoken ? +(supportingWords / spoken).toFixed(3) : 0;
    })(),

    iconSecondaryCount: iconSecondary,
    sectionContextDerivedCount: contextDerived,
    strategyMix: byStrategy,
    distinctStrategies: Object.keys(byStrategy).length,
  };

  return { metrics, fallbackReasons, warnings: buildWarnings(metrics, staged, fps) };
}

/**
 * Warnings, not silent tolerances. Each names the specific defect class
 * PART 20 asks to be detected.
 */
function buildWarnings(m, staged, fps) {
  const w = [];

  if (m.iconHeroRatio > 0) {
    w.push({
      id: "VIS-ICON-HERO",
      severity: "MAJOR",
      message: `${Math.round(m.iconHeroRatio * 100)}% of staged beats still render an icon as the primary visual`,
    });
  }
  if (m.statementRatio > 0.3) {
    w.push({
      id: "VIS-STATEMENT-RATIO",
      severity: "MAJOR",
      message: `${Math.round(m.statementRatio * 100)}% of beats fell to ${TERMINAL_STRATEGY} (target <=30%)`,
    });
  }
  if (m.longestStaticPeriodSec > STATIC_WARN_FRAMES / fps) {
    w.push({
      id: "VIS-STATIC-HOLD",
      severity: "MAJOR",
      message: `a single visual state holds for ${m.longestStaticPeriodSec}s with no change (>${STATIC_WARN_FRAMES / fps}s)`,
    });
  }
  if (m.averageStatesPerBeat < 2 && m.visualBeatCount > 0) {
    w.push({
      id: "VIS-FLAT-BEATS",
      severity: "MAJOR",
      message: `beats average ${m.averageStatesPerBeat} visual states — concepts are not progressing`,
    });
  }
  if (m.genericFallbackRatio > 0.4) {
    w.push({
      id: "VIS-GENERIC-FALLBACK",
      severity: "MAJOR",
      message: `${Math.round(m.genericFallbackRatio * 100)}% of beats produced no readable visual concept`,
    });
  }
  if (m.distinctStrategies <= 2 && m.visualBeatCount >= 6) {
    w.push({
      id: "VIS-TEMPLATE-REPEAT",
      severity: "MAJOR",
      message: `only ${m.distinctStrategies} distinct visual strategies across ${m.visualBeatCount} beats — the video is templated`,
    });
  }

  // Same scene type repeated back-to-back too many times.
  let run = 1;
  for (let i = 1; i < staged.length; i++) {
    const a = staged[i - 1].visualPlan && staged[i - 1].visualPlan.strategy;
    const b = staged[i].visualPlan && staged[i].visualPlan.strategy;
    if (a && a === b) {
      run += 1;
      if (run === 4) {
        w.push({
          id: "VIS-CONSECUTIVE-REPEAT",
          severity: "MINOR",
          message: `${a} repeats ${run}x consecutively around "${(staged[i].text || "").slice(0, 40)}"`,
        });
      }
    } else {
      run = 1;
    }
  }

  if (m.maxWordsOnOneBeat > MAX_SUPPORTING_WORDS) {
    w.push({
      id: "VIS-TEXT-BUDGET",
      severity: "MAJOR",
      message: `a beat prints ${m.maxWordsOnOneBeat} words on screen (budget ${MAX_SUPPORTING_WORDS}) — that is a subtitle, not a label`,
    });
  }
  if (m.textNarrationRatio > 0.35) {
    w.push({
      id: "VIS-TEXT-HEAVY",
      severity: "MAJOR",
      message: `${Math.round(m.textNarrationRatio * 100)}% of the spoken words are also printed on screen — the picture is reciting the narration`,
    });
  }

  // PART 30 — a strategy used twice with the SAME composition variant draws
  // the same picture twice. This is the check that turns "the video feels
  // templated" into a number: it counts beats that will be visually
  // identical to an earlier beat, not beats that merely share a strategy.
  const seen = new Map();
  for (const b of staged) {
    const plan = b.visualPlan;
    if (!plan) continue;
    // Keyed on the strategy's DECLARED variant count, not on the raw
    // ordinal. A scene that draws one composition collapses every beat to
    // #0 and is reported as repeating — which is the truth. Keying on the
    // ordinal alone would have made two identical ACCUMULATION beats look
    // like two different pictures because they happened to be numbered 0
    // and 1.
    const count = plan.variantCount || 1;
    const key = `${plan.strategy}#${count > 1 && Number.isFinite(plan.variant) ? plan.variant % count : 0}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  const duplicated = [...seen.entries()].filter(([, n]) => n > 1);
  if (duplicated.length) {
    w.push({
      id: "VIS-SAME-COMPOSITION",
      severity: "MINOR",
      message:
        `repeated composition: ${duplicated.map(([k, n]) => `${k} x${n}`).join(", ")} — ` +
        "these beats draw the same picture as each other",
    });
  }

  // A beat whose only content is text (PART 20's "visual beat contains
  // only text"): the terminal fallback is exactly that shape.
  const textOnly = staged.filter(
    (b) => b.visualPlan && b.visualPlan.strategy === TERMINAL_STRATEGY
  ).length;
  if (textOnly > 0 && textOnly / (staged.length || 1) > 0.5) {
    w.push({
      id: "VIS-TEXT-ONLY",
      severity: "MAJOR",
      message: `${textOnly} of ${staged.length} beats are typographic-only compositions`,
    });
  }

  return w;
}

/**
 * Sound QA — the same idea applied to the score.
 *
 * A sound track can fail in ways that are invisible on a waveform and
 * inaudible until you notice you are annoyed: one sound every 1.5s for a
 * minute, the same file eleven times, or a "score" that is really four
 * clicks with no silence anywhere. These numbers are cheap and go in the
 * same per-render report as the visual ones.
 *
 * `semanticMatchRate` is deliberately NOT "does the sound match the
 * narration's words" — matching words is the defect this replaced. It is
 * the share of events whose visual state is one the strategy actually
 * declares as an event, which is what "the sound matches the picture"
 * means here.
 */
export function summarizeSound(soundtrack, opts = {}) {
  const fps = opts.fps || FPS;
  const events = soundtrack || [];
  const seconds = Math.max((opts.totalFrames || 0) / fps, 1);

  const byRole = {};
  const byFile = {};
  for (const ev of events) {
    byRole[ev.role] = (byRole[ev.role] || 0) + 1;
    if (ev.file) byFile[ev.file] = (byFile[ev.file] || 0) + 1;
  }

  // Longest stretch with no sound at all, including the head and tail —
  // silence is a design element, so it gets measured like one.
  let longestGap = events.length ? events[0].atFrame : opts.totalFrames || 0;
  for (let i = 1; i < events.length; i++) {
    longestGap = Math.max(longestGap, events[i].atFrame - events[i - 1].atFrame);
  }
  if (events.length) longestGap = Math.max(longestGap, (opts.totalFrames || 0) - events[events.length - 1].atFrame);

  let tightest = Infinity;
  for (let i = 1; i < events.length; i++) tightest = Math.min(tightest, events[i].atFrame - events[i - 1].atFrame);

  const fileCounts = Object.values(byFile);
  const withReason = events.filter((e) => e.reason && e.state).length;

  const metrics = {
    eventCount: events.length,
    eventsPerMinute: round2((events.length / seconds) * 60),
    distinctFiles: Object.keys(byFile).length,
    distinctRoles: Object.keys(byRole).length,
    roleMix: byRole,
    mostRepeatedFile: fileCounts.length ? Math.max(...fileCounts) : 0,
    longestSilenceSec: round2(longestGap / fps),
    tightestGapFrames: Number.isFinite(tightest) ? tightest : null,
    // Every event should carry both; a 1.0 here is the check that nothing
    // is firing for a reason nobody can name.
    semanticMatchRate: events.length ? round2(withReason / events.length) : 1,
    loudestTargetDb: events.length ? Math.max(...events.map((e) => e.targetDb)) : null,
    peakVolume: events.length ? Math.max(...events.map((e) => e.volume)) : 0,
  };

  const warnings = [];
  if (metrics.eventsPerMinute > 40) {
    warnings.push({
      id: "AUD-DENSITY",
      severity: "MAJOR",
      message: `${metrics.eventsPerMinute} sound events per minute — the score is constant, not punctuation`,
    });
  }
  if (metrics.longestSilenceSec < 3 && events.length > 4) {
    warnings.push({
      id: "AUD-NO-SILENCE",
      severity: "MAJOR",
      message: `longest silence is only ${metrics.longestSilenceSec}s — nothing is ever allowed to land in the clear`,
    });
  }
  if (metrics.mostRepeatedFile > 4) {
    warnings.push({
      id: "AUD-REPEAT",
      severity: "MINOR",
      message: `one file plays ${metrics.mostRepeatedFile}x — the score reads as a single recurring click`,
    });
  }
  if (metrics.semanticMatchRate < 1) {
    warnings.push({
      id: "AUD-UNEXPLAINED",
      severity: "MAJOR",
      message: `${Math.round((1 - metrics.semanticMatchRate) * 100)}% of events carry no visual state or reason`,
    });
  }
  if (metrics.peakVolume >= 1) {
    warnings.push({
      id: "AUD-CLIPPED-GAIN",
      severity: "MAJOR",
      message: `an event plays at unity gain — it was boosted rather than attenuated and will sit on top of the narration`,
    });
  }
  if (metrics.tightestGapFrames !== null && metrics.tightestGapFrames < 12) {
    warnings.push({
      id: "AUD-SMEAR",
      severity: "MINOR",
      message: `two events are ${metrics.tightestGapFrames} frames apart — they will read as one smeared noise`,
    });
  }

  // The event list travels WITH the metrics into the render report, because
  // qa-scripts/audio-qa.mjs needs to know where to look in the finished
  // mp4: a level measured at an arbitrary offset proves nothing, a level
  // measured in the window where an event was scheduled proves it played.
  const eventList = events.map((e) => ({
    atFrame: e.atFrame,
    role: e.role,
    strategy: e.strategy,
    state: e.state,
    reason: e.reason,
    file: e.file,
    durationMs: e.durationMs,
    targetDb: e.targetDb,
    volume: e.volume,
  }));

  return { metrics, warnings, events: eventList };
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

/** Human-readable one-screen summary for CI logs. */
export function formatVisualReport(summary) {
  const m = summary.metrics;
  const lines = [
    `visual beats        : ${m.visualBeatCount} (+${m.listItemBeatCount} list-item)`,
    `visual states       : ${m.visualStateCount} (avg ${m.averageStatesPerBeat}/beat)`,
    `avg beat duration   : ${m.averageBeatDurationSec}s`,
    `longest static hold : ${m.longestStaticPeriodSec}s`,
    `authored plan ratio : ${m.authoredVisualPlanRatio}`,
    `deterministic ratio : ${m.deterministicFallbackRatio}${m.sectionContextDerivedCount ? ` (${m.sectionContextDerivedCount} from section context)` : ""}`,
    `generic fallback    : ${m.genericFallbackRatio}`,
    `statement ratio     : ${m.statementRatio}`,
    `icon-hero ratio     : ${m.iconHeroRatio}${m.iconSecondaryCount ? ` (${m.iconSecondaryCount} secondary)` : ""}`,
    `on-screen words     : ${m.supportingTextWords} total, ${m.averageWordsPerBeat}/beat, max ${m.maxWordsOnOneBeat} (budget ${MAX_SUPPORTING_WORDS})`,
    `text/narration      : ${m.textNarrationRatio}  (${Math.round(m.wordlessBeatRatio * 100)}% of beats print nothing)`,
    `strategy mix        : ${Object.entries(m.strategyMix).map(([k, v]) => `${k}=${v}`).join(" ") || "(none)"}`,
  ];
  for (const warn of summary.warnings) lines.push(`  ! [${warn.severity}] ${warn.id}: ${warn.message}`);

  if (summary.sound) {
    const s = summary.sound.metrics;
    lines.push(
      `sound events        : ${s.eventCount} (${s.eventsPerMinute}/min, ${s.distinctFiles} distinct files)`,
      `longest silence     : ${s.longestSilenceSec}s`,
      `sound role mix      : ${Object.entries(s.roleMix).map(([k, v]) => `${k}=${v}`).join(" ") || "(none)"}`,
      `event->state match  : ${s.semanticMatchRate}  loudest target ${s.loudestTargetDb ?? "n/a"}dBFS  peak vol ${s.peakVolume}`
    );
    for (const warn of summary.sound.warnings) lines.push(`  ! [${warn.severity}] ${warn.id}: ${warn.message}`);
  }
  return lines.join("\n");
}
