// Stage 7 SFR application — orchestrator-owned application of the lanes'
// shared-file requests, read from the two ledgers:
//   data/audit/7/audit-layout.ledger.md  §5.3 (SFR-LAY-7-1..7-7)
//   data/audit/7/audit-motion.ledger.md  §3  (SFR-motion-1/2/4)
// Idempotent: a request whose exact-match is already satisfied is skipped.
// Uses exact-match Node strings (UTF-8-safe, unlike PowerShell display).

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function read(p) {
  return fs.readFileSync(path.join(ROOT, p), "utf8");
}
function write(p, s) {
  fs.writeFileSync(path.join(ROOT, p), s);
}
function splitLines(s) {
  return s.split(/\r?\n/);
}
function joinLines(a) {
  // preserve the file's own line-ending style
  const crlf = readLineEnding(a);
  return a.join(crlf);
}
let __endingCache = {};
function readLineEnding(fileContent) {
  // detect from content: \r\n vs \n
  const crlf = (fileContent.match(/\r\n/g) || []).length;
  const lf = (fileContent.match(/(?<!\r)\n/g) || []).length;
  return crlf >= lf ? "\r\n" : "\n";
}
function replaceOnce(p, before, after, label, endingsKeep) {
  const s = read(p);
  if (s.includes(before)) {
    const n = s.split(before).length - 1;
    if (n !== 1) {
      console.log(`SKIP ${label}: BEFORE occurs ${n}x (not exactly once) — manual review needed`);
      return false;
    }
    const out = s.replace(before, after);
    write(p, out);
    console.log(`APPLIED 1x: ${label}`);
    return true;
  }
  if (s.includes(after)) {
    console.log(`IDEMPOTENT: ${label} already applied`);
    return true;
  }
  console.log(`MISS: ${label} — BEFORE not found; after absent too. Manual review.`);
  return false;
}

// ---------- SFR-LAY-7-1 .. SFR-LAY-7-5 : move the primitive drafts ----------
const primTarget = "src/skills/remotion-render/primitives";
fs.mkdirSync(path.join(ROOT, primTarget), { recursive: true });
const drafts = [
  ["Rule.jsx", "SFR-LAY-7-1"],
  ["Chip.jsx", "SFR-LAY-7-2"],
  ["Node.jsx", "SFR-LAY-7-3"],
  ["Panel.jsx", "SFR-LAY-7-4"],
  ["Icon.jsx", "SFR-LAY-7-5"],
];
for (const [name, id] of drafts) {
  const src = path.join(ROOT, "data/audit/7/primitives-draft", name);
  const dst = path.join(ROOT, primTarget, name);
  if (fs.existsSync(dst)) {
    console.log(`IDEMPOTENT: ${id} ${name} already at primitives/`);
    continue;
  }
  if (!fs.existsSync(src)) {
    console.log(`MISS: ${id} — draft ${src} not found`);
    continue;
  }
  fs.copyFileSync(src, dst);
  console.log(`APPLIED: ${id} → primitives/${name}`);
}

// ---------- SFR-LAY-7-6 : MANUAL D2.1 POP easing cell single E.out ----------
{
  const p = "MOTION-GRAPHICS-MANUAL.md";
  const before = "| `scale` | 0 \u2192 5 \u2192 9 | 0 \u2192 1.15 \u2192 1.00 | `[E.out, E.settle]` |";
  const after = "| `scale` | 0 \u2192 5 \u2192 9 | 0 \u2192 1.15 \u2192 1.00 | `E.out` |";
  replaceOnce(p, before, after, "SFR-LAY-7-6 MANUAL D2.1 POP easing", true);
}

// ---------- SFR-LAY-7-7 : MANUAL A5.1 Node border cell ----------
{
  const p = "MOTION-GRAPHICS-MANUAL.md";
  const before = "| Node | flow/relation points | circle, r 44, `surface` fill, 3 px `accent` border |";
  const after = "| Node | flow/relation points | circle, r 44, `surface` fill, 3 px `stroke` border, `accent` when highlighted |";
  replaceOnce(p, before, after, "SFR-LAY-7-7 MANUAL A5.1 Node border", true);
}

// ---------- SFR-motion-1 : BLUEPRINT §12 MDC duration range ----------
{
  const p = "MOTION-BLUEPRINT.md";
  const before = "- `material-components-android/docs/theming/Motion.md` \u2014 duration slot values (50\u2013500 ms)";
  const after = "- `material-components-android/docs/theming/Motion.md` \u2014 duration slot values (50\u20131000 ms; the 16 slots: short1 50ms, short2 100ms, short3 150ms, short4 200ms, medium1 250ms, medium2 300ms, medium3 350ms, medium4 400ms, long1 450ms, long2 500ms, long3 550ms, long4 600ms, extraLong1 700ms, extraLong2 800ms, extraLong3 900ms, extraLong4 1000ms)";
  replaceOnce(p, before, after, "SFR-motion-1 BLUEPRINT §12 MDC range", true);
}

// ---------- SFR-motion-2 : BLUEPRINT Rule 1.6 alone -> unopposed ----------
{
  const p = "MOTION-BLUEPRINT.md";
  const before = [
    "**Rule 1.6 \u2014 One primary mover per beat.** The hero element animates first,",
    "largest, and alone. Secondary elements stagger `D.micro` (4f) behind it.",
    "Never three elements moving the same way at the same time.",
  ].join("\n");
  const after = [
    "**Rule 1.6 \u2014 One primary mover per beat.** The hero element animates first,",
    "largest, and unopposed \u2014 no element animates with the same motion at the same",
    "time. Secondary elements stagger `D.micro` (4f) behind it and may overlap the",
    "primary\u2019s animation (offsets shorter than the animation duration; `D.micro` = 133 ms",
    "sits inside equal.design\u2019s 80\u2013150 ms related-items bracket, while per-item sequences",
    "use tighter ranges \u2014 Material \u226420 ms per item, designsystems.one 40\u201380 ms, UI Craft",
    "30\u201380 ms). Never three elements moving the same way at the same time.",
  ].join("\n");
  replaceOnce(p, before, after, "SFR-motion-2 BLUEPRINT Rule 1.6", true);
}

// ---------- SFR-motion-4 : BLUEPRINT cite 39-1 broadcast framing ----------
{
  const p = "MOTION-BLUEPRINT.md";
  const before =
    '<cite index="39-1">Comfortable reading is roughly 180\u2013220 words per minute (about 3\u20134 words per second); a seven-word line typically needs 1.8\u20132.5 seconds on screen, and a practical display-time formula is seconds = (characters \u00f7 12) + 0.5, rounded up to the nearest 0.25 s to align with beats.</cite>';
  const after =
    '<cite index="39-1">Comfortable reading is roughly 180\u2013220 words per minute (about 3\u20134 words per second); a seven-word line typically needs 1.8\u20132.5 seconds on screen, and a practical display-time formula is seconds = (characters \u00f7 12) + 0.5, rounded up to the nearest 0.25 s to align with beats. Broadcast subtitle standards are tighter: Ofcom and BBC publish 160\u2013180 wpm (Ofcom: pre-recorded "should not normally exceed 160 to 180 words per minute"; above 200 "difficult for many viewers"), ITC caps at \u2264140 wpm (180 exceptional), and DCMP\u2019s caps are content-tiered (120\u2013160 wpm standard, 225\u2013235 wpm adult theatrical) \u2014 so D.hold is a conservative minimum floor, not a reading duration.</cite>';
  replaceOnce(p, before, after, "SFR-motion-4 BLUEPRINT cite 39-1", true);
}

console.log("\\n=== Stage 7 SFR application complete ===");
