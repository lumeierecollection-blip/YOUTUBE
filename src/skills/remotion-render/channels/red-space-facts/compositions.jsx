// Red Space Facts: "Saturn is losing its rings". Real 3D (Three.js via @remotion/three), no stills.
// Narration and timing arrive as props from platform/channels/red-space-facts/preview.mjs.
import React, { useMemo } from "react";
import { AbsoluteFill, Easing, Sequence, interpolate, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { loadFont as loadGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import * as THREE from "three";
import saturnUrl from "./textures/saturn.jpg";
import channel from "../../../../../platform/channels/red-space-facts/channel.json";
import figures from "../../../../../platform/channels/red-space-facts/figures.json";
import { P, W, H, R_EQ, OBLIQUITY, OBLATE, Rig, SaturnSystem, SunLight, Stars, fieldLine, project, satWorld, useImageTexture, rand } from "./three-kit.jsx";

const { fontFamily: DISPLAY } = loadGrotesk("normal", { weights: ["500", "700"], subsets: ["latin"] });
const { fontFamily: MONO } = loadMono("normal", { weights: ["500", "700"], subsets: ["latin"] });
const SANS = `${DISPLAY}, "Space Grotesk", sans-serif`;
const MONOF = `${MONO}, "JetBrains Mono", monospace`;
const ease = Easing.bezier(0.22, 0.61, 0.36, 1);
const ramp = (f, a, b, x0 = 0, x1 = 1) => interpolate(f, [a, b], [x0, x1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/* ---------- 2D furniture ---------- */

const STATUS_TEXT = channel.status_labels;
function Chip({ status, note, top, light }) {
  const col = P.status[status];
  return (
    <div style={{ position: "absolute", left: 48, right: 48, top, display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderRadius: 14, background: light ? "#ffffffee" : P.caption_bg, border: `2px solid ${col}` }}>
      <div style={{ width: 16, height: 16, borderRadius: 8, background: col, flex: "none" }} />
      <div style={{ fontFamily: MONOF, fontWeight: 700, fontSize: 26, letterSpacing: 1.5, color: col, flex: "none" }}>{STATUS_TEXT[status]}</div>
      <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 26, color: light ? P.ink : P.text, lineHeight: 1.15 }}>{note}</div>
    </div>
  );
}

function Caption({ text, light }) {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: 1440, display: "flex", justifyContent: "center", opacity: ramp(f, 3, 10) }}>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 50, lineHeight: 1.18, textAlign: "center", color: P.text, background: P.caption_bg, padding: "18px 28px", borderRadius: 20, textShadow: "0 2px 8px #000a" }}>{text}</div>
    </div>
  );
}

function Leader({ from, to, label, align = "left", color = P.leader, sub, light }) {
  const tx = to.x, ty = to.y;
  const anchorRight = align === "right";
  return (
    <>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        <line x1={from.x} y1={from.y} x2={tx} y2={ty} stroke={color} strokeWidth={2.5} />
        <circle cx={from.x} cy={from.y} r={7} fill={color} />
      </svg>
      <div style={{ position: "absolute", left: anchorRight ? undefined : tx + 10, right: anchorRight ? W - tx + 10 : undefined, top: ty - 20, fontFamily: SANS, fontWeight: 700, fontSize: 32, color: light ? P.ink : P.text, textAlign: anchorRight ? "right" : "left", whiteSpace: "nowrap", textShadow: light ? "none" : "0 2px 8px #000" }}>
        {label}
        {sub && <div style={{ fontFamily: MONOF, fontWeight: 500, fontSize: 22, color: light ? P.ink_dim : P.text_dim }}>{sub}</div>}
      </div>
    </>
  );
}

function Fade({ light, frames = 6 }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: light ? P.white : P.space, opacity: ramp(f, 0, frames, 1, 0), pointerEvents: "none" }} />;
}

