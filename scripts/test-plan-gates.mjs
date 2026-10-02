// node scripts/test-plan-gates.mjs — planner gate cases (scripts/gemini-visual-plan.js):
// flow sentences -> PROCESS nodes from the sentence's own words, identifier
// numbers are not counters, a one-bar BAR is its figure; and the entity
// resolver's acronym rule (scripts/entity-assets.cjs).
import { createRequire } from "node:module";
import { flowNodes, checkVisual, isIdentifierNumber, groundedOptions, VISUAL_TYPES, checkEntities } from "./gemini-visual-plan.js";
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

// The new compositions: valid exactly when the sentence states one; the data is the extractor's.
const list = checkVisual({ visual_type: "LIST", data: { items: ["invented", "words", "here"] } }, "The three tiers are basic, standard, and premium.");
eq("LIST: the sentence's own items win over the model's", list.data?.items, ["basic", "standard", "premium"]);
eq("LIST: no enumeration -> TYPE", checkVisual({ visual_type: "LIST", data: { items: ["a", "b", "c"] } }, "Rates rose sharply.").type, "TYPE");
const tl = checkVisual({ visual_type: "TIMELINE", data: {} }, "The law passed in 2024 and was drafted in 2019.");
eq("TIMELINE: sorted by year", tl.data?.markers?.map((m) => m.date), ["2019", "2024"]);
eq("TIMELINE: one date -> TYPE", checkVisual({ visual_type: "TIMELINE", data: {} }, "Sales rose in 2020.").type, "TYPE");
eq("COMPARE: vs", checkVisual({ visual_type: "COMPARE", data: {} }, "Renters pay 42% of income versus 31% for owners.").data?.relation, "vs");
eq("COMPARE: one figure -> TYPE", checkVisual({ visual_type: "COMPARE", data: {} }, "Rents rose 12% last year.").type, "TYPE");
eq("DOCUMENT: names an instrument", checkVisual({ visual_type: "DOCUMENT", data: {} }, "The Dodd-Frank Act reshaped banking.").data?.name, "Dodd-Frank Act");
eq("DOCUMENT: no name -> TYPE", checkVisual({ visual_type: "DOCUMENT", data: {} }, "The judge issued an order.").type, "TYPE");
eq("MONEY: the object and the figure", checkVisual({ visual_type: "MONEY", data: {} }, "The fraud cost investors $105 million.").data, { object: "United States dollar banknotes", value: "$105 million" });
eq("MONEY: no money object -> TYPE", checkVisual({ visual_type: "MONEY", data: {} }, "Rates rose sharply.").type, "TYPE");
eq("COUNTER: a year is a hero number now (it snaps in)", checkVisual({ visual_type: "COUNTER", data: { value: "1938", label: "the year" } }, "The law passed in 1938.").type, "COUNTER");
eq("COUNTER: an identifier is still refused", checkVisual({ visual_type: "COUNTER", data: { value: "10" } }, "Article 10 of the treaty was invoked.").type, "TYPE");
eq("14 visual types (CUTOUT is gone)", VISUAL_TYPES.length, 14);
eq("groundedOptions offers COMPARE", groundedOptions("Renters pay 42% of income versus 31% for owners.").allowed.includes("COMPARE"), true);
eq("groundedOptions offers TIMELINE", groundedOptions("The law passed in 2019 and was repealed in 2024.").allowed.includes("TIMELINE"), true);
eq("a second date with no label is no timeline (nothing is invented)", groundedOptions("Rates rose in 2019 and 2024.").allowed.includes("TIMELINE"), false);
eq("groundedOptions offers PROCESS only for a stated flow", groundedOptions("Rates rose sharply.").allowed.includes("PROCESS"), false);

// Scene resolver entity types (owner's spec 2026-10-02): building / object / number are kept; each must be named in the sentence.
{
  const ce = checkEntities([{ type: "building", name: "Miami Federal Courthouse" }, { type: "object", name: "padlock" }, { type: "number", name: "$347" }, { type: "person", name: "Jerome Powell" }, { type: "object", name: "gavel" }, { type: "vehicle", name: "car" }],
    "Jerome Powell said the Miami Federal Courthouse found a padlock worth $347.");
  eq("checkEntities keeps building / object / number / person named in the sentence", ce.kept.map((e) => e.type + ":" + e.name), ["building:Miami Federal Courthouse", "object:padlock", "number:$347", "person:Jerome Powell"]);
  eq("checkEntities drops an object the sentence does not name and an unknown type", ce.dropped.length, 2);
}

console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
