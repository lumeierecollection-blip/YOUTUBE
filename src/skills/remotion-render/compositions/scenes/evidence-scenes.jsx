import React from "react";
import { staticFile, useCurrentFrame } from "remotion";
import { PhotoTreatment } from "../../effects/PhotoTreatment.jsx";
import {
  CANVAS_W, CANVAS_H, Label, ease, seeded, variantOf,
  useStateProgress, EASE_IN_OUT,
} from "./primitives.jsx";
import { DOCUMENT_PAGES, documentPageGeometry } from "../layout-constants.js";
import { MG_TYPE as TYPE } from "../beats.js";
import { progressOf } from "../../visual/states.js";
import { shotFrame } from "./stage.jsx";
import { DocumentSheet } from "./elements/document.jsx";
import { WindowChrome, NavRail, StatusBar } from "./elements/interface.jsx";
import { ContentVessel } from "./elements/transform.jsx";


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
        {/* The page, as a constructed object — depth, a folded corner, a
            letterhead region, body rhythm, a margin annotation and a page
            number, not a bordered rectangle with ruled bars (see
            elements/document.jsx). The safe-rect budget this geometry was
            tuned against (documentPageGeometry) is unchanged; the sheet's
            depth shadow is a small +6/+8px offset, not new page footprint. */}
        <DocumentSheet
          px={px} py={py} pageW={pageW} pageH={pageH} lines={lines} clauseLine={clauseLine}
          lead={lead} variant={v} pPage={pPage} pScan={pScan} pFind={pFind} colors={colors}
        />
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
            color: colors.textPrimary, fontFamily, fontWeight: 700, fontSize: TYPE.support, lineHeight: 1.25,
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
        {/* Real photo treatment (effects/PhotoTreatment.jsx), not a bare
            <Img>. Ported from the now-deleted legacy ImageBeatScene
            (CHECK-REGISTER §3.12.11/§3.12.12) rather than left stranded
            there — a vignette, print-halftone grain, chromatic aberration
            and a real 3D LUT is what makes a sourced photo read as
            EVIDENCE (this repo's own material handled) instead of a raw
            web image sitting in a box. The scale animation moves the
            outer wrapper; PhotoTreatment itself renders at a fixed size
            (its internal orthographic camera is derived from width/height
            once), same technique any other DOM element uses for a push-in. */}
        <div style={{ width: "100%", height: "100%", transform: `scale(${scale})` }}>
          {/* ThreeCanvas demands INTEGER width/height — shotFrame()'s w/h
              are coverage-derived floats (a real render caught this:
              "the height prop... must be an integer, but is 927.36"). */}
          <PhotoTreatment
            src={asset.path.startsWith("http") ? asset.path : staticFile(asset.path)}
            treatment={asset.treatment === "cutout" ? "cutout" : "fullbleed"}
            width={Math.round(f.w)}
            height={Math.round(f.h)}
          />
        </div>
      </div>
      {/* What this is evidence OF — the semantic role, not decoration. */}
      {pRole > 0 && role ? (
        <div style={{ position: "absolute", left: 48, top: 1176, opacity: ease(pRole) }}>
          <div style={{ position: "absolute", left: 0, top: 2, width: 28, height: 3, background: colors.accent }} />
          <Label x={40} y={-13} text={role} color={colors.accent} size={24} tracking={3} fontFamily={fontFamily} />
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

  /**
   * REBUILT (visual-system-reset PART 19): window chrome + three loose
   * rectangles is a diagram OF a UI, not a UI. A real windowed application
   * has a navigation rail beside its content and a status strip under it —
   * regions, not just a title bar and a content blob. No product identity
   * is invented (still `dataNeeds: []`, still abstract per PART 23); this
   * is the same abstraction with the actual regions an interface has.
   */
  const w = 760, h = 560;
  const x = f.cx - w / 2, y = f.cy - f.h * 0.3;
  const navW = 84;
  const contentX = x + navW;
  const contentW = w - navW;

  // The words this scene is allowed to draw, decided by the director from
  // the beat's own narration and counted against the 8-word budget there
  // (visual/text-budget.js). The scene does not extract or invent any text
  // of its own — it only places what it was given.
  const sup = (beat.visualPlan && beat.visualPlan.supporting) || {};
  // Once per same-strategy run (mg-package.js runLast), not on every 2.5s
  // beat of the sentence that produced it.
  const resultLabel = beat.visualPlan && beat.visualPlan.runLast ? sup.phrase || "" : "";
  // The request being submitted. Falls back to a neutral field marker
  // rather than a made-up query string.
  const queryLabel = sup.subject || "QUERY";

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <WindowChrome x={x} y={y} w={w} h={h} colors={colors} progress={pChrome} />
        <NavRail x={x} y={y + 52} w={navW} h={h - 52} colors={colors} progress={pChrome} active={pResult > 0 ? 1 : 0} />

        {/* The request entering — inside the content region, not spanning
            the whole window (the nav rail is part of the window, not part
            of what the request travels through). */}
        {pInput > 0 ? (
          <>
            <rect x={contentX + 24} y={y + 90} width={(contentW - 48) * ease(pInput)} height={54} rx={4}
              fill={colors.accent} fillOpacity={0.1} stroke={colors.accent} strokeWidth={2.5} />
            <line x1={contentX + 40} y1={y + 117} x2={contentX + 40 + 180 * ease(pInput)} y2={y + 117}
              stroke={colors.accent} strokeWidth={3} />
          </>
        ) : null}

        {/* The system visibly working — a real progress bar tied to state */}
        {pWork > 0 ? (
          <>
            <rect x={contentX + 24} y={y + 186} width={contentW - 48} height={10} rx={5}
              fill="none" stroke={colors.stroke} strokeWidth={1.5} />
            <rect x={contentX + 24} y={y + 186} width={(contentW - 48) * ease(pWork, EASE_IN_OUT)} height={10} rx={5}
              fill={colors.accent} />
          </>
        ) : null}

        {/* Result rows landing.
 *
 * THE GREEKED BARS ARE GONE. Each row used to carry a grey rectangle of
 * pseudo-random width (`seeded(i * 9 + 1)`) standing in for text — lorem
 * ipsum drawn as geometry. On a rendered frame (qa/critic/before,
 * INTERFACE_SIMULATION result f512) that is the single most obviously
 * machine-made thing in the whole video: a window full of grey bars is
 * what a placeholder looks like, and no amount of animation on top of it
 * reads as real.
 *
 * The top row now carries the line's actual words instead (drawn below
 * this svg, since Label is HTML). The remaining rows keep their frames
 * but hold NOTHING: the narration says a ranked list came back, it does
 * not say what was in it, and filling those rows with invented titles is
 * exactly the fabrication this repo forbids. An empty row is honest about
 * being structure; a fake row is not.
 */}
        {pResult > 0
          ? Array.from({ length: 4 }).map((_, i) => {
              const a = ease(Math.max(0, Math.min(1, pResult * 4 - i)));
              if (a <= 0.01) return null;
              const ry = y + 240 + i * 62;
              return (
                <g key={i} opacity={a}>
                  <rect x={contentX + 24} y={ry} width={contentW - 48} height={46} rx={4}
                    fill={i === 0 ? colors.accent : colors.stroke} fillOpacity={i === 0 ? 0.14 : 0.05}
                    stroke={i === 0 ? colors.accent : colors.stroke} strokeWidth={i === 0 ? 2.5 : 1.5} />
                  {/* Rank position — a real ordinal, which a ranked list has. */}
                  <text x={contentX + 44} y={ry + 31} fill={i === 0 ? colors.accent : colors.stroke}
                    opacity={i === 0 ? 1 : 0.55} fontFamily={fontFamily} fontSize={TYPE.label} fontWeight={700}>
                    {i + 1}
                  </text>
                </g>
              );
            })
          : null}

        <StatusBar x={x} y={y + h - 26} w={w} colors={colors} progress={pChrome} active={pWork > 0 && pResult <= 0} />
      </svg>

      {/* TYPOGRAPHY INSIDE THE PICTURE, not in a band above or below it.
          aesthetic-rules C3: text that belongs to an object lives with the
          object. These sit in the interface's own regions — the query in
          its field, the result in the row that landed — so the words and
          the thing they describe are read in one look, which is what a
          separate headline zone can never do.

          Q11's floor for auxiliary text is 32px; both are at or above it,
          unlike the 26px numerals this scene used to rely on. */}
      {pInput > 0 ? (
        <Label
          x={contentX + 42} y={y + 100}
          text={queryLabel}
          color={colors.accent} size={TYPE.support} weight={700} tracking={1.5}
          opacity={ease(Math.min(1, pInput * 1.4))}
          fontFamily={fontFamily} halo={colors.bg}
        />
      ) : null}
      {pResult > 0 && resultLabel ? (
        <Label
          x={contentX + 78} y={y + 250}
          text={resultLabel}
          color={colors.textPrimary} size={TYPE.support} weight={800} tracking={1}
          opacity={ease(Math.min(1, pResult * 3))}
          fontFamily={fontFamily} halo={colors.bg}
        />
      ) : null}
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
        {/* A bounded vessel holding the field — one object whose CONTENTS
            change (visual-system-reset PART 14), not an unbounded grid of
            independent cells with nothing holding them. WAS fill="none",
            the same invisible-container defect fixed elsewhere. */}
        <ContentVessel x={x} y={y} w={w} h={h} colors={colors} progress={pBefore} />

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
