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

// An acronym with no unambiguous expansion ("AI", "ED" — CI run 37074911159) is refused before any lookup, flagged so no name card is made.
const ai = await R.resolveSceneEntity({ channel: "t", beatIndex: 2, entity: { type: "organization", name: "AI" } });
eq("a bare acronym is refused (no photo, no name card)", [ai.ok, ai.refused], [false, true]);

console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
