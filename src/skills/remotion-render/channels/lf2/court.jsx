// Court & Spotlight long form v2. Built from SunnyV2 (mxCZUz2F24E, 1aAGV7G5zbo, jZpq6BCud7s), the Diddy documentary (-p_TBe0Re_s) and
// FRONTLINE (OJ8fsE_GOlg): every claim rides on a captured source with the claim line highlighted; a "Credit:" tag on every picture;
// white-box black-serif quote cards; dated headers over typed transcript lines; a provenance bug that stays on screen; date cards.
// Our addition for the channel's safety rule: every card carries a STATUS chip (court finding / official statement / reported / allegation),
// and the charge ledger never mixes convictions with acquittals. Photographs are real (Wikimedia Commons), documents are real captures.
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { F, Fonts, Finish, clamp, eio, eo, expo, lerp, ramp, typed } from "./kit.jsx";

const src = (p) => (p.startsWith("data:") || p.startsWith("http") ? p : staticFile(p));
const STATUS = { finding: ["COURT FINDING", "#2FBF71"], official: ["OFFICIAL STATEMENT", "#4DA3FF"], reported: ["REPORTED", "#F2B441"], allegation: ["ALLEGATION · NOT PROVEN", "#E5484D"], acquitted: ["ACQUITTED", "#9AA3AD"], fact: ["ON THE RECORD", "#E8ECEF"] };

/** Status chip: what kind of claim this card makes. Always present. */
export function Status({ kind = "fact", x = 70, y = 56, from = 0 }) {
  const f = useCurrentFrame(), [label, color] = STATUS[kind], a = ramp(f, from, from + 10);
  return <div style={{ position: "absolute", left: x, top: y, display: "flex", alignItems: "center", gap: 12, opacity: a, fontFamily: F.mono, fontWeight: 700, fontSize: 22, letterSpacing: "0.14em", color, border: `2px solid ${color}`, padding: "6px 14px", background: "rgba(0,0,0,0.6)" }}><span style={{ width: 12, height: 12, background: color, borderRadius: "50%" }} />{label}</div>;
}
/** Provenance bug, top-right, stays up (FRONTLINE "Originally aired on"). */
export const Bug = ({ text }) => text ? <div style={{ position: "absolute", right: 60, top: 56, textAlign: "right", fontFamily: F.sans, fontSize: 20, lineHeight: 1.3, color: "rgba(255,255,255,0.82)", textShadow: "0 1px 4px #000", whiteSpace: "pre-line" }}>{text}</div> : null;
/** "Credit:" tag, bottom-left, bold italic with a dark outline (SunnyV2). */
export const CreditTag = ({ text }) => text ? <div style={{ position: "absolute", left: 40, bottom: 30, fontFamily: F.sans, fontStyle: "italic", fontWeight: 700, fontSize: 28, color: "#fff", textShadow: "0 0 4px #000, 0 2px 0 #000, 2px 0 0 #000, -2px 0 0 #000, 0 -2px 0 #000" }}>Credit: {text}</div> : null;
const Back = ({ t, children }) => <AbsoluteFill style={{ background: `radial-gradient(95% 85% at 50% 40%, ${t.bg2} 0%, ${t.bg} 78%)` }}><Fonts />{children}</AbsoluteFill>;

/**
 * 1. Source capture: the real page or PDF page, moved by a camera that travels to each highlighted line; the highlight sweeps across the
 * real words (rects come from the capture tool); everything else dims. image: { file, w, h }; highlights: [{ rects:[{x,y,w,h}], from, color }];
 * cam: [{ f, x, y, zoom }] in image pixels (centre point + zoom); or auto: follows the highlights.
 */
