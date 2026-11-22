// Psychology long form (serves Dopamine Loop and Gray Matter). Built from Sprouts (4aN5TbGW5JA: the concept as a cycle diagram of people and
// arrows; drawn classroom reconstruction), Practical Psychology (-W-ML_dG_4Y: the experiment set up step by step, the result as one big
// percentage), PsychToons (CkP_8bkjf1E: second-person scenario opening, a word card per idea) and Aperture (one figure singled out from a crowd).
// Our own look: a research notebook (warm paper, ink line figures, one accent) instead of their cartoon characters; and an EVIDENCE chip on
// every claim, because the channel rule is to separate established findings, preliminary results, disputed claims and popular interpretation.
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { F, Fonts, eio, eo, expo, lerp, ramp } from "./kit.jsx";

const src = (p) => (p.startsWith("data:") || p.startsWith("http") ? p : staticFile(p));
const EV = { established: ["ESTABLISHED FINDING", "#1F8A5B"], replicated_small: ["REAL BUT SMALL", "#1F8A5B"], preliminary: ["PRELIMINARY", "#C98A00"], disputed: ["DISPUTED", "#C4421A"], failed: ["DID NOT REPLICATE", "#C4421A"], popular: ["POPULAR CLAIM", "#6A4FB3"], method: ["HOW THE STUDY WORKED", "#2D5D8C"], data: ["DATA", "#2D5D8C"] };

export function Evidence({ kind = "established", x = 70, y = 54, note }) {
  const f = useCurrentFrame(), [label, col] = EV[kind], a = ramp(f, 0, 10);
  return <div style={{ position: "absolute", left: x, top: y, opacity: a, display: "flex", alignItems: "center", gap: 12 }}><div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 21, letterSpacing: "0.14em", color: "#fff", background: col, padding: "7px 14px" }}>{label}</div>{note && <div style={{ fontFamily: F.sans, fontSize: 21, color: "#4a4436" }}>{note}</div>}</div>;
}
const Paper = ({ t, children, grid = true }) => (
  <AbsoluteFill style={{ background: t.paper }}><Fonts />
    {grid && <AbsoluteFill style={{ backgroundImage: `linear-gradient(${t.rule} 1px, transparent 1px)`, backgroundSize: "100% 48px", opacity: 0.55 }} />}
    <div style={{ position: "absolute", left: 40, top: 0, bottom: 0, width: 2, background: t.margin, opacity: 0.6 }} />
    {children}
    <AbsoluteFill style={{ background: "radial-gradient(100% 90% at 50% 50%, rgba(0,0,0,0) 65%, rgba(60,45,20,0.18) 100%)", pointerEvents: "none" }} />
  </AbsoluteFill>
);
const Src = ({ text }) => text ? <div style={{ position: "absolute", left: 70, bottom: 30, fontFamily: F.sans, fontSize: 19, color: "#5d5545" }}>{text}</div> : null;
/** Ink-line person (head + shoulders), optional highlight ring and tag. */
function Person({ x, y, s = 1, ink, fill = "none", hi, tag, accent, op = 1 }) {
  return (<g opacity={op} transform={`translate(${x} ${y}) scale(${s})`}>
    {hi && <circle cx="0" cy="-6" r="44" fill="none" stroke={accent} strokeWidth="4" />}
    <circle cx="0" cy="-26" r="13" fill={fill === "none" ? "#fffdf6" : fill} stroke={ink} strokeWidth="3" />
    <path d="M -24 22 Q -24 -6 0 -6 Q 24 -6 24 22" fill={fill === "none" ? "#fffdf6" : fill} stroke={ink} strokeWidth="3" />
    {tag && <g><rect x="-44" y="30" width="88" height="24" rx="4" fill={accent} /><text x="0" y="47" textAnchor="middle" fontFamily={F.mono} fontWeight="700" fontSize="14" fill="#fff">{tag}</text></g>}
  </g>);
}

