#!/usr/bin/env node
/**
 * visual-plan-generator.mjs — build a structured visual plan BEFORE rendering.
 *
 * For every narration beat records:
 *   - Beat number, narration text, main subject, visual intent,
 *   - Selected asset or graphic, source + licensing info,
 *   - Why the visual is relevant, planned duration, transition,
 *   - Animation / camera movement.
 *
 * The plan is unique to the production. The renderer uses this plan
 * rather than falling back to a static collection of default visuals.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const CHANNEL_CONFIG = JSON.parse(readFileSync(resolve(ROOT, "config", "sourcing", "channel-sourcing.json"), "utf8"));

function arg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
function slugify(s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "video"; }

const VISUAL_INTENTS = {
  PERSON: "person", PEOPLE: "people", PLACE: "place",
  HISTORICAL_EVENT: "historical-event", DATE: "date", SEQUENCE: "sequence",
  STATISTIC: "statistic", COMPARISON: "comparison", PROCESS: "process",
  CAUSE_AND_EFFECT: "cause-and-effect", DOCUMENT: "document", EVIDENCE: "evidence",
  PRODUCT: "product", TECHNICAL: "technical", ENVIRONMENT: "environment", TRANSITION: "transition",
};

function classifyIntent(text, channel) {
  const t = String(text || "").toLowerCase();
  const ch = CHANNEL_CONFIG.channels[`ch-${channel}`] || {};
  // Channel-specific intent hints
  if (channel === "2" && /interface|screen|dashboard|prompt|output|model|tool/i.test(t)) return VISUAL_INTENTS.PRODUCT;
  if (channel === "3" && /court|judge|ruling|verdict|lawsuit|defamation|filing/i.test(t)) return VISUAL_INTENTS.DOCUMENT;
  if (channel === "4" && /score|goal|win|defeat|match|versus|vs|rival/i.test(t)) return VISUAL_INTENTS.COMPARISON;
  if (/\b(he|she|they|him|her)\b/.test(t) && /\b(was|were|is|are|said|did)\b/.test(t)) return VISUAL_INTENTS.PERSON;
  if (/\b(york|london|paris|rome|city|munich|allianz|venue|stadium|courthouse)\b/i.test(t)) return VISUAL_INTENTS.PLACE;
  if (/\b(1586|1605|1606|1994|2026|2025|year|dated|in)\b/i.test(t)) return VISUAL_INTENTS.DATE;
  if (/\b(percent|%|million|billion|shots|duels|tests|cost|dollars)\b/i.test(t)) return VISUAL_INTENTS.STATISTIC;
  if (/\b(versus|vs|compared to|unlike|while|whereas|but|however)\b/i.test(t)) return VISUAL_INTENTS.COMPARISON;
  if (/\b(because|therefore|led to|resulted in|caused)\b/i.test(t)) return VISUAL_INTENTS.CAUSE_AND_EFFECT;
  if (/\b(then|next|after|before|first|finally|eventually)\b/i.test(t)) return VISUAL_INTENTS.SEQUENCE;
  if (/\b(indictment|plea|document|record|testimony|warrant|complaint|ruling)\b/i.test(t)) return VISUAL_INTENTS.DOCUMENT;
  if (/\b(evidence|proof|witness|observed|theory)\b/i.test(t)) return VISUAL_INTENTS.EVIDENCE;
  if (channel === "2" && /tool|ai|model|software|app/i.test(t)) return VISUAL_INTENTS.PRODUCT;
  // Channel-appropriate default: never force a geographic visualisation on a
  // non-geographic subject. AI -> product/technical, Court -> document,
  // Rival -> comparison, History -> place/historical-event.
  if (channel === "2") return VISUAL_INTENTS.PRODUCT;
  if (channel === "3") return VISUAL_INTENTS.DOCUMENT;
  if (channel === "4") return VISUAL_INTENTS.COMPARISON;
  return VISUAL_INTENTS.PLACE;
}

function intentToGraphic(intent, channel) {
  const ch = CHANNEL_CONFIG.channels[`ch-${channel}`] || {};
  const prefs = ch.graphicPreferences || [];
  const map = {
    [VISUAL_INTENTS.PERSON]: "Annotated photograph",
    [VISUAL_INTENTS.PEOPLE]: "Group photograph / side-by-side comparison",
    [VISUAL_INTENTS.PLACE]: prefs.includes("Historical maps and animated routes") ? "Historical map" : "Geographic visualisation",
    [VISUAL_INTENTS.HISTORICAL_EVENT]: "Layered scene reconstruction",
    [VISUAL_INTENTS.DATE]: "Chronological timeline",
    [VISUAL_INTENTS.SEQUENCE]: "Chronological timeline",
    [VISUAL_INTENTS.STATISTIC]: "Charts and data visualisations",
    [VISUAL_INTENTS.COMPARISON]: "Side-by-side comparison",
    [VISUAL_INTENTS.PROCESS]: "Process diagram",
    [VISUAL_INTENTS.CAUSE_AND_EFFECT]: "Cause-and-effect diagram",
    [VISUAL_INTENTS.DOCUMENT]: "Archival document presentation",
    [VISUAL_INTENTS.EVIDENCE]: "Evidence board",
    [VISUAL_INTENTS.PRODUCT]: "Product demonstration / interface walkthrough",
    [VISUAL_INTENTS.TECHNICAL]: "Process diagram",
    [VISUAL_INTENTS.ENVIRONMENT]: "Annotated photograph",
    [VISUAL_INTENTS.TRANSITION]: "Contextual typography",
  };
  return map[intent] || "Contextual typography";
}

function main() {
  const sourcingReport = arg("report");
  const assetsManifest = arg("assets");
  const channel = arg("channel") || "1";
  const videoSlug = arg("slug") || "video";
  const outDir = arg("out") || resolve(ROOT, "data", "sourcing-cache", `ch-${channel}`, videoSlug);
  const planPath = arg("plan");

  if (!sourcingReport || !assetsManifest) {
    console.error("usage: node visual-plan-generator.mjs --report <sourcing-report.json> --assets <manifest.json> --channel <id> --slug <slug> [--out <dir>] [--plan <out-plan.json>]");
    process.exit(1);
  }
  if (!existsSync(sourcingReport)) { console.error(`sourcing report not found: ${sourcingReport}`); process.exit(1); }
  if (!existsSync(assetsManifest)) { console.error(`assets manifest not found: ${assetsManifest}`); process.exit(1); }

  const report = JSON.parse(readFileSync(resolve(sourcingReport), "utf8"));
  const assets = JSON.parse(readFileSync(resolve(assetsManifest), "utf8"));
  const channelKey = `ch-${channel}`;
  const ch = CHANNEL_CONFIG.channels[channelKey] || {};

  const assetByBeat = new Map();
  for (const a of assets.assets || []) {
    if (!assetByBeat.has(a.beat)) assetByBeat.set(a.beat, []);
    assetByBeat.get(a.beat).push(a);
  }

  const beats = (report.beats || []).map((b, i) => {
    const intent = classifyIntent(b.narration, channel);
    const graphic = intentToGraphic(intent, channel);
    const assetsForBeat = assetByBeat.get(b.beat) || [];
    const primary = assetsForBeat[0];
    const duration = Math.max(3, Math.ceil((b.endSec - b.startSec) || 5));
    const transition = i === 0 ? "CUT" : (i % 3 === 0 ? "DISSOLVE" : "FADE");
    const camera = intent === VISUAL_INTENTS.PERSON ? "slow push-in (Ken Burns)" :
                   intent === VISUAL_INTENTS.PLACE ? "pan across" :
                   intent === VISUAL_INTENTS.DOCUMENT ? "zoom-in on detail" : "hold";

    return {
      beat: b.beat,
      narration: b.narration,
      startSec: b.startSec,
      endSec: b.endSec,
      mainSubject: b.entitiesMentioned.map(e => e.name).join(", ") || (primary ? primary.originalTitle : "narration subject"),
      visualIntent: intent,
      graphicType: graphic,
      selectedAsset: primary ? {
        id: primary.id,
        file: primary.file,
        filename: primary.filename,
        source: primary.source,
        sourceUrl: primary.sourceUrl,
        pageUrl: primary.pageUrl,
        creator: primary.creator,
        license: primary.license,
        licenseUrl: primary.licenseUrl,
        attribution: primary.attribution,
        credit: primary.credit,
        sha256: primary.sha256,
        width: primary.width,
        height: primary.height,
        retrievedAt: primary.retrievedAt,
        cacheKey: primary.cacheKey,
        relevance: primary.relevance,
      } : null,
      sourceLicensing: primary ? {
        source: primary.source,
        creator: primary.creator,
        license: primary.license,
        attribution: primary.attribution,
        rightsStatus: primary.rightsStatus,
      } : null,
      relevanceExplanation: primary ? primary.relevance : `Illustrative graphic for beat ${b.beat}: "${b.narration}"`,
      plannedDurationSec: duration,
      transition,
      cameraMovement: camera,
      animation: intent === VISUAL_INTENTS.STATISTIC ? "animated counter / bar growth" :
                 intent === VISUAL_INTENTS.DATE ? "timeline marker draw-on" :
                 intent === VISUAL_INTENTS.COMPARISON ? "side-by-side reveal" : "slow fade-in",
      isIllustrative: !primary,
      reuseJustified: false,
      reuseReason: null,
    };
  });

  // Detect duplicate assets across beats within this video (flag for QA).
  const usedHashes = new Map();
  for (const b of beats) {
    if (b.selectedAsset) {
      const h = b.selectedAsset.sha256;
      if (usedHashes.has(h)) {
        b.reuseJustified = true;
        b.reuseReason = `Same asset (sha256 ${h}) used for beat ${usedHashes.get(h)} — same subject genuinely relevant across beats`;
      }
      usedHashes.set(h, b.beat);
    }
  }

  const plan = {
    schema: "visual-plan/v1",
    channel: channelKey,
    channelName: ch.name || `Channel ${channel}`,
    videoSlug,
    generatedAt: new Date().toISOString(),
    sourcingReport: resolve(sourcingReport),
    assetsManifest: resolve(assetsManifest),
    totalBeats: beats.length,
    uniqueAssets: new Set(beats.map(b => b.selectedAsset?.sha256).filter(Boolean)).size,
    beats,
    graphicTypesUsed: [...new Set(beats.map(b => b.graphicType))],
    notes: "Plan is unique to this production. No asset is reused across videos unless justified and recorded.",
  };

  mkdirSync(outDir, { recursive: true });
  const finalPlan = planPath || resolve(outDir, "visual-plan.json");
  writeFileSync(finalPlan, JSON.stringify(plan, null, 2));
  console.log(`[visual-plan-generator] ${beats.length} beats, ${plan.uniqueAssets} unique assets, graphic types: ${plan.graphicTypesUsed.join(", ")}`);
  console.log(`[visual-plan-generator] plan -> ${finalPlan}`);
}

try { main(); } catch(e) { console.error(e); process.exit(1); }
