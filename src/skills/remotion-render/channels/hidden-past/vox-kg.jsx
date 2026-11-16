// Hidden Past, layered Vox Short: Kaliningrad (Königsberg). Same board, parts and rules as vox-beats.jsx / vox-capone.jsx: photographs are never zoomed or
// panned (they slide in and settle), maps are drawn from Natural Earth, every picture is several layers entering in turn. Colours are the engine's own K palette.
import React from "react";
import { AbsoluteFill, Sequence, Easing, useCurrentFrame } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs } from "../_shared/parts.jsx";
import { K, COND, SHADOW, ramp, over, Board, Tri, Dot, Sticker, Num, Title, Stamp, Strip, Cap, hand } from "./vox-beats.jsx";

const MONO = '"JetBrains Mono", "Roboto Mono", ui-monospace, monospace';
const credit = (c, k) => c[k] || "";
const NATO_TINT = "rgba(166,75,20,0.24)";

/** Natural Earth map: sea, neighbours, NATO/EU states shaded, Russia tinted, optional route that draws on, pins and place names. */
function KgMap({ geo, delay = 0, routeDelay = 16 }) {
  const f = useCurrentFrame(), r = geo.rect;
  const ground = ramp(f, delay, delay + 10), tint = ramp(f, delay + 4, delay + 20, Easing.inOut(Easing.cubic)), route = ramp(f, delay + routeDelay, delay + routeDelay + 30, Easing.inOut(Easing.cubic));
  return (
    <div style={abs(r.x, r.y, r.w, r.h, { opacity: ground, boxShadow: SHADOW, overflow: "hidden", background: K.sea })}>
      <svg viewBox={`${r.x} ${r.y} ${r.w} ${r.h}`} width={r.w} height={r.h} style={{ display: "block" }}>
        <path d={geo.landD} fill={K.land} stroke={K.stroke} strokeWidth="2" />
        <path d={geo.natoD} fill={K.land} stroke={K.stroke} strokeWidth="2" />
        <path d={geo.natoD} fill={NATO_TINT} fillOpacity={tint} stroke="none" />
        <path d={geo.countryD} fill={K.focus} fillOpacity={tint} stroke={K.stroke} strokeWidth="5" />
        {geo.labels.map((l, i) => <text key={i} x={l.x} y={l.y} textAnchor="middle" fontFamily={COND} fontWeight={700} fontSize={l.size} letterSpacing="0.1em" fill={K.dim} stroke={K.land} strokeWidth="6" paintOrder="stroke" opacity={ramp(f, delay + 10 + i * 2, delay + 20 + i * 2)}>{l.text}</text>)}
        {geo.routeD ? <path d={geo.routeD} fill="none" stroke={K.frame} strokeWidth="8" strokeLinecap="round" strokeDasharray="1 0.03" pathLength="1" strokeDashoffset={1 - route} /> : null}
        {geo.pins.map((p, i) => { const a = ramp(f, delay + 14 + i * 8, delay + 24 + i * 8, over); return (
          <g key={p.name}>
            <circle cx={p.x} cy={p.y} r={15 * a} fill={K.frame} />
            <path d={hand(p.x, p.y, 46, 46, i * 37 + 19)} fill="none" stroke={K.frame} strokeWidth="5" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - ramp(f, delay + 20 + i * 8, delay + 34 + i * 8)} />
            <text x={p.x + (p.side === "left" ? -62 : 62)} y={p.y + 12} textAnchor={p.side === "left" ? "end" : "start"} fontFamily={COND} fontWeight={700} fontSize="44" fill={K.ink} stroke={K.land} strokeWidth="7" paintOrder="stroke" opacity={a}>{p.name.toUpperCase()}</text>
          </g>); })}
      </svg>
    </div>
  );
}

