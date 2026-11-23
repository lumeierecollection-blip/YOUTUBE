import React from "react";
import { Composition, CalculateMetadataFunction } from "remotion";
import { AIShort, AIShortProps } from "./AIShort";
import s21 from "../../plans/21-sandbox-escape-lawsuit.plan.json";
import s22 from "../../plans/22-model-price-war.plan.json";
import s23 from "../../plans/23-pause-frontier-ai-case.plan.json";
import s24 from "../../plans/24-one-file-ai-game.plan.json";
import s25 from "../../plans/25-ai-builds-the-app.plan.json";

const stories = [s21,s22,s23,s24,s25] as any[];
const calc: CalculateMetadataFunction<AIShortProps> = async ({ props }) => {
  const dur = Math.max(20, (props.audioDurationSec || props.plan.duration_target_sec || 30) + 0.6);
  return { durationInFrames: Math.ceil(dur * 30), props };
};
export const RemotionRoot: React.FC = () => (<>
  {stories.map((s) => (
    <Composition key={s.id} id={`Short-${s.id}`} component={AIShort}
      durationInFrames={Math.ceil(((s.beats?.reduce((a:any,b:any)=>a+(b.dur||0),0))||30)+1.2)*30}
      fps={30} width={1080} height={1920}
      defaultProps={{ plan:s, audioSrc:`audio/${s.id}.mp3`, audioDurationSec:(s.beats?.reduce((a:any,b:any)=>a+(b.dur||0),0)||30) } as AIShortProps}
      calculateMetadata={calc} />
  ))}
</>);