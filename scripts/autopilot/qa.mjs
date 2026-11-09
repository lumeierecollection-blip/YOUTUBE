/** Technical, editorial and acceptance gates, plus the proof package. Any failure blocks upload. */
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { ROOT, askVision, durationOf, ffprobeJson, log, must, readJson, run, sha256File } from "./lib.mjs";

const require = createRequire(join(ROOT, "package.json"));
const sharp = require("sharp");

// video-qa.js requires scale/pan on 80% of image layers. The VOX rule forbids exactly that, so this one
// check cannot apply to Hidden Past; vox-gate's corner-block stability test is its stricter replacement.
const SUPERSEDED_FOR_VOX = new Set(["motion-keyframes"]);

export function technicalChecks(mp4) {
  const probe = ffprobeJson(mp4);
  const v = probe.streams.find((s) => s.codec_type === "video"), a = probe.streams.find((s) => s.codec_type === "audio");
  const [n, d] = String(v?.r_frame_rate || "0/1").split("/").map(Number);
  const duration = durationOf(mp4);
  const stderrOf = (args) => run("bash", ["-c", `ffmpeg -hide_banner -nostats ${args} -f null - 2>&1`], { capture: true }).stdout;
  const black = (stderrOf(`-i "${mp4}" -vf blackdetect=d=0.2:pix_th=0.02 -an`).match(/black_start/g) || []).length;
  const freeze = (stderrOf(`-i "${mp4}" -vf freezedetect=n=0.0005:d=4 -an`).match(/freeze_start/g) || []).length;
  const vol = stderrOf(`-i "${mp4}" -af volumedetect -vn`);
  const mean = Number((vol.match(/mean_volume: (-?[\d.]+)/) || [])[1]);
  const corrupt = run("bash", ["-c", `ffmpeg -v error -i "${mp4}" -f null - 2>&1 | wc -l`], { capture: true }).stdout.trim();
  const checks = {
    duration_le_30: duration <= 30, resolution: v?.width === 1080 && v?.height === 1920, fps_30: d ? n / d === 30 : false,
    h264: v?.codec_name === "h264", aac: a?.codec_name === "aac", audible: Number.isFinite(mean) && mean > -35, no_black: black === 0, no_freeze: freeze === 0, no_decode_errors: corrupt === "0",
  };
  return { pass: Object.values(checks).every(Boolean), checks, duration, mean_volume_db: mean, black, freeze };
}

export function runVideoQa({ mp4, timelinePath, dir, treatment }) {
  const out = join(dir, "video-qa.json");
  run("node", ["scripts/editor/video-qa.js", "--video", mp4, "--timeline", timelinePath, "--out", out, "--contact", join(dir, "contact-sheet.jpg"), "--frames", join(dir, "qa-frames")]);
  const q = readJson(out);
  const superseded = treatment === "vox" ? q.failures.filter((f) => SUPERSEDED_FOR_VOX.has(f.check)) : [];
  const blocking = q.failures.filter((f) => !superseded.includes(f));
  return { pass: blocking.length === 0, blocking, superseded, report: q };
}