/** 1. Concept cycle (Sprouts' Pygmalion diagram): steps round a circle, arrows drawn on in order, one step can be marked as unproven. */
export function Cycle({ t, title, steps, evidence = "popular", note, source }) {
  const f = useCurrentFrame(), n = steps.length, cx = 960, cy = 590, R = 300;
  return (
    <Paper t={t}>
      <div style={{ position: "absolute", left: 120, top: 120, fontFamily: F.display, fontWeight: 700, fontSize: 62, color: t.ink }}>{title}</div>
      <svg width="1920" height="1080" style={{ position: "absolute" }}>
        <defs><marker id="pa" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill={t.ink} /></marker></defs>
        {steps.map((s, i) => { const a0 = (i / n) * 2 * Math.PI - Math.PI / 2 + 0.32, a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2 - 0.32, p = ramp(f, 20 + i * 18, 38 + i * 18, eo), am = a0 + (a1 - a0) * p;
          return <path key={i} d={`M ${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A ${R} ${R} 0 0 1 ${cx + R * Math.cos(am)} ${cy + R * Math.sin(am)}`} fill="none" stroke={s.weak ? t.warn : t.ink} strokeWidth="4" strokeDasharray={s.weak ? "10 10" : "none"} markerEnd={p > 0.1 ? "url(#pa)" : undefined} />; })}
        {steps.map((s, i) => { const a = (i / n) * 2 * Math.PI - Math.PI / 2, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a), op = ramp(f, 6 + i * 18, 20 + i * 18);
          return <g key={`n${i}`} opacity={op}><Person x={x} y={y - 6} s={1.3} ink={t.ink} accent={t.accent} hi={s.hi} /><text x={x} y={y + 68} textAnchor="middle" fontFamily={F.grot} fontWeight="700" fontSize="28" fill={t.ink}>{s.title}</text><text x={x} y={y + 100} textAnchor="middle" fontFamily={F.sans} fontSize="21" fill="#4a4436">{s.text}</text></g>; })}
      </svg>
      <Evidence kind={evidence} note={note} /><Src text={source} />
    </Paper>
  );
}

/** 2. Experiment reconstruction: a class of pupils, a random 20% tagged, the steps of the study across the top (Practical Psychology's step-by-step). */
export function Experiment({ t, rows = 4, cols = 8, picked = [], step = 0, steps, title, source, evidence = "method", result }) {
  const f = useCurrentFrame(), W0 = 520, H0 = 330, gx = 120, gy = 110;
  return (
    <Paper t={t}>
      <div style={{ position: "absolute", left: 120, top: 116, fontFamily: F.display, fontWeight: 700, fontSize: 56, color: t.ink }}>{title}</div>
      <div style={{ position: "absolute", left: 120, top: 210, display: "flex", gap: 16 }}>{steps.map((s, i) => <div key={i} style={{ width: 400, padding: "14px 18px", border: `3px solid ${i === step ? t.accent : "#c9bfa8"}`, background: i === step ? "#fffdf6" : "rgba(255,253,246,0.5)", opacity: i <= step ? 1 : 0.45 }}><div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 18, color: i === step ? t.accent : "#7a705c" }}>STEP {i + 1}</div><div style={{ fontFamily: F.grot, fontWeight: 700, fontSize: 25, color: t.ink, marginTop: 4 }}>{s.title}</div><div style={{ fontFamily: F.sans, fontSize: 19, color: "#4a4436", marginTop: 4 }}>{s.text}</div></div>)}</div>
      <svg width="1920" height="1080" style={{ position: "absolute" }}>
        <rect x={W0 - 60} y={H0 + 90} width={cols * gx + 20} height={rows * gy + 30} fill="none" stroke="#c9bfa8" strokeWidth="2" />
        {Array.from({ length: rows * cols }, (_, i) => { const r = Math.floor(i / cols), c = i % cols, isP = picked.includes(i), a = ramp(f, 4 + i * 0.6, 14 + i * 0.6), tagOn = step >= 1 && isP && f > 30 + picked.indexOf(i) * 4;
          return <Person key={i} x={W0 + c * gx} y={H0 + 160 + r * gy} s={0.9} ink={t.ink} accent={t.accent} op={a} fill={tagOn ? t.accentSoft : "none"} tag={tagOn ? "BLOOMER" : null} />; })}
      </svg>
      {result && <div style={{ position: "absolute", right: 120, bottom: 110, width: 480, background: "#fffdf6", border: `3px solid ${t.ink}`, padding: "20px 24px", opacity: ramp(f, 60, 76) }}><div style={{ fontFamily: F.mono, fontSize: 18, color: "#7a705c" }}>{result.label}</div><div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 64, color: t.accent }}>{result.value}</div><div style={{ fontFamily: F.sans, fontSize: 20, color: t.ink }}>{result.note}</div></div>}
      <Evidence kind={evidence} /><Src text={source} />
    </Paper>
  );
}

