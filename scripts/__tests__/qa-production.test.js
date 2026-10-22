// Production QA loop (scripts/qa/production.mjs + repairs.mjs) on synthetic ffmpeg clips and plan fixtures.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkFrozen, checkAudio } from "../qa/objective-checks.mjs";
import { repairFor, applyPlanRepairs, clampSrt, limitAudio, typeCard } from "../qa/repairs.mjs";
import { canvasDefects, inspectRender, runProductionQa, qaMode, qaBudgets } from "../qa/production.mjs";

let dir;
function clip(name, { size = "1080x1920", dur = 3, src = null, audio = "sine=frequency=440:duration=3", af = "" } = {}) {
  const out = join(dir, name);
  const args = ["-v", "error", "-y", "-f", "lavfi", "-i", src || `testsrc2=s=${size}:r=30:d=${dur}`];
  if (audio) args.push("-f", "lavfi", "-i", audio);
  if (af) args.push("-af", af);
  args.push("-c:v", "libx264", "-preset", "ultrafast", "-crf", "45", "-pix_fmt", "yuv420p", "-r", "30");
  if (audio) args.push("-c:a", "aac", "-b:a", "128k", "-shortest");
  args.push(out);
  const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return out;
}
const plan3 = () => ({ beats: [0, 1, 2].map((i) => ({ index: i, visual_type: "PHOTO", headline: `Beat ${i} has a very long headline that will not fit on one line`, pull_phrase: { text: "p", position: "bottom" }, label: "L", lead_in: "lead", named_entities: [{ type: "organization", name: `Org ${i}` }], canvas: { photo: { asset: `a${i}.jpg` } } })) });

before(() => { dir = mkdtempSync(join(tmpdir(), "qa-prod-")); });
after(() => { rmSync(dir, { recursive: true, force: true }); });

test("qaMode / qaBudgets: advisory and safe defaults; bad values fall back", () => {
  assert.equal(qaMode({}), "advisory");
  assert.equal(qaMode({ QA_LOOP: "ENFORCE" }), "enforce");
  assert.equal(qaMode({ QA_LOOP: "bogus" }), "advisory");
  assert.deepEqual(qaBudgets({}), { maxAttempts: 3, maxMs: 1200000, maxCostUnits: 2 });
  assert.deepEqual(qaBudgets({ QA_MAX_ATTEMPTS: "5", QA_MAX_MS: "-1", QA_MAX_COST_UNITS: "x" }), { maxAttempts: 5, maxMs: 1200000, maxCostUnits: 2 });
});

test("freeze: a 4 s still is a frozen-frames defect", () => {
  const v = clip("still.mp4", { src: "color=c=gray:s=1080x1920:r=30:d=4", audio: "sine=frequency=440:duration=4" });
  const f = checkFrozen(v);
  assert.equal(f.length, 1);
  assert.ok(f[0].t_start < 0.5);
});

test("true peak: a clipping tone is audio-clipping; the post repair (limiter) clears it", () => {
  const v = clip("loud.mp4", { audio: "sine=frequency=440:duration=3", af: "volume=24dB" });
  assert.equal(checkAudio(v).filter((d) => d.check === "audio-clipping").length, 1);
  assert.deepEqual(repairFor({ check: "audio-clipping" }).scope, "post");
  assert.equal(limitAudio(v).changed, true);
  assert.equal(checkAudio(v).filter((d) => d.check === "audio-clipping").length, 0);
});

test("render failure: no MP4 is a render-failure blocker", () => {
  const d = inspectRender({ videoPath: join(dir, "nope.mp4") });
  assert.equal(d.length, 1);
  assert.equal(d[0].check, "render-failure");
  assert.equal(d[0].severity, "blocker");
});

test("canvasDefects: one defect per failing beat, timed from the manifest, entities parsed, repair attached", () => {
  const stdout = [
    "[canvas] PASS canvas-coverage — fine",
    "[canvas] FAIL canvas-fit — beat 0: headline box (40,100,1100,300) leaves the frame's safe area; beat 2: text boxes headline and number overlap; beat 2: pull box enters the caption band",
    "[canvas] FAIL entity-coverage — beat 1: organization \"Org 1\" — words only, but the sentence names an entity",
    "[canvas] FAIL canvas-accent — accent missing everywhere",
  ].join("\n");
  const man = { beats: [{ start_sec: 0, duration_sec: 2 }, { start_sec: 2, duration_sec: 3 }, { start_sec: 5, duration_sec: 1 }] };
  const d = canvasDefects(stdout, man);
  assert.deepEqual(d.map((x) => `${x.check}:${x.beat_index}`), ["canvas-fit:0", "canvas-fit:2", "entity-coverage:1", "canvas-accent:null"]);
  assert.equal(d[1].t_start, 5);
  assert.match(d[1].evidence, /caption band/);
  assert.deepEqual(d[2].entities, ["Org 1"]);
  assert.equal(repairFor(d[0]).scope, "plan");
  assert.equal(repairFor(d[3]), null);
});

