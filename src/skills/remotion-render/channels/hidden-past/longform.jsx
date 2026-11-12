// Hidden Past long form (1920x1080). Look taken from the This Is History study (12 Nov 2026): maps on a warm paper sea with a year counter top right,
// routes drawn as dotted lines, photographs held still in a frame with their credit, quotations on a document card, big numbers for the stakes.
// Photographs never zoom or pan (Hidden Past rule). Every scene's content arrives in its scene record (kind + fields); nothing is typed here.
import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs, clamp } from "../_shared/parts.jsx";
import { K } from "./vox-beats.jsx";

const SERIF = '"Playfair Display", Georgia, serif', TEXT = '"Noto Serif", Georgia, serif', COND = '"Roboto Condensed", "Arial Narrow", sans-serif', MONO = '"JetBrains Mono", ui-monospace, monospace';
const ramp = (f, a, b) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

function Year({ year }) {
  if (!year) return null;
  return <div style={abs(1640, 48, 230, 64, { fontFamily: SERIF, fontWeight: 700, fontSize: 52, color: K.ink, textAlign: "right", letterSpacing: "0.04em" })}>{year}</div>;
}
function Credit({ children }) { return children ? <div style={abs(80, 1040, 1760, 26, { fontFamily: MONO, fontSize: 18, color: K.dim, letterSpacing: "0.04em" })}>{children}</div> : null; }
const Label = ({ x, y, children, size = 34, delay = 8 }) => { const f = useCurrentFrame(); return <div style={abs(x, y, 900, size * 1.4, { fontFamily: SERIF, fontVariant: "small-caps", fontWeight: 700, fontSize: size, color: K.ink, letterSpacing: "0.06em", opacity: ramp(f, delay, delay + 12) })}>{children}</div>; };

