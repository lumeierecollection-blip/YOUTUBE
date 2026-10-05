// Lint: tests must not hardcode a separator codepoint when asserting against generated text.
//
// Two tests in a row failed on exactly this. test-verify-image asserted "FLAT - centered"
// (hyphen) against a prompt saying "FLAT — centered" (U+2014). test-scene-primitives
// asserted "  <kind> - " against a digest that writes "  <kind> — " and reported 14 spurious
// failures once the regex used a literal hyphen. Both were invisible while reading the code,
// because the console renders U+2014 as "-".
//
// Em dashes are the house convention (1174 tracked files contain U+2014 or U+2013), and the
// codepoint is a presentation choice that has already changed once. So an assertion that
// pins it is a false failure waiting for a reword.
//
// This does NOT forbid a hyphen — `"\u2010-\u2015"` character classes and word-internal
// hyphens are fine, and asserting an exact string that genuinely contains a hyphen is fine
// when the generator provably emits one. It only catches a literal " - " or " — " separator
// inside an assertion, which is the shape that broke twice.
//
// Run: node scripts/test-assertion-separators.mjs
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const EM = "—";
const tests = execFileSync("git", ["ls-files"], { encoding: "utf8", maxBuffer: 1 << 26 })
  .split("\n").filter((f) => /(^|\/)test-.*\.m?js$/.test(f));

// An assertion that pins a separator: a quoted literal with a SPACED dash between two word
// characters — " - ", " — ", " – ". Word-internal hyphens are NOT this: "TYPE-FULL",
// "COMPARISON-SPLIT" and "number-roll" are identifiers, and flagging them would be noise.
// The spaces are what separate the two tests that actually broke ("FLAT - centered",
// "  <kind> - ") from the sixty identifiers that merely contain a dash.
//
// A first attempt also demanded whitespace BEFORE the character preceding the dash, which
// never matches a real case ("FLAT — centered": the T is mid-word) and so the guard could
// never fire. Verified against the planted pre-fix violation before trusting it.
const isSeparator = (s) => /[A-Za-z0-9] [-–—] [A-Za-z0-9]/.test(s);

const hits = [];
for (const f of tests) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    // This repo's assertion conventions: ok(cond, "message") — the first literal is ALWAYS a
    // human message, and messages are allowed to contain em dashes as prose. eq(got, want)
    // and the matchers take values. So a message is skipped and only values are checked;
    // without that, every message containing " — " is a false positive.
    const call = line.match(/\b(ok|eq|assert[A-Za-z]*)\s*\(/);
    if (!call) return;
    const isOk = call[1] === "ok";
    const isEq = call[1] === "eq";
    if (!isOk && !isEq && !/\.(includes|toContain|toBe|toEqual|matches|match|startsWith|endsWith)\s*\(/.test(line)) return;

    const literals = [...line.matchAll(/(["'`])((?:[^"'`\\]|\\.)*)\1/g)].map((m) => m[2]);
    // Drop a leading message for ok(); eq() takes values in both positions.
    const candidates = isOk ? literals.slice(1) : literals;
    for (const literal of candidates) {
      if (!isSeparator(literal)) continue;
      hits.push({ f, n: i + 1, literal: literal.slice(0, 72), around: (literal.match(/[A-Za-z0-9] [-–—] [A-Za-z0-9]/) || [""])[0] });
      break; // one report per line is enough
    }
  });
}

if (!hits.length) {
  console.log(`ok   no test pins a separator codepoint (${tests.length} test files scanned)`);
  console.log("ok   assertions against generated text normalise, so a reword cannot fail them");
  console.log("\nall pass");
  process.exit(0);
}

console.log(`${hits.length} assertion(s) pin a separator codepoint:\n`);
for (const h of hits) console.log(`  ${h.f}:${h.n}  ${JSON.stringify(h.literal)}\n      matched: ${JSON.stringify(h.around)}`);
console.log("\nEach needs a decision: normalise it, or assert a generator that provably emits that exact character.");
process.exit(1);