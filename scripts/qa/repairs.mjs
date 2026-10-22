// Deterministic, scene-scoped repairs for machine-readable QA defects (docs/QA-LOOP.md).
//
// Every repair is keyed by a defect's `check` id. Three scopes:
//   plan  - edits ONE beat of the resolved visual plan (beat_index); every other beat is left
//           byte-identical (deep clone + only plan.beats[i] replaced). Needs a re-render.
//   input - edits a render input (the SRT the renderer times beats from). Needs a re-render.
//   post  - fixes the rendered MP4 itself (audio limiter). No re-render.
//
// What a repair does NOT guarantee: that the re-render passes. The loop re-inspects the new
// render; a repair that changed nothing measurable ends as no-progress / unresolved and is
// reported as such. The plan repairs reuse the shapes render-and-qa.js already renders
// (forceTypeCard's TYPE card, the entity ladder's plate-* art) - no new visual vocabulary.
import { spawnSync } from "node:child_process";
import { renameSync } from "node:fs";
import { parseSrt } from "./objective-checks.mjs";

const clone = (x) => JSON.parse(JSON.stringify(x));

// The same reset render-and-qa.js forceTypeCard applies (kept in sync by the unit test that
// compares the two on a fixture). Duplicated, not imported: render-and-qa.js runs main() on import.
export function typeCard(beat, sentence, keepHeadline) {
  const headline = keepHeadline && typeof beat.headline === "string" && beat.headline.trim() ? beat.headline : (sentence || beat.headline || "");
  Object.assign(beat, {
    kind: "TYPE", visual_type: "TYPE", canvas_composition: "TYPE-FULL", shot: "STATEMENT",
    scene_description: sentence || beat.scene_description, headline,
    lead_in: null, data: null, named_entities: [], concepts: [], emphasis_word: null, emphasis_words: [],
    entity_anchor_word: null, camera_focus: null, hero_cutout: null, fallback_symbol: null, concept_visuals: [],
    art: null, name_card: null, type_layout: null, pull_phrase: null, label: null, visual_events: [], objects: {},
    ground: "white", ground_source: "default",
  });
  if (beat.typography_direction) beat.typography_direction.phrase = beat.headline;
  return beat;
}

const PLATE = { person: "plate-person", place: "plate-place", organization: "plate-organization", company: "plate-organization", institution: "plate-organization", agency: "plate-organization" };

// Each plan repair mutates the (already cloned) beat and returns a short description, or null when it cannot act.
const PLAN_REPAIRS = {
  // Overflow / overlap: first drop the secondary text roles and trim the headline to 8 words;
  // if this beat was already decluttered in an earlier attempt, fall to a TYPE card.
  "canvas-fit": (b, { sentence, tier }) => {
    if (tier >= 2) { typeCard(b, sentence, true); return "TYPE card (headline kept) after declutter did not fit"; }
    const before = JSON.stringify([b.pull_phrase, b.label, b.lead_in, b.headline]);
    b.pull_phrase = null; b.label = null; b.lead_in = null;
    if (typeof b.headline === "string") { const w = b.headline.trim().split(/\s+/); if (w.length > 8) b.headline = w.slice(0, 8).join(" "); }
    if (JSON.stringify([b.pull_phrase, b.label, b.lead_in, b.headline]) === before) { typeCard(b, sentence, true); return "TYPE card (nothing to declutter)"; }
    return "declutter: pull phrase / label / lead-in dropped, headline <= 8 words";
  },
  // An empty frame across the boundary: the TYPE card draws its headline from the beat's first frame.
  "pop-transitions": (b, { sentence }) => { typeCard(b, sentence, true); return "TYPE card (headline kept)"; },
  // A named entity not drawn: its plate (the name set in type, the entity ladder's honest fallback - never a stock image).
  "entity-coverage": (b, { entities }) => {
    const pool = (entities?.length ? entities : (b.named_entities || []).map((e) => e?.name)).filter(Boolean);
    const named = (b.named_entities || []).find((e) => e?.name && (!pool.length || pool.some((n) => String(n).includes(e.name))) && PLATE[String(e.type || "").toLowerCase()]);
    if (!named) return null;
    for (const k of ["type_layout", "name_card", "hero_cutout", "fallback_symbol"]) delete b[k];
    b.visual_type = "TYPE"; b.data = null; b.concept_visuals = [];
    b.art = { kind: PLATE[String(named.type).toLowerCase()], name: named.name };
    return `plate ${b.art.kind} "${named.name}"`;
  },
  // A referenced file that is not on disk: drop the picture, keep the words.
  "missing-media": (b, { sentence }) => { typeCard(b, sentence, true); return "missing asset dropped -> TYPE card (headline kept)"; },
};