const Canvas3D = ({ children, bg }) => (
  <AbsoluteFill style={{ background: bg }}>
    <ThreeCanvas width={W} height={H} flat gl={{ antialias: true, preserveDrawingBuffer: true }} camera={{ fov: 40, position: [0, 0, 10], near: 0.05, far: 800 }}>
      {children}
    </ThreeCanvas>
  </AbsoluteFill>
);

/* ---------- S1: ring-plane flyover (hook) ---------- */

function S1({ dur, caption }) {
  const f = useCurrentFrame();
  const tex = useImageTexture(saturnUrl);
  const t = ramp(f, 0, dur - 4);
  const az = interpolate(t, [0, 1], [1.0, 0.12]);
  const el = interpolate(t, [0, 1], [0.07, 0.34]);
  const d = interpolate(t, [0, 1], [4.6, 9.5]);
  const cam = { pos: [d * Math.cos(el) * Math.sin(az) * -1, d * Math.sin(el), d * Math.cos(el) * Math.cos(az)], look: [0.1, 0, 0], fov: 40 };
  return (
    <>
      <Canvas3D bg={P.space}>
        <Rig cam={cam} />
        <SunLight pos={[-14, 5, 9]} />
        <Stars seed={3} />
        <SaturnSystem tex={tex} rotation={f * 0.004} />
      </Canvas3D>
      <Chip status="scientific_model" note="loss inferred from measured infrared glow" top={170} />
      <div style={{ position: "absolute", left: 60, right: 60, top: 300, fontFamily: SANS, fontWeight: 700, fontSize: 92, lineHeight: 1.0, color: P.text, opacity: ramp(f, 4, 16), textShadow: "0 4px 24px #000" }}>
        Saturn is raining its rings away.
      </div>
      <Caption text={caption} />
    </>
  );
}

/* ---------- S2: orbital scale pull-out ---------- */

const ORB_U = 100; // 1 scene unit = 100 million km
function OrbitRing({ r, w, color, op = 1 }) {
  const geo = useMemo(() => { const g = new THREE.RingGeometry(Math.max(0.001, r - Math.min(w, r * 0.2)), r + Math.min(w, r * 0.2), 256, 1); g.rotateX(-Math.PI / 2); return g; }, [r, w]);
  return <mesh geometry={geo}><meshBasicMaterial color={color} transparent opacity={op} side={THREE.DoubleSide} depthWrite={false} /></mesh>;
}

