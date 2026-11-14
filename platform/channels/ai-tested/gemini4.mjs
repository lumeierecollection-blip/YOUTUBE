/**
 * AI Tested: "Gemini 4 Hydrogen vs the older model, ten-digit multiplication". A faceless, serious news-card Short built only from our own stored test
 * (gemini4-data.json, built by gemini4-build-data.mjs from run 43528243932 and the earlier run 43346149304, the same ninety problems in both).
 * plan() throws if the data does not say what a line says. Known limits are spoken and shown: one run at temperature 0, a 4,096-token reply cap
 * (two empty replies), and two other Gemini 4 models that could not be tested for lack of quota.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DATA = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "gemini4-data.json"), "utf8"));

export function plan(d = DATA) {
  const { hydrogen: h, older: o, example: ex } = d;
  const lead = [...ex.older].findIndex((c, i) => c !== ex.correct[i]);
  const need = (c, m) => { if (!c) throw new Error(`gemini4 short: ${m}`); };
  need(h.big.right === 48 && h.big.of === 50, `Hydrogen six-to-ten digits is ${h.big.right}/${h.big.of}, not 48/50`);
  need(o.big.right === 0 && o.big.of === 50, `older six-to-ten digits is ${o.big.right}/${o.big.of}, not 0/50`);
  need(h.small.right === 40 && h.small.of === 40, `Hydrogen two-to-five digits is ${h.small.right}/${h.small.of}, not 40/40`);
  need(o.small.right === 27 && o.small.of === 40, `older two-to-five digits is ${o.small.right}/${o.small.of}, not 27/40`);
  need(h.all.of === 90 && h.all.right === 88 && h.empty === 2 && h.wrong_numbers === 0, "Hydrogen overall / empty replies do not match the script");
  need(lead === 4 && ex.older.length === ex.correct.length && ex.hydrogen === ex.correct && ex.correct.length === 20, `example does not match the script (lead ${lead})`);
  need(d.token_cap === 4096, "token cap changed");
  const url = d.run_url, date = d.date;
  const claim = (claim_id, text) => ({ claim_id, claim: text, source_id: "s1", source_url: url, published: date, excerpt: text, confidence: "high", status: "measured_statistic", context: `Measured by this repository's own test, run on GitHub Actions on ${date}; the older model's answers are from the earlier run on the same problems (${d.earlier_run_url}, ${d.earlier_date}).` });
  const claims = [
    claim("big", `On the fifty multiplications of six to ten digits, answering with only the number, ${d.new_model} got 48 right and ${d.old_model} got 0 right.`),
    claim("example", `For ${ex.a} × ${ex.b}, ${d.old_model}'s answer matches the correct product for the first four digits and then differs; ${d.new_model}'s answer matches all twenty digits.`),
    claim("design", `Both models were given the same ninety multiplications, ten at each size from two to ten digits, one attempt each at temperature 0; code checked every digit.`),
    claim("small", `On the forty multiplications of two to five digits, ${d.new_model} got 40 right and ${d.old_model} got 27 right.`),
    claim("empty", `${d.new_model} missed two of the ninety; both misses were empty replies, and none of its replies was a wrong number.`),
    claim("limits", `One run at temperature 0 with a ${d.token_cap}-token reply limit; two other Gemini 4 models could not be tested because the key had no quota for them.`),
  ];
  const V = (text, claim_ids = []) => ({ text, claim_ids });
  const NR = { allow_no_claim: true, editorial: "question for viewers, drawn from the measured results" };
  const slots = [ // one sentence per variant: the fitter counts sentences
    { id: "hook", scene: 0, variants: [V("On big multiplications, the older model got none right.", ["big"]), V("The older model got none right.", ["big"])] },
    { id: "hook2", scene: 0, variants: [V("Gemini 4 Hydrogen got forty-eight of fifty.", ["big"]), V("Hydrogen got forty-eight of fifty.", ["big"])] },
    { id: "ex1", scene: 1, variants: [V("Take one ten-digit pair.", ["example"]), V("One ten-digit pair.", ["example"])] },
    { id: "ex2", scene: 1, variants: [V("The older model was right for four digits, then wrong.", ["example"]), V("The older model failed after four digits.", ["example"])] },
    { id: "ex3", scene: 1, variants: [V("Hydrogen got all twenty.", ["example"])] },
    { id: "design", scene: 2, variants: [V("We gave both models the same ninety multiplications, from two digits to ten, and code checked every digit.", ["design"]), V("Ninety multiplications, two to ten digits, every digit checked by code.", ["design"])] },
    { id: "small", scene: 3, variants: [V("Up to five digits, Hydrogen was perfect.", ["small"]), V("Up to five digits, Hydrogen got forty of forty.", ["small"])] },
    { id: "small2", scene: 3, variants: [V("The older model got twenty-seven of forty.", ["small"]), V("The older model, twenty-seven.", ["small"])] },
    { id: "empty", scene: 4, variants: [V("Hydrogen missed two, and both were empty replies, not wrong numbers.", ["empty"]), V("Its two misses were empty replies, not wrong numbers.", ["empty"])] },
    { id: "limits", scene: 5, variants: [V("This was one run, with a reply limit that may have cut answers short.", ["limits"]), V("One run, with a reply limit.", ["limits"])] },
    { id: "limits2", scene: 5, optional: true, variants: [V("Two other Gemini 4 models could not be tested.", ["limits"])] },
    { id: "ask", scene: 5, optional: true, ...NR, variants: [V("Would you trust it with your sums?")] },
  ];
  const scenes = [
    { kind: "hook", treatment: "two-big-numbers", objective: "Lead with the result: 0 of 50 against 48 of 50", background: "dark news card" },
    { kind: "example", treatment: "digit-compare", objective: "One ten-digit pair, digit by digit", background: "dark news card" },
    { kind: "design", treatment: "big-number-card", objective: "Ninety multiplications, same problems, code checked", background: "dark news card" },
    { kind: "results", treatment: "ranked-table", objective: "Right answers by size for both models, with the source line", background: "dark news card" },
    { kind: "empty", treatment: "big-number-card", objective: "The two misses were empty replies", background: "dark news card" },
    { kind: "close", treatment: "limits-list", objective: "Known limits, then the question", background: "dark news card" },
  ];
  return { claims, slots, scenes, data: d, sources: [{ source_id: "s1", url, published: date, title: "AI Tested Gemini 4 Hydrogen multiplication test run" }] };
}
