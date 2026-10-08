import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadReferences, crossReferenceMax, classifyStyle, layer2Advisory, CLONE_SHARE } from "../eval-layer2-wire.js";
import { normalize, scoreStyleFile } from "../eval-layer2-style.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const v = (...xs) => normalize(Float32Array.from(xs));

describe("Layer 2 is wired at the render call site", () => {
  const src = readFileSync(join(ROOT, "scripts", "eval-loop-callsite.js"), "utf8");
  const rq = readFileSync(join(ROOT, "scripts", "render-and-qa.js"), "utf8");
  it("the stub is gone and the real call is in its place", () => {
    assert.doesNotMatch(src + rq, /advisory not wired at this call site yet/);
    assert.match(rq, /import\("\.\/eval-layer2-wire\.js"\)/);
    assert.match(src, /await layer2Advisory\(cur\.outputPath\)/); // the render being judged now (the original, or a live revision)
    assert.match(rq, /recordEvalLoop\(\{[\s\S]*?layer2Advisory, judge/);
  });
  it("Layer 3 receives the advisory score and the style match", () => {
    assert.match(src, /styleMatch: l2\?\.style_match \?\? null/);
  });
  it("the workflow caches the HuggingFace weights", () => {
    const wf = readFileSync(join(ROOT, ".github", "workflows", "daily-pipeline-v2.yml"), "utf8");
    assert.match(wf, /name: Cache HuggingFace models[\s\S]*?path: ~\/\.cache\/huggingface/);
  });
});

describe("references", () => {
  it("loads the stored embeddings of the three reference videos, with the calibrated floor", async () => {
    const r = await loadReferences();
    assert.equal(r.source, "stored");
    assert.equal(r.embeddings.length, 142);
    assert.deepEqual([...new Set(r.groups)].sort(), ["ref-01", "ref-02", "ref-03"]);
    assert.ok(Math.abs(r.threshold - 0.4569791218227832) < 1e-9);
    for (const e of r.embeddings.slice(0, 5)) assert.ok(Math.abs(Math.hypot(...e) - 1) < 1e-4, "unit length");
  });
  it("the family's ceiling is measured across DIFFERENT reference videos only", () => {
    const e = [v(1, 0, 0), v(0.99, 0.01, 0), v(0.8, 0.6, 0)];
    const g = ["a", "a", "b"];
    // a-a pair (0.9999) is excluded; the ceiling is the better of the two a-b pairs
    assert.ok(Math.abs(crossReferenceMax(e, g) - 0.8) < 0.02);
  });
});

describe("clone check: style is similarity to the family, a clone is similarity to one member beyond the family", () => {
  // A family whose members are alike (cosines .90 / .85 / .77 across videos), as one style family is.
  const refs = [v(1, 0, 0), v(0.9, 0.44, 0), v(0.85, 0, 0.53)];
  const groups = ["a", "b", "c"];
  const ceiling = crossReferenceMax(refs, groups);
  const opts = { threshold: 0.45, ceiling };
  const verdict = (cands, advisory_score) => classifyStyle(cands, refs, { advisory_score, ...opts });

  it("frames identical to a reference frame are clone_suspected", () => {
    const r = verdict([v(1, 0, 0), v(1, 0, 0), v(0.9, 0.44, 0), v(0.85, 0, 0.53)], 0.99);
    assert.equal(r.style_match, "clone_suspected");
    assert.ok(r.clone_share >= CLONE_SHARE);
  });
  it("frames inside the family's own range are matched, not clones", () => {
    // each frame sits between members: similar to the family, above none of them
    const r = verdict([v(0.6, 0.6, 0.5), v(0.55, 0.45, 0.45), v(0.5, 0.6, 0.4), v(0.5, 0.4, 0.5)], 0.8);
    assert.equal(r.clone_frames, 0);
    assert.equal(r.style_match, "matched");
  });
  it("frames far from every reference are off_style", () => {
    const r = verdict([v(-1, -1, -1), v(-1, 0.1, -1), v(-0.5, -1, -1)], 0.0);
    assert.equal(r.style_match, "off_style");
  });
  it("the verdict is advisory data, not a pass/fail", () => {
    const r = verdict([v(1, 0, 0)], 0.9);
    assert.deepEqual(Object.keys(r).sort(), ["candidate_max", "clone_frames", "clone_share", "off_style_frames", "reference_ceiling", "style_match"]);
  });
});

// The real model (Xenova/clip-vit-base-patch32, ~350 MB). Skipped, loudly, only when it cannot be fetched.
describe("Layer 2 produces a number on a real video", () => {
  const refVideo = join(ROOT, "research", "motion-graphics-ref", "ref-02.mp4");
  const net = /fetch failed|ENOTFOUND|getaddrinfo|ECONNRESET|EAI_AGAIN|network/i;

  it("a reference video scores numerically, matches scoreStyleFile, and is flagged as a clone of itself", { timeout: 600000 }, async (t) => {
    let r, direct;
    try {
      const refs = await loadReferences();
      r = await layer2Advisory(refVideo, { references: refs, framesDir: mkdtempSync(join(tmpdir(), "l2-")) });
      direct = await scoreStyleFile(refVideo, { framesDir: mkdtempSync(join(tmpdir(), "l2d-")), references: refs.embeddings, threshold: refs.threshold });
    } catch (e) {
      if (net.test(`${e.message} ${e.cause?.message || ""}`)) return t.skip(`model not reachable: ${e.message}`);
      throw e;
    }
    assert.equal(typeof r.advisory_score, "number");
    assert.ok(Number.isFinite(r.advisory_score) && r.advisory_score > 0.9, `a reference frame set vs. itself: ${r.advisory_score}`);
    assert.ok(Math.abs(r.advisory_score - direct.advisory_score) < 1e-6, "same number as the module's own scoreStyleFile");
    assert.equal(r.frame_count, direct.frame_count);
    assert.equal(r.style_match, "clone_suspected");
  });

  it("a blank white video is not flagged as a clone", { timeout: 600000 }, async (t) => {
    const dir = mkdtempSync(join(tmpdir(), "l2w-"));
    const mp4 = join(dir, "white.mp4");
    const ff = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=white:s=270x480:d=6:r=10", "-pix_fmt", "yuv420p", mp4]);
    if (ff.status !== 0) return t.skip("ffmpeg not available");
    let r;
    try { r = await layer2Advisory(mp4, { framesDir: join(dir, "f") }); }
    catch (e) { if (net.test(`${e.message} ${e.cause?.message || ""}`)) return t.skip(`model not reachable: ${e.message}`); throw e; }
    assert.equal(typeof r.advisory_score, "number");
    assert.notEqual(r.style_match, "clone_suspected");
    rmSync(dir, { recursive: true, force: true });
  });
});
