import React from "react";
import { useCurrentFrame } from "remotion";
import {
  CANVAS_W, CANVAS_H, STAGE_CX, Label, Rule, ease, seeded, variantOf,
  useStateProgress, EASE_OUT, EASE_IN_OUT,
} from "./primitives.jsx";
import { progressOf, reached } from "../../visual/states.js";

/**
 * Structure scenes — how things are ARRANGED, rather than how big they are.
 *
 *   when it happened, in order        TimelineScene
 *   what it moves through             ProcessScene
 *   what drives what                  CauseEffectScene
 *   who is connected to whom          RelationshipScene
 *
 * These four are deliberately different geometries — a horizontal dated
 * axis, a left-to-right stage chain with a travelling token, a two-node
 * vertical driver/outcome pair, and a radial node graph. If they shared a
 * layout they'd be aliases (PART 2), which the registry check would catch.
 */

const short = (s, n) => {
  const t = String(s || "").trim().replace(/\s+/g, " ");
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
};

/** Pull the most meaningful words out of a clause for a node label. */
const STOP = new Set("a an the of and or but not is are was were be been being to from in on at for with by as it its this that these those they them their he she we you i our your his her".split(" "));
function keyPhrase(text, maxWords = 3) {
  const words = String(text || "")
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()));
  return words.slice(0, maxWords).join(" ").toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE — dated events on a real axis.
