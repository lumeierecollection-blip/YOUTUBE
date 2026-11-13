// Celebrity News long form: international entertainment news in three treatments chosen per story.
//  - investigation: evidence captures with highlighted lines + a status chip (shares Source/Quote/Status with Court & Spotlight, own colours)
//  - magazine: glossy portrait covers, award and record cards, premium type (reference: the polish of awards coverage, not a channel's art)
//  - explainer (VOX-style): ownership and money-flow diagrams, comparisons, numbered "why" cards, charts
// Built from Patrick Cc: (1-3 large real faces, a recreated public post with its date), SWOOP (arrow to the document that proves the point),
// As Told by JP (music-career explainers, tight face crops, opinion headline), SunnyV2 (quote card in quotation marks). The list/"where are
// they now" format of Nicki Swift / The List is NOT used: their newest-30 median is 3-4k views on 2-3M subscribers (format has collapsed).
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { F, Fonts, Finish, clamp, eio, eo, expo, lerp, ramp } from "./kit.jsx";
import { Source, Quote, Status, CreditTag } from "./court.jsx";

const src = (p) => (p.startsWith("data:") || p.startsWith("http") ? p : staticFile(p));
const Glow = ({ t, children }) => <AbsoluteFill style={{ background: `radial-gradient(110% 90% at 70% 30%, ${t.bg2} 0%, ${t.bg} 70%)` }}><Fonts />{children}</AbsoluteFill>;

/** 1. Magazine cover: a real photograph full height, masthead-style serif headline, cover lines, issue line. */
export function Cover({ t, photo, credit, kicker, headline, lines = [], issue, pos = "50% 20%", status = "fact" }) {
  const f = useCurrentFrame(), s = interpolate(f, [0, 300], [1.04, 1.1], clamp);
  return (
    <AbsoluteFill style={{ background: "#0b0a0d" }}><Fonts />
      <Img src={src(photo)} style={{ position: "absolute", right: 0, top: 0, width: 1150, height: 1080, objectFit: "cover", objectPosition: pos, transform: `scale(${s})`, transformOrigin: "60% 30%" }} />
      <AbsoluteFill style={{ background: `linear-gradient(90deg, ${t.bg} 0%, ${t.bg} 34%, rgba(0,0,0,0) 62%), linear-gradient(0deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 30%)` }} />
      {kicker && <div style={{ position: "absolute", left: 100, top: 110, fontFamily: F.mono, fontSize: 24, letterSpacing: "0.3em", color: t.gold, opacity: ramp(f, 0, 12) }}>{kicker}</div>}
      <div style={{ position: "absolute", left: 92, top: 160, width: 900, fontFamily: F.display, fontWeight: 700, fontSize: 128, lineHeight: 0.95, color: "#fff", opacity: ramp(f, 4, 22, expo), whiteSpace: "pre-line", letterSpacing: "-0.01em" }}>{headline}</div>
      {lines.map((l, i) => <div key={i} style={{ position: "absolute", left: 100, top: 640 + i * 78, width: 820, borderTop: `2px solid ${t.gold}`, paddingTop: 10, opacity: ramp(f, 26 + i * 10, 40 + i * 10) }}><span style={{ fontFamily: F.grot, fontWeight: 700, fontSize: 30, color: t.gold }}>{l.big} </span><span style={{ fontFamily: F.sans, fontSize: 26, color: "#f2eef5" }}>{l.text}</span></div>)}
      {issue && <div style={{ position: "absolute", right: 60, top: 50, fontFamily: F.mono, fontSize: 20, color: "rgba(255,255,255,0.85)", letterSpacing: "0.2em", textShadow: "0 1px 4px #000" }}>{issue}</div>}
      <Status kind={status} x={100} y={50} /><CreditTag text={credit} />
      <Finish grain={0.04} vignette={0.3} />
    </AbsoluteFill>
  );
}

