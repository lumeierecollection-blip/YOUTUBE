// Hidden Past "campaign" kit: the history explainer look measured from Epic History TV bhQe2cjr5XQ (channel-reverse/spec/CLONE-SPEC.md, aust-sheet.jpg).
// The FORMULA, not their art: text cards on black for context and honesty notes, period art held and slowly panned with a cream caption plate for each named
// person, a flat-colour campaign map (one colour per side, serif small-caps labels, routes drawn as arrows), an order-of-forces card, a casualty card, and a red
// credits card at the end. Our own palette (config/longform-v2.json hidden-past.ep), our own maps (OpenStreetMap boundaries + Sentinel-2 / Blue Marble imagery),
// and only public-domain or credited art. Their animated battle maps come from a licensed collaborator; ours is a schematic drawn on real terrain, labelled as such.
import React from "react";
import { AbsoluteFill, Img, continueRender, delayRender, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { geoMercator, geoPath } from "d3-geo";
import { MapScene } from "./hidden.jsx";
import { F, Fonts, clamp, eio, eo, expo, lerp, ramp } from "./kit.jsx";

const SERIF = '"Cormorant Garamond", "Noto Serif", Georgia, serif', COND = F.cond;
const src = (p) => (p.startsWith("data:") || p.startsWith("http") ? p : staticFile(p));
const col = (t, c) => (c && t.ep[c]) || c || t.ep.red;

/** Paper grain overlay (fixed noise, multiply) used on cards and over the map so both read as printed matter. */
// a static grain texture (public/lf2/hidden-past/tex-grain.png): a full-frame feTurbulence on every frame made the Hastings shards overrun (19 Nov 2026)
const Grain = ({ o = 0.12 }) => <Img src={staticFile("lf2/hidden-past/tex-grain.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: o * 0.8, mixBlendMode: "multiply", pointerEvents: "none" }} />;

/** Caption plate for a named person or a place, measured from Epic (aust-sheet / ep-a): a dark grey plate with a thin light inner rule, name in serif, role in
 *  smaller serif below ("General Mikhail Kutuzov / Russian Army Commander"). */
export const Plate = ({ t, name, role, x = 70, y = 900, from = 18, w }) => {
  const f = useCurrentFrame(), a = ramp(f, from, from + 14, expo);
  return <div style={{ position: "absolute", left: x, top: y, minWidth: w || 430, background: "linear-gradient(180deg, #4A4640 0%, #35322D 100%)", padding: "10px 26px 9px", boxShadow: "0 8px 22px rgba(0,0,0,0.5)", opacity: a, transform: `translateY(${(1 - a) * 14}px)`, outline: "1.5px solid rgba(214,205,186,0.75)", outlineOffset: -6 }}>
    <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 34, color: "#F1EADB", letterSpacing: "0.02em" }}>{name}</div>
    {role && <div style={{ fontFamily: SERIF, fontSize: 25, color: "#CFC6B3", marginTop: 1 }}>{role}</div>}
  </div>;
};
const Credit = ({ text }) => text ? <div style={{ position: "absolute", right: 26, bottom: 16, fontFamily: F.sans, fontSize: 17, color: "rgba(255,255,255,0.78)", textShadow: "0 1px 3px #000" }}>{text}</div> : null;

/** Text card on black: context lines at the start, honesty notes, chapter titles. lines: [{ text, size?, italic?, caps?, from? }] */
export function EpTitle({ t, lines = [], rule = true }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: t.ep.black, alignItems: "center", justifyContent: "center" }}>
    <Fonts />
    <div style={{ width: 1400, textAlign: "center", color: "#EFE7D6", transform: `scale(${1 + 0.0004 * f})` }}>
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

/** Loads a JSON file from public/ once per scene (the Europe base is 0.5 MB: too big to pass as props to every beat). */
function useJson(path) {
  const [data, set] = React.useState(null);
  const [h] = React.useState(() => delayRender(`json ${path}`));
  React.useEffect(() => { fetch(staticFile(path)).then((r) => r.json()).then((j) => { set(j); continueRender(h); }); }, []);
  return data;
}

/** Campaign map in Epic's measured style (channel-reverse/spec/carbon/ep-a.jpg): a FLAT printed map, not imagery. Pale blue-grey sea, light grey land with thin
 *  modern borders, each power in one flat colour, big spaced serif capitals for realms, italic capitals for water, small serif for places; routes drawn as
 *  arrows; flag tokens for armies; commander plates and cut-out figures over the map edge. Camera: views [{ f, center: [lon, lat], scale }] (Mercator).
 *  realms: [{ key: "england"|"normandy"|"norway", color, from }] from public/lf2/hidden-past/geo/hastings-realms.json (modern outlines, said on screen). */