function Slip({ text, hl, x, y, w, size = 40, delay = 0, rot = -1 }) {
  const f = useCurrentFrame(), a = ramp(f, delay, delay + 9), m = ramp(f, delay + 12, delay + 26);
  const i = hl ? text.indexOf(hl) : -1, parts = i < 0 ? [text, "", ""] : [text.slice(0, i), hl, text.slice(i + hl.length)];
  return (
    <div style={abs(x, y, w, 520, { transform: `translateX(${(1 - a) * 1000}px) rotate(${rot}deg)`, opacity: a > 0 ? 1 : 0 })}>
      <div style={{ background: K.white, padding: "28px 32px", boxShadow: SHADOW, fontFamily: MONO, fontWeight: 700, fontSize: size, lineHeight: 1.34, color: K.ink }}>
        “{parts[0]}<span style={{ backgroundImage: "linear-gradient(rgba(253,224,71,0.75), rgba(253,224,71,0.75))", backgroundRepeat: "no-repeat", backgroundSize: `${m * 100}% 100%` }}>{parts[1]}</span>{parts[2]}”
      </div>
    </div>
  );
}

/** A word that is struck through, as the old name goes. */
function Struck({ children, x, y, size = 100, w = 940, delay = 0 }) {
  const f = useCurrentFrame(), a = ramp(f, delay, delay + 9), s = ramp(f, delay + 8, delay + 18);
  return (
    <div style={abs(x, y, w, size * 1.1, { fontFamily: COND, fontWeight: 700, fontSize: size, lineHeight: 1, textTransform: "uppercase", color: K.dim, opacity: a, transform: `translateY(${(1 - a) * 60}px)` })}>
      <span style={{ position: "relative" }}>{children}<span style={abs(-10, size * 0.5, (children.length * size * 0.5 + 20) * s, 10, { background: K.frame })} /></span>
    </div>
  );
}

