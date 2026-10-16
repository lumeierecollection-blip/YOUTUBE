/**
 * clone-plan — stage a video's beats the way the reference videos are staged. PURE (no React, no I/O): unit-tested, and the cadence it plans is
 * checked again on the rendered pixels (scripts/gate-clone-cadence.mjs).
 *
 * WHAT IS CLONED IS THE LAWS, NOT THE FRAMES (owner, 2026-10-15). config/clone-grammar.json holds the laws MEASURED from the reference videos
 * (scripts/derive-clone-grammar.mjs): how often something new appears, the longest wait, how long a shot lasts. This module turns a beat
 * (a sentence, its spoken words and timings, the assets the pipeline already sourced and verified) into SHOTS that obey them:
 *
 *   - A beat is cut into shots of about `shot_s` seconds, each cut landing on a spoken word's onset (never mid-word).
 *   - A shot is a hero (one of the beat's OWN sourced assets, or nothing), staged as a TREATMENT from the profile (bleed / framed / disc / ...),
 *     with its elements popping one after another at known frames: hero, accent shape, display words (on the word they are), name plate.
 *   - NOTHING IS INVENTED. The hero is an asset the beat already carries; the plate is an entity name the beat names; the display words are words
 *     the narrator speaks (at most three, contiguous); a figure is one the sentence states. An asset is reused in a different treatment and
 *     crop, never fabricated. A beat with no asset gets a type-led shot and the plan REPORTS it (heroShare) instead of hiding it.
 *
 * Where it stops: the planner places elements by rule; whether the photo it was handed is a good one is decided upstream (entity resolution and
 * its gates). It cannot make a sentence with nothing to show show something — it reports it.
 */
import { parseDate } from "./clone-layout.js";

export const FPS = 30;
const STOP = new Set("a an the and or but of to in on at by for with from as is are was were be been it its this that these those he she they we you i his her their our your not no do does did has have had will would can could should may might than then so if into over under about after before while which who whom what when where why how also just only very more most".split(" "));
// Words a display phrase may not START or END on although they are not function words: verbs of being / holding / saying and adverbs that dangle
// ("AIR HELD ALMOST", "CAVE SITS", "SOUTHEASTERN ROMANIA FAR", "DEAL ANIMALS" were real picks). Without a parser this is a list, not a grammar: it stops
// the commonest fragments, it does not guarantee a phrase.
const WEAK = new Set("held sits sit sat said says say made make makes found find finds got get gets had have went go goes came come comes took take takes seemed seem seems became become becomes almost far very quite rather really still even also ever never always often just only nearly mostly already soon later early late deal lot kind sort way thing things something anything great many much some several few little various certain other another such whole each every any".split(" "));
const NUMBER_WORDS = new Set("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion percent dollars dollar twenty-six twenty-five twenty-four twenty-three twenty-two twenty-one first second third fourth fifth".split(" "));
// spoken ordinals ("April sixteenth", "the twenty-first"): the spoken form of a date's day, never display type either
for (const w of "first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth thirteenth fourteenth fifteenth sixteenth seventeenth eighteenth nineteenth twentieth thirtieth fortieth fiftieth".split(" ")) NUMBER_WORDS.add(w);
for (const t of ["twenty", "thirty"]) for (const u of "first second third fourth fifth sixth seventh eighth ninth".split(" ")) NUMBER_WORDS.add(t + "-" + u);
for (const t of ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]) for (const u of "one two three four five six seven eight nine".split(" ")) NUMBER_WORDS.add(t + "-" + u);
const MONTH_WORDS = new Set("january february march april may june july august september october november december".split(" "));
// Contractions and pronoun openers are never display type: board 38831133468 ch-1 showed "IT'S" and "THAT'S" as the shot's big words.
for (const w of "it's that's there's here's what's who's where's i'm you're we're they're he's she's isn't aren't wasn't weren't don't doesn't didn't can't won't wouldn't couldn't shouldn't let's yet still even".split(" ")) STOP.add(w);
const isNumberWord = (w) => /^[\$€£]?\d[\d,.]*(?:%|[kmb]|million|billion|thousand)?$/i.test(w);
const clean = (w) => String(w || "").replace(/^[^\w$€£]+|[^\w%]+$/g, "");

