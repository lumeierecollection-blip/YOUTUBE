/**
 * CanvasVideo — full-canvas editorial motion graphics (owner's rebuild,
 * 2026-09-29). There is no paper and no card: every beat is composed for
 * the whole 1080x1920 frame on the off-white studio ground.
 *
 *   TYPE-FULL     the statement, or one number with a small label
 *   DATA-FULL     bars / donut / line / gauge / map filling the canvas
 *   SCENE-FULL    a real photo edge to edge (objectFit cover), type over it;
 *                 or an isolated object cutout, large, on the studio
 *   PROCESS-FULL  2-3 nodes, thick arrows drawing between them
 *
 * Motion, three tiers (beat.canvas.motion_tier):
 *   micro   ALWAYS: studio shadows drift, grain re-seeds every frame, type
 *           breathes 0.5%, numbers keep a small oscillation AFTER they land
 *           (their position, never their value: a displayed figure is always
 *           the sourced one)
 *   medium  once per beat: bars grow, type lands, photo pushes in, arrows
 *           draw, the donut sweeps, nodes connect. A "micro" beat builds with
 *           a plain fade instead.
 *   major   2-3 per video (the planner marks them; the planner code caps
 *           them): full-canvas zoom 1.0 -> 1.15 with the words flying in from
 *           scattered positions (TYPE-FULL), the photo expanding from a small
 *           circle to the whole frame (SCENE-FULL), or the composition
 *           rotating in 180 degrees across the boundary (DATA / PROCESS).
 *
 * Camera through information (beat.canvas.camera_focus): each focus event
 * {at_percent, target} moves the camera over 0.7 s to frame that element
 * (canvas-layout.js focusBox). No focus events: one slow push across the
 * beat.
 *
 * Continuity: a beat with persists_from / match_cut_prev keeps the previous
 * beat's hero element across the 0.5 s boundary — match cut: the new hero
 * starts exactly where the old one was and settles into its own place while
 * the rest of the frame changes; persisted: the old hero also stays visible,
 * moving and scaling into the new hero's box as it fades (a FLIP morph).
 * Where this stops: the morph moves and scales the element's box; it does
 * not re-draw one chart type's geometry as another (bars are not bent into
 * a donut ring, they cross-fade into it while moving).
 */
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { StudioBG } from "./studio-bg.jsx";
import { parseQuantity, rollQuantity } from "./primitives/quantity.js";
import { PaperMap } from "./primitives/map.jsx";
import {
  FRAME, CAPTION, INK, INK_SOFT, MID, LIGHT, STUDIO, SANS, SERIF, TRANSITION_SEC,
  canvasLayout, focusBox, textWidth,
} from "./canvas-layout.js";

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const Hero = React.createContext(null);

// ── motion helpers ────────────────────────────────────────────────────
function useMotion(c, local, dur, fps) {
  const tier = c.motion_tier || "medium";
  const s = (sec) => sec * fps;
  const build = (share = 0.4, delay = 0) => (tier === "micro" ? easeOut(clamp01((local - delay) / s(0.35))) : easeOut(clamp01((local - delay) / Math.max(1, dur * share))));
  const breathe = 1 + 0.005 * Math.sin((local / fps) * 2.1);
  const jitter = (k = 0) => Math.sin(local / fps * 7.3 + k) * 1.2;
  return { tier, s, build, breathe, jitter };
}

