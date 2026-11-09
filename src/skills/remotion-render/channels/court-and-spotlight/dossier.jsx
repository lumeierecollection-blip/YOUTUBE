// Court & Spotlight, investigation format: an evidence-panel dossier. Confirmed, acquitted and alleged items are stamped differently
// so a viewer can never mistake an allegation for a finding. No photo of any person is used.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs, Captions, clamp, From, Scene } from "../_shared/parts.jsx";

const SANS = '"Space Grotesk", sans-serif', MONO = '"JetBrains Mono", monospace';
const C = { desk: "#0E1621", grid: "#16222F", paper: "#F1EAD8", paperEdge: "#D8CDB0", ink: "#1C1B18", dim: "#6B6454", red: "#C62828", green: "#2E7D32", amber: "#B26A00", text: "#F4F1E8" };

const Paper = ({ x, y, w, h, rot = 0, delay = 0, children, style }) => {
  const f = useCurrentFrame(), t = interpolate(f, [delay, delay + 12], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return <div style={abs(x, y, w, h, { background: C.paper, border: `2px solid ${C.paperEdge}`, borderRadius: 6, boxShadow: "0 24px 50px rgba(0,0,0,0.5)", transform: `rotate(${rot}deg) translateY(${(1 - t) * 60}px)`, opacity: t, padding: "36px 40px", boxSizing: "border-box", ...style })}>{children}</div>;
};

const Stamp = ({ text, color, x, y, rot = -8, delay = 0, size = 64 }) => {
  const f = useCurrentFrame(), t = interpolate(f, [delay, delay + 8], [1.8, 1], { ...clamp, easing: Easing.out(Easing.back(2)) }), o = interpolate(f, [delay, delay + 4], [0, 1], clamp);
  return <div style={{ position: "absolute", left: x, top: y, border: `8px solid ${color}`, borderRadius: 10, color, fontFamily: MONO, fontWeight: 800, fontSize: size, letterSpacing: "0.08em", padding: "6px 22px", opacity: o * 0.92, transform: `rotate(${rot}deg) scale(${t})`, transformOrigin: "center" }}>{text}</div>;
};

const Label = ({ children, color = C.dim, size = 26 }) => <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: size, letterSpacing: "0.12em", color }}>{children}</div>;
const Desk = () => <AbsoluteFill style={{ background: C.desk, backgroundImage: `linear-gradient(${C.grid} 2px, transparent 2px), linear-gradient(90deg, ${C.grid} 2px, transparent 2px)`, backgroundSize: "90px 90px" }} />;

function Cover({ dur }) {
  return (
    <Scene dur={dur}>
      <Desk />
      <Paper x={90} y={330} w={900} h={1000} rot={-1.2}>
        <Label>FEDERAL TAX CASE · OCALA, FLORIDA</Label>
        <From delay={6} style={{ fontFamily: SANS, fontWeight: 800, fontSize: 150, lineHeight: 0.98, color: C.ink, marginTop: 70 }}>WESLEY<br />SNIPES</From>
        <div style={{ height: 6, background: C.ink, width: 220, margin: "50px 0 40px" }} />
        <From delay={14} style={{ fontFamily: SANS, fontWeight: 700, fontSize: 60, lineHeight: 1.12, color: C.ink }}>Sentenced to three years' imprisonment for failing to file income tax returns</From>
        <Label size={24}>APRIL 2008 · AS REPORTED BY THE US DEPARTMENT OF JUSTICE</Label>
      </Paper>
      <Stamp text="CONFIRMED" color={C.green} x={600} y={1190} delay={26} />
    </Scene>
  );
}

function Verdict({ dur, guilty }) {
  const items = guilty
    ? [["Charge", "Failing to file income tax returns"], ["Decided by", "A jury, in February"]]
    : [["Charges", "Five additional charges"], ["Including", "Felony tax fraud and conspiracy"], ["Decided by", "The same jury, in February"]];
  return (
    <Scene dur={dur}>
      <Desk />
      <Paper x={90} y={360} w={900} h={900} rot={guilty ? 1 : -1.4}>
        <Label>{guilty ? "VERDICT · COUNT SUMMARY" : "VERDICT · OTHER CHARGES"}</Label>
        <div style={{ marginTop: 56, display: "flex", flexDirection: "column", gap: 44 }}>
          {items.map(([k, v], i) => (
            <From key={k} delay={8 + i * 8} dy={20}><Label size={24}>{k.toUpperCase()}</Label><div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 68, lineHeight: 1.06, color: C.ink, marginTop: 8 }}>{v}</div></From>
          ))}
        </div>
      </Paper>
      <Stamp text={guilty ? "CONVICTED" : "ACQUITTED"} color={guilty ? C.red : C.green} x={guilty ? 560 : 520} y={1130} delay={24} size={72} />
    </Scene>
  );
}

