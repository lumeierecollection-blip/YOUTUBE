// Court & Spotlight, investigation format (style profile: platform/channels/court-and-spotlight/styles/investigation.json).
// A serious case file: a large torn-paper cut-out of the real subject, then one piece of evidence per sentence. Confirmed, convicted,
// acquitted and alleged items are stamped differently so an allegation can never be mistaken for a finding.
// Every photograph is real and licensed, passed in as a data URI with its credit. Nothing here is generated imagery.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs, Captions, clamp, From, Scene } from "../_shared/parts.jsx";

const SERIF = '"Playfair Display", serif', SANS = '"DM Sans", sans-serif', MONO = '"JetBrains Mono", monospace';
const C = { desk: "#121212", paper: "#F1EAD8", paperEdge: "#CFC4A8", ink: "#1C1B18", dim: "#6B6454", red: "#C62828", amber: "#D68A00", green: "#2E7D32", hi: "#F2D64B", text: "#F4F1E8", mute: "#8E8A80" };
const out = Easing.out(Easing.cubic);
const t = (f, a, b) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: out });

/** Dark desk with grain and a vignette. */
const Desk = ({ warm = 0 }) => (
  <AbsoluteFill style={{ background: C.desk }}>
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
      <defs>
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="6" /><feColorMatrix type="saturate" values="0" /></filter>
        <radialGradient id="vig" cx="50%" cy="45%" r="75%"><stop offset="40%" stopColor="#000" stopOpacity="0" /><stop offset="100%" stopColor="#000" stopOpacity="0.7" /></radialGradient>
      </defs>
      <rect width={1080} height={1920} filter="url(#grain)" opacity={0.11} />
      <rect width={1080} height={1920} fill={warm ? "#2a1a0a" : "#000"} opacity={warm ? 0.18 : 0} />
      <rect width={1080} height={1920} fill="url(#vig)" />
    </svg>
  </AbsoluteFill>
);

/** An aged paper card with grain, a hard shadow and optional tape. */
const Card = ({ x, y, w, h, rot = 0, delay = 0, children, border, tape = true, style }) => {
  const f = useCurrentFrame(), a = t(f, delay, delay + 14);
  return (
    <div style={abs(x, y, w, h, { transform: `rotate(${rot}deg) translateY(${(1 - a) * 70}px)`, opacity: a })}>
      <div style={{ position: "absolute", inset: 0, background: C.paper, border: `3px ${border ? "dashed" : "solid"} ${border || C.paperEdge}`, borderRadius: 4, boxShadow: "0 28px 60px rgba(0,0,0,0.55)", padding: "38px 44px", boxSizing: "border-box", overflow: "hidden", ...style }}>
        <svg width="100%" height="100%" style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}><filter id={`pg${delay}`}><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="3" /><feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter={`url(#pg${delay})`} opacity={0.12} /></svg>
        <div style={{ position: "relative" }}>{children}</div>
      </div>
      {tape && <><div style={{ position: "absolute", left: 60, top: -22, width: 150, height: 46, background: "rgba(228,214,150,0.6)", transform: "rotate(-6deg)" }} /><div style={{ position: "absolute", right: 70, top: -20, width: 130, height: 44, background: "rgba(228,214,150,0.55)", transform: "rotate(5deg)" }} /></>}
    </div>
  );
};

const Stamp = ({ text, color, x, y, rot = -8, delay = 0, size = 64 }) => {
  const f = useCurrentFrame(), s = interpolate(f, [delay, delay + 8], [1.7, 1], { ...clamp, easing: Easing.out(Easing.back(2)) }), o = interpolate(f, [delay, delay + 4], [0, 1], clamp);
  return <div style={{ position: "absolute", left: x, top: y, border: `8px solid ${color}`, borderRadius: 10, color, fontFamily: MONO, fontWeight: 800, fontSize: size, letterSpacing: "0.08em", padding: "6px 22px", opacity: o * 0.93, transform: `rotate(${rot}deg) scale(${s})`, background: "rgba(241,234,216,0.2)" }}>{text}</div>;
};

