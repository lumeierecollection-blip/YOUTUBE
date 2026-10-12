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
  // A map of somewhere the sentence does not name is wrong, not just unhelpful: it yields (board 38012563025 ch-49).
  if (kinds.includes("map") && !(g.ents || []).some((e) => { const r = coverageOf(c, e); return r.covered && /^map/.test(String(r.by || "")); })) return true;
  const vt = String(c.visual_type || b.visual_type || "").toUpperCase();
  if (vt === "TREND" || (vt === "LIST" && c.composition === "LIST-BUILD")) return true;
  // A process diagram of named steps shows none of the entity it names; the entity comes first ("process / relation -> diagram only if stated").
  if (c.composition === "PROCESS-FULL") return true;
  // A bare stat card yields to a person / organisation / place the sentence names: that is what the sentence is about (RANK in entity-coverage.js).
  if (kinds.every((k) => k === "figure") && ["person", "organization", "place", "date"].includes(g.primary?.type)) return true;
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
  const primary = primaryOf(ents, c.photo?.entity || c.data?.entity || null);
  const covered = primary ? coverageOf(c, primary).covered || ents.some((e) => { const r = coverageOf(c, e); return r.covered && /^(map|flag|photo|portrait|logo|cutout|plate-)/.test(String(r.by || "")); }) : ents.some((e) => coverageOf(c, e).covered);
  return { ents, uncovered: covered ? [] : ents, primary: covered ? null : primary, covered };
}

/** The directive for one beat, or null: { map } | { figure } | { art } (applied by render-and-qa.js entityLadder). */
export function ladderFor(b) {
  const g = gapOf(b);
  if (g.covered || !g.primary) return null;
  const replaces = hasSubstance(b.canvas);
  if (replaces && !yieldsTo(b, g)) return null;
  return directiveFor(g.primary, g, b, replaces);
}

/**
 * One entity's directive. Split out of ladderFor so the second end of a
 * two-thing sentence goes through exactly the same ladder rung as the first —
 * the rungs, the qualifiers and the never-blank rule do not differ by
 * position.
 */
