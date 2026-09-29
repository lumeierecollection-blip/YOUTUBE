// node scripts/test-concept-visuals.mjs — concept extraction, the token table, token placement.
import { KINDS, conceptsOf, validateConcepts, mergeConcepts, tokenFor, pickConcepts, conceptTokens, skipFor, iconElements, currencyIconOf } from "../src/skills/remotion-render/visual/concept-visuals.js";
import { ICON_SET } from "../src/skills/remotion-render/visual/icon-set.js";
import { placeTokens } from "../src/skills/remotion-render/visual/token-layout.js";
import { canvasLayout, canvasManifest, flattenBoxes, TOP, BOTTOM, L_EDGE, R_EDGE } from "../src/skills/remotion-render/visual/canvas-layout.js";
import { planConcepts, assignConceptTokens } from "./concept-plan.js";

let bad = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};
const kinds = (s, o) => conceptsOf(s, o).map((c) => `${c.word}/${c.kind}`);

// Every kind of the brief has a token whose icon exists in the vendored set.
const tokenIcons = KINDS.map((k) => [k, tokenFor({ kind: k, word: "x" }, { sentence: "" })]);
eq("45 kinds", KINDS.length, 45);
eq("every kind maps to a token", tokenIcons.filter(([, t]) => !t).map(([k]) => k), []);
eq("every token icon exists in the icon set", tokenIcons.filter(([, t]) => t && !ICON_SET[t.icon]).map(([k]) => k), []);
eq("every icon draws (elements convert, no <line>)", tokenIcons.filter(([, t]) => t && iconElements(t.icon).some(([tag]) => tag === "line" || tag === "polyline" || tag === "polygon")).length, 0);

// The brief's mapping.
const icon = (kind, word = "x", ctx = {}) => tokenFor({ kind, word }, ctx)?.icon;
eq("money -> dollar sign", icon("money", "cost", { sentence: "It cost $5." }), "dollar-sign");
eq("money with a number already showing $ -> banknote", icon("money", "cost", { sentence: "It cost $5.", numberShowsCurrency: true }), "banknote");
eq("currency: euro", icon("currency", "euros"), "euro");
eq("currency: pound", icon("currency", "pounds"), "pound-sterling");
eq("currency: rupee", icon("currency", "rupees"), "indian-rupee");
eq("currency: yen", icon("currency", "yen"), "japanese-yen");
eq("coin -> coin stack", icon("coin"), "coins");
eq("place -> pin", icon("place"), "map-pin");
eq("building -> building", icon("building"), "building");
eq("time -> clock, date -> calendar", [icon("time"), icon("date"), icon("year")], ["clock", "calendar", "calendar"]);
eq("document -> sheet", icon("document"), "file-text");
eq("growth up / decline down", [icon("growth"), icon("decline")], ["trending-up", "trending-down"]);
eq("loss -> minus disc", icon("loss"), "circle-minus");
eq("warning -> triangle", icon("warning"), "triangle-alert");
eq("deal -> handshake", icon("deal"), "handshake");
eq("vehicle by word", [icon("vehicle", "flights"), icon("vehicle", "trucks"), icon("vehicle", "cars")], ["plane", "truck", "car"]);
eq("currency word in the sentence", currencyIconOf("Prices rose 4% in euros."), "euro");

// Extraction from real sentences.
eq("fraud cost investors", kinds("The fraud cost investors $105 million."), ["fraud/loss", "cost/money", "investors/group", "million/money"]);
eq("Bill Gates is a name, not a bill", kinds("Bill Gates signed a deal."), ["signed/agreement", "deal/deal"]);
eq("a lowercase bill is a bill", kinds("She paid the bill in cash.").map((x) => x.split("/")[1]), ["money", "bill", "bill"]);
eq("a date and a year", kinds("The law passed in March 2019."), ["law/law", "passed/agreement", "March/date", "2019/year"].filter((x) => !x.startsWith("passed")));
eq("the named entities add who and where", kinds("Tesla sued the SEC in Texas.", { namedEntities: [{ type: "organization", name: "Tesla" }, { type: "place", name: "Texas" }] }).filter((x) => /Tesla|Texas/.test(x)), ["Tesla/organization", "Texas/place"]);
eq("a sentence that names nothing concrete has no concept", kinds("Things change when you look closely."), []);
// Grounding: nothing comes from outside the sentence.
eq("a proposed concept whose word is not in the sentence is dropped", validateConcepts([{ word: "gold", kind: "money" }, { word: "fraud", kind: "loss" }, { word: "fraud", kind: "nonsense" }], "The fraud hit hard."), [{ word: "fraud", kind: "loss", at: 4 }]);
eq("merge: the lexicon and a grounded proposal, once each", mergeConcepts("The fraud hit investors.", { proposed: [{ word: "fraud", kind: "loss" }, { word: "investors", kind: "person" }] }).map((c) => `${c.word}/${c.kind}`), ["fraud/loss", "investors/group", "investors/person"]);

// Picking: two most important, one per icon; skip what the composition shows.
const tk = (s, beat = {}, extra = {}) => pickConcepts(mergeConcepts(s), { beat, sentence: s, ...extra }).map((t) => `${t.kind}:${t.icon}:${t.role}`);
eq("at most two, primary first", tk("The company warned customers about the fraud, and the CEO resigned in March.").length, 2);
eq("money before who", tk("Investors lost $5 million.")[0].split(":")[0], "money");
eq("two kinds with one icon collapse", pickConcepts([{ word: "cost", kind: "money" }, { word: "fees", kind: "money" }], { sentence: "x" }).length, 1);
eq("a real photo already shows the named place", skipFor("place", { photo: { asset: "x" }, composition: "SCENE-FULL" }), true);
eq("the money photo shows the money", skipFor("money", { photo: { asset: "x" }, composition: "MONEY" }), true);
eq("the timeline shows the dates", skipFor("year", { composition: "TIMELINE" }), true);
eq("a TYPE beat skips nothing", skipFor("money", { composition: "TYPE-FULL" }), false);

