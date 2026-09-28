// node scripts/test-tts-normalize.mjs — the TTS normalizer cases (src/utils/tts-normalize.js).
import { speakable } from "../src/utils/tts-normalize.js";
const cases = [
  ["The 50/30/20 rule is simple.", "The fifty, thirty, twenty rule is simple."],
  ["Needs take 50%.", "Needs take fifty percent."],
  ["Housing is 34% of income.", "Housing is thirty-four percent of income."],
  ["He raised $1.5M in a year.", "He raised one point five million dollars in a year."],
  ["A $2 billion deal.", "A two billion dollars deal."],
  ["It cost 1,000 workers.", "It cost one thousand workers."],
  ["Profits fell in Q1.", "Profits fell in first quarter."],
  ["Growth in Q2/Q3 slowed.", "Growth in second and third quarter slowed."],
  ["Expect 10–20 new rules.", "Expect ten to twenty new rules."],
  ["Needs rise to 55-60%.", "Needs rise to fifty-five to sixty percent."],
  ["Debt → default.", "Debt leads to default."],
  ["Rates ↑ and savings ↓.", "Rates up and savings down."],
  ["Johnson & Johnson paid.", "Johnson and Johnson paid."],
  ["Buy/sell pressure.", "Buy and sell pressure."],
  ["#1 rule *always*.", "one rule always."],
  ["In 2026, the Fed moved.", "In twenty twenty-six, the Fed moved."],
  ["A $105M Ponzi scheme.", "A one hundred five million dollars Ponzi scheme."],
  ["Output grew 3x in the U.S. last year.", "Output grew three times in the U.S. last year."],
  ["The 1st and 22nd cases.", "The first and twenty-second cases."],
  ["Stay-or-pay rules tighten in 5 states.", "Stay-or-pay rules tighten in five states."],
  ["Over 10,000 units at 10 minutes takt time.", "Over ten thousand units at ten minutes takt time."],
];
let fail = 0;
for (const [i, want] of cases) { const got = speakable(i); const ok = got === want; if (!ok) fail++; console.log(ok ? "ok  " : "FAIL", JSON.stringify(i), "->", JSON.stringify(got), ok ? "" : `(want ${JSON.stringify(want)})`); }
console.log(fail ? `${fail} FAILED` : "all pass");
process.exit(fail ? 1 : 0);
