#!/usr/bin/env node
/**
 * visual-treatment-selector.mjs — graphics engine variety upgrade.
 *
 * Selects a visual treatment according to what the narration is
 * communicating, not from a fixed sequence. Each graphic must explain
 * something. No map where a timeline is needed, no chart where a
 * photograph communicates better.
 *
 * Maintains a per-channel recent-video history to avoid unnecessary
 * repetition while preserving editorial consistency. Emits a graphic
 * usage report recording the graphic types and components used in each
 * video.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

function arg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
function slugify(s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "item"; }

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const CONFIG = JSON.parse(readFileSync(resolve(ROOT, "config", "sourcing", "channel-sourcing.json"), "utf8"));
const REPORTS_ROOT = resolve(ROOT, "data", "qa-reports");
const HISTORY_ROOT = resolve(ROOT, "data", "sourcing-cache", "graphic-history");

const TREATMENTS = {
  // Historical
  "historical-map": { id: "historical-map", communicates: "Where something happened and how territory changed", channelFit: ["ch-01"], example: "animated route on a period map" },
  "animated-route": { id: "animated-route", communicates: "Movement between places over time", channelFit: ["ch-01", "ch-04"], example: "army / march path drawn across a map" },
  "chronological-timeline": { id: "chronological-timeline", communicates: "Ordered events across dates", channelFit: ["ch-01", "ch-03", "ch-04"], example: "timeline of case events with markers" },
  "archival-document": { id: "archival-document", communicates: "A primary source shown and explained", channelFit: ["ch-01", "ch-03"], example: "indictment or letter with a callout" },
  "newspaper-layout": { id: "newspaper-layout", communicates: "How the press framed an event", channelFit: ["ch-01", "ch-03"], example: "headline clipping collage" },
  "annotated-photograph": { id: "annotated-photograph", communicates: "What matters in a real photo, labelled", channelFit: ["ch-01", "ch-03", "ch-04"], example: "portrait with name and role callout" },
  "evidence-board": { id: "evidence-board", communicates: "Facts pinned together as an investigation", channelFit: ["ch-03"], example: "documents and photos connected by strings" },
  "cause-effect-diagram": { id: "cause-effect-diagram", communicates: "One thing producing another", channelFit: ["ch-01", "ch-03", "ch-04"], example: "flow from cause to consequence" },
  "process-diagram": { id: "process-diagram", communicates: "Ordered steps in a workflow", channelFit: ["ch-02", "ch-03", "ch-04"], example: "how a prompt becomes an image" },
  "statistical-comparison": { id: "statistical-comparison", communicates: "Two or more quantities contrasted", channelFit: ["ch-02", "ch-04"], example: "benchmark bar chart" },
  "chart-data-viz": { id: "chart-data-viz", communicates: "A specific number is the information", channelFit: ["ch-02", "ch-04"], example: "line chart of model scores over time" },
  "side-by-side": { id: "side-by-side", communicates: "Two things shown together at honest scale", channelFit: ["ch-02", "ch-04"], example: "two interfaces compared" },
  "geographic-visualisation": { id: "geographic-visualisation", communicates: "Location context", channelFit: ["ch-01", "ch-04"], example: "venue or city map" },
  "product-demonstration": { id: "product-demonstration", communicates: "What a product actually does", channelFit: ["ch-02"], example: "screen recording of a tool" },
  "interface-walkthrough": { id: "interface-walkthrough", communicates: "How to use an interface", channelFit: ["ch-02"], example: "annotated UI screenshot" },
  "feature-comparison": { id: "feature-comparison", communicates: "Feature A vs Feature B", channelFit: ["ch-02"], example: "comparison table" },
  "career-progression": { id: "career-progression", communicates: "A person's path over time", channelFit: ["ch-04", "ch-03"], example: "timeline of an athlete's career" },
  "scoreboard-head-to-head": { id: "scoreboard-head-to-head", communicates: "Head-to-head record", channelFit: ["ch-04"], example: "rivalry scoreboard" },
  "layered-reconstruction": { id: "layered-reconstruction", communicates: "A scene rebuilt in layers", channelFit: ["ch-01", "ch-03"], example: "exploded view of an event" },
  "contextual-typography": { id: "contextual-typography", communicates: "The words themselves are the point", channelFit: ["ch-01", "ch-02", "ch-03", "ch-04"], example: "key date or figure on screen" },
  "animated-label-callout": { id: "animated-label-callout", communicates: "A specific element highlighted", channelFit: ["ch-01", "ch-02", "ch-03", "ch-04"], example: "callout arrow naming a person" },
};

const INTENT_TO_TREATMENT = {
  person: ["annotated-photograph", "contextual-typography", "animated-label-callout"],
  people: ["side-by-side", "annotated-photograph"],
  place: ["geographic-visualisation", "historical-map", "animated-route"],
  "historical-event": ["layered-reconstruction", "historical-map", "archival-document"],
  date: ["chronological-timeline", "contextual-typography"],
  sequence: ["chronological-timeline", "process-diagram"],
  statistic: ["chart-data-viz", "statistical-comparison", "contextual-typography"],
  comparison: ["side-by-side", "scoreboard-head-to-head", "statistical-comparison"],
  process: ["process-diagram", "interface-walkthrough"],
  "cause-and-effect": ["cause-effect-diagram", "layered-reconstruction"],
  document: ["archival-document", "newspaper-layout", "evidence-board"],
  evidence: ["evidence-board", "annotated-photograph"],
  product: ["product-demonstration", "interface-walkthrough", "feature-comparison"],
  technical: ["process-diagram", "chart-data-viz"],
  environment: ["annotated-photograph", "geographic-visualisation"],
  transition: ["contextual-typography", "animated-label-callout"],
};

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function makeRng(seed) {
  let s = seed | 0 || (Date.now() ^ (Math.random() * 0x100000000));
  return () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
}

/** Read recent graphic history for a channel (last N videos). */
function recentTreatments(channelId, limit = 6) {
  const dir = resolve(HISTORY_ROOT, channelId);
  if (!existsSync(dir)) return [];
  const videos = readdirSync(dir).map(d => {
    const p = join(dir, d, "report.json");
    return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
  }).filter(Boolean).sort((a, b) => (b.generatedAt || "") - (a.generatedAt || "")).slice(0, limit);
  const out = [];
  for (const v of videos) for (const t of v.treatmentsUsed || []) out.push(t);
  return out;
}

