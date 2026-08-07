// Orchestrator application of Stage-4 SFRs for the docs:
//   SFR-LAY-1  MOTION-GRAPHICS-MANUAL.md A1.3 + B2 (caption zone 1152, maxWidth 760, B2.2 96px)
//   SFR-LAY-6  LAYOUT-SYSTEM.md §3.1 (multiple-of-8 carve-out) + §3.7 (longform overlap) + rail note
//   SFR-LAY-7  CHECK-REGISTER.md LAY-02/03/04/05/20 -> PASS; LAY-10 method note; LAY-12 version note
import { readFileSync, writeFileSync } from "fs";

let changed = 0;
function apply(file, pairs) {
  let c = readFileSync(file, "utf8");
  for (const [a, b] of pairs) {
    if (!c.includes(a)) {
      console.log(`${file}: already applied or absent (idempotent skip): ${a.slice(0, 60)}...`);
      continue;
    }
    const n = c.split(a).length - 1;
    c = c.split(a).join(b);
    changed += n;
    console.log(`${file}: replaced ${n}x [${a.slice(0, 60)}...]`);
  }
  writeFileSync(file, c, "utf8");
}

// ── SFR-LAY-1: MANUAL ─────────────────────────────────────────────────────────
apply("MOTION-GRAPHICS-MANUAL.md", [
  ["| Caption | 1148 \u2013 1248 |", "| Caption | 1152 \u2013 1248 |"],
  ["  zoneTop:     1148,", "  zoneTop:     1152,"],
  ["  maxWidth:    780,", "  maxWidth:    760,"],
  ["**B2.2** \u2014 Two lines at 64 px \u00d7 1.12 = 143 px, which overflows the 100 px\nzone", "**B2.2** \u2014 Two lines at 64 px \u00d7 1.12 = 143 px, which overflows the 96 px\nzone"],
]);

// ── SFR-LAY-6: LAYOUT-SYSTEM ──────────────────────────────────────────────────
const ls = readFileSync("LAYOUT-SYSTEM.md", "utf8");
const old31 = "Every value is a multiple of 4; every width\nand height is a multiple of 8.";
const new31 = "Every value is a multiple of 4; every resolved width\nand height is a multiple of 8. The two table values that are multiples of 4 but\nnot of 8 are deliberate: the rail width 4 (a 4 px stroke rule, TYP-18) and the\nstage height 548 (392\u2013940, confirmed by the live renderers) \u2014 grid\nmultiples apply to resolved rects, not to these two structural constants.";
if (!ls.includes(old31)) { console.log("LAYOUT-SYSTEM.md: §3.1 already applied (idempotent skip)"); }
else {
  changed += 1;
  writeFileSync("LAYOUT-SYSTEM.md", ls.split(old31).join(new31), "utf8");
  console.log("LAYOUT-SYSTEM.md: §3.1 carve-out applied");
}

const old37 = "**3.7 \u2014 Slots never overlap.** The one exception is a 2-line caption growing\nupward into the bottom 48 px of `headline`, which is why `headline` is\n176 tall but its content box is 128 (\u00a75.3).";
const new37 = "**3.7 \u2014 Slots never overlap (Shorts).** The one exception is a 2-line caption growing\nupward into the bottom 48 px of `headline`, which is why `headline` is\n176 tall but its content box is 128 (\u00a75.3). **Longform caveat (corrected\n2026-08-07):** in `SLOTS_LONGFORM` the caption slot (884\u2013980) overlaps the\nheadline slot (780\u2013924) by 40 px in the static table \u2014 the two-line caption\n(980 \u2212 143 = 837) also collides with the headline content box (780\u2013876).\nThe longform table therefore keeps the same \u00a73.7 rule, but the headline\ncontent box must be kept clear when a two-line caption is active, exactly as\nin Shorts. The longform rail spans 100\u2013924 (it ends at the headline slot\nbottom, not the safe bottom) \u2014 documented because, unlike the Shorts rail,\nit is not full-safe-height.";
if (!ls.includes(old37)) { console.log("LAYOUT-SYSTEM.md: §3.7 already applied (idempotent skip)"); }
else {
  writeFileSync("LAYOUT-SYSTEM.md", ls.split(old37).join(new37), "utf8");
  console.log("LAYOUT-SYSTEM.md: §3.7 longform caveat applied");
}

// ── SFR-LAY-7: CHECK-REGISTER (mojibake-safe per-line prefix matching) ────────
const reg = readFileSync("CHECK-REGISTER.md", "utf8");
const lines = reg.split("\n");
let hits = 0;
const rowFor = (id) => {
  const i = lines.findIndex((l) => l.startsWith(`| ${id} |`));
  if (i < 0) throw new Error(`register row ${id} not found`);
  return i;
};
const endState = (line, newState) => {
  // CRLF-tolerant: drop trailing \r, replace final state cell, restore nothing (split("\\n") keeps \\r inside line)
  const stripped = line.replace(/\r$/, "");
  if (/\*\*FAIL\*\*/.test(stripped)) {
    const i = stripped.lastIndexOf("**FAIL**");
    return stripped.slice(0, i) + newState + " |";
  }
  if (/\| N\/B \|$/.test(stripped)) {
    return stripped.replace(/\| N\/B \|$/, `| ${newState} |`);
  }
  throw new Error(`no state cell found in: ${line}`);
};

let i = rowFor("LAY-02");
lines[i] = endState(lines[i], "**PASS**");
hits++;
i = rowFor("LAY-03");
lines[i] = endState(lines[i], "**PASS**");
hits++;
i = rowFor("LAY-04");
lines[i] = endState(lines[i], "**PASS**");
hits++;
i = rowFor("LAY-05");
lines[i] = endState(lines[i], "**PASS**");
hits++;
i = rowFor("LAY-20");
lines[i] = endState(lines[i], "**PASS**");
hits++;
i = rowFor("LAY-10");
lines[i] = lines[i].replace(
  "`grep` in `styles/`, `beats/`",
  "`grep` in `styles/`, `beats/`; `compositions/` raw dupes tracked (D2: stale 1148)"
);
hits++;
i = rowFor("LAY-12");
lines[i] = lines[i].replace(
  "Tier 2 probe \u00c3\u00b7 `useCurrentScale()`",
  "Tier 2 probe \u00c3\u00b7 `useCurrentScale()` (doc conflict 4.0.111 vs 4.0.125, resolved by 4.0.505 install)"
);
hits++;
writeFileSync("CHECK-REGISTER.md", lines.join("\n"), "utf8");
console.log(`CHECK-REGISTER.md: ${hits} LAY rows updated`);

console.log(`\nTotal replacements: ${changed + hits}`);
