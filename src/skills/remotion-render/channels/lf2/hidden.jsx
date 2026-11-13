// Hidden Past long form v2. Built from RealLifeLore (WiRLNEl-4bk, U_UoAZrOTNU, FA-oEtccS_k, R60ZGwd3n9E, 3IVbe0xrRt8):
// one satellite-relief map re-framed by a real camera; colour only for ownership and routes; small uppercase labels in dark boxes;
// a small key bottom-left; credited photographs as evidence inserts with white-box black-serif captions in the source's words;
// figures stacked early; a chart laid over a picture. Imagery here is open (EOX Sentinel-2 cloudless, NASA, Commons), not their licensed tiles.
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { GeoMap } from "./geomap.jsx";
import { F, Fonts, Finish, clamp, eo, expo, lerp, ramp } from "./kit.jsx";

const src = (p) => (p.startsWith("data:") || p.startsWith("http") ? p : staticFile(p));

/** Key box, bottom-left (FA-oEtccS_k, U_UoAZrOTNU). items: [{ color, label, line }] */
function Key({ items, from = 10 }) {
  const f = useCurrentFrame(), a = ramp(f, from, from + 12);
  return <div style={{ position: "absolute", left: 56, bottom: 60, background: "rgba(10,12,16,0.88)", padding: "14px 20px 12px", borderRadius: 4, opacity: a, fontFamily: F.cond, fontSize: 22, letterSpacing: "0.1em", color: "#fff", textTransform: "uppercase" }}>
    {items.map((it, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}><span style={{ width: 26, height: it.line ? 5 : 18, background: it.color, borderRadius: 2 }} />{it.label}</div>)}
  </div>;
}
/** Stat tag on the map (3IVbe0xrRt8 "~53 MILLION PEOPLE"): light box, dark condensed type. */
function Tag({ text, x, y, from = 0 }) {
  const f = useCurrentFrame(), a = ramp(f, from, from + 10, expo);
  return <div style={{ position: "absolute", left: x, top: y, background: "rgba(232,236,240,0.94)", color: "#0b0d10", padding: "8px 18px 6px", fontFamily: F.cond, fontWeight: 700, fontSize: 34, letterSpacing: "0.1em", textTransform: "uppercase", borderRadius: 3, opacity: a, transform: `scale(${0.9 + 0.1 * a})`, transformOrigin: "left center" }}>{text}</div>;
}
/** Caption box in the source's own words (WiRLNEl-4bk): white box, black serif, lower third; several can follow each other. */
function Captions({ items = [] }) {
  const f = useCurrentFrame();
  return items.map((c, i) => { const a = Math.min(ramp(f, c.from, c.from + 8), c.to ? 1 - ramp(f, c.to - 8, c.to) : 1); return a > 0 && (
    <div key={i} style={{ position: "absolute", left: 90, right: 90, bottom: 96, display: "flex", justifyContent: "center", opacity: a }}>
      <div style={{ background: "rgba(255,255,255,0.96)", color: "#0c0c0c", fontFamily: F.serif, fontSize: 38, lineHeight: 1.32, padding: "16px 28px", maxWidth: 1480, textAlign: "center", boxShadow: "0 6px 30px rgba(0,0,0,0.45)" }}>{c.text}{c.source && <span style={{ display: "block", fontFamily: F.sans, fontSize: 20, color: "#555", marginTop: 6 }}>{c.source}</span>}</div>
    </div>); });
}
const Credit = ({ text, left = 34 }) => <div style={{ position: "absolute", left, bottom: 26, fontFamily: F.sans, fontSize: 19, color: "rgba(255,255,255,0.86)", textShadow: "0 1px 4px #000, 0 0 2px #000" }}>{text}</div>;
/** Date stamp, top-left (dated cold open). */
const DateStamp = ({ text, from = 0 }) => { const f = useCurrentFrame(); return <div style={{ position: "absolute", left: 60, top: 54, fontFamily: F.mono, fontWeight: 700, fontSize: 30, letterSpacing: "0.12em", color: "#fff", background: "rgba(0,0,0,0.6)", padding: "8px 16px", opacity: ramp(f, from, from + 10) }}>{text}</div>; };

/** 1. The map scene: everything GeoMap does, plus key, tags, captions and a date stamp. */
export function MapScene({ key_, tags = [], captions, date, ...map }) {
  return (
    <AbsoluteFill><GeoMap {...map}>
      {key_ && <Key items={key_} />}
      {tags.map((t, i) => <Tag key={i} {...t} />)}
      {date && <DateStamp text={date} />}
      <Captions items={captions} />
    </GeoMap></AbsoluteFill>
  );
}

