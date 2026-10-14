// BOTH PUBLISHABLE QUEUES UPLOAD. approved/ HAD NO PATH AT ALL.
//
// Board 38528287535: ch-2 became the first channel ever to reach approved/:
//
//   { "channel": 2, "verdict": "approved", "attempts": 1,
//     "reason": "verdict A rigorously structured, visually sophisticated editorial short..." }
//
// The cron now reaches review-publish (286d35aa). And the upload step still found
// nothing to upload, because findVideo() read exactly ONE queue:
//
//   const verdict = review ? "approved-review" : "approved";
//
// --review read approved-review/ alone. So the video that earned the STRONGER
// verdict had no upload path at all — the job built to publish could not publish
// the one video that had passed everything.
//
// Under the human-review policy every video in a publishable queue goes up PRIVATE
// and the owner clicks Publish in Studio, so the two queues differ only in the
// verdict recorded, not in how they are uploaded. approved-review/ is searched
// FIRST — it exists precisely because a video needs a human, and one there should
// not be passed over for a different video from the other queue.
//
// rejected/ is still never read. No gate changed, no queue membership changed.
// This changes only what happens to a video AFTER it lands in a queue.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../../src/skills/youtube-publish/run.js", import.meta.url), "utf8");

test("a review publish searches both publishable queues", () => {
  const m = SRC.match(/const queues = review \? \[([^\]]+)\]/);
  assert.ok(m, "findVideo no longer branches on the review flag — it must list its queues");
  const queues = m[1].split(",").map((s) => s.trim().replace(/"/g, ""));
  assert.deepEqual(queues, ["approved-review", "approved"], `queues searched: ${queues.join(", ")}`);
});

test("approved-review is searched FIRST", () => {
  // A video sitting in the queue that exists because it needs a human must not be
  // passed over in favour of a different video from approved/.
  assert.ok(/review \? \["approved-review", "approved"\]/.test(SRC), "approved-review must be preferred");
});

test("rejected is never a source", () => {
  assert.ok(!/review \? \[[^\]]*rejected/.test(SRC), "rejected/ must never be searched");
  assert.ok(!/verdict === "rejected"/.test(SRC), "rejected must never be publishable");
});

test("findVideo returns WHICH queue it came from", () => {
  assert.ok(/\{ path: join\(rendersDir, newest\), queue: verdict \}/.test(SRC), "the source queue is not returned");
  assert.ok(/source_queue: sourceQueue/.test(SRC), "the queue entry still guesses from the review flag instead of recording the truth");
});

test("a plain (non-review) publish still reads approved/ only", () => {
  assert.ok(/review \? \["approved-review", "approved"\] : \["approved"\]/.test(SRC),
    "without --review the queue list must stay exactly ['approved']");
});

test("the marker must still name the queue it came from", () => {
  // A video is only publishable if its own marker says so for this channel.
  assert.ok(/m\.verdict === verdict && String\(m\.channel\) === String\(Number\(channelId\)\)/.test(SRC),
    "the per-queue marker check was weakened");
});

test("uploads stay private under this policy", () => {
  assert.ok(/status: \{ privacyStatus: "private"/.test(SRC), "the upload is no longer private");
  assert.ok(/cancelled: stayPrivate/.test(SRC), "the entry is no longer queued cancelled, so process-queue could flip it public");
});