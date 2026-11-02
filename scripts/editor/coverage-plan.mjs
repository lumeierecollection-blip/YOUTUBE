/**
 * Sentence-level visual coverage for the automatic editor.
 *
 * The old planner gave every spoken sentence exactly one scene. A sentence
 * with four ideas ("a pregnant mother / was crushed / in 1586 / in York")
 * therefore got one picture and the other three ideas were never shown. This
 * module extracts the visual ideas from each sentence, allocates them to
 * beats, and times each beat from the word the idea is spoken on. It is
 * deterministic: the same script + the same word timings always produce the
 * same plan, so the render and the QA can both read it.
 *
 * A concept is what the sentence asks the viewer to see: a named person, a
 * place, an organisation, an object, a document, an event, a process, a
 * relationship, a number or a year. A concept is only "essential" when the
 * sentence would lose information without it. A repeated year ("1586" said
 * four times) is one dated idea, not four graphics.
 *
 * Pure functions only. No network, no model, no filesystem.
 */
import { scriptSentences } from "./captions.mjs";
import { sentenceSpans } from "./auto-plan.mjs";

const cleanWord = (s) => String(s || "").toLowerCase().replace(/[’']s$/i, "").replace(/[^\p{L}\p{N}]/gu, "");
const norm = (s) => String(s || "").toLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ").trim();
const slug = (s) => norm(s).replace(/\s+/g, "-").slice(0, 52) || "concept";

const KIND = {
  person: "person", people: "person",
  place: "place", location: "place", city: "place", country: "place", building: "place",
  organization: "organization", organisation: "organization", company: "organization", agency: "organization",
  institution: "organization", university: "organization",
  object: "object", product: "object", technology: "technology",
  event: "event", document: "document", process: "process", relation: "relation",
};

const ESSENTIAL_KINDS = new Set(["person", "place", "organization", "object", "document", "event", "process", "relation", "technology", "number", "year", "state"]);

/** Named entities from the research, with the aliases a sentence may use. */
export function coverageEntityIndex(research) {
  const out = [];
  for (const e of research?.named_entities || []) {
    const kind = KIND[String(e.kind || "").toLowerCase()];
    if (!kind || !e.name) continue;
    const full = norm(e.name);
    if (!full) continue;
    const aliases = new Set([full]);
    const parts = full.split(" ").filter(Boolean);
    if (kind === "person" && parts.length >= 2 && parts.at(-1).length >= 4) aliases.add(parts.at(-1));
    if (kind === "organization" && parts.length > 1) aliases.add(parts[0]);
    // "WSO2 Integrator 5.1" is a product; a sentence may say only "Integrator 5.1" or "5.1".
    if (parts.length > 1) for (let i = 1; i < parts.length; i++) if (parts[i].length > 2) aliases.add(parts.slice(i).join(" "));
    out.push({ name: String(e.name), kind, aliases: [...aliases].filter(Boolean).sort((a, b) => b.length - a.length) });
  }
  return out;
}

function tokensWithPositions(sentence) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(String(sentence)))) out.push({ raw: m[0], clean: cleanWord(m[0]), start: m.index, end: m.index + m[0].length });
  return out;
}

/** All non-overlapping mentions of research entities, longest alias first. */
export function entityMentions(sentence, index) {
  const words = tokensWithPositions(sentence);
  const found = [];
  for (let i = 0; i < words.length; i++) {
    for (const ent of index) {
      for (const alias of ent.aliases) {
        const at = alias.split(" ");
        if (i + at.length > words.length) continue;
        let ok = true;
        for (let k = 0; k < at.length; k++) if (words[i + k].clean !== at[k]) { ok = false; break; }
        if (!ok) continue;
        found.push({ ent, startWord: i, endWord: i + at.length, start: words[i].start, end: words[i + at.length - 1].end, speak: sentence.slice(words[i].start, words[i + at.length - 1].end) });
      }
    }
  }
  found.sort((a, b) => a.startWord - b.startWord || (b.endWord - b.startWord) - (a.endWord - a.startWord));
  const out = [];
  let lastEnd = -1;
  for (const m of found) {
    if (m.startWord < lastEnd) continue;
    out.push(m);
    lastEnd = m.endWord;
  }
  return out;
}

