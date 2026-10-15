// video-tone: one decision per video — what the viewer should feel, and what that forbids (owner, 2026-10-15, ch-2: "too playful").
import { test } from "node:test";
import assert from "node:assert/strict";
import { toneOf, deliveryFor } from "../../src/utils/video-tone.js";
import { geminiVoiceFor } from "../../src/utils/gemini-voice.js";

const CH2 = "Federal immigration agents are sworn to uphold the law, but one ICE agent now faces felony charges on Highway 62. Court records show 2 counts of second-degree assault involving a dangerous weapon.";

test("the ch-2 story (felony assault charges) is grave: no music, no SFX, a low steady voice", () => {
  const t = toneOf({ text: CH2, channelTone: "authoritative-empowering" });
  assert.equal(t.gravity, "grave");
  assert.equal(t.music, false);
  assert.equal(t.sfx.max, 0);
  assert.match(t.emotion, /weight|sober/);
});

test("a story can make a video graver than its channel's tone, never lighter", () => {
  assert.equal(toneOf({ text: "A man was killed in the crash.", channelTone: "playful-educational" }).gravity, "grave");
  assert.equal(toneOf({ text: "The fund faces fraud charges.", channelTone: "friendly-encouraging" }).gravity, "serious");
  assert.equal(toneOf({ text: "Sourdough rises because yeast eats sugar.", channelTone: "playful-educational" }).gravity, "light");
});

test("the default keeps the documentary read, the music bed and the effects", () => {
  const t = toneOf({ text: "The telescope captured a new image of the nebula.", channelTone: "awe-inspiring" });
  assert.equal(t.gravity, "measured");
  assert.equal(t.music, true);
  assert.equal(t.sfx.max, Infinity);
  assert.equal(t.hits.length, 0);
});

test("whole words only: 'warm' is not 'war', 'shot' is not 'shotgun-free'", () => {
  assert.equal(toneOf({ text: "A warm, warrantied toaster." }).gravity, "measured");
});

test("the voice: grave and serious get their own delivery; everything else is exactly what it was", () => {
  const was = geminiVoiceFor("en-US-GuyNeural");
  assert.match(was.style, /warm, engaged and conversational/);
  assert.deepEqual(geminiVoiceFor("en-US-GuyNeural", null, "measured"), was);
  assert.deepEqual(geminiVoiceFor("en-US-GuyNeural", null, "light"), was);
  assert.deepEqual(geminiVoiceFor("en-US-GuyNeural", null, null), was);
  const g = geminiVoiceFor("en-US-GuyNeural", null, "grave");
  assert.equal(g.voice, was.voice, "the voice itself is not changed");
  assert.match(g.style, /serious news correspondent/);
  assert.doesNotMatch(g.style, /warm|conversational/);
  assert.match(deliveryFor("serious", { british: true }), /British/);
  assert.equal(deliveryFor("measured"), null);
});
