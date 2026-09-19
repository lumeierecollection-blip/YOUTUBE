/**
 * CAPABILITY MANIFEST — the vocabulary Gemini composes with.
 *
 * This is the machine-readable registry of what Remotion can construct.
 * Generated from the actual renderer implementation, not hand-maintained.
 *
 * Gemini describes WHAT the viewer should see and WHY.
 * The capability compiler determines HOW it can safely be constructed.
 *
 * Capabilities are COMPOSABLE — Gemini can combine them freely.
 * The compiler validates combinations and provides semantic fallbacks.
 */

import { PRIMITIVES, ANCHORS, MOTIONS, CANVAS_W, CANVAS_H, SAFE, SAFE_W, SAFE_H } from "./scene-primitives.js";

/* ── Capability Categories ──────────────────────────────────────────── */

/**
 * PRIMITIVE CAPABILITIES — what each visual primitive can do.
 * These are the building blocks Gemini selects from.
 */
export const PRIMITIVE_CAPABILITIES = {
  block: {
    description: "A solid rectangle that can stack, fall, break apart, and fill space",
    supports: ["fill", "stack", "fall", "break", "scale", "position", "color", "opacity", "rotation"],
    constraints: { maxCount: 60, minScale: 0.2, maxScale: 2 },
    status: "production",
  },
  stack: {
    description: "A vertical column of blocks — quantity you can see accumulate",
    supports: ["accumulate", "deplete", "grow", "shrink", "label", "count"],
    constraints: { maxCount: 24, minScale: 0.2, maxScale: 2 },
    status: "production",
  },
  bar: {
    description: "Proportional length for comparison without a chart frame",
    supports: ["compare", "grow", "shrink", "proportional", "label", "count"],
    constraints: { maxCount: 12, minScale: 0.2, maxScale: 2 },
    status: "production",
  },
  vessel: {
    description: "A container with a fill level that drains or fills",
    supports: ["fill", "drain", "level-change", "label", "count"],
    constraints: { maxCount: 6, minScale: 0.2, maxScale: 2 },
    status: "production",
  },
  document: {
    description: "A page or sheet that can tear, stamp, highlight, or stack",
    supports: ["tear", "stamp", "highlight", "stack", "reveal", "label", "count"],
    constraints: { maxCount: 8, minScale: 0.2, maxScale: 2 },
    status: "production",
  },
  grid: {
    description: "A field of cells for scale and proportion at a glance",
    supports: ["scale", "proportion", "pattern", "fill-cells", "label"],
    constraints: { minScale: 0.2, maxScale: 2 },
    status: "production",
  },
  gauge: {
    description: "A circular meter with a reading",
    supports: ["read", "change", "danger-zone", "label", "count"],
    constraints: { maxCount: 4, minScale: 0.2, maxScale: 2 },
    status: "production",
  },
  figure: {
    description: "One large number — the evidence itself",
    supports: ["display", "roll", "compare", "label"],
    constraints: { minScale: 0.2, maxScale: 2 },
    status: "production",
  },
  counter: {
    description: "A number that rolls up or down",
    supports: ["count-up", "count-down", "roll", "label"],
    constraints: { minScale: 0.2, maxScale: 2 },
    status: "production",
  },
  silhouette: {
    description: "A human/object outline for population, crowd, scale",
    supports: ["populate", "crowd", "scale", "label", "count"],
    constraints: { maxCount: 20, minScale: 0.2, maxScale: 2 },
    status: "production",
  },
  arrow: {
    description: "A directional connector between objects",
    supports: ["connect", "direct", "point", "count"],
    constraints: { maxCount: 8 },
    status: "production",
  },
  rule: {
    description: "A dividing line for structure, not decoration",
    supports: ["divide", "structure", "separate", "count"],
    constraints: { maxCount: 6 },
    status: "production",
  },
  field: {
    description: "A textured ground plane — depth so objects are not floating in void",
    supports: ["ground", "depth", "texture", "atmosphere"],
    constraints: {},
    status: "production",
  },
};

/**
 * SCENE-LEVEL CAPABILITIES — what Gemini can request at the scene level.
 * These compose primitive capabilities into visual events.
 */
