// Space long form (Red Space Facts). Built from Astrum (pZh5BWCNmmE: 3D planet renders with labelled diameters, real Voyager/HST image panels,
// cutaway interior, labelled moon-system diagram), The Space Race (orbital diagrams, Earth-analogue footage), SEA/Kurzgesagt (scale markers with an
// arrow and a label), ElderFox (real mission imagery untreated, place caption bottom-left, the authenticity stated) and History of the Universe.
// Channel rule (registry): every picture is labelled OBSERVATION (real image/data), VISUALISATION (model drawn from data), or ARTIST IMPRESSION.
import React, { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useDelayRender } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { F, Fonts, Finish, clamp, eio, eo, expo, lerp, ramp } from "./kit.jsx";

const src = (p) => (p.startsWith("data:") || p.startsWith("http") ? p : staticFile(p));
const KIND = { observation: ["OBSERVATION · REAL IMAGE", "#5CE1E6"], data: ["OBSERVATION · MEASURED DATA", "#5CE1E6"], visualisation: ["SCIENTIFIC VISUALISATION", "#FFC857"], model: ["MODEL · NOT TO SCALE", "#FFC857"], artist: ["ARTIST IMPRESSION", "#FF7A90"], hypothesis: ["HYPOTHESIS", "#FF7A90"] };

/** Provenance badge, top-left, on every space picture. */
export function Kind({ kind = "observation", credit, x = 56, y = 48 }) {
  const f = useCurrentFrame(), [label, col] = KIND[kind], a = ramp(f, 0, 10);
  return (<>
    <div style={{ position: "absolute", left: x, top: y, opacity: a, display: "flex", alignItems: "center", gap: 10, fontFamily: F.mono, fontWeight: 700, fontSize: 20, letterSpacing: "0.14em", color: col, background: "rgba(0,0,0,0.55)", border: `1.5px solid ${col}`, padding: "6px 12px" }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: col }} />{label}</div>
    {credit && <div style={{ position: "absolute", right: 30, bottom: 22, fontFamily: F.sans, fontSize: 17, color: "rgba(255,255,255,0.7)", textShadow: "0 1px 3px #000" }}>{credit}</div>}
  </>);
}
const Title = ({ t, text, sub, from = 0, x = 120, y = 120 }) => { const f = useCurrentFrame(), a = ramp(f, from, from + 16, expo); return (<div style={{ position: "absolute", left: x, top: y, opacity: a, transform: `translateY(${(1 - a) * 16}px)` }}><div style={{ fontFamily: F.grot, fontWeight: 700, fontSize: 64, letterSpacing: "0.04em", color: "#fff", textTransform: "uppercase" }}>{text}</div>{sub && <div style={{ fontFamily: F.sans, fontSize: 28, color: "rgba(230,240,255,0.75)", marginTop: 8 }}>{sub}</div>}</div>); };
const Space = ({ children, stars = true }) => <AbsoluteFill style={{ background: "radial-gradient(120% 90% at 60% 40%, #0b1426 0%, #04060c 70%)" }}><Fonts />{stars && <Img src={staticFile("lf2/red-space-facts/sss-2k_stars_milky_way.jpg")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 }} />}{children}</AbsoluteFill>;

function useTex(file) {
  const { delayRender, continueRender } = useDelayRender();
  const [h] = useState(() => delayRender(`tex ${file}`, { timeoutInMilliseconds: 60000 })), [tex, setTex] = useState(null);
  useEffect(() => { new THREE.TextureLoader().load(staticFile(file), (t) => { t.colorSpace = THREE.SRGBColorSpace; setTex(t); }, undefined, () => continueRender(h)); }, []);
  return [tex, () => continueRender(h)];
}
/** Inside the canvas: once the textured mesh exists, draw it explicitly, wait two animation frames, then release the frame. Without this the first
 * still of a render session was captured before the texture reached the GPU (tested: blank planet in the first shot only). */
