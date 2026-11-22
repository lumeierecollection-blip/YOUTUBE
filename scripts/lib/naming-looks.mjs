/**
 * The naming check's second look (scripts/gemini-frame-review.js --naming-check). Pure, so it is tested without a model.
 *
 * A beat that fails the first look is read again from a DIFFERENT frame of the same beat. It stays failed only if it fails again: a real
 * misspelling is on the screen at both times, a one-off misread of small type ("95 million euros" read as "curos", board 38047691386 ch 26)
 * is not. What counts as a failure is unchanged; a missing second answer keeps the first verdict.
 */
export const isFail = (v) => String(v?.verdict).toUpperCase() !== "PASS" || (v?.names || []).some((n) => n.ok === false);

/** verdicts: the first look, by beat; secondByIdx: Map(beat_index -> verdict) for the beats looked at again (or null). */
export function settleNaming(verdicts, secondByIdx) {
  if (!secondByIdx) return verdicts;
  return verdicts.map((v) => {
    if (!isFail(v)) return v;
    const again = secondByIdx.get(v.beat_index);
    if (!again) return v;
    return isFail(again) ? { ...v, second_look: again } : { ...again, cleared_by_second_look: true, first_look: v };
  });
}

/* ── Credit lines are not entity names ─────────────────────────────────
 *
 * Run 39961381904 ch-1: a correct portrait of Flinders Petrie (a Wikimedia Commons painting BY George Frederic Watts) carried the renderer's
 * own credit line "Photo: George Frederic Watts / Wikimedia Commons, Public domain". The reader listed "George Frederic Watts" as a name on the
 * frame, judged it against a sentence about Petrie, failed beat 4 on both looks (the credit is on screen at both times, so the second look cannot
 * clear it) and the channel's video was held. The picture was right; the credit names who made and hosts the picture, not a person, place or
 * organisation the story is about.
 *
 * The credit text is the renderer's own output, written by code from the file's metadata (scripts/entity-assets.cjs, resolve-scene.cjs) and recorded
 * in the manifest, so it is known exactly and this is deterministic: a flagged name that IS (part of) a credit line recorded for the beat is set
 * aside. Nothing else changes: a misspelt headline, a wrong place, a wrong figure, a name that is not in any credit line all still fail, and so does a
 * beat whose credit line the reader did not misread. The credit line itself is not re-judged: it is metadata, not a claim about the story.
 */
const norm = (s) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Every credit / source line the renderer may draw on a beat, from the beat's manifest canvas record.
 * KNOWN LIMIT: canvasManifest only records photo.credit once canvas-layout.js carries that field, and that change is held back
 * from the first recovery push; until it ships, the Wikimedia photo credit line (the Watts case) is not in the record and is not set aside.
 */
export function creditLinesOf(canvas) {
  const c = canvas || {};
  const out = [];
  const add = (v) => { const s = String(v ?? "").trim(); if (s && !out.includes(s)) out.push(s); };
  add(c.photo?.credit);
  add(c.source_credit);
  for (const v of c.concept_visuals || []) add(v?.credit);
  for (const v of c.clone_extra || []) add(v?.credit);
  add(c.art?.credit);
  for (const it of c.art?.items || []) add(it?.credit);
  return out;
}

/** True when `shown` (what the reader says it read) is the credit line, or a part of it long enough to be a name rather than a stray word. */
export function isCreditLineRead(shown, credits) {
  const s = norm(shown);
  if (s.length < 4) return false;
  return (credits || []).some((cr) => {
    const c = norm(cr);
    if (!c) return false;
    // whole-word containment, so "ton" cannot hide inside "Washington" in a credit and "Petrie" is not covered by "Petrie Museum" unless the credit has it
    return ` ${c} `.includes(` ${s} `) || ` ${s} `.includes(` ${c} `);
  });
}

/**
 * Set aside the names of one verdict that are the beat's credit line. Returns the verdict unchanged when none are; otherwise the names are marked
 * ok with credit_line: true and the verdict is recomputed from what is left (PASS only if no name still fails).
 */
export function dropCreditLineNames(verdict, credits) {
  if (!verdict || !(credits || []).length) return verdict;
  let touched = false;
  const names = (verdict.names || []).map((n) => {
    if (n && n.ok === false && isCreditLineRead(n.shown, credits)) { touched = true; return { ...n, ok: true, credit_line: true, problem: "" }; }
    return n;
  });
  if (!touched) return verdict;
  const stillBad = names.some((n) => n.ok === false);
  // A FAIL that listed nothing but credit-line names is cleared. A FAIL with some other failing name stays; a FAIL that named nobody is not ours to clear.
  return { ...verdict, names, verdict: stillBad ? "FAIL" : "PASS", credit_line_set_aside: true };
}

/** Apply dropCreditLineNames to every verdict; creditsByIdx: Map(beat_index -> [credit line]). */
export function setAsideCreditLines(verdicts, creditsByIdx) {
  return verdicts.map((v) => dropCreditLineNames(v, creditsByIdx?.get(Number(v?.beat_index))));
}

/**
 * The corrections a naming failure hands to the NEXT planning attempt (the shape gemini-visual-plan.js prints: `${beat}: ${problem} -> Fix: ${fix}`).
 * Only real failures: credit-line names are already gone from `verdicts` by the time this is called.
 */
export function namingCorrections(verdicts) {
  const out = [];
  for (const v of verdicts || []) {
    if (!isFail(v)) continue;
    const bad = (v.names || []).filter((n) => n && n.ok === false);
    const problem = bad.length
      ? bad.map((n) => `the frame shows "${n.shown}" where the sentence has "${n.expected}"${n.problem ? ` (${n.problem})` : ""}`).join("; ")
      : "the on-screen names do not match the sentence";
    out.push({ beat: `beat ${v.beat_index}`, owner: "NAMING", problem,
      fix: "Draw every name, place, organisation and figure on this beat exactly as the sentence spells it, or choose a visual that does not repeat a name the sentence does not support." });
  }
  return out;
}

/**
 * Does a failed naming check earn another attempt? It used to go straight to the backup audit (approved-review/, uploaded private for a human) with no
 * retry, so one misnamed beat cost the channel its day (run 39961381904 ch-1: attempt 2 of 3, 11 minutes left in the budget, never re-planned).
 * Yes only when: the check RAN and found real failures (exit 1 — a check that could not run is not helped by a re-render), an attempt is left, and the
 * next attempt (a full re-plan: corrections only reach the planner, an enforced plan would render the same misnaming again) fits the time budget.
 * The retry does not touch what counts as a failure; the re-rendered video goes through the same check again, and the last attempt still holds the video.
 */
export function namingRetryDecision({ code, report, attempt, maxAttempts, elapsedMs, nextAttemptMs, budgetMs }) {
  if (code !== 1) return { retry: false, why: "the naming check could not run" };
  const corrections = namingCorrections(report?.beats || []);
  if (!corrections.length) return { retry: false, why: "no failing beat to correct", corrections };
  if (attempt >= maxAttempts) return { retry: false, why: "no attempt left", corrections };
  if (elapsedMs + nextAttemptMs > budgetMs) return { retry: false, why: "time budget: no further attempt", corrections };
  return { retry: true, why: "re-plan with the naming corrections", corrections };
}
