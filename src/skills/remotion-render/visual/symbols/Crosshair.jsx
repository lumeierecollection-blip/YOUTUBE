import React from "react";

/**
 * Crosshair (target, search).
 * A drawn symbol (visual/concept-classes.js SYMBOLS): one large monochrome shape in the channel accent
 * (`color`), filled — no outline, no shadow. 100 x 100 viewBox; `size` is the rendered edge in px.
 */
export function Crosshair({ size = 400, color = "currentColor", style, ...rest }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill={color} stroke="none" style={{ display: "block", overflow: "visible", ...style }} {...rest}>
      <path fillRule="evenodd" d="M50 5 a45 45 0 1 0 0.01 0 Z M50 15 a35 35 0 1 1 -0.01 0 Z" />
      <rect x="46" y="0" width="8" height="34" />
      <rect x="46" y="66" width="8" height="34" />
      <rect x="0" y="46" width="34" height="8" />
      <rect x="66" y="46" width="34" height="8" />
      <circle cx="50" cy="50" r="6" />
    </svg>
  );
}
