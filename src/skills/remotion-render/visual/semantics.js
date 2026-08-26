/**
 * Deterministic semantic analysis of an authored beat.
 *
 * PURE module. No model call, ever (PART 24). Everything here is regex,
 * arithmetic and lookup over text the pipeline already has.
 *
 * HOW THIS DIFFERS FROM classifyBeat() (compositions/beats.js)
 *
 * classifyBeat is a 7-word-fragment archetype guesser: it reads a caption
 * chunk with no context and picks a card type. PART 13 keeps it as an
 * emergency fallback and nothing more. This module runs over an AUTHORED
 * beat — the writer's own full sentence for one visual idea, plus its
 * anchor token and its gate-checked `data` — and asks a different question:
 * not "which card?" but "what is being described, and what would the
 * viewer need to SEE to understand it?".
 *
 * The gap is real and measurable. Given
 *   "used a geofence to scan a"                        <- classifyBeat's input
 * there is nothing to work with. Given
 *   "Police used a geofence warrant to scan a 150 meter
 *    radius for anyone's phone near a crime"           <- this module's input
 *   anchor_token: "150 meter", data: {unit: "meters", series: [{value: 150}]}
 * the spatial reading is unambiguous.
 *
 * Every signal below returns a `confidence` so the director can rank
 * competing readings rather than taking whichever regex happened to run
 * first — the ordering bug that made the old priority chain arbitrary.
 */

const lc = (s) => String(s || "").toLowerCase();

// ─────────────────────────────────────────────────────────────────────────────
// Numbers and units
// ─────────────────────────────────────────────────────────────────────────────

const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100, thousand: 1000, million: 1e6, billion: 1e9,
};

const UNIT_KINDS = {
  distance: /\b(met(?:er|re)s?|m|km|kilomet(?:er|re)s?|mile|miles|feet|foot|ft|yard|yards|block|blocks|radius|radii)\b/i,
  money: /(\$|£|€|\bdollars?\b|\bpounds?\b|\beuros?\b|\bcents?\b|\busd\b|\bgbp\b)/i,
  duration: /\b(seconds?|minutes?|hours?|days?|weeks?|months?|years?|decades?|centuries|century)\b/i,
  percent: /(%|\bpercent\b|\bper cent\b|\bpercentage points?\b)/i,
  people: /\b(people|persons?|residents?|citizens?|customers?|users?|accounts?|employees?|workers?|victims?|suspects?)\b/i,
  count: /\b(times?|cases?|items?|purchases?|transactions?|votes?|stages?|steps?|phases?|devices?|phones?)\b/i,
};

/** Classify a unit string / surrounding text into a broad unit kind. */
export function unitKind(unitOrText) {
  const s = String(unitOrText || "");
  for (const [kind, re] of Object.entries(UNIT_KINDS)) {
    if (re.test(s)) return kind;
  }
  return null;
}

/**
 * Every number in the text, digits or words, with the unit token that
 * follows it. Order-preserving — "from 10,000 to 18,000" keeps its
 * direction, which TRANSFORMATION depends on.
 */
