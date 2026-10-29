// NOTHING GOES PUBLIC UNLESS A QUEUE RECORD SAYS, EXPLICITLY, THAT IT MAY.
//
// run.js processQueue is the only code that sets privacyStatus "public". It used to decide with
//     if (entry.cancelled || entry.privacy_status === "public") continue;
//     if (Date.parse(entry.go_public_at) > now) continue;
// so a record with NO `cancelled` key read as "not cancelled", and one with a missing/garbled go_public_at made `NaN > now`
// false = "due now". A hand-edited or restored record (cf. hOYJOrB9lR4, restored by hand in 7f67d9cb) could therefore be published
// by accident. flipDecision now fails closed. Nothing here touches YouTube or any queue file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { flipDecision, shouldStayPrivate } from "../../src/skills/youtube-publish/queue-guard.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const NOW = Date.parse("2026-10-30T12:00:00Z");
const due = (extra = {}) => ({ video_id: "vid", privacy_status: "private", cancelled: false, go_public_at: "2026-10-30T11:00:00.000Z", ...extra });

test("the one legitimate flip: explicitly private, explicitly not cancelled, due", () => {
  assert.deepEqual(flipDecision(due(), NOW), { flip: true, reason: "due" });
});

test("not yet due, cancelled and already public never flip (and are not 'malformed')", () => {
  assert.equal(flipDecision(due({ go_public_at: "2026-10-30T13:00:00Z" }), NOW).flip, false);
  const c = flipDecision(due({ cancelled: true }), NOW);
  assert.deepEqual([c.flip, c.malformed], [false, undefined]);
  assert.equal(flipDecision(due({ privacy_status: "public" }), NOW).flip, false);
});

test("real record shapes: hOYJOrB9lR4 (restored by hand, now public) and a typical cancelled review upload are never flipped again", () => {
  const restored = { video_id: "hOYJOrB9lR4", channel_id: "1", privacy_status: "public", cancelled: false, go_public_at: "2026-10-20T01:23:16.835Z", published_at: "2026-10-20T09:38:44.014Z", source_queue: "approved" };
  assert.equal(flipDecision(restored, NOW).flip, false);
  const review = { video_id: "DeeJ9qDKLpc", channel_id: "1", privacy_status: "private", cancelled: true, go_public_at: "2026-10-28T16:37:20.105Z", source_queue: "approved" };
  assert.equal(flipDecision(review, NOW).flip, false);
});

test("a hand-edited or restored record that drops or garbles a field is NOT published, and says why", () => {
  const cases = {
    "no cancelled key":            (() => { const e = due(); delete e.cancelled; return e; })(),
    "cancelled: null":             due({ cancelled: null }),
    'cancelled: "false"':          due({ cancelled: "false" }),
    "cancelled: 0":                due({ cancelled: 0 }),
    "no go_public_at":             (() => { const e = due(); delete e.go_public_at; return e; })(),
    "go_public_at: garbage":       due({ go_public_at: "tomorrow-ish" }),
    "go_public_at: null":          due({ go_public_at: null }),
    'privacy_status: "unlisted"':  due({ privacy_status: "unlisted" }),
    "no privacy_status":           (() => { const e = due(); delete e.privacy_status; return e; })(),
    "no video_id":                 due({ video_id: "" }),
    "null entry":                  null,
    "array entry":                 [],
  };
  for (const [name, entry] of Object.entries(cases)) {
    const d = flipDecision(entry, NOW);
    assert.equal(d.flip, false, name);
    assert.equal(d.malformed, true, `${name} must be reported as malformed, not silently skipped`);
    assert.ok(d.reason, name);
  }
});

test("shouldStayPrivate: stay_private must be exactly true; --review always keeps it private", () => {
  assert.equal(shouldStayPrivate({ stay_private: true }, false), true);
  assert.equal(shouldStayPrivate({}, true), true);
  assert.equal(shouldStayPrivate({ stay_private: "true" }, false), false, "a string is not a setting");
  assert.equal(shouldStayPrivate({ stay_private: 1 }, false), false);
  assert.equal(shouldStayPrivate({}, false), false);
  assert.equal(shouldStayPrivate(undefined, true), true);
  assert.equal(shouldStayPrivate(undefined, false), false);
});

test("committed queue records: every approved-review upload is cancelled, and every record is well-formed", () => {
  const dir = join(ROOT, "data/publish-queue");
  if (!existsSync(dir)) return;
  for (const ch of readdirSync(dir)) {
    const f = join(dir, ch, "publish-queue.json");
    if (!existsSync(f)) continue;
    for (const e of JSON.parse(readFileSync(f, "utf8"))) {
      if (e.source_queue === "approved-review") assert.equal(e.cancelled, true, `${ch}/${e.video_id}: a review upload must never be publishable`);
      const d = flipDecision(e, Date.now() + 365 * 864e5);
      assert.notEqual(d.malformed, true, `${ch}/${e.video_id}: ${d.reason}`);
    }
  }
});

// ---- other routes to a public video ------------------------------------------------------------------------------------------
function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n === "__tests__" || n === ".git" || n === "data") continue;
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p, out) : /\.(js|cjs|mjs|ts|yml|yaml|sh)$/.test(n) && out.push(p);
  }
  return out;
}

test("exactly one source file can set a video public (run.js processQueue), and only the daily workflow calls it", () => {
  const writers = [];
  for (const base of ["src", "scripts", ".github"]) {
    for (const f of walk(join(ROOT, base))) {
      const text = readFileSync(f, "utf8");
      if (/privacyStatus["']?\s*:\s*["'](public|unlisted)["']/.test(text)) writers.push(f.slice(ROOT.length).replace(/\\/g, "/"));
    }
  }
  assert.deepEqual(writers, ["src/skills/youtube-publish/run.js"]);

  // only .github/workflows is executed by GitHub; .github/workflows-deprecated is inert
  const callers = walk(join(ROOT, ".github/workflows")).filter((f) => /process-queue/.test(readFileSync(f, "utf8"))).map((f) => f.slice(ROOT.length).replace(/\\/g, "/"));
  assert.deepEqual(callers, [".github/workflows/daily-pipeline-v2.yml"]);
});

test("run.js decides through the guard (no return to the inline fail-open checks)", () => {
  const src = readFileSync(join(ROOT, "src/skills/youtube-publish/run.js"), "utf8");
  assert.match(src, /from "\.\/queue-guard\.js"/);
  assert.match(src, /flipDecision\(entry, now\)/);
  assert.match(src, /shouldStayPrivate\(channel, review\)/);
  assert.doesNotMatch(src, /if \(entry\.cancelled \|\| entry\.privacy_status === "public"\) continue;/);
  assert.doesNotMatch(src, /channel\.stay_private === true \|\| review/);
});