function S2({ dur, caption }) {
  const f = useCurrentFrame();
  const rows = figures.planets.rows;
  const t = ramp(f, 6, dur - 8);
  const dist = Math.exp(interpolate(t, [0, 1], [Math.log(4.2), Math.log(78)]));
  const elev = 0.82;
  const earth = rows.find((r) => r.name === "Earth"), saturn = rows.find((r) => r.name === "Saturn");
  const days = f * 2.4; // time sped up: 72 days per second
  const pos = (row, ph) => { const r = row.distance_million_km / ORB_U, a = ph + (2 * Math.PI * days) / row.period_days; return [r * Math.cos(a), 0, r * Math.sin(a)]; };
  const phases = { Mercury: 0.4, Venus: 2.2, Earth: 4.3, Mars: 1.1, Jupiter: 5.2, Saturn: 2.6 };
  const focus = interpolate(t, [0, 1], [pos(earth, phases.Earth)[0], 0]);
  const cam = { pos: [dist * 0.1, dist * Math.sin(elev), dist * Math.cos(elev)], look: [0, 0, 0], fov: 38 };
  const lw = dist * 0.0032, mk = dist * 0.018;
  const ratio = interpolate(t, [0, 1], [1, saturn.distance_million_km / earth.distance_million_km]);
  const sat = project(cam, pos(saturn, phases.Saturn)), ear = project(cam, pos(earth, phases.Earth));
  return (
    <>
      <Canvas3D bg={P.space}>
        <Rig cam={cam} />
        <Stars seed={11} />
        <ambientLight intensity={1} />
        <mesh><sphereGeometry args={[mk * 1.6, 32, 24]} /><meshBasicMaterial color={P.sun} /></mesh>
        <mesh><sphereGeometry args={[mk * 3.2, 32, 24]} /><meshBasicMaterial color={P.sun_glow} transparent opacity={0.22} depthWrite={false} /></mesh>
        {rows.map((row) => {
          const focusRow = row.name === "Earth" || row.name === "Saturn";
          return (
            <group key={row.name}>
              <OrbitRing r={row.distance_million_km / ORB_U} w={lw * (focusRow ? 1.5 : 0.8)} color={focusRow ? P.orbit_focus : P.orbit} op={focusRow ? 0.95 : 0.55} />
              <mesh position={pos(row, phases[row.name])}>
                <sphereGeometry args={[mk * (focusRow ? 1.25 : 0.8), 32, 24]} />
                <meshBasicMaterial color={P.planets[row.name]} />
              </mesh>
            </group>
          );
        })}
      </Canvas3D>
      <Chip status="observation" note="measured orbital distances (NASA fact sheet)" top={170} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 290, textAlign: "center", fontFamily: MONOF, fontWeight: 700, fontSize: 150, color: P.orbit_focus, textShadow: "0 4px 24px #000" }}>
        {ratio.toFixed(1)}x
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 470, textAlign: "center", fontFamily: SANS, fontWeight: 500, fontSize: 34, color: P.text }}>Earth's distance from the Sun</div>
      {t > 0.55 && <Leader from={sat} to={{ x: Math.min(W - 40, sat.x), y: sat.y - 110 }} align="right" color={P.planets.Saturn} label="Saturn" sub="1,432 million km" />}
      {t > 0.0 && <Leader from={ear} to={{ x: Math.max(40, ear.x), y: ear.y + 110 }} align="left" color={P.planets.Earth} label="Earth" sub="149.6 million km" />}
      <div style={{ position: "absolute", left: 48, right: 48, top: 1290, fontFamily: MONOF, fontSize: 22, color: P.text_dim, lineHeight: 1.3 }}>
        Orbit sizes to scale (circles at mean distance). Planets enlarged. Positions illustrative; time sped up.
      </div>
      <Caption text={caption} />
    </>
  );
}

/* ---------- S3: ring rain, labelled ---------- */

const RINGS_L = [
  { name: "C ring", L: (figures.rings.regions[0].inner_km + figures.rings.regions[0].outer_km) / 2 / R_EQ },
  { name: "B ring", L: (figures.rings.regions[1].inner_km + figures.rings.regions[1].outer_km) / 2 / R_EQ },
  { name: "A ring", L: (figures.rings.regions[3].inner_km + figures.rings.regions[3].outer_km) / 2 / R_EQ },
];

function FieldLines() {
  const lines = useMemo(() => {
    const out = [];
    RINGS_L.forEach((rg, ri) => {
      for (let k = 0; k < 6; k++) {
        const phi = (k / 6) * Math.PI * 2 + ri * 0.35;
        for (const sign of [1, -1]) out.push({ ...fieldLine(rg.L, phi, sign), ri, k, sign });
      }
    });
    return out;
  }, []);
  const geos = useMemo(() => lines.map((l) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(l.pts), 48, 0.006, 5, false)), [lines]);
  const f = useCurrentFrame();
  const rr = useMemo(() => rand(5), []);
  const seeds = useMemo(() => lines.map(() => rr()), [lines, rr]);
  return (
    <>
      {geos.map((g, i) => (<mesh key={i} geometry={g}><meshBasicMaterial color={P.field_line} transparent opacity={0.55} depthWrite={false} /></mesh>))}
      {lines.map((l, i) => {
        // two grains per line, falling from the ring (t=0) to the planet (t=1)
        return [0, 0.5].map((off) => {
          const t = (seeds[i] + off + f * 0.011) % 1;
          const p = l.pts[Math.min(l.pts.length - 1, Math.floor(t * (l.pts.length - 1)))];
          return <mesh key={`${i}-${off}`} position={p}><sphereGeometry args={[0.028, 10, 8]} /><meshBasicMaterial color={P.ice} /></mesh>;
        });
      })}
    </>
  );
}

