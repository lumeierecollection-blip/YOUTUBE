/**
 * Layout constants and pure layout math.
 *
 * PURE .js ON PURPOSE — no React, no JSX, no Remotion.
 *
 * These lived in scenes/primitives.jsx, which meant nothing outside the
 * Remotion bundle could read them: node cannot import .jsx, so the test
 * suite had to parse the source as TEXT with a regex to recover SAFE and
 * CAPTION_RESERVE_Y. That worked until a scene's real geometry stopped
 * matching the constants the test was re-deriving, at which point the check
 * was verifying numbers the renderer no longer drew and still passing.
 *
 * Anything a test, a gate or mg-package.js might need to reason about
 * belongs here rather than in a component file. primitives.jsx re-exports
 * these so existing scene imports keep working unchanged.
 */

/** Design-space canvas. Matches DesignSpace in motion-graphics.jsx. */
export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

/** Safe rect (MOTION-GRAPHICS-MANUAL A1) — never draw meaning outside this. */
export const SAFE = { left: 48, right: 888, top: 288, bottom: 1248 };

/**
 * How far the stage drops when captions are off, reclaiming the band they
 * used to occupy.
 */
export const CAPTION_RESERVE_Y = 110;

/** The stage band: above the caption zone, below the headline zone. */
export const STAGE = { x: 48, y: 300, w: 840, h: 820 };
export const STAGE_CX = STAGE.x + STAGE.w / 2; // 468 — the real optical centre
export const STAGE_CY = STAGE.y + STAGE.h / 2;

/** Where a DOCUMENT_EVIDENCE page starts, in design space. */
export const DOCUMENT_PAGE_TOP = 300;

/**
 * Page geometry per DOCUMENT_EVIDENCE variant.
 *
 * Three genuinely different documents: a filing, a wider order with the
 * operative clause near the top, and a long opinion with it buried.
 */
export const DOCUMENT_PAGES = [
  { w: 560, h: 660, lines: 17, clause: 9, lead: 31 },
  { w: 620, h: 580, lines: 12, clause: 4, lead: 37 },
  { w: 500, h: 690, lines: 22, clause: 16, lead: 25 },
];

/** Space reserved below the page for the pulled-out clause. */
const CLAUSE_BLOCK = 140;

/**
 * The pulled-out clause is set WIDER than the page — it hangs 30px past each
 * edge so the accent rule beside it sits outside the page's own margin. That
 * overhang is real drawn geometry, so the page's horizontal clamp has to
 * budget for it; otherwise a page pinned flush to SAFE.left puts the clause
 * rule at x=18, thirty pixels into the unsafe margin.
 */
const CLAUSE_OVERHANG = 30;

/**
 * The page's real drawn geometry, for one variant and one shot frame.
 *
 * ONE MODEL, TWO CALLERS — the scene and the safe-rect test. The test used
 * to recompute this from the constants above, which was correct right up
 * until the scene began scaling the page to the shot; after that the test
 * was checking a geometry the renderer had abandoned.
 *
 * The page scales with the shot because a CLOSE framing means the camera is
 * near the document, and a page that ignores its framing reads as a
 * thumbnail of evidence rather than as evidence. The scale is CLAMPED so
 * the page plus the clause beneath it always fits the safe rect — the
 * clamp, not a hope, is what keeps the check true.
 */
export function documentPageGeometry(variant, f) {
  const page = DOCUMENT_PAGES[variant % DOCUMENT_PAGES.length];
  const availableH = SAFE.bottom - CAPTION_RESERVE_Y - DOCUMENT_PAGE_TOP - CLAUSE_BLOCK;
  const availableW = SAFE.right - SAFE.left;
  const wanted = f && f.w ? f.w / 620 : 1;
  const scale = Math.max(0.75, Math.min(wanted, availableH / page.h, availableW / page.w));
  const pageW = page.w * scale;
  const pageH = page.h * scale;
  const cx = f && Number.isFinite(f.cx) ? f.cx : CANVAS_W / 2;
  // Kept inside the safe rect horizontally even when the shot's anchor is
  // off-centre: an off-centre framing must not push evidence off the page.
  // Clamped against the CLAUSE, not the page, because the clause is the
  // wider of the two.
  const px = Math.max(
    SAFE.left + CLAUSE_OVERHANG,
    Math.min(cx - pageW / 2, SAFE.right - pageW - CLAUSE_OVERHANG),
  );
  const py = DOCUMENT_PAGE_TOP;
  // Line pitch follows the page so body copy fills it at any scale.
  const lead = (pageH - 150) / Math.max(page.lines, 1);
  // The clause block, as the scene actually draws it: 40px under the page,
  // overhanging both edges. Returned rather than re-derived at the call site
  // so the scene and the safe-rect check cannot disagree about where it is.
  const clause = {
    x: px - CLAUSE_OVERHANG,
    y: py + pageH + 40,
    w: pageW + CLAUSE_OVERHANG * 2,
    h: CLAUSE_BLOCK - 40,
  };
  return { page, scale, pageW, pageH, px, py, lead, clause, clauseBlock: CLAUSE_BLOCK };
}
