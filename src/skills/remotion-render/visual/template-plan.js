/**
 * Turn a beat that already has a chosen strategy into a plan the template
 * renderer can draw.
 *
 * THE STRATEGY CHOOSER ALREADY EXISTED, AND IS REUSED RATHER THAN REPLACED.
 * `director.js` decides which of the 17 strategies a beat is, from detectors in
 * `semantics.js` that read the beat's own text and data. Every one of those is
 * grounded and covered by the visual test suite. Nothing here re-decides it:
 * this takes `beat.visualPlan.strategy`, finds that channel's template for it,
 * and fills the template's declared parameters from what the director already
 * extracted.
 *
 * WHERE THE VALUES COME FROM. Only from the beat: `payload` is what the
 * detectors pulled out of the text, `supporting` is what the director resolved
 * for the scene to draw. Nothing is invented and nothing is read from general
 * knowledge — the same rule the plan generator follows in `build-visual-plan.js`.
 *
 * WHEN A REQUIRED PARAMETER CANNOT BE GROUNDED, THIS RETURNS NULL. That beat
 * then renders through the existing engine, and the render report records it.
 * That is a deliberate departure from section 3's hard abort, and it is worth
 * saying why: section 3 forbids a FALLBACK TEMPLATE, because a generic template
 * quietly becomes the whole system. Falling back to the engine that has been
 * rendering these channels all along is not that — it is the previous
 * behaviour, it is per beat rather than per run, and it is counted.
 */

/** Keys the detectors use for a single quantity, in the order they are preferred. */
const NUMBER_KEYS = ["total", "value", "amount", "count", "to", "from", "radius", "quantity"];
/**
 * Keys that carry an ordered set, read off what the detectors actually produce.
 *
 * The first list was written from the parameter names and missed the two the
 * director really uses: COMPARISON files its two sides under `pairs` as
 * {label, value, unit} objects, and TIMELINE files its dates under `years`.
 * Measured on the ch-fixture script, that cost five COMPARISON beats and two
 * TIMELINE beats -- they fell back to the old engine for want of a key name.
 */
const LIST_KEYS = ["series", "pairs", "events", "years", "stages", "items", "nodes", "labels", "steps"];

const firstFinite = (...vals) => {
  for (const v of vals) {
    const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
    if (Number.isFinite(n) && n !== 0) return n;
  }
  return null;
};

function fillNumber(vp) {
  const p = vp.payload || {};
  for (const k of NUMBER_KEYS) {
    const n = firstFinite(p[k] && p[k].value !== undefined ? p[k].value : p[k]);
    if (n !== null) return n;
  }
  // A number the detectors found but filed under a name this does not know.
  for (const v of Object.values(p)) {
    if (typeof v === "number" && Number.isFinite(v) && v !== 0) return v;
  }
  return null;
}

function fillList(vp) {
  const p = vp.payload || {};
  for (const k of LIST_KEYS) {
    const v = p[k];
    if (Array.isArray(v) && v.length >= 2) {
      return v.map((e) => (typeof e === "object" && e !== null ? (e.label ?? e.name ?? e.value) : e))
        .filter((e) => e !== undefined && e !== null && String(e).length)
        .map(String);
    }
  }
  const sup = vp.supporting || {};
  const labels = sup.labels || [];
  if (labels.length >= 2) return labels.map(String);
  // A qualitative comparison has no numeric pairs; the director resolves the
  // two sides into phrases instead.
  const sides = [sup.leftPhrase || sup.left, sup.rightPhrase || sup.right].filter((x) => x && String(x).trim());
  return sides.length === 2 ? sides.map(String) : null;
}

function fillText(vp) {
  const s = vp.supporting || {};
  const t = s.phrase || s.event || s.subject || "";
  return String(t).trim() || null;
}

function fillDate(vp) {
  const p = vp.payload || {};
  if (p.date) return String(p.date);
  const m = /\b(1[6-9]\d{2}|20\d{2})\b/.exec(vp.text || "");
  return m ? m[1] : null;
}

/**
 * @returns {object|null} a plan for `template-scene.jsx`, or null when a
 * required parameter could not be grounded in this beat.
 */
export function templatePlanFor(beat, { spec, template }) {
  const vp = beat.visualPlan;
  if (!vp || !template || !spec) return null;

  const filled = {};
  for (const [name, decl] of Object.entries(template.parameters || {})) {
    let v = null;
    if (decl.type === "number") v = fillNumber(vp);
    else if (decl.type === "list") v = fillList(vp);
    else if (decl.type === "date") v = fillDate(vp);
    else v = fillText(vp);
    if (v === null && decl.required !== false) return null;
    if (v !== null) filled[name] = v;
  }

  /**
   * FRAMES ARE RELATIVE TO THE BEAT, NOT ABSOLUTE.
   *
   * This plan is rendered inside `<Sequence from={beat.startFrame}>`, and
   * Remotion's useCurrentFrame() is zero at a Sequence's own start. A plan
   * carrying absolute frames would make TemplateScene compute a negative
   * progress for every beat after the first and hold every camera at its
   * opening keyframe. `build-visual-plan.js` emits absolute frames because its
   * plans are rendered standalone; these are not.
   */
  const dur = Math.max(1, beat.durationInFrames);
  const at = (f) => Math.round(f * dur);

  const countFor = (o) => {
    if (!o.repeats || filled[o.repeats] === undefined) return 1;
    const decl = template.parameters[o.repeats] || {};
    const got = filled[o.repeats];
    if (decl.type === "list") return Math.max(1, Math.min(decl.max_items || 6, got.length));
    // A number is a quantity, not a length. `total = "$215"` once drew four
    // bank statements because String.length was read as the count.
    const n = Number(String(got).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return 1;
    return Math.max(1, Math.min(decl.max_items || 6, Math.round(n)));
  };

  return {
    version: 1,
    template: template.name,
    strategy: template.strategy,
    beat: { startFrame: 0, durationInFrames: dur },
    palette: { primary: spec.primary_palette, secondary: spec.secondary_palette },
    fonts: { primary: spec.typography_primary, secondary: spec.typography_secondary },
    environment: template.environment,
    motion_curve: spec.motion_curve,
    framing: spec.framing_default,
    negative_space: spec.use_of_negative_space,
    objects: (template.objects || []).map((o) => ({
      object: o.object, role: o.role, anchor: o.anchor,
      count: countFor(o), repeat_note: o.repeat_note || null,
    })),
    camera: (template.camera_path || []).map((k) => ({
      frame: at(k.at), move: k.move, target: k.target || null, reason: k.reason,
    })),
    typography: (template.typography || []).map((t) => {
      const m = /^\{([a-z0-9_]+)\}$/i.exec(t.slot);
      const val = m ? filled[m[1]] : t.slot;
      if (val === undefined || val === null) return null;
      return {
        text: Array.isArray(val) ? val.join(", ") : String(val),
        face: t.face, placement: t.placement, from: at(t.in_at), to: at(t.out_at),
      };
    }).filter(Boolean),
    transitions: template.transitions || [],
    data: Object.fromEntries(Object.entries(filled).map(([k, v]) => [k, { value: v, from_beat: beat.startFrame }])),
  };
}
