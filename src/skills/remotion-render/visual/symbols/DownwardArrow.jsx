import React from "react";

/**
 * Downward arrow (decline, loss).
 * A drawn symbol (visual/concept-classes.js SYMBOLS): one large monochrome shape in the channel accent
 * (`color`), filled — no outline, no shadow. 100 x 100 viewBox; `size` is the rendered edge in px.
 */
export function DownwardArrow({ size = 400, color = "currentColor", style, ...rest }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill={color} stroke="none" style={{ display: "block", overflow: "visible", ...style }} {...rest}>
      <polygon points="50,94 94,50 66,50 66,6 34,6 34,50 6,50" />
    </svg>
  );
}
