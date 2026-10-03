/**
 * Plan caps — the two distribution rules every visual plan must satisfy
 * BEFORE it is written to disk, shared by both planners
 * (scripts/local-visual-plan.cjs, scripts/gemini-visual-plan.js).
 *
 *   1. TYPOGRAPHY appears on 1 or 2 beats — never 0, never more than 2.
 *      The hook (beat 0) is always one of them.
 *   2. No mechanism (TYPOGRAPHY included) covers more than 40% of beats.
 *
 * These used to be enforced only in plan-adjustments.js, which runs inside
 * the QA correction loop — and --skip-qa bypasses that loop, so CI rendered
 * plans that broke both rules (ch-12: text on 50% of beats, logged as a
 * warning and rendered anyway). Here they are applied unconditionally and
 * the result is re-checked; a plan that still violates them throws.
 *
 * Where the guarantee stops: this caps the MECHANISM LABEL of each beat.
 * Whether a reassigned beat's objects/labels suit its new mechanism is the
 * director's job (applyDirective builds the scene from the mechanism).
 */

const TYPOGRAPHY = "TYPOGRAPHY";
const MAX_SHARE = 0.4;

// Mechanisms the director's applyDirective() knows how to build. Beats
// reassigned by the cap are only ever moved INTO one of these.
const REASSIGN_POOL = [
  "ACTION_CONSEQUENCE",
  "STATE_CHANGE",
  "EVIDENCE_FIGURE",
  "PROPORTIONAL_OBJECTS",
  "PHYSICAL_GROWTH",
  "VISIBLE_CONSUMPTION",
  "SURFACE_AND_BENEATH",
];

function capLimits(n) {
  // floor(0.4n) beats is the most any one mechanism may hold. TYPOGRAPHY's
  // own ceiling is min(2, that) — a 4-beat plan can only carry 1.
  const maxPer = Math.max(1, Math.floor(n * MAX_SHARE));
  return { maxPer, typoMax: Math.min(2, maxPer) };
}

function countOf(mechs) {
  const c = {};
  for (const m of mechs) c[m] = (c[m] || 0) + 1;
  return c;
}

function pickReplacement(mechs, i, exclude, maxPer) {
  const counts = countOf(mechs);
  const neighbours = new Set([mechs[i - 1], mechs[i + 1]]);
  const candidates = REASSIGN_POOL
    .filter((m) => m !== exclude && (counts[m] || 0) < maxPer)
    .sort((a, b) => {
      // Prefer a mechanism the neighbours aren't using, then the least used.
      const na = neighbours.has(a) ? 1 : 0;
      const nb = neighbours.has(b) ? 1 : 0;
      if (na !== nb) return na - nb;
      return (counts[a] || 0) - (counts[b] || 0);
    });
  return candidates[0] || null;
}

/**
 * Enforce both caps on an array of mechanism names.
 * Returns { mechanisms, changes } — changes lists every beat that moved.
 * Throws if the plan is too short to satisfy the 40% rule at all.
 */
function enforceCaps(mechanisms) {
  const n = mechanisms.length;
  if (n < 3) {
    throw new Error(`plan has ${n} beat(s) — the 40% mechanism cap needs at least 3`);
  }
  const { maxPer, typoMax } = capLimits(n);
  const out = mechanisms.map((m) => m || null);
  const changes = [];
  const set = (i, m, why) => {
    if (out[i] !== m) {
      changes.push({ beat: i, from: out[i], to: m, why });
      out[i] = m;
    }
  };

  // Every beat must carry a mechanism before the caps can be counted.
  for (let i = 0; i < n; i++) {
    if (!out[i]) {
      throw new Error(`beat ${i} has no mechanism — the planner must assign one`);
    }
  }

  // Rule 1a: the hook is TYPOGRAPHY.
  set(0, TYPOGRAPHY, "hook is always TYPOGRAPHY");

  // Rule 1b: at most typoMax TYPOGRAPHY beats. Keep the hook, and prefer to
  // keep the last beat (the CTA); strip the rest from the middle outwards.
  let typo = out.map((m, i) => (m === TYPOGRAPHY ? i : -1)).filter((i) => i >= 0);
  const keep = new Set([0]);
  if (typoMax >= 2 && typo.includes(n - 1)) keep.add(n - 1);
  for (const i of typo) {
    if (keep.size >= typoMax) break;
    keep.add(i);
  }
  for (const i of typo) {
    if (keep.has(i)) continue;
    const r = pickReplacement(out, i, TYPOGRAPHY, maxPer);
    if (!r) throw new Error(`no mechanism has room to take beat ${i} off TYPOGRAPHY`);
    set(i, r, `TYPOGRAPHY capped at ${typoMax}`);
  }

  // Rule 2: no mechanism over floor(40%). Move excess beats, latest first,
  // into the least-used pool mechanism that still has room.
  for (let guard = 0; guard < n * 4; guard++) {
    const counts = countOf(out);
    const over = Object.keys(counts).find((m) => counts[m] > maxPer);
    if (!over) break;
    let moved = false;
    for (let i = n - 1; i >= 1; i--) {
      if (out[i] !== over) continue;
      const r = pickReplacement(out, i, over, maxPer);
      if (!r) continue;
      set(i, r, `${over} exceeded 40% (max ${maxPer} of ${n})`);
      moved = true;
      break;
    }
    if (!moved) throw new Error(`cannot bring ${over} under the 40% cap`);
  }

  assertCaps(out);
  return { mechanisms: out, changes };
}

/** Throws if the mechanism list breaks either rule. */
function assertCaps(mechanisms) {
  const n = mechanisms.length;
  const { maxPer } = capLimits(n);
  const counts = countOf(mechanisms);
  const typo = counts[TYPOGRAPHY] || 0;
  if (typo < 1 || typo > 2) {
    throw new Error(`TYPOGRAPHY count ${typo} violates the 1–2 rule (${n} beats)`);
  }
  for (const [m, c] of Object.entries(counts)) {
    if (c > maxPer) {
      throw new Error(`${m} on ${c}/${n} beats exceeds 40% (max ${maxPer})`);
    }
  }
  return counts;
}

function describe(mechanisms) {
  return Object.entries(countOf(mechanisms))
    .sort((a, b) => b[1] - a[1])
    .map(([m, c]) => `${m}:${c}`)
    .join(" ");
}

module.exports = { enforceCaps, assertCaps, capLimits, describe, TYPOGRAPHY, REASSIGN_POOL };