test("plan repairs: canvas-fit declutters then escalates to a TYPE card; entity-coverage draws a plate; missing-media drops the picture", () => {
  const history = new Map();
  const fit = [{ check: "canvas-fit", beat_index: 0 }];
  const r1 = applyPlanRepairs(plan3(), fit, { history, sentences: ["S0", "S1", "S2"] });
  assert.equal(r1.plan.beats[0].pull_phrase, null);
  assert.equal(r1.plan.beats[0].headline.split(" ").length, 8);
  assert.equal(r1.plan.beats[0].visual_type, "PHOTO");
  const r2 = applyPlanRepairs(r1.plan, fit, { history, sentences: ["S0", "S1", "S2"] });
  assert.equal(r2.plan.beats[0].visual_type, "TYPE");
  const e = applyPlanRepairs(plan3(), [{ check: "entity-coverage", beat_index: 1, entities: ["Org 1"] }]);
  assert.deepEqual(e.plan.beats[1].art, { kind: "plate-organization", name: "Org 1" });
  const m = applyPlanRepairs(plan3(), [{ check: "missing-media", beat_index: 2 }], { sentences: ["", "", "the sentence"] });
  assert.equal(m.plan.beats[2].visual_type, "TYPE");
  assert.deepEqual(m.plan.beats[2].concept_visuals, []);
});

test("REGRESSION: repairing scene N leaves every other scene's plan entry byte-identical (and the input plan unmutated)", () => {
  for (const check of ["canvas-fit", "pop-transitions", "entity-coverage", "missing-media"]) {
    const plan = plan3();
    const before = JSON.stringify(plan);
    const rebuilt = [];
    const r = applyPlanRepairs(plan, [{ check, beat_index: 1, entities: ["Org 1"] }], { rebuildCanvas: (b) => { rebuilt.push(b.index); return { rebuilt: true }; } });
    assert.equal(r.changed, true, check);
    assert.equal(JSON.stringify(plan), before, `${check}: input mutated`);
    assert.deepEqual(r.plan.beats[0], plan.beats[0], `${check}: beat 0 changed`);
    assert.deepEqual(r.plan.beats[2], plan.beats[2], `${check}: beat 2 changed`);
    assert.notDeepEqual(r.plan.beats[1], plan.beats[1], check);
    assert.deepEqual(rebuilt, [1], `${check}: canvas rebuilt only for beat 1`);
  }
});

test("typeCard keeps the headline when asked and clears the picture fields", () => {
  const b = typeCard({ headline: "Keep me", photo: 1, art: { kind: "x" }, concept_visuals: [1] }, "the sentence", true);
  assert.equal(b.headline, "Keep me");
  assert.equal(b.art, null);
  assert.equal(typeCard({ headline: "x" }, "the sentence", false).headline, "the sentence");
});

test("clampSrt: overlaps and past-end cues are clamped; a clean SRT is unchanged", () => {
  const srt = "1\n00:00:00,000 --> 00:00:02,500\nOne\n\n2\n00:00:02,000 --> 00:00:04,000\nTwo\n\n3\n00:00:04,000 --> 00:00:09,000\nThree\n";
  const r = clampSrt(srt, 6);
  assert.equal(r.changed, true);
  assert.match(r.text, /00:00:00,000 --> 00:00:02,000\nOne/);
  assert.match(r.text, /00:00:04,000 --> 00:00:06,000\nThree/);
  assert.equal(clampSrt(r.text, 6).changed, false);
});

function writePlan(p) { const f = join(dir, `plan-${Math.random().toString(36).slice(2)}.json`); writeFileSync(f, JSON.stringify(p)); return f; }
function videoWithManifest(name) {
  const v = clip(name);
  writeFileSync(v.replace(/\.mp4$/, "-manifest.json"), JSON.stringify({ fps: 30, beats: [{ start_sec: 0, duration_sec: 1 }, { start_sec: 1, duration_sec: 1 }, { start_sec: 2, duration_sec: 1 }] }));
  return v;
}
const FAIL_B1 = "[canvas] FAIL canvas-fit — beat 1: text boxes headline and number overlap";

