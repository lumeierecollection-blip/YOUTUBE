/**
 * spec/fromBeats.js — LAYOUT-SYSTEM.md §8.1: Beat[] → ShotSpec[].
 *
 * The Stage-6 inline stand-in (data/audit/6/build-shots.mjs `beatToShotSpec`)
 * lifted into the real spec module (SFR-LAY-6-2, data/audit/6 ledger), plus
 * the PROGRESS chart layer with the Stage-8 ENC honesty gates
 * (CHECK-REGISTER §3.5, rows ENC-08..15, ENC-20..24) and the Stage-9
 * per-archetype layer contract (MANUAL Part F + DETAIL-REFERENCE A4) with the
 * ENC-01..07 / ENC-16..19 gates (data/audit/9 ledger, CLAIM-ENC-9-01..05).
 *
 * PURE — no React, no Remotion. Runs in Node (schema.js / toEnglish.js
 * contract; compile.js consumes its output).
 *
 * Layer recipes (stage-9, CLAIM-ENC-9-01/02/03):
 *   - every beat: kicker + rail + caption
 *   - headline: content + enter timing per archetype (unit / term /
 *     consequence / relation word / subject; LIST_ITEM has NO headline — no
 *     producer exists, SFR-ENC-9-4)
 *   - accent: the 4 px rule ONLY for TERM_DEFINE (F2: "the rule is the accent
 *     element for this beat", MANUAL:1006); the chart highlight for PROGRESS
 *     (F5); the other accents live in the peer-lane Stage (F1 numeral, F3
 *     badge, F4 key element) or do not exist (F6/F7/F8) — the COL-11/L7
 *     "exactly one accent" wording conflict is SFR-ENC-9-1
 *   - PROGRESS with a single series point: downgraded to HERO_NUMBER — never
 *     a one-bar chart (ENC-22 / DETAIL-REFERENCE H8)
 *
 * Chart data honesty (each violation THROWS with the beat id — a data
 * error becomes a build error, R4):
 *   - ENC-08  — chart beat without `beat.data.series` throws (E3.1/E3.2)
 *   - ENC-09  — >5 series points throws (E3.3, C2.6)
 *   - ENC-24  — non-finite value throws — values are printed EXACTLY as
 *               given; nothing may silently become 0 (H3)
 *   - ENC-10  — negative value throws — the axis origin is zero and bars
 *               only grow upward (C2.4; compile.js would silently flip the
 *               sign of a negative value)
 *   - ENC-21  — a per-point unit differing from the chart unit throws — two
 *               values share an axis only when they share a unit (H5)
 *   - ENC-20  — unit "%" with no percentage in the voiceover throws — a
 *               percentage is only shown when the script states one (H4)
 *   - ENC-13  — exactly one `highlight: true` point is required — the
 *               referent comes from the DATA, never derived as the first
 *               point or the largest value (C2.7, H7, L7)
 *   - ENC-23  — 3+ year-like labels with unequal intervals throw — a time
 *               comparison uses equal intervals or states them (H6); labels
 *               that are not year-like are skipped (documented limitation)
 *
 * Stage-9 honesty gates (CHECK-REGISTER §3.5, stage 9):
 *   - ENC-01 — STATEMENT >30% of the beats array throws (F8/H-blocker)
 *   - ENC-02 — any archetype repeating >2× consecutively throws
 *   - ENC-03 — every beat has exactly one anchorTokenIndex, in wordTokens
 *   - ENC-04 — the stage anchor tA = anchorFrame − startFrame resolves inside
 *              the beat ([tA−4, tA+2] must be able to exist)
 *   - ENC-16 — at most one Stage-slot layer per spec (recipes emit 0 or 1;
 *              the ≤4 frame limit is completed by peer-lane stage content)
 *   - ENC-18 — IMAGE_BEAT >20% of the beats array throws (E2.1)
 *   ENC-05/06/07/19 are source-level (gate Run 4 greps); ENC-17 needs the
 *   channel's `concepts` — config gap, C4 side-table, SFR-ENC-9-3.
 *
 * The compiler (layout/compile.js chartRect) then resolves interior
 * geometry from the chart content; fromBeats never computes pixels.
 */

