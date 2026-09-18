/**
 * PLAN ADJUSTMENTS — Gemini SPECIFIES the change, the system MAKES it.
 *
 * Plain .js, no deps, same reason as narrative-typography.js and
 * scene-text.js: the node side (render-and-qa.js, gemini-frame-review.js)
 * and the tests all import it, so the directive vocabulary cannot drift.
 *
 * WHY THIS EXISTS
 *
 * The correction loop used to hand Gemini's review back to Gemini and ask
 * it to re-plan. That is Gemini making the change, and it does not
 * converge: run 35271777426 fed 28 then 38 corrections into two further
 * planning passes on channel 2, and the auditor's issue count went 12 -> 19
 * -> 16 while every attempt came back REJECTED. Re-prompting a model with
 * its own complaint re-rolls the dice; it does not enforce anything.
 *
 * The division of labour here is deliberate and narrow:
 *
 *   GEMINI   judges meaning and says WHAT must change, as a structured
 *            directive naming the beat, the field, and the new value.
 *   SYSTEM   applies that directive to the plan deterministically, then
 *            VERIFIES it actually took effect. An unapplied or unverifiable
 *            directive is a loud failure, never a silent no-op.
 *
 * So a rejected review does not become a suggestion. It becomes a plan edit
 * that provably happened.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *
 * Nothing invents content. Every directive that sets a value carries that
 * value FROM Gemini — the system never writes a phrase or a figure of its
 * own, because that would be fabricated on-screen content (the hard rule in
 * CLAUDE.md, and the reason "GASOLINE" / "REPORTED FIGURE" fallbacks were
 * removed from the renderer). The only thing the system decides on its own
 * is which mechanism to use when told to stop using text on a beat, and it
 * picks from the declared object-first set rather than inventing one.
 */


import { drawsNarrativeText } from "./scene-text.js";
/* ── Mechanism vocabulary ────────────────────────────────────────────── */

/** Mechanisms that render an object-first scene (no narrative phrase). */
export const OBJECT_FIRST_MECHANISMS = [
  "STATE_CHANGE",
  "EVIDENCE_FIGURE",
  "ACTION_CONSEQUENCE",
  "PHYSICAL_GROWTH",
  "VISIBLE_CONSUMPTION",
  "SURFACE_AND_BENEATH",
  "PROPORTIONAL_OBJECTS",
  "STRUCTURAL_BREAKDOWN",
];

export const ALL_MECHANISMS = ["TYPOGRAPHY", ...OBJECT_FIRST_MECHANISMS];

/**
 * Mechanisms that draw NO narrative-role text — their strings are figures
 * and units (role "value"/"quiet" in scene-text.js TEXT_SURFACES), which
 * are data rather than a phrase.
 *
 * Derived from TEXT_SURFACES rather than listed by hand, so adding a
 * narrative surface to a mechanism automatically removes it from the set a
 * text-free beat can be moved to.
 */
export const TEXT_FREE_MECHANISMS = OBJECT_FIRST_MECHANISMS.filter((m) => !drawsNarrativeText(m));

/** Object-label keys that render as narrative text rather than as data. */
const NARRATIVE_OBJECT_KEYS = ["label_a", "label_b", "cause", "effect", "surface", "beneath"];

/* ── Directive vocabulary ────────────────────────────────────────────── */

/**
 * The complete set of changes the system knows how to make.
 *
 * Kept small on purpose: every directive must be mechanically applicable
 * AND mechanically verifiable. A directive the system cannot verify is a
 * suggestion, and suggestions are what this module exists to replace.
 *
 *   per-beat (require `beat`):
 *     SET_MECHANISM       params.mechanism   — change how the beat is shown
 *     REMOVE_TYPOGRAPHY   (none)             — beat must draw no phrase
 *     SET_PHRASE          params.phrase      — replace the narrative phrase
 *     SET_FIGURE          params.figure      — replace the figure slot
 *     SET_OBJECT_LABEL    params.key, .label — replace one object label
 *
 *   whole-video (no `beat`):
 *     REDUCE_TEXT_BEATS     params.max      — at most N beats carry a phrase
 *     DIVERSIFY_MECHANISMS  params.minDistinct — at least N distinct mechanisms
 */
