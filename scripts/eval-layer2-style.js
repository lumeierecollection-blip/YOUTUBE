#!/usr/bin/env node
/**
 * eval-layer2-style.js — Layer 2: a coarse CLIP floor over a shared
 * motion-graphics reference family.
 *
 * ── What this layer is, after Option A ──────────────────────────────────
 *
 * The three references in research/motion-graphics-ref/ define ONE
 * motion-graphics family, not three per-channel blueprints. All six channels
 * share one threshold, derived from the union of all three reference frame sets.
 *
 * Layer 2 answers "is this motion graphics at all" — a floor that keeps blank
 * beats, fallback frames and wrong-media renders out of Layer 3's way. It does
 * NOT answer "is this good motion graphics", and it is not a per-channel style
 * judgement: that is Layer 3, which sees the whole video with audio.
 *
 * The earlier per-channel design carried a §2.7 cross-pair separation gate, and
 * it failed 6/6: ref-03's threshold admitted 15 of 16 ref-01 frames and all 4
 * ref-02 frames, so a channel paired with ref-03 would have flagged essentially
 * nothing. Under Option A there is no per-channel threshold and no separation
 * gate, so that failure mode is gone by construction rather than by lowering the
 * bar. The gate's real lesson survives: a floor must be permissive, and the
 * permissive number is the intended result here, not a warning.
 *
 * ── Percentile choice (spec §7) ─────────────────────────────────────────
 *
 * 0.10 over every pair drawn from the union of all reference frames, self-pairs
 * excluded, within-reference and cross-reference pairs both included. It reads
 * as "the outer edge of this family": the similarity below which a frame is not
 * motion graphics from this family at all. Deliberately permissive — it should
 * not flag style variation, only non-motion-graphics.
 *
 * ── Frame floor (spec §1.1) ─────────────────────────────────────────────
 *
 * Minimum 30 frames per reference, because ref-02 (5.00 s) previously yielded 4
 * frames at 1 fps -> 6 pairs -> floor(0.10 * 6) = 0, which made the "10th
 * percentile" the minimum of 6 values rather than a percentile of anything.
 * fps = ceil(30 / (duration - 1.0)), never below 1.
 *
 * ── Normalization (spec §1.6) ───────────────────────────────────────────
 *
 * Mandatory and not optional. @xenova/transformers' image-feature-extraction
 * returns UNNORMALIZED vectors. Skipping L2 normalization does not make the
 * threshold conservative — it makes the arithmetic wrong: cosine similarities
 * came back at 117.0997 and 93.6966 before this was added, and every threshold
 * derived from those numbers was meaningless. normalize() is applied to every
 * embedding, and a test asserts unit length to 1e-4.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const MODEL = "Xenova/clip-vit-base-patch32";
export const MIN_FRAMES = 30;
export const PERCENTILE = 0.10;
/** The escalation ratio Layer 2 USED to gate at. Retained only so the demotion is legible. */
export const ESCALATION_RATIO = 0.40;

/**
 * L2-normalize in place-free fashion, returning a new Float32Array.
 * A zero vector is returned as zeros rather than NaN, so a degenerate frame
 * scores 0 against everything instead of poisoning the whole run.
 */
export function normalize(vec) {
  const out = Float32Array.from(vec);
  let sum = 0;
  for (const x of out) sum += x * x;
  const norm = Math.sqrt(sum);
  if (!norm) return out;
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

/** Cosine similarity of two already-normalized vectors. */
export function cosine(a, b) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

/**
 * Frames per second needed to reach MIN_FRAMES after the head/tail skips.
 * Never below 1 fps.
 */
export function extractionFps(durationSec) {
  const usable = Math.max(Number(durationSec) - 1.0, 0.1);
  return Math.max(1, Math.ceil(MIN_FRAMES / usable));
}

/**
 * Sample timestamps inside [skipHead, duration - skipTail], midpoints of equal
 * bins so no frame lands on a fade boundary. Head/tail skip is min(0.5, 10% of
 * duration) so a very short clip still yields frames.
 */
export function frameTimestamps(durationSec, fps) {
  const d = Number(durationSec);
  const skip = Math.min(0.5, d * 0.1);
  const span = Math.max(d - 2 * skip, 0.05);
  const n = Math.max(MIN_FRAMES, Math.round(span * fps));
  return Array.from({ length: n }, (_, i) => skip + (span * (i + 0.5)) / n);
}

// cb67973's resolution pattern is an ordered list of candidates falling back to
// bare names on PATH. ffmpeg/ffprobe are on PATH in this environment and are
// what local-audit.cjs and render-and-qa.js already spawn, so that is the
// resolution used here rather than a second list that could disagree with them.
const FFMPEG = "ffmpeg";
const FFPROBE = "ffprobe";

export function probeDuration(file) {
  return Number(execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }).trim());
}

