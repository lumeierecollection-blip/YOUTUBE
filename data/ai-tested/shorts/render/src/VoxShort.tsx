import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { loadFont as loadArchivo } from "@remotion/google-fonts/ArchivoBlack";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: archivo } = loadArchivo();
const { fontFamily: inter } = loadInter();

export type Scene = { t: number; dur: number; caption: string[]; visual: string };
export type Story = { id: string; slug: string; title: string; script: string; sources: string[]; scenes: Scene[]; duration_target_sec: number };
export type VoxShortProps = { story: Story; audioSrc: string; audioDurationSec: number };

const P = {
  paper: "#f2ecdf",
  paperDeep: "#e9e1cf",
  ink: "#161513",
  yellow: "#ffd200",
  red: "#e5483f",
  cobalt: "#2f5fe8",
};

const Grain: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.55, backgroundImage: `radial-gradient(circle at 1px 1px, rgba(22,21,19,0.05) 1px, transparent 0), radial-gradient(circle at 3px 2px, rgba(22,21,19,0.035) 1px, transparent 0), radial-gradient(circle at 2px 5px, rgba(255,255,255,0.05) 1px, transparent 0)`, backgroundSize: "3px 3px,5px 5px,7px 7px" }} />
);

const PaperEdge: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse at center, transparent 62%, rgba(22,21,19,0.07) 100%)" }} />
);

const DotField: React.FC<{ style?: React.CSSProperties; coarse?: boolean }> = ({ style, coarse }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const step = Math.round((durationInFrames / 30) * 12);
  const stepped = Math.floor((frame / Math.max(1, durationInFrames)) * step);
  const offset = stepped * (coarse ? 30 : 18);
  return <div style={{ position: "absolute", width: 700, height: 700, backgroundImage: `radial-gradient(circle, rgba(22,21,19,${coarse ? 0.10 : 0.13}) ${coarse ? 3.5 : 2.2}px, transparent ${coarse ? 4 : 2.6}px)`, backgroundSize: coarse ? "30px 30px" : "18px 18px", backgroundPosition: `${offset}px ${offset}px`, ...style }} />;
};

const SheetWipe: React.FC<{ progress: number }> = ({ progress }) => {
  const x = interpolate(progress, [0, 1], [-130, 230]);
  return <div style={{ position: "absolute", top: "-5%", bottom: "-5%", left: "-10%", right: "-10%", background: P.paperDeep, borderLeft: `6px solid ${P.ink}`, borderRight: `6px solid ${P.ink}`, transform: `translateX(${x}%)`, zIndex: 100 }} />;
};

const Highlight: React.FC<{ children: React.ReactNode; active: boolean; delay?: number }> = ({ children, active }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 8, fps, config: { damping: 200 }, durationInFrames: 14 });
  const scaleX = active ? Math.max(0, Math.min(1, p)) : 0;
  return (
    <span style={{ position: "relative", display: "inline-block", zIndex: 0 }}>
      <span style={{ position: "absolute", zIndex: -1, inset: "8% -0.08em -2% -0.08em", background: P.yellow, transform: `scaleX(${scaleX})`, transformOrigin: "left center" }} />
      {children}
    </span>
  );
};

const Stamp: React.FC<{ text: string; color?: string; style?: React.CSSProperties }> = ({ text, color = P.red, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 18, fps, config: { damping: 12, mass: 0.6 } });
  return (
    <div style={{ position: "absolute", fontFamily: inter, fontWeight: 800, fontSize: 34, letterSpacing: "0.12em", color, border: `5px solid ${color}`, padding: "12px 22px", background: "#fff", boxShadow: "6px 7px 0 rgba(22,21,19,0.16)", transform: `rotate(6deg) scale(${Math.max(0, s)})`, ...style }}>
      {text}
    </div>
  );
};

