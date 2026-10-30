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
import { addGraphics } from "../editor/auto-timeline.mjs";

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
  assert.equal(plan.scenes[0].graphic.figs[0].raw, "45%", "the figure is drawn as an animated graphic over the photo");
  assert.ok(["bar", "ring"].includes(plan.scenes[0].graphic.kind));
  assert.equal(plan.assets["concept-0"].credit, "Photo: Z / Wikimedia Commons, CC0");
  assert.match(report.scenes[2].shows, /concept-0 again, re-framed/, "a miss re-uses the story's own photo, framed differently");
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
  assert.deepEqual(keyPhrase("The pilots flew fatigued across Europe"), ["PILOTS FLEW", "FATIGUED"]);
  assert.deepEqual(keyPhrase("A vintage 1950s wedding photo album dumped in an alleyway"), ["VINTAGE 1950S", "WEDDING PHOTO"], "a run with a year beats a plain one, and stays contiguous");
  assert.deepEqual(keyPhrase("It was in a"), []);
});

test("graphics become real layers above the scrim and below the text, entering after the scene's own fade", () => {
  const tl = { layers: [{ id: "scene-0-image", in: 0, out: 100, z: 11 }, { id: "scene-0-gradient", z: 100, in: 0, out: 100 }, { id: "t", z: 210, in: 0, out: 100 }] };
  const plan = { id: "p", palette: { accent: "#0f0", bg: "#000", text: "#fff" }, scenes: [{ stagger: 9, graphic: { id: "g0", kind: "bar", figs: [{ raw: "45%", kind: "percent", value: 45 }], source: "x.com", fn: "evidence", dy: 0, look: "anti-slop" } }] };
  addGraphics(tl, plan);
  const g = tl.layers.filter((l) => l.id.startsWith("scene-0-g-"));
  assert.ok(g.length >= 3, "a bar, its track and a counting number at least");
  assert.ok(g.every((l) => l.in >= 9 && l.out === 100 && l.z >= 150 && l.z < 200), "above the scrim, below the text, after the stagger");
  assert.deepEqual(tl.layers.map((l) => l.z), [...tl.layers.map((l) => l.z)].sort((x, y) => x - y), "layers stay sorted by z");
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

test("a video with no photo at all falls back to the key-word poster, never to an empty scene", async () => {
  const { report } = await buildAutoPlan({ ...base, resolve: async () => ({ ok: false }), concept: async () => null, queries: [null, null, null, null] });
  assert.ok(report.scenes.some((x) => /key-word poster/.test(x.shows)));
});

// ---- figures fit their width ("252 million" was clipped at 260px in a real render) ----------------------------------------------------
import { fitSize } from "../editor/styles.mjs";

test("a figure is sized to fit: long figures shrink, short ones keep their size", () => {
  assert.equal(fitSize("45%", 250), 250);
  assert.ok(fitSize("252 million", 250) * "252 million".length * 0.62 <= 900, "the longest figure fits 900px");
  assert.ok(fitSize("$300 billion", 340) < 340);
  for (const n of [1, 2, 3, 4, 5]) {
    const svg = styleFor(n, { bg: "#000", accent: "#0f0" }).figure({ figs: [{ raw: "252 million", kind: "number", value: null }], source: "x.com", fn: "hook" });
    for (const m of svg.matchAll(/font-size="(\d+)"[^>]*>252 million</g)) assert.ok(Number(m[1]) * 11 * 0.6 <= 960, `look ${n}: size ${m[1]} fits`);
  }
});

test("poster lines shrink to fit the frame in every look", () => {
  for (const n of [1, 2, 3, 4, 5]) {
    const svg = styleFor(n, { bg: "#000", accent: "#0f0" }).poster({ phrase: ["COUNT DRACULA", "POSSESSES"] });
    for (const m of svg.matchAll(/font-size="(d+)"[^>]*>COUNT DRACULA</g)) assert.ok(Number(m[1]) * 13 * 0.74 <= 900, `look ${n}: size ${m[1]} fits`);
  }
});

test("plain numbers count as figures, but years, dates, ordinals and small numbers do not", () => {
  const raws = (t) => extractFigures(t).map((f) => f.raw);
  assert.deepEqual(raws("In October 2026, 453 product recalls were announced on October 29."), ["453"]);
  assert.deepEqual(raws("Moderate severity issues represent 181 of the total, and 3 of them were 4th-ranked."), ["181"]);
  assert.deepEqual(raws("It rose 12.5 percent to 3,471 recalls in 2025."), ["12.5%", "3,471"]);
  assert.deepEqual(raws("The 5th site opened in March 2024 with 90 staff."), ["90"]);
});

// ---- animated graphics (graphics.mjs) ---------------------------------------------------------------------------------------------
import { graphicLayers, parseFigure, chooseKind, backdropSvg, decorationLayers } from "../editor/graphics.mjs";
import { valueAt, formatCount } from "../../src/skills/remotion-render/editor/layer-math.js";

const PAL = { accent: "#1ABC9C", bg: "#07070D", text: "#fff" };
const g = (look, kind, figs, extra = {}) => graphicLayers({ id: "g", kind, figs, source: "jll.com", fn: "evidence", look, palette: PAL, inF: 0, outF: 90, ...extra });
const PCT = { raw: "45%", kind: "percent", value: 45 };
const NUM = { raw: "$2.5 million", kind: "number", value: null };

test("a figure is parsed into what to count to and how to write it", () => {
  assert.deepEqual(parseFigure(PCT), { from: 0, to: 45, decimals: 0, prefix: "", suffix: "%", group: false, percent: 45 });
  const m = parseFigure(NUM);
  assert.deepEqual([m.prefix, m.to, m.decimals, m.suffix], ["$", 2.5, 1, " million"]);
  const c = parseFigure({ raw: "3,471", kind: "number" });
  assert.deepEqual([c.to, c.group], [3471, true]);
  assert.equal(formatCount(c, 1), "3,471");
  assert.equal(formatCount(m, 1), "$2.5 million");
  assert.equal(formatCount(parseFigure(PCT), 0.5), "23%", "half way through the count it shows half the number");
});

test("a percentage bar grows to exactly its share, and the number counts up to the stated figure", () => {
  for (const look of ["anti-slop", "hallmark", "vox", "scene-director", "mograph-critic"]) {
    const ls = g(look, "bar", [PCT]);
    const fill = ls.find((l) => /-b-fill$/.test(l.id));
    assert.ok(fill, `${look}: a growing bar`);
    assert.equal(valueAt(fill, "clipR", 0), 100, `${look}: starts empty`);
    assert.equal(valueAt(fill, "clipR", 80), 55, `${look}: ends at 45% of the track (clipR 55)`);
    const n = ls.find((l) => l.count);
    assert.ok(n, `${look}: a counting number`);
    assert.equal(formatCount(n.count, valueAt(n, "count", 0)), "0%");
    assert.equal(formatCount(n.count, valueAt(n, "count", 80)), "45%");
  }
});

test("a ring draws on to exactly its share; two percentages get two bars; a plain number counts", () => {
  const ring = g("vox", "ring", [PCT]).find((l) => l.type === "svg" && /ring$/.test(l.id));
  assert.ok(ring);
  assert.equal(valueAt(ring, "draw", 0), 0);
  assert.ok(Math.abs(valueAt(ring, "draw", 80) - 0.45) < 1e-9);
  const two = g("anti-slop", "bars2", [PCT, { raw: "71%", kind: "percent", value: 71 }]);
  assert.equal(two.filter((l) => /-fill$/.test(l.id)).length, 2);
  assert.equal(valueAt(two.find((l) => /b1-fill$/.test(l.id)), "clipR", 80), 29);
  const count = g("mograph-critic", "count", [{ raw: "453", kind: "number" }]).find((l) => l.count);
  assert.equal(formatCount(count.count, valueAt(count, "count", 80)), "453");
});

test("every look and kind yields layers that stay inside the frame, are on screen only while the scene is, and carry only sourced text", () => {
  const cases = [["bar", [PCT]], ["ring", [PCT]], ["bars2", [PCT, { raw: "71%", kind: "percent", value: 71 }]], ["count", [NUM]]];
  for (const look of ["anti-slop", "hallmark", "vox", "scene-director", "mograph-critic"]) {
    for (const fn of ["hook", "evidence", "payoff"]) {
      for (const [kind, figs] of cases) {
        const ls = g(look, kind, figs, { fn, dy: 60 });
        assert.ok(ls.length >= 2, `${look}/${fn}/${kind}`);
        const ids = new Set(ls.map((l) => l.id));
        assert.equal(ids.size, ls.length, "layer ids are unique");
        for (const l of ls) {
          assert.ok(l.in >= 0 && l.out <= 90 && l.out > l.in, `${look}/${kind}: ${l.id} timing`);
          assert.ok(l.rect.x >= -1 && l.rect.x + l.rect.w <= 1081, `${look}/${kind}: ${l.id} inside the width`);
          assert.ok(l.rect.y + l.rect.h > 0 && l.rect.y < 1920, `${look}/${kind}: ${l.id} on the canvas`);
          if (l.type === "text" && l.text) assert.match(l.text, /^Source: jll\.com$/, "the only free text is the source");
        }
      }
    }
  }
});

test("the kind follows the figures, and a backdrop has no gradient", () => {
  const rng = () => 0.1;
  assert.equal(chooseKind([PCT], rng, "vox"), "ring");
  assert.equal(chooseKind([PCT], rng, "hallmark"), "bar");
  assert.equal(chooseKind([PCT, { raw: "9%", kind: "percent", value: 9 }], rng, "vox"), "bars2");
  assert.equal(chooseKind([NUM], rng, "vox"), "count");
  assert.ok(!/Gradient/.test(backdropSvg(PAL)));
});

test("a figure-only scene keeps an image layer with motion (the backdrop) under its graphic, so the final QA still passes", async () => {
  const { plan, cards } = await buildAutoPlan({ ...base, resolve: async () => ({ ok: false }), concept: async () => null, queries: [null, null, null, null], style: 3 });
  const first = plan.scenes[0];
  assert.match(first.asset, /^card-/);
  assert.ok(cards.some((c) => c.id === first.asset && /<rect width="1080" height="1920"/.test(c.svg)));
  assert.ok(first.graphic && first.graphic.figs[0].raw === "45%");
});

test("a full timeline with every look's graphics validates against schemas/editor-timeline.json", async (t) => {
  const Ajv = await import("ajv").then((m) => m.default, () => null);
  if (!Ajv) return t.skip("ajv is not installed on this machine (CI has it)");
  const { readFileSync } = await import("node:fs");
  const schema = JSON.parse(readFileSync(new URL("../../schemas/editor-timeline.json", import.meta.url), "utf8"));
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  for (const style of [1, 2, 3, 4, 5]) {
    const { plan, cards } = await buildAutoPlan({ ...base, resolve: photoOk, concept: async () => null, queries: [null, null, null, null], style, stem: `schema-${style}-shorts-script` });
    for (const c of cards) plan.assets[c.id] = { file: `${c.id}.svg`, width: 1080, height: 1920 };
    for (const a of Object.values(plan.assets)) { a.credit ??= "c"; a.source_url ??= "u"; }
    const transcript = transcriptFromWords({ words });
    const tl = addGraphics(buildTimeline(plan, { audioDuration: 22, captions: buildCaptions({ script, whisper: transcript, duration: 22 }) }), plan);
    assert.ok(tl.layers.some((l) => l.count), `look ${style}: a counting number is in the timeline`);
    assert.ok(validate(tl), `look ${style}: ${JSON.stringify((validate.errors || []).slice(0, 3))}`);
  }
});

test("a photo scene with no figure still moves: the accent draws itself across it", () => {
  const PAL2 = { accent: "#1ABC9C", bg: "#07070D", text: "#fff" };
  for (const look of ["anti-slop", "hallmark", "vox", "scene-director", "mograph-critic"]) {
    const ls = decorationLayers({ id: "d", look, palette: PAL2, inF: 10, outF: 100 });
    assert.ok(ls.length >= 1 && ls.every((l) => l.in === 10 && l.out === 100), look);
    const anim = ls.find((l) => l.keyframes.draw || l.keyframes.clipR);
    assert.ok(anim, `${look}: something draws or wipes in`);
    if (anim.keyframes.draw) { assert.equal(valueAt(anim, "draw", 0), 0); assert.equal(valueAt(anim, "draw", 40), 1); }
    else { assert.equal(valueAt(anim, "clipR", 0), 100); assert.equal(valueAt(anim, "clipR", 40), 0); }
  }
  const tl = { layers: [{ id: "scene-0-image", in: 0, out: 100, z: 11 }] };
  addGraphics(tl, { id: "p", palette: PAL2, scenes: [{ asset: "photo-x", look: "vox", stagger: 0 }] });
  assert.ok(tl.layers.some((l) => l.id.startsWith("scene-0-d-")), "a photo scene without a graphic gets the decoration");
  const tl2 = { layers: [{ id: "scene-0-image", in: 0, out: 100, z: 11 }] };
  addGraphics(tl2, { id: "p", palette: PAL2, scenes: [{ asset: "other-x", look: "vox", stagger: 0 }] });
  const tl3 = { layers: [{ id: "scene-0-image", in: 0, out: 100, z: 11 }] };
  addGraphics(tl3, { id: "p", palette: PAL2, scenes: [{ asset: "card-1", look: "vox", stagger: 0 }] });
  assert.ok(tl3.layers.some((l) => /-sweep$/.test(l.id)), "a poster scene gets the sweeping line so it never sits still");
  assert.equal(tl2.layers.length, 1, "a card is not a photo scene, so it gets no decoration");
});

import { luminance, onFill } from "../editor/graphics.mjs";
import { extractYear } from "../editor/auto-plan.mjs";

test("text on an accent fill follows the fill: dark on light, white on dark (a dark-blue accent made dark text unreadable)", () => {
  assert.equal(onFill("#1ABC9C"), "#101114");
  assert.equal(onFill("#D4A574"), "#101114");
  assert.equal(onFill("#1F3A8A"), "#FFFFFF");
  assert.equal(onFill("#8B1E1E"), "#FFFFFF");
  assert.ok(luminance("#FFFFFF") > 0.99 && luminance("#000000") < 0.01);
});

test("a year the research states becomes an animated timeline: the line wipes in, ticks pop, the year counts up to it", async () => {
  assert.equal(extractYear("The 2000 wedding ended it.").value, 2000);
  assert.equal(extractYear("It cost 1,500 dollars and 45 people."), null);
  assert.equal(extractYear("No year here."), null);
  const ls = graphicLayers({ id: "g", kind: "year", figs: [{ raw: "2000", kind: "year", value: 2000 }], source: "bbc.com", fn: "evidence", look: "vox", palette: PAL, inF: 0, outF: 90 });
  const n = ls.find((l) => l.count);
  assert.equal(formatCount(n.count, valueAt(n, "count", 0)), "1986");
  assert.equal(formatCount(n.count, valueAt(n, "count", 80)), "2000");
  assert.ok(ls.some((l) => /-line$/.test(l.id) && valueAt(l, "clipR", 0) === 100 && valueAt(l, "clipR", 60) === 0));
  assert.equal(ls.filter((l) => /-tick\d$/.test(l.id)).length, 3);
  const r = await buildAutoPlan({ ...base, script: { sources_used: ["https://example.com/a"], sections: [{ id: "a", voiceover: "A 2000 wedding ended it. Nothing else happened." }] }, research: { ...research, key_facts: [{ fact: "The 2000 wedding", source_url: "https://news.example.org/x" }] }, words: [{ text: "a", start: 0, end: 1, sentence: 0 }, { text: "b", start: 6, end: 7, sentence: 1 }], audioDuration: 12, resolve: async () => ({ ok: false }), concept: async () => null, queries: [null, null], style: 1 });
  assert.equal(r.plan.scenes[0].graphic.kind, "year");
  assert.equal(r.plan.scenes[1].graphic, undefined, "a sentence with no figure and no year gets no graphic");
});

test("the same year gets one timeline per video, and no more than three timelines", async () => {
  const sentences = ["A 2000 wedding ended it.", "The 2000 wedding was big.", "In 1998 they met.", "In 1999 they wed.", "In 2001 they split.", "In 2002 they fought."];
  const r = await buildAutoPlan({ ...base, script: { sources_used: ["https://example.com/a"], sections: [{ id: "a", voiceover: sentences.join(" ") }] },
    research: { ...research, key_facts: [{ fact: "2000 1998 1999 2001 2002", source_url: "https://news.example.org/x" }] },
    words: sentences.map((_, i) => ({ text: "w", start: i * 4, end: i * 4 + 1, sentence: i })), audioDuration: 26, resolve: async () => ({ ok: false }), concept: async () => null, queries: sentences.map(() => null), style: 1 });
  const years = r.plan.scenes.filter((s) => s.graphic && s.graphic.kind === "year").map((s) => s.graphic.figs[0].value);
  assert.deepEqual(years, [2000, 1998, 1999], "first three distinct years only; the repeat of 2000 gets none");
});

test("graphics never sit still: every layer drifts to the end of the scene, and a figure-only scene also gets a sweeping line", async () => {
  for (const look of ["anti-slop", "hallmark", "vox", "scene-director", "mograph-critic"]) {
    for (const [kind, figs] of [["bar", [PCT]], ["count", [NUM]], ["year", [{ raw: "2000", kind: "year", value: 2000 }]]]) {
      const ls = g(look, kind, figs, { backdrop: true });
      const moving = ls.filter((l) => !/-(flat|sweep)$/.test(l.id));
      for (const l of moving) assert.ok(valueAt(l, "ty", l.out - l.in) <= -20, `${look}/${kind}: ${l.id} is still rising at the end`);
      const sweep = ls.find((l) => /-sweep$/.test(l.id));
      assert.ok(sweep, `${look}/${kind}: sweep`);
      assert.ok(valueAt(sweep, "ty", 40) > valueAt(sweep, "ty", 10), "the sweep moves down the frame");
      assert.ok(valueAt(sweep, "ty", 84) < valueAt(sweep, "ty", 83), "and starts again every cycle");
      assert.equal(ls.some((l) => /-flat$/.test(l.id) && valueAt(l, "ty", 80) !== 0), false, "a full-bleed layer never drifts");
    }
  }
  const { plan } = await buildAutoPlan({ ...base, resolve: async () => ({ ok: false }), concept: async () => null, queries: [null, null, null, null], style: 2 });
  const s0 = plan.scenes[0];
  assert.equal(s0.graphic.backdrop, true);
  assert.ok(s0.zoom >= 0.1, "the backdrop pushes harder under a figure");
});
