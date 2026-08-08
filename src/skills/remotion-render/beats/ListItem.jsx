import React from "react";
import { Audio, Easing, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { D, MG_TYPE } from "../compositions/beats.js";
import { Chip } from "../primitives/Chip.jsx";
import { mixColor } from "../compositions/mg-style.js";

// ── Motion curves ─ Layer D2/D3 shared values (see Statement.jsx).
const E_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const E_IN = Easing.bezier(0.55, 0.055, 0.675, 0.19);

function ease(frame, inputRange, outputRange, easing = E_OUT) {
  return interpolate(frame, inputRange, outputRange, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
}

function easeScale(frame, inputRange, outputRange, easing = E_OUT) {
  return interpolate(frame, inputRange, outputRange, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
    output: "perceptual-scale",
  });
}

/** D2.1 POP — scale 0 → 1.15 → 1.00 over D.base, opacity 0 → 1 over 3 f. */
function popStyle(frame, start) {
  const rel = frame - start;
  return {
    opacity: ease(rel, [0, 3], [0, 1], E_OUT),
    scale: easeScale(rel, [0, 5, D.base], [0, 1.15, 1], E_OUT),
    transformOrigin: "center",
  };
}

function dbToVolume(db) {
  return Math.pow(10, db / 20);
}

// ── Geometry ─ A4 LIST_ITEM (DETAIL-REFERENCE:238-251) + F3 (MANUAL:1009-1028):
//    the chip column is inset 40 from the stage's left (= caption.x = 88
//    Shorts), width = stage.w − 80 (= caption.w = 760), chips 88 px tall,
//    pitched 88 px, bottom-anchored at the stage bottom (stage.y + stage.h).
const CHIP_INSET = 40; // F3 x=88 = stage.x(48) + 40
const CHIP_H = 88; // F3 "88 px pitch"; legacy chip height 88
const CHIP_PITCH = 88; // F3 "prior items shift up by 88 px"
const SHIFT_FRAMES = 9; // A4 row 3 "translate up 88 px (drag 2) | 9, stagger 2"; F3 window tA−4→tA+5 = 9 f
const SHIFT_DRAG = 2; // A4 "(drag 2)" — the shift starts 2 f after the new chip's POP (tA−2)
const SHIFT_STAGGER = 2; // A4 "9, stagger 2" / F3 "staggered 2 frames" — per-chip, up the stack
const DIM_FRAMES = 6; // A4 row 4 "textPrimary→textDim | 6"
const MAX_VISIBLE = 4; // F3 "Max 4 visible"
const BADGE_SIZE = 48; // legacy badge 48×48 circle
const BADGE_BORDER = 3; // legacy 3 px stroke
const BADGE_WINDOW = 6; // A4/F3 "badge takes accent … returns to stroke" (6 f)
const BADGE_RETURN = 3; // A4 "tA+6 badge returns to stroke 3"
const DROP_RISE = 12; // stageExitStyle — translateY −12 on the drop
const CLICK_DB = -24; // A4/F3 "ui/click_001.ogg −24 dB"
const CLICK_FILE = "sfx/ui/click_001.ogg";
const CLICK_AT = 2; // A4/F3 "tA+2"

/**
 * LIST_ITEM — chips only (the wiring renders kicker/rail/caption; the
 * component renders chips only). Each item pops into the stack's bottom slot
 * at its own tA−4 (D2.1 POP); the prior chips translate up 88 px over 9 f
 * E_OUT (drag 2 — the shift starts 2 f after the newcomer's POP; staggered
 * 2 f per chip — the chip directly above the newcomer moves first) while
 * their text flips textPrimary → textDim over 6 f; the new
 * chip's numeral badge takes accent for [tA, tA+6) then returns to stroke
 * over 3 f; one ui/click_001.ogg (−24 dB) fires at tA+2 per chip; max 4
 * visible — a 5th chip drops the oldest with a 6 f E_IN fade + translateY
 * −12 (stageExitStyle).
 * HOLD (A4.1): the last visual event is the lowest surviving chip's final
 * shift — the newcomer's badge return completes tA+9, the highest chip's
 * shift completes tA−2+2·(N−2)+9, and a dropped chip is frozen and gone by
 * entrance+6. For the 5-item run fixture (anchors 10/15/20/25/30) chip 1's
 * shift completes frame 41 → hold begins 41 (C17 41/42). Single-chip beats:
 * hold begins tA+9 (the badge return). The tA+2 click is audio, not a
 * visual event.
 */
export function ListItem({
  rects = {},
  stage,
  colors,
  anchorFrame = 0,
  frame: frameProp,
  items = [],
  fontFamily = "Inter",
  ...rest
}) {
  const frame = frameProp ?? useCurrentFrame();
  const stageBottom = stage.y + stage.h;

  const entranceOf = (it) => Math.max((Number(it.anchor) || 0) - D.micro, 0); // tA−4

  const lastArrived = (() => {
    let i = -1;
    for (let k = 0; k < items.length; k++) {
      if (entranceOf(items[k]) <= frame) i = k;
    }
    return i;
  })();

  if (lastArrived < 0) return null;
  const dropIdx = lastArrived - MAX_VISIBLE; // the 5th chip drops the oldest

  const x = stage.x + CHIP_INSET;
  const chipW = stage.w - CHIP_INSET * 2;

  const chips = [];
  for (let k = 0; k <= lastArrived; k++) {
    const it = items[k];
    const tA = Number(it.anchor) || 0;
    const entrance = entranceOf(it);
    const dropping = lastArrived >= MAX_VISIBLE && k === dropIdx;
    const dropStart = dropping ? entranceOf(items[lastArrived]) : 0;
    if (dropping && frame >= dropStart + D.short) continue; // dropped chip is gone at rest

    // POP (D2.1) from the chip's own entrance.
    const pop = popStyle(frame, entrance);

    // Shift: every arrival i > k moves chip k up one pitch; each shift runs
    // SHIFT_FRAMES (9 f) starting SHIFT_DRAG (2 f) after the newcomer's POP,
    // with a SHIFT_STAGGER per chip up the stack — the chip directly above the
    // newcomer moves first. (A dropping chip does not shift; its restTop is
    // frozen at lastArrived−1 and translateY is suppressed below.)
    let shiftPx = 0;
    for (let i = k + 1; i <= lastArrived; i++) {
      const startShift = entranceOf(items[i]) + SHIFT_DRAG + SHIFT_STAGGER * (i - 1 - k);
      shiftPx += CHIP_PITCH * (1 - ease(frame - startShift, [0, SHIFT_FRAMES], [0, 1], E_OUT));
    }

    // Dim: textPrimary → textDim over DIM_FRAMES from the next arrival.
    const dimProg = k < lastArrived ? ease(frame - entranceOf(items[k + 1]), [0, DIM_FRAMES], [0, 1], E_OUT) : 0;

    // Drop: 6 f E_IN fade + translateY −12 (stageExitStyle).
    const dropP = dropping ? ease(frame - dropStart, [0, D.short], [0, 1], E_IN) : 0;
    const dropFade = dropping ? ease(frame - dropStart, [0, D.short], [1, 0], E_IN) : 1;

    // Badge: accent for [tA, tA+6) (1-frame instant switch at tA), then
    // returns to stroke over 3 f (A4 "badge returns to stroke 3").
    const badgeProg = ease(frame - (tA + BADGE_WINDOW), [0, BADGE_RETURN], [0, 1], E_OUT);
    const badgeAccent = frame >= tA && frame < tA + BADGE_WINDOW;
    const borderColor =
      badgeAccent ? colors.accent : badgeProg < 1 ? mixColor(colors.accent, colors.stroke, badgeProg) : colors.stroke;
    const badgeText = badgeAccent ? colors.accent : colors.textPrimary;
    const textColor = k === lastArrived ? colors.textPrimary : mixColor(colors.textPrimary, colors.textDim, dimProg);

    // Rest position: the newest chip (k = lastArrived) sits at the stage
    // bottom (top = stageBottom − 88); each chip above is one pitch higher
    // (legacy shiftBase = 940 − (lastArrived−1−k)·88 as a CSS bottom maps to
    // stageBottom − (lastArrived−k)·88 − 88 in top coordinates). A dropping
    // chip freezes at the position it held when the 5th chip arrived
    // (lastArrived − 1) — it fades in place, it does not shift.
    const restTop = stageBottom - (lastArrived - (dropping ? 1 : 0) - k) * CHIP_PITCH - CHIP_H;
    const translateY = (dropping ? 0 : shiftPx) - DROP_RISE * dropP;

    chips.push(
      <div
        key={`${k}-${it.text}`}
        data-role="chip"
        data-index={k}
        data-text={it.text}
        data-anchor={it.anchor}
        style={{
          position: "absolute",
          left: x,
          top: restTop,
          width: chipW,
          height: CHIP_H,
          opacity: pop.opacity * dropFade,
          ...(pop.scale !== 1 ? { scale: pop.scale } : null),
          ...(translateY !== 0 ? { translate: `0 ${translateY}px` } : null),
          transformOrigin: "center",
        }}
      >
        <Chip colors={colors} style={{ width: "100%", height: "100%" }}>
          <div
            style={{
              width: BADGE_SIZE,
              height: BADGE_SIZE,
              borderRadius: BADGE_SIZE / 2,
              flex: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "transparent",
              border: `${BADGE_BORDER}px solid ${borderColor}`,
              boxSizing: "border-box",
              fontSize: MG_TYPE.label, // 32
              fontWeight: 800,
              color: badgeText,
            }}
          >
            {k + 1}
          </div>
          <span
            style={{
              flex: "1 1 auto",
              fontSize: MG_TYPE.body, // 52 — w700
              fontWeight: 700,
              color: textColor,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {it.text}
          </span>
        </Chip>
      </div>
    );

    chips.push(
      <Sequence key={`click-${k}`} from={tA + CLICK_AT} durationInFrames={60}>
        <Audio src={staticFile(CLICK_FILE)} volume={dbToVolume(CLICK_DB)} />
      </Sequence>
    );
  }

  return (
    <div {...rest} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0 }}>
      {chips}
    </div>
  );
}

export default ListItem;
