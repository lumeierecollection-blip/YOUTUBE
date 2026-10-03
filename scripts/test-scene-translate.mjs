// node scripts/test-scene-translate.mjs — scene description -> composition (scripts/scene-translate.js),
// through the planner's own gate (checkVisual), as the planner picks.
import { translateScene, cuesOf } from "./scene-translate.js";
import { checkVisual } from "./gemini-visual-plan.js";
let bad = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`); };
const pick = (sentence, scene, entities = []) => {
  for (const c of translateScene({ sentence, scene, entities })) {
    const v = checkVisual({ visual_type: c.visual_type, data: c.data || {}, named_entities: entities }, sentence);
    if (!v.why && v.type === c.visual_type) return v.type;
  }
  return "TYPE";
};
// The owner's example.
eq("'a big number, 7.2%, fills the frame' -> COUNTER", pick("Mortgage rates hit 7.2% in October.", "A big number, 7.2%, fills the centre of the frame. Behind it a thin line draws left to right."), "COUNTER");
eq("a portrait of a named person -> PHOTO", pick("Jerome Powell said rates will stay high.", "A portrait of Jerome Powell, slow push in.", [{ type: "person", name: "Jerome Powell" }]), "PHOTO");
eq("a logo -> PHOTO of the company (the resolver fetches the logo)", pick("Apple sold 50 million phones in Ohio.", "The Apple logo pops in at the centre.", [{ type: "company", name: "Apple" }]), "PHOTO");
eq("a map of a named state -> MAP", pick("Ohio passed the law in June.", "A map of Ohio, the state lighting up.", [{ type: "place", name: "Ohio" }]), "MAP");
eq("two compared figures are a chart even if the scene says nothing", pick("Rates rose from 3.8% to 4.3% this year.", "Something dramatic."), "BAR");
eq("a stated flow with arrows -> PROCESS", pick("Higher rates lead to fewer home sales.", "Two nodes joined by an arrow."), "PROCESS");
eq("a described number the sentence does not say is refused (gate) -> next candidate", pick("The court ruled against the company.", "A big number fills the frame."), "TYPE");
eq("abstract with kinetic type -> TYPE", pick("This changes everything about leadership.", "Kinetic type: the word everything slams in."), "TYPE");
eq("cues come back in the order the description names them", cuesOf("A map of Ohio lights up while the number counts up"), ["MAP", "COUNTER"]);
console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
