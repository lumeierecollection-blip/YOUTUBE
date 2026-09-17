/**
 * SCENE TEXT — the chokepoint for every string an object-first scene draws.
 *
 * Plain .js, no JSX, no deps, same reason as narrative-typography.js: the
 * Remotion bundle imports it AND the node side (render.js's manifest,
 * local-visual-auditor.js) imports it directly, so the renderer, the
 * manifest and the auditor cannot drift apart.
 *
 * WHY THIS EXISTS — three real defects found in run 35261545735 (ch2,
 * barnes-v-felix), all with the same root cause: every scene hand-rolled
 * its own <text> nodes, so there was no place to enforce anything.
 *
 *  1. THE MANIFEST LIED ABOUT TEXT. render.js marked every object-first
 *     mechanism `renders_typography: false` with `text: []`, on the theory
 *     that only TypographyScene draws text. It does not. STATE_CHANGE drew
 *     TWO headline-weight lines plus THREE section labels; VISIBLE_CONSUMPTION
 *     drew a label, a headline and a sub-line. 5 of 6 beats reported no text
 *     while carrying most of the text in the video, so the local auditor's
 *     typography checks skipped exactly the beats that were violating them
 *     and reported "0 violations". Narrative typography was enforced only
 *     where it was already obeyed.
 *
 *  2. SETTLED TEXT WAS TRANSLUCENT. StateChangeScene drew its "expected"
 *     row as `fill={ed.text} opacity={0.7}` inside `<g opacity={0.65}>` =
 *     0.455 effective, at the SETTLED state (not a transient entrance), so
 *     a bright fill composited to rgb(77,77,87) on the near-black ground —
 *     2.30:1, well under AA, and the frame-audit gate rejected the render.
 *     This is the same translucent-text defect already fixed for eyebrows;
 *     it survived in the scene bodies because nothing stopped it.
 *
 *  3. ENGINE VOCABULARY REACHED THE SCREEN. "EXPECTED", "REALITY",
 *     "EXPECTED -> ACTUAL", "CONSUMED" were hardcoded <text> literals —
 *     internal mechanism vocabulary printed as section labels, which
 *     narrative typography prohibits outright and which tell the viewer
 *     nothing the visual is not already showing.
 *
 * THE RULE THIS MODULE MAKES STRUCTURAL
 *
 *   De-emphasis is a COLOUR, never an alpha. A scene expresses "this is
 *   secondary" by picking a quieter contrast-validated role, not by fading
 *   a bright one. Alpha is reserved for motion (entrances/exits), and even
 *   then the settled value must be 1.
 *
 * Deliberately NOT here: whether a phrase is GOOD. That stays with Gemini,
 * exactly as in narrative-typography.js. This module only decides what can
 * be measured — colour contrast, and which fields become on-screen text.
 */

/* ── WCAG contrast (same formula as scripts/frame-audit.js, COL-23) ──── */

function srgbChannel(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Parse #rgb / #rrggbb into [r,g,b]; returns null for anything else. */
export function parseHex(hex) {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export function toHex([r, g, b]) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return "#" + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
}

export function relLuminance(rgb) {
  const [r, g, b] = rgb;
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b);
}

