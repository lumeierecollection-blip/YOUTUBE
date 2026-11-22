// Pilot C kit, rebuilt 20 Nov 2026 in REAL 3D from measured reference frames (faceless-breakout-experiment/research/jeremy-bearimy/full-sheet.jpg).
// Measured grammar: pale lavender-white sphere heads on a thin neck, small bodies in soft clothes (hoodies, caps, hair), stick limbs with round white hands
// and feet; low-key purple/magenta ambient light with warm accents; bloom and depth of field; extreme close-ups and crowds; serif small-caps UI labels,
// glowing pink laser lines linking people, a heart counter. Ours: our own characters, sets and story, rendered with @remotion/three + postprocessing.
// Limits, stated: primitive-built characters (spheres, capsules, cylinders), procedural animation only, no rigged meshes or lip sync.
import React, { useMemo, useRef } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, DepthOfField, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { PostFxReadyGate } from "../../effects/PostFxReadyGate.jsx";
import { F, Fonts, clamp, eio, expo, ramp } from "./kit.jsx";

const SKIN = "#E9E3F3", SERIF = '"Cormorant Garamond", "Noto Serif", Georgia, serif';
const grey = (hex, k) => { const c = new THREE.Color(hex), g = c.r * 0.3 + c.g * 0.59 + c.b * 0.11; return new THREE.Color(c.r + (g - c.r) * k, c.g + (g - c.g) * k, c.b + (g - c.b) * k * 0.6 + 0.04 * k); };
const Mat = ({ color, frozen = 0, rough = 0.62, emissive, ei = 0 }) => <meshStandardMaterial color={frozen ? grey(color, 0.75) : color} roughness={rough} metalness={0} emissive={emissive || "#000"} emissiveIntensity={ei} />;

function Limb({ from, to, r = 0.045, color, frozen }) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return <mesh position={mid} quaternion={q}><cylinderGeometry args={[r, r, len, 12]} /><Mat color={color} frozen={frozen} /></mesh>;
}
// [shoulder, elbow, hand] per side (x mirrored for the left arm); measured proportions: slim hoodie torso, long white neck, thin limbs (side-by-side v1, 20 Nov)
const ARM = { down: [[0.25, 1.42, 0], [0.31, 1.1, 0.02], [0.33, 0.8, 0.06]], up: [[0.25, 1.42, 0], [0.36, 1.75, 0], [0.4, 2.12, 0.05]], wave: [[0.25, 1.42, 0], [0.52, 1.55, 0.05], [0.6, 1.95, 0.1]], cross: [[0.25, 1.42, 0], [0.22, 1.12, 0.22], [-0.06, 1.22, 0.3]], point: [[0.25, 1.42, 0], [0.56, 1.42, 0.15], [0.86, 1.45, 0.3]], pocket: [[0.25, 1.42, 0], [0.29, 1.15, 0.1], [0.1, 1.0, 0.24]] };

