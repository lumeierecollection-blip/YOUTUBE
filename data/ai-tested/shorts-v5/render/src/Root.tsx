import React from "react";
import { Composition, CalculateMetadataFunction } from "remotion";
import { Short, ShortProps, Plan } from "./Short";

const IDS = ["21", "22", "23", "24", "25"];
const stub = (id: string): Plan => ({ id, slug: "stub", title: "stub", schema: 7, words: [], beats: [], audio: { sfx: [] } });
const calc: CalculateMetadataFunction<ShortProps> = async ({ props }) => ({
  durationInFrames: Math.max(30, Math.ceil(((props.audioDurationSec || 1) + 0.5) * 30)),
  props,
});
export const RemotionRoot: React.FC = () => (<>
  {IDS.map((id) => (
    <Composition key={id} id={`Short-${id}`} component={Short} durationInFrames={30 * 30} fps={30} width={1080} height={1920}
      defaultProps={{ plan: stub(id), audioSrc: "", audioDurationSec: 30 } as ShortProps} calculateMetadata={calc} />
  ))}
</>);
