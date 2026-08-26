/**
 * MOTION-GRAPHICS-MANUAL.md — the baked motion-graphics package.
 * PURE module (no React, no Remotion): runs in node for render.js and
 * verify-compositions.js AND in the browser bundle.
 *
 * Turns an SRT + script + channel config into exactly what the composition
 * needs: annotated beats with per-scene data, caption pages with token-level
 * line groups, section ranges, and the total frame count. All scene-level
 * decisions (icon, value, term, before/after, nodes, list runs, accent
 * windows) are made HERE, deterministically, so the JSX stays presentational.
 */

import {
  FPS,
  D,
  parseSRT,
  parseSrtToBeats,
  parseSrtToMotionGraphics,
  assignBeatsToSections,
  buildAuthoredBeats,
  transitionBeforeBeat,
  wrapCaptionWords,
  wordCount,
} from "./beats.js";
import { resolveIcon, isSpecificIconMatch } from "./mg-style.js";
import { planVisual } from "../visual/director.js";
import { buildStates } from "../visual/states.js";
import { summarizeVisuals } from "../visual/diagnostics.js";

export const MG_TAIL_FRAMES = 12; // held tail after the last beat (D3 headline/end)

// ─────────────────────────────────────────────────────────────────────────────
// Small text utilities
// ─────────────────────────────────────────────────────────────────────────────

const STOPWORDS = new Set(
  (
    "a an the of and or but not nor for with by on at in to from as it its this that these those is are was were be been being " +
    "have has had do does did will would shall should can could may might must i you he she we they them their his her our " +
    "me my your our us there here then so if than when while where why how what which who whom because just very all any both each " +
    "more most other some such no yes up down about over under again further out once also only own same too don now"
  ).split(/\s+/)
);

export function contentWord(word) {
  const w = String(word || "").replace(/^[^\w']+|[^\w']+$/g, "");
  return w.length >= 3 && !STOPWORDS.has(w.toLowerCase());
}

export function contentWords(text, max = 3) {
  return String(text || "")
    .split(/\s+/)
    .map((w) => w.replace(/^[^\w']+|[^\w']+$/g, ""))
    .filter(contentWord)
    .slice(0, max);
}

export function overlapCount(aWords, bText) {
  const set = new Set(String(bText || "").toLowerCase().split(/\s+/));
  let n = 0;
  for (const w of aWords) if (set.has(String(w).toLowerCase())) n += 1;
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// Number parsing (HERO_NUMBER / PROGRESS values). Digits first, then a bounded
// word-numeral parser for "ten thousand pounds". Never regex-scrapes a chart.
// ─────────────────────────────────────────────────────────────────────────────

const SMALL = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const SCALES = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 };

export function normalizeUnit(u) {
  if (!u) return "";
  const s = String(u).toLowerCase().replace(/[^a-z%]/g, "");
  if (s === "%" || s === "percent") return "%";
  if (s === "pound" || s === "pounds") return "£";
  if (s === "year" || s === "years") return "YEARS";
  if (s === "month" || s === "months") return "MONTHS";
  if (s === "day" || s === "days") return "DAYS";
  if (s === "week" || s === "weeks") return "WEEKS";
  return s.toUpperCase();
}

