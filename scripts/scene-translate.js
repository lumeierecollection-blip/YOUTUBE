/**
 * Scene -> composition (owner's "blueprint" note, 2026-10-03: "Gemini describes. The system
 * renders. The audit verifies."). The planner no longer picks a mechanism or a zone: it
 * writes a free scene_description. This module translates that description, with the
 * sentence it illustrates, into the candidate compositions the renderer knows — in the order
 * the description asks for them — and the planner keeps the first that passes checkVisual
 * (every figure, place and name still has to be in the sentence: nothing is invented here).
 *
 * Order of candidates:
 *   1. what the DESCRIPTION asks for, by its cue words, in the order the cues appear
 *      ("a portrait of Powell" -> PHOTO person; "the logo" -> PHOTO company; "a map" -> MAP;
 *      "a big number … counts up" -> COUNTER; "bars" -> BAR; "a line draws" -> LINE / TREND;
 *      "arrows" -> PROCESS; "a timeline" -> TIMELINE; "a list" -> LIST; "side by side" ->
 *      COMPARE; "a scan of the filing" -> DOCUMENT; "a stack of bills" -> MONEY;
 *      "kinetic type" -> TYPE);
 *   2. a two-number comparison in the SENTENCE is a chart (the two-number rule) — BAR, or
 *      LINE when the description says line / over time;
 *   3. what the sentence itself grounds (composition-rotation.js candidatesFor: timeline,
 *      comparison, list, process, map, percentage, figure);
 *   4. the sentence's named entities as photos (person, company / institution, place /
 *      building) — the resolver fetches, verifies or falls back;
 *   5. TYPE.
 * Where it stops: cue words, not understanding. A description that says "the number" for a
 * sentence with no number gets no COUNTER (the gate refuses it) and the next candidate wins.
 * Anything it cannot translate falls back to TYPE — the safety valve, logged by the planner.
 */
import { candidatesFor } from "./composition-rotation.js";
import { quantitiesOf, compareOf, timelineOf, listItemsOf, flowNodes, knownPlacesOf, statedPercentsOf, documentNameOf, moneyObjectOf } from "./canvas-grounding.js";
import { trendOf } from "./composition-variety.js";

const CUES = [
  ["PORTRAIT", /\b(portrait|headshot|face|photo(?:graph)? of (?:him|her)|his photo|her photo)\b/i],
  ["LOGO", /\b(logo|wordmark|emblem|seal|crest)\b/i],
  ["MAP", /\b(map|outline of (?:the )?(?:country|state|region)|region (?:lights|glows|highlight))\b/i],
  ["MONEY", /\b(bills?|banknotes?|cash|coins?|stack of (?:money|dollars)|wallet|piggy bank)\b/i],
  ["DOCUMENT", /\b(document|filing|court papers|the (?:bill|act|law) text|page of|scan of)\b/i],
  ["TIMELINE", /\b(timeline|dates? (?:line|run) (?:up|down)|year by year)\b/i],
  ["LIST", /\b(list|items? (?:appear|stack)|one by one|checklist)\b/i],
  ["COMPARE", /\b(side by side|versus|vs\.?|split (?:screen|frame)|two halves|against each other)\b/i],
  ["PROCESS", /\b(arrows?|flow(?:s|chart)?|chain|leads? to|nodes?|cause and effect|step by step)\b/i],
  ["BAR", /\b(bars?|bar chart|columns? (?:grow|rise))\b/i],
  ["LINE", /\b(line (?:chart|graph|draws|climbs|rises|falls)|draws left to right|over (?:the past|time)|curve)\b/i],
  ["GAUGE", /\b(gauge|dial|meter|needle)\b/i],
  ["PIE", /\b(donut|doughnut|pie|slice|share of the circle)\b/i],
  ["COUNTER", /\b(big number|large number|number (?:fills|counts|builds|rolls|ticks)|counts? up|figure fills|the number)\b/i],
  ["PHOTO", /\b(photo(?:graph)?|skyline|street|building|facade|aerial|courthouse|headquarters|factory floor|full-bleed)\b/i],
  ["TYPE", /\b(kinetic type|typography|words? (?:pop|stack|slam)|type treatment|the phrase|statement)\b/i],
];

const clean = (s) => String(s || "").replace(/[$\d.,%]+/g, " ").replace(/\b(a|an|the|of|and|to|in|on|for|per|is|are|was|were|from)\b/gi, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 3).join(" ");

