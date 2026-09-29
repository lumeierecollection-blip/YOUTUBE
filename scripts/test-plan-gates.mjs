// node scripts/test-plan-gates.mjs — planner gate cases (scripts/gemini-visual-plan.js):
// flow sentences -> PROCESS nodes from the sentence's own words, identifier
// numbers are not counters, a one-bar BAR is its figure; and the entity
// resolver's acronym rule (scripts/entity-assets.cjs).
import { createRequire } from "node:module";
import { flowNodes, checkVisual, isIdentifierNumber } from "./gemini-visual-plan.js";
const { expandName } = createRequire(import.meta.url)("./entity-assets.cjs");

let bad = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};

// flowNodes: both sides of a stated flow, else null.
eq("lead to", flowNodes("Failure to do so can lead to legal repercussions."), ["Failure", "legal repercussions"]);
eq("boosts, stops at a preposition", flowNodes("Building trust boosts employee engagement across teams."), ["Building trust", "employee engagement"]);
eq("because reverses", flowNodes("Prices fell sharply because demand collapsed."), ["demand collapsed", "Prices fell sharply"]);
eq("no flow word", flowNodes("The SEC sued Kristopher Lunsford for fraud."), null);
eq("no content before the flow word", flowNodes("It then becomes a habit."), null);
for (const s of ["Failure to do so can lead to legal repercussions.", "Higher rates raise borrowing costs for families."]) {
  eq(`PROCESS gate passes flowNodes of "${s}"`, checkVisual({ visual_type: "PROCESS", data: { nodes: flowNodes(s) } }, s).type, "PROCESS");
}

// Identifier numbers.
eq("Article 10", isIdentifierNumber("10", "Article 10 of the treaty was invoked."), true);
eq("Section 357-A", isIdentifierNumber("357-A", "Section 357-A of the CrPC ensures compensation."), true);
eq("765 victims", isIdentifierNumber("765", "The scheme hit 765 victims."), false);
eq("Phase 2 and 2 ships (a count too)", isIdentifierNumber("2", "Phase 2 begins now, with 2 ships."), false);
eq("COUNTER Article 10 rejected", checkVisual({ visual_type: "COUNTER", data: { value: "10" } }, "Article 10 of the treaty was invoked.").type, "TYPE");

// One bar is the figure.
eq("one-bar BAR", checkVisual({ visual_type: "BAR", data: { bars: [{ label: "Annual Volume", value: "500 million" }] } }, "It processes 500 million records a year."),
  { type: "COUNTER", data: { value: "500 million", label: "Annual Volume" } });

// Acronyms: only unambiguous expansions, organizations only.
eq("SEC", expandName("organization", "SEC").name, "U.S. Securities and Exchange Commission");
eq("NHRC refused", !!expandName("organization", "NHRC").refuse, true);
eq("place UK untouched", expandName("place", "UK"), { name: "UK" });

console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
