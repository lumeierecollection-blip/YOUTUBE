import React from "react";
import { C, CANVAS, F, OUT, clamp } from "./kit7";

// Data widgets drawn in the reference's ink-on-paper language. Every number shown here must come from a
// facts file; the plan validator checks that (plan-lib.mjs). Times (`at`) are seconds from beat start.
export type Row = { label: string; value: number; at: number; color?: string; text?: string };
export type Widget =
  | { k: "counter"; x: number; y: number; to: number; from?: number; decimals?: number; prefix?: string; suffix?: string; label?: string; at: number; dur?: number; size?: number; bar?: string }
  | { k: "bars"; x: number; y: number; w: number; rowH?: number; max: number; rows: Row[]; unit?: string; decimals?: number; group?: string }
  | { k: "timeline"; x: number; y: number; w: number; items: { date: string; label: string; at: number }[] }
  | { k: "compare"; x: number; y: number; w: number; left: { title: string; rows: { k: string; v: string; at: number }[] }; right: { title: string; rows: { k: string; v: string; at: number }[] }; badge?: { text: string; at: number } }
  | { k: "line"; x: number; y: number; w: number; h: number; series: { label: string; points: { x: number; y: number; label?: string; at: number }[] }[]; xLabel?: string; yLabel?: string; yMin?: number; yMax?: number }
  | { k: "doc"; x: number; y: number; w: number; title: string; lines: { text: string; hl?: boolean; at: number }[] }
  | { k: "terminal"; x: number; y: number; w: number; lines: { text: string; at: number; big?: boolean }[] };

const p01 = (t: number, at: number, d = 0.4) => OUT(clamp((t - at) / d, 0, 1));
const inkText = (bar: string) => (bar === "blue" || bar === "red" ? "#fff" : C.ink);
const barStyle = (bar: string | undefined, p: number): React.CSSProperties => bar ? ({ backgroundImage: `linear-gradient(${C.bars[bar]},${C.bars[bar]})`, backgroundRepeat: "no-repeat", backgroundPosition: "0 62%", backgroundSize: `${p * 100}% 72%`, padding: "0 14px", color: inkText(bar) }) : {};

const Counter: React.FC<Extract<Widget, { k: "counter" }> & { bt: number; plate?: string }> = (w) => {
  // Eases to the final value in 0.25 s so no unlisted intermediate number stays on screen.
  const p = p01(w.bt, w.at, Math.min(w.dur ?? 1.1, 0.25));
  const v = (w.from ?? 0) + (w.to - (w.from ?? 0)) * p;
  const txt = `${w.prefix ?? ""}${v.toFixed(w.decimals ?? 0)}${w.suffix ?? ""}`;
  const finalLen = `${w.prefix ?? ""}${w.to.toFixed(w.decimals ?? 0)}${w.suffix ?? ""}`.length;
  const size = Math.min(w.size ?? 330, Math.floor((CANVAS.w * 0.84) / (Math.max(finalLen, 2) * 0.72)));
  const ink = w.plate && w.plate !== "paper" ? "#F4F4F0" : C.ink;
  const vis = clamp((w.bt - w.at) / 0.12, 0, 1);
  return <div style={{ position: "absolute", left: w.x * CANVAS.w, top: w.y * CANVAS.h, transform: "translate(-50%,-50%)", textAlign: "center", opacity: vis, maxWidth: CANVAS.w * 0.92 }}>
    <div style={{ fontFamily: F.sans, fontSize: size, lineHeight: 0.9, letterSpacing: "-0.05em", whiteSpace: "nowrap", color: w.bar ? inkText(w.bar) : ink, ...barStyle(w.bar, vis), display: "inline-block" }}>{txt}</div>
    {w.label ? <div style={{ fontFamily: F.serif, fontStyle: "italic", fontSize: 92, lineHeight: 1, marginTop: 18, color: ink, opacity: p01(w.bt, w.at + 0.25, 0.35) }}>{w.label}</div> : null}
  </div>;
};

