// The automatic editor plan: one scene per spoken sentence, timed by the voiceover; a verified photo when a named entity has one,
// otherwise a figure card (only numbers the research states) or a statement card. Nothing invented, nothing left uncovered.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAutoPlan, extractFigures, researchStates, nameVariants, sentenceSpans, entitiesIn, entityIndex } from "../editor/auto-plan.mjs";
import { figureCard, statementCard, wrapText } from "../editor/cards.mjs";
import { transcriptFromWords } from "../editor/auto-timeline.mjs";
import { buildCaptions } from "../editor/captions.mjs";
import { buildTimeline } from "../editor/timeline.mjs";

const script = { sources_used: ["https://example.com/a"], sections: [
  { id: "hook", voiceover: "45% of organizations are scaling AI. JLL surveyed 1,321 organizations in 2026." },
  { id: "close", voiceover: "Sir Jane Doeson spoke about it. Nothing numeric here, and a made up 99% claim." },
] };
const research = {
  strongest_angle: "AI in facilities",
  named_entities: [{ name: "Sir Jane Doeson", kind: "person" }, { name: "Obscure Org", kind: "organization" }],
  numbers: [{ label: "x", value: 45, unit: "percent", source_url: "https://news.example.org/x" }, { label: "y", value: 1321, unit: "organizations", source_url: "https://fortune.com/y" }],
  key_facts: [{ fact: "45% scaling AI; 1,321 organizations surveyed in 2026", source_url: "https://news.example.org/x" }],
};
const words = [0, 1, 2, 3].flatMap((s) => [0, 1].map((k) => ({ text: `w${s}${k}`, start: 1 + s * 5 + k, end: 1.9 + s * 5 + k, sentence: s })));
const channel = { colors: { bg: "#000011", secondary: "#112233", accent: "#00ff99", canvas_accent: "#00ff99" }, font: "Inter" };
const base = { script, research, words, audioDuration: 22, channel, stem: "t-shorts-script", audioPath: "a.mp3", transcriptPath: "t.json", scriptPath: "s.json" };

test("figures: percentages, money and counts are found; only ones the research states survive", () => {
  const f = extractFigures("45% rose to $2.5 million while 1,321 firms and 99% said 3 percent");
  assert.deepEqual(f.map((x) => x.raw), ["45%", "$2.5 million", "1,321", "99%", "3%"]);
  assert.equal(researchStates(research, { raw: "45%" }), true);
  assert.equal(researchStates(research, { raw: "1,321" }), true);
  assert.equal(researchStates(research, { raw: "99%" }), false, "a figure the sources do not state is never drawn");
});

test("entities: a person is found by surname, honorifics are dropped for the photo lookup", () => {
  const idx = entityIndex(research);
  assert.equal(entitiesIn("Doeson spoke today", idx).length, 1);
  assert.equal(entitiesIn("Nothing here", idx).length, 0);
  assert.deepEqual(nameVariants("Sir Jane Doeson"), ["Sir Jane Doeson", "Jane Doeson"]);
  assert.deepEqual(nameVariants("Jane Doeson"), ["Jane Doeson"]);
});

