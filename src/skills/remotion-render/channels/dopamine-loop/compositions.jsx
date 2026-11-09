// Dopamine Loop: the experience of anticipation and peak pleasure, drawn as pictures a muted viewer can follow.
// Palette comes from platform/channels/dopamine-loop/channel.json via props. The curve and waveform are illustrative and say so.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs, Captions, clamp, From, Scene, useIn } from "../_shared/parts.jsx";

const SANS = '"Space Grotesk", sans-serif', MONO = '"JetBrains Mono", monospace';
const BARS = 36;
const barHeight = (i) => 46 + 330 * Math.pow(i / (BARS - 1), 1.7) * (0.62 + 0.38 * Math.abs(Math.sin(i * 1.9)));

function Title({ p, children, top = 210 }) {
  return <From dy={30} style={abs(70, top, 940, 220, { fontFamily: SANS, fontWeight: 800, fontSize: 84, lineHeight: 1.04, color: p.ink })}>{children}</From>;
}

function Note({ p, children, top, color }) {
  return <From delay={10} dy={10} style={abs(70, top, 940, 90, { fontFamily: MONO, fontWeight: 700, fontSize: 26, lineHeight: 1.3, color: color || p.dim })}>{children}</From>;
}

/** A song building toward its best part. A reward signal starts at the left, before the highlighted bars arrive. */
function Hook({ dur, p }) {
  const f = useCurrentFrame();
  const head = interpolate(f, [4, dur * 0.88], [0, BARS], clamp);
  const pulse = interpolate(f, [dur * 0.34, dur * 0.34 + 10], [0, 1], clamp);
  const base = 1020, x0 = 70, w = 940 / BARS;
  return (
    <Scene dur={dur}>
      <Title p={p}>Before the best part</Title>
      <Note p={p} top={470}>Illustrative waveform, not a measurement</Note>
      <svg width={1080} height={1400} style={{ position: "absolute", left: 0, top: 0 }}>
        {Array.from({ length: BARS }, (_, i) => {
          const h = barHeight(i), played = i < head, best = i >= BARS - 8;
          return <rect key={i} x={x0 + i * w + 3} y={base - h} width={w - 6} height={h} rx={7} fill={best ? (played ? p.warm : p.warmSoft) : (played ? p.ink : p.stroke)} stroke={best ? p.warm : "none"} strokeWidth={best ? 2 : 0} />;
        })}
        <text x={x0 + (BARS - 8) * w} y={base - 410} fontFamily={SANS} fontWeight={700} fontSize={34} fill={p.warm}>best part</text>
        <line x1={x0 + head * w} y1={base - 430} x2={x0 + head * w} y2={base + 30} stroke={p.ink} strokeWidth={4} />
        <g opacity={pulse}>
          {[0, 1, 2].map((k) => {
            const t = ((f - dur * 0.34) / 26 + k / 3) % 1;
            return <circle key={k} cx={190} cy={1240} r={40 + t * 120} fill="none" stroke={p.warm} strokeWidth={5} opacity={(1 - t) * 0.9} />;
          })}
          <circle cx={190} cy={1240} r={34} fill={p.warm} />
          <text x={290} y={1232} fontFamily={SANS} fontWeight={800} fontSize={54} fill={p.ink}>Anticipation</text>
          <text x={290} y={1284} fontFamily={MONO} fontWeight={700} fontSize={26} fill={p.dim}>starts before the peak</text>
        </g>
      </svg>
    </Scene>
  );
}