// ------------------------------------------------------------------ the thirteen pictures
function Hook({ map }) {
  const p = map.pins[0];
  return (<>
    <Title y={92} size={118} w={940} delay={0}>Russia owns this</Title>
    <KgMap geo={map} delay={0} />
    <Stamp x={Math.max(80, p.x - 20)} y={p.y - 210} w={330} rot={-7} delay={22} size={52}>Russian<br />land</Stamp>
    <Strip x={60} y={1450} w={960} delay={34} size={40}>Between Poland and Lithuania</Strip>
    <Tri x={900} y={130} delay={10} rot={12} />
  </>);
}
function Name({ images, credits }) {
  return (<>
    <Title y={92} size={150} w={940} delay={0}>Kaliningrad</Title>
    <Sticker src={images.cathedral} x={110} y={400} w={860} h={600} rot={-1.6} from="right" delay={3} tapes={[[-30, -14, -34, 170], [700, 570, -30, 170]]} credit={credit(credits, "cathedral")} />
    <Strip x={110} y={1130} w={640} delay={14} size={44}>On the Baltic Sea</Strip>
    <Strip x={330} y={1260} w={660} delay={26} size={36} bg={K.ink}>Poland south, Lithuania north</Strip>
    <Tri x={860} y={1100} delay={8} rot={-10} /><Dot x={900} y={190} s={60} delay={12} />
  </>);
}
function German({ images, credits }) {
  return (<>
    <Num x={60} y={80} size={400} delay={0} w={940}>1946</Num>
    <Sticker src={images.castle} x={100} y={560} w={880} h={590} rot={1.4} from="left" delay={4} tapes={[[-24, -12, -32, 160], [720, 560, -28, 160]]} credit={credit(credits, "castle")} />
    <Stamp x={600} y={1020} w={400} rot={-6} delay={12} size={46}>German<br />city</Stamp>
    <Strip x={100} y={1240} w={860} delay={18} size={42}>Until then: Königsberg</Strip>
    <Dot x={920} y={140} s={56} delay={8} />
  </>);
}
function K1255({ images, credits }) {
  return (<>
    <Num x={60} y={80} size={400} delay={0} w={940}>1255</Num>
    <Sticker src={images.merian} x={150} y={560} w={780} h={560} rot={2} from="bottom" delay={5} tapes={[[-24, -10, -30, 150], [620, 530, -28, 150]]} credit={credit(credits, "merian")} />
    <Strip x={90} y={1230} w={900} delay={12} size={42}>Teutonic Knights found the city</Strip>
    <Tri x={860} y={150} delay={8} rot={14} />
  </>);
}
function K1701({ images, credits }) {
  return (<>
    <Num x={60} y={80} size={400} color={K.ink} delay={0} w={940}>1701</Num>
    <Sticker src={images.coronation} x={110} y={560} w={860} h={590} rot={-1.4} from="right" delay={4} tapes={[[-24, -12, -32, 160], [700, 560, -28, 160]]} credit={credit(credits, "coronation")} />
    <Stamp x={470} y={1000} w={520} rot={5} delay={12} size={46}>Crowned<br />in its castle</Stamp>
    <Strip x={110} y={1260} w={860} delay={18} size={38}>Frederick I, King in Prussia</Strip>
    <Dot x={900} y={150} s={56} delay={8} />
  </>);
}
function Kant({ images, credits }) {
  return (<>
    <Title y={92} size={130} w={940} delay={0}>Immanuel<br />Kant</Title>
    <Sticker src={images.kant} x={80} y={440} w={500} h={560} rot={-2.2} from="left" delay={3} tapes={[[150, -18, -8, 160]]} credit={credit(credits, "kant")} />
    <Strip x={560} y={500} w={460} delay={8} size={40}>Lived there</Strip>
    <Strip x={540} y={640} w={480} delay={16} size={40} bg={K.ink}>virtually all</Strip>
    <Strip x={560} y={780} w={460} delay={24} size={40}>his life</Strip>
    <Tri x={820} y={1000} delay={12} rot={-10} />
  </>);
}
function Bombs({ images, credits }) {
  return (<>
    <Num x={60} y={80} size={400} delay={0} w={940}>1944</Num>
    <Sticker src={images.oldcity} x={110} y={560} w={860} h={610} rot={1.2} from="top" delay={4} tapes={[[-24, -12, -32, 160], [720, 580, -28, 160]]} credit={credit(credits, "oldcity")} />
    <Stamp x={540} y={1060} w={470} rot={5} delay={12} size={44}>Burned<br />for days</Stamp>
    <Strip x={110} y={1280} w={640} delay={20} size={30} bg={K.ink}>Old centre, undated aerial view</Strip>
    <Dot x={900} y={150} s={56} delay={8} />
  </>);
}
function Fall({ images, credits }) {
  return (<>
    <Num x={60} y={80} size={400} color={K.ink} delay={0} w={940}>1945</Num>
    <Strip x={60} y={500} w={420} delay={6} size={48}>9 April</Strip>
    <Sticker src={images.street} x={100} y={600} w={880} h={600} rot={-1.2} from="left" delay={5} tapes={[[-24, -12, -32, 160], [720, 570, -28, 160]]} credit={credit(credits, "street")} />
    <Stamp x={560} y={1090} w={440} rot={6} delay={14} size={44}>Soviets<br />capture it</Stamp>
    <Tri x={860} y={140} delay={8} rot={12} />
  </>);
}
function Potsdam({ images, credits }) {
  return (<>
    <Sticker src={images.potsdam} x={130} y={110} w={820} h={640} rot={-1.2} from="top" delay={0} tapes={[[-24, -12, -32, 160], [640, 610, -28, 160]]} credit={credit(credits, "potsdam")} />
    <Slip text="…agreed in principle to the proposal of the Soviet Government concerning the ultimate transfer to the Soviet Union of the City of Koenigsberg…" hl="ultimate transfer" x={80} y={850} w={920} size={38} delay={10} rot={-0.8} />
    <Strip x={80} y={1400} w={760} delay={22} size={34}>Potsdam Agreement, section V</Strip>
  </>);
}
function Rename({ images, credits }) {
  const f = useCurrentFrame(), a = ramp(f, 12, 22);
  return (<>
    <Num x={60} y={90} size={330} delay={0} w={600}>1946</Num>
    <Sticker src={images.kalinin} x={620} y={110} w={400} h={560} rot={3} from="right" delay={2} tapes={[[130, -16, -8, 120]]} credit={credit(credits, "kalinin")} />
    <Struck x={60} y={560} size={100} delay={4}>Königsberg</Struck>
    <div style={abs(60, 740, 960, 200, { fontFamily: COND, fontWeight: 700, fontSize: 150, lineHeight: 1, textTransform: "uppercase", color: K.frame, transform: `translateX(${(1 - a) * -900}px) rotate(-3deg)`, opacity: a })}>Kaliningrad</div>
    <Strip x={60} y={1050} w={940} delay={20} size={36}>After Mikhail Kalinin</Strip>
    <Strip x={120} y={1180} w={880} delay={28} size={36} bg={K.ink}>Unrelated to the city</Strip>
  </>);
}
function Today({ wide }) {
  return (<>
    <Title y={92} size={104} w={940} delay={0}>Land links</Title>
    <KgMap geo={wide} delay={0} routeDelay={12} />
    <Stamp x={70} y={1170} w={430} rot={-6} delay={26} size={44}>Crosses<br />NATO + EU</Stamp>
    <Strip x={60} y={1450} w={960} delay={34} size={32}>Route schematic · every land link crosses NATO and EU members</Strip>
  </>);
}
function Answer({ images, credits }) {
  return (<>
    <Title y={80} size={116} w={940} delay={0}>German city</Title>
    <Title y={205} size={116} w={940} color={K.frame} delay={14}>Russian now</Title>
    <Sticker src={images.castle} x={60} y={440} w={620} h={440} rot={-3} from="left" delay={2} filter="grayscale(1) contrast(0.95)" tapes={[[100, -16, -8, 130]]} credit={credit(credits, "castle")} />
    <Strip x={60} y={960} w={260} delay={10} size={40} bg={K.ink}>Before 1900</Strip>
    <Sticker src={images.cathedral} x={380} y={900} w={640} h={450} rot={2.4} from="right" delay={8} tapes={[[-20, -10, -30, 150], [500, 410, -28, 150]]} credit={credit(credits, "cathedral")} />
    <Strip x={640} y={1400} w={220} delay={16} size={40}>2012</Strip>
  </>);
}
function Outro({ map }) {
  const p = map.pins[0];
  return (<>
    <Title y={92} size={118} w={940} delay={0}>Russia owns this</Title>
    <KgMap geo={map} delay={0} />
    <Stamp x={Math.max(80, p.x - 20)} y={p.y - 210} w={330} rot={-7} delay={4} size={52}>Russian<br />land</Stamp>
    <Stamp x={90} y={900} w={900} rot={-4} delay={8} size={86}>Full story<br />on our channel</Stamp>
    <Strip x={60} y={1450} w={960} delay={16} size={36}>Hidden Past · Kaliningrad, in full</Strip>
  </>);
}

const BEATS = { hook: Hook, name: Name, german: German, k1255: K1255, k1701: K1701, kant: Kant, bombs: Bombs, fall: Fall, potsdam: Potsdam, rename: Rename, today: Today, answer: Answer, outro: Outro };

export function HiddenPastVoxKg({ durationInFrames, scenes, captions, images, credits, map, wide }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: K.frame }}><style>{FONT_FACES}</style>
      <Board f={f} />
      {scenes.map((s) => { const B = BEATS[s.kind]; return B ? <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><AbsoluteFill><B images={images} credits={credits} map={map} wide={wide} /></AbsoluteFill></Sequence> : null; })}
      <Cap captions={captions} />
      <div style={abs(36, 1884, 1008 * (f / durationInFrames), 8, { background: K.ink })} />
    </AbsoluteFill>
  );
}
const base = { fps: 30, width: 1080, height: 1920, durationInFrames: 1140, defaultProps: { durationInFrames: 1140, scenes: [], captions: [], images: {}, credits: {}, map: null, wide: null } };
export const voxKgCompositions = [{ id: "HiddenPastVoxKg", component: HiddenPastVoxKg, ...base }];
