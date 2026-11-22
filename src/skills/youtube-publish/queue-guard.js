// The two decisions that stand between an upload and a PUBLIC video, kept apart from run.js (which executes main() on import)
// so they can be tested. Both fail CLOSED.

/**
 * Is this channel's new upload queued as cancelled (= process-queue must never make it public)?
 * `review` is the --review flag. Strictly `=== true`: a truthy string such as "yes" in channels.json is NOT enough, and neither is
 * a missing key, so a mistyped config cannot read as either.
 */
export const shouldStayPrivate = (channel, review) => channel?.stay_private === true || review === true;

/**
 * May process-queue flip this entry to PUBLIC at `now` (ms)? Only an entry that says, in so many words, that it is private, NOT
 * cancelled, and due. Anything else - a missing or non-boolean `cancelled`, a missing/garbled `go_public_at`, an unknown
 * privacy_status, a hand-edited or restored record - stays as it is. (It used to be `if (entry.cancelled || ...) continue;
 * if (Date.parse(go_public_at) > now) continue;`: a missing `cancelled` read as "not cancelled", and an unparsable date made
 * `NaN > now` false, i.e. "due immediately".)
 */
export function flipDecision(entry, now, channel) {
  if (!entry || typeof entry !== "object") return { flip: false, reason: "not an object", malformed: true };
  if (typeof entry.video_id !== "string" || !entry.video_id) return { flip: false, reason: "no video_id", malformed: true };
  if (entry.privacy_status === "public") return { flip: false, reason: "already public" };
  // The channel's own setting is enforced HERE, at the point of publishing, not left to whatever the queue record says: a
  // stay_private channel never has a video made public by process-queue, however the record looks (restored, hand-edited, or
  // written before the flag existed).
  // Fail closed on the setting itself too: only an absent key or an explicit false means "not stay_private"; true, "true", 1, null
  // or any other value is refused (a mistyped config must not open the gate).
  if (channel && channel.stay_private !== undefined && channel.stay_private !== false) {
    return { flip: false, reason: `channel is stay_private (${JSON.stringify(channel.stay_private)}): only a person makes its videos public` };
  }
  if (entry.privacy_status !== "private") return { flip: false, reason: `privacy_status is ${JSON.stringify(entry.privacy_status)}, not "private"`, malformed: true };
  if (entry.cancelled === true) return { flip: false, reason: "cancelled" };
  if (entry.cancelled !== false) return { flip: false, reason: `cancelled is ${JSON.stringify(entry.cancelled)}, not a boolean`, malformed: true };
  // A review upload (source_queue "approved-review") failed an AI check; only the person reviewing it in YouTube Studio makes it
  // public. It is queued cancelled: true, but un-cancelling the record by hand must not be enough. Only the legacy shape (no
  // source_queue) and "approved" may flip; any other value is refused rather than guessed at.
  if (entry.source_queue !== undefined && entry.source_queue !== null && entry.source_queue !== "approved") {
    return { flip: false, reason: `source_queue is ${JSON.stringify(entry.source_queue)}: a review upload stays private even if cancelled was edited to false`, malformed: true };
  }
  const due = Date.parse(entry.go_public_at);
  if (!Number.isFinite(due)) return { flip: false, reason: `go_public_at ${JSON.stringify(entry.go_public_at)} is not a date`, malformed: true };
  if (due > now) return { flip: false, reason: "not yet due" };
  return { flip: true, reason: "due" };
}