function S3({ dur, caption }) {
  const f = useCurrentFrame();
  const tex = useImageTexture(saturnUrl);
  const t = ramp(f, 0, dur);
  const cam = { pos: [interpolate(t, [0, 1], [-1.4, 1.2]), interpolate(t, [0, 1], [3.8, 4.6]), 12.6], look: [0, 0, 0], fov: 36 };
  const bands = ramp(f, 6, 30);
  // anchor points (world) for labels
  const ringPt = (name) => { const L = RINGS_L.find((r) => r.name === name).L; return satWorld([L * Math.cos(0.5), 0, L * Math.sin(0.5)]); };
  const bandPt = satWorld([0.35, 0.58, 0.68]);
  const lineA = useMemo(() => fieldLine(RINGS_L[2].L, 2.0, 1), []);
  const lineMid = satWorld(lineA.pts[Math.floor(lineA.pts.length * 0.45)].toArray());
  return (
    <>
      <Canvas3D bg={P.space}>
        <Rig cam={cam} />
        <SunLight pos={[-12, 8, 10]} />
        <Stars seed={21} />
        <SaturnSystem tex={tex} bands={bands * 0.9} rotation={0.6}>
          <FieldLines />
        </SaturnSystem>
      </Canvas3D>
      <Chip status="observation" note="dark bands, 25-55 degrees latitude (Keck, April 2011)" top={170} />
      <Chip status="scientific_model" note="charged ice falling along field lines" top={262} />
      <div style={{ opacity: ramp(f, 22, 34) }}>
        <Leader from={project(cam, bandPt)} to={{ x: 40, y: 560 }} align="left" label="Dark bands" sub="25-55 deg latitude" color={P.status.observation} />
      </div>
      <div style={{ opacity: ramp(f, 36, 48) }}>
        <Leader from={project(cam, lineMid)} to={{ x: W - 40, y: 1000 }} align="right" label="Field line" sub="simplified dipole" color={P.field_line} />
      </div>
      <div style={{ opacity: ramp(f, 48, 60) }}>
        <Leader from={project(cam, ringPt("A ring"))} to={{ x: W - 40, y: 1130 }} align="right" label="A ring" color={P.ring_tint} />
        <Leader from={project(cam, ringPt("B ring"))} to={{ x: W - 40, y: 1215 }} align="right" label="B ring" color={P.ring_tint} />
        <Leader from={project(cam, ringPt("C ring"))} to={{ x: W - 40, y: 1300 }} align="right" label="C ring" color={P.ring_tint} />
      </div>
      <div style={{ position: "absolute", left: 48, top: 1330, fontFamily: MONOF, fontSize: 22, color: P.text_dim, width: 560 }}>Charged ice grains drawn bright. Grain count and speed illustrative.</div>
      <Caption text={caption} />
    </>
  );
}

/* ---------- S4: pool-fill estimate (explanatory, white) ---------- */

