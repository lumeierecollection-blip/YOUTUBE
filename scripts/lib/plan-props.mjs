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
// Board 39031532519 ch-1 (owner, 2026-10-17: "the random PNGs that really don't make sense"): one MONEY row let any of 40 money words admit 16 objects, so
// "The Washington Post reports debt payments grow eight times faster" got a calculator, a wallet and a pile of credit cards, and "reports" (a DOCUMENTS
// word) would have admitted a pen and a notebook. Every row is now narrow: a word maps only to the object that IS its physical form — paid / stole /
// $40 million -> cash; savings -> a piggy bank; credit -> a credit card; "budget", "debt", "reports", "online", "investigated" map to NOTHING (no object
// is the physical form of them, and a loose one is exactly what the owner calls random). Each proposal is also checked against the words it says it
// depicts (validateProps), not the whole sentence, so a prop cannot ride on an unrelated word elsewhere in the line.
const DEPICTS = [
  [/\$|£|€|\b(dollars?|cash|money|paid|pays?|payments?|paychecks?|funds?|millions?|billions?|bribe\w*|salar\w*|wages?|income|stole|stolen|steal\w*|embezzl\w*|launder\w*|ransom|refund\w*|fines?|fined|settlement|compensat\w*|profits?|revenue)\b/i,
    ["dollar", "bill", "banknote", "bank note", "cash", "money", "coin"]],
  [/\b(savings?|saved|piggy)\b/i, ["piggy bank", "coin", "jar of coins"]],
  [/\b(credit|cards?)\b/i, ["credit card"]],
  [/\b(banks?|banking|bankers?)\b/i, ["bank", "bank building", "vault"]],
  [/\b(vaults?|safes?|robb\w*|heist)\b/i, ["vault", "safe"]],
  [/\b(calculat\w*)\b/i, ["calculator"]],
  [/\b(wallets?|purses?)\b/i, ["wallet", "purse"]],
  [/\bgold\b/i, ["gold", "ingot"]],
  [/\b(courts?|courtroom|trials?|judges?|jury|juror\w*|sentenc\w*|plead\w*|plea|guilty|convict\w*|lawsuits?|sued|sues|suing|prosecut\w*|indict\w*|verdict|testif\w*|ruling|ruled|charged|acquit\w*)\b/i,
    ["courthouse", "court", "courtroom", "gavel", "witness stand", "jury box"]],
  [/\b(arrest\w*|police|sheriff\w*|jail\w*|prisons?|custody|detain\w*|inmates?|raid\w*|seiz\w*|fbi|suspects?|handcuff\w*)\b/i,
    ["police car", "patrol car", "handcuff", "prison", "jail", "prison cell", "jail cell", "police station", "police"]],
  [/\b(houses?|homes?|homeowners?|rent\w*|tenants?|landlords?|housing|apartments?|mortgages?|evict\w*|real estate)\b/i,
    ["house", "home", "apartment"]],
  [/\b(keys?|locked|unlocked)\b/i, ["keys", "key"]],
  [/\b(oil|fuel|diesel|gasoline|petrol|crude|petroleum|refiner\w*|pipelines?|gas prices?|gas station)\b/i,
    ["oil", "barrel", "fuel", "pump", "tanker", "refinery", "pipeline", "rig", "gas"]],
  [/\b(electric\w*|power grid|power plants?|solar|wind farms?|wind turbines?)\b/i, ["power line", "transformer", "power plant", "solar", "turbine", "pylon"]],
  [/\b(ships?|shipping|shipments?|exports?|imports?|tariffs?|cargo|ports?|freight|smuggl\w*)\b/i,
    ["cargo", "ship", "container", "crane", "freight", "crate", "pallet"]],
  // Things an office HAS, not what people DO there: board 39031532519 ch-44 put an antique desk next to "Deepak Malhotra published research" and a
  // laptop next to "Katie Shonk analyzed business skills" — activities. A company is shown as its building; an office as its furniture; a contract as paper.
  [/\b(compan\w*|firms?|corporat\w*|headquarters)\b/i, ["office building", "headquarters"]],
  [/\b(offices?|workplace)\b/i, ["office", "office building", "desk", "office chair", "filing cabinet"]],
  [/\b(contracts?|signed|signing|agreements?|deals?)\b/i, ["contract", "document", "fountain pen", "pen"]],
  [/\b(schools?|universit\w*|colleges?|students?|classrooms?|professors?|campus|graduat\w*|tuition)\b/i,
    ["university", "school", "graduation cap", "academic cap", "mortarboard", "classroom", "school building"]],
  [/\b(textbooks?|books?|novels?|authors?)\b/i, ["book", "textbook", "novel"]],
  [/\b(lab|labs|laborator\w*|experiments?|dna|forensic\w*|remains|bones?|autops\w*|scientists?)\b/i,
    ["microscope", "test tube", "lab", "petri", "beaker", "flask"]],
  [/\b(hospitals?|medical|medicines?|doctors?|patients?|drugs?|vaccin\w*|clinic\w*|nurses?|pharma\w*|prescri\w*|pills?|surger\w*)\b/i,
    ["hospital", "stethoscope", "pill", "syringe", "ambulance", "medicine", "clinic"]],
  [/\b(phones?|texted|smartphones?|phone calls?|cellphones?)\b/i, ["phone", "telephone", "smartphone"]],
  [/\b(emails?|letters?|mailed|mail|envelopes?|documents?|paperwork|forms?|filed|filing|subpoena\w*|warrants?)\b/i,
    ["document", "paperwork", "envelope", "letter", "folder"]],
  [/\b(cars?|vehicles?|crash\w*|traffic|highways?|trucks?|drivers?)\b/i, ["car", "truck"]],
  [/\b(planes?|flights?|airlines?|airports?|flew|pilots?|travel\w*|passports?|luggage|suitcases?)\b/i, ["airplane", "plane", "jet", "suitcase", "luggage", "passport"]],
  [/\b(films?|movies?|hollywood|cinemas?|studios?|filmmak\w*|filming|filmed|box office|theaters?|theatres?|premiere\w*)\b/i,
    ["film camera", "movie camera", "camera", "clapperboard", "film reel", "cinema", "movie theater", "theater"]],
  [/\b(podcasts?|radio|broadcast\w*|comedians?|comedy|stand-up|singers?|concerts?)\b/i, ["microphone"]],
  [/\b(music|songs?|albums?|guitar\w*|vinyl)\b/i, ["microphone", "guitar", "vinyl", "record player"]],
  [/\b(elect\w*|votes?|voters?|voting|ballots?|polls?)\b/i, ["ballot", "ballot box", "voting booth"]],
  [/\b(congress\w*|senat\w*|capitol|parliament\w*|legislat\w*|lawmakers?)\b/i, ["capitol", "government building", "parliament"]],
  [/\b(computers?|laptops?|software|hack\w*|cyber\w*|servers?|data cent\w*)\b/i, ["laptop", "computer", "server", "keyboard"]],
  [/\b(chips?|semiconductor\w*|microchips?|processors?)\b/i, ["microchip", "chip", "circuit board"]],
  [/\b(robots?|robotic\w*)\b/i, ["robot"]],
  [/\b(food|groceries|grocery|farms?|farmers?|crops?|harvest\w*|meals?|restaurants?)\b/i, ["grocery", "shopping cart", "food", "vegetable", "fruit", "tractor", "wheat"]],
  [/\b(shops?|shopping|stores?|retail\w*|shoppers?|supermarkets?|malls?)\b/i, ["shopping cart", "shopping bag", "store"]],
  [/\b(packages?|parcels?|deliver\w*|shipped)\b/i, ["package", "parcel", "cardboard box"]],
  [/\b(receipts?)\b/i, ["receipt"]],
  [/\b(military|war|troops?|army|missiles?|drones?|weapons?|tanks?|bombs?|airstrikes?)\b/i, ["tank", "drone", "missile", "military truck", "helmet"]],
  [/\b(guns?|firearms?|rifles?|shooting|pistols?)\b/i, ["handgun", "rifle", "bullet", "shell casing"]],
  [/\b(fires?|burn|burned|burning|burnt|blaze|flames?|wildfires?|arson)\b/i, ["fire truck", "fire hydrant", "fire extinguisher"]],
  // digging is done WITH a shovel / an excavator: the literal tool of the act (test run 39037009215 ch-6: "dug up the backyard", "excavated", "unearthed"
  // left 7 of 8 beats without a picture). Luminol / blood / fingerprints are forensic work: the kit it uses.
  [/\b(dig|digs|digging|dug|excavat\w*|unearth\w*|backyard)\b/i, ["shovel", "spade", "excavator", "wheelbarrow", "heavy machinery"]],
  [/\b(luminol|blood\w*|fingerprints?|evidence)\b/i, ["evidence bag", "test tube", "spray bottle", "fingerprint kit"]],
  [/\b(murder\w*|homicide|killed|killing|victims?|crime scenes?)\b/i, ["evidence bag", "police car"]],
  [/\b(graves?|buried|burial|cemeter\w*|coffins?|funeral\w*)\b/i, ["gravestone", "headstone", "coffin", "shovel"]],
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

/**
 * Are the words a proposal says it depicts really words of the sentence? Gemini is asked to copy them; a paraphrase keeps most content words. Returns the
 * depicts phrase when at least two thirds of its content words (3+ letters) are the sentence's, else null.
 */
export function depictsOf(depicts, sentence) {
  const sw = new Set(wordsOf(sentence).map(stem));
  const dw = wordsOf(depicts).filter((w) => w.length >= 3 || /^\$|\d/.test(w)).map(stem);
  if (!dw.length) return null;
  return dw.filter((w) => sw.has(w)).length * 3 >= dw.length * 2 ? String(depicts) : null;
}

/**
 * A proposal kept only if it is a short concrete noun phrase that is none of the above and names nothing the beat names.
 * strict (planProps): the proposal must say which words of the sentence it depicts, and it is judged against THOSE words, not the whole line — a
 * calculator citing "debt payments" is refused (payments are shown as cash), where against the whole sentence any money word anywhere once admitted it.
 */
export function validateProps(props, namedEntities = [], sentence = "", { strict = false } = {}) {
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
    const cited = p && typeof p === "object" && p.depicts ? depictsOf(p.depicts, sentence) : null;
    const why2 = why || (strict && !(p && p.depicts) ? "no \"depicts\" (which words of the sentence it shows)"
      : strict && !cited ? `"depicts" ("${String(p.depicts).slice(0, 60)}") is not words of the sentence` : null);
    const literal = why2 ? null : isLiteral(object, strict ? cited : sentence);
    if (why2 || !literal) { dropped.push(`${object || "?"}: ${why2 || (strict ? `not what "${cited}" shows (a symbol or a loose association)` : "not something the sentence says (a symbol or a loose association)")}`); continue; }
    if (kept.some((k) => k.object === object)) continue;
    kept.push({ object, building: !!(p && (p.building || p.kind === "building" || p.kind === "place")), why: literal });
    if (kept.length >= MAX_PROPS) break;
  }
  return { kept, dropped };
}