/** A model reviews real frames. If no model can answer, the video is held rather than passed. */
export async function frameReview({ mp4, dir, channelName, treatment, duration }) {
  const framesDir = join(dir, "review-frames"); rmSync(framesDir, { recursive: true, force: true }); mkdirSync(framesDir, { recursive: true });
  const count = 15, step = duration / count, tiles = [];
  for (let i = 0; i < count; i++) {
    const f = join(framesDir, `f${String(i).padStart(2, "0")}.jpg`);
    must("frame-review", "ffmpeg", ["-y", "-v", "error", "-ss", (step * i + step / 2).toFixed(3), "-i", mp4, "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "3", f]);
    tiles.push(f);
  }
  const sheet = join(dir, "full-contact-sheet.jpg");
  must("frame-review", "ffmpeg", ["-y", "-v", "error", "-framerate", "1", "-i", join(framesDir, "f%02d.jpg"), "-vf", "tile=5x3", "-frames:v", "1", "-q:v", "3", sheet]);
  const style = treatment === "vox" ? "Historical editorial look: desaturated photos, printed texture, gold accent. Photos must look real, not AI-generated."
    : "Motion graphics about AI: text, diagrams, panels, screenshots.";
  const verdict = await askVision(`These are 15 frames in order from the finished Short for "${channelName}", left to right, top to bottom. ${style}
Captions in the lower part of the frame are expected. A frame mid-transition can look partial; report only problems that persist.
Reply JSON {"clipped_text":["frame: what"],"overlapping_text":["frame: what"],"blank_or_corrupt":["frame"],"unrelated_or_broken_images":["frame: what"],"overall":"one sentence"}.`, readFileSync(sheet), "autopilot-frame-review");
  if (!verdict) return { pass: false, why: "no vision model answered; held rather than passed" };
  const problems = ["clipped_text", "overlapping_text", "blank_or_corrupt", "unrelated_or_broken_images"].flatMap((k) => (verdict[k] || []).map((x) => `${k}: ${x}`));
  return { pass: problems.length === 0, problems, verdict, sheet };
}

export function acceptance({ channel, topic, script, narration, mp4, timelinePath, manifestPath, dir, productionId }) {
  const out = join(dir, "acceptance.json");
  const hash = (p) => sha256File(join(ROOT, p));
  const phrase = topic.slug.split("-").slice(0, 3).join(" ");
  const r = run("node", ["scripts/acceptance/final-acceptance.mjs", "--channel", channel.id, "--channel-id-field", `ch-${channel.id.padStart(2, "0")}`, "--topic", topic.slug, "--topic-slug", topic.slug, "--production-id", productionId,
    "--script-path", script.scriptRel, "--script-hash", hash(script.scriptRel), "--narration-hash", hash(narration.mp3), "--video", mp4, "--timeline", timelinePath, "--visual-manifest", manifestPath, "--out", out,
    "--topic-phrase", phrase, "--skill-set", channel.acceptance_skills], { capture: true });
  const report = readJson(out, { accepted: false, failures: [{ check: "acceptance", why: `exit ${r.status}` }] });
  return { pass: report.accepted === true, report };
}

async function tile(file, w, h, label) {
  const img = await sharp(file).resize(w, h, { fit: "contain", background: "#111" }).toBuffer();
  const svg = Buffer.from(`<svg width="${w}" height="56"><rect width="${w}" height="56" fill="#111"/><text x="${w / 2}" y="38" font-family="sans-serif" font-size="26" fill="#eee" text-anchor="middle">${label}</text></svg>`);
  return sharp({ create: { width: w, height: h + 56, channels: 3, background: "#111" } }).composite([{ input: svg, top: 0, left: 0 }, { input: img, top: 56, left: 0 }]).jpeg().toBuffer();
}

/** Real frames only: the source image beside what it became in the MP4, then an annotation, chapter and map. */
async function comparison(report, outDir) {
  const tiles = [];
  const photo = report.scenes.find((s) => s.treatments.some((t) => t.type === "annotation")) || report.scenes.find((s) => s.source_file);
  const W = 400, H = 711;
  if (photo?.source_file) tiles.push(await tile(join(ROOT, photo.source_file), W, H, "1. Source image"));
  const treated = report.scenes.find((s) => s.photo);
  if (photo) tiles.push(await tile(photo.frame_file, W, H, "2. Final VOX frame"));
  if (photo?.treatments.some((t) => t.type === "annotation")) tiles.push(await tile(photo.annotation_frame || photo.frame_file, W, H, "3. Annotation"));
  const ch = report.scenes.find((s) => s.chapter_frame);
  if (ch) tiles.push(await tile(ch.chapter_frame, W, H, "4. Chapter opener"));
  const map = report.scenes.find((s) => s.map_frame);
  if (map) tiles.push(await tile(map.map_frame, W, H, "5. Animated map"));
  const outFile = join(outDir, "vox-comparison.jpg");
  await sharp({ create: { width: W * tiles.length, height: H + 56, channels: 3, background: "#111" } }).composite(tiles.map((input, i) => ({ input, left: W * i, top: 0 }))).jpeg({ quality: 88 }).toFile(outFile);
  return { outFile, used_treated: Boolean(treated) };
}

function reviewMarkdown(report, plan, attributions, frame) {
  const pct = (a, b) => (b ? `${Math.round((1 - a / b) * 100)}%` : "n/a");
  const rows = report.scenes.map((s) => {
    const m = s.measured;
    const t = s.treatments.map((x) => x.type.replaceAll("_", " ")).join(", ");
    const measured = s.photo ? `stable across ${m.stability.frames_compared} frames (${m.stability.blocks_used} blocks); saturation ${m.grade.source}→${m.grade.treated}; corners vs tone curve ${m.vignette.measurable ? m.vignette.ratio : "not measurable"}; dot-screen peak ${m.halftone.source.peak_over_median}→${m.halftone.treated.peak_over_median}; fine detail ${m.grain.source}→${m.grain.treated}` : (m.map_route ? `route accent pixels ${m.map_route.accent_pixels_start}→${m.map_route.end}` : "");
    return `| ${s.scene} | ${Number(s.start_s).toFixed(1)}-${Number(s.end_s).toFixed(1)}s | ${t} | ${measured} | ${(s.exceptions || []).map((e) => `${e.treatment}: ${e.reason}`).join("; ") || "none"} |`;
  });
  return `# VOX visual review

Production: \`${report.production_id}\`
MP4 SHA-256: \`${report.mp4_sha256}\`
Result: **${report.pass ? "PASS" : "FAIL"}**
Accent colour: \`${report.accent}\`
Recipe: \`${report.recipe_source}\`, halftone opacity ${plan.halftone_opacity}

Frame review verdict: ${frame?.verdict?.overall || frame?.why || "n/a"}

| Scene | Time | Applied | Measured in the MP4 | Exceptions |
|---|---|---|---|---|
${rows.join("\n")}

Failures: ${report.failures.length ? report.failures.map((f) => `scene ${f.scene} ${f.check}: ${f.why}`).join("; ") : "none"}

## Sources
${attributions.map((a) => `- ${a}`).join("\n")}
`;
}

/** Copies everything the owner needs next to the MP4. Hidden Past also gets the VOX package. */
export async function proofPackage({ channel, dir, mp4, voxReport, frame, video, attributions, manifestPath, title }) {
  const out = join(ROOT, "output", "autopilot", channel.key);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  copyFileSync(mp4, join(out, "final.mp4"));
  writeFileSync(join(out, "SHA256.txt"), `${sha256File(mp4)}  final.mp4\n`);
  for (const f of ["full-contact-sheet.jpg", "contact-sheet.jpg", "video-qa.json", "acceptance.json", "visual-plan.json", "candidates.json", "selected-topic.json", "qa-summary.json"]) if (existsSync(join(dir, f))) copyFileSync(join(dir, f), join(out, f));
  copyFileSync(manifestPath, join(out, "asset-manifest.json"));
  const prov = join(ROOT, "data/editor/assets", channel.id);
  if (channel.treatment === "vox" && voxReport) {
    const voxOut = join(ROOT, "output/github-final-production/hidden-past");
    mkdirSync(voxOut, { recursive: true });
    const framesOut = join(voxOut, "frames");
    if (existsSync(join(dir, "vox-frames"))) { rmSync(framesOut, { recursive: true, force: true }); cpSync(join(dir, "vox-frames"), framesOut, { recursive: true }); }
    const plan = readJson(join(dir, "vox-plan.json"));
    const planByScene = new Map(plan.scenes.map((s) => [s.scene, s]));
    const enriched = { ...voxReport, scenes: voxReport.scenes.map((s) => ({ ...s, source_file: planByScene.get(s.scene)?.photo?.source_file, frame_file: join(framesOut, s.frame_file.split(/[\\/]/).pop()), chapter_frame: s.chapter_frame ? join(framesOut, s.chapter_frame.split(/[\\/]/).pop()) : undefined, map_frame: s.map_frame ? join(framesOut, s.map_frame.split(/[\\/]/).pop()) : undefined })) };
    const cmp = await comparison(enriched, voxOut);
    writeFileSync(join(voxOut, "VOX-VISUAL-REVIEW.md"), reviewMarkdown(voxReport, plan, attributions || [], frame));
    copyFileSync(join(dir, "vox-frames", "vox-compliance-report.json"), join(voxOut, "vox-compliance-report.json"));
    copyFileSync(mp4, join(voxOut, "final.mp4"));
    copyFileSync(join(out, "SHA256.txt"), join(voxOut, "SHA256.txt"));
    for (const f of ["full-contact-sheet.jpg", "qa-summary.json", "acceptance.json"]) if (existsSync(join(dir, f))) copyFileSync(join(dir, f), join(voxOut, f));
    copyFileSync(manifestPath, join(voxOut, "asset-manifest.json"));
    for (const f of ["provenance-manifest.json", "ATTRIBUTIONS.md"]) if (existsSync(join(prov, f))) copyFileSync(join(prov, f), join(voxOut, f));
    log("proof", `comparison: ${cmp.outFile}`);
  }
  writeFileSync(join(out, "README.txt"), `${title}\nSHA-256: ${sha256File(mp4)}\nDuration: ${video.duration}s\n`);
  return out;
}

export const parentOf = dirname;