export function Source({ t, image, highlights = [], cam, status = "official", bug, label, paper = true, tilt = 0 }) {
  const f = useCurrentFrame(), W = 1920, H = 1080;
  const auto = cam || [{ f: 0, x: image.w / 2, y: Math.min(image.h / 2, (H / 2) * (image.w / 1500)), zoom: 1500 / image.w }, ...highlights.map((h) => { const xs = h.rects.map((r) => r.x), ys = h.rects.map((r) => r.y), x1 = Math.max(...h.rects.map((r) => r.x + r.w)), y1 = Math.max(...h.rects.map((r) => r.y + r.h)), w = x1 - Math.min(...xs); return { f: h.from + 4, x: (Math.min(...xs) + x1) / 2, y: (Math.min(...ys) + y1) / 2, zoom: Math.min(2.2, 1350 / w) * (h.zoom || 1) }; })];
  let i = 0; while (i < auto.length - 2 && f > auto[i + 1].f) i++;
  const a = auto[i], b = auto[Math.min(i + 1, auto.length - 1)], k = a === b ? 0 : interpolate(f, [Math.max(a.f, b.f - 28), b.f], [0, 1], { ...clamp, easing: eio }), cx = a.x + (b.x - a.x) * k, cy = a.y + (b.y - a.y) * k, z = a.zoom + (b.zoom - a.zoom) * k;
  const active = highlights.filter((h) => f >= h.from), dim = active.length ? ramp(f, active[0].from, active[0].from + 14) * 0.5 : 0;
  return (
    <Back t={t}>
      <div style={{ position: "absolute", left: W / 2, top: H / 2, width: 0, height: 0, transform: `perspective(2400px) rotateX(${tilt}deg) scale(${z}) translate(${-cx}px, ${-cy}px)`, transformOrigin: "0 0" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: image.w, height: image.h, boxShadow: paper ? "0 40px 120px rgba(0,0,0,0.75)" : "none", background: "#fff" }}>
          <Img src={src(image.file)} style={{ width: image.w, height: image.h, display: "block" }} />
          <div style={{ position: "absolute", inset: 0, background: `rgba(6,8,12,${dim})` }} />
          {active.map((h, hi) => h.rects.map((r, ri) => { const per = 8, p = ramp(f, h.from + ri * per, h.from + ri * per + per + 2, eo), on = h.to ? f < h.to : true; return (
            <React.Fragment key={`${hi}-${ri}`}>
              <div style={{ position: "absolute", left: r.x - 6, top: r.y - 4, width: r.w + 12, height: r.h + 8, overflow: "hidden", opacity: on ? 1 : 0.35 }}><Img src={src(image.file)} style={{ position: "absolute", left: -(r.x - 6), top: -(r.y - 4), width: image.w, height: image.h }} /></div>
              <div style={{ position: "absolute", left: r.x - 6, top: r.y - 4, width: (r.w + 12) * p, height: r.h + 8, background: h.color || t.mark, mixBlendMode: "multiply", opacity: on ? 0.95 : 0.4 }} />
            </React.Fragment>); }))}
        </div>
      </div>
      <AbsoluteFill style={{ background: "radial-gradient(90% 90% at 50% 50%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.55) 100%)", pointerEvents: "none" }} />
      <Status kind={status} /><Bug text={bug} />
      {label && <div style={{ position: "absolute", left: 70, bottom: 44, fontFamily: F.sans, fontSize: 22, color: "rgba(255,255,255,0.85)", background: "rgba(0,0,0,0.6)", padding: "6px 12px" }}>{label}</div>}
    </Back>
  );
}

/** 2. Quote card: white box, black serif, who said it and where (mxCZUz2F24E). Optional portrait beside it (1aAGV7G5zbo). */
export function Quote({ t, text, who, where, status = "official", photo, credit, bug, mark }) {
  const f = useCurrentFrame(), a = ramp(f, 0, 14, expo), words = text.split(" ");
  return (
    <Back t={t}>
      {photo && <><Img src={src(photo)} style={{ position: "absolute", right: 0, top: 0, width: 760, height: 1080, objectFit: "cover", objectPosition: "50% 20%", filter: "grayscale(1) contrast(1.1) brightness(0.8)" }} /><div style={{ position: "absolute", right: 0, top: 0, width: 760, height: 1080, background: `linear-gradient(90deg, ${t.bg} 0%, rgba(0,0,0,0) 45%)` }} /></>}
      <div style={{ position: "absolute", left: 110, top: 210, width: photo ? 1080 : 1500, background: "#fbfaf6", padding: "46px 56px 40px", boxShadow: "0 30px 90px rgba(0,0,0,0.6)", opacity: a, transform: `translateY(${(1 - a) * 26}px)` }}>
        <div style={{ fontFamily: F.serif, fontSize: text.length > 260 ? 38 : 46, lineHeight: 1.36, color: "#0d0d0d" }}>{words.map((w, i) => { const on = mark && i >= mark[0] && i <= mark[1], p = on ? ramp(f, 30 + (i - mark[0]) * 3, 38 + (i - mark[0]) * 3) : 0; return <span key={i} style={{ opacity: ramp(f, 6 + i * 1.1, 12 + i * 1.1), background: on ? `linear-gradient(90deg, ${t.mark} ${p * 100}%, transparent ${p * 100}%)` : "none" }}>{w} </span>; })}</div>
        <div style={{ marginTop: 26, borderTop: "2px solid #0d0d0d", paddingTop: 14, fontFamily: F.sans, fontWeight: 700, fontSize: 26, color: "#0d0d0d" }}>{who}<span style={{ fontWeight: 400, color: "#444" }}>{where ? ` · ${where}` : ""}</span></div>
      </div>
      <Status kind={status} /><Bug text={bug} /><CreditTag text={credit} />
    </Back>
  );
}

