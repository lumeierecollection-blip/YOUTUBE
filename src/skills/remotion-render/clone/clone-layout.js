/**
 * clone-layout — where everything goes in a clone shot. PURE geometry on the 1080x1920 frame, so legality is unit-tested without a browser.
 *
 * The clone family has ITS OWN legality rules (owner, 2026-10-15: the references' defining move is type and objects sharing the frame, which
 * the canvas engine's zone gates forbid; those gates are not loosened — they simply do not judge this family):
 *   CLONE-1  every box is inside the frame with a 40 px margin (a full-bleed picture is the one exception: it IS the frame)
 *   CLONE-2  display type never sits on a picture except on a SOLID plate (`bleed`), so its contrast is guaranteed by construction
 *   CLONE-3  the text region and the picture region do not overlap, except a bleed picture (under its plate)
 *   CLONE-4  the display region is tall enough for its type: at least 150 px
 */
export const FRAME = Object.freeze({ w: 1080, h: 1920 });
export const MARGIN = 40;

const rect = (x, y, w, h, extra = {}) => ({ x, y, w, h, ...extra });

/** Boxes for a treatment. `idx` alternates tilt and side so successive shots differ. */
export function treatmentBoxes(treatment, idx = 0) {
  const tilt = idx % 2 ? -1.6 : 1.6;
  switch (treatment) {
    case "bleed":
      return { hero: rect(0, 0, 1080, 1920, { bleed: true }), label: rect(60, 1196, 700, 44), text: rect(60, 1260, 960, 360, { align: "left", plated: true }), shape: { block: rect(60, 1676, 300, 16), bar: rect(60, 1676, 300, 16), stripe: rect(640, 0, 440, 96), rule: rect(60, 1176, 200, 6) } };
    case "framed":
      return { hero: rect(150, 320, 780, 975, { rot: tilt, mat: 22 }), label: rect(90, 1352, 900, 48), text: rect(90, 1420, 900, 300, { align: "center" }), shape: { block: rect(120, 360, 780, 975), bar: rect(390, 1780, 300, 20), stripe: rect(640, 0, 440, 96), rule: rect(90, 1330, 900, 6) } };
    case "disc":
      return { hero: rect(160, 300, 760, 760, { circle: true }), label: rect(90, 1100, 900, 48), text: rect(90, 1180, 900, 380, { align: "center" }), shape: { block: rect(120, 340, 760, 760), bar: rect(390, 1640, 300, 20), stripe: rect(640, 0, 440, 96), rule: rect(90, 1085, 900, 6) } };
    case "strip":
      return { hero: rect(0, 380, 1080, 700), label: rect(90, 1130, 700, 48), text: rect(90, 1210, 900, 420, { align: "left" }), shape: { block: rect(0, 1080, 1080, 24), bar: rect(90, 1700, 300, 20), stripe: rect(640, 0, 440, 96), rule: rect(90, 1112, 900, 6) } };
    case "inset-left":
      return { hero: rect(0, 260, 600, 1000), label: rect(640, 470, 380, 44), text: rect(640, 520, 380, 560, { align: "left" }), shape: { block: rect(40, 300, 560, 1000), bar: rect(640, 1130, 300, 20), stripe: rect(640, 0, 440, 96), rule: rect(640, 450, 380, 6) } };
    case "inset-right":
      return { hero: rect(480, 260, 600, 1000), label: rect(60, 470, 380, 44), text: rect(60, 520, 380, 560, { align: "right" }), shape: { block: rect(480, 300, 560, 1000), bar: rect(140, 1130, 300, 20), stripe: rect(640, 0, 440, 96), rule: rect(60, 450, 380, 6) } };
    case "plate":
    default:
      return { hero: rect(180, 380, 720, 720, { plate: true }), label: rect(90, 1160, 900, 48), text: rect(90, 1240, 900, 380, { align: "center" }), shape: { block: rect(140, 420, 720, 720), bar: rect(390, 1700, 300, 20), stripe: rect(640, 0, 440, 96), rule: rect(90, 1142, 900, 6) } };
  }
}

const inside = (b) => b.x >= MARGIN - 1e-6 && b.y >= MARGIN - 1e-6 && b.x + b.w <= FRAME.w - MARGIN + 1e-6 && b.y + b.h <= FRAME.h - MARGIN + 1e-6;
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Legality of one treatment's layout: [] when every CLONE rule holds. */
export function layoutProblems(treatment, idx = 0) {
  const B = treatmentBoxes(treatment, idx), out = [];
  for (const k of ["label", "text"]) if (!inside(B[k])) out.push(`${treatment}: ${k} box leaves the frame margin`);
  if (!B.hero.bleed && !inside({ ...B.hero, x: B.hero.x < MARGIN ? MARGIN : B.hero.x, w: Math.min(B.hero.w, FRAME.w - MARGIN - Math.max(B.hero.x, MARGIN)) }) && !(B.hero.x === 0 || B.hero.x + B.hero.w === FRAME.w)) out.push(`${treatment}: picture leaves the frame margin without running to an edge`);
  if (!B.hero.bleed && overlap(B.hero, B.text)) out.push(`${treatment}: display text overlaps the picture (only a plated bleed may)`);
  if (B.hero.bleed && !B.text.plated) out.push(`${treatment}: type over a full-bleed picture must sit on a solid plate`);
  if (B.text.h < 150) out.push(`${treatment}: display region ${B.text.h}px is too short for its type`);
  return out;
}

export const TREATMENTS = ["bleed", "framed", "disc", "strip", "inset-left", "inset-right", "plate"];
