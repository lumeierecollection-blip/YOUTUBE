// node scripts/test-resolve-scene.mjs — the scene resolver's offline parts (scripts/resolve-scene.cjs, scripts/verify-place-image.cjs).
// The network paths (Wikipedia, Commons, Pixabay, the vision models) run in CI and log every step.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const R = require("./resolve-scene.cjs");
const P = require("./verify-place-image.cjs");
let bad = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`); };

// Place verifier: the owner's question verbatim; only MATCH is accepted.
eq("place prompt asks the owner's question", P.promptFor("Miami, Florida").startsWith("Does this image show Miami, Florida? Answer MATCH, CLOSE, or WRONG."), true);
eq("MATCH is read", P.normalize({ verdict: "match", seen: "Miami skyline at dusk" }).verdict, "MATCH");
eq("CLOSE is read (and the caller rejects it)", P.normalize({ verdict: "CLOSE", seen: "a generic courthouse" }).verdict, "CLOSE");
eq("an unknown verdict is no answer", P.normalize({ verdict: "YES", seen: "x" }), null);
eq("no 'seen' is no answer", P.normalize({ verdict: "MATCH" }), null);

// Proper names in a scene_description (task 2.2): capitalized runs, leading articles dropped, scene words ignored.
eq("proper names", R.properNames("A portrait of Jerome Powell, the Federal Reserve chairman. An exterior photograph of the Miami federal courthouse."), ["Jerome Powell", "Federal Reserve", "Miami"]);
eq("no names in a typographic scene", R.properNames("Kinetic typography: the word everything, large."), []);

// An entity type the resolver does not fetch is refused without a network call.
const r = await R.resolveSceneEntity({ channel: "t", beatIndex: 1, entity: { type: "object", name: "padlock" } });
eq("an object is not resolved here (the cutout path fetches it)", [r.ok, r.why], [false, "not a real-world entity type"]);
// A common noun typed as a building is not a named entity (CI run 37110620556 ch-2: "field office").
const fo = await R.resolveSceneEntity({ channel: "t", beatIndex: 2, entity: { type: "building", name: "field office" } });
eq("'field office' is not a proper name: not looked up, no name card", [fo.ok, fo.refused, fo.why], [false, true, "not a proper name"]);

// An acronym with no unambiguous expansion ("AI", "ED" — CI run 37074911159) is refused before any lookup, flagged so no name card is made.
const ai = await R.resolveSceneEntity({ channel: "t", beatIndex: 2, entity: { type: "organization", name: "AI" } });
eq("a bare acronym is refused (no photo, no name card)", [ai.ok, ai.refused], [false, true]);

// A date typed as a place ("September 2026" — CI run 37079127196 ch-44) is refused: no lookup, no name card.
for (const d of ["September 2026", "2026", "Q3 2026", "October 1, 2026"]) {
  const r = await R.resolveSceneEntity({ channel: "t", beatIndex: 4, entity: { type: "place", name: d } });
  eq(`a date is not a place: "${d}"`, [r.ok, r.refused], [false, true]);
}
// A name the scene_description adds must be a proper name in the sentence (not its first word).
{
  const logs = [];
  const named = (n, s) => s.toLowerCase().includes(n.toLowerCase());
  const ents = await R.sceneEntities({ beat: { index: 4, named_entities: [], scene_description: "The word Safety, large, over a red warning band." }, sentence: "Safety at risk across the plant.", entityNamedInSentence: named, log: (m) => logs.push(m) });
  eq("'Safety' (the sentence's first word) is not added as an entity", [ents.length, logs.some((l) => /not a proper name/.test(l))], [0, true]);
}

// A person the sentence introduces by name is not the Wikipedia namesake (CI run 37114977307
// ch-26: "a man named David Rivera" got the congressman's portrait).
eq("'a man named David Rivera' is a private individual", R.introducedByName("David Rivera", "A twenty-two-year-old man named David Rivera just pleaded guilty to a crypto heist"), true);
eq("'Jerome Powell said' is not introduced by name", R.introducedByName("Jerome Powell", "Jerome Powell said rates will hold."), false);
eq("a name with regex characters does not throw", R.introducedByName("J. (Jay) Smith", "a man called J. (Jay) Smith"), true);
eq("same-person prompt asks SAME/DIFFERENT/UNSURE", /Answer SAME, DIFFERENT, or UNSURE/.test(R.samePersonPrompt("X", "s", { title: "X", description: "d", extract: "e" })), true);
eq("SAME is read", R.normalizeSame({ verdict: "same", why: "w" }).verdict, "SAME");
eq("an unknown verdict is no answer (fails closed)", R.normalizeSame({ verdict: "YES" }), null);

console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