test("every sentence gets a scene, the scenes tile the audio with no gap, and a figure the research lacks is not drawn", async () => {
  const resolve = async ({ name }) => (/Jane Doeson/.test(name) && !/^Sir/.test(name) ? { ok: true, file: "p.jpg", width: 800, height: 1000, credit: "Photo: X / Wikimedia Commons, CC0", source_url: "u", license: "CC0" } : { ok: false, why: "none" });
  const { plan, cards, report } = await buildAutoPlan({ ...base, resolve });
  assert.equal(plan.scenes.length, 4);
  assert.equal(plan.scenes[0].start, 0);
  for (let i = 1; i < 4; i++) assert.equal(plan.scenes[i].start, plan.scenes[i - 1].end);
  assert.equal(plan.scenes.at(-1).end, 22);
  assert.equal(report.spans, "voiceover");
  assert.match(report.scenes[0].shows, /figure card 45%/);
  assert.match(report.scenes[1].shows, /figure card 1,321/);
  assert.match(report.scenes[2].shows, /photo of Sir Jane Doeson/, "the honorific-free lookup found the photo");
  assert.equal(plan.assets["photo-sir-jane-doeson"].credit, "Photo: X / Wikimedia Commons, CC0");
  assert.match(report.scenes[3].shows, /statement card/, "the unsourced 99% is not featured");
  assert.ok(!cards.some((c) => c.svg.includes("99%") && c.svg.includes("font-size=\"260\"")), "99% is not drawn as a figure");
  for (const s of plan.scenes) assert.ok(s.asset && (plan.assets[s.asset] || cards.some((c) => c.id === s.asset)), `scene ${s.id} has an asset`);
});

test("the same photo is never shown in two scenes running", async () => {
  const two = { ...script, sections: [{ id: "a", voiceover: "Doeson spoke first. Doeson spoke again." }] };
  const w = [0, 1].flatMap((s) => [{ text: "a", start: s * 4, end: s * 4 + 1, sentence: s }]);
  const resolve = async () => ({ ok: true, file: "p.jpg", width: 800, height: 1000, credit: "c", source_url: "u", license: "l" });
  const { report } = await buildAutoPlan({ ...base, script: two, words: w, audioDuration: 8, resolve });
  assert.match(report.scenes[0].shows, /photo/);
  assert.match(report.scenes[1].shows, /statement card/);
});

test("no voiceover sentence list for the script -> proportional timing, still covering the audio", async () => {
  const { plan, report } = await buildAutoPlan({ ...base, words: [], resolve: async () => ({ ok: false }) });
  assert.equal(report.spans, "proportional");
  assert.equal(plan.scenes.at(-1).end, 22);
});

test("a script with no sentences is an error, not an empty video", async () => {
  await assert.rejects(buildAutoPlan({ ...base, script: { sections: [] }, resolve: async () => ({ ok: false }) }), /no spoken sentences/);
  await assert.rejects(buildAutoPlan({ ...base, audioDuration: 0, resolve: async () => ({ ok: false }) }), /no audio duration/);
});

test("sentenceSpans refuses a word list whose sentence count disagrees", () => {
  assert.equal(sentenceSpans(words, 3, 22), null);
  assert.equal(sentenceSpans(words, 4, 22).length, 4);
});

test("cards escape markup and a percentage bar is exactly that share of the track", () => {
  const p = { bg: "#000", accent: "#0f0", secondary: "#111" };
  const svg = figureCard({ palette: p, label: "L", sentence: "A <b>&\"x\" 45% claim", figures: [{ raw: "45%", kind: "percent", value: 45 }], source: "a.com" });
  assert.match(svg, /width="405\.0"/);
  assert.ok(!svg.includes("<b>"));
  assert.match(statementCard({ palette: p, label: "L", sentence: "one two", source: "" }), /<svg/);
  assert.deepEqual(wrapText("aa bb cc", 5), ["aa bb", "cc"]);
});

test("the plan builds a valid editor timeline with captions from the voiceover", async () => {
  const { plan, cards } = await buildAutoPlan({ ...base, resolve: async () => ({ ok: false }) });
  for (const c of cards) plan.assets[c.id] = { file: `${c.id}.svg`, width: 1080, height: 1920 };
  const transcript = transcriptFromWords({ words });
  assert.equal(transcript.segments.length, 4);
  const captions = buildCaptions({ script, whisper: transcript, duration: 22 });
  const tl = buildTimeline(plan, { audioDuration: 22, captions });
  assert.equal(tl.durationInFrames, 660);
  assert.equal(tl.captions.length, 4);
  assert.equal(tl.metadata.image_scene_count, 4);
  assert.ok(tl.layers.every((l) => l.out <= tl.durationInFrames));
});
