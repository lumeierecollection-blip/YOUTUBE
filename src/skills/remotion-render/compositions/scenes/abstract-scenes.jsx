import React from "react";
import { useCurrentFrame } from "remotion";
import {
  CANVAS_W, CANVAS_H, SAFE, Label, ease, seeded,
  useStateProgress, useValueProgress, EASE_OUT, EASE_IN_OUT,
} from "./primitives.jsx";
import { progressOf } from "../../visual/states.js";
import { MG_TYPE as TYPE } from "../beats.js";
import { Plane, shotFrame, cameraSafe } from "./stage.jsx";
import { PressureWalls } from "./elements/pressure.jsx";
import { ATMOSPHERE_HORIZON_Y } from "../../layout/slots.js";
// remocn text-entrance and pull-quote emphasis. Installed and verified
// per-component against their own doc pages — see REMOCN-COMPONENTS.md for
// each install command and the diff against the registry source.
import { LineByLineSlide } from "../../components/remocn/line-by-line-slide";
import { SoftBlurIn } from "../../components/remocn/soft-blur-in";
import { MicroScaleFade } from "../../components/remocn/micro-scale-fade";
import { InlineHighlight } from "../../components/remocn/inline-highlight";

/**
 * Abstract scenes — the two that carry a beat when nothing concrete is
 * available. These are where PART 7 is won or lost.
 *
 * The old terminal fallback was StatementScene, which rendered ONE ICON at
 * 120px in the middle of the frame and nothing else. That is what made
 * every video feel templated: whenever the classifier couldn't read a
 * fragment (which was most of the time), a noun-matched glyph appeared.
 *
 * Neither scene here renders an icon at all.
 */