// ─────────────────────────────────────────────────────────────────────────────
export function TimelineScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const sup = (beat.visualPlan && beat.visualPlan.supporting) || {};
  const years = (sup.years || []).slice(0, 5);

  const pAxis = useStateProgress(states, "axis");
  const pEvents = progressOf(states, "events", frame);
  const pFocus = useStateProgress(states, "focus");
  const pCons = useStateProgress(states, "consequence");

  const x0 = 148, w = 680, axisY = 760;
  // A single dated event still gets a real axis with a before/after span,
  // so "the law changed in 1998" reads as a moment IN time, not a caption.
  const span = years.length >= 2
    ? { lo: years[0], hi: years[years.length - 1] }
    : years.length === 1
      ? { lo: years[0] - 12, hi: years[0] + 12 }
      : null;
  if (!span) return null;

  const xFor = (y) => x0 + ((y - span.lo) / (span.hi - span.lo || 1)) * w;
  const focusYear = years.length ? years[years.length - 1] : null;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Rule x={x0} y={axisY} w={w} p={pAxis} color={colors.stroke} thickness={2} />

      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {/* Decade ticks — gives the axis real scale rather than two dots */}
        {Array.from({ length: 11 }).map((_, i) => {
          const t = i / 10;
          const x = x0 + w * t;
          const a = ease(Math.max(0, Math.min(1, pAxis * 2 - t)));
          return <line key={i} x1={x} y1={axisY} x2={x} y2={axisY + 10} stroke={colors.stroke} strokeWidth={1.5} opacity={0.55 * a} />;
        })}

        {years.map((y, i) => {
          const a = ease(Math.max(0, Math.min(1, pEvents * years.length - i)));
          if (a <= 0.01) return null;
          const x = xFor(y);
          const isFocus = y === focusYear && pFocus > 0;
          const stemH = 92 + (i % 2) * 44;
          return (
            <g key={y} opacity={pFocus > 0 && !isFocus ? 0.4 : 1}>
              <line x1={x} y1={axisY} x2={x} y2={axisY - stemH * a} stroke={isFocus ? colors.accent : colors.stroke} strokeWidth={isFocus ? 3 : 2} />
              <circle cx={x} cy={axisY} r={isFocus ? 9 : 6} fill={isFocus ? colors.accent : colors.stroke} opacity={a} />
              {isFocus ? (
                <circle cx={x} cy={axisY} r={9 + 22 * ease(pFocus)} fill="none" stroke={colors.accent} strokeWidth={2} opacity={0.6 * (1 - ease(pFocus))} />
              ) : null}
            </g>
          );
        })}

        {/* What changed after the decisive moment: the axis beyond it
            becomes the accent, so "after" is visibly a different regime. */}
        {pCons > 0 && focusYear != null ? (
          <line
            x1={xFor(focusYear)} y1={axisY}
            x2={xFor(focusYear) + (x0 + w - xFor(focusYear)) * ease(pCons)} y2={axisY}
            stroke={colors.accent} strokeWidth={5}
          />
        ) : null}
      </svg>

      {years.map((y, i) => {
        const a = ease(Math.max(0, Math.min(1, pEvents * years.length - i)));
        if (a <= 0.01) return null;
        const isFocus = y === focusYear && pFocus > 0;
        const stemH = 92 + (i % 2) * 44;
        return (
          <Label key={y} x={xFor(y)} y={axisY - stemH - 40} text={String(y)}
            color={isFocus ? colors.accent : colors.textDim}
            size={isFocus ? 46 : 34} weight={800} tracking={1} align="center"
            opacity={a * (pFocus > 0 && !isFocus ? 0.5 : 1)} fontFamily={fontFamily} mono />
        );
      })}

      {/* Axis endpoints, but only where they are NOT already an event label.
          With two dated events the span ends exactly on them, and drawing
          both put "1998" on screen twice — the same fact stated twice, which
          is the duplication ENC-29 exists to prevent in the caption stream. */}
      {years.includes(span.lo) ? null : (
        <Label x={x0} y={axisY + 26} text={String(span.lo)} color={colors.textDim} size={22} tracking={2} opacity={pAxis} fontFamily={fontFamily} mono />
      )}
      {years.includes(span.hi) ? null : (
        <Label x={x0 + w} y={axisY + 26} text={String(span.hi)} color={colors.textDim} size={22} tracking={2} align="right" opacity={pAxis} fontFamily={fontFamily} mono />
      )}

      {pCons > 0 && focusYear != null ? (
        <Label x={(xFor(focusYear) + x0 + w) / 2} y={axisY + 62} text="AFTER"
          color={colors.accent} size={24} tracking={3} align="center" opacity={pCons} fontFamily={fontFamily} />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESS — stages something actually moves through.
// ─────────────────────────────────────────────────────────────────────────────
export function ProcessScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const sup = (beat.visualPlan && beat.visualPlan.supporting) || {};
  const n = Math.max(2, Math.min(6, Math.round(sup.stages || 3)));

  const pStages = useStateProgress(states, "stages");
  const pAdvance = progressOf(states, "advance", frame);
  const pArrive = useStateProgress(states, "arrive");

  // COMPOSITION VARIANT (PART 13). Two PROCESS beats in one script drew the
  // identical left-to-right chain of boxes. A process read top-to-bottom is
  // the same idea in a genuinely different composition — and with six
  // stages it is the more legible one, because a vertical chain has room
  // for a stage label beside each box instead of cramped underneath it.
  const vertical = variantOf(beat) === 1;

  const boxW = vertical ? 300 : 168;
  const boxH = vertical ? 96 : 168;
  const gap = vertical ? 34 : 40;
  const span = n * (vertical ? boxH : boxW) + (n - 1) * gap;
  // Along-axis origin, then the fixed cross-axis position.
  const a0 = vertical ? 700 - span / 2 : STAGE_CX - span / 2;
  const cross = vertical ? STAGE_CX - boxW / 2 - 90 : 660;

  const boxAt = (i) => (vertical
    ? { x: cross, y: a0 + i * (boxH + gap) }
    : { x: a0 + i * (boxW + gap), y: cross });

  // The token's position along the chain — this is the "something moves
  // through" that makes it a process rather than a list of boxes.
  const tokenT = ease(pAdvance, EASE_IN_OUT) * n;
  const tokenStage = Math.min(Math.floor(tokenT), n - 1);
  const withinStage = tokenT - tokenStage;
  const step = (vertical ? boxH : boxW) + gap;
  const along = a0 + tokenStage * step + (vertical ? boxH : boxW) / 2 + withinStage * step;
  const tokenX = vertical ? cross + boxW / 2 : along;
  const tokenY = vertical ? along : cross + boxH / 2;
  const endX = vertical ? cross + boxW / 2 : a0 + span - boxW / 2;
  const endY = vertical ? a0 + span - boxH / 2 : cross + boxH / 2;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {Array.from({ length: n }).map((_, i) => {
          const a = ease(Math.max(0, Math.min(1, pStages * n - i * 0.7)));
          const done = tokenT > i + 0.85;
          const active = tokenStage === i && pAdvance > 0 && !done;
          const b = boxAt(i);
          return (
            <g key={i} opacity={a}>
              <rect x={b.x} y={b.y} width={boxW} height={boxH} rx={4}
                fill="none"
                stroke={active || done ? colors.accent : colors.stroke}
                strokeWidth={active ? 4 : 2.5} />
              {/* Fill shows the stage has been completed — real state change */}
              {done ? (
                <rect x={b.x} y={b.y} width={boxW} height={boxH} rx={4}
                  fill={colors.accent} opacity={0.13} />
              ) : null}
            </g>
          );
        })}

        {/* Connectors between stages, arrowheads pointing along the axis */}
        {Array.from({ length: n - 1 }).map((_, i) => {
          const b = boxAt(i);
          const a = ease(Math.max(0, Math.min(1, pStages * n - i * 0.7 - 0.4)));
          const passed = tokenT > i + 1;
          const col = passed ? colors.accent : colors.stroke;
          const x1 = vertical ? b.x + boxW / 2 : b.x + boxW;
          const y1 = vertical ? b.y + boxH : b.y + boxH / 2;
          const x2 = vertical ? x1 : x1 + gap;
          const y2 = vertical ? y1 + gap : y1;
          const head = vertical
            ? `${x2 - 6},${y2 - 9} ${x2 + 6},${y2 - 9} ${x2},${y2}`
            : `${x2 - 9},${y2 - 6} ${x2 - 9},${y2 + 6} ${x2},${y2}`;
          return (
            <g key={`c${i}`} opacity={a}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={passed ? 3 : 2} />
              <polygon points={head} fill={col} />
            </g>
          );
        })}

        {/* The travelling token */}
        {pAdvance > 0 ? (
          <circle cx={tokenX} cy={tokenY} r={14} fill={colors.accent} />
        ) : null}
        {pArrive > 0 ? (
          <circle cx={endX} cy={endY} r={14 + 26 * ease(pArrive)}
            fill="none" stroke={colors.accent} strokeWidth={2.5} opacity={0.7 * (1 - ease(pArrive))} />
        ) : null}
      </svg>

      {Array.from({ length: n }).map((_, i) => {
        const a = ease(Math.max(0, Math.min(1, pStages * n - i * 0.7)));
        const b = boxAt(i);
        return (
          <Label
            key={i}
            x={vertical ? b.x + boxW + 24 : b.x + boxW / 2}
            y={vertical ? b.y + boxH / 2 - 12 : b.y + boxH + 22}
            text={`STAGE ${i + 1}`}
            color={tokenT > i + 0.85 ? colors.accent : colors.textDim}
            size={24} tracking={2.4} align={vertical ? "left" : "center"}
            opacity={a} fontFamily={fontFamily} />
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CAUSE_EFFECT — one thing driving another, with the link made visible.
// Vertical, so it reads as "this produces that" rather than "these two".
// ─────────────────────────────────────────────────────────────────────────────
export function CauseEffectScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const sup = (beat.visualPlan && beat.visualPlan.supporting) || {};

  const causeText = keyPhrase(sup.cause, 3) || keyPhrase(beat.text, 3);
  const effectText = keyPhrase(sup.effect, 3) || "";
  const marker = String(sup.marker || "").toUpperCase().trim();

  const pCause = useStateProgress(states, "cause");
  const pLink = progressOf(states, "link", frame);
  const pEffect = useStateProgress(states, "effect");
  const pSettle = useStateProgress(states, "settle");

  const boxW = 470, boxH = 132;
  const x = STAGE_CX - boxW / 2;
  const yCause = 500, yEffect = 880;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <rect x={x} y={yCause} width={boxW} height={boxH} rx={4}
          fill="none" stroke={colors.stroke} strokeWidth={2.5} opacity={ease(pCause)} />

        {/* The link is the point of this scene: it DRAWS, downward, and the
            effect cannot appear before it arrives. */}
        {pLink > 0 ? (
          <>
            <line x1={STAGE_CX} y1={yCause + boxH}
              x2={STAGE_CX} y2={yCause + boxH + (yEffect - yCause - boxH) * ease(pLink, EASE_IN_OUT)}
              stroke={colors.accent} strokeWidth={4} />
            {ease(pLink) > 0.9 ? (
              <polygon
                points={`${STAGE_CX - 11},${yEffect - 16} ${STAGE_CX + 11},${yEffect - 16} ${STAGE_CX},${yEffect - 2}`}
                fill={colors.accent} />
            ) : null}
          </>
        ) : null}

        {pEffect > 0 ? (
          <rect x={x} y={yEffect} width={boxW} height={boxH} rx={4}
            fill={colors.accent} fillOpacity={0.12 * ease(pEffect)}
            stroke={colors.accent} strokeWidth={3} opacity={ease(pEffect)} />
        ) : null}

        {/* Both readable at once at the end — the whole relationship */}
        {pSettle > 0 ? (
          <rect x={x - 22} y={yCause - 22} width={boxW + 44} height={yEffect + boxH - yCause + 44} rx={6}
            fill="none" stroke={colors.stroke} strokeWidth={1} strokeDasharray="8 10" opacity={0.4 * ease(pSettle)} />
        ) : null}
      </svg>

      <Label x={STAGE_CX} y={yCause + boxH / 2 - 18} text={short(causeText, 24)}
        color={colors.textPrimary} size={38} weight={800} tracking={1} align="center"
        opacity={pCause} fontFamily={fontFamily} />
      {marker ? (
        <Label x={STAGE_CX + boxW / 2 + 26} y={(yCause + boxH + yEffect) / 2 - 14}
          text={short(marker, 14)} color={colors.accent} size={24} tracking={2.4}
          opacity={pLink} fontFamily={fontFamily} />
      ) : null}
      {effectText ? (
        <Label x={STAGE_CX} y={yEffect + boxH / 2 - 18} text={short(effectText, 24)}
          color={colors.accent} size={38} weight={800} tracking={1} align="center"
          opacity={pEffect} fontFamily={fontFamily} />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONSHIP — several entities and how they connect. Radial, not linear.
// ─────────────────────────────────────────────────────────────────────────────
export function RelationshipScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];

  const pNodes = progressOf(states, "nodes", frame);
  const pLinks = progressOf(states, "links", frame);
  const pWeight = useStateProgress(states, "weight");

  // Entities named in the beat itself; falls back to an abstract 4-node
  // graph when the text doesn't name enough of them.
  const words = String(beat.text || "")
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w.toLowerCase()));
  const labels = [...new Set(words)].slice(0, 5);
  const n = Math.max(3, Math.min(5, labels.length || 4));

  const cx = STAGE_CX, cy = 730, R = 240;

  const nodes = Array.from({ length: n }).map((_, i) => {
    const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(ang) * R, y: cy + Math.sin(ang) * R * 0.86, label: labels[i] || "" };
  });

  // Link every pair; the strongest (first-to-second) is emphasized later.
  const links = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) links.push([i, j]);
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {links.map(([i, j], k) => {
          const a = ease(Math.max(0, Math.min(1, pLinks * links.length - k * 0.6)));
          if (a <= 0.01) return null;
          const strongest = k === 0 && pWeight > 0;
          const A = nodes[i], B = nodes[j];
          return (
            <line key={k}
              x1={A.x} y1={A.y}
              x2={A.x + (B.x - A.x) * a} y2={A.y + (B.y - A.y) * a}
              stroke={strongest ? colors.accent : colors.stroke}
              strokeWidth={strongest ? 4 : 1.8}
              opacity={pWeight > 0 && !strongest ? 0.3 : 0.85} />
          );
        })}
        {nodes.map((nd, i) => {
          const a = ease(Math.max(0, Math.min(1, pNodes * n - i * 0.6)));
          if (a <= 0.01) return null;
          return (
            <circle key={i} cx={nd.x} cy={nd.y} r={16 * a}
              fill={colors.bg} stroke={colors.accent} strokeWidth={3} />
          );
        })}
      </svg>
      {nodes.map((nd, i) => {
        const a = ease(Math.max(0, Math.min(1, pNodes * n - i * 0.6)));
        if (a <= 0.01 || !nd.label) return null;
        const below = nd.y > cy;
        return (
          <Label key={i} x={nd.x} y={nd.y + (below ? 30 : -56)} text={short(nd.label.toUpperCase(), 14)}
            color={colors.textDim} size={26} tracking={1.8} align="center" opacity={a} fontFamily={fontFamily} />
        );
      })}
    </div>
  );
}
