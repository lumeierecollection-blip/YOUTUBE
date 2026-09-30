import React from "react";

/**
 * Radar: two rings, a sweep and a blip.
 * A drawn symbol (visual/concept-classes.js SYMBOLS): one large monochrome shape in the channel accent
 * (`color`), filled — no outline, no shadow. 100 x 100 viewBox; `size` is the rendered edge in px.
 */
export function Radar({ size = 400, color = "currentColor", style, ...rest }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill={color} stroke="none" style={{ display: "block", overflow: "visible", ...style }} {...rest}>
      <path fillRule="evenodd" d="M50 4 a46 46 0 1 0 0.01 0 Z M50 10 a40 40 0 1 1 -0.01 0 Z" />
      <path fillRule="evenodd" d="M50 24 a26 26 0 1 0 0.01 0 Z M50 29 a21 21 0 1 1 -0.01 0 Z" />
      <path d="M50 50 L90 27 A46 46 0 0 0 50 4 Z" fillOpacity="0.4" />
      <circle cx="50" cy="50" r="5" />
      <circle cx="70" cy="30" r="4.5" />
    </svg>
  );
}
