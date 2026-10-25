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
