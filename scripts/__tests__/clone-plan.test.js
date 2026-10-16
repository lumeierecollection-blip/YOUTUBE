// clone-plan: the references' laws hold BY CONSTRUCTION on the plan, before anything is rendered; a beat with nothing to show is reported, not hidden.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planClone, lawProblems, cutPoints, displayWords, heroesOf, namesOf, typedEntitiesOf, cloneCanvasFor, excerptOf, figuresOf, quantityIn } from "../../src/skills/remotion-render/clone/clone-plan.js";

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
  for (const sh of named) { assert.equal(sh.glyph.type, "person"); assert.equal(sh.treatment, "subject"); assert.equal(sh.hero, null); assert.equal(sh.excerpt, null); }   // frameless (owner, 2026-10-16: "the frames are not needed")
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

test("a picture-less beat that states a figure and a date shows ALL its subjects in EVERY shot, as one panel (the entity check samples one frame per beat)", () => {
  const SENT2 = "The Penny Hoarder published the October 2026 survey and only 35 percent of workers kept that money in reserve";
  const c = { sentence: SENT2, data: { value: "35%", label: "of workers" }, named_entities: [{ type: "date", name: "October 2026" }, { type: "company", name: "The Penny Hoarder" }] };
  const plan = planClone([beat(0, 0, 7, SENT2, c)], { laws: G.laws, profile: G.profiles["cutout-collage"] });
  assert.ok(plan.shots.length >= 3);
  for (const sh of plan.shots) {
    assert.equal(sh.treatment, "subject");
    const kinds = sh.subjects.map((x) => x.kind).sort().join();
    assert.equal(kinds, "date,figure,glyph", "a shot is missing a subject: " + kinds);
  }
  const rec = cloneCanvasFor(c, plan.shots);
  assert.equal(rec.data.value, "35 percent");   // the figure as the SENTENCE writes it ("only 35 percent of workers"), unit and all
  assert.equal(rec.composition, "NUMBER-STAT");
  assert.ok(rec.art.names.includes("The Penny Hoarder"));
});

