// Orchestrator application of Stage-4 code SFRs:
//   SFR-LAY-2  compositions/mg-style.js  ZONES -> derive from layout/slots.js (caption 1152)
//   SFR-LAY-3  compositions/beats.js     SAFE/OPTICAL/CAPTION -> derive from layout/slots.js
import { readFileSync, writeFileSync } from "fs";

const mg = readFileSync("src/skills/remotion-render/compositions/mg-style.js", "utf8");
const oldZones = `export const ZONES = {
  kicker: { top: 288, bottom: 360 },
  stage: { top: 392, bottom: 940 },
  headline: { top: 964, bottom: 1140 },
  caption: { top: 1148, bottom: 1248 },
  rail: { x: 48, top: 288, bottom: 1248 },
};`;
const newZones = `import { SLOTS_SHORTS } from "../layout/slots.js";

/** Vertical zones — A1.3. Fixed for every beat. Derived from the slot table
 * (layout/slots.js) so the composition can never drift from the spec again. */
export const ZONES = {
  kicker: { top: SLOTS_SHORTS.kicker.y, bottom: SLOTS_SHORTS.kicker.y + SLOTS_SHORTS.kicker.h },
  stage: { top: SLOTS_SHORTS.stage.y, bottom: SLOTS_SHORTS.stage.y + SLOTS_SHORTS.stage.h },
  headline: { top: SLOTS_SHORTS.headline.y, bottom: SLOTS_SHORTS.headline.y + SLOTS_SHORTS.headline.h },
  caption: { top: SLOTS_SHORTS.caption.y, bottom: SLOTS_SHORTS.caption.y + SLOTS_SHORTS.caption.h },
  rail: { x: SLOTS_SHORTS.rail.x, top: SLOTS_SHORTS.rail.y, bottom: SLOTS_SHORTS.rail.y + SLOTS_SHORTS.rail.h },
};`;
if (!mg.includes(oldZones)) throw new Error("mg-style.js ZONES block not found");
writeFileSync(
  "src/skills/remotion-render/compositions/mg-style.js",
  mg.split(oldZones).join(newZones),
  "utf8"
);
console.log("mg-style.js: ZONES derived from slots.js (caption top now 1152)");

const beats = readFileSync("src/skills/remotion-render/compositions/beats.js", "utf8");

// 1. SAFE literal -> derive from SAFE_SHORTS
const oldSafe = `/** Hard safe rect — §2.1. Design to the Google numbers. */
export const SAFE = { top: 288, bottom: 1248, left: 48, right: 888 };`;
const newSafe = `import { SAFE_SHORTS, SLOTS_SHORTS } from "../layout/slots.js";

/** Hard safe rect — §2.1. Design to the Google numbers. Single source: layout/slots.js. */
export const SAFE = SAFE_SHORTS;`;
if (!beats.includes(oldSafe)) throw new Error("beats.js SAFE block not found");
let b = beats.split(oldSafe).join(newSafe);

// 2. Delete the American-spelling duplicate constant (unused; mg-style uses OPTICAL_CENTRE_X)
const oldDup = `/** Optical centre for a Short — §2.3. Right margin is 4× the left. */
export const OPTICAL_CENTER_X = 468;
`;
if (!b.includes(oldDup)) throw new Error("beats.js OPTICAL_CENTER_X dup not found");
b = b.split(oldDup).join("");

// 3. OPTICAL_CENTRE_X/Y literals -> derive from SAFE
const oldOpt = `export const OPTICAL_CENTRE_X = 468; // NOT 540 — right margin is 4x the left
export const OPTICAL_CENTRE_Y = 768; // (288 + 1248) / 2`;
const newOpt = `export const OPTICAL_CENTRE_X = SAFE.left + (SAFE.right - SAFE.left) / 2; // 48 + 840/2 = 468 — NOT 540
export const OPTICAL_CENTRE_Y = (SAFE.top + SAFE.bottom) / 2; // (288 + 1248) / 2 = 768`;
if (!b.includes(oldOpt)) throw new Error("beats.js OPTICAL_CENTRE block not found");
b = b.split(oldOpt).join(newOpt);

// 4. CAPTION zoneTop 1148 -> slot-derived 1152; zoneBottom/maxWidth from the slot
const oldCap = `export const CAPTION = {
  zoneTop: 1148,
  zoneBottom: 1248,
  anchor: "bottom",
  maxWidth: 780,
  maxLines: 2,
  lineHeight: 1.12,
  align: "center",
};`;
const newCap = `export const CAPTION = {
  zoneTop: SLOTS_SHORTS.caption.y, // 1152 (corrected from 1148 — off-grid)
  zoneBottom: SLOTS_SHORTS.caption.y + SLOTS_SHORTS.caption.h, // 1248 == SAFE.bottom
  anchor: "bottom",
  maxWidth: SLOTS_SHORTS.caption.w, // 760 (corrected from 780 — 780 centred on 468 crossed slot right edge 848)
  maxLines: 2,
  lineHeight: 1.12,
  align: "center",
};`;
if (!b.includes(oldCap)) throw new Error("beats.js CAPTION block not found");
b = b.split(oldCap).join(newCap);

writeFileSync("src/skills/remotion-render/compositions/beats.js", b, "utf8");
console.log("beats.js: SAFE/OPTICAL/CAPTION derived from slots.js; dual spelling removed; caption 1152/maxWidth 760");

// sanity: the other named exports beats.js provides to mg-package.js must still exist
for (const name of ["FPS", "D", "parseSRT", "parseSrtToBeats", "parseSrtToMotionGraphics", "assignBeatsToSections", "transitionBeforeBeat", "wrapCaptionWords", "wordCount", "SAFE", "OPTICAL_CENTRE_X", "OPTICAL_CENTRE_Y", "CAPTION", "CAPTION_LIMITS"]) {
  if (!b.includes(name)) console.warn(`WARN: ${name} no longer present in beats.js`);
}
console.log("export sanity check done");