/** 2. Record / award card: one achievement, gold numerals, what it was measured by, the source. */
export function Record({ t, value, label, detail, source, photo, credit, status = "fact" }) {
  const f = useCurrentFrame(), a = ramp(f, 4, 22, expo);
  return (
    <Glow t={t}>
      {photo && <Img src={src(photo)} style={{ position: "absolute", left: 0, top: 0, width: 760, height: 1080, objectFit: "cover", objectPosition: "50% 25%", filter: "saturate(0.9)", WebkitMaskImage: "linear-gradient(90deg, #000 60%, transparent 100%)" }} />}
      <div style={{ position: "absolute", left: photo ? 820 : 160, top: 240, fontFamily: F.display, fontWeight: 700, fontSize: 230, lineHeight: 1, color: t.gold, opacity: a, transform: `translateY(${(1 - a) * 30}px)`, textShadow: "0 4px 40px rgba(232,192,106,0.35)" }}>{value}</div>
      <div style={{ position: "absolute", left: photo ? 830 : 170, top: 500, width: 980, fontFamily: F.grot, fontWeight: 700, fontSize: 52, lineHeight: 1.15, color: "#fff", opacity: ramp(f, 16, 30) }}>{label}</div>
      {detail && <div style={{ position: "absolute", left: photo ? 830 : 170, top: 650, width: 960, fontFamily: F.sans, fontSize: 30, lineHeight: 1.4, color: "rgba(242,238,245,0.8)", opacity: ramp(f, 26, 40) }}>{detail}</div>}
      {source && <div style={{ position: "absolute", left: photo ? 830 : 170, bottom: 60, fontFamily: F.sans, fontSize: 20, color: "rgba(242,238,245,0.55)" }}>Source: {source}</div>}
      <Status kind={status} x={photo ? 830 : 170} y={60} /><CreditTag text={credit} />
    </Glow>
  );
}

/** 3. Ownership / money flow (VOX explainer): who owned what and when, with the price on each arrow. nodes: [{ id, label, sub, x, y, photo }] links: [{ a, b, label, date, from }] */
export function Flow({ t, title, nodes, links, focus, source, status = "reported" }) {
  const f = useCurrentFrame(), by = Object.fromEntries(nodes.map((n) => [n.id, n]));
  return (
    <Glow t={t}>
      <div style={{ position: "absolute", left: 100, top: 70, fontFamily: F.grot, fontWeight: 700, fontSize: 52, color: "#fff" }}>{title}</div>
      <svg width="1920" height="1080" style={{ position: "absolute" }}>
        <defs><marker id="cn" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill={t.gold} /></marker></defs>
        {links.map((l, i) => { const A = by[l.a], B = by[l.b], p = ramp(f, l.from ?? 20 + i * 16, (l.from ?? 20 + i * 16) + 20, eio), dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, x1 = A.x + ux * 120, y1 = A.y + uy * 120, x2 = B.x - ux * 130, y2 = B.y - uy * 130, mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          return <g key={i}><line x1={x1} y1={y1} x2={x1 + (x2 - x1) * p} y2={y1 + (y2 - y1) * p} stroke={t.gold} strokeWidth="5" markerEnd={p > 0.95 ? "url(#cn)" : undefined} />
            {p > 0.9 && <g><rect x={mx - 140} y={my - 44} width="280" height="78" rx="8" fill={t.bg} stroke={t.gold} strokeWidth="2" /><text x={mx} y={my - 10} textAnchor="middle" fontFamily={F.grot} fontWeight="700" fontSize="28" fill="#fff">{l.label}</text><text x={mx} y={my + 22} textAnchor="middle" fontFamily={F.mono} fontSize="19" fill={t.gold}>{l.date}</text></g>}</g>; })}
      </svg>
      {nodes.map((n, i) => { const a = ramp(f, 4 + i * 8, 18 + i * 8, expo), hi = focus === n.id; return (
        <div key={n.id} style={{ position: "absolute", left: n.x - 110, top: n.y - 110, width: 220, textAlign: "center", opacity: a, transform: `scale(${0.85 + 0.15 * a})` }}>
          <div style={{ width: 170, height: 170, margin: "0 auto", borderRadius: "50%", overflow: "hidden", border: `5px solid ${hi ? t.gold : "rgba(255,255,255,0.5)"}`, background: n.photo ? "#000" : t.bg2, display: "flex", alignItems: "center", justifyContent: "center" }}>{n.photo ? <Img src={src(n.photo)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: n.pos || "50% 25%" }} /> : <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: 40, color: "#fff" }}>{n.mono || n.label.split(" ").map((w) => w[0]).join("").slice(0, 3)}</span>}</div>
          <div style={{ fontFamily: F.grot, fontWeight: 700, fontSize: 28, color: "#fff", marginTop: 10 }}>{n.label}</div>
          {n.sub && <div style={{ fontFamily: F.sans, fontSize: 19, color: "rgba(242,238,245,0.7)" }}>{n.sub}</div>}
        </div>); })}
      {source && <div style={{ position: "absolute", left: 100, bottom: 40, fontFamily: F.sans, fontSize: 19, color: "rgba(242,238,245,0.55)" }}>Source: {source}</div>}
      <Status kind={status} x={100} y={150} />
    </Glow>
  );
}

