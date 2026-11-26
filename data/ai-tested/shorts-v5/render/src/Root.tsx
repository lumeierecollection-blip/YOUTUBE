import React from "react";
import { Composition, CalculateMetadataFunction } from "remotion";
import { AIShort, AIShortProps } from "./AIShort";
import { Short, ShortProps } from "./Short";
import { IFShort } from "./IF";

const IDS = ["21", "22", "23", "24", "25", "26"];

const isV7 = (plan: any) => plan?.schema === 7 || (Array.isArray(plan?.beats) && plan.beats[0] && ("pics" in plan.beats[0] || "text" in plan.beats[0]));

const AnyShort: React.FC<any> = (props) => {
  if (isV7(props.plan)) return <Short {...(props as ShortProps)} />;
  return <AIShort {...(props as AIShortProps)} />;
};

const calc: CalculateMetadataFunction<any> = async ({ props }) => {
  const plan = props.plan || {};
  const planEnd = (s: any) => (s.beats || []).reduce((m: number, b: any) => Math.max(m, (b.t || 0) + (b.dur || 0)), 30);
  const dur = (props.audioDurationSec || planEnd(plan)) + 0.5;
  return { durationInFrames: Math.max(30, Math.ceil(dur * 30)), props };
};

const stubV5 = (id: string): any => ({ id, slug: "stub", title: "stub", theme: { bg: "#fff", bg2: "#eee", ink: "#111", muted: "#666", accent: "#f00", accent2: "#0f0", accent3: "#00f", panel: "#fff", panelInk: "#111", line: "#ddd", texture: "none", display: "anton" }, beats: [], audio: { sfx: [] } });

const calcIF: CalculateMetadataFunction<any> = async ({ props }) => ({ durationInFrames: Math.max(30, Math.ceil(((props.audioDurationSec || 30) + 0.5) * 30)), props });

export const RemotionRoot: React.FC = () => (<>
  <Composition id="IF-25" component={IFShort as any} durationInFrames={30 * 30} fps={30} width={1080} height={1920}
    defaultProps={{ plan: { scenes: [{ t0: 0, t1: 99, els: [] }], sfx: [], watermark: "AI Tested" }, audioSrc: "if/25.mp3", audioDurationSec: 30 } as any}
    calculateMetadata={calcIF} />
  {IDS.map((id) => (
    <Composition key={id} id={`Short-${id}`} component={AnyShort}
      durationInFrames={30 * 30} fps={30} width={1080} height={1920}
      defaultProps={{ plan: stubV5(id), audioSrc: `audio/${id}.mp3`, audioDurationSec: 30 } as any}
      calculateMetadata={calc} />
  ))}
</>);
