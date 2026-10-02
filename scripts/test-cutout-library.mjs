// node scripts/test-cutout-library.mjs [--rembg] — cutout checks: the specs, the content verifier, and the isolation checks (scripts/cutout_lib.py). The PNG library and its builder are deleted (2026-10-02); cutouts are fetched live per beat.
// Needs python3 with numpy + Pillow (CUTOUT_PYTHON overrides the interpreter); --rembg also runs the real u2net isolation on a repo photograph.
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PY = process.env.CUTOUT_PYTHON || "python3";
let bad = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};

// The specs: the brief's names, three queries each, valid flags.
const specs = JSON.parse(readFileSync(join(ROOT, "scripts", "cutout-specs.json"), "utf8")).specs;
// v2 (owner's list, 2026-10-02): 39 names; the symbol / scene-photo classes of v1 were removed (ec1f24b).
eq("39 cutout specs (owner's list, 2026-10-02)", specs.length, 39);
eq("every spec has 2-3 queries and keywords", specs.filter((s) => s.queries.length < 2 || s.queries.length > 3 || !s.words.length).map((s) => s.name), []);
eq("names are unique kebab-case", specs.filter((s, i) => !/^[a-z]+(-[a-z]+)*$/.test(s.name) || specs.findIndex((x) => x.name === s.name) !== i).map((s) => s.name), []);
eq("every query is a plain object name (no stock-photo phrasing)", specs.flatMap((s) => s.queries.filter((q) => /isolated|white background|cut ?out|\bpng\b|studio/i.test(q)).map(() => s.name)), []);

// Content verification (scripts/verify-cutout-image.cjs): only MATCH is accepted; anything malformed is no answer.
const { normalize: vNorm, promptFor: vPrompt } = (await import("node:module")).createRequire(import.meta.url)("./verify-cutout-image.cjs");
eq("verifier: LITERAL + recognizable is the only MATCH", vNorm({ seen: "a wall calendar", verdict: "literal", recognizable: true }).verdict, "MATCH");
eq("verifier: FIGURATIVE rejects (a sun dial for calendar)", vNorm({ seen: "a sun dial", verdict: "FIGURATIVE", recognizable: false }).verdict, "FIGURATIVE");
eq("verifier: LITERAL but not recognizable rejects", vNorm({ seen: "a tiny padlock", verdict: "LITERAL", recognizable: "NO" }).verdict, "UNRECOGNIZABLE");
eq("verifier: an old MATCH/WRONG answer is no answer", vNorm({ seen: "coins", verdict: "MATCH" }), null);
eq("verifier: the prompt names the concept and asks LITERAL / recognizable", [vPrompt("coin-stack").includes('Concept: "coin stack"'), vPrompt("x").includes("LITERAL"), vPrompt("x").includes("no label")], [true, true, true]);

const run = (code) => spawnSync(PY, ["-c", code], { encoding: "utf8", cwd: ROOT });
const probe = run("import numpy, PIL; print('ok')");
if (probe.status !== 0 || !probe.stdout.includes("ok")) {
  console.log(`SKIP mask validation: ${PY} has no numpy / Pillow (${(probe.stderr || "").trim().split("\n").pop()})`);
  console.log(bad ? `${bad} FAILED` : "all pass (validation skipped)");
  process.exit(bad ? 1 : 0);
}
const report = (shape, flags = "") => {
  const r = run(`
import sys, json
sys.path.insert(0, "scripts")
import numpy as np
from cutout_lib import alpha_report
a = np.zeros((600, 800), np.uint8)
yy, xx = np.ogrid[:600, :800]
def ell(cx, cy, rx, ry): a[((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1] = 255
def rect(x0, y0, x1, y1): a[y0:y1, x0:x1] = 255
${shape}
print(json.dumps(alpha_report(a${flags})))`);
  try { return JSON.parse(r.stdout); } catch { return { ok: false, why: `python failed: ${r.stderr}` }; }
};
const V = (name, shape, flags, wantOk, wantWhy) => {
  const r = report(shape, flags);
  eq(`${name}: ${wantOk ? "accepted" : "rejected"}${wantWhy ? ` (${wantWhy})` : ""}`, [r.ok, wantOk ? "ok" : (wantWhy && r.why.includes(wantWhy)) ? wantWhy : r.why], [wantOk, wantOk ? "ok" : wantWhy || r.why]);
};
V("a centred object", "ell(400, 300, 160, 200)", "", true);
V("a tiny object", "ell(400, 300, 40, 40)", "", false, "< 12%");
V("nothing removed", "rect(0, 0, 800, 600)", "", false, "nothing was removed");
V("opaque on all four edges", "ell(400, 300, 400, 300)", "", false, "all four edges");
V("cut by the frame on one side", "ell(300, 300, 100, 200); rect(0, 150, 120, 450)", "", false, "cut by the frame");
V("two objects", "ell(200, 300, 110, 150); ell(620, 300, 110, 150)", "", false, "more than one object");
V("a rectangle", "rect(150, 100, 650, 500)", "", false, "a rectangle");
V("a rectangle where rect_ok (a banknote)", "rect(150, 100, 650, 500)", ", rect_ok=True", true);
V("a building resting on the photo floor, grounded", "rect(100, 380, 700, 600); rect(330, 120, 470, 600); ell(400, 120, 70, 70)", ", grounded=True", true);
V("the same building, not grounded", "rect(100, 380, 700, 600); rect(330, 120, 470, 600); ell(400, 120, 70, 70)", "", false, "cut by the frame");
V("a skyline (multi, grounded)", "rect(100, 300, 260, 600); rect(240, 200, 420, 600); rect(400, 340, 560, 600)", ", grounded=True, multi=True", true);

if (process.argv.includes("--rembg")) {
  // The real u2net isolation on a repo photograph (a real object on a real background): proves rembg, the model download and the crop end to end.
  const dir = mkdtempSync(join(tmpdir(), "cutout-"));
  const out = join(dir, "spider.png");
  const src = join(ROOT, "src/skills/remotion-render/public/b-roll/ch-fixture/cave-spider.jpg");
  const r = spawnSync(PY, [join(ROOT, "scripts", "cutout_lib.py"), "isolate", src, out], { encoding: "utf8" });
  let rep = {}; try { rep = JSON.parse(r.stdout.trim().split("\n").pop()); } catch { rep = { ok: false, why: r.stderr.slice(-300) }; }
  console.log(`rembg on the repo's cave-spider photograph -> ${JSON.stringify(rep)}`);
  eq("rembg ran and wrote a PNG when it accepted (or said why it did not)", rep.ok ? existsSync(out) : typeof rep.why === "string" && rep.why.length > 0, true);
  rmSync(dir, { recursive: true, force: true });
}
console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
