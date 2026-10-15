// clone-plan: the references' laws hold BY CONSTRUCTION on the plan, before anything is rendered; a beat with nothing to show is reported, not hidden.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planClone, lawProblems, cutPoints, displayWords, heroesOf, namesOf, typedEntitiesOf, cloneCanvasFor, excerptOf, figuresOf } from "../../src/skills/remotion-render/clone/clone-plan.js";

const G = JSON.parse(readFileSync(new URL("../../config/clone-grammar.json", import.meta.url), "utf8"));
const FPS = 30;

// a beat of `sec` seconds starting at `start` s, narrated at ~2.6 words/s from `text`
function beat(index, start, sec, text, canvas = {}) {
  const words = text.split(/\s+/), per = (sec * FPS - 6) / words.length;
  return { index, text, original_text: text, start_frame: Math.round(start * FPS), duration_frames: Math.round(sec * FPS),
    spoken: words.map((w, i) => ({ text: w, from: Math.round(i * per), to: Math.round((i + 1) * per) - 2 })), scene: { canvas } };
}
const photo = (asset, entity, kind = "place") => ({ asset, entity, kind, view: kind, w: 1600, h: 1000 });
const SENT = "Hennepin County Attorney Mary Moriarty announced the case against ICE agent Gregory Morgan on April sixteenth";

function video(nBeats, sec, heroEvery = 1) {
  const beats = [];
  for (let i = 0; i < nBeats; i++) beats.push(beat(i, i * sec, sec, SENT, i % heroEvery === 0 ? { photo: photo(`b-roll/x/p${i}.jpg`, "Hennepin County"), named_entities: [{ type: "organization", name: "Hennepin County" }] } : {}));
  return beats;
}

for (const name of Object.keys(G.profiles)) {
  test(`profile ${name}: a video of long beats still meets every cadence law on the plan`, () => {
    const beats = video(6, 7);                       // 7 s beats: the length that left our videos 8-10 s with nothing new
    const plan = planClone(beats, { laws: G.laws, profile: G.profiles[name] });
    assert.deepEqual(lawProblems(plan, G.laws), [], JSON.stringify(plan.report));
    assert.ok(plan.report.events_per_10s >= G.laws.events_per_10s_min);
    assert.ok(plan.report.gap_max_s <= G.laws.gap_max_s);
  });
}

test("every cut lands on a spoken word's onset, never mid-word", () => {
  const b = beat(0, 0, 7, SENT);
  const spoken = b.spoken.map((w) => ({ ...w, abs: w.from }));
  const cuts = cutPoints(0, 7 * FPS, 54, 30, spoken);
  for (const c of cuts.slice(1, -1)) assert.ok(spoken.some((w) => w.abs === c), `cut ${c} is not a word onset`);
});

test("a shot is about the profile's length: a 7 s beat becomes several shots, not one", () => {
  const plan = planClone(video(1, 7), { laws: G.laws, profile: G.profiles["dossier-mono"] });
  assert.ok(plan.shots.length >= 3, `${plan.shots.length} shots`);
  for (const s of plan.shots) assert.ok((s.f1 - s.f0) / FPS <= 2.6, `shot ${s.k} is ${(s.f1 - s.f0) / FPS}s`);
});

test("nothing is invented: heroes are the beat's own assets, the plate an entity it names, display words words it speaks", () => {
  const plan = planClone(video(3, 6), { laws: G.laws, profile: G.profiles["cutout-collage"] });
  const spokenAll = new Set(SENT.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/));
  for (const s of plan.shots) {
    if (s.hero) assert.match(s.hero.asset, /^b-roll\/x\/p\d\.jpg$/);
    if (s.plate) assert.equal(s.plate, "Hennepin County");
    if (s.display) for (const w of s.display.text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/)) assert.ok(spokenAll.has(w), `"${w}" is not a spoken word`);
    if (s.display) assert.ok(s.display.words <= 3);
  }
});

test("the same picture returns in a different treatment or crop, never the same frame twice", () => {
  const plan = planClone(video(1, 9), { laws: G.laws, profile: G.profiles["archive-italic"] });
  for (let i = 1; i < plan.shots.length; i++) {
    const a = plan.shots[i - 1], b = plan.shots[i];
    assert.ok(a.treatment !== b.treatment || a.crop[0] !== b.crop[0] || a.crop[1] !== b.crop[1], `shots ${i - 1}/${i} identical`);
  }
});

