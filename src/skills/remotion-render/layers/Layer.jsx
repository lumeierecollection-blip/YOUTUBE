/**
 * layers/Layer.jsx — LAYOUT-SYSTEM.md §4.2: the ONLY positioning component.
 *
 *   <Layer rect={rect} enter={enter} exit={exit} frame={n}>
 *     <SomePrimitive … />           // primitives never position themselves
 *   </Layer>
 *
 * Contract:
 * - rect — a compiled rect from layout/compile.js:
 *   { role, x, y, w, h, from, to, persistent?, structural? … }.
 *   Position is ALWAYS rect.x/y/w/h applied as `position: absolute`
 *   (R1). This file contains ZERO raw pixel literals — every coordinate
 *   comes from the rect (LAY-10), and no flexbox anywhere
 *   (LAY-11; flex may only exist INSIDE a single leaf primitive, §4.1 R1).
 * - enter / exit — the ShotSpec motion objects ({ pattern, atFrame }).
 *   Only the pattern NAME is read here. The FRAMES are rect.from/rect.to:
 *   the compiler already resolved atFrame under R4 (compile.js
 *   rangeBound + assertRange) — Layer never re-resolves, so a second
 *   resolver cannot drift (one resolver, single source of truth).
 * - frame — beat-relative current frame. Defaults to useCurrentFrame(),
 *   which is correct whenever the beat is rendered as its own
 *   composition/sequence (frame 0 = beat start). Probes and tests pass it
 *   explicitly for deterministic measurement.
 *
 * Motion (MOTION-GRAPHICS-MANUAL D2/D3, Blueprint §1.3/§1.4):
 * - Entrance patterns (D2), over frames [from, from + duration):
 *   RISE (D2.2): translateY +24 → 0 over D.base (9f), opacity 0 → 1 over
 *        D.short (6f), E_OUT. No scale — text that scales while fading
 *        reads blurry at 30 fps.
 *   POP  (D2.1): scale 0 → 1.15 → 1.00 over 9f with
 *        output:'perceptual-scale' (D1.3), opacity 0 → 1 over 3f, E_OUT.
 *        The two-segment keyframe curve is taken verbatim from the live
 *        renderer (motion-graphics.jsx:85) — single E_OUT easing there;
 *        the manual's "[E.out, E.settle]" cell is a reconciliation item
 *        (finding 3 in the stage ledger).
 *   FADE / DRAW / GROW / TRACE: wrapper envelope only — opacity 0 → 1
 *        over D.base, E_OUT. DRAW/GROW/TRACE interior motion (evolvePath,
 *        spring) is owned by the primitive; the Layer envelope just makes
 *        the element present. NONE: no motion (opacity 1 within window).
 * - Exits (D3), over the last exitDur frames ending at `to` (inclusive),
 *   E_IN, never overshooting (D3.2), never mirroring the entrance
 *   (D3.3), one token faster than the entrance (Rule 1.4: D.base 9f
 *   entrance exits in D.short 6f):
 *   caption          3f  fade + scale → 0.97 (live: motion-graphics.jsx:426-427)
 *   headline / accent   6f  fade only
 *   everything else  6f  fade + translateY −12
 *   structural + persistent (rail): furniture — never animates; held at
 *        full opacity through [from, to] (D5: rail is continuous).
 *   NONE exit pattern (kicker/caption in the real specs): no exit — held at
 *        full opacity through `to` (schema.js:65; build-shots.mjs:154,163).
 *        exitStyle reads the exit pattern NAME, exactly like entranceStyle
 *        reads the entrance pattern (only the FRAMES come from rect).
 * - Every interpolate() has an easing AND both extrapolate clamps
 *   (Rule 1.5 / D1.2); every scale interpolation sets
 *   output:'perceptual-scale' (D1.3). Individual CSS transform properties
 *   (scale, translate) are used instead of a composed transform string
 *   (§4.2, Remotion markup guidance), keeping values legible and
 *   Studio-editable.
 */

import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { D } from "../compositions/beats.js";

