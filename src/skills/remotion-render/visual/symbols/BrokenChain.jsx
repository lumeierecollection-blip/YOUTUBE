import React from "react";

/**
 * Broken chain (conflict, a broken agreement): two links pulled apart, with the shards between.
 * A drawn symbol (visual/concept-classes.js SYMBOLS): one large monochrome shape in the channel accent
 * (`color`), filled — no outline, no shadow. 100 x 100 viewBox; `size` is the rendered edge in px.
 */
export function BrokenChain({ size = 400, color = "currentColor", style, ...rest }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill={color} stroke="none" style={{ display: "block", overflow: "visible", ...style }} {...rest}>
      <path fillRule="evenodd" d="M-11 -13 h22 a13 13 0 0 1 0 26 h-22 a13 13 0 0 1 0 -26 Z M-11 -6 h22 a6 6 0 0 1 0 12 h-22 a6 6 0 0 1 0 -12 Z" transform="translate(27 27) rotate(35)" />
      <path fillRule="evenodd" d="M-11 -13 h22 a13 13 0 0 1 0 26 h-22 a13 13 0 0 1 0 -26 Z M-11 -6 h22 a6 6 0 0 1 0 12 h-22 a6 6 0 0 1 0 -12 Z" transform="translate(73 73) rotate(35)" />
      <polygon points="46,36 54,32 51,44" />
      <polygon points="56,48 66,46 58,56" />
      <polygon points="40,52 47,56 38,64" />
    </svg>
  );
}
