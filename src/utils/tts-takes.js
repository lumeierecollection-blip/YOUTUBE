/**
 * tts-takes — record the narration again when the listener does not believe it (board 38044082797, ch 26).
 *
 * The Gemini TTS voice is not deterministic: the same voice and style note scored 8-9 in the listening test and 5-6 on every sentence of
 * one script. The render's narration gate (scripts/narration-judge.mjs) wants 7+ on every sentence, so a flat take held the video. A
 * director re-records. This only decides WHICH take is kept; it never changes what the judge accepts.
 *
 *   record(take)  -> true when a take now exists on disk, false when none could be made (stop; the caller falls back)
 *   judge(take)   -> { status: "pass" | "fail" | "unavailable", mean }   (unavailable = the judge could not run: keep this take)
 *   save()        -> remember the take on disk as the best so far            restore() -> put the remembered take back
 * Returns { outcome: "none" | "pass" | "unavailable" | "best", take, mean }.
 */
export function chooseTake({ takes = 3, record, judge, save, restore, log = () => {} }) {
  let best = null;
  for (let take = 1; take <= takes; take++) {
    if (!record(take)) return { outcome: best ? "best" : "none", ...(best ? finish(best, restore, log) : {}) };
    const j = judge(take);
    if (j.status === "unavailable") { log(`take ${take}: the narration judge could not run — keeping this take`); return { outcome: "unavailable", take }; }
    if (j.status === "pass") { log(`take ${take}/${takes}: the narration judge passes every sentence — kept`); return { outcome: "pass", take }; }
    log(`take ${take}/${takes}: the narration judge fails it (mean ${Number(j.mean || 0).toFixed(1)}/10)${take < takes ? " — recording another take" : ""}`);
    if (!best || (j.mean || 0) > best.mean) { save(); best = { take, mean: j.mean || 0 }; }
  }
  return { outcome: "best", ...finish(best, restore, log) };
}

function finish(best, restore, log) {
  restore();
  log(`no take passed the narration judge; keeping the best (take ${best.take}, mean ${Number(best.mean).toFixed(1)}/10) — the render's own narration gate decides`);
  return { take: best.take, mean: best.mean };
}