test("beats with no asset are REPORTED: the family requires 65% of shots to have a picture and says which fail", () => {
  const plan = planClone(video(6, 6, 3), { laws: G.laws, profile: G.profiles["dossier-mono"] });   // only every 3rd beat carries a photo
  assert.ok(plan.report.heroShare < 0.65);
  assert.ok(lawProblems(plan, G.laws).some((p) => /pictures: .* of shots have a picture/.test(p)));
});

test("cadence law violations are caught: a plan with one 10 s shot fails", () => {
  const plan = planClone(video(1, 10), { laws: G.laws, profile: { ...G.profiles["dossier-mono"], shot_s: 10, accent_shapes: [] } });
  const bad = { ...plan, report: { ...plan.report, gap_max_s: 9.4, gap_p90_s: 9.4, events_per_10s: 2, cuts_per_10s: 1 } };
  assert.ok(lawProblems(bad, G.laws).length >= 3);
});

test("display words never start or end on a function word", () => {
  const spoken = "the case against the agent of Highway sixty two".split(" ").map((t, i) => ({ text: t, from: i * 10, abs: i * 10 }));
  const d = displayWords(spoken, 0, 300, ["Highway 62"]);
  assert.ok(d && !/^(the|of|against)\b/i.test(d.text) && !/\b(the|of)$/i.test(d.text), d && d.text);
});

test("heroesOf / namesOf read what the resolved canvas carries", () => {
  const c = { photo: photo("a.jpg", "Minnesota"), concept_visuals: [{ name: "ICE", asset: "logos/ice.png", logo: true }], named_entities: [{ type: "organization", name: "ICE" }, { type: "number", name: "62" }] };
  assert.deepEqual(heroesOf(c).map((h) => h.kind), ["photo", "logo"]);
  assert.deepEqual(namesOf(c), ["ICE", "Minnesota"]);
});

test("a shot with NO picture is a designed type shot with an excerpt CARD, never a picture treatment with the picture missing", () => {
  const plan = planClone(video(2, 6, 2), { laws: G.laws, profile: G.profiles["dossier-mono"] });   // beat 1 carries no asset
  const noPic = plan.shots.filter((x) => !x.hero);
  assert.ok(noPic.length >= 2);
  // an accent block is only ever drawn BEHIND something: the card (a shot without a card has no block)
  for (const sh of noPic) { assert.equal(sh.treatment, "type"); assert.ok(sh.elements.some((e) => e.kind === "card"), "no card"); assert.ok(sh.excerpt); }
  for (const sh of plan.shots.filter((x) => x.hero)) { assert.notEqual(sh.treatment, "type"); assert.ok(!sh.elements.some((e) => e.kind === "card")); }
});

test("every entity a beat names gets a plate in some shot of that beat, typed by what it is", () => {
  const c = { photo: photo("b-roll/x/a.jpg", "Hennepin County"), named_entities: [{ type: "place", name: "Hennepin County" }, { type: "person", name: "Mary Moriarty" }, { type: "organization", name: "ICE" }, { type: "number", name: "62" }] };
  const plan = planClone([beat(0, 0, 7, SENT, c)], { laws: G.laws, profile: G.profiles["dossier-mono"] });
  const names = plan.shots.flatMap((x) => x.plates.map((p) => p.name));
  for (const n of ["Hennepin County", "Mary Moriarty", "ICE"]) assert.ok(names.includes(n), `${n} never gets a plate`);
  assert.ok(!names.includes("62"), "a figure is not a plate");
  assert.deepEqual(typedEntitiesOf(c).map((e) => e.type), ["place", "person", "organization"]);
});