export const SCENE_CAPABILITIES = {
  surface: {
    description: "A background surface with texture and depth",
    requires: ["field"],
    supports: ["texture", "color", "depth", "gradient"],
    status: "production",
  },
  environment: {
    description: "A setting that provides context and atmosphere",
    requires: ["field"],
    supports: ["context", "atmosphere", "mood", "lighting"],
    status: "production",
  },
  lighting: {
    description: "Direction, intensity, and shadow for depth",
    requires: [],
    supports: ["direction", "intensity", "shadow", "highlight", "gradient"],
    status: "production",
  },
  camera: {
    description: "Movement, perspective, and focus",
    requires: [],
    supports: ["push_in", "pull_back", "track", "orbit", "tilt", "hold", "zoom"],
    status: "production",
  },
  motion: {
    description: "Easing, timing, and weight for objects",
    requires: [],
    supports: ["ease", "timing", "weight", "spring", "bounce"],
    status: "production",
  },
  layering: {
    description: "Depth, z-order, and parallax for visual hierarchy",
    requires: [],
    supports: ["depth", "z-order", "parallax", "foreground", "background"],
    status: "production",
  },
  accumulation: {
    description: "Objects building up over time",
    requires: ["block", "stack", "document", "silhouette"],
    supports: ["build", "grow", "pile", "stack"],
    status: "production",
  },
  separation: {
    description: "Objects moving apart to show division or contrast",
    requires: [],
    supports: ["split", "divide", "scatter", "distribute"],
    status: "production",
  },
  transformation: {
    description: "Shape or state change to show evolution",
    requires: [],
    supports: ["morph", "change", "evolve", "transform"],
    status: "production",
  },
  reveal: {
    description: "Showing hidden content to expose truth",
    requires: [],
    supports: ["uncover", "expose", "strip", "peel"],
    status: "production",
  },
  conceal: {
    description: "Hiding content to create mystery or contrast",
    requires: [],
    supports: ["hide", "cover", "mask", "obscure"],
    status: "production",
  },
  expansion: {
    description: "Growing to fill space and show scale",
    requires: [],
    supports: ["grow", "expand", "swell", "inflate"],
    status: "production",
  },
  collapse: {
    description: "Shrinking or breaking down to show failure",
    requires: [],
    supports: ["shrink", "collapse", "break", "crumble"],
    status: "production",
  },
  scattering: {
    description: "Spreading objects to show distribution or chaos",
    requires: [],
    supports: ["spread", "scatter", "disperse", "fragment"],
    status: "production",
  },
  transfer: {
    description: "Moving between states to show change or flow",
    requires: [],
    supports: ["move", "flow", "transfer", "shift"],
    status: "production",
  },
};

/**
 * TYPOGRAPHY CAPABILITY — text as narrative emphasis, not a fallback.
 */
export const TYPOGRAPHY_CAPABILITY = {
  description: "Narrative emphasis text — one short centred line that emphasises what the narrator says",
  supports: ["hook", "re_hook", "key_fact", "contradiction", "question", "statement"],
  constraints: {
    maxWords: 7,
    hardMaxWords: 9,
    maxChars: 48,
    minReadablePx: 34,
    maxPx: 132,
    safeWidthFraction: 0.86,
    lineHeight: 1.18,
    maxBeatShare: 0.4,
  },
  rules: [
    "ONE LINE — never two lines, never headline + subheadline",
    "2-7 words — 8-9 is unusual, more than 9 is narration not emphasis",
    "NOT the transcript — never the narration verbatim or near-restated",
    "NOT a headline — never a topic label, section title, or article headline",
    "NOT a fallback — typography is selective emphasis, not the default for beats you could not think of a visual for",
    "Animate as ONE object — no word-by-word/karaoke reveal",
  ],
  status: "production",
};

/* ── Capability Manifest Generator ──────────────────────────────────── */

/**
 * Generate the complete capability manifest.
 * This is the single source of truth for what Remotion can construct.
 */
export function generateCapabilityManifest() {
  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    canvas: { width: CANVAS_W, height: CANVAS_H },
    safeArea: { ...SAFE, width: SAFE_W, height: SAFE_H },
    primitives: PRIMITIVE_CAPABILITIES,
    scenes: SCENE_CAPABILITIES,
    typography: TYPOGRAPHY_CAPABILITY,
    anchors: Object.keys(ANCHORS),
    motions: MOTIONS,
    constraints: {
      minSceneCoverage: 0.35,
      maxSceneCoverage: 0.92,
      maxObjectsPerScene: 8,
      maxLabelledObjects: 3,
    },
  };
}

