/**
 * Layer 1 pixel checks measure "ink" against the frame's own ground.
 *
 * zones-no-overlap, pop-transitions and middle-zone-filled defined ink as luma < 235 — the house
 * white ground. A beat whose planner-declared ground is dark (#0E0E10) read as ink in every pixel:
 * every column "crossed" a zone edge (ch-05 run 37694022496, beats 3 and 7), and an EMPTY dark
 * frame counted as full for pop-transitions. These tests drive the real CLI
 * (`local-audit.cjs --canvas-only`) on ffmpeg-generated videos, so the pixels are real.
 *
 *   white ground, content in the middle zone      -> zones PASS (unchanged by the fix)
 *   dark  ground, the same content drawn light    -> zones PASS (was FAIL)
 *   white ground, content crossing a zone edge    -> zones FAIL
 *   dark  ground, the same crossing content       -> zones FAIL (the check is not made permissive)
 *   dark  beat with content / EMPTY dark beat     -> pop-transitions PASS / FAIL (was PASS / PASS)
 *
 * MUTATION (run, recorded in the commit): making inkFnColour / inkFnLuma ignore the ground (always
 * the legacy `< 235` rule) turns "dark ground ... PASS" and "EMPTY dark beat -> FAIL" red.
 * Restored byte-identical.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const have = spawnSync("ffmpeg", ["-version"]).status === 0;
const dir = mkdtempSync(join(tmpdir(), "ground-aware-"));
after(() => rmSync(dir, { recursive: true, force: true }));

const WHITE = "0xFFFFFF", DARK = "0x0E0E10";
const box = (x, y, w, h, c) => `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${c}:t=fill`;

/** One segment: a ground colour for `d` seconds, with optional drawboxes. */
function segment(name, ground, boxes, d) {
  const out = join(dir, `${name}.mp4`);
  const vf = [`color=c=${ground}:s=1080x1920:r=30:d=${d}`, ...boxes].join(",");
  const r = spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", vf, "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "12", out]);
  assert.equal(r.status, 0, String(r.stderr));
  return out;
}
function concat(name, parts) {
  const out = join(dir, `${name}.mp4`);
  const args = ["-loglevel", "error", "-y", ...parts.flatMap((p) => ["-i", p]),
    "-filter_complex", `${parts.map((_, i) => `[${i}:v]`).join("")}concat=n=${parts.length}:v=1:a=0[v]`, "-map", "[v]", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "12", out];
  const r = spawnSync("ffmpeg", args);
  assert.equal(r.status, 0, String(r.stderr));
  return out;
}

const BOXES = {
  headline: { x: 48, y: 130, w: 600, h: 100, role: "headline", align: "left", size: 88, bleed: 0 },
  cutout0: { x: 220, y: 690, w: 640, h: 640, role: "concept", align: "center", size: 0, bleed: 0 },
};
const beat = (i, start, dur, ground_color) => ({
  index: i, start_sec: start, duration_sec: dur, visual_type: "TYPE",
  canvas: { composition: "TYPE-FULL", hero: "cutout0", boxes: BOXES, ground: ground_color ? "white" : "white", ground_color, dark: !!ground_color, photo: null, motion_tier: "micro" },
});

function audit(video, beats) {
  const mf = join(dir, `m-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(mf, JSON.stringify({ video: "x.mp4", fps: 30, width: 1080, height: 1920, accent: "#2B2B2B", beats }));
  const r = spawnSync("node", ["scripts/local-audit.cjs", "--canvas-only", "--video", video, "--manifest", mf], { encoding: "utf8" });
  const line = (id) => String(r.stdout).split("\n").find((l) => l.includes(` ${id} —`)) || "";
  return { zones: line("zones-no-overlap"), pop: line("pop-transitions"), all: r.stdout };
}
const pass = (l) => /\[canvas\] PASS/.test(l);
const fail = (l) => /\[canvas\] FAIL/.test(l);

describe("zones-no-overlap against each beat's ground", { skip: !have && "ffmpeg not on PATH" }, () => {
  let whiteOk, darkOk, whiteCross, darkCross;
  before(() => {
    whiteOk = audit(segment("w-ok", WHITE, [box(220, 700, 640, 600, "black")], 3), [beat(0, 0, 3, null)]);
    darkOk = audit(segment("d-ok", DARK, [box(220, 700, 640, 600, "white")], 3), [beat(0, 0, 3, "#0E0E10")]);
    whiteCross = audit(segment("w-x", WHITE, [box(220, 500, 640, 1000, "black")], 3), [beat(0, 0, 3, null)]);
    darkCross = audit(segment("d-x", DARK, [box(220, 500, 640, 1000, "white")], 3), [beat(0, 0, 3, "#0E0E10")]);
  });
  it("white ground, content inside the middle zone: PASS (unchanged)", () => assert.ok(pass(whiteOk.zones), whiteOk.zones));
  it("dark ground, the same content drawn light: PASS (was FAIL: every pixel was ink)", () => assert.ok(pass(darkOk.zones), darkOk.zones));
  it("white ground, content crossing a zone edge: FAIL", () => assert.ok(fail(whiteCross.zones), whiteCross.zones));
  it("dark ground, the same crossing content: FAIL — the check is correct, not permissive", () => assert.ok(fail(darkCross.zones), darkCross.zones));
  it("the dark beat matches the same composition drawn on white, both ways", () => {
    assert.equal(pass(darkOk.zones), pass(whiteOk.zones));
    assert.equal(fail(darkCross.zones), fail(whiteCross.zones));
  });
});

describe("pop-transitions against each beat's ground", { skip: !have && "ffmpeg not on PATH" }, () => {
  const lead = () => segment("lead", WHITE, [box(220, 700, 640, 600, "black")], 0.9);
  it("a dark beat that has content from its first frame: PASS", () => {
    const v = concat("p-dark-ok", [lead(), segment("dark-c", DARK, [box(220, 700, 640, 600, "white")], 2)]);
    const r = audit(v, [beat(0, 0, 0.9, null), beat(1, 0.9, 2, "#0E0E10")]);
    assert.ok(pass(r.pop), r.pop);
  });
  it("an EMPTY dark beat: FAIL (it used to pass — every dark pixel counted as ink)", () => {
    const v = concat("p-dark-empty", [lead(), segment("dark-e", DARK, [], 2)]);
    const r = audit(v, [beat(0, 0, 0.9, null), beat(1, 0.9, 2, "#0E0E10")]);
    assert.ok(fail(r.pop), r.pop);
  });
  it("an EMPTY white beat still FAILs (unchanged)", () => {
    const v = concat("p-white-empty", [lead(), segment("white-e", WHITE, [], 2)]);
    const r = audit(v, [beat(0, 0, 0.9, null), beat(1, 0.9, 2, null)]);
    assert.ok(fail(r.pop), r.pop);
  });
});
