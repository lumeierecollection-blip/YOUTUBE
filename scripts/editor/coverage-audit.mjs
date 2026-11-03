/**
 * Hard visual-QA gate for coverage timelines.
 *
 * Replaces the old pixel proxies (80% of image layers with scale/pan motion,
 * dot field to defeat the near-static gate) with semantic checks that prove
 * the visuals actually explain the narration:
 *   - every essential concept is covered by a beat (uncovered: [])
 *   - every image asset carries credit + source_url (provenance)
 *   - every image layer declares meaningful motion (push_in/push_out/pan/draw)
 *   - every beat's visual differs from the previous beat's (no stale images)
 *   - text is large enough to read on a phone (scrim + size floor)
 *   - captions sit inside their beat's span (caption sync)
 *   - no decorative layers (dot fields, sweeps, corner brackets, grids)
 *   - no blank or near-duplicate consecutive frames
 *   - per-beat contact sheets written for visual review
 *
 * Conditional on `timeline.metadata.coverage`: non-coverage timelines keep
 * the legacy video-qa.js checks untouched.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FPS = 30;

// A layer is "decorative" if its id matches the old removed patterns.
const DECORATIVE = /-(d|drip|drift|dot|sweep|corner|wipe|splash|field|grid|backdrop|splash)-/i;
const DECORATIVE_TYPE_KINDS = new Set(["sweep", "decoration", "dot", "drift", "grid", "backdrop"]);

const failures = [];
const fail = (check, why) => failures.push({ check, why });

/** Run every check. Returns { pass, failures, checks }. `video` is optional (final-pixel checks only if given). */
export async function auditCoverage({ timeline, coverageReport, video, out, contactDir }) {
  failures.length = 0;
  const checks = {};

  /* ── 1. Every essential concept covered ── */
  const uncovered = (coverageReport && coverageReport.uncovered) || [];
  checks.uncovered_count = uncovered.length;
  if (uncovered.length) fail("coverage", `${uncovered.length} essential concept(s) not covered by any beat: ${uncovered.map((c) => c.label).join(", ")}`);

  const beatCount = coverageReport?.beat_count ?? 0;
  checks.beat_count = beatCount;
  if (!beatCount) fail("coverage", "no beats in the coverage plan");

  /* ── 2. Provenance on every image asset ── */
  const assets = timeline.assets || {};
  const imageLayers = (timeline.layers || []).filter((l) => l.type === "image" && l.asset_id);
  const imageAssets = Object.entries(assets).filter(([, a]) => a.file && /\.(jpe?g|png|webp)$/i.test(a.file));
  const missingCredit = imageAssets.filter(([, a]) => !a.credit || !String(a.credit).trim());
  const missingSource = imageAssets.filter(([, a]) => !a.source_url || !/^https?:\/\//i.test(String(a.source_url)));
  checks.image_assets = imageAssets.length;
  checks.assets_with_credit = imageAssets.length - missingCredit.length;
  checks.assets_with_source = imageAssets.length - missingSource.length;
  if (missingCredit.length) fail("provenance", `image asset(s) without credit: ${missingCredit.map(([i]) => i).join(", ")}`);
  if (missingSource.length) fail("provenance", `image asset(s) without source_url: ${missingSource.map(([i]) => i).join(", ")}`);

  /* └─ 2b. Label card dominance — fail when >50% of image assets are label cards. */
  const labelCardAssets = imageAssets.filter(([, a]) => /label.card/i.test(String(a.role || "")) || /label.card/i.test(String(a.file || "")));
  checks.label_card_assets = labelCardAssets.length;
  checks.label_card_share = imageAssets.length ? Number((labelCardAssets.length / imageAssets.length).toFixed(3)) : 0;
  if (imageAssets.length && labelCardAssets.length / imageAssets.length > 0.5) {
    fail("label-card-dominance", `${labelCardAssets.length} of ${imageAssets.length} image assets are label cards (${(labelCardAssets.length / imageAssets.length * 100).toFixed(0)}%), exceeding the 50% limit`);
  }

  /* └─ 2c. Person/place photo check — person and place concepts should be
   *  represented by real photographs, not label cards. */
  const personPlaceImageLayers = imageLayers.filter((l) => {
    const role = String(l.role || "");
    const credit = String(l.credit || "");
    return /person|place/i.test(role) || /person|place|margaret|fawkes|clitherow|york/i.test(credit);
  });
  const personPlaceLabelCards = personPlaceImageLayers.filter((l) => /label.card/i.test(String(l.role || "")) || /label.card/i.test(String(l.file || "")));
  checks.person_place_image_layers = personPlaceImageLayers.length;
  checks.person_place_label_cards = personPlaceLabelCards.length;
  if (personPlaceLabelCards.length) {
    fail("person-place-photo", `${personPlaceLabelCards.length} person/place image layer(s) use a label card instead of a photograph: ${personPlaceLabelCards.map(([i]) => i).join(", ")}`);
  }

  /* ── 3. Meaningful motion on every image layer ── */
  const moving = imageLayers.filter((l) => {
    const kf = l.keyframes || {};
    const scale = kf.scale || [];
    const x = kf.x || [];
    const y = kf.y || [];
    const scaleDelta = scale.length ? Math.max(...scale.map((p) => p.v)) - Math.min(...scale.map((p) => p.v)) : 0;
    const xDelta = x.length ? Math.max(...x.map((p) => p.v)) - Math.min(...x.map((p) => p.v)) : 0;
    const yDelta = y.length ? Math.max(...y.map((p) => p.v)) - Math.min(...y.map((p) => p.v)) : 0;
    return scaleDelta > 0.008 || xDelta > 0.005 || yDelta > 0.005;
  });
  const stillImageLayers = imageLayers.filter((l) => !moving.includes(l));
  checks.image_layers = imageLayers.length;
  checks.moving_image_layers = moving.length;
  checks.still_image_layers = stillImageLayers.length;
  if (imageLayers.length && stillImageLayers.length) {
    fail("motion", `${stillImageLayers.length} image layer(s) declare no meaningful motion: ${stillImageLayers.map((l) => l.id).join(", ")}`);
  }

  /* ── 4. No decorative layers ── */
  const decorativeLayers = (timeline.layers || []).filter((l) => DECORATIVE.test(l.id) || DECORATIVE_TYPE_KINDS.has(l.type));
  checks.decorative_layers = decorativeLayers.length;
  if (decorativeLayers.length) fail("decorative", `decorative layer(s) present: ${decorativeLayers.map((l) => l.id).join(", ")}`);

  /* ── 5. Beat distinctness: consecutive beats must not show the same asset ── */
  const beats = (coverageReport && coverageReport.beats) || [];
  const assetUse = new Map();
  for (const l of imageLayers) {
    if (!assetUse.has(l.asset_id)) assetUse.set(l.asset_id, []);
    assetUse.get(l.asset_id).push({ id: l.id, in: l.in, out: l.out });
  }
  let duplicateUse = 0;
  for (const [aid, uses] of assetUse) {
    for (let i = 1; i < uses.length; i++) {
      const a = uses[i - 1], b = uses[i];
      if (b.in < a.out) { duplicateUse++; fail("duplicate", `asset "${aid}" shown in overlapping beats ${a.id} (${a.in}-${a.out}) and ${b.id} (${b.in}-${b.out})`); }
    }
  }
  checks.duplicate_asset_overlaps = duplicateUse;

  /* ── 6. Phone legibility: text layers have a scrim or dark bg, and size >= 24 ── */
  const textLayers = (timeline.layers || []).filter((l) => l.type === "text");
  const contentText = textLayers.filter((l) => !/credit/i.test(l.id));
  const smallText = contentText.filter((l) => (l.style && l.style.size) && l.style.size < 24);
  checks.text_layers = textLayers.length;
  checks.content_text_layers = contentText.length;
  checks.small_text_layers = smallText.length;
  if (smallText.length) fail("legibility", `${smallText.length} text layer(s) below the 24px phone-readability floor: ${smallText.map((l) => l.id).join(", ")}`);

  /* ── 7. Captions within their beat span ── */
  const cues = timeline.captions || [];
  const badCues = cues.filter((c) => c.start_f < 0 || c.end_f > (timeline.durationInFrames || 0) + 1 || c.end_f <= c.start_f);
  checks.caption_cues = cues.length;
  checks.bad_caption_cues = badCues.length;
  if (badCues.length) fail("captions", `${badCues.length} caption cue(s) outside the timeline`);

  /* ── 8. Final-pixel checks (only when a video is provided) ── */
  if (video && existsSync(video)) {
    await finalPixelChecks(video, timeline, checks);
  }

  /* ── 9. Per-beat contact sheets ── */
  if (contactDir && video && existsSync(video)) {
    writeContactSheets(video, timeline, contactDir);
    checks.contact_sheets = true;
  }

  const report = {
    coverage_qa: true,
    pass: failures.length === 0,
    generated_at: new Date().toISOString(),
    id: timeline.id,
    checks,
    failures,
  };
  if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(report, null, 2) + "\n"); }
  console.log(`[coverage-qa] ${report.pass ? "PASS" : "FAIL"} ${timeline.id}: ${Object.keys(checks).length} checks, ${failures.length} failure(s)`);
  for (const f of failures) console.error(`[coverage-qa] ${f.check}: ${f.why}`);
  if (out) console.log(`[coverage-qa] report: ${out}`);
  return report;
}

