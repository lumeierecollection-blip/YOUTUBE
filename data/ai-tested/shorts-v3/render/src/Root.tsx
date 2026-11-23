import React from "react";
import { Composition, CalculateMetadataFunction } from "remotion";
import { AIShort, AIShortProps } from "./AIShort";
import s11 from "../../scripts/11-gpt62-race.json";
import s12 from "../../scripts/12-california-openai-lawsuit.json";
import s13 from "../../scripts/13-ai-giants-lawsuit.json";
import s14 from "../../scripts/14-saltline-ai-game.json";
import s15 from "../../scripts/15-google-tabletop.json";

const stories = [s11, s12, s13, s14, s15] as any[];
const calc: CalculateMetadataFunction<AIShortProps> = async ({ props }) => {
  const dur = Math.max(20, (props.audioDurationSec || props.story.duration_target_sec) + 0.6);
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
