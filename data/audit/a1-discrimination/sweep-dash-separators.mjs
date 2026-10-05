/**
 * Close the U+2014 class, not the instance.
 *
 * Two tests in a row failed on dash mismatch: test-verify-image asserted "FLAT - centered"
 * (hyphen) against a prompt saying "FLAT — centered" (U+2014), and test-scene-primitives
 * asserted "  <kind> - " against a digest that writes "  <kind> — ". Both were read in a
 * PowerShell session that renders U+2014 as "-", so the mismatch was invisible until the
 * assertion ran.
 *
 * So: which separator does each generator emit, and which tests hardcode the other one?
 * A test that asserts on separator output is only correct if it normalises, because the
 * codepoint is a presentation choice that has already changed once in this repo's history.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const files = execFileSync("git", ["ls-files"], { encoding: "utf8", maxBuffer: 1 << 26 })
  .split("\n").filter((f) => /\.(js|cjs|mjs|jsx|json|md)$/.test(f));

const EM = "—";        // em dash
const EN = "–";        // en dash
const HY = "-";        // hyphen-minus

const rows = [];
for (const f of files) {
  let t;
  try { t = readFileSync(f, "utf8"); } catch { continue; }
  const em = (t.match(new RegExp(EM, "g")) || []).length;
  const en = (t.match(new RegExp(EN, "g")) || []).length;
  if (em || en) rows.push({ f, em, en });
}

rows.sort((a, b) => (b.em + b.en) - (a.em + a.en));
console.log(`files containing U+2014/U+2013: ${rows.length}\n`);
console.log("file".padEnd(62), "em", "en");
for (const r of rows.slice(0, 18)) console.log(r.f.padEnd(62), String(r.em).padStart(3), String(r.en).padStart(3));

// The pattern that actually breaks: a test hardcoding a hyphen where generated text uses
// an em dash (or the reverse) in an assertion.
console.log("\n--- test assertions that hardcode a hyphen separator inside a quoted string ---");
const risky = [];
for (const f of files.filter((x) => /test-.*\.m?js$/.test(x))) {
  const t = readFileSync(f, "utf8");
  const lines = t.split("\n");
  lines.forEach((line, i) => {
    // .includes("...") / toContain("...") / === "..." with an internal " - " or " — "
    const m = line.match(/(includes|toContain|toBe|match|test)\(\s*["'`]([^"'`]*\s[-–—]\s[^"'`]*)["'`]/);
    if (!m) return;
    const lit = m[2];
    const hasEm = lit.includes(EM);
    const hasEn = lit.includes(EN);
    const hasHy = lit.includes(" - ") || lit.includes(/[A-Za-z0-9]-[A-Za-z0-9]/);
    if (hasHy && !hasEm && !hasEn) {
      risky.push({ f, n: i + 1, lit: lit.slice(0, 70) });
    }
  });
}
for (const r of risky) console.log(`  ${r.f}:${r.n}  ${JSON.stringify(r.lit)}`);
console.log(`\n${risky.length} assertion(s) hardcode a hyphen separator.`);

// Do the generators those tests read use em dashes?
console.log("\n--- verdict ---");
const generatorsUseEm = rows.some((r) => /scene-primitives|verify-image|visual-bible/.test(r.f));
console.log(generatorsUseEm
  ? "Generators emit U+2014, so any test asserting a hyphen separator against generated text is fragile by construction."
  : "No generator found emitting U+2014; the hyphen assertions are not at risk.");