const SceneCard: React.FC<{ scene: Scene; index: number; total: number; story: Story }> = ({ scene, index, total, story }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 16 });
  const y = interpolate(enter, [0, 1], [60, 0]);
  const op = interpolate(enter, [0, 1], [0, 1]);
  const drift = interpolate(frame, [0, durationInFrames], [1, 1.02]);
  const wipeOut = interpolate(frame, [durationInFrames - 10, durationInFrames - 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const captionTop = scene.caption[0] || "";
  const captionBottom = scene.caption[1] || "";
  const isClose = scene.visual === "close";
  const accent = index % 2 === 0 ? P.yellow : P.cobalt;
  return (
    <AbsoluteFill style={{ background: P.paper, overflow: "hidden" }}>
      <DotField style={{ top: -180, left: -180 }} />
      <DotField coarse style={{ bottom: -180, right: -180 }} />
      <div style={{ position: "absolute", inset: 0, transform: `scale(${drift})`, opacity: op }}>
        <div style={{ position: "absolute", top: 110, left: 70, fontFamily: inter, fontWeight: 700, fontSize: 28, letterSpacing: "0.22em", color: P.ink, opacity: 0.7 }}>AI TESTED</div>
        <div style={{ position: "absolute", top: 110, right: 70, fontFamily: inter, fontWeight: 700, fontSize: 28, letterSpacing: "0.18em", color: P.ink, opacity: 0.55 }}>{String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}</div>
        <div style={{ position: "absolute", left: 80, right: 80, top: 420, transform: `translateY(${y}px)` }}>
          <div style={{ fontFamily: inter, fontWeight: 800, fontSize: 42, letterSpacing: "0.2em", color: P.red, marginBottom: 28 }}>{captionTop}</div>
          <div style={{ fontFamily: archivo, fontSize: captionBottom.length > 14 ? 92 : 112, lineHeight: 0.95, color: P.ink, textTransform: "uppercase", wordBreak: "break-word" }}>
            {isClose ? <Highlight active>{captionBottom}</Highlight> : captionBottom.split(" ").map((w, i) => i === 0 ? <span key={i}><Highlight active>{w}</Highlight> </span> : <span key={i}>{w} </span>)}
          </div>
        </div>
        <div style={{ position: "absolute", left: 80, right: 80, bottom: 260, border: `5px solid ${P.ink}`, background: "#fff", boxShadow: "10px 12px 0 rgba(22,21,19,0.16)", padding: "34px 36px", transform: `rotate(${-1 + (index % 3) * 0.6}deg)` }}>
          <div style={{ fontFamily: inter, fontWeight: 800, fontSize: 30, letterSpacing: "0.08em", color: P.red, marginBottom: 12 }}>AI TESTED // {story.slug.replace(/-/g, " ").toUpperCase()}</div>
          <div style={{ fontFamily: inter, fontWeight: 600, fontSize: 38, lineHeight: 1.35, color: P.ink }}>{story.scenes[index] ? story.scenes[index].caption.join(" — ") : ""}</div>
          <div style={{ marginTop: 18, height: 10, background: accent, width: `${interpolate(frame, [0, durationInFrames * 0.7], [0, 100], { extrapolateRight: "clamp" })}%` }} />
        </div>
        {index === 0 && <Stamp text="TRENDING" style={{ top: 170, right: 90 }} />}
        {isClose && <Stamp text="AI TESTED" color={P.cobalt} style={{ bottom: 170, right: 90, transform: undefined }} />}
      </div>
      <PaperEdge />
      <Grain />
      {wipeOut > 0 && <SheetWipe progress={wipeOut} />}
    </AbsoluteFill>
  );
};

export const VoxShort: React.FC<VoxShortProps> = ({ story, audioSrc, audioDurationSec }) => {
  const { fps } = useVideoConfig();
  const totalDur = audioDurationSec + 0.8;
  return (
    <AbsoluteFill style={{ background: P.paper }}>
      <Audio src={staticFile(audioSrc)} />
      {story.scenes.map((scene, i) => {
        const from = Math.round(scene.t * fps);
        const dur = Math.round(scene.dur * fps);
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <SceneCard scene={scene} index={i} total={story.scenes.length} story={story} />
          </Sequence>
        );
      })}
      {/* end pad */}
      <Sequence from={Math.round(totalDur * fps) - 6} durationInFrames={6}>
        <AbsoluteFill style={{ background: P.paperDeep }} />
      </Sequence>
    </AbsoluteFill>
  );
};