export function EpPaperMap({ t, views, realms = [], labels = [], routes = [], points = [], plates = [], figures = [], armies = [], note, credit = "Base: Natural Earth (public domain) · realm outlines: OpenStreetMap contributors, modern boundaries" }) {
  const f = useCurrentFrame(), base = useJson("lf2/hidden-past/geo/europe-50m.json"), rl = useJson("lf2/hidden-past/geo/hastings-realms.json"), c = t.ep;
  let i = 0; while (i < views.length - 2 && f > views[i + 1].f) i++;
  const A = views[i], B = views[Math.min(i + 1, views.length - 1)], k = A === B ? 0 : interpolate(f, [A.f || 0, B.f], [0, 1], { ...clamp, easing: eio });
  const proj = geoMercator().center([A.center[0] + (B.center[0] - A.center[0]) * k, A.center[1] + (B.center[1] - A.center[1]) * k]).scale(Math.exp(Math.log(A.scale) + (Math.log(B.scale) - Math.log(A.scale)) * k)).translate([960, 540]);
  const path = geoPath(proj);
  const draw = (coords, p) => {
    const pts = coords.map((q) => proj(q)); let len = 0; const seg = [];
    for (let n = 1; n < pts.length; n++) { const d = Math.hypot(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1]); seg.push(d); len += d; }
    let left = len * p; const out = [pts[0]];
    for (let n = 1; n < pts.length && left > 0; n++) { const d = seg[n - 1]; if (left >= d) { out.push(pts[n]); left -= d; } else { const r = left / d; out.push([pts[n - 1][0] + (pts[n][0] - pts[n - 1][0]) * r, pts[n - 1][1] + (pts[n][1] - pts[n - 1][1]) * r]); left = 0; } }
    return out;
  };
  if (!base || !rl) return <AbsoluteFill style={{ background: c.sea }} />;
  const K = { country: { size: 66, weight: 800, sp: "0.08em", caps: true, op: 0.92 }, region: { size: 38, weight: 700, sp: "0.08em", caps: true, op: 0.9 }, place: { size: 28, weight: 700, sp: "0.06em", caps: true, op: 0.95 }, water: { size: 36, weight: 600, sp: "0.14em", caps: true, italic: true, op: 0.75 } };   // Epic: bold capitals everywhere
  return <AbsoluteFill style={{ background: c.sea }}>
    <Fonts />
    <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
      <defs>
        <marker id="pmah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke" /></marker>
      </defs>
      {base.features.map((ft, n) => <path key={n} d={path(ft)} fill={c.land} stroke={c.border} strokeWidth={1.4} />)}
      {realms.map((r, n) => <path key={`r${n}`} d={path(rl[r.key])} fill={col(t, r.color)} stroke="rgba(40,10,5,0.55)" strokeWidth={2} opacity={ramp(f, r.from || 0, (r.from || 0) + 18) * Math.max(0.6, (r.alpha ?? 1)) * 0.88} />)}   {/* deep, textured realm colour (Epic); close-ups no longer fade to a pale tint */}
      {routes.map((r, n) => {
        const p = ramp(f, r.from || 0, (r.from || 0) + (r.dur || 60), eio), pts = draw(r.coords, p).map((q) => q.join(",")).join(" ");
        return p > 0 && <g key={`ro${n}`}>
          <polyline points={pts} fill="none" stroke={col(t, r.color)} strokeWidth={(r.width || 8) + 8} opacity={0.25} strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={pts} fill="none" stroke={col(t, r.color)} strokeWidth={r.width || 8} strokeLinecap="round" strokeLinejoin="round" markerEnd={p > 0.98 ? "url(#pmah)" : undefined} />
        </g>;
      })}
      {points.map((q, n) => { const [x, y] = proj(q.at), a = ramp(f, q.from || 0, (q.from || 0) + 10); return <g key={`p${n}`} opacity={a}><rect x={x - 9} y={y - 9} width={18} height={18} fill="#1d1a16" /><rect x={x - 5} y={y - 5} width={10} height={10} fill="#F2EADB" /></g>; })}
      {armies.map((q, n) => {
        const [x, y] = proj(q.at), a = ramp(f, q.from || 0, (q.from || 0) + 12);
        return <g key={`a${n}`} opacity={a} transform={`translate(${x} ${y})`}>
          <line x1={0} y1={0} x2={0} y2={-58} stroke="#2a2520" strokeWidth={3} />
          <rect x={0} y={-58} width={46} height={30} fill={col(t, q.color)} stroke="#F2EADB" strokeWidth={2} />
          <text x={23} y={-37} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={18} fill="#fff">{q.short}</text>
        </g>;
      })}
    </svg>
    {labels.map((l, n) => { const [x, y] = proj(l.at), s = K[l.kind || "country"], a = ramp(f, l.from || 0, (l.from || 0) + 14); return <div key={`l${n}`} style={{ position: "absolute", left: x - 400, width: 800, top: y - s.size * 0.6, textAlign: "center", fontFamily: SERIF, fontWeight: s.weight, fontStyle: s.italic ? "italic" : "normal", fontSize: s.size, letterSpacing: s.sp, textTransform: s.caps ? "uppercase" : "none", color: c.mapInk, opacity: a * s.op, transform: `rotate(${l.rotate || 0}deg)` }}>{l.text}</div>; })}
    {figures.map((g, n) => { const a = ramp(f, g.from || 0, (g.from || 0) + 16, expo), m = g.vignette ? "radial-gradient(ellipse 50% 50% at 50% 50%, #000 62%, transparent 100%)" : undefined;
      // vignette: a rectangular crop of period art faded at the edges (background removal failed on embroidery: heads and riders vanished, 18 Nov 2026)
      return <Img key={`g${n}`} src={staticFile(g.src)} style={{ position: "absolute", [g.side || "right"]: g.edge ?? 30, bottom: g.bottom ?? 0, height: g.h || 760, opacity: a, transform: `translateX(${(1 - a) * (g.side === "left" ? -40 : 40)}px)`, filter: g.vignette ? "sepia(0.1)" : "drop-shadow(0 0 26px rgba(0,0,0,0.55))", WebkitMaskImage: m, maskImage: m }} />; })}
    {/* parchment: ONE full-frame texture layer (a per-shape pattern with blend modes made map beats miss their shard time limit, run 44585504340) */}
    <Img src={staticFile("lf2/hidden-past/tex-terrain.jpg")} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, objectFit: "cover", opacity: 0.22, pointerEvents: "none" }} />
    <AbsoluteFill style={{ background: "radial-gradient(90% 85% at 50% 45%, rgba(0,0,0,0) 65%, rgba(30,28,25,0.35) 100%)", pointerEvents: "none" }} />   {/* Epic political maps: neutral paper, soft dark edge */}   {/* Epic: warm orange-brown vignette */}
    <Grain o={0.2} />
    {plates.map((p, n) => <Plate key={`pl${n}`} t={t} {...p} />)}
    {note && <div style={{ position: "absolute", left: 40, top: 30, fontFamily: SERIF, fontStyle: "italic", fontSize: 22, color: c.mapInk, opacity: 0.75 * ramp(f, note.from || 20, (note.from || 20) + 14) }}>{note.text}</div>}
    <Credit text={credit} />
  </AbsoluteFill>;
}

