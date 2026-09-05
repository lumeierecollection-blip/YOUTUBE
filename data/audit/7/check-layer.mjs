// Stage-7 register-pattern checks against the LAY-10..13 register method
// wording (CHECK-REGISTER.md lines 136-139). Scratch — deletable.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const file = path.join(__dirname, "..", "..", "..", "src", "skills", "remotion-render", "layers", "Layer.jsx");
const src = fs.readFileSync(file, "utf8");

// LAY-11 pattern (register verbatim): grep 'display: *"flex"' — the register
// requires the quoted VALUE form.
const flexPattern = /display:\s*["']flex/g;
const flexHits = src.match(flexPattern);
console.log("LAY-11 flex pattern hits (whole file, incl. comments):", flexHits ? flexHits.length : 0);

// Code-only: strip comment lines and block-comment bodies, then re-check.
const code = src
  .split("\n")
  .filter((l) => {
    const t = l.trim();
    return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/**") && !t.startsWith("/*");
  })
  .join("\n");
const flexCode = code.match(flexPattern);
console.log("LAY-11 flex pattern hits (code only):", flexCode ? flexCode.length : 0);

// LAY-10: zero raw pixel coordinates — every position derives from rect.x/y/w/h.
// Check that all numeric layout values route through rect. `24` (RISE_OFFSET) is a
// motion translate offset, not a position; that is a documented motion constant.
const twoPlus = src.match(/\b\d{2,}\b/g) || [];
console.log("two-digit+ literals (should only be motion/curve constants):", JSON.stringify(twoPlus));

// Exit-p convention sanity: exactly one window per exit type, all values 0..1.
const easeCalls = src.match(/ease\([^;]+?\)/g) || [];
console.log("ease( calls:", easeCalls.length);
for (const c of easeCalls) console.log("  ", c.replace(/\s+/g, " ").slice(0, 110));

// No raw `translate:` string composition (the bug that was fixed): only numeric
// translateY composition in the style object.
const translateInStyle = src.match(/translate:\s*`/g);
console.log("raw translate template-literal in style:", translateInStyle ? translateInStyle.length : 0);
const translateYUses = src.match(/translateY/g) || [];
console.log("translateY occurrences:", translateYUses.length);