function Settle({ ready, done }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => { if (!ready) return; gl.render(scene, camera); requestAnimationFrame(() => requestAnimationFrame(() => { gl.render(scene, camera); done(); })); }, [ready]);
  return null;
}
/** A planet as a real 3D sphere: texture, tilt (deg, about the view axis), spin, rings, sun direction, an axis line. */
function Body({ tex, r = 1, tilt = 0, spin = 0, pos = [0, 0, 0], rings, axis, emissive }) {
  const ringGeo = useMemo(() => rings ? new THREE.RingGeometry(rings[0], rings[1], 128) : null, [rings]);
  return (
    <group position={pos} rotation={[0, 0, (-tilt * Math.PI) / 180]}>
      <mesh rotation={[0, spin, 0]}><sphereGeometry args={[r, 96, 64]} />{emissive ? <meshBasicMaterial map={tex} /> : <meshStandardMaterial map={tex} roughness={0.95} metalness={0} />}</mesh>
      {ringGeo && <mesh geometry={ringGeo} rotation={[Math.PI / 2, 0, 0]}><meshBasicMaterial color="#c8d6e5" transparent opacity={0.45} side={THREE.DoubleSide} /></mesh>}
      {axis && <mesh><cylinderGeometry args={[0.012 * r, 0.012 * r, r * 2.9, 8]} /><meshBasicMaterial color={axis} /></mesh>}
    </group>
  );
}

/** 1. Planet in 3D, slowly turning, with optional labelled facts beside it (Astrum: diameter labels). */
export function Planet3D({ t, texture = "lf2/red-space-facts/sss-2k_uranus.jpg", tilt = 97.77, axis = "#ffffff", facts = [], kind = "visualisation", credit, camZ = 6.4, offsetX = 1.25, ringsOn = true, title, sub, sunX = -6 }) {
  const f = useCurrentFrame(), [tex, done] = useTex(texture);
  return (
    <Space>
      <ThreeCanvas width={1920} height={1080} camera={{ position: [0, 0, lerp(f, 0, 300, camZ + 0.6, camZ, eio)], fov: 32 }}>
        <ambientLight intensity={0.08} /><directionalLight position={[sunX, 1.5, 3]} intensity={2.6} />
        {tex && <Body tex={tex} r={1} tilt={tilt} spin={f * 0.004} pos={[offsetX, 0, 0]} rings={ringsOn ? [1.75, 1.83] : null} axis={axis} />}
        <Settle ready={!!tex} done={done} />
      </ThreeCanvas>
      {title && <Title t={t} text={title} sub={sub} />}
      {facts.map((x, i) => { const a = ramp(f, 20 + i * 12, 34 + i * 12, expo); return (
        <div key={i} style={{ position: "absolute", left: 120, top: (title ? 330 : 220) + i * 128, opacity: a, transform: `translateX(${(1 - a) * -30}px)` }}>
          <div style={{ fontFamily: F.mono, fontSize: 20, letterSpacing: "0.16em", color: t.accent, textTransform: "uppercase" }}>{x.label}</div>
          <div style={{ fontFamily: F.grot, fontWeight: 700, fontSize: 58, color: "#fff" }}>{x.value}</div>
          {x.note && <div style={{ fontFamily: F.sans, fontSize: 20, color: "rgba(230,240,255,0.6)" }}>{x.note}</div>}
        </div>); })}
      <Kind kind={kind} credit={credit || "Visualisation: texture Solar System Scope (CC BY 4.0); tilt and radius from the NASA fact sheet"} />
      <Finish grain={0.03} vignette={0.45} />
    </Space>
  );
}