/** Which cue types the description names, in the order they first appear. */
export function cuesOf(scene) {
  const text = String(scene || "");
  return CUES.map(([type, re]) => { const m = text.match(re); return m ? { type, at: m.index } : null; })
    .filter(Boolean).sort((a, b) => a.at - b.at).map((c) => c.type);
}

/**
 * Candidate { visual_type, data } list for one beat, most wanted first (deduplicated by
 * type + data). The caller runs checkVisual and keeps the first that passes.
 */
export function translateScene({ sentence = "", scene = "", entities = [], headline = "" }) {
  const out = [];
  const seen = new Set();
  const add = (visual_type, data, why) => {
    const k = `${visual_type}:${JSON.stringify(data)}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ visual_type, data, why });
  };
  const ents = (types) => entities.filter((e) => types.includes(String(e?.type || "").toLowerCase()));
  const qs = quantitiesOf(sentence);
  const bars = qs.slice(0, 4).map((q) => ({ label: clean(q.label), value: q.value }));
  const descLine = /\b(line|over (?:the past|time)|curve|climb)\b/i.test(scene);
  const want = (type) => {
    switch (type) {
      case "PORTRAIT": for (const e of ents(["person"])) add("PHOTO", { entity: e.name }, "description: portrait"); break;
      case "LOGO": for (const e of ents(["company", "institution", "organization"])) add("PHOTO", { entity: e.name }, "description: logo"); break;
      case "MAP": { const p = knownPlacesOf(sentence)[0]; if (p) add("MAP", { place: p }, "description: map"); break; }
      case "MONEY": if (moneyObjectOf(sentence)) add("MONEY", {}, "description: money"); break;
      case "DOCUMENT": if (documentNameOf(sentence)) add("DOCUMENT", {}, "description: document"); break;
      case "TIMELINE": if (timelineOf(sentence)) add("TIMELINE", {}, "description: timeline"); break;
      case "LIST": if (listItemsOf(sentence)) add("LIST", {}, "description: list"); break;
      case "COMPARE": if (compareOf(sentence)) add("COMPARE", {}, "description: side by side"); break;
      case "PROCESS": { const n = flowNodes(sentence); if (n) add("PROCESS", { nodes: n }, "description: flow"); break; }
      case "BAR": if (bars.length >= 2) add("BAR", { bars }, "description: bars"); break;
      case "LINE": {
        if (qs.length >= 2) add("LINE", { points: qs.slice(0, 5).map((q) => ({ label: clean(q.label), value: q.value })) }, "description: line");
        const tr = trendOf(sentence);
        if (tr) add("TREND", { direction: tr.direction, label: tr.label }, "description: line, no figures");
        break;
      }
      case "GAUGE": { const p = statedPercentsOf(sentence)[0]; if (p != null) add("GAUGE", { percent: p, label: null }, "description: gauge"); break; }
      case "PIE": { const p = statedPercentsOf(sentence)[0]; if (p != null) add("PIE", { percent: p, label: null }, "description: share"); break; }
      case "COUNTER": if (qs[0]) add("COUNTER", { value: qs[0].value, label: clean(qs[0].label) || null }, "description: number"); break;
      case "PHOTO": for (const e of ents(["place", "building", "company", "institution", "organization", "person"])) add("PHOTO", { entity: e.name }, "description: photo"); break;
      case "TYPE": add("TYPE", null, "description: type"); break;
      default: break;
    }
  };
  // 1. what the description asks for (TYPE only after everything visual it also names)
  const cues = cuesOf(scene);
  for (const c of cues.filter((x) => x !== "TYPE")) want(c);
  // 2. the two-number rule: two comparable figures + a comparison word is a chart
  if (/\b(more|less|than|versus|vs|higher|lower|grew|fell|rose|dropped|doubled|halved|increased|decreased|compared|from)\b/i.test(sentence) && qs.length >= 2) {
    if (descLine) want("LINE");
    if (bars.length >= 2) add("BAR", { bars }, "two-number rule");
  }
  // 3. what the sentence itself grounds
  for (const c of candidatesFor({ sentence, headline })) if (c.visual_type !== "TYPE") add(c.visual_type, c.data, "grounded in the sentence");
  const tr = trendOf(sentence);
  if (tr) add("TREND", { direction: tr.direction, label: tr.label }, "a stated rise / fall");
  // 4. the named entities as photos
  for (const e of [...ents(["person"]), ...ents(["company", "institution", "organization"]), ...ents(["place", "building"])]) add("PHOTO", { entity: e.name }, "named entity");
  // 5. type
  if (cues.includes("TYPE")) add("TYPE", null, "description: type");
  add("TYPE", null, "nothing else fits");
  return out;
}
