// Hidden Past, layered Vox cut: the Avianca Flight 203 bombing. Same board, parts and rules as vox-beats.jsx (photographs are never zoomed or panned;
// counts are drawn literally; maps are drawn from Natural Earth). New here: a cut-out of the real aircraft that flies along the drawn route and then
// splits in two, a literal dot count of the dead (107 on board, 3 on the ground), and a portrait that carries across four beats under changing stamps.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs, clamp } from "../_shared/parts.jsx";
import { K, COND, SHADOW, ramp, over, Board, Tri, Dot, Sticker, Num, Title, Stamp, Strip, MapBoard, Cap, hand } from "./vox-beats.jsx";

const CUT_FILTER = "drop-shadow(3px 0 0 #fff) drop-shadow(-3px 0 0 #fff) drop-shadow(0 3px 0 #fff) drop-shadow(0 -3px 0 #fff) drop-shadow(5px 9px 8px rgba(26,23,19,0.32)) grayscale(0.2) sepia(0.15) contrast(1.05)";
const lerp = (a, b, t) => a + (b - a) * t;

/** A grid of dots, one per person. The first `ink` are dark; the rest are the accent. Drawn in order, literally counted. */
function Dots({ count, accentFrom, cols, x, y, gap, r, delay = 0 }) {
  const f = useCurrentFrame(), step = Math.min(0.5, 24 / count);
  const rows = Math.ceil(count / cols);
  return (
    <svg viewBox={`0 0 ${cols * gap} ${rows * gap}`} style={abs(x, y, cols * gap, rows * gap, { overflow: "visible" })}>
      {Array.from({ length: count }, (_, i) => {
        const c = i % cols, rr = Math.floor(i / cols), at = delay + Math.floor(i * step) + (i >= accentFrom ? 14 : 0), a = ramp(f, at, at + 7, over);
        return <circle key={i} cx={c * gap + gap / 2} cy={rr * gap + gap / 2} r={r * a} fill={i >= accentFrom ? K.frame : K.ink} opacity={i >= accentFrom ? 1 : 0.88} />;
      })}
    </svg>
  );
}

/** A flat starburst in the accent colour: a drawn shape, not an image of an explosion. */
function Burst({ x, y, size = 160, delay = 0 }) {
  const f = useCurrentFrame(), a = ramp(f, delay, delay + 9, over);
  const pts = Array.from({ length: 24 }, (_, i) => { const t = (i / 24) * Math.PI * 2, rr = i % 2 ? size * 0.5 : size; return `${(Math.cos(t) * rr).toFixed(1)},${(Math.sin(t) * rr).toFixed(1)}`; }).join(" ");
  return <svg viewBox="0 0 1080 1920" style={abs(0, 0, 1080, 1920)}><g transform={`translate(${x} ${y}) scale(${a}) rotate(${(1 - a) * 40})`}><polygon points={pts} fill={K.frame} /><circle r={size * 0.28} fill={K.paper} /></g></svg>;
}