/** 2. Axial tilt compared (Earth vs Uranus), drawn from the measured obliquities. The spin arrow shows which way each turns. */
export function Tilt({ t, bodies, credit }) {
  const f = useCurrentFrame();
  return (
    <Space stars={false}>
      <svg width="1920" height="1080" style={{ position: "absolute" }}>
        <line x1="120" x2="1800" y1="560" y2="560" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeDasharray="10 10" />
        <text x="1800" y="540" textAnchor="end" fontFamily={F.mono} fontSize="20" fill="rgba(255,255,255,0.5)">ORBITAL PLANE</text>
        {bodies.map((b, i) => { const cx = 520 + i * 880, r = b.r, a = ramp(f, 10 + i * 20, 40 + i * 20, expo), ang = (b.tilt * Math.PI) / 180 * a, dx = Math.sin(ang) * r * 1.65, dy = -Math.cos(ang) * r * 1.65;
          return (<g key={i}>
            <defs><radialGradient id={`g${i}`} cx="35%" cy="35%" r="70%"><stop offset="0%" stopColor={b.light} /><stop offset="100%" stopColor={b.dark} /></radialGradient></defs>
            <circle cx={cx} cy="560" r={r} fill={`url(#g${i})`} />
            <ellipse cx={cx} cy="560" rx={r} ry={r * 0.18} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" transform={`rotate(${b.tilt * a} ${cx} 560)`} />
            <line x1={cx - dx} y1={560 - dy} x2={cx + dx} y2={560 + dy} stroke="#fff" strokeWidth="4" />
            <line x1={cx} y1={560 - r * 1.65} x2={cx} y2={560 + r * 1.65} stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeDasharray="6 8" />
            <path d={`M ${cx} ${560 - r * 1.35} A ${r * 1.35} ${r * 1.35} 0 0 1 ${cx + Math.sin(ang) * r * 1.35} ${560 - Math.cos(ang) * r * 1.35}`} fill="none" stroke={t.accent} strokeWidth="4" />
            <text x={cx} y={560 + r + 120} textAnchor="middle" fontFamily={F.grot} fontWeight="700" fontSize="56" fill="#fff">{b.name}</text>
            <text x={cx} y={560 + r + 175} textAnchor="middle" fontFamily={F.mono} fontWeight="700" fontSize="44" fill={t.accent}>{(a > 0.97 ? b.tilt : b.tilt * a).toFixed(2)}°</text>
          </g>); })}
      </svg>
      <Kind kind="data" credit={credit || "Obliquity to orbit: NASA NSSDCA planetary fact sheets (Earth 23.44°, Uranus 97.77°). Sizes not to scale."} />
    </Space>
  );
}

/** 3. One orbit, four seasons: the planet keeps its axis fixed in space while it goes round the Sun, so each pole gets decades of sun then dark. */
export function Seasons({ t, years = 84, tilt = 97.77, labels = [], credit, highlight }) {
  const f = useCurrentFrame(), cx = 960, cy = 560, rx = 640, ry = 300, prog = lerp(f, 0, 240, 0, 1, eio);
  const pts = [0, 0.25, 0.5, 0.75].map((k) => ({ k, x: cx + rx * Math.cos(k * 2 * Math.PI), y: cy + ry * Math.sin(k * 2 * Math.PI) }));
  const cur = { x: cx + rx * Math.cos(prog * 2 * Math.PI), y: cy + ry * Math.sin(prog * 2 * Math.PI) };
  const ax = (Math.sin((tilt * Math.PI) / 180) * 60), ay = -(Math.cos((tilt * Math.PI) / 180) * 60);
  const planet = (x, y, key, big) => { const lit = Math.atan2(cy - y, cx - x), r = big ? 34 : 24; return (
    <g key={key}><circle cx={x} cy={y} r={r} fill="#16303a" /><path d={`M ${x + Math.cos(lit + Math.PI / 2) * r} ${y + Math.sin(lit + Math.PI / 2) * r} A ${r} ${r} 0 0 1 ${x + Math.cos(lit - Math.PI / 2) * r} ${y + Math.sin(lit - Math.PI / 2) * r} Z`} fill="#8fe3ea" />
      <line x1={x - ax} y1={y - ay} x2={x + ax} y2={y + ay} stroke="#fff" strokeWidth="3" /><circle cx={x + ax} cy={y + ay} r="5" fill={t.accent} /></g>); };
  return (
    <Space>
      <svg width="1920" height="1080" style={{ position: "absolute" }}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeDasharray="4 10" />
        <circle cx={cx} cy={cy} r="46" fill="#FFD27A" /><circle cx={cx} cy={cy} r="80" fill="#FFD27A" opacity="0.15" />
        {pts.map((p, i) => <g key={i} opacity={highlight == null || highlight === i ? 1 : 0.35}>{planet(p.x, p.y, i)}</g>)}
        {planet(cur.x, cur.y, "cur", true)}
        {labels.map((l, i) => { const p = pts[l.at]; return <g key={`l${i}`} opacity={ramp(f, 30 + i * 18, 44 + i * 18)}><rect x={p.x - 170} y={p.y + (p.y > cy ? 54 : -128)} width="340" height="74" fill="rgba(0,0,0,0.65)" stroke="rgba(255,255,255,0.3)" /><text x={p.x} y={p.y + (p.y > cy ? 84 : -98)} textAnchor="middle" fontFamily={F.grot} fontWeight="700" fontSize="24" fill="#fff">{l.title}</text><text x={p.x} y={p.y + (p.y > cy ? 112 : -70)} textAnchor="middle" fontFamily={F.sans} fontSize="19" fill="rgba(230,240,255,0.75)">{l.text}</text></g>; })}
        <text x={cx} y={cy + 110} textAnchor="middle" fontFamily={F.mono} fontSize="22" fill="#FFD27A">SUN</text>
        <text x="120" y="980" fontFamily={F.mono} fontSize="24" fill={t.accent}>{`YEAR ${Math.round(prog * years)} OF ${years}`}</text>
      </svg>
      <Kind kind="model" credit={credit || "Orbit period 84.0 Earth years and obliquity 97.77°: NASA fact sheet. Orbit drawn as an ellipse in perspective; sizes and distances not to scale."} />
    </Space>
  );
}