// ── TYPE-FULL ─────────────────────────────────────────────────────────
function TypeFull({ c, L, local, dur, fps, accent, part = "body" }) {
  const m = useMotion(c, local, dur, fps);
  const B = L.boxes;
  const major = m.tier === "major";
  if (B.number) {
    const q = parseQuantity(c.data?.value);
    const t = m.build(0.4, m.s(0.25));
    const shown = q ? rollQuantity(q, t).replace(/\s*(thousand|million|billion|trillion)$/i, "").replace(/(\d)\s+([kKmMbB])$/, "$1$2") : B.number.text;
    // The closing rule is pinned with the header: a major 1.15 zoom carried
    // it into the caption band (run 36500636962 ch-2).
    if (part === "header") return (
      <>
        {B.headline ? <Lines b={B.headline} color={INK} weight={800} upper local={local} fps={fps} m={m} stagger /> : null}
        <Rule b={B.rule} t={m.build(0.3, m.s(0.6))} />
      </>
    );
    return (
      <>
        <HeroEl name="number" b={B.number}>
          <div style={{ position: "absolute", left: B.number.x, top: B.number.y, width: B.number.w, textAlign: "center", whiteSpace: "nowrap",
            font: `800 ${B.number.size}px ${SANS}, sans-serif`, lineHeight: 0.95, letterSpacing: -B.number.size * 0.04, color: accent,
            fontVariantNumeric: "tabular-nums", opacity: clamp01(local / m.s(0.2)),
            transform: `translateY(${(t >= 1 ? m.jitter() : (1 - t) * 60).toFixed(2)}px) scale(${(m.breathe * (major ? lerp(0.6, 1, t) : 1)).toFixed(4)})` }}>{shown}</div>
        </HeroEl>
        {B.label ? <Lines b={B.label} color={INK} weight={500} local={local - m.s(0.5)} fps={fps} m={m} /> : null}
      </>
    );
  }
  const st = B.statement;
  const words = st.lines.map((l) => l.split(" "));
  let wi = 0;
  const emph = String(c.emphasis_word || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (part === "header") return (
    <>
      {B.kicker ? <div style={{ position: "absolute", left: B.kicker.x + B.kicker.w * 0.03, top: B.kicker.y, width: B.kicker.w, font: `italic 600 ${B.kicker.size}px ${SERIF}`, color: INK, opacity: m.build(0.2) }}>{B.kicker.lines[0]}</div> : null}
      <Rule b={B.rule} t={m.build(0.3, m.s(0.5))} />
    </>
  );
  return (
    <>
      <HeroEl name="statement" b={st}>
        <div style={{ position: "absolute", left: st.x, top: st.y, width: st.w, font: `800 ${st.size}px ${SANS}, sans-serif`, lineHeight: 0.98,
          letterSpacing: -st.size * 0.035, textTransform: st.upper ? "uppercase" : "none", transform: `scale(${m.breathe.toFixed(4)})`, transformOrigin: "left center" }}>
          {words.map((line, li) => (
            <div key={li} style={{ whiteSpace: "nowrap" }}>
              {line.map((w, k) => {
                const i = wi++;
                const land = m.s(0.12) + i * m.s(0.16);
                const a = easeOut(clamp01((local - land) / m.s(major ? 0.45 : 0.22)));
                const isE = emph && w.toLowerCase().replace(/[^a-z0-9]/g, "") === emph;
                const hasDigit = /\d/.test(w);
                // Major: words fly in from scattered positions and reform.
                const sx = major ? Math.sin(i * 2.3) * 520 * (1 - a) : 0, sy = major ? Math.cos(i * 1.7) * 700 * (1 - a) : (1 - a) * st.size * 0.4;
                const rot = major ? (1 - a) * (i % 2 ? 24 : -18) : 0;
                return (
                  <span key={k} style={{ display: "inline-block", marginRight: st.size * 0.22, opacity: a,
                    color: hasDigit ? accent : isE ? INK : a >= 1 ? INK : INK_SOFT,
                    transform: `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) rotate(${rot.toFixed(2)}deg)` }}>{w}</span>
                );
              })}
            </div>
          ))}
        </div>
      </HeroEl>
    </>
  );
}

function Lines({ b, color, weight = 700, upper = false, local, fps, m, stagger = false, align = "center", shadow = false }) {
  if (!b) return null;
  const a = (i) => easeOut(clamp01((local - (stagger ? i * 0.12 * fps : 0)) / (0.3 * fps)));
  return (
    <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, textAlign: align, font: `${weight} ${b.size}px ${SANS}, sans-serif`,
      lineHeight: 1.05, letterSpacing: -b.size * 0.02, color, textTransform: upper || b.upper ? "uppercase" : "none",
      textShadow: shadow ? "0 4px 24px rgba(0,0,0,0.55)" : "none" }}>
      {b.lines.map((l, i) => (
        <div key={i} style={{ opacity: a(i), transform: `translateY(${((1 - a(i)) * 26).toFixed(1)}px) scale(${m ? m.breathe.toFixed(4) : 1})` }}>{l}</div>
      ))}
    </div>
  );
}
const Rule = ({ b, t }) => (b ? <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w * t, height: b.h, backgroundColor: INK }} /> : null);

