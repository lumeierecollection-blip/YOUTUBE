/**
 * PALETTE ROLES — which of a channel's declared colours is the ground, the
 * paper, the mark on each, and the accent.
 *
 * ONE MODEL, TWO CALLERS, the same rule this repo already applies to
 * `cameraSafe` and `planeOffset`. The renderer resolves these roles to draw a
 * frame; `scripts/build-visual-plan.js` resolves them to print the section-5
 * plan document. When they were separate the plan document lied: it reported
 * the caption colour as `primary_palette[2]`, an index, while the renderer
 * derived it. On ch-09 that index is the blue accent and the renderer used a
 * near-white — a plan describing a frame that was never rendered.
 *
 * Plain .js, no JSX, so a node script can import it without a bundler.
 */

/**
 * The colours an object draws with.
 *
 * THE SPECIFICATION GIVES FOUR ORDERED COLOURS AND NO ROLES, so the roles are
 * DERIVED BY MEASUREMENT rather than by index. Reading role from position would
 * only work because of how these three were transcribed, and the schema
 * promises nothing of the kind.
 *
 * Two bugs, both found by looking at a rendered frame, shaped what is here.
 *
 * 1. THE ACCENT WAS PICKED BY HSV SATURATION, which is (max-min)/max. A
 *    near-black navy is highly saturated by that measure: #0A1A2E scores 0.78
 *    against #3B82F6's 0.76, so ch-09 chose a colour indistinguishable from its
 *    own ground as its accent and the whole map rendered black-on-black. An
 *    accent is a colour that is visibly colourful, which is ABSOLUTE chroma,
 *    (max-min)/255 — 0.14 for the navy against 0.73 for the blue.
 *
 * 2. THERE WAS ONE MARK COLOUR FOR TWO DIFFERENT BACKDROPS. `ink` was taken as
 *    the darkest entry in the pool, which on a dark channel is the ground
 *    itself: ch-02 and ch-09 both resolved ink and ground to the same hex, so
 *    their captions were drawn in the background colour and did not exist. A
 *    mark is only legible relative to what it sits on, and this renderer has
 *    two surfaces — the paper an object establishes for itself, and the
 *    environment ground. So there are two mark colours, each chosen for
 *    contrast against its own surface.
 *
 * An object picks by the surface it draws on: one that lays down its own sheet
 * (a statement, a legal document) marks it with `ink`; one drawn straight onto
 * the environment (terrain, a border line, a keypad on a desk) marks with
 * `onGround`. Where an object sits on top of ANOTHER object's paper — ch-02's
 * folder over its document stack — it uses `ink`, and that is a real limitation
 * rather than a rule: place that folder alone on a dark ground and it will be
 * hard to see. Nothing checks it, because the renderer cannot know what a
 * template stacked.
 */
export function paletteRoles(palette) {
  const lum = (h) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };
  /** Absolute chroma — how much colour is present, independent of how dark. */
  const chroma = (h) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  };
  /** WCAG 2.1 relative luminance and contrast ratio — an external standard, not a threshold of ours. */
  const chan = (c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4));
  const rl = (h) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [rl(a), rl(b)].sort((p, q) => q - p);
    return (hi + 0.05) / (lo + 0.05);
  };

  const primary = palette.primary;
  const accent = [...primary].sort((a, b) => chroma(b) - chroma(a))[0];
  const nonAccent = primary.filter((h) => h !== accent);
  // The ground is the channel's real backdrop: the entry furthest toward either
  // end of the luminance range, which is what a backdrop is.
  const ground = [...nonAccent].sort(
    (a, b) => Math.max(lum(b), 1 - lum(b)) - Math.max(lum(a), 1 - lum(a))
  )[0];
  const pool = [...nonAccent, ...palette.secondary].filter((h) => h !== accent);
  // Paper is the lightest surface the palette offers. It is NOT required to
  // contrast with the ground: ch-01 is white sheets on a white desk, which is
  // what a desk flatlay looks like, and the sheets read by their outline.
  const paper = [...pool].sort((a, b) => lum(b) - lum(a))[0];
  const ink = [...pool].sort((a, b) => ratio(b, paper) - ratio(a, paper))[0];
  const onGround = [...pool].sort((a, b) => ratio(b, ground) - ratio(a, ground))[0];

  /**
   * A palette that cannot produce a legible mark is a specification error, and
   * the render aborts rather than emitting a frame that looks like a blank
   * background. 4.5:1 is WCAG 2.1 AA for body text; the three specified
   * channels clear it by more than three times (15.5 to 17.1), and the two
   * failures this catches scored exactly 1.0 — the mark and its backdrop were
   * the same hex.
   */
  const MIN_RATIO = 4.5;
  for (const [mark, surface, what] of [[ink, paper, "ink on paper"], [onGround, ground, "onGround on ground"]]) {
    const r = ratio(mark, surface);
    if (r < MIN_RATIO) {
      throw new Error(
        `palette cannot render ${what}: ${mark} on ${surface} is ${r.toFixed(2)}:1, below WCAG AA 4.5:1.\n` +
        `primary=[${primary.join(", ")}] secondary=[${palette.secondary.join(", ")}]\n` +
        `Fix the channel's palette in config/visual-identity.json — do not relax this, an unreadable frame is worse than no frame.`
      );
    }
  }

  return { ground, paper, ink, onGround, accent };
}
