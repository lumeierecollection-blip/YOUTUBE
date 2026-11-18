// Hidden Past "campaign" kit: the history explainer look measured from Epic History TV bhQe2cjr5XQ (channel-reverse/spec/CLONE-SPEC.md, aust-sheet.jpg).
// The FORMULA, not their art: text cards on black for context and honesty notes, period art held and slowly panned with a cream caption plate for each named
// person, a flat-colour campaign map (one colour per side, serif small-caps labels, routes drawn as arrows), an order-of-forces card, a casualty card, and a red
// credits card at the end. Our own palette (config/longform-v2.json hidden-past.ep), our own maps (OpenStreetMap boundaries + Sentinel-2 / Blue Marble imagery),
// and only public-domain or credited art. Their animated battle maps come from a licensed collaborator; ours is a schematic drawn on real terrain, labelled as such.
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { MapScene } from "./hidden.jsx";
import { F, Fonts, clamp, eio, eo, expo, lerp, ramp } from "./kit.jsx";

const SERIF = '"Cormorant Garamond", "Noto Serif", Georgia, serif', COND = F.cond;
const src = (p) => (p.startsWith("data:") || p.startsWith("http") ? p : staticFile(p));
const col = (t, c) => (c && t.ep[c]) || c || t.ep.red;

/** Paper grain overlay (fixed noise, multiply) used on cards and over the map so both read as printed matter. */
const Grain = ({ o = 0.12, id = "epg" }) => <svg width="1920" height="1080" style={{ position: "absolute", inset: 0, opacity: o, mixBlendMode: "multiply", pointerEvents: "none" }}>
  <filter id={id}><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="9" /><feColorMatrix type="saturate" values="0" /></filter><rect width="1920" height="1080" filter={`url(#${id})`} /></svg>;

/** Caption plate for a named person or a place (Epic's commander plate): cream strip, dark small caps, thin rule. */
export const Plate = ({ t, name, role, x = 70, y = 900, from = 18, w }) => {
  const f = useCurrentFrame(), a = ramp(f, from, from + 14, expo);
  return <div style={{ position: "absolute", left: x, top: y, width: w, background: t.ep.paper, color: t.ep.ink, padding: "12px 26px 10px", boxShadow: "0 8px 26px rgba(0,0,0,0.45)", opacity: a, transform: `translateX(${(1 - a) * -30}px)`, borderLeft: `6px solid ${t.ep.red}` }}>
    <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 36, letterSpacing: "0.08em", textTransform: "uppercase" }}>{name}</div>
    {role && <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 26, marginTop: 2 }}>{role}</div>}
  </div>;
};
const Credit = ({ text }) => text ? <div style={{ position: "absolute", right: 26, bottom: 16, fontFamily: F.sans, fontSize: 17, color: "rgba(255,255,255,0.78)", textShadow: "0 1px 3px #000" }}>{text}</div> : null;

/** Text card on black: context lines at the start, honesty notes, chapter titles. lines: [{ text, size?, italic?, caps?, from? }] */
export function EpTitle({ t, lines = [], rule = true }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: t.ep.black, alignItems: "center", justifyContent: "center" }}>
    <Fonts />
    <div style={{ width: 1400, textAlign: "center", color: "#EFE7D6" }}>
      {lines.map((l, i) => { const from = l.from ?? 6 + i * 16, a = ramp(f, from, from + 18); return <div key={i} style={{ fontFamily: SERIF, fontSize: l.size || 44, fontStyle: l.italic ? "italic" : "normal", fontWeight: l.caps ? 700 : 500, letterSpacing: l.caps ? "0.18em" : "0.01em", textTransform: l.caps ? "uppercase" : "none", lineHeight: 1.3, marginBottom: 22, opacity: a, transform: `translateY(${(1 - a) * 10}px)` }}>{l.text}</div>; })}
      {rule && <div style={{ width: 220 * ramp(f, 20, 50), height: 2, background: t.ep.gold, margin: "10px auto 0" }} />}
    </div>
    <Grain o={0.18} id="eptg" />
  </AbsoluteFill>;
}

/** Period art, held and slowly panned (camera from -> to: { x, y } as object-position %, s scale). plates appear in order; credit always on screen. */
export function EpPaint({ t, image, from = { x: 50, y: 50, s: 1.05 }, to = { x: 50, y: 50, s: 1.14 }, dur = 300, plates = [], credit, fit = "cover", caption }) {
  const f = useCurrentFrame(), k = interpolate(f, [0, dur], [0, 1], { ...clamp, easing: eio }), m = (a, b) => a + (b - a) * k;
  return <AbsoluteFill style={{ background: "#0b0a09" }}>
    <Fonts />
    {fit === "contain" && <Img src={src(image)} style={{ position: "absolute", inset: -60, width: "calc(100% + 120px)", height: "calc(100% + 120px)", objectFit: "cover", filter: "blur(30px) brightness(0.4)" }} />}
    <Img src={src(image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit, objectPosition: `${m(from.x, to.x)}% ${m(from.y, to.y)}%`, transform: `scale(${m(from.s, to.s)})`, transformOrigin: `${m(from.x, to.x)}% ${m(from.y, to.y)}%`, filter: "sepia(0.12) contrast(1.04)" }} />
    <AbsoluteFill style={{ background: "radial-gradient(95% 90% at 50% 50%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.55) 100%)" }} />
    {caption && <div style={{ position: "absolute", left: 0, right: 0, top: 60, textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 40, color: "#F3EBD8", textShadow: "0 2px 10px #000", opacity: ramp(f, 10, 30) }}>{caption}</div>}
    {plates.map((p, i) => <Plate key={i} t={t} {...p} />)}
    <Credit text={credit} />
  </AbsoluteFill>;
}

