import React from "react";
import { Easing, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { D, MG_TYPE } from "../compositions/beats.js";
import Layer from "../layers/Layer.jsx";

function dbToVolume(db) {
  return Math.pow(10, db / 20);
}

// ── Motion curves ─ Layer D2/D3 shared values (see Statement.jsx).
const E_OUT = Easing.bezier(0.16, 1, 0.3, 1);

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

/**
 * A2 "raised floor" counter — the counter never spends a frame below the
 * floor above the highest place value (e.g. 47 → floor 10, so the counter
 * reads 10..47, never 0..9). Honest: the counter only ever shows values
 * it actually reached (progress 0 → the floor itself, 1 → the value).
 */
export function raisedFloor(value) {
  const abs = Math.abs(Math.trunc(value));
  if (!Number.isFinite(abs) || abs < 10) return 0;
  return 10 ** (String(abs).length - 1);
}

/** A2 counter text — same shape as the live renderer's counterText. */
export function formatCounter(value, progress) {
  if (!Number.isFinite(value)) return "0";
  const floor = raisedFloor(value);
  const shown = Math.min(value, floor + (value - floor) * progress);
  const rounded = Number.isInteger(value) ? Math.round(shown) : Math.round(shown * 10) / 10;
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * HERO_NUMBER — split-overline: the numeral counts 47 (A2: raised floor,
 * D.push-long E_OUT ramp) at the stage centre; the unit ("%") travels in
 * the compiled headline layer (RISE@anchor+8, rect.from = tA+8) below the
 * stage. Value never renders a floor it didn't reach (SFR-ENC-9-6). One
 * ui/click_004.ogg at dbToVolume(−22) fires on the settle frame tA+56
 * (start + D.push — F1 E4.2: SFX lands on the visual settle, never on the
 * word).
 * HOLD (A4.1): nothing moves after the count reaches the value on tA+56
 * (start + D.push) — the numeral opacity/scale settle tA+5 and the unit
 * headline (RISE@anchor+8) settles tA+17; the tA+56 click is audio, not a
 * visual event. C17 pair (tA+55, tA+56).
 */
export function HeroNumber({
  rects = {},
  stage,
  colors,
  anchorFrame = 0,
  frame: frameProp,
  value = 0,
  unit = "",
  fontFamily = "Inter",
  ...rest
}) {
  const frame = frameProp ?? useCurrentFrame();
  const tA = Math.max(anchorFrame, 0);
  const start = Math.max(tA - D.micro, 0);
  const headline = rects.headline;
  const cx = stage.x + stage.w / 2;
  const cy = stage.y + stage.h / 2;

  const p = ease(frame - start, [0, D.push], [0, 1], E_OUT);
  const counter = formatCounter(value, p);
  const opacity = ease(frame - start, [0, D.short], [0, 1], E_OUT);
  const scale = easeScale(frame - start, [0, D.base], [0.92, 1], E_OUT);

  return (
    <div {...rest} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0 }}>
      <span
        data-role="numeral"
        data-value={value}
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          translate: "-50% -50%",
          fontSize: MG_TYPE.hero, // 220 — w800
          fontWeight: 800,
          color: colors.accent,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          opacity,
          ...(scale !== 1 ? { scale } : null),
          transformOrigin: "center",
        }}
      >
        {counter}
      </span>

      <Sequence from={start + D.push} durationInFrames={60}>
        <Audio src={staticFile("sfx/ui/click_004.ogg")} volume={dbToVolume(-22)} />
      </Sequence>

      {headline ? (
        <Layer
          rect={headline}
          enter={headline.enter}
          exit={headline.exit}
          frame={frame}
          data-rect-id={headline.id}
          data-role={headline.role}
        >
          <span
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              fontSize: headline.fontSize,
              lineHeight: `${headline.h}px`,
              fontWeight: 800, // MG_TYPE headline — w800
              color: colors.textPrimary,
              whiteSpace: "nowrap",
              textAlign: "center",
            }}
          >
            {headline.text}
          </span>
        </Layer>
      ) : null}
    </div>
  );
}

export default HeroNumber;
