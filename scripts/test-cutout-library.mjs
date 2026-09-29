// node scripts/test-cutout-library.mjs [--rembg] — the cutout library's validation (scripts/cutout_lib.py) and the builder's pure parts.
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
eq("41 specs (the brief lists 41 names)", specs.length, 41);
eq("every spec has 3 queries and keywords", specs.filter((s) => s.queries.length !== 3 || !s.words.length).map((s) => s.name), []);
eq("names are unique kebab-case", specs.filter((s, i) => !/^[a-z]+(-[a-z]+)*$/.test(s.name) || specs.findIndex((x) => x.name === s.name) !== i).map((s) => s.name), []);
eq("every query is a plain object name (no stock-photo phrasing)", specs.flatMap((s) => s.queries.filter((q) => /isolated|white background|cut ?out|\bpng\b|studio/i.test(q)).map(() => s.name)), []);
const BRIEF = "dollar-bill dollar-sign coin-stack wallet bank-statement credit-card person-silhouette person-walking business-person group-people scientist worker courthouse government-building bank-building factory office-tower city-skyline contract stamp-approved gavel scales evidence-tag upward-arrow downward-arrow warning-triangle checkmark broken-chain handshake clock-face calendar hourglass magnifying-glass padlock key shield crosshair radar globe map-pin flag-america".split(" ");
eq("exactly the brief's names", specs.map((s) => s.name), BRIEF);

// The builder's pure parts (no network).
const lib = await import("./cutout-library-lib.mjs");
const spec = specs.find((s) => s.name === "dollar-bill");
const cand = (o) => ({ downloadUrl: "u" + Math.random(), sourceApi: "pexels", license: "PEXELS", width: 3000, height: 2000, sourceText: { alt: "" }, title: "", ...o });
eq("a keyword match passes", lib.judgeCandidate(cand({ title: "One hundred dollar bill on a table" }), spec).ok, true);
eq("a vector / icon is not a photograph", lib.judgeCandidate(cand({ title: "dollar bill vector illustration" }), spec).ok, false);
eq("a licence off the allowlist is refused", lib.judgeCandidate(cand({ license: "CC-BY-SA", title: "dollar bill" }), spec).ok, false);
eq("no keyword in the source's words is refused", lib.judgeCandidate(cand({ title: "mountain lake at sunrise" }), spec).ok, false);
eq("a wordless candidate is allowed but ranked last", [lib.judgeCandidate(cand({}), spec).ok, lib.judgeCandidate(cand({}), spec).rank], [true, 2]);
eq("too small is refused", lib.judgeCandidate(cand({ title: "dollar bill", width: 600, height: 400 }), spec).ok, false);
eq("unsafe words are refused", lib.judgeCandidate(cand({ title: "nude dollar bill" }), spec).ok, false);
const sl = lib.shortlist([cand({ downloadUrl: "a", title: "cash", width: 1000, height: 900 }), cand({ downloadUrl: "b", title: "", width: 5000, height: 4000 }), cand({ downloadUrl: "c", title: "dollar bill", width: 2000, height: 1500 }), cand({ downloadUrl: "c", title: "dollar bill" })], spec, { query: "dollar bill" });
eq("shortlist: keyword matches first (larger first), the wordless last, no duplicates", sl.map((c) => c.downloadUrl), ["c", "a", "b"]);
// The looser keyword filter: case, plurals and prefixes do not matter; only NO shared word rejects.
const court = specs.find((x) => x.name === "courthouse");
eq("'A courthouse in Ohio' matches the query 'courthouse'", lib.judgeCandidate(cand({ title: "A Courthouse in Ohio" }), court, { query: "courthouse" }).ok, true);
eq("'Courthouses of Texas' (plural) matches", lib.judgeCandidate(cand({ title: "Courthouses of Texas" }), court, { query: "courthouse" }).ok, true);
eq("a description that shares a word matches", lib.judgeCandidate(cand({ title: "IMG_2041.jpg", sourceText: { description: "The old county court building" } }), court, { query: "court building" }).ok, true);
eq("no shared word is still rejected", lib.judgeCandidate(cand({ title: "Sunset over the harbour" }), court, { query: "courthouse" }).ok, false);
eq("words(): folds case and plurals, drops stop words", lib.words("The Coins, stacked"), ["coin", "stacked"]);

