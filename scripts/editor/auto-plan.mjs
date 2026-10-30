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

const clean = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const KIND = { person: "person", people: "person", place: "place", location: "place", city: "place", country: "place", organization: "organization", company: "organization", agency: "organization", institution: "organization", university: "organization" };

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

const PERCENT = /(\d+(?:\.\d+)?)\s?(?:%|percent\b)/gi;
const MONEY = /[$£€]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|billion|trillion|thousand))?/gi;
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
  return found.sort((a, b) => a.index - b.index);
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

const MOTIONS = ["in", "pan-left", "out", "pan-right"];

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
export async function buildAutoPlan({ script, research, words, audioDuration, channel, stem, audioPath, transcriptPath, scriptPath, resolve, concept = async () => null, queries = [], style = 1, maxPhotos = 8 }) {
  const sentences = scriptSentences(script);
  if (!sentences.length) throw new Error(`auto-plan: ${stem} has no spoken sentences`);
  if (!(audioDuration > 0)) throw new Error(`auto-plan: ${stem} has no audio duration`);
  const exact = sentenceSpans(words, sentences.length, audioDuration);
  const spans = exact || proportionalSpans(sentences, audioDuration);
  const spanSource = exact ? "voiceover" : "proportional";

  const colors = channel?.colors || {};
  const palette = { bg: colors.bg || "#07070D", text: "#F5F5FF", muted: "#C9CDD6", accent: colors.canvas_accent || colors.accent || "#D4A574", accent2: colors.accent || "#D4A574" };
  const look = styleFor(style, palette);
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
  const n = sentences.length;

  for (let i = 0; i < n; i++) {
    const sentence = sentences[i];
    const { start, end } = spans[i];
    const motion = MOTIONS[i % MOTIONS.length];
    const fn = functionOf(i, n);
    const figs = extractFigures(sentence).filter((f) => researchStates(research, f));
    const figSource = hostOf((research?.numbers || []).find((nn) => figs.some((f) => digitsOf(f.raw) === String(nn.value).replace(/[^\d.]/g, "")))?.source_url) || defaultSource;
    const overlayFor = (id) => {
      cards.push({ id, svg: look.figure({ figs, source: figSource, fn }) });
      return id;
    };
    const base = { fit: "cover", motion, filter: look.filter, gradient: look.scrim, layout: "lower" };
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
      if (figs.length) scene.overlay = overlayFor(`overlay-${i}`);
      how = `verified photo of ${ent.name}${figs.length ? ` + figure ${figs[0].raw}` : ""}`;
      break;
    }

    // 2. a real photo of the concept the sentence is about (+ its figure drawn over it). The scene-director payoff is a flat poster instead.
    if (!scene && !(look.payoffIsPoster && fn === "payoff" && figs.length) && queries[i]) {
      const c = await concept({ query: queries[i], used: usedFiles }).catch(() => null);
      if (c) {
        usedFiles.add(c.file);
        const id = `concept-${i}`;
        assets[id] = { file: c.file, width: c.width, height: c.height, credit: c.credit, source_url: c.source_url, license: c.license };
        scene = { ...base, id: `s${i}-${id}`, asset: id };
        if (figs.length) scene.overlay = overlayFor(`overlay-${i}`);
        how = `concept photo "${queries[i]}"${figs.length ? ` + figure ${figs[0].raw}` : ""}`;
      } else misses.push({ sentence: i, entity: `concept "${queries[i]}"`, why: "no acceptable Commons photo" });
    }

    // 3. no photo: the figure alone on a flat colour, or the sentence's key words as a poster
    if (!scene) {
      const id = `card-${i}`;
      if (figs.length) {
        const flat = look.name === "scene-director" && fn === "payoff" ? null : (look.name === "hallmark" ? "#15130F" : palette.bg);
        const svgText = look.figure({ figs, source: figSource, fn });
        cards.push({ id, svg: flat ? withBg(svgText, flat) : svgText });
        how = `figure alone ${figs.map((f) => f.raw).join(", ")}`;
      } else {
        cards.push({ id, svg: look.poster({ phrase: keyPhrase(sentence), source: defaultSource }) });
        how = "key-word poster";
      }
      scene = { id: `s${i}-${id}`, asset: id, fit: "cover", motion };
    }

    lastAsset = scene.asset;
    scenes.push({ ...scene, start: Number(start.toFixed(3)), end: Number(end.toFixed(3)), stagger: look.stagger });
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
  return { plan, cards, report: { spans: spanSource, scenes: report, photos, misses, style: look.name } };
}