/** Campaign map: our GeoMap (real imagery, muted to read as paper) with flat side colours, serif labels, routes; paper grain on top. Same props as MapScene. */
export function EpMap({ t, plates = [], ...map }) {
  // GeoMap draws a fill's outline as a line colour: outline: true is mapped to the theme's route colour (true itself broke the fill layers)
  const fills = (map.fills || []).map((x) => ({ ...x, color: col(t, x.color), outline: x.outline ? col(t, x.outline === true ? "route" : x.outline) : undefined, outlineWidth: x.outlineWidth || 1.6 })), lines = (map.lines || []).map((x) => ({ ...x, color: col(t, x.color) })), points = (map.points || []).map((x) => ({ ...x, color: col(t, x.color) }));
  return <AbsoluteFill>
    <MapScene {...map} fills={fills} lines={lines} points={points} theme={t.ep.map} grade={{ saturation: -0.8, contrast: -0.05, brightnessMax: 1.0, ...(map.grade || {}) }} />
    <AbsoluteFill style={{ background: t.ep.paper, mixBlendMode: "screen", opacity: 0.42, pointerEvents: "none" }} />
    <Grain o={0.16} id="epmg" />
    {plates.map((p, i) => <Plate key={i} t={t} {...p} />)}
  </AbsoluteFill>;
}

/** Order of forces (Epic's order-of-battle card): two sides, each a header in its colour and rows of unit blocks with a label and a sourced figure. */
export function EpOrder({ t, title, sides = [], note }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: t.ep.paper }}>
    <Fonts /><Grain o={0.2} id="epog" />
    <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center", fontFamily: SERIF, fontWeight: 700, fontSize: 64, letterSpacing: "0.14em", textTransform: "uppercase", color: t.ep.ink, opacity: ramp(f, 0, 14) }}>{title}</div>
    {sides.map((s, si) => <div key={si} style={{ position: "absolute", left: si ? 1000 : 120, top: 210, width: 800 }}>
      <div style={{ background: col(t, s.color), color: "#fff", fontFamily: SERIF, fontWeight: 700, fontSize: 40, letterSpacing: "0.12em", textTransform: "uppercase", padding: "10px 22px", opacity: ramp(f, 8 + si * 10, 22 + si * 10) }}>{s.name}</div>
      {s.rows.map((r, i) => { const a = ramp(f, 26 + si * 10 + i * 12, 40 + si * 10 + i * 12, expo); return <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 26, opacity: a, transform: `translateX(${(1 - a) * (si ? 30 : -30)}px)` }}>
        <div style={{ display: "flex", gap: 6 }}>{Array.from({ length: r.blocks || 1 }, (_, k) => <span key={k} style={{ width: 34, height: 24, background: col(t, s.color), border: "2px solid rgba(0,0,0,0.5)", display: "inline-block" }} />)}</div>
        <div style={{ fontFamily: SERIF, fontSize: 34, color: t.ep.ink, lineHeight: 1.15 }}><b>{r.label}</b>{r.value && <div style={{ fontStyle: "italic", fontSize: 28 }}>{r.value}</div>}</div>
      </div>; })}
    </div>)}
    {note && <div style={{ position: "absolute", left: 120, right: 120, bottom: 60, textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 28, color: t.ep.ink, opacity: ramp(f, 80, 100) }}>{note}</div>}
  </AbsoluteFill>;
}

/** Casualty card (Epic's orange card): rows of sourced estimates, with what is unknown said as plainly as what is known. */
export function EpCasualty({ t, title = "Casualty estimates", rows = [], note }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: `radial-gradient(90% 80% at 50% 45%, ${t.ep.orange} 0%, #6E2A0E 100%)` }}>
    <Fonts /><Grain o={0.25} id="epcg" />
    <div style={{ position: "absolute", left: 0, right: 0, top: 120, textAlign: "center", fontFamily: SERIF, fontWeight: 700, fontSize: 60, letterSpacing: "0.16em", textTransform: "uppercase", color: "#FBEBD3" }}>{title}</div>
    <div style={{ position: "absolute", left: 260, right: 260, top: 280 }}>
      {rows.map((r, i) => { const a = ramp(f, 14 + i * 16, 30 + i * 16); return <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 40, borderBottom: "1px solid rgba(251,235,211,0.35)", padding: "18px 0", opacity: a, fontFamily: SERIF, color: "#FBEBD3" }}>
        <span style={{ fontSize: 38 }}>{r.label}</span><span style={{ fontSize: 40, fontWeight: 700, textAlign: "right" }}>{r.value}</span></div>; })}
    </div>
    {note && <div style={{ position: "absolute", left: 200, right: 200, bottom: 80, textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 30, color: "#FBEBD3", opacity: ramp(f, 80, 100) }}>{note}</div>}
  </AbsoluteFill>;
}

