/**
 * PaperVideo — the reference style (docs/REFERENCE-STYLE.md), whole video.
 *
 * Static camera, as measured: the studio, the branding rail, the paper and
 * the timeline device are placed ONCE and never move or cut. Only the
 * paper's content changes per beat (PaperContent builds and clears on the
 * same page); the timeline playhead travels across the whole video.
 *
 * Each beat's content is `beat.scene.paper`, built by the asset resolver
 * in render-and-qa.js from the plan and resolved cutouts. No mechanism
 * scene, drawing or primitive is called on this path.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { StudioBG } from "../visual/studio-bg.jsx";
import { BrandingRail } from "../visual/branding-rail.jsx";
import { TimelineFooter } from "../visual/timeline-footer.jsx";
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
        {/* The tiny body paragraph is the narration sentence itself (the cue). */}
        {content ? <PaperContent key={i} c={{ ...content, body: content.body || beat.original_text || null }} local={local} dur={beat.duration_frames} fps={fps} /> : null}
      </Paper>
      <TimelineFooter seed={plan.railText || "0"} progress={frame / Math.max(1, durationInFrames - 1)} />
    </StudioBG>
  );
}

export default PaperVideo;
