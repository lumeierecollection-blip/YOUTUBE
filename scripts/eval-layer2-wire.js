/**
 * The call site for Layer 2 (render-and-qa.js used to hand the eval loop a literal
 * `{ advisory_score: null, note: "advisory not wired at this call site yet" }`).
 *
 * eval-layer2-style.js is unchanged. This file loads its references and calls its API:
 *
 *   references   the stored embeddings of research/motion-graphics-ref/ref-0{1,2,3}.mp4
 *                (channels/_shared/ref-embeddings/*.bin, written by `node scripts/eval-layer2-style.js`
 *                together with the threshold in channels/_shared/style-threshold.json). When the
 *                .bin files are absent the three reference videos are embedded here, which is the
 *                same work, only slower.
 *   candidate    the render: frames extracted and embedded with the module's own functions.
 *
 * ── What Layer 2 is, and is not ─────────────────────────────────────────
 * CLIP image embeddings carry how an image LOOKS (palette, layout density, typography weight,
 * medium), not what it depicts frame by frame. The score is the mean over the render's frames of
 * the best cosine similarity to any reference frame: "does this belong to the motion-graphics
 * family". No reference frame ever enters the render; the references are only a similarity target.
 *
 * ── The clone check (an advisory signal, never a gate) ──────────────────
 * Style is similarity to the FAMILY. A copy is similarity to ONE reference that exceeds how alike
 * the references are to each other. The references' own ceiling is measured from them: the highest
 * cosine between frames of DIFFERENT reference videos (frames of one video are near-duplicates of
 * their neighbours, so that pairing says nothing about style). A render frame whose best match to
 * any reference frame is above that ceiling is closer to a reference than the references are to
 * each other. style_match is:
 *   clone_suspected  a quarter or more of the render's frames are above the ceiling
 *   off_style        the render's mean similarity is under the family floor, or half its frames are
 *   matched          otherwise: inside the family's own range, not a copy of any member
 * Where this stops: one similarity number per frame cannot tell a pixel copy from a render that
 * happens to share a reference's layout. It flags; a human or Layer 3 decides.
 */
