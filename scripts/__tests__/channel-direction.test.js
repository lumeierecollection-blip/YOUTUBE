// channel-direction: the planner's REFERENCE DIRECTION section and the critic's reference images come only
// from committed analyses (data/reference/analysis/<stem>/), are capped, and degrade with a reason.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadChannelDirection, directionSummary, criticReferenceImages, pacingLine, observationLines, DIRECTION_SUMMARY_MAX_CHARS,
} from "../reference/channel-direction.mjs";

const CHANNELS = [{ id: 2, channel_id: "ch-02", channel_name: "T", niche: "n" }, { id: 5, channel_id: "ch-05", channel_name: "U", niche: "n" }];

test("a shared-reference channel reads the committed measured-only analyses; pacing is measured, no observation is invented", () => {
  const d = loadChannelDirection("2");
  assert.ok(d.shared, "ch-02 has no reference of its own");
  assert.ok(d.refs.some((r) => r.stem === "ref-01"), `ref-01 analysis committed (${d.why || ""})`);
  const r = d.refs.find((x) => x.stem === "ref-01");
  assert.equal(r.doc.direction.status, "measured-only");
  const line = pacingLine(r);
  assert.match(line, /^ref-01 \[measured-only: /);
  assert.match(line, /16 cuts \(4\.5, 13\.4, 14\.7/, "cut times are the measured ones");
  assert.match(line, /longest hold 13\.9s @28\.7-42\.6s/);
  assert.deepEqual(observationLines(r), [], "measured-only contributes no typography/composition/transition text");
  const s = directionSummary(d);
  assert.ok(s.text.startsWith("REFERENCE DIRECTION"));
  assert.ok(s.chars <= DIRECTION_SUMMARY_MAX_CHARS, `${s.chars} chars`);
});

const doc = (status, extra = {}) => ({
  source: { file: "x.mp4" }, direction: { status, why: status === "complete" ? null : "--no-vision" },
  measured: { metadata: { duration_s: 30 }, cuts: [1.2, 3.4], cadence: { cuts_per_10s: 2, events_per_10s: 5, p90_gap_s: 1.1, longest_hold: { start: 10, end: 14, length_s: 4 } } },
  typography: [], composition: [], transitions: [], color: [], pacing: { observations: [] }, ...extra,
});

test("a completed analysis contributes evidenced medium/high observations, cited frame@time; low confidence and colour never", () => {
  const long = "word ".repeat(80);
  const ref = { stem: "x", times: { f012: 13.4, f003: 3.5 }, doc: doc("complete", {
    typography: [{ text: "low guess", evidence: ["f001"], confidence: "low" }, { text: "Bold serif headline, sentence case", evidence: ["f012"], confidence: "high" }],
    composition: [{ text: long, evidence: ["f003"], confidence: "medium" }],
    transitions: [{ text: "hard cut on the beat", evidence: ["f003"], confidence: "medium", type: "cut", at_cuts: [3.4] }],
    color: [{ text: "#FF0000 accent everywhere", evidence: ["f003"], confidence: "high" }],
  }) };
  const lines = observationLines(ref);
  assert.equal(lines.length, 3);
  assert.match(lines[0], /typography: Bold serif headline, sentence case \[f012@13\.4s\]/);
  assert.ok(lines[1].length < 160, "a long observation is clipped");
  assert.match(lines[2], /\(cut at 3\.4s\) \[f003@3\.5s\]/);
  assert.ok(!lines.join("\n").includes("low guess"));
  assert.ok(!lines.join("\n").includes("#FF0000"), "colour lives in channels.json");
});

test("the summary never exceeds its cap, and drops whole lines rather than cutting a citation", () => {
  const big = (i) => ({ stem: `ref-${i}`, times: {}, doc: doc("complete", {
    typography: [{ text: "t".repeat(300), evidence: ["f001"], confidence: "high" }],
    composition: [{ text: "c".repeat(300), evidence: ["f002"], confidence: "high" }],
    transitions: [{ text: "x".repeat(300), evidence: ["f003"], confidence: "high", type: "cut", at_cuts: [1.2] }],
    pacing: { observations: [{ text: "p".repeat(300), evidence: ["f004"], confidence: "high" }] },
  }) });
  const s = directionSummary({ refs: [big(1), big(2), big(3), big(4)], missing: [] });
  assert.ok(s.chars <= DIRECTION_SUMMARY_MAX_CHARS, `${s.chars}`);
  assert.equal(s.truncated, true);
  for (const l of s.text.trim().split("\n").slice(1)) assert.ok(/\]\.?$|s\.$/.test(l), `whole line kept: ${l.slice(-30)}`);
});

test("no analysis for the channel's reference: empty text and the reason, never a guess", () => {
  const root = mkdtempSync(join(tmpdir(), "chdir-"));
  mkdirSync(join(root, "channels", "ch-05"), { recursive: true });
  writeFileSync(join(root, "channels", "ch-05", "style-spec.json"), JSON.stringify({ reference_video: "research/own.mp4" }));
  const d = loadChannelDirection("5", { root, channels: CHANNELS });
  assert.equal(d.refs.length, 0);
  assert.match(d.why, /no analysis at data\/reference\/analysis\/own\/direction\.json/);
  const s = directionSummary(d);
  assert.equal(s.text, "");
  assert.match(s.why, /analyze-reference/);
});

test("critic images: contact sheets of the analysed reference; else stills; else none with the reason", () => {
  const real = criticReferenceImages("2", { framesFor: () => ({ files: [], why: "unused" }) });
  assert.equal(real.kind, "contact-sheet");
  assert.ok(real.files.length >= 1 && real.files.length <= 2);
  assert.ok(real.files.every((f) => /contact-\d+\.jpg$/.test(f)));

  const root = mkdtempSync(join(tmpdir(), "chdir-"));
  const stills = criticReferenceImages("5", { root, channels: CHANNELS, framesFor: () => ({ files: ["a.jpg"], source: "research/x.mp4" }) });
  assert.equal(stills.kind, "stills");
  assert.match(stills.source, /no contact sheet/);
  const none = criticReferenceImages("5", { root, channels: CHANNELS, framesFor: () => ({ files: [], why: "no frames" }) });
  assert.deepEqual(none.files, []);
  assert.match(none.why, /no contact sheet .* and no reference stills \(no frames\)/);
});