export function extractNumbers(text) {
  const out = [];
  const s = String(text || "");

  const digitRe = /(\$|£|€)?\s?(\d[\d,]*(?:\.\d+)?)\s*(%|percent|million|billion|thousand|k\b|met(?:er|re)s?\b|m\b|km\b|kilomet(?:er|re)s?\b|miles?\b|feet\b|ft\b|dollars?\b|pounds?\b|euros?\b|years?\b|months?\b|weeks?\b|days?\b|hours?\b|people\b|accounts?\b|votes?\b|stages?\b|steps?\b|times?\b)?/gi;
  let m;
  while ((m = digitRe.exec(s)) !== null) {
    if (!m[2]) continue;
    let value = parseFloat(m[2].replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    const suffix = lc(m[3] || "");
    if (/^million$/.test(suffix)) value *= 1e6;
    else if (/^billion$/.test(suffix)) value *= 1e9;
    else if (/^(thousand|k)$/.test(suffix)) value *= 1e3;
    const symbol = m[1] || "";
    out.push({
      value,
      raw: m[0].trim(),
      unit: symbol || m[3] || "",
      index: m.index,
      kind: unitKind(symbol + " " + (m[3] || "")) || null,
    });
  }

  // Word numerals, COMPOSED across adjacent words.
  //
  // Reading each word independently was a real defect caught on a rendered
  // frame: "five hundred dollars" produced 5 and 100, and the accumulation
  // scene counted toward 100. Scripts in this pipeline spell numbers out
  // precisely because they are written to be spoken, so the composed form
  // is the normal case, not an edge case.
  //   "five hundred"            -> 500
  //   "eight hundred and forty" -> 840
  //   "twenty"                  -> 20
  const words = [...s.matchAll(/\b[\w'-]+\b/g)];
  let i = 0;
  while (i < words.length) {
    const w = lc(words[i][0]);
    if (WORD_NUMBERS[w] === undefined) {
      i += 1;
      continue;
    }
    const startIdx = words[i].index;
    let total = 0;
    let current = 0;
    let j = i;
    let consumedEnd = startIdx + words[i][0].length;
    while (j < words.length) {
      const token = lc(words[j][0]);
      if (token === "and" && current > 0) {
        j += 1;
        continue; // "eight hundred AND forty"
      }
      const val = WORD_NUMBERS[token];
      if (val === undefined) break;
      if (val === 100) {
        current = Math.max(current, 1) * 100;
      } else if (val >= 1000) {
        total += Math.max(current, 1) * val;
        current = 0;
      } else {
        current += val;
      }
      consumedEnd = words[j].index + words[j][0].length;
      j += 1;
    }
    const value = total + current;
    // Skip if a digit-form number already covers this span.
    if (value > 0 && !out.some((n) => Math.abs(n.index - startIdx) < 4)) {
      const after = s.slice(consumedEnd, consumedEnd + 26);
      out.push({
        value,
        raw: s.slice(startIdx, consumedEnd),
        unit: "",
        index: startIdx,
        kind: unitKind(after) || null,
      });
    }
    i = Math.max(j, i + 1);
  }

  return out.sort((a, b) => a.index - b.index);
}

/** Series values off the gate-checked authored `data` block, if present. */
export function seriesFrom(beat) {
  const series = beat && beat.data && Array.isArray(beat.data.series) ? beat.data.series : [];
  return series
    .filter((p) => p && Number.isFinite(Number(p.value)))
    .map((p) => ({ label: String(p.label || ""), value: Number(p.value), highlight: !!p.highlight }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Concept signals. Each returns null or {confidence, ...payload}.
// Confidence is a rough 0-1 ranking device, not a probability.
// ─────────────────────────────────────────────────────────────────────────────

const SPATIAL_STRONG = /\b(geofence|geo-fence|radius|perimeter|boundary|within .{0,12}(met(?:er|re)|mile|km|foot|feet|block)|square (?:mile|kilomet)|coordinates|latitude|longitude|airspace|territorial waters)\b/i;
const SPATIAL_WEAK = /\b(map|maps|area|zone|region|border|borders|district|neighbou?rhood|city block|surrounding|nearby|proximity|location|located|distance|across the (?:city|country|border)|terrain)\b/i;
const SUBJECTS_IN_AREA = /\b(phones?|devices?|handsets?|people|residents?|anyone|everyone|homes?|houses?|buildings?|vehicles?|cars?|accounts?|signals?)\b/i;

/** GEOSPATIAL: a distance/boundary over real ground. */
export function detectGeospatial(text, numbers) {
  const t = lc(text);
  const strong = SPATIAL_STRONG.test(t);
  const weak = SPATIAL_WEAK.test(t);
  if (!strong && !weak) return null;

  const distance = numbers.find((n) => n.kind === "distance");
  // A boundary needs a measurable extent to draw. Without one there is no
  // radius to expand — the director records this as a real reason, not a
  // silent downgrade.
  if (!distance) {
    return { confidence: strong ? 0.45 : 0.2, missing: "no distance value to draw a boundary with" };
  }
  // What is caught inside the boundary. Prefer a concrete noun (phones,
  // vehicles, homes) over an indefinite one: "for anyone's phone" matches
  // "anyone" first by position, but "phone" is the thing to draw.
  const CONCRETE = /\b(phones?|devices?|handsets?|vehicles?|cars?|homes?|houses?|buildings?|accounts?|signals?)\b/i;
  const concrete = CONCRETE.exec(t);
  const generic = SUBJECTS_IN_AREA.exec(t);

  return {
    confidence: strong ? 0.96 : 0.62,
    value: distance.value,
    unit: distance.unit || "m",
    subjects: concrete ? concrete[0] : generic ? generic[0] : null,
  };
}

const ACCUM_VERB = /\b(add(?:s|ed)? up|adds up to|became|becomes|turned into|total(?:l?ed|s)?|amount(?:s|ed)? to|piled? up|accumulat\w+|stack(?:s|ed)? up|come out to|ends? up|snowball\w*)\b/i;
const ACCUM_MANY = /\b(each|every|small|little|tiny|handful|dozens?|hundreds?|thousands?|repeated|daily|weekly|monthly|one by one|bit by bit)\b/i;

/** ACCUMULATION: many small things becoming one consequential total. */
export function detectAccumulation(text, numbers) {
  const t = lc(text);
  const verb = ACCUM_VERB.test(t);
  const many = ACCUM_MANY.test(t);
  if (!verb && !many) return null;

  // Prefer a count->total reading: "Twenty small purchases became $500".
  const money = numbers.filter((n) => n.kind === "money");
  const counts = numbers.filter((n) => n.kind !== "money");
  const total = money.length ? money[money.length - 1] : numbers[numbers.length - 1];
  if (!total) return { confidence: verb ? 0.35 : 0.15, missing: "no total value to accumulate toward" };

  // A COUNT has to be a real plurality that was actually stated. "Each one
  // felt too small" contains the numeral "one" used as a pronoun, and an
  // earlier `Math.max(2, ...)` floor silently promoted it to "2", so a
  // $500 total rendered as two purchase cards — a picture that states a
  // fact the script never did. A candidate now has to be >= 2 on its own
  // merits; when nothing qualifies the scene shows an unlabelled quantity
  // instead of inventing a number (see supporting.countKnown).
  const candidate = counts.find((n) => n.index < total.index && n.value >= 2 && n.value <= 200);
  return {
    confidence: verb && many ? 0.94 : verb ? 0.84 : 0.42,
    total: total.value,
    totalUnit: total.unit || "",
    count: candidate ? Math.round(candidate.value) : null,
  };
}

const FROM_TO = /\bfrom\s+(\$|£|€)?\s?([\d,]+(?:\.\d+)?)\s*([a-z%]*)\s+to\s+(\$|£|€)?\s?([\d,]+(?:\.\d+)?)/i;
const GROWTH_VERB = /\b(grew|grow|grows|growing|increas\w+|ros[e]|rise|rises|rising|climb\w*|doubl\w+|tripl\w+|surg\w+|jump\w+|fell|fall\w*|drop\w+|declin\w+|shrank|shrink\w*|compound\w*)\b/i;

/** TRANSFORMATION: a value becoming another value, with a mechanism. */
export function detectTransformation(text, numbers, series) {
  const t = lc(text);
  const m = FROM_TO.exec(t);
  if (m) {
    const from = parseFloat(m[2].replace(/,/g, ""));
    const to = parseFloat(m[5].replace(/,/g, ""));
    if (Number.isFinite(from) && Number.isFinite(to) && from !== to) {
      return { confidence: 0.95, from, to, unit: m[1] || m[4] || m[3] || "" };
    }
  }
  // Two real series points also describe a move.
  if (series.length === 2 && series[0].value !== series[1].value && GROWTH_VERB.test(t)) {
    return { confidence: 0.78, from: series[0].value, to: series[1].value, unit: "", labels: series.map((s) => s.label) };
  }
  if (GROWTH_VERB.test(t) && numbers.length >= 2) {
    const [a, b] = numbers;
    if (a.value !== b.value) return { confidence: 0.6, from: a.value, to: b.value, unit: a.unit || b.unit || "" };
  }
  if (GROWTH_VERB.test(t)) return { confidence: 0.3, missing: "growth described but no start/end values to move between" };
  return null;
}

const STAGE_WORDS = /\b(stages?|steps?|phases?|rounds?|tiers?|levels?|gates?)\b/i;
const SEQUENCE_MARKERS = /\b(first|second|third|then|next|after that|finally|before it|once it|passes? through|goes? through|routed? through|moves? through|sent to)\b/i;
const PROCESS_NOUN = /\b(process(?:es|ed|ing)?|pipeline|workflow|procedure|assembly|production line|review|approval|application|request|submission)\b/i;

/** PROCESS: an ordered set of stages something moves through. */
export function detectProcess(text, numbers) {
  const t = lc(text);
  const hasStageWord = STAGE_WORDS.test(t);
  const hasSeq = SEQUENCE_MARKERS.test(t);
  const hasNoun = PROCESS_NOUN.test(t);
  if (!hasStageWord && !(hasSeq && hasNoun)) return null;

  // "three stages" gives a real stage count.
  let count = null;
  const nearStage = numbers.find((n) => {
    const after = t.slice(n.index, n.index + 40);
    return STAGE_WORDS.test(after);
  });
  if (nearStage) count = Math.round(nearStage.value);
  if (!count) {
    const ordinals = (t.match(/\b(first|second|third|fourth|fifth)\b/g) || []).length;
    if (ordinals >= 2) count = Math.max(ordinals, 3);
  }
  if (!count || count < 2 || count > 8) {
    if (!hasStageWord) return null;
    count = 3; // a named-but-uncounted process still has stages to draw
  }
  return { confidence: hasStageWord && count ? 0.9 : 0.55, stages: count, noun: hasNoun };
}

const YEAR_RE = /\b(1[6-9]\d{2}|20\d{2})\b/g;
const TEMPORAL = /\b(in \d{4}|since|until|by \d{4}|before|after|later|earlier|era|decade|century|history|historic|originally|then in|that year|years? later|ago)\b/i;

/** TIMELINE: events placed on a real time axis. */
export function detectTimeline(text) {
  const t = lc(text);
  const years = [...String(text).matchAll(YEAR_RE)].map((m) => parseInt(m[1], 10));
  const uniqueYears = [...new Set(years)];
  if (uniqueYears.length >= 2) {
    return { confidence: 0.93, years: uniqueYears.sort((a, b) => a - b) };
  }
  if (uniqueYears.length === 1 && TEMPORAL.test(t)) {
    return { confidence: 0.72, years: uniqueYears, single: true };
  }
  if (uniqueYears.length === 1) return { confidence: 0.55, years: uniqueYears, single: true };
  if (/\b(timeline|chronolog\w+|sequence of events)\b/i.test(t)) {
    return { confidence: 0.5, years: [], missing: "no dates to place on an axis" };
  }
  return null;
}

// Causal markers point in one of two directions, and getting this wrong
// draws the arrow backwards. Caught on a rendered frame: "Throughput
// collapsed BECAUSE the second stage was holding" rendered
// collapse -> holding, i.e. the outcome causing its own cause.
//
//   FORWARD:  <cause> MARKER <effect>   "X led to Y"
//   BACKWARD: <effect> MARKER <cause>   "Y because X"
const CAUSAL_FORWARD = /\b(as a result|results? in|resulting in|leads? to|led to|causes?|triggers?|forces?|means that|so that|therefore|which is why|that's why|makes? it)\b/i;
const CAUSAL_BACKWARD = /\b(because|because of|since|due to|thanks to|caused by|driven by|owing to|as a consequence of)\b/i;

/** CAUSE_EFFECT: one thing driving another, in the right direction. */
export function detectCauseEffect(text) {
  const s = String(text);
  const fwd = CAUSAL_FORWARD.exec(s);
  const bwd = CAUSAL_BACKWARD.exec(s);
  // Whichever marker appears first governs the sentence.
  const useBackward = bwd && (!fwd || bwd.index < fwd.index);
  const m = useBackward ? bwd : fwd;
  if (!m) return null;

  const before = s.slice(0, m.index).trim();
  const after = s.slice(m.index + m[0].length).trim();
  if (!before || !after) {
    return { confidence: 0.4, missing: "causal marker with nothing on one side of it" };
  }
  return {
    confidence: 0.86,
    marker: m[0],
    cause: useBackward ? after : before,
    effect: useBackward ? before : after,
    direction: useBackward ? "backward" : "forward",
  };
}

const COMPARE = /\b(versus|vs\.?|compared (?:to|with)|more than|less than|fewer than|twice|three times|half|double|outnumber\w*|whereas|while|but only|against)\b/i;

/**
 * Two SIDES in opposition, with no numbers attached — "the government
 * argued X, but the court disagreed". This is still a comparison (X set
 * against Y), it just resolves to opposing positions rather than opposing
 * magnitudes; ComparisonScene renders both, which is one concept in two
 * registers, not two strategies wearing one name.
 */
// Ordered by strength, and searched in that order — NOT as one alternation.
// A single regex returns the LEFTMOST match, which on a real script split
// "The government argued that X, but Justice Kagan disagreed" at "argued
// that" (a framing verb) instead of at "but" (the actual opposition),
// producing a one-word left panel and a right panel containing both sides.
// Reporting verbs are deliberately absent: "argued that" introduces a
// position, it does not oppose one.
const OPPOSE_TIERS = [
  /\b(but|however|instead|rather than|on the other hand|whereas|yet)\b/i,
  /\b(disagreed|rejected|overruled|denied|struck down|countered|refused|reversed)\b/i,
  /\b(contrary to|opposed|in contrast)\b/i,
];

function sidesFrom(text) {
  const s = String(text);
  for (const re of OPPOSE_TIERS) {
    const m = re.exec(s);
    if (!m) continue;
    const left = s.slice(0, m.index).trim();
    const right = s.slice(m.index + m[0].length).trim();
    // Both sides must carry real content; a pivot at the very start or end
    // of the span means the opposition's other half is in another beat.
    if (left.split(/\s+/).length < 3 || right.split(/\s+/).length < 3) continue;
    return { left, right, pivot: m[0] };
  }
  return null;
}

/** COMPARISON: two quantities — or two positions — set against each other. */
export function detectComparison(text, numbers, series) {
  const t = lc(text);
  if (series.length >= 2) {
    return { confidence: COMPARE.test(t) ? 0.9 : 0.66, pairs: series.slice(0, 5) };
  }
  if (numbers.length >= 2 && COMPARE.test(t)) {
    return {
      confidence: 0.8,
      pairs: numbers.slice(0, 2).map((n) => ({ label: "", value: n.value, unit: n.unit })),
    };
  }
  const sides = sidesFrom(text);
  if (sides) {
    return { confidence: 0.68, qualitative: true, ...sides };
  }
  if (COMPARE.test(t)) return { confidence: 0.36, missing: "comparison language but only one quantity" };
  return null;
}

const BEFORE_AFTER = /\b(used to|no longer|previously|until now|before .{0,24}(now|today)|these days|nowadays|(?:^|\W)now\b.{0,40}\b(?:instead|rather)|once was|has since|changed from)\b/i;

/** BEFORE_AFTER: the same subject under two conditions. */
export function detectBeforeAfter(text) {
  const t = lc(text);
  if (!BEFORE_AFTER.test(t)) return null;
  return { confidence: 0.74 };
}

const DOCUMENT = /\b(law|laws|statute|statutory|clause|section \d|subsection|act\b|bill\b|ruling|ruled|court|judge|justice|opinion|amendment|constitution|contract|lease|agreement|policy|regulation|filing|affidavit|warrant|records?|archive|document|paperwork|terms of service|fine print)\b/i;

/** DOCUMENT_EVIDENCE: the actual text of a rule or record. */
export function detectDocument(text) {
  const t = lc(text);
  const hits = (t.match(DOCUMENT) || []).length;
  if (!hits) return null;
  return { confidence: /\b(clause|section \d|subsection|statute|fine print|terms of service|amendment)\b/i.test(t) ? 0.82 : 0.58 };
}

const INTERFACE = /\b(app|apps|software|platform|dashboard|screen|interface|website|browser|search|query|algorithm|system|server|database|api|model|prompt|click|tap|swipe|upload|download|login|account settings|notification)\b/i;

/** INTERFACE_SIMULATION: a system's own screen doing the thing. */
export function detectInterface(text) {
  const t = lc(text);
  if (!INTERFACE.test(t)) return null;
  const strong = /\b(dashboard|interface|screen|app|software|algorithm|platform|api|database|search|query)\b/i.test(t);
  return { confidence: strong ? 0.7 : 0.44 };
}

const ENTITY = /\b(between|among|and the|both|parties|sides|each other|relationship|network|linked|connected|ties|partners?|rivals?|allies)\b/i;

/** RELATIONSHIP: several entities and their connections. */
export function detectRelationship(text) {
  const t = lc(text);
  if (!ENTITY.test(t)) return null;
  return { confidence: /\b(network|relationship|linked|connected|parties|allies|rivals)\b/i.test(t) ? 0.66 : 0.4 };
}

const ABSTRACT = /\b(trust|fear|freedom|power|risk|pressure|control|privacy|dignity|justice|hope|momentum|burden|weight of|trap|trapped|invisible|silent|hidden)\b/i;

/** VISUAL_METAPHOR: an abstract idea that needs physical behaviour. */
export function detectMetaphor(text) {
  const t = lc(text);
  const m = ABSTRACT.exec(t);
  if (!m) return null;
  return { confidence: 0.5, notion: m[0] };
}

/**
 * Run every detector once. The director ranks these; nothing here decides.
 * Returning the full set (not the first hit) is the fix for the old
 * priority-chain ordering bug, where whichever regex ran first won
 * regardless of how weak its evidence was.
 */
export function analyzeBeat(beat, opts = {}) {
  const text = String((beat && beat.text) || "");
  const anchor = String((beat && beat.anchor_token) || (beat && beat.anchorToken) || "");
  // The writer's own short on-screen label ("150 meters", "6-3 Decision")
  // carries the subject even when the spoken span in this window doesn't.
  const authoredLabel = String((beat && beat.authoredText) || "");
  // `context` is the surrounding section narration. It matters for beats
  // that came from the fragment classifier rather than an authored beat:
  // a ~7-word chunk like "used a geofence to scan a" has no readable
  // signal on its own, but its section plainly does. Callers pass it, the
  // director penalizes anything only visible here (see director.js), so a
  // beat with its own evidence always outranks a section-wide reading.
  const context = String(opts.context || "");

  // The anchor names what the beat is ABOUT; appending it lets a signal
  // that only appears in the anchor ("150 meter") still be seen.
  const parts = [text];
  if (anchor && !lc(text).includes(lc(anchor))) parts.push(anchor);
  if (authoredLabel && !lc(text).includes(lc(authoredLabel))) parts.push(authoredLabel);
  const haystack = parts.join(" ");

  const numbers = extractNumbers(haystack);
  const series = seriesFrom(beat);

  // An authored data.series carries gate-checked values the prose may not
  // spell out; fold its numbers in so detectors can use them.
  const numbersWithSeries = numbers.length
    ? numbers
    : series.map((s, i) => ({ value: s.value, raw: String(s.value), unit: (beat.data && beat.data.unit) || "", index: i, kind: unitKind((beat.data && beat.data.unit) || "") }));

  return {
    text,
    anchor,
    authoredLabel,
    context,
    numbers: numbersWithSeries,
    series,
    // Signals read from the beat's own words + authored fields. Trusted.
    signals: {
      GEOSPATIAL_RADIUS: detectGeospatial(haystack, numbersWithSeries),
      ACCUMULATION: detectAccumulation(haystack, numbersWithSeries),
      TRANSFORMATION: detectTransformation(haystack, numbersWithSeries, series),
      PROCESS: detectProcess(haystack, numbersWithSeries),
      TIMELINE: detectTimeline(haystack),
      COMPARISON: detectComparison(haystack, numbersWithSeries, series),
      CAUSE_EFFECT: detectCauseEffect(haystack),
      BEFORE_AFTER: detectBeforeAfter(haystack),
      DOCUMENT_EVIDENCE: detectDocument(haystack),
      INTERFACE_SIMULATION: detectInterface(haystack),
      RELATIONSHIP: detectRelationship(haystack),
      VISUAL_METAPHOR: detectMetaphor(haystack),
    },
    // The same detectors over beat + surrounding narration. Strictly
    // weaker evidence — a signal here might belong to a neighbouring
    // sentence — so the director only consults these when the beat's own
    // signals produced nothing renderable, and discounts them when it does.
    contextSignals: context
      ? (() => {
          const both = `${haystack} ${context}`;
          const ctxNumbers = extractNumbers(both);
          return {
            GEOSPATIAL_RADIUS: detectGeospatial(both, ctxNumbers),
            ACCUMULATION: detectAccumulation(both, ctxNumbers),
            TRANSFORMATION: detectTransformation(both, ctxNumbers, series),
            PROCESS: detectProcess(both, ctxNumbers),
            TIMELINE: detectTimeline(both),
            COMPARISON: detectComparison(both, ctxNumbers, series),
            CAUSE_EFFECT: detectCauseEffect(both),
            BEFORE_AFTER: detectBeforeAfter(both),
            DOCUMENT_EVIDENCE: detectDocument(both),
            INTERFACE_SIMULATION: detectInterface(both),
            RELATIONSHIP: detectRelationship(both),
            VISUAL_METAPHOR: detectMetaphor(both),
          };
        })()
      : null,
  };
}
