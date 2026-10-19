// THE DETERMINISTIC PLAN REPAIR (render-and-qa.js, challenger auto-correct).
//
// Run 39308784564 ch-2 was rejected twice by the challenger: its COUNTER beats
// showed the model version 5.5 and the passing count 4 instead of the measured
// figures 31.7 and 69.5 minutes, and its PHOTO beat showed the Anthropic logo
// for the sentence about testing both models. The old auto-correct rewrote only
// headline strings, so the picture and the number stayed wrong.
//
// This holds the two repairs that replaced it: measuredFigures() picks the one
// unit-bearing figure a sentence states, and forceTypeCard() turns a picture no
// repair can make truthful into a text card.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { measuredFigures, forceTypeCard } from "../render-and-qa.js";

describe("measuredFigures", () => {
  it("picks the measured figure, not the model version before it", () => {
    assert.deepEqual(measuredFigures("Claude Opus 5.5 finishes faster at 31.7 minutes."), [
      { value: "31.7", unit: "minutes" },
    ]);
  });

  it("picks the measured figure, not the count of items", () => {
    assert.deepEqual(measuredFigures("Yet Gemini 4 Argon takes 69.5 minutes to complete the task."), [
      { value: "69.5", unit: "minutes" },
    ]);
  });

  it("does not read a bare price or a bare number as a measured figure", () => {
    assert.deepEqual(measuredFigures("Gemini 4 Argon charges $9.23."), []);
  });

  it("returns every distinct unit-bearing figure, so the caller can refuse", () => {
    assert.deepEqual(measuredFigures("It grew from $7 million to $9 million."), [
      { value: "$7", unit: "million" },
      { value: "$9", unit: "million" },
    ]);
  });
});

describe("forceTypeCard", () => {
  const photoBeat = () => ({
    kind: "EDITORIAL",
    visual_type: "PHOTO",
    canvas_composition: "SCENE-FULL",
    shot: "SCENE-FULL",
    headline: "tested Gemini and Claude",
    scene_description: "a split benchmark sheet with two AI logos",
    named_entities: [{ type: "company", name: "Anthropic" }],
    concepts: [],
    entity_anchor_word: "tested",
    camera_focus: [{ at_percent: 0.5, target: "photo" }],
    hero_cutout: { asset: "logos/anthropic.png" },
    concept_visuals: [{ asset: "logos/anthropic.png" }],
    art: { kind: "plate-organization", name: "Anthropic" },
    name_card: { name: "Anthropic" },
    data: { entity: "Anthropic", entity_type: "company" },
    ground: "photo",
    visual_events: [{ type: "evidence", label: "benchmark testing" }],
  });

  it("keeps the headline on a MISMATCH and strips every picture field", () => {
    const b = photoBeat();
    forceTypeCard(b, "Charlie Hills tested Gemini and Claude on four prompts.", true);
    assert.equal(b.visual_type, "TYPE");
    assert.equal(b.canvas_composition, "TYPE-FULL");
    assert.equal(b.headline, "tested Gemini and Claude");
    assert.equal(b.data, null);
    assert.equal(b.art, null);
    assert.equal(b.name_card, null);
    assert.equal(b.hero_cutout, null);
    assert.equal(b.concept_visuals.length, 0);
    assert.equal(b.named_entities.length, 0);
    assert.equal(b.ground, "white");
  });

  it("uses the sentence as the card when the headline is the problem", () => {
    const b = photoBeat();
    const sentence = "Charlie Hills tested Gemini and Claude on four prompts.";
    forceTypeCard(b, sentence, false);
    assert.equal(b.headline, sentence);
  });
});
