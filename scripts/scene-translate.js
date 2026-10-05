/**
 * Scene -> composition (owner's "blueprint" note, 2026-10-03: "Gemini describes. The system
 * renders. The audit verifies."). The planner no longer picks a mechanism or a zone: it
 * writes a free scene_description. This module translates that description, with the
 * sentence it illustrates, into the candidate compositions the renderer knows — in the order
 * the description asks for them — and the planner keeps the first that passes checkVisual
 * (every figure, place and name still has to be in the sentence: nothing is invented here).
 *
 * The translation pipeline:
 *   1. elementsOf(scene)     — parse the description for element types in order
 *   2. positionOf(scene)     — parse placement phrases to zone coordinates
 *   3. timingOf(scene, words)— parse pacing phrases against SRT word timings
 *   4. translateScene()      — map elements to renderer primitives, carry position + timing
 *   5. unrecognised          — log and fall back to TYPE-FULL (the safety valve)
 *
 * Every translation is logged:
 *   [translate] ch-1 beat 3: number + line chart → Counter + LineChart, center, line draws 0–40% of beat
 *   [translate] unrecognized scene description, falling back to TYPE-FULL
 *
 * Where it stops: cue words, not understanding. A description that says "the number" for a
 * sentence with no number gets no COUNTER (the gate refuses it) and the next candidate wins.
 * Anything it cannot translate falls back to TYPE — the safety valve, logged.
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
  // "VS Code" is a product name, not a comparison. Without this guard the beat about
  // the VS Code extension marketplace was forced to COMPARE (audit 2026-10-05, ch-44 b6).
  ["COMPARE", /\b(side by side|versus|vs\.?(?!\s?code\b)|split (?:screen|frame)|two halves|against each other)\b/i],
  ["PROCESS", /\b(arrows?|flow(?:s|chart)?|chain|leads? to|nodes?|cause and effect|step by step|diagram|node[s]? (?:connected|linked))\b/i],
  ["BAR", /\b(bars?|bar chart|columns? (?:grow|rise))\b/i],
  ["LINE", /\b(line (?:chart|graph|draws|climbs|rises|falls)|draws left to right|over (?:the past|time)|curve)\b/i],
  ["GAUGE", /\b(gauge|dial|meter|needle)\b/i],
  ["PIE", /\b(donut|doughnut|pie|slice|share of the circle)\b/i],
  // "numeral" was missing, so "A giant numeral 40% fills the centre" matched nothing here and
  // the beat lost to LINE on a later, supporting clause ("behind it a thin line draws left to
  // right"), landing on TYPE with no number anywhere (run 37323030454, ch-1 beat 0). Cue
  // priority is by position in the description, so the primary element only wins if it
  // matches something. A beat whose description opens by naming a figure is a COUNTER beat.
  ["COUNTER", /\b(big number|large number|giant number|huge number|numeral|number (?:fills|counts|builds|rolls|ticks)|counts? up|figure fills|the number)\b/i],
  ["PHOTO", /\b(photo(?:graph)?|promotional still|press still|film still|production still|skyline|street|building|facade|aerial|courthouse|headquarters|factory floor|full-bleed)\b/i],
  ["TYPE", /\b(kinetic type|typograph(?:y|ic)|serif type|sans type|words? (?:pop|stack|slam)|type treatment|the phrase|statement)\b/i],
  // A name card is a TYPE-FULL composition in this renderer (canvas-layout.js draws
  // c.name_card inside the TYPE-FULL branch), so it resolves to TYPE — but naming it
  // here makes it a DECISIVE cue: the planner is told to describe the name card as the
  // intended visual when an entity is too niche to source (plan-vs-render audit
  // 2026-10-05, Fix 3), and that description must not be overridden by a heuristic.
  ["NAME_CARD", /\bname card\b/i],
];

const clean = (s) => String(s || "").replace(/[$\d.,%]+/g, " ").replace(/\b(a|an|the|of|and|to|in|on|for|per|is|are|was|were|from)\b/gi, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 3).join(" ");

/** Which cue types the description names, in the order they first appear. */
export function cuesOf(scene) {
  const text = String(scene || "");
  return CUES.map(([type, re]) => { const m = text.match(re); return m ? { type, at: m.index } : null; })
    .filter(Boolean).sort((a, b) => a.at - b.at).map((c) => c.type);
}

/**
 * Parse the description for element types, deduped, in the order they appear.
 * Maps text tokens to the element families the spec names: photo, number,
 * chart, logo, diagram, type.
 */
