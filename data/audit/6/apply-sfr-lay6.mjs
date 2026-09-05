// Orchestrator applies Stage-6 SFRs:
//  SFR-LAY-6-1: LAY-20 register evidence correction (0 hits -> 1 hit @ mg-style.js:150-151)
//  SFR-LAY-6-3: MANUAL "12 channels" -> 13 with Money Mind (superset gate)
//  SFR-LAY-6-2: note only (spec/fromBeats.js is audit-encoding's) — no file change
// Line-ending aware; exact-match; idempotent.
import { readFileSync, writeFileSync } from "node:fs";

let changed = 0;

function patch(file, oldStr, newStr, label) {
  const src = readFileSync(file, "utf8");
  const n = src.split(oldStr).length - 1;
  if (n === 0) {
    console.log(`SKIP (not found): ${label}`);
    return;
  }
  if (n > 1) console.log(`WARN ${n} matches: ${label}`);
  writeFileSync(file, src.split(oldStr).join(newStr), "utf8");
  changed += n;
  console.log(`APPLIED ${n}x: ${label}`);
}

// ---- SFR-LAY-6-1: LAY-20 register row ----
patch(
  "CHECK-REGISTER.md",
  "| LAY-20 | Scale factor `u` is not a no-op | `grep \"Math.min(width, height) / 1080\"` | 0 hits | 1 | MAJOR | 4 | **PASS** |",
  "| LAY-20 | Scale factor `u` is not a no-op | `grep \"Math.min(width, height) / 1080\"` | 1 hit @ compositions/mg-style.js:150-151 (scaleUnit, applied — not a no-op; stage-4 ledger's \"0 hits\" was stale) | 1 | MAJOR | 4 | **PASS** |",
  "SFR-LAY-6-1 LAY-20 evidence correction"
);

// ---- SFR-LAY-6-3: MANUAL channel list 12 -> 13 ----
patch(
  "MOTION-GRAPHICS-MANUAL.md",
  "**Applies to:** `style: \"motion-graphics\"` only — 12 channels in `config/channels.json`:\nLegal Brief · Border Lines · Quantum Canvas · Earth Signal · Fraud Files ·\nMachine Anatomy · Build Smart · MedBrief · Mind & Body Files · NutriDecode ·\nSkill Stack · Factory Floor",
  "**Applies to:** `style: \"motion-graphics\"` only — 13 channels in `config/channels.json`:\nMoney Mind · Legal Brief · Border Lines · Quantum Canvas · Earth Signal ·\nFraud Files · Machine Anatomy · Build Smart · MedBrief · Mind & Body Files ·\nNutriDecode · Skill Stack · Factory Floor",
  "SFR-LAY-6-3 MANUAL 12->13 channel list"
);

console.log(`Total: ${changed}`);