/** 3. Photograph: the real picture, slow push, credit tag, optional name-and-date lower third. layout: full | framed. */
export function Photo({ t, image, credit, name, sub, layout = "full", bw = false, pos = "50% 30%", status, bug, dur = 240 }) {
  const f = useCurrentFrame(), s = interpolate(f, [0, dur], [1.02, 1.1], clamp), flt = bw ? "grayscale(1) contrast(1.12)" : "saturate(0.92) contrast(1.05)";
  return (
    <Back t={t}>
      {layout === "full" ? <Img src={src(image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: pos, transform: `scale(${s})`, filter: flt }} /> : <>
        <Img src={src(image)} style={{ position: "absolute", inset: -60, width: "calc(100% + 120px)", height: "calc(100% + 120px)", objectFit: "cover", filter: "blur(36px) brightness(0.35) grayscale(0.5)" }} />
        <div style={{ position: "absolute", left: 560, top: 90, width: 800, height: 900, overflow: "hidden", border: "10px solid #f4f1ea", boxShadow: "0 30px 90px rgba(0,0,0,0.7)", transform: `rotate(${lerp(f, 0, dur, -1.2, -0.4)}deg)` }}><Img src={src(image)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: pos, transform: `scale(${s})`, filter: flt }} /></div></>}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.7) 100%)" }} />
      {name && <div style={{ position: "absolute", left: 70, bottom: 110, opacity: ramp(f, 12, 26) }}><div style={{ display: "inline-block", background: t.accent, color: "#fff", fontFamily: F.sans, fontWeight: 700, fontStyle: "italic", fontSize: 42, padding: "6px 18px" }}>{name}</div>{sub && <div style={{ fontFamily: F.sans, fontSize: 28, color: "#fff", marginTop: 8, textShadow: "0 1px 6px #000" }}>{sub}</div>}</div>}
      {status && <Status kind={status} />}<Bug text={bug} /><CreditTag text={credit} />
      <Finish grain={0.07} vignette={0.4} />
    </Back>
  );
}

/** 4. Dated header + typed transcript on black (jZpq6BCud7s). lines: [{ who, text, color }] typed one after another. */
export function Transcript({ t, date, heading, lines, status = "finding", bug, source }) {
  const f = useCurrentFrame(), { fps } = useVideoConfig(); let start = 20;
  return (
    <AbsoluteFill style={{ background: "#040405" }}><Fonts />
      <div style={{ position: "absolute", left: 0, right: 0, top: 150, textAlign: "center", fontFamily: F.sans, fontStyle: "italic", fontWeight: 700, fontSize: 30, opacity: ramp(f, 0, 12) }}><span style={{ color: t.date }}>{date}</span><span style={{ color: "#fff" }}> | {heading}</span></div>
      <div style={{ position: "absolute", left: 260, top: 270, width: 1400 }}>
        {lines.map((l, i) => { const s0 = start, shown = typed(l.text, f, fps, 30, s0); start += Math.ceil((l.text.length / 30) * fps) + 14; return f >= s0 && (
          <div key={i} style={{ fontFamily: F.sans, fontStyle: "italic", fontWeight: 700, fontSize: 40, lineHeight: 1.4, marginBottom: 26 }}><span style={{ color: l.color || t.speaker }}>{l.who}: </span><span style={{ color: "#fff" }}>{shown}</span>{shown.length < l.text.length && <span style={{ color: "#fff", opacity: f % 16 < 8 ? 1 : 0 }}>|</span>}</div>); })}
      </div>
      {source && <div style={{ position: "absolute", left: 0, right: 0, bottom: 60, textAlign: "center", fontFamily: F.sans, fontSize: 22, color: "rgba(255,255,255,0.6)" }}>{source}</div>}
      <Status kind={status} /><Bug text={bug} /><Finish grain={0.08} vignette={0.55} />
    </AbsoluteFill>
  );
}

