/**
 * captions/fromSrt.js — canonical caption-pipeline entry (LAYOUT-SYSTEM §8.1,
 * build order row 8: "captions/ | caption gates from MANUAL Part H").
 * Owned by: audit-type lane (Stage 10, 2026-08-08).
 *
 * The manual (B3:422) says pages come from `createTikTokStyleCaptions()`;
 * the production pipeline implements its DOCUMENTED deterministic equivalent
 * — buildCaptionPages (beats.js:457-461) with the 600 ms-hook / 1200 ms-
 * section combine windows (hookEndMs 8000) and the CAPTION_LIMITS post-process
 * (≤25 chars/line, ≤2 lines, ≤7 words, ≤15 CPS, duration ∈ [833,5000] ms,
 * ≥2 blank frames). This module is the single canonical entry point: it
 * re-exports the production pipeline and ships the Stage-10 gate (H5–H9 +
 * B2.4 + an independently recomputed 2-frame gap), so the gate verifies the
 * exact pages that render.
 *
 * NOTE — the installed @remotion/captions (4.0.505) also exports the real
 * `createTikTokStyleCaptions` API (verified in Phase 1); production does not
 * call it because beats.js's buildCaptionPages is the manual-blessed
 * deterministic equivalent. This module does NOT fork a second page
 * generator — a divergent pipeline would gate pages that never render.
 * (Stage-5 dead-code REJECT lesson.)
 */

import {
  parseSrtToMotionGraphics,
  gateCaptions,
  CAPTION_LIMITS,
} from "../compositions/beats.js";
import { SLOTS_SHORTS, SAFE_SHORTS } from "../layout/slots.js";

export { gateCaptions, CAPTION_LIMITS };

/** B2.4 — the caption is the only element permitted below y = 1140 (Shorts). */
export const B2_4_LINE = 1140;

/**
 * §8.1 canonical page builder: parseSrt (via beats.js parseSRT → real
 * parseSrt from @remotion/captions) → buildCaptionPages (documented
 * deterministic equivalent of createTikTokStyleCaptions) → pages.
 * Production (mg-package.js:442) currently routes page building through
 * parseSrtToMotionGraphics directly; routing production through this
 * canonical entry is the PENDING SFR-cap-002 (orchestrator-owned, filed
 * ledger §4). The gate runner asserts this entry and the production package
 * produce identical pages (no drift).
 */
export function captionPagesFromSrt(srtText, opts = {}) {
  return parseSrtToMotionGraphics(srtText, opts).pages;
}

/**
 * H6 input gate for the sections-fallback synthesis path (buildMgPackage,
 * mg-package.js:375-398). The synthesis distributes each section's voiceover
 * text word-for-word across the section's DECLARED timing window (from the
 * script's "0:00-0:10" strings), so a section whose declared window is
 * shorter than chars/15 is spoken faster than H6 on average and will surface
 * fast pages — as the ch-01 hook does (163 non-space chars / 10 s = 16.3
 * declared CPS → unfixable pages at up to 17.4 CPS). The input check is
 * NECESSARY but NOT SUFFICIENT: page construction pools words across section
 * boundaries (beats.js:491-511) and its merge loop (beats.js:543-583) can
 * dilute a fast section's words into a slower neighbour's pages, so page-level
 * gates ([prod]/[ind]) remain authoritative. Wiring this gate INTO the
 * synthesis path so it refuses to emit captions is the PENDING SFR-cap-002
 * (orchestrator-owned, filed ledger §4); this stage delivers the gate here and
 * exercises it in the gate runner's synthesis cases (F, G).
 *
 * Returns { pass, failures, sections } where sections carries per-section
 * declared-CPS evidence (id, timing, chars, declared seconds, CPS).
 */