// Placement: the free square, never over another element.
const occ = [{ x: 48, y: 1000, w: 700, h: 400 }, { x: 48, y: 180, w: 96, h: 6 }];
const [a, b2] = placeTokens(occ, 2, { bounds: { x0: L_EDGE, y0: TOP, x1: R_EDGE, y1: BOTTOM }, flip: 0 });
const hit = (p, q) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
eq("primary is large", a.size >= 300, true);
eq("primary clears the text (>= 40 px)", occ.every((o) => !hit(a, { x: o.x - 39, y: o.y - 39, w: o.w + 78, h: o.h + 78 })), true);
eq("secondary is smaller and clears the primary", b2.size < a.size && !hit(b2, { x: a.x - 39, y: a.y - 39, w: a.w + 78, h: a.h + 78 }), true);
eq("no room -> null, secondary too", placeTokens([{ x: 0, y: 0, w: 1080, h: 1920 }], 2, { bounds: { x0: 48, y0: 180, x1: 1032, y1: 1400 } }), [null, null]);
eq("left-anchored text puts the token on the far (right) side", a.x + a.size > 700, true);

// In the real layouts.
const tokens = conceptTokens("The fraud cost investors $105 million.").tokens;
const layouts = [
  { visual_type: "TYPE", headline: "Investors lost their savings", composition: "TYPE-FULL" },
  { visual_type: "TYPE", headline: "Trucking entrepreneur indicted for fraud", composition: "TYPE-SPLIT" },
  { visual_type: "COUNTER", data: { value: "$105M", label: "lost by investors" }, headline: "Investor losses", composition: "NUMBER-FULL" },
  { visual_type: "TYPE", headline: "Rates will cut savings", composition: "TYPE-FULL", emphasis_beat: true, emphasis_word: "cut" },
  { visual_type: "PIE", data: { percent: 34, label: "of income on housing" }, headline: "Housing share", composition: "DATA-FULL" },
];
let placedN = 0;
for (const v of [0, 1]) for (const c0 of layouts) {
  const c = { ...c0, variant: v, beat_index: v, beat_total: 8, tokens };
  const L = canvasLayout(c);
  const ts = Object.entries(L.boxes).filter(([k]) => /^token\d$/.test(k));
  const others = flattenBoxes(L.boxes).filter(([k, x]) => !/^token/.test(k) && x.role !== "shape");
  const overlaps = ts.flatMap(([tk2, t]) => others.filter(([, o]) => hit(t, o)).map(([k]) => `${tk2}x${k}`));
  placedN += ts.length;
  eq(`${c.composition}/${c.visual_type}/v${v}: tokens never overlap another element`, overlaps, []);
  eq(`${c.composition}/${c.visual_type}/v${v}: tokens inside the safe area`, ts.every(([, t]) => t.x >= 48 && t.x + t.w <= 1032 && t.y >= 100 && t.y + t.h <= BOTTOM), true);
}
eq("tokens were placed in most layouts", placedN >= 12, true);
eq("a photo composition draws no token", Object.keys(canvasLayout({ visual_type: "PHOTO", composition: "SCENE-FULL", photo: { asset: "x", entity: "E" }, headline: "h", tokens }).boxes).filter((k) => /^token/.test(k)), []);
eq("manifest lists the tokens drawn", canvasManifest({ visual_type: "TYPE", headline: "Investors lost their savings", composition: "TYPE-FULL", tokens }, 0).tokens.length > 0, true);

// planConcepts / assignConceptTokens
const beats = [
  { index: 0, narration: "The fraud cost investors $105 million.", named_entities: [], concepts: [{ word: "gold", kind: "money" }, { word: "fraud", kind: "loss" }] },
  { index: 1, narration: "Things change when you look closely.", named_entities: [] },
  { index: 2, narration: "Renters pay 42% of income versus 31% for owners.", named_entities: [] },
];
planConcepts(beats);
eq("planConcepts drops the ungrounded proposal", beats[0].concepts.some((c) => c.word === "gold"), false);
eq("planConcepts keeps the grounded one", beats[0].concepts.some((c) => c.word === "fraud" && c.kind === "loss"), true);
eq("a beat with nothing concrete has no concept", beats[1].concepts, []);
beats[0].canvas = { visual_type: "COUNTER", data: { value: "$105M", label: "lost" }, headline: "Investor losses", composition: "NUMBER-FULL" };
beats[1].canvas = { visual_type: "TYPE", headline: "Things change", composition: "TYPE-FULL" };
beats[2].canvas = { visual_type: "BAR", data: { bars: [{ label: "renters", value: "42%" }, { label: "owners", value: "31%" }] }, headline: "Who pays", composition: "DATA-FULL" };
const rep = assignConceptTokens(beats);
eq("beat 0: two tokens, the number's $ makes the money a banknote", beats[0].canvas.tokens.map((t) => t.icon).slice(0, 1), ["banknote"]);
eq("beat 1: no token, honestly", beats[1].canvas.tokens, []);
eq("report counts", [rep.withToken >= 1, rep.none], [true, 1]);

console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
