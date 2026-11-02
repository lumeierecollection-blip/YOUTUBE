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
 */
import { frames, textLayer, solidLayer, imageLayer, svgLayer } from "./coverage-layers.mjs";
import {
  scrimLayer, creditLayer, labelLayers,
  dateDiagram, versionDiagram, numberDiagram, clockDiagram,
  relationDiagram, causalDiagram, pleaDiagram, flowDiagram,
  negotiationDiagram, aiDiagram, labelCard,
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

/** Resolve a beat's concepts into assets (image assets) and diagram specs. */
async function resolveBeatAssets(beat, { resolveAsset, screenshot, pdftoppm, askVision }) {
  const assets = {};
  const diagrams = []; // { builder, args, rect, z }
  let photoAsset = null;

  for (const c of beat.concepts) {
    if (c.essential === false) continue;
    const visual = c.visual;
    if (visual === "diagram" || visual === "annotated" || visual === "figure") {
      // These are drawn by the renderer as SVG layers, not image files.
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

  // ── background solid (always, so nothing is ever transparent/blank)
  layers.push(solidLayer({ id: `beat-${beat.id}-bg`, rect: { x: 0, y: 0, w: W, h: H }, background: BG, inF, outF, z: z++, opacity: 1 }));

  // ── photo / document base layer
  let photoRect = null;
  if (photoAsset && photoAsset.file) {
    const rect = beat.composition === "portrait" ? { x: 130, y: 300, w: 820, h: 1000 } : { x: 0, y: 0, w: W, h: H };
    photoRect = rect;
    layers.push(imageLayer({ id: `beat-${beat.id}-image`, assetId: photoAsset.id, rect, fit: beat.composition === "portrait" ? "contain" : "cover", inF, outF, z: z++, motion: beat.motion.type === "push_in" || beat.motion.type === "push_out" ? beat.motion.type : "settle" }));
    // scrim behind labels so text reads at phone size
    if (beat.composition !== "diagram") {
      layers.push(scrimLayer({ id: `beat-${beat.id}-scrim`, rect: { x: 0, y: 0, w: W, h: H }, inF, outF, z: z++ }));
    }
    // credit tag (bottom-left)
    layers.push(creditLayer({ id: `beat-${beat.id}-credit`, text: photoAsset.credit, rect: { x: 60, y: 1660, w: 960, h: 40 }, inF, outF, z: z++, size: 14 }));
  }

  // ── concept labels (staggered, reading order)
  const labels = beat.concepts.filter((c) => c.essential !== false).map((c) => c.label);
  const labelRects = beat.concepts.filter((c) => c.essential !== false).map((c, k) => ({
    x: 90, y: photoRect ? (beat.composition === "portrait" ? 1420 + k * 110 : 980 + k * 120) : 400 + k * 130, w: 900, h: 110,
  }));
  layers.push(...labelLayers({ idBase: `beat-${beat.id}`, labels, rects: labelRects, inF, outF, z, size: 28, delay: 6 }));
  z += labels.length * 2 + 2;

  // ── diagram layers (drawn by the renderer; no image file)
  diagrams.forEach(({ concept }, d) => {
    const diag = diagramLayersFor(concept, { id: `beat-${beat.id}-diag-${d}`, inF, outF, z: z + d * 3, rect: photoRect || { x: 90, y: 400, w: 900, h: 1000 } });
    layers.push(...diag);
  });

  return { layers, z };
}

/** Build SVG diagram layers for one concept. */
function diagramLayersFor(concept, { id, inF, outF, z, rect }) {
  const kind = concept.diagram || "label";
  const label = concept.label;
  switch (kind) {
    case "date": return dateDiagram({ id, value: concept.value, label, inF, outF, z, rect });
    case "version": return versionDiagram({ id, a: label, b: "", inF, outF, z, rect });
    case "number": return numberDiagram({ id, number: concept.value, label, inF, outF, z, rect });
    case "clock": return clockDiagram({ id, positions: concept.value ? [concept.value] : [10, 2], label, inF, outF, z, rect });
    case "relation": return relationDiagram({ id, a: label, b: "", link: "", inF, outF, z, rect });
    case "causal": return causalDiagram({ id, cause: label, effect: "", inF, outF, z, rect });
    case "plea": return pleaDiagram({ id, label, inF, outF, z, rect });
    case "flow": return flowDiagram({ id, nodes: [label], link: "", inF, outF, z, rect });
    case "negotiation": return negotiationDiagram({ id, inF, outF, z, rect });
    case "ai": return aiDiagram({ id, inF, outF, z, rect });
    default: return labelCard({ id, text: label, inF, outF, z, rect: { x: 90, y: 600, w: 900, h: 340 } });
  }
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