test("enforce: a canvas-fit failure on beat 1 is repaired, re-rendered, passes; the report is written; other beats untouched", async () => {
  const v = videoWithManifest("enf.mp4");
  const plan = plan3();
  const planPath = writePlan(plan);
  const rendered = [];
  const res = await runProductionQa({
    mode: "enforce", budgets: { maxAttempts: 3, maxMs: 60000, maxCostUnits: 2 }, log: () => {},
    first: { videoPath: v, planPath, canvasStdout: FAIL_B1, canvasCode: 1 },
    rerender: async (p, n) => { rendered.push(p); copyFileSync(join(dir, "enf.qa-a1.mp4"), v); return { videoPath: v, planPath: p, canvasStdout: "", canvasCode: 0 }; },
  });
  assert.equal(rendered.length, 1);
  const repaired = JSON.parse(readFileSync(rendered[0], "utf8"));
  assert.deepEqual(repaired.beats[0], plan.beats[0]);
  assert.deepEqual(repaired.beats[2], plan.beats[2]);
  assert.equal(repaired.beats[1].pull_phrase, null);
  assert.equal(res.best_attempt, 2);
  assert.ok(!res.bestDefects.some((d) => d.check === "canvas-fit"));
  assert.equal(res.vision.status, "not_run");
  const rep = JSON.parse(readFileSync(res.report.jsonPath, "utf8"));
  assert.equal(rep.meta.vision.status, "not_run");
  assert.equal(rep.meta.attempts.length, 2);
  assert.ok(rep.defects.some((d) => d.check === "canvas-fit" && d.status === "repaired"));
  assert.ok(existsSync(res.report.mdPath));
  assert.ok(res.sheet && existsSync(res.sheet), "contact sheet");
});

test("enforce: a repair that does not fix the beat stops on no-progress and keeps the best attempt at the canonical path", async () => {
  const v = videoWithManifest("np.mp4");
  const planPath = writePlan(plan3());
  const firstBytes = readFileSync(v);
  let n2 = 0;
  const res = await runProductionQa({
    mode: "enforce", budgets: { maxAttempts: 4, maxMs: 60000, maxCostUnits: 5 }, log: () => {},
    first: { videoPath: v, planPath, canvasStdout: FAIL_B1, canvasCode: 1 },
    // every re-render still fails beat 1 AND adds a new failure on beat 0 (a regression) -> attempt 1 stays best
    rerender: async (p) => { n2++; clip("np.mp4", { src: "testsrc=s=1080x1920:r=30:d=3" }); return { videoPath: v, planPath: p, canvasStdout: `${FAIL_B1}\n[canvas] FAIL pop-transitions — beat 0: the composition is empty at boundary frame(s) 0`, canvasCode: 1 }; },
  });
  assert.equal(res.best_attempt, 1);
  assert.ok(["no-progress", "budget-exhausted"].includes(res.status), res.status);
  assert.deepEqual(readFileSync(v), firstBytes, "the canonical MP4 is attempt 1 again");
  assert.ok(res.attempts[1].regressions.length === 0 || res.attempts[1].regressions.every((r) => /pop-transitions/.test(r)));
});

test("advisory: inspects once, proposes the repair, never re-renders or writes a plan", async () => {
  const v = videoWithManifest("adv.mp4");
  const planPath = writePlan(plan3());
  let called = 0;
  const res = await runProductionQa({ mode: "advisory", log: () => {}, first: { videoPath: v, planPath, canvasStdout: FAIL_B1, canvasCode: 1 }, rerender: async () => { called++; return {}; } });
  assert.equal(called, 0);
  assert.equal(res.attempts.length, 1);
  assert.equal(res.status, "advisory-repairs-proposed");
  assert.ok(!existsSync(planPath.replace(/\.json$/, "-qa-a2.json")));
  const md = readFileSync(res.report.mdPath, "utf8");
  assert.match(md, /mode \*\*advisory\*\*/);
  assert.match(md, /beat 1: canvas-fit: declutter/);
});

test("off: nothing runs", async () => {
  const res = await runProductionQa({ mode: "off", first: { videoPath: join(dir, "x.mp4") }, rerender: async () => assert.fail("rendered") });
  assert.equal(res.skipped, true);
});