// ---------------------------------------------------------------- the sixteen pictures
function Plane({ images, credits }) {
  return (<>
    <Title size={170} delay={0} w={600}>Nov 27<br />1989</Title>
    <Stamp x={660} y={150} w={340} rot={6} delay={10} size={44}>Destroyed<br />by a bomb</Stamp>
    <Sticker src={images.plane} x={90} y={620} w={900} h={563} rot={-1.4} from="right" delay={3} tapes={[[-30, -14, -34, 170], [720, 540, -30, 170]]} credit={credits.plane} />
    <Strip x={90} y={1270} w={800} delay={12} size={34}>Avianca Boeing 727, HK-1803, in 1982</Strip>
    <Tri x={860} y={440} delay={6} rot={12} />
  </>);
}
function Route({ map, cut }) {
  const f = useCurrentFrame(), [b, c] = [map.pins[0], map.pins[1]], p = ramp(f, 12, 56, Easing.inOut(Easing.cubic));
  const w = 190, h = w / cut.aspect, x = lerp(b.x, c.x, p) - w / 2, y = lerp(b.y, c.y, p) - h / 2 - Math.sin(p * Math.PI) * 40;
  return (<>
    <Title y={92} size={100} w={960}>Flight 203</Title>
    <MapBoard geo={map} delay={0} />
    <img src={cut.src} style={abs(x, y, w, h, { objectFit: "contain", filter: CUT_FILTER, opacity: ramp(f, 10, 16), transform: `rotate(${-8 * Math.sin(p * Math.PI)}deg)` })} />
    <Strip x={60} y={1445} w={640} delay={14} size={34}>07:13 · Bogotá to Cali</Strip>
  </>);
}
function Boom({ map }) {
  const f = useCurrentFrame(), s = map.soacha;
  return (<>
    <Title y={92} size={100} w={960}>Over Soacha</Title>
    <MapBoard geo={map} delay={-80} />
    <Burst x={s.x - 20} y={s.y + 20} size={80} delay={4} />
    <svg viewBox="0 0 1080 1920" style={abs(0, 0, 1080, 1920)}><path d={`M${s.x} ${s.y} L ${s.x + 190} ${s.y - 120}`} stroke={K.ink} strokeWidth="5" fill="none" opacity={ramp(f, 12, 20)} /><text x={s.x + 200} y={s.y - 124} fontFamily={COND} fontWeight={700} fontSize="54" fill={K.ink} stroke={K.land} strokeWidth="8" paintOrder="stroke" opacity={ramp(f, 14, 24)}>SOACHA</text></svg>
    <div style={abs(60, 1020, 440, 380, { background: K.paper, boxShadow: SHADOW, transform: `translateY(${(1 - ramp(f, 6, 18)) * 500}px)` })} />
    <Num x={80} y={1010} size={330} delay={8} w={400}>5</Num>
    <Strip x={60} y={1445} w={800} delay={14} size={34}>Minutes after takeoff</Strip>
  </>);
}
function Apart({ cut }) {
  const f = useCurrentFrame(), a = ramp(f, 14, 46, Easing.in(Easing.quad)), w = 900, h = w / cut.aspect;
  const half = (clip, dx, rot, dy) => <img src={cut.src} style={abs(90, 430, w, h, { objectFit: "contain", filter: CUT_FILTER, clipPath: clip, transform: `translate(${dx * a}px, ${dy * a}px) rotate(${rot * a}deg)` })} />;
  return (<>
    <Title y={92} size={100} w={960}>Soacha</Title>
    <Burst x={540} y={430 + h / 2} size={220} delay={10} />
    {half("inset(0 50% 0 0)", -90, -16, 330)}
    {half("inset(0 0 0 50%)", 90, 20, 470)}
    <Num x={60} y={1010} size={260} delay={6} w={500} color={K.ink}>5 km</Num>
    <Strip x={60} y={1270} w={940} delay={12} size={32}>Wreckage scattered around the town</Strip>
  </>);
}
function Toll() {
  return (<>
    <Num x={60} y={90} size={300} delay={0} w={560} color={K.ink}>107</Num>
    <Num x={600} y={160} size={220} delay={10} w={400}>+3</Num>
    <Strip x={60} y={430} w={940} delay={6} size={34}>On board · and on the ground</Strip>
    <Dots count={110} accentFrom={107} cols={11} x={100} y={560} gap={80} r={29} delay={4} />
  </>);
}
function Who() {
  return (<>
    <Num x={0} y={140} size={980} delay={0} w={1080} align="center">?</Num>
    <Strip x={140} y={1130} w={800} delay={8} size={44}>Who ordered it?</Strip>
    <Tri x={120} y={150} delay={6} rot={-12} />
  </>);
}
function Explosives() {
  return (<>
    <Stamp x={70} y={300} w={940} rot={-5} delay={2} size={120}>Plastic<br />explosives</Stamp>
    <Strip x={90} y={800} w={760} delay={10} size={38} rot={1}>The investigation's finding</Strip>
    <Tri x={820} y={110} delay={6} rot={14} /><Dot x={110} y={1000} s={70} delay={10} />
  </>);
}
function Cartel({ images, credits }) {
  return (<>
    <Sticker src={images.escobar} x={80} y={250} w={520} h={690} rot={-2} from="left" delay={0} tapes={[[170, -20, -8, 170]]} credit={credits.escobar} />
    <Stamp x={540} y={420} w={470} rot={6} delay={8} size={62}>Medellín<br />Cartel</Stamp>
    <Strip x={80} y={1040} w={940} delay={12} size={36}>Bombing planned by Pablo Escobar</Strip>
    <Dot x={880} y={140} s={60} delay={6} />
  </>);
}
function Portrait({ images, credits, ring = true, stamp, strip, strip2, year = true, ringDelay = 12 }) {
  const f = useCurrentFrame();
  return (<>
    <Sticker src={images.gaviria} x={80} y={250} w={500} h={654} rot={-1.5} from="left" delay={0} tapes={[[150, -20, -8, 160]]} credit={credits.gaviria} />
    {ring ? <svg viewBox="0 0 1080 1920" style={abs(0, 0, 1080, 1920)}><path d={hand(330, 480, 175, 200, 9)} fill="none" stroke={K.frame} strokeWidth="9" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - ramp(f, ringDelay, ringDelay + 16)} /></svg> : null}
    {year ? <><Num x={610} y={270} size={190} delay={4} w={400} color={K.ink}>1990</Num><Strip x={610} y={470} w={380} delay={10} size={30}>Election year</Strip></> : null}
    {stamp}
    <Strip x={80} y={1010} w={940} delay={10} size={36}>{strip}</Strip>
    {strip2 ? <Strip x={80} y={1130} w={760} delay={16} size={30} bg={K.ink}>{strip2}</Strip> : null}
  </>);
}
const Target = (p) => <Portrait {...p} strip="Presidential candidate César Gaviria" strip2="Photographed in 2009" />;
const Absent = (p) => <Portrait {...p} ringDelay={-40} strip="Escobar expected him on board" stamp={<Stamp x={110} y={640} w={860} rot={-9} delay={8} size={110}>Not on board</Stamp>} />;
const Elected = (p) => <Portrait {...p} ringDelay={-40} year={false} strip="He went on to be elected president" stamp={<Stamp x={380} y={640} w={640} rot={7} delay={8} size={84} color={K.ink}>Elected</Stamp>} />;
function Das() {
  return (<>
    <Num x={60} y={80} size={440} delay={0} w={620}>63</Num>
    <Strip x={560} y={150} w={450} delay={6} size={34}>9 days later</Strip>
    <Strip x={560} y={270} w={450} delay={10} size={34} bg={K.ink}>Bogotá · DAS Building</Strip>
    <Dots count={63} accentFrom={999} cols={9} x={140} y={620} gap={86} r={31} delay={6} />
    <div style={abs(80, 1370, 920, 40, { fontFamily: COND, fontWeight: 700, fontSize: 28, letterSpacing: "0.05em", color: K.dim, textTransform: "uppercase" })}>Presumably also ordered by the cartel, per Wikipedia</div>
  </>);
}
function Americans() {
  return (<>
    <Num x={60} y={90} size={620} delay={0} w={500}>2</Num>
    <Strip x={420} y={250} w={590} delay={8} size={36}>Americans among the dead</Strip>
    <Stamp x={90} y={900} w={900} rot={-4} delay={14} size={86}>The hunt for<br />Escobar begins</Stamp>
    <Tri x={860} y={110} delay={6} rot={10} />
  </>);
}
function Assassin() {
  return (<>
    <Num x={60} y={90} size={560} delay={0} w={620}>10</Num>
    <Strip x={440} y={250} w={570} delay={8} size={34}>Consecutive life sentences</Strip>
    <Strip x={90} y={800} w={880} delay={14} size={34} bg={K.ink}>“La Quica”, the cartel's chief assassin</Strip>
    <Strip x={90} y={930} w={600} delay={18} size={32}>Convicted in a US court, 1994</Strip>
  </>);
}
function Disputed({ images, credits }) {
  return (<>
    <Stamp x={110} y={250} w={860} rot={-7} delay={2} size={170}>Disputed</Stamp>
    <Strip x={80} y={720} w={920} delay={10} size={34}>2016, El Espectador: a faulty fuel pump</Strip>
    <Strip x={80} y={850} w={920} delay={16} size={34} bg={K.ink}>Rejected by Avianca and the families</Strip>
    <Sticker src={images.plane} x={560} y={1010} w={440} h={275} rot={3} from="bottom" delay={8} filter="grayscale(1) contrast(0.95)" tapes={[[120, -16, -8, 120]]} />
  </>);
}
function Close({ images, credits }) {
  return (<>
    <Title x={80} y={90} size={140} w={620}>One target.<br />110 dead.</Title>
    <Sticker src={images.gaviria} x={730} y={130} w={270} h={353} rot={4} from="top" delay={4} filter="grayscale(1) contrast(0.9)" tapes={[[80, -14, -8, 100]]} />
    <Dots count={110} accentFrom={107} cols={11} x={150} y={640} gap={70} r={25} delay={0} />
  </>);
}