/** The assets a beat's canvas already carries, in the order the beat gives them. { kind, asset, name, w, h, view } — kind is what coverage reads. */
export function heroesOf(canvas) {
  const c = canvas || {};
  const out = [];
  if (c.photo && c.photo.asset) out.push({ kind: c.photo.kind === "person" || c.photo.view === "person" ? "portrait" : "photo", asset: c.photo.asset, name: c.photo.entity || null, w: c.photo.w || null, h: c.photo.h || null, view: c.photo.view || null, credit: c.photo.credit || c.source_credit || null, cutout: c.photo.cutout || null, grounded: !!c.photo.cutout_grounded, bust: !!c.photo.cutout_bust, vignette: !!c.photo.vignette });
  for (const v of c.concept_visuals || []) if (v && v.asset) out.push({ kind: v.logo ? "logo" : v.class === "cutout" ? "cutout" : "symbol", asset: v.asset, name: v.name || null, w: v.w || null, h: v.h || null, view: null, cutout: v.asset });   // a logo / cut-out / symbol asset is already a transparent PNG
  // further verified pictures of the beat's entities (render-and-qa.js [clone-extra]): a logo is a transparent mark; a photo is cut out or soft-edged like the main one
  for (const x of c.clone_extra || []) {
    if (!x || !x.asset || out.some((o) => o.asset === x.asset)) continue;
    if (x.kind === "logo") out.push({ kind: "logo", asset: x.asset, name: x.name || null, w: x.w || null, h: x.h || null, view: null, cutout: x.asset });
    else out.push({ kind: x.kind === "person" ? "portrait" : "photo", asset: x.asset, name: x.name || null, w: x.w || null, h: x.h || null, view: x.view || null, credit: x.credit || null, cutout: x.cutout || null, grounded: !!x.cutout_grounded, bust: !!x.cutout_bust, vignette: !!x.vignette });
  }
  if (c.art && c.art.asset) out.push({ kind: c.art.kind === "plate-organization" ? "logo" : c.art.kind || "art", asset: c.art.asset, name: c.art.name || null, w: null, h: null, view: null });
  if (c.art && Array.isArray(c.art.items)) for (const it of c.art.items) if (it && it.asset) out.push({ kind: "logo", asset: it.asset, name: it.name || null, w: null, h: null, view: null });
  return out;
}

/** Entity names the beat names (what a plate may say). */
export function namesOf(canvas) {
  const c = canvas || {};
  const names = [];
  for (const e of c.named_entities || c.entities || []) if (e && e.name && e.type !== "number" && e.type !== "date") names.push(String(e.name));
  for (const h of heroesOf(c)) if (h.name && !names.includes(String(h.name))) names.push(String(h.name));
  return [...new Set(names)];
}

/** The sentence a picture-less shot quotes on its excerpt card: exactly what the narrator says, never more than ~150 characters (cut at a word). */
export function excerptOf(beat, canvas) {
  const raw = String((beat && (beat.original_text || beat.text)) || (canvas && canvas.sentence) || "").replace(/\s+/g, " ").trim();
  if (raw.length <= 150) return raw;
  const cut = raw.slice(0, 150), at = cut.lastIndexOf(" ");
  return cut.slice(0, at > 80 ? at : 150).replace(/[,;:\s]+$/, "") + "...";
}

/** The beat's named entities WITH their types, minus figures and dates (those are drawn as figures, not as plates): [{ name, type }]. */
export function typedEntitiesOf(canvas) {
  const c = canvas || {};
  const out = [];
  const kind = (t) => (t === "person" ? "person" : /^(place|location|country|city|region|state|county)$/.test(String(t)) ? "place" : "organization");
  for (const e of c.named_entities || c.entities || []) {
    if (!e || !e.name || e.type === "number" || e.type === "date" || e.type === "span") continue;
    if (!out.some((x) => x.name.toLowerCase() === String(e.name).toLowerCase())) out.push({ name: String(e.name), type: kind(e.type) });
  }
  return out;
}

/** A figure as the SENTENCE writes it, unit and all ("30-second", "$1,250", "35%", "5 million euros"): the naming check wants the number "and its unit as the sentence states them". */
export function quantityIn(sentence, name) {
  const digits = String(name || "").replace(/[^\d]/g, "");
  if (!digits || !sentence) return String(name || "");
  const re = /\$?\d[\d,.]*(?:-[A-Za-z]+|%|(?:\s(?:million|billion|thousand|hundred))?(?:\s(?:percent|euros|dollars|pounds|years|days|hours|minutes|seconds|points|people|species))?)/g;
  for (const m of String(sentence).matchAll(re)) {
    if (m[0].replace(/[^\d]/g, "") === digits) return m[0].trim().replace(/[.,]$/, "");
  }
  return String(name || "");
}

/** A figure's label ends on a content word: the planner's "working Americans have an" (board 38831133468 ch-1) is cut to "working Americans". Null when nothing is left. */
export function trimLabel(label) {
  const ws = String(label || "").replace(/\s+/g, " ").trim().split(" ");
  while (ws.length && (STOP.has(clean(ws[ws.length - 1]).toLowerCase()) || WEAK.has(clean(ws[ws.length - 1]).toLowerCase()))) ws.pop();
  while (ws.length && STOP.has(clean(ws[0]).toLowerCase())) ws.shift();
  const out = ws.join(" ").replace(/[,;:]+$/, "");
  return out.length ? out : null;
}

