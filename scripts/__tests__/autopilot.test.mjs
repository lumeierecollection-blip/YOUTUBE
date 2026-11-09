import assert from "node:assert/strict";
import { test } from "node:test";
import { CONFIG } from "../autopilot/lib.mjs";
import { pickDueSlot, reapStale, slotsBetween } from "../autopilot/schedule.mjs";
import { rejections, scoreCandidate, similarity } from "../autopilot/score.mjs";
import { fit, layoutCheck, text } from "../autopilot/visual-common.mjs";

const HOUR = 3600e3;
// Mon 2026-11-09 11:00 SAST = 09:00 UTC
const MON = Date.UTC(2026, 10, 9, 9, 0);
const empty = () => ({ slots: {}, uploads: [], topics: [], attention: [] });

test("weekly capacity is 5 AI Tested and 2 Hidden Past, about 70/30", () => {
  const week = slotsBetween(MON - HOUR, MON - HOUR + 7 * 24 * HOUR);
  assert.equal(week.filter((s) => s.channel === "2").length, 5);
  assert.equal(week.filter((s) => s.channel === "1").length, 2);
});

test("no two slots share a time", () => {
  const week = slotsBetween(MON - HOUR, MON - HOUR + 7 * 24 * HOUR);
  assert.equal(new Set(week.map((s) => s.at)).size, week.length);
});

test("SAST slot maps to the right UTC instant", () => {
  const [s] = slotsBetween(MON - 60e3, MON + 60e3);
  assert.equal(s.id, "2026-11-09-ch2");
  assert.equal(s.at, MON);
});

test("a late poll still finds the slot; a claimed slot is never returned", () => {
  const l = empty();
  const slot = pickDueSlot(l, MON + 7 * HOUR);
  assert.equal(slot.id, "2026-11-09-ch2");
  l.slots[slot.id] = { status: "running", attempts: 1 };
  assert.equal(pickDueSlot(l, MON + 7 * HOUR), null);
});

test("retries stop at the attempt limit", () => {
  const l = empty();
  l.slots["2026-11-09-ch2"] = { status: "failed", attempts: 1 };
  assert.equal(pickDueSlot(l, MON + HOUR).id, "2026-11-09-ch2");
  l.slots["2026-11-09-ch2"].attempts = CONFIG.max_attempts_per_slot;
  assert.equal(pickDueSlot(l, MON + HOUR), null);
});

test("a failing channel does not block the other channel's fresh slot", () => {
  const WED_AI = Date.UTC(2026, 10, 11, 9, 0), WED_HP = Date.UTC(2026, 10, 11, 14, 0);
  const l = empty();
  l.slots["2026-11-10-ch2"] = { status: "delivered", attempts: 1 };
  l.slots["2026-11-11-ch2"] = { status: "failed", attempts: 1 };
  assert.equal(pickDueSlot(l, WED_HP + HOUR).id, "2026-11-11-ch1");
  assert.ok(WED_AI < WED_HP);
});

test("slots expire after the window instead of piling up", () => {
  assert.equal(pickDueSlot(empty(), MON + (CONFIG.slot_window_hours + 1) * HOUR)?.id === "2026-11-09-ch2", false);
});

const channel = CONFIG.channels["2"];
const nowMs = Date.UTC(2026, 10, 9);
const evidence = (h, domain) => ({ published_ms: nowMs - h * HOUR, domain });
const cand = (over = {}) => ({ topic: "ChatGPT voice mode can now read your screen", evidence: [evidence(5, "theverge.com"), evidence(8, "techcrunch.com")], youtube: { median_views: 50000 }, ratings: { curiosity: 8, relevance: 9, visual: 7 }, ...over });
const opts = { channel, weights: CONFIG.score_weights, nowMs };

test("factor weights total 100", () => assert.equal(Object.values(CONFIG.score_weights).reduce((a, b) => a + b, 0), 100));

test("a fresh, sourced, popular topic qualifies", () => {
  const s = scoreCandidate(cand(), opts);
  assert.deepEqual(rejections(cand(), s, { history: [], minScore: CONFIG.min_topic_score, nowMs, windowDays: 120 }), []);
});

test("missing evidence scores zero rather than being assumed", () => {
  const s = scoreCandidate(cand({ youtube: null, wikipedia: null }), opts);
  assert.equal(s.factors.reach, 0);
  assert.ok(rejections(cand(), s, { history: [], minScore: 0, nowMs, windowDays: 120 }).some((r) => /reach/.test(r)));
});

