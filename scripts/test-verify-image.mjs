// node scripts/test-verify-image.mjs — the three-question verifier's rules (scripts/verify-image.cjs), offline.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { promptFor, normalizer, judge, isMoney } = require("./verify-image.cjs");
const { FLAT_MONEY } = require("./fetch-cutout-once.cjs");
const { comparisonNumbers } = await import("./gemini-visual-plan.js");
let bad = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`); };

// E.1: the owner's prompt, with the subject, its type and the scene filled in.
const p = promptFor({ scene: "A close-up photo of a metal padlock", entity: "padlock", type: "object" });
eq("prompt carries the three questions and the scene", [p.includes("1. Does this image show the subject named?"), p.includes("2. Is the image literal or figurative?"), p.includes("3. Is the image clean?"), p.includes("A close-up photo of a metal padlock")], [true, true, true, true]);
eq("money adds the flatness question; a logo the logo line", [promptFor({ entity: "dollar bill", type: "object", money: true }).includes("FLAT — centered"), promptFor({ entity: "Bosch", type: "company logo", logo: true }).includes("official LOGO of Bosch")], [true, true]);

// E.2: YES and LITERAL and CLEAN — nothing else passes.
const n = normalizer(false), nm = normalizer(true);
const v = (o) => judge(n(o), false);
eq("YES / LITERAL / CLEAN is accepted", v({ shows: "yes", kind: "literal", quality: "clean", seen: "a brass padlock" }).accept, true);
eq("CLOSE is rejected", v({ shows: "CLOSE", kind: "LITERAL", quality: "CLEAN", seen: "a combination lock" }).reason, "shows=CLOSE");
eq("FIGURATIVE is rejected", v({ shows: "YES", kind: "FIGURATIVE", quality: "CLEAN", seen: "a padlock icon" }).reason, "kind=FIGURATIVE");
eq("META is rejected", v({ shows: "YES", kind: "META", quality: "CLEAN", seen: "a shield" }).reason, "kind=META");
eq("DIRTY is rejected", v({ shows: "YES", kind: "LITERAL", quality: "DIRTY", seen: "padlock with a halo" }).reason, "quality=DIRTY");
eq("several defects are all named", v({ shows: "NO", kind: "META", quality: "DIRTY", seen: "x" }).reason, "shows=NO, kind=META, quality=DIRTY");
eq("a malformed answer is no answer", [n({ shows: "MATCH", kind: "LITERAL", quality: "CLEAN", seen: "x" }), n({ shows: "YES", kind: "LITERAL", quality: "CLEAN" })], [null, null]);
eq("money: ANGLED is rejected, FLAT accepted", [judge(nm({ shows: "YES", kind: "LITERAL", quality: "CLEAN", flat: "ANGLED", seen: "folded bill" }), true).reason, judge(nm({ shows: "YES", kind: "LITERAL", quality: "CLEAN", flat: "FLAT", seen: "a $100 bill" }), true).accept], ["flat=ANGLED", true]);
eq("money without the flat answer is no answer", nm({ shows: "YES", kind: "LITERAL", quality: "CLEAN", seen: "bill" }), null);

// G: a single bill or coin is flat money; a stack, a wallet or a card is an ordinary object.
eq("flat money", ["dollar bill", "one hundred dollar bill", "single coin", "euro banknote", "stack of bills", "banded cash bundle", "piggy bank", "credit card", "bank statement"].map((c) => FLAT_MONEY(c)), [true, true, true, true, false, false, false, false, false]);
eq("isMoney (verify-image) is broader than flat money", [isMoney("stack of bills"), isMoney("credit card")], [true, false]);

// D: the two-number rule's detector.
eq("two numbers + a comparison word", comparisonNumbers("Unemployment rose from 3.8% to 4.3%."), ["3.8%", "4.3%"]);
eq("one number is not this rule", comparisonNumbers("Unemployment is 4.3%."), null);
eq("years are not compared quantities", comparisonNumbers("It rose after the law passed in 2019 and changed in 2024."), null);
eq("spelled numbers count", comparisonNumbers("It rose from ten to twenty-two percent."), ["10", "22"]);
eq("a spelled year is not a compared number (CI run 37108869325 ch-44)", comparisonNumbers("Productivity will increase by 20% by twenty twenty-six."), null);
eq("no comparison word -> not this rule", comparisonNumbers("They hired 10 people and bought 22 machines."), null);

console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