// 429 is a wait, not a quit.
const bo = async (errors) => {
  const state = {}, logs = [], sleeps = [];
  let i = 0;
  const fn = async () => { const e = errors[i++]; if (e) throw new Error(e); return "ok"; };
  let out, err = null;
  try { out = await lib.withBackoff(state, "wikimedia", fn, { sleep: async (ms) => sleeps.push(ms / 1000), log: (m) => logs.push(m) }); } catch (e) { err = e.message; }
  return { out, err, sleeps, logs, dead: [...(state.dead || [])], calls: i };
};
let r = await bo(["HTTP 429 Too Many Requests"]);
eq("one 429: waits 30 s, retries, succeeds", [r.out, r.sleeps, r.logs, r.dead], ["ok", [30], ["[cutouts] wikimedia: 429, waiting 30s"], []]);
r = await bo(["HTTP 429 x", "HTTP 429 x"]);
eq("two 429s: waits 30 s then 60 s, then succeeds", [r.out, r.sleeps, r.calls], ["ok", [30, 60], 3]);
r = await bo(["HTTP 429 x", "HTTP 429 x", "HTTP 429 x"]);
eq("three consecutive 429s: stops asking the source and says so", [r.out, r.dead, r.logs.at(-1)], [undefined, ["wikimedia"], "[cutouts] wikimedia: rate-limited, disabling for this run"]);
r = await bo(["HTTP 403 Forbidden"]);
eq("403 is a block: disabled at once, no waiting", [r.sleeps, r.dead, r.calls], [[], ["wikimedia"], 1]);
r = await bo(["HTTP 500 boom"]);
eq("another error is not retried or disabling", [r.sleeps, r.dead, r.err], [[], [], "HTTP 500 boom"]);
{
  const state = {}, sleeps = [];
  const seq = ["HTTP 429 x", null, "HTTP 429 x", null, "HTTP 429 x", null];
  let k = 0;
  const fn = async () => { const e = seq[k++]; if (e) throw new Error(e); return "ok"; };
  const vals = [];
  for (let n = 0; n < 3; n++) vals.push(await lib.withBackoff(state, "openverse", fn, { sleep: async (ms) => sleeps.push(ms / 1000), log: () => {} }));
  eq("a success resets the streak (429s that are not consecutive never disable)", [vals, sleeps, [...(state.dead || [])]], [["ok", "ok", "ok"], [30, 30, 30], []]);
}

let idx = { cutouts: [], missing: [] };
idx = lib.upsert(idx, { name: "gavel", source: "pexels", license: "PEXELS", attribution: "Photo by A | B", source_url: "https://x", query: "q" });
idx = lib.markMissing(idx, "radar", ["a", "b"]);
eq("credits table escapes pipes and lists the row", /\| gavel \| pexels \| PEXELS \| Photo by A \\\| B \|/.test(lib.creditsMarkdown(idx)), true);
eq("missing file names what was tried", lib.missingMarkdown(idx).includes("## radar") && lib.missingMarkdown(idx).includes("- a"), true);
eq("a cutout that is fetched later leaves the missing list", lib.upsert(idx, { name: "radar" }).missing.length, 0);

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
  // The whole builder offline (--from-dir): a supplied photograph is isolated, checked, credited; a rejected or unlicensed one goes to MISSING.md.
  const w = mkdtempSync(join(tmpdir(), "cutout-build-"));
  const fx = join(ROOT, "src/skills/remotion-render/public/b-roll/ch-fixture");
  const put = (name, photo, meta) => { spawnSync("mkdir", ["-p", join(w, "in")]); spawnSync("cp", [join(fx, photo), join(w, "in", `${name}.jpg`)]); writeFileSync(join(w, "in", `${name}.json`), JSON.stringify(meta)); };
  put("gavel", "springtail-macro.jpg", { license: "CC0", attribution: "repo fixture", source_url: "https://example.invalid/f" });
  put("padlock", "water-scorpion.jpg", { license: "CC0" });
  put("globe", "flashlight-beam.jpg", { license: "all rights reserved" });
  const b = spawnSync("node", [join(ROOT, "scripts", "build-cutout-library.mjs"), "--from-dir", join(w, "in"), "--only", "gavel,padlock,globe"], { encoding: "utf8", env: { ...process.env, CUTOUT_PYTHON: PY, CUTOUT_OUT_DIR: join(w, "out"), CUTOUT_LOG: join(w, "log.jsonl") } });
  const ix = existsSync(join(w, "out", "index.json")) ? JSON.parse(readFileSync(join(w, "out", "index.json"), "utf8")) : { cutouts: [], missing: [] };
  eq("builder --from-dir: the usable photograph became a PNG with alpha, credited", [ix.cutouts.map((c) => c.name), existsSync(join(w, "out", "gavel.png"))], [["gavel"], true]);
  eq("builder --from-dir: a photo the checks reject and an unlicensed one are MISSING, never drawn", ix.missing.map((m) => m.name).sort(), ["globe", "padlock"]);
  eq("builder --from-dir: no file for a missing cutout", [existsSync(join(w, "out", "padlock.png")), existsSync(join(w, "out", "globe.png"))], [false, false]);
  const alpha = spawnSync(PY, ["-c", `from PIL import Image; import numpy as np; a=np.asarray(Image.open(r"${join(w, "out", "gavel.png")}").convert("RGBA"))[:,:,3]; print(round(float((a<128).mean()),3))`], { encoding: "utf8" });
  eq("builder --from-dir: the PNG has a real transparent area", Number(alpha.stdout) >= 0.12, true);
  if (b.status !== 0) console.log(b.stdout.slice(-400), b.stderr.slice(-400));
  rmSync(w, { recursive: true, force: true });
}
console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
