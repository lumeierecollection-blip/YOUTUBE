/**
 * Motion graphics for the automatic editor: the figure a sentence states, drawn as REAL animated layers (not a picture of one):
 *   - a bar that grows to exactly that share (a solid layer whose clipR is keyframed),
 *   - a ring that draws on to exactly that share (an svg path whose draw is keyframed),
 *   - a number that counts up to the stated value (a text layer with `count`),
 *   - plates, strips, rules and an annotation ellipse that slide or draw in.
 * Each of the five looks (styles.mjs) has its own arrangement. Nothing here states anything the sentence does not: the numbers are
 * the figures extracted from the sentence and found in the research, and the only other text is the source's host.
 */
import { fitSize } from "./styles.mjs";

const SANS = "Inter";
const SERIF = "Georgia";

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

/** Which graphic fits the figures: percentages get a bar or a ring (two percentages get two bars), anything else counts. */
export function chooseKind(figs, rng, look) {
  const pcts = figs.filter((f) => f.kind === "percent" && f.value >= 0 && f.value <= 100);
  if (pcts.length >= 2) return "bars2";
  if (pcts.length === 1) return look === "vox" || look === "anti-slop" ? (rng() < 0.45 ? "ring" : "bar") : "bar";
  return "count";
}

const span = (l) => Math.max(2, l.out - l.in);
const kf = (...a) => a.map(([f, v, e]) => ({ f, v, ...(e ? { e } : {}) }));

function entrance(len, { slide = 36, delay = 0 } = {}) {
  const e = Math.min(14, Math.max(4, Math.floor(len / 5)));
  const x = Math.max(e + delay + 1, len - 8);
  return {
    opacity: kf([0, 0], [delay, 0, "outCubic"], [delay + 8, 1], [x, 1], [len, 0, "inOutCubic"]),
    ty: slide ? kf([0, slide], [delay, slide, "outCubic"], [delay + e, 0]) : undefined,
  };
}

