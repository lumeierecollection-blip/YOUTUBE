/**
 * The pop compositor's element groups (owner's spec 2026-10-02; full-canvas.jsx PopGroups
 * draws them). Pure — no React — so it is unit-tested (scripts/test-entity-sync.mjs).
 *
 * A beat is shown as GROUPS: the full-bleed photo (if any), the top-zone band and the
 * middle-zone band. Each pops in place, staggered; with word-level sync
 * (visual/entity-sync.js, scheduled in render.js) the group holding the entity visual pops
 * on its word instead.
 */
import { flattenBoxes, ZONES, CAPTION } from "./canvas-layout.js";

export const POP = Object.freeze({ IN: 6, OUT: 6, STAGGER: 8, START: 1, S0: 0.94, OVER: 1.04 });
export const PHOTO_COMPS = ["SCENE-FULL", "ARCHITECTURE", "DOCUMENT", "MONEY"];
// The bands the groups are clipped to (zones; the middle runs to the caption
// row so a descender within ZONE_TOL is not cut).
const BANDS = { top: [0, ZONES.top[1]], middle: [ZONES.middle[0], CAPTION.y - 10] };
/** The element groups of a beat, in arrival order, with their pop pivots. */
export function popGroups(c, L) {
  const photo = !!c.photo && PHOTO_COMPS.includes(L.composition);
  const groups = [];
  if (photo) groups.push({ key: "photo", show: "body", clip: null, cx: 540, cy: 960 });
  for (const [band, [y0, y1]] of Object.entries(BANDS)) {
    const kb = flattenBoxes(L.boxes).filter(([k, b]) => b && b.w > 0 && b.h > 0 && k !== "photo" && b.role !== "shape" && b.y + b.h / 2 >= y0 && b.y + b.h / 2 < y1);
    if (!kb.length) continue;
    const bs = kb.map(([, b]) => b);
    const x0 = Math.min(...bs.map((b) => b.x)), x1 = Math.max(...bs.map((b) => b.x + b.w));
    const t0 = Math.min(...bs.map((b) => b.y)), t1 = Math.max(...bs.map((b) => b.y + b.h));
    // A group of only furniture (a rule, a kicker, a folio) is minor: it pops
    // AFTER the group holding the real element, or the frame is near-empty
    // until the statement arrives (CI run 36985423031 ch-44: frames 6-8 of
    // two boundaries held only a hairline rule).
    const major = kb.some(([k, b]) => !/^(rule|kicker|folio|end|line)/.test(k) && b.role !== "rule" && b.role !== "data");
    groups.push({ key: band, show: photo ? "header" : "all", clip: [y0, y1], cx: (x0 + x1) / 2, cy: (t0 + t1) / 2, major });
  }
  // Arrival order: the photo, then major groups (top before middle), then minor ones.
  const order = [...groups.filter((g) => g.key === "photo"), ...groups.filter((g) => g.key !== "photo" && g.major), ...groups.filter((g) => g.key !== "photo" && !g.major)];
  // Word-level sync (visual/entity-sync.js, scheduled in render.js): the group holding the
  // entity visual — the full-bleed photo, or the band of the portrait / cutout / hero
  // number — pops at the frame its word is spoken; the others keep their order from the
  // beat's start (headline first). Not when nothing else would be on screen meanwhile
  // (the pop-transitions rule: no empty frame).
  const ek = entityGroupKey(c, L, groups);
  if (ek && c.entity_pop && Number.isFinite(c.entity_pop.frame) && order.some((g) => g.key !== ek && g.major)) {
    const rest = order.filter((g) => g.key !== ek).map((g, i) => ({ ...g, at: i * POP.STAGGER }));
    return [...rest, { ...order.find((g) => g.key === ek), at: Math.max(0, c.entity_pop.frame - POP.START), entity: true }];
  }
  return order.map((g, i) => ({ ...g, at: i * POP.STAGGER }));
}
// The group that holds the beat's entity visual, or null.
export function entityGroupKey(c, L, groups) {
  const kind = c.entity_pop?.kind;
  if (!kind) return null;
  if (kind === "photo") return groups.some((g) => g.key === "photo") ? "photo" : null;
  const box = kind === "portrait" ? L.boxes.portrait : kind === "cutout" ? L.boxes.cutout0 : kind === "number" ? L.boxes.number : null;
  if (!box) return null;
  const cy = box.y + box.h / 2;
  const band = Object.entries(BANDS).find(([, [y0, y1]]) => cy >= y0 && cy < y1)?.[0];
  return band && groups.some((g) => g.key === band) ? band : null;
}