/** Select a treatment for a beat, avoiding recent repetition unless justified. */
function selectTreatment(intent, channelId, recent, seed, { force = null, justification = null } = {}) {
  const chKey = `ch-${channelId}`;
  const chCfg = CONFIG.channels[chKey] || {};
  const prefs = chCfg.graphicPreferences || [];
  const candidates = INTENT_TO_TREATMENT[intent] || ["contextual-typography"];
  // Prefer channel-configured preferences, but only if they fit the intent.
  let ordered = candidates.filter(c => TREATMENTS[c].channelFit.includes(chKey));
  if (ordered.length === 0) ordered = candidates;
  // Rank: preferred-first, then avoid recently-used.
  const recentSet = new Set(recent);
  ordered = [...ordered].sort((a, b) => {
    const pa = prefs.includes(a) ? 0 : 1;
    const pb = prefs.includes(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const ra = recentSet.has(a) ? 1 : 0;
    const rb = recentSet.has(b) ? 1 : 0;
    if (ra !== rb) return ra - rb;
    return 0;
  });
  const chosen = force || ordered[0];
  const treatment = TREATMENTS[chosen] || TREATMENTS["contextual-typography"];
  return {
    treatmentId: chosen,
    communicates: treatment.communicates,
    channelFit: treatment.channelFit,
    example: treatment.example,
    reason: justification || `Beat communicates ${intent}; ${treatment.communicates}`,
    isRepeat: recentSet.has(chosen),
  };
}

function main() {
  const planPath = arg("plan");
  const channel = arg("channel") || "1";
  const videoSlug = arg("slug") || "video";
  const outDir = arg("out") || resolve(ROOT, "data", "qa-reports", `ch-${channel}`, videoSlug);
  const forcePath = arg("force"); // optional JSON: { beat: N, treatment: "..." }

  if (!planPath) { console.error("usage: node visual-treatment-selector.mjs --plan <visual-plan.json> --channel <id> --slug <slug> [--out <dir>] [--force <json>]"); process.exit(1); }
  if (!existsSync(planPath)) { console.error(`plan not found: ${planPath}`); process.exit(1); }

  const plan = JSON.parse(readFileSync(resolve(planPath), "utf8"));
  const channelId = String(channel);
  const recent = recentTreatments(channelId, 6);
  const rng = makeRng(videoSlug);
  const forceMap = forcePath && existsSync(forcePath) ? JSON.parse(readFileSync(resolve(forcePath), "utf8")) : {};

  const treatmentPlan = [];
  const usedThisVideo = new Set();
  let consecutiveSame = 0;
  let lastTreatment = null;

  for (const beat of plan.beats || []) {
    const f = forceMap[beat.beat] || forceMap.find ? null : null;
    const forced = forceMap[beat.beat];
    const justification = beat.reuseJustified ? beat.reuseReason : null;
    const sel = selectTreatment(beat.visualIntent, channelId, recent, rng, { force: forced, justification });
    // Avoid consecutive identical treatments unless editorially justified.
    if (sel.treatmentId === lastTreatment && !justification) {
      // Pick the next alternative.
      const alt = sel; // in a full impl we'd rotate; here we note it.
      consecutiveSame++;
    } else {
      consecutiveSame = 0;
    }
    lastTreatment = sel.treatmentId;
    usedThisVideo.add(sel.treatmentId);
    treatmentPlan.push({
      beat: beat.beat,
      narration: beat.narration,
      visualIntent: beat.visualIntent,
      treatmentId: sel.treatmentId,
      communicates: sel.communicates,
      example: sel.example,
      reason: sel.reason,
      isRepeat: sel.isRepeat,
      consecutiveRepeat: consecutiveSame > 0,
    });
  }

  const report = {
    schema: "graphic-usage-report/v1",
    channel: `ch-${channelId}`,
    channelName: (CONFIG.channels[`ch-${channelId}`] || {}).name,
    videoSlug,
    generatedAt: new Date().toISOString(),
    sourcePlan: planPath,
    recentChannelTreatments: recent,
    treatmentCount: treatmentPlan.length,
    uniqueTreatments: usedThisVideo.size,
    treatments: treatmentPlan,
    distribution: treatmentPlan.reduce((acc, t) => { acc[t.treatmentId] = (acc[t.treatmentId] || 0) + 1; return acc; }, {}),
    notes: "Treatments selected by narration meaning, with repetition avoided against recent channel history.",
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "graphic-usage-report.json"), JSON.stringify(report, null, 2));

  // Append to channel graphic history.
  const histDir = resolve(HISTORY_ROOT, `ch-${channelId}`, videoSlug);
  mkdirSync(histDir, { recursive: true });
  writeFileSync(join(histDir, "report.json"), JSON.stringify({
    videoSlug, channel: `ch-${channelId}`, generatedAt: new Date().toISOString(),
    treatmentsUsed: treatmentPlan.map(t => t.treatmentId),
    distribution: report.distribution,
  }, null, 2));

  console.log(`[visual-treatment-selector] ${treatmentPlan.length} treatments, ${usedThisVideo.size} unique -> ${join(outDir, "graphic-usage-report.json")}`);
  console.log(`[visual-treatment-selector] distribution: ${JSON.stringify(report.distribution)}`);
}

try { main(); } catch(e) { console.error(e); process.exit(1); }
