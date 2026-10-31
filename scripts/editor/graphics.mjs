/**
 * Motion graphics for the automatic editor, drawn as REAL animated layers in a PANEL OF THEIR OWN: a chart never sits on top of the photo
 * it belongs to. Two layouts: "split" (the photo fills the top of the frame, the panel sits under it, above the captions) and "hero" (a
 * figure-only or map scene: the panel is the picture). The panel holds, per kind:
 *   bar    a bar that grows to exactly its share on a 0-100% axis with gridlines, tick labels and a value marker
 *   bars2  two shares on one shared axis (a comparison)
 *   ring   a ring that draws on to its share, the value counting in its centre
 *   count  a number that counts up, with a rule that wipes in
 *   year   a drawn timeline whose year counts up to the stated one
 *   map    a drawn map of the places the sentence names, outlines drawing on, the named places filled, labels revealed
 * The words in a panel are the sentence's own (a short caption taken from the clause around the figure) and the source's host.
 * Every layer keeps moving until its scene ends (a slow rise), so a held graphic is never a held still.
 */
import { fitSize } from "./styles.mjs";
import { buildMap } from "./maps.mjs";

const SANS = "Inter";
const SERIF = "Georgia";
const DRIFT = 22;

/** Relative luminance (0..1) of a #rrggbb colour. */
export function luminance(hex) {
  const m = String(hex).replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return 0.5;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => { const c = parseInt(h, 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Colour helpers for the light editorial palette (channels.json colours.paper / ink). */
const toRgb = (h) => { const m = String(h).replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); return m ? [1, 2, 3].map((i) => parseInt(m[i], 16)) : [128, 128, 128]; };
export const mixHex = (a, b, t) => "#" + toRgb(a).map((v, i) => Math.round(v + (toRgb(b)[i] - v) * t).toString(16).padStart(2, "0")).join("").toUpperCase();
export const rgba = (hex, a) => { const [r, g, b] = toRgb(hex); return `rgba(${r},${g},${b},${a})`; };
const contrast = (a, b) => { const la = luminance(a) + 0.05, lb = luminance(b) + 0.05; return Math.max(la, lb) / Math.min(la, lb); };
/** `color` darkened toward `toward` until it reads on `bg` (contrast >= 3.2: it is used for large type, fills and lines). */
export function readableOn(bg, color, toward) {
  let c = color;
  for (let i = 0; i < 12 && contrast(bg, c) < 3.2; i++) c = mixHex(c, toward, 0.15);
  return c;
}
/** Text colour that reads on a given fill: dark ink on light fills, white on dark ones. */
export const onFill = (fill) => (luminance(fill) > 0.28 ? "#101114" : "#FFFFFF");

/** "45%" / "$2.5 million" / "3,471" / "453" -> what to count to, and how to write it. */
export function parseFigure(fig) {
  const raw = String(fig.raw);
  if (fig.kind === "percent") {
    const decimals = (raw.match(/\.(\d+)/) || [, ""])[1].length;
    return { from: 0, to: Number(fig.value), decimals, prefix: "", suffix: "%", group: false, percent: Number(fig.value) };
  }
  const m = raw.match(/^([$£€]?)\s?([\d,]+(?:\.\d+)?)(.*)$/);
  if (!m) return { from: 0, to: 0, decimals: 0, prefix: "", suffix: "", group: false, static: raw };
  const digits = m[2].replace(/,/g, "");
  const decimals = (digits.match(/\.(\d+)/) || [, ""])[1].length;
  return { from: 0, to: Number(digits), decimals, prefix: m[1], suffix: m[3] || "", group: m[2].includes(",") || Number(digits) >= 10000 };
}

/** A short caption in the sentence's OWN words: the clause after the figure (or the one before it), up to `max` words. */
export function figureLabel(sentence, fig, max = 9) {
  const s = String(sentence || "").replace(/\s+/g, " ").trim();
  const token = String(fig?.matched || fig?.raw || "");
  const i = token ? s.indexOf(token) : -1;
  const clean = (t) => t.replace(/^[\s,;:()"'-]+|[\s,;:()"'-]+$/g, "");
  const words = (t) => clean(t).split(" ").filter(Boolean);
  if (i < 0) return words(s).slice(0, max).join(" ");
  const tail = s.slice(i + token.length).replace(/^\s*(percent|%)/i, "");
  const after = words(tail.split(/[.;:!?]|, (?:and|but|while|which)\b/i)[0]);
  if (after.length >= 3) return after.slice(0, max).join(" ");
  const before = words(s.slice(0, i).split(/[.;:!?]/).pop());
  return (before.length >= 2 ? before.slice(-max) : [...before, ...after]).join(" ");
}

/** Which graphic fits the figures. */
export function chooseKind(figs, rng, look) {
  if (figs.length === 1 && figs[0].kind === "year") return "year";
  const pcts = figs.filter((f) => f.kind === "percent" && f.value >= 0 && f.value <= 100);
  if (pcts.length >= 2) return "bars2";
  if (pcts.length === 1) return look === "vox" || look === "anti-slop" ? (rng() < 0.45 ? "ring" : "bar") : "bar";
  return "count";
}

const kf = (...a) => a.map(([f, v, e]) => ({ f, v, ...(e ? { e } : {}) }));

function entrance(len, { slide = 36, delay = 0 } = {}) {
  const e = Math.min(14, Math.max(4, Math.floor(len / 5)));
  const x = Math.max(e + delay + 1, len - 8);
  return {
    opacity: kf([0, 0], [delay, 0, "outCubic"], [delay + 8, 1], [x, 1], [len, 0, "inOutCubic"]),
    ty: slide ? kf([0, slide], [delay, slide, "outCubic"], [delay + e, 0]) : undefined,
  };
}

const THEMES = {
  "anti-slop": { bg: "#0B0C10", edge: null, text: "#FFFFFF", muted: "#AEB4C0", font: SANS, weight: 800, radius: 0, barH: 30, grid: "rgba(255,255,255,0.16)", track: "rgba(255,255,255,0.14)" },
  hallmark: { bg: "#EFE8D8", edge: "#15130F", text: "#15130F", muted: "#4A463C", font: SERIF, weight: 400, radius: 0, barH: 20, grid: "rgba(21,19,15,0.28)", track: "rgba(21,19,15,0.12)" },
  vox: { bg: "#0E0E10", edge: "rgba(255,255,255,0.4)", text: "#FFFFFF", muted: "#C9C9C9", font: SANS, weight: 900, radius: 18, barH: 28, grid: "rgba(255,255,255,0.18)", track: "rgba(255,255,255,0.14)" },
  "scene-director": { bg: "#0B0C10", edge: null, text: "#FFFFFF", muted: "#AEB4C0", font: SANS, weight: 900, radius: 0, barH: 34, grid: "rgba(255,255,255,0.16)", track: "rgba(255,255,255,0.14)" },
  "mograph-critic": { bg: "rgba(5,5,8,0.92)", edge: null, text: "#FFFFFF", muted: "#C7CAD1", font: SANS, weight: 800, radius: 0, barH: 24, grid: "rgba(255,255,255,0.16)", track: "rgba(255,255,255,0.14)" },
};

/** Where the panel sits. split: under a 990 px photo, above the captions (y 1540+). hero: the panel is the picture. */
export const PANEL = { split: { x: 60, y: 1015, w: 960, h: 480 }, hero: { x: 60, y: 520, w: 960, h: 820 }, full: { x: 0, y: 0, w: 1080, h: 1920 }, bare: { x: 0, y: 0, w: 1080, h: 1920 } };
/** A map beat is the whole frame: the map is drawn at this size (mapFor projects to it). */
export const FULL_MAP = { w: 960, h: 1200 };
export const PHOTO_RECT = { x: 0, y: 0, w: 1080, h: 990 };
export const MAP_RECT = { w: PANEL.hero.w - 48, h: PANEL.hero.h - 132 - 84 };

/** Build the layers for one scene's graphic. inF/outF = the frames the graphic is on screen. */
export function graphicLayers({ id, kind, figs, source, label = "", places = null, fn = "evidence", look, palette, inF, outF, z = 150, mode = "split", rng = Math.random }) {
  const len = Math.max(8, outF - inF);
  const layers = [];
  // hero: a boxed panel that is the picture. full: a map across the whole frame, no box. bare: a number on the open frame, no box.
  const hero = mode === "hero" || mode === "full" || mode === "bare";
  const bare = mode === "bare";
  // Light editorial theme: paper panel, ink type, hairline ink rules. Each look keeps its own face, weight, corner radius and bar height.
  const paper = palette.paper || "#F4F1EA", ink = palette.ink || "#101114";
  const theme = { ...(THEMES[look] || THEMES["anti-slop"]), bg: mixHex(paper, "#FFFFFF", 0.65), text: ink, muted: mixHex(ink, paper, 0.4), edge: rgba(ink, 0.28), grid: rgba(ink, 0.2), track: rgba(ink, 0.1) };
  const accent = palette.accent;
  let P = { ...(PANEL[hero ? mode : "split"]) };
  if (look === "mograph-critic") P = { ...P, x: 0, w: 1080 };
  const payoffFlat = look === "scene-director" && fn === "payoff" && hero;
  if (payoffFlat) { theme.bg = accent; theme.text = onFill(accent); theme.muted = onFill(accent); theme.grid = onFill(accent) === "#FFFFFF" ? "rgba(255,255,255,0.3)" : "rgba(16,17,20,0.3)"; theme.track = theme.grid; theme.edge = null; }
  const barColor = payoffFlat ? theme.text : accent;
  const pad = look === "mograph-critic" ? 60 : 36;
  const X = P.x + pad, W = P.w - pad * 2;

  const mk = (suffix, type, rect, extra = {}) => {
    const keyframes = { ...(extra.keyframes || {}) };
    for (const k of Object.keys(keyframes)) if (keyframes[k] === undefined) delete keyframes[k];
    const delay = extra.delay || 0;
    if (!extra.noDrift) {
      const L = Math.max(2, outF - (inF + delay));
      const ty = keyframes.ty && keyframes.ty.length ? keyframes.ty : [{ f: 0, v: 0 }];
      keyframes.ty = ty.at(-1).f < L ? [...ty, { f: L, v: -DRIFT, e: "linear" }] : ty;
    }
    const { keyframes: _k, noDrift: _n, delay: _d, ...rest } = extra;
    const layer = { id: `${id}-${suffix}`, type, rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) }, in: inF + delay, out: outF, z: z + layers.length, props: { opacity: 1 }, ...rest, keyframes };
    layers.push(layer);
    return layer;
  };
  const text = (suffix, rect, t, { size = 28, weight = 600, color = theme.muted, align = "left", font = SANS, upper = false, tracking = 0, shadow = false, delay = 0, valign = "center", lineHeight = 1.15 } = {}) =>
    mk(suffix, "text", rect, { text: t, style: { size, weight, color, align, valign, font, upper, tracking, shadow, lineHeight }, delay, keyframes: entrance(len, { slide: 18, delay }) });
  const countText = (suffix, rect, sp, size, { color = theme.text, align = "left", weight = theme.weight, font = theme.font, delay = 0 } = {}) => {
    const cl = Math.min(110, Math.max(20, Math.round(len * 0.6)));
    if (sp.static) return text(suffix, rect, sp.static, { size, weight, color, align, font, delay, valign: "center", lineHeight: 1 });
    return mk(suffix, "text", rect, { style: { size, weight, color, align, valign: "center", font, shadow: false, lineHeight: 1 },
      count: { from: sp.from, to: sp.to, decimals: sp.decimals, prefix: sp.prefix, suffix: sp.suffix, group: sp.group }, delay,
      keyframes: { ...entrance(len, { slide: 22, delay }), count: kf([0, 0], [cl, 1, "outCubic"]) } });
  };
  const bar = (suffix, rect, pct, { color = barColor, delay = 12 } = {}) => {
    mk(`${suffix}-track`, "solid", rect, { style: { background: theme.track }, keyframes: { opacity: kf([0, 0], [8, 1], [Math.max(9, len - 8), 1], [len, 0]) } });
    const fillLen = Math.min(90, Math.max(12, Math.round(len * 0.6) - delay));
    return mk(`${suffix}-fill`, "solid", rect, { style: { background: color }, delay, keyframes: { clipR: kf([0, 100], [fillLen, 100 - pct, "outCubic"]), opacity: kf([0, 0], [4, 1], [Math.max(5, len - delay - 8), 1], [len - delay, 0]) } });
  };
  const sourceTag = () => source && text("source", { x: X, y: P.y + P.h - (hero ? 70 : 52), w: W, h: 34 }, `Source: ${source}`.slice(0, 80), { size: 22, color: theme.muted, upper: look === "hallmark", tracking: look === "hallmark" ? 0.08 : 0, delay: 6 });

  // ---- the panel itself: a solid plate (slides up) with a border that draws on ----
  if (mode === "hero" || mode === "split") mk("panel", "solid", P, { style: { background: theme.bg }, radius: theme.radius, noDrift: true, keyframes: { opacity: kf([0, 0], [8, 1], [Math.max(9, len - 8), 1], [len, 0]), ty: kf([0, 60, "outCubic"], [14, 0]) } });
  if (theme.edge) mk("edge", "svg", P, { viewBox: [0, 0, P.w, P.h], paths: [{ d: `M2 2 H${P.w - 2} V${P.h - 2} H2 Z`, stroke: theme.edge, strokeWidth: 3 }], noDrift: true, keyframes: { opacity: kf([0, 0], [6, 1], [Math.max(7, len - 8), 1], [len, 0]), draw: kf([0, 0], [26, 1, "outCubic"]) } });
  if (look === "mograph-critic") mk("rule", "solid", { x: X, y: P.y + 22, w: 120, h: 6 }, { style: { background: accent }, noDrift: true, keyframes: { ...entrance(len, { slide: 0 }), clipR: kf([0, 100], [16, 0, "outCubic"]) } });
  else if (look === "anti-slop" || look === "scene-director") mk("rule", "solid", { x: P.x, y: P.y, w: 150, h: 8 }, { style: { background: barColor }, noDrift: true, keyframes: { ...entrance(len, { slide: 0 }), clipR: kf([0, 100], [16, 0, "outCubic"]) } });

  const capY = P.y + (bare ? 440 : mode === "full" ? 240 : hero ? 36 : 24), capH = hero ? 96 : 72;
  const capSize = hero ? 36 : 28;
  const caption = () => label && text("caption", { x: X, y: capY, w: W, h: capH }, label, { size: capSize, color: theme.muted, weight: look === "hallmark" ? 400 : 600, font: look === "hallmark" ? SERIF : SANS, upper: look !== "hallmark", tracking: look === "hallmark" ? 0 : 0.04, valign: "top" });

  // ---- the axis shared by bar and bars2: gridlines every 25 %, tick labels under them ----
  const axis = (y, h, trackX, trackW) => {
    [0, 25, 50, 75, 100].forEach((v, i) => {
      const gx = trackX + (trackW * v) / 100;
      mk(`grid${i}`, "solid", { x: gx - 1, y, w: 2, h }, { style: { background: theme.grid }, delay: 2 + i * 2, keyframes: { ...entrance(len, { slide: 0, delay: 2 + i * 2 }), clipB: kf([0, 100], [12, 0, "outCubic"]) } });
      text(`tick${i}`, { x: gx - 40, y: y + h + 4, w: 80, h: 30 }, `${v}%`, { size: 20, color: theme.muted, align: "center", delay: 4 + i * 2, weight: 600 });
    });
  };

  const fig = figs[0];
  const sp = parseFigure(fig);
  const pct = (f) => (f.kind === "percent" ? Math.max(0, Math.min(100, f.value)) : null);

  if (kind === "map") {
    const MP = mode === "full" ? { x: 60, y: 380, w: FULL_MAP.w, h: FULL_MAP.h } : { x: P.x + 24, y: P.y + 132, w: MAP_RECT.w, h: MAP_RECT.h };
    const names = (places?.highlights || []).map((h) => h.name).slice(0, 3);
    if (names.length) text("title", { x: X, y: capY, w: W, h: 70 }, names.join("  ·  "), { size: hero ? 46 : 36, color: theme.text, weight: 800, upper: true, tracking: 0.1, font: look === "hallmark" ? SERIF : SANS });
    if (places?.land) mk("land", "svg", MP, { viewBox: [0, 0, MP.w, MP.h], paths: [{ d: places.land, stroke: rgba(ink, 0.45), fill: rgba(ink, 0.07), strokeWidth: 1.6 }], keyframes: { ...entrance(len, { slide: 0 }), draw: kf([0, 0], [26, 1, "outCubic"]) } });
    (places?.highlights || []).forEach((h, i) => mk(`hl${i}`, "svg", MP, { viewBox: [0, 0, MP.w, MP.h], paths: [{ d: h.d, stroke: accent, fill: accent, strokeWidth: 3.5 }], delay: 12 + i * 8, keyframes: { ...entrance(len, { slide: 0 }), draw: kf([0, 0], [20, 1, "outCubic"]) } }));
    (places?.highlights || []).forEach((h, i) => {
      if (names.length < 2 && i === 0 && !places.pin) return; // a single named region is already in the title
      const lw = 330;
      text(`lab${i}`, { x: MP.x + Math.max(0, Math.min(MP.w - lw, h.cx - lw / 2)), y: MP.y + Math.max(0, Math.min(MP.h - 44, h.cy - 20)), w: lw, h: 44 }, h.name, { size: 28, color: onFill(accent), weight: 800, align: "center", delay: 26 + i * 8 });
    });
    if (places?.pin) {
      const r = 22;
      mk("pin-ring", "svg", { x: MP.x + places.pin.x - 60, y: MP.y + places.pin.y - 60, w: 120, h: 120 }, { viewBox: [0, 0, 120, 120], paths: [{ d: `M60 ${60 - r} A${r} ${r} 0 1 1 59.9 ${60 - r}`, stroke: theme.text, strokeWidth: 5 }], delay: 30, keyframes: { ...entrance(len, { slide: 0 }), draw: kf([0, 0], [14, 1, "outCubic"]), scale: kf([0, 0.6, "outCubic"], [16, 1], [48, 1.25, "inOutSine"], [80, 1]) } });
      mk("pin-dot", "solid", { x: MP.x + places.pin.x - 8, y: MP.y + places.pin.y - 8, w: 16, h: 16 }, { style: { background: theme.text }, radius: 8, delay: 30, keyframes: entrance(len, { slide: 0 }) });
    }
    if (label) text("caption", { x: X, y: P.y + P.h - 84, w: W, h: 44 }, label, { size: 26, color: theme.muted, weight: 600 });
    sourceTag();
    return layers;
  }

  caption();

  if (kind === "year") {
    const y = Number(fig.value);
    const sp2 = { from: y - 14, to: y, decimals: 0, prefix: "", suffix: "", group: false };
    countText("n", { x: X, y: P.y + (hero ? 140 : 92), w: W, h: hero ? 300 : 170 }, sp2, hero ? fitSize("0000", 260, W) : fitSize("0000", 160, 600), { delay: 2 });
    const ly = P.y + (hero ? 560 : 320);
    mk("line", "solid", { x: X, y: ly, w: W, h: 6 }, { style: { background: theme.track }, keyframes: entrance(len, { slide: 0 }) });
    mk("line-fill", "solid", { x: X, y: ly, w: W, h: 6 }, { style: { background: barColor }, keyframes: { ...entrance(len, { slide: 0 }), clipR: kf([0, 100], [26, 0, "outCubic"]) } });
    [[0, y - 10], [0.5, y - 5], [1, y]].forEach(([t, yr], i) => {
      const tx = X + W * t;
      mk(`tick${i}`, "solid", { x: tx - 3, y: ly - 18, w: 6, h: 42 }, { style: { background: i === 2 ? barColor : theme.grid }, delay: 8 + i * 6, keyframes: { ...entrance(len, { slide: 0, delay: 8 + i * 6 }), clipB: kf([0, 100], [10, 0, "outCubic"]) } });
      text(`yr${i}`, { x: tx - 60, y: ly + 30, w: 120, h: 34 }, String(yr), { size: 24, color: i === 2 ? theme.text : theme.muted, align: "center", weight: i === 2 ? 800 : 600, delay: 10 + i * 6 });
    });
    sourceTag();
    return layers;
  }

  if (kind === "count") {
    countText("n", { x: X, y: P.y + (bare ? 560 : hero ? 150 : 96), w: W, h: hero ? 340 : 190 }, sp, fitSize(fig.raw, hero ? 260 : 170, W), {});
    mk("meter", "solid", { x: X, y: P.y + (bare ? 1000 : hero ? 540 : 310), w: W, h: 8 }, { style: { background: theme.track }, keyframes: entrance(len, { slide: 0 }) });
    mk("meter-fill", "solid", { x: X, y: P.y + (bare ? 1000 : hero ? 540 : 310), w: W, h: 8 }, { style: { background: barColor }, keyframes: { ...entrance(len, { slide: 0 }), clipR: kf([0, 100], [Math.min(100, Math.max(30, Math.round(len * 0.7))), 0, "inOutSine"]) } });
    sourceTag();
    return layers;
  }

  if (kind === "ring" && pct(fig) != null) {
    const R = hero ? 330 : 280;
    const ry = P.y + (hero ? 150 : 100);
    const arc = `M${R / 2} 16 A${R / 2 - 16} ${R / 2 - 16} 0 1 1 ${R / 2 - 0.1} 16`;
    mk("ring-track", "svg", { x: X, y: ry, w: R, h: R }, { viewBox: [0, 0, R, R], paths: [{ d: arc, stroke: theme.track, strokeWidth: 26 }], keyframes: entrance(len, { slide: 0 }) });
    mk("ring", "svg", { x: X, y: ry, w: R, h: R }, { viewBox: [0, 0, R, R], paths: [{ d: arc, stroke: barColor, strokeWidth: 30 }], keyframes: { ...entrance(len, { slide: 0 }), draw: kf([0, 0], [8, 0], [Math.min(100, Math.max(42, Math.round(len * 0.6))), Math.max(0.02, pct(fig) / 100), "outCubic"]) } });
    countText("n", { x: X + 30, y: ry + R / 2 - 60, w: R - 60, h: 120 }, sp, fitSize(fig.raw, 110, R - 80), { align: "center", delay: 4 });
    if (label) text("ring-caption", { x: X + R + 40, y: P.y + (hero ? 190 : 110), w: W - R - 40, h: hero ? 280 : 220 }, label, { size: hero ? 42 : 34, color: theme.text, weight: 700, font: look === "hallmark" ? SERIF : SANS, lineHeight: 1.25, delay: 10 });
    sourceTag();
    return layers;
  }

  if (kind === "bars2") {
    const [a, b] = figs.filter((f) => f.kind === "percent").slice(0, 2);
    const rowH = hero ? 190 : 100;
    const top = P.y + (bare ? 560 : hero ? 150 : 96);
    const numW = hero ? 330 : 250;
    const trackX = X + numW + 20, trackW = W - numW - 20;
    [a, b].forEach((f, i) => {
      const y = top + i * (rowH + (hero ? 10 : 6));
      countText(`n${i}`, { x: X, y, w: numW, h: rowH }, parseFigure(f), fitSize(f.raw, hero ? 150 : 84, numW), { color: i ? barColor : theme.text, delay: i * 8 });
      bar(`b${i}`, { x: trackX, y: y + rowH / 2 - theme.barH / 2, w: trackW, h: theme.barH }, pct(f), { color: i ? barColor : theme.text, delay: 12 + i * 8 });
    });
    axis(top - 6, rowH * 2 + 22, trackX, trackW);
    sourceTag();
    return layers;
  }

  // bar: one percentage on a 0-100% axis
  countText("n", { x: X, y: P.y + (hero ? 150 : 92), w: W, h: hero ? 300 : 170 }, sp, fitSize(fig.raw, hero ? 240 : 150, hero ? W : 520), {});
  const ty = P.y + (hero ? 520 : 296);
  const pv = pct(fig) ?? 0;
  axis(ty - 12, theme.barH + 24, X, W);
  bar("b", { x: X, y: ty, w: W, h: theme.barH }, pv, { delay: 14 });
  mk("marker", "solid", { x: X + (W * pv) / 100 - 2, y: ty - 26, w: 4, h: theme.barH + 52 }, { style: { background: theme.text }, delay: 40, keyframes: { ...entrance(len, { slide: 0, delay: 40 }), clipB: kf([0, 100], [8, 0, "outCubic"]) } });
  sourceTag();
  return layers;
}

/** A flat, quiet backdrop for a scene that has no photo: the channel's background colour and a faint grid. No gradient, no glow. */
export function backdropSvg(palette) {
  const lines = [];
  for (let x = 0; x <= 1080; x += 90) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="1920"/>`);
  for (let y = 0; y <= 1920; y += 90) lines.push(`<line x1="0" y1="${y}" x2="1080" y2="${y}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <rect width="1080" height="1920" fill="${palette.bg}"/>
  <g stroke="${palette.ink || palette.accent}" stroke-opacity="0.07" stroke-width="1">${lines.join("")}</g>
</svg>
`;
}

/**
 * Motion for a photo scene that has no figure: the accent draws itself across the picture so a photo is never just a held still.
 *   corner brackets that draw on (vox, scene-director, mograph-critic), or a rule that wipes in along the top (anti-slop, hallmark).
 * The brackets frame the PHOTO (inside it). Pure decoration in the channel's one accent colour: it states nothing.
 */
export function decorationLayers({ id, look, palette, inF, outF, z = 150, photoBottom = 1360 }) {
  const len = Math.max(8, outF - inF);
  const out = Math.max(10, len - 8);
  const fade = { opacity: [{ f: 0, v: 0 }, { f: 6, v: 1 }, { f: out, v: 1 }, { f: len, v: 0 }] };
  if (look === "anti-slop" || look === "hallmark") {
    return [{ id: `${id}-wipe`, type: "solid", rect: { x: 90, y: 150, w: 260, h: look === "hallmark" ? 6 : 10 }, in: inF, out: outF, z, props: { opacity: 1 }, style: { background: palette.accent },
      keyframes: { ...fade, clipR: [{ f: 0, v: 100 }, { f: 18, v: 0, e: "outCubic" }] } }];
  }
  const L = 120, m = 60, W = 1080;
  const bottom = Math.min(photoBottom, 1360);
  const draw = { ...fade, draw: [{ f: 0, v: 0 }, { f: 4, v: 0 }, { f: 22, v: 1, e: "outCubic" }] };
  return [
    { id: `${id}-tl`, type: "svg", rect: { x: m, y: m + 90, w: L, h: L }, in: inF, out: outF, z, props: { opacity: 1 }, viewBox: [0, 0, L, L], paths: [{ d: `M 0 ${L} L 0 0 L ${L} 0`, stroke: palette.accent, strokeWidth: 7 }], keyframes: draw },
    { id: `${id}-br`, type: "svg", rect: { x: W - m - L, y: bottom - m - L, w: L, h: L }, in: inF, out: outF, z: z + 1, props: { opacity: 1 }, viewBox: [0, 0, L, L], paths: [{ d: `M ${L} 0 L ${L} ${L} L 0 ${L}`, stroke: palette.accent, strokeWidth: 7 }], keyframes: draw },
  ];
}

/** A thin accent line that crosses the frame every ~3 s: keeps a poster (or any text-and-backdrop scene) moving for as long as it is on screen. */
export function sweepLayers({ id, palette, inF, outF, z = 150 }) {
  const len = Math.max(8, outF - inF);
  const cycle = 84;
  const pts = [];
  for (let f = 0; f < len; f += cycle) { pts.push({ f, v: 0 }); pts.push({ f: Math.min(len, f + cycle - 1), v: 1860, e: "inOutSine" }); }
  return [{ id: `${id}-sweep`, type: "solid", rect: { x: 0, y: 30, w: 1080, h: 4 }, in: inF, out: outF, z, props: { opacity: 0.22 }, style: { background: palette.accent },
    keyframes: { ty: pts, opacity: [{ f: 0, v: 0 }, { f: 6, v: 0.22 }, { f: Math.max(7, len - 6), v: 0.22 }, { f: len, v: 0 }] } }];
}

/** Map geometry for a sentence's places, projected into the map rect of a hero panel. */
export function mapFor({ highlight, pin = null }) {
  return buildMap({ highlight, pin, w: FULL_MAP.w, h: FULL_MAP.h });
}
