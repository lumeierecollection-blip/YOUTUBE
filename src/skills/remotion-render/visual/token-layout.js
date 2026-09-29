/**
 * Where a beat's concept tokens sit (concept-visuals.js gives WHAT to draw,
 * this gives WHERE) — pure JS, no imports, so canvas-layout.js can call it
 * without a cycle and the tests can drive it directly.
 *
 * A token is a square. The composition has already placed its own elements
 * (headline, number, label, chart...), so a token goes in the largest square
 * the rest of the beat leaves empty: the search tries sizes from big to
 * small and, at the biggest size that fits anywhere, takes the free spot
 * closest to where the eye should land — the side of the frame OPPOSITE the
 * text's anchor, so the beat stays asymmetric. The secondary token, smaller,
 * takes the free spot nearest the primary.
 *
 * A token never overlaps another element: every existing box is inflated by
 * `gap` first. When no square of the minimum size is free the token is NOT
 * drawn (null) — the composition's own visual (a chart, a process, a photo)
 * is what the beat shows, and the resolver logs the omission. Nothing is
 * shrunk below the size at which the icon still reads, and nothing is
 * squeezed into text.
 */

const inter = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inflate = (b, g) => ({ x: b.x - g, y: b.y - g, w: b.w + 2 * g, h: b.h + 2 * g });

/**
 * @param occupied  [{x,y,w,h}] boxes already on the beat (backgrounds excluded by the caller)
 * @param count     how many tokens (1 or 2)
 * @param o.bounds  {x0,y0,x1,y1} the region a token may sit in
 * @param o.flip    1 when the text is right-anchored (so tokens prefer the left)
 * @returns array of `count` entries: {x,y,w,h,size} or null
 */
export function placeTokens(occupied, count, o = {}) {
  const { x0, y0, x1, y1 } = o.bounds;
  const gap = o.gap ?? 40, step = o.step ?? 12;
  const flip = o.flip ? 1 : 0;
  const primary = o.primary || [380, 220], secondary = o.secondary || [230, 150];
  const obstacles = (occupied || []).filter((b) => b && b.w > 0 && b.h > 0).map((b) => inflate(b, gap));
  const out = [];
  for (let i = 0; i < count; i++) {
    const [hi, lo] = i === 0 ? primary : [Math.min(secondary[0], Math.floor((out[0]?.size || secondary[0]) * 0.66)), secondary[1]];
    let best = null;
    for (let s = hi; s >= lo && !best; s -= 20) {
      let bestScore = Infinity;
      for (let x = x0; x + s <= x1 + 0.5; x += step) {
        for (let y = y0; y + s <= y1 + 0.5; y += step) {
          const r = { x, y, w: s, h: s };
          if (obstacles.some((b) => inter(r, b))) continue;
          let score;
          if (i === 0) {
            // The side opposite the text anchor, then the vertical middle of what is free.
            const idealX = flip ? x0 : x1 - s;
            score = Math.abs(x - idealX) * 1.0 + Math.abs(y - (o.idealY ?? (y0 + y1) / 2 - s / 2)) * 0.8;
          } else {
            // Beside (or under) the primary: the nearest free spot.
            const p = out[0];
            score = Math.hypot(x + s / 2 - (p.x + p.w / 2), y + s / 2 - (p.y + p.h / 2));
          }
          if (score < bestScore) { bestScore = score; best = { x, y, w: s, h: s, size: s }; }
        }
      }
    }
    if (best) { out.push(best); obstacles.push(inflate(best, gap)); } else out.push(null);
    // A secondary with no primary to sit beside is not drawn.
    if (!best && i === 0) { for (let k = 1; k < count; k++) out.push(null); break; }
  }
  return out;
}