export const DIRECTIVES = {
  SET_MECHANISM: { scope: "beat", params: ["mechanism"] },
  REMOVE_TYPOGRAPHY: { scope: "beat", params: [] },
  SET_PHRASE: { scope: "beat", params: ["phrase"] },
  SET_FIGURE: { scope: "beat", params: ["figure"] },
  SET_OBJECT_LABEL: { scope: "beat", params: ["key", "label"] },
  REDUCE_TEXT_BEATS: { scope: "video", params: ["max"] },
  DIVERSIFY_MECHANISMS: { scope: "video", params: ["minDistinct"] },
};

/** Is this a directive the system can apply and verify? */
export function isKnownDirective(name) {
  return Object.prototype.hasOwnProperty.call(DIRECTIVES, name);
}

/**
 * Validate one directive's shape. Returns null when valid, else a reason.
 * Strictness here is the whole point: a malformed directive must be
 * reported, not quietly skipped.
 */
export function validateDirective(adj, beatCount) {
  if (!adj || typeof adj !== "object") return "not an object";
  const name = adj.directive;
  if (!isKnownDirective(name)) return `unknown directive "${name}"`;
  const spec = DIRECTIVES[name];
  const params = adj.params || {};

  if (spec.scope === "beat") {
    if (!Number.isInteger(adj.beat)) return `${name} requires an integer beat index`;
    if (adj.beat < 0 || adj.beat >= beatCount) return `${name} beat ${adj.beat} is out of range (0-${beatCount - 1})`;
  }
  for (const p of spec.params) {
    if (params[p] === undefined || params[p] === null || params[p] === "") {
      return `${name} requires params.${p}`;
    }
  }
  if (name === "SET_MECHANISM" && !ALL_MECHANISMS.includes(params.mechanism)) {
    return `SET_MECHANISM mechanism "${params.mechanism}" is not a known mechanism`;
  }
  if (name === "REDUCE_TEXT_BEATS" && !(Number.isInteger(params.max) && params.max >= 0)) {
    return "REDUCE_TEXT_BEATS params.max must be a non-negative integer";
  }
  if (name === "DIVERSIFY_MECHANISMS" && !(Number.isInteger(params.minDistinct) && params.minDistinct >= 1)) {
    return "DIVERSIFY_MECHANISMS params.minDistinct must be a positive integer";
  }
  return null;
}

/* ── Beat helpers ────────────────────────────────────────────────────── */

function beatMechanism(b) {
  return b.mechanism || b.treatment || (b.scene && b.scene.mechanism) || null;
}

function setBeatMechanism(b, mechanism) {
  b.mechanism = mechanism;
  if (b.treatment) b.treatment = mechanism;
  if (b.scene) b.scene.mechanism = mechanism;
}

/** Does this beat carry an on-screen narrative phrase? */
export function beatHasPhrase(b) {
  const td = b.typography_direction;
  const phrase = (td && td.phrase) || b.visual_headline || "";
  return String(phrase).trim().length > 0;
}

/**
 * Remove every NARRATIVE string from a beat — the typography phrase AND the
 * object labels that render as a phrase.
 *
 * Clearing only the phrase was not enough. Six of the nine mechanisms draw
 * narrative strings from objects.*.label, so a beat moved off TYPOGRAPHY
 * kept its two state labels and stayed a text beat under another name: run
 * 35293642808 applied REMOVE_TYPOGRAPHY on three consecutive attempts and
 * the auditor measured an identical text-beat share every time (67% ch2,
 * 100% ch9, 60% ch26). Figures and units are left alone — those are data,
 * not a phrase.
 */
function clearBeatPhrase(b) {
  b.typography_direction = null;
  b.visual_headline = "";
  if (b.scene && b.scene.typography) b.scene.typography = null;
  if (b.objects) {
    for (const key of NARRATIVE_OBJECT_KEYS) {
      if (b.objects[key]) b.objects[key] = "";
    }
  }
}

