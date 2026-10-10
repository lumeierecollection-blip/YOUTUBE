import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Board 38054686824 ch 49: the beat check named a face "Chase Sui Wonders" for a portrait whose source file is Inde Navarrette's (identity-audit:
// the file's categories, its uploader, the article it sits in and Wikidata's P18 all say Navarrette). The model was asked to judge whether a
// face matched the named person; it cannot do that reliably. The prompt must not ask it to.
test("the beat check does not ask a model to judge whether a face matches a named person", () => {
  const src = readFileSync(new URL("../gemini-frame-review.js", import.meta.url), "utf8");
  assert.ok(!/face plausibly matches/i.test(src), "the face-identity question is gone");
  assert.ok(/do NOT decide who a face is/i.test(src), "the prompt says identity is not the model's to judge");
  assert.ok(/plainly shows a child/i.test(src), "the wrong-person failure is kept for what is visible without identity");
});
