/**
 * Plan-vs-render audit (NOT pipeline code — audit only).
 * Step 4: aggregate every channel's audit.json into one summary + per-beat table rows.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = "data/audit/plan-vs-render";
const channels = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "tools")
  .map((d) => d.name).sort();

const tally = { YES: 0, PARTIAL: 0, NO: 0, ERROR: 0 };
let timingOk = 0, timingBad = 0;
const missingTypes = new Map(), unexpectedTypes = new Map();
const bump = (m, k) => { const s = String(k).toLowerCase().replace(/^(a|an|the)\s+/, "").trim(); if (s) m.set(s, (m.get(s) || 0) + 1); };

const perChannel = [];
const rows = [];
for (const ch of channels) {
  const plan = JSON.parse(readFileSync(join(ROOT, ch, "plan.json"), "utf8"));
  const audit = JSON.parse(readFileSync(join(ROOT, ch, "audit.json"), "utf8"));
  const byIndex = new Map(audit.results.map((r) => [r.index, r]));
  const beats = [];
  for (const b of plan.beats) {
    const r = byIndex.get(b.index) || {};
    const m = r.match || "NO";
    if (r.error) tally.ERROR++; else if (tally[m] !== undefined) tally[m]++;
    if (r.timing_correct === true) timingOk++; else timingBad++;
    for (const x of r.missing || []) bump(missingTypes, x);
    for (const x of r.unexpected || []) bump(unexpectedTypes, x);
    beats.push({
      index: b.index,
      sentence: b.sentence,
      planned_type: b.visual_type_planned,
      planned_desc: b.scene_description,
      rendered_type: b.rendered.visual_type,
      rendered_composition: b.rendered.composition,
      match: m,
      present: r.present || [],
      missing: r.missing || [],
      unexpected: r.unexpected || [],
      timing_correct: r.timing_correct,
      timing_note: r.timing_note || "",
      frames: b.frames.map((f) => ({ at: f.at, path: f.path, size: f.size, mean: f.mean, ink_fraction: f.ink_fraction, ink_bbox: f.ink_bbox })),
    });
    rows.push({ channel: ch, ...beats[beats.length - 1] });
  }
  perChannel.push({ channel: ch, run: plan.run, video: plan.video, beats });
}

const total = tally.YES + tally.PARTIAL + tally.NO;
const pct = (n) => total ? `${n} (${Math.round((n / total) * 100)}%)` : "0 (0%)";
const top = (m, n = 8) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

const summary = {
  generated: new Date().toISOString(),
  model: "gemini-3.5-flash-lite",
  runs: [...new Set(perChannel.map((c) => c.run))],
  channels: perChannel.map((c) => c.channel),
  total_beats: total,
  yes: tally.YES, partial: tally.PARTIAL, no: tally.NO, errors: tally.ERROR,
  timing_correct: timingOk, timing_incorrect: timingBad,
  common_missing: top(missingTypes).map(([k, v]) => ({ element: k, beats: v })),
  common_unexpected: top(unexpectedTypes).map(([k, v]) => ({ element: k, beats: v })),
  per_channel: perChannel.map((c) => ({
    channel: c.channel, run: c.run, video: c.video, beats: c.beats.length,
    yes: c.beats.filter((b) => b.match === "YES").length,
    partial: c.beats.filter((b) => b.match === "PARTIAL").length,
    no: c.beats.filter((b) => b.match === "NO").length,
    timing_ok: c.beats.filter((b) => b.timing_correct === true).length,
    type_divergences: c.beats.filter((b) => b.planned_type && b.rendered_type && b.planned_type !== b.rendered_type).length,
  })),
};
writeFileSync(join(ROOT, "summary.json"), JSON.stringify(summary, null, 2));
writeFileSync(join(ROOT, "rows.json"), JSON.stringify(rows, null, 2));

console.log(`total beats: ${total}`);
console.log(`YES ${pct(tally.YES)}  PARTIAL ${pct(tally.PARTIAL)}  NO ${pct(tally.NO)}  errors ${tally.ERROR}`);
console.log(`timing correct: ${timingOk}  incorrect: ${timingBad}`);
console.log("per channel:");
for (const c of summary.per_channel) console.log(`  ${c.channel}: beats=${c.beats} YES=${c.yes} PARTIAL=${c.partial} NO=${c.no} timing_ok=${c.timing_ok} type_divergence=${c.type_divergences}`);
console.log("most common missing:");
for (const m of summary.common_missing) console.log(`  ${m.beats}x ${m.element}`);
console.log("most common unexpected:");
for (const m of summary.common_unexpected) console.log(`  ${m.beats}x ${m.element}`);