/** Listeners in a scanner, and an arousal curve with dopamine marked at its peak. */
function Scan({ dur, p }) {
  const f = useCurrentFrame();
  const draw = interpolate(f, [18, dur * 0.8], [0, 1], clamp);
  const mark = useIn(Math.round(dur * 0.78), 12);
  const path = "M 90 1230 C 250 1220 330 1150 470 1050 C 600 950 680 800 800 760 C 900 730 950 880 1000 1000";
  const peak = [800, 760];
  return (
    <Scene dur={dur}>
      <Title p={p}>Listeners, scanned while the music played</Title>
      <svg width={1080} height={1400} style={{ position: "absolute", left: 0, top: 0 }}>
        <g transform="translate(540 600)">
          {[0, 1, 2].map((k) => <circle key={k} r={150 + k * 42} fill="none" stroke={k === 0 ? p.ink : p.stroke} strokeWidth={k === 0 ? 10 : 6} strokeDasharray={k === 2 ? "12 14" : "0"} />)}
          <path d="M -70 20 C -70 -90 70 -90 70 20" fill="none" stroke={p.ink} strokeWidth={14} strokeLinecap="round" />
          <rect x={-96} y={6} width={42} height={78} rx={18} fill={p.ink} />
          <rect x={54} y={6} width={42} height={78} rx={18} fill={p.ink} />
          {[0, 1, 2].map((k) => { const t = ((f / 24) + k / 3) % 1; return <path key={k} d={`M 118 ${40 - 20 - t * 30} q ${30 + t * 20} ${20 + t * 30} 0 ${40 + t * 60}`} fill="none" stroke={p.warm} strokeWidth={6} opacity={1 - t} strokeLinecap="round" />; })}
        </g>
        <text x={70} y={900} fontFamily={MONO} fontWeight={700} fontSize={28} fill={p.dim}>PET scan and fMRI, human listeners</text>
        <line x1={70} y1={1260} x2={1010} y2={1260} stroke={p.stroke} strokeWidth={4} />
        <text x={70} y={1010} fontFamily={SANS} fontWeight={700} fontSize={34} fill={p.ink}>Emotional arousal</text>
        <path d={path} fill="none" stroke={p.warm} strokeWidth={10} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
        <g opacity={mark}>
          <circle cx={peak[0]} cy={peak[1]} r={26} fill={p.warm} />
          <circle cx={peak[0]} cy={peak[1]} r={46} fill="none" stroke={p.warm} strokeWidth={5} />
        </g>
      </svg>
      <div style={abs(250, 590 + 330, 760, 120, { opacity: mark, transform: `translateY(${(1 - mark) * 20}px)`, background: p.warmSoft, border: `3px solid ${p.warm}`, borderRadius: 22, padding: "16px 24px", fontFamily: SANS, fontWeight: 800, fontSize: 40, color: p.ink, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" })}>Dopamine released in the striatum at the peak</div>
    </Scene>
  );
}

/** The two phases of a song as two blocks. One is lit; the card under it names the region more involved there. */
function Phase({ dur, p, d }) {
  const f = useCurrentFrame();
  const t = useIn(6, 14), card = useIn(18, 14);
  const lit = d.phase, col = lit === "anticipation" ? p.warm : p.cool, soft = lit === "anticipation" ? p.warmSoft : p.coolSoft;
  const blocks = [{ id: "anticipation", x: 70, w: 440, label: "Anticipation", c: p.warm }, { id: "peak", x: 530, w: 480, label: "Peak", c: p.cool }];
  const target = blocks.find((b) => b.id === lit);
  return (
    <Scene dur={dur}>
      <Title p={p}>{lit === "anticipation" ? "The build-up" : "The peak"}</Title>
      <svg width={1080} height={1500} style={{ position: "absolute", left: 0, top: 0 }}>
        {blocks.map((b) => {
          const on = b.id === lit;
          return (
            <g key={b.id} opacity={t}>
              <rect x={b.x} y={560} width={b.w} height={250} rx={28} fill={on ? b.c : "#fff"} stroke={on ? b.c : p.stroke} strokeWidth={6} />
              <text x={b.x + b.w / 2} y={700} textAnchor="middle" fontFamily={SANS} fontWeight={800} fontSize={58} fill={on ? "#fff" : p.dim}>{b.label}</text>
              <text x={b.x + b.w / 2} y={758} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={24} fill={on ? "#fff" : p.stroke}>{b.id === "anticipation" ? "before the best part" : "the best part"}</text>
            </g>
          );
        })}
        <path d={`M ${target.x + target.w / 2} 820 L ${target.x + target.w / 2} 930`} stroke={col} strokeWidth={6} opacity={card} />
        <path d={`M ${target.x + target.w / 2 - 14} 912 L ${target.x + target.w / 2} 934 L ${target.x + target.w / 2 + 14} 912`} fill="none" stroke={col} strokeWidth={6} opacity={card} />
      </svg>
      <div style={abs(70, 950, 940, 360, { opacity: card, transform: `translateY(${(1 - card) * 40}px)`, background: soft, border: `4px solid ${col}`, borderRadius: 30, padding: "34px 40px" })}>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 28, color: col, letterSpacing: "0.12em" }}>BRAIN REGION · fMRI</div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 92, lineHeight: 1.05, color: p.ink, marginTop: 14 }}>{d.region}</div>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 44, color: p.dim, marginTop: 14 }}>more involved {lit === "anticipation" ? "while anticipating" : "at the peak"}</div>
      </div>
    </Scene>
  );
}

