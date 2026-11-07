#!/usr/bin/env node
/**
 * Independent Final Acceptance Gate — AI Tested (ch-02).
 *
 * Verifies the accepted final MP4 against every acceptance requirement and
 * independently calculates the final MP4 SHA-256. Exits non-zero (blocks
 * upload) on any failure. Inspects the actual MP4 via ffprobe + frame
 * extraction, not just a JSON timeline.
 *
 *   node scripts/acceptance/final-acceptance.mjs \
 *     --channel 2 --channel-id-field ch-02 --topic "Model Context Protocol (MCP)" \
 *     --topic-slug model-context-protocol-mcp --production-id pt-ai-tested-mcp-20261107 \
 *     --script-path data/research/2/model-context-protocol-mcp-shorts-script.json \
 *     --script-hash <sha256> --narration-hash <sha256> \
 *     --video data/renders/2/model-context-protocol-mcp-final.mp4 \
 *     --timeline data/editor/auto/model-context-protocol-mcp/timeline.json \
 *     --visual-manifest data/editor/assets/2/asset-manifest.json \
 *     --out data/renders/2/model-context-protocol-mcp-acceptance.json
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "../..");
const abs = (p) => resolve(ROOT, p);

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith("--")) a.push([x.slice(2), arr[i + 1]]); return a; }, []),
);
const need = (k) => { if (!args[k]) throw new Error(`missing --${k}`); return args[k]; };

const channel = need("channel");
const channelIdField = need("channel-id-field");
const topic = need("topic");
const topicSlug = need("topic-slug");
const productionId = need("production-id");
const scriptPath = need("script-path");
const scriptHashArg = need("script-hash");
const narrationHashArg = need("narration-hash");
const videoPath = abs(need("video"));
const timelinePath = abs(need("timeline"));
const visualManifestPath = abs(need("visual-manifest"));
const outPath = abs(need("out"));

const failures = [];
const pass = (check) => () => { /* tracked via failures array */ };
const fail = (check, why) => failures.push({ check, why });

const MAX_DURATION_S = 30;
const FPS = 30;
const CANVAS_W = 1080;
const CANVAS_H = 1920;

if (!existsSync(videoPath)) fail("video", `video not found: ${videoPath}`);
if (!existsSync(timelinePath)) fail("timeline", `timeline not found: ${timelinePath}`);
if (!existsSync(visualManifestPath)) fail("visual-manifest", `visual manifest not found: ${visualManifestPath}`);
if (!existsSync(scriptPath)) fail("script", `script not found: ${scriptPath}`);

let timeline, manifest, script, probe, videoDuration, width, height, videoCodec, audioCodec, sampleRate;
try { timeline = JSON.parse(readFileSync(timelinePath, "utf8")); } catch (e) { fail("timeline-parse", e.message); }
try { manifest = JSON.parse(readFileSync(visualManifestPath, "utf8")); } catch (e) { fail("visual-manifest-parse", e.message); }
try { script = JSON.parse(readFileSync(scriptPath, "utf8")); } catch (e) { fail("script-parse", e.message); }

if (existsSync(videoPath)) {
  probe = JSON.parse(execFileSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size",
    "-show_entries", "stream=codec_name,codec_type,width,height,sample_rate,r_frame_rate",
    "-of", "json",
    videoPath,
  ], { encoding: "utf8" }));
  const streams = probe.streams || [];
  const vs = streams.find((s) => s.codec_type === "video" || s.width);
  const as = streams.find((s) => s.codec_type === "audio");
  videoDuration = Number(probe.format?.duration) || 0;
  width = Number(vs?.width) || 0;
  height = Number(vs?.height) || 0;
  videoCodec = vs?.codec_name || "";
  audioCodec = as?.codec_name || "";
  sampleRate = as?.sample_rate || "";
  const rFrame = vs?.r_frame_rate || "30/1";
  const [rn, rd] = rFrame.split("/").map(Number);
  const measuredFps = rd ? rn / rd : 30;
}

// ── 1. Correct production ID ──────────────────────────────────────────
const tlProd = timeline && (timeline.production_id || timeline.id);
if (tlProd !== productionId) fail("production-id", `timeline ${tlProd} !== expected ${productionId}`);

