import React from "react";
import { Composition, CalculateMetadataFunction } from "remotion";
import { IFShort } from "./IF";

const calcIF: CalculateMetadataFunction<any> = async ({ props }) => ({ durationInFrames: Math.max(30, Math.ceil(((props.audioDurationSec || 30) + 0.5) * 30)), props });

export const RemotionRoot: React.FC = () => (
  <Composition id="IF-25" component={IFShort as any} durationInFrames={30 * 30} fps={30} width={1080} height={1920}
    defaultProps={{ plan: { scenes: [{ t0: 0, t1: 99, els: [] }], sfx: [], watermark: "AI Tested" }, audioSrc: "if/25.mp3", audioDurationSec: 30 } as any}
    calculateMetadata={calcIF} />
);
