/**
 * The visual strategy registry — the single source of truth for "what kinds
 * of visual explanation this renderer can actually produce".
 *
 * PURE module (no React, no Remotion): runs in node for render.js and the
 * gates AND inside the browser bundle, same constraint as beats.js.
 *
 * WHY THIS FILE EXISTS AT ALL
 *
 * The previous overhaul fixed *which authored beat reaches the screen*. It
 * did not fix *what the viewer sees when it gets there*: `deriveScene`
 * (mg-package.js) resolved an icon for every beat before it even looked at
 * the archetype, `StatementScene` (motion-graphics.jsx) rendered nothing but
 * that icon, and `HeroNumberScene` rendered nothing but a giant numeral. A
 * beat carrying {value: 150, unit: "meters"} for the narration "police
 * scanned a 150 meter radius for anyone's phone" rendered "150 / meters" —
 * technically correct, and it explains nothing about a geographic dragnet.
 *
 * THE ANTI-DEAD-ENUM RULE
 *
 * Every strategy listed here MUST name a `scene` that a composition actually
 * routes to, and MUST declare its own `states` timeline. A strategy that
 * renders the same composition as another strategy is not a strategy, it's
 * an alias, and it makes the router lie about what the video contains.
 * `assertStrategyRegistryIsSound()` below is the mechanical check, and
 * `visual/run-visual-tests.js` fails the build if it ever stops holding.
 *
 * STATE TIMELINES
 *
 * `states` is an ordered list of named visual moments with relative
 * `weight`s. No frame numbers, no seconds — states.js normalizes the weights
 * across whatever real SRT-derived window the beat actually occupies, so the
 * same concept works in a 2s beat and a 14s beat without an LLM ever being
 * asked to compute a frame number (PART 24: the model decides WHAT, code
 * decides WHEN).
 *
 * `anchored: true` marks the ONE state that must land on the anchor token —
 * the frame where the beat's key word is actually spoken. states.js shifts
 * the timeline so that state begins there, which is how a measurement label
 * appears exactly as the narrator says "150 meters" rather than at some
 * proportional guess.
 */

/**
 * `dataNeeds` documents what a strategy must have to render honestly. The
 * director checks these before selecting a strategy and records a real
 * fallback reason when they're unmet (PART 19: never silently downgrade).
 */