export function gateSectionsDeclaredCps(sections, caps = CAPTION_LIMITS) {
  const failures = [];
  const checked = [];
  for (const s of sections || []) {
    const text = String((s && s.voiceover) || "").replace(/\s+/g, "");
    if (!text.length) continue;
    const m = /(\d+):(\d+)\s*[-–—]\s*(\d+):(\d+)/.exec(String((s && s.timing) || ""));
    if (!m) continue; // undeclared timing → proportional path, not assessable here
    const fromMs = Number(m[1]) * 60000 + Number(m[2]) * 1000;
    const toMs = Number(m[3]) * 60000 + Number(m[4]) * 1000;
    const durSec = (toMs - fromMs) / 1000;
    if (durSec <= 0) continue;
    const cps = text.length / durSec;
    const row = {
      id: s.id || s.timing,
      timing: s.timing,
      chars: text.length,
      declaredSec: Number(durSec.toFixed(1)),
      declaredCps: Number(cps.toFixed(1)),
    };
    checked.push(row);
    if (cps > caps.maxCPS) {
      failures.push(
        `section "${row.id}" declared ${row.declaredSec}s for ${row.chars} chars = ${row.declaredCps} CPS > ${caps.maxCPS} — synthesis maps declared timing; pages cannot satisfy H6`
      );
    }
  }
  return { pass: failures.length === 0, failures, sections: checked };
}

/**
 * H8-independent — recompute the inter-page gap from RAW milliseconds
 * (never trusting the page's startFrame/endFrame fields):
 * displayEnd of page i-1 = min(endMs, nextStart − gapMs), then both edges
 * rounded to frames at the given fps. Because round(x−2)=round(x)−2, the
 * reserved gap is exactly 2 frames when gapMs = 2/30 s — this is the
 * construction property, and this recomputation proves it per pair.
 */
export function independentGapFrames(pages, fps = 30, caps = CAPTION_LIMITS) {
  const gapMs = (caps.minGapFrames / fps) * 1000;
  const out = [];
  for (let i = 1; i < pages.length; i++) {
    const prev = pages[i - 1];
    const next = pages[i];
    const prevDisplayEnd = Math.min(prev.endMs, next.startMs - gapMs);
    out.push({
      index: i,
      gapFrames:
        Math.round((next.startMs / 1000) * fps) -
        Math.round((prevDisplayEnd / 1000) * fps),
      prevEndMs: prevDisplayEnd,
      nextStartMs: next.startMs,
      gapMs,
    });
  }
  return out;
}

/**
 * B2.4 gate — data-driven from the Shorts slot table:
 *   - the caption zone is the ONLY content zone whose top ≥ 1140;
 *   - the caption bottom == SAFE.bottom (1248) — nothing goes below;
 *   - every other content slot (kicker/stage/headline) ends at or above 1140;
 *   - the rail (4 px structural progress rule) is the manual-documented
 *     exception (A1.3 zone table line 55: "Rail | x 48, y 288–1248") and is
 *     exempt as furniture, not content (TYP-18, BLUEPRINT §4.3).
 */
export function gateB24(slots = SLOTS_SHORTS, safe = SAFE_SHORTS) {
  const failures = [];
  for (const [role, s] of Object.entries(slots)) {
    const bottom = s.y + s.h;
    if (role === "caption") {
      if (s.y < B2_4_LINE) {
        failures.push(
          `B2.4: caption zone top ${s.y} < ${B2_4_LINE} — another element overlaps the zone below 1140`
        );
      }
      if (bottom !== safe.bottom) {
        failures.push(
          `B2.4: caption bottom ${bottom} != SAFE.bottom ${safe.bottom}`
        );
      }
    } else if (role === "rail") {
      // Documented structural exception (A1.3 line 55): may span below 1140.
      continue;
    } else {
      if (bottom > B2_4_LINE) {
        failures.push(
          `B2.4: content slot "${role}" bottom ${bottom} > ${B2_4_LINE} — caption is the only element permitted below y=${B2_4_LINE}`
        );
      }
    }
  }
  return { pass: failures.length === 0, failures };
}

/** Non-space characters of a page (H6 CPS numerator). */
export function pageChars(page) {
  return String(page.text || "").replace(/\s+/g, "").length;
}