import { MG_TYPE } from "../compositions/beats.js";
import { normalizeUnit, parseNumber } from "../compositions/mg-package.js";

/** §3.7/§5.3 — a headline is 1 line at ≥84 px: anchor phrase ≤16 chars
 *  (build-shots.mjs:127-140 — the proven stand-in rule). */
const HEADLINE_MAX_CHARS = 16;

/** E3.3 / C2.6 / ENC-09 — maximum 5 series points. */
const MAX_SERIES_POINTS = 5;

/** CLAIM-ENC-9-03 — per-archetype headline RISE delay, frames after tA
 *  (MANUAL F1/F2/F6/F7/F8 tables + legacy HEADLINE_DELAY,
 *  motion-graphics.jsx:48-57; PROGRESS retains stage-8's anchor+8 — F5/A4
 *  declare no PROGRESS headline event). */
const HEADLINE_DELAY = {
  HERO_NUMBER: 8,
  TERM_DEFINE: 0,
  RELATION: 18,
  STATEMENT: 0,
  IMAGE_BEAT: 6,
  CONTRAST: 0,
  LIST_ITEM: 0,
  PROGRESS: 8,
};

/** CLAIM-ENC-9-01 — RELATION headline = the relation word, uppercase. The
 *  fallback mirrors deriveScene's splitRelation EXACTLY: the same 19-marker
 *  list and the same list-order-first-match semantics (indexOf per marker,
 *  mg-package.js:127-161) — NOT the provisional 4-item list, which the
 *  stage-9 counter-check rejected (THEN is a LIST_ITEM marker and WHILE a
 *  CONTRAST pivot in the live classifiers; §7 verdict 1). Kept in sync by
 *  the gate's source-level marker comparison (Run 4) and SFR-ENC-9-6. */
const RELATION_MARKERS = [
  "because", "means that", "leads to", "caused by", "driven by", "thanks to",
  "due to", "resulting in", "connected to", "linked to", "depends on",
  "turns into", "powered by", "fueled by", "running on", "run on",
  "made of", "exactly like", "like",
];

/** §2.1.3-safe entrance — "anchor+delay" unless the anchor sits too late in
 *  the beat for the delay before the "end−6" fade; then "end−6". The default
 *  delay of 8 preserves the stage-8 HERO_NUMBER behaviour. */
export function headlineEnterAt(anchorFrame, dur, delay = 8) {
  return anchorFrame + delay <= dur - 6 ? `anchor+${delay}` : "end-6";
}

/** The headline fallback: the beat's own anchor phrase, ≤maxChars and ≤4
 *  tokens (CLAIM-ENC-9-01 — CONTRAST's anchor is the first token after the
 *  pivot marker, i.e. the consequence start; beats.js pickAnchorTokenIndex). */
export function headlineFor(beat, maxChars = HEADLINE_MAX_CHARS, maxTokens = 4) {
  const tokens = beat.wordTokens || [];
  const anchor = tokens[beat.anchorTokenIndex];
  if (!anchor) return String(beat.text || "").split(/\s+/)[0] || "";
  let phrase = anchor.text;
  let words = 1;
  for (let i = beat.anchorTokenIndex + 1; i < tokens.length; i++) {
    if (words >= maxTokens) break;
    const next = `${phrase} ${tokens[i].text}`;
    if (next.length > maxChars) break;
    phrase = next;
    words += 1;
  }
  return phrase;
}

/** scene.headline when it carries a real value, else the fallback. */
function sceneOr(beat, fallback) {
  const h = beat.scene && beat.scene.headline;
  return h && String(h).trim() ? String(h).trim() : fallback;
}

/** CLAIM-ENC-9-01 — HERO_NUMBER headline = the unit: real data first, then
 *  the production scene, then the caption's own number unit. Empty → the
 *  headline layer is omitted (an invented phrase is never printed). */
