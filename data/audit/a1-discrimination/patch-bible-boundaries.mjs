/**
 * Adds a boundary clause to EDT-02 and EDT-03 in config/visual-bible.json.
 *
 * WHY TEXT-LEVEL, NOT JSON: the first attempt parsed and re-serialised the bible, which
 * reformatted every compact array in the file — 63 insertions / 29 deletions of unrelated
 * churn to change two sentences. This patches the raw text and then PARSES the result and
 * asserts the two descriptions are exactly original + boundary, so correctness does not
 * depend on the file staying formatted the way it happens to be.
 *
 * WHY AT ALL: both rules legitimately ask for visual rhythm and neither is removed. But each
 * stated its permission with no boundary, and together with the reviewer's now-deleted "do
 * not call a beat 'empty' ... because its middle is clear" they meant a frame carrying
 * nothing but the caption band could be described as intentional, clean and balanced — the
 * exact frame local-audit.cjs middle-zone-filled exists to catch. Same shape as the ground
 * shield fixed in 1ef8b0e: keep the intent, remove the unbounded licence.
 */
import { readFileSync, writeFileSync } from "node:fs";

const P = "config/visual-bible.json";
const raw = readFileSync(P, "utf8");

const BOUNDARIES = {
  "EDT-02": " BOUNDARY: 'not afraid of an empty frame' permits a SPARSE frame, never a BARE one. A beat carrying no element for its sentence is a fallback, not restraint, and is reported as one.",
  "EDT-03": " BOUNDARY: 'breathing room' means lower density than the frame before it, not no content. A beat whose middle zone is empty while its caption band carries the sentence (local-audit.cjs middle-zone-filled, < 15% filled) FAILS this rule rather than satisfying it.",
};

const before = JSON.parse(raw);
let out = raw;

for (const [id, boundary] of Object.entries(BOUNDARIES)) {
  const originalDesc = before.rules[id].description;
  // Locate the exact original description inside the raw text and append after it. Using the
  // parsed value as the needle is safe: JSON.stringify of the same string reproduces the
  // same escapes, so this cannot match a differently-escaped twin by accident.
  const needle = JSON.stringify(originalDesc).slice(1, -1);
  const occurrences = out.split(needle).length - 1;
  if (occurrences !== 1) throw new Error(`${id}: expected its description exactly once in the raw text, found ${occurrences}`);
  out = out.replace(needle, needle + boundary.replace(/"/g, '\\"'));
}

const after = JSON.parse(out);
for (const [id, boundary] of Object.entries(BOUNDARIES)) {
  const want = before.rules[id].description + boundary;
  if (after.rules[id].description !== want) throw new Error(`${id}: description is not exactly original + boundary`);
  console.log(`${id}: original ${before.rules[id].description.length} chars + ${boundary.length} appended, verbatim`);
}
for (const k of Object.keys(before)) {
  if (k === "rules") continue;
  if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) throw new Error(`unexpected change outside rules: ${k}`);
}
for (const id of Object.keys(before.rules)) {
  if (id in BOUNDARIES) continue;
  if (JSON.stringify(before.rules[id]) !== JSON.stringify(after.rules[id])) throw new Error(`unexpected change to rule ${id}`);
}

writeFileSync(P, out);
console.log("\nboundaries added; only EDT-02 and EDT-03 descriptions changed");