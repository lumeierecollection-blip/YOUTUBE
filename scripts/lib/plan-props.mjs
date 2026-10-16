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
 * Where this stops: a prop ILLUSTRATES a sentence, it is not evidence for it, and the owner accepted that (2026-10-16). It never stands for a specific
 * named thing: "a courthouse" is drawn, never "Southwark Crown Court" — that one is shown only from its own verified photo.
 */

export const MAX_PROPS = 4;

// Never a prop: people (a stranger reads as the story's named person), words on things, marks, drawings and abstractions.
const PEOPLE = /\b(man|men|woman|women|person|people|boy|girl|child|children|kid|kids|baby|worker|workers|officer|officers|police|judge|lawyer|doctor|nurse|teacher|student|students|ceo|businessman|businesswoman|crowd|family|couple|actor|actress|politician|president|soldier|player|fan|fans|face|hand|hands|silhouette|figure|portrait|selfie|human|humans)\b/i;
const NOT_PHOTO = /\b(icon|icons|logo|logos|symbol|symbols|emoji|illustration|drawing|cartoon|vector|clipart|clip-art|graphic|graphics|chart|graph|diagram|infographic|sign|signs|signage|banner|poster|text|word|words|letter|letters|headline|newspaper|screen|screenshot|website|app|map|flag|arrow|arrows|silhouette)\b/i;
const ABSTRACT = /\b(idea|ideas|concept|success|failure|growth|economy|policy|risk|future|change|freedom|justice|truth|power|love|fear|hope|time|money\s+concept|strategy|problem|solution|crisis|trend|market|markets|inflation|value|values|culture|history|news|story|life|death|anxiety|stress)\b/i;

/** A proposal kept only if it is a short concrete noun phrase that is none of the above and names nothing the beat names. */
export function validateProps(props, namedEntities = []) {
  const names = (namedEntities || []).map((e) => String(e && e.name || e || "").toLowerCase()).filter(Boolean);
  const kept = [], dropped = [];
  for (const p of Array.isArray(props) ? props : []) {
    const object = String((p && (p.object || p.name)) || p || "").toLowerCase().replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();
    const why = !object ? "empty"
      : object.split(" ").length > 3 ? "more than 3 words"
      : PEOPLE.test(object) ? "a person"
      : NOT_PHOTO.test(object) ? "not a photographable object (text / mark / drawing)"
      : ABSTRACT.test(object) ? "an abstract idea"
      : names.some((n) => n && (object.includes(n) || n.split(/\s+/).filter((w) => w.length > 3).some((w) => object.split(" ").includes(w)))) ? "names a specific entity of the beat"
      : null;
    if (why) { dropped.push(`${object || "?"}: ${why}`); continue; }
    if (kept.some((k) => k.object === object)) continue;
    kept.push({ object, building: !!(p && (p.building || p.kind === "building" || p.kind === "place")) });
    if (kept.length >= MAX_PROPS) break;
  }
  return { kept, dropped };
}

export function propsPrompt({ topic, beats }) {
  return `You choose the PHOTOS for a vertical news-explainer video. The style is the editorial "cut-out collage": every shot shows a real photograph of an
object or a place, cut out of its background (a money bag, a stack of cash, a courthouse, a house, an alarm clock, a gavel, a laptop, a shipping container).

For EACH beat below, propose ${MAX_PROPS} props for its sentence, best first. A prop is:
- a REAL, PHOTOGRAPHABLE physical object, or a generic building / place type ("courthouse", "house", "factory", "hospital", "oil tanker", "bank vault");
- what the sentence itself mentions first (it says "court" -> "courthouse"; it says "house" -> "house"; it says "$500" -> "dollar bills");
  then the concrete subject matter of the sentence (savings -> "piggy bank"; a trial -> "gavel"; shipping -> "cargo ship");
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
{"beats": [{"index": 0, "props": [{"object": "courthouse", "building": true}, {"object": "gavel", "building": false}, ...]}, ...]}`;
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
    out.set(b.index, validateProps(row ? row.props : [], b.named_entities));   // an object already SHOWN on an earlier beat is skipped at fetch time
  }
  return out;
}