/** 3. Study card: a citation on an index card with design, sample, finding and status. */
export function StudyCard({ t, authors, year, venue, design, sample, finding, evidence, quote, photo, credit }) {
  const f = useCurrentFrame(), a = ramp(f, 0, 16, expo);
  return (
    <Paper t={t}>
      {photo && <div style={{ position: "absolute", right: 130, top: 170, width: 520, height: 640, transform: "rotate(2deg)", background: "#fff", padding: 16, boxShadow: "0 18px 50px rgba(60,45,20,0.35)" }}><Img src={src(photo)} style={{ width: "100%", height: "92%", objectFit: "cover", filter: "grayscale(0.2)" }} /><div style={{ fontFamily: F.sans, fontSize: 15, color: "#5d5545", marginTop: 8 }}>{credit}</div></div>}
      <div style={{ position: "absolute", left: 130, top: photo ? 220 : 260, width: photo ? 1050 : 1660, background: "#fffdf6", border: "1px solid #d8cdb2", boxShadow: "0 18px 50px rgba(60,45,20,0.25)", padding: "40px 50px", opacity: a, transform: `rotate(-0.6deg) translateY(${(1 - a) * 20}px)` }}>
        <div style={{ fontFamily: F.mono, fontSize: 22, color: t.accent, letterSpacing: "0.1em" }}>{year} · {venue}</div>
        <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 60, color: t.ink, marginTop: 8 }}>{authors}</div>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", rowGap: 16, columnGap: 20, marginTop: 30, fontSize: 28 }}>
          {[["Design", design], ["Sample", sample], ["Finding", finding]].filter(([, v]) => v).map(([k, v], i) => <React.Fragment key={k}><div style={{ fontFamily: F.mono, fontSize: 20, color: "#7a705c", paddingTop: 6, opacity: ramp(f, 14 + i * 10, 24 + i * 10) }}>{k.toUpperCase()}</div><div style={{ fontFamily: F.serif, color: t.ink, lineHeight: 1.35, opacity: ramp(f, 14 + i * 10, 24 + i * 10) }}>{v}</div></React.Fragment>)}
        </div>
        {quote && <div style={{ marginTop: 30, borderLeft: `6px solid ${t.accent}`, paddingLeft: 20, fontFamily: F.serif, fontStyle: "italic", fontSize: 28, color: t.ink, opacity: ramp(f, 46, 60) }}>"{quote}"</div>}
      </div>
      <Evidence kind={evidence} />
    </Paper>
  );
}

/** 4. Effect-size scatter from a real meta-analysis: one dot per study (area = sample size), x = a moderator, y = effect size d, zero line,
 * pooled mean, and the claim being tested drawn as a band for comparison. */
