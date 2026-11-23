import React from "react";
import { Composition, CalculateMetadataFunction } from "remotion";
import { VoxShort, VoxShortProps } from "./VoxShort";
import s01 from "../../scripts/01-openai-gpt-6-2-astra-sol.json";
import s02 from "../../scripts/02-california-sues-openai.json";
import s03 from "../../scripts/03-nonprofits-sue-ai-giants.json";
import s04 from "../../scripts/04-saltline-ai-game.json";
import s05 from "../../scripts/05-google-tabletop.json";

const stories = [s01, s02, s03, s04, s05] as any[];

const calc: CalculateMetadataFunction<VoxShortProps> = async ({ props }) => {
  const dur = Math.max(30, (props.audioDurationSec || props.story.duration_target_sec) + 0.8);
  return { durationInFrames: Math.ceil(dur * 30), props };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {stories.map((s) => (
        <Composition
          key={s.id}
          id={`Short-${s.id}`}
          component={VoxShort}
          durationInFrames={Math.ceil((s.duration_target_sec + 1.2) * 30)}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ story: s, audioSrc: `audio/${s.id}.mp3`, audioDurationSec: s.duration_target_sec } as VoxShortProps}
          calculateMetadata={calc}
        />
      ))}
    </>
  );
};
