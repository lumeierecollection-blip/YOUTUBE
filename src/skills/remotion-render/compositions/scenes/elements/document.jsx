import React from "react";
import { ease, seeded } from "../primitives.jsx";

/**
 * DocumentSheet — a constructed page, not a rectangle with random lines.
 *
 * Internal structure (visual-system-reset PART 9's own list for DOCUMENT):
 * paper body + shadow (depth), a folded corner (a page has an edge, not
 * just four corners), a letterhead/header region distinct from body copy,
 * body text rhythm, a highlighted passage, a margin annotation mark next
 * to it, and a page number. None of this is factual content — it is page
 * FURNITURE, the physical construction of a document, which is exactly
 * what PART 18 asks for and what the previous version (a bordered rect
 * plus flat ruled bars) did not have.
 *
 * Real content stays exactly as strict as before: `lines`/`clauseLine`
 * come from the caller's own page-geometry module, and the only actual
 * WORDS drawn anywhere are the beat's real pulled quote — this component
 * draws no text of its own beyond a page number.
 */
export function DocumentSheet({
  px, py, pageW, pageH, lines, clauseLine, lead, variant = 0,
  pPage, pScan, pFind, colors,
}) {
  const eDraw = ease(pPage);
  const drawnH = pageH * eDraw;
  const foldSize = Math.min(56, pageW * 0.09);

  return (
    <>
      {/* Depth: a second sheet sitting slightly behind and below, the way
          a real page in a stack casts a sibling's edge into view. This is
          what makes it a PAGE rather than a rectangle floating in the void. */}
      <rect x={px + 6} y={py + 8} width={pageW} height={drawnH}
        fill={colors.stroke} fillOpacity={0.04} stroke={colors.stroke} strokeWidth={1.5} strokeOpacity={0.3} />

      {/* The sheet itself. */}
      <rect x={px} y={py} width={pageW} height={drawnH}
        fill={colors.stroke} fillOpacity={0.07} stroke={colors.stroke} strokeWidth={2.5} />

      {/* The folded corner — a page has an edge you can lift, a rectangle
          does not. Cut from the sheet (a background-coloured triangle)
          with its own crease line, so it reads as paper curling rather
          than a decorative wedge glued on top. */}
      {eDraw > 0.4 ? (
        <g opacity={ease(Math.max(0, Math.min(1, (pPage - 0.4) * 1.8)))}>
          <path
            d={`M ${px + pageW - foldSize} ${py} L ${px + pageW} ${py} L ${px + pageW} ${py + foldSize} Z`}
            fill={colors.bg} stroke={colors.stroke} strokeWidth={2} />
          <line x1={px + pageW - foldSize} y1={py} x2={px + pageW} y2={py + foldSize}
            stroke={colors.stroke} strokeWidth={1.5} opacity={0.5} />
        </g>
      ) : null}

      {/* Letterhead: a header region distinct from body rhythm — a short
          double rule near the top, not just one line indistinguishable
          from a text row. */}
      <line x1={px + 40} y1={py + 56} x2={px + pageW - 40} y2={py + 56}
        stroke={colors.stroke} strokeWidth={2.5} opacity={eDraw} />
      <line x1={px + 40} y1={py + 66} x2={px + pageW * 0.42} y2={py + 66}
        stroke={colors.stroke} strokeWidth={1.5} opacity={0.5 * eDraw} />

      {/* Body text rhythm. */}
      {Array.from({ length: lines }).map((_, i) => {
        const a = ease(Math.max(0, Math.min(1, pPage * 2.2 - i * 0.06)));
        if (a <= 0.01) return null;
        const y = py + 112 + i * lead;
        const isClause = i === clauseLine;
        const w = (pageW - 80) * (0.62 + seeded(i * 5 + 3 + variant * 97) * 0.36);
        return (
          <rect key={i} x={px + 40} y={y} width={w} height={isClause ? 12 : 8} rx={2}
            fill={isClause && pFind > 0 ? colors.accent : colors.stroke}
            opacity={isClause && pFind > 0 ? 1 : pFind > 0 ? 0.22 : 0.5 * a} />
        );
      })}

      {/* Attention moving down the page during `scan`. */}
      {pScan > 0 && pFind <= 0 ? (
        <rect x={px + 24} y={py + 98 + (pageH - 200) * ease(pScan)} width={pageW - 48} height={40}
          fill="none" stroke={colors.accent} strokeWidth={2} opacity={0.75} />
      ) : null}

      {/* The clause, located, with a margin annotation beside it — an
          evidence marker (a bracket standing off the page edge), not just
          a highlight box around the line itself. */}
      {pFind > 0 ? (
        <g opacity={ease(pFind)}>
          <rect x={px + 28} y={py + 110 + clauseLine * lead - 14} width={(pageW - 56) * ease(pFind)} height={40}
            fill="none" stroke={colors.accent} strokeWidth={3} />
          <path
            d={`M ${px - 14} ${py + 110 + clauseLine * lead - 16} L ${px - 24} ${py + 110 + clauseLine * lead} L ${px - 14} ${py + 110 + clauseLine * lead + 16}`}
            fill="none" stroke={colors.accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ) : null}

      {/* Page number — a structural mark, not invented content. */}
      <text x={px + pageW - 30} y={py + drawnH - 22} textAnchor="end"
        fill={colors.textDim} opacity={0.45 * eDraw} fontSize={16} fontWeight={700}>
        {variant + 1}
      </text>
    </>
  );
}
