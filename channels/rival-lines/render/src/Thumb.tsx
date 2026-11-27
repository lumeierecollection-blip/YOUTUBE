import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { loadFont as loadDidone } from "@remotion/google-fonts/PlayfairDisplay";

const didone = loadDidone("normal", { weights: ["400", "700", "900"], subsets: ["latin"] }).fontFamily;
const didoneItalic = loadDidone("italic", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;

// 1280x720. Colour comes only from props.theme (channels.json); every number comes from props.data (the episode's own model and totals).
// Structure follows the Paper Pitch thumbnails side by side (data/rival-lines/paperpitch-footballrealm-reference-study.md section 6):
// a large player cutout edge-faded into the background with a motion smear, a big didone lowercase headline with one heavy keyword,
// one unframed data visual built to the video's answer, a small red arrow with a black italic annotation, a small round badge top-left.
const Arrow: React.FC<{ from: [number, number]; to: [number, number]; bend?: number; color: string }> = ({ from, to, bend = 40, color }) => {
  const [x1, y1] = from, [x2, y2] = to;
  const cx = (x1 + x2) / 2 - bend, cy = (y1 + y2) / 2 + bend;
  const a = Math.atan2(y2 - cy, x2 - cx), h = 20;
  const p = (d: number) => `${x2 - h * Math.cos(a + d)} ${y2 - h * Math.sin(a + d)}`;
  return (
    <g fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
      <path d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`} />
      <path d={`M ${p(0.5)} L ${x2} ${y2} L ${p(-0.5)}`} />
    </g>
  );
};

export const Thumb: React.FC<any> = ({ theme, data, thumb }) => {
  const left = thumb.side === "left";
  const res = data.results.wikipedia;
  const cut = thumb.cutout;
  const src = staticFile(`ep/images/cutout-${thumb.img}.png`);
  const colX = left ? 560 : 56, colW = 660;
  const inner = left ? "to right" : "to left";
  const edge = left ? { left: cut.edge } : { right: cut.edge };
  const maskImg = `linear-gradient(to bottom, #000 0%, #000 ${cut.fadeBottom ?? 74}%, transparent 100%), linear-gradient(${inner}, #000 0%, #000 ${cut.fadeSide ?? 78}%, transparent 100%)`;
  const mask: React.CSSProperties = { WebkitMaskImage: maskImg, maskImage: maskImg, WebkitMaskComposite: "source-in", maskComposite: "intersect" };
  const trailMask = `linear-gradient(${inner}, #000 0%, transparent 100%)`;

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at ${left ? "62%" : "38%"} 40%, #ffffff 0%, #ffffff 40%, ${theme.paper} 100%)` }}>
      <div style={{ position: "absolute", top: cut.top, height: cut.h, ...edge, display: "flex" }}>
        <Img src={src} style={{ height: cut.h, width: "auto", filter: "blur(16px)", opacity: 0.45, transform: `scaleX(1.35) translateX(${left ? 40 : -40}px)`, transformOrigin: left ? "left center" : "right center", WebkitMaskImage: trailMask, maskImage: trailMask }} />
      </div>
      <div style={{ position: "absolute", top: cut.top, height: cut.h, ...edge, display: "flex" }}>
        <Img src={src} style={{ height: cut.h, width: "auto", ...mask }} />
      </div>

      <div style={{ position: "absolute", left: 30, top: 24, width: 58, height: 58, borderRadius: 29, background: theme.paper, border: `3px solid ${theme.grid}`, boxShadow: "0 2px 6px rgba(0,0,0,.18)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: didone, fontWeight: 900, fontSize: 24, lineHeight: 1, color: theme.ink }}>RL</div>
        <div style={{ width: 24, height: 3, background: theme.accent, borderRadius: 2, marginTop: 3 }} />
      </div>

      <div style={{ position: "absolute", left: colX, top: 44, width: colW, fontFamily: didone, color: theme.ink, fontSize: 150, lineHeight: 1.05, letterSpacing: -4, whiteSpace: "nowrap" }}>
        {thumb.headline.map((ln: any, i: number) => (
          <div key={i}>
            {ln.map((w: any, j: number) => <span key={j} style={{ fontWeight: w.b ? 900 : 400 }}>{w.t}</span>)}
          </div>
        ))}
      </div>

      <svg width={colW} height={430} viewBox={`0 0 ${colW} 430`} style={{ position: "absolute", left: colX, top: 250, overflow: "visible" }}>
        {thumb.visual === "curve" ? (() => {
          const ps: number[] = res.scenarios.hold.p_by_month.slice(0, 25);
          const x0 = 10, x1 = colW - 10, y0 = 380, y1 = 80;
          const X = (m: number) => x0 + ((x1 - x0) * m) / (ps.length - 1), Y = (p: number) => y0 - (y0 - y1) * p;
          const med = res.scenarios.hold.median_month;
          const mx = X(med), my = Y(ps[med]);
          return (
            <g>
              <text x={x0} y={y1 - 22} fontFamily={didone} fontWeight={900} fontSize={44} fill={theme.ink}>100%</text>
              <line x1={x0} x2={x1} y1={y1} y2={y1} stroke={theme.ink} strokeWidth={4} strokeDasharray="12 10" />
              <line x1={x0} x2={x1} y1={y0} y2={y0} stroke={theme.muted} strokeOpacity={0.6} strokeWidth={4} />
              {[6, 12, 18].map((m) => <text key={m} x={X(m)} y={y0 + 42} textAnchor="middle" fontFamily={didone} fontWeight={700} fontSize={32} fill={theme.muted}>{m}</text>)}
              <text x={x1} y={y0 + 42} textAnchor="end" fontFamily={didone} fontWeight={700} fontSize={32} fill={theme.muted}>24 months</text>
              <path d={ps.map((p, m) => `${m ? "L" : "M"} ${X(m)} ${Y(p)}`).join(" ")} fill="none" stroke={theme.ink} strokeWidth={13} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={mx} cy={my} r={17} fill={theme.ink} />
              <text x={mx + 90} y={my + 150} fontFamily={didoneItalic} fontStyle="italic" fontWeight={500} fontSize={46} fill={theme.ink}>{thumb.note}</text>
              <Arrow from={[mx + 80, my + 118]} to={[mx + 22, my + 28]} bend={50} color={theme.accent} />
            </g>
          );
        })() : (() => {
          const rowGrey = { fontFamily: didone, fontWeight: 900, fontSize: 84, fill: theme.muted, fillOpacity: 0.6 } as const;
          const rowHot = { fontFamily: didone, fontWeight: 900, fontSize: 104, fill: theme.accent } as const;
          return (
            <g>
              <text x={0} y={80} {...rowGrey}>1,000</text>
              <text x={290} y={80} {...rowGrey} fontWeight={700}>the target</text>
              <line x1={0} x2={colW} y1={125} y2={125} stroke={theme.accent} strokeWidth={5} strokeDasharray="10 8" />
              <text x={0} y={250} {...rowHot}>{data.totals.official_goals}</text>
              <text x={280} y={250} {...rowHot} fontSize={76}>Ronaldo, now</text>
              <text x={150} y={380} fontFamily={didoneItalic} fontStyle="italic" fontWeight={500} fontSize={46} fill={theme.ink}>{thumb.note}</text>
              <Arrow from={[120, 345]} to={[60, 285]} bend={-20} color={theme.accent} />
            </g>
          );
        })()}
      </svg>
    </AbsoluteFill>
  );
};
