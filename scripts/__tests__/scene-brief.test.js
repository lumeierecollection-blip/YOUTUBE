import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSceneBriefs, usableObs } from "../direction/scene-brief.mjs";
import { checkBriefsAgainstRender } from "../direction/check-briefs.mjs";
import { locateInputs } from "../direction/brief-cli.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const R = (f) => JSON.parse(readFileSync(join(ROOT, "data", "research", "1", f), "utf8"));
const script = R("elizabeth-van-lew-union-espionage-network-shorts-script.json");   // real, committed
const research = R("elizabeth-van-lew-union-espionage-network.json");              // real, committed

// Synthetic manifest/plan: one beat per sentence of the real script.
const sentences = script.sections.flatMap((s) => s.voiceover.match(/[^.?!]+[.?!]/g).map((x) => x.trim()));
const manifest = {
  video: "elizabeth-van-lew-union-espionage-network-shorts-shorts-2026-10-22.mp4", fps: 30, engine: "clone",
  sfx: [{ role: "hit", beat: 1, at_frame: 150, reason: "photo lands" }],
  beats: sentences.map((s, i) => ({
    index: i, start_sec: i * 3, duration_sec: i === 2 ? 5 : 3, narrative_text: ["Union", "Spy"],
    canvas: { sentence: s, visual_type: "PHOTO", composition: "PHOTO-FULL", emphasis_words: ["Richmond"],
      photo: i === 0 ? { asset: "asset-library/missing.jpg", entity: "Elizabeth Van Lew", verified_as: null } : null, concept_visuals: [] },
  })),
};
const plan = { beats: sentences.map((_, i) => ({ index: i, named_entities: i === 0 ? [{ type: "person", name: "Elizabeth Van Lew" }] : [], text_entrance: "POP_HARD" })) };
const grammar = { laws: { gap_max_s: 4 }, profiles: { "archive-italic": {} } };
const channel = { id: 1, clone: { profile: "archive-italic" } };
const build = (extra = {}) => buildSceneBriefs({ script, research, plan, manifest, channel, grammar, ...extra });

describe("scene briefs", () => {
  it("ids are stable, unique and carry index + narration hash", () => {
    const a = build(), b = build();
    assert.deepEqual(a.map((x) => x.scene_id), b.map((x) => x.scene_id));
    assert.equal(new Set(a.map((x) => x.scene_id)).size, a.length);
    assert.match(a[0].scene_id, /-s0-[0-9a-f]{6}$/);
    const changed = JSON.parse(JSON.stringify(manifest));
    changed.beats[0].canvas.sentence += " Extra words.";
    assert.notEqual(buildSceneBriefs({ script, research, plan, manifest: changed, channel, grammar })[0].scene_id, a[0].scene_id);
  });

  it("matches research evidence deterministically and never invents it", () => {
    const briefs = build();
    const allowed = new Set([...research.key_facts.map((f) => f.fact), ...research.numbers.map((n) => `${n.label}: ${n.value} ${n.unit}`)]);
    for (const b of briefs) for (const e of b.source_evidence) {
      assert.ok(allowed.has(e.fact), `unknown fact: ${e.fact}`);
      assert.ok(research.key_facts.some((f) => f.source_url === e.source_url) || research.numbers.some((n) => n.source_url === e.source_url));
    }
    const birth = briefs.find((b) => /October 12, 1818/.test(b.narration));
    assert.ok(birth.source_evidence.some((e) => /October 12, 1818/.test(e.fact)));
    assert.equal(birth.narrative_purpose, "evidence");
    const none = build().find((b) => /^Visit/.test(b.narration));
    assert.deepEqual(none.source_evidence.filter((e) => /1861|Libby/.test(e.fact)), []);
    const noEv = buildSceneBriefs({ script, research: { key_facts: [], numbers: [], named_entities: [] }, plan, manifest, channel, grammar });
    assert.ok(noEv.every((b) => b.source_evidence.length === 0 && b.evidence_status === "none" && b.flags.includes("no-research-evidence-for-sentence")));
  });

  it("maps beats to script sections and narration comes only from the manifest sentence", () => {
    const b = build();
    assert.equal(b[0].section, "hook");
    assert.equal(b[0].narrative_purpose, "hook");
    assert.ok(b.every((x) => sentences.includes(x.narration)));
  });

  const ref = (over = {}) => ({
    source: { file: "ref-01.mp4" }, direction: { status: "complete" },
    transitions: [{ text: "hard cut on the beat", type: "hard-cut", confidence: "high", evidence: ["f003", "f004"] }],
    sound_cues: [{ t: 1.2, text: "whoosh at cut", confidence: "medium", evidence: ["f005"] }],
    ...over,
  });

  it("uses reference observations only when confidence >= medium and frames are cited", () => {
    const b = build({ referenceDirection: ref() });
    assert.equal(b[1].transition.in, "hard-cut");
    assert.match(b[1].transition.rationale, /f003/);
    assert.ok(b[1].justification.some((j) => j.evidence.includes("ref:ref-01#f003")));
    const bad = build({ referenceDirection: ref({
      transitions: [{ text: "dissolve", confidence: "low", evidence: ["f001"] }, { text: "wipe", confidence: "high", evidence: [] }, { text: "spin", confidence: "high", evidence: ["frame-9"] }],
      sound_cues: [{ t: 1, text: "boom", confidence: "low", evidence: ["f001"] }],
    }) });
    assert.ok(bad.every((x) => !/dissolve|wipe|spin/.test(JSON.stringify(x.transition))));
    assert.ok(bad.every((x) => x.sound_cues.every((c) => c.kind !== "boom")));
    assert.match(bad[1].transition.rationale, /clone profile "archive-italic"/);
    const measured = build({ referenceDirection: ref({ direction: { status: "measured-only" } }) });
    assert.match(measured[1].transition.rationale, /No usable reference direction/);
    assert.equal(usableObs({ confidence: "medium", evidence: ["f010"] }), true);
    assert.equal(usableObs({ confidence: "low", evidence: ["f010"] }), false);
  });

  it("says so when neither reference nor clone profile exists", () => {
    const b = buildSceneBriefs({ script, research, plan, manifest, channel: {}, grammar });
    assert.match(b[1].transition.rationale, /not specified/);
  });

  it("every brief has objective and subjective criteria; justification cites evidence", () => {
    for (const b of build()) {
      assert.ok(b.acceptance_criteria.some((c) => c.objective) && b.acceptance_criteria.some((c) => !c.objective));
      assert.ok(b.justification.every((j) => j.evidence.length > 0));
    }
  });
});

