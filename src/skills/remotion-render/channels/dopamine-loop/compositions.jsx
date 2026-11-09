// Dopamine Loop: a character-led, restrained 2D story. The feeling is shown through the character and the situation.
// Graphics stay small and appear only where the research needs them. Character rig: ./rig.jsx (drawn from the owner's reference).
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs, Captions, clamp, Scene } from "../_shared/parts.jsx";
import { Figure, Room } from "./rig.jsx";

const SANS = '"Space Grotesk", sans-serif', MONO = '"JetBrains Mono", monospace';
const TEXT = "#F2F2F4", DIM = "#9A9AA2", COOL = "#9CC0E0", WARM = "#FF8A7A";
const lerp = (f, a, b, from, to) => interpolate(f, [a, b], [from, to], clamp);
const tag = (top, color, children, size = 26) => <div style={abs(70, top, 940, 120, { fontFamily: MONO, fontWeight: 700, fontSize: size, lineHeight: 1.35, letterSpacing: "0.06em", color, textAlign: "center" })}>{children}</div>;

/** Two characters toss a ball over a third, who stands apart. */
function LeftOut({ dur }) {
  const f = useCurrentFrame();
  const P = 46, u = (f / P) % 1, rightward = Math.floor(f / P) % 2 === 0;
  const bx = rightward ? 230 + 620 * u : 850 - 620 * u, by = 640 - 140 * Math.sin(Math.PI * u);
  const sway = Math.sin(f / 36) * 1.4;
  return (
    <Scene dur={dur}>
      <Room tint={0} />
      {tag(190, DIM, "BEING LEFT OUT")}
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
        <Figure x={230} y={780} scale={0.55} mood="neutral" tilt={rightward ? 4 : -2} />
        <Figure x={850} y={780} scale={0.55} flip={-1} mood="neutral" tilt={rightward ? 2 : -5} />
        <circle cx={bx} cy={by} r={22} fill={TEXT} />
        <Figure x={540} y={1060} scale={0.82} mood="sad" tilt={7 + sway} lean={sway / 2} />
      </svg>
    </Scene>
  );
}

/** The virtual game on a screen: the ball goes between two avatars and never to the third. */
function Screen({ dur }) {
  const f = useCurrentFrame();
  const P = 50, u = (f / P) % 1, right = Math.floor(f / P) % 2 === 0;
  const bx = right ? 330 + 420 * u : 750 - 420 * u, by = 440 - 90 * Math.sin(Math.PI * u);
  const mood = f > dur * 0.4 ? "sad" : "neutral";
  return (
    <Scene dur={dur}>
      <Room tint={0} />
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
        <rect x={150} y={290} width={780} height={640} rx={30} fill="#0D0D0F" stroke="#A5A5AB" strokeOpacity={0.5} strokeWidth={4} />
        <Figure x={330} y={560} scale={0.24} mood="neutral" />
        <Figure x={750} y={560} scale={0.24} flip={-1} mood="neutral" />
        <Figure x={540} y={780} scale={0.24} mood="neutral" opacity={0.7} />
        <circle cx={bx} cy={by} r={13} fill={TEXT} />
        <line x1={330} y1={450} x2={750} y2={450} stroke="#A5A5AB" strokeOpacity={0.3} strokeDasharray="6 12" strokeWidth={3} />
        <Figure x={540} y={1260} scale={0.95} mood={mood} tilt={lerp(f, 0, dur, -6, 4)} />
      </svg>
      {tag(965, DIM, <>VIRTUAL BALL GAME<br />INSIDE AN fMRI SCANNER</>)}
    </Scene>
  );
}

