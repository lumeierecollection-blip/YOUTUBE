import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const T = require("../fetch-trending.cjs");

describe("fetch-trending CATEGORY map", () => {
  it("maps the four new channels so they stop falling through to unseeded discovery", () => {
    for (const [bare, expected] of [[5, 25], [6, 24], [8, 27], [10, 27]]) {
      assert.ok(T.CATEGORY[bare], `bare id ${bare} must be mapped or the channel is unseeded`);
      assert.equal(T.CATEGORY[bare], expected);
    }
  });

  it("every new channel's content_pillars overlap its CURRENT niche", () => {
    // Widening the niche on 2026-10-07 left the pillars on the old media-history
    // subjects, and the niche filter matches niche + pillars together - so stale
    // pillars kept feeding the old subject. This fails if either drifts alone.
    const ids = ["ch-05", "ch-06", "ch-08", "ch-10"];
    const channels = T.loadChannels();
    for (const id of ids) {
      const row = T.findChannel(T.bareId(id), channels);
      const nicheTerms = new Set(T.nicheTerms(row.niche, []));
      assert.ok(nicheTerms.size > 0, `${id} niche yields no terms`);
      const pillarTerms = new Set(T.nicheTerms("", row.content_pillars));
      const overlap = [...pillarTerms].filter((t) => nicheTerms.has(t));
      assert.ok(
        overlap.length > 0,
        `${id} (${row.niche}) has no pillar term overlapping its niche. pillars=${JSON.stringify(row.content_pillars)}`,
      );
    }
  });

  it("pillars do not still describe the pre-widening subject", () => {
    // The specific regression the widening was meant to remove.
    const stale = {
      // "press" alone is NOT stale: "press investigations" is the new subject.
      // Only the media-history compounds are.
      "ch-05": ["newspaper", "print layout", "press history", "masthead", "typesetting", "editorial history"],
      "ch-06": ["broadcast", "archival footage", "lost media", "pre-digital"],
      "ch-08": ["accumulation"],
      "ch-10": [],
    };
    const channels = T.loadChannels();
    for (const [id, words] of Object.entries(stale)) {
      const row = T.findChannel(T.bareId(id), channels);
      const hay = (row.content_pillars || []).join(" ").toLowerCase();
      for (const w of words) {
        assert.ok(!hay.includes(w), `${id} pillar still says "${w}": ${hay}`);
      }
    }
  });

  it("every pillar is title-shaped, not prose", () => {
    const channels = T.loadChannels();
    for (const id of ["ch-05", "ch-06", "ch-08", "ch-10"]) {
      const row = T.findChannel(T.bareId(id), channels);
      for (const p of row.content_pillars || []) {
        // Two-word phrases are fine - "press investigations" is title-shaped.
        // The bar is that a pillar is a noun phrase, not a sentence.
        assert.ok(typeof p === "string" && p.length >= 12, `${id} pillar too short: "${p}"`);
        assert.ok(p.split(" ").length >= 2, `${id} pillar is not keyword-shaped: "${p}"`);
        assert.ok(p === p.toLowerCase(), `${id} pillar should be lower-case: "${p}"`);
      }
    }
  });

  it("CATEGORY matches each new channel's CURRENT niche, not the pre-widening one", () => {
    // The niches were widened on 2026-10-07. If someone edits a niche without
    // re-checking the category, this is what catches the drift.
    const expected = { "ch-05": 25, "ch-06": 24, "ch-08": 27, "ch-10": 27 };
    for (const [channel_id, cat] of Object.entries(expected)) {
      const row = T.findChannel(T.bareId(channel_id), T.loadChannels());
      assert.equal(T.CATEGORY[T.bareId(channel_id)], cat, `${channel_id} ("${row.niche}")`);
    }
  });

  it("keeps the six built channels on their existing categories", () => {
    assert.equal(T.CATEGORY[1], 27);
    assert.equal(T.CATEGORY[2], 25);
    assert.equal(T.CATEGORY[9], 25);
    assert.equal(T.CATEGORY[26], 25);
    assert.equal(T.CATEGORY[44], 27);
  });

  it("strips ch- and leading zeros the way the workflow does", () => {
    assert.equal(T.bareId("ch-05"), "5");
    assert.equal(T.bareId("ch-10"), "10");
    assert.equal(T.bareId("ch-26"), "26");
    assert.equal(T.bareId("ch-1"), "1");
  });

  it("resolves the real ch-05 row, not the id=5 row that is a different channel", () => {
    const channels = T.loadChannels();
    const found = T.findChannel("5", channels);
    assert.equal(found.channel_id, "ch-05");
    assert.equal(found.channel_name, "Broadsheet");
  });

  it("real config: every CATEGORY key resolves, and any collision is a baselined one", () => {
    const channels = T.loadChannels();
    const owners = new Map();
    const collisions = [];
    for (const r of channels) {
      const b = T.bareId(r.channel_id);
      if (!Object.keys(T.CATEGORY).includes(b)) continue;
      if (owners.has(b)) collisions.push(b);
      else owners.set(b, r);
    }
    // 26 and 44 are duplicate channel_ids in channels.json AND are CATEGORY keys
    // naming live built channels. They are warned, not fatal - see KNOWN_COLLISIONS.
    assert.deepEqual([...new Set(collisions)].sort(), ["26", "44"]);
    // The four new channels must resolve unambiguously.
    for (const bare of ["5", "6", "8", "10"]) {
      assert.equal(owners.get(bare).channel_name, { 5: "Broadsheet", 6: "Archive Room", 8: "Ledger", 10: "Margin Note" }[bare]);
    }
  });

  it("real config: does not exit non-zero", () => {
    const realExit = process.exit;
    let fired = null;
    process.exit = (c) => { fired = c; throw new Error("__exit__"); };
    const realWarn = console.warn;
    console.warn = () => {};
    try { T.assertNoKeyCollision(T.loadChannels()); } catch { /* ignore */ } finally { process.exit = realExit; console.warn = realWarn; }
    assert.equal(fired, null, "the shipped config must not hard-fail the trending fetch");
  });
});