const PATTERNS = [
  { re: /\b(?:wouldn't|would not|refused)\b[^.!?]{0,30}\b(?:so|then)\b[^.!?]{0,45}\bcrush(?:ed|ing)?\b/i, kind: "relation", label: "refusal led to crushing", visual: "diagram", diagram: "causal" },
  { re: /\b(?:crushed|crushing|crush)\b[^.!?]{0,36}\b(?:to death|death)\b/i, kind: "event", label: "crushing to death", query: "pressing to death execution historical engraving", visual: "historical", diagram: "timeline" },
  { re: /\bexecution\b/i, kind: "event", label: "execution", query: "public execution scaffold historical engraving", visual: "historical", diagram: "timeline" },
  { re: /\bharbour(?:ing|ed|s)?\b[^.!?]{0,48}\b(?:catholic\s+)?priests?\b/i, kind: "event", label: "harbouring Catholic priests", query: "priest hole Catholic recusant hiding place", visual: "photo" },
  { re: /\brefused to enter a plea\b|\bwouldn't testify\b|\bwould not testify\b|\brefused to testify\b/i, kind: "event", label: "refused to enter a plea", query: "Elizabethan trial document", visual: "diagram", diagram: "plea" },
  { re: /\bpregnant\b[^.!?]{0,28}\b(?:\d+(?:st|nd|rd|th)|fourth)\s+child\b/i, kind: "state", label: "pregnant with her fourth child", query: null, visual: "diagram", diagram: "number" },
  { re: /\bpregnant\s+(?:mother|woman)\b/i, kind: "state", label: "pregnant mother", query: "mother and child historical painting", visual: "historical" },
  { re: /\bwitness(?:ed|es|ing)?\b|\bwhat did\b[^.!?]{1,60}\bsee\b|\bsaw\b/i, kind: "relation", label: "witnessed the execution", visual: "diagram", diagram: "relation" },
  { re: /\bgunpowder plot\b/i, kind: "event", label: "Gunpowder Plot", query: "Gunpowder Plot conspirators engraving", visual: "historical" },
  { re: /\bshaped\b[^.!?]{0,30}\bconspirators?\b/i, kind: "relation", label: "influenced the conspirators", visual: "diagram", diagram: "relation" },
  { re: /\bknew\b[^.!?]{0,20}\b(?:her|the)\b[^.!?]{0,20}\bstory\b/i, kind: "relation", label: "knew her story", visual: "diagram", diagram: "relation" },
  { re: /\binfluenced\b[^.!?]{0,40}\b(?:gunpowder plot|conspirators?)\b/i, kind: "relation", label: "influenced the Gunpowder Plot", visual: "diagram", diagram: "relation" },
  { re: /\b(?:launched|released|unveiled)\b/i, kind: "event", label: "release", query: null, visual: "diagram", diagram: "date" },
  { re: /\bpublished\b/i, kind: "event", label: "published the release details", query: "release notes document", visual: "document" },
  { re: /\bbuilds? on\b[^.!?]{0,36}\bversion\s+\d+(?:\.\d+)+/i, kind: "relation", label: "version upgrade", visual: "diagram", diagram: "version" },
  { re: /\benterprise agents?\b/i, kind: "technology", label: "enterprise agents", query: null, visual: "diagram", diagram: "flow" },
  { re: /\bintegration workflows?\b/i, kind: "process", label: "integration workflows", query: null, visual: "diagram", diagram: "flow" },
  { re: /\bconnect(?:s|ed|ing)?\b[^.!?]{0,50}\b(?:using|with)\b[^.!?]{0,30}\b(?:artificial intelligence|AI)\b/i, kind: "relation", label: "connected with AI", visual: "diagram", diagram: "flow" },
  { re: /\bexpand(?:s|ed|ing)? support\b/i, kind: "relation", label: "expanded support", visual: "diagram", diagram: "flow" },
  { re: /\bartificial intelligence\b|\bAI\b/i, kind: "technology", label: "artificial intelligence", query: null, visual: "diagram", diagram: "ai" },
  { re: /\bpatent(?:ed|s)?\b/i, kind: "document", label: "patent", visual: "document" },
  { re: /\bsteering wheel\b/i, kind: "object", label: "steering wheel", query: "car steering wheel interior", visual: "photo" },
  { re: /\bhaptic zones?\b/i, kind: "object", label: "haptic zones", query: "car steering wheel interior", visual: "annotated" },
  { re: /\bnegotiation\b/i, kind: "relation", label: "driver-system negotiation", visual: "diagram", diagram: "negotiation" },
  { re: /\bautonomous (?:driving|systems?|vehicles?)\b/i, kind: "technology", label: "autonomous driving", query: null, visual: "diagram", diagram: "negotiation" },
  { re: /\bsemi-autonomous cars?\b/i, kind: "object", label: "semi-autonomous car", query: null, visual: "diagram", diagram: "negotiation" },
];

const VERSION = /\bversion\s+(\d+(?:\.\d+){1,2})\b|\b(\d+\.\d+(?:\.\d+)?)\b/gi;
const YEAR = /(?<![\d,.])(1[0-9]{3}|20[0-9]{2})(?!\d|,\d|\.\d)/g;
const DATE = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+((?:1[0-9]{3}|20[0-9]{2}))\b/gi;
const ORDINAL = /\b(\d{1,2})(?:st|nd|rd|th)\s+(child|children|child\b)/gi;
const COUNT = /\b(\d{1,3})\s+(haptic zones?|zones?|specialized steering wheels?)\b/gi;
const POSITION = /\b(10|2)\s*o'clock\b/gi;
const PATENT = /\b(US\s?\d{7,}[A-Z]\d?)\b/i;

function pushConcept(list, c) {
  if (!c || !c.label) return;
  const key = `${c.kind}:${norm(c.label)}`;
  if (list.some((x) => `${x.kind}:${norm(x.label)}` === key)) return;
  list.push(c);
}

/** The visual ideas in one sentence, in the order they are spoken. */
export function extractCoverageConcepts(sentence, { research = {}, yearSeen = new Set(), versionSeen = new Set(), dateSeen = new Set(), entitySeen = new Set(), conceptSeen = new Set() } = {}) {
  const text = String(sentence || "");
  const concepts = [];
  const index = coverageEntityIndex(research);
  const dateSpans = [];
  // Every recognized span, including a repeat that is deliberately not drawn.
  // A clause that is already understood must not fall back to a key-word card.
  const recognized = [];
  const note = (start, end) => recognized.push({ start, end });
  for (const m of text.matchAll(DATE)) {
    const label = `${m[1]} ${Number(m[2])}, ${m[3]}`;
    const start = m.index;
    const end = m.index + m[0].length;
    dateSpans.push({ start, end });
    note(start, end);
    yearSeen.add(Number(m[3]));
    if (dateSeen.has(label)) continue;
    dateSeen.add(label);
    pushConcept(concepts, {
      kind: "date", label, speak: m[0], start, end, value: m[3],
      query: null, visual: "diagram", diagram: "date", essential: true, era: "modern",
    });
  }
  for (const m of entityMentions(text, index)) {
    const historical = Number((text.match(YEAR) || [])[0] || 0) > 0 && Number((text.match(YEAR) || [])[0] || 0) < 1950;
    const key = `${m.ent.kind}:${norm(m.ent.name)}`;
    const repeat = entitySeen.has(key);
    entitySeen.add(key);
    note(m.start, m.end);
    pushConcept(concepts, {
      kind: m.ent.kind, label: m.ent.name, speak: m.speak, start: m.start, end: m.end,
      query: m.ent.kind === "person" ? `${m.ent.name} portrait` : m.ent.name,
      visual: m.ent.kind === "person" ? (historical ? "historical" : "entity") : m.ent.kind,
      essential: true,
      era: historical ? "historical" : "modern",
      repeat,
    });
  }
  for (const p of PATTERNS) {
    const m = p.re.exec(text);
    if (!m) continue;
    note(m.index, m.index + m[0].length);
    pushConcept(concepts, {
      kind: p.kind, label: p.label, speak: m[0], start: m.index, end: m.index + m[0].length,
      query: p.query || null, visual: p.visual, diagram: p.diagram || null, expect: p.expect || [],
      essential: true,
      era: /execution|crush|harbour|plea|gunpowder|conspirator|clitherow/i.test(p.label) ? "historical" : "modern",
      repeat: conceptSeen.has(`${p.kind}:${norm(p.label)}`),
    });
  }
  const patent = PATENT.exec(text);
  if (patent) {
    const number = patent[1].replace(/\s+/g, "");
    note(patent.index, patent.index + patent[0].length);
    pushConcept(concepts, {
      kind: "document", label: `patent ${number}`, speak: patent[0], start: patent.index, end: patent.index + patent[0].length,
      query: `US patent ${number}`, visual: "document", essential: true, era: "modern",
      source_url: `https://patents.google.com/patent/${number}/en`,
      expect: [number],
      repeat: conceptSeen.has(`document:${norm(`patent ${number}`)}`),
    });
  }
  for (const m of text.matchAll(YEAR)) {
    const y = Number(m[1]);
    note(m.index, m.index + m[1].length);
    if (yearSeen.has(y)) continue;
    if (dateSpans.some((d) => d.start <= m.index && m.index < d.end)) continue;
    yearSeen.add(y);
    pushConcept(concepts, {
      kind: "year", label: String(y), speak: m[1], start: m.index, end: m.index + m[1].length,
      value: y, query: null, visual: "figure", diagram: "timeline", essential: true, era: y < 1950 ? "historical" : "modern",
      source: "research", source_text: String(y),
    });
  }
  for (const m of text.matchAll(VERSION)) {
    const v = m[1] || m[2];
    if (!v) continue;
    note(m.index, m.index + m[0].length);
    if (versionSeen.has(v)) continue;
    versionSeen.add(v);
    pushConcept(concepts, {
      kind: "version", label: `version ${v}`, speak: m[0], start: m.index, end: m.index + m[0].length,
      value: v, query: null, visual: "diagram", diagram: "version", essential: true, era: "modern",
    });
  }
  for (const m of text.matchAll(ORDINAL)) {
    const n = Number(m[1]);
    note(m.index, m.index + m[0].length);
    const word = m[1] === "1" ? "first" : m[1] === "2" ? "second" : m[1] === "3" ? "third" : "fourth";
    const stated = new RegExp(`\\b(?:${m[1]}(?:st|nd|rd|th)|${word})\\b`, "i").test(JSON.stringify(research));
    if (!stated) continue;
    pushConcept(concepts, {
      kind: "number", label: `${m[1]}${m[1] === "1" ? "st" : m[1] === "2" ? "nd" : m[1] === "3" ? "rd" : "th"} child`, speak: m[0], start: m.index, end: m.index + m[0].length,
      value: n, query: null, visual: "diagram", diagram: "number", essential: true, era: "historical",
      repeat: conceptSeen.has(`number:${norm(`${m[1]}${m[1] === "1" ? "st" : m[1] === "2" ? "nd" : m[1] === "3" ? "rd" : "th"} child`)}`),
    });
  }
  for (const m of text.matchAll(COUNT)) {
    const n = Number(m[1]);
    note(m.index, m.index + m[0].length);
    // "one specialized steering wheel" is a sentence construction, not a figure to draw.
    if (n < 2 && !/haptic/i.test(m[2])) continue;
    pushConcept(concepts, {
      kind: "number", label: `${n} ${m[2]}`, speak: m[0], start: m.index, end: m.index + m[0].length,
      value: n, query: null, visual: "diagram", diagram: "number", essential: true, era: "modern",
      repeat: conceptSeen.has(`number:${norm(`${n} ${m[2]}`)}`),
    });
  }
  for (const m of text.matchAll(POSITION)) {
    note(m.index, m.index + m[0].length);
    pushConcept(concepts, {
      kind: "position", label: `${m[1]} o'clock zone`, speak: m[0], start: m.index, end: m.index + m[0].length,
      value: Number(m[1]), query: null, visual: "annotated", diagram: "clock", essential: true, era: "modern",
      repeat: conceptSeen.has(`position:${norm(`${m[1]} o'clock zone`)}`),
    });
  }

  // Two concepts for the same noun ("2 haptic zones" and "haptic zones"):
  // the one with the figure is the one that adds information.
  for (const c of concepts) {
    if (c.kind !== "object" || !/haptic zones?/i.test(c.label)) continue;
    if (concepts.some((o) => o.kind === "number" && /haptic zones?/i.test(o.label))) c.essential = false;
  }
  // "4th child" is already stated by "pregnant with her fourth child"; one
  // pregnancy diagram, not two.
  for (const c of concepts) {
    if (c.kind !== "number" || !/child/i.test(c.label)) continue;
    const n = String(c.value);
    if (concepts.some((o) => o.kind === "state" && new RegExp(`\\b${n}(?:st|nd|rd|th)\\b`, "i").test(o.label))) c.essential = false;
  }
  // A named patent (US12227190B2) is more specific than the word "patent".
  if (concepts.some((c) => c.kind === "document" && /^patent\s+US/i.test(c.label))) {
    for (const c of concepts) if (c.kind === "document" && /^patent$/i.test(c.label)) c.essential = false;
  }
  // "What did Guy Fawkes see ..." is a relation about Fawkes: order it after
  // him and time it on "see", not on the question word.
  const firstPerson = concepts.find((c) => c.kind === "person");
  if (firstPerson) {
    for (const c of concepts) {
      if (c.kind !== "relation" || c.start > 0) continue;
      const verb = text.slice(firstPerson.end).match(/\b(?:see|saw|witness(?:ed)?)\b/i);
      if (!verb) continue;
      c.start = firstPerson.end + verb.index;
      c.end = c.start + verb[0].length;
      c.speak = verb[0];
    }
  }

  // No named/lexical idea in a clause: use its most concrete phrase, rather than silently showing nothing.
  const clauses = clauseSpans(text);
  for (const c of clauses) {
    const covered = concepts.some((x) => x.essential !== false && x.start < c.end && c.start < x.end) || recognized.some((x) => x.start < c.end && c.start < x.end);
    if (covered) continue;
    const phrase = keyWords(text.slice(c.start, c.end));
    if (!phrase) continue;
    note(c.start, c.start + phrase.length);
    pushConcept(concepts, {
      kind: "subject", label: phrase, speak: phrase, start: c.start, end: c.start + phrase.length,
      query: null, visual: "diagram", diagram: "label", essential: true, era: "modern",
    });
  }

  concepts.sort((a, b) => a.start - b.start || b.label.length - a.label.length);
  // Drop a concept wholly inside a same-kind concept (the longer one says the same thing and more).
  const kept = concepts.filter((c, i) => !concepts.some((o, j) => j !== i && o.kind === c.kind && o.start <= c.start && o.end >= c.end && (o.end - o.start) > (c.end - c.start)));
  for (const c of kept) conceptSeen.add(`${c.kind}:${norm(c.label)}`);
  return kept;
}

function clauseSpans(text) {
  const out = [];
  const re = /[^.!?;]+(?:[.!?;]+|$)/g;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const start = m.index;
    // Sub-clauses introduced by but/so/while/after/before/however; "and" is deliberately not split (it joins names).
    const at = raw.search(/\b(?:but|so|while|after|before|however)\b/i);
    if (at > 12) {
      out.push({ start, end: start + at });
      out.push({ start: start + at, end: start + raw.length });
    } else out.push({ start, end: start + raw.length });
  }
  return out;
}

const STOP = new Set("the a an of to in on at for and or but is are was were be been it its this that these those with by from as than then when while which who whom what where how why not no yes will would can could may might has have had do does did into over under about after before more most less least very just only also across around through during between against within without his her their our your my she he they them we you i".split(" "));

function keyWords(text) {
  const words = String(text).replace(/[^\p{L}\p{N}'\s-]/gu, " ").split(/\s+/).filter(Boolean);
  const keep = words.filter((w) => !STOP.has(w.toLowerCase()) && w.length > 2);
  if (!keep.length) return "";
  const runs = [];
  let cur = [];
  for (const w of words) {
    if (!STOP.has(w.toLowerCase()) && w.length > 2) cur.push(w);
    else if (cur.length) { runs.push(cur); cur = []; }
  }
  if (cur.length) runs.push(cur);
  const score = (r) => Math.min(r.length, 4) + (r.some((w) => /\d/.test(w) || /^[A-Z]/.test(w)) ? 2 : 0);
  const best = runs.reduce((a, b) => (score(b) > score(a) ? b : a), runs[0] || keep).slice(0, 4);
  return best.join(" ");
}

/** How many beats a sentence's ideas deserve, before the duration cap. */
export function beatTarget(count) {
  if (count <= 1) return 1;
  if (count === 2) return 2;
  return Math.min(5, count);
}

/** Group ordered concepts into semantic beats (person+place, document+owner, object+zones), then merge to `target`. */
export function groupConcepts(concepts, target) {
  const list = concepts.slice(0, 8);
  if (!list.length) return [];
  const groups = [];
  for (const c of list) {
    const last = groups.at(-1);
    const joins = last && (
      (c.kind === "position" && last.some((x) => x.kind === "object" || x.kind === "position")) ||
      (c.kind === "document" && last.some((x) => x.kind === "organization" || x.kind === "person")) ||
      (c.kind === "organization" && last.some((x) => x.kind === "document")) ||
      (c.kind === "year" && last.some((x) => x.kind === "event")) ||
      (c.kind === "date" && last.some((x) => x.kind === "event" || x.kind === "version")) ||
      (c.kind === "number" && last.some((x) => x.kind === "state"))
    );
    if (joins) last.push(c);
    else groups.push([c]);
  }
  // Keep the target as a ceiling: merge the smallest adjacent pair until the
  // sentence has no more beats than its duration can carry.
  const n = Math.max(1, Math.min(target, groups.length));
  while (groups.length > n) {
    let best = 1;
    let bestSize = Infinity;
    for (let i = 1; i < groups.length; i++) {
      const size = groups[i - 1].length + groups[i].length;
      if (size < bestSize) { bestSize = size; best = i; }
    }
    groups[best - 1] = [...groups[best - 1], ...groups[best]];
    groups.splice(best, 1);
  }
  return groups;
}

function wordsForSentence(words, i) {
  return (words || []).filter((w) => w && w.sentence === i && Number.isFinite(w.start) && Number.isFinite(w.end)).sort((a, b) => a.start - b.start);
}

function timeOfConcept(concept, sentence, span, sentenceWords) {
  const target = norm(concept.speak).split(" ").filter(Boolean);
  if (target.length && sentenceWords.length) {
    const clean = sentenceWords.map((w) => cleanWord(w.word ?? w.text));
    for (let i = 0; i + target.length <= clean.length; i++) {
      let ok = true;
      for (let k = 0; k < target.length; k++) if (clean[i + k] !== target[k]) { ok = false; break; }
      if (ok) return sentenceWords[i].start;
    }
    // fall back to the longest word of the concept, which survives number spellings and hyphenation
    let best = null;
    for (const t of target.slice().sort((a, b) => b.length - a.length)) {
      const at = clean.indexOf(t);
      if (at >= 0) { best = sentenceWords[at].start; break; }
    }
    if (best != null) return best;
  }
  const ratio = sentence.length ? concept.start / sentence.length : 0;
  return span.start + (span.end - span.start) * Math.max(0, Math.min(1, ratio));
}

/**
 * Time each group from the word its first idea is spoken on. The first beat
 * starts with the sentence, the last ends with it, and no beat is shorter than
 * `minDur` seconds. If the sentence is too short for that many beats, the
 * groups are merged (the caller already capped the target).
 */
export function timeGroups(groups, sentence, span, sentenceWords, minDur = 0.9) {
  let list = groups.filter((g) => g.length);
  if (!list.length) return [];
  const spanLength = Math.max(0.1, span.end - span.start);
  // The sentence is too short for one beat per group: merge from the tail so
  // every idea is still covered, rather than dropping the last group.
  while (list.length > 1 && list.length * minDur > spanLength) {
    const tail = list.pop();
    list[list.length - 1] = [...list[list.length - 1], ...tail];
  }
  const starts = list.map((g) => timeOfConcept(g[0], sentence, span, sentenceWords));
  starts[0] = span.start;
  for (let i = 1; i < starts.length; i++) starts[i] = Math.max(starts[i], starts[i - 1] + minDur);
  // Fit the last beat before the sentence ends, then pull the earlier starts
  // back just enough to keep the minimum gap.
  if (starts.at(-1) > span.end - minDur) {
    starts[starts.length - 1] = span.end - minDur;
    for (let i = starts.length - 2; i >= 1; i--) starts[i] = Math.min(starts[i], starts[i + 1] - minDur);
    starts[0] = span.start;
  }
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const start = i === 0 ? span.start : Math.max(span.start, Math.min(span.end, starts[i]));
    const end = i === list.length - 1 ? span.end : Math.max(start + minDur, Math.min(span.end, starts[i + 1]));
    if (end - start < 0.3) continue;
    out.push({ group: list[i], start, end });
  }
  return out;
}

function proportionalSpans(sentences, audioDuration) {
  const total = sentences.reduce((a, s) => a + Math.max(1, s.length), 0);
  let acc = 0;
  return sentences.map((s) => {
    const start = (acc / total) * audioDuration;
    acc += Math.max(1, s.length);
    return { start, end: (acc / total) * audioDuration };
  });
}

/**
 * Build the coverage plan: sentences -> concepts -> beats, timed by the voiceover.
 * `words` is the flattened word list from tts.js: [{text|word, start, end, sentence}].
 */
export function buildCoveragePlan({ script, research = {}, words = [], audioDuration }) {
  const sentences = scriptSentences(script);
  if (!sentences.length) throw new Error("coverage: script has no spoken sentences");
  if (!(audioDuration > 0)) throw new Error("coverage: no audio duration");
  const exact = sentenceSpans(words, sentences.length, audioDuration);
  const spans = exact || proportionalSpans(sentences, audioDuration);
  const yearSeen = new Set();
  const versionSeen = new Set();
  const dateSeen = new Set();
  const entitySeen = new Set();
  const conceptSeen = new Set();
  const primaryPerson = (research?.named_entities || []).find((e) => /^person$/i.test(String(e.kind || "")))?.name || null;
  const sentencePlans = sentences.map((text, i) => {
    const concepts = extractCoverageConcepts(text, { research, yearSeen, versionSeen, dateSeen, entitySeen, conceptSeen }).map((c, k) => ({
      ...c,
      id: `s${i}.c${k}`,
      sentence: i,
      slug: slug(c.label),
      priority: c.kind === "person" || c.kind === "place" || c.kind === "event" || c.kind === "document" ? 3 : c.kind === "year" || c.kind === "number" || c.kind === "position" ? 2 : 1,
      subject_name: c.subject_name || (/^(?:state|event|relation)$/.test(c.kind) && primaryPerson ? primaryPerson : null),
    }));
    // A repeated place/organisation/object is not new information when the
    // sentence also names a new person, event or relation. Keeping it made
    // "What did Guy Fawkes see in York?" resolve to the York photo again.
    const fresh = concepts.filter((c) => !c.repeat);
    if (fresh.length) {
      for (const c of concepts) {
        if (!c.repeat) continue;
        if (c.kind === "person") continue; // a person can be the subject of a new claim
        if (["place", "organization", "object", "technology", "event", "relation", "position", "number", "date", "version"].includes(c.kind)) c.essential = false;
      }
    } else if (concepts.length) {
      // Nothing new in the sentence: keep one concept, marked as a revisit so
      // the timeline has to compose it differently (a detail, a diagram, or a
      // second image of the same subject) rather than repeat the last shot.
      concepts[0].revisit = true;
      for (const c of concepts.slice(1)) c.essential = false;
    }
    return { index: i, text, start: spans[i].start, end: spans[i].end, concepts };
  });

  const beats = [];
  for (const sp of sentencePlans) {
    const duration = sp.end - sp.start;
    const essential = sp.concepts.filter((c) => c.essential !== false);
    // 0.9 s is the shortest a beat can be read on a phone; if the sentence is
    // shorter than that per idea, the groups are merged instead of skipped.
    const byDuration = Math.max(1, Math.floor(duration / 0.9));
    const target = Math.min(byDuration, beatTarget(essential.length || 1));
    const groups = groupConcepts(essential.length ? essential : sp.concepts.slice(0, 1), target);
    const timed = timeGroups(groups, sp.text, { start: sp.start, end: sp.end }, wordsForSentence(words, sp.index), 0.9);
    timed.forEach((t, k) => {
      const covers = t.group.map((c) => c.id);
      const first = t.group[0];
      beats.push({
        id: `b${sp.index}.${k}`,
        sentence: sp.index,
        start: Number(t.start.toFixed(3)),
        end: Number(t.end.toFixed(3)),
        covers,
        labels: t.group.map((c) => c.label),
        concepts: t.group,
        visual_class: first.visual,
        revisit: t.group.some((c) => c.revisit),
        motion: defaultMotion(first, k, t.end - t.start),
      });
    });
  }
  // No holes: if a sentence produced no beat (duration too short), give it one over its whole span.
  for (const sp of sentencePlans) {
    if (beats.some((b) => b.sentence === sp.index)) continue;
    const c = sp.concepts[0] || { id: `s${sp.index}.empty`, label: sp.text.slice(0, 48), visual: "diagram", kind: "subject", diagram: "label" };
    beats.push({ id: `b${sp.index}.0`, sentence: sp.index, start: sp.start, end: sp.end, covers: [c.id], labels: [c.label], concepts: [c], visual_class: c.visual, revisit: false, motion: defaultMotion(c, 0, sp.end - sp.start) });
  }
  beats.sort((a, b) => a.start - b.start);
  const covered = new Set(beats.flatMap((b) => b.covers));
  const conceptById = new Map(sentencePlans.flatMap((s) => s.concepts.map((c) => [c.id, c])));
  const uncovered = [...conceptById.values()].filter((c) => c.essential !== false && !covered.has(c.id));
  return {
    version: 1,
    sentences: sentencePlans,
    beats,
    concepts: [...conceptById.values()],
    report: {
      sentence_count: sentences.length,
      concept_count: conceptById.size,
      beat_count: beats.length,
      beats_per_sentence: sentencePlans.map((s) => ({ sentence: s.index, concepts: s.concepts.filter((c) => c.essential !== false).length, beats: beats.filter((b) => b.sentence === s.index).length })),
      uncovered: uncovered.map((c) => ({ id: c.id, label: c.label, sentence: c.sentence })),
      timing: exact ? "voiceover" : "proportional",
    },
  };
}

export function defaultMotion(concept, index, duration) {
  const span = Math.max(1, duration);
  const half = Math.max(6, Math.round(span * 15));
  if (concept.visual === "historical") return { type: index % 2 ? "push_out" : "push_in", direction: index % 2 ? "out" : "in", reason: "slow move on a historical depiction so the face and its label stay readable", start_f: 0, end_f: half };
  if (concept.visual === "document") return { type: "settle", direction: "none", reason: "settle on the document so its heading can be read on a phone", start_f: 0, end_f: Math.min(half, 24) };
  if (concept.visual === "diagram" || concept.visual === "annotated" || concept.visual === "figure") return { type: "draw", direction: "none", reason: "draw the diagram in the order the sentence explains it", start_f: 0, end_f: Math.min(half, 36) };
  if (concept.visual === "place") return { type: "pan_left", direction: "left", reason: "pan across the place as the narration names it", start_f: 0, end_f: half };
  return { type: index % 2 ? "push_in" : "settle", direction: index % 2 ? "in" : "none", reason: "hold the viewer on the subject the sentence names", start_f: 0, end_f: half };
}
