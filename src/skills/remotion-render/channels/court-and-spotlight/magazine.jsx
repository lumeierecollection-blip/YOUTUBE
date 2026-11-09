// Court & Spotlight, entertainment-magazine format (style profile: platform/channels/court-and-spotlight/styles/magazine.json).
// A glossy, type-led page: the subject is the star in every scene, at a different scale each time (full-bleed, cut-out through giant type,
// career strip). Photographs are real and licensed, passed in as data URIs with their credit lines and photo dates. Nothing is generated.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs, Captions, clamp, From, Scene } from "../_shared/parts.jsx";

const SERIF = '"Playfair Display", serif', SANS = '"DM Sans", sans-serif';
const M = { page: "#F7F1E6", ink: "#15110D", dim: "#6E6558", gold: "#B8892B", red: "#B3202A", white: "#FFFFFF" };
const out = Easing.out(Easing.cubic);
const t = (f, a, b) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: out });
const Masthead = ({ light }) => <div style={abs(0, 100, 1080, 90, { textAlign: "center", fontFamily: SERIF, fontWeight: 700, fontSize: 70, letterSpacing: "0.34em", color: light ? M.white : M.ink })}>SPOTLIGHT</div>;
const Photo = ({ src, style }) => <div style={{ backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center 18%", ...style }} />;
const Page = ({ children }) => <AbsoluteFill style={{ background: M.page }}>{children}</AbsoluteFill>;
const Credit = ({ children, light }) => <div style={abs(50, 1546, 980, 40, { fontFamily: SANS, fontWeight: 500, fontSize: 20, color: light ? "rgba(255,255,255,0.75)" : M.dim })}>{children}</div>;
/** A clean cut-out portrait that slides up into place. */
const Cut = ({ src, x, y, w, delay = 4, rot = 0 }) => { const f = useCurrentFrame(), a = t(f, delay, delay + 16); return <img src={src} style={{ position: "absolute", left: x, top: y, width: w, opacity: a, transform: `translateY(${(1 - a) * 90}px) rotate(${rot}deg)`, filter: "drop-shadow(0 26px 30px rgba(0,0,0,0.35))" }} />; };

function Cover({ dur, images, credits }) {
  const f = useCurrentFrame();
  const zoom = interpolate(f, [0, dur], [1.0, 1.06], clamp);
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ background: "#000" }}><Photo src={images.p2023} style={{ position: "absolute", inset: 0, transform: `scale(${zoom})` }} /></AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.82) 100%)" }} />
      <Masthead light />
      <From delay={6} dy={30} style={abs(60, 1000, 960, 420, { fontFamily: SERIF, fontWeight: 700, fontSize: 124, lineHeight: 1.0, color: M.white })}>The night she made history</From>
      <From delay={14} dy={20} style={abs(60, 1410, 960, 70, { fontFamily: SANS, fontWeight: 700, fontSize: 36, letterSpacing: "0.14em", color: "#F2D58A" })}>BEYONCÉ · 65TH GRAMMY AWARDS · FEBRUARY 2023</From>
      <Credit light>Photo: {credits.p2023}</Credit>
    </Scene>
  );
}

function Nine({ dur, images, credits, dates }) {
  const f = useCurrentFrame();
  return (
    <Scene dur={dur}>
      <Page><Masthead /></Page>
      <From dy={40} style={abs(20, 250, 700, 700, { fontFamily: SERIF, fontWeight: 700, fontStyle: "italic", fontSize: 720, lineHeight: 1, color: M.gold })}>9</From>
      <Cut src={images.p2011} x={330} y={290} w={760} />
      <From delay={8} style={abs(60, 1010, 600, 70, { fontFamily: SANS, fontWeight: 800, fontSize: 52, letterSpacing: "0.26em", color: M.ink })}>NOMINATIONS</From>
      <div style={abs(60, 1130, 960, 110, { display: "flex", gap: 22 })}>
        {Array.from({ length: 9 }, (_, i) => { const on = interpolate(f, [12 + i * 4, 18 + i * 4], [0, 1], clamp); return <div key={i} style={{ fontSize: 74, lineHeight: 1, color: M.gold, opacity: 0.18 + 0.82 * on, transform: `scale(${0.8 + 0.2 * on})` }}>★</div>; })}
      </div>
      <Credit>Photo ({dates.p2011}): {credits.p2011}</Credit>
    </Scene>
  );
}

