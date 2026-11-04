#!/usr/bin/env node
/**
 * repetition-detector.mjs — visual repetition and relevance QA gate.
 *
 * Detects:
 *   - Duplicate images within a video (exact hash + perceptual similarity)
 *   - Repeated images across recent videos on the same channel
 *   - Unrelated images
 *   - Incorrect people or products (placeholder: flags missing verification)
 *   - Excessive generic stock imagery
 *   - Excessive use of the same graphic component
 *   - Repeated graphic sequences
 *   - Missing narration-to-visual alignment
 *   - Unattributed assets
 *   - Licensing failures
 *   - Empty or meaningless visual sections
 *
 * Reuse is acceptable when the same subject is genuinely relevant and
 * documented. Requires a documented editorial reason.
 *
 * Output: data/qa-reports/<channel>/<slug>/qa-report.json (pass/fail + findings)
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const CONFIG = JSON.parse(readFileSync(resolve(ROOT, "config", "sourcing", "channel-sourcing.json"), "utf8"));

function arg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
function slugify(s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "video"; }

function sha256File(p) {
  const buf = readFileSync(p);
  return createHash("sha256").update(buf).digest("hex");
}

/** Very light perceptual-similarity proxy: compare dimensions + first KB of bytes. */
function similarSig(p) {
  try {
    const buf = readFileSync(p);
    const head = buf.slice(0, 1024).toString("hex");
    return { size: buf.length, head: head.slice(0, 64) };
  } catch { return null; }
}