/** 5. Investigative timeline: dated nodes on a spine, a playhead travels, the active node opens into a card. nodes: [{ date, title, text, status }] */
export function CaseTimeline({ t, title, nodes, active = 0, bug }) {
  const f = useCurrentFrame(), n = nodes.length, X = (i) => 170 + (i / (n - 1)) * 1580, head = lerp(f, 6, 50, X(Math.max(0, active - 1)), X(active), eio);
  return (
    <Back t={t}>
      <div style={{ position: "absolute", left: 170, top: 96, fontFamily: F.sans, fontWeight: 700, fontSize: 30, letterSpacing: "0.2em", color: "rgba(255,255,255,0.7)", textTransform: "uppercase" }}>{title}</div>
      <div style={{ position: "absolute", left: 170, top: 318, width: 1580, height: 3, background: "rgba(255,255,255,0.22)" }} /><div style={{ position: "absolute", left: 170, top: 316, width: head - 170, height: 7, background: t.accent }} />
      {nodes.map((nd, i) => { const on = head >= X(i) - 2, col = STATUS[nd.status || "fact"][1]; return (
        <div key={i} style={{ position: "absolute", left: X(i), top: 220 }}>
          <div style={{ position: "absolute", left: -90, width: 180, top: 0, textAlign: "center", fontFamily: F.mono, fontWeight: 700, fontSize: 21, color: on ? "#fff" : "rgba(255,255,255,0.4)" }}>{nd.date}</div>
          <div style={{ position: "absolute", left: -13, top: 86, width: 26, height: 26, borderRadius: "50%", background: on ? col : "#1c1f24", border: `3px solid ${on ? "#fff" : "rgba(255,255,255,0.35)"}`, transform: `scale(${i === active ? 1 + 0.25 * ramp(f, 44, 56) : 1})` }} />
          <div style={{ position: "absolute", left: -110, width: 220, top: 130, textAlign: "center", fontFamily: F.sans, fontWeight: 700, fontSize: 20, lineHeight: 1.25, color: on ? "#fff" : "rgba(255,255,255,0.35)" }}>{nd.title}</div>
        </div>); })}
      {(() => { const nd = nodes[active], a = ramp(f, 50, 66, expo), [label, col] = STATUS[nd.status || "fact"]; return (
        <div style={{ position: "absolute", left: 260, top: 520, width: 1400, background: "rgba(255,255,255,0.05)", borderLeft: `10px solid ${col}`, padding: "34px 44px", opacity: a, transform: `translateY(${(1 - a) * 30}px)` }}>
          <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 22, letterSpacing: "0.14em", color: col }}>{label} · {nd.date}</div>
          <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 64, lineHeight: 1.12, color: "#fff", marginTop: 12 }}>{nd.title}</div>
          <div style={{ fontFamily: F.serif, fontSize: 34, lineHeight: 1.4, color: "rgba(255,255,255,0.86)", marginTop: 16 }}>{nd.text}</div>
          {nd.source && <div style={{ fontFamily: F.sans, fontSize: 20, color: "rgba(255,255,255,0.55)", marginTop: 16 }}>Source: {nd.source}</div>}
        </div>); })()}
      <Bug text={bug} />
    </Back>
  );
}