export function elementsOf(scene) {
  const text = String(scene || "");
  const map = [
    ["logo", /\b(logo|wordmark|emblem|seal|crest)\b/i],
    ["photo", /\b(portrait|headshot|photo|photograph|skyline|street|building|facade|aerial|courthouse|headquarters|factory|scene|full-bleed)\b/i],
    ["chart", /\b(chart|bars?|columns?|line (?:graph|chart)|curve|donut|doughnut|pie|gauge|dial|meter|needle|graph|trend)\b/i],
    ["number", /\b(big number|large number|number|figure|count|counts? up|roll|tick)\b/i],
    ["diagram", /\b(diagram|nodes?|arrows?|flow(?:s|chart)?|chain|process|step by step|cause and effect|timeline)\b/i],
    ["type", /\b(kinetic type|typography|words?|type|statement|phrase|headline)\b/i],
  ];
  const found = [];
  for (const [family, re] of map) {
    const m = text.match(re);
    if (m && !found.includes(family)) found.push(family);
  }
  return found;
}

/**
 * Parse placement phrases into zone coordinates.
 *   "fills the center"  -> x540, y960, scale 60% of frame
 *   "upper third"       -> y 150–620
 *   "lower third"       -> y 1340–1920
 *   "behind the number" -> z-index below the number
 *   "below it"          -> y offset +60px from the reference element
 * Returns { anchor, zone, x, y, note } or null when no phrase matched.
 */
export function positionOf(scene) {
  const text = String(scene || "").toLowerCase();
  const out = [];
  if (/\bfill(s|ing)? the (cent(e|re)|frame)\b/.test(text)) out.push({ anchor: "center", zone: "middle", x: 540, y: 960, scale: 0.6 });
  if (/\b(upper|top) third\b/.test(text)) out.push({ anchor: "upper-third", zone: "top", y: [150, 620] });
  if (/\b(lower|bottom) third\b/.test(text)) out.push({ anchor: "lower-third", zone: "bottom", y: [1340, 1920] });
  if (/\bbehind (the|a) \w+/.test(text)) out.push({ anchor: "behind", zIndex: "below" });
  const below = text.match(/\bbelow( it)?\b/);
  if (below) out.push({ anchor: "below", yOffset: 60 });
  if (/\b(left|left[- ]?aligned)\b/.test(text)) out.push({ anchor: "left", x: 48 });
  if (/\b(right|right[- ]?aligned)\b/.test(text)) out.push({ anchor: "right", x: 1032 });
  if (/\btop\b/.test(text) && !/\btop third\b/.test(text)) out.push({ anchor: "top", zone: "top" });
  if (!out.length) return null;
  // The first phrase the description makes is the primary placement.
  return out[0];
}

/**
 * Parse timing phrases against SRT word timings (words: [{word, start, end}] seconds).
 *   "finishes drawing by the time the narrator says X" -> animation ends at X's start
 *   "counts up over the first 40%"                     -> 0 -> 40% of the beat
 *   "pops in when X is said"                            -> at X's start - 6 frames
 * Default: pop at beat start, animate over 40% of the beat.
 * Returns { anchorWord, startFrac, endFrac, popAtWord } with frames when possible.
 */