export function EffectPlot({ t, rows, xKey = "weeks_prior_contact", xLabel, mean, claim, title, source, evidence = "replicated_small", highlightX }) {
  const f = useCurrentFrame(), X = (v) => 240 + (v / 25) * 1420, Y = (d) => 760 - d * 420, a = ramp(f, 4, 14);
  return (
    <Paper t={t}>
      <div style={{ position: "absolute", left: 120, top: 116, fontFamily: F.display, fontWeight: 700, fontSize: 52, color: t.ink, maxWidth: 1600 }}>{title}</div>
      <svg width="1920" height="1080" style={{ position: "absolute" }}>
        {[-0.4, 0, 0.4, 0.8, 1.2].map((d) => <g key={d}><line x1="240" x2="1660" y1={Y(d)} y2={Y(d)} stroke={d === 0 ? t.ink : "#d8cdb2"} strokeWidth={d === 0 ? 3 : 1.5} /><text x="220" y={Y(d) + 8} textAnchor="end" fontFamily={F.mono} fontSize="22" fill="#5d5545">{d.toFixed(1)}</text></g>)}
        {[0, 5, 10, 15, 20, 25].map((w) => <text key={w} x={X(w)} y="830" textAnchor="middle" fontFamily={F.mono} fontSize="22" fill="#5d5545">{w}</text>)}
        <text x="950" y="880" textAnchor="middle" fontFamily={F.sans} fontSize="26" fill={t.ink}>{xLabel}</text>
        <text x="110" y="470" textAnchor="middle" fontFamily={F.sans} fontSize="26" fill={t.ink} transform="rotate(-90 110 470)">effect size (d)</text>
        {highlightX != null && <rect x={X(-0.5)} y={Y(1.3)} width={X(highlightX) - X(-0.5)} height={Y(-0.45) - Y(1.3)} fill={t.accentSoft} opacity={0.5 * ramp(f, 50, 64)} />}
        {mean != null && <g opacity={ramp(f, 70, 84)}><line x1="240" x2="1660" y1={Y(mean)} y2={Y(mean)} stroke={t.accent} strokeWidth="4" strokeDasharray="14 8" /><text x="1660" y={Y(mean) - 14} textAnchor="end" fontFamily={F.grot} fontWeight="700" fontSize="26" fill={t.accent}>average across all 19 studies: d = {mean}</text></g>}
        {rows.map((r, i) => { const op = ramp(f, 10 + i * 2.2, 18 + i * 2.2), n = r.n_expectancy + r.n_control; return <circle key={i} cx={X(r[xKey])} cy={Y(r.d)} r={6 + Math.sqrt(n) * 0.9} fill={r.author.includes("Rosenthal Jacobson") ? t.accent : t.ink} fillOpacity={r.author.includes("Rosenthal Jacobson") ? 0.95 : 0.55} stroke="#fffdf6" strokeWidth="2" opacity={op} />; })}
        {rows.filter((r) => r.author.includes("Rosenthal Jacobson")).map((r, i) => <text key={i} x={X(r[xKey]) + 30} y={Y(r.d) - 18} fontFamily={F.grot} fontWeight="700" fontSize="24" fill={t.accent} opacity={ramp(f, 40, 52)}>Rosenthal & Jacobson 1968</text>)}
      </svg>
      {claim && <div style={{ position: "absolute", right: 120, top: 210, width: 470, background: "#fffdf6", border: "2px dashed #6A4FB3", padding: "16px 20px", opacity: ramp(f, 90, 104) }}><div style={{ fontFamily: F.mono, fontSize: 17, color: "#6A4FB3" }}>{claim.label}</div><div style={{ fontFamily: F.sans, fontSize: 23, color: t.ink, marginTop: 6 }}>{claim.text}</div></div>}
      <Evidence kind={evidence} /><Src text={source} />
    </Paper>
  );
}

/** 5. Claim vs evidence: what people say on the left, what the research shows on the right, each line with its own status. */
export function ClaimVsEvidence({ t, claims, evidence, title, source }) {
  const f = useCurrentFrame();
  return (
    <Paper t={t}>
      <div style={{ position: "absolute", left: 120, top: 110, fontFamily: F.display, fontWeight: 700, fontSize: 56, color: t.ink }}>{title}</div>
      {[["THE POPULAR VERSION", claims, "#6A4FB3", 120], ["WHAT THE RESEARCH SHOWS", evidence, t.ink, 1000]].map(([h, list, col, x], c) => (
        <div key={c} style={{ position: "absolute", left: x, top: 230, width: 800 }}>
          <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 22, color: col, letterSpacing: "0.12em", borderBottom: `3px solid ${col}`, paddingBottom: 8 }}>{h}</div>
          {list.map((l, i) => { const a = ramp(f, 14 + c * 30 + i * 12, 28 + c * 30 + i * 12); return <div key={i} style={{ marginTop: 22, opacity: a, display: "flex", gap: 16 }}>{l.kind && <div style={{ flex: "none", fontFamily: F.mono, fontWeight: 700, fontSize: 14, color: "#fff", background: EV[l.kind][1], padding: "4px 8px", height: 20 }}>{EV[l.kind][0]}</div>}<div style={{ fontFamily: c ? F.serif : F.sans, fontSize: 28, lineHeight: 1.35, color: t.ink, textDecoration: l.strike ? "line-through" : "none", textDecorationColor: "#C4421A" }}>{l.text}</div></div>; })}
        </div>))}
      <Src text={source} />
    </Paper>
  );
}

