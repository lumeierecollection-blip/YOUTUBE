// Court & Spotlight, VOX-style explainer (style profile: platform/channels/court-and-spotlight/styles/vox.json).
// Visual journalism on a light page: large cut-outs of the people involved beside the data they explain, a zero-baseline chart in one
// unit, and one comparison. The picture carries the argument with the sound off. Photographs are real and credited; nothing is generated.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs, Captions, clamp, From, Scene } from "../_shared/parts.jsx";

const SERIF = '"Playfair Display", serif', SANS = '"DM Sans", sans-serif', MONO = '"JetBrains Mono", monospace';
const V = { page: "#F4F2EC", ink: "#101114", accent: "#E3402B", blue: "#2D5BD0", dim: "#5B5F6A", rule: "#D9D5CA", white: "#FFFFFF" };
const out = Easing.out(Easing.cubic);
const t = (f, a, b) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: out });
const Page = ({ children }) => <AbsoluteFill style={{ background: V.page }}>{children}</AbsoluteFill>;
const Tag = ({ children, color = V.dim, size = 26, style }) => <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: size, letterSpacing: "0.1em", color, ...style }}>{children}</div>;
const Credit = ({ children }) => <div style={abs(50, 1546, 980, 40, { fontFamily: MONO, fontWeight: 500, fontSize: 19, color: V.dim })}>{children}</div>;

/** A cut-out portrait, or a framed photograph if the cut-out was refused. */
const Person = ({ src, cut, x, y, w, h, by, delay = 4, flip = false }) => {
  const f = useCurrentFrame(), a = t(f, delay, delay + 16);
  const common = { position: "absolute", left: x, ...(by !== undefined ? { bottom: 1920 - by } : { top: y }), width: w, opacity: a, transform: `translateY(${(1 - a) * 80}px) scaleX(${flip ? -1 : 1})` };
  return cut ? <img src={src} style={{ ...common, filter: "drop-shadow(0 22px 26px rgba(0,0,0,0.3))" }} /> : <div style={{ ...common, height: h || w * 1.25, backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center 25%", borderRadius: 10, border: `8px solid ${V.white}`, boxShadow: "0 22px 40px rgba(0,0,0,0.3)" }} />;
};

function Question({ dur, images, cut, credits }) {
  return (
    <Scene dur={dur}>
      <Page />
      <From dy={10} style={abs(60, 190, 960, 40, {})}><Tag color={V.accent} size={30}>A RECORD, BEATEN</Tag></From>
      <From delay={4} dy={40} style={abs(40, 250, 700, 380, { fontFamily: SERIF, fontWeight: 700, fontSize: 250, lineHeight: 1, color: V.accent })}>$1B+</From>
      <Person src={images.swift} cut={cut.swift} x={430} y={420} w={640} h={900} />
      <Person src={images.elton} cut={cut.elton} x={20} y={760} w={400} h={560} delay={12} />
      <From delay={12} dy={20} style={abs(40, 1330, 420, 130, { fontFamily: SERIF, fontWeight: 700, fontSize: 96, lineHeight: 1, color: V.blue })}>$939M</From>
      <From delay={18} style={abs(40, 1450, 960, 60, { fontFamily: SANS, fontWeight: 700, fontSize: 36, color: V.ink })}>Who set the record, and who beat it?</From>
      <Credit>{credits.swift} · {credits.elton}</Credit>
    </Scene>
  );
}

/** One zero-baseline chart, one unit (US$ millions). The Eras bar is open-topped: the figure was reported as 'more than'. */
function Chart({ dur, images, cut }) {
  const f = useCurrentFrame();
  const base = 1260, scale = 0.5; // px per US$ million; zero is the baseline
  const hE = 1000 * scale * t(f, 8, 40), hJ = 939 * scale * t(f, 16, 48);
  const label = t(f, 40, 56);
  return (
    <Scene dur={dur}>
      <Page />
      <Tag color={V.ink} size={30} style={{ position: "absolute", left: 60, top: 190 }}>TOUR GROSS · US$ MILLIONS</Tag>
      <svg width={1080} height={1500} style={{ position: "absolute", left: 0, top: 0 }}>
        {[0, 250, 500, 750, 1000].map((v) => <g key={v}><line x1={150} y1={base - v * scale} x2={1020} y2={base - v * scale} stroke={V.rule} strokeWidth={v === 0 ? 5 : 2} /><text x={140} y={base - v * scale + 8} textAnchor="end" fontFamily={MONO} fontWeight={700} fontSize={22} fill={V.dim}>{v.toLocaleString()}</text></g>)}
        <rect x={250} y={base - hE} width={220} height={hE} fill={V.accent} />
        <rect x={250} y={base - hE - 56 * label} width={220} height={56 * label} fill="none" stroke={V.accent} strokeWidth={5} strokeDasharray="12 10" opacity={label} />
        <rect x={650} y={base - hJ} width={220} height={hJ} fill={V.blue} />
      </svg>
      <Person src={images.swift} cut={cut.swift} x={170} by={base - 1000 * scale - 70} w={300} h={400} delay={30} />
      <Person src={images.elton} cut={cut.elton} x={570} by={base - 939 * scale - 14} w={300} h={400} delay={34} />
      <div style={abs(230, base + 22, 260, 120, { opacity: label, textAlign: "center" })}><Tag color={V.accent} size={30}>ERAS TOUR</Tag><div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 52, color: V.ink }}>$1,000M+</div></div>
      <div style={abs(630, base + 22, 260, 120, { opacity: label, textAlign: "center" })}><Tag color={V.blue} size={30}>ELTON JOHN</Tag><div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 52, color: V.ink }}>$939M</div></div>
      <Tag size={20} style={{ position: "absolute", left: 60, top: 1500, width: 960, lineHeight: 1.4 }}>Dashed top = reported as “more than $1 billion” (Pollstar). Source: Music Week, December 2023.</Tag>
    </Scene>
  );
}