// ── DATA-FULL ─────────────────────────────────────────────────────────
function DataFull({ c, L, local, dur, fps, accent, part = "body" }) {
  const m = useMotion(c, local, dur, fps);
  const B = L.boxes, vt = String(c.visual_type).toUpperCase(), d = c.data || {};
  const head = (
    <>
      {B.kicker ? <div style={{ position: "absolute", left: B.kicker.x, top: B.kicker.y, width: B.kicker.w, font: `italic 500 ${B.kicker.size}px ${SERIF}`, color: INK_SOFT, opacity: m.build(0.2) }}>{B.kicker.lines[0]}</div> : null}
      {B.headline ? <Lines b={B.headline} color={INK} weight={800} align="left" local={local} fps={fps} m={m} stagger /> : null}
    </>
  );
  let chart = null;
  const ch = B.chart;
  if (vt === "BAR") {
    const bars = (d.bars || []).map((b) => ({ ...b, q: parseQuantity(b.value) })).filter((b) => b.q);
    const max = Math.max(...bars.map((b) => b.q.magnitude)) || 1;
    const primary = bars.reduce((a, b, i) => (b.q.magnitude > bars[a].q.magnitude ? i : a), 0);
    if (ch.orient === "h") {
      const row = ch.h / Math.max(1, bars.length), th = row * 0.42;
      chart = (
        <svg width={FRAME.w} height={FRAME.h} style={{ position: "absolute", inset: 0 }}>
          {bars.map((b, i) => {
            const t = m.build(0.45, i * 4);
            const y = ch.y + row * i + row * 0.36;
            const w = Math.max(6, (b.q.magnitude / max) * (ch.w - 40) * t);
            const lsz = Math.min(46, Math.floor(ch.w / Math.max(1, String(b.label).length * 0.56)));
            return (
              <g key={i}>
                <text x={ch.x} y={y - 18} style={{ font: `600 ${lsz}px ${SANS}, sans-serif` }} fill={INK}>{b.label}</text>
                <rect x={ch.x} y={y} width={w} height={th} fill={i === primary ? accent : MID} />
                <text x={Math.min(ch.x + w + 18, ch.x + ch.w - 10)} y={y + th * 0.72} textAnchor={ch.x + w + 18 > ch.x + ch.w - 200 ? "end" : "start"}
                  style={{ font: `800 ${Math.round(th * 0.55)}px ${SANS}, sans-serif` }} fill={ch.x + w + 18 > ch.x + ch.w - 200 ? "#fff" : INK}>{rollQuantity(b.q, t)}</text>
              </g>
            );
          })}
        </svg>
      );
    } else {
      const base = ch.baseline, plotTop = ch.y + 70, plotH = base - plotTop;
      const slot = ch.w / bars.length, bw = Math.min(300, slot * 0.64);
      chart = (
        <svg width={FRAME.w} height={FRAME.h} style={{ position: "absolute", inset: 0 }}>
          <line x1={ch.x} y1={base} x2={ch.x + ch.w} y2={base} stroke={INK} strokeWidth={4} />
          {bars.map((b, i) => {
            const t = m.build(0.45, i * 5);
            const h = Math.max(4, (b.q.magnitude / max) * plotH * t);
            const x = ch.x + slot * i + (slot - bw) / 2;
            const vs = Math.min(84, Math.floor((slot * 0.96) / Math.max(1, rollQuantity(b.q, 1).length * 0.6)));
            const ls = Math.min(44, Math.floor((slot * 0.96) / Math.max(1, String(b.label).length * 0.56)));
            return (
              <g key={i}>
                <rect x={x} y={base - h} width={bw} height={h} fill={i === primary ? accent : MID} />
                <text x={x + bw / 2} y={base - h - 22 + (t >= 1 ? m.jitter(i) : 0)} textAnchor="middle" style={{ font: `800 ${vs}px ${SANS}, sans-serif` }} fill={INK}>{rollQuantity(b.q, t)}</text>
                <text x={x + bw / 2} y={base + 46} textAnchor="middle" style={{ font: `500 ${ls}px ${SANS}, sans-serif` }} fill={INK}>{b.label}</text>
              </g>
            );
          })}
        </svg>
      );
    }
  } else if (vt === "PIE") {
    const pct = Number(d.percent) || 0, t = m.build(0.5, m.s(0.15));
    const r = ch.r, cx = ch.x + r, cy = ch.y + r, sw = 150, rr = r - sw / 2;
    const C = 2 * Math.PI * rr;
    chart = (
      <>
        <svg width={FRAME.w} height={FRAME.h} style={{ position: "absolute", inset: 0 }}>
          <circle cx={cx} cy={cy} r={rr} fill="none" stroke={LIGHT} strokeWidth={sw} />
          <circle cx={cx} cy={cy} r={rr} fill="none" stroke={accent} strokeWidth={sw} strokeDasharray={`${(C * pct / 100) * t} ${C}`}
            transform={`rotate(-90 ${cx} ${cy})`} />
        </svg>
        <div style={{ position: "absolute", left: cx - r, top: cy - 130 + (t >= 1 ? m.jitter() : 0), width: 2 * r, textAlign: "center",
          font: `800 230px ${SANS}, sans-serif`, letterSpacing: -9, color: INK, lineHeight: 1 }}>{Math.round(pct * t)}%</div>
        {d.label ? <div style={{ position: "absolute", left: B.label.x, top: B.label.y, width: B.label.w, textAlign: "center", font: `500 52px ${SANS}, sans-serif`, color: INK, opacity: m.build(0.2, m.s(0.5)) }}>{d.label}</div> : null}
      </>
    );
  } else if (vt === "GAUGE") {
    const pct = Number(d.percent) || 0, t = m.build(0.5, m.s(0.15));
    const r = ch.r, cx = 540, cy = ch.cy, sw = 96, rr = r - sw / 2;
    const arc = (p) => { const a = Math.PI * (1 - p); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; };
    const [ex, ey] = arc(clamp01((pct / 100) * t));
    chart = (
      <>
        <svg width={FRAME.w} height={FRAME.h} style={{ position: "absolute", inset: 0 }}>
          <path d={`M ${cx - rr} ${cy} A ${rr} ${rr} 0 0 1 ${cx + rr} ${cy}`} fill="none" stroke={LIGHT} strokeWidth={sw} />
          <path d={`M ${cx - rr} ${cy} A ${rr} ${rr} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`} fill="none" stroke={accent} strokeWidth={sw} />
          <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={INK} strokeWidth={10} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={22} fill={INK} />
        </svg>
        <div style={{ position: "absolute", left: B.number.x, top: B.number.y + (t >= 1 ? m.jitter() : 0), width: B.number.w, textAlign: "center",
          font: `800 210px ${SANS}, sans-serif`, letterSpacing: -8, color: INK, lineHeight: 1 }}>{Math.round(pct * t)}%</div>
        {d.label ? <div style={{ position: "absolute", left: B.label.x, top: B.label.y, width: B.label.w, textAlign: "center", font: `500 52px ${SANS}, sans-serif`, color: INK, opacity: m.build(0.2, m.s(0.5)) }}>{d.label}</div> : null}
      </>
    );
  } else if (vt === "LINE") {
    const pts = (d.points || []).map((p) => ({ ...p, q: parseQuantity(p.value) })).filter((p) => p.q);
    const max = Math.max(...pts.map((p) => p.q.magnitude)) || 1, min = Math.min(0, ...pts.map((p) => p.q.magnitude));
    const px = (i) => ch.x + 40 + (i * (ch.w - 80)) / Math.max(1, pts.length - 1);
    const base = ch.y + ch.h - 90;
    const py = (v) => base - ((v - min) / (max - min || 1)) * (ch.h - 260);
    const t = m.build(0.55, m.s(0.1));
    const path = pts.map((p, i) => `${i ? "L" : "M"} ${px(i).toFixed(1)} ${py(p.q.magnitude).toFixed(1)}`).join(" ");
    chart = (
      <svg width={FRAME.w} height={FRAME.h} style={{ position: "absolute", inset: 0 }}>
        <line x1={ch.x} y1={base} x2={ch.x + ch.w} y2={base} stroke={INK} strokeWidth={4} />
        {[0.33, 0.66].map((f) => <line key={f} x1={ch.x} y1={base - f * (ch.h - 260)} x2={ch.x + ch.w} y2={base - f * (ch.h - 260)} stroke={LIGHT} strokeWidth={2} />)}
        <path d={path} fill="none" stroke={accent} strokeWidth={14} strokeLinejoin="round" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} />
        {pts.map((p, i) => {
          const on = clamp01(t * (pts.length - 1) - i + 1);
          return (
            <g key={i} opacity={on}>
              <circle cx={px(i)} cy={py(p.q.magnitude)} r={20} fill={i === pts.length - 1 ? accent : INK} />
              <text x={px(i)} y={py(p.q.magnitude) - 44} textAnchor="middle" style={{ font: `800 64px ${SANS}, sans-serif` }} fill={INK}>{rollQuantity(p.q, 1)}</text>
              <text x={px(i)} y={base + 60} textAnchor="middle" style={{ font: `500 42px ${SANS}, sans-serif` }} fill={INK}>{p.label}</text>
            </g>
          );
        })}
      </svg>
    );
  } else if (vt === "MAP") {
    chart = <PaperMap data={d} bounds={ch} local={local} dur={dur} font={SANS} accent={accent} ground={STUDIO} labelMax={84} />;
  }
  return part === "header" ? head : <HeroEl name="chart" b={ch}>{chart}</HeroEl>;
}

