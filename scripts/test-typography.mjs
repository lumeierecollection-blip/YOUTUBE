// node scripts/test-typography.mjs — the type system (visual/typography.js).
import { sentenceCase, numberParts, numberSlots, fitNumber, fitHeadline, fitEmphasis, measure, ROLE_HEADLINE, ROLE_NUMBER, ROLE_DATA, ROLE_EMPHASIS, ROLES, roleFont } from "../src/skills/remotion-render/visual/typography.js";

let bad = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};
const yes = (name, cond, detail = "") => { if (!cond) bad++; console.log(`${cond ? "ok  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };

// Three roles + emphasis; two families only.
yes("four roles", Object.keys(ROLES).join() === "headline,number,data,emphasis");
yes("two families", new Set([ROLE_HEADLINE.family, ROLE_NUMBER.family, ROLE_NUMBER.familySmall, ROLE_DATA.family, ROLE_EMPHASIS.family]).size === 2);
yes("headline is never all-caps", ROLE_HEADLINE.caseMode === "sentence" && ROLE_EMPHASIS.caseMode === "sentence");
eq("headline band", ROLE_HEADLINE.sizeBand, [160, 260]);
eq("number band", ROLE_NUMBER.sizeBand, [260, 420]);
eq("data band", ROLE_DATA.sizeBand, [24, 48]);
eq("emphasis band", ROLE_EMPHASIS.sizeBand, [400, 600]);
yes("font shorthand", roleFont(ROLE_HEADLINE, 160) === "600 160px Fraunces, Georgia, serif", roleFont(ROLE_HEADLINE, 160));
yes("small numbers are Inter", roleFont(ROLE_NUMBER, 60).includes("Inter") && roleFont(ROLE_NUMBER, 300).includes("Fraunces"));

// Sentence case is rebuilt from the narration.
eq("all caps + source", sentenceCase("SEC SUES FOR FRAUD", "The SEC sued him for fraud."), "SEC sues for fraud");
eq("proper noun kept", sentenceCase("TRUCKING ENTREPRENEUR INDICTED", "A trucking entrepreneur was indicted."), "Trucking entrepreneur indicted");
eq("mid-sentence proper noun", sentenceCase("PONZI SCHEME IN MIAMI", "He ran a Ponzi scheme in Miami."), "Ponzi scheme in Miami");
eq("figures untouched", sentenceCase("$127 MILLION PONZI SCHEME", "It was a $127 million Ponzi scheme."), "$127 million Ponzi scheme");
eq("no source: acronym heuristic", sentenceCase("DOJ FILES INDICTMENT"), "DOJ files indictment");
eq("already sentence case", sentenceCase("Rates rise again"), "Rates rise again");
eq("first letter capitalised", sentenceCase("the fix"), "The fix");

// Numbers.
eq("$105M", numberParts("$105M"), { pre: "$", digits: "105", suffix: "M", scaleWord: "", percent: false, post: "", isQuantity: true, text: "$105M" });
eq("$127 million", numberParts("$127 million").scaleWord, "million");
eq("percent", numberParts("34%").percent, true);
eq("year snaps", numberParts("2026").isQuantity, false);
eq("identifier snaps", numberParts("357-A").isQuantity, false);
eq("commas kept", numberParts("1,400,000").digits, "1,400,000");

// Slots and fits.
const p105 = numberParts("$105M");
const sl = numberSlots(p105, 340);
eq("$ slot is 0.5x", sl.slots[0].size, 170);
eq("M slot is 0.59x", Math.round(sl.slots.at(-1).size), 201);
yes("$105M at 340 fits the frame", sl.width < 1000, `${Math.round(sl.width)} px`);
yes("hero number keeps the 260-420 band when it fits", fitNumber(numberParts("105"), 1000).size === 420, `size ${fitNumber(numberParts("105"), 1000).size}`);
const big = fitNumber(numberParts("105,000,000"), 1000);
yes("a 9-digit number shrinks below the band rather than crossing the frame", big.size < 260 && !big.inBand && numberSlots(numberParts("105,000,000"), big.size).width <= 1000, `size ${big.size}`);
yes("a counting number's slots do not depend on the value shown", numberSlots(numberParts("105"), 340).width === numberSlots(numberParts("105"), 340).width);

// Headline / emphasis fits.
const h = fitHeadline("Fraud", 1000);
yes("one short word takes the top of the band", h.size === 260 && h.inBand, `size ${h.size}`);
const h2 = fitHeadline("Trucking entrepreneur indicted", 1000, { maxLines: 4 });
yes("a 3-word headline stays in the 160-260 band", h2.inBand && h2.lines.length <= 4, `size ${h2.size}, ${h2.lines.length} lines`);
const h3 = fitHeadline("Reduce your global trade data research time by ninety percent", 1000, { maxLines: 4 });
yes("a long headline steps down to the floor, not past it", h3.size >= 88 && !h3.inBand, `size ${h3.size}`);
yes("headline widths use measured metrics", measure("Trucking", 160, { family: "Fraunces", weight: 600 }) > 400);
eq("emphasis: 3 letters fills the band top", fitEmphasis("Cut", 1000)?.size, 600);
yes("emphasis: 5 letters fits the width", (fitEmphasis("Fraud", 1000)?.size ?? 0) >= 240);
eq("emphasis: a long word is refused", fitEmphasis("Unprecedented", 1000), null);

console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
