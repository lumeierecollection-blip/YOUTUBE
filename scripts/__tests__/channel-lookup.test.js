import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const L = require("../lib/channel-lookup.cjs");

const channels = L.loadChannels();
const resolve = (k) => L.resolveChannel(k, channels);

describe("normalizeChannelId", () => {
  it("mirrors the workflow's strip of ch- and leading zeros", () => {
    assert.equal(L.normalizeChannelId("ch-05"), "5");
    assert.equal(L.normalizeChannelId("ch-5"), "5");
    assert.equal(L.normalizeChannelId("ch-10"), "10");
    assert.equal(L.normalizeChannelId("ch-1"), "1");
    assert.equal(L.normalizeChannelId("5"), "5");
    assert.equal(L.normalizeChannelId(5), "5");
  });

  it("is idempotent", () => {
    for (const s of ["ch-05", "ch-10", "ch-26", "ch-1"]) {
      assert.equal(L.normalizeChannelId(L.normalizeChannelId(s)), L.normalizeChannelId(s));
    }
  });
});

describe("resolveChannel - the bug this module exists for", () => {
  // ch-05 Broadsheet and ch-26 Harmony are BOTH id=5 in config/channels.json.
  // Resolving by `id` gave Broadsheet Harmony's music-theory context, and runs
  // 37548436088 / 37549155059 both produced a music topic for a true-crime
  // channel.
  it("dispatch key 5 resolves to ch-05 Broadsheet, NOT ch-26 Harmony", () => {
    const r = resolve("5");
    assert.equal(r.channel_id, "ch-05");
    assert.equal(r.channel_name, "Broadsheet");
    assert.equal(r.niche, "True Crime & Investigative Journalism");
    assert.notEqual(r.channel_name, "Harmony");
  });

  it("there really are two rows with id=5, so an id-based lookup would be wrong", () => {
    const byId = channels.filter((c) => String(c.id) === "5");
    assert.equal(byId.length, 2, "if this ever drops to 1 the id-based lookup stops being ambiguous");
    assert.deepEqual(byId.map((c) => c.channel_id).sort(), ["ch-05", "ch-26"]);
  });

  it("the four new channels each resolve to themselves", () => {
    for (const [key, id, name] of [["5", "ch-05", "Broadsheet"], ["6", "ch-06", "Archive Room"], ["8", "ch-08", "Ledger"], ["10", "ch-10", "Margin Note"]]) {
      const r = resolve(key);
      assert.equal(r.channel_id, id);
      assert.equal(r.channel_name, name);
    }
  });

  it("built channels are unaffected: 26 -> Fraud Files, 44 -> Skill Stack, 49", () => {
    assert.equal(resolve("26").channel_name, "Fraud Files");
    assert.equal(resolve("44").channel_name, "Skill Stack");
    const r49 = resolve("49");
    assert.ok(["Picture House", "Stellar"].includes(r49.channel_name), r49.channel_name);
  });

  it("resolves the other built channels too", () => {
    assert.equal(resolve("1").channel_name, "Money Mind");
    assert.equal(resolve("2").channel_name, "Legal Brief");
    assert.equal(resolve("9").channel_name, "Border Lines");
  });

  it("accepts the ch- form as well as the bare form", () => {
    assert.equal(resolve("ch-05").channel_id, "ch-05");
    assert.equal(resolve("ch-10").channel_id, "ch-10");
  });
});

describe("resolveChannel fails loud", () => {
  it("throws channel_not_found for an unknown key", () => {
    assert.throws(() => resolve("999"), (e) => e.code === "channel_not_found" && /channel_not_found: 999/.test(e.message));
  });

  it("throws channel_ambiguous when two rows normalise to the same bare id", () => {
    // No `id` field at all, so neither row can agree with both namespaces.
    const fixture = [
      { channel_id: "ch-5", channel_name: "A" },
      { channel_id: "ch-05", channel_name: "B" },
    ];
    assert.throws(() => L.resolveChannel("5", fixture), (e) => e.code === "channel_ambiguous");
  });

  it("the ambiguity error names both channels and their ids", () => {
    // A true duplicate: two rows agreeing with BOTH namespaces for key 5.
    const fixture = [
      { channel_id: "ch-05", channel_name: "Alpha", id: 5 },
      { channel_id: "ch-5", channel_name: "Beta", id: 5 },
    ];
    try {
      L.resolveChannel("5", fixture);
      assert.fail("should have thrown");
    } catch (e) {
      assert.match(e.message, /Alpha/);
      assert.match(e.message, /Beta/);
      assert.match(e.message, /id=5/);
    }
  });

  it("two rows that normalise alike but only one is consistent resolves the consistent one", () => {
    // This is the ch-05 / ch-26 Harmony shape: both normalise to a bare id, but
    // only one also agrees on `id`, so there is no ambiguity to report.
    const fixture = [
      { channel_id: "ch-26", channel_name: "Harmony", id: 5 },
      { channel_id: "ch-05", channel_name: "Broadsheet", id: 5 },
    ];
    assert.equal(L.resolveChannel("5", fixture).channel_name, "Broadsheet");
    const byId = [
      { channel_id: "ch-26", channel_name: "Harmony", id: 5 },
      { channel_id: "ch-26", channel_name: "Fraud Files", id: 26 },
    ];
    assert.equal(L.resolveChannel("26", byId).channel_name, "Fraud Files");
  });

  it("built channels keep pointing where they already point, not at their duplicate", () => {
    // channel_id normalisation alone would return BOTH rows and first-match
    // would hand back Harmony for key 26 -- regressing Fraud Files, which the
    // old id-based lookup got right. The both-namespaces-agree rule is what
    // prevents that.
    assert.equal(resolve("26").channel_name, "Fraud Files");
    assert.equal(resolve("44").channel_name, "Skill Stack");
    assert.equal(resolve("49").channel_name, "Picture House");
  });

  it("no row agreeing with both namespaces fails loud instead of guessing", () => {
    const fixture = [
      { channel_id: "ch-26", channel_name: "A", id: 5 },
      { channel_id: "ch-26", channel_name: "B", id: 6 },
    ];
    assert.throws(() => L.resolveChannel("26", fixture), (e) => e.code === "channel_ambiguous" && /no row where id and channel_id agree/.test(e.message));
  });
});

describe("trending file key", () => {
  it("both id=5 rows would read the same data/trending/5.json, so the key must be channel_id", () => {
    // fetch-trending writes data/trending/<bare id>.json; build-discovery
    // context must read the SAME file the fetch wrote, for the SAME channel.
    // With the id=5 collision, the music row read the true-crime feed.
    const broadsheet = resolve("5");
    assert.equal(L.normalizeChannelId(broadsheet.channel_id), "5");
    assert.equal(broadsheet.channel_id, "ch-05");
  });
});