function heroNumberHeadline(beat) {
  const fromData = beat.data && beat.data.unit ? normalizeUnit(beat.data.unit) : "";
  if (fromData) return fromData;
  const fromScene = beat.scene && beat.scene.headline;
  if (fromScene && String(fromScene).trim()) return String(fromScene).trim();
  // parseNumber can return null for classifier-marked HERO_NUMBER captions
  // ("thirty-five species" — a digit-less compound; beats.js classifyBeat's
  // word list is wider than parseNumber's parser). Null → "" → layer omitted:
  // no invented unit, never a crash. The value-side fix (parseNumber compound
  // support) is requested on mg-package.js — SFR-ENC-9-6.
  const n = parseNumber(String(beat.text || ""));
  return n ? normalizeUnit(n.unit) : "";
}

/** CLAIM-ENC-9-01 — RELATION headline = the relation word, uppercase. */
function relationHeadline(beat) {
  const fromScene = beat.scene && beat.scene.headline;
  if (fromScene && String(fromScene).trim()) return String(fromScene).trim();
  const lower = String(beat.text || "").toLowerCase();
  for (const marker of RELATION_MARKERS) {
    if (lower.indexOf(marker) >= 0) return marker.toUpperCase();
  }
  return headlineFor(beat);
}

/** CLAIM-ENC-9-01 — IMAGE_BEAT / STATEMENT headline = who or what. */
function subjectHeadline(beat) {
  const fromScene = beat.scene && beat.scene.headline;
  if (fromScene && String(fromScene).trim()) return String(fromScene).trim();
  const label = beat.data && beat.data.subjectLabel;
  if (label && String(label).trim()) return String(label).trim();
  return headlineFor(beat);
}

/** CLAIM-ENC-9-01 — the headline text for a beat's archetype, or "" when no
 *  honest source exists (LIST_ITEM — SFR-ENC-9-4). */
export function headlineTextFor(beat) {
  switch (beat.archetype) {
    case "HERO_NUMBER":
      return heroNumberHeadline(beat);
    case "TERM_DEFINE":
      return sceneOr(beat, headlineFor(beat));
    case "RELATION":
      return relationHeadline(beat);
    case "CONTRAST":
      return sceneOr(beat, headlineFor(beat));
    case "IMAGE_BEAT":
    case "STATEMENT":
      return subjectHeadline(beat);
    case "PROGRESS":
      return sceneOr(beat, headlineFor(beat));
    case "LIST_ITEM":
      return "";
    default:
      return headlineFor(beat);
  }
}

/** ENC-03/04 — the beat's single anchor and its stage window resolve inside
 *  the beat. annotateBeats always produces these; a hand-built beat that
 *  skips them is a build error, not a silent default (R4). */
function assertAnchor(beat, id) {
  const a = beat.anchorTokenIndex;
  if (!Number.isInteger(a) || a < 0) {
    throw new Error(
      `${id} ENC-03: every beat has exactly one anchorTokenIndex — got ${JSON.stringify(a)}`
    );
  }
  const tokens = beat.wordTokens || [];
  if (a >= tokens.length) {
    throw new Error(`${id} ENC-03: anchorTokenIndex ${a} points past wordTokens (${tokens.length})`);
  }
  if (!Number.isInteger(beat.anchorFrame) || !Number.isInteger(beat.startFrame)) {
    throw new Error(
      `${id} ENC-04: anchorFrame/startFrame must be integer frames (got ` +
        `${JSON.stringify(beat.anchorFrame)}, ${JSON.stringify(beat.startFrame)})`
    );
  }
  const tA = beat.anchorFrame - beat.startFrame;
  if (tA < 0 || tA > beat.durationInFrames) {
    throw new Error(
      `${id} ENC-04: stage entrance tA=${tA} resolves outside [0, ${beat.durationInFrames}] — ` +
        `the [tA−4, tA+2] window must exist inside the beat`
    );
  }
}

/** ENC-16 — the spec recipe never emits more than one Stage-slot layer (the
 *  chart); a future recipe adding a second is a build error. The frame limit
 *  is 4; the rest of the Stage is peer-lane content. */
function assertStageLayerCount(layers, id) {
  const stage = layers.filter((l) => l.slot === "stage").length;
  if (stage > 1) {
    throw new Error(`${id} ENC-16: ${stage} Stage-slot layers (frame limit 4; recipes emit at most 1)`);
  }
}