/** 6. Charge ledger: every count as a cell; convictions and acquittals are different colours and are counted separately. counts: [{ n, result: guilty|acquitted, text }] */
export function Ledger({ t, title, counts, reveal = "all", source, bug }) {
  const f = useCurrentFrame(), g = counts.filter((c) => c.result === "guilty"), cols = 8, show = reveal === "all";
  return (
    <Back t={t}>
      <div style={{ position: "absolute", left: 130, top: 96, fontFamily: F.display, fontWeight: 700, fontSize: 60, color: "#fff" }}>{title}</div>
      {counts.map((c, i) => { const a = ramp(f, 8 + i * 2, 18 + i * 2, expo), guilty = c.result === "guilty", flip = show ? ramp(f, 70 + i * 2, 84 + i * 2) : 0, col = guilty ? STATUS.finding[1] : STATUS.acquitted[1]; return (
        <div key={i} style={{ position: "absolute", left: 130 + (i % cols) * 152, top: 230 + Math.floor(i / cols) * 152, width: 136, height: 136, opacity: a, transform: `scale(${0.8 + 0.2 * a})`, background: flip > 0.5 ? (guilty ? col : "rgba(255,255,255,0.06)") : "rgba(255,255,255,0.1)", border: `3px solid ${flip > 0.5 ? col : "rgba(255,255,255,0.3)"}`, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: F.mono, fontSize: 17, letterSpacing: "0.14em", color: flip > 0.5 && guilty ? "#06210f" : "rgba(255,255,255,0.6)" }}>COUNT</div>
          <div style={{ fontFamily: F.cond, fontWeight: 700, fontSize: 62, lineHeight: 1, color: flip > 0.5 && guilty ? "#06210f" : "#fff" }}>{c.n}</div>
          {flip > 0.5 && <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 14, letterSpacing: "0.08em", color: guilty ? "#06210f" : col }}>{guilty ? "GUILTY" : "ACQUITTED"}</div>}
        </div>); })}
      {show && <div style={{ position: "absolute", left: 1400, top: 230, width: 420, opacity: ramp(f, 120, 136) }}>
        <div style={{ fontFamily: F.cond, fontWeight: 700, fontSize: 190, lineHeight: 0.9, color: STATUS.finding[1] }}>{g.length}</div><div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 24, letterSpacing: "0.14em", color: STATUS.finding[1] }}>GUILTY · COURT FINDING</div>
        <div style={{ fontFamily: F.cond, fontWeight: 700, fontSize: 190, lineHeight: 0.9, color: STATUS.acquitted[1], marginTop: 30 }}>{counts.length - g.length}</div><div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 24, letterSpacing: "0.14em", color: STATUS.acquitted[1] }}>ACQUITTED</div>
      </div>}
      {show && g.map((c, i) => <div key={i} style={{ position: "absolute", left: 130, top: 720 + i * 62, width: 1200, fontFamily: F.serif, fontSize: 30, color: "#fff", opacity: ramp(f, 130 + i * 8, 142 + i * 8) }}><span style={{ fontFamily: F.mono, fontWeight: 700, color: STATUS.finding[1] }}>COUNT {c.n} </span>{c.text}</div>)}
      {source && <div style={{ position: "absolute", left: 130, bottom: 30, fontFamily: F.sans, fontSize: 20, color: "rgba(255,255,255,0.55)" }}>Source: {source}</div>}
      <Bug text={bug} />
    </Back>
  );
}

/** 7. Money card: one sourced amount, large, with what it was and where it is written. */
export function Amount({ t, value, label, detail, source, status = "finding", bug, count }) {
  const f = useCurrentFrame(), a = ramp(f, 4, 22, expo);
  return (
    <Back t={t}>
      <div style={{ position: "absolute", left: 150, top: 250, fontFamily: F.mono, fontWeight: 700, fontSize: 28, letterSpacing: "0.2em", color: t.accent2, opacity: ramp(f, 0, 10) }}>{count}</div>
      <div style={{ position: "absolute", left: 144, top: 300, fontFamily: F.display, fontWeight: 700, fontSize: 250, lineHeight: 1, color: "#fff", opacity: a, clipPath: `inset(0 ${(1 - a) * 100}% 0 0)`, whiteSpace: "nowrap" }}>{value}</div>
      <div style={{ position: "absolute", left: 150, top: 590, width: 1500, fontFamily: F.serif, fontSize: 52, lineHeight: 1.25, color: "#fff", opacity: ramp(f, 20, 34) }}>{label}</div>
      {detail && <div style={{ position: "absolute", left: 150, top: 740, width: 1400, fontFamily: F.serif, fontSize: 34, lineHeight: 1.4, color: "rgba(255,255,255,0.75)", opacity: ramp(f, 30, 44) }}>{detail}</div>}
      {source && <div style={{ position: "absolute", left: 150, bottom: 60, fontFamily: F.sans, fontSize: 22, color: "rgba(255,255,255,0.55)" }}>Source: {source}</div>}
      <Status kind={status} /><Bug text={bug} />
    </Back>
  );
}