/** Distress builds as a tangle. Two restrained bars rise together, marked as illustrative. */
function Distress({ dur }) {
  const f = useCurrentFrame();
  const p = lerp(f, 6, dur * 0.85, 0.08, 1);
  const pulse = (Math.sin(f / 8) + 1) / 2;
  const bar = (top, label, color) => (
    <div style={abs(110, top, 860, 70, {})}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 24, letterSpacing: "0.08em", color: DIM }}>{label}</div>
      <div style={{ marginTop: 10, height: 22, borderRadius: 11, background: "#2A2A2E" }}><div style={{ width: `${p * 100}%`, height: 22, borderRadius: 11, background: color }} /></div>
    </div>
  );
  return (
    <Scene dur={dur}>
      <Room tint={0.02} />
      <svg width={1080} height={1500} style={{ position: "absolute", left: 0, top: 0 }}>
        <Figure x={540} y={700} scale={1.45} mood="sad" thought={p} heart="broken" heartPulse={pulse} tilt={Math.sin(f / 30) * 1.2} seed={11} />
      </svg>
      {bar(1330, "REPORTED DISTRESS", "#FF6A5A")}
      {bar(1440, "ANTERIOR CINGULATE ACTIVITY", COOL)}
      {tag(1535, DIM, "Illustrative. The study found the two rose together.", 22)}
    </Scene>
  );
}

/** The tangle loosens while a soft ring forms: a second region was active and linked to less distress. */
function Regulate({ dur }) {
  const f = useCurrentFrame();
  const calm = lerp(f, 8, dur * 0.9, 0, 0.85);
  const ring = lerp(f, 6, dur * 0.7, 0, 1);
  const mood = f > dur * 0.5 ? "tired" : "sad";
  return (
    <Scene dur={dur}>
      <Room tint={0.08} />
      <svg width={1080} height={1500} style={{ position: "absolute", left: 0, top: 0 }}>
        <circle cx={540} cy={700} r={1.45 * 110 + 30 + ring * 26} fill="none" stroke={COOL} strokeWidth={5} opacity={ring * 0.7} style={{ filter: `drop-shadow(0 0 ${14 * ring}px ${COOL})` }} />
        <Figure x={540} y={700} scale={1.45} mood={mood} thought={1} calm={calm} heart="broken" heartPulse={0.3} tilt={lerp(f, 0, dur, 3, -1)} seed={11} />
      </svg>
      {tag(1350, COOL, <>RIGHT VENTRAL PREFRONTAL CORTEX<br />ACTIVE, AND LINKED TO LESS DISTRESS</>)}
    </Scene>
  );
}

/** Someone sits down beside. The room warms and the heart mends. No claim is made about what comfort does to the brain. */
function Comfort({ dur }) {
  const f = useCurrentFrame();
  const arrive = lerp(f, 4, dur * 0.55, 1350, 705);
  const mend = f > dur * 0.6;
  const tint = lerp(f, dur * 0.3, dur * 0.9, 0.1, 0.85);
  return (
    <Scene dur={dur}>
      <Room tint={tint} />
      <svg width={1080} height={1500} style={{ position: "absolute", left: 0, top: 0 }}>
        <Figure x={390} y={760} scale={1.25} mood={mend ? "soft" : "sad"} thought={mend ? 0 : 0.6} heart={mend ? "whole" : "broken"} heartPulse={(Math.sin(f / 10) + 1) / 2} tilt={mend ? -2 : 5} seed={11} />
        <Figure x={arrive} y={760} scale={1.25} flip={-1} mood="soft" tilt={-3} />
      </svg>
      {tag(1330, DIM, "EISENBERGER, LIEBERMAN & WILLIAMS · SCIENCE 2003", 22)}
    </Scene>
  );
}

const KINDS = { "left-out": LeftOut, screen: Screen, distress: Distress, regulate: Regulate, comfort: Comfort };

function DopamineLoopShort({ durationInFrames, scenes, captions }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#0A0A0B" }}>
      <style>{FONT_FACES}</style>
      {scenes.map((s) => { const K = KINDS[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><K dur={s.to - s.from} /></Sequence>; })}
      <div style={abs(0, 110, 1080, 40, { textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: 26, letterSpacing: "0.3em", color: "#7C7C84" })}>DOPAMINE  LOOP</div>
      <Captions captions={captions} font={SANS} color={TEXT} accent={DIM} top={1610} />
      <div style={abs(0, 1912, 1080 * (f / durationInFrames), 8, { background: "#FF2B2B" })} />
    </AbsoluteFill>
  );
}

export const compositions = [{ id: "DopamineLoopShort", component: DopamineLoopShort, durationInFrames: 780, fps: 30, width: 1080, height: 1920, defaultProps: { durationInFrames: 780, scenes: [], captions: [] } }];