/** 6. One big number from a study with what it means (Practical Psychology's "75% answered incorrectly"). */
export function Stat({ t, value, label, detail, evidence = "established", source }) {
  const f = useCurrentFrame(), a = ramp(f, 4, 20, expo);
  return (
    <Paper t={t}>
      <div style={{ position: "absolute", left: 120, top: 250, fontFamily: F.display, fontWeight: 700, fontSize: 280, lineHeight: 1, color: t.accent, opacity: a, transform: `scale(${0.9 + 0.1 * a})`, transformOrigin: "left center" }}>{value}</div>
      <div style={{ position: "absolute", left: 130, top: 560, width: 1500, fontFamily: F.serif, fontSize: 54, lineHeight: 1.25, color: t.ink, opacity: ramp(f, 18, 32) }}>{label}</div>
      {detail && <div style={{ position: "absolute", left: 130, top: 720, width: 1400, fontFamily: F.sans, fontSize: 32, lineHeight: 1.4, color: "#4a4436", opacity: ramp(f, 30, 44) }}>{detail}</div>}
      <Evidence kind={evidence} /><Src text={source} />
    </Paper>
  );
}

/** 7. Everyday scenario: two people, a thought bubble each, a behaviour arrow between them (the concept in daily life). */
export function Scenario({ t, left, right, arrow, title, evidence = "popular", note }) {
  const f = useCurrentFrame();
  return (
    <Paper t={t} grid={false}>
      <div style={{ position: "absolute", left: 120, top: 100, fontFamily: F.display, fontWeight: 700, fontSize: 52, color: t.ink }}>{title}</div>
      <svg width="1920" height="1080" style={{ position: "absolute" }}>
        <Person x={560} y={700} s={3.2} ink={t.ink} accent={t.accent} />
        <Person x={1360} y={700} s={3.2} ink={t.ink} accent={t.accent} hi={right.hi} />
        <defs><marker id="sa2" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill={t.accent} /></marker></defs>
        <path d={`M 700 640 Q 960 ${560 - 60 * ramp(f, 30, 50)} ${700 + 520 * ramp(f, 30, 50)} 640`} fill="none" stroke={t.accent} strokeWidth="6" markerEnd="url(#sa2)" />
        <text x="960" y="545" textAnchor="middle" fontFamily={F.grot} fontWeight="700" fontSize="30" fill={t.accent} opacity={ramp(f, 46, 58)}>{arrow}</text>
      </svg>
      {[[left, 300], [right, 1100]].map(([p, x], i) => <div key={i} style={{ position: "absolute", left: x, top: 230, width: 520, background: "#fffdf6", border: `3px solid ${t.ink}`, borderRadius: 30, padding: "20px 26px", opacity: ramp(f, 10 + i * 16, 24 + i * 16) }}><div style={{ fontFamily: F.mono, fontSize: 18, color: "#7a705c" }}>{p.who}</div><div style={{ fontFamily: F.serif, fontStyle: "italic", fontSize: 30, color: t.ink, marginTop: 6 }}>{p.thought}</div></div>)}
      <Evidence kind={evidence} note={note} />
    </Paper>
  );
}

/** Thumbnail: notebook paper, the concept name huge, one ink figure singled out among many (Aperture's single red figure), a verdict stamp. */
export function PsychThumb({ t, big, stamp, crowd = 9, single = 4, photo }) {
  return (
    <Paper t={t}>
      {photo && <Img src={src(photo)} style={{ position: "absolute", right: 0, top: 0, width: 700, height: 1080, objectFit: "cover", filter: "grayscale(1) contrast(1.1)", opacity: 0.9 }} />}
      <div style={{ position: "absolute", left: 90, top: 90, fontFamily: F.display, fontWeight: 700, fontSize: 168, lineHeight: 0.95, color: t.ink, whiteSpace: "pre-line" }}>{big}</div>
      <svg width="1920" height="1080" style={{ position: "absolute" }}>{Array.from({ length: crowd }, (_, i) => <Person key={i} x={150 + i * 120} y={860} s={1.8} ink={t.ink} accent={t.accent} fill={i === single ? t.accent : "none"} hi={i === single} />)}</svg>
      {stamp && <div style={{ position: "absolute", right: photo ? 540 : 140, top: 620, transform: "rotate(-10deg)", border: `10px solid #C4421A`, color: "#C4421A", fontFamily: F.mono, fontWeight: 700, fontSize: 84, padding: "6px 24px", letterSpacing: "0.06em", background: "rgba(255,253,246,0.85)" }}>{stamp}</div>}
    </Paper>
  );
}

export const PSYCH = { cycle: Cycle, experiment: Experiment, study: StudyCard, effect: EffectPlot, claims: ClaimVsEvidence, stat: Stat, scenario: Scenario, thumb: PsychThumb };
