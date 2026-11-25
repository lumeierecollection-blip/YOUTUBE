import React from "react";
import { AbsoluteFill, Img, interpolate } from "remotion";
import { F, Theme, SAFE, clamp, num, useAnim, stagger, fitText, asset, Logo, Kicker, Headline, SubText, Chip, Panel, Credit, OUT, IO } from "./kit";

export type Side = { title: string; logo?: string; color?: string; tag?: string; rows: { k: string; v: string }[] };
export type Beat = {
  t: number; dur: number; narration: string; scene: string; kicker?: string; headline?: string; sub?: string;
  accent?: string; theme?: Partial<Theme>; transition?: string; credit?: string; cta?: string;
  hl?: string[];
  media?: { src: string; role?: string; credit?: string; w?: number; h?: number }[];
  logos?: { id: string; label: string; color?: string }[];
  items?: { label: string; value?: string; note?: string; color?: string; strike?: boolean }[];
  stat?: { value: number; prefix?: string; suffix?: string; decimals?: number; label?: string; dots?: number; ghost?: string };
  chart?: { unit?: string; prefix?: string; yMax?: number; xTitle?: string; note?: string; ratio?: string; ratioLabel?: string;
    series?: { name: string; color?: string; points: { x: string; y: number }[] }[];
    rows?: { label: string; values: { name?: string; v: number; color?: string }[] }[] };
  compare?: { left: Side; right: Side; vs?: string; win?: string };
  crops?: { x: number; y: number; w: number; h: number; label: string }[];
  doc?: { title: string; sub?: string; stamp?: string; clauses?: string[] };
  callouts?: string[];
  ghost?: string;
  focus?: { x?: number; y?: number };
};
type P = { beat: Beat; th: Theme };

const TOP = SAFE.top;
const W = 1080 - SAFE.x * 2;
const fmt = (n: number, dec = 0) => n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const Ghost: React.FC<{ th: Theme; text?: string; y?: number; size?: number; stroke?: boolean }> = ({ th, text, y = 520, size = 420, stroke = true }) => {
  const a = useAnim();
  if (!text) return null;
  const dx = interpolate(a.t, [0, a.dur], [40, -60]);
  return <div style={{ position: "absolute", left: 0, right: 0, top: y, textAlign: "center", fontFamily: F[th.display || "anton"], fontWeight: 800, fontSize: size, lineHeight: 0.9, color: stroke ? "transparent" : th.accent, WebkitTextStroke: stroke ? `4px ${th.accent}` : undefined, opacity: 0.22 * a.r(0, 0.6), transform: `translateX(${dx}px)`, whiteSpace: "nowrap", letterSpacing: "0.02em" }}>{text.toUpperCase()}</div>;
};

const Head: React.FC<P & { top?: number; maxH?: number; max?: number; subAt?: number; withSub?: boolean; align?: "left" | "center"; maxLines?: number }> = ({ beat, th, top = TOP + 40, maxH = 330, max = 120, subAt = 0.9, withSub = true, align = "left", maxLines = 3 }) => (
  <div style={{ position: "absolute", left: SAFE.x, width: W, top }}>
    <div style={{ marginBottom: 22, textAlign: align }}><Kicker th={th} text={beat.kicker} at={0.02} /></div>
    <Headline th={th} text={beat.headline || ""} maxW={W} maxH={maxH} max={max} align={align} hl={beat.hl} maxLines={maxLines} />
    {withSub && beat.sub ? <div style={{ marginTop: 18 }}><SubText th={th} text={beat.sub} at={subAt} maxW={W} maxH={130} size={40} align={align} /></div> : null}
  </div>
);

