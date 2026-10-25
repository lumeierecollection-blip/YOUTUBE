/**
 * Reference frames reach the planner as images (scripts/reference-frames.js).
 *
 * Before: the reference videos were only compared AFTER a render (Layer 2); the planner planned
 * from the hand-written style spec. These tests assert the frames exist per channel, that the
 * message content Gemini receives carries them as image parts, and that every Gemini planner call
 * (first, strict retry, context-cache path) is built with them.
 *
 * MUTATION (run, recorded in the commit): withReferenceImages returning the bare text turns the
 * "content carries the frames" test red. Restored byte-identical.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { referenceFramesFor, withReferenceImages, imageParts, referenceTimestamps, REFERENCE_NOTE, FRAME_COUNT } from "../reference-frames.js";

describe("reference frames per channel", () => {
  it("ch-05 gets 4 frames of its own spec's reference video, committed under channels/ch-05", () => {
    const r = referenceFramesFor("5", { extract: false });
    assert.equal(r.files.length, FRAME_COUNT);
    assert.equal(r.source, JSON.parse(readFileSync("channels/ch-05/style-spec.json", "utf8")).reference_video);
    assert.equal(r.dir, "channels/ch-05/reference-frames");
  });
  for (const ch of ["6", "8", "10"]) {
    it(`ch-${ch} gets its own reference's frames`, () => assert.equal(referenceFramesFor(ch, { extract: false }).files.length, FRAME_COUNT));
  }
  it("a channel with no reference of its own gets the shared set Layer 2 scores it against", () => {
    const r = referenceFramesFor("1", { extract: false });
    assert.equal(r.files.length, FRAME_COUNT);
    assert.equal(r.dir, "channels/_shared/reference-frames");
  });
  it("timestamps are evenly spaced and skip the first and last 0.5 s", () => {
    const t = referenceTimestamps(10);
    assert.equal(t.length, 4);
    assert.ok(t[0] > 0.5 && t[3] < 9.5);
    assert.ok(Math.abs((t[1] - t[0]) - (t[3] - t[2])) < 1e-6);
  });
});

describe("the planner call carries them", () => {
  it("content carries the frames as image parts, after the text and the 'do not copy' note", () => {
    const parts = imageParts(referenceFramesFor("5", { extract: false }).files);
    const c = withReferenceImages("PROMPT", parts);
    assert.ok(Array.isArray(c));
    assert.equal(c[0].type, "text");
    assert.ok(c[0].text.startsWith("PROMPT") && c[0].text.includes(REFERENCE_NOTE));
    assert.match(REFERENCE_NOTE, /Do not copy them/);
    const imgs = c.filter((p) => p.type === "image_url");
    assert.equal(imgs.length, FRAME_COUNT);
    for (const p of imgs) assert.match(p.image_url.url, /^data:image\/jpeg;base64,\/9j\//);
  });
  it("no frames: the text alone, unchanged", () => assert.equal(withReferenceImages("PROMPT", []), "PROMPT"));
  it("every Gemini planner call is built with them (first call, strict retry, cached path)", () => {
    const src = readFileSync("scripts/gemini-visual-plan.js", "utf8");
    assert.match(src, /callGeminiApi\(\[\{ role: "user", content: withReferenceImages\(prompt, refParts\) \}\]/);
    assert.match(src, /callGeminiApi\(\[\{ role: "user", content: withReferenceImages\(strictPrompt, refParts\) \}\]/);
    assert.match(src, /content: withReferenceImages\(dynamicPart \+ extra, refParts\)/);
    assert.match(src, /reference frames attached to the planner call/);
  });
});