/** Battle map in Epic's measured style (ep-a.jpg rows 5-6): painted khaki ground with soft relief and fog at the edges, pale water, unit blocks in formation
 *  rows (one colour per side, white edge), big curved glowing arrows for each attack, army names with their strength in white serif. Drawn in screen space:
 *  a SCHEMATIC of what the sources describe (two hills, a ridge, marsh, a stream), not a surveyed map, and it says so on screen. */
export function EpBattle({ t, hills = [], water = [], woods = [], units = [], arrows = [], armies = [], plates = [], schematic = "Schematic positions (the sources disagree) · relief: AWS Terrain Tiles, Battle, East Sussex", push = 0.1 }) {
  const f = useCurrentFrame(), { durationInFrames: D } = useVideoConfig(), c = t.ep, k = interpolate(f, [0, Math.max(60, D)], [0, 1], { ...clamp, easing: eio });
  const curve = (pts) => pts.length === 3 ? `M${pts[0][0]} ${pts[0][1]} Q${pts[1][0]} ${pts[1][1]} ${pts[2][0]} ${pts[2][1]}` : "M" + pts.map((q) => q.join(" ")).join(" L");
  return <AbsoluteFill style={{ background: c.khaki2 }}>
    {/* real relief of the battlefield as an <Img>: Remotion waits for it (an SVG <image> was captured before it loaded, stills round 4) */}
    <Img src={staticFile("lf2/hidden-past/battle-terrain.jpg")} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, objectFit: "cover" }} />
    <Fonts />
    <AbsoluteFill style={{ transform: `scale(${1 + push * k})`, transformOrigin: "50% 50%" }}>
      <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="hd"><stop offset="0%" stopColor="#3D3518" stopOpacity="0.4" /><stop offset="100%" stopColor="#3D3518" stopOpacity="0" /></radialGradient>
          <radialGradient id="hl"><stop offset="0%" stopColor="#F0E6B4" stopOpacity="0.35" /><stop offset="100%" stopColor="#F0E6B4" stopOpacity="0" /></radialGradient>
          <radialGradient id="wd"><stop offset="0%" stopColor="#4A5320" stopOpacity="0.6" /><stop offset="100%" stopColor="#4A5320" stopOpacity="0" /></radialGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="9" /></filter>
          <marker id="bah" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke" /></marker>
        </defs>
   {/* Epic battle maps show relief: real hillshade of the battlefield (AWS Terrain Tiles / Terrarium), not a flat field */}
        {hills.map((h, n) => <g key={`h${n}`}>
          <ellipse cx={h.x} cy={h.y} rx={h.rx} ry={h.ry} fill="url(#hd)" transform={`rotate(${h.rot || 0} ${h.x} ${h.y})`} />
          <ellipse cx={h.x - h.rx * 0.18} cy={h.y - h.ry * 0.25} rx={h.rx * 0.7} ry={h.ry * 0.55} fill="url(#hl)" transform={`rotate(${h.rot || 0} ${h.x} ${h.y})`} />
        </g>)}
        {woods.map((w, n) => <ellipse key={`w${n}`} cx={w.x} cy={w.y} rx={w.rx} ry={w.ry} fill="url(#wd)" />)}
        {water.map((w, n) => <path key={`wa${n}`} d={curve(w.pts)} fill="none" stroke={c.water} strokeWidth={w.width || 10} strokeLinecap="round" opacity={0.9} />)}
        {units.map((u, n) => {
          const a = ramp(f, u.from || 0, (u.from || 0) + 12), mv = u.to ? ramp(f, u.to.from, u.to.from + (u.to.dur || 60), eio) : 0;
          const x = u.x + (u.to ? (u.to.x - u.x) * mv : 0), y = u.y + (u.to ? (u.to.y - u.y) * mv : 0), cols = u.cols || 6, rows = u.rows || 2, bw = u.bw || 22, bh = u.bh || 14;
          return <g key={`u${n}`} opacity={a} transform={`translate(${x} ${y}) rotate(${u.rot || 0})`}>
            {Array.from({ length: cols * rows }, (_, q) => <rect key={q} x={(q % cols) * (bw + 4) - (cols * (bw + 4)) / 2} y={Math.floor(q / cols) * (bh + 4) - (rows * (bh + 4)) / 2} width={bw} height={bh} fill={col(t, u.color)} stroke="#F4EEDD" strokeWidth={1.6} />)}
          </g>;
        })}
        {arrows.map((ar, n) => {
          const p = ramp(f, ar.from || 0, (ar.from || 0) + (ar.dur || 40), eio);
          return p > 0 && <g key={`ar${n}`}>
            <path d={curve(ar.pts)} fill="none" stroke={col(t, ar.color || "arrow")} strokeWidth={(ar.width || 26) + 16} opacity={0.45} filter="url(#glow)" pathLength={1} strokeDasharray={`${p} 1`} />
            <path d={curve(ar.pts)} fill="none" stroke={col(t, ar.color || "arrow")} strokeWidth={ar.width || 26} opacity={0.9} pathLength={1} strokeDasharray={`${p} 1`} markerEnd={p > 0.97 ? "url(#bah)" : undefined} />
          </g>;
        })}
      </svg>
      {hills.filter((h) => h.label).map((h, n) => <div key={`hl${n}`} style={{ position: "absolute", left: h.x - 300, width: 600, top: h.y + (h.ly || 0), textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 30, color: "#2B2412", opacity: 0.8 }}>{h.label}</div>)}
      {armies.map((a, n) => <div key={`am${n}`} style={{ position: "absolute", left: a.x, top: a.y, fontFamily: SERIF, color: "#FFFBEF", textShadow: "0 2px 12px rgba(0,0,0,0.6)", opacity: ramp(f, a.from || 0, (a.from || 0) + 14) }}><div style={{ fontSize: a.size || 50, fontWeight: 600 }}>{a.title}</div>{a.sub && <div style={{ fontSize: (a.size || 50) * 0.6, marginLeft: a.size ? 0 : 40 }}>{a.sub}</div>}</div>)}
    </AbsoluteFill>
    <AbsoluteFill style={{ background: "radial-gradient(80% 75% at 50% 50%, rgba(240,232,205,0) 55%, rgba(236,228,200,0.7) 100%)", pointerEvents: "none" }} />
    {plates.map((p, n) => <Plate key={`bp${n}`} t={t} {...p} />)}
    {schematic && <div style={{ position: "absolute", right: 30, top: 24, fontFamily: SERIF, fontStyle: "italic", fontSize: 22, color: "#2B2412", opacity: 0.8 }}>{schematic}</div>}
  </AbsoluteFill>;
}

export const EP = { eppmap: EpPaperMap, epbattle: EpBattle, eptitle: EpTitle, eppaint: EpPaint, epmap: EpMap, eporder: EpOrder, epcasualty: EpCasualty, epcredits: EpCredits, epthumb: EpThumb };
