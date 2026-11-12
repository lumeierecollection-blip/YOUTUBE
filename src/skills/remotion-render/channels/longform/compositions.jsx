// Long-form compositions (1920x1080) for the visual approval gate and, later, production. LfScene renders one scene of one channel; LfTransition shows scene A
// becoming scene B at a chosen progress (so a still at 0, 0.5 and 1 is the real transition); LfThumb is a thumbnail concept. No timeline is rendered.
import React from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { TransitionStage, abs, ramp, W, H } from "./kit.jsx";
import { HiddenPastSceneOnly } from "../hidden-past/longform.jsx";
import { AiTestedSceneOnly, AI_COLORS as AI } from "./ai.jsx";
import { CourtSceneOnly, COURT_COLORS as CT, STATUS } from "./court.jsx";
import { RivalSceneOnly, RIVAL_COLORS as RV } from "./rival.jsx";

const SCENE = { "hidden-past": HiddenPastSceneOnly, "ai-tested": AiTestedSceneOnly, "court-and-spotlight": CourtSceneOnly, "rival-lines": RivalSceneOnly };
export function LfScene({ channel, scene, ...assets }) { const S = SCENE[channel]; return <S scene={scene} {...assets} />; }
export function LfTransition({ channel, kind, a, b, ...assets }) {
  const f = useCurrentFrame(), p = ramp(f, 12, 48, (x) => x), S = SCENE[channel];
  return <TransitionStage kind={kind} p={p} a={<S scene={a} {...assets} />} b={<S scene={b} {...assets} />} />;
}

