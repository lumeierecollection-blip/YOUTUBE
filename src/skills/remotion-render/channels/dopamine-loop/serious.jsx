// Dopamine Loop, serious cut: no characters. Public-domain paintings under a dark wash with a slow push, serif type, and the study itself on a
// document card with the quoted finding highlighted. The abstract text is the PubMed record (PMID 14551436), passed in as props, never retyped here.
import React from "react";
import { Img, interpolate, useCurrentFrame } from "remotion";
import { abs } from "../_shared/parts.jsx";
import { MONO, SERIF, ramp, Plate, Kicker, Head, Rule, Chip, Doc, Shell, WideShell, baseComp, wideComp } from "../_shared/serious.jsx";

export const T = { bg: "#0B0A09", glow: "rgba(120,100,70,0.22)", line: "rgba(255,255,255,0.0)", ink: "#F4EFE6", dim: "#B3AA9B", accent: "#C9A35B", rule: "rgba(244,239,230,0.3)", paper: "#F3EEE3", mark: "rgba(201,163,91,0.5)", onAccent: "#14110B" };
const Credit = ({ children }) => { const f = useCurrentFrame(); return <div style={abs(70, 1366, 940, 30, { fontFamily: MONO, fontSize: 19, letterSpacing: "0.06em", color: T.dim, textTransform: "uppercase", opacity: 0.85 * ramp(f, 8, 18) })}>{children}</div>; };
const H = (p) => <Head t={T} font={SERIF} upper={false} size={118} lh={1.08} {...p} />;

const wrap = (Inner, key, pos, wash) => function Beat({ dur, cues, images, credits, study, wide }) {
  if (wide) return <Inner dur={dur} cues={cues} study={study} />;
  return (<><Plate src={images[key]} dur={dur} pos={pos} wash={wash} /><Inner dur={dur} cues={cues} study={study} /><Credit>Painting: {credits[key]}</Credit></>);
};

const B1 = wrap(({ cues }) => { const c1 = cues[1] ?? 64, c2 = cues[2] ?? c1 + 40; return (<>
  <Kicker t={T} y={190}>Why exclusion hurts</Kicker>
  <H y={250} lines={["Being", "left out"]} size={170} />
  <Rule t={T} y={690} w={300} delay={c1 - 6} color={T.accent} h={6} />
  <H y={730} lines={["may feel to", "your brain like"]} delay={c1} size={100} color={T.dim} />
  <H y={980} lines={["physical pain."]} delay={c2} size={132} italic color={T.accent} />
</>); }, "back", "50% 30%", 0.42);

const B2 = wrap(({ cues }) => { const c1 = cues[1] ?? 70; return (<>
  <Kicker t={T} y={190}>When the group goes quiet</Kicker>
  <H y={250} lines={["That sting"]} size={170} />
  <H y={520} lines={["is not you"]} delay={c1} size={120} color={T.dim} />
  <H y={680} lines={["being dramatic."]} delay={c1 + 10} size={124} italic color={T.accent} />
</>); }, "cafe", "50% 40%", 0.66);

const B3 = wrap(({ cues, study }) => (<>
  <Kicker t={T} y={190}>The study</Kicker>
  <Doc t={T} y={260} source={study.journal} meta={study.id} title={study.title} text={study.find1} hl={study.hl1} size={40} hlDelay={(cues[1] ?? 60) - 4} hlStep={(cues[2] ?? 110) - (cues[1] ?? 60)}>
    <div style={{ fontFamily: MONO, fontSize: 21, letterSpacing: "0.04em", color: "rgba(20,22,26,0.6)", marginTop: 24 }}>{study.authors}</div>
  </Doc>
</>), "melancholy", "50% 50%", 0.62);

const B4 = wrap(({ study }) => (<>
  <Kicker t={T} y={190}>A second region</Kicker>
  <Doc t={T} y={260} source={study.journal} meta={study.id} text={study.find2} hl={study.hl2} size={44} hlDelay={24} />
  <Chip t={T} x={70} y={1010} delay={48} size={50} filled={false}>Linked to less distress</Chip>
</>), "window", "50% 40%", 0.6);

const B5 = wrap(({ cues }) => { const c = cues.find((x) => x > 50) ?? 80; return (<>
  <Kicker t={T} y={190}>What it means</Kicker>
  <H y={250} lines={["Feeling it", "doesn't mean", "something", "is wrong."]} size={112} color={T.dim} />
  <Rule t={T} y={800} w={300} delay={c - 6} color={T.accent} h={6} />
  <H y={840} lines={["It means", "people matter", "to you."]} delay={c} size={136} italic color={T.accent} />
</>); }, "moon", "50% 35%", 0.5);

const BEATS = { "left-out": B1, "quiet-chat": B2, screen: B3, regulate: B4, comfort: B5 };
export function DopamineSerious({ durationInFrames, scenes, captions, images, credits, study }) {
  return <Shell t={T} grid={false} durationInFrames={durationInFrames} scenes={scenes} captions={captions} beats={BEATS} pass={{ images, credits, study }} label={["Dopamine Loop", "Psychology"]} />;
}
const ART = { "left-out": ["back", "50% 30%"], "quiet-chat": ["cafe", "50% 40%"], screen: ["melancholy", "50% 50%"], regulate: ["window", "50% 35%"], comfort: ["moon", "50% 40%"] };
function Painting({ src, pos, dur, credit }) {
  const f = useCurrentFrame(), s = interpolate(f, [0, dur], [1.03, 1.1], { extrapolateRight: "clamp" });
  return (<><Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: pos, transform: `scale(${s})`, filter: "saturate(0.85)" }} />
    <div style={abs(0, 572, 880, 48, { background: "rgba(0,0,0,0.62)", fontFamily: MONO, fontSize: 18, letterSpacing: "0.06em", color: T.dim, textTransform: "uppercase", padding: "13px 18px", boxSizing: "border-box" })}>Painting: {credit}</div></>);
}
export function DopamineSeriousWide({ durationInFrames, scenes, captions, images, credits, study }) {
  const side = (s, dur) => { const a = ART[s.kind]; return a && images[a[0]] ? <Painting src={images[a[0]]} pos={a[1]} dur={dur} credit={credits[a[0]]} /> : null; };
  return <WideShell t={T} grid={false} durationInFrames={durationInFrames} scenes={scenes} captions={captions} beats={BEATS} pass={{ images, credits, study }} label={["Dopamine Loop", "Psychology"]} side={side} sayFont={SERIF} upper={false} />;
}
const DP = { durationInFrames: 780, scenes: [], captions: [], images: {}, credits: {}, study: { hl1: [], hl2: [] } };
export const seriousCompositions = [{ id: "DopamineSeriousWide", component: DopamineSeriousWide, ...wideComp, defaultProps: DP }, { id: "DopamineSerious", component: DopamineSerious, ...baseComp, defaultProps: { durationInFrames: 780, scenes: [], captions: [], images: {}, credits: {}, study: { hl1: [], hl2: [] } } }];
