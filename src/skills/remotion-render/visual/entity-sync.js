/**
 * Word-level sync for entity visuals (owner's spec 2026-10-03): a beat's
 * portrait, full-bleed photo, hero cutout or hero number pops on the WORD
 * that names it, not at the beat's start. Measured before this existed (CI
 * run 37082751699 ch-9 beat 1): Ilham Aliyev's portrait was fully in at
 * +0.4 s, the narrator said "Aliyev" at +1.8 s.
 *
 *   entityAnchor(canvas)                        -> { kind, entity, words: [candidates] } | null
 *   scheduleEntityPop(canvas, spoken, durFrames) -> { kind, entity, word, from, to, frame } (frames, beat-relative)
 *                                                 | { kind, entity, missing: "<word>" } | null
 *
 * `spoken` is the beat's voiceover words with their real timings (render.js:
 * Edge TTS WordBoundary -> { text, from, to } in frames from the beat start).
 *
 * The anchor: the planner's entity_anchor_word when it is part of what the
 * visual SHOWS (a portrait of "Ilham Aliyev": "Aliyev"); otherwise the shown
 * entity's own words, last word first ("Aliyev" before "Ilham", "key" before
 * "door"); a number's digits ("$387.5" matches the spoken "$387.5").
 *
 * The schedule (the pop takes POP_IN = 6 frames, full-canvas.jsx POP.IN):
 *   - the pop starts 6 frames before the word starts, so the element is fully
 *     in as the word begins and certainly before it ends;
 *   - a word in the beat's last 0.5 s pops 8 frames earlier still;
 *   - never before frame 0, never later than 0.5 s before the beat's end
 *     (the element always gets screen time; it is never pushed past the beat).
 * The first occurrence of the word is used. Pure — no I/O.
 */
export const POP_IN = 6;

const PHOTO_COMPS = ["SCENE-FULL", "ARCHITECTURE", "DOCUMENT", "MONEY", "PORTRAIT"];
const SMALL = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];

/** A spoken / written word, compared case-free: possessive and punctuation dropped. */
export const normWord = (w) => String(w || "").toLowerCase().replace(/['’]s$/, "").replace(/[^\p{L}\p{N}]/gu, "");
/** A figure's digits ("$387.5 million" -> "3875"), or null. */
export const digitsOf = (w) => { const m = String(w || "").match(/\d[\d.,]*/); return m ? m[0].replace(/[.,]+$/, "").replace(/[.,]/g, "") : null; };

const STOP = new Set(["the", "of", "and", "a", "an", "inc", "llc", "ltd", "co", "corp", "for", "de"]);
const wordsOf = (s) => String(s || "").split(/[\s\-–—/]+/).map((w) => normWord(w)).filter((w) => w && !STOP.has(w));

export function entityAnchor(c) {
  if (!c) return null;
  const comp = c.composition;
  const planned = c.anchor_word ? normWord(c.anchor_word) : null;
  const pick = (kind, entity, own) => {
    const words = [];
    if (planned && own.includes(planned)) words.push(planned);
    for (const w of [...own].reverse()) if (!words.includes(w)) words.push(w);
    return words.length ? { kind, entity, words } : null;
  };
  if (c.photo && PHOTO_COMPS.includes(comp)) {
    const entity = c.photo.entity || c.data?.entity || c.data?.name || c.data?.object || "";
    if (comp === "MONEY" && c.data?.value && digitsOf(c.data.value)) return { kind: "photo", entity: String(c.data.value), words: [`#${digitsOf(c.data.value)}`] };
    return pick(comp === "PORTRAIT" ? "portrait" : "photo", entity, wordsOf(entity));
  }
  const cut = (c.concept_visuals || []).find((v) => v && v.class === "cutout");
  if (cut && ["TYPE-FULL", "TYPE-SPLIT"].includes(comp)) return pick("cutout", cut.name, wordsOf(String(cut.name).replace(/-/g, " ")));
  if (comp === "NUMBER-FULL" && c.data?.value && digitsOf(c.data.value)) {
    const d = digitsOf(c.data.value);
    const words = [`#${d}`];
    if (Number(d) <= 20 && SMALL[Number(d)]) words.push(SMALL[Number(d)]);
    return { kind: "number", entity: String(c.data.value), words };
  }
  return null;
}

// Spelled numbers: the voiceover says "two hundred" for "200+" (CI run 37100587452 ch-9 beat 3).
const UNITS = Object.fromEntries(SMALL.map((w, i) => [w, i]));
const TENS = { thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 };
/** Each spoken word gets the value of the spelled number run STARTING at it ("two hundred" -> 200 on "two"). */
function spelledValues(said) {
  return said.map((_, i) => {
    // "two point seven" -> "2" + "7": the digits are compared without the decimal point
    // (digitsOf("$2.7 million") is "27"), so the decimals are appended as digits.
    let total = 0, cur = 0, n = 0, dec = null;
    for (let k = i; k < said.length; k++) {
      const parts = said[k].n ? String(said[k].text).toLowerCase().replace(/[^a-z-]/g, "").split("-").filter(Boolean) : [];
      if (!parts.length || !parts.every((p) => p in UNITS || p in TENS || p in SCALES || p === "and" || p === "point")) break;
      if (k === i && parts[0] === "point") break;
      for (const p of parts) {
        if (p === "point") { dec = ""; continue; }
        if (dec !== null) { if (p in UNITS && UNITS[p] < 10) dec += String(UNITS[p]); continue; }
        if (p in UNITS) cur += UNITS[p]; else if (p in TENS) cur += TENS[p];
        else if (p === "hundred") cur = (cur || 1) * 100; else if (p in SCALES) { total += (cur || 1) * SCALES[p]; cur = 0; }
      }
      n++;
    }
    if (!n || (n === 1 && said[i].n === "and")) return null;
    return dec ? `${total + cur}${dec}` : String(total + cur);
  });
}

/** The pop frame for the beat's entity visual, from the spoken words' timings. */
export function scheduleEntityPop(c, spoken, dur) {
  const a = entityAnchor(c);
  if (!a) return null;
  const said = (Array.isArray(spoken) ? spoken : []).map((w) => ({ ...w, n: normWord(w.text), d: digitsOf(w.text) }));
  const spelled = spelledValues(said);
  said.forEach((w, i) => { if (!w.d && spelled[i]) w.d = spelled[i]; });
  let hit = null, word = null;
  for (const cand of a.words) {
    const m = cand.startsWith("#") ? said.find((w) => w.d === cand.slice(1)) : said.find((w) => w.n === cand);
    if (m) { hit = m; word = cand.replace(/^#/, ""); break; }
  }
  if (!hit) return { kind: a.kind, entity: a.entity, missing: a.words[0].replace(/^#/, "") };
  const late = dur - hit.from < 15;                                     // the word is in the beat's last 0.5 s
  let frame = hit.from - POP_IN - (late ? 8 : 0);
  frame = Math.max(0, Math.min(frame, dur - 15));
  return { kind: a.kind, entity: a.entity, word: hit.text, anchor: word, from: hit.from, to: hit.to, frame };
}
