/**
 * derive-clone-grammar — measure the reference videos and write what they OBEY to config/clone-grammar.json.
 *
 *   node scripts/derive-clone-grammar.mjs            measure every video in REFERENCES, rewrite `measured` and `laws`; `profiles` is kept
 *   node scripts/derive-clone-grammar.mjs --check    measure, compare with the committed file, exit 1 on drift (CI)
 *
 * Owner, 2026-10-15: clone "the concepts behind" the reference videos, "the laws that govern it ... how quickly every X seconds there is a
 * change". `measured` is per-reference and comes from decoded pixels (scripts/lib/novelty.mjs). `laws` are DERIVED from `measured` by the rules in
 * `lawRules` below — never typed by hand, so a different reference set gives different laws and the code that reads them does not change.
 * `profiles` are the qualitative half (ground, type roles, entrances, element kinds) written by a person who watched each video; they name the
 * reference they came from and are the only hand-written part.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { measureVideo } from "./lib/novelty.mjs";

const OUT = "config/clone-grammar.json";
const REFERENCES = [
  "research/motion-graphics-ref/ref-01.mp4",
  "research/motion-graphics-ref/ref-03.mp4",
  "research/4_5764834761163939028.mp4",
  "research/4_5904230506030964428.mp4",
  "research/4_5917850534521349237.mp4",
  "research/VID_20261002_003228_944.mp4",
  "research/VID_20261002_003244_575.mp4",
  "research/VID_20261002_003250_292.mp4",
  "research/VID_20261002_003254_139.mp4",
];

const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); const k = (s.length - 1) * q / 100, f = Math.floor(k), c = Math.min(s.length - 1, f + 1); return s[f] + (s[c] - s[f]) * (k - f); };
const r1 = (x) => +x.toFixed(1);

/** The rules that turn measurements into laws. Each law says which statistic over which references and why. */
export const lawRules = {
  events_per_10s_min: "the 10th percentile of the references' events per 10 s, rounded down: at most one reference in ten is sparser than this (ref-01, the slow archival one, is)",
  gap_p90_max_s: "the largest reference 90th-percentile wait for something new: nine waits in ten are at most this long",
  gap_max_s: "the largest single wait in any reference but the longest one (an outlier that is an advert's held end card), rounded up to 0.5 s: no wait is longer",
  shot_median_s: "the range of the references' median shot (time between whole-frame cuts): where a shot should sit",
  cuts_per_10s: "the range of the references' cuts per 10 s",
};

export function lawsFrom(measured) {
  const rows = Object.values(measured);
  const ev = rows.map((m) => m.events_per_10s), p90 = rows.map((m) => m.gap_s.p90), mx = rows.map((m) => m.gap_s.max).sort((a, b) => a - b);
  const sm = rows.map((m) => m.shot_s.median), cp = rows.map((m) => m.cuts_per_10s);
  const outlierFree = mx.slice(0, -1);   // drop the single longest
  return {
    events_per_10s_min: Math.floor(pct(ev, 10)),
    gap_p90_max_s: r1(Math.max(...p90)),
    gap_max_s: Math.ceil(Math.max(...outlierFree) * 2) / 2,
    shot_median_s: { min: r1(Math.min(...sm)), max: r1(Math.max(...sm)) },
    cuts_per_10s: { min: r1(Math.min(...cp)), max: r1(Math.max(...cp)) },
    from: Object.keys(measured),
  };
}

function main() {
  const check = process.argv.includes("--check");
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  const measured = {};
  for (const f of REFERENCES) {
    const r = measureVideo(f);
    const { events_at, cuts_at, ...rest } = r;
    measured[f.split("/").pop().replace(/\.mp4$/, "")] = { ...rest, source: f };
    console.log(`${r.file.padEnd(34)} ${r.duration_s}s  events/10s ${r.events_per_10s}  cuts/10s ${r.cuts_per_10s}  gap p90 ${r.gap_s.p90} max ${r.gap_s.max}  shot median ${r.shot_s.median}`);
  }
  const doc = { _about: "Derived by scripts/derive-clone-grammar.mjs from the reference videos. `measured` and `laws` are regenerated; `profiles` is hand-written.", lawRules, measured, laws: lawsFrom(measured), profiles: prev.profiles || {}, grammar: prev.grammar || {} };
  if (check) {
    const same = JSON.stringify({ measured: doc.measured, laws: doc.laws }) === JSON.stringify({ measured: prev.measured, laws: prev.laws });
    console.log(same ? "clone-grammar.json matches the references" : "DRIFT: clone-grammar.json no longer matches what the references measure");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
  console.log(`wrote ${OUT}\nlaws:`, JSON.stringify(doc.laws));
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) main();
