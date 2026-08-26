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
    `strategy mix        : ${Object.entries(m.strategyMix).map(([k, v]) => `${k}=${v}`).join(" ") || "(none)"}`,
  ];
  for (const warn of summary.warnings) lines.push(`  ! [${warn.severity}] ${warn.id}: ${warn.message}`);
  return lines.join("\n");
}