/** 8. Relationship diagram: who stood where in the case. nodes: [{ id, label, sub, x, y, kind }], links: [{ a, b, label }]; connectors draw on. */
export function Relations({ t, title, nodes, links, focus, bug }) {
  const f = useCurrentFrame(), by = Object.fromEntries(nodes.map((n) => [n.id, n]));
  return (
    <Back t={t}>
      <div style={{ position: "absolute", left: 110, top: 80, fontFamily: F.sans, fontWeight: 700, fontSize: 30, letterSpacing: "0.2em", color: "rgba(255,255,255,0.7)", textTransform: "uppercase" }}>{title}</div>
      <svg width="1920" height="1080" style={{ position: "absolute" }}>
        {links.map((l, i) => { const A = by[l.a], B = by[l.b], p = ramp(f, 24 + i * 10, 46 + i * 10, eio), mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2; return (
          <g key={i}><line x1={A.x} y1={A.y} x2={A.x + (B.x - A.x) * p} y2={A.y + (B.y - A.y) * p} stroke={focus && (focus === l.a || focus === l.b) ? t.accent2 : "rgba(255,255,255,0.45)"} strokeWidth="4" />
            {p > 0.95 && <g><rect x={mx - l.label.length * 6.3 - 12} y={my - 19} width={l.label.length * 12.6 + 24} height="38" fill={t.bg} stroke="rgba(255,255,255,0.3)" /><text x={mx} y={my + 7} textAnchor="middle" fontFamily={F.mono} fontSize="20" fill="#fff">{l.label}</text></g>}</g>); })}
      </svg>
      {nodes.map((n, i) => { const a = ramp(f, 4 + i * 5, 18 + i * 5, expo), hi = focus === n.id; return (
        <div key={n.id} style={{ position: "absolute", left: n.x - 170, top: n.y - 58, width: 340, height: 116, background: n.kind === "subject" ? t.accent : hi ? "#fbfaf6" : "#15181d", border: `3px solid ${hi ? t.accent2 : "rgba(255,255,255,0.4)"}`, boxSizing: "border-box", opacity: a, transform: `scale(${0.9 + 0.1 * a})`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 28, color: hi && n.kind !== "subject" ? "#0d0d0d" : "#fff" }}>{n.label}</div>
          {n.sub && <div style={{ fontFamily: F.sans, fontSize: 19, color: hi && n.kind !== "subject" ? "#333" : "rgba(255,255,255,0.7)", marginTop: 4 }}>{n.sub}</div>}
        </div>); })}
      <Bug text={bug} />
    </Back>
  );
}