/**
 * ENC-23 / H6 — a time comparison uses equal intervals, or states them.
 * Verifiable part: ≥3 labels that are all plain integers ≥1000 (year-like)
 * must be equally spaced. Two points have one interval (trivially equal);
 * labels that are not year-like cannot be interval-checked in code — that
 * remainder is recorded as a documented limitation (audit-encoding ledger §5).
 */
export function assertEqualYearIntervals(series, id) {
  if (series.length < 3) return;
  const isYear = (label) => {
    const s = String(label ?? "").trim();
    if (!/^\d{4,}$/.test(s)) return false;
    const n = Number(s);
    return Number.isInteger(n) && n >= 1000;
  };
  if (!series.every((p) => isYear(p.label))) return; // limitation: not verifiable
  const years = series.map((p) => Number(p.label));
  const deltas = [];
  for (let i = 1; i < years.length; i++) deltas.push(years[i] - years[i - 1]);
  if (deltas.some((d) => d - deltas[0] > 1e-6 || d - deltas[0] < -1e-6)) {
    throw new Error(
      `${id} PROGRESS: time labels ${years.join(", ")} have unequal intervals ` +
        `(${deltas.join(", ")}) — a time comparison uses equal intervals or states them (ENC-23, H6)`
    );
  }
}

/**
 * Basic series validation (ENC-08/09/24/10/21/20). Returns { series, unit }
 * on success; throws with the beat id on any violation. Does NOT check the
 * highlight or the time intervals — those apply only when the series is a
 * real chart (≥2 points, ENC-22 downgrades the 1-point case first).
 */
export function validateSeriesData(beat, id) {
  const data = beat.data;
  const series = data && Array.isArray(data.series) ? data.series : null;
  if (!series || series.length < 1) {
    throw new Error(
      `${id} PROGRESS: beat.data.series is required — numbers come from the research JSON, never from regex over the voiceover (ENC-08, E3.1/E3.2)`
    );
  }
  if (series.length > MAX_SERIES_POINTS) {
    throw new Error(
      `${id} PROGRESS: ${series.length} series points exceeds the ${MAX_SERIES_POINTS} maximum (ENC-09, E3.3/C2.6)`
    );
  }
  const unit = String(data.unit ?? "");
  for (let i = 0; i < series.length; i++) {
    const p = series[i] || {};
    const v = Number(p.value);
    if (!Number.isFinite(v)) {
      throw new Error(
        `${id} PROGRESS: series[${i}].value ${JSON.stringify(p.value)} is not a finite number — ` +
          `values are printed exactly as given, nothing silently becomes 0 (ENC-24, H3)`
      );
    }
    if (v < 0) {
      throw new Error(
        `${id} PROGRESS: series[${i}].value ${v} is negative — the axis origin is zero and bars only grow upward (ENC-10, C2.4)`
      );
    }
    if (p.unit !== undefined && p.unit !== null && String(p.unit) !== unit) {
      throw new Error(
        `${id} PROGRESS: series[${i}].unit ${JSON.stringify(p.unit)} differs from the chart unit ` +
          `${JSON.stringify(unit)} — two values share an axis only when they share a unit (ENC-21, H5)`
      );
    }
  }
  // ENC-20 / H4 — a percentage is only shown when the script states one.
  if (unit.includes("%")) {
    const text = String(beat.text ?? "");
    if (!/%|percent|per\s?cent/i.test(text)) {
      throw new Error(
        `${id} PROGRESS: unit "${unit}" but the voiceover does not state a percentage — ` +
          `a percentage is only shown when the script states one (ENC-20, H4)`
      );
    }
  }
  return { series, unit };
}

/**
 * The chart layer content for a PROGRESS beat (≥2 points). Values and the
 * highlight flag pass through EXACTLY from beat.data (ENC-13/24 — no
 * derivation, no rounding); throws when the data cannot be charted
 * honestly (ENC-13/23, L7).
 */