describe("check-briefs", () => {
  it("turns failed objective criteria into defects with scene_id; subjective go to vision review", () => {
    const briefs = build();
    const r = checkBriefsAgainstRender(briefs, { manifest, publicDir: join(ROOT, "src", "skills", "remotion-render", "public") });
    const checks = r.new_defects.map((d) => d.check);
    assert.ok(checks.includes("brief:asset_file_exists"), checks.join());
    assert.ok(checks.includes("brief:entity_photo_verified"));
    assert.ok(checks.includes("brief:display_words_subset"));   // "Union Spy" is not in beat 0 narration
    const hold = r.new_defects.find((d) => d.check === "brief:max_hold");
    assert.equal(hold.beat_index, 2);
    assert.ok(r.new_defects.every((d) => d.scene_id === briefs[d.beat_index].scene_id && d.source === "objective"));
    assert.ok(r.for_vision_review.length > 0 && r.for_vision_review.every((c) => c.objective === false && c.scene_id));
  });

  it("a clean beat produces no defect", () => {
    const m = JSON.parse(JSON.stringify(manifest));
    m.beats[0].canvas.photo = { asset: "ok.jpg", verified_as: "Elizabeth Van Lew (Wikipedia)" };
    m.beats.forEach((b) => { b.narrative_text = []; b.duration_sec = 3; });
    const briefs = buildSceneBriefs({ script, research, plan, manifest: m, channel, grammar });
    const r = checkBriefsAgainstRender(briefs, { manifest: m, exists: () => true });
    assert.deepEqual(r.new_defects, []);
  });
});

describe("locateInputs", () => {
  it("skips with a reason when the video name or siblings cannot be found", () => {
    assert.match(locateInputs("C:/x/renders/1/odd.mp4").skip, /does not match/);
    assert.match(locateInputs("C:/x/renders/1/a-shorts-shorts-2026-10-22.mp4", join(ROOT, "nowhere")).skip, /not found/);
  });
});