const BEATS = { plane: Plane, route: Route, boom: Boom, apart: Apart, toll: Toll, who: Who, explosives: Explosives, cartel: Cartel, target: Target, absent: Absent, elected: Elected, das: Das, americans: Americans, assassin: Assassin, disputed: Disputed, close: Close };

export function HiddenPastVoxCrime({ durationInFrames, scenes, captions, images, credits, cut, map }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: K.frame }}><style>{FONT_FACES}</style>
      <Board f={f} />
      {scenes.map((s) => { const B = BEATS[s.kind]; return B ? <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><AbsoluteFill><B images={images} credits={credits} cut={cut} map={map} /></AbsoluteFill></Sequence> : null; })}
      <div style={abs(80, 1516, 920, 40, { fontFamily: COND, fontWeight: 700, fontSize: 26, letterSpacing: "0.12em", color: K.dim, textTransform: "uppercase" })}>Avianca Flight 203 · 27 November 1989</div>
      <Cap captions={captions} />
      <div style={abs(36, 1884, 1008 * (f / durationInFrames), 8, { background: K.ink })} />
    </AbsoluteFill>
  );
}
const base = { fps: 30, width: 1080, height: 1920, durationInFrames: 1140, defaultProps: { durationInFrames: 1140, scenes: [], captions: [], images: {}, credits: {}, cut: { src: "", aspect: 3 }, map: null } };
export const voxCrimeCompositions = [{ id: "HiddenPastVoxCrime", component: HiddenPastVoxCrime, ...base }];
