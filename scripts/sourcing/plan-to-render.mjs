#!/usr/bin/env node
/**
 * plan-to-render.mjs — convert a video-specific visual plan (from
 * visual-plan-generator.mjs) into the format consumed by the Remotion
 * render pipeline's `direct()` function (visual-director.js).
 *
 * The `direct()` function requires each beat directive to have either:
 *   - `mechanism` (one of: STATE_CHANGE, PHYSICAL_GROWTH, VISIBLE_CONSUMPTION,
 *     SURFACE_AND_BENEATH, PROPORTIONAL_OBJECTS, ACTION_CONSEQUENCE,
 *     EVIDENCE_FIGURE, TYPOGRAPHY)
 *   - or `visual_events` / `capabilities` / `compiledScene`
 *
 * This converter maps each beat's visualIntent + selectedAsset to a
 * mechanism and builds the corresponding objects/capabilities so the
 * renderer can draw the selected asset (photo, document, etc.) or a
 * meaningful illustrative graphic.
 *
 * Output: data/sourcing-cache/<channel>/<slug>/render-plan.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

function arg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
function slugify(s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "video"; }

// Valid scene primitives (from scene-primitives.js PRIMITIVES):
// block, stack, bar, vessel, document, grid, gauge, figure, counter,
// silhouette, icon, arrow, rule, library_shape, field, photo
const VALID_PRIMITIVES = new Set(["block", "stack", "bar", "vessel", "document", "grid", "gauge", "figure", "counter", "silhouette", "icon", "arrow", "rule", "library_shape", "field", "photo"]);

function validKind(kind) {
  return VALID_PRIMITIVES.has(kind) ? kind : "field";
}

// Where rendered-ready images are staged so Remotion's staticFile can serve them.
const PUBLIC_ASSET_DIR = join(ROOT, "public", "asset-library");
mkdirSync(PUBLIC_ASSET_DIR, { recursive: true });

const ASSET_STAGE = new Map(); // source filePath -> public asset-library path

function stageAsset(filePath) {
  if (ASSET_STAGE.has(filePath)) return ASSET_STAGE.get(filePath);
  const name = basename(filePath);
  const dst = join(PUBLIC_ASSET_DIR, name);
  if (!existsSync(dst)) {
    try { copyFileSync(filePath, dst); } catch (e) { /* asset may already exist */ }
  }
  ASSET_STAGE.set(filePath, `asset-library/${name}`);
  return `asset-library/${name}`;
}

/** Map visualIntent to a render mechanism. */
function intentToMechanism(intent, channel) {
  const ch = String(channel || "1");
  if (ch === "2") return "EVIDENCE_FIGURE";   // AI: product demonstrations
  if (ch === "3") return "EVIDENCE_FIGURE";   // Court: documents and evidence
  if (ch === "4") return "PROPORTIONAL_OBJECTS"; // Rivalries: comparisons
  const map = {
    "person": "EVIDENCE_FIGURE",
    "people": "EVIDENCE_FIGURE",
    "place": "EVIDENCE_FIGURE",
    "historical-event": "STATE_CHANGE",
    "date": "STATE_CHANGE",
    "sequence": "PROPORTIONAL_OBJECTS",
    "statistic": "EVIDENCE_FIGURE",
    "comparison": "PROPORTIONAL_OBJECTS",
    "process": "PROPORTIONAL_OBJECTS",
    "cause-and-effect": "ACTION_CONSEQUENCE",
    "document": "EVIDENCE_FIGURE",
    "evidence": "EVIDENCE_FIGURE",
    "product": "EVIDENCE_FIGURE",
    "technical": "PROPORTIONAL_OBJECTS",
    "environment": "EVIDENCE_FIGURE",
    "transition": "STATE_CHANGE",
  };
  return map[intent] || "EVIDENCE_FIGURE";
}

/** Build objects for a mechanism based on the asset and narration. */
function buildObjects(mechanism, beat, asset, channel) {
  const shortLabel = beat.mainSubject || "Subject";
  const assetLabel = asset ? (asset.label || asset.originalTitle || asset.filename || shortLabel) : shortLabel;
  const assetFile = asset ? asset.file : null;

  switch (mechanism) {
    case "EVIDENCE_FIGURE":
      return {
        figure: assetFile ? assetLabel : assetLabel,
        _assetFile: assetFile,
        _asset: asset,
      };
    case "PROPORTIONAL_OBJECTS":
      return {
        amount_a: assetFile ? shortLabel : shortLabel,
        amount_b: assetLabel,
        _assetFile: assetFile,
        _asset: asset,
      };
    case "ACTION_CONSEQUENCE":
      return {
        cause: shortLabel,
        effect: assetLabel,
        _assetFile: assetFile,
        _asset: asset,
      };
    case "STATE_CHANGE":
      return {
        label_a: shortLabel,
        label_b: assetFile ? assetLabel : shortLabel,
        _assetFile: assetFile,
        _asset: asset,
      };
    default:
      return { figure: assetLabel, _assetFile: assetFile, _asset: asset };
  }
}

