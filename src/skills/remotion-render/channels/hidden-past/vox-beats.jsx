// Hidden Past, layered Vox cut. Each picture is built from several layers (a sticker photograph, giant numerals, stamps, tape, a drawn map or a
// counted herd of cut-outs) that enter in turn, on a board that drifts continuously underneath so the cuts feel connected.
// Grammar from CK42BB/vox-explainer-skill (MIT, references/vox-style-guide.md): paper cut-outs with white sticker borders and soft shadows,
// halftone, tape, one accent colour, flat geometric accents, stamps, bold condensed type, elements that slide in from an edge and settle.
// Channel rule kept: archival photographs are never zoomed, panned or scaled while they are on screen. Counts are drawn literally:
// one real hippo cut-out repeated N times in an even grid. Nothing is generated.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs, clamp } from "../_shared/parts.jsx";

const COND = '"Roboto Condensed", sans-serif';
const K = { frame: "#A64B14", paper: "#EFE6D2", ink: "#1A1713", dim: "#6B604E", white: "#FFFFFF", tape: "rgba(226,206,160,0.86)", sea: "#D3DCDC", land: "#F4EEE2", focus: "#E7C9A2", stroke: "#8A7B66" };
const out = Easing.out(Easing.cubic), over = Easing.out(Easing.back(1.25));
const ramp = (f, a, b, e = out) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });
const SHADOW = "10px 16px 0 rgba(26,23,19,0.18), 0 22px 40px rgba(26,23,19,0.25)";

/** The board under every picture: saturated frame, cream panel, halftone that drifts with the global frame. */
const Board = ({ f }) => (
  <AbsoluteFill style={{ background: K.frame }}>
    <div style={abs(36, 36, 1008, 1848, { background: K.paper, boxShadow: "0 0 0 6px rgba(0,0,0,0.12) inset", overflow: "hidden" })}>
      <div style={abs(-40 + f * 0.5, -40, 560, 560, { backgroundImage: `radial-gradient(${K.frame} 22%, transparent 24%)`, backgroundSize: "26px 26px", opacity: 0.2, WebkitMaskImage: "radial-gradient(circle at 20% 20%, #000 0%, transparent 70%)", maskImage: "radial-gradient(circle at 20% 20%, #000 0%, transparent 70%)" })} />
      <div style={abs(480 - f * 0.5, 1290, 560, 560, { backgroundImage: `radial-gradient(${K.ink} 22%, transparent 24%)`, backgroundSize: "26px 26px", opacity: 0.1, WebkitMaskImage: "radial-gradient(circle at 80% 80%, #000 0%, transparent 70%)", maskImage: "radial-gradient(circle at 80% 80%, #000 0%, transparent 70%)" })} />
    </div>
  </AbsoluteFill>
);