/** 4. Explainer card: a concept defined in one line with the key term highlighted, and a small labelled diagram (two copyrights of a song). */
export function Explainer({ t, kicker, term, definition, parts = [], source, status = "fact" }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: t.light }}><Fonts />
      <div style={{ position: "absolute", left: 120, top: 110, fontFamily: F.mono, fontSize: 24, letterSpacing: "0.24em", color: t.accent }}>{kicker}</div>
      <div style={{ position: "absolute", left: 114, top: 160, fontFamily: F.display, fontWeight: 700, fontSize: 110, color: "#14111a", opacity: ramp(f, 0, 14) }}><span style={{ background: `linear-gradient(90deg, ${t.highlight} ${ramp(f, 10, 28) * 100}%, transparent ${ramp(f, 10, 28) * 100}%)`, padding: "0 10px" }}>{term}</span></div>
      <div style={{ position: "absolute", left: 120, top: 330, width: 1650, fontFamily: F.serif, fontSize: 42, lineHeight: 1.35, color: "#14111a", opacity: ramp(f, 18, 32) }}>{definition}</div>
      <div style={{ position: "absolute", left: 120, top: 560, display: "flex", gap: 40 }}>{parts.map((p, i) => <div key={i} style={{ width: 800, background: "#fff", border: `4px solid ${i ? t.accent : "#14111a"}`, padding: "26px 32px", opacity: ramp(f, 36 + i * 14, 50 + i * 14), transform: `translateY(${(1 - ramp(f, 36 + i * 14, 50 + i * 14)) * 20}px)` }}><div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 22, color: i ? t.accent : "#14111a" }}>{p.kicker}</div><div style={{ fontFamily: F.grot, fontWeight: 700, fontSize: 46, color: "#14111a", marginTop: 6 }}>{p.title}</div><div style={{ fontFamily: F.sans, fontSize: 27, lineHeight: 1.4, color: "#3a3540", marginTop: 10 }}>{p.text}</div>{p.owner && <div style={{ marginTop: 16, fontFamily: F.mono, fontWeight: 700, fontSize: 22, color: "#fff", background: i ? t.accent : "#14111a", display: "inline-block", padding: "6px 12px" }}>{p.owner}</div>}</div>)}</div>
      {source && <div style={{ position: "absolute", left: 120, bottom: 40, fontFamily: F.sans, fontSize: 19, color: "#6a6470" }}>Source: {source}</div>}
      <Status kind={status} x={1500} y={60} />
    </AbsoluteFill>
  );
}

