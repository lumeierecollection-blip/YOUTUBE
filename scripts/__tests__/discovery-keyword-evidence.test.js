// Evidence for the measurable-keyword rule, from REAL reserved titles in data/topic-log.json (ch-1, ch-2, ch-48; read 2026-10-29).
// Pure: no network. Titles only (the log has no angles), so these exercise the title rule and the angle fallback by construction.
//
// Measured on 318 reserved titles (title rule only):  whole-word passes 6/117 (ch-1), 5/127 (ch-2), 3/74 (ch-48); of the last 25
// per channel 0, 5 and 0. The old substring rule passed 11, 19 and 8, of which 5, 14 and 5 were not measurable at all
// ("strategy" contains "rate", "arbitration" contains "ratio", "nonprofits" contains "profit"...).
//
// Three groups, three kinds of guarantee:
//   1. FALSE POSITIVES the whole-word rule fixed: must stay rejected.
//   2. TRUE POSITIVES: must stay accepted.
//   3. KNOWN LIMITATION, pinned as it is today: titles with a clear numeric hook are rejected because the keyword list is a word list.
//      This is NOT an endorsement. Changing the policy (e.g. counting a non-year number or a currency/percentage figure) is a separate,
//      deliberate decision that should be evaluated against labelled outcomes; when it is made, change group 3 on purpose.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkMeasurableKeywords } from "../validate-discovery.js";

const passes = async (topic, angle) => (await checkMeasurableKeywords({ topic, angle })).pass;

const FALSE_POSITIVES_FIXED = {
  "ch-1": ["debt payoff strategies", "The 2026 National Strategy for Financial Literacy and Saving Priorities"],
  "ch-2": [
    "Supreme Court Rules Last-Mile Drivers Exempt From Arbitration",
    "Can State Subpoenas Force Nonprofits to Disclose Donor Lists?",
    "DOJ Declares Title VII Disparate Impact Liability Unconstitutional",
  ],
  "ch-48": [
    "How Through-Glass Vias Are Manufactured for AI Chip Substrates",
    "KUKA AMP: The Open Orchestration Platform for Physical AI",
    "HKS Designs New People-First Corporate Real Estate Strategy",
    "New Tool for AI-Generated 3D Models",
  ],
};

for (const [ch, titles] of Object.entries(FALSE_POSITIVES_FIXED)) {
  test(`${ch}: words that merely CONTAIN a keyword do not make a topic measurable`, async () => {
    for (const t of titles) assert.equal(await passes(t), false, t);
  });
}

test("the same substring words in the ANGLE do not satisfy the two-keyword fallback either", async () => {
  assert.equal(await passes("A topic with no keyword", "arbitration strategies for corporate substrates and nonprofits"), false);
});

const TRUE_POSITIVES = [
  "How the Fed's 2026 Rate Shift Reshapes Your 50/30/20 Budget", // ch-1: "rate"
  "September 2026 U.S. Consumer Price Index Inflation Breakdown", // ch-2: "index"
  "MiniMax M3.1 Flash vs DeepSeek and Opus 5 Benchmarks", // ch-2: "benchmark(s)"
  "South Korea Bets $1 Billion on Physical AI for Factories", // ch-48: "billion"
  "Inside the Global 5-Million Robot Milestone: IFR World Robotics", // ch-48: "million" after a hyphen
];
test("real titles with a genuine measurable word still pass (plurals and hyphen-joined numbers included)", async () => {
  for (const t of TRUE_POSITIVES) assert.equal(await passes(t), true, t);
});

test("an angle with at least two whole-word keywords rescues a title without one", async () => {
  assert.equal(await passes("Inside a Chip Fabrication Plant", "A survey of yield and revenue per wafer"), true);
  assert.equal(await passes("Inside a Chip Fabrication Plant", "A survey of how wafers are made"), false, "one keyword in the angle is not enough");
});

// ---- KNOWN LIMITATION (pinned, not endorsed) --------------------------------------------------------------------------------------
const NUMERIC_HOOK_REJECTED_TODAY = [
  "Inside a Chip Fabrication Plant: How 3nm Transistors Are Made", // ch-48: "3nm"
  "Humanoid Robots at BMW: 30,000 X3s Built in an 11-Month Pilot", // ch-48: 30,000 / 11-month
  "50/30/20 budget breakdowns", // ch-1: a stated ratio
  "UK Renters' Rights Act: No-Fault Evictions Officially End May 2026", // ch-2: a date only - arguably correct to reject
];
test("KNOWN LIMITATION: titles whose only measurable cue is a number are rejected today (decide the policy deliberately before changing this)", async () => {
  for (const t of NUMERIC_HOOK_REJECTED_TODAY) assert.equal(await passes(t), false, t);
});
