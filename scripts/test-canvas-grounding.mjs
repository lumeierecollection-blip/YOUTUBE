// node scripts/test-canvas-grounding.mjs — the extractors behind the new compositions (scripts/canvas-grounding.js).
import { listItemsOf, timelineOf, compareOf, documentNameOf, moneyObjectOf } from "./canvas-grounding.js";

let bad = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};

// LIST
eq("list with a lead", listItemsOf("The three tiers are basic, standard, and premium."), { lead: "The three tiers are", items: ["basic", "standard", "premium"] });
eq("list, no Oxford comma", listItemsOf("Save, invest and spend."), { lead: "", items: ["Save", "invest", "spend"] });
eq("four items", listItemsOf("Needs, wants, savings and debt."), { lead: "", items: ["Needs", "wants", "savings", "debt"] });
eq("clauses are not a list", listItemsOf("He ran to the shop, she walked home, and they stayed inside."), null);
eq("two items are not a list", listItemsOf("Rates rose, and prices followed."), null);
eq("no commas", listItemsOf("Rates rose sharply this year."), null);
eq("six items are too many", listItemsOf("a, b, c, d, e, f and g."), null);

// TIMELINE
eq("passed in 2019 ... repealed in 2024", timelineOf("The law passed in 2019 and was repealed in 2024."), [{ date: "2019", label: "The law passed" }, { date: "2024", label: "was repealed" }]);
eq("In 2019, ...; by 2024, ...", timelineOf("In 2019, the law passed; by 2024, it was repealed."), [{ date: "2019", label: "the law passed" }, { date: "2024", label: "it was repealed" }]);
eq("month and year", timelineOf("It opened in March 2021 and closed in June 2023.").map((x) => x.date), ["March 2021", "June 2023"]);
eq("one date is not a timeline", timelineOf("Sales rose in 2020."), null);
eq("a repeated year is one date", timelineOf("In 2020 sales fell and in 2020 costs rose."), null);
eq("five dates are too many", timelineOf("1990 a, 1991 b, 1992 c, 1993 d, 1994 e."), null);

// COMPARE
eq("vs", compareOf("Renters pay 42% of income versus 31% for owners."), { a: { value: "42%", label: "income" }, b: { value: "31%", label: "owners" }, relation: "vs", subject: null });
eq("from-to", compareOf("Unemployment rose from 3% to 5%."), { a: { value: "3%", label: null }, b: { value: "5%", label: null }, relation: "from-to", subject: "Unemployment" });
eq("than", compareOf("Costs hit $9 million, more than $4 million last year.").relation, "than");
eq("one figure", compareOf("Rents rose 12% last year."), null);
eq("years are not figures", compareOf("The 2019 law replaced the 2008 rule."), null);
eq("two figures, no relation", compareOf("It cost 5% and 9% of income."), null);

// DOCUMENT
eq("act", documentNameOf("The Dodd-Frank Act reshaped banking."), "Dodd-Frank Act");
eq("amendment", documentNameOf("The Fourteenth Amendment guarantees equal protection."), "Fourteenth Amendment");
eq("case", documentNameOf("Miranda v. Arizona changed policing."), "Miranda v. Arizona");
eq("acts with several words", documentNameOf("In 2010, Congress passed the Affordable Care Act."), "Affordable Care Act");
eq("no name", documentNameOf("The judge issued an order on Friday."), null);
eq("a bare Act is not a name", documentNameOf("The Act was passed."), null);

// MONEY
// An amount is not a physical money object (CI run 37795613343: banknote cutouts for amounts failed beat-check).
eq("dollars", moneyObjectOf("The fraud cost investors $105 million."), null);
eq("a receipt", moneyObjectOf("She kept the receipt for the purchase."), "receipt");
eq("cash", moneyObjectOf("They paid in cash."), "banknotes cash");
eq("euros", moneyObjectOf("The fund holds 3 billion euros."), null);
eq("no money object", moneyObjectOf("Rates rose sharply this year."), null);

console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