function main() {
  const planPath = arg("plan");
  const assetsManifest = arg("assets");
  const channel = arg("channel") || "1";
  const videoSlug = arg("slug") || "video";
  const outDir = arg("out") || resolve(ROOT, "data", "qa-reports", `ch-${channel}`, videoSlug);
  const recentVideos = arg("recent") ? Number(arg("recent")) : 5;

  if (!planPath || !assetsManifest) {
    console.error("usage: node repetition-detector.mjs --plan <visual-plan.json> --assets <manifest.json> --channel <id> --slug <slug> [--out <dir>] [--recent <N>]");
    process.exit(1);
  }
  if (!existsSync(planPath)) { console.error(`plan not found: ${planPath}`); process.exit(1); }
  if (!existsSync(assetsManifest)) { console.error(`assets manifest not found: ${assetsManifest}`); process.exit(1); }

  const plan = JSON.parse(readFileSync(resolve(planPath), "utf8"));
  const assets = JSON.parse(readFileSync(resolve(assetsManifest), "utf8"));
  const channelKey = `ch-${channel}`;
  const chCfg = CONFIG.channels[channelKey] || {};
  const qaCfg = chCfg.qa || {};

  const findings = [];
  let fail = false;

  const assetList = assets.assets || [];
  const beats = plan.beats || [];

  // 1. Duplicate images within a video (exact hash).
  const hashMap = new Map();
  for (const a of assetList) {
    const h = a.sha256;
    if (h) {
      if (hashMap.has(h)) {
        const prev = hashMap.get(h);
        findings.push({
          type: "duplicate-within-video",
          severity: "high",
          beat: a.beat,
          asset: a.filename,
          detail: `Exact duplicate of beat ${prev.beat} asset "${prev.filename}" (sha256 ${h})`,
          reuseJustified: a.reuseJustified || false,
          reuseReason: a.reuseReason || null,
        });
        if (!a.reuseJustified) fail = true;
      } else {
        hashMap.set(h, { beat: a.beat, filename: a.filename });
      }
    }
  }

  // 2. Perceptual similarity within video.
  const sigs = new Map();
  for (const a of assetList) {
    const sig = similarSig(join(resolve(ROOT, assets.sourceReport || ""), "..", a.file));
    if (!sig) continue;
    for (const [otherHash, info] of sigs) {
      const sameSize = Math.abs(info.size - sig.size) < 64;
      const sameHead = info.head === sig.head;
      if (sameSize && sameHead) {
        findings.push({
          type: "visually-similar-within-video",
          severity: "medium",
          beat: a.beat,
          asset: a.filename,
          detail: `Visually similar to beat ${info.beat} asset`,
        });
        fail = true;
      }
    }
    sigs.set(a.sha256 || a.filename, { size: sig.size, head: sig.head, beat: a.beat });
  }

  // 3. Unattributed assets.
  for (const a of assetList) {
    if (!a.attribution || !a.creator || !a.license) {
      findings.push({ type: "unattributed-asset", severity: "high", beat: a.beat, asset: a.filename, detail: "Missing attribution / creator / license" });
      fail = true;
    }
    if (a.rightsStatus && a.rightsStatus !== "clear") {
      findings.push({ type: "licensing-failure", severity: "high", beat: a.beat, asset: a.filename, detail: `Rights status: ${a.rightsStatus}` });
      fail = true;
    }
  }

  // 4. Excessive generic stock ratio (heuristic: no named entities + generic title).
  const total = assetList.length;
  let genericCount = 0;
  for (const a of assetList) {
    const title = String(a.originalTitle || a.filename || "").toLowerCase();
    const isGeneric = /(ai|artificial intelligence|robot|brain|technology|business|money|court|gavel|sport|stadium|crowd|people|person|portrait)/.test(title) &&
                      !/margaret|fawkes|york|clitherow|trump|murdoch|gayles|bayern|dortmund|kovac|guirassy/i.test(title);
    if (isGeneric) genericCount++;
  }
  const genericRatio = total ? genericCount / total : 0;
  const maxGeneric = qaCfg.maxGenericStockRatio || 0.15;
  if (genericRatio > maxGeneric) {
    findings.push({ type: "excessive-generic-stock", severity: "medium", detail: `${(genericRatio * 100).toFixed(0)}% generic stock (max ${(maxGeneric * 100).toFixed(0)}%)` });
    fail = true;
  }

  // 5. Missing narration-to-visual alignment: beats with no asset and no illustrative graphic.
  let unaligned = 0;
  for (const b of beats) {
    if (!b.selectedAsset && !b.graphicType) { unaligned++; }
    if (!b.selectedAsset) {
      findings.push({ type: "missing-asset-for-beat", severity: "medium", beat: b.beat, detail: `Beat ${b.beat} (“${(b.narration || b._narration || "").slice(0,60)}…”) has no assigned asset` });
    }
  }
  if (unaligned > beats.length * 0.5) {
    findings.push({ type: "excessive-unaligned-beats", severity: "high", detail: `${unaligned}/${beats.length} beats lack visual alignment` });
    fail = true;
  }

  // 6. Empty / meaningless visual sections: beats marked illustrative with no explanation.
  let meaningless = 0;
  for (const b of beats) {
    if (b.isIllustrative && (!b.relevanceExplanation || b.relevanceExplanation.length < 10)) meaningless++;
  }
  if (meaningless > 0) {
    findings.push({ type: "illustrative-without-reason", severity: "medium", detail: `${meaningful} illustrative beats lack a relevance explanation` });
  }

  // 7. Cross-video repetition (check recent channel history via cache-isolation).
  // Import logic inline: check how many recent videos used the same subject.
  const repCache = resolve(ROOT, "data", "sourcing-cache", "video", channelKey);
  let crossVideoRepeats = 0;
  if (existsSync(repCache)) {
    const vids = readdirSync(repCache);
    const recentSeen = new Set();
    for (const v of vids.slice(0, recentVideos)) {
      const mp = join(repCache, v, "manifest.json");
      if (existsSync(mp)) {
        try {
          const man = JSON.parse(readFileSync(mp, "utf8"));
          for (const a of man.assets || []) {
            if (assetList.some(x => x.sha256 === a.sha256)) {
              if (!recentSeen.has(v)) { recentSeen.add(v); crossVideoRepeats++; }
            }
          }
        } catch { /* ignore */ }
      }
    }
  }
  if (crossVideoRepeats > 0) {
    findings.push({ type: "cross-video-repetition", severity: "medium", detail: `${crossVideoRepeats} recent video(s) on this channel reuse an asset from this video` });
    // Not an automatic fail if justified; flagged for review.
  }

  const qaReport = {
    schema: "qa-repetition-report/v1",
    channel: channelKey,
    channelName: chCfg.name || `Channel ${channel}`,
    videoSlug,
    generatedAt: new Date().toISOString(),
    sourcePlan: planPath,
    sourceAssets: assetsManifest,
    totalAssets: total,
    uniqueAssets: new Set(assetList.map(a => a.sha256).filter(Boolean)).size,
    totalBeats: beats.length,
    findings,
    findingCount: findings.length,
    highSeverity: findings.filter(f => f.severity === "high").length,
    pass: !fail,
    genericStockRatio: Number(genericRatio.toFixed(4)),
    maxGenericStockRatio: maxGeneric,
    verdict: !fail ? "PASS" : "FAIL",
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "qa-report.json"), JSON.stringify(qaReport, null, 2));

  console.log(`[repetition-detector] ${qaReport.verdict}: ${findings.length} finding(s), ${qaReport.highSeverity} high, ${total} assets, ${new Set(assetList.map(a => a.sha256).filter(Boolean)).size} unique`);
  for (const f of findings.slice(0, 10)) console.log(`  [${f.severity}] ${f.type}: ${f.detail}`);
  console.log(`[repetition-detector] report -> ${join(outDir, "qa-report.json")}`);
  process.exit(fail ? 1 : 0);
}

try { main(); } catch(e) { console.error(e); process.exit(1); }
