// Orchestrator applies ESCLAY-5-1 resolution — decision option 1:
// browser-time measurement feeding the compiler.
// Amends LAYOUT-SYSTEM.md Part 4 intro + R3 + Part 8 tree/build-order notes.
// Line-ending aware; exact-match; idempotent.
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "LAYOUT-SYSTEM.md";
let src = readFileSync(FILE, "utf8");
const eol = src.includes("\r\n") ? "\r\n" : "\n";
console.log(`EOL: ${JSON.stringify(eol)}`);
let changed = 0;

function replaceOne(oldStr, newStr, label) {
  const n = src.split(oldStr).length - 1;
  if (n === 0) {
    console.log(`SKIP (not found): ${label}`);
    return;
  }
  if (n > 1) console.log(`WARN ${n} matches: ${label}`);
  src = src.split(oldStr).join(newStr);
  changed += n;
  console.log(`APPLIED ${n}x: ${label}`);
}

// 1) Part 4 intro — compile.js is pure Node layout math; measurement is browser-fed
replaceOne(
  "`compositions/layout/compile.js` \u2014 pure, synchronous, runs in Node **before**" + eol +
  "any browser starts.",
  "`compositions/layout/compile.js` \u2014 pure layout math, synchronous, runs in Node." + eol +
  "Text measurement is NOT performed inside compile.js: the @remotion/layout-utils" + eol +
  "measurement functions throw outside a browser (machine-verified on the installed" + eol +
  "4.0.506, and documented: \u201cOnly works in the browser, not in Node.js or Bun.\u201d," + eol +
  "ESCLAY-5-1, resolved 2026-08-07, option 1). Measurement runs in the browser once," + eol +
  "before render, through layout/measure.js (font gate armed); its results are passed" + eol +
  "into compile() as input, and compile resolves geometry from them.",
  "Part 4 intro (compile.js browser-fed)"
);

// 2) R3 — measure before place, browser-time
replaceOne(
  "**R3 \u2014 Measure before place.** Any rect whose size depends on text calls" + eol +
  "`measureText()` at compile time with the *exact* font properties that will be" + eol +
  "used at render time, and stores the result in the rect. Nothing is measured in" + eol +
  "the browser during a render.",
  "**R3 \u2014 Measure before place (browser-time).** Any rect whose size depends on" + eol +
  "text is measured in the browser through layout/measure.js \u2014 the gated wrappers," + eol +
  "so an unloaded font throws \u2014 *before* compile() runs, and the measured widths" + eol +
  "and line counts are passed into compile() as input. Nothing is measured inside" + eol +
  "compile.js (the library throws in Node), and nothing is measured *during* a" + eol +
  "render frame.",
  "R3 measure-before-place (browser-time)"
);

// 3) Part 8.1 target tree comment for compile.js
replaceOne(
  "│   ├── compile.js          # Part 4. Pure. No React, no browser.",
  "│   ├── compile.js          # Part 4. Pure layout math, Node. No measurement (browser-fed).",
  "8.1 tree compile.js comment"
);

// 4) Part 8.5 — steps 1-4 no-browser claim, now qualified
replaceOne(
  "**8.5** \u2014 Steps 1\u20134 require no browser and no render. Roughly half the work",
  "**8.5** \u2014 Steps 1\u20132 require no browser and no render. Step 3 (measure.js)",
  "8.5 first line"
);

writeFileSync(FILE, src, "utf8");
console.log(`Total: ${changed}`);
