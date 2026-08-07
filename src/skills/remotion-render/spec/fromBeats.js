/**
 * spec/fromBeats.js — LAYOUT-SYSTEM.md §8.1: Beat[] → ShotSpec[].
 *
 * The Stage-6 inline stand-in (data/audit/6/build-shots.mjs `beatToShotSpec`)
 * lifted into the real spec module (SFR-LAY-6-2, data/audit/6 ledger), plus
 * the PROGRESS chart layer with the Stage-8 ENC honesty gates
 * (CHECK-REGISTER §3.5, rows ENC-08..15, ENC-20..24).
 *
 * PURE — no React, no Remotion. Runs in Node (schema.js / toEnglish.js
 * contract; compile.js consumes its output).
 *
 * Layer recipes (mirror the Stage-6 stand-in exactly, so the proven
 * geometry is preserved):
 *   - every beat: kicker + rail + caption + headline (build-shots:148-173)
 *   - non-chart beats: + the 4 px accent rule (the ONE accent — L7)
 *   - PROGRESS beats: + the chart layer INSTEAD of the accent rule — the
 *     highlight bar IS the frame's one accent (L7, compile.js:295-298;
 *     build-shots:142-144: "chart beats would carry the highlight bar
 *     instead, never both")
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
 * The compiler (layout/compile.js chartRect) then resolves interior
 * geometry from the chart content; fromBeats never computes pixels.
 */

import { MG_TYPE } from "../compositions/beats.js";

/** §3.7/§5.3 — a headline is 1 line at ≥84 px: anchor phrase ≤16 chars
 *  (build-shots.mjs:127-140 — the proven stand-in rule). */
const HEADLINE_MAX_CHARS = 16;

/** E3.3 / C2.6 / ENC-09 — maximum 5 series points. */
const MAX_SERIES_POINTS = 5;

/** §2.1.3-safe entrance — "anchor+8" unless the anchor sits too late in the
 *  beat for an 8-frame rise before the "end−6" fade; then "end−6"
 *  (build-shots.mjs:121-125). */
export function headlineEnterAt(anchorFrame, dur) {
  return anchorFrame + 8 <= dur - 6 ? "anchor+8" : "end-6";
}

/** The headline term: the anchor token phrase, ≤16 chars — one line at
 *  84 px (build-shots.mjs:127-140). */
export function headlineFor(beat, maxChars = HEADLINE_MAX_CHARS) {
  const tokens = beat.wordTokens || [];
  const anchor = tokens[beat.anchorTokenIndex];
  if (!anchor) return String(beat.text || "").split(/\s+/)[0] || "";
  let phrase = anchor.text;
  for (let i = beat.anchorTokenIndex + 1; i < tokens.length; i++) {
    const next = `${phrase} ${tokens[i].text}`;
    if (next.length > maxChars) break;
    phrase = next;
  }
  return phrase;
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

// ── Layer recipes (mirror build-shots.mjs:148-181) ───────────────────────────

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

function headlineLayer(beat, dur, anchorFrame) {
  return {
    role: "headline",
    slot: "headline",
    align: "left",
    content: { text: headlineFor(beat) },
    fit: { maxSize: MG_TYPE.headline, minSize: MG_TYPE.headline, maxLines: 1 },
    enter: { pattern: "RISE", atFrame: headlineEnterAt(anchorFrame, dur) },
    exit: { pattern: "FADE", atFrame: "end-6" },
  };
}

/** The 4 px accent rule — non-chart beats only (the highlight bar replaces
 *  it on chart beats, L7). */
function accentLayer(beat, dur, anchorFrame) {
  return {
    role: "accent",
    slot: "headline",
    content: {},
    enter: { pattern: "DRAW", atFrame: headlineEnterAt(anchorFrame, dur) },
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
  const base = [kickerLayer(sectionFor(beat, opts)), railLayer(), captionLayer(beat)];

  if (beat.archetype === "PROGRESS") {
    // Data gates run BEFORE any layer decision — a data error is a build error.
    const { series, unit } = validateSeriesData(beat, id); // ENC-08/09/24/10/21/20
    if (series.length === 1) {
      // ENC-22 / H8 — single-point data renders as HERO_NUMBER, never a
      // one-bar chart (mirrors mg-package.js:419-421's downgrade family).
      return {
        id,
        archetype: "HERO_NUMBER",
        startFrame: beat.startFrame,
        durationInFrames: dur,
        anchorTokenIndex: beat.anchorTokenIndex,
        layers: [
          ...base,
          headlineLayer(beat, dur, anchorFrame),
          accentLayer(beat, dur, anchorFrame),
        ],
      };
    }
    const content = chartContentFor(beat, id); // ENC-13/23 (highlight + intervals)
    return {
      id,
      archetype: "PROGRESS",
      startFrame: beat.startFrame,
      durationInFrames: dur,
      anchorTokenIndex: beat.anchorTokenIndex,
      layers: [
        ...base,
        headlineLayer(beat, dur, anchorFrame),
        chartLayer({ unit, series: content.series }),
      ],
    };
  }

  // Every other archetype: the generic five layers (build-shots:145-190).
  return {
    id,
    archetype: beat.archetype,
    startFrame: beat.startFrame,
    durationInFrames: dur,
    anchorTokenIndex: beat.anchorTokenIndex,
    layers: [...base, headlineLayer(beat, dur, anchorFrame), accentLayer(beat, dur, anchorFrame)],
  };
}

/**
 * Beat[] → ShotSpec[]. One spec per beat, in order (the beat's own
 * startFrame/durationInFrames are preserved — the spec never re-times).
 * `opts.sections` mirrors build-shots' section table ({ index, id, ... })
 * for kicker labels; when absent the beat's own sectionIndex is used.
 * Throws on any chart-data honesty violation (ENC-08/09/13/20/21/23/24, H3-H8).
 */
export function fromBeats(beats, opts = {}) {
  if (!Array.isArray(beats)) throw new Error("fromBeats: beats must be an array");
  return beats.map((beat, i) => beatToShotSpec(beat, i, opts));
}

export default fromBeats;