test("the manifest records what the clone DREW: a map the canvas engine would have drawn, but the clone frame does not, is not claimed", () => {
  const c = { composition: "MAP-CENTERED", data: { place: "Colorado" }, named_entities: [{ type: "place", name: "Colorado" }], sentence: SENT };
  const plan = planClone([beat(0, 0, 6, SENT, c)], { laws: G.laws, profile: G.profiles["dossier-mono"] });
  const rec = cloneCanvasFor(c, plan.shots);
  assert.equal(rec.composition, "CLONE");
  assert.equal(rec.data, null, "no map or figure is claimed");
  assert.equal(rec.photo, null);
  assert.deepEqual(rec.art.names, ["Colorado"]);
  assert.deepEqual(rec.art.kinds, ["plate-place"]);
});

test("the manifest keeps the beat's photo (with its verification fields) only when some shot shows it", () => {
  const ph = { ...photo("b-roll/x/p.jpg", "Phil Weiser", "person"), verified_as: "Phil Weiser" };
  const plan = planClone([beat(0, 0, 6, SENT, { photo: ph, named_entities: [] })], { laws: G.laws, profile: G.profiles["cutout-collage"] });
  assert.equal(cloneCanvasFor({ photo: ph }, plan.shots).photo, ph);
  assert.equal(cloneCanvasFor({ photo: ph }, []).photo, null);
});

test("a stated figure is shown as a figure and recorded as one", () => {
  const c = { data: { value: "$14,000", label: "maximum fine" }, named_entities: [], sentence: SENT };
  const plan = planClone([beat(0, 0, 6, SENT, c)], { laws: G.laws, profile: G.profiles["dossier-mono"] });
  const rec = cloneCanvasFor(c, plan.shots);
  assert.equal(rec.composition, "NUMBER-STAT");
  assert.equal(rec.data.value, "$14,000");
});

test("display phrases do not start or end on a dangling verb or adverb (the real fragments: AIR HELD ALMOST, CAVE SITS, ROMANIA FAR, DEAL ANIMALS)", () => {
  const cases = [
    "Its air held almost no oxygen and a great deal of sulfur, which would kill most animals.",
    "The cave sits near the Black Sea, in southeastern Romania, far from any town.",
  ];
  for (const text of cases) {
    const spoken = text.split(" ").map((t, i) => ({ text: t, abs: i * 12 }));
    for (const [a, b] of [[0, 60], [48, 120], [96, 200], [0, 400]]) {
      const d = displayWords(spoken, a, b, ["Black Sea", "Romania"], 3);
      if (!d) continue;
      assert.ok(!/^(held|sits|almost|far|deal)/i.test(d.text) && !/(held|sits|almost|far|deal)$/i.test(d.text), `${d.text} (${text.slice(0, 20)})`);
    }
  }
});

test("a picture-less shot quotes the narration on an excerpt card: exactly what is spoken, cut at a word, never invented", () => {
  const b = beat(0, 0, 6, SENT, { sentence: SENT });
  const plan = planClone([b], { laws: G.laws, profile: G.profiles["dossier-mono"] });
  for (const sh of plan.shots) { assert.equal(sh.hero, null); assert.ok(sh.excerpt && SENT.startsWith(sh.excerpt.replace(/\.\.\.$/, "").trim().slice(0, 40))); assert.ok(sh.elements.some((e) => e.kind === "card")); }
  const long = excerptOf({ text: "word ".repeat(80).trim() }, {});
  assert.ok(long.length <= 154 && long.endsWith("..."), long.length);
  assert.equal(excerptOf({ text: "Short sentence here." }, {}), "Short sentence here.");
});

test("a picture-less shot that NAMES an entity shows that entity's glyph plate (silhouette / building / pin), not a bare label; one that names nothing shows the excerpt card", () => {
  const beats = [
    beat(0, 0, 6, SENT, { sentence: SENT, named_entities: [{ type: "person", name: "Mary Moriarty" }] }),
    beat(1, 6, 6, "Its air held almost no oxygen and a great deal of sulfur.", { sentence: "Its air held almost no oxygen and a great deal of sulfur.", named_entities: [] }),
  ];
  const plan = planClone(beats, { laws: G.laws, profile: G.profiles["cutout-collage"] });
  const named = plan.shots.filter((x) => x.beat === 0), unnamed = plan.shots.filter((x) => x.beat === 1);
  // EVERY shot of the picture-less beat shows the glyph (the entity check samples one frame per beat), alternating plate and disc so successive shots differ
  assert.ok(named.length >= 3 && named.every((x) => x.glyph), "a shot of the beat has no glyph");
  for (const sh of named) { assert.equal(sh.glyph.type, "person"); assert.ok(["plate", "disc"].includes(sh.treatment)); assert.equal(sh.hero, null); assert.equal(sh.excerpt, null); }
  for (let i = 1; i < named.length; i++) assert.notEqual(named[i].treatment, named[i - 1].treatment, "two glyph plates in a row look the same");
  for (const sh of unnamed) { assert.equal(sh.glyph, null); assert.ok(sh.excerpt); }
  const rec = cloneCanvasFor({ named_entities: [{ type: "person", name: "Mary Moriarty" }] }, named);
  assert.deepEqual(rec.art.kinds, ["plate-person"]);
});

