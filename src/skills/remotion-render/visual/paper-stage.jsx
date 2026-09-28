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
 *   - a thin ring draws around the cutout; a dot grid fades in behind it;
 *     design-tool selection handles frame the headline
 *   - a black petal / swoosh / hairline shape (abstract-shape.jsx)
 *   - the sentence itself as the tiny body paragraph (real text, never
 *     invented filler)
 */
import React from "react";
import { Img, staticFile, Easing } from "remotion";
import { PAPER, INK, INK_SOFT, PAPER_FILL, PAPER_EDGE_SHADOW } from "./paper-layout.js";
import { AbstractShape } from "./abstract-shape.jsx";
import { Counter } from "./primitives/counter.jsx";
import { BarChart } from "./primitives/bar-chart.jsx";
import { PieChart } from "./primitives/pie-chart.jsx";
import { LineChart } from "./primitives/line-chart.jsx";
import { Gauge } from "./primitives/gauge.jsx";
import { PaperMap } from "./primitives/map.jsx";
import { PaperCaption } from "./paper-caption.jsx";

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

function fitSize(text, width, max, min) {
  return Math.round(Math.max(min, Math.min(max, width / Math.max(1, String(text).length * 0.56))));
}

export function PaperContent({ c, local = 0, dur = 75, fps = 30, font = "Inter" }) {
  const s = (sec) => sec * fps;
  const inT = ease(clamp01(local / s(0.3)));
  const outT = clamp01((dur - local) / s(0.2));
  const vis = inT * outT;
  const blur = (1 - inT) * 6;
  const hasCutout = !!c.cutout?.asset;
  // No phone mockups: a cutout is the rembg-isolated object (PNG + alpha).
  const vtype = String(c.visual_type || (hasCutout ? "CUTOUT" : "TYPE")).toUpperCase();
  const chart = ["COUNTER", "BAR", "PIE", "LINE", "GAUGE", "MAP"].includes(vtype) && c.data ? vtype : null;
  const center = c.layout === "center" || (!hasCutout && !chart);
  const W = PAPER.w, H = PAPER.h;

  // ── headline, word by word (grey -> black), emphasis pops 8% ──
  const words = String(c.headline || "").split(/\s+/).filter(Boolean);
  const hStart = s(0.35), hStep = s(0.2);
  const hSize = !hasCutout && !chart ? fitSize(c.headline, W * 0.78, 84, 34) : fitSize(c.headline, W * 0.72, 56, 26);
  const upper = words.length <= 3;
  // Visual on top (y 8-50%), headline under it (55%), the word-level
  // caption under that (76%) - the page is filled top to bottom. A TYPE beat's
  // headline sits higher and larger.
  const headlineTop = hasCutout || chart ? H * 0.55 : H * 0.34;
  const captionTop = H * 0.76;
  const lead = String(c.lead_in || "").trim();
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

  const align = center ? "center" : "left";
  const textLeft = center ? W * 0.08 : W * 0.12;
  const textWidth = center ? W * 0.84 : W * 0.76;

  const headline = (
    <div style={{ position: "absolute", left: textLeft, top: headlineTop, width: textWidth, textAlign: align }}>
      {lead ? (
        <div style={{ font: `italic 400 ${Math.round(hSize * 0.42 + 8)}px ${SERIF}`, color: INK, marginBottom: 6,
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

  // ── cutout: the isolated object, on the paper ──
  let hero = null, ring = null, grid = null;
  if (hasCutout) {
    const enterT = ease(clamp01((local - s(0.15)) / s(0.3)));
    const from = c.cutout.enter || "bottom";
    const off = (1 - enterT) * 0.35;
    const dx = from === "left" ? -W * off : from === "right" ? W * off : 0;
    const dy = from === "top" ? -H * off : from === "bottom" ? H * off : 0;
    const drift = 0.015 * W * clamp01((local - s(0.45)) / Math.max(1, dur - s(0.45)));
    const rot = (1 - enterT) * -6;
    {
      const cw = W * 0.56;
      const cx = (W - cw) / 2 + (center ? 0 : W * 0.06), cy = H * 0.1;
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

  // System-built data viz, on the paper in its ink (visual zone above the
  // headline). Drawn, never fetched.
  const zone = { x: W * 0.08, y: H * 0.08, w: W * 0.84, h: H * 0.42 };
  const vizProps = { data: c.data, zone, local, dur, fps, font };
  const viz = chart === "COUNTER" ? <Counter {...vizProps} />
    : chart === "BAR" ? <BarChart {...vizProps} />
    : chart === "PIE" ? <PieChart {...vizProps} />
    : chart === "LINE" ? <LineChart {...vizProps} />
    : chart === "GAUGE" ? <Gauge {...vizProps} />
    : chart === "MAP" ? <PaperMap {...vizProps} />
    : null;

  return (
    <div style={{ position: "absolute", inset: 0, opacity: vis, filter: `blur(${blur.toFixed(2)}px)` }}>
      {viz}
      {grid}
      {ring}
      {hero}
      {headline}
      {body}
      <PaperCaption words={c.spoken} local={local} fps={fps} emphasis={c.emphasis_word} top={captionTop} />
      {/* Clipped to the paper: in the reference shapes enter from the page's
          corners and edges, never over the studio or the device. */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <AbstractShape variant={c.shape?.variant} corner={c.shape?.corner} local={local} fps={fps} />
      </div>
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