const Tape = ({ x, y, rot = 0, w = 170 }) => <div style={abs(x, y, w, 52, { background: K.tape, transform: `rotate(${rot}deg)`, boxShadow: "0 2px 4px rgba(0,0,0,0.18)", backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0 8px, transparent 8px 16px)" })} />;
const Tri = ({ x, y, s = 110, rot = 0, delay = 0 }) => { const f = useCurrentFrame(), a = ramp(f, delay, delay + 8, over); return <div style={abs(x, y, s, s, { background: K.frame, clipPath: "polygon(50% 0, 100% 100%, 0 100%)", transform: `rotate(${rot}deg) scale(${a})`, opacity: a })} />; };
const Dot = ({ x, y, s = 64, delay = 0 }) => { const f = useCurrentFrame(), a = ramp(f, delay, delay + 8, over); return <div style={abs(x, y, s, s, { background: K.frame, borderRadius: s, transform: `scale(${a})` })} />; };

/** A photograph as a sticker: white border, hard and soft shadow. It slides in from an edge and settles; it is never scaled. */
const Sticker = ({ src, x, y, w, h, rot = 0, from = "left", delay = 0, fit = "cover", tapes = [], credit, filter, pad = 14, creditTop = false }) => {
  const f = useCurrentFrame(), a = ramp(f, delay, delay + 9);
  const dx = from === "left" ? -(1 - a) * 1000 : from === "right" ? (1 - a) * 1000 : 0, dy = from === "bottom" ? (1 - a) * 900 : from === "top" ? -(1 - a) * 900 : 0;
  return (
    <div style={abs(x, y, w, h, { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: a > 0 ? 1 : 0 })}>
      <div style={abs(0, 0, w, h, { background: K.white, padding: pad, boxSizing: "border-box", boxShadow: SHADOW })}>
        <img src={src} style={{ width: "100%", height: "100%", objectFit: fit, display: "block", filter }} />
      </div>
      {tapes.map(([tx, ty, tr, tw], i) => <Tape key={i} x={tx} y={ty} rot={tr} w={tw} />)}
      {credit ? <div style={abs(0, creditTop ? -36 : h + 12, w, 30, { fontFamily: COND, fontWeight: 400, fontSize: 22, color: K.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" })}>{credit}</div> : null}
    </div>
  );
};

/** One cut-out (alpha PNG) with a white sticker outline. */
const CUT_FILTER = "drop-shadow(3px 0 0 #fff) drop-shadow(-3px 0 0 #fff) drop-shadow(0 3px 0 #fff) drop-shadow(0 -3px 0 #fff) drop-shadow(5px 9px 8px rgba(26,23,19,0.32)) grayscale(0.35) sepia(0.22) contrast(1.05)";
const Cut = ({ src, x, y, w, h, delay = 0, rot = 0, from = "bottom" }) => {
  const f = useCurrentFrame(), a = ramp(f, delay, delay + 10);
  const dx = from === "left" ? -(1 - a) * 700 : from === "right" ? (1 - a) * 700 : 0, dy = from === "bottom" ? (1 - a) * 500 : 0;
  return <img src={src} style={abs(x, y, w, h, { objectFit: "contain", transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: a > 0 ? 1 : 0, filter: CUT_FILTER })} />;
};

const Num = ({ children, x, y, size, color = K.frame, delay = 0, rot = 0, w = 900, align = "left" }) => {
  const f = useCurrentFrame(), a = ramp(f, delay, delay + 9, over);
  return <div style={abs(x, y, w, size * 1.05, { fontFamily: COND, fontWeight: 700, fontSize: size, lineHeight: 1, letterSpacing: "-0.02em", color, textAlign: align, transform: `rotate(${rot}deg) translateY(${(1 - a) * 90}px)`, opacity: a })}>{children}</div>;
};
const Title = ({ children, x = 80, y = 100, size = 150, color = K.ink, delay = 0, w = 920 }) => { const f = useCurrentFrame(), a = ramp(f, delay, delay + 9); return <div style={abs(x, y, w, size * 2.2, { fontFamily: COND, fontWeight: 700, fontSize: size, lineHeight: 0.92, textTransform: "uppercase", letterSpacing: "-0.01em", color, transform: `translateX(${(1 - a) * -700}px)`, opacity: a })}>{children}</div>; };
const Stamp = ({ children, x, y, w = 560, rot = -6, delay = 8, size = 56, color = K.frame }) => { const f = useCurrentFrame(), a = ramp(f, delay, delay + 7, over); return <div style={abs(x, y, w, size * 2.1, { border: `8px solid ${color}`, color, fontFamily: COND, fontWeight: 700, fontSize: size, lineHeight: 1.05, textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", transform: `rotate(${rot}deg) scale(${0.6 + 0.4 * a})`, opacity: a, boxSizing: "border-box" })}>{children}</div>; };
const Strip = ({ children, x, y, w = 800, delay = 6, size = 40, bg = K.frame, color = K.paper, rot = 0 }) => { const f = useCurrentFrame(), a = ramp(f, delay, delay + 9); return <div style={abs(x, y, w, size * 1.9, { background: bg, color, fontFamily: COND, fontWeight: 700, fontSize: size, letterSpacing: "0.05em", textTransform: "uppercase", display: "flex", alignItems: "center", padding: "0 26px", boxSizing: "border-box", transform: `translateX(${(1 - a) * 900}px) rotate(${rot}deg)`, opacity: a, boxShadow: "6px 9px 0 rgba(26,23,19,0.16)" })}>{children}</div>; };

function hand(cx, cy, rx, ry, seed) {
  let s = seed; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; };
  const pts = [];
  for (let a = 0; a <= 390; a += 15) { const t = (a * Math.PI) / 180, wob = 1 + rnd() * 0.05; pts.push(`${Math.round(cx + Math.cos(t - 1.2) * rx * wob * (1 + a / 9000))} ${Math.round(cy + Math.sin(t - 1.2) * ry * wob)}`); }
  return "M" + pts.join(" L");
}

/** One real hippo cut-out repeated `count` times in an even grid; the first `cull` are recoloured in the accent. Drawn with one <image> and <use> copies. */
function Herd({ src, aspect, count, cols, x, y, w, delay = 0, cull = 0, cullAt = 0, faded = 1 }) {
  const f = useCurrentFrame();
  const cw = w / cols, ch = cw / aspect, rows = Math.ceil(count / cols), step = Math.min(2, 22 / count);
  const id = `hip${count}`;
  return (
    <svg viewBox={`0 0 ${w} ${rows * ch}`} style={abs(x, y, w, rows * ch, { overflow: "visible" })}>
      <defs>
        <image id={id} href={src} width={cw} height={ch} preserveAspectRatio="xMidYMid meet" />
        <filter id={`${id}acc`}><feColorMatrix type="matrix" values="0 0 0 0 0.651  0 0 0 0 0.294  0 0 0 0 0.078  0 0 0 1 0" /></filter>
        <filter id={`${id}shadow`}><feDropShadow dx="1.5" dy="2.5" stdDeviation="1.5" floodColor="#1A1713" floodOpacity="0.3" /></filter>
      </defs>
      {Array.from({ length: count }, (_, i) => {
        const c = i % cols, r = Math.floor(i / cols), at = delay + Math.floor(i * step), a = ramp(f, at, at + 7, over);
        const isCull = i < cull && f >= cullAt + Math.floor(i * 0.6);
        const cx = c * cw + cw / 2, cy = r * ch + ch / 2;
        return <use key={i} href={`#${id}`} x={c * cw} y={r * ch} opacity={a * (isCull ? 1 : faded)} filter={isCull ? `url(#${id}acc)` : `url(#${id}shadow)`} transform={`translate(${cx} ${cy}) scale(${0.55 + 0.45 * a}) translate(${-cx} ${-cy})`} />;
      })}
    </svg>
  );
}

/** A drawn map: sea, neighbours, the tinted country, a route that draws on and pins that pop. All geometry is computed from Natural Earth. */
function MapBoard({ geo, delay = 0 }) {
  const f = useCurrentFrame(), r = geo.rect;
  const ground = ramp(f, delay, delay + 10), country = ramp(f, delay + 4, delay + 22, Easing.inOut(Easing.cubic)), route = ramp(f, delay + 14, delay + 40, Easing.inOut(Easing.cubic));
  return (
    <div style={abs(r.x, r.y, r.w, r.h, { opacity: ground, boxShadow: SHADOW, overflow: "hidden", background: K.sea })}>
      <svg viewBox={`${r.x} ${r.y} ${r.w} ${r.h}`} width={r.w} height={r.h} style={{ display: "block" }}>
        <path d={geo.landD} fill={K.land} stroke={K.stroke} strokeWidth="2" />
        <path d={geo.countryD} fill={K.focus} fillOpacity={country} stroke={K.stroke} strokeWidth="5" />
        {geo.labels.map((l, i) => <text key={i} x={l.x} y={l.y} textAnchor="middle" fontFamily={COND} fontWeight={700} fontSize={l.size} letterSpacing="0.1em" fill={l.color || K.dim} opacity={ramp(f, delay + 12 + i * 2, delay + 22 + i * 2)}>{l.text}</text>)}
        <path d={geo.routeD} fill="none" stroke={K.frame} strokeWidth="7" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - route} />
        {geo.pins.map((p, i) => { const a = ramp(f, delay + 16 + i * 8, delay + 26 + i * 8, over); return (
          <g key={p.name}>
            <circle cx={p.x} cy={p.y} r={14 * a} fill={K.frame} />
            <path d={hand(p.x, p.y, 44, 44, i * 37 + 19)} fill="none" stroke={K.frame} strokeWidth="5" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - ramp(f, delay + 22 + i * 8, delay + 36 + i * 8)} />
            <text x={p.x + (p.side === "left" ? -58 : 58)} y={p.y + 10} textAnchor={p.side === "left" ? "end" : "start"} fontFamily={COND} fontWeight={700} fontSize="40" fill={K.ink} stroke={K.land} strokeWidth="6" paintOrder="stroke" opacity={a}>{p.name}</text>
          </g>); })}
      </svg>
    </div>
  );
}

/** World outline with an arc drawn from one place to another. */
function ArcMap({ geo, delay = 0 }) {
  const f = useCurrentFrame(), r = geo.rect, ground = ramp(f, delay, delay + 10), arc = ramp(f, delay + 10, delay + 40, Easing.inOut(Easing.cubic));
  return (
    <div style={abs(r.x, r.y, r.w, r.h, { opacity: ground, boxShadow: SHADOW, overflow: "hidden", background: K.sea })}>
      <svg viewBox={`0 0 ${r.w} ${r.h}`} width={r.w} height={r.h} style={{ display: "block" }}>
        <path d={geo.landD} fill={K.land} stroke={K.stroke} strokeWidth="1.5" />
        {geo.focus.map((d, i) => <path key={i} d={d} fill={K.focus} stroke={K.stroke} strokeWidth="2" />)}
        <path d={geo.arcD} fill="none" stroke={K.frame} strokeWidth="8" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - arc} />
        {geo.pins.map((p, i) => { const a = ramp(f, delay + 8 + i * 22, delay + 18 + i * 22, over); return (
          <g key={p.name}>
            <circle cx={p.x} cy={p.y} r={16 * a} fill={K.frame} />
            <text x={p.x} y={p.y - 34} textAnchor="middle" fontFamily={COND} fontWeight={700} fontSize="52" fill={K.ink} stroke={K.land} strokeWidth="8" paintOrder="stroke" letterSpacing="0.06em" opacity={a}>{p.name}</text>
          </g>); })}
      </svg>
    </div>
  );
}

/** The story's own years along the bottom: the line fills to the year being told, so every count beat carries the one before it. */
const YEARS = ["1981", "1993", "2007", "2014", "2026"];
function Timeline({ active, delay = 6 }) {
  const f = useCurrentFrame(), x0 = 120, x1 = 960, y = 1420, fill = ramp(f, delay, delay + 16, Easing.inOut(Easing.cubic));
  const px = (i) => x0 + ((x1 - x0) * i) / (YEARS.length - 1);
  return (
    <svg viewBox="0 0 1080 1920" style={abs(0, 0, 1080, 1920)}>
      <line x1={x0} y1={y} x2={x1} y2={y} stroke={K.stroke} strokeWidth="4" opacity="0.6" />
      <line x1={x0} y1={y} x2={x0 + (px(active) - x0) * fill} y2={y} stroke={K.frame} strokeWidth="8" strokeLinecap="round" />
      {YEARS.map((yr, i) => { const on = i <= active, a = ramp(f, delay + i * 2, delay + 8 + i * 2); return (
        <g key={yr} opacity={a}>
          <circle cx={px(i)} cy={y} r={i === active ? 17 : 10} fill={on ? K.frame : K.paper} stroke={on ? K.frame : K.stroke} strokeWidth="4" />
          <text x={px(i)} y={y + 58} textAnchor="middle" fontFamily={COND} fontWeight={700} fontSize={i === active ? 46 : 34} fill={i === active ? K.frame : K.dim}>{yr}</text>
        </g>); })}
    </svg>
  );
}

const credit = (c, k) => c[k] || "";

// ---------------------------------------------------------------- the fourteen pictures
function Still({ images, credits }) {
  return (<>
    <Title delay={0}>Still<br />alive</Title>
    <Sticker src={images.hippoA} x={120} y={520} w={840} h={630} rot={-1.6} from="right" delay={3} tapes={[[-30, -14, -34, 170], [700, 590, -30, 170]]} credit={credit(credits, "hippoA")} />
    <Strip x={120} y={1260} w={640} delay={12}>Hacienda Nápoles, 2008</Strip>
    <Tri x={830} y={120} delay={6} rot={12} /><Dot x={900} y={1250} delay={10} />
  </>);
}
function Approved({ images, credits }) {
  return (<>
    <Num x={50} y={120} size={600} rot={-3} delay={0} w={980}>80+</Num>
    <Stamp x={90} y={800} w={560} rot={-6} delay={8}>Approved<br />13 Apr 2026</Stamp>
    <Sticker src={images.hippoA} x={600} y={900} w={400} h={300} rot={3.5} from="bottom" delay={5} tapes={[[150, -18, -8, 120]]} />
    <Strip x={90} y={1130} w={470} delay={14} size={36}>More than 80 hippos</Strip>
  </>);
}
function Year() {
  const f = useCurrentFrame();
  return (<>
    <div style={abs(80, 400, 360, 16, { background: K.frame, transform: `scaleX(${ramp(f, 2, 12)})`, transformOrigin: "left" })} />
    <Num x={60} y={440} size={470} color={K.ink} delay={2} w={980}>1981</Num>
    <Strip x={80} y={1010} w={640} delay={10}>Back to the start</Strip>
    <svg viewBox="0 0 400 300" style={abs(620, 1100, 400, 300)}><path d="M20 20 C 120 20, 160 180, 300 220 L 270 170 M300 220 L 245 245" fill="none" stroke={K.frame} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - ramp(f, 12, 30)} /></svg>
    <Tri x={820} y={140} delay={6} rot={-10} />
  </>);
}
function Import({ images, credits, cut }) {
  return (<>
    <Sticker src={images.escobar} x={70} y={250} w={470} h={620} rot={-2.2} from="left" delay={0} tapes={[[150, -20, -8, 160]]} credit={credit(credits, "escobar")} />
    <Num x={560} y={170} size={520} delay={4} w={460}>4</Num>
    <Herd src={cut.src} aspect={cut.aspect} count={4} cols={2} x={580} y={760} w={420} delay={14} />
    <Strip x={70} y={1010} w={940} delay={10} size={36}>Imported 1981: three females, one male</Strip>
    <Dot x={920} y={130} s={56} delay={8} />
    <Timeline active={0} />
  </>);
}
function Estate({ images, credits, map }) {
  const f = useCurrentFrame();
  return (<>
    <Title y={92} size={96} w={960}>Hacienda Nápoles</Title>
    <MapBoard geo={map} delay={0} />
    <svg viewBox="0 0 1080 1920" style={abs(0, 0, 1080, 1920)}><path d={`M${map.pins[1].x} ${map.pins[1].y} L 700 1130`} stroke={K.frame} strokeWidth="5" fill="none" strokeDasharray="14 10" opacity={ramp(f, 24, 34)} /></svg>
    <Sticker src={images.gate} x={500} y={1090} w={500} h={375} rot={2} from="bottom" delay={22} tapes={[[-24, -10, -30, 130], [380, 350, -28, 130]]} credit={credit(credits, "gate")} />
  </>);
}
function Escape({ images, credits, cut }) {
  return (<>
    <Sticker src={images.gate} x={90} y={290} w={900} h={675} rot={1.2} from="top" delay={0} tapes={[[-30, -14, -34, 170], [760, 640, -30, 170]]} credit={credit(credits, "gate")} creditTop />
    <Cut src={cut.src} x={430} y={780} w={380} h={380 / cut.aspect} delay={12} from="left" rot={-3} />
    <Cut src={cut.src} x={690} y={850} w={330} h={330 / cut.aspect} delay={16} from="left" rot={2} />
    <Cut src={cut.src} x={170} y={870} w={300} h={300 / cut.aspect} delay={20} from="left" rot={-1} />
    <Num x={70} y={1090} size={260} color={K.ink} delay={4} w={520}>1993</Num>
    <Stamp x={600} y={1150} w={400} rot={5} delay={10} size={46}>Escobar<br />dies</Stamp>
    <Timeline active={1} />
  </>);
}
function Count({ n, year, note, cols, cut, top, w, size = 440, active }) {
  return (<>
    <Num x={60} y={80} size={size} delay={0} w={940}>{n}</Num>
    <Num x={70} y={500} size={120} color={K.ink} delay={4} w={340}>{year}</Num>
    <Strip x={410} y={528} w={590} delay={8} size={34}>{note}</Strip>
    <Herd src={cut.src} aspect={cut.aspect} count={n === "~200" ? 200 : Number(n)} cols={cols} x={(1080 - w) / 2} y={top} w={w} delay={6} />
    <Timeline active={active} />
  </>);
}
const N16 = (p) => <Count n="16" year="2007" note="Sixteen hippos" cols={4} top={690} w={880} active={2} {...p} />;
const N40 = (p) => <Count n="40" year="2014" note="About forty, reported" cols={7} top={720} w={910} active={3} {...p} />;
const N200 = (p) => <Count n="~200" year="2026" note="April, an estimate" cols={16} top={720} w={920} size={380} active={4} {...p} />;
function Invasive({ cut }) {
  return (<>
    <Herd src={cut.src} aspect={cut.aspect} count={200} cols={16} x={80} y={800} w={920} delay={0} faded={0.35} />
    <Stamp x={70} y={230} w={940} rot={-6} delay={4} size={190}>Invasive</Stamp>
    <Strip x={90} y={660} w={760} delay={12} size={40} rot={1}>Most conservationists</Strip>
    <Tri x={860} y={110} delay={8} rot={14} />
    <Timeline active={4} />
  </>);
}
function Cull({ cut }) {
  return (<>
    <Num x={50} y={100} size={340} delay={0} w={620}>80+</Num>
    <Stamp x={560} y={150} w={440} rot={5} delay={6} size={46}>Approved<br />13 Apr 2026</Stamp>
    <Strip x={60} y={470} w={760} delay={10} size={36}>Ministry of Environment</Strip>
    <Herd src={cut.src} aspect={cut.aspect} count={200} cols={16} x={80} y={640} w={920} delay={0} cull={80} cullAt={14} faded={0.85} />
    <Timeline active={4} />
    <div style={abs(80, 1180, 920, 40, { fontFamily: COND, fontWeight: 700, fontSize: 30, letterSpacing: "0.06em", color: K.dim, textTransform: "uppercase" })}>Coloured: more than 80 of around 200</div>
  </>);
}
function India({ world }) {
  return (<>
    <Title y={92} size={90} w={960}>The offer</Title>
    <ArcMap geo={world} delay={0} />
    <Strip x={60} y={1010} w={960} delay={26} size={30}>Anant Ambani offers transport and shelter in India</Strip>
    <Stamp x={560} y={1200} w={420} rot={-5} delay={32} size={64}>Offer</Stamp>
  </>);
}
function Stay({ images, credits }) {
  const f = useCurrentFrame(), a = ramp(f, 8, 20);
  return (<>
    <Sticker src={images.hippoB} x={110} y={290} w={860} h={640} rot={1.4} from="bottom" delay={0} tapes={[[-24, -12, -32, 160], [720, 610, -28, 160]]} credit={credit(credits, "hippoB")} />
    <div style={abs(150, 1050, 780, 330, { background: K.frame, transform: `rotate(-1.2deg) translateX(${(1 - a) * -900}px)`, boxShadow: "10px 16px 0 rgba(26,23,19,0.2)" })} />
    <div style={abs(200, 1090, 680, 200, { fontFamily: COND, fontWeight: 700, fontSize: 98, lineHeight: 0.98, textTransform: "uppercase", color: K.paper, opacity: ramp(f, 12, 22) })}>“They should remain.”</div>
    <div style={abs(200, 1300, 680, 50, { fontFamily: COND, fontWeight: 400, fontSize: 30, color: K.paper, opacity: ramp(f, 16, 26) })}>Some ecologists, as Wikipedia reports</div>
  </>);
}
function Gone({ images, credits }) {
  return (<>
    <Title x={80} y={90} size={130} color={K.frame} delay={0}>Still here</Title>
    <Sticker src={images.escobar} x={60} y={400} w={360} h={470} rot={-3} from="left" delay={2} filter="grayscale(1) contrast(0.9)" tapes={[[100, -18, -8, 130]]} />
    <Strip x={60} y={920} w={280} delay={10} size={40} bg={K.ink}>1993</Strip>
    <Sticker src={images.hippoA} x={340} y={600} w={700} h={525} rot={2} from="right" delay={6} tapes={[[-20, -10, -30, 150], [560, 500, -28, 150]]} credit={credit(credits, "hippoA")} />
    <Strip x={640} y={1230} w={280} delay={14} size={40}>2026</Strip>
  </>);
}

export { K, COND, SHADOW, ramp, over, out, Board, Tape, Tri, Dot, Sticker, Cut, Num, Title, Stamp, Strip, MapBoard, Cap, hand };
const BEATS = { still: Still, approved: Approved, year: Year, import: Import, estate: Estate, escape: Escape, n16: N16, n40: N40, n200: N200, invasive: Invasive, cull: Cull, india: India, stay: Stay, gone: Gone };

function Cap({ captions }) {
  const f = useCurrentFrame(); const c = captions.find((x) => f >= x.from && f < x.to);
  if (!c) return null;
  return <div style={abs(70, 1590, 940, 220, { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "0 14px", fontFamily: COND, fontWeight: 700, fontSize: 70, lineHeight: 1.05, textAlign: "center", zIndex: 9000 })}>
    {(c.words || [{ text: c.text, from: c.from }]).map((w, i) => <span key={i} style={{ color: f >= w.from ? K.white : "rgba(255,255,255,0.55)", WebkitTextStroke: "9px #111", paintOrder: "stroke fill", textShadow: "4px 5px 0 #111" }}>{w.text}</span>)}
  </div>;
}

export function HiddenPastVoxBeats({ durationInFrames, scenes, captions, images, credits, cut, map, world }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: K.frame }}><style>{FONT_FACES}</style>
      <Board f={f} />
      {scenes.map((s) => { const B = BEATS[s.kind]; return B ? <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><AbsoluteFill><B images={images} credits={credits} cut={cut} map={map} world={world} /></AbsoluteFill></Sequence> : null; })}
      <Cap captions={captions} />
      <div style={abs(36, 1884, 1008 * (f / durationInFrames), 8, { background: K.ink })} />
    </AbsoluteFill>
  );
}
const base = { fps: 30, width: 1080, height: 1920, durationInFrames: 1140, defaultProps: { durationInFrames: 1140, scenes: [], captions: [], images: {}, credits: {}, cut: { src: "", aspect: 1.4 }, map: null, world: null } };
export const voxBeatsCompositions = [{ id: "HiddenPastVoxBeats", component: HiddenPastVoxBeats, ...base }];
