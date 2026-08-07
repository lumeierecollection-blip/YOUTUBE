/**
 * primitives/Icon.jsx — MANUAL A4 icons: the vendored Lucide set, rendered
 * per A4.2/A4.3 stroke arithmetic.
 *
 *   <Layer rect={…}> <Icon colors={colors} name="flame" /> </Layer>
 *
 * A4.2/A4.3: inner geometry comes from the vendored ICON_INNER table
 * (compositions/icons-data.js, generated — DO NOT EDIT); stroke/fill/size
 * are applied at render time. Apparent stroke must land between 6 and 12 px
 * at 1080-wide: `strokeWidth = strokeAttr(size)` (mg-style.js, A4.3).
 * Sizes are exactly ICON_SIZES = [64, 120, 180, 240] (A4.4).
 *
 * Contract: NEVER positions itself — the wrapping Layer owns position. Icon
 * fills its Layer box (square icon slot); the 24×24 viewBox keeps the glyph
 * square and centred inside whatever the compiled rect gives it.
 *
 * TRACE (D2.5): `TraceIcon` runs the draw-on interior motion (evolvePath,
 * 10 f per subpath, staggered D.micro, opacity ramp over D.short) — the
 * primitive-side motion Layer's envelope leaves to DRAW/GROW/TRACE
 * primitives (Layer.jsx header). The Layer still owns the entrance/exit
 * envelope on top.
 *
 * No shadows (A5.2); no brand logos (A4.8).
 */

import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { evolvePath, getSubpaths } from "@remotion/paths";
import { ICON_INNER } from "../compositions/icons-data.js";
import { strokeAttr } from "../compositions/mg-style.js";
import { D, EASE_DECELERATE } from "../compositions/beats.js";

const E_OUT = EASE_DECELERATE;

/** A4.3 — extract the d attributes from the vendored inner markup. */
function extractPathDs(inner) {
  const out = [];
  const re = /<path d="([^"]+)"/g;
  let m;
  while ((m = re.exec(inner || ""))) out.push(m[1]);
  return out;
}

/** Static icon — live renderer Icon() (motion-graphics.jsx:304-320). */
export function Icon({ name, size, color, sw, ...rest }) {
  const inner = ICON_INNER[name];
  if (!inner) return null;
  return (
    <svg
      {...rest}
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={sw ?? strokeAttr(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

/**
 * D2.5 TRACE — evolve each subpath, 10 f each, staggered D.micro. One per
 * video (live TraceIcon, motion-graphics.jsx:323-350). `start` is the
 * beat-relative frame the draw begins on; `frame` defaults to
 * useCurrentFrame() (probes pass it explicitly).
 */
export function TraceIcon({ name, size, color, sw, start, frame: frameProp, ...rest }) {
  const frame = frameProp ?? useCurrentFrame();
  const inner = ICON_INNER[name];
  const subpaths = [];
  for (const d of extractPathDs(inner)) {
    for (const sp of getSubpaths(d)) subpaths.push(sp);
  }
  if (subpaths.length === 0) return <Icon name={name} size={size} color={color} sw={sw} {...rest} />;
  return (
    <svg
      {...rest}
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={sw ?? strokeAttr(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: easeOpacity(frame - start) }}
    >
      {subpaths.map((sp, i) => {
        const s0 = start + i * (10 + D.micro);
        const { strokeDasharray, strokeDashoffset } = evolvePath(easeProgress(frame - s0), sp);
        return <path key={i} d={sp} strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />;
      })}
    </svg>
  );
}

/** Clamped E_OUT ramp over D.short — live TraceIcon opacity (mg.jsx:341). */
function easeOpacity(rel) {
  return interpolate(rel, [0, D.short], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: E_OUT });
}

/** Clamped E_OUT progress over 10 f — live TraceIcon subpath (mg.jsx:345). */
function easeProgress(rel) {
  return interpolate(rel, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: E_OUT });
}

export default Icon;