/** 5. Then vs now comparison: two eras side by side, real photos, a measured line under each. */
export function Compare({ t, left, right, title, verdict, source }) {
  const f = useCurrentFrame();
  return (
    <Glow t={t}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 60, textAlign: "center", fontFamily: F.grot, fontWeight: 700, fontSize: 52, color: "#fff" }}>{title}</div>
      {[left, right].map((p, i) => { const a = ramp(f, 8 + i * 14, 26 + i * 14, expo); return (
        <div key={i} style={{ position: "absolute", left: 120 + i * 860, top: 170, width: 820, opacity: a, transform: `translateX(${(1 - a) * (i ? 40 : -40)}px)` }}>
          <div style={{ width: 820, height: 560, overflow: "hidden", border: `4px solid ${i ? t.gold : "rgba(255,255,255,0.5)"}` }}><Img src={src(p.photo)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: p.pos || "50% 30%" }} /></div>
          <div style={{ fontFamily: F.mono, fontSize: 22, letterSpacing: "0.18em", color: i ? t.gold : "rgba(242,238,245,0.7)", marginTop: 16 }}>{p.kicker}</div>
          <div style={{ fontFamily: F.grot, fontWeight: 700, fontSize: 40, color: "#fff", marginTop: 4 }}>{p.title}</div>
          <div style={{ fontFamily: F.sans, fontSize: 24, color: "rgba(242,238,245,0.75)", marginTop: 6 }}>{p.text}</div>
          {p.credit && <div style={{ fontFamily: F.sans, fontStyle: "italic", fontSize: 16, color: "rgba(242,238,245,0.5)", marginTop: 6 }}>Photo: {p.credit}</div>}
        </div>); })}
      {verdict && <div style={{ position: "absolute", left: 0, right: 0, bottom: 50, textAlign: "center", fontFamily: F.display, fontWeight: 700, fontSize: 44, color: t.gold, opacity: ramp(f, 50, 64) }}>{verdict}</div>}
      {source && <div style={{ position: "absolute", left: 120, bottom: 14, fontFamily: F.sans, fontSize: 17, color: "rgba(242,238,245,0.5)" }}>Source: {source}</div>}
    </Glow>
  );
}

/** 6. Chart: chart positions or totals as bars with the re-recorded/new bar highlighted. bars: [{ label, value, hi, note }] */
export function Bars({ t, title, sub, bars, unit = "", source, status = "fact", invert }) {
  const f = useCurrentFrame(), max = Math.max(...bars.map((b) => b.value));
  return (
    <Glow t={t}>
      <div style={{ position: "absolute", left: 120, top: 80, fontFamily: F.grot, fontWeight: 700, fontSize: 54, color: "#fff" }}>{title}</div>
      {sub && <div style={{ position: "absolute", left: 122, top: 152, fontFamily: F.sans, fontSize: 26, color: "rgba(242,238,245,0.7)" }}>{sub}</div>}
      {bars.map((b, i) => { const a = ramp(f, 14 + i * 9, 40 + i * 9, expo), y = 250 + i * 118, w = ((invert ? max - b.value + 1 : b.value) / max) * 1150 * a; return (
        <div key={i}>
          <div style={{ position: "absolute", left: 120, top: y + 14, width: 420, fontFamily: F.grot, fontWeight: 700, fontSize: 30, color: b.hi ? t.gold : "#fff" }}>{b.label}</div>
          <div style={{ position: "absolute", left: 560, top: y + 6, width: w, height: 56, background: b.hi ? t.gold : "rgba(242,238,245,0.35)" }} />
          <div style={{ position: "absolute", left: 576 + w, top: y + 10, fontFamily: F.mono, fontWeight: 700, fontSize: 34, color: "#fff" }}>{b.prefix || ""}{b.value}{unit}</div>
          {b.note && <div style={{ position: "absolute", left: 560, top: y + 66, fontFamily: F.sans, fontSize: 19, color: "rgba(242,238,245,0.6)" }}>{b.note}</div>}
        </div>); })}
      {source && <div style={{ position: "absolute", left: 120, bottom: 40, fontFamily: F.sans, fontSize: 19, color: "rgba(242,238,245,0.55)" }}>Source: {source}</div>}
      <Status kind={status} x={1500} y={60} />
    </Glow>
  );
}

