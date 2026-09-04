import React from "react";
import { staticFile, useCurrentFrame } from "remotion";
import { resolveSceneAsset } from "../../visual/asset-shape.js";
import { PhotoTreatment } from "../../effects/PhotoTreatment.jsx";
import {
  CANVAS_W, CANVAS_H, SAFE, Label, ease, seeded, variantOf,
  useStateProgress, useValueProgress, EASE_IN_OUT,
} from "./primitives.jsx";
import { DOCUMENT_PAGES, documentPageGeometry } from "../layout-constants.js";
import { MG_TYPE as TYPE } from "../beats.js";
import { progressOf } from "../../visual/states.js";
import { shotFrame } from "./stage.jsx";
import { DocumentSheet } from "./elements/document.jsx";
import { WindowChrome, NavRail, StatusBar } from "./elements/interface.jsx";
import { CinematicStatementScene } from "./abstract-scenes.jsx";


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
            letterhead region, a margin annotation and a page number, not a
            bordered rectangle with ruled bars. Body copy is deliberately
            blank paper now: the fake grey "body rhythm" rects this used to
            draw (random-width lines standing in for sentences that were
            never real, one pre-highlighted as "the clause" before the real
            one below ever appears) are gone — see elements/document.jsx for
            why. The safe-rect budget this geometry was tuned against
            (documentPageGeometry) is unchanged; the sheet's depth shadow is
            a small +6/+8px offset, not new page footprint. */}
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
  // Shared with run-visual-tests.js on purpose — see visual/asset-shape.js for
  // why these two drifted and why the rule now lives in one place.
  const asset = resolveSceneAsset(plan, beat);
  if (!asset) return null;

  const pReveal = useStateProgress(states, "reveal");
  const pRole = useStateProgress(states, "role");
  const pHold = progressOf(states, "hold", frame);

  // THE PHOTOGRAPH IS THE SCENE, NOT AN EXHIBIT INSIDE ONE.
  //
  // This used to draw the photo into `shotFrame()` — a band capped at
  // CANVAS_H * 0.46, so a real sourced photograph always arrived letterboxed,
  // a rectangular panel with the composition's black above and below it. That
  // framing is right for a diagram subject ("a subject that fills 1920px tall
  // is not composed, it is stretched") and wrong for a photograph, which is
  // not a subject sitting in a world — it IS the world. It now fills the
  // canvas and the camera works inside it.
  //
  // AND THE CAMERA IS NO LONGER ONE MOVE FOR EVERY BEAT. It was a uniform
  // `1.06 - 0.05 * hold` on every image beat without exception: the slow zoom
  // that stands in for "cinematic". Each beat now gets one of four readings of
  // its own photograph, chosen by the beat's seed, and one of them is holding
  // still — stillness has to be reachable or the alternative is just a
  // different universal formula.
  const move = seeded(beat.startFrame || 1);
  const h = ease(pHold, EASE_IN_OUT);
  const camera =
    move < 0.25
      ? { scale: 1.0, x: 0, y: 0, name: "held" }
      : move < 0.5
        ? { scale: 1.0 + 0.14 * h, x: 0, y: 0, name: "push" }
        : move < 0.75
          ? { scale: 1.12, x: (0.5 - h) * 0.10 * CANVAS_W, y: 0, name: "track" }
          : { scale: 1.18 - 0.14 * h, x: 0, y: (h - 0.5) * 0.06 * CANVAS_H, name: "pull-back" };
  const role = String(plan.assetRole || (asset.role || "")).toUpperCase();

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div style={{
        position: "absolute", left: 0, top: 0, width: CANVAS_W, height: CANVAS_H,
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
        <div style={{
          width: "100%", height: "100%",
          transform: `translate(${camera.x.toFixed(1)}px, ${camera.y.toFixed(1)}px) scale(${camera.scale.toFixed(3)})`,
        }}>
          {/* ThreeCanvas demands INTEGER width/height — shotFrame()'s w/h
              are coverage-derived floats (a real render caught this:
              "the height prop... must be an integer, but is 927.36"). */}
          <PhotoTreatment
            src={asset.path.startsWith("http") ? asset.path : staticFile(asset.path)}
            treatment={asset.treatment === "cutout" ? "cutout" : "fullbleed"}
            width={CANVAS_W}
            height={CANVAS_H}
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
  /**
   * THE WINDOW TAKES THE FRAME ITS SHOT GRANTED IT.
   *
   * This was `const w = 760, h = 560` — fixed pixels that ignored
   * `shotFrame` entirely. INTERFACE_SIMULATION is framed CLOSE (coverage
   * 0.86), which on a 1080x1920 frame grants 929x760; the scene drew 66%
   * of that area and left the rest black. Measured across the anchor set
   * it was the last scene still stuck at 1.8-3.5% ink with a bbox pinned
   * at 70x29% while every other scene had moved into 6-13%.
   *
   * composition.js calls `coverage` "the direct answer to the 0.2%-ink
   * measurement", so a scene that hardcodes its own size is not just
   * smaller than intended — it opts out of the mechanism that exists to
   * stop frames reading as diagrams floating in a void.
   *
   * Clamped to the safe rect rather than taken raw: centred on the CLOSE
   * anchor (0.48), the full granted width would put the window's left edge
   * at x=54 against a 9% safe edge of 97.
   */
  const safeHalf = Math.min(f.cx - CANVAS_W * 0.09, CANVAS_W * 0.91 - f.cx);
  const w = Math.min(f.w, safeHalf * 2);
  const h = f.h;
  const x = f.cx - w / 2, y = f.cy - f.h * 0.3;
  // The interior rhythm was tuned against 760x560. Scale it with the
  // window instead of restating every offset, so a bigger window is the
  // same design at size rather than the old layout stranded in the top
  // corner of a larger box.
  const sx = w / 760, sy = h / 560;
  const navW = 84 * sx;
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
        <NavRail x={x} y={y + 52 * sy} w={navW} h={h - 52 * sy} colors={colors} progress={pChrome} active={pResult > 0 ? 1 : 0} />

        {/* The request entering — inside the content region, not spanning
            the whole window (the nav rail is part of the window, not part
            of what the request travels through). */}
        {pInput > 0 ? (
          <>
            <rect x={contentX + 24 * sx} y={y + 90 * sy} width={(contentW - 48 * sx) * ease(pInput)} height={54 * sy} rx={4}
              fill={colors.accent} fillOpacity={0.1} stroke={colors.accent} strokeWidth={2.5} />
            <line x1={contentX + 40 * sx} y1={y + 117 * sy} x2={contentX + (40 + 180 * ease(pInput)) * sx} y2={y + 117 * sy}
              stroke={colors.accent} strokeWidth={3} />
          </>
        ) : null}

        {/* The system visibly working — a real progress bar tied to state */}
        {pWork > 0 ? (
          <>
            <rect x={contentX + 24 * sx} y={y + 186 * sy} width={contentW - 48 * sx} height={10 * sy} rx={5}
              fill="none" stroke={colors.stroke} strokeWidth={1.5} />
            <rect x={contentX + 24 * sx} y={y + 186 * sy} width={(contentW - 48 * sx) * ease(pWork, EASE_IN_OUT)} height={10 * sy} rx={5}
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
              const ry = y + (240 + i * 62) * sy;
              return (
                <g key={i} opacity={a}>
                  <rect x={contentX + 24 * sx} y={ry} width={contentW - 48 * sx} height={46 * sy} rx={4}
                    fill={i === 0 ? colors.accent : colors.stroke} fillOpacity={i === 0 ? 0.14 : 0.05}
                    stroke={i === 0 ? colors.accent : colors.stroke} strokeWidth={i === 0 ? 2.5 : 1.5} />
                  {/* Rank position — a real ordinal, which a ranked list has. */}
                  <text x={contentX + 44 * sx} y={ry + 31 * sy} fill={i === 0 ? colors.accent : colors.stroke}
                    opacity={i === 0 ? 1 : 0.55} fontFamily={fontFamily} fontSize={TYPE.label} fontWeight={700}>
                    {i + 1}
                  </text>
                </g>
              );
            })
          : null}

        <StatusBar x={x} y={y + h - 26 * sy} w={w} colors={colors} progress={pChrome} active={pWork > 0 && pResult <= 0} />
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
          x={contentX + 58 * sx} y={y + 100 * sy}
          text={queryLabel}
          color={colors.accent} size={TYPE.support} weight={700} tracking={1.5}
          opacity={ease(Math.min(1, pInput * 1.4))}
          fontFamily={fontFamily} halo={colors.bg}
        />
      ) : null}
      {pResult > 0 && resultLabel ? (
        <Label
          x={contentX + 78 * sx} y={y + 250 * sy}
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
  /**
   * THE GRID OF RANDOM CELLS IS GONE.
   *
   * This strategy's own entry in visual/strategies.js declares
   * `dataNeeds: []` and states its intent as "the same frame under two
   * different conditions" — which literally names a photograph (the SAME
   * shot, at two moments). No photo pipeline is reachable here (every
   * source returns a connection error) and 17 of 18 channels have zero
   * sourced images on disk, so that intent cannot be honestly met right
   * now. What rendered instead was 40 identical rounded rects, each
   * switched on or off by `seeded(i)` with no relationship to anything the
   * script said, inside a box hardcoded to `x=108,y=470,w=864,h=560` that
   * ignored the shot entirely. A field of fake data standing in for a
   * comparison is worse than an empty frame — it looks like evidence and
   * carries none.
   *
   * director.js has never populated real before/after data for this
   * strategy either (its supporting-data switch has no BEFORE_AFTER case),
   * so the only real thing to show is the beat's own actual words — same
   * fallback CinematicStatementScene already uses when no richer
   * representation exists (visual/strategies.js: "no richer representation
   * was available — compose the frame anyway"). Delegating to it rather
   * than duplicating its typography keeps one definition of that fallback
   * instead of two that can drift apart.
   *
   * WIRED, BUT NOT YET PROVEN. The pair path below now exists: when the
   * manifest DECLARES two images as one subject under two conditions
   * (broll.js resolveAssetPair — explicit pair_id + before/after, never
   * inferred from "this section has two photos"), the scene shows them.
   * No manifest in this repo declares a pair and none can be sourced while
   * the asset APIs are egress-blocked, so this branch is compile-checked
   * and has never rendered a frame. The statement fallback below remains
   * what every real beat actually gets today. See CHECK-REGISTER §3.12.19.
   */
  const pair = (beat.visualPlan && beat.visualPlan.supporting && beat.visualPlan.supporting.assetPair) || null;
  if (pair && pair.before && pair.after) {
    return <BeforeAfterPair beat={beat} pair={pair} colors={colors} fontFamily={fontFamily} />;
  }
  return <CinematicStatementScene beat={beat} colors={colors} fontFamily={fontFamily} />;
}

/**
 * Two real photographs of one subject, the second wiping across the first.
 *
 * The wipe is the whole argument: a hard edge travelling over a FIXED frame
 * is what makes the two images read as the same place rather than two
 * pictures side by side, which is why the states are `before` / `wipe` /
 * `after` / `compare` (strategies.js) and not a crossfade. Both images are
 * drawn at identical geometry for the same reason — any offset between
 * them and the eye reads two subjects.
 *
 * Labels are the manifest's own `condition` words, nothing invented, and
 * the attribution each image carries is preserved on the plan so the
 * credits block can pick it up the way it already does for CC-BY photos.
 */
function BeforeAfterPair({ beat, pair, colors, fontFamily }) {
  const states = beat.visualStates || [];
  const pWipe = useValueProgress(states); // reaches 1 exactly on the anchor
  const pCompare = useStateProgress(states, "compare");
  const cut = `${(Math.max(0, Math.min(1, pWipe)) * 100).toFixed(2)}%`;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <img src={staticFile(pair.before.path)} alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      {/* The AFTER image, revealed by a moving edge over the same frame. */}
      <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${cut})` }}>
        <img src={staticFile(pair.after.path)} alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      {/* The edge itself, so the wipe is an event and not a dissolve. */}
      {pWipe > 0 && pWipe < 1 ? (
        <div style={{ position: "absolute", top: 0, bottom: 0, left: cut, width: 3, background: colors.accent }} />
      ) : null}
      <Label x={SAFE.left} y={SAFE.top} text={String(pair.before.conditionLabel || "BEFORE")}
        color={colors.textPrimary} size={TYPE.label} weight={800} tracking={2}
        opacity={1 - Math.max(0, Math.min(1, pWipe))} fontFamily={fontFamily} halo={colors.bg} />
      <Label x={SAFE.right} y={SAFE.top} text={String(pair.after.conditionLabel || "AFTER")}
        color={colors.accent} size={TYPE.label} weight={800} tracking={2} align="right"
        opacity={Math.max(0, Math.min(1, pWipe)) * (0.5 + 0.5 * ease(pCompare))}
        fontFamily={fontFamily} halo={colors.bg} />
    </div>
  );
}
