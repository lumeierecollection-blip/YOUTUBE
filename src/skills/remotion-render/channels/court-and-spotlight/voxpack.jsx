// Court & Spotlight, "printed, not lit" explainer look from https://github.com/Cele-san/vox-style-animation (MIT): cream paper, ink,
// one yellow highlighter, red for the old world, cobalt for the new, Archivo Black headlines, hard offset shadows, halftone dot fields
// (12 fps stutter on the dot field only), paper slap-ins, highlighter swipes, red strike-through, count-up tickers, a hand-drawn red-pen
// circle on the evidence, and a sheet-wipe as the only transition. Photographs are real and licensed; halftone ink cut-outs are baked
// from them offline (platform/production/halftone.py). Nothing is generated.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, Easing, staticFile } from "remotion";
import { abs, clamp } from "../_shared/parts.jsx";

const V = { paper: "#F2ECDF", deep: "#E9E1CF", ink: "#161513", yellow: "#FFD200", red: "#E5483F", cobalt: "#2F5FE8", dim: "#5C564B", white: "#FFFFFF" };
const HEAD = '"Archivo Black", "Roboto Condensed", sans-serif', BODY = '"Inter", sans-serif';
const FACE = `@font-face{font-family:"Archivo Black";font-weight:400;src:url("${staticFile("fonts/ArchivoBlack-400.woff2")}") format("woff2");}`;
const shadow = "10px 12px 0 rgba(22,21,19,0.16)";
const eo = Easing.out(Easing.cubic), back = Easing.out(Easing.back(1.15)), expo = Easing.out(Easing.exp);
const tw = (f, a, b, e = eo) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });
const steps = (f, a, b, fps = 12) => { const n = Math.max(1, Math.round(((b - a) / 30) * fps)); const p = Math.min(1, Math.max(0, (f - a) / (b - a))); return Math.floor(p * n) / n; };

/** Paper with grain, edge darkening and a halftone dot field that pans at 12 fps (the only stuttered element). */
const Stage = ({ deep = false, coarse = false }) => {
  const f = useCurrentFrame(), pan = steps(f, 0, 300) * 80;
  return (<AbsoluteFill style={{ background: deep ? V.deep : V.paper }}>
    <div style={abs(-60 + pan, -60, 1300, 2100, { backgroundImage: `radial-gradient(circle, rgba(22,21,19,${coarse ? 0.10 : 0.13}) ${coarse ? 3.5 : 2.2}px, transparent ${coarse ? 4 : 2.6}px)`, backgroundSize: coarse ? "30px 30px" : "18px 18px", opacity: 0.8, WebkitMaskImage: "radial-gradient(ellipse at 15% 10%, #000 0%, transparent 62%)" })} />
    <AbsoluteFill style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(22,21,19,0.05) 1px, transparent 0), radial-gradient(circle at 3px 2px, rgba(22,21,19,0.035) 1px, transparent 0)", backgroundSize: "3px 3px, 5px 5px", opacity: 0.55 }} />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 62%, rgba(22,21,19,0.07) 100%)" }} />
  </AbsoluteFill>);
};
/** The only transition: a paper sheet sweeps across at the start of every scene after the first. */
const Wipe = ({ first }) => { const f = useCurrentFrame(); if (first || f > 12) return null; const x = interpolate(f, [0, 12], [0, 1180], { ...clamp, easing: Easing.in(Easing.cubic) }); return <div style={abs(-100 + x, 0, 1280, 1920, { background: V.deep, boxShadow: "-14px 0 0 rgba(22,21,19,0.12)" })} />; };
/** Paper slap-in: scale 1.15 -> 1, rotation settles a little crooked, back-out ease. */
const Slap = ({ x, y, w, h, rot = -1, delay = 0, children, style }) => {
  const f = useCurrentFrame(), p = tw(f, delay, delay + 15, back), s = 1.15 - 0.15 * p, o = Math.min(1, tw(f, delay, delay + 6));
  return <div style={abs(x, y, w, h, { opacity: o, transform: `scale(${s}) rotate(${rot * 3 - (rot * 2) * p}deg)`, ...style })}>{children}</div>;
};
const Photo = ({ src, fit = "cover", pos = "center" }) => <div style={{ width: "100%", height: "100%", backgroundImage: `url(${src})`, backgroundSize: fit, backgroundPosition: pos, backgroundRepeat: "no-repeat", backgroundColor: V.deep }} />;
const Card = ({ children, style }) => <div style={{ background: V.white, boxShadow: shadow, padding: 14, boxSizing: "border-box", ...style }}>{children}</div>;
/** Highlighter swipe: a real element behind the word, scaleX 0 -> 1 from the left. The text itself never changes colour. */
const Hl = ({ children, delay = 8, color = V.yellow }) => { const f = useCurrentFrame(), s = tw(f, delay, delay + 14, Easing.out(Easing.quad)); return <span style={{ position: "relative", display: "inline-block", zIndex: 0 }}><span style={{ position: "absolute", zIndex: -1, left: "-0.12em", right: "-0.12em", top: "6%", bottom: "-4%", background: color, transform: `scaleX(${s})`, transformOrigin: "left center" }} />{children}</span>; };
const Strike = ({ delay = 0 }) => { const f = useCurrentFrame(), s = tw(f, delay, delay + 17, Easing.out(Easing.cubic)); return <div style={{ position: "absolute", left: "-4%", right: "-4%", top: "48%", height: "0.14em", background: V.red, transform: `scaleX(${s}) rotate(-2.5deg)`, transformOrigin: "left center" }} />; };
const Head = ({ children, y = 120, size = 150, delay = 0, w = 940, color = V.ink }) => { const f = useCurrentFrame(), a = tw(f, delay, delay + 14, expo); return <div style={abs(70, y, w, 520, { fontFamily: HEAD, fontSize: size, lineHeight: 0.98, letterSpacing: "-0.01em", textTransform: "uppercase", color, opacity: a, transform: `translateY(${(1 - a) * 24}px)` })}>{children}</div>; };
const Label = ({ children, x = 70, y, w = 940, color = V.dim, size = 30, delay = 6 }) => { const a = tw(useCurrentFrame(), delay, delay + 12); return <div style={abs(x, y, w, 60, { fontFamily: BODY, fontWeight: 700, fontSize: size, letterSpacing: "0.12em", textTransform: "uppercase", color, opacity: a })}>{children}</div>; };
const Credit = ({ children }) => <div style={abs(70, 1536, 940, 50, { fontFamily: BODY, fontWeight: 500, fontSize: 21, color: V.dim })}>{children}</div>;
/** Rough red-pen circle, drawn on at 12 fps, around the real evidence. */
const Pen = ({ cx, cy, rx, ry, delay = 10 }) => {
  const f = useCurrentFrame(), p = steps(f, delay, delay + 22);
  let pts = []; for (let a = 0; a <= 380; a += 12) { const r = (a * Math.PI) / 180, wob = 1 + 0.04 * Math.sin(a * 0.11 + 1.3) ; pts.push(`${(cx + Math.cos(r) * rx * wob * (1 + a / 4000)).toFixed(1)},${(cy + Math.sin(r) * ry * wob).toFixed(1)}`); }
  return <svg width="1080" height="1920" style={{ position: "absolute", left: 0, top: 0 }}><polyline points={pts.join(" ")} fill="none" stroke={V.red} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - p} /></svg>;
};
const Ticker = ({ from = 0, to, a = 6, b = 30 }) => { const f = useCurrentFrame(); return Math.round(from + (to - from) * Math.min(1, Math.max(0, (f - a) / (b - a)))); };