/** 7. Recreated public post (Patrick Cc: "Megan Fox ✓ ... August 31st 2008"): ONLY the words of a real, cited public statement, its platform and date. */
export function Post({ t, platform, handle, date, text, mark, photo, source, status = "official" }) {
  const f = useCurrentFrame(), words = text.split(" ");
  return (
    <Glow t={t}>
      {photo && <Img src={src(photo)} style={{ position: "absolute", left: 0, top: 0, width: 760, height: 1080, objectFit: "cover", objectPosition: "50% 20%", filter: "grayscale(0.5) brightness(0.55)" }} />}
      <div style={{ position: "absolute", left: photo ? 700 : 360, top: 150, width: 1100, background: "#fff", borderRadius: 18, padding: "36px 44px", boxShadow: "0 30px 90px rgba(0,0,0,0.6)", opacity: ramp(f, 0, 14), transform: `translateY(${(1 - ramp(f, 0, 14, expo)) * 30}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}><div style={{ width: 56, height: 56, borderRadius: "50%", background: "#14111a", color: "#fff", fontFamily: F.grot, fontWeight: 700, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>{handle.slice(0, 1).toUpperCase()}</div><div><div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 28, color: "#14111a" }}>{handle}</div><div style={{ fontFamily: F.sans, fontSize: 20, color: "#6a6470" }}>{platform} · {date}</div></div></div>
        <div style={{ fontFamily: F.sans, fontSize: 36, lineHeight: 1.42, color: "#14111a", marginTop: 22 }}>{words.map((w, i) => { const on = mark && i >= mark[0] && i <= mark[1], p = on ? ramp(f, 24 + (i - mark[0]) * 2, 30 + (i - mark[0]) * 2) : 0; return <span key={i} style={{ background: on ? `linear-gradient(90deg, ${t.highlight} ${p * 100}%, transparent ${p * 100}%)` : "none" }}>{w} </span>; })}</div>
        <div style={{ fontFamily: F.mono, fontSize: 17, color: "#6a6470", marginTop: 20 }}>Recreated from the original text; source below</div>
      </div>
      {source && <div style={{ position: "absolute", left: photo ? 700 : 360, bottom: 60, fontFamily: F.sans, fontSize: 19, color: "rgba(242,238,245,0.6)" }}>Source: {source}</div>}
      <Status kind={status} x={photo ? 700 : 360} y={60} />
    </Glow>
  );
}

/** Thumbnail: 1-2 tightly cropped real faces, an opinion headline at top (As Told by JP), one symbol (arrow / price / lock). */
export function CelebThumb({ t, photos = [], big, small, symbol }) {
  return (
    <AbsoluteFill style={{ background: t.bg }}><Fonts />
      {photos.map((p, i) => <Img key={i} src={src(p.file)} style={{ position: "absolute", left: p.x, top: 0, width: p.w, height: 1080, objectFit: "cover", objectPosition: p.pos || "50% 20%", filter: p.dim ? "grayscale(0.6) brightness(0.7)" : "contrast(1.08) saturate(1.05)" }} />)}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 36%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.55) 100%)" }} />
      <div style={{ position: "absolute", left: 60, right: 60, top: 36, fontFamily: F.cond, fontWeight: 700, fontSize: 170, lineHeight: 0.95, color: t.gold, textShadow: "0 6px 30px rgba(0,0,0,0.9)", whiteSpace: "pre-line" }}>{big}</div>
      {small && <div style={{ position: "absolute", left: 60, bottom: 60, fontFamily: F.cond, fontWeight: 700, fontSize: 90, color: "#14111a", background: "#fff", padding: "0 26px" }}>{small}</div>}
      {symbol && <div style={{ position: "absolute", right: 70, bottom: 50, fontFamily: F.cond, fontWeight: 700, fontSize: symbol.size || 150, color: symbol.color || t.gold, textShadow: "0 6px 30px rgba(0,0,0,0.9)" }}>{symbol.text}</div>}
    </AbsoluteFill>
  );
}

export const CELEB = { cover: Cover, record: Record, flow: Flow, explainer: Explainer, compare: Compare, bars: Bars, post: Post, source: Source, quote: Quote, thumb: CelebThumb };