/** 4. Real image plate: the real image, a slow push, labelled callouts with leader lines (Astrum's labelled real images; ElderFox's place caption). */
export function ImagePlate({ t, image, kind = "observation", credit, caption, date, callouts = [], fit = "contain", pos = "50% 50%", dur = 240, bg = "#000" }) {
  const f = useCurrentFrame(), s = interpolate(f, [0, dur], [1.0, 1.06], clamp);
  return (
    <AbsoluteFill style={{ background: bg }}><Fonts />
      {fit === "contain" && <Img src={src(image)} style={{ position: "absolute", inset: -80, width: "calc(100% + 160px)", height: "calc(100% + 160px)", objectFit: "cover", filter: "blur(40px) brightness(0.3)" }} />}
      <Img src={src(image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit, objectPosition: pos, transform: `scale(${s})` }} />
      <svg width="1920" height="1080" style={{ position: "absolute" }}>{callouts.map((c, i) => { const a = ramp(f, 20 + i * 14, 34 + i * 14); return <g key={i} opacity={a}><circle cx={c.x} cy={c.y} r={c.r || 14} fill="none" stroke={t.accent} strokeWidth="3" /><line x1={c.x} y1={c.y} x2={c.tx} y2={c.ty} stroke={t.accent} strokeWidth="2" /><text x={c.tx + (c.tx > c.x ? 10 : -10)} y={c.ty + 8} textAnchor={c.tx > c.x ? "start" : "end"} fontFamily={F.grot} fontWeight="700" fontSize="26" fill="#fff" stroke="#000" strokeWidth="5" paintOrder="stroke">{c.text}</text></g>; })}</svg>
      {date && <div style={{ position: "absolute", right: 56, top: 50, fontFamily: F.mono, fontWeight: 700, fontSize: 26, letterSpacing: "0.12em", color: "#fff", background: "rgba(0,0,0,0.55)", padding: "6px 14px" }}>{date}</div>}
      {caption && <div style={{ position: "absolute", left: 56, bottom: 64, maxWidth: 1300, fontFamily: F.sans, fontStyle: "italic", fontSize: 28, color: "#fff", textShadow: "0 1px 6px #000, 0 0 2px #000" }}>{caption}</div>}
      <Kind kind={kind} credit={credit} />
    </AbsoluteFill>
  );
}

/** 5. Side-by-side real images with column titles (Astrum: Voyager vs Hubble/Webb panels). */
export function ImagePair({ t, left, right, title, credit }) {
  const f = useCurrentFrame();
  return (
    <Space stars={false}>
      {title && <Title t={t} text={title} y={70} x={110} />}
      {[left, right].map((p, i) => { const a = ramp(f, 8 + i * 14, 26 + i * 14, expo); return (
        <div key={i} style={{ position: "absolute", left: 110 + i * 870, top: 210, width: 830, opacity: a, transform: `translateY(${(1 - a) * 24}px)` }}>
          <div style={{ width: 830, height: 640, background: "#000", border: "1px solid rgba(255,255,255,0.2)", overflow: "hidden" }}><Img src={src(p.image)} style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
          <div style={{ fontFamily: F.grot, fontWeight: 700, fontSize: 32, color: "#fff", marginTop: 14 }}>{p.title}</div>
          <div style={{ fontFamily: F.sans, fontSize: 20, color: "rgba(230,240,255,0.65)", marginTop: 4 }}>{p.note}</div>
        </div>); })}
      <Kind kind="observation" credit={credit} />
    </Space>
  );
}

