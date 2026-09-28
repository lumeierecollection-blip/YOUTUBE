/**
 * The paper — the reference's flat white page (docs/REFERENCE-STYLE.md),
 * static, with a hard shadow down its right edge and a soft one beneath.
 * It never moves or cuts; each beat's content builds ON it and clears.
 *
 * PaperContent draws one beat, with the reference's on-paper motion:
 *   - content builds from a slight blur and clears at the end (same page)
 *   - italic lead-in, then headline words landing one at a time — grey,
 *     then black; the emphasis word scales 8% for 0.3 s
 *   - a named number rolls up from 0 over the first 40% of the beat
 *   - the planner's visual type: a rembg-isolated grayscale cutout enters
 *     from an edge with a slight rotation, then drifts (CUTOUT); or a
 *     system-drawn COUNTER / BAR / PIE / LINE / GAUGE / MAP (primitives/).
 *     No phone mockup and no rectangular photo.
 *   - a thin ring draws around the cutout; a dot grid fades in behind it
 *   - a black petal / swoosh / hairline shape (abstract-shape.jsx), behind
 *     the visual
 *   - the word-level caption (paper-caption.jsx)
 *
 * THE ZONE MAP (paper-layout.js ZONES) — the same on every beat, nothing
 * crosses between zones: the visual (and the shape) in VISUAL, the lead-in
 * + headline block in HEADLINE (sized to fit it), the caption in CAPTION.
 * Checked on rendered frames by local-audit.cjs shapes-clear-of-text.
 */
import React from "react";
import { Img, staticFile, Easing } from "remotion";
import { PAPER, PAPER_INNER, ZONES, INK, INK_SOFT, PAPER_FILL, PAPER_EDGE_SHADOW } from "./paper-layout.js";
import { AbstractShape } from "./abstract-shape.jsx";
import { Counter } from "./primitives/counter.jsx";
import { BarChart } from "./primitives/bar-chart.jsx";
import { PieChart } from "./primitives/pie-chart.jsx";
import { LineChart } from "./primitives/line-chart.jsx";
import { Gauge } from "./primitives/gauge.jsx";
import { PaperMap } from "./primitives/map.jsx";
import { PaperCaption } from "./paper-caption.jsx";
import { headlineLayout, HEADLINE_ZONE_PAD } from "./paper-text.js";

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const SERIF = "'Playfair Display', Georgia, serif";

export function Paper({ children }) {
  return (
    <div style={{
      position: "absolute", left: PAPER.x, top: PAPER.y, width: PAPER.w, height: PAPER.h,
      backgroundColor: PAPER_FILL, borderRadius: 2, overflow: "visible",
      boxShadow: `10px 0 0 -2px ${PAPER_EDGE_SHADOW}33, 14px 6px 18px rgba(0,0,0,0.22), 0 30px 50px rgba(0,0,0,0.14)`,
    }}>
      {children}
    </div>
  );
}

// "$14.99" -> {pre:"$", value:14.99, dec:2, post:""}; "500 aircraft" -> {value:500, post:" aircraft"}
function parseNumber(s) {
  const m = String(s || "").match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  const raw = m[2].replace(/,/g, "");
  return { pre: m[1], value: Number(raw), dec: (raw.split(".")[1] || "").length, post: m[3], comma: m[2].includes(",") };
}
function fmt(n, { dec, comma }) {
  const s = n.toFixed(dec);
  return comma ? Number(s).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : s;
}

// The paper's inner content box (paper-layout.js PAPER_INNER), exposed to
// everything drawn on the paper. Primitives also take it as a `bounds` prop.
export const PaperBounds = React.createContext(PAPER_INNER);