/* ── Apply ───────────────────────────────────────────────────────────── */

/**
 * Apply directives to a plan, in order, mutating a deep copy.
 *
 * Returns { plan, applied, rejected }. `rejected` entries carry a reason and
 * are NOT silently dropped — the caller is expected to surface them, because
 * a directive that could not be applied means the rejection was not acted
 * on.
 */
export function applyAdjustments(plan, adjustments) {
  const next = JSON.parse(JSON.stringify(plan));
  const beats = next.beats || [];
  const applied = [];
  const rejected = [];

  // LENGTH INVARIANT — captured before anything is touched.
  //
  // Video duration is set by the VOICEOVER, not by the visual plan
  // (render.js computeDurationFrames: frames = audioSeconds * fps +
  // AUDIO_TAIL_FRAMES). Enforcement only ever rewrites how a beat is SHOWN —
  // its mechanism, its phrase, its object labels — so it must never change
  // the beat count or any timing field. Asserting it here rather than
  // reasoning about it means a future directive that tried to add, drop or
  // retime a beat fails loudly instead of silently changing how long every
  // video runs.
  const lengthBefore = lengthSignature(next);

  for (const adj of adjustments || []) {
    const bad = validateDirective(adj, beats.length);
    if (bad) { rejected.push({ adj, reason: bad }); continue; }

    const p = adj.params || {};
    switch (adj.directive) {
      case "SET_MECHANISM": {
        const b = beats[adj.beat];
        setBeatMechanism(b, p.mechanism);
        // Moving OFF typography means the phrase must go with it, or the
        // beat would keep drawing text it no longer has a reason to draw.
        if (p.mechanism !== "TYPOGRAPHY") clearBeatPhrase(b);
        applied.push(adj);
        break;
      }
      case "REMOVE_TYPOGRAPHY": {
        const b = beats[adj.beat];
        clearBeatPhrase(b);
        // Move the beat onto a mechanism DESIGNED to carry itself without a
        // phrase. Emptying STATE_CHANGE's two labels leaves a scene built
        // around labels with nothing in them; a text-free mechanism draws
        // the idea with objects instead. Covers TYPOGRAPHY too, which would
        // otherwise render nothing at all.
        if (drawsNarrativeText(beatMechanism(b))) {
          setBeatMechanism(b, pickObjectFirst(beats, adj.beat));
        }
        applied.push(adj);
        break;
      }
      case "SET_PHRASE": {
        const b = beats[adj.beat];
        b.visual_headline = String(p.phrase);
        b.typography_direction = { ...(b.typography_direction || {}), phrase: String(p.phrase), single_line: true };
        applied.push(adj);
        break;
      }
      case "SET_FIGURE": {
        const b = beats[adj.beat];
        b.objects = { ...(b.objects || {}), figure: String(p.figure) };
        applied.push(adj);
        break;
      }
      case "SET_OBJECT_LABEL": {
        const b = beats[adj.beat];
        b.objects = { ...(b.objects || {}), [String(p.key)]: String(p.label) };
        applied.push(adj);
        break;
      }
      case "REDUCE_TEXT_BEATS": {
        // Strip phrases from the LOWEST-priority text beats until at most
        // `max` remain. Priority is the order Gemini listed them in
        // params.keep when given, else earliest-first (the hook is the beat
        // most worth keeping text on).
        const keep = Array.isArray(p.keep) ? p.keep.filter((i) => Number.isInteger(i)) : null;
        const textBeats = beats.map((b, i) => i).filter((i) => beatHasPhrase(beats[i]));
        const ranked = keep
          ? [...textBeats].sort((a, b) => (keep.indexOf(a) === -1 ? 1e9 : keep.indexOf(a)) - (keep.indexOf(b) === -1 ? 1e9 : keep.indexOf(b)))
          : textBeats;
        for (const i of ranked.slice(p.max)) {
          clearBeatPhrase(beats[i]);
          if (beatMechanism(beats[i]) === "TYPOGRAPHY") {
            setBeatMechanism(beats[i], pickObjectFirst(beats, i));
          }
        }
        applied.push(adj);
        break;
      }
      case "DIVERSIFY_MECHANISMS": {
        // Re-assign duplicated mechanisms to unused object-first ones until
        // the distinct count is met. Deterministic: walk beats in order and
        // give the first repeat of a mechanism the next unused one.
        const used = new Set(beats.map(beatMechanism).filter(Boolean));
        const unused = OBJECT_FIRST_MECHANISMS.filter((m) => !used.has(m));
        const seen = new Set();
        for (let i = 0; i < beats.length && new Set(beats.map(beatMechanism)).size < p.minDistinct; i++) {
          const m = beatMechanism(beats[i]);
          if (!seen.has(m)) { seen.add(m); continue; }
          const swap = unused.shift();
          if (!swap) break;
          setBeatMechanism(beats[i], swap);
          clearBeatPhrase(beats[i]);
        }
        applied.push(adj);
        break;
      }
      default:
        rejected.push({ adj, reason: `no applier for "${adj.directive}"` });
    }
  }
  // The invariant is not optional: if any directive changed the beat count
  // or a timing field, the edited plan is discarded rather than rendered.
  // A shorter or longer video is a worse outcome than an unenforced
  // rejection.
  const lengthAfter = lengthSignature(next);
  if (lengthAfter !== lengthBefore) {
    return {
      plan,                       // the ORIGINAL, untouched
      applied: [],
      rejected: [{
        adj: null,
        reason: `enforcement would have changed video length (${lengthBefore} -> ${lengthAfter}) — edits discarded`,
      }],
      lengthViolation: true,
    };
  }

  return { plan: next, applied, rejected };
}

