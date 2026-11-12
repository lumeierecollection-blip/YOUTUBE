// Court & Spotlight, serious cut: black field, one red. The source sentences themselves are on screen (document cards, the quoted words highlighted),
// with the outcome as a giant number. An allegation is never drawn like a finding: allegations are amber and outlined, findings are red and filled.
// All quoted text, names, numbers and credits arrive as props from the run's claims; nothing about the case is typed in this file.
import React from "react";
import { Img, useCurrentFrame } from "remotion";
import { abs } from "../_shared/parts.jsx";
import { COND, MONO, ramp, Kicker, Head, Count, Rule, Chip, Doc, Photo, Shell, WideShell, baseComp, wideComp } from "../_shared/serious.jsx";

export const T = { bg: "#08090C", glow: "rgba(120,30,30,0.26)", line: "rgba(255,255,255,0.03)", ink: "#F4F4F2", dim: "#9A9CA3", accent: "#E0261B", rule: "rgba(255,255,255,0.22)", paper: "#F3F0E8", mark: "rgba(224,38,27,0.30)", amber: "#F2A900", ok: "#E9E9E4" };
const TA = { ...T, accent: T.amber, mark: "rgba(242,169,0,0.42)", onAccent: "#14110B" };
const Src = ({ y, delay = 10, children }) => { const f = useCurrentFrame(); return <div style={abs(70, y, 940, 30, { fontFamily: MONO, fontSize: 20, letterSpacing: "0.06em", color: T.dim, textTransform: "uppercase", opacity: ramp(f, delay, delay + 10) })}>Source: {children}</div>; };

function Cover({ c, images, cues }) {
  const c1 = cues[1] ?? 66;
  return (<>
    <Kicker t={T} y={190}>{c.kicker}</Kicker>
    <Photo t={T} src={images.portrait} x={70} y={260} w={470} h={600} gray credit={c.portraitCredit} pos="50% 15%" />
    <Count t={T} x={590} y={230} w={430} size={460} to={c.years} delay={8} len={14} color={T.accent} align="center" />
    <Head t={T} x={590} y={690} w={430} size={110} lines={["Years"]} delay={16} align="center" />
    <Head t={T} y={950} size={168} lines={c.name} delay={4} />
    <Chip t={T} x={70} y={1300} delay={c1} size={40}>{c.offence}</Chip>
  </>);
}
function Doj({ c }) {
  return (<>
    <Kicker t={T} y={190}>The verdict</Kicker>
    <Doc t={T} y={260} source={c.doj.source} meta={c.doj.meta} text={c.doj.text} hl={c.doj.hl} size={46} hlDelay={18} hlStep={30} />
    <Chip t={T} x={70} y={1010} delay={40} size={64}>Convicted</Chip>
    <Chip t={T} x={470} y={1010} delay={54} size={64} filled={false} color={T.ink}>{c.doj.count}</Chip>
    <Src y={1180}>{c.doj.credit}</Src>
  </>);
}
function Acquitted({ c }) {
  const f = useCurrentFrame();
  return (<>
    <Kicker t={T} y={190}>The other charges</Kicker>
    <Count t={T} x={64} y={240} w={260} size={330} to={c.acq.n} delay={2} len={12} />
    <Head t={T} x={290} y={300} w={720} size={92} lines={["more charges"]} delay={8} />
    {Array.from({ length: c.acq.n }, (_, i) => { const a = ramp(f, 12 + i * 4, 20 + i * 4), s = ramp(f, 44 + i * 4, 54 + i * 4); return (
      <div key={i} style={abs(70, 610 + i * 0, 0, 0)}>
        <div style={abs(i * 191, 0, 176, 110, { border: `3px solid ${T.rule}`, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontWeight: 700, fontSize: 40, color: T.dim, opacity: a })}>{String(i + 1).padStart(2, "0")}</div>
        <div style={abs(i * 191 - 6, 52, 188 * s, 6, { background: T.ink })} />
      </div>); })}
    <Chip t={T} x={70} y={770} delay={62} size={64} color={T.ok} filled={false}>Acquitted</Chip>
    <Doc t={T} y={930} source={c.acq.source} text={c.acq.text} hl={c.acq.hl} size={36} delay={30} hlDelay={34} hlStep={18} quote />
  </>);
}
function Alleged({ c }) {
  return (<>
    <Kicker t={TA} y={190}>What prosecutors said</Kicker>
    <Chip t={TA} x={70} y={250} delay={2} size={50} filled={false}>Alleged · not a finding</Chip>
    <Count t={TA} x={60} y={370} w={960} size={300} to={c.alleged.value} decimals={1} prefix="$" suffix="M" delay={10} len={26} color={T.amber} />
    <Head t={TA} y={690} size={64} lines={[c.alleged.label]} delay={30} color={T.dim} />
    <Doc t={TA} y={830} source={c.alleged.source} text={c.alleged.text} hl={c.alleged.hl} size={36} delay={38} hlDelay={10} hlStep={18} quote />
  </>);
}
function Sought({ c, cues }) {
  const f = useCurrentFrame(), c1 = cues[1] ?? 60, p = ramp(f, c1 + 6, c1 + 30);
  return (<>
    <Kicker t={T} y={190}>The sentence</Kicker>
    <Doc t={T} y={260} source={c.sought.source} text={c.sought.text} hl={c.sought.hl} size={36} hlDelay={14} quote />
    <Head t={T} y={790} size={84} lines={["The judge gave"]} delay={c1} color={T.dim} />
    <Count t={T} x={64} y={880} w={260} size={300} to={c.years} delay={c1 + 4} len={12} color={T.accent} />
    <Head t={T} x={270} y={990} w={700} size={150} lines={["Years"]} delay={c1 + 8} />
    <div style={abs(70, 1290, 940 * p, 4, { background: T.rule })} />
    {c.sought.line.map(([lab, date], i) => <div key={i} style={abs(70 + i * 900, 1270, 44, 44, { background: i ? T.accent : T.ink, borderRadius: 22, opacity: ramp(f, c1 + 6 + i * 22, c1 + 12 + i * 22) })}>
      <div style={abs(i ? -360 : 0, 52, 400, 60, { fontFamily: MONO, fontWeight: 700, fontSize: 21, letterSpacing: "0.06em", color: T.dim, textAlign: i ? "right" : "left", textTransform: "uppercase", whiteSpace: "nowrap" })}>{date} · {lab}</div></div>)}
  </>);
}
function Booking({ c, images }) {
  return (<>
    <Kicker t={T} y={190}>{c.booking.kicker}</Kicker>
    <Photo t={T} src={images.booking} x={190} y={270} w={700} h={860} credit={c.booking.credit} pos="50% 30%" />
    <Chip t={T} x={70} y={1240} delay={20} size={56}>{c.booking.date}</Chip>
  </>);
}

