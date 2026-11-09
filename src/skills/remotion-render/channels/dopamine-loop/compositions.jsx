// Dopamine Loop v2: a character-led, restrained 2D story. The feeling is shown through full human figures and the situation.
// Graphics stay small and appear only where the research needs them. Character rig: ./rig.jsx (drawn from the owner's reference).
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs, Captions, clamp, Scene } from "../_shared/parts.jsx";
import { Figure, POSES, Room } from "./rig.jsx";

const SANS = '"Space Grotesk", sans-serif', MONO = '"JetBrains Mono", monospace';
const TEXT = "#F2F2F4", DIM = "#9A9AA2", COOL = "#9CC0E0";
const lerp = (f, a, b, from, to) => interpolate(f, [a, b], [from, to], clamp);
const mix = (p, q, t) => ({ aL: p.aL.map((v, i) => v + (q.aL[i] - v) * t), aR: p.aR.map((v, i) => v + (q.aR[i] - v) * t), lL: p.lL.map((v, i) => v + (q.lL[i] - v) * t), lR: p.lR.map((v, i) => v + (q.lR[i] - v) * t) });
const tag = (top, color, children, size = 26) => <div style={abs(70, top, 940, 120, { fontFamily: MONO, fontWeight: 700, fontSize: size, lineHeight: 1.35, letterSpacing: "0.06em", color, textAlign: "center" })}>{children}</div>;
const FL = (y, w = 1080) => <line x1={90} y1={y} x2={w - 90} y2={y} stroke="#A5A5AB" strokeOpacity={0.18} strokeWidth={3} />;
const S = 0.85; // standing scale shared by the full-figure scenes

/** One figure stands apart from two who talk. A hand lifts to join, then lowers. */
function LeftOut({ dur }) {
  const f = useCurrentFrame();
  const talk = (ph) => Math.sin(f / 30 + ph) * 3;
  const up = f < dur * 0.45 ? lerp(f, dur * 0.18, dur * 0.46, 4, 46) : lerp(f, dur * 0.56, dur * 0.88, 46, 4);
  const poseC = { ...POSES.stand, aR: [up, up * 0.7 + 3] };
  const sway = Math.sin(f / 60) * 0.7;
  return (
    <Scene dur={dur}>
      <Room tint={0} />
      {tag(190, DIM, "BEING LEFT OUT")}
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
        {FL(1300)}
        <Figure x={680} y={760} scale={0.62} mood="happy" tilt={4} pose={{ ...POSES.stand, aL: [8 + talk(0), 12], aR: [-14 + talk(1), -6] }} />
        <Figure x={880} y={760} scale={0.62} flip={-1} mood="happy" tilt={-3} pose={{ ...POSES.stand, aL: [9 + talk(2), 14], aR: [-12 + talk(3), -5] }} />
        <Figure x={250} y={690} scale={S} mood="sad" tilt={7 + sway} heart="broken" heartPulse={(Math.sin(f / 9) + 1) / 2} pose={poseC} seed={11} />
      </svg>
    </Scene>
  );
}

/** A seated figure watches a phone. Chat bubbles appear, then stop. */
function QuietChat({ dur }) {
  const f = useCurrentFrame();
  const mood = f > dur * 0.55 ? "tired" : "sad";
  const bubbles = [[0.08, 430, 330], [0.22, 560, 290], [0.36, 690, 340]];
  const dots = lerp(f, dur * 0.46, dur * 0.58, 0, 1) * lerp(f, dur * 0.68, dur * 0.8, 1, 0);
  return (
    <Scene dur={dur}>
      <Room tint={0.02} />
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
        {FL(1180)}
        <rect x={150} y={1031} width={780} height={46} rx={10} fill="#141416" stroke="#A5A5AB" strokeOpacity={0.35} strokeWidth={3} />
        <Figure x={400} y={620} scale={0.95} mood={mood} tilt={lerp(f, 0, dur, 4, 9)} pose={{ ...POSES.sit, aR: [50, 85], aL: [8, 18] }} heart="broken" heartPulse={0.3} seed={11} />
        <g transform="translate(722 838) rotate(8)"><rect x={-44} y={-86} width={88} height={172} rx={14} fill="#10161C" stroke="#9CC0E0" strokeOpacity={0.7} strokeWidth={4} /><rect x={-36} y={-76} width={72} height={150} rx={8} fill="#9CC0E0" opacity={0.16 + 0.04 * Math.sin(f / 9)} /></g>
        {bubbles.map(([t, y, w], i) => { const a = lerp(f, dur * t, dur * t + 10, 0, 1) * lerp(f, dur * 0.7, dur * 0.85, 1, 0.35); return <rect key={i} x={620} y={y - 150} width={w - 80} height={66} rx={26} fill="#F2F2F4" opacity={a * 0.16} />; })}
        <g opacity={dots}>{[0, 1, 2].map((k) => <circle key={k} cx={650 + k * 30} cy={y3()} r={9} fill={TEXT} opacity={0.5 + 0.5 * Math.sin(f / 4 + k)} />)}</g>
      </svg>
    </Scene>
  );
}
const y3 = () => 590;