/**
 * A stable fingerprint of everything that determines how long the video is.
 *
 * Beat count plus every timing field present on the beats. Compared as a
 * string so an added, removed, reordered or retimed beat all show up.
 */
function lengthSignature(plan) {
  const beats = plan?.beats || [];
  const timing = beats.map((b) => [
    b.start_frame ?? "", b.duration_frames ?? "",
    b.start_sec ?? "", b.duration_sec ?? "",
  ].join(":"));
  return `${beats.length}|${timing.join(",")}|${plan?.totalFrames ?? ""}|${plan?.durationSec ?? ""}`;
}

/**
 * Choose an object-first mechanism for a beat that must stop carrying text.
 *
 * Prefers one not already used in the video, so removing text does not
 * create a new monoculture; falls back to the least-used. Deterministic —
 * no randomness, so the same rejection always produces the same plan.
 */
function pickObjectFirst(beats, skipIndex) {
  // Only mechanisms that draw NO narrative-role text qualify.
  //
  // "Object-first" was the wrong filter: six of the nine mechanisms still
  // draw narrative strings from objects.*.label (STATE_CHANGE's two state
  // labels, ACTION_CONSEQUENCE's cause/effect, and so on), so a beat moved
  // off TYPOGRAPHY kept carrying text under a different name. That is why
  // run 35293642808 applied REMOVE_TYPOGRAPHY across three attempts and the
  // auditor measured an identical text-beat share every time — 67% on ch2,
  // 100% on ch9, 60% on ch26, never moving. Clearing the phrase is not
  // enough; the beat has to land on a mechanism whose text is data.
  const candidates = TEXT_FREE_MECHANISMS.length ? TEXT_FREE_MECHANISMS : OBJECT_FIRST_MECHANISMS;
  const counts = new Map(candidates.map((m) => [m, 0]));
  beats.forEach((b, i) => {
    if (i === skipIndex) return;
    const m = beatMechanism(b);
    if (counts.has(m)) counts.set(m, counts.get(m) + 1);
  });
  let best = candidates[0];
  let bestN = Infinity;
  for (const m of candidates) {
    const n = counts.get(m);
    if (n < bestN) { bestN = n; best = m; }
  }
  return best;
}

