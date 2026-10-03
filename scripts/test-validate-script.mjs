// node scripts/test-validate-script.mjs — the script specificity validator (scripts/validate-script.cjs).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const V = require("./validate-script.cjs");
let bad = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`); };
const script = (...vo) => ({ sections: vo.map((v, i) => ({ id: `s${i}`, voiceover: v })) });
// In CI the research artifact is passed: its named_entities make a sentence-initial name count.
const RESEARCH = { named_entities: [{ name: "Engel" }, { name: "Chinaplas" }, { name: "Jerome Powell" }] };
const score = (s) => V.validateScript(script(s), RESEARCH).sentences[0].score;

// The owner's ALLOWED / FORBIDDEN examples (task 2.2).
eq("Powell + 0.25% + September 18", score("Jerome Powell raised rates by 0.25% on September 18.") >= 2, true);
eq("the Miami federal courthouse", score("The Miami federal courthouse ruled against the company.") >= 2, true);
eq("Engel at Chinaplas", score("Engel announced the new injection molding line at Chinaplas.") >= 2, true);
eq("'Rates are going up.' scores 0", score("Rates are going up."), 0);
eq("'Companies are adopting AI.' — AI is an acronym name, scores 1", score("Companies are adopting AI."), 1);
eq("'This trend is expected to continue.' scores 0", score("This trend is expected to continue."), 0);
eq("'Experts say it's complicated.' scores 0", score("Experts say it's complicated."), 0);

// Banned phrases (apostrophes normalized).
eq("banned: experts say", V.validateScript(script("Experts say Ford will cut 4,000 jobs in Detroit.")).banned, ["experts say"]);
eq("banned: curly apostrophe here’s why", V.validateScript(script("Here’s why Ford cut 4,000 jobs in Detroit.")).banned, ["here's why"]);

// Sentence splitting keeps decimals and abbreviations whole.
eq("'0.25%' and 'U.S.' do not split", V.sentences("The U.S. Federal Reserve raised rates by 0.25% today. Powell spoke at 2 p.m. in Washington.").length, 2);
eq("a unit word is not a scale: 150 meter", V.specificsOf("a 150 meter radius").numbers, ["150"]);

// A sentence-initial word is a name only in a run, or when capitalized elsewhere / a research entity.
eq("without the research, a sentence-initial name is not counted (documented limit)", V.validateScript(script("Engel announced a new line.")).sentences[0].names, []);
eq("'Financial planners' is not a name", V.specificsOf("Financial planners now recommend saving.").names, []);
eq("'Kagan disagreed' after 'Kagan' mid-script is a name", V.validateScript(script("Justice Elena Kagan wrote the ruling. Kagan disagreed with the 2018 precedent.")).sentences[1].names, ["Kagan"]);

// The whole-script verdicts.
{
  const r = V.validateScript(script("Ford cut 4,000 jobs at its Detroit plant in June.", "The United Auto Workers union filed a $2 billion lawsuit."));
  eq("a specific script passes", [r.specOk, r.ratioOk, r.pass], [true, true, true]);
}
{
  const r = V.validateScript(script("Ford cut 4,000 jobs in Detroit.", "That single month is the difference between panic and stability."));
  eq("a zero sentence fails, with feedback naming it", [r.pass, V.feedbackLines(r).some((l) => l.includes("panic and stability"))], [false, true]);
}
{
  // Task 4: names a company, still abstract.
  const r = V.validateScript(script("Engel represents a significant trend in the industry, a shift in strategy and a new approach to innovation."), RESEARCH);
  eq("Engel + trend/industry/shift/strategy/approach/innovation: ratio fails", [r.ratioOk, r.concrete, r.abstract], [false, 1, 6]);
}

console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