const INPUT_REPAIRS = new Set(["captions-overlap", "captions-past-end", "captions-timing"]);
const POST_REPAIRS = new Set(["audio-clipping"]);

/** The repair a defect gets, or null. Pure. */
export function repairFor(defect) {
  if (PLAN_REPAIRS[defect.check] && Number.isInteger(defect.beat_index)) return { kind: defect.check, scope: "plan", params: { beat_index: defect.beat_index } };
  if (INPUT_REPAIRS.has(defect.check)) return { kind: "srt-clamp", scope: "input", params: {} };
  if (POST_REPAIRS.has(defect.check)) return { kind: "audio-limiter", scope: "post", params: { limit_db: -1 } };
  return null;
}

/**
 * Apply every plan repair in `defects` to a deep clone of `plan`. Only plan.beats[i] for a defect's
 * beat_index is replaced; the rest of the plan is untouched. `history` maps "kind|beat" -> times applied
 * (escalation tier). `rebuildCanvas(beat)` recomputes beat.canvas (render-and-qa.js canvasContentFor).
 */
export function applyPlanRepairs(plan, defects, { sentences = [], history = new Map(), rebuildCanvas = null } = {}) {
  const out = clone(plan);
  const applied = [];
  const byBeat = new Map();
  for (const d of defects) {
    const r = d.repair || repairFor(d);
    if (!r || r.scope !== "plan") continue;
    const i = r.params.beat_index;
    if (!out.beats?.[i]) continue;
    if (!byBeat.has(i)) byBeat.set(i, []);
    byBeat.get(i).push(d);
  }
  for (const [i, ds] of byBeat) {
    const beat = clone(out.beats[i]);
    const notes = [];
    for (const kind of [...new Set(ds.map((d) => d.check))]) {
      const key = `${kind}|${i}`;
      const tier = (history.get(key) || 0) + 1;
      const entities = ds.filter((d) => d.check === kind).flatMap((d) => d.entities || []);
      const note = PLAN_REPAIRS[kind](beat, { sentence: sentences[i] || beat.scene_description || beat.headline || "", tier, entities });
      if (note) { notes.push(`${kind}: ${note}`); history.set(key, tier); }
    }
    if (!notes.length || JSON.stringify(beat) === JSON.stringify(out.beats[i])) continue;
    if (rebuildCanvas) beat.canvas = rebuildCanvas(beat);
    out.beats[i] = beat;
    applied.push({ beat_index: i, scope: "plan", notes });
  }
  return { plan: out, applied, changed: applied.length > 0 };
}

/** SRT repair: every cue ends before the next starts, after it starts, and by the video's end. Returns {text, changed, fixes}. */
export function clampSrt(text, videoDuration = null) {
  const cues = parseSrt(text);
  const fixes = [];
  cues.forEach((c, i) => {
    const next = cues[i + 1];
    if (next && c.end > next.start) { fixes.push(`cue ${i + 1} end ${c.end.toFixed(3)} -> ${next.start.toFixed(3)}`); c.end = next.start; }
    if (videoDuration != null && c.end > videoDuration) { fixes.push(`cue ${i + 1} end -> ${videoDuration.toFixed(3)}`); c.end = videoDuration; }
    if (c.end <= c.start) { const e = Math.min(c.start + 0.2, next ? next.start : c.start + 0.2); fixes.push(`cue ${i + 1} zero-length -> ${(e - c.start).toFixed(3)}s`); c.end = e; }
  });
  const ts = (s) => { const ms = Math.round(s * 1000); const p = (n, w = 2) => String(n).padStart(w, "0"); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
  const out = cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}`).join("\n\n") + "\n";
  return { text: out, changed: fixes.length > 0, fixes };
}

/** Post repair: true-peak limit the MP4's audio in place (video stream copied, not re-encoded). */
export function limitAudio(videoPath, { limitDb = -1 } = {}) {
  const tmp = videoPath.replace(/\.mp4$/, ".qa-limited.mp4");
  const lin = Math.pow(10, limitDb / 20).toFixed(4);
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", videoPath, "-c:v", "copy", "-af", `alimiter=limit=${lin}:level=disabled`, "-c:a", "aac", "-b:a", "192k", tmp], { encoding: "utf8" });
  if (r.status !== 0) return { changed: false, error: (r.stderr || "").slice(0, 200) };
  renameSync(tmp, videoPath);
  return { changed: true };
}
