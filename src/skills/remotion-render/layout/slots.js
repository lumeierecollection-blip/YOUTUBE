/**
 * LAYOUT-SYSTEM.md Part 3 — the slot tables. PURE data + geometry helpers.
 * No React, no Remotion: runs in node and in the bundle.
 *
 * §8.3 — every layout number lives here and nowhere else. Grep for a bare
 * integer in styles/ or beats/ and it should return nothing but frame counts.
 */

/** 8 px base grid + 12-column stage grid — §3.5 / §3.6, A1.1 / A1.2. */
export const GRID = { base: 8, cols: 12, col: 56, gutter: 8, pad: 40 };

/**
 * Shorts safe rect — §2.1 / MOTION-BLUEPRINT §2. Design to the Google numbers.
 * 12 × 56 + 11 × 8 + 2 × 40 = 840, so the safe width is exactly one stage.
 */
export const SAFE_SHORTS = { top: 288, bottom: 1248, left: 48, right: 888 };

/**
 * Longform safe rect — §3.2. Remotion's own floor (≥80 px sides, ≥100 px top
 * and bottom) scaled to 1920 wide → 160 px sides, 100 px vertically.
 */
export const SAFE_LONGFORM = { top: 100, bottom: 980, left: 160, right: 1760 };

/**
 * Where the atmosphere world draws its horizon (AtmosphereGround in
 * compositions/scenes/stage.jsx and every scene that stands in that world:
 * CinematicStatement's ridge/stake/ellipse stack in abstract-scenes.jsx,
 * TimelineScene's ground in structure-scenes.jsx). ONE horizon per frame —
 * this single constant is what keeps that true (§8.3: a layout number lives
 * here, not as `CANVAS_H * 0.6` in three scene files).
 *
 * DERIVED, NOT A TASTE — stage-16 gate FRM-02 / frame-audit.js failed five
 * CINEMATIC_STATEMENT frames (marginFg 0.80/0.02/1.13/1.27/0.14%) for
 * content crossing SAFE_SHORTS.bottom (1248), diagnosed per-probe in
 * data/audit/16/diagnose-margins.mjs: the headline-right margin (frame-
 * audit.js MARGINS: x940-1060, y964-1248) caught a solid full-width ridge
 * band. The previous value, CANVAS_H * 0.6 = 1152, put the ridge's dark
 * fill at output ≈ 1.06·(h − 56) .. 1.06·h + 50.25 (FAR plane, parallax
 * 0.14, settled DRIFT) = y1215-1271 — straddling 1248, so the part above
 * it leaked into the probe. (The +50.25 = motion-graphics.jsx's captionless
 * 110 px DesignSpace drop + Shot's settled scale 1.06 around y960 + camera
 * dy −15.36 + far-plane parallax +13.21. Confirmed by re-deriving the
 * measured band bottom, 1.06·1152+50.25 = 1271.4.)
 *
 * RAISING makes it worse (the band would sit INSIDE the y964-1248 probe —
 * measured up to ~20% coverage at h=1120), so the horizon moves DOWN until
 * the whole band is below the safe rect:
 *
 *   worst crest 1.06·(h − 56) + 50.25 ≥ 1248 + 3 (safe bottom + blur(3)
 *   edge spread)  →  h ≥ 1188.8  →  h = 1200 (= 150·8, grid §3.5)
 *
 * At 1200, worst-case output (drift-phase independent; both planes clear):
 *   far-plane ridge crest        1.06·1144 + 50.25 = 1262.9  (11.9 px clear)
 *   far-plane ridge horizon edge 1.06·1200 + 50.25 = 1322.3
 *   ground-plane horizon line    1.06·1200 + 37.04 = 1309.0  (k = 1, the
 *                              AtmosphereGround backdrop / TimelineScene)
 * (The fixture in run-lint.js checks the ground-plane value 1309.0 and the
 * crest 1262.9; the far-plane edge 1322.3 is the same h in the far plane.)
 *
 * The statement text stays inside the safe rect for both framings (HORIZON
 * output ≈ [926, 1033], ISOLATED ≈ [869, 937] — bottom edge CANVAS_H −
 * (h − stakeH) + 26 with stakeH = max(90, f.h·0.2), subject plane k = 1).
 *
 * Fine print — the band below 1248 is the world's GROUND (the floor the
 * shot stands on); the caption slot (1152-1248) is empty on captionless
 * channels, and the mark-fan alphas entering the bottom margin probe are a
 * separate pre-existing knife-edge (~±2 units from the audit's FG_DIFF at
 * a≈1, unchanged by this value). The haze top-stop 0.1·a in stage.jsx's
 * atmo-haze gradient is the other half of the same audit fix (top-margin
 * leak on frames 07/08) and must track this value in lockstep.
 */
