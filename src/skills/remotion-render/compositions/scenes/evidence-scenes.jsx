import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import {
  CANVAS_W, CANVAS_H, Label, ease, seeded, variantOf,
  useStateProgress, EASE_OUT, EASE_IN_OUT,
} from "./primitives.jsx";
import { DOCUMENT_PAGES, documentPageGeometry } from "../layout-constants.js";
import { progressOf, reached } from "../../visual/states.js";
import { shotFrame } from "./stage.jsx";


/**
 * Evidence scenes — showing the THING, not a symbol standing in for it.
 *
 *   the actual rule / record       DocumentEvidenceScene
 *   a real sourced photograph      ImageEvidenceScene
 *   the system's own screen        InterfaceSimulationScene
 *   the same frame, two states     BeforeAfterScene
 *
 * PART 14 is why ImageEvidenceScene takes a semantic ROLE rather than just
 * a path: a photo shown without a reason is screen-filler. The role is
 * rendered as a small caption so the viewer knows what they are looking at
 * and why it is on screen.
 */


// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT_EVIDENCE — the page, then the clause that actually matters.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Page geometry lives in ../layout-constants.js, a pure .js module, so the
 * safe-rect test can import and exercise the REAL function instead of
 * re-deriving a second copy of the same maths that drifts out of sync with
 * it. That drift already happened once: the check kept recomputing the page
 * from DOCUMENT_PAGE_TOP and DOCUMENT_PAGES after the scene had started
 * scaling the page to the shot, so it verified numbers the renderer no
 * longer drew and still passed.
 */