/** Build the layers for one scene's graphic. inF/outF = the frames the graphic is on screen. */
export function graphicLayers({ id, kind, figs, source, fn = "evidence", look, palette, secondary = "#1A1A33", inF, outF, z = 150, dy = 0, rng = Math.random }) {
  const len = Math.max(8, outF - inF);
  const layers = [];
  const mk = (suffix, type, rect, extra = {}) => {
    const keyframes = { ...(extra.keyframes || {}) };
    for (const k of Object.keys(keyframes)) if (keyframes[k] === undefined) delete keyframes[k];
    const { keyframes: _k, ...rest } = extra;
    const layer = { id: `${id}-${suffix}`, type, rect: { x: Math.round(rect.x), y: Math.round(rect.y + dy), w: Math.round(rect.w), h: Math.round(rect.h) }, in: inF + (extra.delay || 0), out: outF, z: z + layers.length, props: { opacity: 1 }, ...rest, keyframes };
    delete layer.delay;
    layers.push(layer);
    return layer;
  };
  const ink = "#101114";
  const accent = palette.accent;
  const fig = figs[0];
  const spec = parseFigure(fig);
  const growBar = (suffix, rect, color, pct, delay = 10, track = true) => {
    if (track) mk(`${suffix}-track`, "solid", rect, { style: { background: "#FFFFFF" }, keyframes: { opacity: kf([0, 0], [8, 0.16], [Math.max(9, len - 8), 0.16], [len, 0]) } });
    const fillLen = Math.min(34, Math.max(12, len - delay - 10));
    mk(`${suffix}-fill`, "solid", rect, {
      style: { background: color }, delay,
      keyframes: { clipR: kf([0, 100], [fillLen, 100 - pct, "outExpo"]), opacity: kf([0, 0], [4, 1], [Math.max(5, len - delay - 8), 1], [len - delay, 0]) },
    });
  };
  const number = (suffix, rect, size, color, { align = "left", font = SANS, weight = 800, delay = 0, shadow = false, spec: sp = spec } = {}) => {
    const cl = Math.min(36, Math.max(14, len - 14));
    if (sp.static) return mk(suffix, "text", rect, { text: sp.static, style: { size, weight, color, align, valign: "center", font, shadow, lineHeight: 1 }, delay, keyframes: entrance(len) });
    return mk(suffix, "text", rect, {
      style: { size, weight, color, align, valign: "center", font, shadow, lineHeight: 1 },
      count: { from: sp.from, to: sp.to, decimals: sp.decimals, prefix: sp.prefix, suffix: sp.suffix, group: sp.group },
      delay,
      keyframes: { ...entrance(len, { delay: 0 }), count: kf([0, 0], [cl, 1, "outExpo"]) },
    });
  };
  const sourceTag = (rect, color = "#C9CDD6", align = "left", upper = false) => source && mk("source", "text", rect, {
    text: `Source: ${source}`.slice(0, 80), style: { size: 24, weight: 600, color, align, valign: "center", font: SANS, shadow: false, upper, tracking: upper ? 0.1 : 0 }, keyframes: entrance(len, { slide: 0, delay: 6 }),
  });
  const rule = (suffix, rect, color = accent) => mk(suffix, "solid", rect, { style: { background: color }, keyframes: { ...entrance(len, { slide: 0 }), clipR: kf([0, 100], [16, 0, "outCubic"]) } });

  const base = 900;
  const big = (f, bw = 880, cap = 250) => fitSize(f.raw, cap, bw);
  const pct = (f) => (f.kind === "percent" ? Math.max(0, Math.min(100, f.value)) : null);

  if (kind === "bars2") {
    const [a, b] = figs.filter((f) => f.kind === "percent").slice(0, 2);
    const rows = [[a, base - 250], [b, base + 90]];
    rows.forEach(([f, y], i) => {
      const sp = parseFigure(f);
      number(`n${i}`, { x: 90, y, w: 900, h: 150 }, fitSize(f.raw, 150, 860), i ? accent : "#FFFFFF", { sp, delay: i * 8 });
      growBar(`b${i}`, { x: 90, y: y + 160, w: 900, h: look === "hallmark" ? 12 : 30 }, i ? accent : "#FFFFFF", pct(f), 10 + i * 8);
    });
    sourceTag({ x: 90, y: base + 330, w: 900, h: 36 });
    return layers;
  }

  if (look === "hallmark") {
    mk("plate", "solid", { x: 90, y: base - 200, w: 900, h: kind === "count" ? 330 : 420 }, { style: { background: "#EFE8D8" }, keyframes: entrance(len, { slide: 60 }) });
    rule("plate-rule", { x: 90, y: base - 200, w: 900, h: 8 });
    number("n", { x: 130, y: base - 170, w: 820, h: 240 }, fitSize(fig.raw, 200, 720), ink, { font: SERIF, weight: 400, delay: 4 });
    if (kind === "bar" && pct(fig) != null) growBar("b", { x: 130, y: base + 90, w: 820, h: 14 }, ink, pct(fig), 14, true);
    sourceTag({ x: 130, y: base + (kind === "count" ? 70 : 118), w: 820, h: 30 }, "#4A463C", "left", true);
    return layers;
  }

  if (look === "mograph-critic") {
    mk("strip", "solid", { x: 0, y: base + 230, w: 1080, h: 300 }, { style: { background: "rgba(5,5,8,0.78)" }, keyframes: entrance(len, { slide: 80 }), delay: 6 });
    rule("rule", { x: 96, y: base + 266, w: 120, h: 6 }, accent);
    number("n", { x: 96, y: base + 280, w: 888, h: 150 }, fitSize(fig.raw, 170, 880), "#FFFFFF", { delay: 12 });
    if (pct(fig) != null) growBar("b", { x: 96, y: base + 494, w: 888, h: 8 }, accent, pct(fig), 18, true);
    sourceTag({ x: 96, y: base + 440, w: 888, h: 30 }, "#C7CAD1", "right");
    return layers;
  }

  if (look === "scene-director") {
    if (fn === "payoff") {
      mk("flat", "solid", { x: 0, y: -dy, w: 1080, h: 1920 }, { style: { background: accent }, keyframes: { opacity: kf([0, 0], [10, 1], [Math.max(11, len - 8), 1], [len, 0]) } });
      number("n", { x: 90, y: base - 260, w: 900, h: 420 }, fitSize(fig.raw, 330, 880), ink, { weight: 900, delay: 6 });
      if (pct(fig) != null) growBar("b", { x: 90, y: base + 190, w: 900, h: 26 }, ink, pct(fig), 16, true);
      sourceTag({ x: 90, y: base + 250, w: 900, h: 32 }, ink);
      return layers;
    }
    if (fn === "hook") {
      number("n", { x: 90, y: base - 330, w: 900, h: 520 }, fitSize(fig.raw, 340, 880), "#FFFFFF", { align: "center", weight: 900, shadow: true });
      rule("rule", { x: 340, y: base + 190, w: 400, h: 12 });
      if (pct(fig) != null) growBar("b", { x: 190, y: base + 240, w: 700, h: 18 }, accent, pct(fig), 14, true);
      return layers;
    }
    const w = Math.min(760, 60 + Math.ceil(fig.raw.length * fitSize(fig.raw, 100, 640) * 0.66));
    mk("chip", "solid", { x: 90, y: 300 - dy, w, h: 150 }, { style: { background: accent }, keyframes: { ...entrance(len, { slide: -50 }), clipR: kf([0, 100], [14, 0, "outCubic"]) } });
    number("n", { x: 120, y: 300 - dy, w: w - 60, h: 150 }, fitSize(fig.raw, 100, 640), ink, { weight: 900, delay: 4 });
    if (pct(fig) != null) growBar("b", { x: 90, y: 462 - dy, w, h: 14 }, accent, pct(fig), 14, true);
    return layers;
  }

  if (look === "vox") {
    number("n", { x: 90, y: base - 190, w: 900, h: 300 }, fitSize(fig.raw, 250, 700), "#FFFFFF", { align: "center", weight: 900, shadow: true, delay: 0 });
    const w = Math.min(860, 120 + fig.raw.length * 120);
    const cx = 450, cy = 150, rx = w / 2, ry = 140;
    mk("circle", "svg", { x: 90, y: base - 190, w: 900, h: 300 }, {
      viewBox: [0, 0, 900, 300],
      paths: [{ d: `M ${cx - rx} ${cy + 10} C ${cx - rx} ${cy - ry - 10}, ${cx + rx - 20} ${cy - ry - 20}, ${cx + rx} ${cy - 20} C ${cx + rx + 8} ${cy + ry}, ${cx - rx + 40} ${cy + ry + 14}, ${cx - rx + 4} ${cy - 18}`, stroke: accent, strokeWidth: 9 }],
      keyframes: { ...entrance(len, { slide: 0 }), draw: kf([0, 0], [10, 0], [32, 1, "outCubic"]) },
    });
    if (kind === "ring" && pct(fig) != null) {
      mk("ring-track", "svg", { x: 290, y: base + 130, w: 500, h: 500 }, { viewBox: [0, 0, 500, 500], paths: [{ d: "M250 30 A220 220 0 1 1 249.9 30", stroke: "rgba(255,255,255,0.18)", strokeWidth: 22 }], keyframes: entrance(len, { slide: 0 }) });
      mk("ring", "svg", { x: 290, y: base + 130, w: 500, h: 500 }, { viewBox: [0, 0, 500, 500], paths: [{ d: "M250 30 A220 220 0 1 1 249.9 30", stroke: accent, strokeWidth: 26 }], keyframes: { ...entrance(len, { slide: 0 }), draw: kf([0, 0], [8, 0], [40, Math.max(0.02, pct(fig) / 100), "outExpo"]) } });
    } else if (pct(fig) != null) {
      growBar("b", { x: 190, y: base + 150, w: 700, h: 16 }, accent, pct(fig), 16, true);
    }
    sourceTag({ x: 90, y: base + (kind === "ring" ? 650 : 200), w: 900, h: 30 }, "#C9C9C9", "center");
    return layers;
  }

  // anti-slop: flat, hard-edged, one accent
  if (kind === "ring" && pct(fig) != null) {
    mk("ring-track", "svg", { x: 90, y: base - 250, w: 440, h: 440 }, { viewBox: [0, 0, 440, 440], paths: [{ d: "M220 24 A196 196 0 1 1 219.9 24", stroke: "rgba(255,255,255,0.18)", strokeWidth: 26 }], keyframes: entrance(len, { slide: 0 }) });
    mk("ring", "svg", { x: 90, y: base - 250, w: 440, h: 440 }, { viewBox: [0, 0, 440, 440], paths: [{ d: "M220 24 A196 196 0 1 1 219.9 24", stroke: accent, strokeWidth: 30 }], keyframes: { ...entrance(len, { slide: 0 }), draw: kf([0, 0], [8, 0], [40, Math.max(0.02, pct(fig) / 100), "outExpo"]) } });
    number("n", { x: 560, y: base - 150, w: 430, h: 240 }, fitSize(fig.raw, 150, 410), "#FFFFFF", { delay: 4 });
    sourceTag({ x: 560, y: base + 100, w: 430, h: 30 });
    return layers;
  }
  number("n", { x: 90, y: base - 250, w: 900, h: 330 }, big(fig), "#FFFFFF", {});
  if (pct(fig) != null) growBar("b", { x: 90, y: base + 100, w: 900, h: 22 }, accent, pct(fig), 14, true);
  else rule("rule", { x: 90, y: base + 100, w: 160, h: 22 });
  sourceTag({ x: 90, y: base + 150, w: 900, h: 30 });
  return layers;
}

