// Regression guard for the emptiness-shield removal (A1 sweep clause #3 + bible EDT-02/EDT-03).
//
// Two halves, and the split matters:
//
//   1. DETERMINISTIC, tested here: a caption-only beat must FAIL the fallback detector, and a
//      composed beat must PASS it. This is the real assertion — it is the axis V1 is built on
//      and it is the condition the deleted clause protected by name.
//   2. PROMPT CONTENT, also tested here: the reviewer prompt and the two bible rules must no
//      longer carry an unbounded permission to call an empty frame intentional.
//
// What is NOT tested here, and cannot be without a live model call: that the MODEL now
// reports a bare frame as a fallback. That is verified by running the A1 fixture pair through
// the reviewer (data/audit/a1-discrimination/), not by a unit test. Asserting it here would
// mean either mocking the model, which tests nothing, or spending a call per run.
//
// Run: node scripts/test-fallback-detector.mjs
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

let failed = 0;
const ok = (cond, label, detail = "") => {
  if (cond) console.log(`ok   ${label}`);
  else { failed++; console.log(`FAIL ${label}${detail ? " — " + detail : ""}`); }
};

const FIX = "data/audit/a1-discrimination/fixtures-multibeat/clip-fallback-beat-0.png";
const COMPOSED = "data/audit/a1-discrimination/fixtures-multibeat/clip-designed-beat-1.png";

// ── 1. the deterministic detector ───────────────────────────────────────────
// Run local-audit.cjs against a single beat by giving it the fixture frames as a one-beat
// clip. Built on demand so this test does not depend on build-fixtures having been run.
if (!existsSync(FIX) || !existsSync(COMPOSED)) {
  execFileSync("node", ["data/audit/a1-discrimination/build-fixtures-multibeat.mjs"], { stdio: "pipe" });
}

const WORK = "data/audit/a1-discrimination/work-test-detector";
mkdirSync(WORK, { recursive: true });

const mkClip = (png, name) => {
  execFileSync("ffmpeg", ["-loop", "1", "-i", png, "-t", "2", "-r", "30", "-pix_fmt", "yuv420p",
    "-vf", "scale=1080:1920", "-c:v", "libx264", "-preset", "veryfast", "-y", `${WORK}/${name}.mp4`], { stdio: "pipe" });
  const beat = { index: 0, start_sec: 0, duration_sec: 2, visual_type: "TYPE",
    canvas: { composition: "TYPE-FULL", dark: false, boxes: {}, name_card: null } };
  writeFileSync(`${WORK}/${name}-manifest.json`, JSON.stringify({ video: `${name}.mp4`, fps: 30, width: 1080, height: 1920, duration_sec: 2, beats: [beat] }, null, 2));
  writeFileSync(`${WORK}/${name}.srt`, "1\n00:00:00,000 --> 00:00:02,000\nOver forty percent of borrowers clear high-interest debt first.\n");
  writeFileSync(`${WORK}/${name}-script.json`, JSON.stringify({ channel: "1", beats: [{ index: 0, narration: "x" }] }, null, 2));
  return name;
};

const auditOne = (name) => {
  execFileSync("ffmpeg", ["-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", "2", "-y", `${WORK}/silence.wav`], { stdio: "pipe" });
  try {
    execFileSync("node", ["scripts/local-audit.cjs", "--video", `${WORK}/${name}.mp4`, "--manifest", `${WORK}/${name}-manifest.json`,
      "--plan", `${WORK}/${name}-script.json`, "--srt", `${WORK}/${name}.srt`, "--audio", `${WORK}/silence.wav`,
      "--out", `${WORK}/${name}-audit.json`], { stdio: "pipe" });
  } catch { /* non-zero is expected and fine; the report is what we read */ }
  const report = JSON.parse(readFileSync(`${WORK}/${name}-audit.json`, "utf8"));
  return new Map((report.checks || []).map((c) => [c.id, c]));
};

const fbChecks = auditOne(mkClip(FIX, "fallback"));
const coChecks = auditOne(mkClip(COMPOSED, "composed"));
const mz = (m) => (m.get("middle-zone-filled") || {});
const cg = (m) => (m.get("canvas-ground") || {});