/** A Pip: feet at (x, 0, z). c = theme cast entry { top, hair, hairColor }. */
function Pip({ x = 0, z = 0, turn = 0, c = {}, mood = "neutral", look = 0, arm = "down", armL = "down", frozen = false, walk, hop = 0, f, s = 1 }) {
  let X = x, step = 0; if (walk) { const k = ramp(f, walk.from, walk.from + walk.dur, eio); X = x + (walk.to - x) * k; if (k > 0 && k < 1) step = Math.sin(f * 0.45); }
  const fr = frozen ? 1 : 0, bob = frozen ? 0 : Math.sin(f / 16) * 0.015, jump = !frozen && hop ? Math.abs(Math.sin(f / 7)) * hop : 0;
  const wave = arm === "wave" && !frozen ? Math.sin(f / 5) * 0.12 : 0;
  const top = c.top || "#5DA9FF", R = ARM[arm] || ARM.down, L = ARM[armL] || ARM.down;
  const eye = (sx) => mood === "happy" ? <mesh position={[sx * 0.17, 0.05, 0.5]} rotation={[0, 0, Math.PI]}><torusGeometry args={[0.06, 0.018, 8, 16, Math.PI]} /><Mat color="#1B1626" /></mesh>
    : <mesh position={[sx * 0.17, 0.04, 0.51]} scale={[1, mood === "shock" ? 1.5 : mood === "smug" ? 0.45 : 1.15, 0.5]}><sphereGeometry args={[0.055, 16, 12]} /><Mat color="#1B1626" rough={0.3} /></mesh>;
  return <group position={[X, jump, z]} rotation={[0, turn, 0]} scale={s}>
    <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.42, 24]} /><meshBasicMaterial color="#000" transparent opacity={0.28} depthWrite={false} /></mesh>   {/* contact shadow */}
    {/* legs: thin white sticks, trousers on the thigh, round feet */}
    {[-1, 1].map((sd) => { const sw = sd * step * 0.18; return <group key={sd}><Limb from={[sd * 0.11, 0.86, 0]} to={[sd * 0.12, 0.07, sw]} r={0.045} color={SKIN} frozen={fr} /><Limb from={[sd * 0.11, 0.9, 0]} to={[sd * 0.115, 0.6, sw * 0.4]} r={0.075} color={c.pants || "#3A3550"} frozen={fr} /><mesh position={[sd * 0.12, 0.06, sw + 0.06]} scale={[1, 0.6, 1.35]}><sphereGeometry args={[0.085, 16, 12]} /><Mat color={SKIN} frozen={fr} /></mesh></group>; })}
    {/* slim hoodie torso, hood behind the neck */}
    <mesh position={[0, 1.17 + bob, 0]} scale={[1.18, 1, 0.82]}><capsuleGeometry args={[0.23, 0.36, 8, 20]} /><Mat color={top} frozen={fr} rough={0.85} /></mesh>
    <mesh position={[0, 1.5 + bob, -0.1]} rotation={[0.35, 0, 0]}><torusGeometry args={[0.15, 0.065, 10, 24]} /><Mat color={top} frozen={fr} rough={0.85} /></mesh>
    {/* arms: sleeve on the upper arm, white forearm, round hand */}
    {[[1, R], [-1, L]].map(([sd, A]) => { const P3 = A.map((q, j) => [sd * q[0], q[1] + bob + (sd > 0 && j === 2 ? wave : 0), q[2]]); return <group key={sd}><Limb from={P3[0]} to={P3[1]} r={0.07} color={top} frozen={fr} /><Limb from={P3[1]} to={P3[2]} r={0.042} color={SKIN} frozen={fr} /><mesh position={P3[2]}><sphereGeometry args={[0.075, 16, 12]} /><Mat color={SKIN} frozen={fr} /></mesh></group>; })}
    {/* neck and head */}
    <Limb from={[0, 1.45 + bob, 0]} to={[0, 1.75 + bob, 0]} r={0.045} color={SKIN} frozen={fr} />
    <group position={[0, 2.15 + bob, 0]} rotation={[0, look * 0.35, 0]}>
      <mesh><sphereGeometry args={[0.52, 48, 32]} /><Mat color={SKIN} frozen={fr} rough={0.5} /></mesh>
      {eye(-1)}{eye(1)}
      {(mood === "happy" || mood === "smug") && [-1, 1].map((sx) => <mesh key={sx} position={[sx * 0.27, -0.08, 0.44]} scale={[1, 0.6, 0.3]}><sphereGeometry args={[0.06, 12, 8]} /><meshStandardMaterial color="#F4A3C0" transparent opacity={0.7} /></mesh>)}
      {mood === "shock" ? <mesh position={[0, -0.16, 0.5]} scale={[1, 1.3, 0.4]}><sphereGeometry args={[0.05, 12, 8]} /><Mat color="#1B1626" /></mesh>
        : <mesh position={[0, -0.12, 0.49]} rotation={[0, 0, mood === "sad" ? 0 : Math.PI]}><torusGeometry args={[0.07, 0.014, 8, 16, Math.PI]} /><Mat color="#1B1626" /></mesh>}
      {c.hair === "cap" && <group><mesh position={[0, 0.12, 0]} scale={[1.02, 0.8, 1.02]}><sphereGeometry args={[0.53, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><Mat color={c.hairColor || "#3E7A4E"} frozen={fr} /></mesh><mesh position={[0, 0.2, 0.45]} rotation={[0.25, 0, 0]} scale={[1, 0.12, 0.9]}><cylinderGeometry args={[0.3, 0.3, 0.2, 24]} /><Mat color={c.hairColor || "#3E7A4E"} frozen={fr} /></mesh></group>}
      {c.hair === "long" && <group><mesh position={[0, 0.16, -0.04]} scale={[1.08, 0.9, 1.06]}><sphereGeometry args={[0.53, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.6]} /><Mat color={c.hairColor || "#E6B655"} frozen={fr} /></mesh><mesh position={[0, -0.3, -0.18]} scale={[1.15, 1.1, 0.7]}><capsuleGeometry args={[0.42, 0.35, 8, 16]} /><Mat color={c.hairColor || "#E6B655"} frozen={fr} /></mesh></group>}
      {c.hair === "short" && <mesh position={[0, 0.1, -0.02]} scale={[1.04, 0.85, 1.04]}><sphereGeometry args={[0.53, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.4]} /><Mat color={c.hairColor || "#6B4A35"} frozen={fr} /></mesh>}
    </group>
  </group>;
}

function SetGeo({ kind, P }) {
  const wall = P.wall, floor = P.floor;
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[40, 30]} /><meshStandardMaterial color={floor} roughness={0.45} /></mesh>
    <mesh position={[0, 6, -6]}><planeGeometry args={[40, 12]} /><meshStandardMaterial color={wall} roughness={0.9} /></mesh>
    {kind === "gym" && <group>
      {[...Array(9)].map((_, i) => <mesh key={i} position={[-8 + i * 2, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.03, 30]} /><meshStandardMaterial color="#C9986A" /></mesh>)}
      <mesh position={[0, 0.008, -1]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.7, 1.78, 48]} /><meshStandardMaterial color="#F3E6D8" /></mesh>
      <mesh position={[5, 3.4, -5.8]}><boxGeometry args={[1.8, 1.1, 0.06]} /><meshStandardMaterial color="#F2EEF6" /></mesh><mesh position={[5, 2.75, -5.4]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.32, 0.03, 8, 24]} /><meshStandardMaterial color="#FF7A3D" emissive="#FF7A3D" emissiveIntensity={0.3} /></mesh>
      {[0, 1, 2, 3].map((r) => <mesh key={r} position={[-3, 0.3 + r * 0.55, -4.4 - r * 0.55]}><boxGeometry args={[14, 0.12, 0.55]} /><meshStandardMaterial color="#6B5590" /></mesh>)}
      {[...Array(24)].map((_, i) => <Pip key={`bl${i}`} x={-9 + (i % 12) * 1.2 + (Math.floor(i / 12) % 2) * 0.6} z={-4.4 - (1 + Math.floor(i / 12)) * 0.55 - 0.2} s={0.55} c={{ top: ["#E46FA0", "#4F8FE0", "#F2C94C", "#3E9A5A", "#9B7BE0", "#E8743B"][i % 6], hair: ["none", "short", "long", "cap"][i % 4] }} mood={["happy", "neutral", "smug"][i % 3]} f={0} />)}
    </group>}
    {kind === "classroom" && <group>
      <mesh position={[-1, 2.7, -5.9]}><boxGeometry args={[4.2, 2, 0.05]} /><meshStandardMaterial color="#284A3E" /></mesh>
      {[-4.2, -2.6].map((x, i) => <mesh key={i} position={[x, 3.4, -5.92]}><planeGeometry args={[0.9, 1.2]} /><meshStandardMaterial color={["#F2C94C", "#7FB3E0"][i]} /></mesh>)}
      {[-3, -1, 1, 3].map((x) => [-1.6, -3.2].map((zz) => <group key={`${x}${zz}`} position={[x, 0, zz]}><mesh position={[0, 0.74, 0]}><boxGeometry args={[1.1, 0.06, 0.7]} /><meshStandardMaterial color="#E1A866" /></mesh>{[[-0.48, -0.3], [0.48, -0.3], [-0.48, 0.3], [0.48, 0.3]].map(([a, b], j) => <mesh key={j} position={[a, 0.37, b]}><boxGeometry args={[0.04, 0.74, 0.04]} /><meshStandardMaterial color="#5A5A6A" /></mesh>)}<mesh position={[0, 0.45, 0.62]}><boxGeometry args={[0.5, 0.05, 0.45]} /><meshStandardMaterial color="#7C8AA8" /></mesh><mesh position={[0, 0.75, 0.85]}><boxGeometry args={[0.5, 0.5, 0.05]} /><meshStandardMaterial color="#7C8AA8" /></mesh></group>))}
      <mesh position={[4.5, 3, -5.9]}><planeGeometry args={[2.6, 2]} /><meshStandardMaterial color="#FFB46B" emissive="#FF9E5A" emissiveIntensity={1.4} /></mesh>
    </group>}
    {kind === "bedroom" && <group>
      <mesh position={[-3, 0.35, -4.2]}><boxGeometry args={[3.2, 0.7, 2]} /><meshStandardMaterial color="#E9E4F2" /></mesh><mesh position={[-3, 0.75, -4]}><boxGeometry args={[3.1, 0.12, 1.7]} /><meshStandardMaterial color="#6F86D6" /></mesh><mesh position={[-4.2, 0.85, -4.6]}><boxGeometry args={[0.7, 0.18, 0.5]} /><meshStandardMaterial color="#FFFFFF" /></mesh>
      <mesh position={[-0.8, 0.4, -4.6]}><boxGeometry args={[0.7, 0.8, 0.6]} /><meshStandardMaterial color="#CDB8E6" /></mesh><mesh position={[-0.8, 0.9, -4.5]}><boxGeometry args={[0.35, 0.2, 0.15]} /><meshStandardMaterial color="#1B1626" emissive="#FF3B5C" emissiveIntensity={0.6} /></mesh>
      <mesh position={[3.6, 3, -5.9]}><planeGeometry args={[2.2, 1.8]} /><meshStandardMaterial color="#1C2346" emissive="#3A4A9A" emissiveIntensity={0.9} /></mesh>
      <mesh position={[1.4, 3.2, -5.92]}><planeGeometry args={[1, 1.4]} /><meshStandardMaterial color="#F28CB4" /></mesh>
      <mesh position={[1.2, 1.6, -5.2]}><sphereGeometry args={[0.22, 16, 12]} /><meshStandardMaterial color="#FFD9A0" emissive="#FFC070" emissiveIntensity={3} /></mesh>
    </group>}
    {kind === "street" && <group>
      {[-9, -5.5, -2, 1.5, 5, 8.5].map((x, i) => <group key={i}><mesh position={[x, 2.5 + (i % 3) * 0.6, -7]}><boxGeometry args={[3, 5 + (i % 3) * 1.2, 2]} /><meshStandardMaterial color="#2A2F4A" /></mesh>
        {[...Array(8)].map((_, w) => <mesh key={w} position={[x - 0.9 + (w % 3) * 0.9, 1.4 + Math.floor(w / 3) * 1.2, -5.98]}><planeGeometry args={[0.45, 0.55]} /><meshStandardMaterial color="#FFD9A0" emissive="#FFB86B" emissiveIntensity={(w * 7 + i) % 3 ? 1.6 : 0.1} /></mesh>)}</group>)}
      <mesh position={[-3, 2.4, -2]}><cylinderGeometry args={[0.05, 0.05, 4.8, 8]} /><meshStandardMaterial color="#222" /></mesh><mesh position={[-3, 4.8, -2]}><sphereGeometry args={[0.18, 16, 12]} /><meshStandardMaterial color="#FFE2A0" emissive="#FFD080" emissiveIntensity={4} /></mesh>
    </group>}
  </group>;
}

