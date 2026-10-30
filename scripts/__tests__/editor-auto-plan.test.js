// The automatic editor plan: one scene per spoken sentence, timed by the voiceover; a verified photo when a named entity has one,
// otherwise a figure card (only numbers the research states) or a key-word poster. Nothing invented, nothing left uncovered.
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
  assert.match(report.scenes[0].shows, /figure alone 45%/);
  assert.match(report.scenes[1].shows, /figure alone 1,321/);
  assert.match(report.scenes[2].shows, /verified photo of Sir Jane Doeson/, "the honorific-free lookup found the photo");
  assert.equal(plan.assets["photo-sir-jane-doeson"].credit, "Photo: X / Wikimedia Commons, CC0");
  assert.match(report.scenes[3].shows, /key-word poster/, "the unsourced 99% is not featured");
  assert.ok(!cards.some((c) => c.svg.includes("99%") && c.svg.includes("font-size=\"260\"")), "99% is not drawn as a figure");
  for (const s of plan.scenes) assert.ok(s.asset && (plan.assets[s.asset] || cards.some((c) => c.id === s.asset)), `scene ${s.id} has an asset`);
});

test("the same photo is never shown in two scenes running", async () => {
  const two = { ...script, sections: [{ id: "a", voiceover: "Doeson spoke first. Doeson spoke again." }] };
  const w = [0, 1].flatMap((s) => [{ text: "a", start: s * 4, end: s * 4 + 1, sentence: s }]);
  const resolve = async () => ({ ok: true, file: "p.jpg", width: 800, height: 1000, credit: "c", source_url: "u", license: "l" });
  const { report } = await buildAutoPlan({ ...base, script: two, words: w, audioDuration: 8, resolve });
  assert.match(report.scenes[0].shows, /photo/);
  assert.match(report.scenes[1].shows, /key-word poster/);
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

// ---- concept photos and the five looks --------------------------------------------------------------------------------------------
import { parseQueries, conceptPrompt, searchCommons } from "../editor/concept-photo.mjs";
import { styleFor, STYLE_NAMES, functionOf, keyPhrase } from "../editor/styles.mjs";
import { addOverlays } from "../editor/auto-timeline.mjs";

test("the model's phrases are parsed from JSON or from text, null when absent", () => {
  assert.deepEqual(parseQueries({ "0": "airline cockpit", "1": null, "2": "None" }, 4), ["airline cockpit", null, null, null]);
  assert.deepEqual(parseQueries({ content: 'Sure! {"queries":{"1":"tide mill"}}' }, 2), [null, "tide mill"]);
  assert.deepEqual(parseQueries(null, 2), [null, null]);
  assert.match(conceptPrompt({ sentences: ["a", "b"], topic: "t", niche: "n" }), /0\. a\n1\. b/);
});

test("Commons results are filtered to free JPEG photographs that are not logos, maps or charts", async () => {
  const page = (index, title, mime, license, w = 3000, h = 2000) => ({ index, title: `File:${title}`, imageinfo: [{ mime, width: w, height: h, thumburl: "t", url: "u", descriptionurl: "d", extmetadata: { LicenseShortName: { value: license }, Artist: { value: "<b>A</b>" } } }] });
  const fake = async () => ({ query: { pages: {
    a: page(1, "Company logo.jpg", "image/jpeg", "CC0"), b: page(2, "Cockpit.png", "image/png", "CC0"), c: page(3, "Cockpit nonfree.jpg", "image/jpeg", "Non-free"),
    d: page(4, "Tiny.jpg", "image/jpeg", "CC0", 400, 300), e: page(5, "Airliner cockpit.jpg", "image/jpeg", "CC BY-SA 4.0"),
  } } });
  const r = await searchCommons("cockpit", 3, fake);
  assert.deepEqual(r.map((x) => x.title), ["Airliner cockpit.jpg"]);
  assert.equal(r[0].credit, "Photo: A / Wikimedia Commons, CC BY-SA 4.0");
});

test("a sentence with no entity gets a concept photo, with its figure drawn over it; a miss falls back to a poster", async () => {
  const concept = async ({ query }) => (query === "cockpit" ? { file: "c.jpg", width: 2000, height: 1300, credit: "Photo: Z / Wikimedia Commons, CC0", source_url: "u", license: "CC0" } : null);
  const { plan, cards, report } = await buildAutoPlan({ ...base, resolve: async () => ({ ok: false }), concept, queries: ["cockpit", null, "nothing", "cockpit"] });
  assert.match(report.scenes[0].shows, /concept photo "cockpit" \+ figure 45%/);
  assert.equal(plan.scenes[0].overlay, "overlay-0");
  assert.ok(cards.some((c) => c.id === "overlay-0" && c.svg.includes("45%")));
  assert.equal(plan.assets["concept-0"].credit, "Photo: Z / Wikimedia Commons, CC0");
  assert.match(report.scenes[2].shows, /key-word poster/);
});

test("each of the five looks draws a figure overlay with no gradient fill and no sentence text", () => {
  const pal = { bg: "#000011", accent: "#00ff99" };
  for (const n of [1, 2, 3, 4, 5]) {
    const st = styleFor(n, pal);
    assert.equal(st.name, STYLE_NAMES[n]);
    for (const fn of ["hook", "evidence", "payoff"]) {
      const svg = st.figure({ figs: [{ raw: "45%", kind: "percent", value: 45 }], source: "jll.com", fn });
      assert.match(svg, /45%/);
      assert.ok(!/linearGradient|radialGradient/.test(svg), `look ${n} ${fn}: flat colour only`);
    }
    assert.match(st.poster({ phrase: ["ONE", "TWO"] }), /ONE/);
  }
  assert.deepEqual([0, 1, 2, 4].map((i) => functionOf(i, 5)), ["hook", "setup", "evidence", "payoff"]);
  assert.deepEqual(keyPhrase("The pilots flew fatigued across Europe"), ["PILOTS", "FATIGUED", "EUROPE"]);
});

test("overlays become image layers above the scrim and below the text, entering after the scene's own fade", () => {
  const tl = { layers: [{ id: "scene-0-image", in: 0, out: 100, z: 11 }, { id: "scene-0-gradient", z: 100, in: 0, out: 100 }, { id: "t", z: 210, in: 0, out: 100 }] };
  addOverlays(tl, { scenes: [{ overlay: "overlay-0", stagger: 9 }] });
  const o = tl.layers.find((l) => l.id === "scene-0-overlay");
  assert.deepEqual([o.in, o.out, o.z, o.asset_id], [9, 100, 150, "overlay-0"]);
  assert.deepEqual(tl.layers.map((l) => l.z), [11, 100, 150, 210]);
  assert.ok(o.keyframes.scale.length >= 2 && o.keyframes.scale[1].v > o.keyframes.scale[0].v, "an overlay moves, as every image layer must");
});

// ---- the vision check on concept photos --------------------------------------------------------------------------------------------
import { parseVerdict, verifyConceptPhoto, visionPrompt } from "../editor/concept-photo.mjs";

test("a concept photo passes only if it shows the subject, no identifiable person, and is not mostly text", () => {
  const ok = { shows_subject: true, identifiable_person: false, mostly_text_or_logo: false, what_it_shows: "airline cockpit" };
  assert.equal(parseVerdict(ok).ok, true);
  assert.equal(parseVerdict({ ...ok, shows_subject: false }).ok, false);
  assert.match(parseVerdict({ ...ok, identifiable_person: true }).why, /identifiable person/);
  assert.match(parseVerdict({ ...ok, mostly_text_or_logo: true }).why, /text/);
  assert.equal(parseVerdict({ content: "Sure: " + JSON.stringify(ok) }).ok, true);
  assert.equal(parseVerdict({ shows_subject: true }).ok, false, "a missing field is not a pass");
  assert.equal(parseVerdict(null).ok, false);
  assert.match(visionPrompt({ sentence: "S", query: "Q" }), /"S"[\s\S]*"Q"/);
});

test("the vision check fails closed when the model errors or answers nonsense", async () => {
  const jpeg = Buffer.from([0xff, 0xd8, 1, 2]);
  assert.equal((await verifyConceptPhoto({ sentence: "s", query: "q", jpeg, askVision: async () => { throw new Error("quota"); } })).ok, false);
  assert.equal((await verifyConceptPhoto({ sentence: "s", query: "q", jpeg, askVision: async () => ({ content: "no idea" }) })).ok, false);
  assert.equal((await verifyConceptPhoto({ sentence: "s", query: "q", jpeg, askVision: async () => ({ shows_subject: true, identifiable_person: false, mostly_text_or_logo: false }) })).ok, true);
});

// ---- per-video variety ------------------------------------------------------------------------------------------------------------
import { seededRandom, pickLook, shiftSvg } from "../editor/auto-plan.mjs";

const photoOk = async () => ({ ok: true, file: "p.jpg", width: 1000, height: 1400, credit: "c", source_url: "u", license: "l" });
const longScript = { sources_used: ["https://example.com/a"], sections: [{ id: "a", voiceover: "Doeson spoke at length about the plan. Then Doeson left the building. 45% agreed afterwards." }] };
const longWords = [{ text: "a", start: 0, end: 1, sentence: 0 }, { text: "b", start: 12, end: 13, sentence: 1 }, { text: "c", start: 18, end: 19, sentence: 2 }];
const planFor = (stem, extra = {}) => buildAutoPlan({ ...base, stem, script: longScript, words: longWords, audioDuration: 24, style: 0, resolve: photoOk, ...extra });

test("the random stream is seeded by the slug: same slug same plan, different slug different plan", async () => {
  const a = seededRandom("x"), b = seededRandom("x"), c = seededRandom("y");
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.notDeepEqual([seededRandom("x")(), seededRandom("x")()], [c(), c()]);
  const one = await planFor("video-one-shorts-script"), again = await planFor("video-one-shorts-script");
  assert.deepEqual(one.plan.scenes, again.plan.scenes, "a re-render is identical");
  const looks = new Set();
  const moves = new Set();
  for (let i = 0; i < 30; i++) { const r = await planFor(`video-${i}-shorts-script`); looks.add(r.report.look); moves.add(r.plan.scenes.map((s) => s.motion).join(",")); }
  assert.ok(looks.size >= 4, `looks used across 30 videos: ${[...looks]}`);
  assert.ok(moves.size >= 10, `distinct camera sequences across 30 videos: ${moves.size}`);
});

test("the home look comes up about half the time, and a forced look is honoured", () => {
  let home = 0;
  for (let i = 0; i < 400; i++) if (pickLook(seededRandom("s" + i), 3) === 3) home++;
  assert.ok(home > 160 && home < 260, `home look share ${home}/400`);
});

test("a long photo shot is re-framed halfway and never moves the same way twice running", async () => {
  const { plan } = await planFor("split-test-shorts-script");
  const s = plan.scenes;
  assert.ok(s.some((x) => x.id.endsWith("b")), "a scene was split");
  const first = s.find((x) => x.id.endsWith("b"));
  const orig = s.find((x) => x.id === first.id.slice(0, -1));
  assert.equal(orig.end, first.start);
  assert.equal(orig.asset, first.asset);
  assert.notEqual(orig.motion, first.motion);
  for (let i = 1; i < s.length; i++) assert.notEqual(s[i].motion, s[i - 1].motion, `scene ${i}`);
  for (let i = 1; i < s.length; i++) assert.equal(s[i].start, s[i - 1].end, "no gap or overlap");
  assert.equal(s.at(-1).end, 24);
});

test("a shifted overlay stays a valid SVG", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">\n<text>45%</text>\n</svg>\n';
  const moved = shiftSvg(svg, 60);
  assert.match(moved, /<g transform="translate\(0,60\)">[\s\S]*<\/g>\n<\/svg>/);
  assert.equal(shiftSvg(svg, 0), svg);
});

test("zoom and fade reach the timeline's image layer", () => {
  const plan = { fps: 30, palette: {}, fonts: {}, assets: { a: { file: "a.jpg", width: 1000, height: 1000 } },
    scenes: [{ id: "s", start: 0, end: 4, asset: "a", fit: "cover", motion: "in", zoom: 0.06, fade: 8 }] };
  const img = buildTimeline(plan, { audioDuration: 4, captions: [] }).layers.find((l) => l.type === "image");
  assert.ok(Math.abs(img.keyframes.scale.at(-1).v - 1.16) < 1e-9);
  assert.deepEqual(img.keyframes.opacity.slice(0, 2).map((k) => k.v), [0, 1]);
});