test("the manifest declares the beat's ground and calls a beat what it draws (the frame review's labels read both)", () => {
  const pal = { ground: "#E4E4E1" };
  const withPhoto = planClone([beat(0, 0, 6, SENT, { photo: photo("b-roll/x/p.jpg", "Hennepin County"), sentence: SENT })], { laws: G.laws, profile: G.profiles["dossier-mono"] });
  const a = cloneCanvasFor({ photo: photo("b-roll/x/p.jpg", "Hennepin County") }, withPhoto.shots, pal);
  assert.equal(a.ground_color, "#E4E4E1");
  assert.equal(a.visual_type, "PHOTO");
  const none = planClone([beat(0, 0, 6, SENT, { sentence: SENT })], { laws: G.laws, profile: G.profiles["dossier-mono"] });
  assert.equal(cloneCanvasFor({}, none.shots, pal).visual_type, "TYPE");
  const fig = planClone([beat(0, 0, 6, SENT, { data: { value: "30+", label: "species" }, sentence: SENT })], { laws: G.laws, profile: G.profiles["dossier-mono"] });
  assert.equal(cloneCanvasFor({ data: { value: "30+", label: "species" } }, fig.shots, pal).visual_type, "COUNTER");
});

test("a picture-less beat that states a figure and a date shows them as its subjects in EVERY shot (the entity check samples one frame per beat)", () => {
  const SENT2 = "The Penny Hoarder published the October 2026 survey and only 35 percent of workers kept that money in reserve";
  const c = { sentence: SENT2, data: { value: "35%", label: "of workers" }, named_entities: [{ type: "date", name: "October 2026" }, { type: "company", name: "The Penny Hoarder" }] };
  const plan = planClone([beat(0, 0, 7, SENT2, c)], { laws: G.laws, profile: G.profiles["cutout-collage"] });
  assert.ok(plan.shots.length >= 3 && plan.shots.every((x) => x.subject), "a shot has no subject");
  const kinds = new Set(plan.shots.map((x) => x.subject.kind));
  assert.ok(kinds.has("figure") && kinds.has("date") && kinds.has("glyph"), [...kinds].join());
  const rec = cloneCanvasFor(c, plan.shots);
  assert.equal(rec.data.value, "35%");
  assert.equal(rec.composition, "NUMBER-STAT");
  assert.ok(rec.art.names.includes("The Penny Hoarder"));
});

test("a shot WITH a picture shows the beat's figure in its text region, every shot, in place of the display words", () => {
  const c = { photo: photo("b-roll/x/p.jpg", "Hennepin County"), data: { value: "$14,000", label: "maximum fine" }, sentence: SENT, named_entities: [] };
  const plan = planClone([beat(0, 0, 6, SENT, c)], { laws: G.laws, profile: G.profiles["dossier-mono"] });
  assert.ok(plan.shots.length >= 3);
  for (const sh of plan.shots) { assert.equal(sh.figure.value, "$14,000"); assert.equal(sh.display, null); }
});

test("a date with no glyph entity is recorded as a date art, the shape the coverage gate reads", () => {
  const c = { sentence: SENT, named_entities: [{ type: "date", name: "April 16, 2026" }] };
  const plan = planClone([beat(0, 0, 6, SENT, c)], { laws: G.laws, profile: G.profiles["dossier-mono"] });
  const rec = cloneCanvasFor(c, plan.shots);
  assert.equal(rec.art.kind, "date");
  assert.equal(rec.art.text, "April 16, 2026");
});
