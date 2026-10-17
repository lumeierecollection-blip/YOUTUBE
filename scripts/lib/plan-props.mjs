/**
 * plan-props — a real cut-out PHOTO for every beat of a clone video, chosen by Gemini, fetched and verified by the pipeline.
 *
 * Owner, 2026-10-16: "Make it so that it does have a PNG cutout in every frame ... make that Gemini's task ... if the sentence mentions something like a court
 * or a house, have a PNG photo of a court, of a house. Not a specific one, but just like a model, actual photo PNG of the place and not an asset, like an
 * icon. We never ever have icons." The reference videos put an isolated object in nearly every shot (money bags, cash, a ladder, an alarm clock); our clone
 * renders had pictures in 0-15 of ~30 shots, because a cut-out was only fetched when the sentence named one of 39 library objects.
 *
 * Division of labour:
 *   - GEMINI decides WHAT each beat shows: 3-4 PROPS per beat, generic photographable things that illustrate that sentence (what it names first: "court"
 *     -> a courthouse; then its subject matter: savings -> a piggy bank). One call for the whole video, so props differ from beat to beat.
 *   - THIS FILE checks every proposal (validateProps): a short concrete noun phrase; never a named / specific entity (that is the real-photo path in
 *     entity-assets.cjs); never a person (a stranger standing in a story about a named person reads as that person); never text, a screen, a logo, an
 *     icon, a symbol, a chart or an illustration; never an abstract idea.
 *   - scripts/fetch-cutout-once.cjs fetches each prop (Pixabay PHOTOS only, image_type=photo), isolates it (rembg + geometric checks) and has a vision
 *     model confirm the isolated PNG LITERALLY shows the prop. A prop that fails is replaced by the beat's next proposal.
 *
 * LITERAL, NOT SYMBOLIC (owner, 2026-10-16: "make sure it collects the correct PNG ... we wouldn't want PNGs that don't make sense, say gold bars, but it's a
 * house"). Boards 38889577784 / 38890511624 failed their beat checks on metaphors Gemini chose: a compass for "achieving outcomes", a padlock for "misleading
 * lenders", an hourglass for "ten years", an anchor for stability, an alarm clock, a mailbox, a cherub statue, puzzle pieces. So every proposal names the
 * words of its sentence it depicts (`depicts`), and isLiteral() keeps it only when
 *   (a) the object IS a thing the sentence names (a word of the object is a word of the sentence: "gold bars" <- "gold bars"; "house" <- "his house"), or
 *   (b) the object is the plain physical form of something the sentence says, from the fixed DEPICTS table below ("pleaded guilty" -> a courthouse or a
 *       gavel; "$40 million" -> dollar bills; "diesel" -> a fuel pump; "tenants" -> an apartment building).
 * Anything else is refused, whatever Gemini says. A symbol therefore passes only when the sentence literally names it ("a compass" for "his compass").
 * A beat whose sentence has nothing photographable gets no prop: its named entity's picture or its words in type carry it — never a wrong picture.
 *
 * Where this stops: a prop ILLUSTRATES a sentence, it is not evidence for it, and the owner accepted that (2026-10-16). It never stands for a specific
 * named thing: "a courthouse" is drawn, never "Southwark Crown Court" — that one is shown only from its own verified photo. DEPICTS is a hand-kept table:
 * a subject it does not list gets props only from words the sentence names.
 */

export const MAX_PROPS = 4;