/** The virtual game: the ball goes between two avatars and never to the third. One small bar rises with distress. */
function Screen({ dur }) {
  const f = useCurrentFrame();
  const P = 50, u = (f / P) % 1, right = Math.floor(f / P) % 2 === 0;
  const bx = right ? 650 + 240 * u : 890 - 240 * u, by = 740 - 80 * Math.sin(Math.PI * u);
  const p = lerp(f, 8, dur * 0.85, 0.1, 1);
  const av = (cx, cy, o = 1) => <g opacity={o}><circle cx={cx} cy={cy} r={34} fill="#0A0A0B" stroke="#A5A5AB" strokeOpacity={0.7} strokeWidth={3} /><path d={`M ${cx - 46} ${cy + 96} Q ${cx} ${cy + 40} ${cx + 46} ${cy + 96} Z`} fill="#0A0A0B" stroke="#A5A5AB" strokeOpacity={0.7} strokeWidth={3} /></g>;
  return (
    <Scene dur={dur}>
      <Room tint={0} />
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
        {FL(1250)}
        <Figure x={280} y={800} scale={0.7} mood={f > dur * 0.4 ? "sad" : "neutral"} tilt={lerp(f, 0, dur, -4, 5)} heart={f > dur * 0.4 ? "broken" : null} heartPulse={0.3} pose={{ ...POSES.stand, aR: [24, 40] }} seed={11} />
        <rect x={500} y={560} width={500} height={440} rx={26} fill="#0D0D0F" stroke="#A5A5AB" strokeOpacity={0.5} strokeWidth={4} />
        {av(650, 700)}{av(890, 700)}{av(770, 840, 0.7)}
        <circle cx={bx} cy={by} r={12} fill={TEXT} />
        <line x1={650} y1={655} x2={890} y2={655} stroke="#A5A5AB" strokeOpacity={0.3} strokeDasharray="6 12" strokeWidth={3} />
      </svg>
      {tag(1020, DIM, "VIRTUAL BALL GAME · fMRI SCANNER", 22)}
      <div style={abs(500, 1100, 500, 90, {})}>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, letterSpacing: "0.06em", color: DIM }}>BRAIN ACTIVITY ROSE WITH DISTRESS</div>
        <div style={{ marginTop: 12, height: 20, borderRadius: 10, background: "#2A2A2E" }}><div style={{ width: `${p * 100}%`, height: 20, borderRadius: 10, background: "#FF6A5A" }} /></div>
      </div>
    </Scene>
  );
}

/** The tangle loosens while a soft ring forms. */
function Regulate({ dur }) {
  const f = useCurrentFrame();
  const calm = lerp(f, 8, dur * 0.9, 0, 0.85), ring = lerp(f, 6, dur * 0.7, 0, 1);
  const mood = f > dur * 0.5 ? "tired" : "sad";
  const arms = lerp(f, 0, dur, 16, 4);
  return (
    <Scene dur={dur}>
      <Room tint={0.08} />
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
        {FL(1330)}
        <circle cx={540} cy={640} r={0.95 * 110 + 30 + ring * 24} fill="none" stroke={COOL} strokeWidth={5} opacity={ring * 0.7} style={{ filter: `drop-shadow(0 0 ${14 * ring}px ${COOL})` }} />
        <Figure x={540} y={640} scale={0.95} mood={mood} thought={1} calm={calm} heart="broken" heartPulse={0.3} tilt={lerp(f, 0, dur, 3, -1)} pose={{ ...POSES.stand, aL: [-arms, -arms], aR: [arms, arms] }} seed={11} />
      </svg>
      {tag(1400, COOL, <>ANOTHER REGION: ACTIVE,<br />LINKED TO LESS DISTRESS</>)}
    </Scene>
  );
}

/** Someone walks over, sits, and rests a hand on a shoulder. The room warms and the heart mends. No brain claim is made here. */
function Comfort({ dur }) {
  const f = useCurrentFrame();
  const walk = lerp(f, 4, dur * 0.4, 0, 1), sit = lerp(f, dur * 0.4, dur * 0.55, 0, 1), reach = lerp(f, dur * 0.58, dur * 0.72, 0, 1);
  const dx = lerp(f, 4, dur * 0.4, 1330, 650);
  const stride = Math.sin(f / 9) * 9 * (walk < 1 ? 1 : 0);
  const sitPose = mix({ ...POSES.stand, lL: [stride, 0], lR: [-stride, 0] }, POSES.sit, sit);
  const dPose = { ...sitPose, aR: [4 + 41 * reach, 2 + 8 * reach], aL: [-4, -2] };
  const dY = 700 - 150 * S * (1 - sit);
  const mend = f > dur * 0.66, tint = lerp(f, dur * 0.35, dur * 0.9, 0.1, 0.85);
  return (
    <Scene dur={dur}>
      <Room tint={tint} />
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
        {FL(1192)}
        <rect x={170} y={1068} width={790} height={42} rx={10} fill="#141416" stroke="#A5A5AB" strokeOpacity={0.35} strokeWidth={3} />
        <Figure x={380} y={700} scale={S} mood={mend ? "soft" : "sad"} thought={mend ? 0 : 0.6} heart={mend ? "whole" : "broken"} heartPulse={(Math.sin(f / 10) + 1) / 2} tilt={mend ? -2 : 6} pose={POSES.sit} seed={11} />
        <Figure x={dx} y={dY} scale={S} flip={-1} mood="soft" tilt={-3} pose={dPose} />
      </svg>
      {tag(1310, DIM, "EISENBERGER, LIEBERMAN & WILLIAMS · SCIENCE 2003", 22)}
    </Scene>
  );
}

const KINDS = { "left-out": LeftOut, "quiet-chat": QuietChat, screen: Screen, regulate: Regulate, comfort: Comfort };

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