/**
 * Also strip the narrative-role object labels a mechanism would draw.
 *
 * clearBeatPhrase() only removes the typography phrase. A STATE_CHANGE beat
 * whose label_a/label_b survive is still a two-narrative-line beat, which is
 * the violation REMOVE_TYPOGRAPHY was issued to fix.
 */
function clearNarrativeObjectLabels(b) {
  if (!b.objects) return;
  for (const key of NARRATIVE_OBJECT_KEYS) {
    if (b.objects[key]) b.objects[key] = "";
  }
}

/* ── Verify ──────────────────────────────────────────────────────────── */

/**
 * Confirm each applied directive actually holds in the resulting plan.
 *
 * This is what makes the loop STRICT rather than hopeful. Applying an edit
 * and assuming it stuck is how the previous loop "handled" rejections; here
 * a directive that did not take effect is returned as a failure so the
 * caller can fail the attempt instead of rendering a plan that still has
 * the defect Gemini rejected.
 */
export function verifyAdjustments(plan, applied) {
  const beats = plan.beats || [];
  const failures = [];
  const distinct = () => new Set(beats.map(beatMechanism).filter(Boolean)).size;

  for (const adj of applied || []) {
    const p = adj.params || {};
    const b = Number.isInteger(adj.beat) ? beats[adj.beat] : null;
    switch (adj.directive) {
      case "SET_MECHANISM":
        if (beatMechanism(b) !== p.mechanism) {
          failures.push({ adj, reason: `beat ${adj.beat} mechanism is ${beatMechanism(b)}, expected ${p.mechanism}` });
        }
        break;
      case "REMOVE_TYPOGRAPHY":
        if (beatHasPhrase(b)) failures.push({ adj, reason: `beat ${adj.beat} still carries a phrase` });
        if (beatMechanism(b) === "TYPOGRAPHY") failures.push({ adj, reason: `beat ${adj.beat} is still TYPOGRAPHY with no phrase` });
        break;
      case "SET_PHRASE": {
        const got = (b.typography_direction && b.typography_direction.phrase) || b.visual_headline;
        if (String(got) !== String(p.phrase)) failures.push({ adj, reason: `beat ${adj.beat} phrase is "${got}", expected "${p.phrase}"` });
        break;
      }
      case "SET_FIGURE":
        if (String((b.objects || {}).figure) !== String(p.figure)) {
          failures.push({ adj, reason: `beat ${adj.beat} figure is "${(b.objects || {}).figure}", expected "${p.figure}"` });
        }
        break;
      case "SET_OBJECT_LABEL":
        if (String((b.objects || {})[p.key]) !== String(p.label)) {
          failures.push({ adj, reason: `beat ${adj.beat} objects.${p.key} is "${(b.objects || {})[p.key]}", expected "${p.label}"` });
        }
        break;
      case "REDUCE_TEXT_BEATS": {
        const n = beats.filter(beatHasPhrase).length;
        if (n > p.max) failures.push({ adj, reason: `${n} beats still carry a phrase, max ${p.max}` });
        break;
      }
      case "DIVERSIFY_MECHANISMS": {
        const d = distinct();
        if (d < p.minDistinct) {
          // Not always satisfiable: a 3-beat video cannot have 6 distinct
          // mechanisms. Report the ceiling so the caller can tell an
          // impossible demand from a failed application.
          const ceiling = Math.min(beats.length, ALL_MECHANISMS.length);
          failures.push({
            adj,
            reason: `${d} distinct mechanisms, asked for ${p.minDistinct}` +
              (p.minDistinct > ceiling ? ` (impossible: only ${beats.length} beats)` : ""),
            impossible: p.minDistinct > ceiling,
          });
        }
        break;
      }
    }
  }
  return { ok: failures.length === 0, failures };
}

/* ── Derive directives from objective findings ───────────────────────── */