/** A flat, quiet backdrop for a scene that has no photo: the channel's background colour and a faint grid. No gradient, no glow. */
export function backdropSvg(palette) {
  const lines = [];
  for (let x = 0; x <= 1080; x += 90) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="1920"/>`);
  for (let y = 0; y <= 1920; y += 90) lines.push(`<line x1="0" y1="${y}" x2="1080" y2="${y}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <rect width="1080" height="1920" fill="${palette.bg}"/>
  <g stroke="${palette.accent}" stroke-opacity="0.08" stroke-width="1">${lines.join("")}</g>
</svg>
`;
}

/**
 * Motion for a photo scene that has no figure: the accent draws itself across the picture so a photo is never just a held still.
 *   corner brackets that draw on (vox, scene-director, mograph-critic), or a rule that wipes in along the top (anti-slop, hallmark).
 * A few frames in, held, then gone with the scene. Pure decoration in the channel's one accent colour: it states nothing.
 */
export function decorationLayers({ id, look, palette, inF, outF, z = 150 }) {
  const len = Math.max(8, outF - inF);
  const out = Math.max(10, len - 8);
  const fade = { opacity: [{ f: 0, v: 0 }, { f: 6, v: 1 }, { f: out, v: 1 }, { f: len, v: 0 }] };
  if (look === "anti-slop" || look === "hallmark") {
    return [{ id: `${id}-wipe`, type: "solid", rect: { x: 90, y: 150, w: 260, h: look === "hallmark" ? 6 : 10 }, in: inF, out: outF, z, props: { opacity: 1 }, style: { background: palette.accent },
      keyframes: { ...fade, clipR: [{ f: 0, v: 100 }, { f: 18, v: 0, e: "outCubic" }] } }];
  }
  const L = 120, m = 60, W = 1080, H = 1920;
  const draw = { ...fade, draw: [{ f: 0, v: 0 }, { f: 4, v: 0 }, { f: 22, v: 1, e: "outCubic" }] };
  return [
    { id: `${id}-tl`, type: "svg", rect: { x: m, y: m + 90, w: L, h: L }, in: inF, out: outF, z, props: { opacity: 1 }, viewBox: [0, 0, L, L], paths: [{ d: `M 0 ${L} L 0 0 L ${L} 0`, stroke: palette.accent, strokeWidth: 7 }], keyframes: draw },
    { id: `${id}-br`, type: "svg", rect: { x: W - m - L, y: H - 560 - L, w: L, h: L }, in: inF, out: outF, z: z + 1, props: { opacity: 1 }, viewBox: [0, 0, L, L], paths: [{ d: `M ${L} 0 L ${L} ${L} L 0 ${L}`, stroke: palette.accent, strokeWidth: 7 }], keyframes: draw },
  ];
}