/**
 * Generate a human-readable capability digest for Gemini's prompt.
 * Lists capabilities in a structured way that Gemini can understand.
 */
export function capabilityDigest() {
  const lines = [];

  lines.push("## WHAT REMOTION CAN CONSTRUCT");
  lines.push("");
  lines.push("These are the building blocks you compose from.");
  lines.push("You describe the VISUAL EVENT; the system builds it from these capabilities.");
  lines.push("");

  lines.push("### Primitive Capabilities (visual objects):");
  for (const [kind, cap] of Object.entries(PRIMITIVE_CAPABILITIES)) {
    const supports = cap.supports.join(", ");
    lines.push(`  ${kind}: ${cap.description}`);
    lines.push(`    can: ${supports}`);
    if (cap.constraints.maxCount) lines.push(`    max count: ${cap.constraints.maxCount}`);
  }

  lines.push("");
  lines.push("### Scene Capabilities (visual events):");
  for (const [name, cap] of Object.entries(SCENE_CAPABILITIES)) {
    const requires = cap.requires.length ? ` requires: ${cap.requires.join(", ")}` : "";
    lines.push(`  ${name}: ${cap.description}${requires}`);
    lines.push(`    can: ${cap.supports.join(", ")}`);
  }

  lines.push("");
  lines.push("### Typography Capability:");
  lines.push(`  typography: ${TYPOGRAPHY_CAPABILITY.description}`);
  lines.push(`    moments: ${TYPOGRAPHY_CAPABILITY.supports.join(", ")}`);
  lines.push(`    rules: ${TYPOGRAPHY_CAPABILITY.rules.join("; ")}`);

  lines.push("");
  lines.push("### Composition Rules:");
  lines.push("  - A scene must cover at least 35% of the frame");
  lines.push("  - At most 8 objects per scene");
  lines.push("  - At most 3 objects should be labelled");
  lines.push("  - Capabilities are COMPOSABLE — combine them freely");
  lines.push("  - The system validates combinations and provides semantic fallbacks");

  return lines.join("\n");
}

/**
 * Check if a capability combination is supported.
 * Returns { ok, issues, suggestions }.
 */
export function validateCapabilityCombination(capabilities) {
  const issues = [];
  const suggestions = [];

  for (const cap of capabilities) {
    if (SCENE_CAPABILITIES[cap]) {
      const sceneCap = SCENE_CAPABILITIES[cap];
      for (const req of sceneCap.requires) {
        if (!capabilities.includes(req)) {
          issues.push(`${cap} requires ${req}`);
          suggestions.push(`Add ${req} to your capability list`);
        }
      }
    }
  }

  return { ok: issues.length === 0, issues, suggestions };
}

/**
 * Map a capability to the primitives that can fulfill it.
 * Used by the compiler when Gemini requests a capability.
 */
export function primitivesForCapability(capability) {
  const matching = [];

  for (const [kind, cap] of Object.entries(PRIMITIVE_CAPABILITIES)) {
    if (cap.supports.some(s => capability.includes(s) || s.includes(capability))) {
      matching.push(kind);
    }
  }

  return matching;
}

/**
 * Get the supported motions for a primitive.
 */
export function motionsForPrimitive(kind) {
  const cap = PRIMITIVE_CAPABILITIES[kind];
  if (!cap) return [];

  const motionMap = {
    block: ["appear", "rise", "grow", "fall", "strike", "split", "hold"],
    stack: ["appear", "rise", "grow", "fill", "fall", "hold"],
    bar: ["appear", "grow", "fill", "drain", "hold"],
    vessel: ["appear", "fill", "drain", "hold"],
    document: ["appear", "rise", "tear", "reveal", "hold"],
    grid: ["appear", "fill", "reveal", "hold"],
    gauge: ["appear", "fill", "drain", "hold"],
    figure: ["appear", "count", "hold"],
    counter: ["appear", "count", "hold"],
    silhouette: ["appear", "rise", "fall", "count", "hold"],
    arrow: ["appear", "rise", "hold"],
    rule: ["appear", "strike", "hold"],
    field: ["appear", "reveal", "hold"],
  };

  return motionMap[kind] || MOTIONS;
}
