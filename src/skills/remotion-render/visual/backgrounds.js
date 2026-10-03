/**
 * The studio ground: uniform white on every beat of every video on every
 * channel (owner's decision, 2026-09-30 — it replaced the per-channel
 * gradients and the dark hook / CTA variant, which were wrong).
 *
 * No tint, no gradient, no vignette, no shadow overlay, no darkening: one
 * solid colour. Charts, maps and type render on it; a full-bleed photo beat
 * covers it for its own beat and the white returns on the next beat.
 *
 * Pure JS so the renderer (full-canvas.jsx, studio-bg.jsx), the render verify
 * (scripts/render-and-qa.js) and the audit read the same value.
 */
export const GROUND = "#FFFFFF";