const Wrap = ({ dur, first, deep, coarse, children }) => <AbsoluteFill><Stage deep={deep} coarse={coarse} />{children}<Wipe first={first} /></AbsoluteFill>;

function Cover({ dur, images, credits, first }) {
  return (<Wrap dur={dur} first={first}>
    <Label y={100} color={V.red}>Grammy Awards · February 2023</Label>
    <Head y={170} size={158}>The <Hl delay={10}>most</Hl> Grammys ever</Head>
    <Slap x={70} y={740} w={940} h={800} rot={-0.5} delay={6}><Card style={{ width: "100%", height: "100%" }}><Photo src={images.p2023} pos="center 20%" /></Card></Slap>
    <Credit>Photo: {credits.p2023}</Credit>
  </Wrap>);
}
function Solti({ dur, images, credits, first }) {
  const n = Ticker({ to: 31, a: 4, b: 26 });
  return (<Wrap dur={dur} first={first} deep coarse>
    <Label y={100} color={V.red}>The old record</Label>
    <div style={abs(40, 150, 700, 560, { fontFamily: HEAD, fontSize: 520, lineHeight: 1, color: V.ink })}><Hl delay={12}>{n}</Hl></div>
    <Label y={720} color={V.ink} size={34}>Grammy wins</Label>
    <Slap x={580} y={330} w={440} h={620} rot={0.6} delay={8}><img src={images.solti} style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(10px 12px 0 rgba(22,21,19,0.16))" }} /></Slap>
    <Slap x={70} y={1040} w={940} h={190} rot={-0.4} delay={16}><Card style={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }}><div style={{ fontFamily: HEAD, fontSize: 56, textTransform: "uppercase", lineHeight: 1 }}>Set by conductor<br /><span style={{ color: V.red }}>Georg Solti</span></div></Card></Slap>
    <Credit>Portrait (1974): {credits.solti}. Halftone ink bake of the real photograph.</Credit>
  </Wrap>);
}
function Nine({ dur, images, credits, first }) {
  const f = useCurrentFrame(), n = Ticker({ to: 9, a: 4, b: 22 });
  return (<Wrap dur={dur} first={first}>
    <Label y={100}>She arrived with</Label>
    <div style={abs(60, 140, 520, 520, { fontFamily: HEAD, fontSize: 470, lineHeight: 1, color: V.ink })}>{n}</div>
    <Label y={640} color={V.ink} size={40}>Nominations</Label>
    <Slap x={560} y={160} w={460} h={640} rot={0.5} delay={6}><img src={images.p2011} style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(10px 12px 0 rgba(22,21,19,0.16))" }} /></Slap>
    <Slap x={70} y={940} w={940} h={460} rot={-0.7} delay={Math.max(14, dur * 0.42)}><Card style={{ width: "100%", height: "100%", padding: 36 }}><div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 30, letterSpacing: "0.12em", textTransform: "uppercase", color: V.dim }}>Half an hour in · best R&amp;B song</div><div style={{ fontFamily: HEAD, fontSize: 96, textTransform: "uppercase", lineHeight: 1, marginTop: 18 }}>“Cuff It”</div><div style={{ fontFamily: HEAD, fontSize: 64, textTransform: "uppercase", color: V.cobalt, marginTop: 18 }}><Hl delay={Math.max(20, dur * 0.5)}>Ties the record</Hl></div></Card></Slap>
    <Credit>Photo ({"2011"}): {credits.p2011}</Credit>
  </Wrap>);
}
function Record({ dur, images, credits, first }) {
  const f = useCurrentFrame(), flip = dur * 0.45;
  return (<Wrap dur={dur} first={first}>
    <Label y={100} color={V.red}>Her fourth win · Renaissance</Label>
    <div style={abs(40, 150, 520, 420, { fontFamily: HEAD, fontSize: 330, lineHeight: 1, color: V.ink, position: "absolute" })}><span style={{ position: "relative", display: "inline-block", opacity: 0.55 }}>31<Strike delay={Math.max(10, flip - 6)} /></span></div>
    <div style={abs(40, 480, 700, 500, { fontFamily: HEAD, fontSize: 400, lineHeight: 1, color: V.cobalt, opacity: tw(f, flip, flip + 10), transform: `scale(${1.15 - 0.15 * tw(f, flip, flip + 14, back)})`, transformOrigin: "left center" })}><Hl delay={flip + 8}>32</Hl></div>
    <Pen cx={290} cy={720} rx={270} ry={215} delay={flip + 14} />
    <Slap x={730} y={150} w={310} h={640} rot={0.8} delay={6}><img src={images.trophy} style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(10px 12px 0 rgba(22,21,19,0.16))" }} /></Slap>
    <Slap x={70} y={1140} w={940} h={200} rot={-0.5} delay={flip + 6}><Card style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", padding: 30 }}><div style={{ fontFamily: HEAD, fontSize: 54, textTransform: "uppercase", lineHeight: 1.02 }}>Best dance / electronic<br />music album</div></Card></Slap>
    <Credit>Trophy photo: {credits.trophy} (Grammy trophies from Kenny Rogers's collection, not Beyoncé's).</Credit>
  </Wrap>);
}
function Quote({ dur, images, credits, first }) {
  return (<Wrap dur={dur} first={first} deep>
    <Label y={100}>On stage</Label>
    <Head y={150} size={120} delay={4}>“I'm just trying to <Hl delay={18}>receive</Hl> this night.”</Head>
    <Slap x={110} y={760} w={860} h={760} rot={0.7} delay={10}><Card style={{ width: "100%", height: "100%" }}><Photo src={images.p2009} pos="center 18%" /></Card></Slap>
    <Credit>Photo (2009, not that night): {credits.p2009}</Credit>
  </Wrap>);
}
const KINDS = { cover: Cover, solti: Solti, nine: Nine, record: Record, quote: Quote };