export function chartContentFor(beat, id) {
  const { series, unit } = validateSeriesData(beat, id);
  if (series.length === 1) {
    throw new Error(
      `${id} PROGRESS: single-point series must downgrade to HERO_NUMBER (ENC-22, H8) — this is a chart-content call`
    );
  }
  const highlightCount = series.filter((p) => p.highlight === true).length;
  if (highlightCount !== 1) {
    throw new Error(
      `${id} PROGRESS: ${highlightCount} highlighted points (want exactly 1) — the data must name the ` +
        `referent point; it is never derived as the largest or the first (ENC-13, C2.7/H7, L7)`
    );
  }
  assertEqualYearIntervals(series, id); // ENC-23 / H6 (verifiable part)
  return {
    unit,
    series: series.map((p) => ({
      label: p.label,
      value: Number(p.value), // exact data value — printed as-is (ENC-24)
      highlight: p.highlight === true, // straight from data (ENC-13)
    })),
  };
}

// ── Layer recipes ─────────────────────────────────────────────────────────────

/** Section for the kicker label: the caller's section table when provided
 *  (stage 9 passes it), else the beat's own sectionIndex. */
function sectionFor(beat, opts) {
  const table = opts && Array.isArray(opts.sections) ? opts.sections : null;
  const idx = beat.sectionIndex ?? 0;
  if (table) return table[idx] || table[0];
  return { index: idx, id: `section_${idx + 1}` };
}

function kickerLayer(section) {
  return {
    role: "kicker",
    slot: "kicker",
    content: { index: section.index + 1, label: section.id },
    enter: { pattern: "RISE", atFrame: 0 },
    exit: { pattern: "NONE" },
  };
}

function railLayer() {
  return { role: "rail", slot: "rail", content: {}, enter: { pattern: "NONE" }, exit: { pattern: "NONE" } };
}

function captionLayer(beat) {
  return {
    role: "caption",
    slot: "caption",
    content: { text: beat.text },
    fit: { maxSize: MG_TYPE.caption, minSize: MG_TYPE.caption, maxLines: 2 },
    enter: { pattern: "RISE", atFrame: 0 },
    exit: { pattern: "NONE" },
  };
}

function headlineLayer(beat, dur, anchorFrame, text, archetype) {
  return {
    role: "headline",
    slot: "headline",
    align: "left",
    content: { text },
    fit: { maxSize: MG_TYPE.headline, minSize: MG_TYPE.headline, maxLines: 1 },
    enter: { pattern: "RISE", atFrame: headlineEnterAt(anchorFrame, dur, HEADLINE_DELAY[archetype] ?? 8) },
    exit: { pattern: "FADE", atFrame: "end-6" },
  };
}

/** The 4 px accent rule — TERM_DEFINE only (F2: "the rule is the accent
 *  element for this beat", MANUAL:1006; CLAIM-ENC-9-02). */
function accentLayer(dur, anchorFrame) {
  return {
    role: "accent",
    slot: "headline",
    content: {},
    enter: { pattern: "DRAW", atFrame: anchorFrame + 6 <= dur - 6 ? "anchor+6" : "end-6" },
    exit: { pattern: "FADE", atFrame: "end-6" },
  };
}

/** The chart layer — role "chart" in the stage slot. The compiler resolves
 *  all interior geometry from `content.series` (compile.js chartRect); the
 *  primitive renders the compiled `chart` object only. */
function chartLayer(content) {
  return {
    role: "chart",
    slot: "stage",
    align: "bottom-left",
    content,
    enter: { pattern: "CHART_BUILD", atFrame: 0 },
    exit: { pattern: "NONE" },
  };
}

