import React from "react";

/**
 * Upward arrow (growth, gain).
 * A drawn symbol (visual/concept-classes.js SYMBOLS): one large monochrome shape in the channel accent
 * (`color`), filled — no outline, no shadow. 100 x 100 viewBox; `size` is the rendered edge in px.
 */
export function UpwardArrow({ size = 400, color = "currentColor", style, ...rest }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill={color} stroke="none" style={{ display: "block", overflow: "visible", ...style }} {...rest}>
      <polygon points="50,6 94,50 66,50 66,94 34,94 34,50 6,50" />
    </svg>
  );
}
