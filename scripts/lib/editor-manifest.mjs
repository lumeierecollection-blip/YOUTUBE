// The evidence record for one editor-rendered video: which renderer made it, from exactly which script, timeline and voiceover (SHA-256),
// which images it shows and where each came from, and the QA verdict for THIS file. It exists so that "the MP4 corresponds to the final
// validated script and timeline of this run" is checkable, not asserted.
//
// It refuses to describe anything that is not a real, non-empty video that passed editor QA, and it is only ever written by the editor
// render path (render-and-qa.js renderEditorTimeline), so its presence also means "not the legacy renderer". It does not judge facts or
// visual quality: scripts/gate-script.js and scripts/editor/video-qa.js do, and the manifest records their verdict.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";

export const RENDERER_ID = "editor-timeline";
export const RENDERER_ENTRY = "src/skills/remotion-render/render-editor.js";

const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };

export class ManifestError extends Error {
  constructor(message) { super(message); this.name = "ManifestError"; }
}

function mustBeFile(label, p, { nonEmpty = true } = {}) {
  if (!p || !existsSync(p) || !statSync(p).isFile()) throw new ManifestError(`${label} does not exist: ${p}`);
  if (nonEmpty && statSync(p).size === 0) throw new ManifestError(`${label} is empty: ${p}`);
}

/** Builds the manifest, or throws ManifestError. Every path is absolute or resolved against `root`; stored paths are repo-relative. */
export function buildEditorManifest({ root, channelId, scriptPath, timelinePath, audioPath, videoPath, qaPath, contactPath, env = process.env, now = new Date() }) {
  const abs = (p) => (p ? resolve(root, p) : p);
  const [script, timelineFile, audio, video, qaFile, contact] = [scriptPath, timelinePath, audioPath, videoPath, qaPath, contactPath].map(abs);
  mustBeFile("script", script);
  mustBeFile("timeline", timelineFile);
  mustBeFile("voiceover", audio);
  mustBeFile("rendered video", video);
  mustBeFile("QA report", qaFile);
  mustBeFile("contact sheet", contact);

  const timeline = readJson(timelineFile);
  if (!timeline) throw new ManifestError(`timeline is not valid JSON: ${timelineFile}`);
  const qa = readJson(qaFile);
  if (!qa) throw new ManifestError(`QA report is not valid JSON: ${qaFile}`);
  if (qa.pass !== true) throw new ManifestError("the QA report does not say pass:true, so no manifest is written for this video");
  if (!qa.video || resolve(root, qa.video) !== video) throw new ManifestError(`the QA report is for a different video (${qa.video}), not ${relative(root, video)}`);
  if (!qa.timeline || resolve(root, qa.timeline) !== timelineFile) throw new ManifestError(`the QA report is for a different timeline (${qa.timeline}), not ${relative(root, timelineFile)}`);

  const stem = basename(script, ".json");
  const claimed = basename(String(timeline.metadata?.source_script || ""), ".json");
  if (claimed !== stem) throw new ManifestError(`the timeline belongs to script "${claimed}", not "${stem}"`);

  const used = [...new Set((timeline.layers || []).filter((l) => l?.type === "image" && l.asset_id).map((l) => l.asset_id))];
  const assets = used.map((id) => {
    const a = timeline.assets?.[id] || {};
    const file = a.file ? resolve(root, a.file) : null;
    if (!file || !existsSync(file)) throw new ManifestError(`asset "${id}" has no file on disk (${a.file})`);
    return { id, file: relative(root, file), sha256: sha256(file), credit: a.credit || null, source_url: a.source_url || null, license: a.license || null };
  });
  if (!assets.length) throw new ManifestError("the timeline shows no images");

  const rel = (p) => relative(root, p).replaceAll("\\", "/");
  return {
    schema: 1,
    generated_at: now.toISOString(),
    renderer: { id: RENDERER_ID, entry: RENDERER_ENTRY, legacy: false },
    channel_id: String(channelId),
    script: { path: rel(script), sha256: sha256(script), stem },
    timeline: { path: rel(timelineFile), sha256: sha256(timelineFile), id: timeline.id, duration_frames: timeline.durationInFrames, fps: timeline.fps },
    voiceover: { path: rel(audio), sha256: sha256(audio) },
    video: { path: rel(video), bytes: statSync(video).size, sha256: sha256(video), duration_s: qa.duration_s, width: qa.width, height: qa.height },
    contact_sheet: { path: rel(contact), bytes: statSync(contact).size },
    qa: { report: rel(qaFile), report_sha256: sha256(qaFile), pass: true, checks: qa.checks || null },
    assets,
    ci: { repository: env.GITHUB_REPOSITORY || null, run_id: env.GITHUB_RUN_ID || null, run_attempt: env.GITHUB_RUN_ATTEMPT || null, commit: env.GITHUB_SHA || null, ref: env.GITHUB_REF_NAME || null },
  };
}

/** Writes <video>-editor-manifest.json next to the MP4 and returns its path. */
export function writeEditorManifest(opts) {
  const manifest = buildEditorManifest(opts);
  const out = resolve(opts.root, opts.videoPath).replace(/\.mp4$/i, "-editor-manifest.json");
  writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");
  return out;
}