import { existsSync, readdirSync, readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { cosine, scoreCandidate, scoreStyle, extractFrames, embedFiles, normalize } from "./eval-layer2-style.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CLONE_SHARE = 0.25;
/**
 * A frame is only a copy of a reference frame if it is a near-duplicate of it. The references' measured
 * ceiling (frames of different videos) is 0.837 on the shipped set, and a BLANK WHITE frame already scores
 * 0.855 against a mostly-white reference frame (measured with the real model), so the measured ceiling alone
 * calls every empty frame a clone. 0.90 sits between "different content in the same family" (<= 0.84) and an
 * actual copy (a reference against itself is ~1.0). The effective threshold is the larger of the two.
 */
export const CLONE_MIN = 0.90;
export const OFF_STYLE_SHARE = 0.5;

/**
 * Where @xenova/transformers keeps the CLIP weights. Its default is node_modules/@xenova/transformers/
 * .cache, which no CI cache covers (and which a clean `npm ci` empties); ~/.cache/huggingface is what the
 * workflow's "Cache HuggingFace models" step saves. Same singleton the style module's loadModel() imports.
 */
export async function configureModelCache(dir = process.env.LAYER2_MODEL_CACHE || join(homedir(), ".cache", "huggingface", "transformers-js")) {
  const { env } = await import("@xenova/transformers");
  env.cacheDir = dir;
  return dir;
}

/** "ref-02-0007.bin" -> "ref-02" */
const groupOf = (file) => basename(file).replace(/-\d+\.bin$/, "");

/** Float32Array views are 4-byte aligned only on an aligned Buffer: copy out. */
function readEmbedding(file) {
  const b = readFileSync(file);
  const out = new Float32Array(b.byteLength / 4);
  for (let i = 0; i < out.length; i++) out[i] = b.readFloatLE(i * 4);
  return normalize(out);
}

/**
 * -> { embeddings: Float32Array[], groups: string[], threshold, source }
 * `source` is "stored" or "computed". Throws when neither the stored embeddings nor the reference
 * videos exist: a Layer 2 with no references cannot say anything, and a made-up number is worse.
 */
export async function loadReferences({ root = ROOT, embDir = join(root, "channels", "_shared", "ref-embeddings"), thresholdPath = join(root, "channels", "_shared", "style-threshold.json"), refVideos = null } = {}) {
  const threshold = JSON.parse(readFileSync(thresholdPath, "utf8")).threshold;
  if (existsSync(embDir)) {
    const files = readdirSync(embDir).filter((f) => f.endsWith(".bin")).sort();
    if (files.length) return { embeddings: files.map((f) => readEmbedding(join(embDir, f))), groups: files.map(groupOf), threshold, source: "stored" };
  }
  const videos = (refVideos || ["ref-01", "ref-02", "ref-03"].map((id) => ({ id, video: join(root, "research", "motion-graphics-ref", `${id}.mp4`) }))).filter((r) => existsSync(r.video));
  if (!videos.length) throw new Error("layer 2 has no references: no stored embeddings in channels/_shared/ref-embeddings/ and no videos in research/motion-graphics-ref/");
  const embeddings = [], groups = [];
  for (const r of videos) {
    const { files } = extractFrames(r.video, join(root, "data", "audit", "l2-ref-frames", r.id));
    const embs = await embedFiles(files);
    for (const e of embs) { embeddings.push(e); groups.push(r.id); }
  }
  return { embeddings, groups, threshold, source: "computed" };
}

/** Highest cosine between frames of two DIFFERENT reference videos: the family's own ceiling. */
export function crossReferenceMax(embeddings, groups) {
  let max = -1;
  for (let a = 0; a < embeddings.length; a++) {
    for (let b = a + 1; b < embeddings.length; b++) {
      if (groups[a] === groups[b]) continue;
      const s = cosine(embeddings[a], embeddings[b]);
      if (s > max) max = s;
    }
  }
  return max;
}

/**
 * style_match for one render. Pure: embeddings in, a verdict out.
 * -> { style_match, clone_frames, clone_share, reference_ceiling, candidate_max, off_style_frames }
 */
export function classifyStyle(candidateEmbeddings, references, { advisory_score, threshold, ceiling }) {
  const scored = scoreCandidate(candidateEmbeddings, references, threshold);
  const sims = scored.similarities;
  const n = sims.length;
  const cloneFrames = sims.filter((s) => s > ceiling).length;
  const cloneShare = n ? cloneFrames / n : 0;
  const offShare = scored.ratio_below_floor;
  let style_match = "matched";
  if (n && cloneShare >= CLONE_SHARE) style_match = "clone_suspected";
  else if (n && (advisory_score < threshold || offShare >= OFF_STYLE_SHARE)) style_match = "off_style";
  return {
    style_match, clone_frames: cloneFrames, clone_share: cloneShare, reference_ceiling: ceiling,
    candidate_max: n ? Math.max(...sims) : null, off_style_frames: scored.below_floor_count,
  };
}

let _refs = null;

/**
 * Layer 2 for one render: { advisory_score, frame_count, below_floor_count, timestamps_below_floor,
 * style_match, ... }. Advisory only; the caller never gates on it.
 */
export async function layer2Advisory(renderPath, { framesDir, references } = {}) {
  await configureModelCache();
  const refs = references || (_refs ||= await loadReferences());
  const dir = framesDir || join(ROOT, "data", "audit", "l2-candidate", String(Date.now()));
  mkdirSync(dir, { recursive: true });
  const { files, timestamps } = extractFrames(renderPath, dir);
  const embs = await embedFiles(files);
  const base = scoreStyle(embs, refs.embeddings, refs.threshold, timestamps);
  const measured = refs.ceiling ?? (refs.ceiling = crossReferenceMax(refs.embeddings, refs.groups));
  const ceiling = Math.max(measured, CLONE_MIN);
  const verdict = classifyStyle(embs, refs.embeddings, { advisory_score: base.advisory_score, threshold: refs.threshold, ceiling });
  return { ...base, ...verdict, reference_ceiling_measured: measured, threshold: refs.threshold, reference_source: refs.source, reference_frames: refs.embeddings.length };
}