/** Build capabilities for rendering an actual image asset. */
function buildCapabilities(mechanism, beat, asset, channel) {
  const caps = [];
  if (asset && asset.file) {
    const staged = stageAsset(asset.filePath || asset.file);
    // Use "photo" primitive for real image files (valid primitive)
    // Note: ComposedScene motion must be one of: appear, rise, grow, drain,
    // fill, fall, strike, split, count, reveal, hold. The Photo primitive's
    // own movement is set via obj.movement (push, drift-left, etc.).
    caps.push({
      kind: "photo",
      anchor: "center",
      motion: "appear",
      label: asset.label || asset.originalTitle || beat.mainSubject || "Subject",
      asset: staged,
      variant: "photo",
      movement: "push",
      scale: 1,
      credit: asset.attribution,
      source_url: asset.sourceUrl,
      license: asset.license,
    });
  }
  // Always add a field capability for narration text (valid primitive, not "text")
  caps.push({
    kind: validKind("field"),
    anchor: "bottom",
    motion: "fade_in",
    label: beat.narration ? beat.narration.slice(0, 80) : "",
    scale: 0.8,
  });
  return caps;
}

/** Build visual events for a mechanism. */
function buildVisualEvents(mechanism, beat, asset, channel) {
  const events = [];
  const label = beat.mainSubject || "Subject";
  if (asset && asset.file) {
    const staged = stageAsset(asset.filePath || asset.file);
    events.push({
      type: "appear",
      label: asset.label || asset.originalTitle || label,
      anchor: "center",
      motion: "appear",
      scale: 1,
      asset: staged,
      variant: "photo",
      movement: "push",
    });
  } else {
    events.push({
      type: "type",
      label: beat.narration ? beat.narration.slice(0, 80) : "",
      anchor: "bottom",
      motion: "fade_in",
    });
  }
  return events;
}

function main() {
  const planPath = arg("plan");
  const channel = arg("channel") || "1";
  const videoSlug = arg("slug") || "video";
  const outDir = arg("out") || resolve(ROOT, "data", "sourcing-cache", `ch-${channel}`, videoSlug);
  const outPath = arg("outpath") || resolve(outDir, "render-plan.json");

  if (!planPath) {
    console.error("usage: node plan-to-render.mjs --plan <visual-plan.json> --channel <id> --slug <slug> [--out <dir>] [--outpath <render-plan.json>]");
    process.exit(1);
  }
  if (!existsSync(planPath)) { console.error(`plan not found: ${planPath}`); process.exit(1); }

  const plan = JSON.parse(readFileSync(resolve(planPath), "utf8"));

  const renderBeats = (plan.beats || []).map((b, i) => {
    const mechanism = intentToMechanism(b.visualIntent, channel);
    const asset = b.selectedAsset || null;
    const objects = buildObjects(mechanism, b, asset, channel);
    const capabilities = buildCapabilities(mechanism, b, asset, channel);
    const visualEvents = buildVisualEvents(mechanism, b, asset, channel);

    let visualHeadline = "";
    if (asset && (asset.label || asset.originalTitle)) {
      visualHeadline = asset.label || asset.originalTitle;
    } else if (b.mainSubject) {
      visualHeadline = b.mainSubject;
    } else {
      visualHeadline = b.narration ? b.narration.split(" ").slice(0, 6).join(" ") + "…" : "Subject";
    }

    const directive = {
      index: i,
      mechanism,
      visual_headline: visualHeadline,
      reason: b.relevanceExplanation || `Beat ${b.beat}: ${b.visualIntent}`,
      objects,
      capabilities,
      visual_events: visualEvents,
      carries_forward: null,
      emotional_weight: "calm",
      variant: i % 6,
      visualIntent: b.visualIntent,
      graphicType: b.graphicType,
      _beatNumber: b.beat,
      _narration: b.narration,
      _startSec: b.startSec,
      _endSec: b.endSec,
      _plannedDurationSec: b.plannedDurationSec,
      _transition: b.transition,
      _cameraMovement: b.cameraMovement,
      _animation: b.animation,
      _isIllustrative: b.isIllustrative,
      _reuseJustified: b.reuseJustified,
      _reuseReason: b.reuseReason,
    };

    // If there's a real asset file, add a composition so the renderer
    // can draw the image using valid primitives.
    if (asset && asset.file) {
      const staged = stageAsset(asset.filePath || asset.file);
      const compLabel = asset.label || asset.originalTitle || b.mainSubject || "Subject";
      directive.composition = {
        objects: [
          {
            kind: validKind("photo"),
            anchor: "center",
            motion: "appear",
            label: compLabel,
            emphasis: true,
            scale: 1,
            asset: staged,
            variant: "photo",
            movement: "push",
            credit: asset.attribution,
            source_url: asset.sourceUrl,
            license: asset.license,
          },
        ],
      };
    }

    return directive;
  });

  const renderPlan = {
    schema: "render-plan/v1",
    sourcePlan: planPath,
    channel: `ch-${channel}`,
    videoSlug,
    generatedAt: new Date().toISOString(),
    totalBeats: renderBeats.length,
    beats: renderBeats,
    source: "plan-to-render converter",
    notes: "Converted from video-specific visual plan for Remotion render pipeline. Each beat has a mechanism and capabilities for rendering the selected asset.",
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(renderPlan, null, 2));
  console.log(`[plan-to-render] ${renderBeats.length} beats converted -> ${outPath}`);
  console.log(`[plan-to-render] mechanisms: ${renderBeats.map(b => b.mechanism).join(", ")}`);
  const withAssets = renderBeats.filter(b => b.objects._assetFile).length;
  console.log(`[plan-to-render] beats with real assets: ${withAssets}/${renderBeats.length}`);
  console.log(`[plan-to-render] staged ${ASSET_STAGE.size} unique image(s) to public/asset-library/`);
}

try { main(); } catch(e) { console.error(e); process.exit(1); }