/** The figures and dates a beat states, in order: [{ kind: "figure"|"date", name, label }]. From the canvas's own data and from its named number / date entities. */
export function figuresOf(canvas) {
  const c = canvas || {};
  const out = [];
  const digits = (t) => String(t).replace(/[^\d]/g, "");
  const add = (kind0, name, label = null) => {
    let kind = kind0;
    let n = String(name || "").trim();
    if (!n) return;
    if (kind === "figure" && parseDate(n).month) kind = "date";
    if (kind === "figure") n = quantityIn(c.sentence, n);   // "October 13, 2026" arrives as a figure when the planner filed it under data.value: it is a date
    if (out.some((x) => x.kind === kind && (kind === "date" ? x.name.toLowerCase() === n.toLowerCase() : digits(x.name) === digits(n) && digits(n)))) return;
    out.push({ kind, name: n, label });
  };
  if (c.data && c.data.value) add("figure", c.data.value, c.data.label ? trimLabel(c.data.label) : null);
  for (const e of c.named_entities || c.entities || []) {
    if (!e || !e.name) continue;
    // a figure is drawn only when the sentence writes it in DIGITS: "three" and "one" as big type read as stray words (board 38870271640 ch-5: "one three" panels)
    if (e.type === "number") { if (/\d/.test(String(e.name))) add("figure", e.name); }
    else if (e.type === "date") add("date", e.name);
  }
  // "9" from the entities is the start of "9 to 0" from the data: keep the longer, drop the part
  return out.filter((f) => !out.some((g) => g !== f && g.kind === f.kind && g.name.length > f.name.length && g.name.includes(f.name)));
}

/** Score a spoken word for display: numbers and named things first, long content words next, function words never. */
function scoreWord(text, names) {
  const w = clean(text), lw = w.toLowerCase();
  if (!w) return -9;
  let s = 0;
  if (isNumberWord(w)) s += 4;
  if (names.some((n) => n.toLowerCase().split(/\s+/).includes(lw))) s += 3;
  if (/^[A-Z]/.test(w) && w.length > 1) s += 2;
  if (w.length >= 7) s += 1;
  if (STOP.has(lw)) s -= 3;
  return s;
}

/** A word as it is DISPLAYED: the spoken word without the punctuation around it (a figure keeps its $ % and decimal point). */
const shown = (t) => String(t || "").replace(/^[^\w$€£]+/, "").replace(/[^\w%]+$/, "");

/**
 * The best run of <= `max` contiguous spoken words inside [from, to): { text, at, emphasis, words } (at = the first word's frame).
 * A run is worth its words: numbers and named things most, long content words next; a second content word makes a PHRASE ("entire ecosystem",
 * "nobody knew existed") which says more than one word alone, so each extra content word earns a bonus and each function word inside costs one.
 * A run never starts or ends on a function word, and never crosses the end of a sentence.
 */