// Never a prop: people (a stranger reads as the story's named person), words on things, marks, drawings and abstractions.
const PEOPLE = /\b(man|men|woman|women|person|people|boy|girl|child|children|kid|kids|baby|worker|workers|officer|officers|judge|lawyer|doctor|nurse|teacher|student|students|ceo|businessman|businesswoman|crowd|family|couple|actor|actress|politician|president|soldier|player|fan|fans|face|hand|hands|silhouette|figure|portrait|selfie|human|humans)\b/i;
const NOT_PHOTO = /\b(icon|icons|logo|logos|symbol|symbols|emoji|illustration|drawing|cartoon|vector|clipart|clip-art|graphic|graphics|chart|graph|diagram|infographic|sign|signs|signage|banner|poster|text|word|words|letter|letters|headline|newspaper|screen|screenshot|website|app|map|flag|arrow|arrows|silhouette)\b/i;
const ABSTRACT = /\b(idea|ideas|concept|success|failure|growth|economy|policy|risk|future|change|freedom|justice|truth|power|love|fear|hope|time|money\s+concept|strategy|problem|solution|crisis|trend|market|markets|inflation|value|values|culture|history|news|story|life|death|anxiety|stress)\b/i;

// (b) The plain physical form of what a sentence says: [what the sentence says, objects that show it]. An object qualifies when one of its words starts
// is one of the listed words (singular or plural). Nothing symbolic is listed (no scales, compass, ladder, lightbulb, hourglass, padlock, chess piece, puzzle, target).
const DEPICTS = [
  [/\$|£|€|\b(dollars?|cash|money|paid|pays?|payments?|funds?|fraud\w*|millions?|billions?|bribe\w*|salar\w*|wages?|income|savings?|saved|debts?|loans?|lend\w*|stole|stolen|steal\w*|embezzl\w*|prices?|costs?|spent|spend\w*|budget\w*|profits?|revenue|tax|taxes|invest\w*|bank\w*|financ\w*|afford\w*|refund\w*|fines?|fined|settlement|compensat\w*)\b/i,
    ["dollar", "bill", "banknote", "cash", "money", "coin", "wallet", "piggy", "calculator", "safe", "vault", "briefcase", "cheque", "check", "credit card", "bank"]],
  [/\bgold\b/i, ["gold", "ingot"]],
  [/\b(courts?|courtroom|trials?|judges?|jury|juror\w*|sentenc\w*|plead\w*|plea|guilty|convict\w*|lawsuits?|sued|sues|suing|prosecut\w*|indict\w*|verdict|testif\w*|ruling|ruled|appeal\w*|charged|charges|legal|lawyers?|attorneys?|acquit\w*)\b/i,
    ["courthouse", "court", "courtroom", "gavel", "law book", "witness stand", "jury box"]],
  [/\b(arrest\w*|police|sheriff\w*|officers?|jail\w*|prisons?|custody|detain\w*|inmates?|crimes?|criminal\w*|charged|raid\w*|seiz\w*|fbi|investigat\w*|suspects?)\b/i,
    ["police car", "patrol car", "handcuff", "prison", "jail", "prison cell", "jail cell", "evidence bag", "police"]],
  [/\b(houses?|homes?|homeowners?|rent\w*|tenants?|landlords?|housing|apartments?|mortgages?|evict\w*|propert\w*|real estate|residen\w*|neighbou?rhoods?)\b/i,
    ["house", "home", "apartment", "keys", "front door", "door"]],
  [/\b(oil|fuel|diesel|gasoline|petrol|crude|petroleum|refin\w*|pipelines?|energy|gas)\b/i,
    ["oil", "barrel", "fuel", "pump", "tanker", "refinery", "pipeline", "rig", "gas"]],
  [/\b(electric\w*|power grid|grid|power plants?|solar|wind)\b/i, ["power line", "transformer", "power plant", "solar", "turbine", "pylon"]],
  [/\b(ships?|shipping|shipments?|exports?|imports?|trade|traders?|tariffs?|supply chains?|cargo|ports?|goods|freight|sanction\w*|smuggl\w*)\b/i,
    ["cargo", "ship", "container", "crane", "freight", "truck", "crate", "pallet", "box"]],
  // Things an office HAS, not what people DO there: board 39031532519 ch-44 put an antique desk next to "Deepak Malhotra published research" and a
  // laptop next to "Katie Shonk analyzed business skills" — "negotiators", "business", "research", "study" are activities, and a desk / laptop / book
  // for them is a loose association. Those words were dropped from these two rows; the objects still come from what the sentence names.
  [/\b(compan\w*|firms?|corporat\w*|offices?|workplace|layoffs?|contracts?|signed)\b/i,
    ["office", "desk", "laptop", "briefcase", "chair", "computer", "filing cabinet", "folder", "document", "paperwork", "pen", "fountain pen", "contract", "conference table"]],
  [/\b(schools?|universit\w*|colleges?|students?|classrooms?|professors?|campus|lab|labs|laborator\w*|experiments?|dna|forensic\w*|remains|bones?|autops\w*)\b/i,
    ["university", "school", "book", "textbook", "graduation", "academic cap", "mortarboard", "classroom", "notebook", "microscope", "test tube", "lab", "petri", "beaker", "flask", "pen"]],
  [/\b(hospitals?|health\w*|medical|medicines?|doctors?|patients?|drugs?|disease\w*|vaccin\w*|virus\w*|therap\w*|clinic\w*|nurses?|pharma\w*)\b/i,
    ["hospital", "stethoscope", "pill", "syringe", "ambulance", "medicine", "clinic"]],
  [/\b(phones?|called|calls?|texts?|texted|messages?|smartphones?)\b/i, ["phone", "telephone", "smartphone"]],
  [/\b(emails?|letters?|mail\w*|wrote|documents?|reports?|records?|files|filed|filing|paperwork|forms?|applications?)\b/i,
    ["document", "paperwork", "paper", "folder", "envelope", "file", "pen", "letter", "notebook"]],
  [/\b(cars?|vehicles?|drove|drive\w*|crash\w*|traffic|roads?|highways?|trucks?)\b/i, ["car", "truck", "tire", "steering wheel", "road"]],
  [/\b(planes?|flights?|airlines?|airports?|flew|fly|flying|pilots?|travel\w*)\b/i, ["airplane", "plane", "jet", "suitcase", "luggage", "passport"]],
  [/\b(films?|movies?|actors?|actress\w*|hollywood|cinema|studios?|oscars?|acting|filmmak\w*|filming|filmed|box office|episodes?|horror)\b/i,
    ["film camera", "movie camera", "camera", "clapperboard", "film reel", "director", "cinema", "theater", "popcorn", "spotlight"]],
  [/\b(comedians?|comedy|stand-up|stages?|perform\w*)\b/i, ["microphone", "spotlight", "stage", "theater"]],
  [/\b(music|songs?|albums?|singers?|concerts?|band|bands)\b/i, ["microphone", "guitar", "headphone", "vinyl", "speaker"]],
  [/\b(elect\w*|votes?|voters?|voting|ballots?|campaign\w*|congress\w*|senat\w*|government|federal|legislat\w*|lawmakers?|representatives?|sponsor\w*|politic\w*|bills?|laws?|governors?|mayors?|state|officials?|agenc\w*|regulat\w*|policies)\b/i,
    ["ballot", "podium", "microphone", "government building", "capitol", "gavel", "law book", "document", "paperwork", "pen"]],
  [/\b(computers?|ai|artificial intelligence|tech\w*|software|data|online|internet|hack\w*|cyber\w*|apps?|digital|chips?|semiconductor\w*|robots?)\b/i,
    ["laptop", "computer", "server", "circuit board", "smartphone", "chip", "microchip", "keyboard", "robot"]],
  [/\b(food|groceries|grocery|farms?|farmers?|crops?|eat\w*|meals?|restaurants?)\b/i, ["grocery", "shopping cart", "food", "vegetable", "fruit", "tractor", "wheat", "plate"]],
  [/\b(shops?|shopping|stores?|retail\w*|buy\w*|bought|purchas\w*|consumers?|customers?|sales?|sold|sell\w*)\b/i, ["shopping cart", "shopping bag", "store", "receipt", "box", "package"]],
  [/\b(military|war|troops?|army|soldiers?|missiles?|drones?|weapons?|defen[cs]e)\b/i, ["tank", "drone", "missile", "military truck", "helmet"]],
  [/\b(fires?|burn\w*|blaze|flames?)\b/i, ["fire truck", "fire hydrant", "fire extinguisher"]],
  // digging is done WITH a shovel / an excavator: the literal tool of the act (test run 39037009215 ch-6: "dug up the backyard", "excavated", "unearthed"
  // left 7 of 8 beats without a picture). Luminol / DNA are forensic work: the kit it uses.
  [/\b(dig|digs|digging|dug|excavat\w*|unearth\w*|backyard|soil|dirt)\b/i, ["shovel", "spade", "excavator", "wheelbarrow", "heavy machinery"]],
  [/\b(luminol|blood\w*|fingerprints?|evidence)\b/i, ["evidence bag", "test tube", "spray bottle", "fingerprint kit"]],
  [/\b(bod(y|ies)|dead|death|killed|murder\w*|homicide|victims?|graves?|buried|cemeter\w*)\b/i, ["evidence bag", "police car", "shovel"]],
];
const MODIFIER = new Set(["stack", "stacks", "pile", "piles", "pair", "set", "bundle", "bundles", "box", "bag", "of", "the", "a", "an", "old", "new", "small", "large", "big", "vintage", "modern", "empty", "full", "wooden", "metal", "open", "closed", "red", "black", "white", "blue"]);
const stem = (w) => String(w || "").toLowerCase().replace(/ies$/, "y").replace(/(ses|xes|ches|shes)$/, (m) => m.slice(0, -2)).replace(/s$/, "");
const wordsOf = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9$£€\s-]/g, " ").split(/[\s-]+/).filter(Boolean);

