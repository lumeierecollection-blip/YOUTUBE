#!/usr/bin/env node
/**
 * eval-layer1-execution.js — Layer 1 of the three-layer evaluation: did the
 * renderer do what Gemini asked?
 *
 * No model, no API, no network. Pure geometry over the render manifest.
 *
 * ── What already existed, and why this does not reimplement it ──────────
 *
 * The deterministic checks are NOT missing. scripts/local-audit.cjs already
 * runs all four of them against a real render:
 *
 *   timing contiguity   src/skills/remotion-render/visual/run-visual-tests.js
 *                       boundary scan, registered as MOT-22
 *                       (CHECK-REGISTER.md:270 — PASS 2026-09-03)
 *   element presence    canvasCoverage()      local-audit.cjs:360
 *   text legibility     canvasFit()           local-audit.cjs:334-357
 *   motion properties   popTransitions()      local-audit.cjs:624
 *
 * local-audit reports a failure as one free-text string per video:
 *   "beat 4: text boxes headline and subhead overlap"
 * That is enough to fail a run and useless for the thing Layer 1 exists to do,
 * which is re-render ONLY the failed element. A string does not say which beat
 * failed in a form a re-renderer can address, and local-audit.cjs has no
 * module.exports, so it cannot be imported and asked for structured output.
 *
 * So this module does not re-derive the answers. It returns the same four
 * answers STRUCTURED, keyed by (beat, element), over the manifest rather than
 * over decoded frames, which is what lets the retry loop address one element.
 * The constants are the same ones local-audit uses, cited inline, so the two
 * cannot silently drift:
 *
 *   SAFE_INSET 48, CAPTION_Y0 1450, CAPTION_Y1 1610   local-audit.cjs:325
 *   POP.IN 6, POP.START 1, STAGGER 8                   pop-groups.js:12
 *   ENTRANCE.STAGGERED 12, TEXT_AFTER_VISUAL 14       pop-groups.js:19
 *
 * MOT-22 keeps its registered ID. The three checks local-audit does not have a
 * registered ID for are namespaced L1-* here and are NOT yet in
 * CHECK-REGISTER.md — §1 of the brief forbids adding entries beyond the three
 * layers, so they need a register entry before they gate anything for real.
 *
 * ── What this layer deliberately cannot do ──────────────────────────────
 *
 * It cannot judge whether the video looks good, and it does not try. That is
 * Layer 2 (style similarity) and Layer 3 (Gemini, full-video). Nothing here
 * calls a model, so nothing here can be fooled by a model, and no provider
 * outage can turn a Layer 1 failure into a pass.
 */
import { POP, ENTRANCE } from "../src/skills/remotion-render/visual/pop-groups.js";

/** local-audit.cjs:325. */
export const SAFE_INSET = 48;
export const CAPTION_Y0 = 1450;
export const CAPTION_Y1 = 1610;

/**
 * Frames a beat must hold for its own entrance to finish landing.
 *
 * pop-groups.js derives arrival from POP.START plus each group's offset, and
 * POP.IN frames of scale; a beat whose window is shorter than its own entrance
 * cannot finish the animation no matter what the compositor does, so this is a
 * plan-level fault rather than a render fault — and it is detectable without
 * decoding a frame.
 */
export function requiredFrames(entranceStyle) {
  switch (entranceStyle) {
    case "staggered": return ENTRANCE.STAGGERED;
    case "visual-first": return ENTRANCE.TEXT_AFTER_VISUAL;
    case "together":
    case undefined:
    case null:
    case "": return POP.START + POP.IN;
    default: return POP.START + POP.IN;
  }
}

/**
 * Rect intersection with the same 2px tolerance local-audit.cjs:336 uses, so
 * boxes that merely touch do not read as overlapping.
 */
function rectsIntersect(a, b) {
  return a.x < b.x + b.w - 2 && b.x < a.x + a.w - 2 && a.y < b.y + b.h - 2 && b.y < a.y + a.h - 2;
}

function fail(out, id, check, beat, element, detail) {
  out.push({ id, check, layer: 1, beat, element: element ?? null, pass: false, detail });
}
function pass(out, id, check, detail) {
  out.push({ id, check, layer: 1, beat: null, element: null, pass: true, detail });
}

/**
 * MOT-22 — no frame falls BETWEEN two beats.
 *
 * Scoped to inter-beat coverage exactly as registered (CHECK-REGISTER.md:270:
 * "The beat timeline covers every frame - no frame falls between two beats").
 * The head and tail of the timeline are deliberately NOT treated as gaps: the
 * canvas ground is mounted globally, so frames before the first beat and after
 * the last render the ground, not black. Measured on ch-2
 * california-no-robo-bosses (1391 frames, beat 0 starting at frame 3): frames
 * 0-2 come back mean 255.0 stddev 0.0 — pure white ground, not an uncovered
 * black frame. Extending MOT-22 to the head failed that already-approved render
 * on a condition the registered check never asserted.
 *
 * An uncovered frame renders BLACK because no Sequence is mounted over it; that
 * is the defect this guards, and it only happens between beats.
 */