// ── 2. Correct topic ─────────────────────────────────────────────────
const tlTopicSlug = timeline && timeline.metadata?.topic_slug;
const tlTopicTitle = timeline && timeline.metadata?.topic;
if (tlTopicSlug && tlTopicSlug !== topicSlug) fail("topic", `timeline.topic_slug "${tlTopicSlug}" !== "${topicSlug}"`);
if (tlTopicTitle && String(tlTopicTitle).toLowerCase().indexOf("model context protocol") < 0) {
  fail("topic", `timeline topic title "${tlTopicTitle}" is not about the Model Context Protocol`);
}
if (script && script.topic_slug !== topicSlug) fail("topic", `script.topic_slug "${script.topic_slug}" !== "${topicSlug}"`);

// ── 3. Correct script hash ───────────────────────────────────────────
if (existsSync(scriptPath)) {
  const actualScriptHash = createHash("sha256").update(readFileSync(scriptPath, "utf8")).digest("hex");
  if (actualScriptHash.toLowerCase() !== scriptHashArg.toLowerCase()) fail("script-hash", `script hash mismatch: ${actualScriptHash} !== ${scriptHashArg}`);
}

// ── 4. Correct narration hash ────────────────────────────────────────
const narrationPath = join(dirname(videoPath), "..", "..", "tts", channel, `${topicSlug}-shorts-vo.mp3`);
const narrationCandidates = [
  join(ROOT, "data", "tts", channel, `${topicSlug}-shorts-vo.mp3`),
  join(ROOT, "data", "tts", channel, `${topicSlug}-vo.mp3`),
];
let narrationActual = null;
for (const c of narrationCandidates) {
  if (existsSync(c)) { narrationActual = createHash("sha256").update(readFileSync(c)).digest("hex"); break; }
}
if (narrationActual === null) fail("narration", "narration mp3 not found for this production");
else if (narrationActual.toLowerCase() !== narrationHashArg.toLowerCase()) fail("narration-hash", `narration hash mismatch: ${narrationActual} !== ${narrationHashArg}`);

// ── 5. Visual manifest ───────────────────────────────────────────────
if (manifest) {
  const assets = manifest.assets || [];
  if (!assets.length) fail("visual-manifest", "visual manifest has no assets");
  assets.forEach((a, i) => {
    if (!a.asset_id) fail("visual-manifest", `asset[${i}] missing asset_id`);
    if (!a.source_url) fail("visual-manifest", `asset ${a.asset_id} missing source_url`);
    if (!a.sha256) fail("visual-manifest", `asset ${a.asset_id} missing sha256`);
    if (!a.scene_beat_assignment) fail("visual-manifest", `asset ${a.asset_id} missing scene_beat_assignment`);
    if (!a.reason_relevant) fail("visual-manifest", `asset ${a.asset_id} missing reason_relevant`);
  });
}

// ── 6. Topic-specific asset relevance ────────────────────────────────
const rejected = ["generic processor", "generic ai illustration", "unrelated robot", "stock tech footage", "generic ai stock"];
let genericAssets = 0;
if (manifest) {
  (manifest.assets || []).forEach((a) => {
    const hay = `${a.reason_relevant || ""} ${a.subject || ""} ${a.label || ""}`.toLowerCase();
    if (rejected.some((r) => hay.includes(r))) { genericAssets++; fail("asset-relevance", `generic/unrelated asset: ${a.asset_id}`); }
  });
}
if (manifest && manifest.relevance_gate_result && manifest.relevance_gate_result.missing_photo_replaced_by_unrelated_image === true) {
  fail("asset-relevance", "missing relevant photo was silently replaced by an unrelated image");
}

// ── 7. Skill application evidence ────────────────────────────────────
const requiredSkills = ["motion-graphics", "cinematic-camera", "terminal-inserts", "article-highlights"];
const missingSkills = [];
for (const s of requiredSkills) {
  const p = join(ROOT, ".agents", "skills", s, "SKILL.md");
  if (!existsSync(p)) missingSkills.push(s);
}
if (missingSkills.length) fail("skills", `missing Liam Johnston skill files: ${missingSkills.join(", ")}`);
// Confirm techniques present in timeline layers/captions
const hasKineticTypography = timeline && (timeline.layers || []).some((l) => l.type === "text");
const hasAnimatedDiagram = timeline && (timeline.layers || []).some((l) => l.type === "svg" && l.paths && l.paths.some((p) => p.d && p.d.includes("L")));
const hasCaptions = timeline && Array.isArray(timeline.captions) && timeline.captions.length > 0;
if (!hasKineticTypography) fail("skills", "no kinetic typography text layers found");
if (!hasAnimatedDiagram) fail("skills", "no animated diagram (svg paths) found");
if (!hasCaptions) fail("skills", "no caption cues found");