export function displayWords(spoken, from, to, names, max = 3, exclude = null) {
  const ws = (spoken || []).filter((w) => w.abs >= from && w.abs < to && clean(w.text));
  if (!ws.length) return null;
  const isStop = (w) => STOP.has(clean(w.text).toLowerCase());
  let best = null;
  for (let i = 0; i < ws.length; i++) {
    for (let n = 1; n <= Math.min(max, ws.length - i); n++) {
      const run = ws.slice(i, i + n);
      if (isStop(run[0]) || isStop(run[n - 1])) continue;
      const weak = (w) => WEAK.has(clean(w.text).toLowerCase()) || /ly$/i.test(clean(w.text));
      if (weak(run[0]) || weak(run[n - 1])) continue;
      if (run.slice(0, -1).some((w) => /[.!?]$/.test(String(w.text).trim()))) continue;   // do not run across a sentence end
      // A phrase may not SHOW PART OF A NAMED ENTITY: "ACKIE" for "Naomi Ackie" fails the naming check ("first name missing", board 38781391920 ch-49). It contains a
      // whole name or none of that name's words.
      const toks = run.map((w) => clean(w.text).toLowerCase());
      const splitsName = (names || []).some((nm) => {
        const nt = String(nm).toLowerCase().split(/\s+/).map((t) => t.replace(/[^\w']/g, "")).filter(Boolean);
        if (nt.length < 2) return false;
        const hits = nt.filter((t) => toks.includes(t)).length;
        return hits > 0 && hits < nt.length;
      });
      if (splitsName) continue;
      // words the shot's plate already says are not said again ("TWENTY-SIX" under a date plate, "NEWARK" under a Newark pin): that is the headline competing with the picture
      if (exclude && toks.some((t) => exclude.has(t))) continue;
      const content = run.filter((w) => !isStop(w)).length;
      const sc = run.reduce((a, w) => a + scoreWord(w.text, names), 0) + (content - 1) * 1.2 - (n - content) * 1;
      if (!best || sc > best.sc) best = { sc, run };
    }
  }
  if (!best) return null;
  const hi = best.run.reduce((a, w) => (scoreWord(w.text, names) > scoreWord(a.text, names) ? w : a), best.run[0]);
  return { text: best.run.map((w) => shown(w.text)).join(" "), at: best.run[0].abs, emphasis: shown(hi.text), words: best.run.length };
}

/** Shot boundaries inside [s, e): about `len` apart, each moved to the nearest spoken word onset, at least `min` frames from its neighbours. */
export function cutPoints(s, e, len, min, spoken) {
  const n = Math.max(1, Math.round((e - s) / len));
  const onsets = (spoken || []).map((w) => w.abs).filter((f) => f > s + min && f < e - min);
  const cuts = [s];
  for (let k = 1; k < n; k++) {
    const ideal = s + ((e - s) * k) / n;
    let at = Math.round(ideal);
    if (onsets.length) at = onsets.reduce((a, f) => (Math.abs(f - ideal) < Math.abs(a - ideal) ? f : a), onsets[0]);
    if (at - cuts[cuts.length - 1] >= min && e - at >= min) cuts.push(at);
  }
  cuts.push(e);
  return cuts;
}

// Frames after the cut. The cadence metric (scripts/lib/novelty.mjs) counts two things less than 0.4 s apart (12 frames) as ONE event, so the elements that
// matter sit in their own windows: the picture AT the cut (the cut itself is the first event), the display words at ~0.47 s, the label at ~0.9 s. The accent
// shape arrives with the picture (it is its second sheet), not as a third thing. Measured on real boards: spacing them 0.35 s apart merged three into one and
// left real videos at 12.3-12.99 events per 10 s against the law's 13.
const ELEMENT_OFFSET = { ground: 0, hero: 1, shape: 3, display: 14, plate: 27 };
const PLATE_MIN_FRAMES = 24;   // a shot shorter than 0.8 s cannot hold a plate; its entities go to the shots that can   // frames after the cut: one new thing about every 0.35 s

/**
 * QUOTED STATEMENTS (owner, 2026-10-16: "the highlighted text style should be quoted statements from sites and people"). `quotes` are VERBATIM statements the
 * research stage found in its search results and scripts/lib/quote-verify.mjs confirmed word for word against them: { text, speaker, source_name, source_url }.
 * A quote goes on a beat whose sentence NAMES its speaker or its source, never elsewhere: the naming check reads every name on screen against the beat's
 * sentence, and an attribution the narration never mentions would read as an unnamed entity. Each quote is used once. Returns Map(beatIndex -> quote).
 */
export function assignQuotes(beats, quotes) {
  const out = new Map();
  const used = new Set();
  const tokens = (t) => String(t || "").toLowerCase().split(/[^a-z0-9']+/).filter((w) => w.length >= 4);
  (beats || []).forEach((b, bi) => {
    const sentence = String((b.scene && b.scene.canvas && b.scene.canvas.sentence) || b.original_text || b.text || "").toLowerCase();
    if (!sentence) return;
    const q = (quotes || []).find((x, qi) => !used.has(qi) && x && x.text && [x.speaker, x.source_name].some((who) => {
      const t = tokens(who);
      return t.length && t.every((w) => sentence.includes(w));
    }));
    if (q) { used.add(quotes.indexOf(q)); out.set(bi, q); }
  });
  return out;
}

/**
 * @param beats   [{ index, start_frame, duration_frames, spoken: [{text, from, to}] (beat-relative frames), scene: { canvas } }]
 * @param opts    { laws, profile, fps }
 * @returns { shots, events, report }
 */
export function planClone(beats, { laws, profile, fps = FPS, quotes = [] } = {}) {
  if (!laws || !profile) throw new Error("planClone needs the grammar's laws and a profile");
  const shotS = Math.min(profile.shot_s || 1.8, 10 / laws.cuts_per_10s.min);
  const len = Math.round(shotS * fps), minLen = Math.round(1.0 * fps);
  const treatments = profile.treatments, crops = profile.crops || [[50, 35], [35, 50], [65, 50], [50, 62]];
  const shots = [];
  const quoteOf = assignQuotes(beats, quotes);
  beats.forEach((b, bi) => {
    const s = b.start_frame, e = b.start_frame + b.duration_frames;
    const canvas = b.scene?.canvas || {};
    const heroes = heroesOf(canvas), names = namesOf(canvas), ents = typedEntitiesOf(canvas), figs = figuresOf(canvas);
    const spoken = (b.spoken || []).map((w) => ({ ...w, abs: s + w.from }));
    const cuts = cutPoints(s, e, len, minLen, spoken);
    const nShots = cuts.length - 1;
    // A LABEL UNDER A PICTURE NAMES THAT PICTURE'S OWN ENTITY, NEVER ANOTHER. Board 38805009555 ch-49 beat 5: a photo of James Wan carried a plate "Sam Raimi" (another entity
    // of the same sentence) and the beat check rejected the video: "The photo shows James Wan, but the text label incorrectly identifies him as Sam Raimi". The beat's OTHER
    // entities are shown where no picture is, on a trailing panel shot (a beat of three or more shots gives its last one to them).
    const heroNames = new Set(heroes.map((h) => String(h.name || "").toLowerCase()).filter(Boolean));
    const extra = ents.filter((x) => !heroNames.has(x.name.toLowerCase()));
    const panelLast = heroes.length > 0 && extra.length > 0 && nShots >= 3;
    for (let k = 0; k < nShots; k++) {
      const f0 = cuts[k], f1 = cuts[k + 1];
      const lastPanel = panelLast && k === nShots - 1;
      const hero = !lastPanel && heroes.length ? heroes[k % heroes.length] : null;
      const prev = shots[shots.length - 1];
      // A shot with NO picture is a designed type shot (an editorial pull-quote), never a picture treatment with the picture missing: that left a
      // bare accent block standing alone on real beats (board 38752797116 ch-2). The treatment rotation is for pictures only.
      let treatment = "type";
      if (hero) {
        // FRAMELESS, chosen by what the picture IS (owner, 2026-10-16: "the frames are not needed"): a person cut-out stands on the floor, runs off an edge or
        // floats; an object / logo cut-out floats or runs off an edge; a photo that could not be cut out is a soft-edged vignette or a full bleed. Never a box.
        const set = hero.cutout ? (hero.bust ? ["stand"] : hero.grounded ? ["stand", "edge", "float"] : ["float", "edge"]) : ["vignette", "bleed"];
        let ti = shots.filter((x) => x.hero).length % set.length;
        // never the same treatment twice in a row on the same hero: that is the same frame twice
        if (prev && prev.hero && prev.hero.asset === hero.asset && set[ti] === prev.treatment) ti = (ti + 1) % set.length;
        treatment = set[ti];
      }
      // (the display words are chosen below, after the shot's subjects are known, so they can avoid repeating them)
      let disp = null;
      // EVERY entity the beat names gets a plate in some shot of the beat: entity j goes to shot j mod n. A beat that names more entities than it has
      // shots shows several on one plate. (What the manifest says was drawn is computed from this, so entity coverage judges the pixels' truth.)
      const roomForPlate = f1 - f0 >= PLATE_MIN_FRAMES;
      const heroEnt = hero && hero.name ? ents.find((x) => x.name.toLowerCase() === String(hero.name).toLowerCase()) || { name: String(hero.name), type: hero.kind === "portrait" ? "person" : "organization" } : null;
      const plates = hero ? (heroEnt && roomForPlate ? [heroEnt] : []) : [];
      // A picture-less shot shows a SUBJECT of its beat as its visual, cycling through them: an entity as a GLYPH plate (a person's silhouette, an
      // organisation's building, a place's pin: the canvas engine's own fallback when no picture exists), a stated figure as a big number, a stated date as a
      // calendar page. EVERY shot does, not just one: the entity check (Gemini, on the frames) samples ONE frame per beat and fails "a beat names an entity /
      // a figure / a date its frame does not show" when the sampled frame is another shot (board 38772064251 ch-1: missing "35%", "October 2026", "44%").
      // The excerpt card is only for a beat that names nothing to show.
      const subjectsAll = [...(heroes.length ? extra : ents).map((x) => ({ kind: "glyph", ...x })), ...figs.map((f) => ({ ...f }))];
      // ALL of them in ONE frame (up to four, as cells of a panel; more than four rotate), so the single frame the entity check samples shows every subject
      // (board 38781391920 ch-9: a beat naming the UN and Ethiopia showed only the UN in the sampled frame; the date was missing in another).
      const MAXCELLS = 4;
      let subjects = !hero && subjectsAll.length && f1 - f0 >= PLATE_MIN_FRAMES
        ? (subjectsAll.length <= MAXCELLS ? subjectsAll : Array.from({ length: MAXCELLS }, (_, j) => subjectsAll[(k + j) % subjectsAll.length])) : [];
      // Successive panels must DIFFER or a cut between them is invisible (cadence fell on board 38790006358 when every shot of a beat showed the same panel): the cells rotate
      // by one each shot, and every other shot is inverted (ink plate, paper type).
      if (subjects.length > 1) { const r = k % subjects.length; subjects.push(...subjects.splice(0, r)); }
      const inv = k % 2 === 1;
      const subject = subjects[0] || null;
      const glyph = subject && subject.kind === "glyph" ? subject : null;
      if (subject) {
        treatment = "subject";   // frameless: glyphs, figures and dates straight on the paper (the panel, plate and disc boxes are gone)
        for (const g of subjects) if (g.kind === "glyph" && !plates.some((x) => x.name === g.name)) plates.push({ name: g.name, type: g.type });
      }
      // A shot WITH a picture shows the beat's figures / dates in its text region, cycling through them, in place of the display words.
      const figHere = hero && figs.length ? figs[k % figs.length] : null;
      const quote = quoteOf.has(bi) && k === (nShots >= 2 ? 1 : 0) ? quoteOf.get(bi) : null;   // the beat's quoted statement, once, on its second shot
      if (quote) treatment = hero ? (hero.cutout && !hero.bust ? "quote-cut" : "quote-soft") : "quote";
      {
        const exclude = new Set();
        const addToks = (t) => String(t || "").toLowerCase().split(/[^a-z0-9']+/).filter(Boolean).forEach((x) => exclude.add(x));
        for (const sj of subjects) { addToks(sj.name); addToks(sj.label); }
        if (subjects.some((sj) => sj.kind === "figure" || sj.kind === "date")) { NUMBER_WORDS.forEach((w) => exclude.add(w)); MONTH_WORDS.forEach((w) => exclude.add(w)); }
        // Number and month words are NEVER display type: the spoken form ("October eight, twenty twenty-six") is not the written one ("October 8, 2026") and the naming
        // check fails it (board 38790006358 ch-44 / ch-49). Dates and figures are drawn on their plates, in the sentence's own written form.
        NUMBER_WORDS.forEach((w) => exclude.add(w)); MONTH_WORDS.forEach((w) => exclude.add(w));
        // REVERTED (board 38811678143): a shot whose visual is a subject plate once carried NO caption, on the theory that the words were the "headline" the frame review counted.
        // The measurement said the opposite: with the captions gone ch-44 went from approved-review to TEMPLATE_MONOCULTURE 100%, ch-26 from 50% to 100% (ch-2 stayed 100%): bare
        // identical plates read as one template. The short caption stays (smaller than the plate, and never repeating it: see the exclusion above); a tick still stands in when none fits.
        disp = displayWords(spoken, f0, f1, names, profile.display_words || 3, exclude);
      }
      // KICKER (ref-03, owner 2026-10-16 "look how much better they look"): a shot with no picture and no subject sets the narration it is SPEAKING, word by word on each
      // word's own onset, in a small serif line next to the big phrase — the words the big phrase does not say ("the more it" + "SLIPS AWAY"). It replaces the paper
      // excerpt card with marked words (a sticky note; and the marker highlight is now reserved for quoted statements).
      let kicker = null;
      if (!hero && !subject && !quote) {
        const inShot = spoken.filter((w) => w.abs >= f0 && w.abs < f1 && clean(w.text));
        const runAt = disp ? inShot.findIndex((w) => w.abs === disp.at) : -1;
        const mk = (ws) => ws.map((w) => ({ text: String(w.text).trim(), at: Math.max(f0 + 1, Math.min(f1 - 4, w.abs)) }));
        const before = runAt >= 0 ? inShot.slice(0, runAt) : inShot;
        const after = runAt >= 0 ? inShot.slice(runAt + disp.words) : [];
        kicker = before.length || after.length ? { before: mk(before), after: mk(after) } : null;
      }
      const shownNames = new Set(subjects.filter((x) => x.kind === "glyph").map((x) => x.name));
      const labelPlates = plates.filter((x) => !shownNames.has(x.name));
      const el = [];
      const at = (off) => Math.min(f1 - 3, f0 + off);
      el.push({ kind: "ground", at: f0 });
      if (hero || subject) el.push({ kind: "hero", at: at(ELEMENT_OFFSET.hero) });
      else el.push({ kind: "card", at: at(ELEMENT_OFFSET.hero) });   // a beat that names nothing shows the narration itself, set as an excerpt card
      const shape = !profile.accent_shapes?.length ? null : treatment === "type" ? (profile.accent_shapes.includes("block") ? "block" : profile.accent_shapes[0]) : profile.accent_shapes[shots.length % profile.accent_shapes.length];
      // The accent shape rides with the picture (a second sheet) when a label plate takes the late window; with no label it takes that window itself, so every
      // shot has three separate events (picture at the cut, key phrase ~0.47 s, accent / label ~0.9 s). Real archive-italic video measured 12.17 per 10 s against 13.
      const hasLabel = labelPlates.length && (roomForPlate || subject);
      if (shape) el.push({ kind: "shape", at: at(hasLabel ? ELEMENT_OFFSET.shape : ELEMENT_OFFSET.plate) });
      if (quote) el.push({ kind: "display", at: at(ELEMENT_OFFSET.display) });
      else if (figHere) el.push({ kind: "figure", at: at(ELEMENT_OFFSET.display) });
      else if (disp) el.push({ kind: "display", at: Math.min(f1 - 9, Math.max(f0 + ELEMENT_OFFSET.display, disp.at)) });
      else el.push({ kind: "tick", at: at(ELEMENT_OFFSET.display) });   // no phrase that adds to the plate: a rule under it arrives instead, so the shot still has its three events
      if (labelPlates.length && (roomForPlate || subject)) el.push({ kind: "plate", at: Math.min(f1 - 8, f0 + ELEMENT_OFFSET.plate) });
      shots.push({
        beat: bi, k, f0, f1, hero, treatment, crop: crops[(shots.length) % crops.length], shape,
        display: quote || figHere ? null : disp, figure: !quote && figHere ? { value: figHere.name, label: figHere.label, kind: figHere.kind } : null, quote,
        inv, subject, subjects, glyph, excerpt: !hero && !subject ? excerptOf(b, canvas) : null, kicker,
        plates: plates.length && (roomForPlate || subject) ? plates : [], plate: labelPlates.length && (roomForPlate || subject) ? labelPlates.map((x) => x.name).join(" · ") : null,
        elements: el,
      });
    }
  });
  const events = shots.flatMap((sh) => sh.elements.map((x) => x.at)).sort((a, b) => a - b);
  return { shots, events, report: reportOf(shots, events, laws, fps, beats) };
}

/** What the plan promises, in the units the laws use. Computed from the plan alone; the gate re-measures it on pixels. */
export function reportOf(shots, events, laws, fps = FPS, beats = []) {
  const total = beats.length ? (beats[beats.length - 1].start_frame + beats[beats.length - 1].duration_frames - beats[0].start_frame) / fps : (shots.at(-1)?.f1 || 0) / fps;
  const t = events.map((f) => f / fps);
  const gaps = [];
  let prev = beats.length ? beats[0].start_frame / fps : 0;
  for (const x of t) { gaps.push(x - prev); prev = x; }
  gaps.push(Math.max(0, (beats.length ? (beats.at(-1).start_frame + beats.at(-1).duration_frames) / fps : total) - prev));
  const s = [...gaps].sort((a, b) => a - b), p90 = s[Math.min(s.length - 1, Math.floor(0.9 * (s.length - 1) + 0.5))];
  const withHero = shots.filter((x) => x.hero).length;
  return {
    seconds: +total.toFixed(2), shots: shots.length, events: events.length,
    events_per_10s: +(events.length / Math.max(1, total) * 10).toFixed(2),
    cuts_per_10s: +(shots.length / Math.max(1, total) * 10).toFixed(2),
    gap_p90_s: +p90.toFixed(2), gap_max_s: +Math.max(...gaps).toFixed(2),
    heroShare: +(withHero / Math.max(1, shots.length)).toFixed(2),
    typeOnlyShots: shots.length - withHero,
    laws: { events_per_10s_min: laws.events_per_10s_min, gap_p90_max_s: laws.gap_p90_max_s, gap_max_s: laws.gap_max_s },
  };
}

/** The laws a plan must satisfy: [] when it does. Cadence from the plan; legality from the profile; hero share from what the beats carry. */
export function lawProblems(plan, laws, { minHeroShare = 0.65 } = {}) {
  const r = plan.report, out = [];
  if (r.events_per_10s < laws.events_per_10s_min) out.push(`cadence: ${r.events_per_10s} new elements per 10 s, the references never go below ${laws.events_per_10s_min}`);
  if (r.gap_p90_s > laws.gap_p90_max_s) out.push(`cadence: nine waits in ten are up to ${r.gap_p90_s} s, the references' are at most ${laws.gap_p90_max_s} s`);
  if (r.gap_max_s > laws.gap_max_s) out.push(`cadence: the longest wait for something new is ${r.gap_max_s} s, the references' longest is ${laws.gap_max_s} s`);
  if (r.cuts_per_10s < laws.cuts_per_10s.min) out.push(`cadence: ${r.cuts_per_10s} cuts per 10 s, the references go from ${laws.cuts_per_10s.min}`);
  if (r.heroShare < minHeroShare) out.push(`pictures: ${Math.round(r.heroShare * 100)}% of shots have a picture, the family requires ${Math.round(minHeroShare * 100)}% (${r.typeOnlyShots} shot(s) are type only: the beats carry no asset for them)`);
  for (let i = 1; i < plan.shots.length; i++) {
    const a = plan.shots[i - 1], b = plan.shots[i];
    if (a.hero && b.hero && a.hero.asset === b.hero.asset && a.treatment === b.treatment && a.crop[0] === b.crop[0] && a.crop[1] === b.crop[1]) out.push(`shots ${i - 1} and ${i} are the same frame twice (same picture, treatment and crop)`);
    if (b.display && b.display.words > 3) out.push(`shot ${i}: display text is ${b.display.words} words, at most 3`);
  }
  return out;
}

/**
 * What a beat's shots actually DRAW, in the fields the entity gates read (scripts/entity-coverage.js drawnOf): the beat's photo if some shot shows it, the
 * logos / cut-outs some shot shows, the entity names some shot puts on a plate (a plate of a PERSON, PLACE or ORGANISATION, by the entity's type), and the
 * figure some shot shows. The manifest of a clone render records THIS, not the canvas engine's layout of the same beat: a gate that read the canvas layout
 * would say "a map is drawn" or "the photo is shown" of a clone frame that shows neither (the manifest is a proxy; the pixels are the artifact).
 */
export function cloneCanvasFor(canvas, shots, palette = null) {
  const c = canvas || {};
  const drawn = new Set((shots || []).filter((x) => x.hero).map((x) => x.hero.asset));
  const plates = [];
  for (const sh of shots || []) for (const p of sh.plates || []) if (!plates.some((q) => q.name.toLowerCase() === p.name.toLowerCase())) plates.push(p);
  // figures and dates the shots drew (in the text region, or as a subject plate)
  const figs = [];
  const addFig = (f) => { if (f && !figs.some((x) => x.kind === f.kind && x.name === f.name)) figs.push(f); };
  for (const sh of shots || []) { if (sh.figure) addFig({ kind: sh.figure.kind || "figure", name: sh.figure.value, label: sh.figure.label }); for (const sj of sh.subjects || []) if (sj.kind !== "glyph") addFig({ kind: sj.kind, name: sj.name, label: sj.label }); }
  const num = figs.find((f) => f.kind === "figure"), date = figs.find((f) => f.kind === "date");
  const kindOf = (t) => (t === "person" ? "plate-person" : t === "place" ? "plate-place" : "plate-organization");
  const out = {};
  for (const k of ["sentence", "named_entities", "entities", "headline", "lead_in", "visual_type", "source_credit", "beat_index", "beat_total"]) if (c[k] !== undefined) out[k] = c[k];
  out.composition = num ? "NUMBER-STAT" : "CLONE";
  out.photo = c.photo && c.photo.asset && drawn.has(c.photo.asset) ? c.photo : null;
  out.concept_visuals = (c.concept_visuals || []).filter((v) => v && v.asset && drawn.has(v.asset));
  const extraNums = figs.filter((f) => f.kind === "figure" && f !== num);
  out.art = c.art && c.art.asset && drawn.has(c.art.asset) ? c.art
    : plates.length || extraNums.length ? { kind: "plates", name: [...plates.map((p) => p.name), ...extraNums.map((f) => f.name)].join(", "), names: [...plates.map((p) => p.name), ...extraNums.map((f) => f.name)], kinds: [...plates.map((p) => kindOf(p.type)), ...extraNums.map(() => "figure")] }
    : date ? { kind: "date", name: date.name, text: date.name } : null;
  out.data = num ? { value: num.name, label: num.label } : null;
  out.boxes = {};
  out.clone = true;
  // What the beat's frames ARE, for the frame review's label (scripts/gemini-frame-review.js compositionLabel). Every beat without a photo used to be labelled
  // "typography" because the canvas plan said TYPE, so figure plates, glyph plates and calendar plates were counted as headline beats (board 38781391920:
  // TEMPLATE_MONOCULTURE 66% / 62%). The reviewer still judges the frames; this only says truthfully what is drawn.
  const parts = [];
  if (out.photo) parts.push("a photograph of " + (out.photo.entity || "the subject") + " in a framed or full-bleed layout");
  if (out.concept_visuals.length) parts.push("a logo or object picture");
  const glyphs = (shots || []).flatMap((x) => (x.subjects || []).filter((y) => y.kind === "glyph").map((y) => y.type));
  if (glyphs.length) parts.push("generic " + [...new Set(glyphs)].map((t) => (t === "person" ? "person-silhouette" : t === "place" ? "map-pin" : "building")).join(" / ") + " icon plates with the entity's name");
  if (figs.some((f) => f.kind === "figure")) parts.push("large figure plates");
  if (date) parts.push("a calendar-date plate");
  if ((shots || []).some((x) => x.excerpt)) parts.push("the narration set word by word in a serif line (no excerpt cards)");
  if (parts.length) out.clone_label = "a designed multi-shot frame with " + parts.join(", ") + "; a short highlighted key phrase is only a secondary caption";
  // The frame review's labels read these: the ground this beat chose (a non-white ground is declared, not left to read as a mistake), and what the beat
  // DRAWS (a photograph, a logo, or typography) so a beat with a picture is not called typography because the canvas engine's plan said TYPE.
  if (palette && palette.ground) out.ground_color = palette.ground;
  out.visual_type = num ? "COUNTER" : out.photo ? "PHOTO" : "TYPE";
  return out;
}

