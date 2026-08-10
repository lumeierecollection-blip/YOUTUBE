/**
 * Pipeline Orchestrator — Runs the full daily pipeline for a channel.
 *
 * Usage: node src/utils/pipeline.js <channel-id> [--dry-run] [--step <n>]
 *
 * Steps:
 *  1. Deep Research — pick topic from content pillars, research deeply
 *  2. Trend Research — check YouTube trends (needs API)
 *  3. Script Writer — produce Shorts + long-form scripts
 *  4. TTS — generate voiceover with EdgeTTS
 *  5. SEO — generate optimized metadata (title, desc, tags, chapters, hashtags)
 *  6. End Screen — generate end screen + card configs
 *  7. Branding — apply channel visual identity
 *  8. Copyright — pre-upload scan for copyrighted material
 *  9. Captions — validate and format subtitles (BBC/Netflix standards)
 * 10. Thumbnail — generate thumbnail spec
 * 11. VFX Audit — validate visual effects against checklist
 * 12. SFX — source sound effects from library
 * 13. Disclosure — AI disclosure compliance check
 * 14. Quality Gate — inauthentic content mitigation
 * 15. Render — produce video files with Remotion (optimized settings)
 * 16. Publish — upload to YouTube as private, auto-publish after 1hr
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..");

const require = createRequire(import.meta.url);
const topicLog = require("./topic-log.cjs");

// ─── Imports ───
import { generateSEO } from "./seo.js";
import { generateEndScreen } from "./endscreen.js";
import { generateBrandingSpec } from "./branding.js";
import { preUploadChecklist } from "./copyright-check.js";
import { parseSRT, validateCaptions } from "./captions.js";
import { assessDisclosureNeeds } from "./disclosure.js";
import { generateQualityReport } from "./quality-gate.js";
import { generateRenderSettings } from "./render-settings.js";

function log(step, msg, status = "info") {
  const icons = { info: "▸", ok: "✓", warn: "⚠", err: "✗", skip: "○" };
  console.log(`[${step}] ${icons[status] || "▸"} ${msg}`);
}

function run(cmd, cwd) {
  try {
    execSync(cmd, { cwd, stdio: "pipe", timeout: 300000 });
    return true;
  } catch (err) {
    return false;
  }
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// b-roll-manifest-<channel_id>.json is keyed by channel slot, not by topic —
// channels get reused across topics over time (and b-roll-manifest-ch-01.json
// is in fact stale leftover from a topic this channel no longer covers).
// Only trust it when its own topic_slug matches the video actually being
// checked, otherwise a copyright/disclosure/quality gate would silently
// attach a completely unrelated video's assets.
function loadTopicBrollManifest(channel, topicSlug) {
  if (!topicSlug) return null;
  const manifestPath = join(ROOT, "src", "skills", "remotion-render", `b-roll-manifest-${channel.channel_id}.json`);
  if (!existsSync(manifestPath)) return null;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    return manifest.topic_slug === topicSlug ? manifest : null;
  } catch (e) {
    return null;
  }
}

const TOPIC_LOG_SKIP = /(seo|endscreen|branding|disclosure|quality|render-settings|pipeline-report|copyright|next-topic|tts-manifest|community|-script\.json$)/i;

// Collects real research topics (not derived files like seo/scripts) from a channel's research dir.
function collectResearchTopics(researchDir) {
  if (!existsSync(researchDir)) return [];
  const topics = [];
  const files = readdirSync(researchDir).filter((f) => f.endsWith(".json") && !TOPIC_LOG_SKIP.test(f));
  for (const f of files) {
    try {
      const j = JSON.parse(readFileSync(join(researchDir, f), "utf-8"));
      const t = (j.topic || j.title || "").trim();
      if (t) topics.push(t);
    } catch (e) {}
  }
  return topics;
}

// Resolves the topic the metadata steps (5/6) should target: preferred (step 1),
// then next-topic.json, then the latest research file.
function resolveCurrentTopic(researchDir, preferred) {
  if (preferred) {
    const slug = preferred.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return { topic: preferred, slug };
  }
  const ntPath = join(researchDir, "next-topic.json");
  if (existsSync(ntPath)) {
    try {
      const nt = JSON.parse(readFileSync(ntPath, "utf-8"));
      if (nt.topic) return { topic: nt.topic, slug: nt.slug };
    } catch (e) {}
  }
  const topics = collectResearchTopics(researchDir);
  if (topics.length > 0) {
    const last = topics[topics.length - 1];
    return { topic: last, slug: last.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") };
  }
  return null;
}

function main() {
  const channelId = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  const stepFilter = process.argv.includes("--step")
    ? parseInt(process.argv[process.argv.indexOf("--step") + 1])
    : null;

  if (!channelId) {
    console.error("Usage: node pipeline.js <channel-id> [--dry-run] [--step <n>]");
    process.exit(1);
  }

  // Load channel config
  const channelsPath = join(ROOT, "config", "channels.json");
  const data = JSON.parse(readFileSync(channelsPath, "utf-8"));
  const channels = data.channels || data;
  const numId = parseInt(channelId, 10);
  const channel = channels.find((c) => c.id === numId || c.channel_id === channelId);
  if (!channel) {
    console.error(`Channel "${channelId}" not found`);
    process.exit(1);
  }

  // Ensure output directories
  const dirs = {
    research: join(ROOT, "data", "research", channelId),
    tts: join(ROOT, "data", "tts", channelId),
    thumbnails: join(ROOT, "data", "thumbnails", channelId),
    renders: join(ROOT, "data", "renders", channelId),
    community: join(ROOT, "data", "community", channelId),
  };
  Object.values(dirs).forEach(ensureDir);

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  PIPELINE: ${channel.channel_name} (#${channel.id})`);
  console.log(`  Niche: ${channel.niche}${channel.niche_sub ? ` / ${channel.niche_sub}` : ""}`);
  console.log(`  Style: ${channel.style}`);
  console.log(`  Tone: ${channel.tone}`);
  console.log(`  Voice: ${channel.tts_voice || "en-US-GuyNeural"}`);
  console.log(`  Dry Run: ${dryRun}`);
  if (stepFilter) console.log(`  Starting at Step: ${stepFilter}`);
  console.log(`═══════════════════════════════════════════\n`);

  const report = {
    channel_id: channelId,
    started_at: new Date().toISOString(),
    steps: {},
    errors: [],
    warnings: [],
  };

  function shouldRun(step) {
    return !stepFilter || step >= stepFilter;
  }

  // ═══════════════════════════════════════════════════════
  // STEP 1: Deep Research
  // ═══════════════════════════════════════════════════════
  if (shouldRun(1)) {
    log("1", "Deep Research", "info");
    const researchDir = join(ROOT, "data", "research", channelId);
    const topics = collectResearchTopics(researchDir);

    let selected = null;
    let source = null;
    let skipCount = 0;

    // Prefer an existing research topic that has not been used yet.
    const candidates = topics.filter((t) => {
      const dup = topicLog.isDuplicate(channelId, t);
      if (dup) skipCount++;
      return !dup;
    });
    const researchPick = topicLog.pickNextTopic(channelId, candidates);
    if (researchPick) {
      selected = researchPick;
      source = "research";
    }

    // Otherwise rotate to the next unused content pillar (agent researches it fresh).
    if (!selected) {
      const pillars = (channel.content_pillars || []).map((p) => p.replace(/^(the|a|an)\s+/i, ""));
      const pillarPick = topicLog.pickNextTopic(channelId, pillars);
      if (pillarPick) {
        selected = pillarPick;
        source = "content-pillar";
      }
    }

    if (selected) {
      const slug = topicLog.slugify(selected);
      const ntPath = join(researchDir, "next-topic.json");
      if (!dryRun) {
        topicLog.reserveTopic(channelId, selected, { channel_name: channel.channel_name, niche: channel.niche });
        writeFileSync(
          ntPath,
          JSON.stringify(
            {
              channel_id: channelId,
              selected_at: new Date().toISOString(),
              topic: selected,
              slug,
              source,
              status: "next-up",
              note: "Reserved in data/topic-log.json. Run deep-research on THIS topic, then script-writer.",
            },
            null,
            2
          )
        );
      }
      log("1", `Next topic: "${selected}"`, "ok");
      log("1", `Source: ${source}${skipCount > 0 ? ` — ${skipCount} duplicate(s) skipped` : ""}`, "info");
      if (!dryRun) log("1", `Reserved in topic-log; saved ${ntPath}`, "info");
      else log("1", "Dry run — topic selected but not reserved", "info");
    } else {
      log("1", "No unused topics available — expand content_pillars in channels.json", "warn");
      report.warnings.push("Step 1: all content pillars exhausted");
    }

    report.steps[1] = { status: selected ? "ok" : "pending", topic: selected, source, reserved: !dryRun && !!selected };
  }

  // ═══════════════════════════════════════════════════════
  // STEP 2: Trend Research
  // ═══════════════════════════════════════════════════════
  if (shouldRun(2)) {
    log("2", "Trend Research", "info");
    const apiAvailable = channel.youtube_channel_id && channel.youtube_channel_id !== "SET_ME";
    if (apiAvailable) {
      log("2", "API available — fetching trends", "info");
      const ok = run(`node src/skills/trend-research/run.js ${channelId}`, ROOT);
      log("2", ok ? "Trends fetched" : "Trend fetch failed", ok ? "ok" : "warn");
      report.steps[2] = { status: ok ? "ok" : "failed" };
    } else {
      log("2", "API not configured — using content pillars", "skip");
      report.steps[2] = { status: "skipped", reason: "no API" };
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP 3: Script Writer
  // ═══════════════════════════════════════════════════════
  if (shouldRun(3)) {
    log("3", "Script Writer", "info");
    const scriptsDir = join(ROOT, "data", "research", channelId);
    if (existsSync(scriptsDir)) {
      const scripts = readdirSync(scriptsDir).filter(
        (f) => f.includes("script") && (f.endsWith(".txt") || f.endsWith(".md") || f.endsWith(".json"))
      );
      if (scripts.length > 0) {
        log("3", `Found ${scripts.length} script(s)`, "ok");
        scripts.slice(-3).forEach((s) => log("3", `  ${s}`, "info"));
        report.steps[3] = { status: "ok", count: scripts.length };
      } else {
        log("3", "No scripts yet — run script-writer", "warn");
        report.steps[3] = { status: "pending" };
        report.warnings.push("Step 3: No scripts generated yet");
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP 4: TTS (EdgeTTS)
  // ═══════════════════════════════════════════════════════
  if (shouldRun(4)) {
    log("4", "TTS (EdgeTTS)", "info");
    const ttsDir = join(ROOT, "data", "tts", channelId);
    if (existsSync(ttsDir)) {
      const audioFiles = readdirSync(ttsDir).filter((f) => f.endsWith(".mp3"));
      const srtFiles = readdirSync(ttsDir).filter((f) => f.endsWith(".srt"));
      log("4", `Audio: ${audioFiles.length} file(s), SRT: ${srtFiles.length} file(s)`,
        audioFiles.length > 0 ? "ok" : "warn");
      report.steps[4] = { status: audioFiles.length > 0 ? "ok" : "pending", audio: audioFiles.length, srt: srtFiles.length };
    } else {
      log("4", "No TTS output yet", "warn");
      report.steps[4] = { status: "pending" };
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP 5: SEO Metadata
  // ═══════════════════════════════════════════════════════
  if (shouldRun(5)) {
    log("5", "SEO Metadata", "info");

    // Find topic: use step 1's selected topic, then next-topic.json, then latest research file
    const current = resolveCurrentTopic(dirs.research, report.steps[1]?.topic);
    const topic = current?.topic || "Unknown Topic";
    const topicSlug = current?.slug || topic.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const seoPath = join(dirs.research, `${topicSlug}-seo.json`);

    // Chapters are derived from the script's real sections (LONGFORM-SPEC.md
    // Rule 1.5) — find whichever format was generated for this topic today,
    // preferring longform (Mon/Wed/Fri) since it's the one that ships chapters.
    const scriptCandidates = [`${topicSlug}-longform-script.json`, `${topicSlug}-shorts-script.json`, `${topicSlug}-script.json`]
      .map((f) => join(dirs.research, f))
      .filter(existsSync);
    const scriptForSeo = scriptCandidates[0] ? JSON.parse(readFileSync(scriptCandidates[0], "utf-8")) : null;

    if (existsSync(seoPath)) {
      log("5", "SEO metadata already exists", "ok");
      report.steps[5] = { status: "ok", cached: true };
    } else if (!scriptForSeo) {
      log("5", "No script found for this topic yet — SEO needs real sections, run Stage C first", "warn");
      report.steps[5] = { status: "pending" };
      report.warnings.push("Step 5: no script available to derive chapters from");
    } else if (!dryRun) {
      try {
        const sections = scriptForSeo.sections || [];
        const totalWords = sections.reduce((sum, s) => sum + String(s.voiceover || "").split(/\s+/).filter(Boolean).length, 0);
        const wpm = { "cinematic-documentary": 135, "motion-graphics": 155, minimal: 165 }[channel.style] || 150;
        const totalDuration = (totalWords / wpm) * 60;
        const seoData = generateSEO(topic, channel, sections, totalDuration);
        writeFileSync(seoPath, JSON.stringify(seoData, null, 2));
        log("5", `Generated: title="${seoData.title}"`, "ok");
        log("5", `Tags: ${seoData.tags?.length || 0}, Chapters: ${seoData.chapters?.length || 0}`, "info");
        report.steps[5] = { status: "ok", title: seoData.title };
      } catch (err) {
        log("5", `SEO generation failed: ${err.message}`, "err");
        report.steps[5] = { status: "failed", error: err.message };
        report.errors.push(`Step 5: ${err.message}`);
      }
    } else {
      log("5", "Dry run — skipping SEO generation", "skip");
      report.steps[5] = { status: "skipped" };
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP 6: End Screen & Cards
  // ═══════════════════════════════════════════════════════
  if (shouldRun(6)) {
    log("6", "End Screen & Cards", "info");
    const current6 = resolveCurrentTopic(dirs.research, report.steps[1]?.topic);
    const topic6 = current6?.topic || "Unknown Topic";
    const topicSlug6 = current6?.slug || topic6.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const endscreenPath = join(dirs.research, `${topicSlug6}-endscreen.json`);

    if (existsSync(endscreenPath)) {
      log("6", "End screen config already exists", "ok");
      report.steps[6] = { status: "ok", cached: true };
    } else if (!dryRun) {
      try {
        const endscreenData = generateEndScreen(topic6, channel);
        writeFileSync(endscreenPath, JSON.stringify(endscreenData, null, 2));
        log("6", `Generated end screen: ${endscreenData.end_screen?.elements?.length || 0} elements`, "ok");
        const ctaSample = endscreenData.end_screen?.verbal_cta?.script_patterns?.[0] || "";
        log("6", `Verbal CTA: "${ctaSample.substring(0, 50)}..."`, "info");
        report.steps[6] = { status: "ok" };
      } catch (err) {
        log("6", `End screen generation failed: ${err.message}`, "err");
        report.steps[6] = { status: "failed", error: err.message };
        report.errors.push(`Step 6: ${err.message}`);
      }
    } else {
      log("6", "Dry run — skipping end screen generation", "skip");
      report.steps[6] = { status: "skipped" };
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP 7: Channel Branding
  // ═══════════════════════════════════════════════════════
  if (shouldRun(7)) {
    log("7", "Channel Branding", "info");
    const brandingPath = join(dirs.research, "branding-spec.json");

    if (existsSync(brandingPath)) {
      log("7", "Branding spec already exists", "ok");
      report.steps[7] = { status: "ok", cached: true };
    } else if (!dryRun) {
      try {
        const brandingData = generateBrandingSpec(channel);
        writeFileSync(brandingPath, JSON.stringify(brandingData, null, 2));
        log("7", `Generated branding: ${brandingData.colors?.primary || "default"} palette`, "ok");
        report.steps[7] = { status: "ok" };
      } catch (err) {
        log("7", `Branding generation failed: ${err.message}`, "err");
        report.steps[7] = { status: "failed", error: err.message };
        report.errors.push(`Step 7: ${err.message}`);
      }
    } else {
      log("7", "Dry run — skipping branding generation", "skip");
      report.steps[7] = { status: "skipped" };
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP 8: Copyright Check
  // ═══════════════════════════════════════════════════════
  if (shouldRun(8)) {
    log("8", "Copyright Check", "info");
    const checklistPath = join(dirs.research, "copyright-checklist.json");

    if (existsSync(checklistPath)) {
      log("8", "Copyright checklist already exists", "ok");
      report.steps[8] = { status: "ok", cached: true };
    } else if (!dryRun) {
      try {
        // Build the real per-video asset list instead of a fixed stand-in —
        // a copyright gate that checks the same 4 pre-known-safe strings on
        // every run can never actually flag a real problem asset.
        const current8 = resolveCurrentTopic(dirs.research, report.steps[1]?.topic);
        const topicSlug8 = current8?.slug || "";
        const videoAssets = [];

        const ttsFiles = existsSync(dirs.tts) ? readdirSync(dirs.tts) : [];
        const topicTtsFiles = topicSlug8 ? ttsFiles.filter((f) => f.startsWith(topicSlug8)) : ttsFiles;
        const hasRealAudio = topicTtsFiles.some((f) => f.endsWith(".mp3") && !f.includes("PLACEHOLDER"));
        const hasPlaceholderAudio = topicTtsFiles.some((f) => f.endsWith(".PLACEHOLDER.mp3"));
        videoAssets.push({
          name: "voiceover",
          source: hasRealAudio
            ? "EdgeTTS"
            : hasPlaceholderAudio
              ? "Local placeholder TTS (espeak substitute) — not cleared for upload, see Placeholder Doctrine gate"
              : "Unknown — no TTS output found",
        });

        // Real per-file b-roll provenance, only when this channel's manifest
        // is actually for the topic being checked right now (see
        // loadTopicBrollManifest's note — manifests are stale-prone).
        const brollManifest8 = loadTopicBrollManifest(channel, topicSlug8);
        if (brollManifest8) {
          for (const f of brollManifest8.files || []) {
            // assessSource() matches against known platform/brand names
            // (manifest.source, e.g. "Wikimedia Commons ...") — a per-file
            // license string like "CC BY-SA 3.0" wouldn't match anything
            // and would wrongly fall through to UNKNOWN.
            videoAssets.push({
              name: `b-roll: ${(f.local || "unknown").split("/").pop()} (${f.license || "license unspecified"})`,
              source: brollManifest8.source || "Unknown",
            });
          }
        }

        // Only the motion-graphics template currently has baked-in UI/SFX
        // (Kenney CC0 packs — see compositions/motion-graphics.jsx and
        // data/sfx-sources.md); other styles mix no SFX or music today.
        if (channel.style === "motion-graphics") {
          videoAssets.push({ name: "ui-sfx", source: "Kenney Audio Packs (CC0)" });
        }

        videoAssets.push({
          name: "thumbnail",
          source: "Local composite (gradient/text via sharp/canvas) — no external asset",
        });

        const checklist = preUploadChecklist(videoAssets);
        writeFileSync(checklistPath, JSON.stringify(checklist, null, 2));
        log("8", `Generated checklist: ${checklist.checks?.length || 0} checks, risk: ${checklist.overall_risk}`, "ok");
        report.steps[8] = { status: "ok" };
      } catch (err) {
        log("8", `Copyright checklist failed: ${err.message}`, "err");
        report.steps[8] = { status: "failed", error: err.message };
        report.errors.push(`Step 8: ${err.message}`);
      }
    } else {
      log("8", "Dry run — skipping copyright check", "skip");
      report.steps[8] = { status: "skipped" };
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP 9: Captions
  // ═══════════════════════════════════════════════════════
  if (shouldRun(9)) {
    log("9", "Captions (BBC/Netflix Standards)", "info");
    const ttsDir = join(ROOT, "data", "tts", channelId);

    if (existsSync(ttsDir)) {
      const srtFiles = readdirSync(ttsDir).filter((f) => f.endsWith(".srt"));
      if (srtFiles.length > 0) {
        log("9", `Found ${srtFiles.length} SRT file(s)`, "ok");
        let allValid = true;
        for (const srt of srtFiles) {
          try {
            const srtContent = readFileSync(join(ttsDir, srt), "utf-8");
            const parsed = parseSRT(srtContent);
            const validation = validateCaptions(parsed);
            if (!validation.valid) {
              log("9", `  ${srt}: ${validation.issues.length} issue(s)`, "warn");
              allValid = false;
            }
          } catch (e) {
            log("9", `  ${srt}: failed to parse — ${e.message}`, "err");
            allValid = false;
          }
        }
        report.steps[9] = { status: allValid ? "ok" : "warnings", srt_count: srtFiles.length };
      } else {
        log("9", "No SRT files — captions will be generated with TTS", "warn");
        report.steps[9] = { status: "pending" };
      }
    } else {
      log("9", "No TTS directory", "warn");
      report.steps[9] = { status: "pending" };
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP 10: Thumbnail
  // ═══════════════════════════════════════════════════════
  if (shouldRun(10)) {
    log("10", "Thumbnail", "info");
    const thumbDir = join(ROOT, "data", "thumbnails", channelId);
    if (existsSync(thumbDir)) {
      const thumbs = readdirSync(thumbDir).filter((f) => f.endsWith("-thumb-spec.json"));
      log("10", `Found ${thumbs.length} thumbnail spec(s)`, thumbs.length > 0 ? "ok" : "warn");
      report.steps[10] = { status: thumbs.length > 0 ? "ok" : "pending", count: thumbs.length };
    } else {
      log("10", "No thumbnails yet", "warn");
      report.steps[10] = { status: "pending" };
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP 11: VFX Audit
  // ═══════════════════════════════════════════════════════
  if (shouldRun(11)) {
    log("11", "VFX Audit", "info");
    const vfxChecklist = join(ROOT, "data", "vfx-checklist.json");
    if (existsSync(vfxChecklist)) {
      log("11", "VFX checklist loaded", "ok");
      report.steps[11] = { status: "ok" };
    } else {
      log("11", "No VFX checklist — run vfx-audit", "warn");
      report.steps[11] = { status: "pending" };
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP 12: SFX
  // ═══════════════════════════════════════════════════════
  if (shouldRun(12)) {
    log("12", "SFX Library", "info");
    const sfxDir = join(ROOT, "src", "audio");
    if (existsSync(sfxDir)) {
      log("12", "SFX directory exists", "ok");
      report.steps[12] = { status: "ok" };
    } else {
      log("12", "No SFX library — run sfx-sourcing", "warn");
      report.steps[12] = { status: "pending" };
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP 13: Disclosure Check
  // ═══════════════════════════════════════════════════════
  if (shouldRun(13)) {
    log("13", "AI Disclosure Compliance", "info");
    const disclosurePath = join(dirs.research, "disclosure-spec.json");

    if (existsSync(disclosurePath)) {
      log("13", "Disclosure spec already exists", "ok");
      report.steps[13] = { status: "ok", cached: true };
    } else if (!dryRun) {
      try {
        // Real per-video signals, same provenance data Step 8's copyright
        // check reads — a b-roll asset with no documented license/source_url
        // can't be assumed to be a real, verified photo (CLAUDE.md's rule
        // for named people/places) just because the manifest exists.
        const current13 = resolveCurrentTopic(dirs.research, report.steps[1]?.topic);
        const topicSlug13 = current13?.slug || "";
        const ttsFiles13 = existsSync(dirs.tts) ? readdirSync(dirs.tts) : [];
        const topicTtsFiles13 = topicSlug13 ? ttsFiles13.filter((f) => f.startsWith(topicSlug13)) : ttsFiles13;
        const ttsSource13 = topicTtsFiles13.some((f) => f.endsWith(".PLACEHOLDER.mp3")) ? "placeholder" : "edge-tts";
        const brollManifest13 = loadTopicBrollManifest(channel, topicSlug13);

        const disclosureData = assessDisclosureNeeds(channel, { ttsSource: ttsSource13, brollManifest: brollManifest13 });
        writeFileSync(disclosurePath, JSON.stringify(disclosureData, null, 2));
        log("13", `Disclosure: ${disclosureData.overall_disclosure_required ? "REQUIRED" : "NOT REQUIRED"}`,
          disclosureData.overall_disclosure_required ? "warn" : "ok");
        if (!disclosureData.overall_disclosure_required) {
          log("13", `Reason: ${disclosureData.recommendation}`, "info");
        }
        report.steps[13] = { status: "ok", requires: disclosureData.overall_disclosure_required };
      } catch (err) {
        log("13", `Disclosure check failed: ${err.message}`, "err");
        report.steps[13] = { status: "failed", error: err.message };
        report.errors.push(`Step 13: ${err.message}`);
      }
    } else {
      log("13", "Dry run — skipping disclosure check", "skip");
      report.steps[13] = { status: "skipped" };
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP 14: Quality Gate
  // ═══════════════════════════════════════════════════════
  if (shouldRun(14)) {
    log("14", "Quality Gate (Inauthentic Content Check)", "info");
    const qualityPath = join(dirs.research, "quality-report.json");

    if (existsSync(qualityPath)) {
      log("14", "Quality report already exists", "ok");
      report.steps[14] = { status: "ok", cached: true };
    } else if (!dryRun) {
      try {
        const current14 = resolveCurrentTopic(dirs.research, report.steps[1]?.topic);
        const topicSlug14 = current14?.slug || "";
        const scriptCandidates14 = [`${topicSlug14}-longform-script.json`, `${topicSlug14}-shorts-script.json`, `${topicSlug14}-script.json`]
          .map((f) => join(dirs.research, f))
          .filter(existsSync);
        const script14 = scriptCandidates14[0] ? JSON.parse(readFileSync(scriptCandidates14[0], "utf-8")) : null;

        const brollManifest14 = loadTopicBrollManifest(channel, topicSlug14);

        const renderFiles14 = existsSync(dirs.renders) ? readdirSync(dirs.renders) : [];
        const renderExists14 = topicSlug14 ? renderFiles14.some((f) => f.startsWith(topicSlug14) && f.endsWith(".mp4")) : false;

        const qualityData = generateQualityReport(channel, {
          topicSlug: topicSlug14,
          script: script14,
          brollManifest: brollManifest14,
          renderExists: renderExists14,
        });
        writeFileSync(qualityPath, JSON.stringify(qualityData, null, 2));
        const evidenceCount = Object.keys(qualityData.editorial_evidence || {}).length;
        log("14", `Quality report generated: ${evidenceCount} evidence checks`, "ok");
        report.steps[14] = { status: "ok", evidence_checks: evidenceCount };
      } catch (err) {
        log("14", `Quality gate failed: ${err.message}`, "err");
        report.steps[14] = { status: "failed", error: err.message };
        report.errors.push(`Step 14: ${err.message}`);
      }
    } else {
      log("14", "Dry run — skipping quality check", "skip");
      report.steps[14] = { status: "skipped" };
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP 15: Render Settings
  // ═══════════════════════════════════════════════════════
  if (shouldRun(15)) {
    log("15", "Render Settings (Remotion)", "info");
    const renderPath = join(dirs.research, "render-settings.json");

    if (existsSync(renderPath)) {
      log("15", "Render settings already exist", "ok");
      report.steps[15] = { status: "ok", cached: true };
    } else if (!dryRun) {
      try {
        const renderData = generateRenderSettings(channel);
        writeFileSync(renderPath, JSON.stringify(renderData, null, 2));
        log("15", `CRF: ${renderData.long_form?.quality?.crf || 18}, Preset: ${renderData.long_form?.encoding?.x264_preset || "slow"}`, "ok");
        report.steps[15] = { status: "ok" };
      } catch (err) {
        log("15", `Render settings failed: ${err.message}`, "err");
        report.steps[15] = { status: "failed", error: err.message };
        report.errors.push(`Step 15: ${err.message}`);
      }
    } else {
      log("15", "Dry run — skipping render settings", "skip");
      report.steps[15] = { status: "skipped" };
    }

    // Also check for actual renders
    if (existsSync(dirs.renders)) {
      const renders = readdirSync(dirs.renders).filter((f) => f.endsWith(".mp4"));
      log("15", `Existing renders: ${renders.length}`, renders.length > 0 ? "ok" : "info");
      renders.slice(-2).forEach((r) => log("15", `  ${r}`, "info"));
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP 16: Publish
  // ═══════════════════════════════════════════════════════
  if (shouldRun(16)) {
    log("16", "YouTube Publish", "info");
    const apiAvailable = channel.youtube_channel_id && channel.youtube_channel_id !== "SET_ME";

    if (dryRun) {
      log("16", "Dry run — skipping publish", "skip");
      report.steps[16] = { status: "skipped" };
    } else if (!apiAvailable) {
      log("16", "API not configured — manual upload required", "skip");
      report.steps[16] = { status: "skipped", reason: "no API" };
    } else {
      log("16", "Ready to publish — upload to YouTube as private, auto-publish after 1hr", "info");
      report.steps[16] = { status: "ready" };
    }
  }

  // ═══════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════
  report.completed_at = new Date().toISOString();

  const completed = Object.values(report.steps).filter((s) => s.status === "ok").length;
  const pending = Object.values(report.steps).filter((s) => s.status === "pending").length;
  const failed = Object.values(report.steps).filter((s) => s.status === "failed").length;
  const skipped = Object.values(report.steps).filter((s) => s.status === "skipped").length;

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  PIPELINE SUMMARY: ${channelId}`);
  console.log(`  ✓ ${completed} completed  ○ ${skipped} skipped  ⏳ ${pending} pending  ✗ ${failed} failed`);
  if (report.errors.length > 0) {
    console.log(`  Errors:`);
    report.errors.forEach((e) => console.log(`    ✗ ${e}`));
  }
  console.log(`═══════════════════════════════════════════\n`);

  // Save report
  const reportPath = join(dirs.research, "pipeline-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log("Report", `Saved to ${reportPath}`, "ok");
}

main();