// Every scene must justify itself (owner's direction brief, 2026-10-22): the ten fields, validated against
// schemas/scene-brief.json, on a second real committed script, plus a rationale tied to the narration and,
// where one exists, to an evidenced reference observation. Where the reference is measured-only, it says so.
describe("scene briefs justify every choice (real script: aberfan)", async () => {
  const Ajv = (await import("ajv")).default;
  const validate = new Ajv({ allErrors: true, strict: false }).compile(JSON.parse(readFileSync(join(ROOT, "schemas", "scene-brief.json"), "utf8")));
  const A = (f) => JSON.parse(readFileSync(join(ROOT, "data", "research", "1", f), "utf8"));
  const s2 = A("aberfan-marks-60-years-since-coal-tip-collapse-shorts-script.json");
  const r2 = A("aberfan-marks-60-years-since-coal-tip-collapse.json");
  const sents = s2.sections.flatMap((s) => s.voiceover.match(/[^.?!]+[.?!]/g).map((x) => x.trim()));
  const m2 = { video: "aberfan-marks-60-years-since-coal-tip-collapse-shorts-shorts-2026-10-22.mp4", fps: 30, engine: "canvas",
    beats: sents.map((t, i) => ({ index: i, start_sec: i * 3, duration_sec: 3, canvas: { sentence: t, visual_type: /\d/.test(t) ? "COUNTER" : "TYPE", composition: /\d/.test(t) ? "STAT" : "STATEMENT" } })) };
  const p2 = { beats: sents.map((_, i) => ({ index: i, named_entities: /Aberfan/.test(sents[i]) ? [{ type: "place", name: "Aberfan" }] : [], text_entrance: "POP_SOFT" })) };
  const refDoc = JSON.parse(readFileSync(join(ROOT, "data", "reference", "analysis", "ref-01", "direction.json"), "utf8"));   // committed, vision complete (qa-proof run 39816705908)
  const refMeasured = JSON.parse(readFileSync(join(ROOT, "data", "reference", "analysis", "ref-02", "direction.json"), "utf8"));   // committed, measured-only
  const FIELDS = ["narrative_purpose", "source_evidence", "asset_requirements", "timing", "composition", "text", "animation", "transition", "sound_cues", "acceptance_criteria", "justification"];

  it("every brief carries the ten direction fields and validates against the schema", () => {
    const b = buildSceneBriefs({ script: s2, research: r2, plan: p2, manifest: m2, channel: {}, grammar: {}, referenceDirection: refDoc });
    assert.equal(b.length, sents.length);
    assert.ok(validate(b), JSON.stringify(validate.errors?.slice(0, 3)));
    for (const x of b) for (const f of FIELDS) assert.ok(x[f] !== undefined && x[f] !== null, `${x.scene_id} lacks ${f}`);
    assert.ok(b.every((x) => x.timing.start != null && x.timing.end > x.timing.start));
  });

  it("evidence URLs come from research and are checked against the script's sources_used", () => {
    const b = buildSceneBriefs({ script: s2, research: r2, plan: p2, manifest: m2, channel: {}, grammar: {} });
    const urls = new Set([...(r2.key_facts || []).map((f) => f.source_url), ...(r2.numbers || []).map((n) => n.source_url)]);
    assert.ok(b.some((x) => x.source_evidence.length), "a real sentence matched real research");
    for (const x of b) for (const e of x.source_evidence) assert.ok(urls.has(e.source_url));
    const missing = buildSceneBriefs({ script: { ...s2, sources_used: [] }, research: r2, plan: p2, manifest: m2, channel: {}, grammar: {} });
    assert.ok(missing.filter((x) => x.source_evidence.length).every((x) => x.flags.includes("evidence-url-not-in-sources_used")));
  });

  it("the real ref-01 vision analysis is cited by frame in the composition rationale", () => {
    assert.equal(refDoc.direction.status, "complete");
    const b = buildSceneBriefs({ script: s2, research: r2, plan: p2, manifest: m2, channel: {}, grammar: {}, referenceDirection: refDoc });
    for (const x of b) {
      const c = x.justification.find((j) => j.choice.startsWith("composition:"));
      assert.ok(c && c.evidence.includes("narration"), x.scene_id);
      assert.ok(c.evidence.some((e) => /^ref:ref-01#f\d{3}$/.test(e)), `${x.scene_id} cites a ref-01 frame`);
      assert.ok(!x.flags.includes("reference-direction-measured-only"));
    }
  });

  it("the composition rationale cites the narration; a measured-only reference is flagged, never cited", () => {
    assert.equal(refMeasured.direction.status, "measured-only");
    const b = buildSceneBriefs({ script: s2, research: r2, plan: p2, manifest: m2, channel: {}, grammar: {}, referenceDirection: refMeasured });
    for (const x of b) {
      const c = x.justification.find((j) => j.choice.startsWith("composition:"));
      assert.ok(c && c.evidence.includes("narration"), x.scene_id);
      assert.match(c.because, /no usable reference composition observation/);
      assert.ok(x.flags.includes("reference-direction-measured-only"));
      assert.ok(!JSON.stringify(x.justification).includes("ref:"), "measured-only: no ref citation");
    }
    assert.ok(buildSceneBriefs({ script: s2, research: r2, plan: p2, manifest: m2, channel: {}, grammar: {} }).every((x) => x.flags.includes("no-reference-direction")));
  });

  it("with an evidenced reference composition observation the rationale cites its frames", () => {
    const complete = { source: { file: "ref-01.mp4" }, direction: { status: "complete" }, transitions: [], sound_cues: [],
      composition: [{ text: "figure fills the lower two thirds, label top-left", confidence: "high", evidence: ["f012"] }, { text: "guess", confidence: "low", evidence: ["f001"] }] };
    const b = buildSceneBriefs({ script: s2, research: r2, plan: p2, manifest: m2, channel: {}, grammar: {}, referenceDirection: complete });
    assert.ok(validate(b), JSON.stringify(validate.errors?.slice(0, 3)));
    for (const x of b) {
      const c = x.justification.find((j) => j.choice.startsWith("composition:"));
      assert.deepEqual(c.evidence, ["narration", "ref:ref-01#f012"]);
      assert.ok(!c.because.includes("guess"));
      assert.ok(!x.flags.some((f) => f.startsWith("reference-direction") || f === "no-reference-direction"));
    }
  });
});