/** (a) or (b) above: is this object a thing the sentence names, or the plain physical form of something it says? Returns the reason, or null. */
export function isLiteral(object, sentence) {
  const sw = wordsOf(sentence).filter((w) => w.length >= 3).map(stem);
  const ow = wordsOf(object).filter((w) => w.length >= 3 && !MODIFIER.has(w)).map(stem);
  const named = ow.find((o) => sw.some((s) => s === o || (s.length >= 5 && o.startsWith(s))));   // courthouse <- court; never office <- officers
  if (named) return `the sentence names "${named}"`;
  const obj = String(object || "").toLowerCase();
  for (const [says, shows] of DEPICTS) {
    const m = String(sentence || "").match(says);
    if (!m) continue;
    const hit = shows.find((x) => x.includes(" ") ? obj.includes(x) : wordsOf(obj).some((w) => stem(w) === stem(x)));
    if (hit) return `"${m[0].trim()}" is shown as ${hit}`;
  }
  return null;
}

/** A proposal kept only if it is a short concrete noun phrase that is none of the above and names nothing the beat names. */
export function validateProps(props, namedEntities = [], sentence = "") {
  const names = (namedEntities || []).map((e) => String(e && e.name || e || "").toLowerCase()).filter(Boolean);
  // A beat that names a PLACE (a city, a state, a country) gets no generic BUILDING: the viewer reads it as that place (board 38889577784 ch-26: an apartment
  // block for "Alexandria, Virginia" -> beat check NO). A named court, company or agency still gets its model building (owner: "a court -> a photo of a court").
  const namesPlace = (namedEntities || []).some((e) => e && /^(place|location|city|country|region|state|county)$/i.test(String(e.type || e.kind || "")));
  const kept = [], dropped = [];
  for (const p of Array.isArray(props) ? props : []) {
    const object = String((p && (p.object || p.name)) || p || "").toLowerCase().replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();
    const why = !object ? "empty"
      : object.split(" ").length > 3 ? "more than 3 words"
      : PEOPLE.test(object) ? "a person"
      : NOT_PHOTO.test(object) ? "not a photographable object (text / mark / drawing)"
      : ABSTRACT.test(object) ? "an abstract idea"
      : namesPlace && p && (p.building || p.kind === "building" || p.kind === "place") ? "a generic building on a beat that names a place (it would read as that place)"
      : names.some((n) => n && (object.includes(n) || n.split(/\s+/).filter((w) => w.length > 3).some((w) => object.split(" ").includes(w)))) ? "names a specific entity of the beat"
      : null;
    const literal = why ? null : isLiteral(object, sentence);
    if (why || !literal) { dropped.push(`${object || "?"}: ${why || "not something the sentence says (a symbol or a loose association)"}`); continue; }
    if (kept.some((k) => k.object === object)) continue;
    kept.push({ object, building: !!(p && (p.building || p.kind === "building" || p.kind === "place")), why: literal });
    if (kept.length >= MAX_PROPS) break;
  }
  return { kept, dropped };
}