// ─────────────────────────────────────────────────────────────────────────────
// VISUAL_METAPHOR — an abstract idea given physical behaviour.
//
// The notion detected in the text (trapped, pressure, growth, erosion...)
// selects HOW the field behaves, so "debt keeps people trapped" produces
// something closing in, not a lock icon.
// ─────────────────────────────────────────────────────────────────────────────
export function VisualMetaphorScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const plan = beat.visualPlan || {};
  const notion = String((plan.payload && plan.payload.notion) || "").toLowerCase();

  const pEst = useStateProgress(states, "establish");
  const pAct = progressOf(states, "act", frame);
  const pResolve = useStateProgress(states, "resolve");

  // Which physical behaviour the notion maps to. Each is a genuinely
  // different motion, not a restyled version of the same one. No keyword
  // match now folds into "closing" rather than a separate "converging"
  // bucket — both were the same shrink formula at a different rate, i.e.
  // one mode wearing two names.
  const mode = /trap|caught|stuck|lock|bound|constrain|squeeze/.test(notion)
    ? "closing"
    : /pressure|burden|weight|crush|strain/.test(notion)
      ? "loading"
      : /hidden|invisible|silent|secret|unseen/.test(notion)
        ? "revealing"
        : /risk|fragile|collapse|fail/.test(notion)
          ? "destabilising"
          : "closing";

  const f = shotFrame((beat.visualPlan && beat.visualPlan.shot) || null);
  const cx = f.cx, cy = f.cy;
  const a = ease(pAct, EASE_IN_OUT);
  // Field size follows the SHOT, not a fixed 330px. IMMERSIVE puts the
  // viewer inside the field; CLOSE puts them near a smaller one. Hardcoding
  // the size made both framings draw an identical field, which is the
  // whole complaint this layer exists to answer.
  const rawHalfW = f.w * 0.21;
  const rawHalfH = f.h * 0.17;
  const rawOpen = Math.min(f.w, f.h) * 0.2;
  const appear = ease(pEst);

  // loading's own geometry: a compressing stack of load bars, unrelated
  // to the wall box the other three modes use.
  const rings = 5;
  const rawR = Math.min(f.w, f.h) * 0.46;

  /**
   * THE FIELD IS SCALED TO FIT THE SAFE RECT — MEASURED, NOT ASSUMED.
   *
   * The shot for this strategy is IMMERSIVE (coverage 1.0, bleed), so
   * `f.w` is 1134 and every size above is a fraction of a world WIDER than
   * the frame. The walls were therefore drawn wider than the safe rect and
   * then scaled outward again by the camera: the rendered anchor frame put
   * 7277 px of wall outside SAFE, reaching x=1050 — 162px past SAFE.right
   * — with a contiguous run of 814px. That is the enclosure's right bar and
   * the overhanging ends of its two horizontal bars.
   *
   * Scaling the WHOLE field by one factor, rather than clamping each part,
   * is the same answer ComparisonScene needed for its figure pair: clamping
   * parts independently breaks the proportion that carries the meaning. A
   * vice whose right wall is nearer than its left is not a vice.
   *
   * The extent is computed for the mode that will actually draw, at the
   * point in ITS animation where it is widest — `revealing` retreats to
   * 1.68x its opening, `closing` starts at 1.0x and shrinks — so the fit
   * holds for the whole beat, not just the anchor frame.
   */
  const safe = cameraSafe(plan.shot || null, SAFE);
  const availHalfW = Math.max(40, Math.min(cx - safe.left, safe.right - cx));
  const availHalfH = Math.max(40, Math.min(cy - safe.top, safe.bottom - cy));
  const standoffPeak = mode === "revealing" ? 1.68 : mode === "destabilising" ? 0.55 : 1;
  // Mirrors PressureWalls' own th/overhang, which extend the horizontal
  // bars past the wall box on both sides.
  const wallTh = Math.max(12, Math.min(rawHalfW, rawHalfH) * 0.22);
  const wallOver = wallTh * 1.4;
  const extentX = mode === "loading"
    ? rawR * 0.9
    : rawHalfW + rawOpen * standoffPeak + wallOver;
  const extentY = mode === "loading"
    ? f.h * 0.17 + rings * f.h * 0.07
    : rawHalfH + rawOpen * standoffPeak + wallOver;
  const fit = Math.min(1, availHalfW / extentX, availHalfH / extentY);
  const boxHalfW = rawHalfW * fit;
  const boxHalfH = rawHalfH * fit;
  const openMax = rawOpen * fit;
  const R = rawR * fit;
  const step = R * 0.079;

  let standoff = openMax, wallOpacity = appear, wobble = [0, 0, 0, 0], accent = false;
  switch (mode) {
    case "closing":
      // Walls close toward the subject as the beat plays out. A working
      // vice never fully seals — same residual-gap precedent as
      // elements/machine.jsx's Gate — so the minimum standoff stays a
      // small positive gap, not zero.
      standoff = openMax * (1 - 0.82 * a);
      break;
    case "revealing":
      // Walls start almost flush against the subject and retreat outward,
      // exposing what they held, fading as they go.
      standoff = openMax * (0.08 + 1.6 * a);
      wallOpacity = appear * (1 - 0.5 * a);
      accent = true;
      break;
    case "destabilising":
      standoff = openMax * 0.55;
      wobble = [0, 0, 0, 0];
      break;
    default:
      break; // "loading" draws its own bars below and ignores standoff
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {mode === "loading" ? (
          Array.from({ length: rings }).map((_, i) => {
            const t = i / (rings - 1 || 1);
            const barAppear = ease(Math.max(0, Math.min(1, pEst * rings - i * 0.6)));
            if (barAppear <= 0.02) return null;
            const r = R * 0.9 - i * step * 1.15;
            const opacity = 0.5 + 0.5 * barAppear;
            const squash = 1 - 0.5 * a * (1 - t);
            // Stacked bars compress downward under accumulating weight —
            // filled MASS, not a wireframe outline, so the weight reads.
            return (
              <rect key={i}
                x={cx - r} y={cy - f.h * 0.17 + i * (f.h * 0.07) * squash}
                width={r * 2} height={f.h * 0.05 * squash} rx={3}
                fill={i === 0 ? colors.accent : colors.stroke}
                fillOpacity={(i === 0 ? 0.55 : 0.3) * opacity}
                stroke={i === 0 ? colors.accent : colors.stroke}
                strokeWidth={i === 0 ? 3.5 : 2} opacity={opacity} />
            );
          })
        ) : (
          // Four solid walls acting on the subject — a vice/frame closing
          // or opening — instead of a field of concentric rings.
          <PressureWalls cx={cx} cy={cy} halfW={boxHalfW} halfH={boxHalfH}
            standoff={standoff} colors={colors} opacity={wallOpacity}
            wobble={wobble} accent={accent} />
        )}

        {/* The subject held at the centre — the thing the walls act upon. */}
        <circle cx={cx} cy={cy} r={12 + 6 * appear} fill={colors.accent} opacity={appear} />
      </svg>

      {pResolve > 0 ? (() => {
        /**
         * THE ONE PIECE OF THIS SCENE THE FIELD FIT DOES NOT COVER.
         *
         * The walls are scaled to the safe rect above, but this label was
         * a fixed 40px centred on `cx` with no width constraint at all. It
         * only appears in the `resolve` state, so the anchor frame never
         * showed it — the gate caught it only when it sampled the last
         * frame of the beat, where the phrase measured x[151..906], 18px
         * past SAFE.right.
         *
         * Fitted then elided, the same two-step every other text in this
         * system uses: shrink to what fits, and trim if the size floor
         * still will not.
         */
        const phrase = String((beat.visualPlan && beat.visualPlan.supporting.phrase) || "");
        if (!phrase) return null;
        const halfAvail = Math.min(cx - safe.left, safe.right - cx);
        const GLYPH_W = 0.62; // 800-weight mixed case, narrower than the 0.78 uppercase case
        const size = Math.max(TYPE.support, Math.min(40, Math.floor((halfAvail * 2) / (phrase.length * GLYPH_W))));
        const fitChars = Math.max(6, Math.floor((halfAvail * 2) / (size * GLYPH_W)));
        const shown = phrase.length > fitChars ? `${phrase.slice(0, fitChars - 1).trimEnd()}…` : phrase;
        return (
          <Label x={cx} y={cy + R * 0.95} text={shown}
            color={colors.textPrimary} size={size} weight={800} tracking={2}
            align="center" opacity={pResolve} fontFamily={fontFamily} />
        );
      })() : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CINEMATIC_STATEMENT — the terminal fallback.
//
// This replaces the icon-only StatementScene. When no richer reading was
// available the frame is still a SHOT: distance, three real depth planes,
// and the statement standing somewhere in that distance. No icon. Ever.
//
// WHAT WAS WRONG WITH THE FIRST VERSION. It drew `GroundPlane` — a
// perspective grid — with a horizon line at y=560, on top of the
// `AtmosphereGround` the router already stages, whose own horizon is at
// y=1152. Two horizons, at different heights, in one frame. That is the
// same defect the TIMELINE rebuild fixed, and it is what a scene gets for
// staging its own world instead of standing in the one it was given.
//
// It also ignored its shot entirely: `f` was computed and then never read,
// while the composition used a hardcoded STAGE_CX and a fixed y=640. Both
// framings CINEMATIC_STATEMENT can receive drew the identical picture.
//
// This version stands in the atmosphere ground's world — its horizon,
// nothing competing with it — and separates near from far with the real
// `Plane` primitive, which until now was exported and used by no scene.
// ─────────────────────────────────────────────────────────────────────────────

// Horizon lives in layout/slots.js (ATMOSPHERE_HORIZON_Y = 1200) —
// stage-16 FRM-02: 1152 placed the ridge band straddling safe-bottom
// 1248 under the captionDrop(110) + camera mapping.

// ─────────────────────────────────────────────────────────────────────────────
// TEXT ENTRANCE + PULL-QUOTE EMPHASIS.
//
// This scene is where a phrase IS the picture (CINEMATIC_STATEMENT, the
// terminal fallback), so it is where text entrance belongs — NOT in
// structure-scenes.jsx, which draws timelines, processes, cause/effect and
// relationships and contains no text-as-subject at all.
//
// The existing entrance — opacity and a 20px rise driven by `eSubject`, so the
// words LAND on the anchor rather than starting there — remains the default and
// is unchanged. A beat that declares nothing renders exactly the pixels it did
// before; that property is why the anchor-frame check (CHECK-REGISTER VIS-26)
// still means what it meant.
//
// `beat.visualPlan.textEntrance` selects an alternative; `emphasis` names one
// word inside the phrase to carry Inline Highlight. Both are deterministic: an
// unknown value falls back to the default rather than rendering nothing.
// ─────────────────────────────────────────────────────────────────────────────

export const TEXT_ENTRANCES = ["default", "line-by-line-slide", "soft-blur-in", "micro-scale-fade"];

export function textEntranceOf(beat) {
  const asked = beat && beat.visualPlan && beat.visualPlan.textEntrance;
  return TEXT_ENTRANCES.includes(asked) ? asked : "default";
}

/**
 * The phrase, rendered with whichever entrance this beat asked for.
 * `style` carries the type treatment the scene already computed, so the size,
 * weight, tracking and colour decisions stay in one place.
 */
function PhraseText({ phrase, entrance, emphasis, style }) {
  // Inline Highlight emphasises ONE word inside an otherwise-plain phrase, so
  // it composes with the phrase rather than replacing its entrance. Only a
  // word that actually occurs is used — a mismatch renders the plain phrase
  // instead of silently highlighting nothing.
  if (emphasis && phrase.includes(emphasis)) {
    const at = phrase.indexOf(emphasis);
    return (
      <div style={style}>
        <InlineHighlight
          before={phrase.slice(0, at)}
          highlight={emphasis}
          after={phrase.slice(at + emphasis.length)}
          baseColor={style.color}
          highlightColor={style.accentColor || style.color}
          fontSize={style.fontSize}
          fontWeight={style.fontWeight}
        />
      </div>
    );
  }
  if (entrance === "line-by-line-slide") {
    return <div style={style}><LineByLineSlide text={phrase} fontSize={style.fontSize} color={style.color} fontWeight={style.fontWeight} /></div>;
  }
  if (entrance === "soft-blur-in") {
    return <div style={style}><SoftBlurIn text={phrase} fontSize={style.fontSize} color={style.color} fontWeight={style.fontWeight} /></div>;
  }
  if (entrance === "micro-scale-fade") {
    return <div style={style}><MicroScaleFade text={phrase} fontSize={style.fontSize} color={style.color} fontWeight={style.fontWeight} /></div>;
  }
  return <div style={style}>{phrase}</div>;
}

export function CinematicStatementScene({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const states = beat.visualStates || [];
  const shot = (beat.visualPlan && beat.visualPlan.shot) || null;
  const f = shotFrame(shot);
  const dur = beat.durationInFrames;

  const pField = useStateProgress(states, "field");
  const pDrift = progressOf(states, "drift", frame);
  // THE STATEMENT LANDS ON THE ANCHOR, IT DOES NOT START THERE.
  //
  // `subject` is this strategy's anchored state, so driving the phrase from
  // it put opacity 0 on the exact frame the key word is spoken — and this
  // scene's entire content IS that phrase, so the rendered anchor frame
  // came back blank. Measured: 0.1% ink, bbox 100x1%, no text at all.
  //
  // useValueProgress reaches exactly 1 at the anchor, which is what the
  // channel config means by "the largest visual move lands at reveal": the
  // words arrive as they are said, rather than beginning to arrive.
  const pSubject = useValueProgress(states);

  // Decided on the plan (visual/text-budget.js), not here: the phrase has
  // to be countable by the render report, and three scene files each
  // extracting their own with three different word limits is how it stopped
  // being countable in the first place.
  const phrase = (beat.visualPlan && beat.visualPlan.supporting.phrase) || "";

  const seed = (beat.startFrame || 0) + 7;
  const horizon = ATMOSPHERE_HORIZON_Y;
  const eField = ease(pField);
  const eSubject = ease(pSubject);
  // The one extra breath the terminal fallback gets, on top of the camera's
  // drift. Small: the sparseness is the point, movement is not the point.
  const settle = ease(pDrift, EASE_IN_OUT);

  // The statement stands where the FRAMING says, not in the middle. HORIZON
  // sets it low and near the ground; ISOLATED lifts it into the haze and
  // pushes it left, which is what "isolated" should look like.
  const textCx = f.cx;
  // A CLEAN VERTICAL STACK: ground, then the stake standing on it, then the
  // words above the stake. The first version derived the stake's height
  // from the text's top edge, and on a rendered frame the two overlapped —
  // "CARRIED BALANCE" was struck through by its own stake and sat across
  // the horizon line. Stack downward from the horizon instead, and let the
  // text sit on top of the stake rather than around it.
  const stakeH = Math.max(90, f.h * 0.2);
  const stakeTop = horizon - stakeH;
  // Positioned by its BOTTOM edge, so a phrase that wraps to two lines
  // grows upward into empty sky instead of down through the stake.
  const textBottom = CANVAS_H - (stakeTop - 26);
  // The phrase box: centred on `textCx`, but clamped so BOTH edges stay
  // inside SAFE — see the box's own comment below for the rendered-frame
  // defect this exists to prevent.
  /**
   * CLAMPED TO THE CAMERA-SAFE RECT, NOT TO SAFE.
   *
   * These two lines used SAFE directly, which is correct only for a camera
   * that never scales. BEFORE_AFTER delegates to this scene and gets a
   * different shot — ACTING_LEFT, drift held in place, scale 1.04 -> 1.06 —
   * and on its anchor frame the last glyph of "...TRACKING EVERY" rendered
   * at x=904, 16px past SAFE.right, with a 23px run. Real words under the
   * platform UI, not decoration.
   */
  const statementSafe = cameraSafe(shot, SAFE);
  const textBoxW = Math.min(f.w * 0.88, statementSafe.width);
  const textBoxLeft = Math.max(
    statementSafe.left,
    Math.min(statementSafe.right - textBoxW, textCx - textBoxW / 2)
  );

  // A far ridge: deterministic, irregular, and BELOW the eye — it sits on
  // the horizon rather than floating. Seeded, so a re-render is identical.
  const ridge = [];
  const ridgeN = 22;
  for (let i = 0; i <= ridgeN; i++) {
    const x = (i / ridgeN) * CANVAS_W;
    const y = horizon - (10 + seeded(seed * 31 + i) * 46) * eField;
    ridge.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  ridge.push(`L${CANVAS_W},${horizon} L0,${horizon} Z`);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* FAR — a ridge on the horizon. Lags the camera most (parallax 0.2),
          so it barely moves, the way distance behaves. */}
      <Plane shot={shot} depth="far" states={states} durationInFrames={dur}>
        <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0 }}>
          {/* 0.07 was invisible. These planes ARE the composition for the
              terminal fallback, not background texture, and on a white-bg
              channel (Money Mind) the whole frame rendered as blank paper. */}
          <path d={ridge.join(" ")} fill={colors.stroke} opacity={0.26 * eField} />
        </svg>
      </Plane>

      {/* SUBJECT — the statement, and a single stake tying it to the
          ground. Without the stake the words float; with it, they are
          somewhere. */}
      <Plane shot={shot} depth="subject" states={states} durationInFrames={dur}>
        <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          {pSubject > 0 ? (
            <line
              x1={Math.round(textCx)} y1={horizon}
              x2={Math.round(textCx)} y2={horizon - stakeH * eSubject}
              stroke={colors.accent} strokeWidth={6} />
          ) : null}
          {/* Its footing on the ground — a shadow, so the stake is standing
              on the plane rather than crossing in front of it. */}
          {pSubject > 0 ? (
            <ellipse cx={textCx} cy={horizon + 3} rx={26 * eSubject} ry={4 * eSubject}
              fill={colors.stroke} opacity={0.22} />
          ) : null}
        </svg>

        {phrase ? (
          <div style={{
            position: "absolute",
            /**
             * CLAMPED ON BOTH EDGES, not just the left (textBoxLeft/
             * textBoxW above). The old `left` only ever floored at
             * SAFE.left; nothing capped `left + width` at SAFE.right.
             * CINEMATIC_STATEMENT's own two framings (HORIZON, ISOLATED)
             * are both roughly centred, so this never overflowed — but
             * BEFORE_AFTER's ACTING_RIGHT framing (anchor 0.66, off-
             * centre right) routes through this same scene via
             * BeforeAfterScene's delegation, and a rendered frame caught
             * it there: "YOUR PHONE IS TRACKING EVERY MOVE YOU MAKE" ran
             * its first line ("...TRACKING EVERY") straight off the
             * right edge of the canvas.
             */
            left: textBoxLeft,
            width: textBoxW,
            bottom: textBottom,
            textAlign: shot && shot.anchorX < 0.45 ? "left" : "center",
            opacity: eSubject,
            transform: `translateY(${(1 - eSubject) * 20 - settle * 6}px)`,
          }}>
            <PhraseText
              phrase={phrase}
              entrance={textEntranceOf(beat)}
              emphasis={(beat.visualPlan && beat.visualPlan.supporting.emphasis) || null}
              style={{
                color: colors.textPrimary,
                accentColor: colors.accent,
                fontFamily,
                fontWeight: 800,
                // Type scales with the shot: a tighter framing means the
                // words are nearer, not smaller in the same frame.
                fontSize: Math.round((phrase.length > 20 ? 56 : 72) * Math.min(1.1, f.w / 1080)),
                letterSpacing: 1.5,
                lineHeight: 1.1,
              }}
            />
          </div>
        ) : null}
      </Plane>

      {/* FOREGROUND — the near edge of the ground the viewer is standing
          on. Leads the camera (parallax 1.5), so it is the layer that
          actually sells the depth; a still frame shows only a dark band. */}
      <Plane shot={shot} depth="foreground" states={states} durationInFrames={dur}>
        <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0 }}>
          <path
            d={`M-60,${CANVAS_H} L-60,${CANVAS_H - 150 * eField} ${Array.from({ length: 13 })
              .map((_, i) => {
                const x = -60 + (i / 12) * (CANVAS_W + 120);
                const y = CANVAS_H - (110 + seeded(seed * 53 + i) * 80) * eField;
                return `L${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(" ")} L${CANVAS_W + 60},${CANVAS_H} Z`}
            fill={colors.stroke} opacity={0.32 * eField} />
        </svg>
      </Plane>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ENUMERATION — several named things, arriving as they are said.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A ROLL CALL, NOT A LIST WIDGET.
 *
 * WHAT THIS REPLACES. LIST_ITEM beats were skipped by the whole strategy
 * system (`visualPlan = null`) and drawn by `ListRunScene` as chips inside a
 * rounded bordered `Panel` at hardcoded geometry — `left: 88`, `width: 760`,
 * `height: 88` per row, a "+" bullet per chip, the shot ignored entirely. It
 * was a UI list control, and it survived this rebuild only because nothing
 * pointed a plan at it, so no check ever looked (CHECK-REGISTER §3.12.21).
 *
 * WHY THERE IS NO CONTAINER HERE. A border encloses; a roll call does not.
 * The names are set directly on the scene's own ground — the ATMOSPHERE
 * material the stage already draws — with nothing around them. Type
 * hierarchy does the work a box was doing: the name being said is large and
 * in the channel accent, the names already said are smaller and dimmer above
 * it. That difference alone says "these are one list, and this is where we
 * are in it".
 *
 * WHAT IS REAL HERE. Only the names. `supporting.items` are content words
 * lifted from each member beat's own sentence, and `itemIndex` is this
 * beat's real position in the run — both assembled in mg-package.js, which
 * is the only place that can see a whole run. Nothing is invented: no
 * counts, no categories, no icon per item.
 *
 * NAMES NOT YET SPOKEN ARE NOT DRAWN. Printing the rest of the list ahead of
 * the narration would put words on screen before they are said — the same
 * defect `DocumentSheet` was carrying when it pre-highlighted "the clause"
 * before the real one appeared. The list assembles at the speed it is
 * spoken.
 *
 * THE OLDEST NAMES FALL AWAY once more than `VISIBLE_PRIOR` are behind the
 * current one. They had their moment when they were said; keeping every name
 * forever would either shrink the type below the house floor or run off the
 * top of the frame. This is a display window, not a claim that the list was
 * shorter than it was.
 *
 * WITH REAL PHOTOS, THIS SHOULD SHOW THEM. The strategy's intent names
 * concrete things — species, locations, events — and a real sourced photo
 * per item would beat typography. 0 of 17 production channels have any and
 * the asset APIs are egress-blocked (§3.12.24), so this is the honest
 * treatment available now, not the ceiling.
 */
const VISIBLE_PRIOR = 3;

export function EnumerationScene({ beat, colors, fontFamily }) {
  const states = beat.visualStates || [];
  const plan = beat.visualPlan || {};
  const sup = plan.supporting || {};
  const f = shotFrame(plan.shot || null);

  const items = Array.isArray(sup.items) ? sup.items : [];
  const idx = Number.isFinite(sup.itemIndex) ? sup.itemIndex : 0;
  if (!items.length) return null;

  // The name lands ON the anchor, not starting from it — same reason every
  // other scene in this system uses useValueProgress for its key moment.
  const pArrive = useValueProgress(states);
  const pSettle = useStateProgress(states, "settle");
  const eArrive = ease(pArrive);

  // Which names are on screen: this one, plus up to VISIBLE_PRIOR already
  // said. Never anything ahead of the narration.
  const shot = plan.shot || null;
  const coverage = shot ? shot.coverage : 0.9;
  // A narrow field holds fewer names before they crowd. ISOLATED
  // (coverage 0.4) keeps one behind the current name; COLUMNAR keeps the
  // full window.
  const visiblePrior = coverage < 0.6 ? 1 : VISIBLE_PRIOR;
  const firstShown = Math.max(0, idx - visiblePrior);
  const shown = [];
  for (let k = firstShown; k <= idx; k++) shown.push({ k, text: String(items[k] || "").trim() });

  /**
   * Type fitted to the longest name actually on screen, so a long species
   * name cannot leave the safe rect. Same glyph-count estimate the rest of
   * the system uses for un-measured text (Label has no measurement pass);
   * clamped into the house range rather than free-scaled, so the current
   * name never drops under TYP-04's floor.
   */
  // Bold uppercase is WIDE. Measured off a rendered frame: "HARBOUR MASTER"
  // at the label size occupied ~0.75 of size per glyph, and the same lesson
  // cost a clipped figure in ComparisonScene (COMPARISON_GLYPH_W, 0.56 ->
  // 0.70). Over-estimating is the safe direction here: it elides a shade
  // early, where under-estimating clips.
  const GLYPH_W = 0.78;
  /**
   * The column takes the width the SHOT granted, not the whole safe rect.
   *
   * This strategy's two framings are genuinely different rooms: COLUMNAR is
   * a wide vertical stack (coverage 0.9, bleed) for a long run, ISOLATED a
   * narrow field (coverage 0.4) for a short one. Sizing against SAFE alone
   * would draw both identically and make the declared `variants: 2` a claim
   * the pixels do not honour — which run-visual-tests.js checks for.
   */
  // The rect the camera will still have inside SAFE when it is done moving
  // — not SAFE itself. See cameraSafe() in stage.jsx for the measurement
  // that forced this: a column pinned to SAFE.left rendered at x=4.
  const safe = cameraSafe(plan.shot || null, SAFE);
  const avail = Math.min(f.w, safe.width);
  const longest = shown.reduce((n, s) => Math.max(n, s.text.length), 1);
  /**
   * THE ORDINAL'S INDENT COMES OUT OF THE WIDTH THE NAME GETS.
   *
   * Sizing the name against the full column and THEN starting it at
   * `colX + indent` overflows by exactly the indent. A rendered frame
   * caught it: item 02 of the fixture run, "CUSTOMS OFFICER NEXT
   * WAREHOUSE", ran off the right edge as "...WAREHO". The gate did not,
   * because it samples ONE anchor frame per strategy — the first item,
   * where a short name fit fine.
   *
   * The indent is derived from `priorSize`, and `priorSize` from
   * `currentSize`, which is circular; the two-pass resolution below is how
   * that loop is settled.
   */
  const INDENT_STEPS = 2.2; // matches the name's x offset below
  const fitSize = (ind) =>
    Math.max(TYPE.support, Math.min(TYPE.headline,
      Math.floor(Math.max(120, avail - ind) / (longest * GLYPH_W))));
  const indentOf = (size) => Math.max(TYPE.label, Math.round(size * 0.52)) * INDENT_STEPS;
  /**
   * Two passes, because one pass and the elision check below disagreed.
   *
   * Pass one sizes against the indent at the LABEL FLOOR, which is the
   * smallest the indent can be. But the indent actually drawn comes from
   * `priorSize`, which is usually larger — so the name was fitted to more
   * width than it got, and `elide()` (which measures the real indent)
   * trimmed a name that would have fit. A rendered frame caught it: the
   * fixture's "HARBOUR MASTER" came out "HARBOUR MAST…" with ~100px of
   * empty column to its right, one character over the limit.
   *
   * Pass two re-fits against the indent pass one implies. The indent can
   * only grow between the passes, so the second size is <= the first and
   * the second indent <= the first: the result is always at least as much
   * room as it was fitted for, never less.
   */
  const indent = indentOf(fitSize(indentOf(fitSize(TYPE.label * INDENT_STEPS))));
  const currentSize = fitSize(indent);
  const priorSize = Math.max(TYPE.label, Math.round(currentSize * 0.52));
  /**
   * A HARD BACKSTOP, because the house type floor can outvote the fit.
   *
   * `currentSize` is clamped up to TYPE.support (TYP-04, "Never lower"), so
   * a long enough name is drawn larger than the width it was fitted for and
   * runs off the column anyway — measured on a rendered frame at 30 glyphs.
   * Truncating to what actually fits at the size that will actually be used
   * is the only thing that closes it. `short()`-style elision is already the
   * house answer elsewhere (structure-scenes.jsx), and an elided real name
   * is still the script's own word; a clipped one is just broken.
   */
  const fitChars = (size) => Math.max(6, Math.floor((avail - indent) / (size * GLYPH_W)));
  const elide = (t, size) => (t.length > fitChars(size) ? `${t.slice(0, fitChars(size) - 1).trimEnd()}…` : t);

  // A column, left-aligned: a roll call is read down an edge, not centred.
  // Kept inside the camera-safe rect even when the framing pushes the shot
  // off-centre.
  const colX = Math.max(safe.left, Math.min(safe.right - avail, f.cx - avail / 2));
  const step = priorSize * 1.9;
  /**
   * The current name sits on the shot's own centre; prior names step up
   * from it. Both ends are clamped: the bottom so the current name clears
   * the safe floor, the top so a FULL stack of priors cannot climb out of
   * it. The comment here used to claim the second clamp while only having
   * the first — the stack climbs `visiblePrior * step` above `currentY`,
   * and nothing checked it.
   */
  const currentY = Math.max(
    safe.top + visiblePrior * step,
    Math.min(f.cy, safe.bottom - currentSize * 1.6)
  );

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {shown.map(({ k, text }) => {
        const isCurrent = k === idx;
        const behind = idx - k;
        // The stack shifts up by one step as the new name lands, so the
        // older names are visibly pushed along rather than teleporting.
        const y = currentY - behind * step;
        const shift = isCurrent ? (1 - eArrive) * 26 : (1 - eArrive) * step * 0.25;
        // Recede with age, floored so an older name stays legible rather
        // than fading into the ground.
        const dim = Math.max(0.32, 1 - behind * 0.26);
        return (
          <React.Fragment key={k}>
            {/* The ordinal is real — this name's position in the run — and
                is the only structural mark here. It replaces the "+" bullet
                the chip rows carried, which said nothing. */}
            <Label
              x={colX} y={y + shift + (isCurrent ? currentSize * 0.12 : 0)}
              text={String(k + 1).padStart(2, "0")}
              color={isCurrent ? colors.accent : colors.textDim}
              size={isCurrent ? priorSize : Math.round(priorSize * 0.8)}
              weight={800} tracking={2}
              opacity={isCurrent ? eArrive : dim * 0.8}
              fontFamily={fontFamily} halo={colors.bg}
            />
            <Label
              x={colX + (isCurrent ? indent : priorSize * 1.8)} y={y + shift}
              text={elide(text, isCurrent ? currentSize : priorSize)}
              color={isCurrent ? colors.accent : colors.textPrimary}
              size={isCurrent ? currentSize : priorSize}
              weight={isCurrent ? 900 : 700}
              tracking={isCurrent ? 0 : 1.2}
              opacity={isCurrent ? eArrive : dim}
              fontFamily={fontFamily} halo={colors.bg}
            />
          </React.Fragment>
        );
      })}

      {/* How far through the run this is. Real numbers, and the only thing
          on screen that is not one of the script's own words. It earns its
          place: without it a viewer cannot tell a list of three from the
          first three of nine. Appears as the set settles, not before. */}
      {items.length > 1 ? (
        <Label
          x={colX} y={currentY + currentSize * 1.35}
          text={`${idx + 1} OF ${items.length}`}
          color={colors.textDim} size={TYPE.label} weight={700} tracking={3}
          opacity={0.7 * ease(pSettle)}
          fontFamily={fontFamily} halo={colors.bg}
        />
      ) : null}
    </div>
  );
}