/** Red credits card (every Epic video closes on one): who made it and where every fact came from. */
export function EpCredits({ t, title = "Sources", lines = [], mark = "Hidden Past" }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: t.ep.red }}>
    <Fonts /><Grain o={0.18} id="eprg" />
    <div style={{ position: "absolute", left: 140, top: 110, fontFamily: COND, fontWeight: 700, fontSize: 92, letterSpacing: "0.02em", textTransform: "uppercase", color: "#fff" }}>{mark}</div>
    <div style={{ position: "absolute", left: 144, top: 230, fontFamily: SERIF, fontWeight: 700, fontSize: 40, letterSpacing: "0.16em", textTransform: "uppercase", color: "#F4D9D4" }}>{title}</div>
    <div style={{ position: "absolute", left: 144, right: 140, top: 300, columnCount: 2, columnGap: 80 }}>
      {lines.map((l, i) => <div key={i} style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 1.3, color: "#fff", marginBottom: 14, breakInside: "avoid", opacity: ramp(f, 6 + i * 4, 18 + i * 4) }}>{l}</div>)}
    </div>
  </AbsoluteFill>;
}

/** Thumbnail in the measured Epic formula (every reference thumbnail): a torn red paper strip down one side carrying huge condensed caps, a boxed series label,
 *  a year plate and the channel plate; the other side is a cut-out from period art (background removed by platform/production/cutout.py) over its own scene, darkened. */
export function EpThumb({ t, big = [], series, year, bg, bgPos = "50% 50%", cut, credit, mark = "HIDDEN PAST" }) {
  const c = t.ep;
  const torn = "polygon(0 0, 100% 0, 97% 6%, 100% 12%, 96% 19%, 99% 27%, 95% 35%, 98% 44%, 94% 52%, 99% 61%, 95% 69%, 98% 78%, 94% 87%, 97% 94%, 95% 100%, 0 100%)";
  return <AbsoluteFill style={{ background: "#120d09" }}>
    <Fonts />
    {bg && <Img src={src(bg)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: bgPos, filter: "brightness(0.55) sepia(0.2)" }} />}
    {cut && <Img src={src(cut.src)} style={{ position: "absolute", left: cut.x, bottom: cut.bottom || 0, height: cut.h, filter: "drop-shadow(0 0 30px rgba(0,0,0,0.65)) contrast(1.06) saturate(1.05)" }} />}
    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 900, background: c.red, clipPath: torn, boxShadow: "inset -10px 0 30px rgba(0,0,0,0.25)" }}>
      <Grain o={0.22} id="epthg" />
    </div>
    <div style={{ position: "absolute", left: 70, top: 60, width: 800 }}>
      {series && <div style={{ display: "inline-block", background: "#fff", color: c.red, fontFamily: COND, fontWeight: 700, fontSize: 52, padding: "4px 18px", letterSpacing: "0.02em", textTransform: "uppercase" }}>{series}</div>}
      {big.map((b, i) => <div key={i} style={{ fontFamily: COND, fontWeight: 700, fontSize: b.size || 190, lineHeight: 0.92, color: b.dark ? "#1a0f0a" : "#fff", textTransform: "uppercase", letterSpacing: "-0.01em", marginTop: i ? 0 : 24, textShadow: b.dark ? "none" : "0 4px 0 rgba(0,0,0,0.18)" }}>{b.text}</div>)}
      {year && <div style={{ display: "inline-block", marginTop: 26, background: "#fff", color: c.red, fontFamily: COND, fontWeight: 700, fontSize: 64, padding: "2px 18px" }}>{year}</div>}
    </div>
    <div style={{ position: "absolute", left: 70, bottom: 56, background: "#fff", color: c.red, fontFamily: COND, fontWeight: 700, fontSize: 46, padding: "4px 18px", letterSpacing: "0.04em" }}>{mark}</div>
    {credit && <div style={{ position: "absolute", right: 14, bottom: 8, fontFamily: F.sans, fontSize: 15, color: "rgba(255,255,255,0.6)" }}>{credit}</div>}
  </AbsoluteFill>;
}

export const EP = { eptitle: EpTitle, eppaint: EpPaint, epmap: EpMap, eporder: EpOrder, epcasualty: EpCasualty, epcredits: EpCredits, epthumb: EpThumb };