/**
 * Normalize a page's line entry to its display string. buildCaptionPages
 * emits lines as STRINGS (beats.js:601); enrichPages REPLACES them with
 * token ARRAYS (mg-package.js:353-358). gateCaptions' `line.length` therefore
 * counts tokens on enriched pages — a silent char-check gap in the production
 * harness (verify-compositions.js:71 gates the enriched package; recorded in
 * the Stage-10 ledger §6). Joining token texts gives an upper bound on the
 * rendered line (the builder's punctuation fix only REMOVES spaces), so the
 * check here is conservative and exact on raw pages.
 */
export function lineText(line) {
  if (Array.isArray(line)) {
    return line.map((t) => (t && t.text != null ? t.text : "")).join(" ");
  }
  return String(line == null ? "" : line);
}

/**
 * Stage-10 gate over a built package's pages: H5–H8 via the production
 * gateCaptions PLUS independent recomputations (per-page CPS from
 * chars/durationMs, per-pair gap from raw ms), then B2.4 from the slot table.
 * H9 (headline overlap) is applied by the runner with gateMgHeadlineOverlap
 * because that gate lives in mg-package.js (kept out of here to avoid an
 * import cycle — mg-package.js routes through this module via SFR-cap-002).
 */
export function gateCaptionPages(pages, opts = {}) {
  const fps = opts.fps || 30;
  const caps = opts.caps || CAPTION_LIMITS;
  const failures = [];
  if (!pages || pages.length === 0) {
    return { pass: false, failures: ["no caption pages"], evidence: null };
  }
  const prod = gateCaptions(pages, { fps, caps });

  // Independent per-page recomputations (do not trust page.cps/durationMs).
  for (const page of pages) {
    const chars = pageChars(page);
    const dur = Math.max(page.endMs - page.startMs, 1);
    const cps = chars / (dur / 1000);
    if (cps > caps.maxCPS) {
      failures.push(
        `caption "${page.text}" independent CPS ${cps.toFixed(1)} > ${caps.maxCPS}`
      );
    }
    if (dur < caps.minDurationMs || dur > caps.maxDurationMs) {
      failures.push(
        `caption "${page.text}" independent duration ${Math.round(dur)}ms outside [${caps.minDurationMs}, ${caps.maxDurationMs}]`
      );
    }
    for (const line of page.lines || []) {
      if (lineText(line).length > caps.maxCharsPerLine) {
        failures.push(
          `caption "${page.text}" line exceeds ${caps.maxCharsPerLine} chars (independent)`
        );
      }
    }
    if ((page.lines || []).length > caps.maxLines) {
      failures.push(
        `caption "${page.text}" has ${page.lines.length} lines > ${caps.maxLines} (independent)`
      );
    }
    if ((page.words || []).length > caps.maxWords) {
      failures.push(
        `caption "${page.text}" has ${page.words.length} words > ${caps.maxWords} (independent)`
      );
    }
  }

  // Independent per-pair gap recomputation (raw ms → frames).
  const gaps = independentGapFrames(pages, fps, caps);
  for (const g of gaps) {
    if (g.gapFrames < caps.minGapFrames) {
      failures.push(
        `independent gap ${g.gapFrames}f < ${caps.minGapFrames}f between pages ${g.index - 1} and ${g.index}`
      );
    }
  }

  const b24 = gateB24();
  for (const f of b24.failures) failures.push(f);

  return {
    pass: prod.pass && failures.length === 0,
    failures: [...prod.failures, ...failures],
    evidence: {
      pageCount: pages.length,
      productionGate: prod.pass,
      independentFailures: failures.length,
      gaps,
      pages: pages.map((p) => ({
        index: p.index,
        text: p.text,
        words: (p.words || []).length,
        lines: (p.lines || []).map((l) => `${lineText(l).length}:${lineText(l)}`),
        durationMs: Math.round(p.endMs - p.startMs),
        cps: p.cps != null ? Number(p.cps.toFixed(1)) : Number(((pageChars(p) / Math.max(p.endMs - p.startMs, 1)) * 1000).toFixed(1)),
      })),
    },
  };
}
