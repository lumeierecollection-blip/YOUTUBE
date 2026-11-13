/**
 * AI Tested: "Can AI multiply big numbers?" Built from the multiplication test already run on GitHub Actions (run 43346149304; stored slim in
 * multiply-data.json): Gemini 3.1 Flash-Lite, ten problems at every size from two to ten digits, once answering with only the number and (from six
 * digits) once showing its working. Code marked every answer digit by digit. Nothing here is measured again; every sentence is tied to a claim
 * that is checked against the stored data before it is spoken (plan() throws if the data does not say what the line says).
 * Script order follows the 12 Nov 2026 retention report: the result and the surprise come first, the set-up is one short line.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DATA = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "multiply-data.json"), "utf8"));
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "twenty-one", "twenty-two", "twenty-three", "twenty-four", "twenty-five"];
export const say = (n) => ONES[n] ?? String(n);

export function plan(d = DATA) {
  const { miss, direct, worked } = d;
  const lead = [...miss.answer].findIndex((c, i) => c !== miss.correct[i]); // number of leading digits that agree
  const sum = (o, keys) => keys.reduce((s, k) => s + o[k].right, 0), tot = (o, keys) => keys.reduce((s, k) => s + o[k].of, 0);
  const big = ["6", "7", "8", "9", "10"], wRight = sum(worked, big), wOf = tot(worked, big), dBig = sum(direct, big);
  // the lines below say these things; refuse to go on if the data does not
  if (lead !== 4 || miss.answer.length !== miss.correct.length || miss.answer.length !== 16) throw new Error(`example does not match the script: leading digits ${lead}, lengths ${miss.answer.length}/${miss.correct.length}`);
  if (direct["2"].right !== 10 || direct["2"].of !== 10) throw new Error("two-digit result is not 10 of 10");
  if (dBig !== 0 || tot(direct, big) !== 50) throw new Error(`six-to-ten-digit direct result is ${dBig} of ${tot(direct, big)}, not 0 of 50`);
  if (wRight !== 21 || wOf !== 25) throw new Error(`worked result is ${wRight} of ${wOf}, not 21 of 25`);
  const url = d.run_url, date = d.date;
  const claim = (claim_id, text) => ({ claim_id, claim: text, source_id: "s1", source_url: url, published: date, excerpt: text, confidence: "high", status: "measured_statistic", context: `Measured by this repository's own test, run on GitHub Actions on ${date}: ${d.method}.` });
  const claims = [
    claim("miss", `For ${miss.a} × ${miss.b} the model answered ${miss.answer}; the product computed by code is ${miss.correct}. Both have sixteen digits and the first four digits agree; the fifth differs.`),
    claim("design", `${d.model.name} was given ten multiplication problems at every size from two to ten digits, one attempt each at temperature 0, and code checked every digit of every answer.`),
    claim("direct", `Answering with only the number, ${d.model.name} got 10 of 10 right at two digits and 0 of 10 at each size from six to ten digits.`),
    claim("worked", `Asked to show its working, ${d.model.name} got ${wRight} of ${wOf} right across six to ten digits (5, 5, 4, 4 and 3 of 5).`),
  ];
  const V = (text, claim_ids = []) => ({ text, claim_ids });
  const NR = { allow_no_claim: true, editorial: "recommendation or question for viewers, drawn from the measured results" };
  const slots = [
    { id: "hook", scene: 0, variants: [V("Ask AI to multiply two eight-digit numbers, and the first four digits come out right.", ["miss"]), V("AI got the first four digits of a big multiplication right.", ["miss"])] },
    { id: "hook2", scene: 0, variants: [V("Everything after that was wrong.", ["miss"])] },
    { id: "example", scene: 1, optional: true, variants: [V("Sixteen digits, the right length, and still wrong.", ["miss"]), V("Right length, wrong number.", ["miss"])] },
    { id: "design", scene: 2, variants: [V("We gave Gemini Flash-Lite ten problems at every size, from two digits to ten.", ["design"]), V("Ten problems at every size, two digits to ten.", ["design"])] },
    { id: "design2", scene: 2, optional: true, variants: [V("Code checked every digit.", ["design"])] },
    { id: "results", scene: 3, variants: [V("At two digits it was perfect, and from six digits up it got none right.", ["direct"]), V("Perfect at two digits, none right from six.", ["direct"])] },
    { id: "fix", scene: 4, variants: [V(`Then we asked it to show its working, and it got ${say(wRight)} of ${say(wOf)} right.`, ["worked"]), V(`With its working shown, ${say(wRight)} of ${say(wOf)} were right.`, ["worked"])] },
    { id: "tip", scene: 5, ...NR, variants: [V("So make AI show its working, or check its sums with code."), V("So make AI show its working.")] },
    { id: "ask", scene: 5, optional: true, ...NR, variants: [V("Would you have checked?")] },
  ];
  const scenes = [
    { kind: "hook", treatment: "big-numeral-and-wrong-answer", objective: "Lead with the result: first four digits right, then wrong", background: "paper panel in saturated frame" },
    { kind: "example", treatment: "digit-by-digit-compare", objective: "Show the model's answer beside the correct product, digit by digit", background: "paper panel in saturated frame" },
    { kind: "design", treatment: "size-cards", objective: "Show the sizes tested, ten problems each", background: "paper panel in saturated frame" },
    { kind: "results", treatment: "bar-per-size", objective: "Right answers by size when answering with only the number", background: "paper panel in saturated frame" },
    { kind: "fix", treatment: "paired-bars", objective: "Compare number-only with working shown, six to ten digits", background: "paper panel in saturated frame" },
    { kind: "tip", treatment: "title-with-stamp", objective: "Close: make AI show its working; ask if the viewer would have checked", background: "paper panel in saturated frame" },
  ];
  const data = { date, model: d.model.name, lead, miss, direct, worked, wRight, wOf };
  return { claims, slots, scenes, data, sources: [{ source_id: "s1", url, published: date, title: "AI Tested multiplication test run" }] };
}