// ── Easing (shared with the live renderer) ────────────────────────────────
// E_OUT: the Blueprint §1.4 "standard decelerate" — the exact value the live
//   renderer uses (motion-graphics.jsx:40), so Layer's motion is numerically
//   identical to what the Tier-2 probe measures against.
const E_OUT = Easing.bezier(0.16, 1, 0.3, 1);
// E_IN: same value as the live renderer (motion-graphics.jsx:42). Not
//   exported from beats.js — kept local.
const E_IN = Easing.bezier(0.33, 0, 0.67, 1);

// ── Motion constants — MANUAL D2/D3 parameter values (not coordinates) ────
// D2.2 RISE: initial translateY offset (px), MANUAL D2.2 table.
const RISE_OFFSET = 24;
// D3 stage exit: translateY offset (px), MANUAL D3 table.
const STAGE_EXIT_OFFSET = 12;
// D2.1 POP: overshoot peak scale, MANUAL D2.1 table ("0 → 1.15 → 1.00").
const POP_PEAK = 1.15;
// D2.1 POP: overshoot peak frame + opacity ramp frames (live renderer:85,84).
const POP_PEAK_FRAME = 5;
const POP_OPACITY_FRAMES = 3;
// D3 caption exit: 0.97 settle scale + 3-frame window (MANUAL D3; live:427).
const CAPTION_EXIT_SCALE = 0.97;
const CAPTION_EXIT_FRAMES = 3;
// D3 headline/stage exit window = D.short (Rule 1.4: one token faster).
const EXIT_DUR = D.short;

/** NONE pattern check — schema.js:65: "A NONE pattern has no motion"
 *  (so its atFrame is optional). Mirrors compile-lint's isNone. */
const isNone = (p) => typeof p === "string" && /^none$/i.test(p);

/** interpolate with mandatory easing + both clamps (Rule 1.5 / D1.1-D1.2). */
function ease(frame, inputRange, outputRange, easing = E_OUT) {
  return interpolate(frame, inputRange, outputRange, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
}

/** Scale variant — output:'perceptual-scale' (D1.3). */
function easeScale(frame, inputRange, outputRange, easing = E_OUT) {
  return interpolate(frame, inputRange, outputRange, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
    output: "perceptual-scale",
  });
}

/**
 * D2 entrance, driven by the pattern name. Returns partial style values
 * (opacity 0–1, translateY px, scale); the caller combines them with the
 * exit values and the rect position. `rel` is frame − rect.from (0 at the
 * layer's first on-screen frame).
 */
function entranceStyle(pattern, rel) {
  switch (String(pattern || "FADE").toUpperCase()) {
    case "RISE":
      // D2.2 — translateY +24 → 0 over D.base; opacity 0 → 1 over D.short.
      return {
        opacity: ease(rel, [0, D.short], [0, 1], E_OUT),
        translateY: RISE_OFFSET * ease(rel, [0, D.base], [1, 0], E_OUT),
      };
    case "POP":
      // D2.1 — scale 0 → 1.15 → 1.00 over 9f; opacity 0 → 1 over 3f.
      return {
        opacity: ease(rel, [0, POP_OPACITY_FRAMES], [0, 1], E_OUT),
        scale: easeScale(
          rel,
          [0, POP_PEAK_FRAME, D.base],
          [0, POP_PEAK, 1],
          E_OUT
        ),
        transformOrigin: "center",
      };
    case "NONE":
      // No entrance motion — present at full opacity within its window.
      return { opacity: 1 };
    default:
      // FADE, DRAW, GROW, TRACE — envelope only (interior motion is the
      // primitive's). MANUAL D2.4/D2.5 + live IMAGE_BEAT fade (mg.jsx:963).
      return { opacity: ease(rel, [0, D.base], [0, 1], E_OUT) };
  }
}