function Cap({ captions }) {
  const f = useCurrentFrame(), c = captions.find((x) => f >= x.from && f < x.to);
  if (!c) return null;
  return <div style={abs(60, 1620, 960, 200, { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "0 14px", fontFamily: BODY, fontWeight: 700, fontSize: 56, lineHeight: 1.15, textAlign: "center", color: V.ink })}>
    {(c.words || [{ text: c.text, from: c.from }]).map((w, i, arr) => { const on = f >= w.from && (i === arr.length - 1 || f < arr[i + 1].from); return <span key={i} style={{ position: "relative", zIndex: 0, opacity: f >= w.from ? 1 : 0.35 }}><span style={{ position: "absolute", zIndex: -1, left: -6, right: -6, top: "10%", bottom: "-2%", background: V.yellow, opacity: on ? 1 : 0 }} />{w.text}</span>; })}
  </div>;
}
export function CourtVoxPackShort({ durationInFrames, scenes, captions, images, credits }) {
  const f = useCurrentFrame();
  return (<AbsoluteFill style={{ background: V.paper }}><style>{FACE}</style>
    {scenes.map((s, i) => { const K = KINDS[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} images={images} credits={credits} first={i === 0} /></Sequence>; })}
    <Cap captions={captions} />
    <div style={abs(0, 1910, 1080 * (f / durationInFrames), 10, { background: V.ink })} />
  </AbsoluteFill>);
}
const base = { fps: 30, width: 1080, height: 1920, durationInFrames: 780, defaultProps: { durationInFrames: 780, scenes: [], captions: [] } };
export const voxPackCompositions = [{ id: "CourtVoxPackShort", component: CourtVoxPackShort, ...base, defaultProps: { ...base.defaultProps, images: {}, credits: {} } }];