/** Marker-pen highlight that draws across the words it covers. */
const Hi = ({ children, from, len = 26, color = C.hi }) => {
  const f = useCurrentFrame(), p = t(f, from, from + len);
  return <span style={{ backgroundImage: `linear-gradient(transparent 58%, ${color} 58%)`, backgroundRepeat: "no-repeat", backgroundSize: `${p * 100}% 100%`, padding: "0 4px", margin: "0 -4px" }}>{children}</span>;
};

const Label = ({ children, color = C.dim, size = 26, style }) => <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: size, letterSpacing: "0.1em", color, ...style }}>{children}</div>;
const Credit = ({ children }) => <div style={abs(50, 1538, 980, 40, { fontFamily: MONO, fontWeight: 500, fontSize: 20, color: C.mute })}>{children}</div>;
const Sticker = ({ src, x, y, w, rot = 0, delay = 0, push = false, dur = 1 }) => {
  const f = useCurrentFrame(), a = t(f, delay, delay + 16), z = push ? interpolate(f, [0, dur], [1, 1.045], clamp) : 1;
  return <img src={src} style={{ position: "absolute", left: x, top: y, width: w, transform: `translateY(${(1 - a) * 80}px) rotate(${rot}deg) scale(${z})`, transformOrigin: "50% 100%", opacity: a, filter: "drop-shadow(0 30px 34px rgba(0,0,0,0.65))" }} />;
};

function Cover({ dur, images, credits }) {
  return (
    <Scene dur={dur}>
      <Desk />
      <From delay={2} dy={16} style={abs(50, 190, 980, 80, { display: "flex" })}><div style={{ background: C.red, color: "#fff", fontFamily: MONO, fontWeight: 800, fontSize: 28, letterSpacing: "0.14em", padding: "12px 24px" }}>FEDERAL TAX CASE · OCALA, FLA.</div></From>
      <Sticker src={images.portrait} x={300} y={330} w={800} push dur={dur} />
      <From delay={6} dy={50} style={abs(40, 360, 560, 520, { fontFamily: SERIF, fontWeight: 700, fontSize: 440, lineHeight: 0.9, color: C.red, textShadow: "0 8px 30px rgba(0,0,0,0.6)" })}>3</From>
      <From delay={10} dy={40} style={abs(40, 780, 620, 240, { fontFamily: SERIF, fontWeight: 700, fontSize: 168, lineHeight: 0.95, color: C.text, textShadow: "0 8px 30px rgba(0,0,0,0.7)" })}>YEARS</From>
      <From delay={16} dy={20} style={abs(40, 1010, 520, 200, { fontFamily: SANS, fontWeight: 700, fontSize: 52, lineHeight: 1.12, color: C.text })}>in federal prison, for not filing tax returns</From>
      <Credit>{credits.portrait}</Credit>
    </Scene>
  );
}

function Doj({ dur, images, credits }) {
  const f = useCurrentFrame();
  return (
    <Scene dur={dur}>
      <Desk />
      <Card x={70} y={260} w={940} h={930} rot={-1.1} delay={2}>
        <Label>US DEPARTMENT OF JUSTICE · RELEASE · 25 APR 2008</Label>
        <div style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 52, lineHeight: 1.34, color: C.ink, marginTop: 34 }}>
          OCALA, Fla. — U.S. District Judge Wm. Terrell Hodges <Hi from={12}>sentenced Wesley Trent Snipes to three years imprisonment</Hi> Thursday for charges of <Hi from={30}>failing to file income tax returns.</Hi>
        </div>
        <div style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 52, lineHeight: 1.34, color: C.ink, marginTop: 36, opacity: t(f, Math.round(dur * 0.38), Math.round(dur * 0.38) + 10) }}>
          Snipes was <Hi from={Math.round(dur * 0.42)} color="#F4A9A0">found guilty by a jury on February 1.</Hi>
        </div>
        <Label size={21} style={{ position: "absolute", left: 44, bottom: 24 }}>EXCERPT · REPUBLISHED TEXT, BLAST MAGAZINE</Label>
      </Card>
      <Sticker src={images.portrait} x={650} y={1040} w={440} rot={2} delay={14} />
      <Credit>{credits.portrait}</Credit>
    </Scene>
  );
}