function checkContiguity(manifest, out) {
  const beats = manifest.beats || [];
  const uncovered = [];
  const overlaps = [];
  let cursor = null;

  beats.forEach((b, i) => {
    const start = Number(b.start_frame);
    const dur = Number(b.duration_frames);
    if (dur <= 0) fail(out, "MOT-22", "timing-contiguity", i, null, `beat ${i} holds ${dur} frame(s)`);
    if (!Number.isFinite(start)) return;
    if (cursor !== null) {
      if (start > cursor) {
        for (let f = cursor; f < start; f++) uncovered.push({ frame: f, afterBeat: i - 1, beforeBeat: i });
      } else if (start < cursor) {
        overlaps.push({ beat: i, frame: start, over: cursor - start });
      }
    }
    cursor = start + Math.max(dur, 0);
  });

  if (uncovered.length) {
    const first = uncovered.slice(0, 5).map((u) => `frame ${u.frame} (between beat ${u.afterBeat} and beat ${u.beforeBeat})`).join(", ");
    fail(out, "MOT-22", "timing-contiguity", uncovered[0].beforeBeat, null,
      `${uncovered.length} frame(s) covered by no beat: ${first}${uncovered.length > 5 ? " ..." : ""}`);
  }
  if (overlaps.length) {
    fail(out, "MOT-22", "timing-contiguity", overlaps[0].beat, null,
      `${overlaps.length} overlapping boundary/boundaries: ${overlaps.slice(0, 5).map((o) => `beat ${o.beat} starts ${o.over} frame(s) early`).join(", ")}`);
  }
  if (!uncovered.length && !overlaps.length) {
    pass(out, "MOT-22", "timing-contiguity", `${beats.length} beat(s): no frame falls between two beats`);
  }
}

/**
 * Element presence is NOT re-checked here, and the omission is deliberate.
 *
 * Two attempts to state it from the manifest were both false positives against
 * ch-2's own approved render:
 *
 *   1. "canvas.hero must be a key in canvas.boxes" — beats 2 and 5 declare hero
 *      "nodes" and lay out "nodes0" and "nodes1"; the hero is a composite
 *      family, not one box.
 *   2. "every canvas.zones entry must be a laid-out box" — beat 0 lays out
 *      {headline, map} while zones say {top:[headline], middle:[chart],
 *      bottom:[caption]}. zones names ROLES, not boxes: the chart is drawn from
 *      `data`, and captions are burned in from the SRT, which is exactly why the
 *      caption band at y1450-1610 exists and is deliberately not a box.
 *
 * So canvas.zones semantics are not established by anything read here, and a
 * check inferred from one sample is how a gate starts failing renders for
 * reasons that have nothing to do with the render. Presence is already covered
 * against real pixels by local-audit's canvas-coverage() (local-audit.cjs:360,
 * every beat's content spans >= 60% of frame height) and zones-no-overlap
 * (local-audit.cjs:582). Those measure the render. Re-deriving them from
 * metadata would be weaker, and would be inventing a check, which §1 forbids.
 *
 * If a manifest-level presence check is wanted, it needs the zone contract read
 * in scene-primitives.js or capability-compiler.js — the module that WRITES
 * zones — not guessed from a sample output.
 */
function checkElementPresence() {
  return null;
}

/**
 * Safe area, caption band and text overlap — the geometry local-audit's
 * canvasFit() asserts (local-audit.cjs:334-357), reproduced exactly:
 *
 *   BLEEDS  photo, map, split bleed to the frame edge by design
 *   role === "shape" is excluded
 *   a box entering y 1450-1610 enters the caption band
 *   overlap uses a 2px tolerance, so boxes that merely touch do not count
 *   text is TEXT_ROLES by role, or a TEXT_BOXES name with trailing digits
 *     stripped, so nodes0/nodes1 both count
 */