/** One beat → one ShotSpec. */
export function beatToShotSpec(beat, beatIndex, opts = {}) {
  const id = `s${sectionFor(beat, opts).index}b${beatIndex}`;
  const dur = beat.durationInFrames;
  const aDelta = beat.anchorFrame - beat.startFrame;
  const anchorFrame = aDelta >= 0 ? aDelta : 0;
  assertAnchor(beat, id); // ENC-03/04 — every beat, before any layer decision
  const base = [kickerLayer(sectionFor(beat, opts)), railLayer(), captionLayer(beat)];

  if (beat.archetype === "PROGRESS") {
    // Data gates run BEFORE any layer decision — a data error is a build error.
    const { series, unit } = validateSeriesData(beat, id); // ENC-08/09/24/10/21/20
    if (series.length === 1) {
      // ENC-22 / H8 — single-point data renders as HERO_NUMBER, never a
      // one-bar chart (mirrors mg-package.js:419-421's downgrade family).
      const text = heroNumberHeadline(beat);
      const layers = text ? [...base, headlineLayer(beat, dur, anchorFrame, text, "HERO_NUMBER")] : base;
      assertStageLayerCount(layers, id); // ENC-16
      return {
        id,
        archetype: "HERO_NUMBER",
        startFrame: beat.startFrame,
        durationInFrames: dur,
        anchorTokenIndex: beat.anchorTokenIndex,
        layers,
      };
    }
    const content = chartContentFor(beat, id); // ENC-13/23 (highlight + intervals)
    const text = headlineTextFor(beat);
    const layers = [
      ...base,
      ...(text ? [headlineLayer(beat, dur, anchorFrame, text, "PROGRESS")] : []),
      chartLayer({ unit, series: content.series }),
    ];
    assertStageLayerCount(layers, id); // ENC-16
    return {
      id,
      archetype: "PROGRESS",
      startFrame: beat.startFrame,
      durationInFrames: dur,
      anchorTokenIndex: beat.anchorTokenIndex,
      layers,
    };
  }

  // Every other archetype: kicker + rail + caption, headline when the
  // archetype has an honest source, and the F2 accent rule for TERM_DEFINE.
  const text = headlineTextFor(beat);
  const layers = [...base];
  if (text) layers.push(headlineLayer(beat, dur, anchorFrame, text, beat.archetype));
  if (beat.archetype === "TERM_DEFINE") layers.push(accentLayer(dur, anchorFrame));
  assertStageLayerCount(layers, id); // ENC-16
  return {
    id,
    archetype: beat.archetype,
    startFrame: beat.startFrame,
    durationInFrames: dur,
    anchorTokenIndex: beat.anchorTokenIndex,
    layers,
  };
}

/** ENC-01/02/18 — array-level honesty: a video whose archetype mix the
 *  classifier could not produce honestly is rejected, not rendered. */
export function assertArchetypeMix(beats) {
  const total = beats.length;
  if (!total) return;
  const statement = beats.filter((b) => b.archetype === "STATEMENT").length;
  if (statement / total > 0.3) {
    throw new Error(
      `ENC-01: ${statement}/${total} beats are STATEMENT (≤30%) — the classifier fell back too often; render rejected (F8/H-blocker)`
    );
  }
  const image = beats.filter((b) => b.archetype === "IMAGE_BEAT").length;
  if (image / total > 0.2) {
    throw new Error(`ENC-18: ${image}/${total} beats are IMAGE_BEAT (≤20%) (E2.1)`);
  }
  let run = 1;
  for (let i = 1; i < beats.length; i++) {
    run = beats[i].archetype === beats[i - 1].archetype ? run + 1 : 1;
    if (run > 2) {
      throw new Error(
        `ENC-02: ${run} consecutive ${beats[i].archetype} beats at index ${i} (no archetype repeats >2×)`
      );
    }
  }
}

/**
 * Beat[] → ShotSpec[]. One spec per beat, in order (the beat's own
 * startFrame/durationInFrames are preserved — the spec never re-times).
 * `opts.sections` mirrors build-shots' section table ({ index, id, ... })
 * for kicker labels; when absent the beat's own sectionIndex is used.
 * Throws on any chart-data or archetype-mix honesty violation
 * (ENC-01/02/03/04/08/09/10/13/16/18/20/21/23/24, H3-H8, F8).
 */
export function fromBeats(beats, opts = {}) {
  if (!Array.isArray(beats)) throw new Error("fromBeats: beats must be an array");
  const specs = beats.map((beat, i) => beatToShotSpec(beat, i, opts));
  assertArchetypeMix(beats); // ENC-01/02/18 — a bad mix rejects the whole video
  return specs;
}

export default fromBeats;
