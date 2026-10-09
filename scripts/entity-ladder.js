/**
 * entity-ladder — when a beat names an entity and draws none of it, the visual that answers it
 * (owner, 2026-10-09: "nothing spoken goes unrepresented"). Code enforces legality here; it does not pick a look
 * where Gemini already did (a beat that draws its entity is left alone) — it only fills the gap the gate would fail.
 *
 *   place with a region    a map with THAT region highlighted (a flag is offered beside it as the FLAG shot)
 *   place without one      a plate with a pin
 *   person                 a plate with a non-identifying silhouette (the portrait search already failed)
 *   organisation           a plate with a building (the logo search already failed)
 *   date                   a calendar page showing it
 *   span of time           a track filled across the beat, its ends labelled when the sentence states them
 *   number                 a stat card of the stated figure (only through checkVisual: the sentence must state it)
 *
 * Only a beat that draws NOTHING of substance is filled (words only, a name card, or a drawn symbol alone): a beat that
 * already shows a photo, a chart or an object keeps it and is reported by the gate instead.
 */
import { entitiesOf, primaryOf, coverageOf, drawnOf } from "./entity-coverage.js";
import { quantitiesOf } from "./canvas-grounding.js";
import { flagCodeOf } from "../src/skills/remotion-render/visual/flags.js";

const SUBSTANCE = new Set(["portrait", "photo", "logo", "cutout", "map", "flag", "chart", "figure", "span", "plate-person", "plate-organization", "plate-place"]);
/** Does the beat draw something of substance (anything but words, a name card or a drawn symbol)? */
export const hasSubstance = (c) => drawnOf(c).some((d) => SUBSTANCE.has(d.kind));

/**
 * Visuals that carry no data of their own and so yield to the entity the sentence names (the board 37967524047 left these failing the
 * gate): a cutout that is only decoration, a direction-only TREND (no figures), a LIST whose items are just the names, a stat card whose
 * only figure is the span of time the sentence states (a time scale draws it, with the figure as its label).
 * A chart with real figures, a photo, a map or a portrait is NOT yielded: it is shown and the gate reports the gap.
 */
export function yieldsTo(b, g) {
  const c = b.canvas || {}, drawn = drawnOf(c);
  const kinds = drawn.map((d) => d.kind);
  if (!kinds.length) return true;
  if (kinds.every((k) => k === "cutout" || k === "symbol" || k === "visual")) return true;
  const vt = String(c.visual_type || b.visual_type || "").toUpperCase();
  if (vt === "TREND" || (vt === "LIST" && c.composition === "LIST-BUILD")) return true;
  // A process diagram of named steps shows none of the entity it names; the entity comes first ("process / relation -> diagram only if stated").
  if (c.composition === "PROCESS-FULL") return true;
  // A bare stat card yields to a person / organisation / place the sentence names: that is what the sentence is about (RANK in entity-coverage.js).
  if (kinds.every((k) => k === "figure") && ["person", "organization", "place"].includes(g.primary?.type)) return true;
  // a bare stat card whose only figure is the number of a span the sentence states ("30" of "30 years") carries nothing of whatever
  // else is named (board 37973067720: France / "30 years"; "The Fund Guide" / "90-day").
  const spans = (g.ents || []).filter((e) => e.type === "span");
  const fig = String(c.data?.value ?? "").replace(/[^\d.]/g, "");
  const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  const numOf = (name) => { const w = String(name).toLowerCase().split(/[-\s]+/)[0]; return String(WORDNUM[w] ?? String(name).replace(/[^\d.]/g, "")); };
  if (kinds.every((k) => k === "figure") && spans.length && fig && spans.some((s) => numOf(s.name).startsWith(fig))) return true;
  // a spelled span ("ninety-day") whose stat card shows no figure of its own
  if (kinds.every((k) => k === "figure") && spans.length && !fig) return true;
  return false;
}

/** { ents, uncovered, primary } for a plan beat ({ narration, named_entities, canvas }). */
export function gapOf(b) {
  const c = b.canvas || {};
  const ents = entitiesOf({ sentence: b.narration || c.sentence || "", named_entities: b.named_entities || c.named_entities || [] });
  if (!ents.length) return { ents, uncovered: [], primary: null, covered: true };
  const covered = ents.some((e) => coverageOf(c, e).covered);
  const uncovered = covered ? [] : ents;
  return { ents, uncovered, primary: covered ? null : primaryOf(ents, c.photo?.entity || c.data?.entity || null), covered };
}

/** The directive for one beat, or null: { map } | { figure } | { art } (applied by render-and-qa.js entityLadder). */
export function ladderFor(b) {
  const g = gapOf(b);
  if (g.covered || !g.primary) return null;
  const replaces = hasSubstance(b.canvas);
  if (replaces && !yieldsTo(b, g)) return null;
  const e = g.primary;
  const sentence = b.narration || b.canvas?.sentence || "";
  switch (e.type) {
    case "place":
      return e.region ? { map: e.name, region: e.region, flag: flagCodeOf(e.region), replaces } : { art: { kind: "plate-place", name: e.name }, replaces };
    case "person": return { art: { kind: "plate-person", name: e.name }, replaces };
    case "organization": {
      // Several organisations named together: a row of labelled plates (up to four), not one of them standing for the rest.
      const orgs = g.ents.filter((x) => x.type === "organization").map((x) => x.name).slice(0, 4);
      return orgs.length >= 2 ? { art: { kind: "plates", name: orgs.join(", "), names: orgs }, replaces } : { art: { kind: "plate-organization", name: e.name }, replaces };
    }
    case "date": return { art: { kind: "date", name: e.name, text: e.name }, replaces };
    case "span": return { art: { kind: "span", name: e.name, text: e.name, ends: e.ends || null }, replaces };
    case "number": {
      const q = quantitiesOf(sentence).find((x) => x.value.trim() === e.name);
      return q ? { figure: { value: q.value.trim(), label: q.label || null } } : null;
    }
    default: return null;
  }
}