export function propsPrompt({ topic, beats }) {
  return `You choose the PHOTOS for a vertical news-explainer video. The style is the editorial "cut-out collage": a shot shows a real photograph of an
object or a place, cut out of its background (a stack of cash, a courthouse, a house, a gavel, a shipping container, a police car).

For EACH beat below, propose AT MOST 3 props for its sentence, best first. ZERO is a correct answer and is often the right one.

THE TEST every prop must pass: a viewer hears ONLY this sentence while the photo is on screen. Would they instantly say "yes — that is the thing
being talked about"? If they would have to think about why it is there, it fails. Being on the same TOPIC is not enough.
  FAILS (real rejections from our videos): a calculator, a wallet or a credit card for "debt payments grow eight times faster than pay"; a microphone
  for a columnist; headphones, a radio or an armchair for a podcast; a newspaper for "The Washington Post reports"; a laptop for "analyzed business
  skills"; a desk for "published research"; a dining table or a backpack for "a family tackling student debt"; a magnifying glass for an investigation.
  PASSES: "gold bars" for "agents found gold bars in his house"; "stack of cash" for "he was paid $40,000"; "gavel" for "she pleaded guilty";
  "courthouse" for "the case went to federal court"; "shovel" for "they dug up the backyard"; "oil tanker" for "diesel exports doubled".

A prop is:
- the thing the sentence NAMES or the thing it is ABOUT — what was found, taken, paid, sold, built, seized or used — or the one plain physical form of
  what it says ("pleaded guilty" -> "gavel"; "$40 million" -> "dollar bills"; "tenants" -> "apartment building"); never a tool, accessory or setting
  that merely goes with the topic;
- NEVER a symbol or metaphor: no compass, padlock, hourglass, clock, anchor, ladder, lightbulb, puzzle, chess piece, scales, target, trophy,
  magnifying glass, statue, mailbox. Debt, a budget, a report, a strategy, research, growth or a comparison have NO physical form: give those beats
  no prop unless the sentence also names a real object;
- "depicts": the exact words of the sentence this prop shows, copied from it (2-6 words). It is checked: a prop is judged against these words only;
- 1 to 3 words, a plain common noun phrase a stock-photo search would find ("stack of coins", "gavel", "suitcase"); one object, not a scene;
- GENERIC: never a named or specific thing (not "Southwark Crown Court", not "Apple iPhone", not "the White House"), never a brand;
- NEVER a person or a body part, never a crowd; never text, a sign, a newspaper, a screen, a logo, an icon, a symbol, an arrow, a chart, a map, a flag,
  a drawing or an illustration; never an abstract idea ("success", "risk", "justice").
Use different props on different beats: the same object twice in one video is not allowed.
Mark "building": true for a building or a place (it stands on the ground), false for a loose object.

Topic: ${topic || "(none given)"}

Beats:
${beats.map((b) => `${b.index}. ${b.sentence}`).join("\n")}

Answer with ONE JSON object and nothing else:
{"beats": [{"index": 0, "props": [{"object": "gold bars", "depicts": "found gold bars", "building": false}, {"object": "house", "depicts": "in his house", "building": true}]}, {"index": 1, "props": []}, ...]}`;
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
    out.set(b.index, validateProps(row ? row.props : [], b.named_entities, b.sentence, { strict: true }));   // an object already SHOWN on an earlier beat is skipped at fetch time
  }
  return out;
}
