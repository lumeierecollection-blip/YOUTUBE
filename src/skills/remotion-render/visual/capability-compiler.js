/**
 * CAPABILITY COMPILER — translates Gemini's creative specification into buildable Remotion scenes.
 *
 * This is the core of the eco architecture. Gemini describes WHAT the viewer
 * should see and WHY; this compiler determines HOW it can safely be constructed.
 *
 * Input: Gemini's creative visual specification (capabilities)
 * Output: Validated, normalized Remotion scene
 *
 * Key guarantees:
 *   - Every capability is buildable by construction
 *   - Semantic fallbacks when capabilities are unsupported
 *   - NEVER falls back to generic typography
 *   - Typography is ONE capability among many, not the default
 */

import {
  PRIMITIVE_CAPABILITIES,
  SCENE_CAPABILITIES,
  TYPOGRAPHY_CAPABILITY,
  primitivesForCapability,
  motionsForPrimitive,
  validateCapabilityCombination,
} from "./capability-manifest.js";

import {
  PRIMITIVES,
  ANCHORS,
  MOTIONS,
  validateScene,
  normalizeScene,
  estimateCoverage,
  MIN_SCENE_COVERAGE,
  MAX_SCENE_COVERAGE,
} from "./scene-primitives.js";

/* ── Capability Resolution ──────────────────────────────────────────── */

/**
 * Map a visual event to primitive capabilities.
 * This is where Gemini's creative description becomes buildable objects.
 */
function resolveVisualEvent(event, text) {
  const objects = [];
  const warnings = [];

  if (!event || !event.type) {
    warnings.push("Visual event has no type");
    return { objects, warnings };
  }

  switch (event.type) {
    case "growth": {
      const primitives = primitivesForCapability("grow");
      const primary = primitives[0] || "bar";
      const count = Math.min(PRIMITIVES[primary].maxCount || 1, 6);
      objects.push({
        kind: primary,
        anchor: event.anchor || "center",
        motion: "grow",
        count,
        scale: event.scale || 1,
        label: event.label || "",
      });
      if (event.magnitude) {
        objects.push({
          kind: "figure",
          anchor: "upper_third",
          motion: "appear",
          label: event.magnitude,
        });
      }
      break;
    }

    case "depletion": {
      const primitives = primitivesForCapability("drain");
      const primary = primitives[0] || "vessel";
      objects.push({
        kind: primary,
        anchor: event.anchor || "center",
        motion: "drain",
        scale: event.scale || 1.2,
        label: event.label || "",
      });
      break;
    }

    case "comparison": {
      const primitives = primitivesForCapability("compare");
      const primary = primitives[0] || "bar";
      objects.push(
        {
          kind: primary,
          anchor: "left",
          motion: "appear",
          count: 1,
          scale: event.scaleA || 1,
          label: event.labelA || "",
        },
        {
          kind: primary,
          anchor: "right",
          motion: "appear",
          count: 1,
          scale: event.scaleB || 0.6,
          label: event.labelB || "",
        }
      );
      break;
    }

    case "revelation": {
      const primitives = primitivesForCapability("reveal");
      const primary = primitives[0] || "document";
      objects.push({
        kind: primary,
        anchor: "center",
        motion: "reveal",
        scale: event.scale || 1,
        label: event.label || "",
      });
      if (event.hiddenContent) {
        objects.push({
          kind: "field",
          anchor: "center",
          motion: "appear",
          label: event.hiddenContent,
        });
      }
      break;
    }

    case "structure_break": {
      const primitives = primitivesForCapability("break");
      const primary = primitives[0] || "block";
      const count = Math.min(PRIMITIVES[primary].maxCount || 12, 8);
      objects.push({
        kind: primary,
        anchor: "center",
        motion: "fall",
        count,
        scale: event.scale || 1,
        label: event.label || "",
      });
      break;
    }

    case "accumulation": {
      const primitives = primitivesForCapability("accumulate");
      const primary = primitives[0] || "stack";
      const count = Math.min(PRIMITIVES[primary].maxCount || 12, 10);
      objects.push({
        kind: primary,
        anchor: "center",
        motion: "fill",
        count,
        scale: event.scale || 1,
        label: event.label || "",
      });
      break;
    }

    case "population": {
      const primitives = primitivesForCapability("crowd");
      const primary = primitives[0] || "silhouette";
      const count = Math.min(PRIMITIVES[primary].maxCount || 20, 12);
      objects.push({
        kind: primary,
        anchor: "center",
        motion: "appear",
        count,
        scale: event.scale || 1,
        label: event.label || "",
      });
      break;
    }

    case "evidence": {
      objects.push({
        kind: "figure",
        anchor: "center",
        motion: "appear",
        scale: event.scale || 1.2,
        label: event.label || "",
      });
      if (event.context) {
        objects.push({
          kind: "field",
          anchor: "center",
          motion: "appear",
          label: event.context,
        });
      }
      break;
    }

    case "contrast": {
      objects.push(
        {
          kind: "block",
          anchor: "upper_third",
          motion: "strike",
          scale: 0.8,
          label: event.before || "",
        },
        {
          kind: "block",
          anchor: "lower_third",
          motion: "rise",
          scale: 1,
          label: event.after || "",
        }
      );
      break;
    }

    case "causation": {
      objects.push(
        {
          kind: "block",
          anchor: "upper_third",
          motion: "appear",
          scale: 0.9,
          label: event.cause || "",
        },
        {
          kind: "arrow",
          anchor: "center",
          motion: "appear",
          count: 1,
          label: "",
        },
        {
          kind: "block",
          anchor: "lower_third",
          motion: "rise",
          scale: 1,
          label: event.effect || "",
        }
      );
      break;
    }

    default:
      warnings.push(`Unknown visual event type: ${event.type}`);
  }

  return { objects, warnings };
}