function Allegation({ dur }) {
  const f = useCurrentFrame();
  const n = interpolate(f, [8, dur * 0.6], [0, 13.8], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <Scene dur={dur}>
      <Desk />
      <Paper x={90} y={360} w={900} h={900} rot={0.8} style={{ borderColor: C.amber, borderStyle: "dashed" }}>
        <Label color={C.amber}>THE GOVERNMENT'S CLAIM · NOT A FINDING</Label>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 200, lineHeight: 1, color: C.ink, marginTop: 90 }}>${n.toFixed(1)}M+</div>
        <From delay={14} style={{ fontFamily: SANS, fontWeight: 700, fontSize: 52, lineHeight: 1.15, color: C.ink, marginTop: 34 }}>alleged earnings in the years in question</From>
        <From delay={22} style={{ fontFamily: MONO, fontWeight: 700, fontSize: 28, lineHeight: 1.4, color: C.dim, marginTop: 40 }}>Alleged back taxes owed: $2.7M<br />As reported by CBS News</From>
      </Paper>
      <Stamp text="ALLEGED" color={C.amber} x={600} y={1130} delay={20} size={72} />
    </Scene>
  );
}

function Sentence({ dur }) {
  const f = useCurrentFrame();
  const a = interpolate(f, [8, 24], [0, 1], clamp), b = interpolate(f, [26, 44], [0, 1], clamp);
  const bar = (top, label, value, color, fill, shown) => (
    <div style={abs(110, top, 860, 200, { opacity: shown })}>
      <Label color={C.text} size={28}>{label}</Label>
      <div style={{ marginTop: 18, height: 70, borderRadius: 8, background: "#1B2A3A" }}><div style={{ width: `${fill * shown * 100}%`, height: 70, borderRadius: 8, background: color }} /></div>
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 64, color: C.text, marginTop: 12 }}>{value}</div>
    </div>
  );
  return (
    <Scene dur={dur}>
      <Desk />
      <From style={abs(110, 330, 860, 120, {})}><Label color={C.amber} size={30}>SENTENCING · APRIL 2008</Label></From>
      {bar(430, "PROSECUTORS SOUGHT", "The maximum penalty", C.amber, 1, a)}
      {bar(760, "THE JUDGE GAVE", "Three years", C.red, 0.92, b)}
      <Stamp text="SENTENCED" color={C.red} x={470} y={1120} delay={46} size={66} />
      <From delay={52} style={abs(110, 1290, 860, 120, {})}><Label color="#8FA3B8" size={22}>SOURCES: US DOJ RELEASE (REPUBLISHED), CBS NEWS · 25 APRIL 2008</Label></From>
    </Scene>
  );
}

const KINDS = { cover: Cover, "verdict-guilty": (p) => <Verdict {...p} guilty />, "verdict-acquitted": (p) => <Verdict {...p} guilty={false} />, allegation: Allegation, sentence: Sentence };

export function CourtDossierShort({ durationInFrames, scenes, captions }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.desk }}>
      <style>{FONT_FACES}</style>
      {scenes.map((s) => { const K = KINDS[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} /></Sequence>; })}
      <div style={abs(0, 130, 1080, 50, { textAlign: "center", fontFamily: MONO, fontWeight: 800, fontSize: 28, letterSpacing: "0.3em", color: "#8FA3B8" })}>COURT  &  SPOTLIGHT · CASE FILE</div>
      <Captions captions={captions} font={SANS} color={C.text} accent="#7C8CA0" top={1590} />
      <div style={abs(0, 1912, 1080 * (f / durationInFrames), 8, { background: C.red })} />
    </AbsoluteFill>
  );
}
