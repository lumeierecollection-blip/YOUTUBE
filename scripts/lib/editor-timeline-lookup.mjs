// Which renderer a script gets, and whether its persisted editor timeline is fit to render.
//
// The editor (scripts/editor/*, src/skills/remotion-render/editor/*) is opt-in per script: EDITOR_ENGINE=1 plus an entry in the
// timeline map (scripts/editor/timelines.json, keyed by the script file stem). Everything else keeps the Gemini-plan pipeline.
//
// What used to go wrong silently, and now fails loudly:
//   * a map entry whose timeline file does not exist fell back to the legacy renderer (so a "configured" script was rendered by
//     the OTHER pipeline with no error);
//   * a timeline mapped to the wrong script (copy/paste, renamed script) was rendered against that script's voiceover;
//   * an unmapped script under EDITOR_ENGINE=1 quietly used the legacy renderer, so a proof run could look like an editor run.
// EDITOR_STRICT=1 (set by the editor-proof workflow) turns the last one into an error too.
//
// This is a static pre-render check. It does NOT replace final-MP4 QA (scripts/editor/video-qa.js), which inspects the exported
// video, and it says nothing about whether the script is factual: the script gates (gate-script.js) own that.
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

export class EditorTimelineError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "EditorTimelineError";
    this.code = code;
  }
}

const truthy = (v) => /^(1|true|yes)$/i.test(String(v ?? ""));
const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };
const posInt = (n) => Number.isInteger(n) && n > 0;

/** Problems that make a timeline unfit to render (empty array = fit). `root` resolves asset/audio paths like video-qa.js does. */
export function timelineProblems(timeline, { root, stem }) {
  const problems = [];
  if (!timeline || typeof timeline !== "object" || Array.isArray(timeline)) return ["timeline is not an object"];
  for (const k of ["version", "id", "width", "height", "fps", "durationInFrames", "palette", "fonts", "assets", "layers", "captions"]) {
    if (timeline[k] === undefined || timeline[k] === null) problems.push(`missing required field "${k}"`);
  }
  for (const k of ["width", "height", "fps", "durationInFrames"]) {
    if (timeline[k] !== undefined && !posInt(timeline[k])) problems.push(`"${k}" must be a positive integer (got ${JSON.stringify(timeline[k])})`);
  }
  if (timeline.assets !== undefined && (typeof timeline.assets !== "object" || Array.isArray(timeline.assets))) problems.push('"assets" must be an object');
  if (timeline.layers !== undefined && !Array.isArray(timeline.layers)) problems.push('"layers" must be an array');
  if (timeline.captions !== undefined && !Array.isArray(timeline.captions)) problems.push('"captions" must be an array');
  if (problems.length) return problems;

  const assets = timeline.assets;
  for (const [id, a] of Object.entries(assets)) {
    if (!a || typeof a !== "object" || !a.file || !posInt(a.width) || !posInt(a.height)) problems.push(`asset "${id}" needs file, width and height`);
  }

  // Every image the timeline shows must exist and carry its provenance (same rule video-qa.js applies to the export).
  const referenced = [...new Set(timeline.layers.filter((l) => l?.type === "image" && l.asset_id).map((l) => l.asset_id))];
  if (!referenced.length) problems.push("no image layers: an editor timeline must show images");
  for (const id of referenced) {
    const a = assets[id];
    if (!a) { problems.push(`layer references unknown asset "${id}"`); continue; }
    if (a.file && !existsSync(resolve(root, a.file))) problems.push(`asset "${id}": file not found (${a.file})`);
    if (!a.credit || !String(a.credit).trim()) problems.push(`asset "${id}": no credit`);
    if (!a.source_url || !/^https?:\/\//i.test(String(a.source_url))) problems.push(`asset "${id}": no http(s) source_url`);
  }

  const dur = timeline.durationInFrames;
  if (!timeline.captions.length) problems.push("no caption cues");
  const badCues = timeline.captions.filter((c) => !c || !Number.isFinite(c.start_f) || !Number.isFinite(c.end_f) || c.start_f < 0 || c.end_f > dur + 1 || c.end_f <= c.start_f);
  if (badCues.length) problems.push(`${badCues.length} caption cue(s) outside the timeline or with no valid frame range`);
  if (timeline.captions.some((c) => !Array.isArray(c?.words) || !c.words.length)) problems.push("a caption cue has no word timings");
  const st = timeline.caption_style;
  if (st && (st.x < 0 || st.y < 0 || st.x + st.w > timeline.width || st.y + st.h > timeline.height)) problems.push(`caption box ${st.x},${st.y} ${st.w}x${st.h} is outside ${timeline.width}x${timeline.height}`);

  const md = timeline.metadata || {};
  if (!md.source_script) problems.push("metadata.source_script is missing, so the timeline cannot be tied to a script");
  else if (stem && basename(String(md.source_script), ".json") !== stem) problems.push(`timeline belongs to script "${basename(String(md.source_script), ".json")}", not "${stem}"`);
  if (!md.source_audio) problems.push("metadata.source_audio is missing");
  else if (!existsSync(resolve(root, md.source_audio))) problems.push(`voiceover not found (${md.source_audio})`);
  return problems;
}

/**
 * null            -> use the legacy renderer (EDITOR_ENGINE off, or the script is simply not mapped and EDITOR_STRICT is off)
 * { timelinePath, mapPath, timeline } -> render with the editor
 * throws EditorTimelineError -> do NOT render with anything; the caller reports it
 */
export function resolveEditorTimeline(scriptPath, { env = process.env, root } = {}) {
  if (!truthy(env.EDITOR_ENGINE)) return null;
  const stem = basename(scriptPath, ".json");
  const mapPath = resolve(root, env.EDITOR_TIMELINE_MAP || "scripts/editor/timelines.json");
  if (!existsSync(mapPath)) throw new EditorTimelineError("MAP_MISSING", `EDITOR_ENGINE is on but the timeline map does not exist: ${mapPath}`);
  const map = readJson(mapPath);
  if (!map || typeof map !== "object" || Array.isArray(map)) throw new EditorTimelineError("MAP_MALFORMED", `timeline map is not a JSON object: ${mapPath}`);

  const entry = Object.prototype.hasOwnProperty.call(map, stem) ? map[stem] : undefined;
  if (entry === undefined) {
    if (truthy(env.EDITOR_STRICT)) throw new EditorTimelineError("UNMAPPED", `EDITOR_STRICT is on and "${stem}" has no entry in ${mapPath}; it would silently use the legacy renderer`);
    return null;
  }
  if (typeof entry !== "string" || !entry.trim()) throw new EditorTimelineError("MAP_ENTRY_INVALID", `map entry for "${stem}" is not a path`);

  const timelinePath = resolve(root, entry);
  if (!existsSync(timelinePath)) throw new EditorTimelineError("TIMELINE_MISSING", `"${stem}" is mapped to ${entry}, which does not exist (it would otherwise fall back to the legacy renderer)`);
  const timeline = readJson(timelinePath);
  if (!timeline) throw new EditorTimelineError("TIMELINE_MALFORMED", `${entry} is not valid JSON`);
  const problems = timelineProblems(timeline, { root, stem });
  if (problems.length) throw new EditorTimelineError("TIMELINE_INVALID", `${entry} is not fit to render: ${problems.join("; ")}`);
  return { timelinePath, mapPath, timeline };
}
