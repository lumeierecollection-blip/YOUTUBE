import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, Chrome, Theme, asset, clamp, OUT } from "./kit";
import { Beat, SCENES } from "./scenes";

export type SfxEvent = { src: string; t: number; volume?: number; dur?: number; purpose?: string };
export type Plan = {
  id: string; slug: string; title: string; schema?: number;
  theme: Theme;
  beats: Beat[];
  audio?: {
    music?: { src: string; volume?: number; fadeIn?: number; fadeOut?: number; duck?: number };
    ambience?: { src: string; volume?: number };
    sfx?: SfxEvent[];
  };
};
export type AIShortProps = { plan: Plan; audioSrc: string; audioDurationSec: number };

const OV = 0.28;

const Transition: React.FC<{ kind?: string; th: Theme; children: React.ReactNode }> = ({ kind = "cut", th, children }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const p = OUT(clamp(t / OV, 0, 1));
  let style: React.CSSProperties = {};
  let overlay: React.ReactNode = null;
  if (kind === "wipe") {
    style = { clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` };
    overlay = t < OV ? <div style={{ position: "absolute", top: 0, bottom: 0, left: `${p * 100 - 4}%`, width: "4%", background: th.accent, opacity: 1 - p * 0.3 }} /> : null;
  } else if (kind === "push") style = { transform: `translateY(${(1 - p) * 100}%)` };
  else if (kind === "slide") style = { transform: `translateX(${(1 - p) * 100}%)` };
  else if (kind === "zoom") style = { transform: `scale(${1.12 - p * 0.12})`, opacity: clamp(t / (OV * 0.7), 0, 1) };
  else if (kind === "flash") overlay = <AbsoluteFill style={{ background: th.mode === "dark" ? "#fff" : th.accent, opacity: clamp(1 - t / 0.22, 0, 1) * 0.85 }} />;
  else if (kind === "iris") style = { clipPath: `circle(${p * 150}% at 50% 50%)` };
  return <AbsoluteFill style={style}>{children}{overlay}</AbsoluteFill>;
};

const BeatView: React.FC<{ beat: Beat; th: Theme; seed: number }> = ({ beat, th, seed }) => {
  const Scene = SCENES[beat.scene];
  const mt: Theme = { ...th, ...(beat.theme || {}) } as Theme;
  if (beat.accent) mt.accent = beat.accent;
  return <Transition kind={beat.transition} th={mt}>
    <Backdrop th={mt} seed={seed} />
    {Scene ? <Scene beat={beat} th={mt} /> : <AbsoluteFill style={{ background: "#f0f", color: "#fff", fontSize: 60 }}>UNKNOWN SCENE {beat.scene}</AbsoluteFill>}
  </Transition>;
};

export const AIShort: React.FC<AIShortProps> = ({ plan, audioSrc }) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = f / fps;
  const total = durationInFrames / fps;
  const beats = plan.beats;
  const th = plan.theme;
  const cur = Math.max(0, beats.reduce((acc, b, i) => (t >= b.t ? i : acc), 0));
  const curTheme: Theme = { ...th, ...(beats[cur]?.theme || {}) } as Theme;
  if (beats[cur]?.accent) curTheme.accent = beats[cur].accent as string;
  const a = plan.audio || {};
  const mu = a.music;
  const musicVol = (fr: number) => {
    if (!mu) return 0;
    const base = mu.volume ?? 0.16;
    const s = fr / fps;
    const fin = interpolate(s, [0, mu.fadeIn ?? 0.8], [0, 1], { extrapolateRight: "clamp" });
    const fout = interpolate(s, [total - (mu.fadeOut ?? 1.4), total], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const duck = (a.sfx || []).reduce((m, e) => { const d = Math.abs(s - e.t); return d < 0.35 ? Math.min(m, 1 - (mu.duck ?? 0.35) * (1 - d / 0.35)) : m; }, 1);
    return base * fin * fout * duck;
  };
  const ambVol = (fr: number) => {
    const am = a.ambience; if (!am) return 0;
    const s = fr / fps;
    return (am.volume ?? 0.08) * interpolate(s, [0, 1, total - 1.2, total], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  };
  return <AbsoluteFill style={{ background: th.bg }}>
    {beats.map((b, i) => {
      const from = Math.round(b.t * fps);
      const end = i === beats.length - 1 ? durationInFrames : Math.round((b.t + b.dur + OV) * fps);
      return <Sequence key={i} from={from} durationInFrames={Math.max(1, Math.min(end, durationInFrames) - from)} layout="none">
        <AbsoluteFill><BeatView beat={b} th={th} seed={i * 1.7} /></AbsoluteFill>
      </Sequence>;
    })}
    <Chrome th={curTheme} index={cur} total={beats.length} progress={clamp(t / total, 0, 1)} />
    {audioSrc ? <Audio src={asset(audioSrc)!} volume={1} /> : null}
    {mu?.src ? <Audio src={asset(mu.src)!} volume={musicVol} loop /> : null}
    {a.ambience?.src ? <Audio src={asset(a.ambience.src)!} volume={ambVol} loop /> : null}
    {(a.sfx || []).map((s, i) => <Sequence key={`sfx${i}`} from={Math.max(0, Math.round(s.t * fps))} durationInFrames={Math.max(2, Math.round((s.dur ?? 3) * fps))} layout="none">
      <Audio src={asset(s.src)!} volume={s.volume ?? 0.7} />
    </Sequence>)}
  </AbsoluteFill>;
};
