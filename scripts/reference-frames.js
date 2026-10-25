/**
 * Reference frames for the planner — what the channel's reference ACTUALLY looks like, attached to
 * the Gemini planner call as images.
 *
 * Before this the reference videos reached the pipeline only after the fact: Layer 2 compared a
 * finished render against them. The planner planned from the hand-written style spec, a document
 * about the reference, never the reference. Now it sees frames of it while it plans.
 *
 *   referenceFramesFor(channelId)  the channel's frames: channels/<channel_id>/reference-frames/,
 *                                  from its style spec's `reference_video`; a channel with no
 *                                  reference of its own gets the shared motion-graphics set
 *                                  (channels/_shared/reference-frames/, from research/motion-graphics-ref/,
 *                                  the same videos Layer 2 scores every channel against)
 *   extractReferenceFrames         4 evenly spaced frames, skipping the first / last 0.5 s
 *   withReferenceImages            a chat message's content: the prompt text plus the frames as
 *                                  image parts (OpenAI-compatible, which gemini-client.js speaks)
 *
 * The frames are committed (small JPEGs) so CI plans from exactly what was reviewed; a missing
 * directory is extracted on demand. Context only: nothing here gates, and Layer 2's clone check
 * still runs after the render.
 */
import { readFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { resolveChannel } from "./lib/channel-lookup.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const FRAME_COUNT = 4;
export const SHARED_REFS = ["research/motion-graphics-ref/ref-01.mp4", "research/motion-graphics-ref/ref-02.mp4", "research/motion-graphics-ref/ref-03.mp4"];
export const REFERENCE_NOTE = "REFERENCE FRAMES. The images attached are frames from this channel's reference video. Use them to understand the visual language — the ground, the palette, the typography, how dense a frame is and how its elements sit. Do not copy them: no frame you plan should reproduce one of them.";

const listJpgs = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).sort().map((f) => join(dir, f)) : []);

/** Evenly spaced timestamps in [0.5, dur - 0.5]. */
export function referenceTimestamps(durationSec, n = FRAME_COUNT) {
  const a = 0.5, b = Math.max(a, durationSec - 0.5);
  return Array.from({ length: n }, (_, i) => +(a + ((b - a) * (i + 0.5)) / n).toFixed(3));
}

/** Extract `n` frames of `video` into `dir` as frame-NN.jpg (512 px wide). Returns the files. */
export function extractReferenceFrames(video, dir, { n = FRAME_COUNT, prefix = "frame" } = {}) {
  mkdirSync(dir, { recursive: true });
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video], { encoding: "utf8" }).trim());
  if (!Number.isFinite(dur) || dur <= 0) throw new Error(`cannot read the duration of ${video}`);
  return referenceTimestamps(dur, n).map((t, i) => {
    const out = join(dir, `${prefix}-${String(i + 1).padStart(2, "0")}.jpg`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", video, "-frames:v", "1", "-vf", "scale=512:-2", "-q:v", "4", out]);
    return out;
  });
}

/**
 * The planner's reference frames for one dispatched channel.
 *   -> { files, source, dir }        frames found (or extracted)
 *   -> { files: [], why }            none; the caller logs reference_frames_missing and plans anyway
 */
export function referenceFramesFor(channelId, { root = ROOT, channels, extract = true } = {}) {
  let row = null;
  try { row = resolveChannel(channelId, channels); } catch { /* unresolved: shared set below */ }
  let video = null;
  if (row) {
    const specPath = join(root, ...String(row.style_spec_path || `channels/${row.channel_id}/style-spec.json`).split("/"));
    try { video = existsSync(specPath) ? JSON.parse(readFileSync(specPath, "utf8")).reference_video || null : null; } catch { video = null; }
  }
  if (row && video) {
    const dir = join(root, "channels", row.channel_id, "reference-frames");
    let files = listJpgs(dir);
    if (!files.length && extract && existsSync(join(root, video))) {
      try { files = extractReferenceFrames(join(root, video), dir); } catch (e) { return { files: [], why: `extracting ${video} failed: ${e.message}` }; }
    }
    if (files.length) return { files, source: video, dir: relative(root, dir).split("\\").join("/") };
    return { files: [], why: `no frames at ${relative(root, dir)} and ${video} is not available` };
  }
  // No reference of its own: the shared set every channel is scored against by Layer 2.
  const dir = join(root, "channels", "_shared", "reference-frames");
  let files = listJpgs(dir);
  if (!files.length && extract) {
    const vids = SHARED_REFS.filter((v) => existsSync(join(root, v)));
    try {
      // 4 frames across the set: 2 from the first video, then 1 from each of the next.
      files = vids.flatMap((v, i) => extractReferenceFrames(join(root, v), dir, { n: i === 0 ? 2 : 1, prefix: `ref-${String(i + 1).padStart(2, "0")}` })).slice(0, FRAME_COUNT);
    } catch (e) { return { files: [], why: `extracting the shared references failed: ${e.message}` }; }
  }
  return files.length ? { files, source: "research/motion-graphics-ref (shared)", dir: relative(root, dir).split("\\").join("/") } : { files: [], why: "no channel reference and no shared reference videos" };
}

/** Image parts for a list of JPEG files (data URIs). */
export function imageParts(files) {
  return files.map((f) => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${readFileSync(f).toString("base64")}` } }));
}

/** A chat message's content: the text alone, or the text + the reference note + the frames. */
export function withReferenceImages(text, parts) {
  if (!parts?.length) return text;
  return [{ type: "text", text: `${text}\n\n${REFERENCE_NOTE}` }, ...parts];
}
