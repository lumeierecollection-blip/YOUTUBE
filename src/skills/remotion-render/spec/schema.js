/**
 * LAYOUT-SYSTEM.md Part 2 — the Shot Spec, expressed as data. One per beat.
 * Written in named roles and slots, never pixels. This module is the type
 * definition + runtime validator, PURE (no React, no Remotion).
 *
 * Shape (Part 2.1):
 *   {
 *     "id": "b07",
 *     "archetype": "PROGRESS",
 *     "startFrame": 412,
 *     "durationInFrames": 84,
 *     "anchorTokenIndex": 3,
 *     "layers": [ { role, slot, align?, content, fit?, enter, exit } ]
 *   }
 *
 * §2.1.1 — a layer may never carry raw x/y. §2.1.2 — align is one of the nine
 * anchors. §2.1.3 — atFrame is an integer, `anchor±n`, or `end−n`; nothing
 * else. §2.1.4 — fit declares the text box contract.
 */

import { ARCHETYPES } from "../compositions/beats.js";

/** Slot names — shared by the Shorts and Longform tables (Part 3). */
export const SLOT_NAMES = ["kicker", "stage", "headline", "caption", "rail"];

/** Nine anchors — §3.3. */
export const ANCHORS = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
];

const ATFRAME_RE = /^(?:anchor[+-]\d+|end-\d+)$/;
const isInt = (v) => Number.isInteger(v);
const isNone = (p) => typeof p === "string" && /^none$/i.test(p);

function validateAtFrame(atFrame, path, required) {
  const errs = [];
  if (atFrame === undefined || atFrame === null) {
    if (required) errs.push(`${path}.atFrame: required integer ≥ 0, "anchor±n", or "end−n"`);
    return errs;
  }
  if (isInt(atFrame)) {
    if (atFrame < 0) errs.push(`${path}.atFrame: negative integer ${atFrame}`);
  } else if (typeof atFrame === "string" && ATFRAME_RE.test(atFrame)) {
    // OK — resolved by the compiler (§2.1.3).
  } else {
    errs.push(`${path}.atFrame: must be an integer ≥ 0, "anchor±n", or "end−n" (got ${JSON.stringify(atFrame)})`);
  }
  return errs;
}

function validateMotion(motion, path, key) {
  const errs = [];
  if (!motion || typeof motion !== "object") return [`${path}.${key}: missing`];
  if (!motion.pattern || typeof motion.pattern !== "string" || !motion.pattern.trim()) {
    errs.push(`${path}.${key}.pattern: required non-empty string`);
  }
  // A "NONE" pattern has no motion, so its atFrame is optional (§2.1.3 example).
  errs.push(...validateAtFrame(motion.atFrame, `${path}.${key}`, !isNone(motion.pattern)));
  return errs;
}

function validateLayer(layer, path) {
  const errs = [];
  if (!layer || typeof layer !== "object") return [`${path}: missing`];
  if (!layer.role || typeof layer.role !== "string" || !layer.role.trim()) {
    errs.push(`${path}.role: required non-empty string`);
  }
  if (!SLOT_NAMES.includes(layer.slot)) {
    errs.push(`${path}.slot: must be one of ${SLOT_NAMES.join(", ")} (got ${JSON.stringify(layer.slot)})`);
  }
  if (layer.align !== undefined && !ANCHORS.includes(layer.align)) {
    errs.push(`${path}.align: must be one of the nine anchors (got ${JSON.stringify(layer.align)})`);
  }
  if (!layer.content || typeof layer.content !== "object") {
    errs.push(`${path}.content: required object`);
  }
  if (layer.fit !== undefined) {
    const { maxSize, minSize, maxLines } = layer.fit;
    if (!isInt(maxSize) || maxSize <= 0) errs.push(`${path}.fit.maxSize: required positive integer`);
    if (!isInt(minSize) || minSize <= 0) errs.push(`${path}.fit.minSize: required positive integer`);
    if (!isInt(maxLines) || maxLines < 1) errs.push(`${path}.fit.maxLines: required integer ≥ 1`);
  }
  errs.push(...validateMotion(layer.enter, path, "enter"));
  errs.push(...validateMotion(layer.exit, path, "exit"));
  return errs;
}

/**
 * Validate one Shot Spec. Returns { valid, errors: [string] }. Every error is
 * prefixed with the beat id so it is machine-actionable (§6.1).
 */
export function validateShotSpec(spec) {
  const errs = [];
  if (!spec || typeof spec !== "object") return { valid: false, errors: ["spec: missing"] };
  const where = spec.id ? `${spec.id}` : "shot";

  if (typeof spec.id !== "string" || !spec.id.trim()) errs.push(`${where}.id: required non-empty string`);
  if (!ARCHETYPES.includes(spec.archetype)) {
    errs.push(`${where}.archetype: must be one of ${ARCHETYPES.join(", ")} (got ${JSON.stringify(spec.archetype)})`);
  }
  if (!isInt(spec.startFrame) || spec.startFrame < 0) errs.push(`${where}.startFrame: required integer ≥ 0`);
  if (!isInt(spec.durationInFrames) || spec.durationInFrames < 1) {
    errs.push(`${where}.durationInFrames: required integer ≥ 1`);
  }
  if (!isInt(spec.anchorTokenIndex) || spec.anchorTokenIndex < 0) {
    errs.push(`${where}.anchorTokenIndex: required integer ≥ 0`);
  }
  if (!Array.isArray(spec.layers)) {
    errs.push(`${where}.layers: required array`);
  } else {
    if (spec.layers.length < 1) errs.push(`${where}.layers: at least one layer required`);
    spec.layers.forEach((layer, i) => errs.push(...validateLayer(layer, `${where}.layers[${i}]`)));
  }
  return { valid: errs.length === 0, errors: errs };
}

/** Validate a whole spec array. Returns { valid, errors }. */
export function validateShotSpecs(specs) {
  if (!Array.isArray(specs)) return { valid: false, errors: ["specs: expected an array"] };
  const errors = [];
  specs.forEach((spec, i) => {
    const r = validateShotSpec(spec);
    errors.push(...r.errors.map((e) => `[${i}] ${e}`));
  });
  return { valid: errors.length === 0, errors };
}