function Win({ dur, images, credits, dates }) {
  const f = useCurrentFrame();
  const q = t(f, dur * 0.5, dur * 0.5 + 14);
  return (
    <Scene dur={dur}>
      <Page><Masthead /></Page>
      <Cut src={images.p2009} x={560} y={250} w={560} />
      <From dy={20} style={abs(60, 270, 480, 80, { display: "flex", alignItems: "center" })}><div style={{ background: M.red, color: M.white, fontFamily: SANS, fontWeight: 800, fontSize: 40, letterSpacing: "0.14em", padding: "10px 24px", borderRadius: 6 }}>WIN № 4</div></From>
      <From delay={6} dy={30} style={abs(60, 560, 940, 200, { fontFamily: SERIF, fontWeight: 700, fontSize: 136, lineHeight: 1, color: M.ink })}>Renaissance</From>
      <From delay={12} style={abs(60, 770, 800, 130, { fontFamily: SANS, fontWeight: 600, fontSize: 44, lineHeight: 1.2, color: M.dim })}>Best dance/electronic music album</From>
      <div style={abs(60, 1040, 940, 330, { opacity: q, transform: `translateY(${(1 - q) * 30}px)`, borderLeft: `8px solid ${M.gold}`, paddingLeft: 36 })}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: 66, lineHeight: 1.12, color: M.ink }}>“I’m just trying to receive this night.”</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 26, letterSpacing: "0.14em", color: M.dim, marginTop: 18 }}>BEYONCÉ, ON STAGE</div>
      </div>
      <Credit>Photo ({dates.p2009}): {credits.p2009}</Credit>
    </Scene>
  );
}

function Total({ dur, images, dates }) {
  const f = useCurrentFrame();
  const n = Math.round(interpolate(f, [6, dur * 0.6], [0, 32], { ...clamp, easing: out }));
  const strip = [["p2009"], ["p2011"], ["p2016"], ["p2023"]];
  return (
    <Scene dur={dur}>
      <Page><Masthead /></Page>
      <div style={abs(0, 230, 1080, 560, { textAlign: "center", fontFamily: SERIF, fontWeight: 700, fontSize: 520, lineHeight: 1, color: M.gold })}>{n}</div>
      <From delay={10} style={abs(0, 780, 1080, 130, { textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 54, letterSpacing: "0.22em", color: M.ink, lineHeight: 1.3 })}>GRAMMYS · CAREER TOTAL</From>
      <div style={abs(40, 960, 1000, 470, { display: "flex", gap: 14 })}>
        {strip.map(([k], i) => { const a = t(f, 14 + i * 7, 26 + i * 7); return (
          <div key={k} style={{ flex: 1, opacity: a, transform: `translateY(${(1 - a) * 50}px)` }}>
            <Photo src={images[k]} style={{ height: 380, borderRadius: 6, boxShadow: "0 14px 30px rgba(0,0,0,0.25)" }} />
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 40, letterSpacing: "0.1em", color: M.ink, marginTop: 12, textAlign: "center" }}>{dates[k]}</div>
          </div>); })}
      </div>
      <From delay={36} style={abs(0, 1450, 1080, 40, { textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 24, letterSpacing: "0.12em", color: M.dim })}>PHOTOGRAPHS FROM FOUR DIFFERENT YEARS · THE TOTAL IS AS REPORTED IN FEBRUARY 2023</From>
    </Scene>
  );
}

function Record({ dur, images, credits, dates }) {
  const f = useCurrentFrame();
  const r = interpolate(f, [4, 24], [-120, 0], { ...clamp, easing: out });
  return (
    <Scene dur={dur}>
      <Page><Masthead /></Page>
      <Photo src={images.p2023} style={abs(150, 240, 780, 840, { borderRadius: 8, boxShadow: "0 26px 60px rgba(0,0,0,0.25)" })} />
      <div style={abs(-40, 980, 1160, 200, { background: M.red, transform: `translateX(${r}px) rotate(-3deg)`, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 60, letterSpacing: "0.1em", color: M.white, lineHeight: 1.15, padding: "0 90px", boxSizing: "border-box" })}>MOST GRAMMYS OF ANY ARTIST</div>
      <From delay={16} style={abs(0, 1250, 1080, 60, { textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 32, letterSpacing: "0.12em", color: M.dim })}>IN THE AWARDS’ 65-YEAR HISTORY</From>
      <div style={abs(50, 1330, 980, 200, { fontFamily: SANS, fontWeight: 500, fontSize: 19, lineHeight: 1.5, color: M.dim })}>
        Photos: {dates.p2009}: {credits.p2009}. {dates.p2011}: {credits.p2011}. {dates.p2016}: {credits.p2016}. {dates.p2023}: {credits.p2023}.
      </div>
    </Scene>
  );
}

const KINDS = { cover: Cover, nine: Nine, win: Win, total: Total, record: Record };

export function CourtMagazineShort({ durationInFrames, scenes, captions, images, credits, dates }) {
  const f = useCurrentFrame();
  const onCover = scenes.length > 0 && f < scenes[0].to;
  return (
    <AbsoluteFill style={{ background: M.page }}>
      <style>{FONT_FACES}</style>
      {scenes.map((s) => { const K = KINDS[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} images={images} credits={credits} dates={dates} /></Sequence>; })}
      <Captions captions={captions} font={SANS} color={onCover ? M.white : M.ink} accent={onCover ? "#C9C1B2" : M.dim} top={1620} />
      <div style={abs(0, 1912, 1080 * (f / durationInFrames), 8, { background: M.red })} />
    </AbsoluteFill>
  );
}