/**
 * Extract frames to dir. Returns { files, timestamps, fps }.
 * Named frame-0001.png upward so lexical order is temporal order.
 */
export function extractFrames(video, dir, { width = 224 } = {}) {
  const duration = probeDuration(video);
  const fps = extractionFps(duration);
  const timestamps = frameTimestamps(duration, fps);
  mkdirSync(dir, { recursive: true });
  const files = [];
  timestamps.forEach((t, i) => {
    const out = join(dir, `frame-${String(i + 1).padStart(4, "0")}.png`);
    execFileSync(FFMPEG, [
      "-hide_banner", "-loglevel", "error", "-ss", String(t), "-i", video, "-frames:v", "1",
      "-vf", `scale=${width}:${width}:force_original_aspect_ratio=increase,crop=${width}:${width}`,
      "-y", out,
    ]);
    files.push(out);
  });
  return { files, timestamps, fps, duration };
}

let _clip = null, _RawImage = null, _sharp = null;
async function loadModel() {
  if (_clip) return;
  const T = await import("@xenova/transformers");
  _RawImage = T.RawImage;
  // Decode with the repo's own sharp, not transformers' nested copy — the
  // nested one is pinned away by the package.json override (see cb7cc46).
  _sharp = (await import("sharp")).default;
  _clip = await T.pipeline("image-feature-extraction", MODEL);
}

/**
 * Embed one image file. Always L2-normalized.
 * Decodes through the top-level sharp and constructs RawImage from raw pixels,
 * so transformers' own image reader is never involved.
 */
