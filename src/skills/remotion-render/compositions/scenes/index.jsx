import React from "react";
import { useCurrentFrame } from "remotion";
import { stateAt } from "../../visual/states.js";
import { GeospatialRadiusScene } from "./GeospatialRadiusScene.jsx";
import {
  AccumulationScene, TransformationScene, ComparisonScene,
  DataChartScene, ScaleComparisonScene,
} from "./quantity-scenes.jsx";
import {
  TimelineScene, ProcessScene, CauseEffectScene, RelationshipScene,
} from "./structure-scenes.jsx";
import {
  DocumentEvidenceScene, ImageEvidenceScene,
  InterfaceSimulationScene, BeforeAfterScene,
} from "./evidence-scenes.jsx";
import { VisualMetaphorScene, CinematicStatementScene, EnumerationScene } from "./abstract-scenes.jsx";
import { STRATEGIES, TERMINAL_STRATEGY } from "../../visual/strategies.js";
import { Shot, Ground, Falloff } from "./stage.jsx";

/**
 * The semantic scene router.
 *
 * Keyed by the component name each strategy declares in
 * visual/strategies.js, so the registry and the router cannot drift apart:
 * `assertStrategyRegistryIsSound(KNOWN_SCENES)` fails the build the moment
 * a strategy names a component nobody here handles (PART 2's dead-enum
 * rule, enforced mechanically rather than by review).
 */
export const SCENE_COMPONENTS = {
  GeospatialRadiusScene,
  AccumulationScene,
  TransformationScene,
  ComparisonScene,
  DataChartScene,
  ScaleComparisonScene,
  TimelineScene,
  ProcessScene,
  CauseEffectScene,
  RelationshipScene,
  DocumentEvidenceScene,
  ImageEvidenceScene,
  InterfaceSimulationScene,
  BeforeAfterScene,
  VisualMetaphorScene,
  CinematicStatementScene,
  EnumerationScene,
};

export const KNOWN_SCENES = Object.keys(SCENE_COMPONENTS);

/**
 * Render the scene for a planned beat.
 *
 * There is deliberately NO render-time "did that scene draw anything?"
 * wrapper here. A React parent cannot inspect whether a child returned
 * null, so such a wrapper would be theatre. The real guarantee lives one
 * layer up instead, where it can be tested: the director's `unmetNeed`
 * check (visual/director.js) refuses to route a beat to a strategy whose
 * data requirements aren't satisfied, and records the reason. The scenes'
 * own early-null guards are therefore belt-and-braces against a caller
 * bypassing the director — and `visual/run-visual-tests.js` asserts the
 * director never produces such a pairing.
 *
 * An unregistered strategy still falls back here rather than crashing.
 */
export function SemanticScene({ beat, colors, fontFamily }) {
  const plan = beat.visualPlan;
  const def = plan && plan.strategy ? STRATEGIES[plan.strategy] : null;
  const Component = (def && SCENE_COMPONENTS[def.scene]) || SCENE_COMPONENTS[STRATEGIES[TERMINAL_STRATEGY].scene];
  const shot = plan && plan.shot;

  /**
   * THE STAGE IS APPLIED HERE, ONCE, FOR ALL SIXTEEN SCENES.
   *
   * A pixel audit of 23 rendered anchor frames found fifteen of sixteen
   * scenes drawing a hairline diagram under 5% ink, centred within a few
   * percent of the same point. The exception was the map — the only scene
   * that had been given ground, depth, framing and a camera by hand.
   *
   * Doing that per scene is how the monoculture happened: sixteen
   * components each improvising staging with the same primitives converge
   * on the same picture. So the staging comes from ONE place —
   * visual/composition.js decides material/framing/camera/depth per beat,
   * and every scene inherits it whether or not its author thought about it.
   *
   * The scene still owns its SUBJECT. The stage owns the shot.
   */
  if (!shot) {
    // No plan (legacy/classifier beats): behave exactly as before rather
    // than staging something the director never described.
    return (
      <SustainCamera beat={beat}>
        <Component beat={beat} colors={colors} fontFamily={fontFamily} />
      </SustainCamera>
    );
  }

  return (
    <SustainCamera beat={beat}>
      <Shot shot={shot} states={beat.visualStates} durationInFrames={beat.durationInFrames}>
        <Ground material={shot.material} colors={colors} seed={(beat.startFrame || 0) + 1} />
        <Component beat={beat} colors={colors} fontFamily={fontFamily} />
      </Shot>
      {/* Light falloff sits OUTSIDE the camera transform: the frame is lit,
          not the world, so a push-in does not drag the vignette with it. */}
      <Falloff colors={colors} strength={0.4} />
    </SustainCamera>
  );
}

/**
 * A slow camera move across sustaining states.
 *
 * WHY: states.js densifies a long beat by appending sustaining states
 * (reframe / detail / settle), and the diagnostics counted that as "no
 * static hold". Inspecting a real rendered frame showed the flaw in that
 * reasoning — the scenes only react to their own NAMED states, so a
 * sustaining state subdivided the timeline while the picture sat perfectly
 * still. The metric was honest about state changes and quietly dishonest
 * about visible ones.
 *
 * This makes the sustain real: during sustaining states only, the whole
 * composition drifts and pushes slightly, the way a held shot breathes.
 * It is deliberately small (a few pixels, ~2% scale) — enough that the
 * frame is alive, far short of the "random zooms" PART 17 bans, and it
 * never fires during the states that carry the actual meaning.
 */
function SustainCamera({ beat, children }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const active = stateAt(states, frame);

  if (!active || !active.sustaining) return <>{children}</>;

  // Which sustain is this, so consecutive sustains keep moving the same
  // direction instead of resetting.
  const sustainIndex = states.filter((s) => s.sustaining && s.startFrame <= active.startFrame).length - 1;
  const p = Math.max(0, Math.min(1, (frame - active.startFrame) / Math.max(active.durationInFrames, 1)));
  const eased = p * p * (3 - 2 * p); // smoothstep

  const dir = sustainIndex % 2 === 0 ? 1 : -1;
  const dx = dir * 10 * eased;
  const scale = 1 + 0.018 * eased;

  return (
    <div style={{ position: "absolute", inset: 0, transform: `translateX(${dx}px) scale(${scale})` }}>
      {children}
    </div>
  );
}
