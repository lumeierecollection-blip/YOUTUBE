/**
 * SFX for the full-canvas renderer. PURE — no React — so it is unit-tested
 * (scripts/test-canvas-sfx.mjs) and render.js logs exactly what plays.
 *
 * The palette (2026-10-09, owner: "real CC0 sounds from a no-API-key library … no robotic /
 * synthesized sounds"): five RECORDED sounds from Remotion's SFX library, fetched on the runner by
 * scripts/sfx-cc0.mjs into public/sfx/cc0/ (source, author, licence per file there and in
 * cc0/CREDITS.json). The Kenney/OpenGameArt set this replaced included a single synthesized tone
 * (reveal.mp3, the hook "chime") and a looped tick train (number-roll.mp3); both are gone.
 *
 *   whoosh  cc0/whoosh.wav      -22 dB  a beat transition (air past a mic, 1bob)
 *   whip    cc0/whip.wav        -22 dB  a beat transition, the alternate (a racquet swing, JW_Audio)
 *   shutter cc0/shutter.wav     -20 dB  a photo or portrait arrives (a DSLR shutter, ristooooo1)
 *   swish   cc0/draw-knife.wav  -21 dB  a card arrives — title, chapter, definition, stat, number
 *   switch  cc0/switch.wav      -19 dB  a word entrance — the headline (or object) pops in
 *
 * Rules:
 *  - Silence is a sound. At most MAX_SFX per video, never two within MIN_GAP frames, and never a
 *    sound on three beats in a row — so the video always has quiet beats.
 *  - Transitions only where the composition FAMILY changes (PHOTO-* -> TYPE-*), never on a cut
 *    between two of the same kind; whoosh and whip alternate.
 *  - Never the same sound twice in a row.
 *  - Charts (DATA-FULL) animate silently — no word or object sound on a chart beat.
 *  - Alignment: a sound's measured PEAK lands on its visible event (opts.peaks, from
 *    cc0/CREDITS.json — the frame offset of the loudest sample). `eventFrame` is that visible event
 *    (a pop group settling in, or the cut), `atFrame` is when the file starts. Layer 1 sfx-rules
 *    holds |atFrame + peak - eventFrame| <= 100 ms.
 *  - Only files Gemini judged "recorded" may play (opts.recorded, from cc0/verdicts.json). A file
 *    that is robotic or unjudged is dropped and the drop is reported; render.js passes the set, so a
 *    run whose judge could not run plays no SFX rather than an unjudged one.
 *
 * Where it stops: the alignment is to the frame the renderer is TOLD the event is on (pop-groups.js
 * timing, the beat's start_frame); it is not measured from the mixed audio track, where the
 * voiceover sits on top.
 */
import { canvasLayout, normalizeCanvas } from "./canvas-layout.js";
import { popGroups, POP } from "./pop-groups.js";

export const SFX_PALETTE = Object.freeze({
  whoosh:  { file: "cc0/whoosh.wav",     db: -22 },
  whip:    { file: "cc0/whip.wav",       db: -22 },
  shutter: { file: "cc0/shutter.wav",    db: -20 },
  swish:   { file: "cc0/draw-knife.wav", db: -21 },
  switch:  { file: "cc0/switch.wav",     db: -19 },
});
export const MAX_SFX = 6;
export const MIN_GAP = 12;
export const ALIGN_MS = 100;
const PRIORITY = ["hook", "card", "photo", "transition", "word"];
const CARD_COMPS = new Set(["TYPE-TITLE", "TYPE-CHAPTER", "TYPE-DEFINITION", "NUMBER-STAT", "NUMBER-FULL"]);
const OBJECT_BOXES = ["cutout0", "map"];
const bandOf = (y) => (y < 620 ? "top" : "middle");
/** PHOTO-BAND -> PHOTO, TYPE-TITLE -> TYPE, MAP-CENTERED -> MAP. */
export const familyOf = (comp) => String(comp || "").split("-")[0];

/**
 * @param beats DirectedShorts canvas beats ({ start_frame, duration_frames, scene: { canvas } })
 * @param opts.peaks    { [file]: frames from the file's start to its loudest sample } (default 0)
 * @param opts.recorded Set of files judged "recorded"; when given, any other file is dropped
 * @returns {{ events: Array<{trigger, role, file, db, atFrame, eventFrame, peakFrames, beat, reason}>, dropped: string[] }}
 */
