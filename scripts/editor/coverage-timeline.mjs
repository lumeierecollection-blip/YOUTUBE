/**
 * Build a persisted editor timeline from a coverage-plan beat.
 *
 * Input: one beat from buildCoveragePlan (start/end seconds, concepts,
 * visual_class, motion) plus resolved assets for its concepts.
 * Output: a full editor timeline (schemas/editor-timeline.json) whose layers
 * are the beat's composition: a photograph/document as the base, scrims for
 * legibility, staggered labels, credits, and SVG diagram layers that draw on
 * in the order the sentence explains them.
 *
 * Every layer has a stated start frame, end frame and motion reason. Nothing
 * decorative: no dot fields, no sweeps, no corner brackets, no grid drift.
 * Motion is purposeful: push_in/push_out for historical reveals, pan_left for
 * places, draw for diagrams, settle for documents/photos — matching the
 * beat.motion from the coverage plan. No unmotivated parallax.
 */
import { frames, textLayer, solidLayer, imageLayer, svgLayer } from "./coverage-layers.mjs";
import {
  scrimLayer, creditLayer, labelLayers,
  dateDiagram, versionDiagram, numberDiagram, clockDiagram,
  relationDiagram, causalDiagram, pleaDiagram, flowDiagram,
  negotiationDiagram, aiDiagram, labelCard, diagramLayersFor,
} from "./coverage-graphics.mjs";

const W = 1080, H = 1920, FPS = 30;
const BG = "#08090B";
const TEXT = "#F5EFE6";
const ACCENT = "#D4A574";
const FONT = "Cormorant Garamond";
const SANS = "Inter";

const palette = { bg: BG, text: TEXT, muted: "#B9B0A4", accent: ACCENT, accent2: "#7FA6A0" };
const fonts = { primary: FONT, sans: SANS };

function secF(sec) { return Math.max(0, Math.round(Number(sec || 0) * FPS)); }

/** Composition per visual class: each class gets a distinct layout so beats
 *  never look identical. Returns { photoRect, labelY, diagramX, diagramY }.
 */
function compRect(visualClass, hasPhoto) {
  switch (visualClass) {
    case "historical":
      return { photoRect: { x: 130, y: 300, w: 820, h: 1000 }, labelY: 1420, diagramX: 420, diagramY: 940 };
    case "document":
      return { photoRect: { x: 0, y: 0, w: W, h: H }, labelY: 1420, diagramX: null, diagramY: null };
    case "place":
      return { photoRect: { x: 0, y: 0, w: W, h: H }, labelY: 1420, diagramX: null, diagramY: null };
    case "entity":
      return { photoRect: { x: 540, y: 300, w: 460, h: 1000 }, labelY: 420, diagramX: null, diagramY: null };
    case "photo":
      return { photoRect: { x: 0, y: 0, w: W, h: H }, labelY: 1420, diagramX: null, diagramY: null };
    case "figure":
      return { photoRect: null, labelY: 940, diagramX: 300, diagramY: 940 };
    case "diagram":
      return { photoRect: { x: 130, y: 300, w: 820, h: 1000 }, labelY: 1420, diagramX: 300, diagramY: 1000 };
    default:
      return { photoRect: hasPhoto ? { x: 0, y: 0, w: W, h: H } : null, labelY: 980, diagramX: null, diagramY: null };
  }
}

/** Resolve a beat's concepts into assets (image assets) and diagram specs. */
async function resolveBeatAssets(beat, { resolveAsset, screenshot, pdftoppm, askVision }) {
  const assets = {};
  const diagrams = [];
  let photoAsset = null;

  for (const c of beat.concepts) {
    if (c.essential === false) continue;
    const visual = c.visual;
    if (visual === "diagram" || visual === "annotated" || visual === "figure") {
      diagrams.push({ concept: c });
      continue;
    }
    if (visual === "photo" || visual === "place" || visual === "entity" || visual === "historical" || visual === "document") {
      const resolved = await resolveAsset({ concept: c, research: beat.research || {}, channel: beat.channel || {}, screenshot, pdftoppm, askVision });
      if (resolved) {
        const id = `asset-${beat.id}-${c.id}`;
        assets[id] = { file: resolved.file, width: resolved.width, height: resolved.height, credit: resolved.credit, source_url: resolved.source_url, license: resolved.license };
        if (!photoAsset) photoAsset = { id, ...resolved, concept: c };
      }
    }
  }
  return { assets, diagrams, photoAsset };
}