function S4({ dur, caption }) {
  const f = useCurrentFrame();
  const fill = ramp(f, 12, dur - 14);
  const minutes = fill * 30;
  const mm = String(Math.floor(minutes)).padStart(2, "0"), ss = String(Math.floor((minutes % 1) * 60)).padStart(2, "0");
  const L = 5, Wd = 2.5, Dp = 1.1;
  const ang = interpolate(f, [0, dur], [0.5, 0.95]);
  const cam = { pos: [Math.sin(ang) * 8.2, 5.6, Math.cos(ang) * 8.2], look: [0, -0.2, 0], fov: 34 };
  const wall = <meshStandardMaterial color={P.pool_wall} roughness={0.9} side={THREE.DoubleSide} />;
  return (
    <>
      <Canvas3D bg={P.white}>
        <Rig cam={cam} />
        <ambientLight intensity={1.1} />
        <directionalLight position={[5, 9, 4]} intensity={2.2} />
        <mesh position={[0, -Dp, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[L, Wd]} /><meshStandardMaterial color={P.pool_floor} /></mesh>
        <mesh position={[0, -Dp / 2, Wd / 2]}><planeGeometry args={[L, Dp]} />{wall}</mesh>
        <mesh position={[0, -Dp / 2, -Wd / 2]}><planeGeometry args={[L, Dp]} />{wall}</mesh>
        <mesh position={[L / 2, -Dp / 2, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[Wd, Dp]} />{wall}</mesh>
        <mesh position={[-L / 2, -Dp / 2, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[Wd, Dp]} />{wall}</mesh>
        <mesh position={[0, -Dp + (Dp * fill) / 2, 0]} scale={[1, Math.max(0.001, fill), 1]}>
          <boxGeometry args={[L - 0.04, Dp, Wd - 0.04]} />
          <meshStandardMaterial color={P.water} transparent opacity={0.82} />
        </mesh>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (<mesh key={i} position={[-L / 2 + 0.25 + i * ((L - 0.5) / 6), -Dp + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.05, Wd - 0.1]} /><meshBasicMaterial color={P.white} /></mesh>))}
      </Canvas3D>
      <Chip status="scientific_model" note="researchers' estimate, not a measurement" top={170} light />
      <div style={{ position: "absolute", left: 0, right: 0, top: 300, textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: 64, color: P.ink }}>One Olympic-sized pool</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 385, textAlign: "center", fontFamily: SANS, fontWeight: 500, fontSize: 40, color: P.ink_dim }}>of water from the rings, every 30 minutes</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1130, textAlign: "center", fontFamily: MONOF, fontWeight: 700, fontSize: 120, color: P.ink }}>{mm}:{ss}</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1270, textAlign: "center", fontFamily: MONOF, fontSize: 24, color: P.ink_dim }}>Pool drawn for scale only. Clock sped up.</div>
      <Caption text={caption} />
    </>
  );
}

/* ---------- S5 + S6: disputed timescale, then the hypothetical bare planet ---------- */

function Card({ top, year, line, status, op }) {
  const col = P.status[status];
  return (
    <div style={{ position: "absolute", left: 48, right: 48, top, opacity: op, padding: "18px 24px", borderRadius: 18, background: P.caption_bg, border: `2px solid ${col}` }}>
      <div style={{ fontFamily: MONOF, fontWeight: 700, fontSize: 24, color: col, letterSpacing: 1.5 }}>{STATUS_TEXT[status]} | {year}</div>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, color: P.text, lineHeight: 1.12, marginTop: 6 }}>{line}</div>
    </div>
  );
}