// ── SCENE-FULL ────────────────────────────────────────────────────────
function SceneFull({ c, L, local, dur, fps, part = "body" }) {
  const m = useMotion(c, local, dur, fps);
  const B = L.boxes;
  if (c.photo) {
    const push = m.tier === "micro" ? 0.02 : 0.035;
    const scale = 1 + push * clamp01(local / Math.max(1, dur));
    // Major: the photo expands from a small circle to the whole frame.
    const iris = m.tier === "major" ? easeInOut(clamp01(local / m.s(0.9))) : 1;
    const R = lerp(160, 1200, iris);
    if (part === "header") return (
      <>
        {B.kicker ? <div style={{ position: "absolute", left: B.kicker.x, top: B.kicker.y, font: `700 ${B.kicker.size}px ${SANS}, sans-serif`, letterSpacing: 6, color: "#FFFFFF", opacity: m.build(0.2, m.s(0.2)), textShadow: "0 3px 16px rgba(0,0,0,0.6)" }}>{B.kicker.lines[0]}</div> : null}
        <Lines b={B.headline} color="#FFFFFF" weight={800} align="left" local={local - m.s(0.3)} fps={fps} m={m} stagger shadow />
        {c.photo.credit ? <div style={{ position: "absolute", right: 150, top: 1416, font: `500 20px ${SANS}, sans-serif`, color: "rgba(255,255,255,0.72)", maxWidth: 700, textAlign: "right" }}>{c.photo.credit}</div> : null}
      </>
    );
    return (
      <>
        <HeroEl name="photo" b={B.photo}>
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", clipPath: iris < 1 ? `circle(${R.toFixed(0)}px at 540px 820px)` : "none" }}>
            <Img src={staticFile(c.photo.asset)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: c.photo.position || "50% 30%",
              transform: `scale(${scale.toFixed(4)})`, filter: "saturate(0.92) contrast(1.05)" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.66) 0%, rgba(0,0,0,0.25) 36%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.10) 66%, rgba(0,0,0,0.72) 100%)" }} />
          </div>
        </HeroEl>
      </>
    );
  }
  // An isolated object, large on the studio. Hard rule: only an image the
  // resolver isolated (rembg alpha mask, >= 15% transparent) — never a rectangle.
  if (!(c.cutout?.isolated === true && Number(c.cutout.transparent) >= 0.15)) {
    throw new Error(`[cutout] isolation failed, no alpha mask (${c.cutout?.asset}) — the resolver must convert this beat to TYPE`);
  }
  const cu = B.cutout, t = m.build(0.35, m.s(0.1));
  if (part === "header") return (
    <>
      {B.kicker ? <div style={{ position: "absolute", left: B.kicker.x, top: B.kicker.y, width: B.kicker.w, font: `italic 500 ${B.kicker.size}px ${SERIF}`, color: INK_SOFT, opacity: m.build(0.2) }}>{B.kicker.lines[0]}</div> : null}
      {B.headline ? <Lines b={B.headline} color={INK} weight={800} align="left" local={local} fps={fps} m={m} stagger /> : null}
    </>
  );
  return (
    <>
      <HeroEl name="cutout" b={cu}>
        <div style={{ position: "absolute", left: cu.x, top: cu.y + (1 - t) * 120, width: cu.w, height: cu.h, opacity: t,
          transform: `rotate(${((1 - t) * -5).toFixed(2)}deg) scale(${(m.breathe * (1 + 0.03 * clamp01(local / dur))).toFixed(4)})`,
          filter: "drop-shadow(18px 30px 26px rgba(0,0,0,0.28))" }}>
          <Img src={staticFile(c.cutout.asset)} style={{ width: "100%", height: "100%", objectFit: "contain", filter: "grayscale(1) contrast(1.12)" }} />
        </div>
      </HeroEl>
    </>
  );
}