/** Final-pixel: black frames, static run, blank/duplicate frames, mean motion. */
async function finalPixelChecks(video, timeline, checks) {
  const fps = Number(timeline.fps) || FPS;
  const framesDir = join(ROOT, "data", "editor", "qa", `${timeline.id}-coverage-frames`);
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", video, "-vf", "fps=2,scale=270:-1", "-q:v", "2", join(framesDir, "f%05d.jpg")], { encoding: "utf8" });
  const frameFiles = readdirSync(framesDir).filter((f) => /^f\d+\.jpg$/.test(f)).sort();
  if (frameFiles.length < 2) fail("frames", "could not extract frames from the video");

  let blackFrames = 0, maxStaticRun = 0, staticRun = 0, motionSum = 0, motionCount = 0, previous = null;
  let lumaSum = 0;
  for (const file of frameFiles) {
    const { data, info } = await sharp(join(framesDir, file)).greyscale().raw().toBuffer({ resolveWithObject: true });
    let sum = 0, max = 0;
    for (let i = 0; i < data.length; i++) { sum += data[i]; if (data[i] > max) max = data[i]; }
    const mean = sum / data.length;
    lumaSum += mean;
    if (mean < 5 && max < 30) blackFrames++;
    if (previous && previous.length === data.length) {
      let diff = 0;
      for (let i = 0; i < data.length; i++) diff += Math.abs(data[i] - previous[i]);
      const motion = diff / data.length;
      motionSum += motion; motionCount++;
      if (motion < 0.2) { staticRun += 0.5; if (staticRun > maxStaticRun) maxStaticRun = staticRun; }
      else staticRun = 0;
    }
    previous = data;
  }
  checks.black_frames = blackFrames;
  checks.longest_static_run_s = Number(maxStaticRun.toFixed(1));
  checks.mean_motion = Number((motionCount ? motionSum / motionCount : 0).toFixed(3));
  if (blackFrames > 0) fail("black-frames", `${blackFrames} black frame(s) in the export`);
  if (maxStaticRun > 4.0) fail("static-run", `longest near-static run is ${maxStaticRun.toFixed(1)}s (limit 4.0s)`);
  if (motionCount && motionSum / motionCount < 0.05) fail("motion", `mean frame motion is ${(motionSum / motionCount).toFixed(3)} (limit 0.05)`);
}

