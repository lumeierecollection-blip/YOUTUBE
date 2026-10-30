// THE PUBLISHING CODE PATH ENFORCES "REVIEW UPLOADS AND stay_private CHANNELS NEVER GO PUBLIC" - it does not rely on every queue
// record having been written correctly.
//
// queue-guard.test.js proves a malformed record is refused. It could not prove two things this file does:
//   1. A review upload (source_queue "approved-review") whose `cancelled` was edited/restored to false must still be refused.
//   2. A channel configured stay_private: true must never have a video made public by process-queue, whatever its record says,
//      including old records written before the flag existed.
// Pure fixtures + read-only reads of config/channels.json and the committed queue files. Nothing touches YouTube or any queue file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { flipDecision } from "../../src/skills/youtube-publish/queue-guard.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const NOW = Date.parse("2026-10-30T12:00:00Z");
const FAR = NOW + 365 * 864e5;
const channelsCfg = JSON.parse(readFileSync(join(ROOT, "config/channels.json"), "utf8"));
const channels = channelsCfg.channels || channelsCfg;
const stayPrivate = channels.filter((c) => c.stay_private === true);
const open = { id: "999", channel_id: "ch-test" }; // a channel with no stay_private
const due = (extra = {}) => ({ video_id: "vid", privacy_status: "private", cancelled: false, go_public_at: "2026-10-30T11:00:00.000Z", ...extra });

test("control: a valid, due, explicitly-private entry on a normal channel still flips (legacy shape and 'approved')", () => {
  assert.equal(flipDecision(due(), NOW, open).flip, true);
  assert.equal(flipDecision(due({ source_queue: "approved" }), NOW, open).flip, true);
  assert.equal(flipDecision(due({ source_queue: null }), NOW, open).flip, true);
  assert.equal(flipDecision(due(), NOW, undefined).flip, true, "no channel object = no stay_private setting to honour");
});

test("an approved-review entry whose cancelled was edited to false is NOT published, and is reported", () => {
  for (const sq of ["approved-review", "Approved-Review", "review", "approved-review ", "APPROVED-REVIEW"]) {
    const d = flipDecision(due({ source_queue: sq }), NOW, open);
    assert.equal(d.flip, false, JSON.stringify(sq));
    assert.equal(d.malformed, true, `${JSON.stringify(sq)} must be loud, not silent`);
    assert.match(d.reason, /review upload stays private/);
  }
});

test("an unknown or non-string source_queue is refused rather than guessed at", () => {
  for (const sq of ["manual", "", 0, 1, true, false, {}, [], "approved,review"]) {
    assert.equal(flipDecision(due({ source_queue: sq }), NOW, open).flip, false, JSON.stringify(sq));
  }
});

test("a legitimately cancelled review entry is skipped quietly (not reported as malformed)", () => {
  const d = flipDecision(due({ source_queue: "approved-review", cancelled: true }), NOW, open);
  assert.deepEqual([d.flip, d.malformed], [false, undefined]);
});

test("cancelled, future-dated, and missing/invalid fields never flip, with or without a channel", () => {
  const bad = {
    cancelled: due({ cancelled: true }),
    "future-dated": due({ go_public_at: "2026-10-30T12:00:01Z" }),
    "cancelled missing": (() => { const e = due(); delete e.cancelled; return e; })(),
    'cancelled "false"': due({ cancelled: "false" }),
    "cancelled null": due({ cancelled: null }),
    "date missing": (() => { const e = due(); delete e.go_public_at; return e; })(),
    "date garbage": due({ go_public_at: "soon" }),
    "date null": due({ go_public_at: null }),
    "date empty": due({ go_public_at: "" }),
  };
  for (const [name, e] of Object.entries(bad)) {
    for (const ch of [open, undefined, ...stayPrivate]) assert.equal(flipDecision(e, NOW, ch).flip, false, `${name} / ${ch?.channel_id}`);
  }
});

test(`every stay_private channel in config/channels.json (${stayPrivate.length}) refuses even a perfect-looking due record`, () => {
  assert.ok(stayPrivate.length >= 3, "config should have stay_private channels");
  for (const ch of stayPrivate) {
    for (const e of [due(), due({ source_queue: "approved" }), (() => { const x = due(); delete x.cancelled; return x; })(), due({ go_public_at: "not a date" })]) {
      const d = flipDecision(e, FAR, ch);
      assert.equal(d.flip, false, `${ch.channel_id} must never flip: ${JSON.stringify(e)}`);
      assert.match(d.reason, /stay_private/);
    }
  }
});

test("only an absent key or an explicit false opens the channel gate; a mistyped stay_private value fails closed", () => {
  assert.equal(flipDecision(due(), NOW, { id: "7" }).flip, true);
  assert.equal(flipDecision(due(), NOW, { id: "7", stay_private: false }).flip, true);
  for (const v of [true, "true", "false", 1, 0, "yes", null, {}, []]) {
    assert.equal(flipDecision(due(), NOW, { id: "7", stay_private: v }).flip, false, `stay_private ${JSON.stringify(v)} must refuse`);
  }
});

test("hOYJOrB9lR4 (restored by hand, already public) is never flipped again, on its channel or any other", () => {
  const rec = { video_id: "hOYJOrB9lR4", channel_id: "1", privacy_status: "public", cancelled: false, go_public_at: "2026-10-20T01:23:16.835Z", published_at: "2026-10-20T09:38:44.014Z", source_queue: "approved" };
  const ch1 = channels.find((c) => String(c.id) === "1");
  assert.equal(ch1?.stay_private, true);
  for (const ch of [ch1, open, undefined]) assert.equal(flipDecision(rec, FAR, ch).flip, false);
  // and the same record if someone also set it back to private
  for (const ch of [ch1, open]) {
    const d = flipDecision({ ...rec, privacy_status: "private", published_at: undefined }, FAR, ch);
    assert.equal(d.flip, ch === open, "only a channel WITHOUT stay_private could ever act on it, and channel 1 refuses");
  }
});

test("committed queue records: nothing on a stay_private channel, and no review upload, would flip even a year from now", () => {
  const dir = join(ROOT, "data/publish-queue");
  if (!existsSync(dir)) return;
  let seen = 0;
  for (const id of readdirSync(dir)) {
    const f = join(dir, id, "publish-queue.json");
    if (!existsSync(f)) continue;
    const ch = channels.find((c) => String(c.id) === id);
    for (const e of JSON.parse(readFileSync(f, "utf8"))) {
      seen++;
      if (ch?.stay_private === true || /review/i.test(String(e.source_queue ?? ""))) {
        assert.equal(flipDecision(e, FAR, ch).flip, false, `${id}/${e.video_id} must never be published by process-queue`);
      }
    }
  }
  assert.ok(seen > 0);
});

test("run.js hands the channel to the guard (so the channel rule is enforced on the publishing path)", () => {
  const src = readFileSync(join(ROOT, "src/skills/youtube-publish/run.js"), "utf8");
  assert.match(src, /flipDecision\(entry, now, channel\)/);
});
