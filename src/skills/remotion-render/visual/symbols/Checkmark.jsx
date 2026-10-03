import React from "react";

/**
 * Check mark (verification, approval).
 * A drawn symbol (visual/concept-classes.js SYMBOLS): one large monochrome shape in the channel accent
 * (`color`), filled — no outline, no shadow. 100 x 100 viewBox; `size` is the rendered edge in px.
 */
export function Checkmark({ size = 400, color = "currentColor", style, ...rest }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill={color} stroke="none" style={{ display: "block", overflow: "visible", ...style }} {...rest}>
      <polygon points="5,54 22,37 40,55 78,13 95,30 40,89" />
    </svg>
  );
}
