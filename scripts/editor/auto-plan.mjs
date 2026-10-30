/**
 * Turn a finished script + its voiceover timings + its research into an editor scene plan, with no human in the loop.
 *
 * One scene per spoken sentence, timed by the voiceover. What a scene shows, in order of preference:
 *   1. a verified photo of a named person / place / organization the sentence names (resolver = scripts/entity-assets.cjs:
 *      Wikimedia, free licence, identity-checked; never a stand-in),
 *   2. a figure card, when the sentence states a number that the research also states,
 *   3. a statement card: the sentence itself, typeset, with its source.
 * Nothing is invented: a card carries only the sentence's own words and numbers, a photo only what the resolver verified, and a
 * scene's credit is recorded. A script that yields no scenes is an error, never an empty video.
 */
import { scriptSentences } from "./captions.mjs";
import { styleFor, functionOf, keyPhrase } from "./styles.mjs";
import { chooseKind, backdropSvg, figureLabel, mapFor, PHOTO_RECT } from "./graphics.mjs";
import { matchPlaces } from "./maps.mjs";

const clean = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const KIND = { person: "person", people: "person", place: "place", location: "place", city: "place", country: "place", organization: "organization", company: "organization", agency: "organization", institution: "organization", university: "organization" };

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

const PERCENT = /(\d+(?:\.\d+)?)\s?(?:%|percent\b)/gi;
const MONEY = /[$£€]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|billion|trillion|thousand))?/gi;
const PLAIN = /(?<![\d.,$£€])\d{2,4}(?![\d,]\d|\.\d|%)/g;
const MONTH = /(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?$/i;
const COUNT = /\b\d{1,3}(?:,\d{3})+\b|\b\d+(?:\.\d+)?\s?(?:million|billion|trillion)\b/gi;

/** Figures a sentence states, in order of appearance. */
export function extractFigures(sentence) {
  const found = [];
  const take = (re, kind) => {
    for (const m of String(sentence).matchAll(re)) {
      const raw = m[0].trim();
      if (found.some((f) => f.index < m.index + raw.length && m.index < f.index + f.raw.length)) continue;
      found.push({ raw: kind === "percent" ? `${m[1]}%` : raw, kind, value: kind === "percent" ? Number(m[1]) : null, index: m.index, matched: raw });
    }
  };
  take(PERCENT, "percent");
  take(MONEY, "number");
  take(COUNT, "number");
  // A plain number ("453 product recalls", "3,471" is above): 10 or more, not a year, not part of a date ("October 29"), not an ordinal.
  const text = String(sentence);
  for (const m of text.matchAll(PLAIN)) {
    const n = Number(m[0]);
    const before = text.slice(Math.max(0, m.index - 12), m.index);
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 3);
    if (n >= 1900 && n <= 2100) continue;
    if (MONTH.test(before.trim())) continue;
    if (/^(st|nd|rd|th)\b/i.test(after)) continue;
    if (found.some((f) => f.index < m.index + m[0].length && m.index < f.index + f.raw.length)) continue;
    found.push({ raw: m[0], kind: "number", value: null, index: m.index, matched: m[0] });
  }
  return found.sort((a, b) => a.index - b.index);
}

/** A year (1000-2099) the sentence states, as a figure of kind "year"; the caller checks the research states it too. */
export function extractYear(sentence) {
  const m = String(sentence).match(/(?<![\d,.])(1[0-9]{3}|20[0-9]{2})(?![\d,]|\.\d)/);
  return m ? { raw: m[1], kind: "year", value: Number(m[1]), index: m.index, matched: m[1] } : null;
}

/** The digits of a figure, so "1,321" and "1321" and "45 percent" / "45%" compare equal. */
const digitsOf = (raw) => String(raw).replace(/[^\d.]/g, "");

/** Does the research itself state this figure? (A card must never show a number the sources do not.) */
export function researchStates(research, figure) {
  const hay = JSON.stringify(research || {}).replace(/(\d),(\d)/g, "$1$2");
  const d = digitsOf(figure.raw);
  if (!d) return false;
  return new RegExp(`(?<![\\d.])${d.replace(/\./g, "\\.")}(?![\\d])`).test(hay);
}