/**
 * Turn the local auditor's MEASURED violations into directives the system
 * applies without asking anyone.
 *
 * This is the half of the split that needs no model. "83% of beats carry
 * text, max 40%" is arithmetic, and the fix is arithmetic too: strip text
 * from beats until the share is legal. Sending that to Gemini as prose and
 * hoping the next plan happens to comply is what produced three rejected
 * attempts in run 35271777426.
 *
 * Gemini is still required for anything that needs judgment — WHICH phrase,
 * WHICH figure — because those are values, and the system inventing a value
 * would be fabricating on-screen content.
 *
 * `keep` is passed on REDUCE_TEXT_BEATS so the earliest beats (the hook)
 * keep their text and the later filler loses it, rather than an arbitrary
 * choice.
 */
export function deriveAdjustments(plan, localAudit) {
  const beats = plan?.beats || [];
  if (!beats.length) return [];
  const typo = localAudit?.typography;
  const comp = localAudit?.plan_compliance;
  const out = [];

  // Text-beat share. TYPO_MAX_BEAT_SHARE is 0.4; the auditor reports the
  // measured share and the cap, so recompute the legal count from beats.
  const share = typo?.textBeatShare;
  if (typeof share === "number" && share > 0.4) {
    const max = Math.max(1, Math.floor(beats.length * 0.4));
    const textBeats = beats.map((b, i) => i).filter((i) => beatHasPhrase(beats[i]));
    if (textBeats.length > max) {
      out.push({
        directive: "REDUCE_TEXT_BEATS",
        params: { max, keep: textBeats.slice(0, max) },
        owner: "DIRECTION_QUALITY",
        reason: `${Math.round(share * 100)}% of beats carried text (max 40%) — typography must be selective`,
        source: "auditor",
      });
    }
  }

  // Mechanism monoculture. Aim for a distinct count that is achievable:
  // never more than the beat count, and never more than the vocabulary.
  const distinctNow = new Set(beats.map(beatMechanism).filter(Boolean)).size;
  const target = Math.min(beats.length, ALL_MECHANISMS.length, Math.max(4, Math.ceil(beats.length * 0.7)));
  if (comp?.monoculture === true || distinctNow < target) {
    out.push({
      directive: "DIVERSIFY_MECHANISMS",
      params: { minDistinct: target },
      owner: "DIRECTION_QUALITY",
      reason: `${distinctNow} distinct mechanism(s) across ${beats.length} beats — the same composition repeated reads as a template`,
      source: "auditor",
    });
  }

  // Beats drawing more than one narrative line: drop the phrase entirely.
  // One thought per beat is the rule, and when the plan asked for two the
  // object-first mechanism is the one that should carry the beat.
  for (const iss of (typo?.issues || [])) {
    if (iss.beat == null) continue;
    if (!/narrative lines|text blocks/.test(iss.problem || "")) continue;
    if (out.some((a) => a.directive === "REMOVE_TYPOGRAPHY" && a.beat === iss.beat)) continue;
    out.push({
      directive: "REMOVE_TYPOGRAPHY",
      beat: iss.beat,
      owner: "PLAN_COMPLIANCE",
      reason: iss.problem,
      source: "auditor",
    });
  }

  return out;
}

/** One-line summary of what a directive does, for logs and reports. */
export function describeDirective(adj) {
  const p = adj.params || {};
  const where = Number.isInteger(adj.beat) ? `beat ${adj.beat}` : "whole video";
  switch (adj.directive) {
    case "SET_MECHANISM": return `${where}: show it as ${p.mechanism}`;
    case "REMOVE_TYPOGRAPHY": return `${where}: draw no on-screen phrase`;
    case "SET_PHRASE": return `${where}: phrase -> "${p.phrase}"`;
    case "SET_FIGURE": return `${where}: figure -> "${p.figure}"`;
    case "SET_OBJECT_LABEL": return `${where}: objects.${p.key} -> "${p.label}"`;
    case "REDUCE_TEXT_BEATS": return `whole video: at most ${p.max} beats carry text`;
    case "DIVERSIFY_MECHANISMS": return `whole video: at least ${p.minDistinct} distinct mechanisms`;
    default: return `${where}: ${adj.directive}`;
  }
}
