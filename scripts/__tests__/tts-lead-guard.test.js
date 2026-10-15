// tts-lead-guard: speech BEFORE the script's first word is not narration; the helper cuts it and re-aligns (src/utils/tts_gemini.py lead_cut).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const run = (expr) => {
  const r = spawnSync("python", ["-c", `import sys; sys.path.insert(0, "src/utils"); import tts_gemini as t; print(${expr})`], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};

test("the real ch-26 case: first word at 20.07 s -> the first 19.82 s are cut", () => {
  assert.equal(run("round(t.lead_cut(20.07), 2)"), "19.82");
});

test("a normal lead-in (first word within 2 s) is left alone", () => {
  assert.equal(run("t.lead_cut(0.3)"), "None");
  assert.equal(run("t.lead_cut(2.0)"), "None");
  assert.equal(run("t.lead_cut(None)"), "None");
});

test("TTS_LEAD_MAX=0 turns it off", () => {
  assert.equal(run("t.lead_cut(20.0, 0)"), "None");
});

test("the guard is wired into the helper's main path, right after the first alignment, and warns", () => {
  const src = readFileSync("src/utils/tts_gemini.py", "utf8").replace(/\r\n/g, "\n");
  const at = src.indexOf("words, matched, total = align(a.mp3, text)");
  assert.ok(at > 0);
  assert.ok(src.slice(at, at + 200).includes("cut = lead_cut("), "lead_cut is not called straight after the first align");
  assert.ok(src.includes("WARNING the audio had"));
  assert.ok(src.includes("os.replace(trimmed, a.mp3)"));
});