const Bars: React.FC<Extract<Widget, { k: "bars" }> & { bt: number }> = (w) => {
  const rowH = w.rowH ?? 150;
  const labelW = w.w * CANVAS.w * 0.3;
  const trackW = w.w * CANVAS.w - labelW - 40;
  return <div style={{ position: "absolute", left: (w.x - w.w / 2) * CANVAS.w, top: w.y * CANVAS.h - (w.rows.length * rowH) / 2, width: w.w * CANVAS.w }}>
    {w.rows.map((r, i) => {
      const p = p01(w.bt, r.at, 0.7);
      const vis = clamp((w.bt - r.at) / 0.1, 0, 1);
      const col = r.color ? C.bars[r.color] : C.ink;
      const val = r.value * p;
      return <div key={i} style={{ height: rowH, display: "flex", alignItems: "center", opacity: vis }}>
        <div style={{ width: labelW, fontFamily: F.serif, fontStyle: "italic", fontSize: 78, lineHeight: 1, color: C.ink }}>{r.label}</div>
        <div style={{ position: "relative", width: trackW, height: rowH * 0.62, background: "rgba(0,0,0,0.06)" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(r.value / w.max) * p * 100}%`, background: col }} />
          <div style={{ position: "absolute", left: `${Math.min(88, (r.value / w.max) * p * 100 + 2)}%`, top: "50%", transform: "translateY(-50%)", fontFamily: F.sans, fontSize: 84, letterSpacing: "-0.04em", color: C.ink, whiteSpace: "nowrap" }}>{r.text ?? `${w.unit ?? ""}${val.toFixed(w.decimals ?? 0)}`}</div>
        </div>
      </div>;
    })}
  </div>;
};

const Timeline: React.FC<Extract<Widget, { k: "timeline" }> & { bt: number }> = (w) => {
  const W = w.w * CANVAS.w, step = 190;
  const h = (w.items.length - 1) * step;
  const last = w.items.reduce((m, i) => Math.max(m, i.at), 0);
  const draw = clamp((w.bt - w.items[0].at) / Math.max(0.3, last - w.items[0].at + 0.4), 0, 1);
  return <div style={{ position: "absolute", left: (w.x - w.w / 2) * CANVAS.w, top: w.y * CANVAS.h - h / 2, width: W }}>
    <div style={{ position: "absolute", left: 36, top: 0, width: 5, height: h * draw, background: C.ink }} />
    {w.items.map((it, i) => {
      const p = p01(w.bt, it.at, 0.35);
      return <div key={i} style={{ position: "absolute", left: 0, top: i * step - 36, width: W, opacity: p, transform: `translateX(${(1 - p) * -30}px)`, display: "flex", alignItems: "center" }}>
        <div style={{ width: 77, height: 77, borderRadius: 99, background: C.ink, flex: "none" }} />
        <div style={{ marginLeft: 36 }}>
          <div style={{ fontFamily: F.sans, fontSize: 56, letterSpacing: "-0.03em", color: C.ink, lineHeight: 1 }}>{it.date}</div>
          <div style={{ fontFamily: F.serif, fontStyle: "italic", fontSize: 76, lineHeight: 1, color: C.ink, marginTop: 4 }}>{it.label}</div>
        </div>
      </div>;
    })}
  </div>;
};

const Compare: React.FC<Extract<Widget, { k: "compare" }> & { bt: number }> = (w) => {
  const W = w.w * CANVAS.w, colW = W / 2 - 24, rowH = 170;
  const col = (side: typeof w.left, right: boolean) => <div style={{ width: colW, textAlign: "center" }}>
    <div style={{ fontFamily: F.sans, fontSize: 120, letterSpacing: "-0.05em", color: C.ink, marginBottom: 26, opacity: p01(w.bt, side.rows[0].at - 0.2, 0.3) }}>{side.title}</div>
    {side.rows.map((r, i) => {
      const p = p01(w.bt, r.at, 0.35);
      return <div key={i} style={{ height: rowH, opacity: p, transform: `translateY(${(1 - p) * 24}px)`, borderTop: `3px solid ${C.ink}`, paddingTop: 14 }}>
        <div style={{ fontFamily: F.serif, fontStyle: "italic", fontSize: 58, color: "rgba(17,17,17,0.7)", lineHeight: 1 }}>{r.k}</div>
        <div style={{ fontFamily: F.sans, fontSize: 98, letterSpacing: "-0.04em", color: C.ink, lineHeight: 1.05 }}>{r.v}</div>
      </div>;
    })}
  </div>;
  return <div style={{ position: "absolute", left: (w.x - w.w / 2) * CANVAS.w, top: w.y * CANVAS.h - 360, width: W, display: "flex", justifyContent: "space-between" }}>
    {col(w.left, false)}{col(w.right, true)}
    {w.badge ? <div style={{ position: "absolute", left: "50%", top: 330, transform: `translate(-50%,-50%) scale(${0.6 + 0.4 * p01(w.bt, w.badge.at, 0.3)})`, opacity: p01(w.bt, w.badge.at, 0.2), background: C.bars.yellow, padding: "6px 34px", fontFamily: F.sans, fontSize: 170, letterSpacing: "-0.05em", color: C.ink }}>{w.badge.text}</div> : null}
  </div>;
};

const Line: React.FC<Extract<Widget, { k: "line" }> & { bt: number }> = (w) => {
  const W = w.w * CANVAS.w, H = w.h * CANVAS.h;
  const xs = w.series.flatMap(s => s.points.map(p => p.x)), ys = w.series.flatMap(s => s.points.map(p => p.y));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = w.yMin ?? Math.min(...ys), y1 = w.yMax ?? Math.max(...ys);
  const px = (x: number) => 70 + ((x - x0) / Math.max(1e-9, x1 - x0)) * (W - 120);
  const py = (y: number) => H - 60 - ((y - y0) / Math.max(1e-9, y1 - y0)) * (H - 130);
  return <div style={{ position: "absolute", left: (w.x - w.w / 2) * CANVAS.w, top: w.y * CANVAS.h - H / 2, width: W, height: H }}>
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      <line x1={70} y1={H - 60} x2={W - 50} y2={H - 60} stroke={C.ink} strokeWidth={4} />
      <line x1={70} y1={20} x2={70} y2={H - 60} stroke={C.ink} strokeWidth={4} />
      {w.series.map((s, si) => {
        const pts = s.points;
        const colr = si === 0 ? C.ink : "#1018E0";
        const segs = pts.slice(1).map((pt, i) => {
          const a = pts[i], b = pt;
          const p = p01(w.bt, b.at - 0.5, 0.5);
          return <line key={i} x1={px(a.x)} y1={py(a.y)} x2={px(a.x) + (px(b.x) - px(a.x)) * p} y2={py(a.y) + (py(b.y) - py(a.y)) * p} stroke={colr} strokeWidth={9} strokeLinecap="round" />;
        });
        return <g key={si}>{segs}{pts.map((pt, i) => <circle key={i} cx={px(pt.x)} cy={py(pt.y)} r={16} fill={colr} opacity={p01(w.bt, pt.at, 0.2)} />)}
          {pts.map((pt, i) => pt.label ? <text key={"t" + i} x={px(pt.x)} y={py(pt.y) - 34} textAnchor="middle" fontFamily={F.sans} fontSize={56} fill={C.ink} opacity={p01(w.bt, pt.at, 0.3)}>{pt.label}</text> : null)}</g>;
      })}
      {w.xLabel ? <text x={W / 2} y={H + 10} textAnchor="middle" fontFamily={F.serif} fontStyle="italic" fontSize={52} fill={C.ink}>{w.xLabel}</text> : null}
    </svg>
  </div>;
};

const Doc: React.FC<Extract<Widget, { k: "doc" }> & { bt: number }> = (w) => {
  const W = w.w * CANVAS.w;
  const p = p01(w.bt, 0, 0.35);
  return <div style={{ position: "absolute", left: (w.x - w.w / 2) * CANVAS.w, top: w.y * CANVAS.h, width: W, transform: `translateY(calc(-50% + ${(1 - p) * 40}px))`, opacity: p, background: "#F4F5F2", border: "2px solid rgba(0,0,0,0.3)", boxShadow: "0 30px 60px rgba(0,0,0,0.18)", padding: "54px 56px" }}>
    <div style={{ fontFamily: F.sans, fontSize: 46, letterSpacing: "0.06em", color: C.ink, textTransform: "uppercase", borderBottom: `4px solid ${C.ink}`, paddingBottom: 18, marginBottom: 28 }}>{w.title}</div>
    {w.lines.map((l, i) => {
      const lp = p01(w.bt, l.at, 0.3);
      return <div key={i} style={{ fontFamily: F.serif, fontStyle: "italic", fontSize: 74, lineHeight: 1.08, color: C.ink, margin: "14px 0", opacity: lp, ...(l.hl ? { backgroundImage: `linear-gradient(${C.bars.yellow},${C.bars.yellow})`, backgroundRepeat: "no-repeat", backgroundPosition: "0 78%", backgroundSize: `${lp * 100}% 62%` } : {}) }}>{l.text}</div>;
    })}
  </div>;
};

const Terminal: React.FC<Extract<Widget, { k: "terminal" }> & { bt: number }> = (w) => {
  const W = w.w * CANVAS.w;
  return <div style={{ position: "absolute", left: (w.x - w.w / 2) * CANVAS.w, top: w.y * CANVAS.h, width: W, transform: "translateY(-50%)", fontFamily: F.mono, color: C.termGlow, textShadow: `0 0 18px ${C.termGlow}` }}>
    {w.lines.map((l, i) => {
      const p = p01(w.bt, l.at, 0.2);
      const full = l.text;
      const shown = full.slice(0, Math.ceil(full.length * clamp((w.bt - l.at) / 0.35, 0, 1)));
      return <div key={i} style={{ fontSize: l.big ? 150 : 56, fontWeight: 800, lineHeight: 1.15, opacity: p > 0 ? 1 : 0, whiteSpace: "pre", marginBottom: 12 }}>{shown}</div>;
    })}
  </div>;
};

export const WidgetView: React.FC<{ w: Widget; bt: number; plate?: string }> = ({ w, bt, plate }) => {
  switch (w.k) {
    case "counter": return <Counter {...w} bt={bt} plate={plate} />;
    case "bars": return <Bars {...w} bt={bt} />;
    case "timeline": return <Timeline {...w} bt={bt} />;
    case "compare": return <Compare {...w} bt={bt} />;
    case "line": return <Line {...w} bt={bt} />;
    case "doc": return <Doc {...w} bt={bt} />;
    case "terminal": return <Terminal {...w} bt={bt} />;
  }
  return null;
};