export const STRATEGIES = {
  GEOSPATIAL_RADIUS: {
    scene: "GeospatialRadiusScene",
    intent: "a distance/boundary drawn on real ground, with what falls inside it",
    dataNeeds: ["value", "unit:distance"],
    iconRole: "secondary", // a small map marker is genuinely useful here
    // How many DISTINCT compositions the scene can draw (PART 13/30). This
    // is a claim about the scene component, checked by run-visual-tests.js
    // against the arrays it actually indexes — declaring 3 while the scene
    // draws one would make the render report say a video is varied when it
    // is not. Strategies without this draw one composition, which the
    // report then flags honestly as a repeat.
    variants: 3,
    states: [
      { key: "establish", action: "environment appears", weight: 1.4 },
      { key: "origin", action: "the event point lands", weight: 1.0 },
      { key: "expand", action: "radius grows outward", weight: 2.2 },
      // `resolves`: at this point the radius is ALREADY drawn at ~84% and
      // the lock finishes it. A figure labelling it must therefore track
      // the radius, not start counting here — see useValueProgress.
      { key: "lock", action: "boundary locks at the stated distance", weight: 1.0, anchored: true, resolves: true },
      { key: "populate", action: "devices/subjects inside the boundary appear", weight: 1.6 },
      { key: "select", action: "the ones caught are highlighted", weight: 1.4 },
      { key: "measure", action: "measurement label resolves", weight: 1.2 },
    ],
  },

  ACCUMULATION: {
    scene: "AccumulationScene",
    variants: 2, // a tray the units fall into, or a ledger they stack down
    intent: "many small things adding up into one consequential total",
    dataNeeds: ["total"],
    iconRole: "none",
    states: [
      { key: "empty", action: "the empty surface establishes the container", weight: 1.0 },
      { key: "first", action: "the first item lands, at readable size", weight: 1.2 },
      { key: "accumulate", action: "items pile in, running total climbing", weight: 3.0 },
      // `resolves`: the pile is complete before this state begins, so a
      // figure that counts up from zero here contradicts the picture.
      { key: "total", action: "the pile compresses into the total", weight: 1.6, anchored: true, resolves: true },
      { key: "weigh", action: "the total is held against what it means", weight: 1.4 },
    ],
  },

  TRANSFORMATION: {
    scene: "TransformationScene",
    intent: "one value becoming another, showing the mechanism between them",
    dataNeeds: ["from", "to"],
    iconRole: "none",
    states: [
      { key: "establish", action: "starting value sits alone", weight: 1.4 },
      { key: "pressure", action: "the force acting on it becomes visible", weight: 1.6 },
      { key: "grow", action: "the value moves, driven by that force", weight: 2.4, anchored: true },
      { key: "settle", action: "the end value locks, gap to the start visible", weight: 1.6 },
    ],
  },

  COMPARISON: {
    scene: "ComparisonScene",
    intent: "two quantities measured against each other, in proportion",
    dataNeeds: ["series>=2"],
    iconRole: "none",
    states: [
      { key: "left", action: "first quantity establishes the scale", weight: 1.4 },
      { key: "right", action: "second quantity enters against it", weight: 1.6, anchored: true },
      { key: "gap", action: "the difference between them is marked", weight: 1.8 },
      { key: "verdict", action: "which one matters is emphasized", weight: 1.2 },
    ],
  },

  TIMELINE: {
    scene: "TimelineScene",
    intent: "when things happened, in order, on a real axis",
    dataNeeds: ["events>=2"],
    iconRole: "none",
    states: [
      { key: "axis", action: "the time axis draws", weight: 1.2 },
      { key: "events", action: "events land in chronological order", weight: 2.8 },
      { key: "focus", action: "the decisive moment is isolated", weight: 1.6, anchored: true },
      { key: "consequence", action: "what changed after it", weight: 1.4 },
    ],
  },

  CAUSE_EFFECT: {
    scene: "CauseEffectScene",
    intent: "one thing driving another, with the link made visible",
    dataNeeds: [],
    iconRole: "none",
    states: [
      { key: "cause", action: "the cause establishes", weight: 1.4 },
      { key: "link", action: "the connection draws between them", weight: 1.6, anchored: true },
      { key: "effect", action: "the effect arrives", weight: 1.6 },
      { key: "settle", action: "the whole relationship is readable at once", weight: 1.2 },
    ],
  },

  PROCESS: {
    scene: "ProcessScene",
    variants: 2, // left-to-right chain, or read top-to-bottom
    intent: "a sequence of stages something actually moves through",
    dataNeeds: ["stages>=2"],
    iconRole: "none",
    states: [
      { key: "stages", action: "the stages lay out", weight: 1.4 },
      { key: "advance", action: "a token moves through each stage", weight: 3.2, anchored: true },
      { key: "arrive", action: "it completes at the far end", weight: 1.4 },
    ],
  },

  DATA_CHART: {
    scene: "DataChartScene",
    intent: "real series values compared on a zero-origin axis",
    dataNeeds: ["series>=2"],
    iconRole: "none",
    states: [
      { key: "axis", action: "axis and baseline draw", weight: 1.0 },
      { key: "bars", action: "bars grow to their real values", weight: 2.6, anchored: true },
      { key: "highlight", action: "the bar that matters is picked out", weight: 1.6 },
      { key: "read", action: "values sit adjacent to their bars", weight: 1.2 },
    ],
  },

  DOCUMENT_EVIDENCE: {
    scene: "DocumentEvidenceScene",
    variants: 3, // three page shapes — see PAGES in evidence-scenes.jsx
    intent: "the actual text of a rule/record, with the operative part found",
    dataNeeds: [],
    iconRole: "none",
    states: [
      { key: "page", action: "the document page establishes", weight: 1.6 },
      { key: "scan", action: "attention moves down the page", weight: 1.8 },
      { key: "find", action: "the operative clause is located", weight: 1.6, anchored: true },
      { key: "read", action: "that clause is pulled out legible", weight: 1.8 },
    ],
  },

  IMAGE_EVIDENCE: {
    scene: "ImageEvidenceScene",
    intent: "a real sourced photograph, shown for a stated reason",
    dataNeeds: ["asset"],
    iconRole: "none",
    states: [
      { key: "reveal", action: "the photograph resolves", weight: 2.0 },
      { key: "role", action: "what it is evidence OF is named", weight: 1.4, anchored: true },
      { key: "hold", action: "slow move across the subject", weight: 2.2 },
    ],
  },

  INTERFACE_SIMULATION: {
    scene: "InterfaceSimulationScene",
    intent: "a system's own screen, doing the thing being described",
    dataNeeds: [],
    iconRole: "secondary", // UI chrome legitimately contains small glyphs
    states: [
      { key: "chrome", action: "the interface frame establishes", weight: 1.2 },
      { key: "input", action: "the request enters the system", weight: 1.6 },
      { key: "work", action: "the system visibly processes it", weight: 2.0, anchored: true },
      { key: "result", action: "the output appears", weight: 1.8 },
    ],
  },

  RELATIONSHIP: {
    scene: "RelationshipScene",
    intent: "several entities and how they actually connect",
    dataNeeds: ["nodes>=2"],
    iconRole: "none",
    states: [
      { key: "nodes", action: "the parties appear in position", weight: 1.6 },
      { key: "links", action: "connections draw between them", weight: 2.0, anchored: true },
      { key: "weight", action: "the strongest relationship is emphasized", weight: 1.6 },
    ],
  },

  BEFORE_AFTER: {
    scene: "BeforeAfterScene",
    intent: "the same frame under two different conditions",
    dataNeeds: [],
    iconRole: "none",
    states: [
      { key: "before", action: "the prior state holds the frame", weight: 1.8 },
      { key: "wipe", action: "the change sweeps across", weight: 1.4, anchored: true },
      { key: "after", action: "the new state holds the frame", weight: 1.8 },
      { key: "compare", action: "both are visible together", weight: 1.4 },
    ],
  },

  SCALE_COMPARISON: {
    scene: "ScaleComparisonScene",
    intent: "how big a number is, against something that gives it size",
    dataNeeds: ["value"],
    iconRole: "none",
    states: [
      { key: "reference", action: "the reference quantity establishes", weight: 1.4 },
      { key: "grow", action: "the subject grows against it", weight: 2.4, anchored: true },
      { key: "read", action: "the magnitude resolves as a figure", weight: 1.6 },
    ],
  },

  VISUAL_METAPHOR: {
    scene: "VisualMetaphorScene",
    intent: "an abstract idea given physical behaviour",
    dataNeeds: [],
    iconRole: "none",
    states: [
      { key: "establish", action: "the metaphor's objects appear", weight: 1.6 },
      { key: "act", action: "they behave the way the idea behaves", weight: 2.6, anchored: true },
      { key: "resolve", action: "the consequence is left on screen", weight: 1.6 },
    ],
  },

  CINEMATIC_STATEMENT: {
    scene: "CinematicStatementScene",
    intent: "no richer representation was available — compose the frame anyway",
    dataNeeds: [],
    iconRole: "none",
    states: [
      { key: "field", action: "the environment establishes depth", weight: 1.6 },
      { key: "subject", action: "the subject phrase resolves in the field", weight: 2.0, anchored: true },
      { key: "drift", action: "slow parallax keeps the frame alive", weight: 1.8 },
    ],
  },
};

