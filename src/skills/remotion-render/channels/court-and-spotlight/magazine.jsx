// Court & Spotlight, entertainment-magazine format: a glossy, type-led page for awards and achievements. The photograph is a real,
// licensed image passed in as a data URI with its credit line, which is always shown on the cover.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs, Captions, clamp, From, Scene } from "../_shared/parts.jsx";

const SERIF = '"Playfair Display", serif', SANS = '"DM Sans", sans-serif';
const M = { page: "#F7F1E6", ink: "#15110D", dim: "#6E6558", gold: "#B8892B", red: "#B3202A", white: "#FFFFFF" };
const Masthead = ({ light }) => <div style={abs(0, 100, 1080, 90, { textAlign: "center", fontFamily: SERIF, fontWeight: 700, fontSize: 70, letterSpacing: "0.34em", color: light ? M.white : M.ink })}>SPOTLIGHT</div>;
const Photo = ({ src, style }) => <div style={{ backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center 18%", ...style }} />;
const Page = ({ children }) => <AbsoluteFill style={{ background: M.page }}>{children}</AbsoluteFill>;

function Cover({ dur, photo, credit }) {
  const f = useCurrentFrame();
  const zoom = interpolate(f, [0, dur], [1.0, 1.06], clamp);
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ background: "#000" }}><Photo src={photo} style={{ position: "absolute", inset: 0, transform: `scale(${zoom})` }} /></AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.82) 100%)" }} />
      <Masthead light />
      <From delay={6} dy={30} style={abs(60, 1010, 960, 420, { fontFamily: SERIF, fontWeight: 700, fontSize: 124, lineHeight: 1.0, color: M.white })}>The night she made history</From>
      <From delay={14} dy={20} style={abs(60, 1420, 960, 70, { fontFamily: SANS, fontWeight: 700, fontSize: 36, letterSpacing: "0.14em", color: "#F2D58A" })}>BEYONCÉ · 65TH GRAMMY AWARDS · FEBRUARY 2023</From>
      <div style={abs(60, 1862, 960, 40, { fontFamily: SANS, fontWeight: 500, fontSize: 22, color: "rgba(255,255,255,0.72)" })}>{credit}</div>
    </Scene>
  );
}

function Nine({ dur }) {
  const f = useCurrentFrame();
  return (
    <Scene dur={dur}>
      <Page><Masthead /></Page>
      <From dy={40} style={abs(0, 330, 1080, 560, { textAlign: "center", fontFamily: SERIF, fontWeight: 700, fontStyle: "italic", fontSize: 560, lineHeight: 1, color: M.ink })}>9</From>
      <From delay={8} style={abs(0, 930, 1080, 70, { textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: 44, letterSpacing: "0.3em", color: M.gold })}>NOMINATIONS</From>
      <div style={abs(110, 1090, 860, 120, { display: "flex", justifyContent: "space-between" })}>
        {Array.from({ length: 9 }, (_, i) => { const on = interpolate(f, [12 + i * 4, 18 + i * 4], [0, 1], clamp); return <div key={i} style={{ fontSize: 76, lineHeight: 1, color: M.gold, opacity: 0.2 + 0.8 * on, transform: `scale(${0.8 + 0.2 * on})` }}>★</div>; })}
      </div>
    </Scene>
  );
}

function Win({ dur, photo }) {
  const f = useCurrentFrame();
  const q = interpolate(f, [dur * 0.5, dur * 0.5 + 14], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <Scene dur={dur}>
      <Page><Masthead /></Page>
      <Photo src={photo} style={abs(640, 250, 340, 340, { borderRadius: 170, border: `6px solid ${M.gold}` })} />
      <From dy={20} style={abs(70, 270, 520, 80, { display: "flex", alignItems: "center" })}><div style={{ background: M.red, color: M.white, fontFamily: SANS, fontWeight: 800, fontSize: 40, letterSpacing: "0.14em", padding: "10px 24px", borderRadius: 6 }}>WIN № 4</div></From>
      <From delay={6} dy={30} style={abs(70, 640, 940, 220, { fontFamily: SERIF, fontWeight: 700, fontSize: 150, lineHeight: 1, color: M.ink })}>Renaissance</From>
      <From delay={12} style={abs(70, 880, 940, 130, { fontFamily: SANS, fontWeight: 600, fontSize: 46, lineHeight: 1.2, color: M.dim })}>Best dance/electronic music album</From>
      <div style={abs(70, 1100, 940, 330, { opacity: q, transform: `translateY(${(1 - q) * 30}px)`, borderLeft: `8px solid ${M.gold}`, paddingLeft: 36 })}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: 70, lineHeight: 1.12, color: M.ink }}>“I’m just trying to receive this night.”</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 28, letterSpacing: "0.14em", color: M.dim, marginTop: 20 }}>BEYONCÉ, ON STAGE</div>
      </div>
    </Scene>
  );
}

function Total({ dur }) {
  const f = useCurrentFrame();
  const n = Math.round(interpolate(f, [6, dur * 0.7], [0, 32], { ...clamp, easing: Easing.out(Easing.cubic) }));
  return (
    <Scene dur={dur}>
      <Page><Masthead /></Page>
      <div style={abs(0, 300, 1080, 640, { textAlign: "center", fontFamily: SERIF, fontWeight: 700, fontSize: 620, lineHeight: 1, color: M.gold })}>{n}</div>
      <From delay={10} style={abs(0, 980, 1080, 160, { textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 58, letterSpacing: "0.22em", color: M.ink, lineHeight: 1.3 })}>GRAMMYS<br />CAREER TOTAL</From>
      <From delay={18} style={abs(0, 1250, 1080, 70, { textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 30, letterSpacing: "0.12em", color: M.dim })}>AS REPORTED AT THE FEBRUARY 2023 CEREMONY</From>
    </Scene>
  );
}

function Record({ dur, photo }) {
  const f = useCurrentFrame();
  const r = interpolate(f, [4, 24], [-120, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <Scene dur={dur}>
      <Page><Masthead /></Page>
      <Photo src={photo} style={abs(150, 250, 780, 880, { borderRadius: 8, boxShadow: "0 26px 60px rgba(0,0,0,0.25)" })} />
      <div style={abs(-40, 1010, 1160, 200, { background: M.red, transform: `translateX(${r}px) rotate(-3deg)`, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 60, letterSpacing: "0.1em", color: M.white, lineHeight: 1.15, padding: "0 90px", boxSizing: "border-box" })}>MOST GRAMMYS OF ANY ARTIST</div>
      <From delay={16} style={abs(0, 1290, 1080, 60, { textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 32, letterSpacing: "0.12em", color: M.dim })}>IN THE AWARDS’ 65-YEAR HISTORY</From>
    </Scene>
  );
}

const KINDS = { cover: Cover, nine: Nine, win: Win, total: Total, record: Record };

export function CourtMagazineShort({ durationInFrames, scenes, captions, photo, credit }) {
  const f = useCurrentFrame();
  const onCover = scenes.length > 0 && f < scenes[0].to;
  return (
    <AbsoluteFill style={{ background: M.page }}>
      <style>{FONT_FACES}</style>
      {scenes.map((s) => { const K = KINDS[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} photo={photo} credit={credit} /></Sequence>; })}
      <Captions captions={captions} font={SANS} color={onCover ? M.white : M.ink} accent={onCover ? "#C9C1B2" : M.dim} top={1620} />
      <div style={abs(0, 1912, 1080 * (f / durationInFrames), 8, { background: M.red })} />
    </AbsoluteFill>
  );
}
