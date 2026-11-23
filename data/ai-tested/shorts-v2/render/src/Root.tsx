import React from "react";
import { Composition, CalculateMetadataFunction } from "remotion";
import { AIShort, AIShortProps } from "./AIShort";
import s06 from "../../scripts/06-gpt-6-2-astra-sol-v2.json";
import s07 from "../../scripts/07-california-sues-openai-v2.json";
import s08 from "../../scripts/08-nonprofits-freeze-frontier-ai-v2.json";
import s09 from "../../scripts/09-saltline-ai-game-v2.json";
import s10 from "../../scripts/10-google-tabletop-v2.json";

const stories = [s06, s07, s08, s09, s10] as any[];
const calc: CalculateMetadataFunction<AIShortProps> = async ({ props }) => {
  const dur = Math.max(30, (props.audioDurationSec || props.story.duration_target_sec) + 0.8);
  return { durationInFrames: Math.ceil(dur * 30), props };
};

export const RemotionRoot: React.FC = () => (
  <>
    {stories.map((s) => (
      <Composition key={s.id} id={`Short-${s.id}`} component={AIShort}
        durationInFrames={Math.ceil((s.duration_target_sec + 1.2) * 30)} fps={30} width={1080} height={1920}
        defaultProps={{ story: s, audioSrc: `audio/${s.id}.mp3`, audioDurationSec: s.duration_target_sec } as AIShortProps}
        calculateMetadata={calc} />
    ))}
  </>
);