export function canvasSfxEvents(beats = [], opts = {}) {
  const peaks = opts.peaks || {};
  const recorded = opts.recorded || null;
  const cands = [];
  let prevFamily = null;
  beats.forEach((beat, i) => {
    const raw = beat?.scene?.canvas;
    if (!raw) { prevFamily = null; return; }
    const c = normalizeCanvas(raw, i);
    const L = canvasLayout(c);
    const fam = familyOf(L.composition);
    const groups = popGroups(c, L);
    const t0 = (beat.start_frame || 0) + (i > 0 ? POP.START : 0);
    const groupAt = (key) => groups.find((g) => g.key === key)?.at;
    // The visible event is the frame the group appears (its pop-in starts) — where the ear expects the hit.
    const add = (kind, role, eventFrame, reason) => cands.push({ kind, role, eventFrame: Math.round(eventFrame), beat: i, reason });
    if (i > 0 && prevFamily && fam !== prevFamily) add("transition", "whoosh", beat.start_frame || 0, `cut ${prevFamily} -> ${fam}`);
    prevFamily = fam;
    if (!groups.length) return;
    const first = Math.min(...groups.map((g) => g.at));
    if (CARD_COMPS.has(L.composition)) {
      add("card", "swish", t0 + first, `${L.composition} card arrives`);
      return;
    }
    if (L.composition === "DATA-FULL") return;
    if (L.boxes.photo || L.boxes.portrait) {
      const at = groupAt("photo") ?? groupAt(bandOf((L.boxes.photo || L.boxes.portrait).y));
      if (at !== undefined) add("photo", "shutter", t0 + at, `${L.boxes.photo ? "photo" : "portrait"} arrives`);
      return;
    }
    const hb = L.boxes.headline || L.boxes.statement;
    const ob = OBJECT_BOXES.find((k) => L.boxes[k]);
    const box = hb || (ob && L.boxes[ob]);
    if (box) {
      const at = groupAt(bandOf(box.y + box.h / 2));
      if (at !== undefined) add(i === 0 ? "hook" : "word", "switch", t0 + at, hb ? "headline words pop in" : `${ob === "map" ? "map" : "object"} pops in`);
    }
  });

  const dropped = [];
  const why = (e, w) => dropped.push(`${e.role} @${e.eventFrame} (beat ${e.beat}: ${e.reason}) — ${w}`);
  const rank = (e) => PRIORITY.indexOf(e.kind);
  // 1. Where two would sound within MIN_GAP frames, the higher priority keeps the moment.
  //    Transitions take at most half the cap, so a video is not all whooshes.
  const ordered = [...cands].sort((a, b) => rank(a) - rank(b) || a.eventFrame - b.eventFrame);
  let kept = [], transitions = 0;
  for (const e of ordered) {
    const near = kept.find((k) => Math.abs(k.eventFrame - e.eventFrame) < MIN_GAP);
    if (near) { why(e, `within ${MIN_GAP} frames of ${near.role} @${near.eventFrame}`); continue; }
    if (e.kind === "transition" && transitions >= MAX_SFX / 2) { why(e, `transitions are at most ${MAX_SFX / 2} a video`); continue; }
    if (e.kind === "transition") transitions++;
    kept.push(e);
  }
  kept.sort((a, b) => a.eventFrame - b.eventFrame);
  // 2. Transitions alternate whoosh / whip.
  let alt = 0;
  for (const e of kept) if (e.kind === "transition") e.role = alt++ % 2 ? "whip" : "whoosh";
  // 3. Only judged-recorded files; a transition whose sound was not judged recorded takes the other.
  if (recorded) {
    kept = kept.filter((e) => {
      if (recorded.has(SFX_PALETTE[e.role].file)) return true;
      const other = e.role === "whoosh" ? "whip" : e.role === "whip" ? "whoosh" : null;
      if (other && recorded.has(SFX_PALETTE[other].file)) { e.role = other; return true; }
      why(e, `${SFX_PALETTE[e.role].file} not judged "recorded"`);
      return false;
    });
  }
  // 4. In time order: never the same sound twice in a row; never a sound on three beats in a row
  //    (the later, lower-priority one stays silent).
  let out = [];
  for (const e of kept) {
    const prev = out[out.length - 1];
    if (prev && prev.role === e.role) { why(e, `same sound as the one before (${prev.role} @${prev.eventFrame})`); continue; }
    const beatsWith = new Set(out.map((x) => x.beat));
    if (beatsWith.has(e.beat - 1) && beatsWith.has(e.beat - 2) && !beatsWith.has(e.beat)) { why(e, "a sound on three beats in a row — this one stays silent"); continue; }
    out.push(e);
  }
  // 5. The cap: the lowest-priority, latest sounds go first.
  if (out.length > MAX_SFX) {
    const keep = new Set([...out].sort((a, b) => rank(a) - rank(b) || a.eventFrame - b.eventFrame).slice(0, MAX_SFX));
    for (const e of out) if (!keep.has(e)) why(e, `over the ${MAX_SFX}-per-video cap`);
    out = out.filter((e) => keep.has(e));
    // Removing one can make two equal sounds adjacent; drop the later of each such pair.
    out = out.filter((e, i, a) => { if (i > 0 && a[i - 1].role === e.role) { why(e, "same sound as the one before (after the cap)"); return false; } return true; });
  }
  const events = out.map((e) => {
    const spec = SFX_PALETTE[e.role];
    const peakFrames = Math.max(0, Math.round(peaks[spec.file] || 0));
    return { trigger: e.role, role: e.role, ...spec, atFrame: Math.max(0, e.eventFrame - peakFrames), eventFrame: e.eventFrame, peakFrames, beat: e.beat, reason: e.reason };
  });
  return { events, dropped };
}

/** Layer 1 sfx-rules on a render manifest's sfx list; returns the problems (empty = pass). */
export function sfxRuleProblems(sfx = [], { fps = 30, recorded = null } = {}) {
  const bad = [];
  const tol = (ALIGN_MS / 1000) * fps;
  sfx.forEach((e, i) => {
    if (recorded && !recorded.has(e.file)) bad.push(`${e.file} at beat ${e.beat} was not judged "recorded"`);
    if (typeof e.event_frame === "number") {
      const off = e.at_frame + (e.peak_frames || 0) - e.event_frame;
      if (Math.abs(off) > tol) bad.push(`${e.role} at beat ${e.beat}: peak ${Math.round((off / fps) * 1000)} ms off its event (max ${ALIGN_MS})`);
    } else bad.push(`${e.role} at beat ${e.beat}: no event frame recorded — alignment unknown`);
    if (i > 0 && sfx[i - 1].file === e.file) bad.push(`${e.role} twice in a row (beats ${sfx[i - 1].beat}, ${e.beat})`);
  });
  const beats = new Set(sfx.map((e) => e.beat));
  for (const b of beats) if (beats.has(b + 1) && beats.has(b + 2)) bad.push(`a sound on beats ${b}, ${b + 1} and ${b + 2} — no silence`);
  return bad;
}