const SERIF = '"Playfair Display", Georgia, serif', COND = '"Roboto Condensed", "Arial Narrow", sans-serif', SANS = '"Inter", sans-serif';
const stroke = "0 8px 30px rgba(0,0,0,0.7)";
/** Thumbnail concepts. One focal point, 2 to 4 words, readable at phone size. Every figure arrives in props from the real record. */
export function LfThumb({ channel, variant = "A", t = {}, images = {}, base }) {
  const bg = (extra) => <AbsoluteFill style={{ background: "#0B1018", ...extra }} />;
  const Words = ({ lines, x, y, size, color, font = COND, w = 900 }) => <div style={abs(x, y, w, size * lines.length * 1.05, { fontFamily: font, fontWeight: 800, fontSize: size, lineHeight: 1.02, color, textTransform: "uppercase", textShadow: stroke })}>{lines.map((l, i) => <div key={i}>{l}</div>)}</div>;
  const body = (() => {
    if (channel === "hidden-past") {
      if (variant === "A") return (<>{bg({})}{base && <Img src={base} style={abs(0, 0, W, H, { filter: "brightness(0.55) saturate(0.8)" })} />}<Img src={images.cut || images.portrait} style={abs(60, 60, 780, 960, { objectFit: "cover", filter: "contrast(1.1)", boxShadow: "0 0 80px #000" })} /><Words lines={t.lines} x={900} y={260} size={190} color="#F2C94C" font={SERIF} w={960} /></>);
      if (variant === "B") return (<>{bg({ background: "#1A1713" })}{base && <Img src={base} style={abs(0, 0, W, H, { opacity: 0.5 })} />}<Words lines={[t.big]} x={80} y={200} size={420} color="#E7C9A2" /><Words lines={t.lines} x={90} y={720} size={110} color="#fff" w={1700} /></>);
      return (<>{bg({ background: "#EFE6D2" })}<Img src={images.mug} style={abs(60, 100, 1000, 700, { objectFit: "cover", filter: "grayscale(1) contrast(1.1)", border: "14px solid #1A1713" })} /><Words lines={t.lines} x={1100} y={200} size={200} color="#A64B14" font={SERIF} w={780} /></>);
    }
    if (channel === "ai-tested") {
      if (variant === "A") return (<>{bg({ background: "#fff" })}<div style={abs(0, 0, W, 330, { background: "#1D4ED8" })} /><Words lines={[t.word]} x={90} y={40} size={230} color="#fff" font={SANS} w={1700} /><Img src={images.shot} style={abs(160, 380, 1600, 640, { objectFit: "cover", objectPosition: "50% 0%", border: "6px solid #0F172A", boxShadow: "0 30px 80px rgba(0,0,0,0.35)" })} /></>);
      if (variant === "B") return (<>{bg({ background: "#fff" })}<Words lines={[t.big]} x={90} y={60} size={560} color={AI.red} /><Words lines={t.lines} x={100} y={720} size={120} color={AI.ink} font={SANS} w={1700} /></>);
      return (<>{bg({ background: "#0B1220" })}<Words lines={t.lines} x={100} y={90} size={150} color="#7DD3FC" font={SANS} w={1700} /><div style={abs(100, 520, 1700, 440, { fontFamily: '"JetBrains Mono", monospace', fontSize: 52, lineHeight: 1.5, color: "#E2E8F0", whiteSpace: "pre" })}>{t.terminal}</div></>);
    }
    if (channel === "court-and-spotlight") {
      if (variant === "A") return (<>{bg({})}<Img src={images.portrait} style={abs(80, 70, 760, 940, { objectFit: "cover", objectPosition: "50% 15%", filter: "grayscale(1) contrast(1.1)", boxShadow: "0 0 90px #000" })} /><Words lines={[t.big]} x={900} y={90} size={430} color={CT.red} w={960} /><Words lines={t.lines} x={910} y={640} size={130} color="#fff" w={950} /></>);
      if (variant === "B") return (<>{bg({})}<div style={abs(240, 130, 1440, 820, { background: CT.paper, boxShadow: "0 40px 100px #000", padding: "70px 90px", boxSizing: "border-box", fontFamily: SERIF, fontWeight: 700, fontSize: 96, lineHeight: 1.15, color: "#14161A" })}>“{t.quote[0]}<span style={{ background: CT.hl }}>{t.quote[1]}</span>{t.quote[2]}”</div><div style={abs(240, 960, 600, 80, { fontFamily: COND, fontWeight: 700, fontSize: 48, letterSpacing: "0.1em", textTransform: "uppercase", background: STATUS[t.status].fill ? STATUS[t.status].c : "transparent", color: STATUS[t.status].fill ? "#fff" : STATUS[t.status].c, border: `4px ${STATUS[t.status].fill ? "solid" : "dashed"} ${STATUS[t.status].c}`, textAlign: "center", lineHeight: "72px" })}>{STATUS[t.status].label}</div></>);
      return (<>{bg({})}<Words lines={[t.big]} x={80} y={100} size={520} color={CT.amber} w={1760} /><Words lines={t.lines} x={90} y={700} size={120} color="#fff" w={1700} /></>);
    }
    if (variant === "A") return (<>{bg({ background: RV.bg })}<AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 20%, ${RV.glow}, transparent 62%)` }} /><Words lines={[t.big]} x={80} y={60} size={500} color={RV.gold} w={1760} /><Words lines={t.lines} x={90} y={700} size={130} color="#fff" w={1700} /></>);
    if (variant === "B") return (<>{bg({ background: RV.bg })}<Words lines={[t.a]} x={80} y={110} size={330} color={RV.a} w={880} /><Words lines={[t.b]} x={1000} y={110} size={330} color={RV.b} w={880} /><Words lines={t.lines} x={90} y={640} size={150} color="#fff" w={1700} /></>);
    return (<>{bg({ background: RV.bg })}<Words lines={t.lines} x={90} y={80} size={170} color="#fff" w={1740} /><Words lines={[t.big]} x={90} y={420} size={420} color={RV.gold} w={1740} /></>);
  })();
  return <AbsoluteFill style={{ background: "#000" }}><style>{FONT_FACES}</style>{body}</AbsoluteFill>;
}

const wide = { fps: 30, width: 1920, height: 1080 };
export const compositions = [
  { id: "LfScene", component: LfScene, ...wide, durationInFrames: 150, defaultProps: { channel: "hidden-past", scene: { kind: "title", text: "" } } },
  { id: "LfTransition", component: LfTransition, ...wide, durationInFrames: 60, defaultProps: { channel: "hidden-past", kind: "dissolve", a: { kind: "title", text: "A" }, b: { kind: "title", text: "B" } } },
  { id: "LfThumb", component: LfThumb, ...wide, durationInFrames: 1, defaultProps: { channel: "hidden-past", variant: "A", t: { lines: [] } } },
];
