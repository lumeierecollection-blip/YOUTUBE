// Hidden Past long form: a REAL geographic camera. MapLibre GL renders satellite imagery draped over real elevation; the camera
// (centre, zoom, pitch, bearing) is keyframed per frame, so a zoom is a move through real terrain, not a scaled picture.
// Technique: .agents/skills/remotion-maps (maplibre): interactive:false, fadeDuration:0, preserveDrawingBuffer, delayRender per frame, idle wait.
// References: RealLifeLore U_UoAZrOTNU, FA-oEtccS_k, R60ZGwd3n9E, 3IVbe0xrRt8 (one relief map re-framed; ownership fills; routes; small caps labels).
// Imagery: Sentinel-2 cloudless 2016 by EOX (CC BY 4.0) or NASA Blue Marble (public domain). Elevation: Mapzen terrain tiles on AWS (open data).
// Attribution is always drawn (props.credit). Labels are our own DOM type, placed by projecting lon/lat each frame.
import React, { useEffect, useRef, useState } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";
import { FONT_FACES } from "../../fonts-loader.js";

const BASES = {
  s2: { tiles: ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg"], maxzoom: 13, credit: "Sentinel-2 cloudless 2016 by EOX (CC BY 4.0), contains modified Copernicus Sentinel data" },
  bluemarble: { tiles: ["https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg"], maxzoom: 8, credit: "NASA Blue Marble (public domain)" },
};
const DEM = { type: "raster-dem", tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"], encoding: "terrarium", tileSize: 256, maxzoom: 12 };
/** Waits until every source (imagery, terrain, GeoJSON) has its tiles for this view; idle alone fired early with terrain on, leaving fills missing tile by tile. */
const settled = (m, cb, t0 = Date.now()) => m.once("idle", () => { if (m.areTilesLoaded() && m.isStyleLoaded()) { m.triggerRepaint(); m.once("render", () => setTimeout(cb, 60)); } else if (Date.now() - t0 > 60000) cb(); else { m.triggerRepaint(); settled(m, cb, t0); } });
const clampOpt = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const ease = Easing.bezier(0.45, 0.05, 0.25, 1);

/** Camera at a frame, from keyframes [{ f, center:[lng,lat], zoom, pitch, bearing }]. Zoom is eased in zoom space, so the move is exponential in scale. */
export function cameraAt(views, frame) {
  if (views.length === 1) return views[0];
  let i = 0; while (i < views.length - 2 && frame > views[i + 1].f) i++;
  const a = views[i], b = views[i + 1], t = interpolate(frame, [a.f, b.f], [0, 1], { ...clampOpt, easing: ease }), mix = (x, y) => x + (y - x) * t;
  return { center: [mix(a.center[0], b.center[0]), mix(a.center[1], b.center[1])], zoom: mix(a.zoom, b.zoom), pitch: mix(a.pitch || 0, b.pitch || 0), bearing: mix(a.bearing || 0, b.bearing || 0) };
}

const fade = (frame, from = 0, dur = 12, to, out = 10) => {
  const a = interpolate(frame, [from, from + dur], [0, 1], clampOpt);
  return to == null ? a : a * interpolate(frame, [to - out, to], [1, 0], clampOpt);
};

function lineFeature(coords, progress) {
  const line = turf.lineString(coords), len = turf.length(line);
  return turf.lineSliceAlong(line, 0, Math.max(0.001, len * Math.min(1, Math.max(0, progress))));
}

/**
 * props: views; base ("s2"|"bluemarble"); terrain (exaggeration, 0 = flat); grade { saturation, contrast, brightnessMax };
 * fills [{ id, data, color, opacity, outline, from, dur, to }]; lines [{ id, coords, color, width, dash, from, dur, arrow }];
 * points [{ id, at:[lng,lat], color, r, pulse, from }]; labels [{ at, text, kind:"country"|"place"|"zone"|"water", from, dx, dy, leader }];
 * credit (string, drawn bottom-right); vignette (0..1).
 */
// KNOWN LIMIT (tested 13 Nov 2026): with 3D terrain on, GeoJSON fills render only partly under software GL (Chrome swangle, which our
// renders use). Scenes that fill an area therefore pass terrain: 0 (flat, tilted, hillshade kept); line, point and label scenes keep 3D terrain.
export function GeoMap({ views, base = "s2", terrain = 1.4, hillshade = true, grade = {}, fills = [], lines = [], points = [], labels = [], credit, vignette = 0.55, theme, children }) {
  const ref = useRef(null), frame = useCurrentFrame(), { width, height } = useVideoConfig();
  const { delayRender, continueRender } = useDelayRender();
  const [map, setMap] = useState(null), [proj, setProj] = useState({ frame: -1, pts: [] });
  const [boot] = useState(() => delayRender("map load", { timeoutInMilliseconds: 170000 }));
  const t = theme || { label: "#FFFFFF", labelBg: "rgba(12,14,18,0.86)", zone: "#E5484D", font: '"Roboto Condensed", sans-serif' };

  useEffect(() => {
    if (!ref.current) return;
    const b = BASES[base], cam = cameraAt(views, 0);
    const m = new maplibregl.Map({
      container: ref.current, interactive: false, attributionControl: false, fadeDuration: 0, canvasContextAttributes: { preserveDrawingBuffer: true }, maxPitch: 80,
      style: { version: 8, sources: { base: { type: "raster", tiles: b.tiles, tileSize: 256, maxzoom: b.maxzoom }, dem: DEM, dem2: DEM }, layers: [
        { id: "bg", type: "background", paint: { "background-color": "#06090f" } },
        { id: "base", type: "raster", source: "base", paint: { "raster-saturation": grade.saturation ?? -0.25, "raster-contrast": grade.contrast ?? 0.12, "raster-brightness-max": grade.brightnessMax ?? 0.92, "raster-fade-duration": 0 } },
        ...(hillshade !== false ? [{ id: "hill", type: "hillshade", source: "dem2", paint: { "hillshade-exaggeration": 0.35, "hillshade-shadow-color": "#05070c", "hillshade-highlight-color": "#fff6e0", "hillshade-accent-color": "#0b0f18" } }] : []),
      ], ...(terrain ? { terrain: { source: "dem", exaggeration: terrain } } : {}), sky: { "sky-color": "#0a1220", "horizon-color": "#1b2a44", "fog-color": "#0c1626", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.7, "fog-ground-blend": 0.35, "atmosphere-blend": 0.6 } },
      center: cam.center, zoom: cam.zoom, pitch: cam.pitch || 0, bearing: cam.bearing || 0,
    });
    m.on("load", () => {
      for (const f of fills) {
        m.addSource(`f-${f.id}`, { type: "geojson", data: f.data });
        m.addLayer({ id: `f-${f.id}`, type: "fill", source: `f-${f.id}`, paint: { "fill-color": f.color, "fill-opacity": 0 } });
        if (f.outline) m.addLayer({ id: `fo-${f.id}`, type: "line", source: `f-${f.id}`, paint: { "line-color": f.outline, "line-width": f.outlineWidth || 2.5, "line-opacity": 0 } });
      }
      for (const l of lines) {
        m.addSource(`l-${l.id}`, { type: "geojson", data: lineFeature(l.coords, 0) });
        if (l.casing !== false) m.addLayer({ id: `lc-${l.id}`, type: "line", source: `l-${l.id}`, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "rgba(0,0,0,0.55)", "line-width": (l.width || 6) + 5, "line-blur": 3 } });
        m.addLayer({ id: `l-${l.id}`, type: "line", source: `l-${l.id}`, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": l.color, "line-width": l.width || 6, ...(l.dash ? { "line-dasharray": l.dash } : {}) } });
      }
      settled(m, () => { setMap(m); continueRender(boot); });
    });
    m.on("error", (e) => console.error("[geomap]", e?.error?.message || e));
  }, []);

  useEffect(() => {
    if (!map) return;
    const h = delayRender(`map frame ${frame}`, { timeoutInMilliseconds: 170000 }), cam = cameraAt(views, frame);
    for (const f of fills) {
      const a = fade(frame, f.from, f.dur, f.to) * (f.opacity ?? 0.55);
      map.setPaintProperty(`f-${f.id}`, "fill-opacity", a);
      if (f.outline) map.setPaintProperty(`fo-${f.id}`, "line-opacity", fade(frame, f.from, f.dur, f.to));
    }
    for (const l of lines) map.getSource(`l-${l.id}`).setData(lineFeature(l.coords, interpolate(frame, [l.from || 0, (l.from || 0) + (l.dur || 30)], [0, 1], { ...clampOpt, easing: ease })));
    map.jumpTo({ center: cam.center, zoom: cam.zoom, pitch: cam.pitch || 0, bearing: cam.bearing || 0 });
    settled(map, () => {
      const P = (at) => { const p = map.project(at); return [p.x, p.y]; };
      setProj({ frame, pts: labels.map((l) => P(l.at)), dots: points.map((p) => P(p.at)), heads: lines.filter((l) => l.arrow).map((l) => { const c = lineFeature(l.coords, interpolate(frame, [l.from || 0, (l.from || 0) + (l.dur || 30)], [0, 1], { ...clampOpt, easing: ease })).geometry.coordinates; const a = P(c[Math.max(0, c.length - 2)]), b = P(c[c.length - 1]); return { x: b[0], y: b[1], ang: Math.atan2(b[1] - a[1], b[0] - a[0]), color: l.color, on: frame > (l.from || 0) + 2, w: l.width || 6 }; }) });
      continueRender(h);
    });
    map.triggerRepaint();
  }, [map, frame]);

  const kinds = {
    country: { fontSize: 30, letterSpacing: "0.16em", padding: "7px 16px 6px", background: t.labelBg, color: t.label, fontWeight: 700 },
    place: { fontSize: 24, letterSpacing: "0.12em", padding: "5px 12px 4px", background: t.labelBg, color: t.label, fontWeight: 700 },
    zone: { fontSize: 24, letterSpacing: "0.12em", padding: "5px 12px 4px", background: t.zone, color: "#fff", fontWeight: 700 },
    water: { fontSize: 30, letterSpacing: "0.24em", padding: 0, background: "transparent", color: "#e4f1ff", fontWeight: 700, fontStyle: "italic" },
  };
  return (
    <AbsoluteFill style={{ background: "#06090f" }}>
      <style>{FONT_FACES}</style>
      <div ref={ref} style={{ position: "absolute", width, height }} />
      <AbsoluteFill style={{ background: `radial-gradient(85% 80% at 50% 50%, rgba(0,0,0,0) 52%, rgba(0,0,0,${vignette}) 100%)`, pointerEvents: "none" }} />
      {proj.frame === frame && (proj.heads || []).map((hd, i) => hd.on && (
        <div key={`h${i}`} style={{ position: "absolute", left: hd.x, top: hd.y, width: 0, height: 0, transform: `rotate(${hd.ang}rad)` }}>
          <div style={{ position: "absolute", left: -hd.w * 0.6, top: -hd.w * 1.7, width: 0, height: 0, borderTop: `${hd.w * 1.7}px solid transparent`, borderBottom: `${hd.w * 1.7}px solid transparent`, borderLeft: `${hd.w * 2.8}px solid ${hd.color}`, filter: "drop-shadow(0 0 4px rgba(0,0,0,0.6))" }} />
        </div>))}
      {proj.frame === frame && points.map((p, i) => { const a = fade(frame, p.from, 8), [x, y] = proj.dots[i], r = p.r || 9, pulse = p.pulse ? ((frame - (p.from || 0)) % 45) / 45 : 0; return a > 0 && (
        <div key={`p${i}`} style={{ position: "absolute", left: x, top: y, opacity: a }}>
          {p.pulse && <div style={{ position: "absolute", left: -r * (1 + pulse * 3), top: -r * (1 + pulse * 3), width: r * 2 * (1 + pulse * 3), height: r * 2 * (1 + pulse * 3), borderRadius: "50%", border: `3px solid ${p.color || t.zone}`, opacity: 1 - pulse }} />}
          <div style={{ position: "absolute", left: -r, top: -r, width: r * 2, height: r * 2, borderRadius: "50%", background: p.color || t.zone, border: "3px solid #fff", boxShadow: "0 0 10px rgba(0,0,0,0.7)" }} />
        </div>); })}
      {proj.frame === frame && labels.map((l, i) => { const a = fade(frame, l.from, 10, l.to), [x, y] = proj.pts[i], k = kinds[l.kind || "country"]; return a > 0 && (
        <div key={`t${i}`} style={{ position: "absolute", left: x + (l.dx || 0), top: y + (l.dy || 0), transform: `translate(-50%,-50%) translateY(${(1 - a) * 10}px)`, opacity: a, fontFamily: t.font, textTransform: "uppercase", whiteSpace: "nowrap", borderRadius: 4, lineHeight: 1.1, textShadow: l.kind === "water" ? "0 0 3px #000, 0 2px 10px rgba(0,0,0,0.95)" : "none", ...k }}>{l.text}</div>); })}
      {children}
      {credit !== false && <div style={{ position: "absolute", right: 22, bottom: 16, fontFamily: '"Inter", sans-serif', fontSize: 15, color: "rgba(255,255,255,0.62)", textShadow: "0 1px 3px #000" }}>{credit || `${BASES[base].credit} · elevation: Mapzen terrain tiles`}</div>}
    </AbsoluteFill>
  );
}