test("more than four subjects rotate through the panel, every one shown across the beat", () => {
  const ents = ["A One", "B Two", "C Three", "D Four", "E Five", "F Six"].map((n) => ({ type: "organization", name: n }));
  const plan = planClone([beat(0, 0, 9, SENT, { sentence: SENT, named_entities: ents })], { laws: G.laws, profile: G.profiles["dossier-mono"] });
  assert.ok(plan.shots.every((x) => x.subjects.length === 4));
  const seen = new Set(plan.shots.flatMap((x) => x.subjects.map((y) => y.name)));
  assert.equal(seen.size, 6);
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

test("a figure whose text is a date is a date (the planner filed 'October 13, 2026' under data.value)", () => {
  const f = figuresOf({ data: { value: "October 13, 2026", label: "vote" }, named_entities: [{ type: "number", name: "9" }] });
  assert.equal(f[0].kind, "date");
  assert.equal(f[1].kind, "figure");
});

test("the manifest says truthfully what a beat's frames are, for the frame review's label (not 'typography')", () => {
  const c = { sentence: SENT, named_entities: [{ type: "place", name: "Newark" }], data: { value: "9 to 0", label: "vote" } };
  const plan = planClone([beat(0, 0, 7, SENT, c)], { laws: G.laws, profile: G.profiles["dossier-mono"] });
  const rec = cloneCanvasFor(c, plan.shots);
  assert.ok(rec.clone_label && /names of entities it has no picture of/.test(rec.clone_label) && /large figure plates/.test(rec.clone_label), rec.clone_label);
  assert.ok(!/typography/i.test(rec.clone_label.replace("secondary caption", "")));
  const nothing = cloneCanvasFor({ sentence: SENT }, planClone([beat(0, 0, 6, SENT, { sentence: SENT })], { laws: G.laws, profile: G.profiles["dossier-mono"] }).shots);
  assert.match(nothing.clone_label, /narration set word by word/);
});

test("a display phrase never shows PART of a named entity ('ACKIE' for 'Naomi Ackie' failed the naming check)", () => {
  const text = "Naomi Ackie joined the cast of the film in Los Angeles on Monday";
  const spoken = text.split(" ").map((t, i) => ({ text: t, abs: i * 10 }));
  for (const [a, b] of [[0, 25], [10, 40], [0, 200], [60, 110], [90, 120]]) {
    const d = displayWords(spoken, a, b, ["Naomi Ackie", "Los Angeles"], 3);
    if (!d) continue;
    const t = d.text.toLowerCase();
    for (const nm of ["naomi ackie", "los angeles"]) {
      const parts = nm.split(" "), hit = parts.filter((x) => t.split(/\s+/).includes(x)).length;
      assert.ok(hit === 0 || hit === parts.length, `"${d.text}" shows part of "${nm}"`);
    }
  }
});

test("a display phrase does not repeat what the shot's plate already says (TWENTY-SIX under a date plate, NEWARK under a Newark pin)", () => {
  const T = "Newark landlords must pass the October thirteen twenty twenty-six rule on every single violation";
  const c = { sentence: T, named_entities: [{ type: "place", name: "Newark" }, { type: "date", name: "October 13, 2026" }] };
  const plan = planClone([beat(0, 0, 7, T, c)], { laws: G.laws, profile: G.profiles["dossier-mono"] });
  const banned = new Set(["newark", "october", "thirteen", "twenty", "twenty-six", "2026"]);
  for (const sh of plan.shots) if (sh.display) for (const w of sh.display.text.toLowerCase().split(/\s+/)) assert.ok(!banned.has(w), `"${sh.display.text}" repeats the plate`);
});

test("successive panels of a beat DIFFER (rotated cells, alternate inversion): a cut between identical frames is invisible and the cadence falls", () => {
  const ents = ["Newark", "Essex County"].map((n) => ({ type: "place", name: n }));
  const plan = planClone([beat(0, 0, 8, SENT, { sentence: SENT, named_entities: ents, data: { value: "$1,250", label: "per violation" } })], { laws: G.laws, profile: G.profiles["dossier-mono"] });
  assert.ok(plan.shots.length >= 4 && plan.shots.every((x) => x.subjects.length === 3));
  for (let i = 1; i < plan.shots.length; i++) {
    const a = plan.shots[i - 1], b = plan.shots[i];
    const order = (x) => x.subjects.map((y) => y.name).join("|");
    assert.ok(order(a) !== order(b) || a.inv !== b.inv, `shots ${i - 1}/${i} are the same panel`);
    assert.notEqual(a.inv, b.inv, "the inversion does not alternate");
  }
});

test("a shot with no phrase that adds to its plate gets a tick instead, so it still has three events", () => {
  const T = "Newark Newark Newark";
  const plan = planClone([beat(0, 0, 4, T, { sentence: T, named_entities: [{ type: "place", name: "Newark" }] })], { laws: G.laws, profile: G.profiles["dossier-mono"] });
  for (const sh of plan.shots) { assert.equal(sh.display, null); assert.ok(sh.elements.some((e) => e.kind === "tick")); }
});

test("a figure is shown as the SENTENCE writes it, with its unit ('30' for '30-second' failed the naming check: unit missing)", () => {
  assert.equal(quantityIn("A 30-second wait", "30"), "30-second");
  assert.equal(quantityIn("worth 5 million euros", "5"), "5 million euros");
  assert.equal(quantityIn("fined $1,250 each", "1250"), "$1,250");
  assert.equal(quantityIn("only 35% of workers", "35"), "35%");
  assert.equal(quantityIn("no digits here", "7"), "7");
  const f = figuresOf({ sentence: "The 30-second delay", data: { value: "30", label: "delay" } });
  assert.equal(f[0].name, "30-second");
});

test("number and month words are NEVER display type: the spoken form is not the written one (OCTOBER EIGHT / TWENTY-SIX failed the naming check)", () => {
  const T = "Voters passed the measure on October eight in twenty twenty-six with nine votes";
  const spoken = T.split(" ").map((t, i) => ({ text: t, abs: i * 10 }));
  const plan = planClone([{ ...beat(0, 0, 7, T, { sentence: T }), spoken: spoken.map((w) => ({ text: w.text, from: w.abs })) }], { laws: G.laws, profile: G.profiles["dossier-mono"] });
  const banned = new Set(["october", "eight", "twenty", "twenty-six", "nine", "nine"]);
  for (const sh of plan.shots) if (sh.display) for (const w of sh.display.text.toLowerCase().split(/\s+/)) assert.ok(!banned.has(w), `"${sh.display.text}" is a spoken-form number`);
});

test("A LABEL UNDER A PICTURE NAMES THAT PICTURE'S OWN ENTITY: a photo of James Wan never carries 'Sam Raimi' (beat check: wrong-person, board 38805009555 ch-49 beat 5)", () => {
  const T = "James Wan, Sam Raimi, and Na Hong-jin now lead this ranking";
  const c = { sentence: T, photo: photo("b-roll/x/wan.jpg", "James Wan", "person"), named_entities: [{ type: "person", name: "James Wan" }, { type: "person", name: "Sam Raimi" }, { type: "person", name: "Na Hong-jin" }] };
  for (const name of Object.keys(G.profiles)) {
    const plan = planClone([beat(0, 0, 7, T, c)], { laws: G.laws, profile: G.profiles[name] });
    assert.ok(plan.shots.length >= 3, name);
    for (const sh of plan.shots) {
      if (sh.hero) {
        for (const p of sh.plates) assert.equal(p.name, "James Wan", `${name}: a shot showing James Wan's photo is labelled "${p.name}"`);
        if (sh.plate) assert.equal(sh.plate, "James Wan");
        assert.ok(!sh.subjects.length, "a picture shot also carries entity cells");
      }
    }
    // the other two are shown where no picture is, on the trailing panel shot
    const last = plan.shots.at(-1);
    assert.equal(last.hero, null);
    assert.deepEqual(last.subjects.map((x) => x.name).sort(), ["Na Hong-jin", "Sam Raimi"], name);
    const rec = cloneCanvasFor(c, plan.shots);
    for (const n of ["James Wan", "Sam Raimi", "Na Hong-jin"]) assert.ok(rec.art.names.includes(n), `${n} missing from the record`);
  }
});

test("a beat with a picture and a short run of shots (under three) keeps its picture on every shot and never mislabels it", () => {
  const T = "James Wan and Sam Raimi lead";
  const c = { sentence: T, photo: photo("b-roll/x/wan.jpg", "James Wan", "person"), named_entities: [{ type: "person", name: "James Wan" }, { type: "person", name: "Sam Raimi" }] };
  const plan = planClone([beat(0, 0, 2.5, T, c)], { laws: G.laws, profile: G.profiles["dossier-mono"] });
  for (const sh of plan.shots) for (const p of sh.plates) assert.equal(p.name, "James Wan");
});

test("a subject-plate shot keeps a short caption that never repeats its plate (removing captions made ch-44 / ch-26 TEMPLATE_MONOCULTURE 100%: board 38811678143)", () => {
  const c = { sentence: SENT, named_entities: [{ type: "place", name: "Hennepin County" }, { type: "date", name: "April 16, 2026" }] };
  const plan = planClone([beat(0, 0, 8, SENT, c)], { laws: G.laws, profile: G.profiles["dossier-mono"] });
  assert.ok(plan.shots.some((sh) => sh.display), "no shot has a caption");
  for (const sh of plan.shots) { assert.ok(sh.subjects.length); if (sh.display) assert.ok(!/hennepin|county|april|sixteenth/i.test(sh.display.text), `"${sh.display.text}" repeats the plate`); assert.ok(sh.elements.some((e) => e.kind === "display" || e.kind === "tick")); }
});

test("a figure that is only the start of a longer one is dropped ('9' beside '9 to 0')", () => {
  const f = figuresOf({ sentence: "The council voted 9 to 0", data: { value: "9 to 0", label: "vote" }, named_entities: [{ type: "number", name: "9" }, { type: "number", name: "0" }] });
  assert.deepEqual(f.map((x) => x.name), ["9 to 0"]);
});

test("a figure label ends on a content word; contractions are never display type (board 38831133468 ch-1)", async () => {
  const { trimLabel } = await import("../../src/skills/remotion-render/clone/clone-plan.js");
  assert.equal(trimLabel("working Americans have an"), "working Americans");
  assert.equal(trimLabel("of the"), null);
  const sp = "That's shockingly low, but you can prepare for it.".split(" ").map((t, i) => ({ text: t, abs: i * 10 }));
  const d = displayWords(sp, 0, 200, [], 3);
  assert.ok(!/that's/i.test(d.text), d.text);
});

test("a beat's further verified pictures (clone_extra) are heroes too: a logo as a mark, a person as a portrait (board 38870271640 ch-49 NPR)", () => {
  const hs = heroesOf({ photo: { asset: "entities/people/a.jpg", entity: "A Person", kind: "person" }, clone_extra: [{ kind: "logo", name: "NPR", asset: "cutouts-live/49/1-npr-logo.png" }, { kind: "person", name: "B Person", asset: "entities/people/b.jpg", cutout: "cutouts-live/49/photo-x-g.png", cutout_grounded: true }] });
  assert.deepEqual(hs.map((h) => [h.kind, h.name]), [["portrait", "A Person"], ["logo", "NPR"], ["portrait", "B Person"]]);
  assert.equal(hs[2].cutout, "cutouts-live/49/photo-x-g.png");
});

test("with PROPS every shot of a beat has a picture, and the beat's picture-less entities are named in type on the prop shots (owner 2026-10-16)", () => {
  const words = "Russell Brand appeared at Southwark Crown Court in London on Monday for the opening of his trial.".split(" ");
  const beat = { start_frame: 0, duration_frames: 210, text: words.join(" "),
    spoken: words.map((t, k) => ({ text: t, from: 6 + k * 11, to: 16 + k * 11 })),
    scene: { canvas: { sentence: words.join(" "), named_entities: [{ type: "person", name: "Russell Brand" }, { type: "building", name: "Southwark Crown Court" }],
      clone_props: [{ name: "courthouse", asset: "cutouts-live/5/0-courthouse.png", grounded: true }, { name: "gavel", asset: "cutouts-live/5/0-gavel.png" }] } } };
  const plan = planClone([beat], { laws: G.laws, profile: G.profiles["dossier-mono"], fps: 30 });
  assert.ok(plan.shots.length >= 3);
  for (const sh of plan.shots) assert.ok(sh.hero, `shot ${sh.k} has no picture`);
  const named = plan.shots.map((sh) => sh.display && sh.display.text).filter(Boolean).join(" | ");
  assert.match(named, /Russell Brand/);
  assert.match(named, /Southwark Crown Court/);
});

test("a beat with a named picture and props: the named picture holds the key shot (62% of the beat, what the checks sample) and most shots", () => {
  const words = "Director James Wan said the horror slate grew this year at Variety's annual impact report in October.".split(" ");
  const beat = { start_frame: 0, duration_frames: 240, text: words.join(" "),
    spoken: words.map((t, k) => ({ text: t, from: 6 + k * 12, to: 16 + k * 12 })),
    scene: { canvas: { sentence: words.join(" "), named_entities: [{ type: "person", name: "James Wan" }], photo: { asset: "entities/people/james-wan.jpg", entity: "James Wan", kind: "person" },
      clone_props: [{ name: "film camera", asset: "cutouts-live/49/1-film-camera.png" }, { name: "clapperboard", asset: "cutouts-live/49/1-clapperboard.png" }] } } };
  const plan = planClone([beat], { laws: G.laws, profile: G.profiles["cutout-collage"], fps: 30 });
  const key = plan.shots.find((sh) => sh.f0 <= 0.62 * 240 && 0.62 * 240 < sh.f1);
  assert.equal(key.hero.name, "James Wan");
  const named = plan.shots.filter((sh) => sh.hero && sh.hero.name === "James Wan").length;
  assert.ok(named >= plan.shots.length / 2, `${named}/${plan.shots.length}`);
  assert.ok(plan.shots.every((sh) => sh.hero));
});