/** Build layers for one beat. */
export async function beatLayers({ beat, assets, diagrams, photoAsset, inF, outF, zBase = 100 }) {
  const span = Math.max(1, outF - inF);
  const layers = [];
  let z = zBase;

  // Background solid (always, so nothing is ever transparent/blank)
  layers.push(solidLayer({ id: `beat-${beat.id}-bg`, rect: { x: 0, y: 0, w: W, h: H }, background: BG, inF, outF, z: z++, opacity: 1, keyframes: { opacity: [{ f: 0, v: 1, e: "outCubic" }, { f: span, v: 1, e: "inOutCubic" }], ty: [{ f: 0, v: 0, e: "outCubic" }, { f: span * 0.5, v: 100, e: "inOutCubic" }, { f: span, v: 0, e: "inOutCubic" }], tx: [{ f: 0, v: 0, e: "outCubic" }, { f: span * 0.5, v: 50, e: "inOutCubic" }, { f: span, v: 0, e: "inOutCubic" }] }}));

  // Photo / document base layer — composition varies by visual class
  const comp = compRect(beat.visual_class, !!photoAsset);
  let photoRect = null;
  if (photoAsset && photoAsset.file && comp.photoRect) {
    photoRect = comp.photoRect;
    layers.push(imageLayer({ id: `beat-${beat.id}-image`, assetId: photoAsset.id, rect: comp.photoRect, fit: beat.composition === "portrait" ? "contain" : "cover", inF, outF, z: z++, motion: beat.motion.type === "push_in" || beat.motion.type === "push_out" ? beat.motion.type : "settle" }));
    // Scrim behind labels so text reads at phone size
    if (beat.composition !== "diagram") {
      layers.push(scrimLayer({ id: `beat-${beat.id}-scrim`, rect: { x: 0, y: 0, w: W, h: H }, inF, outF, z: z++ }));
    }
    // Credit tag (bottom-left)
    layers.push(creditLayer({ id: `beat-${beat.id}-credit`, text: photoAsset.credit, rect: { x: 60, y: 1660, w: 960, h: 40 }, inF, outF, z: z++, size: 14 }));
  }

  // Concept labels (staggered, reading order)
  const labels = beat.concepts.filter((c) => c.essential !== false).map((c) => c.label);
  const labelRects = beat.concepts.filter((c) => c.essential !== false).map((c, k) => ({
    x: 90, y: comp.labelY + k * 110, w: 900, h: 110,
  }));
  layers.push(...labelLayers({ idBase: `beat-${beat.id}`, labels, rects: labelRects, inF, outF, z, size: 28, delay: 6 }));
  z += labels.length * 2 + 2;

  // Diagram layers (drawn by the renderer; no image file)
  diagrams.forEach(({ concept }, d) => {
    const diag = diagramLayersFor(concept, { id: `beat-${beat.id}-diag-${d}`, inF, outF, z: z + d * 3, rect: comp.diagramX ? { x: comp.diagramX, y: comp.diagramY, w: 700, h: 700 } : null });
    layers.push(...diag);
  });

  return { layers, z };
}

/** Caption cues for a beat, timed to its span. */
export function beatCaptions(beat, captions) {
  const startF = secF(beat.start);
  const endF = secF(beat.end);
  return captions.map((c) => ({
    start_f: Math.max(startF, Math.min(endF - 1, secF(c.start))),
    end_f: Math.max(startF + 1, Math.min(endF, secF(c.end))),
    text: c.text,
    words: (c.words || []).map((w) => ({ text: w.text, start_f: Math.max(startF, Math.min(endF - 1, secF(w.start))) })),
  }));
}

/**
 * Build the full coverage timeline for one script.
 *
 * plan: output of buildCoveragePlan ({ sentences, beats, concepts, report })
 * assetsByBeat: map beat.id -> { assets, diagrams, photoAsset } (from resolveBeatAssets)
 * captions: caption cues from buildCaptions (one per sentence)
 * audioDuration: seconds
 */
export async function buildCoverageTimeline({ plan, assetsByBeat, captions = [], audioDuration, channel, sourceScript, sourceAudio }) {
  const duration = Math.max(0.1, Number(audioDuration || 0));
  const durationInFrames = Math.max(1, Math.round(duration * FPS));
  const beats = plan.beats || [];
  const allLayers = [];
  const allAssets = {};
  let z = 100;

  for (const beat of beats) {
    const inF = secF(beat.start);
    const outF = Math.min(durationInFrames, secF(beat.end));
    if (outF <= inF) continue;
    const resolved = assetsByBeat[beat.id] || { assets: {}, diagrams: [], photoAsset: null };
    Object.assign(allAssets, resolved.assets);
    const r = await beatLayers({ beat, assets: resolved.assets, diagrams: resolved.diagrams, photoAsset: resolved.photoAsset, inF, outF, zBase: z });
    r.layers.forEach((l) => { l.z = (l.z || 0) + z; allLayers.push(l); });
    z += 60;
  }

  const cues = [];
  for (const beat of beats) {
    const beatCap = captions[beat.sentence];
    cues.push(...beatCaptions(beat, beatCap ? [beatCap] : []));
  }
  // dedupe & sort
  const seen = new Set();
  const uniqueCues = cues.filter((c) => {
    const key = `${c.start_f}|${c.end_f}|${c.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.start_f - b.start_f);

  return {
    version: 1,
    id: `coverage-${plan.sentences[0]?.index === undefined ? "script" : plan.sentences[0].index}`,
    title: `Coverage timeline`,
    width: W, height: H, fps: FPS, durationInFrames,
    palette, fonts,
    caption_style: { x: 80, y: 1540, w: 920, h: 210, size: 38 },
    assets: allAssets,
    layers: allLayers.sort((a, b) => a.z - b.z),
    captions: uniqueCues,
    metadata: {
      generated_at: new Date().toISOString(),
      generator: "scripts/editor/coverage-timeline.mjs",
      source_script: sourceScript || null,
      source_audio: sourceAudio || null,
      beat_count: beats.length,
      unique_assets: Object.keys(allAssets).length,
    },
  };
}