function checkTextLegibility(manifest, out) {
  const beats = manifest.beats || [];
  const BLEEDS = new Set(["photo", "map", "split"]);
  const TEXT_ROLES = new Set(["headline", "number", "data", "emphasis"]);
  const TEXT_BOXES = ["kicker", "headline", "statement", "number", "label", "emphasis"];
  let outside = 0, inBand = 0, overlaps = 0;

  beats.forEach((b, i) => {
    const boxes = b.canvas?.boxes;
    if (!boxes) { fail(out, "L1-legibility", "text-legibility", i, null, `beat ${i}: no canvas boxes in the manifest`); return; }
    for (const [k, v] of Object.entries(boxes)) {
      if (BLEEDS.has(k) || v.role === "shape") continue;
      if (v.x < SAFE_INSET - 0.5 || v.y < SAFE_INSET - 0.5 ||
          v.x + v.w > (Number(manifest.width) || 1080) - SAFE_INSET + 0.5 + (v.bleed || 0) ||
          v.y + v.h > (Number(manifest.height) || 1920) - SAFE_INSET + 0.5) {
        fail(out, "L1-legibility", "text-legibility", i, k,
          `beat ${i}: box "${k}" (${v.x},${v.y},${v.x + v.w},${v.y + v.h}) leaves the frame's safe area`);
        outside++;
      }
      if (v.y + v.h > CAPTION_Y0 + 0.5 && v.y < CAPTION_Y1) {
        fail(out, "L1-legibility", "text-legibility", i, k,
          `beat ${i}: box "${k}" (y ${v.y}-${v.y + v.h}) enters the caption band ${CAPTION_Y0}-${CAPTION_Y1}`);
        inBand++;
      }
    }
    const texts = Object.entries(boxes).filter(([k, v]) => TEXT_ROLES.has(v.role) || TEXT_BOXES.includes(k.replace(/\d+$/, "")));
    for (let a = 0; a < texts.length; a++) {
      for (let c = a + 1; c < texts.length; c++) {
        if (rectsIntersect(texts[a][1], texts[c][1])) {
          fail(out, "L1-legibility", "text-legibility", i, `${texts[a][0]}+${texts[c][0]}`,
            `beat ${i}: text boxes "${texts[a][0]}" and "${texts[c][0]}" overlap`);
          overlaps++;
        }
      }
    }
  });
  if (!outside && !inBand && !overlaps) {
    pass(out, "L1-legibility", "text-legibility", `${beats.length} beat(s): every element inside the safe area, no text overlap, caption band clear`);
  }
}

/** The beat's window must be long enough for the entrance the plan asked for. */
function checkMotionTiming(manifest, out) {
  const beats = manifest.beats || [];
  let bad = 0;
  beats.forEach((b, i) => {
    const style = b.canvas?.entrance_style;
    const need = requiredFrames(style);
    const have = Number(b.duration_frames) || 0;
    if (have < need) {
      fail(out, "L1-motion", "motion-property", i, b.canvas?.hero || null,
        `beat ${i}: entrance "${style}" needs ${need} frame(s) to land but the beat holds ${have}`);
      bad++;
    }
  });
  if (!bad) pass(out, "L1-motion", "motion-property", `${beats.length} beat(s): every entrance fits its window`);
}

/**
 * Run all four checks. Pure: same manifest in, same result out, no I/O.
 * `pass` is false if ANY check failed — one failure is enough to re-render.
 */
export function runLayer1(manifest) {
  const out = [];
  if (!manifest || !Array.isArray(manifest.beats) || !manifest.beats.length) {
    return {
      layer: 1, pass: false, checks: [{
        id: "L1-input", check: "input", layer: 1, beat: null, element: null, pass: false,
        detail: "no manifest, or it carries no beats — the renderer produced nothing to check",
      }],
      failures: [{ beat: null, element: null, check: "input", detail: "no manifest" }],
    };
  }
  checkContiguity(manifest, out);
  checkElementPresence();
  checkTextLegibility(manifest, out);
  checkMotionTiming(manifest, out);
  return {
    layer: 1,
    pass: out.every((c) => c.pass),
    checks: out,
    failures: out.filter((c) => !c.pass).map((c) => ({ beat: c.beat, element: c.element, check: c.check, id: c.id, detail: c.detail })),
  };
}

function arg(name, argv = process.argv) {
  const i = argv.indexOf("--" + name);
  return i > -1 && argv[i + 1] ? argv[i + 1] : null;
}

if (process.argv[1] && process.argv[1].endsWith("eval-layer1-execution.js")) {
  const manifestPath = arg("manifest");
  const outPath = arg("out");
  if (!manifestPath) {
    console.error("Usage: eval-layer1-execution.js --manifest <manifest.json> [--out <layer1.json>]");
    process.exit(2);
  }
  const { readFileSync, writeFileSync } = await import("node:fs");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const result = runLayer1(manifest);
  for (const c of result.checks) console.log(`${c.pass ? "PASS" : "FAIL"} ${c.id.padEnd(13)} ${c.detail}`);
  if (outPath) writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n");
  console.log(`[layer1] ${result.pass ? "PASS" : "FAIL"} — ${result.failures.length} failure(s)`);
  process.exit(result.pass ? 0 : 1);
}