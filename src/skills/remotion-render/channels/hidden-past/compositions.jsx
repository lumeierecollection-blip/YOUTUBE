// Hidden Past, documentary format: archival paper, real photographs shown unscaled in matted frames, a dated evidence timeline.
// Archival photographs are never zoomed or panned (channel rule); they are revealed, framed and labelled with date and credit.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { collageCompositions } from "./collage.jsx";
import { voxBeatsCompositions } from "./vox-beats.jsx";
import { voxCrimeCompositions } from "./vox-crime.jsx";
import { voxCaponeCompositions } from "./vox-capone.jsx";
import { voxPonziCompositions } from "./vox-ponzi.jsx";
import { abs, Captions, clamp, From, Scene } from "../_shared/parts.jsx";

const SERIF = '"Playfair Display", serif', SANS = '"DM Sans", sans-serif';
const H = { paper: "#EDE4D0", ink: "#1E1A14", dim: "#6B604E", accent: "#A64B14", rule: "#B9AC92" };
const out = Easing.out(Easing.cubic);
const t = (f, a, b) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: out });
const Page = ({ children }) => <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, ${H.paper} 55%, #D9CDB2 100%)` }}>{children}</AbsoluteFill>;
const Head = ({ kicker }) => <div style={abs(60, 90, 960, 70, { fontFamily: SANS, fontWeight: 700, fontSize: 30, letterSpacing: "0.3em", color: H.accent })}>HIDDEN PAST<span style={{ color: H.dim, fontWeight: 500 }}> · {kicker}</span></div>;
const Credit = ({ children }) => <div style={abs(60, 1500, 960, 70, { fontFamily: SANS, fontWeight: 500, fontSize: 24, lineHeight: 1.35, color: H.dim })}>{children}</div>;
const Stamp = ({ children, delay = 10 }) => { const f = useCurrentFrame(), a = t(f, delay, delay + 8); return <div style={{ display: "inline-block", border: `5px solid ${H.accent}`, color: H.accent, fontFamily: SANS, fontWeight: 800, fontSize: 40, letterSpacing: "0.12em", padding: "8px 22px", transform: `rotate(-4deg) scale(${1.3 - 0.3 * a})`, opacity: a }}>{children}</div>; };
const Framed = ({ src, x, y, w, h, fit = "cover", delay = 0 }) => { const f = useCurrentFrame(), a = t(f, delay, delay + 14); return <div style={abs(x, y, w, h, { background: "#FBF7EC", padding: 14, boxSizing: "border-box", boxShadow: "0 22px 50px rgba(30,26,20,0.3)", opacity: a, transform: `translateY(${(1 - a) * 30}px)` })}><div style={{ width: "100%", height: "100%", backgroundImage: `url(${src})`, backgroundSize: fit, backgroundRepeat: "no-repeat", backgroundPosition: "center" }} /></div>; };

const TL = [["18:00", "Press conference begins, live on East German TV"], ["18:53", "Asked when the new rules start"], ["19:04", "West German agency: borders open “immediately”"], ["22:45*", "Bornholmer Straße checkpoint opens"]];
function Timeline({ upTo, y = 1010 }) {
  const f = useCurrentFrame();
  return (
    <div style={abs(60, y, 960, 460, {})}>
      <div style={abs(24, 10, 4, 400, { background: H.rule })} />
      {TL.slice(0, upTo).map(([time, label], i) => { const a = t(f, 6 + i * 10, 16 + i * 10); return (
        <div key={time} style={abs(0, i * 118, 960, 110, { opacity: a, transform: `translateX(${(1 - a) * -30}px)` })}>
          <div style={abs(14, 14, 24, 24, { borderRadius: 12, background: H.accent })} />
          <div style={abs(62, 0, 220, 60, { fontFamily: SERIF, fontWeight: 700, fontSize: 64, color: H.ink })}>{time}</div>
          <div style={abs(320, 6, 640, 100, { fontFamily: SANS, fontWeight: 600, fontSize: 36, lineHeight: 1.2, color: H.dim })}>{label}</div>
        </div>); })}
    </div>
  );
}