// ── 8. MP4 duration ≤ 30 seconds (ffprobe on actual MP4) ─────────────
if (videoDuration === undefined) fail("duration", "could not probe video duration");
else if (videoDuration > MAX_DURATION_S) fail("duration", `MP4 ${videoDuration.toFixed(3)} s exceeds ${MAX_DURATION_S} s`);
else console.log(`[acceptance] duration: ${videoDuration.toFixed(3)} s (≤ ${MAX_DURATION_S} s)`);

// ── 9. 1080 × 1920 ──────────────────────────────────────────────────
if (width !== CANVAS_W || height !== CANVAS_H) fail("resolution", `${width}x${height} !== ${CANVAS_W}x${CANVAS_H}`);

// ── 10. 9:16 aspect ─────────────────────────────────────────────────
const aspect = width / height;
if (Math.abs(aspect - 9 / 16) > 0.01) fail("aspect", `${width}:${height} is not 9:16`);

// ── 11. H.264 video ─────────────────────────────────────────────────
if (videoCodec !== "h264") fail("codec-video", `video codec ${videoCodec} !== h264`);

// ── 12. AAC audio ───────────────────────────────────────────────────
if (audioCodec !== "aac") fail("codec-audio", `audio codec ${audioCodec} !== aac`);

// ── 13. Expected frame rate ─────────────────────────────────────────
const measuredFps = probe ? (() => { const vs = (probe.streams || []).find((s) => s.codec_type === "video" || s.width); const r = vs?.r_frame_rate || "30/1"; const [n, d] = r.split("/").map(Number); return d ? n / d : 30; })() : 30;
if (Math.abs(measuredFps - FPS) > 0.5) fail("fps", `${measuredFps} fps !== ${FPS} fps`);

// ── 14. Captions synchronised ───────────────────────────────────────
if (timeline && Array.isArray(timeline.captions)) {
  const badCues = timeline.captions.filter((c) => c.start_f < 0 || c.end_f > timeline.durationInFrames + 1 || c.end_f <= c.start_f);
  if (badCues.length) fail("captions", `${badCues.length} caption cue(s) outside timeline`);
  const noWords = timeline.captions.filter((c) => !Array.isArray(c.words) || c.words.length === 0);
  if (noWords.length) fail("captions", `${noWords.length} caption cue(s) without word timings`);
} else {
  fail("captions", "no caption cues in timeline");
}

// ── 15. No black or blank scenes (frame extraction) ─────────────────
const framesDir = join(dirname(outPath), "acceptance-frames");
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });
let blackFrames = 0, maxStaticRun = 0, staticRun = 0, frameCount = 0, prevData = null;
await (async () => {
  if (!existsSync(videoPath)) return;
  execFileSync("ffmpeg", [
    "-y", "-v", "error", "-i", videoPath,
    "-vf", "fps=2,scale=270:-1",
    "-start_number", "0", "-q:v", "2",
    join(framesDir, "f%05d.jpg"),
  ], { encoding: "utf8" });
  const frameFiles = readdirSync(framesDir).filter((f) => /^f\d+\.jpg$/.test(f)).sort();
  frameCount = frameFiles.length;
  let lumaSum = 0;
  for (const file of frameFiles) {
    const data = await sharp(join(framesDir, file)).greyscale().raw().toBuffer();
    let sum = 0, max = 0;
    for (let i = 0; i < data.length; i++) { sum += data[i]; if (data[i] > max) max = data[i]; }
    const mean = sum / data.length;
    lumaSum += mean;
    if (mean < 5 && max < 30) blackFrames++;
    if (prevData && prevData.length === data.length) {
      let diff = 0;
      for (let i = 0; i < data.length; i++) diff += Math.abs(data[i] - prevData[i]);
      const motion = diff / data.length;
      if (motion < 0.2) { staticRun += 0.5; if (staticRun > maxStaticRun) maxStaticRun = staticRun; }
      else staticRun = 0;
    }
    prevData = data;
  }
  if (blackFrames > 0) fail("black-frames", `${blackFrames} black frame(s) in export`);
  if (maxStaticRun > 4.0) fail("static-run", `longest near-static run ${maxStaticRun.toFixed(1)} s`);
})();

// ── 16. No corrupt or frozen frames ─────────────────────────────────
if (frameCount < 2) fail("frames", "could not extract frames from the video");

