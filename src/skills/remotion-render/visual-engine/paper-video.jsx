/**
 * PaperVideo — the reference style (docs/REFERENCE-STYLE.md), whole video.
 *
 * Static camera, as measured: the studio, the branding rail and the paper
 * are placed ONCE and never move or cut; the paper is centred in the 9:16
 * frame. Only the paper's content changes per beat (PaperContent builds and
 * clears on the same page). No timeline footer, no phone wrapper, no pasted
 * rectangular photo: a beat shows a system-drawn visual, an isolated
 * cutout, or type.
 *
 * Each beat's content is `beat.scene.paper`, built by the asset resolver
 * in render-and-qa.js from the plan and resolved cutouts. No mechanism
 * scene, drawing or primitive is called on this path.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { StudioBG } from "../visual/studio-bg.jsx";
import { BrandingRail } from "../visual/branding-rail.jsx";
import { Paper, PaperContent } from "../visual/paper-stage.jsx";

export function PaperVideo({ plan }) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const beats = plan.beats || [];
  const i = Math.max(0, beats.findIndex((b) => frame >= b.start_frame && frame < b.start_frame + b.duration_frames));
  const beat = beats[i] || beats[beats.length - 1];
  const content = beat?.scene?.paper;
  if (beat && !content) {
    throw new Error(`PaperVideo: beat ${i} has no paper content — the asset resolver should have built it or failed the render`);
  }
  const local = beat ? frame - beat.start_frame : 0;
  return (
    <StudioBG>
      <BrandingRail text={plan.railText} />
      <Paper>
        {/* No body paragraph. The narration sentence was used as the tiny body
            text, and the reviewer (run 36369197918 ch-2) read it as "verbatim
            caption tracks" — a subtitle of the voiceover. The reference's body
            copy is not the narration, and filler text would be invented. */}
        {content ? <PaperContent key={i} c={{ ...content, body: null, spoken: beat.spoken }} local={local} dur={beat.duration_frames} fps={fps} /> : null}
      </Paper>
    </StudioBG>
  );
}

export default PaperVideo;
