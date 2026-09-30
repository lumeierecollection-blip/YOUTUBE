import React from "react";

/**
 * Warning triangle with an exclamation mark cut out of it.
 * A drawn symbol (visual/concept-classes.js SYMBOLS): one large monochrome shape in the channel accent
 * (`color`), filled — no outline, no shadow. 100 x 100 viewBox; `size` is the rendered edge in px.
 */
export function WarningTriangle({ size = 400, color = "currentColor", style, ...rest }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill={color} stroke="none" style={{ display: "block", overflow: "visible", ...style }} {...rest}>
      <path fillRule="evenodd" d="M50 7 L97 90 L3 90 Z M45 34 h10 v30 h-10 Z M50 69 a6 6 0 1 0 0.01 0 Z" />
    </svg>
  );
}