function OldRecord({ dur, images, cut, credits }) {
  const f = useCurrentFrame();
  const hi = t(f, 10, 36);
  return (
    <Scene dur={dur}>
      <Page />
      <Person src={images.elton} cut={cut.elton} x={440} y={300} w={640} h={900} />
      <From dy={10} style={abs(60, 200, 600, 40, {})}><Tag color={V.blue} size={30}>THE OLD RECORD</Tag></From>
      <From delay={4} dy={40} style={abs(40, 300, 640, 360, { fontFamily: SERIF, fontWeight: 700, fontSize: 150, lineHeight: 1, color: V.ink })}>$939<br />million</From>
      <div style={abs(60, 700, 560, 300, { fontFamily: SANS, fontWeight: 700, fontSize: 52, lineHeight: 1.18, color: V.ink })}>
        <span style={{ backgroundImage: `linear-gradient(transparent 60%, #F7D26A 60%)`, backgroundRepeat: "no-repeat", backgroundSize: `${hi * 100}% 100%` }}>Farewell Yellow Brick Road Tour</span>
      </div>
      <Credit>{credits.elton}</Credit>
    </Scene>
  );
}

function FiveYears({ dur, images, cut }) {
  const f = useCurrentFrame();
  const fill = interpolate(f, [8, dur * 0.8], [0, 5], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <Scene dur={dur}>
      <Page />
      <Person src={images.elton} cut={cut.elton} x={-40} y={880} w={420} h={560} delay={6} />
      <From dy={10} style={abs(60, 200, 960, 40, {})}><Tag color={V.blue} size={30}>HOW LONG THE OLD RECORD TOOK</Tag></From>
      <From delay={4} dy={30} style={abs(60, 280, 960, 300, { fontFamily: SERIF, fontWeight: 700, fontSize: 200, lineHeight: 1, color: V.ink })}>5 years</From>
      <svg width={1080} height={400} style={{ position: "absolute", left: 0, top: 700 }}>
        <line x1={100} y1={100} x2={980} y2={100} stroke={V.rule} strokeWidth={10} strokeLinecap="round" />
        <line x1={100} y1={100} x2={100 + (880 / 5) * fill} y2={100} stroke={V.blue} strokeWidth={10} strokeLinecap="round" />
        {[0, 1, 2, 3, 4, 5].map((i) => <g key={i}><line x1={100 + (880 / 5) * i} y1={70} x2={100 + (880 / 5) * i} y2={130} stroke={V.ink} strokeWidth={4} /><text x={100 + (880 / 5) * i} y={178} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={26} fill={V.dim}>{i}</text></g>)}
      </svg>
      <From delay={22} dy={20} style={abs(400, 1000, 640, 300, { fontFamily: SANS, fontWeight: 700, fontSize: 50, lineHeight: 1.2, color: V.ink })}>The length was due to <span style={{ color: V.accent }}>pandemic delays</span>.</From>
    </Scene>
  );
}

