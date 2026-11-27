import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { loadFont as loadSerif } from "@remotion/google-fonts/Newsreader";
import { loadFont as loadSans } from "@remotion/google-fonts/InterTight";

const serif = loadSerif("normal", { weights: ["400", "700"], subsets: ["latin"] }).fontFamily;
const serifItalic = loadSerif("italic", { weights: ["400", "600"], subsets: ["latin"] }).fontFamily;
const sans = loadSans("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily;

// 1280x720. Colour comes only from props.theme (channels.json). Every number comes from props.data (the episode's own model and totals).
// Layout follows the Paper Pitch thumbnail formula in data/rival-lines/paperpitch-footballrealm-reference-study.md section 6, minus the
// cutout player (needs licensed background removal): a taped photo with an offset accent shadow stands in for it.
export const Thumb: React.FC<any> = ({ theme, images, data, thumb }) => {
  const im = images[thumb.img];
  const res = data.results.wikipedia;
  const photoW = 440, photoH = 560, px = 760, py = 80;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, #ffffff 0%, ${theme.paper} 70%, ${theme.grid} 100%)` }}>
      <div style={{ position: "absolute", left: px, top: py, width: photoW, height: photoH, transform: "rotate(2.2deg)", boxShadow: `18px 18px 0 ${theme.accent2}`, border: `4px solid ${theme.ink}`, overflow: "hidden", background: theme.ink }}>
        <Img src={staticFile(im.file)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: thumb.focus || "50% 20%" }} />
      </div>
      <div style={{ position: "absolute", left: px + photoW / 2 - 70, top: py - 20, width: 140, height: 40, background: theme.highlight, opacity: 0.85, transform: "rotate(-3deg)" }} />

      <div style={{ position: "absolute", left: 40, top: 32, fontFamily: serif, fontWeight: 700, fontSize: 46, color: theme.ink, lineHeight: 1 }}>
        RL
        <svg width="76" height="14" viewBox="0 0 76 14" style={{ display: "block", marginTop: 2 }}><path d="M2 9 Q 22 2 40 8 T 74 6" fill="none" stroke={theme.accent} strokeWidth={5} strokeLinecap="round" /></svg>
      </div>

      <div style={{ position: "absolute", left: 40, top: 130, width: 700, fontFamily: serif, color: theme.ink, fontSize: 112, lineHeight: 1.0, letterSpacing: -2 }}>
        {thumb.headline.map((ln: any, i: number) => (
          <div key={i}>
            {ln.map((w: any, j: number) => (w.b
              ? <span key={j} style={{ fontWeight: 700, background: `linear-gradient(transparent 62%, ${theme.highlight} 62%, ${theme.highlight} 92%, transparent 92%)` }}>{w.t}</span>
              : <span key={j} style={{ fontWeight: 400 }}>{w.t}</span>))}
          </div>
        ))}
      </div>

      <svg width={700} height={250} viewBox="0 0 700 250" style={{ position: "absolute", left: 40, top: 430 }}>
        {thumb.visual === "curve" ? (() => {
          const ps: number[] = res.scenarios.hold.p_by_month;
          const x0 = 20, x1 = 680, y0 = 210, y1 = 44;
          const X = (m: number) => x0 + ((x1 - x0) * m) / (ps.length - 1), Y = (p: number) => y0 - (y0 - y1) * p;
          const med = res.scenarios.hold.median_month;
          return (
            <g>
              <line x1={x0} x2={x1} y1={y0} y2={y0} stroke={theme.ink} strokeWidth={4} />
              <line x1={x0} x2={x1} y1={Y(1)} y2={Y(1)} stroke={theme.accent} strokeWidth={3} strokeDasharray="10 8" />
              <path d={ps.map((p, m) => `${m ? "L" : "M"} ${X(m)} ${Y(p)}`).join(" ")} fill="none" stroke={theme.ink} strokeWidth={8} strokeLinejoin="round" />
              <circle cx={X(med)} cy={Y(ps[med] ?? 0.5)} r={13} fill={theme.accent} stroke={theme.ink} strokeWidth={4} />
              <text x={x1} y={Y(1) - 20} textAnchor="end" fontFamily={sans} fontWeight={700} fontSize={22} fill={theme.accent}>1,000 reached</text>
            </g>
          );
        })() : (() => {
          const n = res.needed, size = 34, gap = 14, x0 = 20;
          return (
            <g>
              <text x={x0} y={70} fontFamily={sans} fontWeight={700} fontSize={26} fill={theme.ink}>{data.totals.official_goals} now</text>
              {Array.from({ length: n }).map((_, i) => <circle key={i} cx={x0 + i * (size + gap) + size / 2} cy={130} r={size / 2 - 3} fill={theme.accent} stroke={theme.ink} strokeWidth={4} />)}
              <text x={x0 + n * (size + gap) - gap} y={70} textAnchor="end" fontFamily={sans} fontWeight={700} fontSize={26} fill={theme.ink}>1,000</text>
              <line x1={x0} x2={x0 + n * (size + gap) - gap} y1={200} y2={200} stroke={theme.ink} strokeWidth={4} />
            </g>
          );
        })()}
      </svg>

      <svg width={260} height={150} viewBox="0 0 260 150" style={{ position: "absolute", left: thumb.arrow.left, top: thumb.arrow.top, transform: thumb.arrow.flip ? "scaleX(-1)" : undefined }}>
        <path d="M 10 130 Q 120 120 190 40" fill="none" stroke={theme.accent} strokeWidth={7} strokeLinecap="round" />
        <path d="M 190 40 L 168 52 M 190 40 L 192 66" fill="none" stroke={theme.accent} strokeWidth={7} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", left: thumb.note.left, top: thumb.note.top, fontFamily: serifItalic, fontStyle: "italic", fontWeight: 600, fontSize: 34, color: theme.accent, whiteSpace: "nowrap" }}>{thumb.note.text}</div>
    </AbsoluteFill>
  );
};