const FPS = 30;
export function timingOf(scene, words = [], beatStart = 0, beatEnd = 0) {
  const text = String(scene || "");
  const wordStart = (w) => {
    const hit = (words || []).find((x) => String(x.word || "").toLowerCase().replace(/[^a-z0-9]/g, "") === String(w || "").toLowerCase().replace(/[^a-z0-9]/g, ""));
    return hit ? Number(hit.start) : null;
  };
  const duration = Math.max(0, beatEnd - beatStart);
  const m1 = text.match(/finish(?:es)? drawing by the time the narrator says ['"]?([\w-]+)/i);
  if (m1) {
    const at = wordStart(m1[1]);
    if (at != null && duration > 0) return { anchorWord: m1[1], startFrac: 0, endFrac: Math.min(1, Math.max(0, (at - beatStart) / duration)), phrase: `line draws 0–${Math.round(Math.min(1, Math.max(0, (at - beatStart) / duration)) * 100)}% of beat` };
  }
  const m2 = text.match(/counts? up over the first (\d+)%/i);
  if (m2) return { anchorWord: null, startFrac: 0, endFrac: Number(m2[1]) / 100, phrase: `count-up 0–${m2[1]}% of beat` };
  const m3 = text.match(/pops? in when ['"]?([\w-]+)['"]? is said/i);
  if (m3) {
    const at = wordStart(m3[1]);
    if (at != null) return { anchorWord: m3[1], popAt: Math.max(0, at - 6 / FPS), startFrac: duration > 0 ? Math.max(0, (at - 6 / FPS - beatStart) / duration) : 0, phrase: `pop at "${m3[1]}" minus 6 frames` };
  }
  const m4 = text.match(/(?:by the time|when) the narrator says ['"]?([\w-]+)/i);
  if (m4) {
    const at = wordStart(m4[1]);
    if (at != null && duration > 0) return { anchorWord: m4[1], startFrac: Math.max(0, (at - beatStart) / duration), phrase: `sync to "${m4[1]}"` };
  }
  return { anchorWord: null, startFrac: 0, endFrac: 0.4, phrase: "default pop at beat start, animate over 40%" };
}

const POSITION_PHRASE = (p) => {
  if (!p) return "center";
  if (p.anchor === "center") return "center, scale to 60% of frame";
  if (p.anchor === "upper-third") return "upper third";
  if (p.anchor === "lower-third") return "lower third";
  if (p.anchor === "behind") return "behind the primary element (z-index below)";
  if (p.anchor === "below") return "below the reference element (+60px)";
  if (p.anchor === "left") return "left edge";
  if (p.anchor === "right") return "right edge";
  if (p.anchor === "top") return "top zone";
  return p.anchor || "center";
};

/**
 * Candidate { visual_type, data, why } list for one beat, most wanted first (deduplicated by
 * type + data). The caller runs checkVisual and keeps the first that passes.
 *
 * New: each candidate carries `position` and `timing` parsed from the description, and every
 * translation is logged in the specified format.
 */
export function translateScene({ sentence = "", scene = "", entities = [], headline = "", words = [], beatStart = 0, beatEnd = 0, channel = "", beatIndex = null } = {}) {
  const out = [];
  const seen = new Set();
  const position = positionOf(scene);
  const timing = timingOf(scene, words, beatStart, beatEnd);
  const add = (visual_type, data, why) => {
    const k = `${visual_type}:${JSON.stringify(data)}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ visual_type, data, why, position, timing });
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
      case "NAME_CARD": add("TYPE", null, "description: name card"); break;
      default: break;
    }
  };
  const cues = cuesOf(scene);
  const elements = elementsOf(scene);
  const where = POSITION_PHRASE(position);
  const when = timing.phrase;
  const tag = channel ? `ch-${channel} ` : "";
  const beatTag = beatIndex != null ? `beat ${beatIndex}: ` : "";
  const logTranslate = () => {
    const prims = out.filter((o) => o.visual_type !== "TYPE").map((o) => o.visual_type);
    if (prims.length) console.log(`[translate] ${tag}${beatTag}${elements.join(" + ") || "scene"} → ${prims.join(" + ")}, ${where}, ${when}`);
    else console.log(`[translate] unrecognized scene description, falling back to TYPE-FULL${beatIndex != null ? ` (beat ${beatIndex})` : ""}`);
  };

  // THE DESCRIPTION DECIDES (owner, 2026-10-05 — plan-vs-render audit Fix 4).
  // The planner wrote scene_description; the heuristics below are a guess about what
  // the SENTENCE means, and the audit showed that guess overrode the plan on 11 of 37
  // beats — a place name anywhere in the sentence forced MAP-CENTERED, a number forced
  // a chart, and beats that asked for a photograph or a document were drawn as a map.
  // So: if the description names ANY specific element type, that type is the plan and
  // the heuristics do not run at all. A description that cannot be grounded (a line
  // chart for a sentence with one figure) falls through to TYPE, which the planner
  // gates on — it is never silently replaced by a chart or map nobody asked for.
  if (cues.length) {
    for (const c of cues) want(c);
    add("TYPE", null, "description did not name a buildable element");
    // Log the override that was avoided: what a heuristic would have forced instead.
    const chosen = out.find((o) => o.visual_type !== "TYPE") || out[0];
    const heuristic = candidatesFor({ sentence, headline }).find((c) => c.visual_type !== "TYPE");
    if (heuristic && chosen && heuristic.visual_type !== chosen.visual_type) {
      console.log(`[translate] ${tag}${beatTag}description "${String(scene).slice(0, 60)}" → kept as ${chosen.visual_type} (a sentence heuristic would have forced ${heuristic.visual_type}${knownPlacesOf(sentence).length ? " by place name" : ""})`);
    }
    logTranslate();
    return out;
  }

  // The description names no specific type: apply the sentence heuristics (the
  // directive's step 2). NOTE: the saved plan's own `visual_type` is NOT a planner
  // declaration — gemini-visual-plan.js writes this function's pick back into
  // b.visual_type, and Gemini is never asked for one — so feeding it back in here
  // would re-impose the previous translator's choice and reproduce the divergence.
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
  add("TYPE", null, "nothing else fits");

  logTranslate();
  return out;
}
