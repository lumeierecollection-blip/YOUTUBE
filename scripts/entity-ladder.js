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
import { entitiesOf, primaryOf, coverageOf, drawnOf, sameName } from "./entity-coverage.js";
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
  // The same holds for a PHOTO, and it is the reason a photo composition cannot
  // keep a plate beside it: no photo composition lays out a second object
  // (measured with canvasManifest — SCENE-LOW, PHOTO-BAND, DOCUMENT, ENTITY-ART
  // and ARCHITECTURE lay out no cutout box), so an entity added alongside one
  // would be dropped with nothing said. Board 38307081974 ch-2 beat 2: the
  // sentence is about the Code of Federal Regulations and the frame showed a
  // photo of the Capitol, read as "draws photo, none of it the entity".
  // A photo of the right subject stays; a photo of somewhere else yields to it.
  if (kinds.some((k) => k === "photo" || k === "portrait") && !(g.ents || []).some((e) => {
    const r = coverageOf(c, e);
    return r.covered && /^(photo|portrait|plate-)/.test(String(r.by || ""));
  })) return true;
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
  // EVERY figure the sentence names, whether or not this beat is already
  // drawing one: a beat must not trade its figure away for a plate it is also
  // missing (see the row note below). Keyed on the sentence, not on `missing`.
  const allFigures = (g.ents || []).filter((e) => e.type === "number");
  const out = [];

  // THE BEAT IS ONE ROW. A beat ping-pongs when successive passes fill
  // DIFFERENT slots: pass one draws the organisations as a plates row, which
  // takes the beat's single visual, so the figure is missing on pass two and
  // the figure replaces the row. Board 38299684512 ch-26 beat 4 named Deloitte,
  // Meritservus and 1,000: the ladder drew the two organisations, then swapped
  // them for the figure, and coverageOf was right on every pass and the beat
  // never converged.
  //
  // So ONE directive carries EVERYTHING the sentence names that the beat can
  // hold: the plate-ables AND the figures in a single row, each with its own
  // kind. One pass, one stable beat. A place WITH a region keeps its own map
  // and is directed alongside, because a map is a whole-frame visual and a row
  // is not.
  //
  // Each entry's kind is its own, from the entity's TYPE. A row that reported
  // every name as plate-organization made a PERSON in it unmatchable (board
  // 38265869072 ch-5 beat 2, two people read as two organisations); asking
  // directiveFor() per entry filled the array with "plates" itself (board
  // 38271924172 ch-1 beat 5); and a number falling through to the default was
  // recorded as plate-organization when coverageOf() matches a number against a
  // figure (board 38276419111 ch-26 beat 0). All three were the same mistake —
  // the kind has to describe the subject, not the device that drew it.
  // A beat whose OWN visual already answers the entity the sentence is about must
  // not have that visual replaced to make room for a second name. Board
  // 38313573278 ch-49 beat 5: the frame drew the verified portrait of Jessica
  // Chastain, the sentence also states "$27.5 million", and the ladder threw
  // the portrait away for a stat card — putting the person the sentence is
  // ABOUT back on nothing, which is the exact defect the ladder exists to
  // prevent. The portrait is the better answer and it stays; the figure is
  // stated in the headline the beat already draws.
  //
  // The test is whether the beat ALREADY DRAWS the entity it is about — not
  // whether its composition is one that fills the frame. A plate row and a
  // map can each take a second name and are built to (ch-9 beat 4 drew one
  // plate for four named places and now draws them all; ch-26 beat 6 drew a map
  // of Cyprus and now directs Deloitte and Abramovich beside it), so keying on
  // composition would have undone both. Keying on "does this frame already
  // show the subject" is the question the gate actually asks.
  // The subject is gapOf()'s primary when it is still uncovered, and otherwise
  // the first entity the frame DOES answer — gapOf() nulls `primary` once it is
  // covered, which is exactly the case this guard is for.
  //
  // But only when the beat draws ONE thing. A plate row, a map and a photo are
  // all "substance", and a row or a map can take a second name (ch-9 beat 4 drew
  // one plate for four named places and now draws them all; ch-26 beat 6 drew a
  // map of Cyprus and now directs Deloitte and Abramovich beside it). A PORTRAIT
  // or a PHOTO is the whole frame: there is nowhere to put a second thing, so
  // the beat keeps it and the other name stays in the headline.
  const SINGLE_OBJECT = new Set(["portrait", "photo"]);
  if (keeps) {
    const subject = g.primary || (g.ents || []).find((e) => coverageOf(c, e).covered);
    const shown = subject ? drawnOf(c).find((d) => sameName(d.name, subject.name)) : null;
    if (shown && SINGLE_OBJECT.has(String(shown.kind))) return [];
    // A composition that lays out no slot for a second object is the same
    // situation, whatever it draws.
    if (drawnOf(c).length === 1 && ["PORTRAIT", "PHOTO-CARD", "PHOTO-BAND", "SCENE-LOW", "SCENE-FULL", "ARCHITECTURE"].includes(String(c.composition || "").toUpperCase())) return [];
  }

  const kindOf = (e) => (e.type === "person" ? "plate-person" : e.type === "place" ? "plate-place" : e.type === "number" ? "figure" : e.type === "date" || e.type === "span" ? e.type : "plate-organization");
  // Deduped by name: a figure can be both NAMED and MISSING (it is named, and
  // the beat is not drawing it), and `missing` and `allFigures` then name it
  // twice — which put "50 percent, 50 percent" in one row. A row is a set of
  // subjects; the same subject is drawn once.
  //
  // And by FIGURE, not only by name: the sentence "Law360 is cited 360 times"
  // yields the number twice as "360" (the entity extractor) and "360 times"
  // (quantitiesOf), which put two entries on screen for one number: board
  // 38307081974 ch-2 beat 5. Two entries showing the same figure is the same
  // repetition the no-repeat rule exists to refuse.
  const figKey = (e) => (e.type === "number" ? String(quantitiesOf(e.name).find((q) => digitsOf(q.value).length > 0)?.value ?? e.name).replace(/[^\d.]/g, "") : null);
  const digitsOf = (s) => String(s == null ? "" : s).replace(/[^\d.]/g, "");
  const seenNames = new Set();
  const seenFigures = new Set();
  const row = [...rowable, ...allFigures].filter((e) => {
    const k = String(e.name).toLowerCase().trim();
    if (seenNames.has(k)) return false;
    seenNames.add(k);
    if (e.type === "number") {
      const f = figKey(e);
      if (!f || seenFigures.has(f)) return false;
      seenFigures.add(f);
    }
    return true;
  });
  if (row.length >= 2) {
    const names = row.map((e) => e.name).slice(0, 4);
    const kinds = names.map((_, i) => kindOf(row[i]));
    out.push({ art: { kind: "plates", name: names.join(", "), names, kinds }, replaces: !keeps, alongside: keeps });
    if (mapWorthy.length) out.push({ map: mapWorthy[0].name, region: mapWorthy[0].region, replaces: !keeps, alongside: keeps });
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
