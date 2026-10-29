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
export function flipDecision(entry, now) {
  if (!entry || typeof entry !== "object") return { flip: false, reason: "not an object", malformed: true };
  if (typeof entry.video_id !== "string" || !entry.video_id) return { flip: false, reason: "no video_id", malformed: true };
  if (entry.privacy_status === "public") return { flip: false, reason: "already public" };
  if (entry.privacy_status !== "private") return { flip: false, reason: `privacy_status is ${JSON.stringify(entry.privacy_status)}, not "private"`, malformed: true };
  if (entry.cancelled === true) return { flip: false, reason: "cancelled" };
  if (entry.cancelled !== false) return { flip: false, reason: `cancelled is ${JSON.stringify(entry.cancelled)}, not a boolean`, malformed: true };
  const due = Date.parse(entry.go_public_at);
  if (!Number.isFinite(due)) return { flip: false, reason: `go_public_at ${JSON.stringify(entry.go_public_at)} is not a date`, malformed: true };
  if (due > now) return { flip: false, reason: "not yet due" };
  return { flip: true, reason: "due" };
}