function MoreShows({ dur }) {
  const f = useCurrentFrame();
  const a = t(f, 4, 18), b = t(f, 18, 32);
  const chip = (txt, c) => <div style={{ background: V.white, border: `4px solid ${c}`, borderRadius: 18, padding: "20px 28px", fontFamily: SERIF, fontWeight: 700, fontSize: 56, color: V.ink }}>{txt}</div>;
  return (
    <Scene dur={dur}>
      <Page />
      <From dy={10} style={abs(60, 200, 960, 40, {})}><Tag color={V.ink} size={30}>TWO WAYS TO A RECORD</Tag></From>
      <div style={abs(50, 300, 470, 1000, { opacity: a, transform: `translateX(${(1 - a) * -60}px)` })}>
        <Tag color={V.blue} size={26}>EARLIER RECORD TOURS</Tag>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 24 }}>{chip("U2", V.blue)}{chip("Ed Sheeran", V.blue)}{chip("Elton John", V.blue)}</div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 52, lineHeight: 1.1, color: V.blue, marginTop: 36 }}>many more performances</div>
      </div>
      <div style={abs(560, 300, 470, 1000, { opacity: b, transform: `translateX(${(1 - b) * 60}px)` })}>
        <Tag color={V.accent} size={26}>THE ERAS TOUR</Tag>
        <div style={{ marginTop: 24 }}>{chip("Taylor Swift", V.accent)}</div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 52, lineHeight: 1.1, color: V.accent, marginTop: 36 }}>a bigger gross, with fewer performances than those tours</div>
      </div>
      <Tag size={20} style={{ position: "absolute", left: 60, top: 1500, width: 960 }}>Source: Complete Music Update, December 2023. No show counts were reported there, so none are shown.</Tag>
    </Scene>
  );
}

function Answer({ dur, images, cut, credits }) {
  return (
    <Scene dur={dur}>
      <Page />
      <Person src={images.elton} cut={cut.elton} x={-30} y={420} w={520} h={720} />
      <Person src={images.swift} cut={cut.swift} x={560} y={400} w={520} h={740} delay={10} />
      <From delay={6} dy={30} style={abs(40, 1180, 1000, 160, { fontFamily: SERIF, fontWeight: 700, fontSize: 112, lineHeight: 1, color: V.ink, textAlign: "center" })}>Same record.</From>
      <From delay={14} dy={30} style={abs(40, 1330, 1000, 130, { fontFamily: SERIF, fontWeight: 700, fontStyle: "italic", fontSize: 92, lineHeight: 1, color: V.accent, textAlign: "center" })}>Different routes.</From>
      <Credit>{credits.elton} · {credits.swift}</Credit>
    </Scene>
  );
}

const KINDS = { question: Question, chart: Chart, oldrecord: OldRecord, fiveyears: FiveYears, moreshows: MoreShows, answer: Answer };

export function CourtVoxShort({ durationInFrames, scenes, captions, images, credits, cut }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: V.page }}>
      <style>{FONT_FACES}</style>
      {scenes.map((s) => { const K = KINDS[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} images={images} credits={credits} cut={cut || {}} /></Sequence>; })}
      <div style={abs(0, 110, 1080, 50, { textAlign: "center", fontFamily: MONO, fontWeight: 800, fontSize: 26, letterSpacing: "0.3em", color: V.dim })}>COURT  &  SPOTLIGHT · EXPLAINED</div>
      <Captions captions={captions} font={SANS} color={V.ink} accent={V.dim} top={1620} />
      <div style={abs(0, 1912, 1080 * (f / durationInFrames), 8, { background: V.accent })} />
    </AbsoluteFill>
  );
}
