/**
 * THE CUTOUT POLICY (owner's decision, 2026-10-10): a cutout is for a NAMED THING.
 *
 *   - Only an object the sentence actually names ("gavel", "solar panel"). Never a generic stock object standing in for a concept:
 *     a wallet for "businessman", a handshake for "deal".
 *   - Never a person or a role. A named person has a verified portrait (entity-assets.cjs); "businessman", "worker", "official" name nobody
 *     and a stock photograph of one reads as that person's face on a stranger.
 *   - A drawn symbol (visual/symbols/: an arrow, a warning triangle...) is never the visual of a beat that names an organisation, a person or a
 *     place: it would stand where that entity's mark, portrait or map belongs. Such a beat shows the entity's real visual, else its name in
 *     type, or a diagram of its figures.
 *
 * Pure: no files, no network. Callers pass what the beat says. It only REMOVES; it never adds a concept or substitutes one.
 *
 * Where this stops: "the sentence names it" is the word test of concept-visuals.js (every part of the object's own name is a word of the
 * sentence); a thing named in other words is missed, which is the safe direction — it falls to type.
 */
import { SYMBOLS } from "./concept-classes.js";

/** A role or a person-kind: names nobody, so no cutout stands for it. */
export const ROLE_WORDS = /\b(man|men|woman|women|person|people|businessman|businesswoman|businessmen|businesswomen|executive|executives|employee|employees|boss|manager|officer|official|officials|ceo|leader|leaders|worker|workers|scientist|scientists|doctor|doctors|judge|lawyer|lawyers|founder|president|minister|investor|investors|customer|customers|child|children|family|crowd|group)\b/i;

/** Entity types that have their own real visual (a mark, a portrait, a map, a photo) — a symbol must not stand where that belongs. */
export const SHOWABLE_ENTITY = /person|place|organization|company|institution|building|outlet|agency/i;

export const namesShowableEntity = (namedEntities) => (namedEntities || []).some((e) => e && SHOWABLE_ENTITY.test(String(e.type || "")));

/**
 * @param concepts   concept names already checked against the sentence (validateConcepts)
 * @param namedEntities the beat's named_entities
 * @returns { keep: string[], dropped: {name, why}[] }
 */
export function cutoutPolicy(concepts, namedEntities) {
  const keep = [], dropped = [];
  const entity = namesShowableEntity(namedEntities);
  for (const raw of concepts || []) {
    const name = String(raw || "").toLowerCase().trim();
    if (!name) continue;
    if (SYMBOLS.includes(name)) {
      if (entity) { dropped.push({ name, why: "a drawn symbol would stand where the named entity's own visual belongs" }); continue; }
    } else if (ROLE_WORDS.test(name.replace(/-/g, " "))) { dropped.push({ name, why: "a role or a kind of person is not an object the sentence names" }); continue; }
    keep.push(name);
  }
  return { keep, dropped };
}
