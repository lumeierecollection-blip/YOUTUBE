// EVERY CHANNEL THE PIPELINE UPLOADS TO MUST BE FORCED PRIVATE.
//
// The render job's "Publish to YouTube (private)" step runs `run.js <ch>` WITHOUT --review. run.js then queues the
// entry `cancelled: channel.stay_private === true || review`, so for that path `stay_private` is the ONLY thing
// stopping `process-queue` (same job, runs on cron because hold_public is empty there) from flipping the video
// public an hour after upload. ch-48 lost its `stay_private` when the duplicate legacy id-48 row was dropped
// (58432af6, 2026-10-19): a ch-48 render that earned `approved/` would have gone public unreviewed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), "utf8"));
const channels = (() => { const d = read("config/channels.json"); return d.channels || d; })();
const priority = read("config/priority-channels.json").channels.map(String);

test("priority-channels.json lists channels", () => {
  assert.ok(priority.length > 0);
});

for (const slot of priority) {
  test(`priority channel ${slot} is configured stay_private: true (nothing auto-goes-public)`, () => {
    const rows = channels.filter((c) => String(c.id) === slot);
    assert.equal(rows.length, 1, `slot ${slot} must resolve to exactly one config row (found ${rows.length})`);
    assert.equal(rows[0].stay_private, true, `${rows[0].channel_id} has no stay_private:true - its approved/ uploads would be flipped public by process-queue`);
  });
}