function Press({ dur, images, credits }) {
  return (<Scene dur={dur}><Page><Head kicker="9 NOVEMBER 1989" /></Page>
    <From dy={30} style={abs(60, 200, 960, 230, { fontFamily: SERIF, fontWeight: 700, fontSize: 84, lineHeight: 1.04, color: H.ink })}>An announcement came too early</From>
    <Framed src={images.press} x={40} y={470} w={1000} h={780} fit="contain" delay={6} />
    <div style={abs(60, 1300, 960, 90, {})}><Stamp>9 NOV 1989 · EAST BERLIN</Stamp></div>
    <Credit>Photo: {credits.press}</Credit></Scene>);
}
function Note({ dur, images, credits }) {
  return (<Scene dur={dur}><Page><Head kicker="THE NOTE" /></Page>
    <Framed src={images.note} x={190} y={190} w={700} h={900} fit="contain" delay={4} />
    <From delay={14} dy={30} style={abs(60, 1130, 960, 280, { fontFamily: SERIF, fontWeight: 700, fontSize: 70, lineHeight: 1.06, color: H.ink })}>Handed to him just before. No instructions.</From>
    <From delay={22} style={abs(60, 1400, 960, 100, { fontFamily: SANS, fontWeight: 600, fontSize: 30, color: H.dim })}>Schabowski’s own notes, 9 Nov 1989 (source: hdg.de LeMO)</From>
    <Credit>Image: {credits.note}</Credit></Scene>);
}
function Quote({ dur }) {
  return (<Scene dur={dur}><Page><Head kicker="THE ANSWER" /></Page>
    <From dy={20} style={abs(60, 200, 960, 400, { fontFamily: SERIF, fontWeight: 700, fontStyle: "italic", fontSize: 110, lineHeight: 1.02, color: H.accent })}>“…immediately, without delay.”</From>
    <From delay={10} style={abs(60, 640, 960, 110, { fontFamily: SANS, fontWeight: 600, fontSize: 32, lineHeight: 1.3, color: H.dim })}>Günter Schabowski, as reported on Wikipedia’s account of the press conference</From>
    <Timeline upTo={3} y={820} /></Scene>);
}
function Gate({ dur, images, credits, dates }) {
  return (<Scene dur={dur}><Page><Head kicker="THAT NIGHT" /></Page>
    <Framed src={images.gate} x={60} y={190} w={960} h={620} fit="cover" delay={2} />
    <div style={abs(60, 826, 960, 50, { fontFamily: SANS, fontWeight: 600, fontSize: 24, color: H.dim })}>Brandenburg Gate, December 1989 (photo taken weeks later)</div>
    <Timeline upTo={4} y={890} />
    <div style={abs(60, 1370, 960, 60, { fontFamily: SANS, fontWeight: 500, fontSize: 22, color: H.dim })}>*22:45 per Wikipedia; some accounts give 23:30.</div>
    <Credit>Photo: {credits.gate}</Credit></Scene>);
}
const KINDS = { press: Press, note: Note, quote: Quote, gate: Gate };

export function HiddenPastDocShort({ durationInFrames, scenes, captions, images, credits, dates }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: H.paper }}>
      <style>{FONT_FACES}</style>
      {scenes.map((s) => { const K = KINDS[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} images={images} credits={credits} dates={dates} /></Sequence>; })}
      <Captions captions={captions} font={SANS} color={H.ink} accent={H.dim} top={1610} />
      <div style={abs(0, 1912, 1080 * (f / durationInFrames), 8, { background: H.accent })} />
    </AbsoluteFill>
  );
}
const base = { fps: 30, width: 1080, height: 1920, durationInFrames: 780, defaultProps: { durationInFrames: 780, scenes: [], captions: [] } };
export const compositions = [...collageCompositions, ...voxBeatsCompositions, ...voxCrimeCompositions, ...voxCaponeCompositions, ...voxPonziCompositions, { id: "HiddenPastDocShort", component: HiddenPastDocShort, ...base, defaultProps: { ...base.defaultProps, images: {}, credits: {}, dates: {} } }];
