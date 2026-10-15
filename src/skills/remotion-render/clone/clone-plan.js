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
export const FPS = 30;
const STOP = new Set("a an the and or but of to in on at by for with from as is are was were be been it its this that these those he she they we you i his her their our your not no do does did has have had will would can could should may might than then so if into over under about after before while which who whom what when where why how also just only very more most".split(" "));
// Words a display phrase may not START or END on although they are not function words: verbs of being / holding / saying and adverbs that dangle
// ("AIR HELD ALMOST", "CAVE SITS", "SOUTHEASTERN ROMANIA FAR", "DEAL ANIMALS" were real picks). Without a parser this is a list, not a grammar: it stops
// the commonest fragments, it does not guarantee a phrase.
const WEAK = new Set("held sits sit sat said says say made make makes found find finds got get gets had have went go goes came come comes took take takes seemed seem seems became become becomes almost far very quite rather really still even also ever never always often just only nearly mostly already soon later early late deal lot kind sort way thing things something anything".split(" "));
const isNumberWord = (w) => /^[\$€£]?\d[\d,.]*(?:%|[kmb]|million|billion|thousand)?$/i.test(w);
const clean = (w) => String(w || "").replace(/^[^\w$€£]+|[^\w%]+$/g, "");

/** The assets a beat's canvas already carries, in the order the beat gives them. { kind, asset, name, w, h, view } — kind is what coverage reads. */
export function heroesOf(canvas) {
  const c = canvas || {};
  const out = [];
  if (c.photo && c.photo.asset) out.push({ kind: c.photo.kind === "person" || c.photo.view === "person" ? "portrait" : "photo", asset: c.photo.asset, name: c.photo.entity || null, w: c.photo.w || null, h: c.photo.h || null, view: c.photo.view || null, credit: c.photo.credit || c.source_credit || null });
  for (const v of c.concept_visuals || []) if (v && v.asset) out.push({ kind: v.logo ? "logo" : v.class === "cutout" ? "cutout" : "symbol", asset: v.asset, name: v.name || null, w: v.w || null, h: v.h || null, view: null });
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
export function displayWords(spoken, from, to, names, max = 3) {
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

const ELEMENT_OFFSET = { ground: 0, hero: 1, shape: 11, display: 22, plate: 34 };
const PLATE_MIN_FRAMES = 24;   // a shot shorter than 0.8 s cannot hold a plate; its entities go to the shots that can   // frames after the cut: one new thing about every 0.35 s

/**
 * @param beats   [{ index, start_frame, duration_frames, spoken: [{text, from, to}] (beat-relative frames), scene: { canvas } }]
 * @param opts    { laws, profile, fps }
 * @returns { shots, events, report }
 */
export function planClone(beats, { laws, profile, fps = FPS } = {}) {
  if (!laws || !profile) throw new Error("planClone needs the grammar's laws and a profile");
  const shotS = Math.min(profile.shot_s || 1.8, 10 / laws.cuts_per_10s.min);
  const len = Math.round(shotS * fps), minLen = Math.round(1.0 * fps);
  const treatments = profile.treatments, crops = profile.crops || [[50, 35], [35, 50], [65, 50], [50, 62]];
  const shots = [];
  beats.forEach((b, bi) => {
    const s = b.start_frame, e = b.start_frame + b.duration_frames;
    const canvas = b.scene?.canvas || {};
    const heroes = heroesOf(canvas), names = namesOf(canvas), ents = typedEntitiesOf(canvas);
    const spoken = (b.spoken || []).map((w) => ({ ...w, abs: s + w.from }));
    const cuts = cutPoints(s, e, len, minLen, spoken);
    const nShots = cuts.length - 1;
    const fig = canvas.data && canvas.data.value ? { value: String(canvas.data.value), label: canvas.data.label ? String(canvas.data.label) : null } : null;
    for (let k = 0; k < nShots; k++) {
      const f0 = cuts[k], f1 = cuts[k + 1];
      const hero = heroes.length ? heroes[k % heroes.length] : null;
      const prev = shots[shots.length - 1];
      // A shot with NO picture is a designed type shot (an editorial pull-quote), never a picture treatment with the picture missing: that left a
      // bare accent block standing alone on real beats (board 38752797116 ch-2). The treatment rotation is for pictures only.
      let treatment = "type";
      if (hero) {
        let ti = shots.filter((x) => x.hero).length % treatments.length;
        // never the same treatment twice in a row on the same hero: that is the same frame twice
        if (prev && prev.hero && prev.hero.asset === hero.asset && treatments[ti] === prev.treatment) ti = (ti + 1) % treatments.length;
        treatment = treatments[ti];
      }
      const disp = displayWords(spoken, f0, f1, names, profile.display_words || 3);
      // EVERY entity the beat names gets a plate in some shot of the beat: entity j goes to shot j mod n. A beat that names more entities than it has
      // shots shows several on one plate. (What the manifest says was drawn is computed from this, so entity coverage judges the pixels' truth.)
      const eligible = cuts.slice(0, -1).map((c0, i) => i).filter((i) => cuts[i + 1] - cuts[i] >= PLATE_MIN_FRAMES);
      const slot = eligible.indexOf(k);
      const plates = slot >= 0 ? ents.filter((_, j) => j % eligible.length === slot) : [];
      const roomForPlate = slot >= 0;
      // A picture-less shot that names an entity shows that entity as a GLYPH plate (a person's silhouette, an organisation's building, a place's pin):
      // the canvas engine's own fallback when no picture exists, and what the entity check (Gemini, on the frames) needs to see: a small text label is not a depiction.
      const glyph = !hero && plates.length && roomForPlate ? plates[0] : null;
      if (glyph) treatment = "plate";
      const showFig = fig && k === 0;
      const el = [];
      const at = (off) => Math.min(f1 - 3, f0 + off);
      el.push({ kind: "ground", at: f0 });
      if (hero) el.push({ kind: "hero", at: at(ELEMENT_OFFSET.hero) });
      else if (plates.length && roomForPlate) el.push({ kind: "hero", at: at(ELEMENT_OFFSET.hero) });   // a picture-less shot that names an entity shows that entity's GLYPH plate
      else el.push({ kind: "card", at: at(ELEMENT_OFFSET.hero) });   // a picture-less shot that names nothing shows the narration itself, set as an excerpt card
      const shape = !profile.accent_shapes?.length ? null : treatment === "type" && !glyph ? (profile.accent_shapes.includes("block") ? "block" : profile.accent_shapes[0]) : profile.accent_shapes[shots.length % profile.accent_shapes.length];
      if (shape) el.push({ kind: "shape", at: at(ELEMENT_OFFSET.shape) });
      if (showFig) el.push({ kind: "figure", at: at(ELEMENT_OFFSET.display) });
      else if (disp) el.push({ kind: "display", at: Math.min(f1 - 3, Math.max(f0 + ELEMENT_OFFSET.display - 6, disp.at)) });
      if ((glyph ? plates.length > 1 : plates.length) && roomForPlate) el.push({ kind: "plate", at: Math.min(f1 - 8, f0 + ELEMENT_OFFSET.plate) });
      shots.push({
        beat: bi, k, f0, f1, hero, treatment, crop: crops[(shots.length) % crops.length], shape,
        display: showFig ? null : disp, figure: showFig ? fig : null,
        glyph, excerpt: !hero && !glyph ? excerptOf(b, canvas) : null,
        plates: plates.length && roomForPlate ? plates : [], plate: (glyph ? plates.slice(1) : plates).length && roomForPlate ? (glyph ? plates.slice(1) : plates).map((x) => x.name).join(" · ") : null,
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
  const fig = (shots || []).find((x) => x.figure)?.figure || null;
  const kindOf = (t) => (t === "person" ? "plate-person" : t === "place" ? "plate-place" : "plate-organization");
  const out = {};
  for (const k of ["sentence", "named_entities", "entities", "headline", "lead_in", "visual_type", "source_credit", "beat_index", "beat_total"]) if (c[k] !== undefined) out[k] = c[k];
  out.composition = fig ? "NUMBER-STAT" : "CLONE";
  out.photo = c.photo && c.photo.asset && drawn.has(c.photo.asset) ? c.photo : null;
  out.concept_visuals = (c.concept_visuals || []).filter((v) => v && v.asset && drawn.has(v.asset));
  out.art = c.art && c.art.asset && drawn.has(c.art.asset) ? c.art : plates.length ? { kind: "plates", name: plates.map((p) => p.name).join(", "), names: plates.map((p) => p.name), kinds: plates.map((p) => kindOf(p.type)) } : null;
  out.data = fig ? { value: fig.value, label: fig.label } : null;
  out.boxes = {};
  out.clone = true;
  // The frame review's labels read these: the ground this beat chose (a non-white ground is declared, not left to read as a mistake), and what the beat
  // DRAWS (a photograph, a logo, or typography) so a beat with a picture is not called typography because the canvas engine's plan said TYPE.
  if (palette && palette.ground) out.ground_color = palette.ground;
  out.visual_type = fig ? "COUNTER" : out.photo ? "PHOTO" : "TYPE";
  return out;
}

