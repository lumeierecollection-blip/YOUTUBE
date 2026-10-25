/**
 * The no-repeat rule (typography rebuild, Task 6): the planner must not pick
 * the same composition twice in a row. Run at plan time on the planned beats
 * (gemini-visual-plan.js) and again at resolve time on the resolved canvases
 * (render-and-qa.js), because a resolved image can change a beat's
 * composition (a PHOTO whose real picture shows a building is ARCHITECTURE).
 *
 * enforceRotation() is the algorithm; it knows nothing about beats. The caller
 * supplies the accessors:
 *   compositionOf(i)    the composition beat i draws now
 *   candidates(i)       the alternatives beat i could be, in preference order
 *   accept(i, alt)      true when the alternative passes the caller's gates
 *   apply(i, alt)       make it so
 *
 * For each repeat (beat i drawn like beat i-1) it tries, in order:
 *   1. an alternative for beat i that differs from both neighbours,
 *   2. one for beat i-1 that differs from both of ITS neighbours,
 *   3. one for beat i that differs only from beat i-1 (the next repeat, if it
 *      creates one, is handled in turn),
 * and leaves the repeat — logged, never hidden — when nothing else is grounded.
 * The hook (beat 0) is never changed to fix a repeat.
 *
 * candidatesFor() builds the alternatives from the sentence alone
 * (canvas-grounding.js): a timeline, a comparison, a list, a cause -> effect
 * process, a map, a stated percentage, a hero figure, and finally the text
 * compositions (TYPE-SPLIT, then TYPE-FULL). Every one is a slice of the
 * sentence, so rotating never invents anything.
 */
import { compositionFor, splitHeadline } from "../src/skills/remotion-render/visual/canvas-layout.js";
import { timelineOf, compareOf, listItemsOf, flowNodes, knownPlacesOf, statedPercentsOf, quantitiesOf } from "./canvas-grounding.js";

export function enforceRotation(n, o) {
  const log = o.log || (() => {});
  const changes = [];
  const comp = (i) => (i >= 0 && i < n ? o.compositionOf(i) : null);
  const attempt = (k, strict) => {
    if (k < 1) return null;                                     // the hook stays
    if (o.locked?.(k)) return null;                             // the planner chose this beat's type
    for (const alt of o.candidates(k) || []) {
      const cur = comp(k);
      if (alt.composition === cur) continue;
      if (alt.composition === comp(k - 1)) continue;
      if (strict && alt.composition === comp(k + 1)) continue;
      if (!o.accept(k, alt)) continue;
      return alt;
    }
    return null;
  };
  for (let i = 1; i < n; i++) {
    if (comp(i) !== comp(i - 1)) continue;
    const from = comp(i);
    let k = i, alt = attempt(i, true);
    if (!alt) { k = i - 1; alt = attempt(i - 1, true); }
    if (!alt) { k = i; alt = attempt(i, false); }
    if (!alt) {
      if (o.locked?.(i) && (i - 1 < 1 || o.locked?.(i - 1))) log(`[plan] beat ${i} repeats beat ${i - 1} type (${from}) — kept: the planner chose it`);
      else log(`[plan] beat ${i} could not avoid repeating beat ${i - 1} type (${from}): nothing else in its sentence is grounded`);
      changes.push({ beat: i, from, to: from, resolved: false });
      continue;
    }
    const was = comp(k);
    o.apply(k, alt);
    log(`[plan] beat ${i} avoided repeating beat ${i - 1} type (${from}${k !== i ? `; beat ${k}` : ""} ${was} -> ${alt.composition})`);
    changes.push({ beat: k, from: was, to: alt.composition, resolved: true });
  }
  const repeats = [];
  for (let i = 1; i < n; i++) if (comp(i) === comp(i - 1)) repeats.push(i);
  return { changes, repeats };
}

const yearOf = (d) => Number((String(d).match(/(?:19|20)\d{2}/) || [0])[0]);

/**
 * The alternatives one sentence grounds, best first. `headline` decides
 * whether TYPE-SPLIT is possible (it needs two words to split). Each is
 * { visual_type, data, extra, composition }.
 */
export function candidatesFor({ sentence, headline = "" }) {
  const out = [];
  const add = (visual_type, data, extra = {}) => out.push({ visual_type, data, extra, composition: compositionFor(visual_type, false, extra) });
  const tl = timelineOf(sentence);
  if (tl) add("TIMELINE", { markers: [...tl].sort((a, b) => yearOf(a.date) - yearOf(b.date)) });
  const cmp = compareOf(sentence);
  if (cmp) add("COMPARE", { a: cmp.a, b: cmp.b, relation: cmp.relation, subject: cmp.subject });
  const li = listItemsOf(sentence);
  if (li) add("LIST", { items: li.items, lead: li.lead });
  const fl = flowNodes(sentence);
  if (fl) add("PROCESS", { nodes: fl });
  const place = knownPlacesOf(sentence)[0];
  if (place) add("MAP", { place });
  const pct = statedPercentsOf(sentence)[0];
  if (pct != null) { add("GAUGE", { percent: pct, label: null }); add("PIE", { percent: pct, label: null }); }
  const q = quantitiesOf(sentence)[0];
  if (q) add("COUNTER", { value: q.value, label: q.label });
  if (splitHeadline(headline)) add("TYPE", null, { split: true });
  add("TYPE", null);
  return out;
}
