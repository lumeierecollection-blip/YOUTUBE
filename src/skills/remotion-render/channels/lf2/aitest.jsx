// AI Tested long form v2. Built from AI Search (1Aqhg0FVm-w, h5zkzon0gM4, cUeZMUGCxrw, tDWtcyeNNew, EfyQOAJjx1A): the evidence is the real
// screen. Real pages are captured (platform/longform/v2/capture.mjs), shown in a browser frame and moved by a camera to the line under
// discussion with a highlight box; results sit next to the settings that produced them; charts outline the winner; a pill label names what
// is being tested; an explainer diagram follows the demo. Nothing on these screens is typed by hand: replies come from the run's JSON.
import React from "react";
import { AbsoluteFill, Freeze, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { F, Fonts, Finish, clamp, eio, eo, expo, lerp, ramp, typed } from "./kit.jsx";

const src = (p) => (p.startsWith("data:") || p.startsWith("http") ? p : staticFile(p));
// slow push-in on every card (rebuild 15 Nov 2026, owner: "no movement"): nothing on this channel holds a dead-still frame
const Field = ({ t, children }) => { const f = useCurrentFrame(); return <AbsoluteFill style={{ background: t.bg }}><Fonts /><AbsoluteFill style={{ backgroundImage: `radial-gradient(${t.dot} 1.5px, transparent 1.5px)`, backgroundSize: "36px 36px", opacity: 0.5 }} /><AbsoluteFill style={{ transform: `scale(${1 + Math.min(f, 450) * 0.0001})` }}>{children}</AbsoluteFill></AbsoluteFill>; };
/** Pill label, top-right (h5zkzon0gM4 "Halo x MW2"): what is on screen right now. */
export const Pill = ({ t, text, from = 0 }) => { const f = useCurrentFrame(), a = ramp(f, from, from + 10); return text ? <div style={{ position: "absolute", right: 56, top: 44, display: "flex", alignItems: "center", gap: 12, background: "rgba(14,16,20,0.92)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 999, padding: "10px 22px", fontFamily: F.sans, fontWeight: 700, fontSize: 24, color: "#fff", opacity: a, transform: `translateY(${(1 - a) * -12}px)` }}><span style={{ width: 12, height: 12, borderRadius: "50%", background: t.accent }} />{text}</div> : null; };
const Foot = ({ text }) => text ? <div style={{ position: "absolute", left: 56, bottom: 28, fontFamily: F.mono, fontSize: 18, color: "rgba(255,255,255,0.55)" }}>{text}</div> : null;

/**
 * 1. Browser: a real capture inside a browser frame. The camera (centre + zoom in capture pixels) travels between keyframes, the page can
 * scroll, a highlight box draws round the real words, and a cursor follows a path. shots: one or more real screenshots shown in order.
 * image: { file, w, h }; cam: [{ f, x, y, zoom }]; boxes: [{ rects, from, label }]; cursor: [{ f, x, y, click }]; url: shown in the bar.
 */
export function Browser({ t, image, shots, url, cam = [], boxes = [], cursor = [], pill, foot, frame = true, desk = false, dim = 0.38 }) { // dim: how dark the page goes around a box (close-ups use ~0.8)
  const f = useCurrentFrame(), W = 1920, H = 1080, vw = desk ? 1480 : frame ? 1760 : W, vh = desk ? 850 : frame ? 900 : H, ox = (W - vw) / 2, oy = desk ? 120 : frame ? 130 : 0; // desk: How Money Works-style clipping on a green desk (fresh cycle clone, 15 Nov 2026)
  const cur = shots ? shots.filter((s) => f >= (s.from || 0)).at(-1) : image;
  const keys = cam.length ? cam : [{ f: 0, x: cur.w / 2, y: (vh / 2) * (cur.w / vw), zoom: vw / cur.w }];
  let i = 0; while (i < keys.length - 2 && f > keys[i + 1].f) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)], k = a === b ? 0 : interpolate(f, [a.f, b.f], [0, 1], { ...clamp, easing: eio }), cx = a.x + (b.x - a.x) * k, cy = a.y + (b.y - a.y) * k, z = a.zoom + (b.zoom - a.zoom) * k;
  let ci = 0; while (ci < cursor.length - 2 && f > cursor[ci + 1].f) ci++;
  const c0 = cursor[ci], c1 = cursor[Math.min(ci + 1, cursor.length - 1)], ck = c0 && c1 && c0 !== c1 ? interpolate(f, [c0.f, c1.f], [0, 1], { ...clamp, easing: eio }) : 0, cur2 = c0 ? [c0.x + (c1.x - c0.x) * ck, c0.y + (c1.y - c0.y) * ck] : null, clicking = cursor.find((c) => c.click && f >= c.f && f < c.f + 12);
  return (
    <Field t={t}>
      {desk && <AbsoluteFill style={{ background: `radial-gradient(120% 95% at 50% 38%, ${t.desk?.felt || "#2a6e46"} 0%, ${t.desk?.mid || "#1f5638"} 58%, ${t.desk?.edge || "#11321f"} 100%)` }}><AbsoluteFill style={{ backgroundImage: `linear-gradient(${t.desk?.grid || "rgba(255,255,255,0.05)"} 1px, transparent 1px), linear-gradient(90deg, ${t.desk?.grid || "rgba(255,255,255,0.05)"} 1px, transparent 1px)`, backgroundSize: "64px 64px" }} /></AbsoluteFill>}
      {frame && !desk && <div style={{ position: "absolute", left: ox, top: oy - 58, width: vw, height: 58, background: "#1d2026", borderRadius: "14px 14px 0 0", display: "flex", alignItems: "center", gap: 10, padding: "0 20px", boxSizing: "border-box" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} style={{ width: 14, height: 14, borderRadius: "50%", background: c }} />)}
        <div style={{ marginLeft: 20, flex: 1, height: 34, borderRadius: 8, background: "#0f1115", display: "flex", alignItems: "center", padding: "0 16px", fontFamily: F.mono, fontSize: 19, color: "rgba(255,255,255,0.78)", overflow: "hidden", whiteSpace: "nowrap" }}>{url}</div>
      </div>}
      <div style={{ position: "absolute", left: ox, top: oy, width: vw, height: vh, overflow: "hidden", background: "#fff", borderRadius: desk ? 4 : frame ? "0 0 14px 14px" : 0, transform: desk ? "rotate(-1.1deg)" : undefined, boxShadow: "0 30px 90px rgba(0,0,0,0.6)" }}>
        <div style={{ position: "absolute", left: vw / 2, top: vh / 2, transform: `scale(${z}) translate(${-cx}px, ${-cy}px)`, transformOrigin: "0 0" }}>
          <Img src={src(cur.file)} style={{ width: cur.w, height: cur.h, display: "block" }} />
          {boxes.filter((b) => f >= b.from && (!b.to || f < b.to)).map((bx, bi) => { const x0 = Math.min(...bx.rects.map((r) => r.x)) - 10, y0 = Math.min(...bx.rects.map((r) => r.y)) - 8, x1 = Math.max(...bx.rects.map((r) => r.x + r.w)) + 10, y1 = Math.max(...bx.rects.map((r) => r.y + r.h)) + 8, p = ramp(f, bx.from, bx.from + 14, eo), geo = { position: "absolute", left: x0, top: y0, width: x1 - x0, height: y1 - y0, borderRadius: 6 / z, boxSizing: "border-box" }; return (
            // dim and label sit on an unclipped twin of the box: on the box itself the drawing clip-path also cut away its shadow and its label (15 Nov 2026)
            <React.Fragment key={bi}>
              <div style={{ ...geo, boxShadow: `0 0 0 ${3000}px rgba(8,10,14,${dim * p})` }}>
                {bx.label && <div style={{ position: "absolute", left: 0, top: -(46 / z), fontFamily: F.sans, fontWeight: 700, fontSize: 24 / z, color: "#0a0c10", background: t.accent, padding: `${4 / z}px ${12 / z}px`, whiteSpace: "nowrap", opacity: ramp(f, bx.from + 8, bx.from + 18) }}>{bx.label}</div>}
              </div>
              <div style={{ ...geo, border: `${5 / z}px solid ${t.accent}`, clipPath: `inset(0 ${(1 - p) * 100}% 0 0 round ${6 / z}px)` }} />
            </React.Fragment>); })}
          {cur2 && <svg width="40" height="40" viewBox="0 0 24 24" style={{ position: "absolute", left: cur2[0], top: cur2[1], transform: `scale(${(1.6 / z) * (clicking ? 0.85 : 1)})`, transformOrigin: "0 0", filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))" }}><path d="M3 2 L3 19 L8 14.5 L11.5 22 L14.5 20.6 L11 13.4 L18 13.4 Z" fill="#fff" stroke="#111" strokeWidth="1.4" /></svg>}
          {clicking && cur2 && <div style={{ position: "absolute", left: cur2[0] - 30 / z, top: cur2[1] - 30 / z, width: 60 / z, height: 60 / z, borderRadius: "50%", border: `${4 / z}px solid ${t.accent}`, opacity: 1 - (f - clicking.f) / 12, transform: `scale(${1 + (f - clicking.f) / 8})` }} />}
        </div>
      </div>
      <Pill t={t} text={pill} /><Foot text={foot} />
    </Field>
  );
}

/** 2. Terminal: the real command typed, then its real output (captured when the spec was built). */
export function Terminal({ t, title = "bash", command, output = [], pill, foot, cps = 26 }) {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), shown = typed(command, f, fps, cps, 10), done = shown.length >= command.length, t1 = 10 + Math.ceil((command.length / cps) * fps) + 10;
  return (
    <Field t={t}>
      <div style={{ position: "absolute", left: 180, top: 150, width: 1560, height: 800, background: "#0b0d11", borderRadius: 14, border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 30px 90px rgba(0,0,0,0.6)", overflow: "hidden" }}>
        <div style={{ height: 52, background: "#1a1d23", display: "flex", alignItems: "center", gap: 10, padding: "0 18px" }}>{["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} style={{ width: 14, height: 14, borderRadius: "50%", background: c }} />)}<span style={{ marginLeft: 16, fontFamily: F.mono, fontSize: 19, color: "rgba(255,255,255,0.6)" }}>{title}</span></div>
        <div style={{ padding: "30px 36px", fontFamily: F.mono, fontSize: 30, lineHeight: 1.5, color: "#e6e9ee", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          <span style={{ color: t.accent }}>$ </span>{shown}{!done && <span style={{ background: "#e6e9ee", color: "#0b0d11", opacity: f % 16 < 9 ? 1 : 0 }}> </span>}
          {output.map((l, i) => f >= t1 + i * 5 && <div key={i} style={{ color: l.color || "#e6e9ee", fontWeight: l.bold ? 700 : 400 }}>{l.text}</div>)}
          {done && f >= t1 + output.length * 5 && <div><span style={{ color: t.accent }}>$ </span><span style={{ background: "#e6e9ee", opacity: f % 30 < 15 ? 1 : 0 }}> </span></div>}
        </div>
      </div>
      <Pill t={t} text={pill} /><Foot text={foot} />
    </Field>
  );
}

/** Digits of a wrong answer against the right one: every position that differs is marked. */
function DigitDiff({ answer, correct, size = 64, t }) {
  const a = String(answer ?? ""), c = String(correct), n = Math.max(a.length, c.length), A = a.padStart(n, " "), C = c.padStart(n, " ");
  return <span style={{ fontFamily: F.mono, fontWeight: 700, fontSize: size, letterSpacing: "0.04em" }}>{[...A].map((ch, i) => <span key={i} style={{ color: ch === C[i] ? "#fff" : "#0a0c10", background: ch === C[i] ? "transparent" : t.bad, padding: ch === C[i] ? 0 : "0 2px" }}>{ch}</span>)}</span>;
}

/** 3. Prompt and reply, with the settings beside the result (cUeZMUGCxrw: output next to the settings that made it). */
export function Chat({ t, model, settings = [], prompt, reply, correct, answer, ok, pill, foot }) {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), shown = typed(reply, f, fps, 60, 36), verdict = f > 36 + (reply.length / 60) * fps + 12;
  return (
    <Field t={t}>
      <div style={{ position: "absolute", left: 110, top: 130, width: 1180, height: 840, background: "#12151a", borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)", padding: 40, boxSizing: "border-box" }}>
        <div style={{ fontFamily: F.mono, fontSize: 20, letterSpacing: "0.16em", color: "rgba(255,255,255,0.55)" }}>PROMPT (sent exactly as shown)</div>
        <div style={{ marginTop: 12, background: "#1c2129", borderRadius: 12, padding: "22px 26px", fontFamily: F.sans, fontSize: 34, lineHeight: 1.4, color: "#fff", opacity: ramp(f, 0, 12) }}>{prompt}</div>
        <div style={{ marginTop: 34, fontFamily: F.mono, fontSize: 20, letterSpacing: "0.16em", color: t.accent }}>REPLY · {model}</div>
        <div style={{ marginTop: 12, fontFamily: F.mono, fontSize: reply.length > 400 ? 22 : reply.length > 60 ? 28 : 60, lineHeight: 1.45, color: "#fff", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 470, overflow: "hidden" }}>{shown}</div>
      </div>
      <div style={{ position: "absolute", left: 1330, top: 130, width: 480, background: "#12151a", borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)", padding: 30, boxSizing: "border-box" }}>
        <div style={{ fontFamily: F.mono, fontSize: 20, letterSpacing: "0.16em", color: "rgba(255,255,255,0.55)", marginBottom: 14 }}>SETTINGS</div>
        {settings.map(([k, v], i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: F.mono, fontSize: 22, color: "#fff", padding: "9px 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}><span style={{ color: "rgba(255,255,255,0.6)" }}>{k}</span><span>{v}</span></div>)}
      </div>
      {verdict && correct && <div style={{ position: "absolute", left: 1330, top: 560, width: 480, background: ok ? "rgba(47,191,113,0.12)" : "rgba(229,72,77,0.12)", border: `3px solid ${ok ? t.good : t.bad}`, borderRadius: 16, padding: 28, boxSizing: "border-box" }}>
        <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 54, color: ok ? t.good : t.bad }}>{ok ? "CORRECT" : "WRONG"}</div>
        <div style={{ fontFamily: F.mono, fontSize: 18, color: "rgba(255,255,255,0.6)", marginTop: 14 }}>RIGHT ANSWER (computed in code)</div><div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: correct.length > 14 ? 26 : 34, color: "#fff", wordBreak: "break-all" }}>{correct}</div>
        {!ok && <><div style={{ fontFamily: F.mono, fontSize: 18, color: "rgba(255,255,255,0.6)", marginTop: 14 }}>MODEL SAID</div><div style={{ wordBreak: "break-all" }}><DigitDiff answer={answer} correct={correct} size={correct.length > 14 ? 26 : 34} t={t} /></div></>}
      </div>}
      <Pill t={t} text={pill} /><Foot text={foot} />
    </Field>
  );
}

/** 4. Accuracy by size: one line per condition, drawn on; the best one is outlined (tDWtcyeNNew charts). series: [{ name, points:[[x, pct]], best }] */
export function Accuracy({ t, title, sub, series, xLabel, pill, foot, note }) {
  const f = useCurrentFrame(), xs = [...new Set(series.flatMap((s) => s.points.map((p) => p[0])))].sort((a, b) => a - b), X = (x) => 260 + ((x - xs[0]) / (xs.at(-1) - xs[0])) * 1380, Y = (v) => 850 - (v / 100) * 540;
  return (
    <Field t={t}>
      <div style={{ position: "absolute", left: 150, top: 96, fontFamily: F.sans, fontWeight: 700, fontSize: 50, color: "#fff" }}>{title}</div>
      {sub && <div style={{ position: "absolute", left: 152, top: 164, fontFamily: F.sans, fontSize: 26, color: "rgba(255,255,255,0.65)" }}>{sub}</div>}
      <svg width="1920" height="1080" style={{ position: "absolute" }}>
        {[0, 25, 50, 75, 100].map((v) => <g key={v}><line x1="260" x2="1640" y1={Y(v)} y2={Y(v)} stroke="rgba(255,255,255,0.12)" /><text x="236" y={Y(v) + 8} textAnchor="end" fontFamily={F.mono} fontSize="22" fill="rgba(255,255,255,0.6)">{v}%</text></g>)}
        {xs.map((x) => <text key={x} x={X(x)} y="896" textAnchor="middle" fontFamily={F.mono} fontSize="24" fill="rgba(255,255,255,0.75)">{x}</text>)}
        <text x="950" y="946" textAnchor="middle" fontFamily={F.sans} fontSize="24" fill="rgba(255,255,255,0.6)">{xLabel}</text>
        {series.map((s, si) => { const p = ramp(f, 16 + si * 30, 76 + si * 30, eio), d = s.points.map(([x, v], i) => `${i ? "L" : "M"}${X(x)} ${Y(v)}`).join(" "), col = s.color || (si === 0 ? t.bad : t.accent), last = s.points.at(-1); return (
          <g key={si}>
            <path d={d} fill="none" stroke={col} strokeWidth={s.best ? 9 : 6} strokeLinejoin="round" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - p} />
            {s.points.map(([x, v], i) => { const on = p >= i / (s.points.length - 1) - 0.01; return on && <g key={i}><circle cx={X(x)} cy={Y(v)} r="11" fill={t.bg} stroke={col} strokeWidth="5" /><text x={X(x)} y={Y(v) - 22 - (s.lift || 0)} textAnchor="middle" fontFamily={F.mono} fontWeight="700" fontSize="24" fill={col}>{v}%</text></g>; })}
            {p > 0.98 && <text x={X(last[0]) + 26} y={Y(last[1]) + 8 + (s.dy || 0)} fontFamily={F.sans} fontWeight="700" fontSize="26" fill={col}>{s.name}</text>}
          </g>); })}
      </svg>
      {note && <div style={{ position: "absolute", left: 260, top: 250, fontFamily: F.sans, fontSize: 24, color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.06)", padding: "8px 14px", opacity: ramp(f, 90, 104) }}>{note}</div>}
      <Pill t={t} text={pill} /><Foot text={foot} />
    </Field>
  );
}

/** 5. Every single answer as a cell: rows = number size, columns = the problems. Green right, red wrong. Nothing is averaged away. */
export function Grid({ t, title, rows, pill, foot, focus }) {
  const f = useCurrentFrame();
  return (
    <Field t={t}>
      <div style={{ position: "absolute", left: 150, top: 96, fontFamily: F.sans, fontWeight: 700, fontSize: 50, color: "#fff" }}>{title}</div>
      {rows.map((r, ri) => <div key={ri} style={{ position: "absolute", left: 150, top: 210 + ri * 84, display: "flex", alignItems: "center", gap: 12, opacity: focus != null && focus !== r.label ? 0.35 : 1 }}>
        <div style={{ width: 260, fontFamily: F.mono, fontSize: 26, color: "#fff" }}>{r.label}</div>
        {r.cells.map((ok, ci) => { const a = ramp(f, 10 + ri * 6 + ci * 1.5, 18 + ri * 6 + ci * 1.5, expo); return <div key={ci} style={{ width: 96, height: 64, borderRadius: 8, background: ok ? t.good : t.bad, opacity: a, transform: `scale(${0.6 + 0.4 * a})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.mono, fontWeight: 700, fontSize: 28, color: "#0a0c10" }}>{ok ? "✓" : "✗"}</div>; })}
        <div style={{ marginLeft: 26, fontFamily: F.mono, fontWeight: 700, fontSize: 38, color: r.cells.every(Boolean) ? t.good : r.cells.some(Boolean) ? "#fff" : t.bad, opacity: ramp(f, 30 + ri * 6, 40 + ri * 6) }}>{r.cells.filter(Boolean).length}/{r.cells.length}</div>
      </div>)}
      <Pill t={t} text={pill} /><Foot text={foot} />
    </Field>
  );
}

/** 6. One wrong answer, large: the model's digits over the right digits, differences marked (opening hook and "miss" moments). */
export function Miss({ t, a, b, answer, correct, model, pill, foot, lead }) {
  const f = useCurrentFrame(), size = correct.length > 16 ? 86 : correct.length > 12 ? 110 : 140;
  return (
    <Field t={t}>
      {lead && <div style={{ position: "absolute", left: 130, top: 120, fontFamily: F.sans, fontWeight: 700, fontSize: 44, color: "rgba(255,255,255,0.8)" }}>{lead}</div>}
      <div style={{ position: "absolute", left: 130, top: 210, fontFamily: F.mono, fontWeight: 700, fontSize: 84, color: "#fff", opacity: ramp(f, 0, 12) }}>{a} <span style={{ color: t.accent }}>×</span> {b}</div>
      <div style={{ position: "absolute", left: 130, top: 400, fontFamily: F.mono, fontSize: 24, letterSpacing: "0.16em", color: "rgba(255,255,255,0.6)", opacity: ramp(f, 16, 26) }}>{model.toUpperCase()} ANSWERED</div>
      <div style={{ position: "absolute", left: 130, top: 440, opacity: ramp(f, 18, 30) }}>{f < 58 ? <span style={{ fontFamily: F.mono, fontWeight: 700, fontSize: size, letterSpacing: "0.04em", color: "#fff" }}>{answer}</span> : <DigitDiff answer={answer} correct={correct} size={size} t={t} />}</div>
      <div style={{ position: "absolute", left: 130, top: 440 + size * 1.5, fontFamily: F.mono, fontSize: 24, letterSpacing: "0.16em", color: t.good, opacity: ramp(f, 44, 54) }}>THE ANSWER, COMPUTED IN CODE</div>
      <div style={{ position: "absolute", left: 130, top: 480 + size * 1.5, fontFamily: F.mono, fontWeight: 700, fontSize: size, letterSpacing: "0.04em", color: t.good, opacity: ramp(f, 44, 56) }}>{correct}</div>
      <Pill t={t} text={pill} /><Foot text={foot} />
    </Field>
  );
}

/** 7. Explainer flow (h5zkzon0gM4 "source code -> compilation -> binary"): boxes joined by drawn connectors, a dot travels the path. steps: [{ title, text }] */
export function Flow({ t, title, steps, pill, foot }) {
  const f = useCurrentFrame(), n = steps.length, bw = Math.min(380, 1560 / n - 50), gap = (1660 - n * bw) / (n - 1), X = (i) => 130 + i * (bw + gap), travel = lerp(f, 40, 40 + n * 22, 0, n - 1, eio);
  return (
    <Field t={t}>
      <div style={{ position: "absolute", left: 130, top: 130, fontFamily: F.sans, fontWeight: 700, fontSize: 54, color: "#fff" }}>{title}</div>
      <svg width="1920" height="1080" style={{ position: "absolute" }}>{steps.slice(0, -1).map((_, i) => { const p = ramp(f, 20 + i * 14, 36 + i * 14); return <g key={i}><line x1={X(i) + bw} y1="540" x2={X(i) + bw + gap * p} y2="540" stroke={t.accent} strokeWidth="5" />{p > 0.95 && <path d={`M${X(i + 1) - 18} 526 L${X(i + 1) - 2} 540 L${X(i + 1) - 18} 554`} fill="none" stroke={t.accent} strokeWidth="5" />}</g>; })}
        <circle cx={X(Math.floor(travel)) + bw / 2 + (travel % 1) * (bw + gap)} cy="372" r="12" fill={t.accent} opacity={f > 40 ? 1 : 0} /></svg>
      {steps.map((s, i) => { const a = ramp(f, 6 + i * 14, 22 + i * 14, expo), hot = Math.round(travel) === i && f > 40; return (
        <div key={i} style={{ position: "absolute", left: X(i), top: 400, width: bw, height: 290, background: hot ? "#1b2230" : "#12151a", border: `2px solid ${hot ? t.accent : "rgba(255,255,255,0.18)"}`, borderRadius: 16, padding: 26, boxSizing: "border-box", opacity: a, transform: `translateY(${(1 - a) * 30}px)` }}>
          <div style={{ fontFamily: F.mono, fontSize: 20, color: t.accent }}>{String(i + 1).padStart(2, "0")}</div>
          <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 34, color: "#fff", marginTop: 8, lineHeight: 1.15 }}>{s.title}</div>
          <div style={{ fontFamily: F.sans, fontSize: 23, lineHeight: 1.4, color: "rgba(255,255,255,0.72)", marginTop: 12 }}>{s.text}</div>
        </div>); })}
      <Pill t={t} text={pill} /><Foot text={foot} />
    </Field>
  );
}

/** 8. Side-by-side: the same problems under two conditions, column titles on top (cUeZMUGCxrw comparison). cols: [{ title, rows:[{ label, right, of }] }] */
export function Compare({ t, title, cols, pill, foot }) {
  const f = useCurrentFrame();
  return (
    <Field t={t}>
      <div style={{ position: "absolute", left: 130, top: 96, fontFamily: F.sans, fontWeight: 700, fontSize: 50, color: "#fff" }}>{title}</div>
      {cols.map((c, ci) => <div key={ci} style={{ position: "absolute", left: 130 + ci * 850, top: 210, width: 810, height: 760, background: "#12151a", border: `2px solid ${c.best ? t.accent : "rgba(255,255,255,0.14)"}`, borderRadius: 16, padding: 34, boxSizing: "border-box" }}>
        <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 36, color: c.best ? t.accent : "#fff" }}>{c.title}</div>
        <div style={{ fontFamily: F.mono, fontSize: 21, color: "rgba(255,255,255,0.6)", marginTop: 8, minHeight: 60 }}>{c.prompt}</div>
        {c.rows.map((r, ri) => { const a = ramp(f, 16 + ci * 20 + ri * 8, 40 + ci * 20 + ri * 8, expo); return <div key={ri} style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 26 }}>
          <div style={{ width: 150, fontFamily: F.mono, fontSize: 24, color: "#fff" }}>{r.label}</div>
          <div style={{ flex: 1, height: 38, background: "rgba(255,255,255,0.07)", borderRadius: 6 }}><div style={{ width: `${(r.right / r.of) * 100 * a}%`, height: "100%", background: r.right === 0 ? t.bad : c.best ? t.accent : "#cfd5dd", borderRadius: 6, minWidth: r.right === 0 ? 6 : 0 }} /></div>
          <div style={{ width: 90, fontFamily: F.mono, fontWeight: 700, fontSize: 34, color: r.right === 0 ? t.bad : "#fff", textAlign: "right" }}>{r.right}/{r.of}</div>
        </div>; })}
      </div>)}
      <Pill t={t} text={pill} /><Foot text={foot} />
    </Field>
  );
}

/** 9. Verdict: what the run showed, in one line, with its limits listed (so the claim cannot grow in the telling). */
export function Verdict({ t, line, points = [], limits = [], pill, foot }) {
  const f = useCurrentFrame();
  return (
    <Field t={t}>
      <div style={{ position: "absolute", left: 130, top: 130, fontFamily: F.mono, fontSize: 26, letterSpacing: "0.2em", color: t.accent }}>WHAT THIS RUN SHOWED</div>
      <div style={{ position: "absolute", left: 126, top: 180, width: 1660, fontFamily: F.sans, fontWeight: 700, fontSize: 84, lineHeight: 1.08, color: "#fff", opacity: ramp(f, 4, 20), letterSpacing: "-0.01em" }}>{line}</div>
      <div style={{ position: "absolute", left: 130, top: 560, width: 800 }}>{points.map((p, i) => <div key={i} style={{ fontFamily: F.sans, fontSize: 32, lineHeight: 1.35, color: "#fff", marginBottom: 18, opacity: ramp(f, 26 + i * 10, 38 + i * 10), display: "flex", gap: 16 }}><span style={{ color: t.good, fontWeight: 700 }}>●</span>{p}</div>)}</div>
      <div style={{ position: "absolute", left: 1010, top: 560, width: 780, background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 28, boxSizing: "border-box", opacity: ramp(f, 50, 64) }}><div style={{ fontFamily: F.mono, fontSize: 20, letterSpacing: "0.16em", color: "rgba(255,255,255,0.6)", marginBottom: 10 }}>LIMITS OF THIS TEST</div>{limits.map((p, i) => <div key={i} style={{ fontFamily: F.sans, fontSize: 25, lineHeight: 1.4, color: "rgba(255,255,255,0.82)", marginBottom: 10 }}>· {p}</div>)}</div>
      <Pill t={t} text={pill} /><Foot text={foot} />
    </Field>
  );
}

/** Thumbnail: the real wrong digits, one verdict word. */
export function AiThumb({ t, big, small, a, b, answer, correct, num, of, numLabel }) {
  // trust-test variant: a headline, one giant measured count ("12 of 36"), what it counts, and a verdict tag
  if (num != null) return (
    <AbsoluteFill style={{ background: "#07090c" }}><Fonts />
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${t.dot} 2px, transparent 2px)`, backgroundSize: "44px 44px", opacity: 0.6 }} />
      <div style={{ position: "absolute", left: 80, top: 70, fontFamily: F.sans, fontWeight: 700, fontSize: 170, lineHeight: 1, color: "#fff", letterSpacing: "-0.03em", whiteSpace: "pre-line" }}>{big}</div>
      <div style={{ position: "absolute", left: 80, top: 520, fontFamily: F.mono, fontWeight: 700, fontSize: 330, lineHeight: 1, color: t.bad, letterSpacing: "-0.04em" }}>{num}{of != null && <span style={{ fontSize: 150, color: "rgba(255,255,255,0.75)" }}> of {of}</span>}</div>
      <div style={{ position: "absolute", left: 90, top: 880, fontFamily: F.sans, fontWeight: 700, fontSize: 70, color: "rgba(255,255,255,0.88)" }}>{numLabel}</div>
      {small && <div style={{ position: "absolute", right: 80, top: 80, fontFamily: F.sans, fontWeight: 700, fontSize: 80, color: "#0a0c10", background: t.accent, padding: "4px 28px", transform: "rotate(3deg)" }}>{small}</div>}
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill style={{ background: "#07090c" }}><Fonts />
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${t.dot} 2px, transparent 2px)`, backgroundSize: "44px 44px", opacity: 0.6 }} />
      <div style={{ position: "absolute", left: 80, top: 70, fontFamily: F.sans, fontWeight: 700, fontSize: 190, lineHeight: 0.98, color: "#fff", letterSpacing: "-0.03em", whiteSpace: "pre-line" }}>{big}</div>
      <div style={{ position: "absolute", left: 84, top: 560, fontFamily: F.mono, fontWeight: 700, fontSize: 78, color: "rgba(255,255,255,0.85)" }}>{a} × {b} =</div>
      <div style={{ position: "absolute", left: 84, top: 680, transform: "rotate(-2deg)", transformOrigin: "left center" }}><DigitDiff answer={answer} correct={correct} size={150} t={t} /></div>
      {small && <div style={{ position: "absolute", right: 80, bottom: 70, fontFamily: F.sans, fontWeight: 700, fontSize: 96, color: "#0a0c10", background: t.bad, padding: "4px 30px", transform: "rotate(-4deg)" }}>{small}</div>}
    </AbsoluteFill>
  );
}

// ---- Rebuild of 15 Nov 2026 (reference AI Search S7lpCyZSdJQ, median shot 4.2 s): the owner found the first AI Tested clone "one page, no motion".
// Seq cuts one beat into several shots so the picture changes with every sentence; Bars, Stat and Quote add counters, drawn bars and highlighted quotes.

/** 10. Several shots inside one beat, hard cuts between them. parts: [{ w, scene }]: each part's share of the beat is w / sum(w) (the episode
 * sets w to the character count of the sentence it shows, so the cut lands close to where that sentence starts in the voice). */
export function Seq({ t, parts, pill, foot }) {
  const { durationInFrames: D } = useVideoConfig(), tot = parts.reduce((s, p) => s + (p.w || 1), 0);
  let acc = 0; const starts = parts.map((p) => { const s = Math.round((acc / tot) * D); acc += p.w || 1; return s; });
  return <AbsoluteFill style={{ background: t.bg }}>{parts.map((p, i) => { const C = AITEST[p.scene.type]; const len = (starts[i + 1] ?? D) - starts[i]; return <Sequence key={i} from={starts[i]} durationInFrames={len}><AbsoluteFill style={{ filter: p.scene.invert ? "invert(1) hue-rotate(180deg)" : undefined }}>{C ? <C t={t} pill={pill} foot={foot} {...p.scene} /> : null}</AbsoluteFill></Sequence>; })}</AbsoluteFill>;
}

/** 11. Bar chart that draws itself: bars grow in turn, each value counts up, the bar under discussion is lit (AI Search benchmark charts). bars: [{ label, value, hi }] */
export function Bars({ t, title, sub, bars, unit = "%", prefix = "", max, decimals = 1, note, lower, pill, foot }) {
  const f = useCurrentFrame(), n = bars.length, top = max ?? Math.max(...bars.map((b) => b.value)) * 1.12, bw = Math.min(220, 1400 / n - 40), gap = (1500 - n * bw) / Math.max(1, n - 1), base = 860, hMax = 520;
  return (
    <Field t={t}>
      <div style={{ position: "absolute", left: 150, top: 92, fontFamily: F.sans, fontWeight: 700, fontSize: 52, color: "#fff", opacity: ramp(f, 0, 10), transform: `translateY(${(1 - ramp(f, 0, 12)) * 16}px)` }}>{title}</div>
      {sub && <div style={{ position: "absolute", left: 152, top: 162, fontFamily: F.sans, fontSize: 26, color: "rgba(255,255,255,0.65)", opacity: ramp(f, 6, 16) }}>{sub}{lower ? " · lower is better" : ""}</div>}
      <div style={{ position: "absolute", left: 150, top: base, width: 1620, height: 3, background: "rgba(255,255,255,0.25)" }} />
      {bars.map((b, i) => { const a = ramp(f, 10 + i * 7, 40 + i * 7, expo), h = (b.value / top) * hMax * a, x = 210 + i * (bw + gap), col = b.hi ? (b.color || t.accent) : b.color || "#4a515c", lit = b.hi && f > 50; return (
        <React.Fragment key={i}>
          <div style={{ position: "absolute", left: x, top: base - h, width: bw, height: h, background: col, borderRadius: "8px 8px 0 0", boxShadow: lit ? `0 0 0 4px ${t.bg}, 0 0 0 8px ${col}` : "none" }} />
          <div style={{ position: "absolute", left: x - 30, width: bw + 60, top: base - h - 64, textAlign: "center", fontFamily: F.mono, fontWeight: 700, fontSize: b.hi ? 48 : 38, color: b.hi ? "#fff" : "rgba(255,255,255,0.8)", opacity: ramp(f, 12 + i * 7, 20 + i * 7) }}>{prefix}{(b.value * a).toFixed(decimals)}{unit}</div>
          <div style={{ position: "absolute", left: x - 40, width: bw + 80, top: base + 18, textAlign: "center", fontFamily: F.sans, fontWeight: b.hi ? 700 : 500, fontSize: 25, lineHeight: 1.2, color: b.hi ? "#fff" : "rgba(255,255,255,0.7)", opacity: ramp(f, 8 + i * 7, 18 + i * 7) }}>{b.label}</div>
        </React.Fragment>); })}
      {note && <div style={{ position: "absolute", right: 150, top: 230, maxWidth: 760, fontFamily: F.sans, fontWeight: 700, fontSize: 30, color: "#0a0c10", background: t.accent, padding: "10px 20px", opacity: ramp(f, 60, 70), transform: `translateX(${(1 - ramp(f, 60, 72)) * 40}px)` }}>{note}</div>}
      <Pill t={t} text={pill} /><Foot text={foot} />
    </Field>
  );
}

/** 12. One measured number, counted up, then set against its comparison (a median, an earlier model) as two drawn bars. */
export function Stat({ t, value, decimals = 0, prefix = "", suffix = "", label, sub, vs, pill, foot }) {
  const f = useCurrentFrame(), k = ramp(f, 4, 34, expo), big = vs ? 230 : 300;
  return (
    <Field t={t}>
      <div style={{ position: "absolute", left: 150, top: vs ? 150 : 230, fontFamily: F.mono, fontWeight: 700, fontSize: big, lineHeight: 1, color: "#fff", letterSpacing: "-0.04em" }}>{prefix}{(value * k).toFixed(decimals)}<span style={{ color: t.accent }}>{suffix}</span></div>
      <div style={{ position: "absolute", left: 158, top: (vs ? 150 : 230) + big + 20, fontFamily: F.sans, fontWeight: 700, fontSize: 46, color: "#fff", opacity: ramp(f, 16, 28), maxWidth: 1600 }}>{label}</div>
      {sub && <div style={{ position: "absolute", left: 160, top: (vs ? 150 : 230) + big + 84, fontFamily: F.sans, fontSize: 28, color: "rgba(255,255,255,0.62)", opacity: ramp(f, 22, 34), maxWidth: 1600 }}>{sub}</div>}
      {vs && [{ label: vs.mine || "This model", value, hi: true }, { label: vs.label, value: vs.value }].map((r, i) => { const top = Math.max(value, vs.value), p = ramp(f, 46 + i * 10, 76 + i * 10, expo); return (
        <div key={i} style={{ position: "absolute", left: 160, top: 690 + i * 110, display: "flex", alignItems: "center", gap: 24, opacity: ramp(f, 44 + i * 10, 52 + i * 10) }}>
          <div style={{ width: 360, fontFamily: F.sans, fontSize: 28, color: "rgba(255,255,255,0.8)" }}>{r.label}</div>
          <div style={{ width: (r.value / top) * 1000 * p, height: 56, background: r.hi ? t.accent : "#4a515c", borderRadius: 6 }} />
          <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 40, color: "#fff" }}>{prefix}{(r.value * p).toFixed(decimals)}{suffix}</div>
        </div>); })}
      <Pill t={t} text={pill} /><Foot text={foot} />
    </Field>
  );
}

/** 13. A tester's quote as published on the source page: the words arrive, then a marker draws across the line that matters. hl: exact substrings of text. */
export function Quote({ t, text, hl = [], who, org, pill, foot }) {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), words = text.split(" "), shownN = Math.floor(((f - 6) / fps) * 14), markAt = 6 + (words.length / 14) * fps + 8;
  const size = text.length > 260 ? 40 : text.length > 160 ? 48 : 58;
  let pos = 0; const spans = words.map((w, i) => { const s = pos; pos += w.length + 1; const inHl = hl.some((h) => { const a = text.indexOf(h); return a > -1 && s >= a && s < a + h.length; }); return { w, i, inHl }; });
  const m = ramp(f, markAt, markAt + 16, eio);
  return (
    <Field t={t}>
      <div style={{ position: "absolute", left: 140, top: 80, fontFamily: F.serif, fontSize: 240, lineHeight: 1, color: t.accent, opacity: ramp(f, 0, 8) }}>“</div>
      <div style={{ position: "absolute", left: 200, top: 250, width: 1520, fontFamily: F.serif, fontSize: size, lineHeight: 1.35, color: "#fff" }}>
        {spans.map(({ w, i, inHl }) => <span key={i} style={{ opacity: i < shownN ? 1 : 0.0, backgroundImage: inHl ? `linear-gradient(${t.accent}, ${t.accent})` : "none", backgroundRepeat: "no-repeat", backgroundSize: `${m * 100}% 100%`, color: inHl && m > 0.5 ? "#0a0c10" : "#fff" }}>{w} </span>)}
      </div>
      <div style={{ position: "absolute", left: 204, bottom: 110, fontFamily: F.sans, fontSize: 30, color: "rgba(255,255,255,0.8)", opacity: ramp(f, 14, 26) }}><b style={{ color: "#fff" }}>{who}</b>{org ? ` · ${org}` : ""}</div>
      <Pill t={t} text={pill} /><Foot text={foot} />
    </Field>
  );
}


/** 14. A real recorded run (scripts/clone/demo-record.mjs): the screen recording itself, full bleed, with a slow push toward `focus`
 * (the reference zooms into the chat and the running app). The label says which provider and model; it is the run log's own values. */
const Rec = ({ video, len, style }) => { const f = useCurrentFrame(); return <Freeze frame={Math.min(f, Math.max(1, Math.round(len * 30) - 3))}><OffthreadVideo src={src(video)} muted style={style} /></Freeze>; };
export function Run({ t, video, videoLen = 12, label, model, tag, ok, zoom = [1.0, 1.14], focus = "50% 45%", start = 0, pill, foot }) {
  const f = useCurrentFrame(), { durationInFrames } = useVideoConfig(), z = interpolate(f, [0, durationInFrames], zoom, clamp), a = ramp(f, 4, 16, expo);
  return (
    <AbsoluteFill style={{ background: "#0d0e10" }}><Fonts />
      <AbsoluteFill style={{ transform: `scale(${z})`, transformOrigin: focus }}>
        <Sequence from={-Math.round(start * 30)}><Rec video={video} len={videoLen} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /></Sequence>
      </AbsoluteFill>
      {label && <div style={{ position: "absolute", left: 48, bottom: 48, display: "flex", alignItems: "center", gap: 14, background: "rgba(10,11,14,0.9)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 12, padding: "12px 20px", opacity: a, transform: `translateY(${(1 - a) * 16}px)` }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: ok === false ? "#ff5d5d" : t.accent }} />
        <span style={{ fontFamily: F.sans, fontWeight: 800, fontSize: 30, color: "#fff" }}>{label}</span>
        {model && <span style={{ fontFamily: F.mono, fontSize: 22, color: "rgba(255,255,255,0.7)" }}>{model}</span>}
        {tag && <span style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 22, color: "#0a0c10", background: ok === false ? "#ff5d5d" : t.accent, borderRadius: 6, padding: "3px 10px" }}>{tag}</span>}
      </div>}
      <Pill t={t} text={pill} /><Foot text={foot} />
    </AbsoluteFill>
  );
}

/** 15. Four runs of the same prompt side by side (the reference's split-screen comparisons). Each cell: the recording, provider label,
 * and a result tag from the run log (e.g. "ran", "no app"). Cells light up one after another. */
export function Quad({ t, title, cells = [], pill, foot }) {
  const f = useCurrentFrame(), W = 900, H = 506;
  return (
    <AbsoluteFill style={{ background: "#0d0e10" }}><Fonts />
      {title && <div style={{ position: "absolute", left: 0, right: 0, top: 22, textAlign: "center", fontFamily: F.sans, fontWeight: 800, fontSize: 34, color: "#fff", opacity: ramp(f, 0, 10) }}>{title}</div>}
      {cells.slice(0, 4).map((c, i) => { const a = ramp(f, 6 + i * 8, 20 + i * 8, expo), x = 50 + (i % 2) * (W + 20), y = 76 + Math.floor(i / 2) * (H + 18);
        return (<div key={i} style={{ position: "absolute", left: x, top: y, width: W, height: H, borderRadius: 14, overflow: "hidden", border: `2px solid ${c.ok === false ? "#ff5d5d" : "rgba(255,255,255,0.16)"}`, opacity: a, transform: `scale(${0.94 + 0.06 * a})`, background: "#000" }}>
          {c.video ? <Rec video={c.video} len={c.videoLen || 10} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.sans, fontWeight: 800, fontSize: 40, color: "#ff5d5d" }}>{c.empty || "nothing ran"}</div>}
          <div style={{ position: "absolute", left: 14, top: 12, display: "flex", gap: 10, alignItems: "center", background: "rgba(10,11,14,0.88)", borderRadius: 8, padding: "6px 12px" }}>
            <span style={{ fontFamily: F.sans, fontWeight: 800, fontSize: 24, color: "#fff" }}>{c.label}</span>
            {c.tag && <span style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 18, color: "#0a0c10", background: c.ok === false ? "#ff5d5d" : t.accent, borderRadius: 5, padding: "2px 8px" }}>{c.tag}</span>}
          </div>
        </div>); })}
      <Pill t={t} text={pill} /><Foot text={foot} />
    </AbsoluteFill>
  );
}

export const AITEST = { browser: Browser, terminal: Terminal, chat: Chat, accuracy: Accuracy, grid: Grid, miss: Miss, flow: Flow, compare: Compare, verdict: Verdict, thumb: AiThumb, seq: Seq, bars: Bars, stat: Stat, quote: Quote, run: Run, quad: Quad };