describe("fetch-trending collision guard", () => {
  it("fires when two channels claim the same CATEGORY key", () => {
    const fixture = [
      { channel_id: "ch-5", channel_name: "Legacy", niche: "old" },
      { channel_id: "ch-05", channel_name: "Broadsheet", niche: "new" },
    ];
    // process.exit is stubbed so the assertion is observable rather than fatal.
    const realExit = process.exit;
    let code = null;
    const realErr = console.error;
    let msg = "";
    process.exit = (c) => { code = c; throw new Error("__exit__"); };
    console.error = (m) => { msg += String(m); };
    try {
      T.assertNoKeyCollision(fixture, ["5"]);
      assert.fail("guard should have exited");
    } catch (e) {
      if (e.message !== "__exit__") throw e;
    } finally {
      process.exit = realExit;
      console.error = realErr;
    }
    assert.equal(code, 3);
    assert.match(msg, /claimed by two channels/);
    assert.match(msg, /ch-5/);
    assert.match(msg, /ch-05/);
  });

  it("does not fire on a clean fixture", () => {
    const fixture = [{ channel_id: "ch-05", channel_name: "Broadsheet" }];
    const realExit = process.exit;
    let fired = false;
    process.exit = () => { fired = true; throw new Error("__exit__"); };
    try { T.assertNoKeyCollision(fixture, ["5"]); } catch { /* ignore */ } finally { process.exit = realExit; }
    assert.equal(fired, false);
  });
});

