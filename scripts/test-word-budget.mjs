/**
 * The write-script prompt's word budget must be inside the script gate's
 * own valid range for EVERY channel style.
 *
 * This is a drift test, and it exists because the drift already happened and
 * cost real runs. prompts/write-script.md advertised a flat "75-130 words"
 * for all 17 channels while scripts/gate-script.js derived the valid range
 * per style from WPM_TARGET:
 *
 *   cinematic-documentary  135 wpm  ->  68-112 words
 *   motion-graphics        155 wpm  ->  78-129 words
 *   minimal                165 wpm  ->  83-137 words
 *
 * So the prompt's floor (75) was below the gate's floor for two of three
 * styles, its ceiling (130) was above the gate's ceiling for the third, and
 * the prompt additionally said "Shorter is better" — pushing the model at
 * the end that fails. A model that obeyed the prompt was rejected
 * deterministically, five attempts, then the channel produced nothing.
 * Observed in runs 35211514030 and 35266860427: channel 1 wrote 62 then 64
 * words, channel 48 wrote 57.
 *
 * If WPM_TARGET or DURATION_RANGE_SECONDS ever change, this fails and the
 * prompt must be updated with the new numbers.
 *
 *   node scripts/test-word-budget.mjs
 */

import { readFileSync } from "node:fs";
import { WPM_TARGET, DURATION_RANGE_SECONDS } from "./gate-script.js";

let failed = 0;
let passed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; } else { failed++; console.log(`  FAIL  ${msg}`); }
};

const PROMPT = "prompts/write-script.md";
const text = readFileSync(PROMPT, "utf8");

/* ── What the gate actually allows, per style ────────────────────────── */

const { min: minSec, max: maxSec } = DURATION_RANGE_SECONDS.shorts;
const perStyle = Object.entries(WPM_TARGET).map(([style, wpm]) => ({
  style,
  wpm,
  // gate: impliedSeconds = words / wpm * 60, must be within [min, max]
  lo: Math.ceil(minSec * wpm / 60),
  hi: Math.floor(maxSec * wpm / 60),
}));

// The range that satisfies every style at once.
const safeLo = Math.max(...perStyle.map((s) => s.lo));
const safeHi = Math.min(...perStyle.map((s) => s.hi));

console.log("\n1. The gate's valid ranges are computable and non-empty");
for (const s of perStyle) {
  console.log(`   ${s.style.padEnd(24)} ${s.wpm} wpm -> ${s.lo}-${s.hi} words`);
  ok(s.lo < s.hi, `${s.style}: gate range is non-empty`);
}
console.log(`   safe for ALL styles: ${safeLo}-${safeHi} words`);
ok(safeLo < safeHi,
  `a range valid for every style exists (${safeLo}-${safeHi}) — if this fails, the WPM spread is too wide for one shared prompt and the budget must be injected per channel`);

console.log("2. The prompt advertises a range, and it is the safe one");
{
  // Every "NN-MM words" pair the prompt states.
  const ranges = [...text.matchAll(/(\d{2,3})\s*-\s*(\d{2,3})\s*words/g)]
    .map((m) => [Number(m[1]), Number(m[2])]);
  ok(ranges.length > 0, "the prompt states a word range at all");

  for (const [lo, hi] of ranges) {
    ok(lo >= safeLo,
      `stated floor ${lo} is not below the gate's floor ${safeLo} (a model obeying it would fail SCR-16)`);
    ok(hi <= safeHi,
      `stated ceiling ${hi} is not above the gate's ceiling ${safeHi}`);
  }

  // Every stated range must be identical — two different budgets in one
  // prompt is how the old version drifted (header said one, checklist another).
  const unique = new Set(ranges.map(([a, b]) => `${a}-${b}`));
  ok(unique.size === 1,
    `the prompt states ONE word range, not several (found: ${[...unique].join(", ")})`);
}

console.log("3. The prompt does not push the model toward the failing edge");
{
  ok(!/shorter is better/i.test(text),
    '"Shorter is better" is gone — it biased the model below the gate floor');
  ok(/hard gate|BLOCKER/i.test(text),
    "the prompt tells the model the word count is a gate, not a preference");
}

console.log("4. The observed failures would now be rejected by the prompt itself");
{
  for (const words of [62, 64, 57]) {
    ok(words < safeLo,
      `${words} words (a real observed failure) is below the advertised floor ${safeLo}`);
  }
  // And a mid-range script passes for every style.
  const mid = Math.round((safeLo + safeHi) / 2);
  for (const s of perStyle) {
    const secs = (mid / s.wpm) * 60;
    ok(secs >= minSec && secs <= maxSec,
      `${mid} words -> ${secs.toFixed(1)}s passes the gate for ${s.style}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