function Timeline({ dur }) {
  const f = useCurrentFrame();
  const line = t(f, 2, dur * 0.7), guilty = t(f, 4, 18), acq = t(f, 16, 32), sent = t(f, dur * 0.5, dur * 0.5 + 16);
  const node = (y, label, o) => <div style={abs(60, y, 960, 80, { opacity: o, display: "flex", alignItems: "center", gap: 28 })}><div style={{ width: 34, height: 34, borderRadius: 17, background: C.text }} /><Label color={C.text} size={34}>{label}</Label></div>;
  return (
    <Scene dur={dur}>
      <Desk />
      <div style={abs(76, 300, 6, 1000 * line, { background: C.mute })} />
      {node(280, "FEB 1 · THE JURY'S VERDICT", 1)}
      <div style={abs(130, 380, 880, 250, { transform: `translateX(${(1 - guilty) * 60}px)`, background: C.paper, borderLeft: `14px solid ${C.red}`, padding: "28px 36px", boxSizing: "border-box", opacity: guilty * 0.55 })}>
        <Label color={C.red} size={24}>GUILTY</Label><div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 56, lineHeight: 1.08, color: C.ink, marginTop: 8 }}>Failing to file income tax returns</div>
      </div>
      <div style={abs(130, 690, 880, 330, { opacity: acq, transform: `translateX(${(1 - acq) * 60}px)`, background: C.paper, borderLeft: `14px solid ${C.green}`, padding: "28px 36px", boxSizing: "border-box", boxShadow: "0 0 0 4px rgba(46,125,50,0.5)" })}>
        <Label color={C.green} size={24}>NOT GUILTY · FIVE OTHER CHARGES</Label><div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 56, lineHeight: 1.08, color: C.ink, marginTop: 8 }}>Including felony tax fraud and conspiracy</div>
      </div>
      <Stamp text="ACQUITTED" color={C.green} x={560} y={900} delay={26} size={60} />
      {node(1120, "APRIL 2008 · SENTENCED", sent)}
      <div style={abs(130, 1210, 880, 200, { opacity: sent, background: C.paper, borderLeft: `14px solid ${C.red}`, padding: "28px 36px", boxSizing: "border-box" })}>
        <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 76, color: C.ink }}>Three years</div>
      </div>
    </Scene>
  );
}

function Alleged({ dur }) {
  const f = useCurrentFrame();
  const n = interpolate(f, [6, dur * 0.55], [0, 13.8], { ...clamp, easing: out });
  return (
    <Scene dur={dur}>
      <Desk warm />
      <Card x={90} y={300} w={900} h={1060} rot={0.9} delay={2} border={C.amber} style={{ background: "#F6E7C2" }}>
        <Label color={C.amber} size={28}>THE GOVERNMENT'S CLAIM · NOT A FINDING</Label>
        <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 210, lineHeight: 1, color: C.ink, marginTop: 80 }}>${n.toFixed(1)}M+</div>
        <div style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 50, lineHeight: 1.28, color: C.ink, marginTop: 36 }}>The government <Hi from={16} color="#F0B84A">alleged</Hi> Snipes made at least $13.8 million for the years in question and owed $2.7 million in back taxes.</div>
        <Label size={21} style={{ position: "absolute", left: 44, bottom: 24 }}>AS REPORTED BY CBS NEWS · 25 APR 2008</Label>
      </Card>
      <Stamp text="ALLEGED" color={C.amber} x={600} y={1210} delay={20} size={76} />
    </Scene>
  );
}

