// node scripts/test-trending-entities.mjs — named entities from trending titles (scripts/trending-entities.cjs).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const T = require("./trending-entities.cjs");
let bad = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`); };
const places = await T.placeNames();
const e = T.extractEntities([
  "Jerome Powell says the Fed will cut rates by 0.25% in December",
  "SEC charges David Rivera over $245 million crypto heist in Miami",
  "Why Everyone Is Quitting Their Jobs In 2026",
  "Engel unveils new injection molding line at Chinaplas",
  "Venezuela oil exports hit 25 million barrels",
  "Sixth title is never read: Elon Musk",
], places);
eq("people", e.people, ["Jerome Powell", "David Rivera"]);
eq("places (country / state names from geo-regions)", e.places, ["Venezuela"]);
eq("organizations (acronyms, company words)", e.organizations, ["SEC"]);
eq("other names (unclassified; a month is not one)", e.names, ["Fed", "Miami", "Engel", "Chinaplas"]);
eq("numbers", e.numbers, ["0.25%", "$245 million", "2026", "25 million"]);
eq("a Title Case headline gives no names", T.extractEntities(["Why Everyone Is Quitting Their Jobs In 2026"], places).names, []);
eq("only the top 5 titles", e.people.includes("Elon Musk"), false);
console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
