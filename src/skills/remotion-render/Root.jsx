import { registerRoot, Composition } from "remotion";
import { compositions as cinematicDocumentary } from "./compositions/cinematic-documentary.jsx";
import { compositions as minimal } from "./compositions/minimal.jsx";
import { compositions as motionGraphics } from "./compositions/motion-graphics.jsx";
import { compositions as directedScene } from "./visual-engine/directed-scene.jsx";
import { compositions as editorTimeline } from "./editor/EditorTimeline.jsx";
import { compositions as voxStill } from "./effects/VoxStill.jsx";

// Each channel registers its own compositions by adding channels/<key>/compositions.jsx; nobody edits this file to add one.
const channelContext = require.context("./channels", true, /compositions\.jsx$/);
const channelCompositions = channelContext.keys().flatMap((k) => channelContext(k).compositions || []);

function RemotionRoot() {
  return (
    <>
      {cinematicDocumentary.map(c => <Composition key={c.id} {...c} />)}
      {minimal.map(c => <Composition key={c.id} {...c} />)}
      {motionGraphics.map(c => <Composition key={c.id} {...c} />)}
      {directedScene.map(c => <Composition key={c.id} {...c} />)}
      {editorTimeline.map(c => <Composition key={c.id} {...c} />)}
      {voxStill.map(c => <Composition key={c.id} {...c} />)}
      {channelCompositions.map(c => <Composition key={c.id} {...c} />)}
    </>
  );
}

registerRoot(RemotionRoot);