/** Ordered best-to-last. The director walks this when nothing is authored. */
export const STRATEGY_PREFERENCE = [
  "GEOSPATIAL_RADIUS",
  "ACCUMULATION",
  "TRANSFORMATION",
  "PROCESS",
  "TIMELINE",
  "DATA_CHART",
  "COMPARISON",
  "CAUSE_EFFECT",
  "RELATIONSHIP",
  "BEFORE_AFTER",
  "INTERFACE_SIMULATION",
  "DOCUMENT_EVIDENCE",
  "IMAGE_EVIDENCE",
  "SCALE_COMPARISON",
  "VISUAL_METAPHOR",
  "CINEMATIC_STATEMENT",
];

/**
 * The single terminal fallback. Deliberately NOT icon-bearing: the whole
 * point of PART 7 is that "we couldn't find a richer visual" must not mean
 * "put an icon on screen".
 */
export const TERMINAL_STRATEGY = "CINEMATIC_STATEMENT";

export function strategyNames() {
  return Object.keys(STRATEGIES);
}

export function getStrategy(name) {
  return STRATEGIES[name] || null;
}

/**
 * Mechanical guard against the exact failure mode PART 2 warns about:
 * a new strategy name that renders the same generic layout as an existing
 * one, or names a scene component nobody routes to.
 *
 * `knownScenes` comes from the composition's own router, so this can only
 * pass when the router genuinely handles every registered strategy.
 */