export function parseNumber(text) {
  const t = String(text || "");
  const dm = t.match(/(\d[\d,]*(?:\.\d+)?)\s*(%|percent|per\s*cent|million|thousand|hundred|billion|pounds?|£|\$|years?|months?|days?|weeks?)?/i);
  if (dm && /^\d/.test(dm[1])) {
    const value = parseFloat(dm[1].replace(/,/g, ""));
    if (Number.isFinite(value)) return { value, unit: normalizeUnit(dm[2]) };
  }
  const words = t.toLowerCase().split(/\s+/);
  let total = 0;
  let current = 0;
  let seen = false;
  let unit = null;
  let unitIdx = -1;
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/[^a-z%]/g, "");
    if (SMALL[w] !== undefined) {
      current += SMALL[w];
      seen = true;
    } else if (SCALES[w] !== undefined) {
      current = Math.max(current, 1);
      total += current * SCALES[w];
      current = 0;
      seen = true;
    } else if (seen) {
      unitIdx = i;
      break;
    }
  }
  if (!seen) return null;
  if (current) total += current;
  const unitWord = words[unitIdx >= 0 ? unitIdx : words.length - 1] || "";
  unit = normalizeUnit(unitWord);
  return { value: total, unit: total > 0 ? unit : "" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene-data derivation (Part F). Deterministic, no inference beyond the text.
// ─────────────────────────────────────────────────────────────────────────────

const CONTRAST_PIVOTS = [
  "but", "however", "instead", "whereas", "yet", "while", "despite",
  "rather than", "on the other hand", "no longer", "never", "nowhere",
];
const RELATION_MARKERS = [
  "because", "means that", "leads to", "caused by", "driven by", "thanks to",
  "due to", "resulting in", "connected to", "linked to", "depends on",
  "turns into", "powered by", "fueled by", "running on", "run on",
  "made of", "exactly like", "like",
];

function splitAtMarker(text, markers) {
  const lower = String(text || "").toLowerCase();
  for (const marker of markers) {
    const idx = lower.indexOf(marker);
    if (idx >= 0) {
      return { before: text.slice(0, idx).trim(), marker, after: text.slice(idx + marker.length).trim() };
    }
  }
  return null;
}

function splitContrast(text) {
  const split = splitAtMarker(text, CONTRAST_PIVOTS);
  // No marker, OR the marker sits at/near the very start of the sentence
  // ("But the calculators miss the point.") — the latter left `before`
  // empty, rendering a genuinely blank left panel (confirmed on a rendered
  // frame). Fall back to the same before/after-from-the-whole-sentence
  // split used when no marker is found at all, so both panels always carry
  // real content.
  if (!split || !split.before.trim()) {
    return { before: contentWords(text, 3), after: contentWords(text, 3).slice(1), accentWord: 0 };
  }
  const before = contentWords(split.before, 3);
  const after = contentWords(split.after, 3);
  return { before, after, accentWord: 0 };
}

function splitRelation(text) {
  const split = splitAtMarker(text, RELATION_MARKERS);
  if (!split) return { a: contentWords(text, 2), b: contentWords(text, 2).slice(-2), relation: "" };
  return {
    a: contentWords(split.before, 2),
    b: contentWords(split.after, 2),
    relation: split.marker,
  };
}

function termFromBeat(beat) {
  const wts = beat.wordTokens || [];
  const anchor = beat.anchorTokenIndex;
  const words = [];
  if (Number.isInteger(anchor) && wts[anchor]) words.push(wts[anchor].text);
  if (Number.isInteger(anchor) && anchor + 1 < wts.length && contentWord(wts[anchor + 1].text) && words.length < 2) {
    words.push(wts[anchor + 1].text);
  }
  return words.length ? words.join(" ").toUpperCase() : null;
}

// PART 3.4 of the rebuild — "italic serif setup line above bold sans payload
// line" is a deliberate, repeated headline pairing on the reference frames.
// TERM_DEFINE beats are the one archetype with a real, non-fabricated setup
// phrase available: the marker word(s) that introduced the term in the
// voiceover (the same words pickAnchorTokenIndex's firstTokenAfterMarker
// used to find the anchor). Returns null — no setup line, single-line
// headline as before — when the anchor doesn't sit next to a marker word.
const TERM_SETUP_MARKERS = new Set(["called", "known", "named", "records", "holds", "is", "as", "otherwise"]);
function setupLineFromBeat(beat) {
  const wts = beat.wordTokens || [];
  const anchor = beat.anchorTokenIndex;
  if (!Number.isInteger(anchor) || wts.length === 0) return null;
  const isMarker = (tok) => TERM_SETUP_MARKERS.has(String(tok && tok.text || "").replace(/[^a-z]/gi, "").toLowerCase());
  const bare = (tok) => String(tok.text).replace(/[^a-zA-Z]/g, "").toLowerCase();
  const words = [];
  let i = anchor - 1;
  while (i >= 0 && wts[i] && isMarker(wts[i]) && words.length < 3) {
    words.unshift(bare(wts[i]));
    i--;
  }
  if (wts[anchor] && isMarker(wts[anchor]) && words.length < 3) words.push(bare(wts[anchor]));
  return words.length ? words.join(" ") : null;
}

function subjectLabel(beat) {
  const wts = beat.wordTokens || [];
  const anchor = beat.anchorTokenIndex;
  const words = [];
  if (Number.isInteger(anchor) && wts[anchor]) words.push(wts[anchor].text);
  if (Number.isInteger(anchor) && anchor > 0 && words.length < 2 && contentWord(wts[anchor - 1].text)) {
    words.unshift(wts[anchor - 1].text);
  }
  if (!words.length) words.push(...contentWords(beat.text, 2));
  const label = words.map((w) => String(w).replace(/[^a-z0-9'-]/gi, "")).filter(Boolean).join(" ").toUpperCase();
  if (!label) return null;
  return overlapCount(label.split(" "), beat.text) <= 2 ? label : null;
}

function accentWindowFor(beat, scene) {
  const tA = beat.anchorFrame;
  const end = beat.startFrame + beat.durationInFrames;
  const win = (from, to) => [Math.max(from, beat.startFrame), Math.min(to, end)];
  switch (beat.archetype) {
    case "HERO_NUMBER":
      return win(tA - 4, tA + 56);
    case "TERM_DEFINE":
      return win(tA + 6, tA + 20);
    case "LIST_ITEM":
      return win(tA, tA + 6);
    case "CONTRAST":
      return win(tA + 4, tA + 10);
    case "PROGRESS":
      return win(tA - 4, tA + 20);
    case "RELATION":
      return win(tA - 4, tA + 20);
    default:
      return null;
  }
}

export function deriveScene(beat, ctx = {}) {
  const iconMap = ctx.iconMap || null;

  // PART 8 — ICONS ARE NO LONGER RESOLVED FOR EVERY BEAT.
  //
  // This line used to read:
  //   const scene = { icon: resolveIcon(iconMap, beat.text), ... }
  // unconditionally, before the archetype switch below had even run. That
  // single line is where the "large text + icon + dark background" look
  // came from: every beat got a glyph whether or not anything wanted one,
  // resolveIcon() falls back to the channel `default` and then to a literal
  // "sparkles", and StatementScene (motion-graphics.jsx) rendered that glyph
  // as the ENTIRE composition.
  //
  // Now: the visual plan decides. A strategy declares iconRole "secondary"
  // only when a small glyph genuinely helps inside its own composition (a
  // map marker on a map); everything else gets "none" and no icon is even
  // looked up. Scene selection decides whether an icon is useful — icon
  // selection never again decides the scene.
  const plan = beat.visualPlan || null;
  const iconRole = plan ? plan.iconRole : "none";
  const wantsIcon = iconRole === "secondary";

  const scene = {
    iconRole: iconRole || "none",
    icon: wantsIcon ? resolveIcon(iconMap, beat.text) : null,
    iconIsSpecific: wantsIcon ? isSpecificIconMatch(iconMap, beat.text) : false,
  };
  switch (beat.archetype) {
    case "HERO_NUMBER": {
      const n = beat.data && beat.data.value != null ? beat.data : parseNumber(beat.text);
      scene.value = n && Number.isFinite(n.value) ? n.value : 0;
      scene.unit = (beat.data && beat.data.unit) || (n && n.unit) || "";
      scene.headline = scene.unit || null;
      break;
    }
    case "TERM_DEFINE": {
      scene.term = (beat.data && beat.data.term) || termFromBeat(beat);
      scene.headline = scene.term || null;
      scene.setupLine = scene.headline ? setupLineFromBeat(beat) : null;
      break;
    }
    case "CONTRAST": {
      const c = splitContrast(beat.text);
      scene.before = c.before;
      scene.after = c.after;
      scene.accentWord = c.accentWord;
      scene.headline = null;
      break;
    }
    case "RELATION": {
      const r = splitRelation(beat.text);
      scene.a = r.a;
      scene.b = r.b;
      scene.relation = r.relation;
      scene.headline = r.relation ? r.relation.toUpperCase() : null;
      break;
    }
    case "LIST_ITEM": {
      scene.item = contentWords(beat.text, 3).join(" ").toUpperCase() || null;
      scene.headline = null;
      break;
    }
    case "PROGRESS": {
      scene.series = (beat.data && beat.data.series ? beat.data.series.slice(0, 5) : []).map((p, i) => ({
        label: p.label,
        value: p.value,
        highlight: !!(p.highlight || i === 0),
      }));
      scene.unit = (beat.data && beat.data.unit) || "";
      scene.headline = null;
      break;
    }
    case "STATEMENT": {
      scene.headline = subjectLabel(beat);
      break;
    }
    case "IMAGE_BEAT": {
      // PART 6 of the rebuild — imageForSection now returns a treated-asset
      // object ({ path, treatment, mode, credit }) from image-assets.js, not
      // a bare path string. A bare string is still accepted (defends against
      // any caller — verify-compositions.js fixtures, older tests — that
      // still hands a raw path) and treated as an untreated full-bleed photo,
      // matching the composition's pre-rebuild behaviour exactly.
      const resolved = (ctx.imageForSection && ctx.imageForSection(beat.sectionIndex)) || null;
      const asset =
        resolved && typeof resolved === "object"
          ? resolved
          : resolved
            ? { path: resolved, treatment: "fullbleed", mode: null, credit: null }
            : null;
      scene.image = asset ? asset.path : null;
      scene.imageTreatment = asset ? asset.treatment : null;
      scene.credit = (asset && asset.credit) || (beat.data && beat.data.credit) || "";
      scene.headline = subjectLabel(beat);
      break;
    }
    default: {
      scene.headline = subjectLabel(beat);
    }
  }
  scene.accentWindow = accentWindowFor(beat, scene);
  return scene;
}

// ─────────────────────────────────────────────────────────────────────────────
// List runs — consecutive LIST_ITEM beats accumulate chips (F3).
// ─────────────────────────────────────────────────────────────────────────────

export function groupListRuns(beats) {
  let run = -1;
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    if (b.archetype !== "LIST_ITEM") {
      run = -1;
      b.scene.listIndex = -1;
      b.scene.listTotal = 0;
      continue;
    }
    if (run === -1) run = i;
    b.scene.listIndex = i - run;
  }
  let start = -1;
  for (let i = 0; i <= beats.length; i++) {
    const isList = i < beats.length && beats[i].archetype === "LIST_ITEM";
    if (isList && start === -1) start = i;
    if ((!isList || i === beats.length) && start !== -1) {
      for (let k = start; k < i; k++) beats[k].scene.listTotal = i - start;
      start = -1;
    }
  }
  return beats;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section windows from the script's timing strings ("0:00-0:10").
// ─────────────────────────────────────────────────────────────────────────────

export function parseTiming(t) {
  const m = /(\d+):(\d+)\s*[-–—]\s*(\d+):(\d+)/.exec(String(t || ""));
  if (!m) return null;
  return [Number(m[1]) * 60000 + Number(m[2]) * 1000, Number(m[3]) * 60000 + Number(m[4]) * 1000];
}

export function sectionWindowsMs(sections, totalMs, fps = FPS) {
  const secs = sections || [];
  const parsed = secs.map((s) => parseTiming(s && s.timing));
  if (parsed.length > 1 && parsed.every(Boolean)) {
    const lastEnd = parsed[parsed.length - 1][1];
    for (const [from, to] of parsed) if (from >= to) return proportionalWindows(secs, totalMs);
    if (lastEnd > totalMs) return proportionalWindows(secs, totalMs);
    return parsed;
  }
  return proportionalWindows(secs, totalMs);
}

function proportionalWindows(sections, totalMs) {
  const words = sections.map((s) => wordCount((s && s.voiceover) || ""));
  const total = words.reduce((a, b) => a + b, 0) || 1;
  const out = [];
  let acc = 0;
  for (let i = 0; i < sections.length; i++) {
    const from = Math.round((acc / total) * totalMs);
    acc += words[i];
    const to = i === sections.length - 1 ? totalMs : Math.round((acc / total) * totalMs);
    out.push([from, to]);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 4.1 of the rebuild — never state the same fact twice on screen at
// once. A HERO_NUMBER beat renders its value as a giant numeral on the
// Stage for the whole beat window; the caption stream (built independently
// from the same SRT) naturally contains that same digit string at that
// same moment, since it is transcribing the exact word being spoken. Strip
// the matching digit token from any caption page whose display window
// overlaps a HERO_NUMBER beat showing that value — the numeral on Stage
// already carries the fact, spatially adjacent to the caption.
// ─────────────────────────────────────────────────────────────────────────────

function stripHeroNumberTokens(pages, beats) {
  const windows = beats
    .filter((b) => b.archetype === "HERO_NUMBER" && b.scene && Number.isFinite(b.scene.value))
    .map((b) => ({ fromMs: b.startMs, toMs: b.endMs, digits: String(Math.round(b.scene.value)) }));
  if (!windows.length) return pages;
  const isHeroDup = (tok) => {
    const digits = String(tok.text).replace(/[^\d]/g, "");
    if (!digits) return false;
    return windows.some((w) => tok.fromMs >= w.fromMs && tok.fromMs < w.toMs && digits === w.digits);
  };
  return pages
    .map((page) => {
      const tokens = (page.tokens || []).filter((t) => !isHeroDup(t));
      if (tokens.length === (page.tokens || []).length) return page;
      if (tokens.length === 0) return null; // the whole page WAS the number
      const words = tokens.map((t) => t.text);
      return {
        ...page,
        tokens,
        words,
        text: words.join(" ").replace(/\s+([.,;:!?])/g, "$1"),
      };
    })
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// Caption pages → token-level line groups (word→token mapping preserved).
// ─────────────────────────────────────────────────────────────────────────────

export function enrichPages(pages, fps = FPS) {
  return pages.map((page) => {
    const words = page.words || [];
    let tokens = page.tokens || [];
    const withFrames = (t) => ({
      ...t,
      fromFrame: Math.round((t.fromMs / 1000) * fps),
      toFrame: Math.round((t.toMs / 1000) * fps),
    });
    const lines = wrapCaptionWords(words).map((lineStr) => {
      const lineWords = lineStr.split(" ");
      const lineTokens = tokens.slice(0, lineWords.length).map(withFrames);
      tokens = tokens.slice(lineWords.length);
      return lineTokens;
    });
    return {
      ...page,
      lines,
      tokens: page.tokens.map(withFrames),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 7 of the rebuild — "the largest visual move lands at
// script_template.reveal_placement." Channels describe this in free text
// ("50-60% through video", "25/50/85% layered reveals", "65% match, 80%
// identity") — never machine-structured, so this is a deterministic best-
// effort parse, not a guarantee every phrasing is handled perfectly. A
// range ("50-60%") takes its midpoint; several distinct percentages take
// the LARGEST one (read as the climax of a build, e.g. Fraud Files'
// "25/50/85% layered reveals" — the 85% figure is the final, biggest
// reveal, not the first one). No percentage found at all -> no beat is
// marked (honest no-op, not a fabricated default).
// ─────────────────────────────────────────────────────────────────────────────

export function parseRevealTarget(text) {
  const nums = [...String(text || "").matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
  if (!nums.length) return null;
  const rangeMatch = /(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*%/.exec(text);
  if (rangeMatch) return (Number(rangeMatch[1]) + Number(rangeMatch[2])) / 2;
  return Math.max(...nums);
}

export function markReveal(beats, revealPlacementText, totalFrames) {
  const pct = parseRevealTarget(revealPlacementText);
  if (pct == null || !beats.length) return beats;
  const targetFrame = (Math.max(0, Math.min(100, pct)) / 100) * totalFrames;
  let best = null;
  let bestDist = Infinity;
  for (const b of beats) {
    if (b.archetype === "LIST_ITEM") continue; // transient chip accumulation, not a single "big moment"
    const mid = b.startFrame + b.durationInFrames / 2;
    const dist = Math.abs(mid - targetFrame);
    if (dist < bestDist) {
      bestDist = dist;
      best = b;
    }
  }
  if (best) best.scene.isReveal = true;
  return beats;
}

// PART 7 — "respect sfx_profile.silence_technique; settle into a specified
// silence." The beat timeline is locked to the SRT/audio timeline (see this
// file's and motion-graphics.jsx's header — shifting it desyncs captions
// from the voiceover), so this never inserts artificial silence. It only
// DETECTS a real gap already present in the caption stream near the reveal
// beat that is at least as long as the configured technique, and hands
// that window back so the composition can avoid firing new SFX/accent
// events into a pause the voiceover itself is holding. No matching gap ->
// null -> nothing is suppressed (honest: most VO won't happen to pause for
// exactly the configured duration at exactly that moment).
export function computeSilenceWindow(captions, silenceTechniqueText, revealFrame, fps = FPS) {
  const m = /(\d+(?:\.\d+)?)\s*second/i.exec(String(silenceTechniqueText || ""));
  if (!m || revealFrame == null) return null;
  const minGapFrames = Number(m[1]) * fps * 0.6; // 0.6x tolerance — real VO pauses rarely hit an exact figure
  const sorted = [...captions].sort((a, b) => a.startMs - b.startMs);
  const searchWindowMs = 4000; // look within 4s of the reveal beat
  const revealMs = (revealFrame / fps) * 1000;
  let best = null;
  let bestLen = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const gapStartMs = sorted[i].endMs;
    const gapEndMs = sorted[i + 1].startMs;
    const gapFrames = ((gapEndMs - gapStartMs) / 1000) * fps;
    if (gapFrames < minGapFrames) continue;
    if (Math.abs(gapStartMs - revealMs) > searchWindowMs) continue;
    if (gapFrames > bestLen) {
      bestLen = gapFrames;
      best = [Math.round((gapStartMs / 1000) * fps), Math.round((gapEndMs / 1000) * fps)];
    }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildMgPackage — the single entry point used by render.js and verify.
// ─────────────────────────────────────────────────────────────────────────────

export function buildMgPackage(srtText, opts = {}) {
  const fps = opts.fps || FPS;
  const sections = opts.sections || [];

  const rawCaptions = srtText ? parseSRT(srtText) : [];
  let synthesized = false;
  let captions = rawCaptions;
  if (captions.length === 0 && sections.length > 0) {
    synthesized = true;
    const wordsAll = sections.flatMap((s) => String(s.voiceover || "").split(/\s+/).filter(Boolean));
    const totalMs = opts.totalMs || Math.max(wordsAll.length * 450, 30000);
    const windows = sectionWindowsMs(sections, totalMs, fps);
    captions = [];
    for (let s = 0; s < sections.length; s++) {
      const [fromMs, toMs] = windows[s] || [0, totalMs];
      const words = String(sections[s].voiceover || "").split(/\s+/).filter(Boolean);
      if (!words.length) continue;
      const span = Math.max(toMs - fromMs, 1);
      const totalChars = words.reduce((a, w) => a + w.length + 1, 0);
      let acc = 0;
      for (const w of words) {
        const start = fromMs + (acc / totalChars) * span;
        acc += w.length + 1;
        const end = fromMs + (acc / totalChars) * span;
        captions.push({ text: w, startMs: Math.round(start), endMs: Math.round(end), timestampMs: Math.round(start) });
      }
    }
  }

  const audioEndMs = captions.length ? Math.max(...captions.map((c) => c.endMs)) : 0;
  const audioFrames = Math.round((audioEndMs / 1000) * fps);

  const bRollFiles = opts.bRollFiles || [];

  // Prefer the writer's own beats[] (archetype + anchor_token + data.series,
  // already gate-script.js-checked) over the blind regex classifier — see
  // buildAuthoredBeats' header comment in beats.js. Falls back to the
  // classifier path unchanged the moment anything doesn't line up (no
  // sections[].beats, an unmatched anchor_token, a word-count mismatch
  // against the real SRT) so scripts predating this field, and the
  // minimal/cinematic-documentary styles, are unaffected.
  let beats = captions.length ? buildAuthoredBeats(sections, captions, { fps, hook: opts.hook }) : null;
  const usedAuthoredBeats = !!beats;

  if (!beats) {
    beats = parseSrtToBeats(srtText, { bRollFiles, captions: captions.length ? captions : undefined });

    // Sections → beats.
    if (sections.length) {
      const windows = sectionWindowsMs(sections, audioEndMs || opts.totalMs || 60000, fps);
      beats = assignBeatsToSections(beats, windows); // returns a new array (beats.js)
      beats = beats.map(({ _i, ...rest }) => rest); // strip the section-mapping index
    } else {
      for (const b of beats) b.sectionIndex = 0;
    }
  }

  const imageForSection = opts.imageForSection || (() => null);

  // ENC-31 — "every beat that isn't a HERO_NUMBER or chart resolves to a
  // real photo" is enforced here, not left to whatever imageForSection
  // happens to return. image-assets.js's resolveImageAssets already tried
  // (and broadened-and-retried once against the topic) before this ever
  // runs, so a still-empty imageForSection(sectionIndex) means genuinely no
  // manifest match exists for this section. The chain from here: fall back
  // to HERO_NUMBER only if the beat's own text actually carries a number
  // (parseNumber — the same signal/precedent the PROGRESS fallback right
  // below already uses; there is no chart fallback for IMAGE_BEAT in
  // practice, since a plain text beat never carries the structured
  // data.series a chart needs), else STATEMENT — but NEVER silently: every
  // downgrade is pushed onto imageGaps so it shows up in the run's report
  // (render.js writes <slug>-image-gaps.json and echoes a ::warning:: per
  // gap) instead of vanishing into typography-only output unremarked.
  const imageGaps = [];
  // Archetype fallbacks (E3.2, E2.1): no data → downgrade honestly.
  for (const b of beats) {
    if (b.archetype === "PROGRESS" && !(b.data && Array.isArray(b.data.series) && b.data.series.length)) {
      b.archetype = parseNumber(b.text) ? "HERO_NUMBER" : "STATEMENT";
    }
    if (b.archetype === "IMAGE_BEAT" && !imageForSection(b.sectionIndex)) {
      b.archetype = parseNumber(b.text) ? "HERO_NUMBER" : "STATEMENT";
      imageGaps.push({
        sectionIndex: b.sectionIndex,
        text: b.text,
        fallbackArchetype: b.archetype,
        reason: "no asset-library match for this section's cues, even after the topic-broadened retry",
      });
    }
  }

  // IMAGE_BEAT cap ≤20% (E2.1) — a different reason than a sourcing miss
  // (there WAS a real match; the mix ratio just already spent its budget),
  // so tracked as its own, differently-worded gap rather than folded into
  // imageGaps above.
  const imgIdx = beats
    .map((b, i) => (b.archetype === "IMAGE_BEAT" ? i : -1))
    .filter((i) => i >= 0);
  const cap = Math.floor(beats.length * 0.2);
  for (const i of imgIdx.slice(cap)) {
    const b = beats[i];
    b.archetype = parseNumber(b.text) ? "HERO_NUMBER" : "STATEMENT";
    imageGaps.push({
      sectionIndex: b.sectionIndex,
      text: b.text,
      fallbackArchetype: b.archetype,
      reason: "had a real asset-library match, but the IMAGE_BEAT ≤20% mix cap (ENC-18) was already spent",
    });
  }

  // ── VISUAL DIRECTION ───────────────────────────────────────────────────
  // The plan must exist BEFORE deriveScene, because deriveScene now asks
  // the plan whether an icon is wanted at all (PART 8) instead of resolving
  // one for every beat.
  //
  // LIST_ITEM is deliberately not planned: consecutive LIST_ITEM beats are
  // not stage-routed at all, they accumulate as chips through ListRuns,
  // which is already a real non-icon visual system (PART 26 — don't rewrite
  // working systems without evidence).
  const sectionTextFor = (idx) => (sections[idx] && sections[idx].voiceover) || "";
  // Variety pressure needs to know what the last two staged beats chose,
  // or one broad detector wins the whole video (see director.js).
  let recent = [];
  for (const b of beats) {
    if (b.archetype === "LIST_ITEM") {
      b.visualPlan = null;
      b.visualStates = [];
      continue;
    }
    b.visualPlan = planVisual(b, {
      channel: opts.channel || null,
      asset: imageForSection(b.sectionIndex),
      sectionText: sectionTextFor(b.sectionIndex),
      recent,
    });
    recent = [b.visualPlan.strategy, recent[0]].slice(0, 2);
    // Deterministic frame math from the beat's REAL SRT window — no model
    // is ever asked when something happens (PART 24).
    b.visualStates = buildStates(b.visualPlan, {
      startFrame: b.startFrame,
      durationInFrames: b.durationInFrames,
      anchorFrame: b.anchorFrame,
    }, { fps });
  }

  for (const b of beats) b.scene = deriveScene(b, { iconMap: opts.iconMap, imageForSection });

  groupListRuns(beats);

  // TRACE — D2.5, at most one per video, hook icon only.
  const hookBeat = beats.find((b) => b.sectionIndex === 0);
  if (hookBeat) hookBeat.scene.trace = true;

  // AUD-01 — fire each section's resolved sfx_cue (sfx.js) once, on the
  // first beat of that section, so the section's own sound atmosphere
  // actually plays instead of being silently dropped after extraction.
  const sectionSfx = opts.sectionSfx || [];
  if (sectionSfx.some(Boolean)) {
    const seenSections = new Set();
    for (const b of beats) {
      if (seenSections.has(b.sectionIndex)) continue;
      seenSections.add(b.sectionIndex);
      const resolved = sectionSfx[b.sectionIndex];
      if (resolved) b.scene.sfx = resolved.relativePath;
    }
  }

  const rawPages = parseSrtToMotionGraphics(srtText, { captions: captions.length ? captions : undefined }).pages;
  const pages = enrichPages(stripHeroNumberTokens(rawPages, beats), fps);

  const transitions = beats.map((_, i) => transitionBeforeBeat(i, beats));

  const sectionRanges = {};
  for (const b of beats) {
    if (!sectionRanges[b.sectionIndex]) sectionRanges[b.sectionIndex] = { from: b.startFrame, to: b.startFrame + b.durationInFrames };
    else sectionRanges[b.sectionIndex].to = Math.max(sectionRanges[b.sectionIndex].to, b.startFrame + b.durationInFrames);
  }

  const rawTotal = beats.reduce((s, b) => s + b.durationInFrames, 0);
  const totalFrames = Math.max(rawTotal, audioFrames) + MG_TAIL_FRAMES;

  markReveal(beats, opts.revealPlacement, totalFrames);
  const revealBeat = beats.find((b) => b.scene && b.scene.isReveal);
  const silenceWindow = revealBeat
    ? computeSilenceWindow(captions, opts.silenceTechnique, revealBeat.anchorFrame, fps)
    : null;

  return {
    beats,
    captions,
    pages,
    transitions,
    sectionRanges,
    totalFrames,
    audioFrames,
    synthesized,
    usedAuthoredBeats,
    silenceWindow,
    imageGaps,
    // PART 19/20 — every render carries its own visual QA numbers and the
    // reason behind every fallback, so a video that quietly degraded is
    // visible in the run that produced it.
    visual: summarizeVisuals(beats, { fps }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gates H9/H11/H12 — static checks over a built package.
// ─────────────────────────────────────────────────────────────────────────────

export function gateMgHeadlineOverlap(beats) {
  const failures = [];
  for (const b of beats) {
    const h = b.scene && b.scene.headline;
    if (!h) continue;
    const words = h.split(" ");
    if (overlapCount(words, b.text) > 2) {
      failures.push(`headline "${h}" shares >2 words with caption "${b.text}"`);
    }
  }
  return { pass: failures.length === 0, failures };
}

export function gateIconNames(beats, iconSet) {
  const failures = [];
  for (const b of beats) {
    const name = b.scene && b.scene.icon;
    if (name && iconSet && !iconSet[name]) failures.push(`icon "${name}" (beat "${b.text}") not in vendored set`);
  }
  return { pass: failures.length === 0, failures };
}

export function gateChartData(beats) {
  const failures = [];
  for (const b of beats) {
    if (b.archetype === "PROGRESS") {
      const s = b.scene && b.scene.series;
      if (!s || !s.length) failures.push(`PROGRESS beat "${b.text}" has no series data`);
      else if (s.length > 5) failures.push(`PROGRESS beat "${b.text}" has ${s.length} series points > 5`);
    }
  }
  return { pass: failures.length === 0, failures };
}