/** Map: Natural Earth land, the focus country tinted, places pinned, the route drawn as a dotted line that grows. */
function MapScene({ s, maps, images = {} }) {
  const f = useCurrentFrame(), g = maps[s.map];
  if (!g) return null;
  const route = ramp(f, 10, 70);
  return (<>
    <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      {g.base ? <image href={g.base} x={0} y={0} width={1920} height={1080} preserveAspectRatio="none" /> : <><rect width="1920" height="1080" fill={K.sea} /><path d={g.landD} fill={K.land} stroke={K.stroke} strokeWidth="2" /></>}
      <path d={g.countryD} fill={K.focus} fillOpacity={0.45 * ramp(f, 4, 24)} stroke={K.stroke} strokeWidth="3" />
      {g.labels.map((l, i) => <text key={i} x={l.x} y={l.y} textAnchor="middle" fontFamily={SERIF} fontVariant="small-caps" fontSize={30} letterSpacing="0.12em" fill={K.dim} opacity={ramp(f, 12 + i * 3, 24 + i * 3)}>{l.text}</text>)}
      <g style={{ clipPath: `inset(0 ${100 - route * 100}% 0 0)` }} opacity={route > 0 ? 1 : 0}>
        <path d={g.routeD} fill="none" stroke="#F2B544" strokeWidth="22" strokeLinecap="round" opacity="0.28" />
        <path d={g.routeD} fill="none" stroke="#F2B544" strokeWidth="12" strokeLinecap="round" opacity="0.4" />
        <path d={g.routeD} fill="none" stroke="#FFF4D6" strokeWidth="7" strokeDasharray="1 16" strokeLinecap="round" />
      </g>
      {g.pins.map((p, i) => { const a = ramp(f, 14 + i * 14, 24 + i * 14); return (<g key={i} opacity={a}>
        <circle cx={p.x} cy={p.y} r={12} fill={K.frame} stroke={K.paper} strokeWidth="4" />
        <text x={p.x + (p.side === "left" ? -26 : 26)} y={p.y + 12} textAnchor={p.side === "left" ? "end" : "start"} fontFamily={SERIF} fontWeight="700" fontVariant="small-caps" fontSize="40" fill={K.ink} stroke={K.land} strokeWidth="8" paintOrder="stroke">{p.name}</text></g>); })}
    </svg>
    {s.portrait && images[s.portrait] && <div style={abs(s.portraitSide === "left" ? 60 : 1340, 220, 520, 700, { opacity: ramp(f, 8, 24), transform: `translateY(${(1 - ramp(f, 8, 28)) * 30}px)` })}>
      <Img src={images[s.portrait]} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 100%", filter: "drop-shadow(0 18px 30px rgba(26,23,19,0.45))" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: -64, textAlign: "center", fontFamily: SERIF, fontWeight: 700, fontVariant: "small-caps", fontSize: 42, color: K.ink, letterSpacing: "0.06em", textShadow: `0 0 12px ${K.land}, 0 0 4px ${K.land}` }}>{s.name}</div></div>}
    {s.caption && <Label x={80} y={900} size={40}>{s.caption}</Label>}
  </>);
}
/** A photograph held still in a frame, credited. Optional label under it, the way the reference names each person. */
function PhotoScene({ s, images, credits }) {
  const f = useCurrentFrame(), a = ramp(f, 0, 14), wide = s.wide !== false && !s.portrait;
  const box = s.portrait ? { x: 200, y: 80, w: 620, h: 780 } : { x: 300, y: 70, w: 1320, h: 760 };
  return (<>
    <AbsoluteFill style={{ background: K.paper }} />
    <div style={abs(box.x, box.y, box.w, box.h, { opacity: a, background: K.ink, padding: 14, boxSizing: "border-box", boxShadow: "0 30px 80px rgba(26,23,19,0.35)" })}>
      <Img src={images[s.image]} style={{ width: "100%", height: "100%", objectFit: wide ? "cover" : "contain", objectPosition: s.pos || "50% 30%" }} />
    </div>
    {s.portrait && <><Label x={900} y={300} size={72} delay={10}>{s.name}</Label><div style={abs(900, 420, 860, 300, { fontFamily: TEXT, fontSize: 40, lineHeight: 1.35, color: K.dim, opacity: ramp(f, 18, 30) })}>{s.note}</div></>}
    {!s.portrait && s.name && <Label x={300} y={850} size={38}>{s.name}</Label>}
    <Credit>{credits[s.image]}</Credit>
  </>);
}
/** The stakes as one big figure with a label; an optional second figure set against it (needed vs existed). */
function NumberScene({ s }) {
  const f = useCurrentFrame();
  return (<>
    <AbsoluteFill style={{ background: K.paper }} />
    <div style={abs(120, 170, 1680, 330, { fontFamily: COND, fontWeight: 700, fontSize: 300, lineHeight: 1, color: K.frame, opacity: ramp(f, 0, 10), transform: `translateY(${(1 - ramp(f, 0, 14)) * 40}px)` })}>{s.big}</div>
    <div style={abs(130, 500, 1600, 70, { fontFamily: SERIF, fontVariant: "small-caps", fontSize: 54, color: K.ink, letterSpacing: "0.06em", opacity: ramp(f, 8, 20) })}>{s.label}</div>
    {s.big2 && <><div style={abs(120, 640, 1680, 200, { fontFamily: COND, fontWeight: 700, fontSize: 180, lineHeight: 1, color: K.ink, opacity: ramp(f, 30, 42) })}>{s.big2}</div>
      <div style={abs(130, 850, 1600, 60, { fontFamily: SERIF, fontVariant: "small-caps", fontSize: 46, color: K.dim, letterSpacing: "0.06em", opacity: ramp(f, 36, 48) })}>{s.label2}</div></>}
  </>);
}
/** A quotation on a paper card: the exact words, who said them, where they are recorded. */
function QuoteScene({ s }) {
  const f = useCurrentFrame(), a = ramp(f, 0, 16);
  return (<>
    <AbsoluteFill style={{ background: K.sea }} />
    <div style={abs(260, 170, 1400, 640, { background: K.white, boxShadow: "0 30px 80px rgba(26,23,19,0.25)", padding: "70px 90px", boxSizing: "border-box", opacity: a, transform: `translateY(${(1 - a) * 40}px) rotate(-0.6deg)` })}>
      <div style={{ fontFamily: SERIF, fontSize: 64, lineHeight: 1.25, color: K.ink }}>“{s.quote}”</div>
      <div style={{ fontFamily: SERIF, fontVariant: "small-caps", fontSize: 40, color: K.frame, marginTop: 40, letterSpacing: "0.06em", opacity: ramp(f, 14, 26) }}>{s.speaker}</div>
      <div style={{ fontFamily: MONO, fontSize: 22, color: K.dim, marginTop: 16, opacity: ramp(f, 18, 30) }}>{s.source}</div>
    </div>
  </>);
}
/** A chapter title or the central question, set large on the paper. */
function TitleScene({ s }) {
  const f = useCurrentFrame();
  return (<>
    <AbsoluteFill style={{ background: K.ink }} />
    {s.kicker && <div style={abs(160, 330, 1600, 50, { fontFamily: MONO, fontSize: 26, letterSpacing: "0.2em", color: K.focus, textTransform: "uppercase", opacity: ramp(f, 0, 12) })}>{s.kicker}</div>}
    <div style={abs(160, 400, 1600, 400, { fontFamily: SERIF, fontWeight: 700, fontSize: 104, lineHeight: 1.08, color: K.paper, opacity: ramp(f, 4, 18), transform: `translateY(${(1 - ramp(f, 4, 22)) * 30}px)` })}>{s.text}</div>
  </>);
}

function Captions({ captions }) {
  const f = useCurrentFrame(), c = captions.find((x) => f >= x.from && f < x.to);
  if (!c) return null;
  return <div style={abs(260, 950, 1400, 70, { display: "flex", justifyContent: "center", alignItems: "center", fontFamily: TEXT, fontSize: 38, color: K.ink, textAlign: "center" })}><span style={{ background: "rgba(239,230,210,0.92)", padding: "6px 18px", borderRadius: 4 }}>{c.text}</span></div>;
}

/** Dated events on a line that draws from the left; each event drops in when its turn comes. s.events: [{ year, label }]. */
function TimelineScene({ s }) {
  const f = useCurrentFrame(), n = s.events.length, x0 = 200, x1 = 1720, line = ramp(f, 0, 40 + n * 6);
  return (<>
    <AbsoluteFill style={{ background: K.paper }} />
    {s.heading && <Label x={200} y={150} size={56} delay={4}>{s.heading}</Label>}
    <div style={abs(x0, 560, (x1 - x0) * line, 6, { background: K.ink })} />
    {s.events.map((e, i) => { const x = x0 + ((x1 - x0) * i) / Math.max(1, n - 1), a = ramp(f, 14 + i * 12, 28 + i * 12), up = i % 2 === 0; return (<div key={i} style={{ opacity: a }}>
      <div style={abs(x - 11, 549, 28, 28, { borderRadius: 14, background: K.frame, border: `5px solid ${K.paper}`, boxShadow: `0 0 0 3px ${K.ink}` })} />
      <div style={abs(x - 160, up ? 400 : 620, 320, 120, { textAlign: "center", fontFamily: SERIF, fontWeight: 700, fontSize: 64, color: K.frame, transform: `translateY(${(1 - a) * (up ? 20 : -20)}px)` })}>{e.year}</div>
      <div style={abs(x - 170, up ? 470 : 700, 340, 160, { textAlign: "center", fontFamily: TEXT, fontSize: 30, lineHeight: 1.25, color: K.ink })}>{e.label}</div></div>); })}
  </>);
}
/** Two or more quantities drawn to one scale from zero, each labelled with its own figure. s.items: [{ label, value, display, hot? }] */
function CompareScene({ s }) {
  const f = useCurrentFrame(), max = Math.max(...s.items.map((i) => i.value));
  return (<>
    <AbsoluteFill style={{ background: K.paper }} />
    {s.heading && <Label x={160} y={110} size={54} delay={2}>{s.heading}</Label>}
    {s.items.map((it, i) => { const y = 260 + i * 230, w = Math.max(6, (1360 * it.value) / max) * ramp(f, 8 + i * 12, 40 + i * 12); return (<div key={i}>
      <div style={abs(160, y, 1400, 50, { fontFamily: SERIF, fontVariant: "small-caps", fontSize: 40, color: K.dim, letterSpacing: "0.05em", opacity: ramp(f, 4 + i * 10, 16 + i * 10) })}>{it.label}</div>
      <div style={abs(160, y + 56, w, 100, { background: it.hot ? K.frame : K.ink })} />
      <div style={abs(160 + w + 24, y + 56, 500, 100, { fontFamily: COND, fontWeight: 700, fontSize: 84, lineHeight: "100px", color: it.hot ? K.frame : K.ink, opacity: ramp(f, 30 + i * 12, 44 + i * 12) })}>{it.display}</div></div>); })}
    {s.note && <div style={abs(160, 960, 1600, 50, { fontFamily: MONO, fontSize: 24, color: K.dim })}>{s.note}</div>}
  </>);
}

function Fade({ dur, children }) { const f = useCurrentFrame(); return <AbsoluteFill style={{ opacity: interpolate(f, [0, 8, dur - 6, dur], [0, 1, 1, 0], clamp) }}>{children}</AbsoluteFill>; }

const KINDS = { timeline: TimelineScene, compare: CompareScene, map: MapScene, photo: PhotoScene, number: NumberScene, quote: QuoteScene, title: TitleScene };
export function HiddenPastLongform({ durationInFrames, scenes, captions, images = {}, credits = {}, maps = {} }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: K.paper }}><style>{FONT_FACES}</style>
      {scenes.map((s) => { const B = KINDS[s.kind]; const dur = s.to - s.from; return B ? (
        <Sequence key={s.id} from={s.from} durationInFrames={dur}>
          <Fade dur={dur}><B s={s} images={images} credits={credits} maps={maps} /><Year year={s.year} /></Fade>
        </Sequence>) : null; })}
      <Captions captions={captions} />
      <div style={abs(0, 1074, 1920 * (f / durationInFrames), 6, { background: K.frame })} />
    </AbsoluteFill>
  );
}
/** Thumbnail, per the study: portrait on the left, map on the right, two or three words in gold serif capitals. */
export function HiddenPastLongThumb({ image, words = [], maps = {}, map }) {
  const g = maps[map];
  return (
    <AbsoluteFill style={{ background: K.ink }}><style>{FONT_FACES}</style>
      {g && <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: 0.85 }}><rect width="1920" height="1080" fill="#123" /><path d={g.landD} fill="#2B3A3A" stroke="#7FA" strokeOpacity="0.25" strokeWidth="2" /><path d={g.routeD} fill="none" stroke="#F2C94C" strokeWidth="10" strokeDasharray="4 18" strokeLinecap="round" /></svg>}
      {image && <Img src={image} style={{ position: "absolute", left: 40, top: 60, height: 1000, width: 760, objectFit: "cover", filter: "contrast(1.1)", boxShadow: "0 0 80px rgba(0,0,0,0.6)" }} />}
      <div style={abs(820, 250, 1060, 560, { background: "linear-gradient(90deg, rgba(10,16,20,0.85), rgba(10,16,20,0.55))", borderRadius: 8 })} />
      <div style={abs(860, 300, 1000, 600, { fontFamily: SERIF, fontWeight: 700, fontSize: 170, lineHeight: 0.95, color: "#F2C94C", textTransform: "uppercase", textShadow: "0 8px 30px rgba(0,0,0,0.7)" })}>{words.map((w, i) => <div key={i}>{w}</div>)}</div>
    </AbsoluteFill>
  );
}
const wide = { fps: 30, width: 1920, height: 1080 };
export const longformCompositions = [
  { id: "HiddenPastLongform", component: HiddenPastLongform, ...wide, durationInFrames: 900, defaultProps: { durationInFrames: 900, scenes: [], captions: [], images: {}, credits: {}, maps: {} } },
  { id: "HiddenPastLongThumb", component: HiddenPastLongThumb, ...wide, durationInFrames: 1, defaultProps: { image: "", words: [], maps: {}, map: "" } },
];

/** One scene on its own (the visual approval gallery and the transition stage use this). */
export function HiddenPastSceneOnly({ scene, images = {}, credits = {}, maps = {} }) {
  const B = KINDS[scene.kind];
  return <AbsoluteFill style={{ background: K.paper }}><style>{FONT_FACES}</style>{B ? <B s={{ id: "g", ...scene }} images={images} credits={credits} maps={maps} /> : null}<Year year={scene.year} /></AbsoluteFill>;
}