export const ATMOSPHERE_HORIZON_Y = 1200;

/**
 * Part 3 — Shorts slot table. Absolute px in a 1080 × 1920 frame, derived
 * from the safe rect and the 8 px grid. These are the only positions that
 * exist in the system.
 *
 * Arithmetic (§3.1): kicker top 288 = safe top; rail bottom 288 + 960 = 1248
 * = safe bottom; caption bottom 1152 + 96 = 1248 = safe bottom; every slot
 * right edge ≤ 888 = safe right; every value an exact multiple of 8.
 *
 * Caption is bottom-anchored at 1248 and centred on the optical centre 468
 * (§3.4), so x = 468 − 380 = 88 and w = 760. A 2-line caption (2 × 64 × 1.12
 * ≈ 143 px) grows upward from the bottom into headline's lower 48 px (§3.7).
 */
export const SLOTS_SHORTS = {
  kicker: { x: 48, y: 288, w: 840, h: 72 },
  stage: { x: 48, y: 392, w: 840, h: 548 },
  headline: { x: 48, y: 964, w: 840, h: 176 },
  caption: { x: 88, y: 1152, w: 760, h: 96 },
  rail: { x: 48, y: 288, w: 4, h: 960 },
};

/** Part 3 — Longform slot table. Absolute px in a 1920 × 1080 frame. */
export const SLOTS_LONGFORM = {
  kicker: { x: 160, y: 100, w: 1600, h: 72 },
  stage: { x: 160, y: 196, w: 1600, h: 560 },
  headline: { x: 160, y: 780, w: 1600, h: 144 },
  caption: { x: 456, y: 884, w: 1008, h: 96 },
  rail: { x: 160, y: 100, w: 4, h: 824 },
};

/** §3.3 — the nine anchors. */
export const ANCHORS = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
];

/** §3.5 — snap a coordinate to the grid. Returns the snapped value + the displacement. */
export function snapToGrid(value, grid = GRID.base) {
  const snapped = Math.round(value / grid) * grid;
  return { snapped, displacement: Math.abs(snapped - value) };
}

/**
 * §3.6 — the stage is subdivided by the 12-column grid. Column i (0..11)
 * spans [columnX(i), columnX(i) + 56] in frame px. Chart bars, nodes, and
 * chips snap to column edges.
 */
export function columnX(index, table = SLOTS_SHORTS) {
  return table.stage.x + GRID.pad + index * (GRID.col + GRID.gutter);
}

/** Full bounds of a slot as { left, top, right, bottom }. */
export function slotBounds(slot) {
  return { left: slot.x, top: slot.y, right: slot.x + slot.w, bottom: slot.y + slot.h };
}

/**
 * §3.3 — the anchor point (x, y) inside a slot for one of the nine anchors.
 * Centring uses the slot's own centre (§3.4), never the frame centre.
 */
export function anchorPoint(slot, anchor) {
  const cx = slot.x + slot.w / 2;
  const cy = slot.y + slot.h / 2;
  switch (anchor) {
    case "top-left":
      return { x: slot.x, y: slot.y };
    case "top":
      return { x: cx, y: slot.y };
    case "top-right":
      return { x: slot.x + slot.w, y: slot.y };
    case "left":
      return { x: slot.x, y: cy };
    case "center":
      return { x: cx, y: cy };
    case "right":
      return { x: slot.x + slot.w, y: cy };
    case "bottom-left":
      return { x: slot.x, y: slot.y + slot.h };
    case "bottom":
      return { x: cx, y: slot.y + slot.h };
    case "bottom-right":
      return { x: slot.x + slot.w, y: slot.y + slot.h };
    default:
      throw new Error(`unknown anchor: ${anchor}`);
  }
}