export function DocumentEvidenceScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const f = shotFrame((beat.visualPlan && beat.visualPlan.shot) || null);

  const pPage = useStateProgress(states, "page");
  const pScan = progressOf(states, "scan", frame);
  const pFind = useStateProgress(states, "find");
  const pRead = useStateProgress(states, "read");

  // COMPOSITION VARIANT (PART 13). Three DOCUMENT_EVIDENCE beats in one
  // legal script used to draw the identical page, the identical seventeen
  // ruled lines and the identical highlighted line nine. Different
  // documents look different: the variant changes the page proportions, how
  // dense the body copy is, and where in it the operative clause sits.
  // Deterministic from the beat, so a re-render is byte-identical.
  const v = variantOf(beat);
  // GEOMETRY IS CONSTRAINED, not chosen freely. This scene draws the page
  // AND a pulled-out clause 40px below it, and the whole stack now sits
  // 110px lower because captions are off (motion-graphics.jsx
  // CAPTION_RESERVE_Y). Computed against SAFE.bottom = 1248, the first
  // version of these variants put the clause 62-132px OUTSIDE the safe
  // rect on all three; the original single page was inside by 8px, so the
  // drop is what broke it and the variants made it worse.
  //
  // Budget, in pre-drop design space:
  //   top          300   (SAFE.top is 288)
  //   page                <= PAGE_MAX_H
  //   gap           40
  //   clause       100    (two lines at 40px / 1.25)
  //   bottom      1138    (SAFE.bottom - CAPTION_RESERVE_Y)
  // `lead` is then whatever fits `lines` inside the page. TESTED, not
  // eyeballed — see run-visual-tests.js "a document page never draws
  // outside the safe rect".
  const g = documentPageGeometry(v, f);
  const page = DOCUMENT_PAGES[v];
  const { pageW, pageH, px, py, lead } = g;

  // Ruled text lines standing in for body copy. Deliberately abstract —
  // fabricating legal text would be inventing a source, which this repo
  // forbids outright. The REAL words come from the beat's own narration,
  // pulled out at `read`.
  const lines = page.lines;
  const clauseLine = page.clause;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {/* The page itself */}
        <rect x={px} y={py} width={pageW} height={pageH * ease(pPage, EASE_OUT)}
          fill={colors.bg} stroke={colors.stroke} strokeWidth={2.5} />
        {/* Header rule */}
        <line x1={px + 40} y1={py + 62} x2={px + pageW - 40} y2={py + 62}
          stroke={colors.stroke} strokeWidth={2} opacity={ease(pPage)} />

        {Array.from({ length: lines }).map((_, i) => {
          const a = ease(Math.max(0, Math.min(1, pPage * 2.2 - i * 0.06)));
          if (a <= 0.01) return null;
          const y = py + 110 + i * lead;
          const isClause = i === clauseLine;
          const w = (pageW - 80) * (0.62 + seeded(i * 5 + 3 + v * 97) * 0.36);
          return (
            <rect key={i} x={px + 40} y={y} width={w} height={isClause ? 12 : 8} rx={2}
              fill={isClause && pFind > 0 ? colors.accent : colors.stroke}
              opacity={isClause && pFind > 0 ? 1 : pFind > 0 ? 0.22 : 0.5 * a} />
          );
        })}

        {/* Attention moving down the page during `scan` */}
        {pScan > 0 && pFind <= 0 ? (
          <rect x={px + 24} y={py + 96 + (pageH - 200) * ease(pScan, EASE_IN_OUT)} width={pageW - 48} height={40}
            fill="none" stroke={colors.accent} strokeWidth={2} opacity={0.75} />
        ) : null}

        {/* The clause, located */}
        {pFind > 0 ? (
          <rect x={px + 28} y={py + 110 + clauseLine * lead - 14} width={(pageW - 56) * ease(pFind)} height={40}
            fill="none" stroke={colors.accent} strokeWidth={3} />
        ) : null}
      </svg>

      {/* The operative words, pulled out legible. These are the beat's own
          real narration, never invented document text. */}
      {pRead > 0 ? (
        <div style={{
          position: "absolute", left: g.clause.x, top: g.clause.y, width: g.clause.w,
          opacity: ease(pRead), transform: `translateY(${(1 - ease(pRead)) * 14}px)`,
        }}>
          <div style={{
            borderLeft: `4px solid ${colors.accent}`, paddingLeft: 20,
            color: colors.textPrimary, fontFamily, fontWeight: 700, fontSize: 40, lineHeight: 1.25,
          }}>
            {(beat.visualPlan && beat.visualPlan.supporting.phrase) || ""}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE_EVIDENCE — a real sourced photo, shown for a stated reason (PART 14).
// ─────────────────────────────────────────────────────────────────────────────
export function ImageEvidenceScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const f = shotFrame((beat.visualPlan && beat.visualPlan.shot) || null);
  const plan = beat.visualPlan || {};
  const asset = (plan.payload && plan.payload.asset) || (beat.scene && beat.scene.image ? { path: beat.scene.image } : null);
  if (!asset || !asset.path) return null;

  const pReveal = useStateProgress(states, "reveal");
  const pRole = useStateProgress(states, "role");
  const pHold = progressOf(states, "hold", frame);

  // Slow move across the subject — motion that says "look at this", the one
  // kind of ambient movement PART 17 still allows because it aids reading.
  const scale = 1.06 - 0.05 * ease(pHold, EASE_IN_OUT);
  const role = String(plan.assetRole || (asset.role || "")).toUpperCase();

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div style={{
        position: "absolute", left: f.x, top: f.y, width: f.w, height: f.h,
        overflow: "hidden", opacity: ease(pReveal),
      }}>
        <Img
          src={asset.path.startsWith("http") ? asset.path : staticFile(asset.path)}
          style={{
            width: "100%", height: "100%",
            objectFit: asset.treatment === "cutout" ? "contain" : "cover",
            transform: `scale(${scale})`,
          }}
        />
      </div>
      {/* What this is evidence OF — the semantic role, not decoration. */}
      {pRole > 0 && role ? (
        <div style={{
          position: "absolute", left: 48, top: 1176, opacity: ease(pRole),
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ width: 28, height: 3, background: colors.accent }} />
          <Label x={0} y={-13} text={role} color={colors.accent} size={24} tracking={3} fontFamily={fontFamily} />
        </div>
      ) : null}
      {asset.credit ? (
        <Label x={1056} y={1180} text={String(asset.credit).slice(0, 60)} color={colors.textDim}
          size={16} tracking={0.6} align="right" opacity={0.7 * ease(pReveal)} fontFamily={fontFamily} />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACE_SIMULATION — the system's own screen doing the thing described.
// ─────────────────────────────────────────────────────────────────────────────
export function InterfaceSimulationScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const f = shotFrame((beat.visualPlan && beat.visualPlan.shot) || null);

  const pChrome = useStateProgress(states, "chrome");
  const pInput = useStateProgress(states, "input");
  const pWork = progressOf(states, "work", frame);
  const pResult = useStateProgress(states, "result");

  const w = 720, h = 520;
  const x = f.cx - w / 2, y = f.cy - f.h * 0.3;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {/* Window chrome */}
        <rect x={x} y={y} width={w} height={h * ease(pChrome, EASE_OUT)} rx={6}
          fill="none" stroke={colors.stroke} strokeWidth={2.5} />
        <line x1={x} y1={y + 52} x2={x + w} y2={y + 52} stroke={colors.stroke} strokeWidth={2} opacity={ease(pChrome)} />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={x + 26 + i * 24} cy={y + 26} r={6}
            fill="none" stroke={colors.stroke} strokeWidth={1.8} opacity={ease(pChrome)} />
        ))}

        {/* The request entering */}
        {pInput > 0 ? (
          <>
            <rect x={x + 32} y={y + 90} width={(w - 64) * ease(pInput)} height={54} rx={4}
              fill="none" stroke={colors.accent} strokeWidth={2.5} />
            <line x1={x + 48} y1={y + 117} x2={x + 48 + 180 * ease(pInput)} y2={y + 117}
              stroke={colors.accent} strokeWidth={3} />
          </>
        ) : null}

        {/* The system visibly working — a real progress bar tied to state */}
        {pWork > 0 ? (
          <>
            <rect x={x + 32} y={y + 186} width={w - 64} height={10} rx={5}
              fill="none" stroke={colors.stroke} strokeWidth={1.5} />
            <rect x={x + 32} y={y + 186} width={(w - 64) * ease(pWork, EASE_IN_OUT)} height={10} rx={5}
              fill={colors.accent} />
          </>
        ) : null}

        {/* Result rows landing */}
        {pResult > 0
          ? Array.from({ length: 4 }).map((_, i) => {
              const a = ease(Math.max(0, Math.min(1, pResult * 4 - i)));
              if (a <= 0.01) return null;
              const ry = y + 240 + i * 62;
              return (
                <g key={i} opacity={a}>
                  <rect x={x + 32} y={ry} width={w - 64} height={46} rx={4}
                    fill={i === 0 ? colors.accent : "none"} fillOpacity={i === 0 ? 0.14 : 0}
                    stroke={i === 0 ? colors.accent : colors.stroke} strokeWidth={i === 0 ? 2.5 : 1.5} />
                  <rect x={x + 50} y={ry + 18} width={(w - 200) * (0.5 + seeded(i * 9 + 1) * 0.45)} height={9} rx={2}
                    fill={i === 0 ? colors.accent : colors.stroke} opacity={i === 0 ? 1 : 0.5} />
                </g>
              );
            })
          : null}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BEFORE_AFTER — the same frame under two conditions, joined by a real wipe.
// ─────────────────────────────────────────────────────────────────────────────
export function BeforeAfterScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const f = shotFrame((beat.visualPlan && beat.visualPlan.shot) || null);

  const pBefore = useStateProgress(states, "before");
  const pWipe = progressOf(states, "wipe", frame);
  const pAfter = useStateProgress(states, "after");
  const pCompare = useStateProgress(states, "compare");

  const x = 108, y = 470, w = 864, h = 560;
  const wipeX = x + w * ease(pWipe, EASE_IN_OUT);

  // Two different structural states of the same field: sparse vs dense.
  const cells = 40;
  const cols = 8;
  const cw = w / cols, ch = h / (cells / cols);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <rect x={x} y={y} width={w} height={h} fill="none" stroke={colors.stroke} strokeWidth={2} opacity={ease(pBefore)} />

        {Array.from({ length: cells }).map((_, i) => {
          const r = Math.floor(i / cols), c = i % cols;
          const cxp = x + c * cw + cw / 2;
          const cyp = y + r * ch + ch / 2;
          const isAfterSide = cxp < wipeX && pWipe > 0;
          const beforeOn = seeded(i * 3 + 1) > 0.62;
          const afterOn = seeded(i * 3 + 1) > 0.2;
          const on = isAfterSide ? afterOn : beforeOn;
          const a = ease(Math.max(0, Math.min(1, (isAfterSide ? pAfter + 0.4 : pBefore) * 2 - i * 0.012)));
          if (!on || a <= 0.02) return null;
          return (
            <rect key={i} x={cxp - cw * 0.32} y={cyp - ch * 0.3} width={cw * 0.64} height={ch * 0.6} rx={3}
              fill={isAfterSide ? colors.accent : "none"}
              stroke={isAfterSide ? colors.accent : colors.stroke}
              strokeWidth={2} opacity={a} />
          );
        })}

        {pWipe > 0 && ease(pWipe) < 1 ? (
          <line x1={wipeX} y1={y} x2={wipeX} y2={y + h} stroke={colors.accent} strokeWidth={4} />
        ) : null}
        {pCompare > 0 ? (
          <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h}
            stroke={colors.stroke} strokeWidth={1.5} strokeDasharray="8 8" opacity={0.5 * ease(pCompare)} />
        ) : null}
      </svg>

      <Label x={x} y={y + h + 20} text="BEFORE" color={colors.textDim} size={26} tracking={3}
        opacity={pBefore * (pAfter > 0 ? 0.6 : 1)} fontFamily={fontFamily} />
      <Label x={x + w} y={y + h + 20} text="AFTER" color={colors.accent} size={26} tracking={3}
        align="right" opacity={pAfter} fontFamily={fontFamily} />
    </div>
  );
}