function S56({ dur, s5Dur, caption5, caption6 }) {
  const f = useCurrentFrame();
  const tex = useImageTexture(saturnUrl);
  const in6 = f >= s5Dur;
  const ringOp = in6 ? 0 : interpolate(f, [8, s5Dur - 4], [1, 0.12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const t = ramp(f, 0, dur);
  const cam = { pos: [interpolate(t, [0, 1], [-1.6, 1.0]), interpolate(t, [0, 1], [3.4, 2.4]), 13.2], look: [0, 0.6, 0], fov: 36 };
  return (
    <>
      <Canvas3D bg={P.space}>
        <Rig cam={cam} />
        <SunLight pos={[-12, 6, 10]} />
        <Stars seed={33} />
        <SaturnSystem tex={tex} ringOpacity={ringOp} rotation={f * 0.005 + (in6 ? (f - s5Dur) * 0.08 : 0)} />
      </Canvas3D>
      {!in6 && (
        <>
          <Card top={170} year="2018 STUDY" status="scientific_model" line="Under 100 million years left" op={ramp(f, 4, 14)} />
          <Card top={330} year="2024 SIMULATION" status="scientific_model" line="Rings could be as old as the Solar System: about 4.5 billion years" op={ramp(f, Math.round(s5Dur * 0.45), Math.round(s5Dur * 0.45) + 10)} />
          <div style={{ position: "absolute", left: 48, right: 48, top: 1290, fontFamily: MONOF, fontSize: 22, color: P.status.hypothetical, lineHeight: 1.3 }}>HYPOTHETICAL: the thinning rings are an illustration, not an observation.</div>
          <Caption text={caption5} />
        </>
      )}
      {in6 && (
        <>
          <div style={{ position: "absolute", left: 48, right: 48, top: 170, opacity: ramp(f - s5Dur, 0, 8), textAlign: "center", padding: "30px 20px", borderRadius: 24, background: P.status.hypothetical, color: P.space, fontFamily: SANS, fontWeight: 700, fontSize: 84, lineHeight: 1 }}>
            HYPOTHETICAL
            <div style={{ fontFamily: MONOF, fontWeight: 700, fontSize: 34, marginTop: 12 }}>never observed</div>
          </div>
          <Chip status="artistic_interpretation" note="imagined render of a ringless Saturn" top={430} />
          <Caption text={caption6} />
          <div style={{ position: "absolute", left: 48, right: 48, top: 1720, fontFamily: MONOF, fontSize: 21, color: P.text_dim, textAlign: "center", lineHeight: 1.3 }}>{channel.disclosure_line}</div>
        </>
      )}
    </>
  );
}

/* ---------- Composition ---------- */

function Short({ scenes, narration }) {
  const by = Object.fromEntries(scenes.map((s) => [s.id, s]));
  const light = new Set(["s4"]);
  return (
    <AbsoluteFill style={{ background: P.space }}>
      <Sequence from={by.s1.from} durationInFrames={by.s1.dur}><S1 dur={by.s1.dur} caption={narration.s1} /><Fade /></Sequence>
      <Sequence from={by.s2.from} durationInFrames={by.s2.dur}><S2 dur={by.s2.dur} caption={narration.s2} /><Fade /></Sequence>
      <Sequence from={by.s3.from} durationInFrames={by.s3.dur}><S3 dur={by.s3.dur} caption={narration.s3} /><Fade /></Sequence>
      <Sequence from={by.s4.from} durationInFrames={by.s4.dur}><S4 dur={by.s4.dur} caption={narration.s4} /><Fade light /></Sequence>
      <Sequence from={by.s5.from} durationInFrames={by.s5.dur + by.s6.dur}><S56 dur={by.s5.dur + by.s6.dur} s5Dur={by.s5.dur} caption5={narration.s5} caption6={narration.s6} /><Fade /></Sequence>
    </AbsoluteFill>
  );
}

const defaultScenes = [["s1", 0, 90], ["s2", 90, 150], ["s3", 240, 210], ["s4", 450, 130], ["s5", 580, 190], ["s6", 770, 80]].map(([id, from, dur]) => ({ id, from, dur }));
const defaultNarration = {
  s1: "Saturn is raining its rings away.",
  s2: "It orbits nearly ten times farther from the Sun than Earth.",
  s3: "Dark bands in its glow suggest ring rain: charged ice falling along magnetic field lines.",
  s4: "One estimate: an Olympic pool of water, every half hour.",
  s5: "By one model, under a hundred million years left. A 2024 simulation says they may be billions of years old.",
  s6: "A bare Saturn? Only a hypothetical.",
};

export const compositions = [
  { id: "RedSpaceSaturnShort", component: Short, durationInFrames: 850, fps: 30, width: 1080, height: 1920, defaultProps: { scenes: defaultScenes, narration: defaultNarration } },
];