/** Both phases, both regions, side by side, with the evidence marked as one human study. */
function Distinct({ dur, p }) {
  const a = useIn(6, 14), b = useIn(22, 14), c = useIn(40, 14);
  const row = (o, col, soft, head, sub, y) => (
    <div style={abs(70, y, 940, 270, { opacity: o, transform: `translateX(${(1 - o) * 70}px)`, background: soft, border: `4px solid ${col}`, borderRadius: 30, padding: "30px 38px" })}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 28, color: col, letterSpacing: "0.1em" }}>{head}</div>
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 80, color: p.ink, lineHeight: 1.05, marginTop: 10 }}>{sub}</div>
    </div>
  );
  return (
    <Scene dur={dur}>
      <Title p={p}>Two phases, two pathways</Title>
      {row(a, p.warm, p.warmSoft, "ANTICIPATION", "Caudate", 480)}
      {row(b, p.cool, p.coolSoft, "PEAK PLEASURE", "Nucleus accumbens", 790)}
      <div style={abs(70, 1130, 940, 200, { opacity: c, background: p.surface, border: `3px solid ${p.stroke}`, borderRadius: 26, padding: "26px 34px", fontFamily: SANS, fontWeight: 700, fontSize: 40, lineHeight: 1.2, color: p.ink })}>One human imaging study.<div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 26, color: p.dim, marginTop: 10 }}>Shows involvement, not the whole story of pleasure.</div></div>
    </Scene>
  );
}

const KINDS = {
  hook: (a) => <Hook {...a} />,
  scan: (a) => <Scan {...a} />,
  "phase-caudate": (a) => <Phase {...a} d={{ phase: "anticipation", region: "Caudate" }} />,
  "phase-accumbens": (a) => <Phase {...a} d={{ phase: "peak", region: "Nucleus accumbens" }} />,
  distinct: (a) => <Distinct {...a} />,
};

function DopamineLoopShort({ durationInFrames, scenes, captions, palette }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: palette.bg }}>
      <style>{FONT_FACES}</style>
      <div style={abs(0, 120, 1080, 50, { textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: 30, letterSpacing: "0.24em", color: palette.warm })}>DOPAMINE  LOOP</div>
      {scenes.map((s) => <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}>{KINDS[s.kind]({ dur: s.to - s.from, p: palette })}</Sequence>)}
      <Captions captions={captions} font={SANS} color={palette.ink} accent={palette.dim} />
      <div style={abs(0, 1912, 1080 * (f / durationInFrames), 8, { background: palette.warm })} />
    </AbsoluteFill>
  );
}

const palette = { bg: "#FFFFFF", surface: "#F6F3FA", ink: "#16121F", dim: "#5C566B", stroke: "#D9D3E6", warm: "#E4572E", cool: "#2D5BD0", warmSoft: "#FDEDE7", coolSoft: "#E8EEFC" };
export const compositions = [{ id: "DopamineLoopShort", component: DopamineLoopShort, durationInFrames: 780, fps: 30, width: 1080, height: 1920, defaultProps: { durationInFrames: 780, scenes: [], captions: [], palette } }];