function Link({ a, b, k, col }) {
  const A = new THREE.Vector3(...a), B = A.clone().lerp(new THREE.Vector3(...b), k), mid = A.clone().add(B).multiplyScalar(0.5), len = Math.max(0.001, A.distanceTo(B));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return <mesh position={mid} quaternion={q}><cylinderGeometry args={[0.025, 0.025, len, 8]} /><meshStandardMaterial color={col} emissive={col} emissiveIntensity={4} toneMapped={false} /></mesh>;
}
const xOf = (m, f) => (m.walk ? m.x + (m.walk.to - m.x) * ramp(f, m.walk.from, m.walk.from + m.walk.dur, eio) : m.x);

/** C scene in 3D. cast: [{ id, x (world units, -4..4), z, turn, mood, look, arm, armL, frozen, walk:{from,dur,to}, hop, s }], crowd: n background extras,
 *  shot: close | medium | wide, focus: cast index; objs: [{ kind: ball|phone|paper, at:[x,y,z], to?:{at,from,dur,arc} }]; links: [[i,j,from]]; paused; ui; caption. */
export function FxToon3D({ t, set = "gym", cast = [], crowd = 0, shot, focus = 0, angle = "front", objs = [], links = [], paused, ui = [], caption, label }) {
  const f = useCurrentFrame(), { durationInFrames: D } = useVideoConfig(), P = t.fx.sets3d[set] || t.fx.sets3d.gym, composerRef = useRef(null);
  const S = shot || (cast.length <= 1 ? "close" : cast.length === 2 ? "medium" : "wide"), tgt = cast[Math.min(focus, cast.length - 1)];
  const cx = S === "close" && tgt ? xOf(tgt, f) : cast.length ? cast.reduce((a, m) => a + xOf(m, f), 0) / cast.length : 0;
  const k = interpolate(f, [0, D], [0, 1], clamp), dist = { close: 2.7, medium: 5.4, wide: 9.5 }[S] - k * 0.35, camY = { close: 2.15, medium: 1.9, wide: 2.6 }[S];   // angle: front | high | side | low (measured: high three-quarter, side and low views)
  const focusZ = tgt ? (tgt.z || 0) : 0;
  const extras = useMemo(() => [...Array(crowd)].map((_, i) => ({ x: -7 + ((i * 2.3) % 14), z: -2.5 - (i % 3) * 1.1, turn: ((i * 37) % 60 - 30) * Math.PI / 180, c: Object.values(t.fx.cast)[i % Object.values(t.fx.cast).length], mood: ["neutral", "happy", "smug"][i % 3] })), [crowd]);
  const headOf = (m) => [xOf(m, f), 2.15 * (m.s || 1), m.z || 0];
  const pz = !!paused && f >= (paused.from || 0) && (!paused.to || f < paused.to);
  return <AbsoluteFill style={{ background: P.bg }}>
    <Fonts />
    <ThreeCanvas width={1920} height={1080} camera={{ position: { front: [cx + 0.15, camY, focusZ + dist], high: [cx + dist * 0.45, camY + dist * 0.55, focusZ + dist * 0.85], side: [cx + dist * 0.7, camY + 0.2, focusZ + dist * 0.72], low: [cx - dist * 0.25, 0.7, focusZ + dist * 0.95] }[angle] || [cx, camY, focusZ + dist], fov: 34 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <CamAim x={cx} y={S === "close" ? 2.05 : 1.35} z={focusZ} />
      <color attach="background" args={[P.bg]} /><fog attach="fog" args={[P.bg, 9, 22]} />
      <hemisphereLight args={[P.sky, P.ground, 1.35]} /><ambientLight intensity={0.35} color={P.ambient} />
      <directionalLight position={[-4, 7, 5]} intensity={2.1} color={P.key} /><pointLight position={[4, 3, 1]} intensity={14} distance={12} color={P.accent} />
      <SetGeo kind={set} P={P} />
      {extras.map((m, i) => <Pip key={`x${i}`} {...m} f={f} frozen={pz} />)}
      {cast.map((m, i) => <Pip key={i} {...m} c={t.fx.cast[m.id] || {}} f={f} frozen={m.frozen || pz && m.id !== "you" && !m.moves} />)}
      {objs.map((o, i) => { const kk = o.to ? ramp(f, o.to.from, o.to.from + o.to.dur, eio) : 0, A = o.at, B = o.to ? o.to.at : A, p = A.map((v, j) => v + (B[j] - v) * kk); p[1] += (o.to?.arc || 0) * Math.sin(Math.PI * kk);
        return <mesh key={`o${i}`} position={p} rotation={[kk * 6, kk * 3, 0]}>{o.kind === "ball" ? <sphereGeometry args={[0.2, 24, 16]} /> : o.kind === "phone" ? <boxGeometry args={[0.18, 0.34, 0.03]} /> : <boxGeometry args={[0.42, 0.56, 0.01]} />}<meshStandardMaterial color={o.kind === "ball" ? "#E8743B" : o.kind === "phone" ? "#16131F" : "#F6F1E7"} emissive={o.kind === "phone" ? "#5A8CFF" : "#000"} emissiveIntensity={o.kind === "phone" ? 0.6 : 0} /></mesh>; })}
      {links.map(([i, j, from = 0], n) => cast[i] && cast[j] ? <Link key={`l${n}`} a={headOf(cast[i])} b={headOf(cast[j])} k={ramp(f, from, from + 20, eio)} col={t.fx.laser} /> : null)}
      <EffectComposer ref={composerRef} multisampling={4}>
        <DepthOfField target={[cx, S === "close" ? 2.15 : 1.5, focusZ]} focalLength={S === "close" ? 0.012 : S === "medium" ? 0.02 : 0.05} bokehScale={S === "close" ? 5 : S === "medium" ? 2 : 0.6} />   {/* focus on the subject head: the background melts, the face stays sharp */}
        <Bloom intensity={0.9} luminanceThreshold={0.6} luminanceSmoothing={0.3} mipmapBlur />
        <Vignette eskil={false} offset={0.25} darkness={0.75} />
      </EffectComposer>
      <PostFxReadyGate composerRef={composerRef} label="FxToon3D" />
    </ThreeCanvas>
    {pz && <AbsoluteFill style={{ background: "rgba(120,150,255,0.10)", boxShadow: `inset 0 0 220px rgba(120,160,255,0.45)`, pointerEvents: "none" }}><div style={{ position: "absolute", left: 60, bottom: 50, fontFamily: SERIF, fontWeight: 700, fontSize: 36, letterSpacing: "0.3em", color: "#DCD6FF" }}>❚❚ PAUSED</div></AbsoluteFill>}
    {ui.map((u, i) => <Ui3 key={i} u={u} t={t} f={f} />)}
    {label && <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center", fontFamily: SERIF, fontWeight: 700, fontSize: 40, letterSpacing: "0.22em", color: "#EDE6FF", textTransform: "uppercase", opacity: ramp(f, 6, 20) }}>{label}</div>}
    {caption && <div style={{ position: "absolute", left: 0, right: 0, bottom: 60, textAlign: "center", fontFamily: SERIF, fontWeight: 700, fontSize: 64, letterSpacing: "0.1em", color: t.fx.laserText, textShadow: `0 0 26px ${t.fx.laser}`, textTransform: "uppercase" }}>{caption}</div>}
  </AbsoluteFill>;
}
function CamAim({ x, y, z }) { const { camera } = useThree(); camera.lookAt(x, y, z); camera.updateMatrixWorld(); return null; }

// UI in the reference's style: serif small caps, dark rounded buttons with a gold outline, a heart counter top-left, a ring timer
function Ui3({ u, t, f }) {
  const a = ramp(f, u.from || 0, (u.from || 0) + 12, expo), gold = "#D9B25F";
  const box = { position: "absolute", left: u.x, top: u.y, opacity: a, transform: `translateY(${(1 - a) * 14}px)`, fontFamily: SERIF, color: "#F3EEFF" };
  if (u.kind === "counter") { const v = Math.round(interpolate(f, [u.from || 0, (u.from || 0) + (u.dur || 40)], [u.start || 0, u.value], { ...clamp, easing: eio })); return <div style={{ ...box, display: "flex", alignItems: "center", gap: 12, background: "rgba(20,14,34,0.72)", border: `2px solid ${gold}`, borderRadius: 14, padding: "8px 20px" }}><span style={{ color: "#FF6F91", fontSize: 34 }}>♥</span><span style={{ fontSize: 40, fontWeight: 700 }}>{u.prefix || ""}{v.toLocaleString("en-US")}{u.suffix || ""}</span>{u.label && <span style={{ fontSize: 22, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.85 }}>{u.label}</span>}</div>; }
  if (u.kind === "timer") { const kk = interpolate(f, [u.from || 0, (u.from || 0) + (u.dur || 150)], [1, 0], clamp); return <svg style={{ ...box, width: 170, height: 170 }} viewBox="0 0 170 170"><circle cx={85} cy={85} r={70} fill="rgba(20,14,34,0.72)" stroke="rgba(255,255,255,0.15)" strokeWidth={10} /><circle cx={85} cy={85} r={70} fill="none" stroke={gold} strokeWidth={10} strokeDasharray={`${440 * kk} 440`} transform="rotate(-90 85 85)" strokeLinecap="round" /><text x={85} y={98} textAnchor="middle" fontSize={40} fontWeight={700} fill="#fff" fontFamily={SERIF}>{Math.ceil(kk * (u.seconds || 60))}s</text></svg>; }
  if (u.kind === "bar") { const kk = ramp(f, u.from || 0, (u.from || 0) + (u.dur || 40), eio) * u.value; return <div style={{ ...box, width: u.w || 480 }}><div style={{ fontSize: 24, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 8 }}>{u.label}</div><div style={{ height: 22, borderRadius: 11, background: "rgba(255,255,255,0.15)", border: `2px solid ${gold}`, overflow: "hidden" }}><div style={{ width: `${kk * 100}%`, height: "100%", background: "linear-gradient(90deg,#FF6F91,#FFC46B)" }} /></div></div>; }
  return <div style={{ ...box, background: "rgba(20,14,34,0.78)", border: `2px solid ${gold}`, borderRadius: 10, padding: "10px 24px", fontSize: 26, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" }}>{u.label}</div>;   // chip / button
}