export async function embedImage(file) {
  await loadModel();
  const { data, info } = await _sharp(file)
    .resize(224, 224, { fit: "cover" }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const img = new _RawImage(new Uint8Array(data), info.width, info.height, info.channels);
  const out = await _clip(img);
  return normalize(out.data);
}

export async function embedFiles(files, onProgress) {
  const out = [];
  for (let i = 0; i < files.length; i++) {
    out.push(await embedImage(files[i]));
    onProgress?.(i + 1, files.length);
  }
  return out;
}

/**
 * Every unordered pair across the union of all reference frames, self-pairs
 * excluded; within-reference and cross-reference pairs both included (spec §1.2).
 * Threshold is the value at floor(PERCENTILE * length) after ascending sort.
 */
export function pairwiseScores(embeddings) {
  const scores = [];
  for (let a = 0; a < embeddings.length; a++) {
    for (let b = a + 1; b < embeddings.length; b++) scores.push(cosine(embeddings[a], embeddings[b]));
  }
  return scores;
}

export function deriveThreshold(embeddings, percentile = PERCENTILE) {
  const scores = pairwiseScores(embeddings);
  if (!scores.length) throw new Error("no reference embeddings: cannot derive a threshold");
  const sorted = [...scores].sort((x, y) => x - y);
  return {
    threshold: sorted[Math.floor(percentile * sorted.length)],
    frame_count: embeddings.length,
    pair_count: scores.length,
    percentile,
  };
}

/**
 * Score candidate frames against the shared reference set, and return NUMBERS.
 *
 * There is deliberately no pass/fail here. Layer 2 was demoted to a
 * non-blocking style advisory after measurement showed CLIP-SIM cannot do the
 * job it was originally given: a solid white frame scores 0.6783 against 12
 * reference frames and 0.8089 against 40, against a floor of 0.4570, so it
 * passed the gate by a wide margin, and no reachable percentile changed that.
 * The blank/fallback/wrong-media cases this layer was meant to catch are caught
 * deterministically and for free by local-audit.cjs (frames-nonempty,
 * middle-zone-filled, canvas-ground, popTransitions).
 *
 * So this reports how far a render sits from the motion-graphics reference
 * family and hands the number to Layer 3, which decides whether it is good.
 * It never gates, never escalates, never triggers a retry.
 *
 * Per frame: max similarity across all reference frames — a frame is judged
 * against its nearest neighbour in the family, not penalised by its average.
 */
export function scoreCandidate(candidateEmbeddings, referenceEmbeddings, threshold, timestamps = []) {
  const sims = candidateEmbeddings.map((e) => Math.max(...referenceEmbeddings.map((r) => cosine(e, r))));
  const below = sims.map((s, i) => ({ i, similarity: s, timestamp: timestamps[i] ?? null }))
    .filter((x) => x.similarity < threshold);
  return {
    ratio_below_floor: candidateEmbeddings.length ? below.length / candidateEmbeddings.length : 0,
    below_floor_count: below.length,
    below_floor: below,
    frame_count: candidateEmbeddings.length,
    similarities: sims,
    threshold,
  };
}

/**
 * The advisory: one number per render — mean max-similarity to the reference
 * family — plus the counts that produced it. Numbers only, never a verdict.
 *
 * Returns { advisory_score, frame_count, below_floor_count, timestamps_below_floor }.
 */
export function scoreStyle(candidateEmbeddings, referenceEmbeddings, threshold, timestamps = []) {
  const s = scoreCandidate(candidateEmbeddings, referenceEmbeddings, threshold, timestamps);
  const advisory_score = s.similarities.length
    ? s.similarities.reduce((a, b) => a + b, 0) / s.similarities.length
    : 0;
  return {
    advisory_score,
    frame_count: s.frame_count,
    below_floor_count: s.below_floor_count,
    timestamps_below_floor: s.below_floor.map((b) => b.timestamp).filter((t) => t !== null),
  };
}

/**
 * scoreStyle(renderPath) — extract, embed, score. The one-call form Layer 3
 * consumes. Loading embeddings is separated so tests can pass vectors directly.
 */
export async function scoreStyleFile(renderPath, { framesDir, references, threshold, timestamps } = {}) {
  const { files, timestamps: ts } = extractFrames(renderPath, framesDir || `data/audit/l2-candidate/${Date.now()}`);
  const embs = await embedFiles(files);
  return { ...scoreStyle(embs, references, threshold, timestamps || ts), renderPath, files };
}

export function formatTimestamp(sec) {
  const s = Math.max(0, Number(sec) || 0);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function arg(name, argv = process.argv) {
  const i = argv.indexOf("--" + name);
  return i > -1 && argv[i + 1] ? argv[i + 1] : null;
}

async function main() {
  const outDir = arg("out") || "channels/_shared";
  const refs = ["ref-01", "ref-02", "ref-03"].map((id) => ({
    id, video: `research/motion-graphics-ref/${id}.mp4`,
  })).filter((r) => existsSync(r.video));
  if (!refs.length) { console.error("::error::no reference videos in research/motion-graphics-ref/"); process.exit(3); }

  const framesRoot = join(outDir, "ref-frames");
  const embRoot = join(outDir, "ref-embeddings");
  mkdirSync(embRoot, { recursive: true });
  const all = [];
  const perRef = [];

  for (const r of refs) {
    const dir = join(framesRoot, r.id);
    const { files, fps, duration } = extractFrames(r.video, dir);
    const embs = await embedFiles(files);
    embs.forEach((e, i) => {
      const out = join(embRoot, `${r.id}-${String(i + 1).padStart(4, "0")}.bin`);
      writeFileSync(out, Buffer.from(e.buffer, e.byteOffset, e.byteLength));
      all.push(e);
    });
    perRef.push({ reference_id: r.id, frame_count: files.length, extraction_fps: fps, duration_sec: Number(duration.toFixed(3)) });
    console.log(`[layer2] ${r.id}: ${files.length} frames @${fps}fps (dur ${duration.toFixed(2)}s)`);
    if (files.length < MIN_FRAMES) { console.error(`::error::${r.id} yielded ${files.length} frames, below the ${MIN_FRAMES} floor`); process.exit(3); }
  }

  const derived = deriveThreshold(all);
  const doc = {
    threshold: derived.threshold,
    frame_count: derived.frame_count,
    pair_count: derived.pair_count,
    percentile: derived.percentile,
    references: perRef.map((p) => p.reference_id),
    model: MODEL,
    note: "advisory only - this threshold no longer gates, escalates or retries",
    generated_at: new Date().toISOString(),
    per_reference: perRef,
  };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "style-threshold.json"), JSON.stringify(doc, null, 2) + "\n");
  console.log(`[layer2] shared threshold ${doc.threshold.toFixed(4)} over ${doc.pair_count} pairs from ${doc.frame_count} frames (p${(doc.percentile * 100).toFixed(0)})`);
  console.log(`[layer2] -> ${join(outDir, "style-threshold.json")}`);
}

if (process.argv[1] && process.argv[1].endsWith("eval-layer2-style.js")) {
  main().catch((e) => { console.error(`::error::${e.message}`); process.exit(1); });
}