test("developer-infrastructure topics lose relevance on AI Tested", () => {
  const a = scoreCandidate(cand(), opts).factors.relevance;
  const b = scoreCandidate(cand({ topic: "New MCP protocol SDK released" }), opts).factors.relevance;
  assert.ok(b <= a - 30);
});

test("stale and single-source topics are rejected", () => {
  const c = cand({ evidence: [evidence(24 * 20, "theverge.com")] });
  const r = rejections(c, scoreCandidate(c, opts), { history: [], minScore: 0, nowMs, windowDays: 120 });
  assert.ok(r.some((x) => /stale/.test(x)));
  assert.ok(r.some((x) => /2 independent/.test(x)));
});

test("a topic like a recent one is rejected; an old one is not", () => {
  const c = cand();
  const s = scoreCandidate(c, opts);
  const recent = [{ topic: "ChatGPT voice mode reads your screen now", at_ms: nowMs - 86400e3 }];
  const old = [{ ...recent[0], at_ms: nowMs - 200 * 86400e3 }];
  assert.ok(similarity(c.topic, recent[0].topic) >= 0.6);
  assert.ok(rejections(c, s, { history: recent, minScore: 0, nowMs, windowDays: 120 }).some((r) => /similar/.test(r)));
  assert.ok(!rejections(c, s, { history: old, minScore: 0, nowMs, windowDays: 120 }).some((r) => /similar/.test(r)));
});

test("text fit never exceeds its box or line limit", () => {
  const f = fit("AI ASSISTANTS ARE TRAPPED BEHIND INFORMATION SILOS", { maxW: 900, maxLines: 4, max: 120, min: 44 });
  assert.ok(f.lines.length <= 4);
});

test("layout check catches overlap and leaving the safe area, ignoring layers not on screen together", () => {
  const base = { size: 60, color: "#fff", z: 1, font: "x" };
  const a = text("a", "HELLO", { ...base, y: 500, inF: 0, outF: 30 });
  const b = text("b", "WORLD", { ...base, y: 510, inF: 0, outF: 30 });
  const later = text("c", "WORLD", { ...base, y: 510, inF: 40, outF: 60 });
  const off = text("d", "LOW", { ...base, y: 1800, inF: 0, outF: 30 });
  assert.throws(() => layoutCheck([a, b], "t"), /overlaps/);
  assert.throws(() => layoutCheck([off], "t"), /safe area/);
  assert.doesNotThrow(() => layoutCheck([a, later], "t"));
});

test("an abandoned running slot becomes retryable; at the limit it ends", () => {
  const l = empty();
  const old = new Date(MON - 5 * HOUR).toISOString();
  l.slots.a = { status: "running", attempts: 1, updated_at: old, run_id: 1 };
  l.slots.b = { status: "running", attempts: CONFIG.max_attempts_per_slot, updated_at: old, run_id: 2 };
  l.slots.c = { status: "running", attempts: 1, updated_at: new Date(MON - HOUR).toISOString(), run_id: 3 };
  assert.deepEqual(reapStale(l, MON).sort(), ["a", "b"]);
  assert.equal(l.slots.a.status, "failed");
  assert.equal(l.slots.b.status, "failed-final");
  assert.equal(l.slots.c.status, "running");
});

test("a slot that passed QA but lost its upload result is never re-produced automatically", () => {
  const l = empty();
  l.slots["2026-11-09-ch2"] = { status: "qa-passed", attempts: 1, updated_at: new Date(MON - 5 * HOUR).toISOString() };
  reapStale(l, MON + HOUR);
  assert.equal(l.slots["2026-11-09-ch2"].status, "failed-final");
  assert.equal(pickDueSlot(l, MON + HOUR), null);
  assert.equal(l.attention.length, 1);
});

test("two shared proper names make a near-repeat, however the headline is reworded", () => {
  assert.ok(similarity("NYT Cooking AI assistant makes wild ingredient mistakes", "NYT Cooking AI Assistant Flubs Recipe Swaps") >= 0.5);
  assert.ok(similarity("Viking church found in Greenland", "Roman fort found in Britain") < 0.5);
});

test("one distinctive shared name marks the same story; common names do not", () => {
  assert.ok(similarity("Battle of Taranto: The First Attack", "The 1940 Taranto Naval Raid") >= 0.5);
  assert.ok(similarity("Roman fort found in Britain", "Roman coins found in Spain") < 0.6);
});