// ── PROCESS-FULL ──────────────────────────────────────────────────────
function ProcessFull({ c, L, local, dur, fps, accent, part = "body" }) {
  const m = useMotion(c, local, dur, fps);
  const B = L.boxes, nodes = B.nodes || [];
  const nodeT = (i) => m.build(0.18, m.s(0.15) + i * dur * 0.26);
  const arrowT = (i) => m.build(0.2, m.s(0.3) + i * dur * 0.26);
  const center = (n) => [n.x + n.w / 2, n.y + n.h / 2];
  if (part === "header") return (
    <>
      {B.kicker ? <div style={{ position: "absolute", left: B.kicker.x, top: B.kicker.y, width: B.kicker.w, font: `italic 500 ${B.kicker.size}px ${SERIF}`, color: INK_SOFT, opacity: m.build(0.2) }}>{B.kicker.lines[0]}</div> : null}
      {B.headline ? <Lines b={B.headline} color={INK} weight={800} align="left" local={local} fps={fps} m={m} stagger /> : null}
    </>
  );
  return (
    <>
      <HeroEl name="nodes" b={{ x: 0, y: nodes[0]?.y || 0, w: FRAME.w, h: 1400 - (nodes[0]?.y || 0) }}>
        <svg width={FRAME.w} height={FRAME.h} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <marker id="pf-arrow" markerWidth="4" markerHeight="4" refX="2.2" refY="2" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L4,2 L0,4 Z" fill={accent} />
            </marker>
          </defs>
          {nodes.slice(0, -1).map((n, i) => {
            const [x1, y1] = center(n), [x2, y2] = center(nodes[i + 1]);
            const ang = Math.atan2(y2 - y1, x2 - x1);
            const r1 = n.w / 2 + 18, r2 = nodes[i + 1].w / 2 + 44;
            const sx = x1 + Math.cos(ang) * r1, sy = y1 + Math.sin(ang) * r1, ex = x2 - Math.cos(ang) * r2, ey = y2 - Math.sin(ang) * r2;
            const t = arrowT(i);
            return <line key={i} x1={sx} y1={sy} x2={lerp(sx, ex, t)} y2={lerp(sy, ey, t)} stroke={accent} strokeWidth={18} strokeLinecap="round" markerEnd={t > 0.05 ? "url(#pf-arrow)" : undefined} />;
          })}
          {nodes.map((n, i) => {
            const t = nodeT(i);
            const [cx, cy] = center(n);
            // The middle of a 3-node chain transforms: it fills in as the flow arrives.
            const mid = nodes.length === 3 && i === 1;
            const fill = mid ? clamp01((arrowT(0) - 0.8) * 5) : 0;
            return (
              <g key={i} opacity={t} transform={`translate(${cx} ${cy}) scale(${(lerp(0.7, 1, t) * m.breathe).toFixed(4)}) translate(${-cx} ${-cy})`}>
                <circle cx={cx} cy={cy} r={n.w / 2} fill={mid ? `rgba(11,11,12,${fill.toFixed(3)})` : "#FFFFFF"} stroke={INK} strokeWidth={8} />
              </g>
            );
          })}
        </svg>
        {nodes.map((n, i) => {
          const words = String(n.label || "").split(/\s+/);
          const inner = n.w * 0.74;
          let size = 64;
          while (size > 26 && words.some((w) => textWidth(w, size, true) > inner)) size -= 2;
          const mid = nodes.length === 3 && i === 1, fill = mid ? clamp01((arrowT(0) - 0.8) * 5) : 0;
          return (
            <div key={i} style={{ position: "absolute", left: n.x + (n.w - inner) / 2, top: n.y, width: inner, height: n.h, display: "flex", alignItems: "center", justifyContent: "center",
              textAlign: "center", font: `800 ${size}px ${SANS}, sans-serif`, lineHeight: 1.02, textTransform: "uppercase", letterSpacing: -1,
              color: fill > 0.5 ? "#FFFFFF" : INK, opacity: nodeT(i) }}>{n.label}</div>
          );
        })}
      </HeroEl>
    </>
  );
}

