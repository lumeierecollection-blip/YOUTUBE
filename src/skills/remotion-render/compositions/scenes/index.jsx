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
      <Component beat={beat} colors={colors} fontFamily={fontFamily} />
    );
  }

  return (
    <Shot shot={shot} states={beat.visualStates} durationInFrames={beat.durationInFrames}>
      <Ground material={shot.material} colors={colors} seed={(beat.startFrame || 0) + 1} />
      <Component beat={beat} colors={colors} fontFamily={fontFamily} />
    </Shot>
    {/* Light falloff sits OUTSIDE the camera transform: the frame is lit,
        not the world, so a push-in does not drag the vignette with it. */}
    <Falloff colors={colors} strength={0.4} />
  );
}

/**
 * Beat-level scene composition (Cinematic Documentary).
 *
 * The beat's strategy selects a shot through composition.js's shotOf. That
 * shot names the material, framing, depth and camera — the four
 * art-direction decisions every scene must own. This component draws the
 * shot's primitives, its sustain states, and its caption.
 *
 * SHOT:  the strategy's named shot (a frame from the reference grammar)
 * STATES:  sustaining states (reframe / detail / settle) densify long beats
 *          without adding new meaning — they keep the picture alive.
 * CAPTION:  the sentence's pull phrase, drawn once per beat, bottom zone.
 *
 * The camera is SHOT.CAMERA. No automatic drift, no sustain push — a shot
 * moves when the strategy says it moves, and only then.
 */
