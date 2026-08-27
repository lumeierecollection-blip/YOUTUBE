import React from "react";
import { useCurrentFrame } from "remotion";
import {
  CANVAS_W, CANVAS_H, STAGE_CX, Label, Figure, Rule, MeasureBracket, variantOf,
  ease, seeded, useStateProgress, EASE_OUT, EASE_IN_OUT,
} from "./primitives.jsx";
import { progressOf, reached } from "../../visual/states.js";
import { shotFrame } from "./stage.jsx";

/**
 * Quantity scenes — the four ways this renderer explains a NUMBER.
 *
 * PART 6 is the whole reason this file exists: `HERO_NUMBER` used to mean
 * "giant numeral, unit underneath, caption below". A magnitude now has to
 * pick the concept it lives inside:
 *
 *   many small -> one total          AccumulationScene
 *   one value  -> another value      TransformationScene
 *   this one   vs that one           ComparisonScene / DataChartScene
 *   how big is it, really            ScaleComparisonScene
 *
 * Every counter in this file is positioned as a LABEL on a drawn quantity,
 * never centred as the composition.
 */

/**
 * Currency handling. `unit` arrives either as a symbol (from "$500") or as
 * the spoken word (from "five hundred dollars"), because scripts are
 * written to be read aloud. Both have to produce the same rendered figure.
 */
function isMoney(unit) {
  return /[$£€]/.test(String(unit || "")) || /dollar|pound|euro|cent|usd|gbp/i.test(String(unit || ""));
}
/** A value formatter that respects the unit, for use as Figure's `format`. */
function figureFormat(unit) {
  const sym = currencySymbol(unit);
  const pct = /%|percent/i.test(String(unit || ""));
  return (v) => `${sym}${Math.round(v).toLocaleString("en-US")}${pct ? "%" : ""}`;
}

