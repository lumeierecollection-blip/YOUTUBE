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

const ELEMENT_OFFSET = { ground: 0, hero: 1, shape: 11, display: 22, plate: 34 };   // frames after the cut: one new thing about every 0.35 s

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
    const heroes = heroesOf(canvas), names = namesOf(canvas);
    const spoken = (b.spoken || []).map((w) => ({ ...w, abs: s + w.from }));
    const cuts = cutPoints(s, e, len, minLen, spoken);
    const fig = canvas.data && canvas.data.value ? { value: String(canvas.data.value), label: canvas.data.label ? String(canvas.data.label) : null } : null;
    for (let k = 0; k < cuts.length - 1; k++) {
      const f0 = cuts[k], f1 = cuts[k + 1];
      const hero = heroes.length ? heroes[k % heroes.length] : null;
      const prev = shots[shots.length - 1];
      let ti = (shots.length) % treatments.length;
      // never the same treatment twice in a row on the same hero: that is the same frame twice
      if (prev && prev.hero && hero && prev.hero.asset === hero.asset && treatments[ti] === prev.treatment) ti = (ti + 1) % treatments.length;
      const disp = displayWords(spoken, f0, f1, names, profile.display_words || 3);
      const plateName = hero && hero.name && hero.kind !== "photo" ? hero.name : names[k % Math.max(1, names.length)] || null;
      const showFig = fig && k === 0;
      const el = [];
      const at = (kind, off) => Math.min(f1 - 3, f0 + off);
      el.push({ kind: "ground", at: f0 });
      if (hero) el.push({ kind: "hero", at: at("hero", ELEMENT_OFFSET.hero) });
      if (profile.accent_shapes?.length) el.push({ kind: "shape", at: at("shape", ELEMENT_OFFSET.shape) });
      if (showFig) el.push({ kind: "figure", at: at("figure", ELEMENT_OFFSET.display) });
      else if (disp) el.push({ kind: "display", at: Math.min(f1 - 3, Math.max(f0 + ELEMENT_OFFSET.display - 6, disp.at)) });
      if (plateName && f1 - f0 >= ELEMENT_OFFSET.plate + 8) el.push({ kind: "plate", at: at("plate", ELEMENT_OFFSET.plate) });
      shots.push({
        beat: bi, k, f0, f1, hero, treatment: treatments[ti], crop: crops[(shots.length) % crops.length],
        shape: profile.accent_shapes?.length ? profile.accent_shapes[shots.length % profile.accent_shapes.length] : null,
        display: showFig ? null : disp, figure: showFig ? fig : null, plate: plateName && f1 - f0 >= ELEMENT_OFFSET.plate + 8 ? plateName : null,
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