export function assertStrategyRegistryIsSound(knownScenes = null) {
  const problems = [];
  const seenScenes = new Map();

  for (const [name, def] of Object.entries(STRATEGIES)) {
    if (!def.scene) problems.push(`${name}: no scene component named`);
    if (seenScenes.has(def.scene)) {
      problems.push(
        `${name} and ${seenScenes.get(def.scene)} both render ${def.scene} — that's an alias, not a strategy (PART 2)`
      );
    }
    seenScenes.set(def.scene, name);

    if (!Array.isArray(def.states) || def.states.length < 2) {
      problems.push(`${name}: needs >=2 visual states, has ${def.states ? def.states.length : 0}`);
    }
    const anchored = (def.states || []).filter((s) => s.anchored);
    if (anchored.length !== 1) {
      problems.push(`${name}: needs exactly 1 anchored state, has ${anchored.length}`);
    }
    for (const s of def.states || []) {
      if (!(typeof s.weight === "number" && s.weight > 0)) {
        problems.push(`${name}.${s.key}: weight must be a positive number`);
      }
      // PART 11 — states must be declared as proportions, never seconds.
      if ("seconds" in s || "frames" in s || "durationInFrames" in s) {
        problems.push(`${name}.${s.key}: declares absolute time; states are proportional (PART 11)`);
      }
    }
    if (def.iconRole && !["none", "secondary"].includes(def.iconRole)) {
      problems.push(`${name}: iconRole must be "none" or "secondary", never primary (PART 8)`);
    }
  }

  for (const name of STRATEGY_PREFERENCE) {
    if (!STRATEGIES[name]) problems.push(`STRATEGY_PREFERENCE lists unknown strategy ${name}`);
  }
  for (const name of Object.keys(STRATEGIES)) {
    if (!STRATEGY_PREFERENCE.includes(name)) {
      problems.push(`${name} is registered but unreachable — not in STRATEGY_PREFERENCE`);
    }
  }
  if (!STRATEGIES[TERMINAL_STRATEGY]) problems.push(`TERMINAL_STRATEGY ${TERMINAL_STRATEGY} is not registered`);

  if (knownScenes) {
    for (const [name, def] of Object.entries(STRATEGIES)) {
      if (!knownScenes.includes(def.scene)) {
        problems.push(`${name} -> ${def.scene}, which the router does not handle (dead strategy)`);
      }
    }
  }

  return { pass: problems.length === 0, problems };
}