// ── hero element (match cuts / persisted elements) ────────────────────
function HeroEl({ name, b, children }) {
  const ctx = React.useContext(Hero);
  if (!ctx || !ctx.from || ctx.name !== name || !b) return children;
  // Start exactly on the previous beat's hero box, settle into this one.
  const t = easeInOut(ctx.t);
  const sx = ctx.from.w / Math.max(1, b.w), sy = ctx.from.h / Math.max(1, b.h);
  const s = lerp(Math.min(sx, sy), 1, t);
  const dx = lerp(ctx.from.x + ctx.from.w / 2 - (b.x + b.w / 2), 0, t), dy = lerp(ctx.from.y + ctx.from.h / 2 - (b.y + b.h / 2), 0, t);
  return (
    <div style={{ position: "absolute", inset: 0, transformOrigin: `${b.x + b.w / 2}px ${b.y + b.h / 2}px`, transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s.toFixed(4)})` }}>
      {children}
    </div>
  );
}

// ── camera ────────────────────────────────────────────────────────────
function cameraAt(c, L, local, dur, fps) {
  const tier = c.motion_tier || "medium";
  const focus = Array.isArray(c.camera_focus) ? c.camera_focus.filter((f) => Number.isFinite(Number(f?.at_percent))) : [];
  const toXf = (bx) => {
    if (!bx) return { s: 1, x: 0, y: 0 };
    const s = Math.max(1, Math.min(1.35, (0.86 * FRAME.w) / bx.w, (0.8 * FRAME.h) / bx.h));
    const cx = bx.x + bx.w / 2, cy = bx.y + bx.h / 2;
    const maxX = ((s - 1) * FRAME.w) / 2, maxY = ((s - 1) * FRAME.h) / 2;
    return { s, x: Math.max(-maxX, Math.min(maxX, (FRAME.w / 2 - cx) * s)), y: Math.max(-maxY, Math.min(maxY, (FRAME.h / 2 - cy) * s)) };
  };
  let cam = { s: 1, x: 0, y: 0 };
  if (focus.length) {
    const keys = [...focus].sort((a, b) => a.at_percent - b.at_percent);
    for (const k of keys) {
      const start = clamp01(Number(k.at_percent)) * dur;
      const t = easeInOut(clamp01((local - start) / (0.7 * fps)));
      if (t <= 0) break;
      const to = toXf(focusBox(L, k.target));
      cam = { s: lerp(cam.s, to.s, t), x: lerp(cam.x, to.x, t), y: lerp(cam.y, to.y, t) };
    }
  } else {
    const push = tier === "micro" ? 0.015 : 0.04;
    cam = { s: 1 + push * easeInOut(clamp01(local / Math.max(1, dur))), x: 0, y: 0 };
  }
  // Major on TYPE-FULL / DATA-FULL / PROCESS-FULL: full-canvas zoom 1.0 -> 1.15.
  if (tier === "major" && L.composition !== "SCENE-FULL") cam.s *= 1 + 0.15 * easeInOut(clamp01(local / Math.max(1, dur)));
  return cam;
}

function BeatCanvas({ beat, local, fps, accent, hero, bodyOnly = false }) {
  const c = beat.scene.canvas;
  const dur = beat.duration_frames;
  const L = canvasLayout(c);
  const cam = cameraAt(c, L, local, dur, fps);
  const Comp = L.composition === "DATA-FULL" ? DataFull : L.composition === "SCENE-FULL" ? SceneFull : L.composition === "PROCESS-FULL" ? ProcessFull : TypeFull;
  return (
    <Hero.Provider value={hero}>
      {/* The camera moves through the information (the body); the header —
          kicker and headline — stays pinned, so a push or a major zoom never
          crops it. */}
      <div style={{ position: "absolute", inset: 0, transformOrigin: "540px 960px", transform: `translate(${cam.x.toFixed(1)}px, ${cam.y.toFixed(1)}px) scale(${cam.s.toFixed(4)})` }}>
        <Comp c={c} L={L} local={local} dur={dur} fps={fps} accent={accent} part="body" />
      </div>
      {bodyOnly ? null : <Comp c={c} L={L} local={local} dur={dur} fps={fps} accent={accent} part="header" />}
    </Hero.Provider>
  );
}

// ── captions (outside the camera; never move with it) ─────────────────
const norm = (w) => String(w || "").toLowerCase().replace(/[^a-z0-9]/g, "");
function CanvasCaption({ words, local, fps, emphasis, onPhoto }) {
  if (!Array.isArray(words) || !words.length) throw new Error("CanvasCaption: beat has no word timings — the voiceover's word boundaries are required");
  const size = Math.min(58, Math.floor(CAPTION.w / (Math.max(1, ...words.map((w) => String(w.text).length)) * 0.62)));
  const perChunk = Math.max(8, Math.floor((CAPTION.w / (size * 0.55)) * 2));
  const chunks = [];
  let cur = [], chars = 0;
  for (const w of words) {
    const len = String(w.text).length + 1;
    if (cur.length && chars + len > perChunk) { chunks.push(cur); cur = []; chars = 0; }
    cur.push(w); chars += len;
  }
  if (cur.length) chunks.push(cur);
  let ci = -1;
  chunks.forEach((ch, i) => { if (local >= ch[0].from) ci = i; });
  if (ci < 0) return null;
  const last = words[words.length - 1];
  if (ci === chunks.length - 1 && local > last.to + Math.round(0.4 * fps)) return null;
  const emph = norm(emphasis);
  return (
    <div style={{ position: "absolute", left: CAPTION.x, top: CAPTION.y, width: CAPTION.w, textAlign: "center", font: `700 ${size}px ${SANS}, sans-serif`,
      lineHeight: 1.18, color: onPhoto ? "#FFFFFF" : INK, textShadow: onPhoto ? "0 3px 18px rgba(0,0,0,0.7)" : "none" }}>
      {chunks[ci].map((w, i) => {
        const since = local - w.from;
        const e = clamp01(since / 3);
        const isE = emph && norm(w.text).includes(emph);
        return (
          <span key={i} style={{ display: "inline-block", marginRight: size * 0.28, opacity: since < 0 ? 0.28 : 1,
            transform: `translateY(${(6 * (1 - e)).toFixed(1)}px)`, borderBottom: isE && since >= 0 ? `6px solid ${onPhoto ? "#FFFFFF" : INK}` : "6px solid transparent" }}>{w.text}</span>
        );
      })}
    </div>
  );
}

// ── the whole video ───────────────────────────────────────────────────
export function CanvasVideo({ plan }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beats = plan.beats || [];
  const accent = plan.accent || INK;
  const i = Math.max(0, beats.findIndex((b) => frame >= b.start_frame && frame < b.start_frame + b.duration_frames));
  const beat = beats[i] || beats[beats.length - 1];
  beats.forEach((b, k) => { if (!b?.scene?.canvas) throw new Error(`CanvasVideo: beat ${k} has no canvas content — the asset resolver must build it`); });
  const local = frame - beat.start_frame;
  const TR = Math.round(TRANSITION_SEC * fps);
  const prev = i > 0 ? beats[i - 1] : null;
  const inT = prev && local < TR ? local / TR : 1;
  const c = beat.scene.canvas;
  const onPhoto = canvasLayout(c).composition === "SCENE-FULL" && !!c.photo;

  // Transition style at the boundary into this beat.
  let style = "slide";
  if (prev) {
    const pc = prev.scene.canvas;
    const pL = canvasLayout(pc), cL = canvasLayout(c);
    if (c.match_cut_prev || Number.isInteger(c.persists_from)) style = Number.isInteger(c.persists_from) ? "persist" : "match";
    else if (c.motion_tier === "major" && !pc.photo && (cL.composition === "DATA-FULL" || cL.composition === "PROCESS-FULL")) style = "flip";
    else if (pc.photo && c.photo) style = "push";
    // A match / persist needs a hero of the same kind on both sides.
    if ((style === "match" || style === "persist") && pL.hero !== cL.hero) style = "slide";
    var prevHeroBox = style === "match" || style === "persist" ? pL.boxes[pL.hero] : null;
    var heroName = cL.hero;
  }

  const e = easeInOut(clamp01(inT));
  const eOut = easeInOut(clamp01(inT / 0.55)), eIn = easeInOut(clamp01((inT - 0.35) / 0.65));
  const layers = [];
  if (prev && inT < 1) {
    const plocal = prev.duration_frames + local;
    let outStyle = { opacity: 1 - eOut };
    if (style === "slide") outStyle = { opacity: 1 - eOut, transform: `translateY(${(-90 * eOut).toFixed(1)}px)` };
    if (style === "push") outStyle = { opacity: 1, transform: `translateX(${(-FRAME.w * e).toFixed(1)}px)` };
    if (style === "flip") outStyle = { opacity: e < 0.5 ? 1 : 0, transform: `perspective(2400px) rotateY(${(180 * Math.min(0.5, e)).toFixed(2)}deg)` };
    if (style === "match" || style === "persist") outStyle = { opacity: 1 - clamp01(e * 2.5) };
    layers.push(
      <div key="out" style={{ position: "absolute", inset: 0, ...outStyle }}>
        <BeatCanvas beat={prev} local={plocal} fps={fps} accent={accent} hero={null} />
      </div>
    );
    if (style === "persist" && prevHeroBox) {
      // The old hero stays, moving and scaling into the new hero's box as it fades.
      const to = canvasLayout(c).boxes[canvasLayout(c).hero];
      if (to) {
        const s = lerp(1, Math.min(to.w / Math.max(1, prevHeroBox.w), to.h / Math.max(1, prevHeroBox.h)), e);
        const dx = lerp(0, to.x + to.w / 2 - (prevHeroBox.x + prevHeroBox.w / 2), e), dy = lerp(0, to.y + to.h / 2 - (prevHeroBox.y + prevHeroBox.h / 2), e);
        layers.push(
          <div key="persist" style={{ position: "absolute", inset: 0, opacity: 1 - e, transformOrigin: `${prevHeroBox.x + prevHeroBox.w / 2}px ${prevHeroBox.y + prevHeroBox.h / 2}px`,
            transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s.toFixed(4)})` }}>
            <BeatCanvas beat={prev} local={plocal} fps={fps} accent={accent} hero={null} bodyOnly />
          </div>
        );
      }
    }
  }
  let inStyle = {};
  if (prev && inT < 1) {
    if (style === "slide") inStyle = { opacity: eIn, transform: `translateY(${(90 * (1 - eIn)).toFixed(1)}px)` };
    if (style === "push") inStyle = { transform: `translateX(${(FRAME.w * (1 - e)).toFixed(1)}px)` };
    if (style === "flip") inStyle = { opacity: e >= 0.5 ? 1 : 0, transform: `perspective(2400px) rotateY(${(-180 * (1 - Math.max(0.5, e))).toFixed(2)}deg)` };
    if (style === "persist") inStyle = { opacity: e };
  }
  const hero = prev && inT < 1 && (style === "match" || style === "persist") && prevHeroBox ? { name: heroName, from: prevHeroBox, t: inT } : null;
  layers.push(
    <div key="in" style={{ position: "absolute", inset: 0, ...inStyle }}>
      <BeatCanvas beat={beat} local={local} fps={fps} accent={accent} hero={hero} />
    </div>
  );

  return (
    <StudioBG color={STUDIO} drift={frame / fps}>
      {layers}
      {/* grain: a noise tile re-seeded (offset) every frame */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${staticFile("fx/grain.png")})`, backgroundSize: "256px 256px",
        backgroundPosition: `${(frame * 97) % 256}px ${(frame * 57) % 256}px`, opacity: 0.1, mixBlendMode: "soft-light", pointerEvents: "none" }} />
      <CanvasCaption words={beat.spoken} local={local} fps={fps} emphasis={c.emphasis_word} onPhoto={onPhoto} />
    </StudioBG>
  );
}

export default CanvasVideo;