// ---------------------------------------------------------------- type_slam
export const TypeSlam: React.FC<P> = ({ beat, th }) => {
  const a = useAnim();
  const bg = beat.media?.find(m => m.role === "bg");
  const ev = stagger(a.dur, (beat.callouts?.length || 0) + (beat.logos?.length || 0), 1.1, 0.7, 0.3);
  const bar = a.r(0.7, 0.6);
  const hasLower = (beat.callouts?.length || 0) + (beat.logos?.length || 0) > 0;
  return <AbsoluteFill>
    {bg ? <AbsoluteFill style={{ opacity: 0.38 * a.r(0, 0.6) }}><Img src={asset(bg)!} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(0.4) contrast(1.1)", transform: `scale(${1 + a.t * 0.004})` }} /><AbsoluteFill style={{ background: `linear-gradient(180deg, ${th.bg}dd, ${th.bg}88 50%, ${th.bg}ee)` }} /></AbsoluteFill> : null}
    <Ghost th={th} text={beat.ghost} y={hasLower ? 380 : 620} />
    <div style={{ position: "absolute", left: SAFE.x, width: W, top: hasLower ? 330 : 520 }}>
      <div style={{ marginBottom: 34 }}><Kicker th={th} text={beat.kicker} /></div>
      <Headline th={th} text={beat.headline || ""} maxW={W} maxH={hasLower ? 560 : 640} max={hasLower ? 190 : 230} hl={beat.hl} maxLines={4} />
      <div style={{ marginTop: 30, height: 14, width: W * bar, background: th.accent, borderRadius: 4 }} />
      <div style={{ marginTop: 34 }}><SubText th={th} text={beat.sub} at={0.85} maxW={W} maxH={200} size={50} /></div>
    </div>
    {hasLower ? <div style={{ position: "absolute", left: SAFE.x, width: W, top: 1130, display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
      {(beat.logos || []).map((l, i) => { const p = a.pop(ev(i)); return <div key={l.id} style={{ width: 200, height: 200, borderRadius: 28, background: th.panel, border: `3px solid ${th.line}`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${clamp(p, 0, 1.1)})`, opacity: clamp(p, 0, 1) }}><Logo id={l.id} size={120} color={l.color || th.ink} /></div>; })}
      {(beat.callouts || []).map((c, i) => <Chip key={i} th={th} text={c} at={ev((beat.logos?.length || 0) + i)} solid={i === 0} size={36} />)}
    </div> : null}
    <Credit th={th} text={beat.credit} />
  </AbsoluteFill>;
};

// ---------------------------------------------------------------- cutout_hero
export const CutoutHero: React.FC<P> = ({ beat, th }) => {
  const a = useAnim();
  const cut = beat.media?.find(m => m.role === "cutout") || beat.media?.[0];
  const ratio = (cut?.w && cut?.h) ? cut.w / cut.h : 0.667;
  const H = 1180, Wd = H * ratio;
  const rise = OUT(clamp(a.t / 0.8, 0, 1));
  const float = Math.sin(a.t * 1.6) * 7;
  const ev = stagger(a.dur, beat.items?.length || 0, 0.7, 0.8, 0.35);
  const cx = 660;
  return <AbsoluteFill>
    <Ghost th={th} text={beat.ghost} y={430} size={430} />
    <div style={{ position: "absolute", left: cx - 330, top: 400, width: 660, height: 1000, background: th.accent, opacity: 0.9 * a.r(0.05, 0.5), transform: "skewX(-8deg)", borderRadius: 6 }} />
    <div style={{ position: "absolute", left: cx - 360, top: 360, width: 720, height: 1000, border: `4px solid ${th.ink}`, opacity: 0.35 * a.r(0.1, 0.5), transform: "skewX(-8deg) translate(26px,-30px)" }} />
    {cut ? <div style={{ position: "absolute", left: cx - Wd / 2, top: 1380 - H, width: Wd, height: H, clipPath: `inset(${(1 - rise) * 100}% 0 0 0)`, transform: `translateY(${(1 - rise) * 120 + float}px)` }}>
      <Img src={asset(cut)!} style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 40px 50px rgba(0,0,0,0.55)) drop-shadow(0 0 3px rgba(0,0,0,0.5))" }} />
    </div> : null}
    <div style={{ position: "absolute", left: SAFE.x, top: TOP + 20 }}><Kicker th={th} text={beat.kicker} /></div>
    <div style={{ position: "absolute", left: SAFE.x, top: 330, width: 450, display: "flex", flexDirection: "column", gap: 24 }}>
      {(beat.items || []).map((it, i) => {
        const p = a.r(ev(i), 0.5);
        return <div key={i} style={{ opacity: p, transform: `translateX(${(1 - p) * -160}px)`, background: th.panel, color: th.panelInk || th.ink, border: `3px solid ${th.line}`, borderLeft: `14px solid ${it.color || th.accent}`, borderRadius: 10, padding: "20px 22px", boxShadow: "0 18px 40px rgba(0,0,0,0.4)" }}>
          <div style={{ fontFamily: F.mono, fontWeight: 800, fontSize: 24, letterSpacing: "0.1em", color: it.color || th.accent }}>{it.label.toUpperCase()}</div>
          <div style={{ fontFamily: F.grotesk, fontWeight: 800, fontSize: 44, lineHeight: 1.04, marginTop: 6 }}>{it.value}</div>
          {it.note ? <div style={{ fontFamily: F.inter, fontWeight: 600, fontSize: 26, marginTop: 6, opacity: 0.75 }}>{it.note}</div> : null}
        </div>;
      })}
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 150, height: 250, background: th.mode === "dark" ? "linear-gradient(0deg, rgba(0,0,0,0.92) 60%, transparent)" : `linear-gradient(0deg, ${th.bg} 60%, transparent)` }} />
    <div style={{ position: "absolute", left: SAFE.x, width: W, bottom: 170, opacity: a.r(0.5, 0.5), transform: `translateY(${(1 - a.r(0.5, 0.5)) * 60}px)` }}>
      <div style={{ display: "inline-block", background: th.accent, color: th.mode === "dark" ? "#000" : "#fff", fontFamily: F[th.display || "anton"], fontWeight: 800, fontSize: 92, lineHeight: 1, padding: "10px 28px", textTransform: "uppercase" }}>{beat.headline}</div>
      <div style={{ marginTop: 14, fontFamily: F.inter, fontWeight: 700, fontSize: 38, color: th.ink }}>{beat.sub}</div>
    </div>
    <Credit th={th} text={beat.credit || cut?.credit} />
  </AbsoluteFill>;
};

// ---------------------------------------------------------------- logo_wall
export const LogoWall: React.FC<P> = ({ beat, th }) => {
  const a = useAnim();
  const logos = beat.logos || [];
  const ev = stagger(a.dur, logos.length, 0.9, 0.55, 0.3);
  const landed = logos.filter((_, i) => a.t >= ev(i) + 0.15).length;
  const cols = 2, tw = (W - 24) / cols, th_ = 270;
  return <AbsoluteFill>
    <Head beat={beat} th={th} top={TOP + 30} maxH={300} max={118} withSub={false} />
    <div style={{ position: "absolute", left: SAFE.x, width: W, top: 640, display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "center" }}>
      {logos.map((l, i) => {
        const p = a.pop(ev(i));
        const last = i === logos.length - 1 && logos.length % 2 === 1;
        const c = l.color || th.ink;
        return <div key={l.id} style={{ width: last ? W : tw, height: th_, background: th.panel, border: `3px solid ${th.line}`, borderBottom: `12px solid ${c}`, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 28, transform: `scale(${clamp(p, 0, 1.06)}) rotate(${(1 - clamp(p, 0, 1)) * (i % 2 ? 5 : -5)}deg)`, opacity: clamp(p, 0, 1), boxShadow: "0 20px 44px rgba(0,0,0,0.22)" }}>
          <Logo id={l.id} size={150} color={c} />
          <div style={{ fontFamily: F.grotesk, fontWeight: 800, fontSize: last ? 70 : 50, color: th.panelInk || th.ink, letterSpacing: "-0.03em", lineHeight: 1 }}>{l.label}</div>
        </div>;
      })}
    </div>
    {beat.sub ? <div style={{ position: "absolute", left: SAFE.x, width: W, top: 1500 - 90, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: a.r(0.8, 0.4) }}>
      <div style={{ fontFamily: F.mono, fontWeight: 800, fontSize: 40, letterSpacing: "0.1em", color: th.accent }}>{beat.sub.toUpperCase()}</div>
      <div style={{ fontFamily: F.anton, fontSize: 120, lineHeight: 1, color: th.ink }}>{landed}<span style={{ color: th.muted }}>/{logos.length}</span></div>
    </div> : null}
  </AbsoluteFill>;
};

// ---------------------------------------------------------------- stat_hero
export const StatHero: React.FC<P> = ({ beat, th }) => {
  const a = useAnim();
  const s = beat.stat!;
  const prog = IO(clamp(a.t / 1.5, 0, 1)) ;
  const v = s.value * prog;
  const str = `${s.prefix || ""}${fmt(v, s.decimals || 0)}${s.suffix || ""}`;
  const finalStr = `${s.prefix || ""}${fmt(s.value, s.decimals || 0)}${s.suffix || ""}`;
  const dots = s.dots || 0;
  const lit = Math.floor(prog * dots);
  const { size } = fitText(finalStr, W, 520, { font: "anton", max: dots ? 400 : 500, min: 120, lh: 1 });
  const items = beat.items || [];
  const ev = stagger(a.dur, items.length, 1.6, 0.7, 0.35);
  const pulse = a.t > 1.5 ? 1 + Math.sin((a.t - 1.5) * 6) * 0.012 : 1;
  return <AbsoluteFill>
    <Ghost th={th} text={s.ghost} y={dots ? 620 : 760} size={dots ? 300 : 360} />
    <div style={{ position: "absolute", left: SAFE.x, top: TOP + 30 }}><Kicker th={th} text={beat.kicker} /></div>
    <div style={{ position: "absolute", left: SAFE.x, width: W, top: TOP + 100, textAlign: "center", fontFamily: F.anton, fontSize: size, lineHeight: 1.0, color: th.accent, transform: `scale(${pulse})`, letterSpacing: "0.01em", fontVariantNumeric: "tabular-nums", textShadow: `0 0 60px ${th.accent}55` }}>{str}</div>
    <div style={{ position: "absolute", left: SAFE.x, width: W, top: TOP + 100 + size * 1.02 + 6, textAlign: "center" }}>
      <Headline th={th} text={beat.headline || s.label || ""} maxW={W} maxH={200} max={78} align="center" at={0.4} maxLines={2} font={th.display === "anton" ? "anton" : "grotesk"} />
    </div>
    {dots ? <div style={{ position: "absolute", left: SAFE.x + (W - (dots > 60 ? 900 : 800)) / 2, top: 960 + (size > 330 ? 20 : 0), width: dots > 60 ? 900 : 800, display: "grid", gridTemplateColumns: `repeat(${dots > 60 ? 16 : 10}, 1fr)`, gap: dots > 60 ? 10 : 14 }}>
      {Array.from({ length: dots }).map((_, i) => <div key={i} style={{ aspectRatio: "1", borderRadius: 999, background: i < lit ? th.accent : (th.mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"), boxShadow: i < lit && i > lit - 4 ? `0 0 26px ${th.accent}` : "none", transform: `scale(${i < lit ? 1 : 0.8})` }} />)}
    </div> : <div style={{ position: "absolute", left: SAFE.x, width: W, top: 1000, display: "flex", flexDirection: "column", gap: 22 }}>
      {items.map((it, i) => { const p = a.r(ev(i), 0.45); return <div key={i} style={{ opacity: p, transform: `translateX(${(1 - p) * 120}px)`, display: "flex", justifyContent: "space-between", alignItems: "center", background: th.panel, border: `3px solid ${th.line}`, borderLeft: `14px solid ${it.color || th.accent}`, borderRadius: 14, padding: "26px 30px" }}>
        <div style={{ fontFamily: F.grotesk, fontWeight: 800, fontSize: 46, color: th.panelInk || th.ink }}>{it.label}</div>
        <div style={{ fontFamily: F.mono, fontWeight: 800, fontSize: 46, color: it.color || th.accent }}>{it.value}</div>
      </div>; })}
    </div>}
    {dots && beat.sub ? <div style={{ position: "absolute", left: SAFE.x, width: W, top: 1420, textAlign: "center" }}><SubText th={th} text={beat.sub} at={1.8} maxW={W} maxH={110} size={38} align="center" /></div> : null}
    <Credit th={th} text={beat.credit} />
  </AbsoluteFill>;
};

// ---------------------------------------------------------------- charts
const niceMax = (v: number) => { const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };

export const LineChart: React.FC<P> = ({ beat, th }) => {
  const a = useAnim();
  const ch = beat.chart!;
  const series = ch.series || [];
  const xs = series[0]?.points.map(p => p.x) || [];
  const maxV = ch.yMax || niceMax(Math.max(...series.flatMap(s => s.points.map(p => p.y)), 1));
  const X0 = 150, X1 = 1000, Y0 = 560, Y1 = 1230;
  const xAt = (i: number) => X0 + (i * (X1 - X0)) / Math.max(1, xs.length - 1);
  const yAt = (v: number) => Y1 - (v / maxV) * (Y1 - Y0);
  const draw = IO(clamp((a.t - 0.5) / 2.0, 0, 1));
  const unit = ch.unit || "", pre = ch.prefix || "";
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return <AbsoluteFill>
    <Head beat={beat} th={th} top={TOP + 30} maxH={250} max={104} withSub={false} />
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      {ticks.map((tk, i) => { const y = Y1 - tk * (Y1 - Y0); return <g key={i} opacity={a.r(0.1 + i * 0.05, 0.4)}><line x1={X0} x2={X1} y1={y} y2={y} stroke={th.line} strokeWidth={2} strokeDasharray={i === 0 ? "0" : "8 10"} /><text x={X0 - 18} y={y + 11} textAnchor="end" fontFamily={F.mono} fontWeight={700} fontSize={30} fill={th.muted}>{pre}{fmt(maxV * tk)}</text></g>; })}
      {xs.map((x, i) => <text key={i} x={xAt(i)} y={Y1 + 56} textAnchor="middle" fontFamily={F.mono} fontWeight={700} fontSize={30} fill={th.muted} opacity={a.r(0.3, 0.4)}>{x}</text>)}
      {ch.xTitle ? <text x={(X0 + X1) / 2} y={Y1 + 112} textAnchor="middle" fontFamily={F.inter} fontWeight={700} fontSize={30} fill={th.muted}>{ch.xTitle}</text> : null}
      {series.map((s, si) => {
        const pts = s.points.map((p, i) => [xAt(i), yAt(p.y)] as [number, number]);
        let total = 0; const segs = pts.slice(1).map((p, i) => { const d = Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]); total += d; return d; });
        const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
        const col = s.color || (si ? th.accent2 || th.ink : th.accent);
        const area = `${d} L${pts[pts.length - 1][0]} ${Y1} L${pts[0][0]} ${Y1} Z`;
        const shown = total * draw;
        return <g key={si}>
          <defs><linearGradient id={`g${si}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={col} stopOpacity="0.32" /><stop offset="1" stopColor={col} stopOpacity="0" /></linearGradient></defs>
          <path d={area} fill={`url(#g${si})`} opacity={draw} />
          <path d={d} fill="none" stroke={col} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${total} ${total}`} strokeDashoffset={total - shown} />
          {pts.map((p, i) => { const reach = i === 0 ? 0 : segs.slice(0, i).reduce((x, y) => x + y, 0); const on = shown >= reach - 1; const pp = on ? a.pop(0.5 + (reach / total) * 2.0) : 0; return <circle key={i} cx={p[0]} cy={p[1]} r={16 * clamp(pp, 0, 1.2)} fill={th.bg} stroke={col} strokeWidth={8} />; })}
        </g>;
      })}
    </svg>
    {series.map((s, si) => {
      const last = s.points[s.points.length - 1];
      const col = s.color || (si ? th.accent2 || th.ink : th.accent);
      const p = a.pop(2.3 + si * 0.35);
      const y = yAt(last.y);
      const left = si % 2 === 0 ? 60 : 60;
      return <div key={si} style={{ position: "absolute", left: left + 20 + si * 0, top: Y0 - 50 + si * 120, transform: `scale(${clamp(p, 0, 1.08)})`, transformOrigin: "left top", opacity: clamp(p, 0, 1), background: th.panel, border: `4px solid ${col}`, borderRadius: 14, padding: "14px 22px", zIndex: 5 }}>
        <div style={{ fontFamily: F.mono, fontWeight: 800, fontSize: 28, color: col }}>{s.name}</div>
        <div style={{ fontFamily: F.anton, fontSize: 80, lineHeight: 1, color: th.panelInk || th.ink }}>{pre}{fmt(last.y)}{unit}</div>
      </div>;
    })}
    {ch.note ? <div style={{ position: "absolute", left: SAFE.x, width: W, top: 1400, opacity: a.r(1.2, 0.5) }}><SubText th={th} text={ch.note} at={1.2} maxW={W} maxH={160} size={34} /></div> : null}
    {ch.ratio ? <div style={{ position: "absolute", right: 70, top: 880, transform: `scale(${clamp(a.pop(2.9), 0, 1.15)}) rotate(-8deg)`, background: th.accent, color: th.mode === "dark" ? "#000" : "#fff", padding: "10px 30px", borderRadius: 16, fontFamily: F.anton, fontSize: 120, lineHeight: 1.1, boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>{ch.ratio}</div> : null}
    <Credit th={th} text={beat.credit} />
  </AbsoluteFill>;
};

export const BarChart: React.FC<P> = ({ beat, th }) => {
  const a = useAnim();
  const ch = beat.chart!;
  const rows = ch.rows || [];
  const maxV = ch.yMax || niceMax(Math.max(...rows.flatMap(r => r.values.map(v => v.v)), 1));
  const ev = stagger(a.dur, rows.length, 0.8, 0.7, 0.4);
  const BW = 760;
  const unit = ch.unit || "", pre = ch.prefix || "";
  const rowH = rows.length > 3 ? 250 : 300;
  return <AbsoluteFill>
    <Head beat={beat} th={th} top={TOP + 30} maxH={250} max={104} withSub={false} />
    <div style={{ position: "absolute", left: SAFE.x, width: W, top: 600, display: "flex", flexDirection: "column", gap: 26 }}>
      {rows.map((r, ri) => {
        const rp = a.r(ev(ri), 0.4);
        return <div key={ri} style={{ opacity: rp, transform: `translateX(${(1 - rp) * -90}px)`, height: rowH - 26 }}>
          <div style={{ fontFamily: F.mono, fontWeight: 800, fontSize: 34, letterSpacing: "0.08em", color: th.muted, marginBottom: 10 }}>{r.label.toUpperCase()}</div>
          {r.values.map((v, vi) => {
            const g = IO(clamp((a.t - ev(ri) - 0.15 - vi * 0.25) / 0.9, 0, 1));
            const w = (v.v / maxV) * BW * g;
            const col = v.color || (vi ? th.accent2 || th.ink : th.accent);
            return <div key={vi} style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 14 }}>
              <div style={{ width: 130, fontFamily: F.grotesk, fontWeight: 800, fontSize: 36, color: th.ink }}>{v.name}</div>
              <div style={{ height: rows.length > 3 ? 74 : 92, width: Math.max(8, w), background: col, borderRadius: 10, boxShadow: `0 0 30px ${col}55` }} />
              <div style={{ fontFamily: F.anton, fontSize: 70, color: th.ink, lineHeight: 1 }}>{pre}{fmt(v.v * g, v.v % 1 ? 2 : 0)}{unit}</div>
            </div>;
          })}
        </div>;
      })}
    </div>
    {ch.ratio ? <div style={{ position: "absolute", right: 60, top: 440, transform: `scale(${clamp(a.pop(ev(rows.length) + 0.3), 0, 1.15)}) rotate(7deg)`, background: th.accent, color: th.mode === "dark" ? "#000" : "#fff", padding: "6px 34px 14px", borderRadius: 18, textAlign: "center", boxShadow: "0 24px 50px rgba(0,0,0,0.45)" }}>
      <div style={{ fontFamily: F.anton, fontSize: 150, lineHeight: 1.05 }}>{ch.ratio}</div>
      {ch.ratioLabel ? <div style={{ fontFamily: F.mono, fontWeight: 800, fontSize: 28 }}>{ch.ratioLabel}</div> : null}
    </div> : null}
    {ch.note ? <div style={{ position: "absolute", left: SAFE.x, width: W, top: 1430, opacity: a.r(ev(rows.length), 0.5) }}><SubText th={th} text={ch.note} at={ev(rows.length)} maxW={W} maxH={90} size={32} /></div> : null}
    <Credit th={th} text={beat.credit} />
  </AbsoluteFill>;
};

// ---------------------------------------------------------------- timeline
export const Timeline: React.FC<P> = ({ beat, th }) => {
  const a = useAnim();
  const items = beat.items || [];
  const ev = stagger(a.dur, items.length, 0.9, 0.95, 0.5);
  const top = 640, rowH = Math.min(220, 800 / Math.max(1, items.length));
  const reached = items.reduce((acc, _, i) => (a.t >= ev(i) ? i : acc), -1);
  const lineH = reached < 0 ? 0 : reached * rowH + clamp((a.t - ev(reached)) / 0.4, 0, 1) * 0;
  return <AbsoluteFill>
    <Head beat={beat} th={th} top={TOP + 30} maxH={300} max={112} withSub={false} />
    <div style={{ position: "absolute", left: SAFE.x + 38, top: top + 40, width: 8, height: (items.length - 1) * rowH, background: th.line, borderRadius: 4 }} />
    <div style={{ position: "absolute", left: SAFE.x + 38, top: top + 40, width: 8, height: lineH, background: th.accent, borderRadius: 4, boxShadow: `0 0 24px ${th.accent}` }} />
    {items.map((it, i) => {
      const p = a.r(ev(i), 0.5), pp = a.pop(ev(i));
      const active = i === reached;
      return <div key={i} style={{ position: "absolute", left: SAFE.x, top: top + i * rowH, width: W, display: "flex", gap: 36, alignItems: "flex-start", opacity: p * (active || i > reached ? 1 : 0.72), transform: `translateX(${(1 - p) * 140}px)` }}>
        <div style={{ width: 84, height: 84, borderRadius: 999, background: active ? th.accent : th.panel, border: `6px solid ${it.color || th.accent}`, flex: "none", transform: `scale(${clamp(pp, 0, 1.2) * (active ? 1 + Math.sin(a.t * 7) * 0.04 : 1)})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.anton, fontSize: 40, color: active ? (th.mode === "dark" ? "#000" : "#fff") : th.ink }}>{i + 1}</div>
        <div style={{ flex: 1, background: th.panel, border: `3px solid ${active ? th.accent : th.line}`, borderRadius: 16, padding: "20px 28px", boxShadow: active ? `0 0 40px ${th.accent}44` : "none" }}>
          <div style={{ fontFamily: F.mono, fontWeight: 800, fontSize: 30, letterSpacing: "0.08em", color: it.color || th.accent }}>{it.label.toUpperCase()}</div>
          <div style={{ fontFamily: F.grotesk, fontWeight: 800, fontSize: 52, lineHeight: 1.04, color: th.panelInk || th.ink, marginTop: 4 }}>{it.value}</div>
          {it.note ? <div style={{ fontFamily: F.inter, fontWeight: 600, fontSize: 30, color: th.muted, marginTop: 6 }}>{it.note}</div> : null}
        </div>
      </div>;
    })}
    <Credit th={th} text={beat.credit} />
  </AbsoluteFill>;
};

// ---------------------------------------------------------------- compare
export const Compare: React.FC<P> = ({ beat, th }) => {
  const a = useAnim();
  const c = beat.compare!;
  const n = Math.max(c.left.rows.length, c.right.rows.length);
  const ev = stagger(a.dur, n, 1.0, 0.7, 0.4);
  const side = (s: Side, k: "left" | "right") => {
    const col = s.color || (k === "left" ? th.accent : th.accent2 || th.ink);
    return <Panel th={th} at={k === "left" ? 0.15 : 0.3} from={k === "left" ? "left" : "right"} style={{ width: (W - 40) / 2, height: 820, padding: 0, overflow: "hidden", borderTop: `16px solid ${col}` }}>
      <div style={{ padding: "26px 24px 18px", display: "flex", alignItems: "center", gap: 14 }}>
        {s.logo ? <Logo id={s.logo} size={64} color={col} /> : null}
        <div style={{ fontFamily: F.grotesk, fontWeight: 800, fontSize: 56, lineHeight: 1, color: th.panelInk || th.ink }}>{s.title}</div>
      </div>
      {s.tag ? <div style={{ margin: "0 24px 10px", fontFamily: F.mono, fontWeight: 800, fontSize: 24, color: col, letterSpacing: "0.06em" }}>{s.tag.toUpperCase()}</div> : null}
      {s.rows.map((r, i) => { const p = a.r(ev(i), 0.4); const win = c.win && r.k.toLowerCase() === c.win.toLowerCase();
        return <div key={i} style={{ margin: "0 24px", padding: "18px 0", borderTop: `2px solid ${th.line}`, opacity: p, transform: `translateY(${(1 - p) * 30}px)`, background: win && a.t > ev(i) + 0.3 ? `${col}22` : "transparent" }}>
          <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 24, color: th.muted, letterSpacing: "0.08em" }}>{r.k.toUpperCase()}</div>
          <div style={{ fontFamily: F.grotesk, fontWeight: 800, fontSize: r.v.length > 14 ? 38 : 58, lineHeight: 1.05, color: th.panelInk || th.ink, marginTop: 4 }}>{r.v}</div>
        </div>; })}
    </Panel>;
  };
  const vp = a.pop(0.6);
  return <AbsoluteFill>
    <Head beat={beat} th={th} top={TOP + 30} maxH={250} max={108} withSub={false} />
    <div style={{ position: "absolute", left: SAFE.x, width: W, top: 620, display: "flex", gap: 40 }}>{side(c.left, "left")}{side(c.right, "right")}</div>
    <div style={{ position: "absolute", left: 540 - 62, top: 620 + 330, width: 124, height: 124, borderRadius: 999, background: th.accent, color: th.mode === "dark" ? "#000" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.anton, fontSize: 60, transform: `scale(${clamp(vp, 0, 1.15)}) rotate(${(1 - clamp(vp, 0, 1)) * 90}deg)`, zIndex: 4, boxShadow: "0 12px 30px rgba(0,0,0,0.4)" }}>{c.vs || "VS"}</div>
    {beat.sub ? <div style={{ position: "absolute", left: SAFE.x, width: W, top: 1470, textAlign: "center" }}><SubText th={th} text={beat.sub} at={ev(n)} maxW={W} maxH={80} size={36} align="center" /></div> : null}
    <Credit th={th} text={beat.credit} />
  </AbsoluteFill>;
};

// ---------------------------------------------------------------- screenshot
const CropView: React.FC<{ src: string; iw: number; ih: number; c: { x: number; y: number; w: number; h: number }; width: number }> = ({ src, iw, ih, c, width }) => {
  const height = (width * c.h * ih) / (c.w * iw);
  return <div style={{ width, height, overflow: "hidden", position: "relative", borderRadius: 12 }}>
    <Img src={src} style={{ position: "absolute", width: width / c.w, left: -(c.x * width) / c.w, top: -(c.y * height) / c.h, maxWidth: "none" }} />
  </div>;
};

export const Screenshot: React.FC<P> = ({ beat, th }) => {
  const a = useAnim();
  const m = beat.media![0];
  const src = asset(m)!;
  const iw = m.w || 1200, ih = m.h || 750;
  const CW = W, CH = (CW * ih) / iw;
  const crops = beat.crops || [];
  const ev = stagger(a.dur, crops.length, 1.0, 1.0, 0.6);
  const activeIdx = crops.reduce((acc, _, i) => (a.t >= ev(i) ? i : acc), -1);
  const cardTop = 560;
  const cw2 = crops.length > 1 ? (W - 28) / 2 : W;
  return <AbsoluteFill>
    <AbsoluteFill style={{ opacity: 0.35 }}><Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(30px) saturate(1.1)" }} /></AbsoluteFill>
    <AbsoluteFill style={{ background: `${th.bg}cc` }} />
    <Head beat={beat} th={th} top={TOP + 30} maxH={250} max={104} withSub={false} />
    <Panel th={th} at={0.25} from="up" style={{ position: "absolute", left: SAFE.x, top: cardTop, width: CW, height: CH, padding: 0, overflow: "hidden", borderWidth: 6 }}>
      <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      {crops.map((c, i) => { const p = a.r(ev(i), 0.35); return <div key={i} style={{ position: "absolute", left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%`, border: `6px solid ${i === activeIdx ? th.accent : "rgba(255,255,255,0.0)"}`, boxShadow: i === activeIdx ? `0 0 0 9999px rgba(0,0,0,0.45), 0 0 40px ${th.accent}` : "none", opacity: p, display: i === activeIdx ? "block" : "none" }} />; })}
    </Panel>
    <div style={{ position: "absolute", left: SAFE.x, width: W, top: cardTop + CH + 34, display: "flex", gap: 28, flexWrap: "wrap", justifyContent: "center" }}>
      {crops.map((c, i) => { if (a.t < ev(i)) return null; const p = a.pop(ev(i)); const on = i === activeIdx;
        return <div key={i} style={{ width: cw2, transform: `scale(${clamp(p, 0, 1.04)})`, opacity: clamp(p, 0, 1) * (on ? 1 : 0.8), border: `5px solid ${on ? th.accent : th.line}`, borderRadius: 16, overflow: "hidden", background: th.panel, boxShadow: "0 20px 40px rgba(0,0,0,0.35)" }}>
          <CropView src={src} iw={iw} ih={ih} c={c} width={cw2 - 10} />
          <div style={{ padding: "12px 16px", fontFamily: F.mono, fontWeight: 800, fontSize: 28, color: th.panelInk || th.ink, letterSpacing: "0.04em" }}>{c.label}</div>
        </div>; })}
    </div>
    <Credit th={th} text={beat.credit || m.credit} />
  </AbsoluteFill>;
};

// ---------------------------------------------------------------- manifest (spec sheet)
export const Manifest: React.FC<P> = ({ beat, th }) => {
  const a = useAnim();
  const items = beat.items || [];
  const ev = stagger(a.dur, items.length, 0.9, 0.8, 0.4);
  const bg = beat.media?.find(m => m.role === "bg");
  return <AbsoluteFill>
    {bg ? <AbsoluteFill style={{ opacity: 0.3 }}><Img src={asset(bg)!} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(14px)" }} /></AbsoluteFill> : null}
    <Head beat={beat} th={th} top={TOP + 30} maxH={260} max={108} withSub={false} />
    <Panel th={th} at={0.2} style={{ position: "absolute", left: SAFE.x, width: W, top: 600, padding: 0, overflow: "hidden" }}>
      <div style={{ height: 70, background: th.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 12, padding: "0 24px", borderBottom: `3px solid ${th.line}` }}>
        {["#ff5f57", "#febc2e", "#28c840"].map(c => <div key={c} style={{ width: 22, height: 22, borderRadius: 999, background: c }} />)}
        <div style={{ marginLeft: 16, fontFamily: F.mono, fontWeight: 700, fontSize: 28, color: th.muted }}>{beat.sub || "build manifest"}</div>
      </div>
      {items.map((it, i) => { const p = a.r(ev(i), 0.4); const hot = it.color; const strike = it.strike;
        return <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "30px 34px", borderTop: i ? `2px solid ${th.line}` : "none", opacity: p, transform: `translateX(${(1 - p) * 80}px)`, background: hot && a.t > ev(i) + 0.2 ? `${hot}1f` : "transparent" }}>
          <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 40, color: th.panelInk || th.ink, letterSpacing: "0.02em" }}>{it.label}</div>
          <div style={{ fontFamily: F.anton, fontSize: strike ? 96 : 84, color: hot || th.accent, lineHeight: 1, textDecoration: "none" }}>{it.value}</div>
        </div>; })}
    </Panel>
    {beat.callouts?.length ? <div style={{ position: "absolute", left: SAFE.x, width: W, top: 600 + 70 + items.length * 140 + 50, display: "flex", gap: 16, flexWrap: "wrap" }}>
      {beat.callouts.map((c, i) => <Chip key={i} th={th} text={c} at={ev(items.length) + i * 0.5} solid size={38} />)}
    </div> : null}
    <Credit th={th} text={beat.credit} />
  </AbsoluteFill>;
};

// ---------------------------------------------------------------- document
export const Document: React.FC<P> = ({ beat, th }) => {
  const a = useAnim();
  const d = beat.doc!;
  const cl = d.clauses || [];
  const ev = stagger(a.dur, cl.length, 0.9, 0.9, 0.5);
  const stampAt = ev(cl.length) + 0.1;
  const sp = a.pop(stampAt);
  const shake = a.t > stampAt && a.t < stampAt + 0.25 ? Math.sin(a.t * 90) * 8 : 0;
  return <AbsoluteFill>
    <Head beat={beat} th={th} top={TOP + 30} maxH={260} max={108} withSub={false} />
    <div style={{ position: "absolute", left: SAFE.x + 20, width: W - 40, top: 620, transform: `rotate(-1.2deg) translateX(${shake}px)`, opacity: a.r(0.15, 0.4) }}>
      <div style={{ background: "#F7F2E6", color: "#16161a", borderRadius: 6, padding: "44px 48px 54px", boxShadow: "0 40px 80px rgba(0,0,0,0.55)", position: "relative", minHeight: 780 }}>
        <div style={{ fontFamily: F.serif, fontSize: 52, lineHeight: 1.05, borderBottom: "4px double #16161a", paddingBottom: 18 }}>{d.title}</div>
        {d.sub ? <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 26, marginTop: 14, letterSpacing: "0.06em", color: "#555" }}>{d.sub.toUpperCase()}</div> : null}
        <div style={{ marginTop: 26 }}>
          {cl.map((c, i) => { const p = a.r(ev(i), 0.4); const hi = clamp((a.t - ev(i) - 0.25) / 0.5, 0, 1);
            return <div key={i} style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 26, opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
              <div style={{ fontFamily: F.mono, fontWeight: 800, fontSize: 34, color: th.accent, flex: "none", width: 52 }}>{i + 1}.</div>
              <div style={{ position: "relative", fontFamily: F.serif, fontSize: 46, lineHeight: 1.12 }}>
                <span style={{ position: "absolute", left: -8, right: -8, top: "52%", height: "46%", background: th.accent, opacity: 0.28, transformOrigin: "left", transform: `scaleX(${hi})` }} />
                <span style={{ position: "relative" }}>{c}</span>
              </div>
            </div>; })}
        </div>
        {d.stamp ? <div style={{ position: "absolute", right: 30, bottom: 40, transform: `rotate(-12deg) scale(${a.t < stampAt ? 0 : 1 + (1 - clamp(sp, 0, 1)) * 1.4})`, opacity: a.t < stampAt ? 0 : 1, border: `10px solid ${th.accent}`, color: th.accent, fontFamily: F.anton, fontSize: 84, padding: "4px 26px", letterSpacing: "0.04em", background: "rgba(247,242,230,0.6)", mixBlendMode: "multiply" }}>{d.stamp}</div> : null}
      </div>
    </div>
    <Credit th={th} text={beat.credit} />
  </AbsoluteFill>;
};

// ---------------------------------------------------------------- question
export const Question: React.FC<P> = ({ beat, th }) => {
  const a = useAnim();
  const ring = (i: number) => { const p = ((a.t * 0.7 + i * 0.33) % 1); return <div key={i} style={{ position: "absolute", left: 540 - 380, top: 760 - 380, width: 760, height: 760, borderRadius: 999, border: `5px solid ${th.accent}`, opacity: (1 - p) * 0.4, transform: `scale(${0.4 + p * 1.2})` }} />; };
  const cta = a.r(Math.max(1.2, a.dur - 1.4), 0.5);
  return <AbsoluteFill>
    {[0, 1, 2].map(ring)}
    <div style={{ position: "absolute", left: SAFE.x, width: W, top: 360 }}><Kicker th={th} text={beat.kicker} /></div>
    <div style={{ position: "absolute", left: SAFE.x, width: W, top: 450 }}><Headline th={th} text={beat.headline || ""} maxW={W} maxH={760} max={190} hl={beat.hl} maxLines={5} /></div>
    <div style={{ position: "absolute", left: SAFE.x, width: W, top: 1240 }}><SubText th={th} text={beat.sub} at={1.0} maxW={W} maxH={160} size={46} /></div>
    {beat.cta ? <div style={{ position: "absolute", left: SAFE.x, width: W, top: 1380, transform: `translateY(${(1 - cta) * 80}px)`, opacity: cta }}>
      <div style={{ background: th.accent, color: th.mode === "dark" ? "#000" : "#fff", fontFamily: F.grotesk, fontWeight: 800, fontSize: 48, padding: "28px 34px", borderRadius: 16, textAlign: "center", lineHeight: 1.1 }}>{beat.cta}</div>
    </div> : null}
  </AbsoluteFill>;
};

export const SCENES: Record<string, React.FC<P>> = {
  type_slam: TypeSlam, cutout_hero: CutoutHero, logo_wall: LogoWall, stat_hero: StatHero, line_chart: LineChart,
  bar_chart: BarChart, timeline: Timeline, compare: Compare, screenshot: Screenshot, manifest: Manifest, document: Document, question: Question,
};
export const SCENE_NAMES = Object.keys(SCENES);
