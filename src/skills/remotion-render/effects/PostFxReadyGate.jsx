import React from "react";
import { useThree } from "@react-three/fiber";
import { useDelayRender, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Shared by every ThreeCanvas + @react-three/postprocessing <EffectComposer>
 * consumer in this render package (PhotoTreatment.jsx, CanvasGrain.jsx).
 * See PhotoTreatment.jsx's file-header comment ("Rendering sync, part 2")
 * for the full diagnosis: EffectComposer builds its actual composer inside
 * a passive (not layout) useEffect and claims R3F's render priority, so
 * nothing paints — not even the raw scene — until a second React cycle
 * lands, which ThreeCanvas's Suspense-driven "ready" signal has no way to
 * know about. This closes that gap explicitly: holds its own delayRender
 * and retries advance() across real render cycles until the composer's
 * own ref confirms it's live, then releases.
 *
 * Registration AND retries both live inside a single mount-only effect —
 * never in the render body, not even ref-guarded (a real, confirmed bug:
 * React can invoke a component's render function more than once for what
 * becomes ONE logical mount while a Suspense boundary above it resolves;
 * a side effect like delayRender() in the render body runs for both
 * invocations, permanently orphaning one handle since only one fiber ever
 * gets a real commit + effect cycle to release it).
 */
const MAX_RETRIES = 20;
const RETRY_DELAY_MS = 30;

export function PostFxReadyGate({ composerRef, label = "PostFx" }) {
  const { advance } = useThree();
  const { delayRender, continueRender } = useDelayRender();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /**
   * THE CLOCK IS THE TIMELINE, NOT THE WALL.
   *
   * This used to call `advance(performance.now())`. R3F derives its frame
   * delta from the timestamp it is handed, so feeding it wall-clock time
   * made every post-fx effect's phase depend on how long this particular
   * render took — the animated grain in CanvasGrain landed somewhere
   * different on every run.
   *
   * That silently broke the guarantee asserted all over this package
   * ("same script, same pixels"; composition.js, director.js,
   * sound-design.js all state it). It was caught by rendering the SAME
   * commit twice and diffing the frame metrics: the TIMELINE anchor set
   * moved by up to 2.4 points of ink and 28 points of bbox height between
   * two runs of identical code, which is more than most real changes move
   * them — i.e. it was large enough to fake or mask a regression in any
   * before/after comparison, which is exactly what it did once here.
   *
   * The retry loop below re-advances with the SAME timestamp, which is
   * correct: retries exist to give the composer another React cycle, not
   * to move time forward. A still frame should not age while it waits.
   */
  const timelineMs = (frame / (fps || 30)) * 1000;

  React.useEffect(() => {
    const handle = delayRender(`Waiting for ${label}'s EffectComposer to paint a real frame`);
    let released = false;
    let attempts = 0;
    let timeoutId = null;

    function attempt() {
      if (released) return;
      advance(timelineMs);
      attempts += 1;
      if (composerRef.current) {
        released = true;
        continueRender(handle);
        return;
      }
      if (attempts >= MAX_RETRIES) {
        console.warn(
          `${label}: EffectComposer did not become ready after ${MAX_RETRIES} attempts — releasing Remotion's render anyway. This frame likely has no post-fx treatment; investigate before trusting this render.`
        );
        released = true;
        continueRender(handle);
        return;
      }
      timeoutId = setTimeout(attempt, RETRY_DELAY_MS);
    }
    attempt();

    return () => {
      released = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default PostFxReadyGate;