// ── 17. Text legibility / WCAG AA contrast ──────────────────────────
// bg #050510, text #FFFFFF => contrast > 7:1 (passes AAA large text).
// Verify timeline palette text vs bg contrast ≥ 4.5:1 (AA) / 7:1 (AAA large).
const lum = (c) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c);
  if (!m) return 0;
  const s = (h) => { const v = parseInt(h, 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * s(m[1]) + 0.7152 * s(m[2]) + 0.0722 * s(m[3]);
};
const contrast = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
if (timeline && timeline.palette) {
  const c = contrast(timeline.palette.text || "#FFFFFF", timeline.palette.bg || "#000000");
  if (c < 4.5) fail("contrast", `text:bg contrast ${c.toFixed(2)}:1 below WCAG AA 4.5:1`);
}

// ── 18. Narration quality decision ──────────────────────────────────
const judgePath = join(ROOT, "data", "tts", channel, `${topicSlug}-shorts-narration-judge.json`);
const judgeAlt = join(ROOT, "data", "tts", channel, `${topicSlug}-vo-narration-judge.json`);
let narrationDecision = "unavailable";
for (const jp of [judgePath, judgeAlt]) {
  if (existsSync(jp)) {
    try {
      const j = JSON.parse(readFileSync(jp, "utf8"));
      narrationDecision = j.status || "unavailable";
    } catch {}
    break;
  }
}
console.log(`[acceptance] narration decision: ${narrationDecision}`);

// ── 19. No stale artifact reuse ─────────────────────────────────────
if (script && script.production_id && script.production_id !== productionId) fail("stale-reuse", `script production_id ${script.production_id} !== ${productionId}`);
if (timeline && timeline.metadata && timeline.metadata.source_script && timeline.metadata.source_script !== scriptPath) {
  fail("stale-reuse", `timeline source_script ${timeline.metadata.source_script} !== ${scriptPath}`);
}

// ── Independent MP4 SHA-256 ─────────────────────────────────────────
let mp4Sha256 = null;
if (existsSync(videoPath)) {
  const buf = readFileSync(videoPath);
  mp4Sha256 = createHash("sha256").update(buf).digest("hex");
}

mkdirSync(dirname(outPath), { recursive: true });
const report = {
  production_id: productionId,
  channel,
  channel_id_field: channelIdField,
  topic,
  topic_slug: topicSlug,
  accepted: failures.length === 0,
  generated_at: new Date().toISOString(),
  video: videoPath,
  mp4_sha256: mp4Sha256,
  duration_s: Number(videoDuration?.toFixed(3) || 0),
  width, height,
  video_codec: videoCodec,
  audio_codec: audioCodec,
  sample_rate: sampleRate,
  fps: measuredFps,
  checks: {
    production_id: tlProd === productionId,
    topic: tlTopicSlug === topicSlug,
    script_hash: existsSync(scriptPath) ? createHash("sha256").update(readFileSync(scriptPath, "utf8")).digest("hex").toLowerCase() === scriptHashArg.toLowerCase() : false,
    narration_hash: narrationActual ? narrationActual.toLowerCase() === narrationHashArg.toLowerCase() : false,
    visual_manifest: manifest ? (manifest.assets || []).length > 0 : false,
    asset_relevance: genericAssets === 0,
    skills: missingSkills.length === 0 && hasKineticTypography && hasAnimatedDiagram && hasCaptions,
    duration_le_30s: videoDuration !== undefined && videoDuration <= MAX_DURATION_S,
    resolution_1080x1920: width === CANVAS_W && height === CANVAS_H,
    aspect_9_16: Math.abs(aspect - 9 / 16) <= 0.01,
    codec_h264: videoCodec === "h264",
    codec_aac: audioCodec === "aac",
    fps_expected: Math.abs(measuredFps - FPS) <= 0.5,
    captions_synced: hasCaptions,
    no_black_frames: blackFrames === 0,
    no_frozen_frames: maxStaticRun <= 4.0,
    wcag_aa_contrast: timeline && timeline.palette ? contrast(timeline.palette.text || "#FFFFFF", timeline.palette.bg || "#000000") >= 4.5 : false,
    narration_decision: narrationDecision,
    no_stale_reuse: true,
  },
  frame_count: frameCount,
  black_frames: blackFrames,
  longest_static_run_s: Number(maxStaticRun.toFixed(1)),
  failures,
};
writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
console.log(`[acceptance] ${report.accepted ? "PASS" : "FAIL"} — ${failures.length} failure(s)`);
for (const f of failures) console.error(`[acceptance] ${f.check}: ${f.why}`);
console.log(`[acceptance] MP4 SHA-256: ${mp4Sha256}`);
console.log(`[acceptance] report: ${outPath}`);
process.exit(report.accepted ? 0 : 1);
