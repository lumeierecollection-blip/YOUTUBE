/**
 * Credit lines for authentic pictures. A scene that shows an authentic photograph but carries no `credit` of its own gets `autoCredit`: the credit line recorded
 * for that picture in src/skills/remotion-render/public/lf2/<channel>/ATTRIBUTIONS.json (creator, licence, "via Wikimedia Commons"). The generic overlay in
 * channels/lf2/compositions.jsx draws it bottom-left. Reference practice: borrowed material carries its source on screen (VISUAL-EDITING-RESEARCH.md F-HP-3, F-CS-3).
 * Used by the stills specs (platform/longform/stills/specs.mjs) and by the QA tool (platform/longform/qa/visual-audio-qa.mjs), so both agree on what is credited.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const cache = {};
const attributions = (ch) => (cache[ch] ||= (() => { const f = join(ROOT, `src/skills/remotion-render/public/lf2/${ch}/ATTRIBUTIONS.json`); return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {}; })());
const walk = (o, f) => { if (typeof o === "string") f(o); else if (Array.isArray(o)) o.forEach((x) => walk(x, f)); else if (o && typeof o === "object") Object.values(o).forEach((x) => walk(x, f)); };
/** Credit lines for the authentic pictures in a scene that does not already carry its own credit. */
export function autoCredit(ch, scene) {
  if (!scene || scene.credit || scene.credits || scene.autoCredit) return [];
  const att = attributions(ch), lines = [];
  walk(scene, (s) => { const m = /^lf2\/[^/]+\/([^/]+)\.(jpg|jpeg|png)$/i.exec(s); if (m && att[m[1]]?.credit_line && !lines.includes(att[m[1]].credit_line)) lines.push(att[m[1]].credit_line); });
  return lines.slice(0, 2);
}
// QA_NO_AUTOCREDIT=1 counts only credits written into the scene itself (used to reproduce the 'before' baseline).
export const hasCredit = (ch, scene) => !!(scene.credit || scene.credits || (!process.env.QA_NO_AUTOCREDIT && autoCredit(ch, scene).length));