/** WCAG 2.1 contrast ratio between two hex colours. 1.0 if either is bad. */
export function contrastRatio(aHex, bHex) {
  const a = parseHex(aHex);
  const b = parseHex(bHex);
  if (!a || !b) return 1;
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/* ── Contrast budgets ────────────────────────────────────────────────── */

/** The gate's own AA floor (scripts/frame-audit.js). Never lowered here. */
export const TEXT_AA_FLOOR = 4.5;

/**
 * Measured anti-aliasing loss between a text fill's FLAT colour and what
 * the frame-audit samples from the encoded MP4.
 *
 * Run 35261545735 gave two readings of the SAME fill (#F5536B, flat 5.74:1
 * against the ch2 ground) in one video: frame-02 sampled rgb(200,82,110) =
 * 4.47:1 and frame-03 sampled 5.60:1. The gate collects glyph pixels by
 * threshold, so a smaller/lighter glyph contributes proportionally more
 * anti-aliased edge pixels and reads darker; 4.47/5.74 = 0.778 is the worst
 * observed ratio. yuv420p chroma subsampling compounds it on saturated
 * reds against near-black.
 *
 * This is why a fill that is exactly AA-compliant when measured flat still
 * fails the gate: it has no headroom for its own edges. We give text real
 * headroom instead of relaxing the gate — the render genuinely gets more
 * legible, and the threshold the gate enforces is untouched.
 */
export const ANTIALIAS_SAMPLE_RATIO = 0.778;

/** Flat contrast a text fill needs so its SAMPLED value still clears AA. */
export const TEXT_TARGET_CONTRAST = +(TEXT_AA_FLOOR / ANTIALIAS_SAMPLE_RATIO).toFixed(2); // 5.78

/**
 * Accent text is the most exposed case: saturated hue, and the mechanisms
 * use it for the one line that carries the beat. A little more headroom
 * than the derived minimum so a channel whose declared accent sits right at
 * the boundary does not ship a render that depends on glyph size.
 */
export const ACCENT_TEXT_TARGET_CONTRAST = 6.5;

/**
 * Raise a text colour until it clears `target` against the ground, by
 * blending toward white in small steps.
 *
 * Blending toward white rather than substituting a different colour is what
 * keeps this compatible with the hard rule that colour lives in
 * channels.json (CHECK-REGISTER SCR-13): the result is DERIVED from the
 * channel's declared accent and keeps its hue, so channel identity is
 * preserved. Nothing here hardcodes a brand colour.
 *
 * Returns the original when it already clears the target, so a channel with
 * a bright accent renders exactly what it declared.
 */
export function ensureTextContrast(hex, bgHex, target = TEXT_TARGET_CONTRAST) {
  const rgb = parseHex(hex);
  const bg = parseHex(bgHex);
  if (!rgb || !bg) return hex;
  if (contrastRatio(hex, bgHex) >= target) return hex;

  // If the ground is light, darkening is the correct direction.
  const towardWhite = relLuminance(bg) < 0.5;
  const dest = towardWhite ? [255, 255, 255] : [0, 0, 0];

  let best = toHex(rgb);
  for (let step = 1; step <= 20; step++) {
    const t = step / 20;
    const mixed = toHex(rgb.map((c, i) => c + (dest[i] - c) * t));
    best = mixed;
    if (contrastRatio(mixed, bgHex) >= target) return mixed;
  }
  // Nothing in the ramp cleared it (a ground with almost no headroom).
  // Return the extreme rather than something that silently fails.
  return best;
}

/* ── Engine vocabulary ───────────────────────────────────────────────── */

/**
 * Internal mechanism vocabulary that must never be rendered. These were
 * literal <text> nodes in the scene bodies; they are section labels by
 * definition, and they describe the mechanism to the viewer instead of
 * letting the mechanism do its work.
 *
 * Matching is on the normalised form so "Expected -> Actual", "EXPECTED →
 * ACTUAL" and "expected→actual" are all caught.
 */
export const ENGINE_VOCABULARY = new Set([
  "expected", "reality", "actual", "expected actual", "consumed",
  "before", "after", "before after", "surface", "beneath",
  "surface beneath", "cause", "effect", "cause effect", "state change",
  "breakdown", "growth", "evidence", "proportional", "segment",
  "typography", "mechanism", "baseline", "projected",
  // Drawn as literal eyebrows in ActionConsequenceScene until run
  // 35261545735; "result" is the one the first test pass caught missing.
  "result", "outcome", "consequence", "total", "remaining", "left",
  "the real picture", "key fact", "takeaway",
]);

/** Normalise a label for vocabulary matching: strip arrows, punctuation, case. */
export function normaliseLabel(text) {
  return String(text || "")
    .replace(/[←-⇿]|->|=>/g, " ")   // arrows of any kind
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Is this string internal engine vocabulary rather than content? Used as an
 * assertion in the scenes and as a mechanical auditor check.
 */
export function isEngineVocabulary(text) {
  const norm = normaliseLabel(text);
  if (!norm) return false;
  return ENGINE_VOCABULARY.has(norm);
}

/* ── Text surfaces ───────────────────────────────────────────────────── */

/**
 * Which plan fields each mechanism draws as on-screen text, and in what
 * role. The renderer and the manifest both read this, so the manifest can
 * never again claim a beat is text-free while the scene draws five strings.
 *
 * Roles:
 *   "narrative" — the one line that carries the beat. Subject to the full
 *                 narrative-typography contract (one line, 2-7 words).
 *   "value"     — a figure/label that IS the evidence (a number, a unit).
 *                 Exempt from the word budget; it is data, not a phrase.
 *   "quiet"     — chrome: axis ticks, units, scale markers. Must be
 *                 contrast-validated but carries no narrative weight.
 *
 * A mechanism absent from this map draws no text at all.
 */
export const TEXT_SURFACES = {
  TYPOGRAPHY: [{ source: "beat.text", role: "narrative" }],
  STATE_CHANGE: [
    { source: "objects.expected.label", role: "narrative" },
    { source: "objects.actual.label", role: "narrative" },
  ],
  VISIBLE_CONSUMPTION: [
    { source: "objects.consumed.label", role: "value" },
    { source: "axis.ticks", role: "quiet" },
  ],
  EVIDENCE_FIGURE: [
    { source: "objects.figure.value", role: "value" },
    { source: "objects.figure.label", role: "narrative" },
    { source: "objects.figure.source", role: "quiet" },
  ],
  ACTION_CONSEQUENCE: [
    { source: "objects.cause.label", role: "narrative" },
    { source: "objects.effect.label", role: "narrative" },
  ],
  PHYSICAL_GROWTH: [
    { source: "objects.subject.label", role: "narrative" },
    { source: "axis.ticks", role: "quiet" },
  ],
  PROPORTIONAL_OBJECTS: [{ source: "objects.*.label", role: "value" }],
  STRUCTURAL_BREAKDOWN: [{ source: "objects.*.label", role: "value" }],
  SURFACE_AND_BENEATH: [
    { source: "objects.surface.label", role: "narrative" },
    { source: "objects.beneath.label", role: "narrative" },
  ],
};

/** Every mechanism that draws at least one "narrative"-role string. */
export function drawsNarrativeText(mechanism) {
  return (TEXT_SURFACES[mechanism] || []).some((s) => s.role === "narrative");
}

/**
 * The strings a beat will actually put on screen, for the render manifest.
 *
 * Returns [{ text, role, source }]. Pulls from the resolved scene the
 * renderer was handed, so it reflects what was drawn rather than what the
 * plan asked for. Engine vocabulary is reported with role "banned" rather
 * than dropped, so the auditor can fail on it instead of silently not
 * seeing it.
 */
export function sceneTextInventory(mechanism, scene, beatText) {
  const surfaces = TEXT_SURFACES[mechanism] || [];
  const objects = (scene && scene.objects) || [];
  const out = [];

  const push = (text, role, source) => {
    const t = String(text == null ? "" : text).trim();
    if (!t) return;
    out.push({ text: t, role: isEngineVocabulary(t) ? "banned" : role, source });
  };

  const findByHint = (hint) => {
    const h = hint.toLowerCase();
    return objects.find((o) =>
      o && (o.id === hint || o.role === hint ||
        (typeof o.role === "string" && o.role.toLowerCase().includes(h)) ||
        (typeof o.id === "string" && o.id.toLowerCase().includes(h))));
  };

  for (const surface of surfaces) {
    const { source, role } = surface;
    if (source === "beat.text") {
      push(beatText, role, source);
      continue;
    }
    if (source === "axis.ticks") continue;   // generated numerals, not content
    const m = /^objects\.([^.]+)\.(.+)$/.exec(source);
    if (!m) continue;
    const [, hint, field] = m;
    if (hint === "*") {
      for (const o of objects) push(o && o[field], role, source);
    } else {
      const obj = findByHint(hint);
      if (obj) push(obj[field], role, source);
    }
  }
  return out;
}