describe("fetch-trending niche filter", () => {
  const terms = T.nicheTerms("Newspaper & Print Media History", ["newspaper history", "print layout design"]);

  it("derives usable terms from niche and pillars", () => {
    assert.ok(terms.includes("newspaper"), terms.join(","));
    assert.ok(terms.includes("print"), terms.join(","));
    assert.ok(terms.includes("layout"), terms.join(","));
  });

  it("drops stopwords and short noise", () => {
    assert.ok(!terms.includes("the"));
    assert.ok(!terms.includes("and"));
    assert.ok(!terms.every((t) => t.length < 4));
  });

  it("keeps the niche-matching candidate and drops the two that do not fit", () => {
    const top = [
      { title: "How newspapers changed America", tags: ["history"], channelTitle: "History Hub" },
      { title: "Vibe coding with Suno music tools", tags: ["ai", "music"], channelTitle: "Tech" },
      { title: "Best sports highlights today", tags: ["sports"], channelTitle: "ESPN" },
    ];
    const kept = top.filter((v) => T.nicheMatch(v, terms));
    assert.equal(kept.length, 1);
    assert.match(kept[0].title, /newspapers/);
  });

  it("falls back to the closest candidate rather than failing when nothing matches", () => {
    const top = [
      { title: "Vibe coding with Suno music tools", tags: ["ai"], channelTitle: "Tech" },
      { title: "Best sports highlights today", tags: ["sports"], channelTitle: "ESPN" },
    ];
    const r = T.applyNicheFilter(top, terms);
    assert.equal(r.fallback, true);
    assert.equal(r.kept.length, 1);
  });

  it("skips the filter entirely when the channel has no niche", () => {
    const top = [
      { title: "Vibe coding with Suno music tools", tags: [], channelTitle: "Tech" },
      { title: "Something else entirely", tags: [], channelTitle: "Other" },
    ];
    const r = T.applyNicheFilter(top, T.nicheTerms("", []));
    assert.equal(r.fallback, false);
    assert.equal(r.dropped, 0);
    assert.equal(r.kept.length, 2);
  });

  it("is a no-op on a clean list and reports zero dropped", () => {
    const top = [{ title: "Newspaper printing history explained", tags: [], channelTitle: "" }];
    const r = T.applyNicheFilter(top, terms);
    assert.equal(r.dropped, 0);
    assert.equal(r.kept.length, 1);
  });
});

describe("fetch-trending rankAndFilter wiring", () => {
  // Covers the seam main() calls, so removing the filter from it turns these red.
  const broadsheet = { niche: "Newspaper & Print Media History", content_pillars: ["newspaper history", "print layout design"] };
  const recent = [
    { id: "a", title: "Vibe coding with Suno music tools", tags: ["ai"], channelTitle: "Tech", viewCount: 900, velocity: 900, _pub: Date.now() },
    { id: "b", title: "How newspapers shaped America", tags: ["history"], channelTitle: "History Hub", viewCount: 100, velocity: 100, _pub: Date.now() },
    { id: "c", title: "Best sports highlights", tags: ["sports"], channelTitle: "ESPN", viewCount: 800, velocity: 800, _pub: Date.now() },
  ];

  it("drops the higher-velocity off-niche candidates and keeps the niche match", () => {
    const r = T.rankAndFilter(recent, broadsheet);
    assert.equal(r.top.length, 1);
    assert.match(r.top[0].title, /newspapers/);
    assert.equal(r.dropped, 2);
  });

  it("strips the _pub scratch key from what gets written", () => {
    const r = T.rankAndFilter(recent, broadsheet);
    assert.ok(!("_pub" in r.top[0]));
  });

  it("still ranks by velocity within the surviving candidates", () => {
    const two = [
      { id: "x", title: "Newspaper history of the press", tags: [], channelTitle: "", velocity: 10, _pub: Date.now() },
      { id: "y", title: "Print layout and newspaper design", tags: [], channelTitle: "", velocity: 99, _pub: Date.now() },
    ];
    const r = T.rankAndFilter(two, broadsheet);
    assert.equal(r.top.length, 2);
    assert.equal(r.top[0].id, "y");
  });

  it("passes everything through when the channel has no niche field", () => {
    const r = T.rankAndFilter(recent, null);
    assert.equal(r.top.length, 3);
    assert.equal(r.dropped, 0);
  });

  it("honours the limit", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: String(i), title: "Newspaper history item", tags: [], channelTitle: "", velocity: i, _pub: Date.now() }));
    assert.equal(T.rankAndFilter(many, broadsheet, 10).top.length, 10);
  });
});
