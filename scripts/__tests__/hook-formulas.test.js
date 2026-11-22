// The writer prompt carries the faceless-safe hook formulas from prompts/hooks/hooks.json (MIT, credited), generated, never hand-edited.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { loadFormulas, renderHookSection, withHookSection, FACELESS_FORMULAS, BEGIN, END } from "../lib/hook-formulas.mjs";

const prompt = readFileSync(new URL("../../prompts/write-script.md", import.meta.url), "utf8").split("\r").join("");

test("the prompt's generated block is exactly what the library renders (regenerate with node scripts/lib/hook-formulas.mjs)", () => {
  const b = prompt.indexOf(BEGIN), e = prompt.indexOf(END);
  assert.ok(b > 0 && e > b, "block present");
  assert.equal(prompt.slice(b, e + END.length), renderHookSection());
  assert.equal(withHookSection(prompt), prompt, "regenerating changes nothing");
});

test("only formulas a faceless, sourced channel can honour are offered, and the licence travels with the file", () => {
  const f = loadFormulas();
  assert.equal(f.length, FACELESS_FORMULAS.length);
  for (const banned of ["i-tried-it", "the-origin", "the-receipt", "the-insider", "the-stack", "someone-elses-result"]) assert.ok(!FACELESS_FORMULAS.includes(banned), banned);
  assert.ok(existsSync(new URL("../../prompts/hooks/LICENSE-youtube-agent-skill.txt", import.meta.url)));
  assert.match(readFileSync(new URL("../../prompts/hooks/LICENSE-youtube-agent-skill.txt", import.meta.url), "utf8"), /MIT License[\s\S]*Jake Schincariol/);
  assert.match(prompt, /still comes from the research/);
});