/**
 * D3 exit, by role, over the exitDur frames immediately before rect.to.
 * Exit window: frames (to − exitDur, to]; p goes 0 → 1 across it, so the
 * layer is fully visible at the window start and exactly invisible at `to`
 * (the next beat starts at to + 1). Matches the live renderer's
 * stageExitStyle (mg.jsx:99-104) and caption exit (mg.jsx:426-427).
 * Never overshoots (D3.2); never reverses the entrance (D3.3).
 *
 * NONE: no exit — the layer holds at full opacity through `to`. This is the
 * documented spec (LAYOUT-SYSTEM.md:239 kicker exit NONE) and what the real
 * shot builder emits for the persistent trio (kicker/rail/caption,
 * build-shots.mjs:154,156,163). Without this guard, to=dur would fade the
 * kicker/caption out over the beat's last frames — contradicting schema.js:65
 * ("a NONE pattern has no motion") and the live renderer's kicker, which is
 * continuous furniture that never exits (mg.jsx:192-193).
 */
function exitStyle(rect, exit, frame) {
  const { role, to } = rect;
  // NOTE: furniture (structural && persistent, i.e. the rail) is handled by
  // the call site before either style function runs — never animated.
  if (isNone(exit && exit.pattern)) return {};
  const exitDur = role === "caption" ? CAPTION_EXIT_FRAMES : EXIT_DUR;
  const start = to - exitDur; // first frame of the exit window (opacity 1)
  if (frame <= start) return {};

  // p: 0 at the window start → 1 exactly at `to` (invisible).
  const p = ease(frame - start, [0, exitDur], [0, 1], E_IN);

  if (role === "caption") {
    // D3 caption — fade + scale → 0.97 over 3f (live: mg.jsx:426-427).
    return {
      opacity: 1 - p,
      scale: easeScale(frame - start, [0, exitDur], [1, CAPTION_EXIT_SCALE], E_IN),
      transformOrigin: "center",
    };
  }
  if (role === "headline" || role === "accent") {
    // D3 headline — fade only over D.short (the accent underline is glued
    // beneath the headline and must not detach, so it fades with it).
    return { opacity: 1 - p };
  }
  // D3 stage element — fade + translateY −12 over D.short.
  return { opacity: 1 - p, translateY: -STAGE_EXIT_OFFSET * p };
}

/**
 * The one positioning component. Children (primitives) receive position via
 * this wrapper only — see the module header for the full contract.
 */
export function Layer({ rect, enter, exit, frame: frameProp, style, children, ...rest }) {
  const frame = frameProp ?? useCurrentFrame();
  const { from, to } = rect;

  // Furniture (structural && persistent — the rail) never animates on either
  // side: entrance OR exit. Guarded here at the call site, not by spec luck,
  // so a rail layer carrying a non-NONE entrance pattern still holds at full
  // opacity for [from, to] (D5: rail is continuous).
  const isFurniture = rect.structural === true && rect.persistent === true;
  // Entrance progress is frame − from; exit uses the role window above.
  const ent = isFurniture ? {} : entranceStyle(enter && enter.pattern, frame - from);
  const ext = isFurniture ? {} : exitStyle(rect, exit, frame);

  // Visibility window: the layer is only on screen for frames [from, to]
  // (inclusive). The pattern clamps already hide pattern entrances before
  // `from`, but NONE/envelope patterns need this explicit guard.
  const inWindow = frame >= from && frame <= to;

  // Individual transform properties (§4.2): translateY composes
  // entrance + exit numerically so a settled RISE (0) can never shadow a
  // live stage exit (−12); scale multiplies (both default to 1).
  const translateY = (ent.translateY ?? 0) + (ext.translateY ?? 0);
  const scale = (ent.scale ?? 1) * (ext.scale ?? 1);
  const transformOrigin = ent.transformOrigin || ext.transformOrigin;

  return (
    <div
      {...rest}
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        opacity: inWindow ? (ent.opacity ?? 1) * (ext.opacity ?? 1) : 0,
        ...(translateY !== 0 ? { translate: `0px ${translateY}px` } : null),
        ...(scale !== 1 ? { scale } : null),
        ...(transformOrigin ? { transformOrigin } : null),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default Layer;
