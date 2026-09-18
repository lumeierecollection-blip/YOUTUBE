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
import { WPM_TARGET, DURATION_RANGE_SECONDS, TTS_RATE_FACTOR, effectiveWpm } from "./gate-script.js";

let failed = 0;
let passed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; } else { failed++; console.log(`  FAIL  ${msg}`); }
};

// EVERY prompt the script stage sees. write-script.md is the user prompt;
// style-contract.md is appended as the SYSTEM prompt
// (--append-system-prompt-file in daily-pipeline-v2.yml) and so carries at
// least as much weight.
//
// Checking only write-script.md was not enough. style-contract.md held a
// THIRD budget — "shorts: 90–130 words (HARD CAP: 55 seconds)... pack
// maximum information density into fewer words... cut filler ruthlessly" —
// so after write-script.md was fixed the model still drifted short: ch48
// went 71 -> 61 -> 48 words in run 35317469026 while the gate was telling
// it to ADD words. Three sources of truth, two of them wrong.
const PROMPTS = ["prompts/write-script.md", "prompts/style-contract.md"];
const text = PROMPTS.map((f) => readFileSync(f, "utf8")).join("\n");

/* ── What the gate actually allows, per style ────────────────────────── */

const { min: minSec, max: maxSec } = DURATION_RANGE_SECONDS.shorts;
const perStyle = Object.entries(WPM_TARGET).map(([style, wpm]) => {
  // EFFECTIVE wpm, not nominal. EdgeTTS delivers at rate=-8% (tts.js), so
  // the nominal figure under-predicts duration by ~9% — ch48 passed at a
  // predicted 49.9s and rendered 55.49s in run 35319923732.
  const eff = effectiveWpm(style);
  return {
    style, wpm, eff,
    lo: Math.ceil((minSec * eff) / 60),
    hi: Math.floor((maxSec * eff) / 60),
  };
});

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
  // EN DASH, not just hyphen. Both prompts write "83–112 words" with
  // U+2013, so a hyphen-only pattern matched NOTHING in style-contract.md
  // and this section silently checked an empty list — the guard passed
  // while a conflicting "90–130 words (HARD CAP: 55 seconds)" budget sat in
  // the system prompt. Caught only by reintroducing the bad budget and
  // watching the test still pass.
  //
  // Ranges over 200 are longform section-word counts (e.g. 700–950), not a
  // shorts voiceover budget, so they are excluded rather than compared.
  const ranges = [...text.matchAll(/(\d{2,3})\s*[-–—]\s*(\d{2,4})\s*words/g)]
    .map((m) => [Number(m[1]), Number(m[2])])
    .filter(([, hi]) => hi <= 200);
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
  // Any phrasing that makes a SHORT script feel like the safe choice.
  // "into fewer words" and "cut filler ruthlessly" survived in the system
  // prompt after write-script.md was fixed, and ch48 still drifted
  // 71 -> 61 -> 48 words while the gate told it to ADD words.
  for (const bias of [/into fewer words/i, /cut filler ruthlessly/i, /every word fights/i]) {
    ok(!bias.test(text), `no short-bias phrasing matching ${bias} in any script prompt`);
  }
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