/** 6. Scale: bodies drawn at their true relative radii, with a marker + arrow on the small one (SEA/Kurzgesagt scale device). */
export function ScaleBodies({ t, bodies, title, credit, unitPx }) {
  const f = useCurrentFrame(), max = Math.max(...bodies.map((b) => b.radius_km)), k = unitPx || 380 / max; let x = 260;
  return (
    <Space>
      {title && <Title t={t} text={title} y={80} />}
      <svg width="1920" height="1080" style={{ position: "absolute" }}>
        {bodies.map((b, i) => { const r = b.radius_km * k, a = ramp(f, 10 + i * 16, 32 + i * 16, expo), cx = x + r; x += r * 2 + 120; const small = r < 30;
          return (<g key={i} opacity={a}>
            <defs><radialGradient id={`s${i}`} cx="35%" cy="35%" r="70%"><stop offset="0%" stopColor={b.light} /><stop offset="100%" stopColor={b.dark} /></radialGradient></defs>
            <circle cx={cx} cy={640 - r} r={r} fill={`url(#s${i})`} />
            {small && <><circle cx={cx} cy={640 - r} r={r + 14} fill="none" stroke={t.accent} strokeWidth="3" /><line x1={cx} y1={640 - r - 120} x2={cx} y2={640 - 2 * r - 26} stroke={t.accent} strokeWidth="4" /><path d={`M ${cx - 12} ${640 - 2 * r - 44} L ${cx} ${640 - 2 * r - 24} L ${cx + 12} ${640 - 2 * r - 44}`} fill="none" stroke={t.accent} strokeWidth="4" /></>}
            <text x={cx} y={small ? 640 - r - 140 : 700} textAnchor="middle" fontFamily={F.grot} fontWeight="700" fontSize="40" fill="#fff">{b.name.toUpperCase()}</text>
            <text x={cx} y={small ? 640 - r - 108 : 740} textAnchor="middle" fontFamily={F.mono} fontSize="22" fill="rgba(230,240,255,0.7)">{b.radius_km.toLocaleString("en")} km radius</text>
          </g>); })}
      </svg>
      <Kind kind="data" credit={credit || "Mean radii: NASA NSSDCA fact sheets. Drawn to scale with each other."} />
    </Space>
  );
}

/** 7. Discovery and exploration timeline with an image chip per event; status per event (observation / plan). */
export function SpaceTimeline({ t, title, events, active }) {
  const f = useCurrentFrame(), n = events.length, X = (i) => 140 + (i / (n - 1)) * 1640, head = lerp(f, 6, 60, X(0), X(active ?? n - 1), eio);
  return (
    <Space>
      {title && <Title t={t} text={title} y={70} />}
      <div style={{ position: "absolute", left: 140, top: 640, width: 1640, height: 3, background: "rgba(255,255,255,0.25)" }} /><div style={{ position: "absolute", left: 140, top: 638, width: head - 140, height: 7, background: t.accent }} />
      {events.map((e, i) => { const on = head >= X(i) - 2, hi = i === active; return (
        <div key={i} style={{ position: "absolute", left: X(i) - 120, top: e.up === false ? 680 : 250, width: 240, textAlign: "center", opacity: on ? 1 : 0.62 }}>
          {e.image && e.up !== false && <div style={{ width: 200, height: 200, margin: "0 auto 12px", border: `2px solid ${hi ? t.accent : "rgba(255,255,255,0.3)"}`, overflow: "hidden", background: "#000" }}><Img src={src(e.image)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}
          <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 30, color: e.plan ? "#FF7A90" : hi ? t.accent : "#fff" }}>{e.date}</div>
          <div style={{ fontFamily: F.sans, fontSize: 21, lineHeight: 1.3, color: "rgba(230,240,255,0.85)", marginTop: 6 }}>{e.text}</div>
          {e.plan && <div style={{ fontFamily: F.mono, fontSize: 16, color: "#FF7A90", marginTop: 4 }}>PROPOSED · NOT FUNDED</div>}
        </div>); })}
      {events.map((e, i) => <div key={`d${i}`} style={{ position: "absolute", left: X(i) - 11, top: 630, width: 22, height: 22, borderRadius: "50%", background: head >= X(i) - 2 ? (e.plan ? "#FF7A90" : t.accent) : "#223", border: "3px solid #fff" }} />)}
      <Kind kind="data" credit="Dates: NASA; Wikipedia (Uranus, Voyager 2, Moons of Uranus, Uranus Orbiter and Probe)" />
    </Space>
  );
}