export function PaperContent({ c, local = 0, dur = 75, fps = 30, font = "Inter" }) {
  const s = (sec) => sec * fps;
  const inT = ease(clamp01(local / s(0.3)));
  const outT = clamp01((dur - local) / s(0.2));
  const vis = inT * outT;
  const blur = (1 - inT) * 6;
  // Headline layout (paper-text.js — the same numbers render.js records in
  // the manifest): the block sized to fit the HEADLINE zone and centred in it.
  const HL = headlineLayout(c);
  const { hasCutout, vtype, chart, center, words, upper, lead, textLeft, textWidth } = HL;
  const hSize = HL.size;
  const headlineTop = HL.top;
  const W = PAPER.w, H = PAPER.h;
  const B = PAPER_INNER;
  const ZV = ZONES.VISUAL, ZH = ZONES.HEADLINE, ZC = ZONES.CAPTION;

  // ── headline, word by word (grey -> black), emphasis pops 8% ──
  const hStart = s(0.35), hStep = s(0.2);
  const align = center ? "center" : "left";
  // Caption in the CAPTION zone, where it has always sat (paper y 76%).
  const captionTop = Math.max(ZC.y + HEADLINE_ZONE_PAD, H * 0.76);
  const emph = String(c.emphasis_word || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const headlineDone = hStart + words.length * hStep + s(0.2);

  // ── number roll (first 40% of the beat) ──
  const num = parseNumber(c.number);
  const rollT = clamp01(local / (dur * 0.4));
  const rolled = (n) => `${n.pre}${fmt(n.value * ease(rollT), n)}${n.post}`;
  // A number already in the headline rolls IN PLACE (no duplicate line —
  // run 36362576442 printed "273" above "276 ARRESTS").
  const numInHeadline = !!num && words.some((w) => /\d/.test(w));
  // Numbers are drawn by the visual (COUNTER/BAR/PIE/LINE/GAUGE); a number in
  // the headline still rolls in place. No separate number line.
  const numText = null;

  const headline = (
    <div style={{ position: "absolute", left: textLeft, top: headlineTop, width: textWidth, textAlign: align }}>
      {lead ? (
        <div style={{ font: `italic 400 ${HL.leadSize}px ${SERIF}`, color: INK, marginBottom: 6,
          opacity: ease(clamp01((local - s(0.1)) / s(0.25))) }}>{lead}</div>
      ) : null}
      {numText ? (
        <div style={{ font: `700 ${Math.round(hSize * 1.15)}px ${font}, sans-serif`, color: INK, letterSpacing: -hSize * 0.03,
          fontVariantNumeric: "tabular-nums", lineHeight: 1.05, marginBottom: 4 }}>{numText}</div>
      ) : null}
      <div style={{ font: `700 ${hSize}px ${font}, sans-serif`, letterSpacing: -hSize * 0.03, lineHeight: 1.04,
        textTransform: upper ? "uppercase" : "none" }}>
        {words.map((w, i) => {
          const land = hStart + i * hStep;
          const a = ease(clamp01((local - land) / s(0.18)));
          const black = clamp01((local - land - s(0.15)) / s(0.1));
          const isEmph = emph && w.toLowerCase().replace(/[^a-z0-9]/g, "") === emph;
          const pop = isEmph ? 1 + 0.08 * Math.max(0, 1 - Math.abs(local - land - s(0.3)) / s(0.3)) : 1;
          return (
            <span key={i} style={{ display: "inline-block", marginRight: hSize * 0.24, opacity: a,
              color: black >= 1 ? INK : INK_SOFT, transform: `translateY(${(1 - a) * hSize * 0.35}px) scale(${pop})`,
              transformOrigin: "left bottom" }}>{numInHeadline && /\d/.test(w) && parseNumber(w) ? rolled(parseNumber(w)) : w}</span>
          );
        })}
      </div>
      {c.select ? <SelectHandles t={clamp01((local - headlineDone) / s(0.25))} /> : null}
    </div>
  );

  // ── tiny body paragraph: the narration sentence itself ──
  // The body paragraph sits on the frame-centre band (frame y 960 = paper
  // y ~78%), so the centre of the frame always carries real text.
  const bodyTop = hasCutout ? H * 0.76 : H * 0.72;
  const body = c.body ? (
    <div style={{ position: "absolute", left: W * 0.16, top: bodyTop, width: W * 0.68, textAlign: center ? "center" : "left",
      font: `400 14px ${font}, sans-serif`, lineHeight: 1.38, color: "#222",
      opacity: ease(clamp01((local - headlineDone) / s(0.3))) }}>{String(c.body).slice(0, 170)}</div>
  ) : null;

  // ── cutout: the isolated object, in the VISUAL zone ──
  let hero = null, ring = null, grid = null;
  if (hasCutout) {
    const enterT = ease(clamp01((local - s(0.15)) / s(0.3)));
    const from = c.cutout.enter || "bottom";
    // It rises / slides a short way INTO place, inside the visual zone (it
    // used to travel 35% of the page, up through the headline and caption).
    const off = (1 - enterT) * 36;
    const dx = from === "left" ? -off : from === "right" ? off : 0;
    const dy = from === "top" ? -off * 0.6 : from === "bottom" ? off : 0;
    const drift = 0.015 * W * clamp01((local - s(0.45)) / Math.max(1, dur - s(0.45)));
    const rot = (1 - enterT) * -6;
    {
      // Zone map + fit contract: the cutout is drawn "contain" in a square
      // box, so its alpha bounds are inside the box. The box is centred in
      // the visual zone (12 px high, for the drop shadow below it), at most
      // 293 px, and placed so box + drift + drop shadow (~30 px right/down)
      // and the ring around it stay inside the zone.
      const cw = Math.min(W * 0.56, ZV.h - 64, ZV.w - 80);
      const cx = Math.min(ZV.x + ZV.w - cw - 40, (W - cw) / 2 + (center ? 0 : W * 0.06));
      const cy = ZV.y + ZV.h / 2 - 12 - cw / 2;
      hero = (
        <div style={{ position: "absolute", left: cx + dx + drift, top: cy + dy, width: cw, height: cw,
          transform: `rotate(${rot}deg)`, opacity: enterT, filter: "drop-shadow(10px 16px 14px rgba(0,0,0,0.28))" }}>
          <Img src={staticFile(c.cutout.asset)} style={{ width: "100%", height: "100%", objectFit: "contain", filter: "grayscale(1) contrast(1.15)" }} />
        </div>
      );
      if (c.ring) {
        const rT = ease(clamp01((local - s(0.35)) / s(0.5)));
        const R = cw * 0.52;
        ring = (
          <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
            {c.ringDotted
              ? <circle cx={cx + cw / 2} cy={cy + cw / 2} r={R} fill="none" stroke={INK} strokeWidth={1.5} strokeDasharray="3 7" opacity={rT} />
              : <circle cx={cx + cw / 2} cy={cy + cw / 2} r={R} fill="none" stroke={INK} strokeWidth={1.5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - rT} />}
          </svg>
        );
      }
    }
    if (c.grid) {
      const gT = clamp01((local - s(0.2)) / s(0.4));
      const dots = [];
      for (let gy = 0; gy < 6; gy++) for (let gx = 0; gx < 5; gx++) dots.push(<circle key={`${gx}-${gy}`} cx={W * 0.2 + gx * W * 0.15} cy={H * 0.08 + gy * H * 0.07} r={1.6} fill="#8a8a8a" />);
      grid = <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: gT * 0.9 }}>{dots}</svg>;
    }
  }

  // System-built data viz, on the paper in its ink, in the VISUAL zone
  // (4 px clear of its edges). Drawn, never fetched.
  const zone = { x: ZV.x + 4, y: ZV.y + 4, w: ZV.w - 8, h: ZV.h - 8 };
  const vizProps = { data: c.data, bounds: zone, local, dur, fps, font };
  const viz = chart === "COUNTER" ? <Counter {...vizProps} />
    : chart === "BAR" ? <BarChart {...vizProps} />
    : chart === "PIE" ? <PieChart {...vizProps} />
    : chart === "LINE" ? <LineChart {...vizProps} />
    : chart === "GAUGE" ? <Gauge {...vizProps} />
    : chart === "MAP" ? <PaperMap {...vizProps} />
    : null;

  return (
    <div style={{ position: "absolute", inset: 0, opacity: vis, filter: `blur(${blur.toFixed(2)}px)` }}>
      {/* The shape first: behind the visual, in a corner of the VISUAL zone. */}
      <AbstractShape variant={c.shape?.variant} corner={c.shape?.corner} visualType={vtype} local={local} fps={fps} />
      {viz}
      {grid}
      {ring}
      {hero}
      {headline}
      {body}
      <PaperCaption words={c.spoken} local={local} fps={fps} emphasis={c.emphasis_word} top={captionTop} bounds={ZC} />
    </div>
  );
}

// Design-tool selection box with corner handles around the headline block.
function SelectHandles({ t }) {
  if (t <= 0) return null;
  const hs = 7;
  const corner = (pos) => <div key={pos} style={{ position: "absolute", width: hs, height: hs, backgroundColor: PAPER_FILL, border: `1.5px solid ${INK}`,
    ...(pos.includes("t") ? { top: -hs / 2 - 6 } : { bottom: -hs / 2 - 6 }), ...(pos.includes("l") ? { left: -hs / 2 - 8 } : { right: -hs / 2 - 8 }) }} />;
  return (
    <div style={{ position: "absolute", inset: "-6px -8px -6px -8px", border: `1.2px dashed ${INK}`, opacity: t }}>
      {["tl", "tr", "bl", "br"].map(corner)}
    </div>
  );
}

export default Paper;