function Sought({ dur, images, credits }) {
  const f = useCurrentFrame(), a = t(f, 6, 22), b = t(f, 28, 46);
  const bar = (top, label, value, color, fill, shown) => (
    <div style={abs(70, top, 640, 230, { opacity: shown })}>
      <Label color={C.text} size={26}>{label}</Label>
      <div style={{ marginTop: 16, height: 70, borderRadius: 8, background: "#241F1A" }}><div style={{ width: `${fill * shown * 100}%`, height: 70, borderRadius: 8, background: color }} /></div>
      <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 70, color: C.text, marginTop: 12, lineHeight: 1 }}>{value}</div>
    </div>
  );
  return (
    <Scene dur={dur}>
      <Desk />
      <Sticker src={images.portrait} x={560} y={560} w={600} rot={-1} delay={4} />
      <From style={abs(70, 330, 600, 80, {})}><Label color={C.amber} size={30}>SENTENCING · APRIL 2008</Label></From>
      {bar(430, "PROSECUTORS SOUGHT", "The maximum", C.amber, 1, a)}
      {bar(780, "THE JUDGE GAVE", "3 years", C.red, 0.9, b)}
      <Stamp text="SENTENCED" color={C.red} x={80} y={1150} delay={48} size={58} />
      <Credit>{credits.portrait}</Credit>
    </Scene>
  );
}

function Booking({ dur, images, credits }) {
  const f = useCurrentFrame();
  const circle = t(f, dur * 0.4, dur * 0.4 + 18), note = t(f, dur * 0.55, dur * 0.55 + 14);
  return (
    <Scene dur={dur}>
      <Desk />
      <Card x={110} y={250} w={520} h={760} rot={-2} delay={2} style={{ padding: 22 }}>
        <img src={images.booking} style={{ width: "100%", height: 600, objectFit: "cover", objectPosition: "center top", filter: "grayscale(0.2)" }} />
        <Label color={C.ink} size={24} style={{ marginTop: 20 }}>US MARSHALS SERVICE</Label>
        <div style={{ position: "relative", marginTop: 6 }}>
          <Label color={C.ink} size={30}>DATED 2008-04-24</Label>
          <svg width={330} height={70} style={{ position: "absolute", left: -18, top: -16 }}><ellipse cx={165} cy={35} rx={158} ry={27} fill="none" stroke={C.red} strokeWidth={6} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - circle} /></svg>
        </div>
      </Card>
      <div style={abs(680, 360, 340, 520, { opacity: note })}>
        <Label color={C.red} size={28}>THE DATE MATCHES THE SENTENCING</Label>
        <div style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 40, lineHeight: 1.25, color: C.text, marginTop: 24 }}>The photo's date does not say when, or why, it was taken.</div>
      </div>
      <Label size={22} color={C.mute} style={{ position: "absolute", left: 50, top: 1100, width: 980, lineHeight: 1.4 }}>Public domain (US federal government work), via Wikimedia Commons. {credits.booking}</Label>
    </Scene>
  );
}

const KINDS = { cover: Cover, doj: Doj, timeline: Timeline, alleged: Alleged, sought: Sought, booking: Booking };

export function CourtDossierShort({ durationInFrames, scenes, captions, images, credits }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.desk }}>
      <style>{FONT_FACES}</style>
      {scenes.map((s) => { const K = KINDS[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} images={images} credits={credits} /></Sequence>; })}
      <div style={abs(0, 120, 1080, 50, { textAlign: "center", fontFamily: MONO, fontWeight: 800, fontSize: 26, letterSpacing: "0.3em", color: "#8FA3B8" })}>COURT  &  SPOTLIGHT · CASE FILE</div>
      <Captions captions={captions} font={SANS} color={C.text} accent="#7C8CA0" top={1590} />
      <div style={abs(0, 1912, 1080 * (f / durationInFrames), 8, { background: C.red })} />
    </AbsoluteFill>
  );
}
