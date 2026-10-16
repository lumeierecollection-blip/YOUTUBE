// Script clarity word tests (owner 2026-10-16): comment-only sentences and "she" before anyone is named are flagged; real story lines are not.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { wordTests, validateClarity } = require("../validate-script-clarity.cjs");

const script = (lines) => ({ sections: [{ id: "setup", voiceover: lines.join(" ") }] });

test("board 38831133468 ch-44's comment line and nameless 'she' are flagged", () => {
  const p = wordTests(script(["Nearly one in five workers say their job changed after they were hired.", "That's a shocking reality.", "Yet as soon as she started, the dream unraveled."]), null);
  assert.deepEqual(p.map((x) => x.n), [2, 3]);
});

test("a named person then 'she', and a short turn line, pass", () => {
  const p = wordTests(script(["Maria Lopez joined Acme Corp in March 2026.", "Within a week she was moved to night shifts.", "That's the trap."]), { named_entities: [{ name: "Maria Lopez", kind: "person" }] });
  assert.deepEqual(p, []);
});

test("without the model, clarity is the word tests' verdict in the re-ask's line format", () => {
  const r = validateClarity(script(["That's a shocking reality."]), null, { useModel: false });
  assert.equal(r.pass, false);
  assert.match(r.lines[0], /^  - CLARITY: sentence 1 /);
});