function directiveFor(e, g, b, replaces) {
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

/**
 * Every directive this beat needs — one rung that covers ALL uncovered
 * entities, not just the primary.
 *
 * THE TWO-VISUAL RULE. A sentence that names two things has to show both: "X
 * moved from A to B" shows A, B and the move; a comparison shows both sides; a
 * cause shows both ends. ladderFor answered only `gapOf().primary`, so the
 * second thing the voice said had nothing on screen, and the coverage check
 * that should have caught it passes when the primary is answered.
 *
 * Measured on board 38226641642's four renders (29 beats): 9 beats named two or
 * more entities and 1 of them showed two or more. ch-9 beat 4 names Ethiopia,
 * Eritrea, Tigray and the United Nations Security Council and draws one plate.
 * ch-26 beat 6 names Deloitte, Roman Abramovich and Cyprus and draws a map of
 * Cyprus alone. ch-1 beat 3 names Investopedia, You Need a Budget and 3.7 and
 * draws a bar chart.
 *
 * How both ends get on screen, in the order of what each entity deserves:
 *
 *   - Several entities, all of them PLATE-able (a person, an organisation, a
 *     place with no region, a date, a span): ONE `plates` art naming all of
 *     them, drawn by the layout as a row of labelled plates. That rung already
 *     existed and already rendered — it was restricted to two or more
 *     ORGANISATIONS, which is why a place + a person + an organisation got one
 *     plate between the three. Widening the rung is the whole fix, and it uses
 *     a rendering path the frames have already proven.
 *   - One of them is a place WITH a region, so it deserves a map rather than a
 *     plate: the map stays the beat's primary visual and the rest ride beside
 *     it as `extra`, drawn as a second object in the same composition.
 *
 * Never blank, and never a generic icon standing in for a named thing: each
 * name goes through the same rung, qualification and real-mark lookup as the
 * primary did.
 */
export function ladderAll(b) {
  const c = b.canvas || {};
  const g = gapOf(b);
  if (!g.primary && !g.ents.length) return [];

  // EVERY entity the sentence names that the frame does not answer — not just
  // the primary. gapOf() reports `covered` when the PRIMARY is answered, which
  // is what the gate asks ("is this beat about its subject shown?"), but it is
  // not the mission's question ("did everything the voice said get a visual?").
  // ch-9 beat 4 answered the UN Security Council and left Ethiopia, Eritrea and
  // Tigray — three places the sentence named — on nothing.
  const missing = [];
  for (const e of g.ents) {
    if (coverageOf(c, e).covered) continue;
    missing.push(e);
  }
  if (!missing.length) return [];

  // A beat that already draws substance keeps it: the missing entities are
  // ADDED beside what is there (the two-visual case) instead of replacing it.
  // A beat that is words-only has nothing to keep, so the first rung replaces.
  const keeps = hasSubstance(c) && !yieldsTo(b, g);

  // A place with a region deserves a map; everything else is plate-able and
  // shares one `plates` row. A NUMBER joins the row too: a sentence that
  // states two figures ("$672 million ... 1,000 papers") has to show both,
  // and ch-26 beat 0 failed entity-coverage for exactly that — the frame drew
  // one figure and the other number was on nothing. A row entry that is a
  // figure is drawn as the figure (full-canvas.jsx MarkPlate reads its text),
  // so it is honest: the number is shown, not labelled with an icon.
  const mapWorthy = missing.filter((e) => e.type === "place" && e.region);
  const rowable = missing.filter((e) => !(e.type === "place" && e.region));
  const out = [];

  if (rowable.length >= 2) {
    const names = rowable.map((e) => e.name).slice(0, 4);
    // Each entry carries its OWN kind. A row that reported every name as
    // plate-organization made a PERSON in it unmatchable: board 38265869072
    // ch-5 beat 2 named "Amit Hadad" and "Yehudit Tirosh", the ladder drew them
    // as a plates row, and entity-coverage read "draws plate-organization +
    // plate-organization, none of it the entity" — two people drawn as two
    // organisations. The kind is what says what a plate is depicting.
    //
    // The kind comes from the entity's TYPE, not from directiveFor(). For two
    // or more organisations directiveFor() returns a `plates` ROW, so asking
    // it per entry filled the array with "plates" and drawnOf() reported
    // "plates + plates" — a row kind where a plate kind is expected, which
    // coverageOf() matches against nothing (board 38271924172 ch-1 beat 5,
    // "Quartz" and "CNBC Select" drawn and read as uncovered).
    // A FIGURE is its own kind, not a plate. Board 38276419111 ch-26 beat 0: the
    // sentence names $672 million and 1,000, both went into the row, and a
    // number that fell through to the default was recorded as
    // plate-organization — coverageOf() matches a number against a figure or a
    // chart, never a plate, so two numbers on screen read as two
    // organisations and "none of it the entity".
    const kindOf = (e) => (e.type === "person" ? "plate-person" : e.type === "place" ? "plate-place" : e.type === "number" ? "figure" : e.type === "date" || e.type === "span" ? e.type : "plate-organization");
    const kinds = rowable.map(kindOf);
    const d = { art: { kind: "plates", name: names.join(", "), names, kinds }, replaces: !keeps, alongside: keeps };
    out.push(d);
    if (mapWorthy.length) out.push({ map: mapWorthy[0].name, region: mapWorthy[0].region, replaces: !keeps, alongside: keeps });
    return out;
  }
  // A number is the ONE case where "one figure per beat" cannot satisfy the
  // sentence. A beat whose sentence names TWO figures — "$672 million ...
  // 1,000 papers", "a 50 percent discount ... rising to $6.99" — cannot show
  // both by replacing: whichever figure the ladder picks, the other is missing
  // on the next pass and gets picked back. Board 38294611241 ch-1 beat 6 and
  // ch-26 beat 0 both oscillated between the two numbers across passes and
  // never satisfied coverageOf.
  //
  // Two or more figures go in ONE ROW of concept visuals, not as an `art`:
// canvas-layout lays out cutout0/cutout1 for concept_visuals on the NUMBER and
// TYPE compositions, while an `art` plate row gets no box at all there (checked
// with canvasManifest: NUMBER-FULL + art{plates} lays out no art box, NUMBER-FULL
// + two concept_visuals lays out cutout0 AND cutout1). MarkPlate draws a figure
// entry as the figure, so the number on screen is the number.
  // Keyed on the FIGURES THE SENTENCE NAMES, not on the ones currently missing.
// Whichever single figure the beat happens to be drawing, the other is missing
// — so "missing" is one at a time and the beat ping-pongs between them across
  // passes (board 38294611241 ch-1 beat 6 and ch-26 beat 0 both oscillated and
  // never satisfied coverageOf). A sentence that states two numbers gets both
  // on the beat, once.
  const figures = (g.ents || []).filter((e) => e.type === "number");
  if (figures.length >= 2 && missing.some((e) => e.type === "number")) {
    const names = figures.map((e) => e.name).slice(0, 4);
    out.push({ figures: names, replaces: true, alongside: false });
    return out;
  }

  if (rowable.length === 1) {
    // A lone FIGURE cannot ride beside another figure: NUMBER-FULL lays out one
    // stat card and no cutout slot, so "alongside" would drop it (the gate
    // board 38256573651 ch-26 beat 0 failed entity-coverage for exactly this —
    // the sentence names $672 million AND 1,000, the frame showed one). A
    // number with nothing else uncovered therefore takes the stat card itself,
    // REPLACING the figure already drawn: the sentence gets both across the
    // beat, the other number already has its own beat.
    const only = rowable[0];
    if (only.type === "number") {
      const d = directiveFor(only, { ...g, ents: missing, primary: only }, b, true);
      if (d) { d.replaces = true; d.alongside = false; out.push(d); }
    } else {
      const d = directiveFor(only, { ...g, ents: missing, primary: only }, b, !keeps);
      if (d) { d.alongside = keeps; out.push(d); }
    }
  }
  for (const e of mapWorthy) {
    const d = directiveFor(e, { ...g, ents: missing, primary: e }, b, !keeps);
    if (d) { d.alongside = keeps && out.length > 0; out.push(d); }
  }
  // Only a lone number with nothing else uncovered: the stat card. It REPLACES —
  // a beat that already draws one figure cannot hold a second stat card, and
  // the whole point is that the number the sentence named is the one on screen.
  // directiveFor does not attach `replaces` to a figure (a figure sets
  // visual_type/data rather than art), so it is set here.
  if (!out.length) {
    for (const e of missing.filter((x) => x.type === "number")) {
      const d = directiveFor(e, { ...g, ents: missing, primary: e }, b, !keeps);
      if (d) { d.replaces = !keeps; d.alongside = false; out.push(d); }
    }
  }
  return out;
}