/** 9. Headline collage opening (mxCZUz2F24E first frames): real captures stacked at angles over a dark field, arriving one by one. items: [{ file, w, h, crop:{x,y,w,h}, x, y, width, rot }] */
export function Collage({ t, items, photo, credit, bug, title }) {
  const f = useCurrentFrame();
  return (
    <Back t={t}>
      {photo && <Img src={src(photo)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 25%", filter: "grayscale(1) brightness(0.28) contrast(1.2)", transform: `scale(${lerp(f, 0, 300, 1.04, 1.12)})` }} />}
      {items.map((it, i) => { const a = ramp(f, 4 + i * 12, 18 + i * 12, expo), sc = it.width / it.crop.w; return (
        <div key={i} style={{ position: "absolute", left: it.x, top: it.y, width: it.width, height: it.crop.h * sc, overflow: "hidden", background: "#fff", boxShadow: "0 24px 70px rgba(0,0,0,0.75)", opacity: a, transform: `rotate(${it.rot || 0}deg) translateY(${(1 - a) * 60}px) scale(${1 + 0.02 * ramp(f, 20, 240)})` }}>
          <Img src={src(it.file)} style={{ position: "absolute", left: -it.crop.x * sc, top: -it.crop.y * sc, width: it.w * sc, height: it.h * sc }} />
          {it.mark && it.mark.map((r, k) => <div key={k} style={{ position: "absolute", left: (r.x - it.crop.x) * sc - 4, top: (r.y - it.crop.y) * sc - 3, width: ((r.w) * sc + 8) * ramp(f, 30 + i * 12 + k * 6, 42 + i * 12 + k * 6), height: r.h * sc + 6, background: t.mark, mixBlendMode: "multiply" }} />)}
        </div>); })}
      {title && <div style={{ position: "absolute", left: 0, right: 0, bottom: 90, textAlign: "center", fontFamily: F.display, fontWeight: 700, fontSize: 84, color: "#fff", textShadow: "0 6px 40px #000", opacity: ramp(f, 60, 80) }}>{title}</div>}
      <Bug text={bug} /><CreditTag text={credit} /><Finish grain={0.07} vignette={0.5} />
    </Back>
  );
}

/** 10. Date card between sections (-p_TBe0Re_s "1994"; OJ8fsE_GOlg black frames between sections). */
export function DateCard({ t, big, small }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#020202", alignItems: "center", justifyContent: "center" }}><Fonts />
      <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 230, color: "#fff", letterSpacing: "0.02em", opacity: ramp(f, 4, 26), transform: `scale(${lerp(f, 0, 120, 0.98, 1.03)})` }}>{big}</div>
      {small && <div style={{ fontFamily: F.sans, fontSize: 34, letterSpacing: "0.3em", color: t.date, marginTop: 10, opacity: ramp(f, 20, 36), textTransform: "uppercase" }}>{small}</div>}
      <Finish grain={0.09} vignette={0.6} />
    </AbsoluteFill>
  );
}

/** Thumbnail: real photograph, one hard word or figure, a marked document corner. */
export function CourtThumb({ t, photo, big, small, doc, pos = "50% 20%" }) {
  return (
    <AbsoluteFill style={{ background: "#000" }}><Fonts />
      <Img src={src(photo)} style={{ position: "absolute", right: 0, top: 0, width: 1050, height: 1080, objectFit: "cover", objectPosition: pos, filter: "contrast(1.12) saturate(0.9)" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, #050505 0%, #050505 40%, rgba(5,5,5,0) 66%)" }} />
      {doc && <div style={{ position: "absolute", left: 70, top: 610, width: 860, height: 330, overflow: "hidden", background: "#fff", transform: "rotate(-3deg)", boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }}><Img src={src(doc.file)} style={{ position: "absolute", left: -doc.x * doc.s, top: -doc.y * doc.s, width: doc.w * doc.s }} />{(doc.mark || []).map((r, k) => <div key={k} style={{ position: "absolute", left: (r.x - doc.x) * doc.s - 4, top: (r.y - doc.y) * doc.s - 3, width: r.w * doc.s + 8, height: r.h * doc.s + 6, background: t.mark, mixBlendMode: "multiply" }} />)}</div>}
      <div style={{ position: "absolute", left: 70, top: 70, fontFamily: F.cond, fontWeight: 700, fontSize: 190, lineHeight: 0.95, color: "#fff", textTransform: "uppercase", whiteSpace: "pre-line", maxWidth: 900, textShadow: "0 6px 30px #000" }}>{big}</div>
      {small && <div style={{ position: "absolute", left: 76, top: 470, zIndex: 2, fontFamily: F.cond, fontWeight: 700, fontSize: 92, color: "#0a0a0a", background: t.mark, padding: "2px 24px", textTransform: "uppercase" }}>{small}</div>}
    </AbsoluteFill>
  );
}

export const COURT = { source: Source, quote: Quote, photo: Photo, transcript: Transcript, timeline: CaseTimeline, ledger: Ledger, amount: Amount, relations: Relations, collage: Collage, date: DateCard, thumb: CourtThumb };