const BEATS = { cover: Cover, doj: Doj, acquitted: Acquitted, alleged: Alleged, sought: Sought, booking: Booking };
export function CourtSerious({ durationInFrames, scenes, captions, images, c }) {
  return <Shell t={T} durationInFrames={durationInFrames} scenes={scenes} captions={captions} beats={BEATS} pass={{ images, c }} label={["Court & Spotlight", c.tag || ""]} />;
}
const SIDE = new Set(["doj", "acquitted", "alleged", "sought"]);
export function CourtSeriousWide({ durationInFrames, scenes, captions, images, c }) {
  const side = (s) => (SIDE.has(s.kind) && images.portrait ? <Img src={images.portrait} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 18%", filter: "grayscale(1) contrast(1.08)" }} /> : null);
  return <WideShell t={T} durationInFrames={durationInFrames} scenes={scenes} captions={captions} beats={BEATS} pass={{ images, c }} label={["Court & Spotlight", c.tag || ""]} side={side} />;
}
const DP = { durationInFrames: 780, scenes: [], captions: [], images: {}, c: { name: [], doj: { hl: [] }, acq: { n: 0, hl: [] }, alleged: { hl: [] }, sought: { hl: [], line: [] }, booking: {} } };
export const seriousCompositions = [{ id: "CourtSeriousWide", component: CourtSeriousWide, ...wideComp, defaultProps: DP }, { id: "CourtSerious", component: CourtSerious, ...baseComp, defaultProps: { durationInFrames: 780, scenes: [], captions: [], images: {}, c: { name: [], doj: { hl: [] }, acq: { n: 0, hl: [] }, alleged: { hl: [] }, sought: { hl: [], line: [] }, booking: {} } } }];
