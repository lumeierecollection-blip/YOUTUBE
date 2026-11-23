import React from "react";
import { Composition, CalculateMetadataFunction } from "remotion";
import { AIShort, AIShortProps } from "./AIShort";
import s16 from "../../plans/16-openai-sandbox-breakout.plan.json";
import s17 from "../../plans/17-gpt62-price-war.plan.json";
import s18 from "../../plans/18-frontier-ai-court-freeze.plan.json";
import s19 from "../../plans/19-ai-built-shooter.plan.json";
import s20 from "../../plans/20-google-tabletop-builds-tools.plan.json";

const stories = [s16, s17, s18, s19, s20] as any[];
const calc: CalculateMetadataFunction<AIShortProps> = async ({ props }) => {
  const dur = Math.max(20, (props.audioDurationSec || props.plan.duration_target_sec || 30) + 0.6);
  return { durationInFrames: Math.ceil(dur * 30), props };
};

export const RemotionRoot: React.FC = () => (
  <>
    {stories.map((s) => (
      <Composition key={s.id} id={`Short-${s.id}`} component={AIShort}
        durationInFrames={Math.ceil(((s.beats?.reduce((a:any,b:any)=>a+(b.dur||0),0)) || 30) + 1.2) * 30}
        fps={30} width={1080} height={1920}
        defaultProps={{ plan: s, audioSrc: `audio/${s.id}.mp3`, audioDurationSec: (s.beats?.reduce((a:any,b:any)=>a+(b.dur||0),0)) || 30 } as AIShortProps}
        calculateMetadata={calc} />
    ))}
  </>
);