/* ── Scene Compilation ──────────────────────────────────────────────── */

/**
 * Compile a capability-based directive into a validated Remotion scene.
 *
 * @param {Object} directive - Gemini's creative visual specification
 * @param {string} text - The narration text for this beat
 * @param {number} index - Beat index in the sequence
 * @param {number} totalBeats - Total number of beats
 * @returns {{ scene, warnings, errors }}
 */
export function compileScene(directive, text, index, totalBeats) {
  const warnings = [];
  const errors = [];

  if (!directive) {
    errors.push("No directive provided");
    return { scene: null, warnings, errors };
  }

  // Step 1: Validate capability combination
  const caps = directive.capabilities || [];
  const comboValidation = validateCapabilityCombination(caps);
  if (!comboValidation.ok) {
    warnings.push(...comboValidation.issues);
  }

  // Step 2: Resolve visual events to objects
  const allObjects = [];
  const events = directive.visual_events || [];
  for (const event of events) {
    const { objects, warnings: eventWarnings } = resolveVisualEvent(event, text);
    allObjects.push(...objects);
    warnings.push(...eventWarnings);
  }

  // Step 3: If no events resolved, try direct object specification
  if (allObjects.length === 0 && directive.objects) {
    for (const obj of directive.objects) {
      if (PRIMITIVES[obj.kind]) {
        allObjects.push({
          kind: obj.kind,
          anchor: obj.anchor || "center",
          motion: obj.motion || "appear",
          count: obj.count,
          scale: obj.scale,
          label: obj.label || "",
        });
      } else {
        warnings.push(`Unknown primitive: ${obj.kind}`);
      }
    }
  }

  // Step 4: Build the scene
  const scene = {
    narrative_role: directive.narrative_role || "statement",
    mechanism: directive.mechanism || "CAPABILITY",
    reason: directive.reason || "capability-based scene",
    subject: directive.subject || "",
    material: directive.material || "abstract",
    objects: allObjects,
    shots: directive.shots || [
      { phase: 0, phaseDuration: 1, camera: "hold", focus: "center" },
    ],
    typography: {
      role: directive.typography?.role || "primary",
      style: directive.typography?.style || "kinetic",
      emphasis_words: directive.typography?.emphasis_words || [],
    },
  };

  // Step 5: Validate the scene
  const validation = validateScene(scene);
  if (!validation.ok) {
    errors.push(...validation.errors);
  }
  warnings.push(...validation.warnings);

  // Step 6: Ensure minimum coverage
  if (allObjects.length > 0 && validation.coverage < MIN_SCENE_COVERAGE) {
    warnings.push(
      `Scene coverage ${(validation.coverage * 100).toFixed(0)}% is below minimum ${(MIN_SCENE_COVERAGE * 100).toFixed(0)}% — adding ground plane`
    );
    scene.objects.unshift({
      kind: "field",
      anchor: "center",
      motion: "appear",
    });
  }

  return { scene, warnings, errors };
}