console.log("deterministic fallback detector");
ok(mz(fbChecks).pass === false, "a caption-only beat FAILS middle-zone-filled",
  `got pass=${mz(fbChecks).pass} detail=${JSON.stringify(mz(fbChecks).detail)}`);
ok(/middle zone is 0%/.test(String(mz(fbChecks).detail || "")), "…and names the empty middle explicitly",
  JSON.stringify(mz(fbChecks).detail));
ok(mz(coChecks).pass === true, "a composed beat PASSES middle-zone-filled",
  `got pass=${mz(coChecks).pass} detail=${JSON.stringify(mz(coChecks).detail)}`);
ok(cg(fbChecks).pass === true, "…and the caption-only beat still passes canvas-ground (the two checks are independent)");
ok(cg(coChecks).pass === true, "…and the composed beat passes canvas-ground");

// ── 2. the shields must stay deleted ────────────────────────────────────────
// The A1b neutralizer keeps regex patterns that literally contain the removed ground
// clauses, so a whole-file grep matches the probe rather than the rubric. Blank ONLY that
// array literal — the STYLE prompt block sits after it, so truncating there would delete the
// very text under test.
console.log("\nshield clauses");
const reviewerAll = readFileSync("scripts/gemini-frame-review.js", "utf8");
const probeStart = reviewerAll.indexOf("const GROUND_CLAUSES = [");
const probeEnd = reviewerAll.indexOf("];", probeStart);
if (probeStart < 0 || probeEnd < 0) throw new Error("GROUND_CLAUSES probe array not found — the guard below would silently pass");
const reviewer = reviewerAll.slice(0, probeStart) + "/* A1b probe array elided */" + reviewerAll.slice(probeEnd);
ok(reviewer.includes("=== THE STYLE"), "reviewer source still contains the STYLE prompt block");
const bible = JSON.parse(readFileSync("config/visual-bible.json", "utf8"));

ok(!/do not call a beat 'empty', 'unbalanced' or 'off-centre'/.test(reviewer),
  "reviewer no longer forbids calling a beat empty/unbalanced/off-centre");
ok(!/EMPTY SPACE IS INTENTIONAL: do not call/.test(reviewer),
  "…and the EMPTY SPACE preamble no longer wraps that prohibition");
// The prohibition must not appear even quoted into a sentence explaining its removal: a model
// pattern-matches phrasing, not framing. Assert the replacement keeps its history in a
// comment rather than in the prompt string.
const styleStart = reviewer.indexOf("=== THE STYLE");
const styleEnd = reviewer.indexOf("=== FRAMES UNDER REVIEW ===");
ok(styleStart > 0 && styleEnd > styleStart, "the STYLE prompt block is locatable");
const styleText = reviewer.slice(styleStart, styleEnd);
ok(!/unbalanced|off-centre/.test(styleText),
  "…and the prompt text contains neither term, even inside a restatement",
  styleText.match(/.{0,60}(unbalanced|off-centre).{0,60}/)?.[0]);
ok(/ASYMMETRY IS NOT EMPTINESS/.test(styleText), "…and is replaced by an explicit boundary");
ok(/middle-zone-filled/.test(styleText) || /HEADLINE TEST/.test(styleText),
  "…which routes a bare frame to the tests that catch it");

ok(/BOUNDARY/.test(bible.rules["EDT-02"].description), "EDT-02 carries a boundary");
ok(/BOUNDARY/.test(bible.rules["EDT-03"].description), "EDT-03 carries a boundary");
ok(/SPARSE frame, never a BARE one/.test(bible.rules["EDT-02"].description),
  "EDT-02 separates a sparse frame from a bare one");
ok(/FAILS this rule rather than satisfying it/.test(bible.rules["EDT-03"].description),
  "EDT-03 makes an empty middle fail rather than pass");

// The ground shields from 1ef8b0e must still be gone — this test is the guard for all of them.
ok(!/one solid white on every beat/.test(reviewer), "ground mandate still absent");
ok(!/Not noise in this style: the plain uniform white ground/.test(reviewer), "test-12 ground exemption still absent");

console.log(failed ? `\n${failed} FAILED` : "\nall pass");
process.exit(failed ? 1 : 0);