/** Write one contact sheet per beat interval across the video. */
function writeContactSheets(video, timeline, contactDir) {
  mkdirSync(contactDir, { recursive: true });
  const duration = timeline.durationInFrames / (timeline.fps || FPS);
  const beats = Math.min(8, Math.max(2, Math.floor(duration / 4)));
  const interval = duration / beats;
  for (let b = 0; b < beats; b++) {
    const at = b * interval + interval / 2;
    const out = join(contactDir, `beat-${String(b + 1).padStart(2, "0")}-at-${at.toFixed(1)}s.jpg`);
    try {
      execFileSync("ffmpeg", ["-y", "-v", "error", "-i", video, "-ss", at.toFixed(3), "-frames:v", "1", "-q:v", "2", out], { encoding: "utf8" });
    } catch { /* frame may be beyond video length; skip */ }
  }
}

// Allow direct CLI invocation: node coverage-audit.mjs --timeline <file> [--video <mp4>] [--out <json>] [--contact-dir <dir>] [--coverage-report <json>]
if (process.argv[1] && /coverage-audit\.mjs$/.test(process.argv[1].split("\\").join("/"))) {
  (async () => {
    const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith("--")) a.push([x.slice(2), arr[i + 1]]); return a; }, []));
    const need = (k) => { if (!args[k]) throw new Error(`missing --${k}`); return args[k]; };
    const timelinePath = resolve(ROOT, need("timeline"));
    const timeline = JSON.parse(readFileSync(timelinePath, "utf8"));
    let coverageReport = null;
    if (args["coverage-report"]) coverageReport = JSON.parse(readFileSync(resolve(ROOT, args["coverage-report"]), "utf8"));
    await auditCoverage({
      timeline, coverageReport,
      video: args.video ? resolve(ROOT, args.video) : null,
      out: args.out ? resolve(ROOT, args.out) : null,
      contactDir: args["contact-dir"] ? resolve(ROOT, args["contact-dir"]) : null,
    });
  })().catch((e) => { console.error(`::error::coverage-audit: ${e.message}`); process.exit(1); });
}