/** 2. Credited photograph as evidence: full bleed, slow push, the credit stays on screen, captions in the source's words. */
export function Footage({ image, credit, captions, date, dur = 240, from = 1.02, to = 1.1, pos = "50% 50%", grade = "none", fit = "cover" }) {
  const f = useCurrentFrame(), s = interpolate(f, [0, dur], [from, to], clamp);
  const filter = grade === "bw" ? "grayscale(1) contrast(1.08)" : grade === "warm" ? "sepia(0.25) saturate(0.85) contrast(1.05)" : "saturate(0.9) contrast(1.04)";
  return (
    <AbsoluteFill style={{ background: "#07080a" }}><Fonts />
      {fit === "contain" && <Img src={src(image)} style={{ position: "absolute", inset: -60, width: "calc(100% + 120px)", height: "calc(100% + 120px)", objectFit: "cover", filter: `${filter} blur(34px) brightness(0.45)` }} />}
      <Img src={src(image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit, objectPosition: pos, transform: `scale(${s})`, filter }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.62) 100%)" }} />
      {date && <DateStamp text={date} />}
      <Captions items={captions} />
      {credit && <Credit text={credit} />}
      <Finish grain={0.07} vignette={0.35} />
    </AbsoluteFill>
  );
}

/** 3. Picture or satellite plate inset in a thin dark frame with its provider mark (WiRLNEl-4bk 12:15), on a blurred copy of itself. */
export function Inset({ image, mark, title, note, credit, w = 1240, h = 760 }) {
  const f = useCurrentFrame(), a = ramp(f, 0, 16, expo);
  return (
    <AbsoluteFill style={{ background: "#06080b" }}><Fonts />
      <Img src={src(image)} style={{ position: "absolute", inset: -80, width: "calc(100% + 160px)", height: "calc(100% + 160px)", objectFit: "cover", filter: "blur(40px) brightness(0.32) saturate(0.7)" }} />
      <div style={{ position: "absolute", left: (1920 - w) / 2, top: 110, width: w, height: h, border: "2px solid rgba(255,255,255,0.55)", boxShadow: "0 30px 80px rgba(0,0,0,0.7)", overflow: "hidden", opacity: a, transform: `scale(${0.96 + 0.04 * a})` }}>
        <Img src={src(image)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${lerp(f, 0, 240, 1.0, 1.08)})` }} />
        {mark && <div style={{ position: "absolute", right: 14, top: 12, fontFamily: F.sans, fontSize: 18, color: "rgba(255,255,255,0.9)", textShadow: "0 1px 4px #000" }}>{mark}</div>}
      </div>
      {title && <div style={{ position: "absolute", left: 0, right: 0, top: 110 + h + 34, textAlign: "center", fontFamily: F.cond, fontWeight: 700, fontSize: 40, letterSpacing: "0.14em", color: "#fff", textTransform: "uppercase", opacity: ramp(f, 14, 26) }}>{title}</div>}
      {note && <div style={{ position: "absolute", left: 0, right: 0, top: 110 + h + 88, textAlign: "center", fontFamily: F.serif, fontSize: 28, color: "rgba(255,255,255,0.75)", opacity: ramp(f, 22, 34) }}>{note}</div>}
      {credit && <Credit text={credit} />}
    </AbsoluteFill>
  );
}

/** 4. Stacked figures (WiRLNEl-4bk: the numbers arrive in the first two minutes, one after another). rows: [{ value, label, source }] */
export function Figures({ image, rows, title, credit, step = 26 }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#07080a" }}><Fonts />
      {image && <Img src={src(image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(0.6) brightness(0.3) blur(3px)", transform: `scale(${lerp(f, 0, 300, 1.05, 1.12)})` }} />}
      {title && <div style={{ position: "absolute", left: 150, top: 110, fontFamily: F.cond, fontWeight: 700, fontSize: 34, letterSpacing: "0.26em", color: "rgba(255,255,255,0.7)", textTransform: "uppercase" }}>{title}</div>}
      {rows.map((r, i) => { const a = ramp(f, 8 + i * step, 22 + i * step, expo); return (
        <div key={i} style={{ position: "absolute", left: 150, top: 200 + i * (720 / rows.length), display: "flex", alignItems: "baseline", gap: 36, opacity: a, transform: `translateX(${(1 - a) * -50}px)` }}>
          <div style={{ fontFamily: F.cond, fontWeight: 700, fontSize: Math.min(170, 600 / rows.length + 40), lineHeight: 1, color: "#fff", minWidth: 430, textAlign: "right" }}>{r.value}</div>
          <div style={{ fontFamily: F.serif, fontSize: 40, lineHeight: 1.25, color: "#fff", maxWidth: 980 }}>{r.label}{r.source && <span style={{ display: "block", fontFamily: F.sans, fontSize: 20, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>{r.source}</span>}</div>
        </div>); })}
      {credit && <Credit text={credit} />}
      <Finish grain={0.06} vignette={0.5} />
    </AbsoluteFill>
  );
}

/** 5. Chart laid over a picture (U_UoAZrOTNU oil-production chart). bars: [{ label, value }]; value in `unit`. */
export function ChartOver({ image, title, sub, bars, unit = "%", max, source, credit, accent = "#E5484D" }) {
  const f = useCurrentFrame(), top = max || Math.max(...bars.map((b) => b.value));
  return (
    <AbsoluteFill style={{ background: "#07080a" }}><Fonts />
      {image && <Img src={src(image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.7) brightness(0.55)", transform: `scale(${lerp(f, 0, 300, 1.03, 1.1)})` }} />}
      <div style={{ position: "absolute", left: 210, top: 150, width: 1500, height: 760, background: "rgba(9,11,14,0.78)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.16)" }} />
      <div style={{ position: "absolute", left: 270, top: 190, fontFamily: F.cond, fontWeight: 700, fontSize: 46, letterSpacing: "0.1em", color: "#fff", textTransform: "uppercase" }}>{title}</div>
      {sub && <div style={{ position: "absolute", left: 270, top: 252, fontFamily: F.cond, fontSize: 26, letterSpacing: "0.14em", color: "rgba(255,255,255,0.65)", textTransform: "uppercase" }}>{sub}</div>}
      {[0.25, 0.5, 0.75, 1].map((g) => <div key={g} style={{ position: "absolute", left: 270, width: 1380, top: 800 - g * 440, height: 1, background: "rgba(255,255,255,0.14)" }} />)}
      {bars.map((b, i) => { const a = ramp(f, 14 + i * 9, 40 + i * 9, expo), bw = Math.min(240, 1100 / bars.length), x = 360 + i * (1300 / bars.length), h = (b.value / top) * 440 * a; return (
        <div key={i}>
          <div style={{ position: "absolute", left: x, top: 800 - h, width: bw, height: h, background: i === 0 ? accent : "rgba(238,240,243,0.9)" }} />
          <div style={{ position: "absolute", left: x - 40, width: bw + 80, top: 800 - h - 78, textAlign: "center", fontFamily: F.cond, fontWeight: 700, fontSize: 64, color: "#fff", opacity: a }}>{Math.round(b.value * a)}{unit}</div>
          <div style={{ position: "absolute", left: x - 60, width: bw + 120, top: 818, textAlign: "center", fontFamily: F.cond, fontWeight: 700, fontSize: 30, letterSpacing: "0.12em", color: "#fff", textTransform: "uppercase" }}>{b.label}</div>
        </div>); })}
      {source && <div style={{ position: "absolute", left: 270, top: 872, fontFamily: F.sans, fontSize: 19, color: "rgba(255,255,255,0.6)" }}>{source}</div>}
      {credit && <Credit text={credit} />}
    </AbsoluteFill>
  );
}

/** 6. Roster: every item of a counted set shown at once (the 15 trapped ships), grouped by a colour. items: [{ name, group, note }] */
export function Roster({ title, sub, items, groups, source, image }) {
  const f = useCurrentFrame(), cols = 5;
  return (
    <AbsoluteFill style={{ background: "#080a0d" }}><Fonts />
      {image && <Img src={src(image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.22) saturate(0.6) blur(2px)" }} />}
      <div style={{ position: "absolute", left: 110, top: 80, fontFamily: F.cond, fontWeight: 700, fontSize: 60, letterSpacing: "0.06em", color: "#fff", textTransform: "uppercase" }}>{title}</div>
      {sub && <div style={{ position: "absolute", left: 112, top: 156, fontFamily: F.serif, fontSize: 30, color: "rgba(255,255,255,0.72)" }}>{sub}</div>}
      {items.map((it, i) => { const a = ramp(f, 10 + i * 3, 22 + i * 3, expo), x = 110 + (i % cols) * 344, y = 250 + Math.floor(i / cols) * 215, c = groups[it.group] || "#999"; return (
        <div key={i} style={{ position: "absolute", left: x, top: y, width: 320, height: 190, background: "rgba(255,255,255,0.05)", borderTop: `6px solid ${c}`, opacity: a, transform: `translateY(${(1 - a) * 24}px)`, padding: "14px 16px", boxSizing: "border-box" }}>
          <svg width="150" height="40" viewBox="0 0 150 40" style={{ display: "block" }}><path d="M4 18 H112 L146 18 L134 34 H16 Z" fill={c} /><rect x="76" y="4" width="26" height="14" fill={c} opacity="0.8" /><rect x="28" y="10" width="34" height="8" fill={c} opacity="0.55" /></svg>
          <div style={{ fontFamily: F.cond, fontWeight: 700, fontSize: 30, color: "#fff", marginTop: 8, whiteSpace: "nowrap" }}>{it.name}</div>
          <div style={{ fontFamily: F.cond, fontSize: 21, letterSpacing: "0.12em", color: c, textTransform: "uppercase" }}>{it.group}</div>
          {it.note && <div style={{ fontFamily: F.serif, fontSize: 19, color: "rgba(255,255,255,0.7)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.note}</div>}
        </div>); })}
      {source && <div style={{ position: "absolute", left: 112, bottom: 30, fontFamily: F.sans, fontSize: 19, color: "rgba(255,255,255,0.6)" }}>{source}</div>}
    </AbsoluteFill>
  );
}

/** 7. Scale translation (WiRLNEl-4bk "10 New York City blocks"): an unfamiliar length drawn against familiar ones. rows: [{ label, value, note }] */
export function Scale({ title, rows, unit, source, accent = "#FFD23F" }) {
  const f = useCurrentFrame(), max = Math.max(...rows.map((r) => r.value));
  return (
    <AbsoluteFill style={{ background: "radial-gradient(90% 90% at 40% 40%, #121722 0%, #06080b 80%)" }}><Fonts />
      <div style={{ position: "absolute", left: 150, top: 120, fontFamily: F.cond, fontWeight: 700, fontSize: 56, letterSpacing: "0.06em", color: "#fff", textTransform: "uppercase", maxWidth: 1600 }}>{title}</div>
      {rows.map((r, i) => { const a = ramp(f, 14 + i * 16, 50 + i * 16, expo), y = 330 + i * 190; return (
        <div key={i}>
          <div style={{ position: "absolute", left: 150, top: y, fontFamily: F.cond, fontWeight: 700, fontSize: 32, letterSpacing: "0.14em", color: "rgba(255,255,255,0.8)", textTransform: "uppercase" }}>{r.label}</div>
          <div style={{ position: "absolute", left: 150, top: y + 54, width: (r.value / max) * 1320 * a, height: 44, background: i === 0 ? accent : "rgba(232,236,240,0.85)" }} />
          <div style={{ position: "absolute", left: 150 + (r.value / max) * 1320 * a + 22, top: y + 40, fontFamily: F.cond, fontWeight: 700, fontSize: 64, color: "#fff", whiteSpace: "nowrap" }}>{(a > 0.97 ? r.value : Math.round(r.value * a)).toLocaleString("en")} {unit}</div>
          {r.note && <div style={{ position: "absolute", left: 150, top: y + 108, fontFamily: F.serif, fontSize: 24, color: "rgba(255,255,255,0.6)" }}>{r.note}</div>}
        </div>); })}
      {source && <div style={{ position: "absolute", left: 150, bottom: 40, fontFamily: F.sans, fontSize: 19, color: "rgba(255,255,255,0.6)" }}>{source}</div>}
      <Finish grain={0.05} vignette={0.4} />
    </AbsoluteFill>
  );
}

/** Thumbnail (RealLifeLore: a map or picture, a red marked zone or arrow, a few huge words). The map is the live GeoMap. */
export function HiddenThumb({ big, small, image, map, circle, arrow }) {
  return (
    <AbsoluteFill style={{ background: "#000" }}><Fonts />
      {map ? <GeoMap {...map} credit={false} vignette={0.3} /> : <Img src={src(image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.1) saturate(1.05)" }} />}
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.35) 42%, rgba(0,0,0,0) 62%)" }} />
      {circle && <div style={{ position: "absolute", left: circle.x - circle.r, top: circle.y - circle.r, width: circle.r * 2, height: circle.r * 2, borderRadius: "50%", border: "14px solid #F2222A", boxShadow: "0 0 0 4px rgba(0,0,0,0.5), 0 0 40px rgba(242,34,42,0.6)" }} />}
      {arrow && <svg width="1920" height="1080" style={{ position: "absolute" }}><defs><marker id="ah" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5 Z" fill="#F2222A" /></marker></defs><path d={arrow} stroke="#F2222A" strokeWidth="26" fill="none" strokeLinecap="round" markerEnd="url(#ah)" /></svg>}
      <div style={{ position: "absolute", left: 80, top: 110, fontFamily: F.cond, fontWeight: 700, fontSize: 200, lineHeight: 0.98, color: "#fff", textTransform: "uppercase", whiteSpace: "pre-line", textShadow: "0 8px 40px rgba(0,0,0,0.9), 0 0 6px #000" }}>{big}</div>
      {small && <div style={{ position: "absolute", left: 86, bottom: 110, fontFamily: F.cond, fontWeight: 700, fontSize: 96, color: "#fff", background: "#F2222A", padding: "4px 28px", textTransform: "uppercase" }}>{small}</div>}
    </AbsoluteFill>
  );
}

export const HIDDEN = { map: MapScene, footage: Footage, inset: Inset, figures: Figures, chart: ChartOver, roster: Roster, scale: Scale, thumb: HiddenThumb };