function currencySymbol(unit) {
  const u = String(unit || "");
  const sym = u.match(/[$£€]/);
  if (sym) return sym[0];
  if (/pound|gbp/i.test(u)) return "£";
  if (/euro/i.test(u)) return "€";
  if (/dollar|cent|usd/i.test(u)) return "$";
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCUMULATION — many small things becoming one consequential total.
// "Twenty small purchases quietly became $500."
// ─────────────────────────────────────────────────────────────────────────────
export function AccumulationScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const plan = beat.visualPlan || {};
  const sup = plan.supporting || {};
  // Laid out against the SHOT (visual/composition.js), not hardcoded pixels:
  // an audit found 13 of 16 scenes ignoring it and drawing at the same size
  // in the same place regardless of framing.
  const f = shotFrame(plan.shot || null);

  const count = Math.max(3, Math.min(24, Math.round(sup.count || 12)));
  const total = Number.isFinite(sup.total) ? sup.total : null;
  const money = isMoney(sup.unit);
  const symbol = currencySymbol(sup.unit);

  const pEmpty = useStateProgress(states, "empty");
  const pFirst = useStateProgress(states, "first");
  const pAcc = progressOf(states, "accumulate", frame);
  const pTotal = useStateProgress(states, "total");
  const pWeigh = useStateProgress(states, "weigh");
  const collapsed = reached(states, "total", frame);

  // COMPOSITION VARIANT (PART 13). Two ACCUMULATION beats in one finance
  // script drew the identical tray-of-tokens, differing only in how many
  // tokens fell in. Variant 1 is a LEDGER: the same units, but stacked as
  // full-width rows down a left rule the way small charges accumulate on a
  // statement. Same meaning, genuinely different picture — and for money it
  // is arguably the truer one.
  const ledger = variantOf(beat) === 1;

  // The tray: a real container with a floor the items stack on.
  const trayW = f.w * 0.62;
  const trayX = f.cx - trayW / 2;
  const floorY = f.cy + f.h * 0.42;

  // The ledger: a left rule with rows running down it.
  const ledgerTop = f.cy - f.h * 0.34;
  const ledgerH = floorY - ledgerTop;
  const rowH = Math.max(11, Math.min(34, ledgerH / Math.max(count, 1)));

  // How many items have landed. `first` lands exactly one, so the viewer
  // reads the unit before the pile becomes a texture.
  const landed = collapsed
    ? count
    : pAcc > 0
      ? Math.round(1 + ease(pAcc, EASE_IN_OUT) * (count - 1))
      : pFirst > 0
        ? 1
        : 0;

  const perRow = Math.ceil(Math.sqrt(count * 1.6));
  const cellW = trayW / perRow;
  const cellH = 46;

  const runningTotal = total != null ? (total * landed) / count : null;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* The container that gives "accumulation" a place: a tray with a
          floor the units land on, or the ledger's single left rule. */}
      {ledger ? (
        <div style={{ position: "absolute", left: trayX, top: ledgerTop, width: 3, height: ledgerH * ease(pEmpty), background: colors.stroke, opacity: 0.6 }} />
      ) : (
        <>
          <Rule x={trayX} y={floorY} w={trayW} p={pEmpty} color={colors.stroke} thickness={3} />
          <div style={{ position: "absolute", left: trayX, top: floorY - 300, width: 2, height: 300 * ease(pEmpty), background: colors.stroke, opacity: 0.45 }} />
          <div style={{ position: "absolute", left: trayX + trayW - 2, top: floorY - 300, width: 2, height: 300 * ease(pEmpty), background: colors.stroke, opacity: 0.45 }} />
        </>
      )}

      {/* The items themselves. Each one is a discrete unit that fell in. */}
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {Array.from({ length: count }).map((_, i) => {
          if (i >= landed) return null;
          const row = Math.floor(i / perRow);
          const col = i % perRow;
          const jitterX = (seeded(i * 3 + 2) - 0.5) * 8;
          // Tray: fill left-to-right, bottom-up. Ledger: one row per unit,
          // running down the rule, each a different length because no two
          // charges are the same size.
          const rowW = trayW * (0.34 + seeded(i * 7 + 13) * 0.52);
          const x = ledger ? trayX + 14 + rowW / 2 : trayX + col * cellW + cellW / 2 + jitterX;
          const y = ledger ? ledgerTop + 10 + i * rowH : floorY - 22 - row * cellH;

          // Individual drop-in for the item that just landed.
          const isNewest = i === landed - 1;
          const dropP = isNewest ? ease(Math.min(1, (pAcc * (count - 1)) % 1 + 0.25)) : 1;
          const dy = (1 - dropP) * -60;

          // On `total` the pile compresses toward the figure.
          const collapseP = ease(pTotal, EASE_IN_OUT);
          const tx = collapsed ? (STAGE_CX - x) * collapseP : 0;
          const ty = collapsed ? (760 - y) * collapseP : 0;
          const scale = collapsed ? 1 - 0.75 * collapseP : 1;
          const op = collapsed ? 1 - 0.85 * collapseP : dropP;

          return (
            <g key={i} transform={`translate(${x + tx}, ${y + dy + ty}) scale(${scale})`} opacity={op}>
              {ledger ? (
                <rect x={-rowW / 2} y={-rowH * 0.32} width={rowW} height={Math.max(4, rowH * 0.62)} rx={2}
                  fill={colors.stroke} opacity={0.5} />
              ) : (
                <>
                  <rect x={-cellW / 2 + 5} y={-16} width={cellW - 10} height={32} rx={3}
                    fill="none" stroke={colors.stroke} strokeWidth={2} />
                  {money ? (
                    <text x={0} y={6} textAnchor="middle" fill={colors.textDim}
                      style={{ font: `700 17px ${fontFamily}` }}>{symbol}</text>
                  ) : null}
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Running total — climbs WITH the pile, on the tray's own edge. */}
      {landed > 0 && total != null ? (
        <Figure
          x={trayX + trayW}
          y={floorY + 26}
          value={collapsed ? total : runningTotal}
          unit=""
          p={1}
          color={collapsed ? colors.accent : colors.textDim}
          size={collapsed ? 40 : 34}
          align="right"
          fontFamily={fontFamily}
          format={(v) => `${symbol}${Math.round(v).toLocaleString("en-US")}`}
        />
      ) : null}

      {/* Only label a count the script actually stated (supporting.countKnown).
          Otherwise the tray shows a plausible quantity with no number on it,
          rather than asserting a figure nobody said. */}
      {sup.countKnown ? (
        <Label
          x={trayX} y={floorY + 30}
          text={landed > 0 ? `${landed} OF ${count}` : ""}
          color={colors.textDim} size={24} tracking={2.6} opacity={collapsed ? 1 - ease(pTotal) : 1}
          fontFamily={fontFamily}
        />
      ) : null}

      {/* The consequential total, only after the pile becomes it.
          Two things caught on a rendered frame at this beat's ANCHOR — the
          frame where "five hundred dollars" is actually spoken:

          IT READ $0. `total` is the anchored state, and the figure counted
          up from zero starting at that state, so the number was still at
          zero on the exact frame the words landed. The counting already
          happened, on the running total that climbed with the pile; this
          figure is the RESULT, so it arrives at its value and fades in
          rather than counting again.

          IT WAS 132px, CENTRED. That is a hero number — the number as the
          composition, which is the thing this whole rebuild removed. It is
          now a caption on the compressed pile: the pile is the idea, the
          figure says what the pile is worth. */}
      {collapsed && total != null ? (
        <div style={{ opacity: ease(pTotal), transform: `scale(${0.94 + 0.06 * ease(pTotal)})`, transformOrigin: `${STAGE_CX}px 760px` }}>
          <Figure
            x={STAGE_CX} y={716}
            value={total} p={1} color={colors.accent}
            size={72} align="center" fontFamily={fontFamily}
            format={(v) => `${symbol}${Math.round(v).toLocaleString("en-US")}`}
          />
        </div>
      ) : null}

      {pWeigh > 0 && total != null ? (
        <Label
          x={STAGE_CX} y={862}
          text={sup.countKnown ? `FROM ${count} SEPARATE CHARGES` : "ONE CHARGE AT A TIME"}
          color={colors.textDim} size={26} tracking={2.6} align="center"
          opacity={pWeigh} fontFamily={fontFamily}
        />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFORMATION — a value becoming another, with the mechanism visible.
// "Debt increased from $10,000 to $18,000."
// ─────────────────────────────────────────────────────────────────────────────
export function TransformationScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const plan = beat.visualPlan || {};
  const sup = plan.supporting || {};
  const f = shotFrame(plan.shot || null);

  const from = Number.isFinite(sup.from) ? sup.from : 0;
  const to = Number.isFinite(sup.to) ? sup.to : from;
  const rising = to >= from;
  const unit = String(sup.unit || "");
  const symbol = currencySymbol(unit);
  const labels = Array.isArray(sup.labels) ? sup.labels : null;

  const pEst = useStateProgress(states, "establish");
  const pPressure = useStateProgress(states, "pressure");
  const pGrow = progressOf(states, "grow", frame);
  const pSettle = useStateProgress(states, "settle");

  const x0 = f.x + f.w * 0.12;
  const x1 = f.x + f.w * 0.88;
  const baseY = f.cy + f.h * 0.42;
  const topY = f.cy - f.h * 0.34;
  const span = x1 - x0;
  const g = ease(pGrow, EASE_IN_OUT);
  const current = from + (to - from) * g;

  const yFor = (v) => {
    const lo = Math.min(from, to) * 0.82;
    const hi = Math.max(from, to) * 1.06 || 1;
    return baseY - ((v - lo) / (hi - lo || 1)) * (baseY - topY);
  };

  // The plotted path, sampled — a real curve of the value over the span.
  const pts = [];
  const steps = 44;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (t > g) break;
    // Compounding curves; a linear move stays straight.
    const shaped = Math.pow(t, rising ? 1.55 : 0.75);
    pts.push([x0 + span * t, yFor(from + (to - from) * shaped)]);
  }
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const head = pts.length ? pts[pts.length - 1] : [x0, yFor(from)];

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* Baseline + the starting level, held as a reference all the way through */}
      <Rule x={x0} y={baseY} w={span} p={pEst} color={colors.stroke} thickness={2} />
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <line x1={x0} y1={yFor(from)} x2={x0 + span * ease(pEst)} y2={yFor(from)}
          stroke={colors.stroke} strokeWidth={1.5} strokeDasharray="7 9" opacity={0.6} />

        {/* The force acting on the value — repeated pressure marks, one per
            interval. This is the "mechanism" half of a transformation:
            without it the viewer sees a line move for no reason. */}
        {pPressure > 0
          ? Array.from({ length: 6 }).map((_, i) => {
              const t = (i + 1) / 7;
              const a = ease(Math.max(0, Math.min(1, pPressure * 2 - i * 0.16)));
              if (a <= 0.01) return null;
              const px = x0 + span * t;
              return (
                <g key={i} opacity={a * 0.85}>
                  <line x1={px} y1={yFor(from) + 6} x2={px} y2={yFor(from) - 26} stroke={colors.accent} strokeWidth={2} />
                  <polygon
                    points={`${px - 5},${yFor(from) - 24} ${px + 5},${yFor(from) - 24} ${px},${yFor(from) - 36}`}
                    fill={colors.accent}
                  />
                </g>
              );
            })
          : null}

        {/* The value's actual path */}
        {pts.length > 1 ? <path d={d} fill="none" stroke={colors.accent} strokeWidth={4} /> : null}
        {pGrow > 0 ? <circle cx={head[0]} cy={head[1]} r={7} fill={colors.accent} /> : null}

        {/* The gap between where it started and where it ended */}
        {pSettle > 0 ? (
          <line
            x1={x1} y1={yFor(from)} x2={x1} y2={yFor(from) + (yFor(to) - yFor(from)) * ease(pSettle)}
            stroke={colors.accent} strokeWidth={2} strokeDasharray="5 5"
          />
        ) : null}
      </svg>

      <Figure x={x0} y={yFor(from) + 16} value={from} p={pEst} color={colors.textDim} size={38}
        fontFamily={fontFamily} format={(v) => `${symbol}${Math.round(v).toLocaleString("en-US")}`} />
      {labels && labels[0] ? (
        <Label x={x0} y={baseY + 20} text={String(labels[0]).toUpperCase()} color={colors.textDim} size={24} tracking={2.2} opacity={pEst} fontFamily={fontFamily} />
      ) : null}

      {pGrow > 0 ? (
        <Figure x={head[0] + 18} y={head[1] - 26} value={current} p={1} color={colors.accent} size={46}
          fontFamily={fontFamily} format={(v) => `${symbol}${Math.round(v).toLocaleString("en-US")}`} />
      ) : null}
      {labels && labels[1] ? (
        <Label x={x1} y={baseY + 20} text={String(labels[1]).toUpperCase()} color={colors.textDim} size={24} tracking={2.2} align="right" opacity={pSettle} fontFamily={fontFamily} />
      ) : null}

      {pSettle > 0 && to !== from ? (
        <Label
          x={x1 + 14} y={(yFor(from) + yFor(to)) / 2 - 14}
          text={`${rising ? "+" : "-"}${symbol}${Math.abs(Math.round(to - from)).toLocaleString("en-US")}`}
          color={colors.accent} size={30} tracking={0.5} opacity={pSettle} fontFamily={fontFamily}
        />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPARISON — two quantities measured against each other, in proportion.
// Distinct from DataChartScene: this is a HEAD-TO-HEAD of two things, drawn
// as opposing masses, not a series plotted on a shared axis.
// ─────────────────────────────────────────────────────────────────────────────
export function ComparisonScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const plan = beat.visualPlan || {};
  const sup = plan.supporting || {};
  const f = shotFrame(plan.shot || null);
  const series = (sup.series || []).slice(0, 2);

  // Two opposed POSITIONS rather than two magnitudes. Same concept (X set
  // against Y), rendered in the register the evidence supports — the
  // alternative would be inventing bar values for a sentence that never
  // stated any.
  if (sup.qualitative && series.length < 2) {
    return <OppositionComparison beat={beat} sup={sup} states={states} colors={colors} fontFamily={fontFamily} />;
  }
  if (series.length < 2) return null;

  const [a, b] = series;
  const max = Math.max(Math.abs(a.value), Math.abs(b.value)) || 1;

  const pLeft = useStateProgress(states, "left");
  const pRight = useStateProgress(states, "right");
  const pGap = useStateProgress(states, "gap");
  const pVerdict = useStateProgress(states, "verdict");

  const fmt = figureFormat(sup.unit);
  const midX = f.cx;
  const axisY = f.cy + f.h * 0.38;
  const maxH = f.h * 0.72;
  const colW = f.w * 0.2;
  const hA = (Math.abs(a.value) / max) * maxH * ease(pLeft);
  const hB = (Math.abs(b.value) / max) * maxH * ease(pRight);
  const winner = Math.abs(a.value) >= Math.abs(b.value) ? "a" : "b";

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Rule x={midX - 330} y={axisY} w={660} p={Math.max(pLeft, 0.01)} color={colors.stroke} thickness={2} />

      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <rect x={midX - 250} y={axisY - hA} width={colW} height={hA}
          fill={pVerdict > 0 && winner === "a" ? colors.accent : "none"}
          stroke={colors.accent} strokeWidth={3}
          opacity={pVerdict > 0 && winner !== "a" ? 0.4 : 1} />
        <rect x={midX + 60} y={axisY - hB} width={colW} height={hB}
          fill={pVerdict > 0 && winner === "b" ? colors.accent : "none"}
          stroke={colors.accent} strokeWidth={3}
          opacity={pVerdict > 0 && winner !== "b" ? 0.4 : 1} />

        {/* The difference between them, marked where it actually is */}
        {pGap > 0 ? (
          <>
            <line x1={midX - 250} y1={axisY - Math.max(hA, hB)} x2={midX + 60 + colW} y2={axisY - Math.max(hA, hB)}
              stroke={colors.textDim} strokeWidth={1.5} strokeDasharray="6 7" opacity={0.8 * ease(pGap)} />
            <line
              x1={midX + 60 + colW + 22} y1={axisY - Math.min(hA, hB)}
              x2={midX + 60 + colW + 22} y2={axisY - Math.min(hA, hB) - (Math.max(hA, hB) - Math.min(hA, hB)) * ease(pGap)}
              stroke={colors.accent} strokeWidth={3} />
          </>
        ) : null}
      </svg>

      <Figure x={midX - 250 + colW / 2} y={axisY - hA - 56} value={a.value} p={pLeft}
        color={colors.textPrimary} size={44} align="center" fontFamily={fontFamily} format={fmt} />
      {/* Driven by `right`, the anchored state, ON PURPOSE — do not
          "fix" this to useValueProgress. The right-hand BAR also grows on
          pRight, so the figure and the column it labels arrive together;
          forcing the number to full at the anchor would put "$340" above a
          bar of zero height, which is the same inconsistency the other way
          round. The rule is that a figure matches the element it labels,
          not that every figure lands on the anchor. */}
      <Figure x={midX + 60 + colW / 2} y={axisY - hB - 56} value={b.value} p={pRight}
        color={colors.textPrimary} size={44} align="center" fontFamily={fontFamily} format={fmt} />

      <Label x={midX - 250 + colW / 2} y={axisY + 20} text={String(a.label || "").toUpperCase().slice(0, 18)}
        color={colors.textDim} size={24} tracking={2.2} align="center" opacity={pLeft} fontFamily={fontFamily} />
      <Label x={midX + 60 + colW / 2} y={axisY + 20} text={String(b.label || "").toUpperCase().slice(0, 18)}
        color={colors.textDim} size={24} tracking={2.2} align="center" opacity={pRight} fontFamily={fontFamily} />

      {pGap > 0 ? (
        <Label x={midX + 60 + colW + 40} y={axisY - Math.max(hA, hB) / 2}
          text={`${fmt(Math.abs(a.value - b.value))} APART`}
          color={colors.accent} size={26} tracking={1.8} opacity={pGap} fontFamily={fontFamily} />
      ) : null}
    </div>
  );
}

/**
 * The qualitative register of COMPARISON: two stated positions facing each
 * other across a dividing line, the second one arriving to displace the
 * first. No numbers are shown because none were stated.
 */
function OppositionComparison({ beat, sup, states, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const pLeft = useStateProgress(states, "left");
  const pRight = useStateProgress(states, "right");
  const pGap = useStateProgress(states, "gap");
  const pVerdict = useStateProgress(states, "verdict");

  const panelW = f.w * 0.78;
  const panelH = f.h * 0.24;
  const x = f.cx - panelW / 2;
  const yTop = f.cy - f.h * 0.32;
  const yBot = yTop + panelH + f.h * 0.2;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <rect x={x} y={yTop} width={panelW} height={panelH} rx={4}
          fill="none" stroke={colors.stroke} strokeWidth={2.5}
          opacity={ease(pLeft) * (pVerdict > 0 ? 0.45 : 1)} />
        {/* THE SECOND POSITION'S FRAME IS DRAWN FROM THE START, empty.
            `right` is this strategy's anchored state, so at the anchor —
            the frame where the contrast word is spoken, and the moment the
            picture is most on the hook — the composition used to be ONE box
            with four words in it and nothing else. A rendered frame of the
            ch-02 opposition beat showed exactly that: narration on a
            background, which is the failure this rebuild exists to remove.
            An opposition has two sides before either is filled in, so the
            structure is established during `left` and the second side's
            content lands on the anchor. */}
        <rect x={x} y={yBot} width={panelW} height={panelH} rx={4}
          fill={colors.accent} fillOpacity={0.12 * ease(pVerdict)}
          stroke={pRight > 0 ? colors.accent : colors.stroke}
          strokeWidth={pRight > 0 ? 3 : 2.5}
          strokeDasharray={pRight > 0 ? "none" : "10 8"}
          opacity={pRight > 0 ? ease(pRight) : 0.45 * ease(pLeft)} />
        {/* The dividing line IS the disagreement — it draws through on
            `gap`, over a faint rule that exists as soon as there are two
            sides to divide. */}
        <line
          x1={x} y1={(yTop + panelH + yBot) / 2}
          x2={x + panelW} y2={(yTop + panelH + yBot) / 2}
          stroke={colors.stroke} strokeWidth={1.5} opacity={0.3 * ease(pLeft)} />
        {pGap > 0 ? (
          <line
            x1={x} y1={(yTop + panelH + yBot) / 2}
            x2={x + panelW * ease(pGap)} y2={(yTop + panelH + yBot) / 2}
            stroke={colors.accent} strokeWidth={3} strokeDasharray="12 10" />
        ) : null}
      </svg>

      {/* Each side carries its own position. No "ARGUED"/"BUT" headers
          stacked above them — the pivot word sits ON the dividing line,
          which is where the opposition actually happens, and costs one
          word instead of two labels. */}
      <div style={{
        position: "absolute", left: x + 28, top: yTop + 42, width: panelW - 56,
        color: colors.textPrimary, fontFamily, fontWeight: 700, fontSize: 36, lineHeight: 1.25,
        opacity: ease(pLeft) * (pVerdict > 0 ? 0.55 : 1),
      }}>{sup.leftPhrase || ""}</div>

      {pGap > 0 ? (
        <div style={{
          position: "absolute", left: 0, right: 0, top: (yTop + panelH + yBot) / 2 - 20,
          textAlign: "center", opacity: ease(pGap),
        }}>
          <span style={{
            background: colors.bg, padding: "0 18px",
            color: colors.accent, fontFamily, fontWeight: 800, fontSize: 26, letterSpacing: 3,
          }}>{String(sup.pivot || "BUT").toUpperCase()}</span>
        </div>
      ) : null}

      {pRight > 0 ? (
        <div style={{
          position: "absolute", left: x + 28, top: yBot + 42, width: panelW - 56,
          color: colors.textPrimary, fontFamily, fontWeight: 800, fontSize: 38, lineHeight: 1.25,
          opacity: ease(pRight),
        }}>{sup.rightPhrase || ""}</div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA_CHART — real series on a zero-origin axis.
// Keeps the honesty rules the register already enforces (ENC-10 zero origin,
// ENC-09 <=5 points, ENC-14 values adjacent to their bar).
// ─────────────────────────────────────────────────────────────────────────────
export function DataChartScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const plan = beat.visualPlan || {};
  const sup = plan.supporting || {};
  const f = shotFrame(plan.shot || null);
  const series = (sup.series || []).slice(0, 5);
  if (series.length < 2) return null;

  const pAxis = useStateProgress(states, "axis");
  const pBars = progressOf(states, "bars", frame);
  const pHi = useStateProgress(states, "highlight");
  const pRead = useStateProgress(states, "read");

  const chartFmt = figureFormat(sup.unit);
  const max = Math.max(...series.map((s) => Math.abs(s.value))) || 1;
  const axisY = f.cy + f.h * 0.4;
  const x0 = f.x + f.w * 0.14;
  const w = f.w * 0.72;
  const maxH = f.h * 0.74;
  const gap = 26;
  const barW = (w - gap * (series.length - 1)) / series.length;
  const hiIdx = Math.max(series.findIndex((s) => s.highlight), 0);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* ENC-10 — the axis is the zero line, always drawn. */}
      <Rule x={x0} y={axisY} w={w} p={pAxis} color={colors.stroke} thickness={2} />
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {series.map((s, i) => {
          const grow = ease(Math.max(0, Math.min(1, pBars * series.length - i * 0.5)), EASE_OUT);
          const h = (Math.abs(s.value) / max) * maxH * grow;
          const x = x0 + i * (barW + gap);
          const isHi = i === hiIdx && pHi > 0;
          return (
            <rect key={i} x={x} y={axisY - h} width={barW} height={h}
              fill={isHi ? colors.accent : "none"}
              stroke={isHi ? colors.accent : colors.stroke}
              strokeWidth={3}
              opacity={pHi > 0 && !isHi ? 0.45 : 1} />
          );
        })}
      </svg>
      {series.map((s, i) => {
        const grow = ease(Math.max(0, Math.min(1, pBars * series.length - i * 0.5)), EASE_OUT);
        const h = (Math.abs(s.value) / max) * maxH * grow;
        const x = x0 + i * (barW + gap) + barW / 2;
        return (
          <React.Fragment key={i}>
            {/* ENC-14 — the value sits adjacent to ITS bar, not in a legend */}
            <Figure x={x} y={axisY - h - 50} value={s.value} p={grow}
              color={i === hiIdx && pHi > 0 ? colors.accent : colors.textPrimary}
              size={38} align="center" fontFamily={fontFamily} format={chartFmt} />
            <Label x={x} y={axisY + 18} text={String(s.label || "").toUpperCase().slice(0, 14)}
              color={colors.textDim} size={22} tracking={1.8} align="center"
              opacity={Math.max(pRead, grow)} fontFamily={fontFamily} />
          </React.Fragment>
        );
      })}
      {sup.unit ? (
        <Label x={x0} y={axisY - maxH - 66} text={String(sup.unit).toUpperCase()}
          color={colors.textDim} size={22} tracking={2.4} opacity={pAxis} fontFamily={fontFamily} />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCALE_COMPARISON — the last resort for a bare magnitude, and still not a
// naked numeral: the value grows against a reference quantity so the viewer
// sees HOW BIG, not just WHAT.
// ─────────────────────────────────────────────────────────────────────────────
export function ScaleComparisonScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const plan = beat.visualPlan || {};
  const sup = plan.supporting || {};
  const f = shotFrame(plan.shot || null);
  const value = Number.isFinite(sup.value) ? sup.value : 0;

  const pRef = useStateProgress(states, "reference");
  const pGrow = progressOf(states, "grow", frame);
  const pRead = useStateProgress(states, "read");

  // A unit-block field: the value expressed as countable blocks, so the
  // magnitude is something the eye can measure rather than read.
  const cols = 10, rows = 10;
  const blocks = cols * rows;
  const filled = Math.round(blocks * ease(pGrow, EASE_IN_OUT));
  const cell = 52, pad = 8;
  const gridW = cols * cell;
  const gridX = f.cx - gridW / 2;
  const gridY = f.cy - f.h * 0.3;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {Array.from({ length: blocks }).map((_, i) => {
          const r = Math.floor(i / cols), c = i % cols;
          const on = i < filled;
          const a = ease(Math.max(0, Math.min(1, pRef * 3 - (r * cols + c) * 0.002)));
          return (
            <rect key={i}
              x={gridX + c * cell} y={gridY + (rows - 1 - r) * cell}
              width={cell - pad} height={cell - pad} rx={2}
              fill={on ? colors.accent : "none"}
              stroke={on ? colors.accent : colors.stroke}
              strokeWidth={1.5}
              opacity={on ? 1 : 0.3 * a} />
          );
        })}
      </svg>
      <MeasureBracket x1={gridX} x2={gridX + gridW} y={gridY + rows * cell + 18} color={colors.stroke} p={pRef} />
      {/* p is `grow`, the anchored state, ON PURPOSE — same as COMPARISON's
          right-hand column. The quantity grows FROM the anchor, so the
          figure grows with it rather than standing at full value before the
          thing it measures exists. See strategies.js `resolves`. */}
      <Figure x={STAGE_CX} y={gridY + rows * cell + 52} value={value} unit={String(sup.unit || "")}
        p={ease(pGrow)} color={colors.accent} size={72} align="center" fontFamily={fontFamily} />
      {pRead > 0 ? (
        <Label x={STAGE_CX} y={gridY - 54} text={`${Math.round(ease(pGrow) * 100)}% OF THE FIELD`}
          color={colors.textDim} size={24} tracking={2.4} align="center" opacity={pRead} fontFamily={fontFamily} />
      ) : null}
    </div>
  );
}