/** Named entities of the research with how to find them in a sentence. */
export function entityIndex(research) {
  const out = [];
  for (const e of research?.named_entities || []) {
    const kind = KIND[String(e.kind || "").toLowerCase()];
    if (!kind || !e.name) continue;
    const full = clean(e.name);
    const parts = full.split(" ").filter(Boolean);
    const aliases = new Set([full]);
    if (kind === "person" && parts.length >= 2 && parts.at(-1).length >= 4) aliases.add(parts.at(-1));
    out.push({ name: String(e.name), kind, aliases: [...aliases] });
  }
  return out;
}

export function entitiesIn(sentence, index) {
  const s = ` ${clean(sentence)} `;
  return index.filter((e) => e.aliases.some((a) => s.includes(` ${a} `)));
}

/** Sentence k's [start,end) from the voiceover word list (word.sentence), or null when the counts disagree. */
export function sentenceSpans(words, count, audioDuration) {
  const by = new Map();
  for (const w of words || []) {
    if (!Number.isFinite(w.start) || !Number.isFinite(w.end) || w.sentence == null) continue;
    if (!by.has(w.sentence)) by.set(w.sentence, []);
    by.get(w.sentence).push(w);
  }
  const keys = [...by.keys()].sort((a, b) => a - b);
  if (keys.length !== count) return null;
  const starts = keys.map((k) => by.get(k)[0].start);
  return starts.map((s, i) => ({ start: i === 0 ? 0 : s, end: i === count - 1 ? audioDuration : starts[i + 1] }));
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

const HONORIFIC = /^(sir|dame|lord|lady|dr|prof|professor|mr|mrs|ms|president|prime minister|senator|judge|justice)\.?\s+/i;
export function nameVariants(name) {
  const plain = String(name).replace(HONORIFIC, "").trim();
  return plain && plain !== name ? [name, plain] : [name];
}


/**
 * Variety, so no two videos are cut the same way and a video does not repeat itself. Everything below is drawn from a random stream
 * seeded by the video's own slug: a re-render of the same video is identical, a different video is different.
 */
export function seededRandom(text) {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The video's look: the channel's home look about half the time, otherwise one of the other four. */
export function pickLook(rng, home) {
  const all = [1, 2, 3, 4, 5];
  const h = all.includes(Number(home)) ? Number(home) : all[Math.floor(rng() * 5)];
  if (rng() < 0.5) return h;
  const others = all.filter((x) => x !== h);
  return others[Math.floor(rng() * others.length)];
}

/** Move an overlay SVG's content up or down (its own layout otherwise stays put). */
export function shiftSvg(svgText, dy) {
  if (!dy) return svgText;
  return svgText.replace(/(<svg[^>]*>\n)/, `$1<g transform="translate(0,${dy})">\n`).replace(/<\/svg>\s*$/, "</g>\n</svg>\n");
}

const DY = { 1: [-120, -60, 0, 60, 140], 2: [-60, 0, 60, 120, 200], 3: [-100, -40, 0, 60, 120], 4: [0, 60, 120, 700], 5: [-30, 0, 30] };
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

/** Put a flat background behind a transparent overlay SVG. */
export function withBg(svgText, bg) {
  return svgText.replace(/(<svg[^>]*>)\n?/, `$1\n  <rect width="1080" height="1920" fill="${bg}"/>\n`);
}

/**
 * resolve({type,name,context}) -> {ok,file,width,height,credit,source_url,license}   a VERIFIED photo of a named entity (entity-assets)
 * concept({query, used}) -> {file,width,height,credit,source_url,license} | null       a real photo of the CONCEPT (concept-photo)
 * queries[i]: the concept search phrase for sentence i (or null).  style: 1-5 (styles.mjs).
 * Returns { plan, cards, report }. A card is { id, svg }; the CLI writes it and registers its asset.
 */
export async function buildAutoPlan({ script, research, words, audioDuration, channel, stem, audioPath, transcriptPath, scriptPath, resolve, concept = async () => null, queries = [], queries2 = [], style = 1, maxPhotos = 8 }) {
  const sentences = scriptSentences(script);
  if (!sentences.length) throw new Error(`auto-plan: ${stem} has no spoken sentences`);
  if (!(audioDuration > 0)) throw new Error(`auto-plan: ${stem} has no audio duration`);
  const exact = sentenceSpans(words, sentences.length, audioDuration);
  const spans = exact || proportionalSpans(sentences, audioDuration);
  const spanSource = exact ? "voiceover" : "proportional";

  const colors = channel?.colors || {};
  const palette = { bg: colors.bg || "#07070D", text: "#F5F5FF", muted: "#C9CDD6", accent: colors.canvas_accent || colors.accent || "#D4A574", accent2: colors.accent || "#D4A574" };
  const rng = seededRandom(stem);
  const lookId = Number(style) >= 1 ? Number(style) : pickLook(rng, channel?.editor_look);
  const look = styleFor(lookId, palette);
  const font = channel?.font || "Inter";
  const idx = entityIndex(research);
  const sources = (research?.key_facts || []).map((f) => hostOf(f.source_url)).filter(Boolean);
  const defaultSource = sources[0] || hostOf((script.sources_used || [])[0]) || "";

  const assets = {};
  const cards = [];
  const photoByName = new Map();
  const usedFiles = new Set();
  let photos = 0;
  const scenes = [];
  const report = [];
  const misses = [];
  let lastAsset = null;
  const yearsShown = new Set();
  let mapsShown = 0;
  const n = sentences.length;

  for (let i = 0; i < n; i++) {
    const sentence = sentences[i];
    const { start, end } = spans[i];
    // No slow zoom or pan (timeline.mjs): a fade-in instead of a hard cut is the only per-scene variation
    const fade = i > 0 && rng() < 0.35 ? pick(rng, [6, 8, 10]) : 0;
    const fn = functionOf(i, n);
    const figs = extractFigures(sentence).filter((f) => researchStates(research, f));
    // No number to draw? A year the research states becomes an animated timeline (the year counts up along a drawn line).
    const yearFig = !figs.length ? extractYear(sentence) : null;
    // each year gets one timeline per video, and at most three timelines in all: the same "2026" five times is a template, not a graphic
    const yearOk = yearFig && !yearsShown.has(yearFig.value) && yearsShown.size < 3 && researchStates(research, yearFig);
    const gfigs = figs.length ? figs : (yearOk ? [yearFig] : []);
    if (!figs.length && yearOk) yearsShown.add(yearFig.value);
    const figSource = hostOf((research?.numbers || []).find((nn) => figs.some((f) => digitsOf(f.raw) === String(nn.value).replace(/[^\d.]/g, "")))?.source_url) || defaultSource;
    // The figure is drawn as real animated layers (graphics.mjs): a bar that grows, a ring that draws on, a number that counts up.
    // A graphic goes in a panel of its own: under the photo ("split") or, with no photo, as the picture itself ("hero").
    const graphicFor = (mode, extra = {}) => ({ id: `g${i}`, kind: chooseKind(gfigs, rng, look.name), figs: gfigs.slice(0, 2), source: figSource, fn, look: look.name, label: figureLabel(sentence, gfigs[0]), mode, ...extra });
    // On a photo scene the photo takes the top of the frame and the panel sits under it (no overlay, no scrim over the panel).
    const splitScene = (sc) => { sc.rect = PHOTO_RECT; sc.gradient = "rgba(0,0,0,0)"; sc.kicker_y = 880; sc.graphic = graphicFor("split"); return sc; };
    // Places the sentence names (a big country alone is not worth a map: it would be on screen for every news item)
    const GENERIC = new Set(["United States of America", "United Kingdom", "China", "Russia"]);
    const placeHits = !gfigs.length ? matchPlaces(sentence).filter((h) => h.f.kind === "state" || !GENERIC.has(h.f.name)) : [];
    const mapOk = placeHits.length && mapsShown < 3 && lastAsset !== "map";
    const base = { fit: "cover", filter: look.filter, gradient: look.scrim, layout: "lower", fade };
    let scene = null;
    let how = "";

    // 1. a verified photo of a named entity the sentence names
    for (const ent of entitiesIn(sentence, idx)) {
      let photo = photoByName.get(ent.name);
      if (photo === undefined && photos < maxPhotos) {
        // The name as the script has it, then without an honorific ("Sir Brian Leveson" -> "Brian Leveson", the title Wikipedia uses).
        let r = null;
        for (const candidate of nameVariants(ent.name)) {
          r = await resolve({ type: ent.kind, name: candidate, context: research?.strongest_angle || "" }).catch((e) => ({ ok: false, why: String(e.message || e) }));
          if (r?.ok) break;
        }
        photo = r?.ok ? r : null;
        photoByName.set(ent.name, photo);
        if (photo) photos++;
        else misses.push({ sentence: i, entity: ent.name, why: r?.why });
      }
      if (!photo) continue;
      const id = `photo-${ent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      if (id === lastAsset) continue; // never the same picture two scenes running
      assets[id] = { file: photo.file, width: photo.width, height: photo.height, credit: photo.credit, source_url: photo.source_url, license: photo.license };
      scene = { ...base, id: `s${i}-${id}`, asset: id, fy: ent.kind === "person" ? 0.3 : 0.5, kicker: ent.name };
      if (gfigs.length) splitScene(scene);
      how = `verified photo of ${ent.name}${gfigs.length ? ` + ${gfigs[0].kind === "year" ? "timeline" : "figure"} ${gfigs[0].raw}` : ""}`;
      break;
    }

    // 1b. no verified photo, but the sentence names a country or a US state: a DRAWN MAP with it highlighted (outlines draw on, the place fills)
    if (!scene && mapOk) {
      const geo = mapFor({ highlight: placeHits.slice(0, 3) });
      const id = `card-${i}`;
      cards.push({ id, svg: backdropSvg(palette) });
      mapsShown++;
      scene = { id: `s${i}-map`, asset: id, fit: "cover", fade };
      scene.graphic = { id: `g${i}`, kind: "map", figs: [{ raw: placeHits[0].f.name, kind: "place" }], source: defaultSource, fn, look: look.name, label: "", mode: "hero", places: geo };
      how = `map of ${placeHits.slice(0, 3).map((h) => h.f.name).join(", ")}`;
    }

    // 2. a real photo of the concept the sentence is about (+ its figure drawn over it). The scene-director payoff is a flat poster instead.
    if (!scene && queries[i]) {
      const c = await concept({ query: queries[i], sentence, used: usedFiles }).catch(() => null);
      if (c) {
        usedFiles.add(c.file);
        const id = `concept-${i}`;
        assets[id] = { file: c.file, width: c.width, height: c.height, credit: c.credit, source_url: c.source_url, license: c.license };
        scene = { ...base, id: `s${i}-${id}`, asset: id };
        if (gfigs.length) splitScene(scene);
        how = `concept photo "${queries[i]}"${gfigs.length ? ` + ${gfigs[0].kind === "year" ? "timeline" : "figure"} ${gfigs[0].raw}` : ""}`;
      } else misses.push({ sentence: i, entity: `concept "${queries[i]}"`, why: "no acceptable Commons photo" });
    }

    // 3. no photo: the figure alone on a flat colour, or the sentence's key words as a poster
    if (!scene) {
      const id = `card-${i}`;
      if (gfigs.length) {
        // A quiet flat backdrop (no gradient) with the graphic animated over it; the backdrop is an image layer so the
        // final-MP4 QA still sees motion on every image layer.
        cards.push({ id, svg: backdropSvg(palette) });
        how = `figure alone ${gfigs.map((f) => f.raw).join(", ")}`;
      } else {
        // No photo for this sentence and no figure to draw: show the story's own picture again, framed differently, as an editor reuses a
        // shot (a verified photo of the subject first, then a concept photo; never the one on screen a moment ago). A poster of key words
        // is the last resort, only when the video has no photo at all.
        const uses = (a) => scenes.filter((x) => x.asset === a).length;
        const pool = Object.keys(assets).filter((a) => /^(photo|concept)-/.test(a) && a !== lastAsset && uses(a) < 5).sort((a, b) => (a.startsWith("photo-") ? 0 : 1) - (b.startsWith("photo-") ? 0 : 1));
        if (pool.length) {
          const reuse = pool[Math.floor(rng() * Math.min(pool.length, 2))];
          scene = { ...base, id: `s${i}-${reuse}-again`, asset: reuse, scale: 1.25, fx: pick(rng, [0.25, 0.75]), fy: pick(rng, [0.3, 0.7]) };
          how = `${reuse} again, re-framed`;
        } else {
          cards.push({ id, svg: look.poster({ phrase: keyPhrase(sentence).length ? keyPhrase(sentence) : [String(defaultSource || "THE SOURCES").toUpperCase()], source: defaultSource }) });
          how = "key-word poster";
        }
      }
      if (!scene) {
        const onBackdrop = gfigs.length > 0 && /^card-/.test(id);
        scene = { id: `s${i}-${id}`, asset: id, fit: "cover", fade };
        if (gfigs.length) scene.graphic = graphicFor("hero", { backdrop: onBackdrop });
      }
    }

    lastAsset = scene.graphic?.kind === "map" ? "map" : scene.asset;
    scene.look = look.name;

    // Two visuals per sentence: a viewer's eye is held by a change every couple of seconds. The second beat is a different, contextual
    // picture (the second concept photo for this sentence) or, failing that, a hard cut to a tighter crop of the same photo; a figure's
    // panel arrives on the second beat, so the number lands after the picture has set the scene.
    const dur = end - start;
    const isPhoto = (sc) => /^(photo|concept)-/.test(sc.asset);
    const ask2 = [queries2[i], queries[i]].filter((q, k, a) => q && a.indexOf(q) === k && !how.includes('"' + q + '"'));
    const secondPhoto = async () => {
      for (const q of ask2) {
        const c = await concept({ query: q, sentence, used: usedFiles }).catch(() => null);
        if (!c) continue;
        usedFiles.add(c.file);
        const id = `concept-${i}b`;
        assets[id] = { file: c.file, width: c.width, height: c.height, credit: c.credit, source_url: c.source_url, license: c.license };
        return { id, how: `concept photo "${q}"` };
      }
      return null;
    };
    const tight = (sc, extra = {}) => ({ ...sc, id: sc.id + "b", graphic: undefined, kicker: undefined, kicker_y: undefined, rect: undefined, gradient: look.scrim, fade: 0, scale: 1.3, fx: pick(rng, [0.25, 0.75]), fy: pick(rng, [0.3, 0.65]), ...extra });
    const cutAt = start + dur * (0.42 + rng() * 0.16);
    let first = scene;
    let second = null;
    if (dur >= 2.6) {
      if (scene.graphic && scene.graphic.mode === "split") {
        // photo on its own first, then the same story with its chart under it (a second photo if one fits, else a tighter crop)
        const alt = await secondPhoto();
        first = { ...scene, id: scene.id + "a", graphic: undefined, rect: undefined, gradient: look.scrim, kicker_y: undefined };
        second = alt
          ? { ...scene, id: `s${i}-${alt.id}`, asset: alt.id, kicker: undefined, fade: 0 }
          : { ...scene, id: scene.id + "b", kicker: undefined, fade: 0, scale: 1.3, fx: pick(rng, [0.25, 0.75]), fy: pick(rng, [0.3, 0.65]) };
        how += alt ? ` then ${alt.how}` : " then a tighter crop";
      } else if (scene.graphic) {
        // a map or a figure on its own backdrop: then a real photo of the same sentence
        const alt = await secondPhoto();
        if (alt) { second = { ...base, id: `s${i}-${alt.id}`, asset: alt.id }; how += ` then ${alt.how}`; }
      } else if (isPhoto(scene)) {
        const alt = await secondPhoto();
        if (alt) { second = { ...base, id: `s${i}-${alt.id}`, asset: alt.id, fade: 0 }; how += ` then ${alt.how}`; }
        else if (dur >= 3.4) { second = tight(scene); how += " then a tighter crop"; }
      } else if (/^card-/.test(scene.asset)) {
        const alt = await secondPhoto();
        if (alt) { second = { ...base, id: `s${i}-${alt.id}`, asset: alt.id, fade: 0 }; how += ` then ${alt.how}`; }
      }
    }
    if (second) {
      second.look = look.name;
      scenes.push({ ...first, start: Number(start.toFixed(3)), end: Number(cutAt.toFixed(3)), stagger: look.stagger });
      scenes.push({ ...second, start: Number(cutAt.toFixed(3)), end: Number(end.toFixed(3)), stagger: look.stagger });
      lastAsset = second.graphic?.kind === "map" ? "map" : second.asset;
    } else {
      scenes.push({ ...scene, start: Number(start.toFixed(3)), end: Number(end.toFixed(3)), stagger: look.stagger });
    }
    report.push({ sentence: i, shows: how, start: Number(start.toFixed(2)), end: Number(end.toFixed(2)) });
  }

  const plan = {
    id: stem.replace(/-shorts-script$/, ""),
    title: research?.strongest_angle ? String(research.strongest_angle).slice(0, 90) : stem,
    audio: audioPath,
    transcript: transcriptPath,
    script: scriptPath,
    fps: 30,
    palette,
    fonts: { primary: font, sans: font },
    caption_style: { x: 80, y: 1540, w: 920, h: 210, size: 38 },
    caption_replacements: {},
    assets,
    scenes,
  };
  return { plan, cards, report: { spans: spanSource, scenes: report, photos, misses, style: look.name, look: lookId } };
}