/* ── Backward Compatibility ─────────────────────────────────────────── */

/**
 * Check if a directive uses the old mechanism-based format.
 */
export function isMechanismBased(directive) {
  return directive && directive.mechanism && !directive.visual_events && !directive.capabilities;
}

/**
 * Convert an old mechanism-based directive to capability-based format.
 * This provides backward compatibility during the transition.
 */
export function mechanismToCapability(directive) {
  if (!directive) return null;

  const caps = [];
  const events = [];

  switch (directive.mechanism) {
    case "STATE_CHANGE":
      caps.push("contrast");
      events.push({
        type: "contrast",
        before: directive.objects?.label_a || "",
        after: directive.objects?.label_b || "",
      });
      break;

    case "EVIDENCE_FIGURE":
      caps.push("evidence");
      events.push({
        type: "evidence",
        label: directive.objects?.figure || directive.visual_headline || "",
        context: directive.subject || "",
      });
      break;

    case "ACTION_CONSEQUENCE":
      caps.push("causation");
      events.push({
        type: "causation",
        cause: directive.objects?.cause || "",
        effect: directive.objects?.effect || "",
      });
      break;

    case "PHYSICAL_GROWTH":
      caps.push("growth");
      events.push({
        type: "growth",
        label: directive.subject || "",
        magnitude: directive.objects?.figure || directive.visual_headline || "",
      });
      break;

    case "VISIBLE_CONSUMPTION":
      caps.push("depletion");
      events.push({
        type: "depletion",
        label: directive.objects?.consumed?.label || "",
      });
      break;

    case "SURFACE_AND_BENEATH":
      caps.push("revelation");
      events.push({
        type: "revelation",
        label: directive.objects?.surface?.label || "",
        hiddenContent: directive.objects?.beneath?.label || "",
      });
      break;

    case "PROPORTIONAL_OBJECTS":
      caps.push("comparison");
      events.push({
        type: "comparison",
        labelA: directive.objects?.amount_a?.label || "",
        labelB: directive.objects?.amount_b?.label || "",
      });
      break;

    case "STRUCTURAL_BREAKDOWN":
      caps.push("structure_break");
      events.push({
        type: "structure_break",
        label: directive.subject || "",
      });
      break;

    case "TYPOGRAPHY":
      caps.push("typographic_emphasis");
      break;

    default:
      caps.push("typographic_emphasis");
  }

  return {
    ...directive,
    capabilities: caps,
    visual_events: events,
  };
}

/* ── Capability Digest for Prompts ──────────────────────────────────── */

/**
 * Generate a compact capability digest for Gemini's prompt.
 * Lists what Gemini can request, not how it's built.
 */
export function compactCapabilityDigest() {
  const lines = [];

  lines.push("## VISUAL CAPABILITIES (what you can request):");
  lines.push("");
  lines.push("### Visual Events:");
  lines.push("  growth: something physically expands to show increase");
  lines.push("  depletion: a container visibly empties to show consumption");
  lines.push("  comparison: two quantities at honest scale side by side");
  lines.push("  revelation: surface claim is displaced by hidden reality");
  lines.push("  structure_break: a structured object fractures");
  lines.push("  accumulation: objects building up over time");
  lines.push("  population: silhouettes showing scale/crowd");
  lines.push("  evidence: a large number presented as proof");
  lines.push("  contrast: before state struck, after state rises");
  lines.push("  causation: cause → arrow → effect");
  lines.push("");
  lines.push("### Typography:");
  lines.push("  typographic_emphasis: one short centred line (max 7 words)");
  lines.push("  Use for: hook, re_hook, key_fact, contradiction, question, statement");
  lines.push("  NEVER as fallback for beats you couldn't think of a visual for");
  lines.push("");
  lines.push("### Composition Rules:");
  lines.push("  - Combine capabilities freely");
  lines.push("  - A scene must cover ≥35% of the frame");
  lines.push("  - At most 8 objects per scene");
  lines.push("  - Labels are data, not headlines");
  lines.push("  - The system validates combinations and provides semantic fallbacks");

  return lines.join("\n");
}
