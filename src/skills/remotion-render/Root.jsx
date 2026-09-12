import { registerRoot, Composition } from "remotion";
import { compositions as cinematicDocumentary } from "./compositions/cinematic-documentary.jsx";
import { compositions as minimal } from "./compositions/minimal.jsx";
import { compositions as motionGraphics } from "./compositions/motion-graphics.jsx";
// Step 5 of the addendum: a renderer that is a pure function of a plan. It
// knows nothing about channels or strategies, so it is registered once and
// every channel drives it through inputProps.
import { compositions as templatePlan } from "./compositions/template-scene.jsx";
// A QA-only composition: every registered object drawn once in a known box, so
// one render can prove none of them draws outside the box it was given.
import { compositions as objectAudit } from "./compositions/object-audit.jsx";
// The beat engine: a stage that persists across beats, rather than a scene
// composed from nothing each time. See visual-engine/beat-scene.jsx.
import { compositions as beatSequence } from "./visual-engine/beat-scene.jsx";
// Sentence, then the thing the sentence was about: word-by-word typography
// alternating with one semantically matched visual. See sentence-scene.jsx.
import { compositions as sentenceScene } from "./visual-engine/sentence-scene.jsx";
// Visual Director — treatment-based rendering driven by sentence meaning.
import { compositions as directedScene } from "./visual-engine/directed-scene.jsx";

/**
 * Remotion entry point.
 * Registers all style compositions for rendering.
 */

function RemotionRoot() {
  return (
    <>
      {cinematicDocumentary.map(c => <Composition key={c.id} {...c} />)}
      {minimal.map(c => <Composition key={c.id} {...c} />)}
      {motionGraphics.map(c => <Composition key={c.id} {...c} />)}
      {templatePlan.map(c => <Composition key={c.id} {...c} />)}
      {objectAudit.map(c => <Composition key={c.id} {...c} />)}
      {beatSequence.map(c => <Composition key={c.id} {...c} />)}
      {sentenceScene.map(c => <Composition key={c.id} {...c} />)}
      {directedScene.map(c => <Composition key={c.id} {...c} />)}
    </>
  );
}

registerRoot(RemotionRoot);
