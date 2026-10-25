/**
 * gate-clone-cadence — does the RENDERED video obey the laws the reference videos obey?
 *
 *   node scripts/gate-clone-cadence.mjs --video <mp4> [--grammar config/clone-grammar.json] [--out report.json] [--advisory]
 *
 * Measures the video with the same metric the references were measured with (scripts/lib/novelty.mjs: when does something NEW appear, immune to the
 * renderer's sway and to camera slides) and holds it to config/clone-grammar.json `laws`, which scripts/derive-clone-grammar.mjs derived from the
 * references. Exit 1 on a breach. `--advisory` reports and exits 0 (used to MEASURE non-clone videos against the same laws without judging them).
 *
 * Where it stops: it counts edges that appear, not whether they are a good picture or a legible word. A flickering video background would read as
 * constant novelty. It is the cadence law only; legibility and legality are the clone family's own checks (clone-layout.js, the frame review).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { measureVideo } from "./lib/novelty.mjs";

const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const video = arg("video");
if (!video) { console.error("usage: node scripts/gate-clone-cadence.mjs --video <mp4> [--grammar <json>] [--out <json>] [--advisory]"); process.exit(2); }
const G = JSON.parse(readFileSync(arg("grammar", "config/clone-grammar.json"), "utf8")), L = G.laws;
const m = measureVideo(video);

const checks = [
  ["new elements per 10 s", m.events_per_10s, `>= ${L.events_per_10s_min}`, m.events_per_10s >= L.events_per_10s_min],
  ["cuts per 10 s", m.cuts_per_10s, `>= ${L.cuts_per_10s.min}`, m.cuts_per_10s >= L.cuts_per_10s.min],
  ["90th-percentile wait for something new (s)", m.gap_s.p90, `<= ${L.gap_p90_max_s}`, m.gap_s.p90 <= L.gap_p90_max_s],
  ["longest wait for something new (s)", m.gap_s.max, `<= ${L.gap_max_s}`, m.gap_s.max <= L.gap_max_s],
];
console.log(`${m.file}  ${m.duration_s}s  (laws from ${L.from.length} references)`);
for (const [name, got, want, ok] of checks) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}: ${got}  (law ${want})`);
const failing = checks.filter((c) => !c[3]).map((c) => c[0]);
const longWaits = [];
{ let prev = 0; for (const t of m.events_at.concat([m.duration_s])) { if (t - prev > L.gap_max_s) longWaits.push(`${prev.toFixed(1)}s-${t.toFixed(1)}s (${(t - prev).toFixed(1)} s)`); prev = t; } }
if (longWaits.length) console.log(`  waits over ${L.gap_max_s} s: ${longWaits.join(", ")}`);
if (arg("out")) writeFileSync(arg("out"), JSON.stringify({ video: m.file, measured: m, laws: L, failing, long_waits: longWaits }, null, 2) + "\n");
console.log(failing.length ? `${failing.length} law(s) broken${process.argv.includes("--advisory") ? " (advisory)" : ""}` : "every cadence law holds");
process.exit(failing.length && !process.argv.includes("--advisory") ? 1 : 0);