/** 8. Fact-sheet comparison bars (measured values, two bodies). rows: [{ label, a, b, unit, log }] */
export function FactBars({ t, names, rows, title, credit }) {
  const f = useCurrentFrame();
  return (
    <Space stars={false}>
      {title && <Title t={t} text={title} y={70} />}
      <div style={{ position: "absolute", left: 600, top: 200, display: "flex", gap: 40, fontFamily: F.grot, fontWeight: 700, fontSize: 30 }}><span style={{ color: "#8fe3ea" }}>■ {names[0]}</span><span style={{ color: "#7aa2ff" }}>■ {names[1]}</span></div>
      {rows.map((r, i) => { const a = ramp(f, 12 + i * 10, 40 + i * 10, expo), mx = Math.max(r.a, r.b), y = 290 + i * 135; return (
        <div key={i}>
          <div style={{ position: "absolute", left: 110, top: y + 10, width: 460, textAlign: "right", fontFamily: F.sans, fontSize: 28, color: "#fff" }}>{r.label}</div>
          {[r.a, r.b].map((v, k) => <div key={k}><div style={{ position: "absolute", left: 600, top: y + k * 46, width: (v / mx) * 1000 * a, height: 36, background: k ? "#7aa2ff" : "#8fe3ea" }} /><div style={{ position: "absolute", left: 610 + (v / mx) * 1000 * a, top: y + k * 46 - 2, fontFamily: F.mono, fontWeight: 700, fontSize: 28, color: "#fff" }}>{v.toLocaleString("en")} {r.unit}</div></div>)}
        </div>); })}
      <Kind kind="data" credit={credit || "NASA NSSDCA Uranus fact sheet (Uranus/Earth comparison)"} />
    </Space>
  );
}

/** Thumbnail: real image or 3D planet full bleed, 2-3 word wide-tracked title (Astrum), optional scale marker or red arrow (ElderFox). */
export function SpaceThumb({ t, image, big, small, marker, arrow, kind }) {
  return (
    <AbsoluteFill style={{ background: "#000" }}><Fonts />
      {image ? <Img src={src(image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 50%" }} /> : null}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.6) 100%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 60, textAlign: "center", fontFamily: F.grot, fontWeight: 700, fontSize: 150, letterSpacing: "0.18em", color: "#fff", textShadow: "0 6px 30px rgba(0,0,0,0.8)", whiteSpace: "pre-line", lineHeight: 1.0 }}>{big}</div>
      {small && <div style={{ position: "absolute", left: 0, right: 0, bottom: 70, textAlign: "center" }}><span style={{ fontFamily: F.grot, fontWeight: 700, fontSize: 76, color: "#000", background: t.accent, padding: "4px 28px" }}>{small}</span></div>}
      {marker && <svg width="1920" height="1080" style={{ position: "absolute" }}><circle cx={marker.x} cy={marker.y} r={marker.r} fill="none" stroke={t.accent} strokeWidth="10" /><text x={marker.x + marker.r + 24} y={marker.y + 16} fontFamily={F.grot} fontWeight="700" fontSize="54" fill="#fff" stroke="#000" strokeWidth="8" paintOrder="stroke">{marker.text}</text></svg>}
      {arrow && <svg width="1920" height="1080" style={{ position: "absolute" }}><defs><marker id="sa" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5 Z" fill="#F2222A" /></marker></defs><path d={arrow} stroke="#F2222A" strokeWidth="22" fill="none" strokeLinecap="round" markerEnd="url(#sa)" /></svg>}
      {kind && <Kind kind={kind} x={40} y={1000} />}
    </AbsoluteFill>
  );
}

export const SPACE = { planet: Planet3D, tilt: Tilt, seasons: Seasons, image: ImagePlate, pair: ImagePair, scale: ScaleBodies, timeline: SpaceTimeline, facts: FactBars, thumb: SpaceThumb };