export function propsPrompt({ topic, beats }) {
  return `You choose the PHOTOS for a vertical news-explainer video. The style is the editorial "cut-out collage": every shot shows a real photograph of an
object or a place, cut out of its background (a money bag, a stack of cash, a courthouse, a house, an alarm clock, a gavel, a laptop, a shipping container).

For EACH beat below, propose ${MAX_PROPS} props for its sentence, best first. A prop is:
- a REAL, PHOTOGRAPHABLE physical object, or a generic building / place type ("courthouse", "house", "factory", "hospital", "oil tanker", "bank vault");
- LITERALLY what the sentence says, never a symbol or a metaphor. FIRST the thing the sentence is ABOUT — what was found, taken, paid, sold, built or
  used ("agents found gold bars in his house" -> "gold bars" first, "house" second); then the plain physical form of what it says ("pleaded guilty" ->
  "courthouse" or "gavel"; "$40 million" -> "dollar bills"; "diesel exports" -> "fuel pump" or "oil tanker"; "tenants" -> "apartment building");
- NEVER a symbol: no compass for goals, padlock for security, hourglass or clock for time, anchor for stability, ladder for progress, lightbulb for
  ideas, puzzle pieces, chess pieces, scales, a target, a trophy, a mailbox for "stories", a statue. If the sentence names nothing photographable, propose
  fewer props or none — a wrong picture is worse than no picture;
- "depicts": the exact words of the sentence this prop shows, copied from it;
- 1 to 3 words, a plain common noun phrase a stock-photo search would find ("stack of coins", "gavel", "suitcase");
- GENERIC: never a named or specific thing (not "Southwark Crown Court", not "Apple iPhone", not "the White House"), never a brand;
- NEVER a person or a body part, never a crowd; never text, a sign, a newspaper, a screen, a logo, an icon, a symbol, an arrow, a chart, a map, a flag,
  a drawing or an illustration; never an abstract idea ("success", "risk", "justice").
Use different props on different beats: the same object twice in one video is not allowed.
Mark "building": true for a building or a place (it stands on the ground), false for a loose object.

Topic: ${topic || "(none given)"}

Beats:
${beats.map((b) => `${b.index}. ${b.sentence}`).join("\n")}

Answer with ONE JSON object and nothing else:
{"beats": [{"index": 0, "props": [{"object": "gold bars", "depicts": "gold bars", "building": false}, {"object": "house", "depicts": "his house", "building": true}, ...]}, ...]}`;
}

/**
 * Ask Gemini (via `ask(prompt) -> parsed JSON | {error}`) for every beat's props. Returns Map(index -> { kept, dropped }) — an empty map when Gemini
 * did not answer (the caller logs it; nothing is invented in its place).
 */
export async function planProps({ topic, beats, ask }) {
  const out = new Map();
  if (!beats || !beats.length) return out;
  const r = await ask(propsPrompt({ topic, beats }));
  const list = r && Array.isArray(r.beats) ? r.beats : [];
  for (const b of beats) {
    const row = list.find((x) => Number(x && x.index) === Number(b.index));
    out.set(b.index, validateProps(row ? row.props : [], b.named_entities, b.sentence));   // an object already SHOWN on an earlier beat is skipped at fetch time
  }
  return out;
}
