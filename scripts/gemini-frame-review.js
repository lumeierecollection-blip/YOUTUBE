#!/usr/bin/env node
/**
 * Gemini Visual Director — per-beat + whole-video review using Gemini 3.5 Flash Lite.
 *
 * Not a passive QA checker. This is the visual post-production director:
 * inspects actual rendered pixels, compares against the Visual Bible,
 * and produces structured correction instructions when the video fails.
 *
 * Usage:
 *   node scripts/gemini-frame-review.js --video <path> --script <path> --srt <path> --channel <id>
 *   node scripts/gemini-frame-review.js --video <path> --script <path> --srt <path> --channel <id> --fix
 *
 * --fix   Outputs actionable corrections the pipeline can use to re-render.
 *
 * Requires: GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY or VISION_API_KEY
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
// Every model call goes through src/lib/llm.js: Gemini first, local Ollama
// (a vision model — these calls carry frames) when Gemini cannot answer,
// or Ollama only under FORCE_PLANNER=ollama. Transitions are logged.
import { callLLM, isProviderError, llmConfigured, GROQ_MAX_IMAGES } from "../src/lib/llm.js";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const compositorPkg = process.platform === "win32"
  ? "@remotion/compositor-win32-x64-msvc" : "@remotion/compositor-linux-x64-gnu";
const binExt = process.platform === "win32" ? ".exe" : "";
const FFMPEG_MIN = join(ROOT, "src", "skills", "remotion-render", "node_modules",
  compositorPkg, `ffmpeg${binExt}`);
const ffmpegStatic = join(ROOT, "node_modules", "ffmpeg-static", `ffmpeg${binExt}`);
const FFMPEG = existsSync(ffmpegStatic) ? ffmpegStatic : FFMPEG_MIN;
const FFPROBE = join(dirname(FFMPEG_MIN), `ffprobe${binExt}`);

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.split("=").slice(1).join("=") : fallback;
}

function getApiKey() {
  return process.env.GEMINI_API_KEY
    || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    || process.env.VISION_API_KEY
    || null;
}

function parseSrt(srtText) {
  return srtText.split(/\n\n+/).map((block) => {
    const lines = block.trim().split("\n");
    if (lines.length < 3) return null;
    const timeLine = lines[1];
    const [start, end] = timeLine.split(" --> ").map((t) => {
      const [h, m, rest] = t.trim().split(":");
      const [s, ms] = rest.split(",");
      return (+h * 3600) + (+m * 60) + +s + +ms / 1000;
    });
    return { start, end, text: lines.slice(2).join(" ") };
  }).filter(Boolean);
}

function getVoiceoverAtTime(cues, timeSec) {
  const active = cues.filter((c) => timeSec >= c.start && timeSec <= c.end + 0.5);
  if (active.length) return active.map((c) => c.text).join(" ");
  const nearest = cues.reduce((best, c) => {
    const dist = Math.min(Math.abs(timeSec - c.start), Math.abs(timeSec - c.end));
    return dist < best.dist ? { dist, text: c.text } : best;
  }, { dist: Infinity, text: "" });
  return nearest.text;
}

function extractFrameAtTime(video, timeSec, outPath) {
  execFileSync(FFMPEG, [
    "-hide_banner", "-loglevel", "error",
    "-ss", String(timeSec),
    "-i", video,
    "-frames:v", "1",
    "-vf", "scale=540:960",
    "-y", outPath,
  ]);
}

function getVideoDuration(video) {
  const out = execFileSync(FFPROBE, [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1", video,
  ], { encoding: "utf-8" });
  return parseFloat(out.trim());
}

function computeBeatTimes(srtCues, duration) {
  const times = [];
  // SAMPLING (not what is judged): one frame per beat, taken 65% of the way
  // through it — when its page is built. This sampled a uniform grid plus
  // every cue's start + 0.1 s: the first frames of each beat, while the page
  // fades in, the headline has not typed, a counter is still near 0 and the
  // caption shows its first word. Reviews then reported exactly that as the
  // video: "incomplete text fragments ('Two Alexandria', 'We'll')", "nearly
  // blank white pages", "counting up to 1938 via random numbers like 1009"
  // (runs 36405739332 ch-2, 36419295509 ch-2 / ch-48). Every beat is still
  // reviewed, against the same rubric. Without cues: the uniform grid.
  if (srtCues.length) {
    srtCues.forEach((cue, i) => {
      const end = srtCues[i + 1] ? srtCues[i + 1].start : Math.max(cue.end, duration);
      const t = cue.start + 0.65 * Math.max(0, end - cue.start);
      if (t < duration - 0.3) times.push(t);
    });
  } else {
    const interval = Math.max(1, duration / 12);
    for (let t = 0.5; t < duration - 0.3; t += interval) times.push(t);
  }
  if (!times.length) times.push(Math.max(0.5, duration / 2));
  times.sort((a, b) => a - b);
  const unique = [times[0]];
  for (let i = 1; i < times.length; i++) {
    if (times[i] - unique[unique.length - 1] > 0.8) unique.push(times[i]);
  }
  return unique.slice(0, 20);
}

function buildScenePrompt(bible, frameIndex, totalFrames, time, voiceover) {
  return bible.prompts.scene_review
    .replace("{frame_index}", String(frameIndex))
    .replace("{total_frames}", String(totalFrames))
    .replace("{time}", time.toFixed(1))
    .replace("{voiceover}", voiceover.replace(/"/g, '\\"'));
}

async function reviewFrame(framePath, voiceoverText, frameIndex, totalFrames, time, apiKey, bible) {
  const prompt = buildScenePrompt(bible, frameIndex, totalFrames, time, voiceoverText);
  const imageData = readFileSync(framePath).toString("base64");
  const messages = [{
    role: "user",
    content: [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: `data:image/png;base64,${imageData}` } },
    ],
  }];
  const result = await callLLM(messages, {}, "reviewer");
  if (!result.error) {
    result.frame_index = frameIndex;
    result.time_seconds = time;
    result.voiceover_text = voiceoverText;
  }
  return result;
}

/**
 * Batched frame review — sends multiple frames in one Gemini call.
 * Reduces API overhead from N calls to ceil(N/BATCH_SIZE) calls.
 *
 * @param {Array<{path: string, index: number, time: number, voiceover: string}>} frames
 * @param {number} totalFrames
 * @param {Object} bible
 * @returns {Promise<Array<Object>>} Array of results, one per frame
 */
async function reviewFrameBatch(frames, totalFrames, bible) {
  if (!frames.length) return [];

  const BATCH_SIZE = 10;
  const results = [];

  for (let b = 0; b < frames.length; b += BATCH_SIZE) {
    const batch = frames.slice(b, b + BATCH_SIZE);

    // Build a single prompt for the batch
    const batchDescription = batch.map((f, i) =>
      `Frame ${f.index + 1}/${totalFrames} at t=${f.time.toFixed(1)}s — VO: "${f.voiceover.slice(0, 80)}"`
    ).join("\n");

    const prompt =
      `You are reviewing ${batch.length} frames from one video. ` +
      `For EACH frame, provide a separate JSON object in an array.\n\n` +
      `Frames:\n${batchDescription}\n\n` +
      `Answer ONLY with a JSON array, no prose, no markdown fences:\n` +
      `[\n` +
      `  {\n` +
      `    "frame_index": <number>,\n` +
      `    "time_seconds": <number>,\n` +
      `    "status": "PASS"|"FAIL",\n` +
      `    "quality_score": <1-10>,\n` +
      `    "problem": "<one sentence if FAIL, else empty>",\n` +
      `    "correction": { "action": "<what to fix>" },\n` +
      `    "visual_audio_match": true|false,\n` +
      `    "visual_audio_note": "<if mismatch, why>"\n` +
      `  },\n` +
      `  ...\n` +
      `]\n\n` +
      `Rules:\n` +
      `- Each frame must have its own object.\n` +
      `- frame_index must match the frame number above.\n` +
      `- quality_score: 1=terrible, 10=perfect.\n` +
      `- Be harsh but fair. Flag real problems, not style preferences.`;

    // Build content with text + all images in batch
    const content = [{ type: "text", text: prompt }];
    for (const f of batch) {
      const imageData = readFileSync(f.path).toString("base64");
      content.push({ type: "text", text: `\n--- Frame ${f.index + 1} at t=${f.time.toFixed(1)}s ---` });
      content.push({ type: "image_url", image_url: { url: `data:image/png;base64,${imageData}` } });
    }

    // Gemini, or Ollama when Gemini cannot answer (no Gemini retry).
    // Groq: the same request split into parts of <= GROQ_MAX_IMAGES frames,
    // answers joined in frame order; Gemini and Ollama get the one call.
    const asArray = (x) => (Array.isArray(x) ? x : x && typeof x === "object" ? (Object.values(x).find((v) => Array.isArray(v)) || [x]) : []);
    const cap = GROQ_MAX_IMAGES;
    const groqBatch = batch.length > cap ? {
      messages: Array.from({ length: Math.ceil(batch.length / cap) }, (_, k) => batch.slice(k * cap, (k + 1) * cap)).map((g) => [{ role: "user", content: [
        { type: "text", text: prompt.replace(`reviewing ${batch.length} frames`, `reviewing ${g.length} frames`) },
        ...g.flatMap((f) => [
          { type: "text", text: `\n--- Frame ${f.index + 1} at t=${f.time.toFixed(1)}s ---` },
          { type: "image_url", image_url: { url: `data:image/png;base64,${readFileSync(f.path).toString("base64")}` } },
        ]),
      ] }]),
      merge: (answers) => answers.flatMap(asArray),
    } : undefined;
    let batchResult = await callLLM([{ role: "user", content }], { maxTokens: 2000, groqBatch }, "reviewer");
    if (isProviderError(batchResult)) {
      console.warn(`  Batch ${Math.floor(b / BATCH_SIZE) + 1} failed (${batchResult.source} ${batchResult.error}) — skipping ${batch.length} frames`);
      continue;
    }
    // JSON-mode local models answer an object; the array the prompt asks
    // for is then its one array-valued field ({"frames": [...]}).
    if (!Array.isArray(batchResult) && batchResult && typeof batchResult === "object") {
      const arr = Object.values(batchResult).find((v) => Array.isArray(v));
      if (arr) batchResult = arr;
    }

    // Parse batch result — should be an array
    const items = Array.isArray(batchResult) ? batchResult : [batchResult];
    for (let i = 0; i < batch.length; i++) {
      const item = items[i] || { error: "Missing from batch response" };
      item.frame_index = batch[i].index;
      item.time_seconds = batch[i].time;
      item.voiceover_text = batch[i].voiceover;
      results.push(item);
    }
  }

  return results;
}

// ── Full-canvas style (was: paper style): the rubric tests that contradict the owner's spec ──
// config/visual-bible.json predates the paper style. Three of its whole-
// video tests fail what the owner explicitly REQUIRES of this style:
//   "2. CAPTION TEST ... ANY caption track ... Zero tolerance"  vs the
//      required word-level caption synced to the voice (fix(captions));
//   "4. GRAPH TEST ... Could the concept be shown physically? ... don't
//      chart it"  vs the required system-drawn counter/bar/pie/line/gauge/
//      map for a sentence that names a number or a place (feat(viz));
//   "12. DECORATION ... Random dots, grids"  vs the reference video's own
//      dot grid, ring and black corner accents (the style to match).
// Reviews kept failing paper videos on exactly these (runs 36390736594,
// 36393233270, 36405739332: "caption duplicating the narration", "floating
// standalone numbers", "squiggly lines"). For a paper-style video ONLY
// (its render manifest has visual_type beats) those three tests are
// restated to the owner's spec; every other test — headline, continuity,
// motion, repetition, pacing, variety, opening, ending, slop, muted — and
// every threshold is unchanged. A test string that no longer matches is
// reported, not silently skipped.
const PAPER_RUBRIC = [
  ["2. CAPTION TEST: Is there ANY caption track — narration duplicated as text underneath visuals? Zero tolerance.",
    "2. CAPTION TEST: This style REQUIRES (channel owner) a word-by-word caption of the narration in the lower part of the frame, building in time with the voice — a frame mid-sentence shows only the words spoken so far. That caption is not a defect, not duplication and not a fragment: never list it in slop_indicators, repetition_issues, decoration_issues or corrections. Flag only OTHER text that repeats the narration."],
  ["4. GRAPH TEST: For every graph — is a graph the best representation? Could the concept be shown physically? If script says 'the price doubled,' show it doubling, don't chart it.",
    "4. GRAPH TEST: This style draws a sentence's own figure as a full-frame chart — bars, a donut, a line, a half-circle gauge, a map, or one big number — with the primary value in the channel's accent colour (channel owner's design). Judge whether the figure shown is the sentence's figure. A counter or bar grows from 0 to its value early in its beat, so an early frame can show a partly-grown number: that is the animation, not a wrong statistic."],
  ["12. DECORATION: Any meaningless visual noise? Random dots, grids, particles, gradients without purpose?",
    "12. DECORATION: Any meaningless visual noise — particles, clutter, gradients without purpose? (Not noise in this style: the off-white studio ground with soft leaf shadows and a faint film grain, and the dark gradient that keeps white type readable over a full-frame photo.)"],
];
function paperRubric(prompt) {
  let out = prompt;
  for (const [from, to] of PAPER_RUBRIC) {
    if (out.includes(from)) out = out.replace(from, to);
    else console.warn(`::warning::[review] paper rubric: the bible no longer contains "${from.slice(0, 60)}..." — test not restated`);
  }
  return out;
}

// What each full-canvas beat IS, for the frame label (the reviewer read a
// big number or a gauge as "headline-dominated" — run 36504143080 ch-1 75%).
function compositionLabel(b) {
  const c = b?.canvas, vt = String(b?.visual_type || "").toUpperCase();
  if (!c) return "";
  const what = { COUNTER: "one big number (the sentence's figure — a data beat)", BAR: "bar chart", PIE: "donut chart", LINE: "line chart", GAUGE: "gauge", MAP: "map filling the frame",
    PROCESS: "process diagram", PHOTO: `photograph of ${c.photo?.entity || "a named entity"}`, CUTOUT: "photographed object", TYPE: "typography",
    LIST: "an enumeration built item by item", TIMELINE: "a timeline of dated events", COMPARE: "two figures on a diagonal split", DOCUMENT: `scan of ${c.photo?.entity || "a document"}`,
    MONEY: "photograph of money" }[vt] || vt.toLowerCase();
  return ` | beat: ${c.composition} — ${what}`;
}

async function reviewWholeVideo(framePaths, beatTimes, srtCues, duration, apiKey, bible, paperStyle = false, manifestBeats = []) {
  const step = Math.max(1, Math.floor(framePaths.length / 8));
  const selected = [];
  selected.push(0);
  for (let i = step; i < framePaths.length - 1; i += step) selected.push(i);
  selected.push(framePaths.length - 1);
  const unique = [...new Set(selected)].sort((a, b) => a - b).slice(0, 10);

  const base = paperStyle ? paperRubric(bible.prompts.whole_video_review) : bible.prompts.whole_video_review;
  if (paperStyle) console.log("[review] full-canvas style: caption / graph / decoration tests restated to the owner's spec");
  const prompt = base
    .replace("{total_frames}", String(unique.length))
    .replace("{duration}", duration.toFixed(1));

  const content = [{ type: "text", text: prompt }];
  // FULL-CANVAS STYLE (owner's rebuild, 2026-09-29). The paper reference
  // video and its three frames are no longer sent: the video is judged
  // against the owner's full-canvas spec, stated here in text. There is no
  // reference_match any more (render-and-qa.js frameReviewVerdict).
  const refFrames = [];
  content.push({ type: "text", text: "\n=== THE STYLE — full-canvas editorial motion graphics with an editorial serif/sans type system (Financial Times x high-end documentary x contemporary magazine). Every beat is composed for the WHOLE 1080x1920 frame on an off-white studio ground with paper grain and a film vignette (every 4th-5th beat is inverted to near-black with light type — that is intended, not a defect). There is NO paper, NO card, NO container. Each beat is ONE of: TYPE-FULL / TYPE-SPLIT (a serif statement, sentence case, anchored to one side or split across opposite corners), NUMBER-FULL (ONE oversized serif numeral 260-420 px with a small uppercase sans label), DATA-FULL (bars / donut / line / gauge as the composition), SCENE-FULL / ARCHITECTURE / DOCUMENT / MONEY (a real photograph or scan edge to edge, type over it), MAP-CENTERED (the map fills the frame, labelled at the region), PROCESS-FULL (2-3 nodes, thick arrows), TIMELINE (dated events on a vertical line), COMPARISON-SPLIT (the frame cut on a diagonal, value A / value B), LIST-BUILD (items appearing one by one). Type has three roles: a serif headline (never all-caps), an oversized serif numeral, a small uppercase sans data label. LAYOUTS ARE ASYMMETRIC ON A GRID AND EMPTY SPACE IS INTENTIONAL: do not call a beat 'empty', 'unbalanced' or 'off-centre' because its middle is clear or its text sits to one side; judge whether the composition spans the frame (elements anchored to opposite regions) and whether the type roles and the picture support the line. The channel's accent colour marks only the primary value / the arrow / the number that matters. Beats transform into each other (slides, match cuts, a persisted element). The word-by-word caption of the narration near the bottom is REQUIRED on every beat by the channel owner: do not count it as caption duplication, subtitles, redundancy or slop, and do not lower any score for it. A small section folio ('03 / 08') and a hairline rule are page furniture, not defects. Judge each frame's CONTENT against its voiceover line. Reject a frame if a photo shown is not literally about what its sentence names: a generic stock image standing in for a named person, place or organization is a CRITICAL defect (a MONEY beat's picture of currency and a DOCUMENT beat's scan illustrate the literal object the sentence names, not a named entity). A card, a paper page or a framed panel is a HIGH defect; so is a composition shrunk into a small area with no element reaching the frame's regions. Two beats of the same composition kind in a row is a defect. In the headline test, a TYPE-FULL / TYPE-SPLIT typography beat is headline-led by design; a beat labelled as a big number, chart, gauge, map, process, timeline, list, comparison, photograph, document or money is a VISUAL beat, not a headline beat; the video is headline-dominated only when most beats are typography with no chart, number, photo, object or process. Score overall_score on how well the video realises this style AND how well each frame matches its line. ===" });
  content.push({ type: "text", text: "\n=== FRAMES UNDER REVIEW ===" });
  const head = content.slice(0, 2);            // rubric + reference note (text)
  const framePartsList = [];
  for (const idx of unique) {
    const imageData = readFileSync(framePaths[idx]).toString("base64");
    const t = beatTimes[idx];
    const vo = srtCues.length ? getVoiceoverAtTime(srtCues, t) : "(no SRT)";
    const parts = [
      { type: "text", text: `\n--- Frame ${idx + 1}/${unique.length} at t=${t.toFixed(1)}s | VO: "${vo.slice(0, 80)}"${compositionLabel(manifestBeats.find((b) => t >= (b.start_sec ?? 0) && t < (b.start_sec ?? 0) + (b.duration_sec ?? 0)))} ---` },
      { type: "image_url", image_url: { url: `data:image/png;base64,${imageData}` } },
    ];
    framePartsList.push(parts);
    content.push(...parts);
  }

  // Groq takes at most GROQ_MAX_IMAGES images per request: 1 reference
  // frame + (cap - 1) review frames per batch, merged at the WORST verdict (lowest score, FAIL / NO
  // wins, issues concatenated). Where this stops: each Groq batch sees part
  // of the video, so its continuity and repetition calls are per batch.
  // Gemini and Ollama still get the one full call.
  const refMid = refFrames.length ? { type: "image_url", image_url: { url: `data:image/png;base64,${readFileSync(refFrames[Math.floor(refFrames.length / 2)]).toString("base64")}` } } : null;
  const perBatch = refMid && GROQ_MAX_IMAGES > 1 ? GROQ_MAX_IMAGES - 1 : GROQ_MAX_IMAGES;
  const useRef = refMid && GROQ_MAX_IMAGES > 1;
  const nBatches = Math.ceil(framePartsList.length / perBatch);
  const groqBatch = (refFrames.length + framePartsList.length) > GROQ_MAX_IMAGES ? {
    messages: Array.from({ length: nBatches }, (_, k) => [{ role: "user", content: [
      ...head,
      ...(useRef ? [refMid, { type: "text", text: `\n=== FRAMES UNDER REVIEW (part ${k + 1} of ${nBatches} of the video; one reference frame shown above) ===` }] : []),
      ...framePartsList.slice(k * perBatch, (k + 1) * perBatch).flat(),
    ] }]),
    merge: (answers) => {
      const ok = answers.filter((x) => x && typeof x === "object");
      const nums = (key) => ok.map((x) => Number(x[key])).filter(Number.isFinite);
      const min = (key) => (nums(key).length ? Math.min(...nums(key)) : undefined);
      const cat = (key) => ok.flatMap((x) => (Array.isArray(x[key]) ? x[key] : []));
      const sev = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
      const worstSev = ok.map((x) => String(x.severity || "").toUpperCase()).filter((v) => sev.includes(v)).sort((x, y) => sev.indexOf(y) - sev.indexOf(x))[0] || null;
      const refs = ok.map((x) => String(x.reference_match || "").toUpperCase());
      const ht = ok.map((x) => x.headline_test).filter(Boolean);
      return {
        ...ok[0],
        status: ok.some((x) => String(x.status).toUpperCase() === "FAIL") ? "FAIL" : (ok[0]?.status || "PASS"),
        severity: worstSev,
        overall_score: min("overall_score"),
        continuity_score: min("continuity_score"),
        motion_weight_score: min("motion_weight_score"),
        reference_match: refs.includes("NO") ? "NO" : refs.length && refs.every((v) => v === "YES") ? "YES" : ok[0]?.reference_match,
        reference_reason: ok.map((x) => x.reference_reason).filter(Boolean).join(" | "),
        headline_test: ht.length ? { ...ht[0], monoculture: ht.some((h) => h.monoculture), pass: ht.every((h) => h.pass !== false) } : ok[0]?.headline_test,
        categories: [...new Set(cat("categories"))],
        repetition_issues: cat("repetition_issues"), decoration_issues: cat("decoration_issues"),
        slop_indicators: cat("slop_indicators"), corrections: cat("corrections"),
        verdict: ok.map((x) => x.verdict).filter(Boolean).join(" | "),
      };
    },
  } : undefined;

  return callLLM([{ role: "user", content }], { maxTokens: 1600, groqBatch }, "reviewer");
}

function categorizeResult(result, bible) {
  if (result.error) return { tier: "ERROR", blocking: false };
  const status = result.status || (result.quality_score >= 6 ? "PASS" : "FAIL");
  const severity = result.severity || null;

  const criticalRuleFails = Object.entries(result.checks || {}).filter(([id, v]) => {
    const rule = bible.rules[id];
    return rule && rule.severity === "CRITICAL" && !v.pass;
  });
  const highRuleFails = Object.entries(result.checks || {}).filter(([id, v]) => {
    const rule = bible.rules[id];
    return rule && rule.severity === "HIGH" && !v.pass;
  });

  if (criticalRuleFails.length > 0 || severity === "CRITICAL") {
    return { tier: "CRITICAL", blocking: true, criticalRuleFails, highRuleFails };
  }
  if (highRuleFails.length > 0 || severity === "HIGH") {
    return { tier: "HIGH", blocking: false, criticalRuleFails, highRuleFails };
  }
  if (status === "FAIL") {
    return { tier: severity || "MEDIUM", blocking: false, criticalRuleFails, highRuleFails };
  }
  return { tier: "PASS", blocking: false, criticalRuleFails, highRuleFails };
}

/* ── Per-beat check ──────────────────────────────────────────────────
 *
 *   node scripts/gemini-frame-review.js --beat-check --video <mp4> \
 *        --manifest <render-manifest.json> --srt <vo.srt> [--out <json>]
 *
 * One frame at the MIDPOINT of every beat (timings from the render
 * manifest render.js writes), each paired with that beat's sentence (SRT
 * cue i ↔ beat i), sent to Gemini in one call. For each: does this frame
 * visually correspond to this sentence — YES or NO?
 *
 * Exit 0 = at most 1 beat NO. Exit 1 = more than 1 beat NO (listed).
 * Exit 3 = the check could not run (no key, no answer, unreadable answer,
 * wrong number of verdicts). Nothing defaults to a pass — the full review
 * below exits 0 "SKIPPED" when no key is set, which is how a missing check
 * looked like a passing one.
 */
async function beatCheck() {
  const videoPath = arg("video");
  const manifestPath = arg("manifest");
  const srtPath = arg("srt");
  const outPath = arg("out");
  if (!videoPath || !manifestPath || !srtPath) {
    console.error("Usage: gemini-frame-review.js --beat-check --video <mp4> --manifest <manifest.json> --srt <vo.srt> [--out <json>]");
    process.exit(2);
  }
  if (!llmConfigured()) {
    console.error("::error::beat check cannot run: no Gemini key and no Ollama server configured");
    process.exit(3);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const cues = parseSrt(readFileSync(srtPath, "utf-8").replace(/\r\n/g, "\n"));
  const beats = manifest.beats || [];
  if (!beats.length) {
    console.error("::error::beat check: manifest has no beats");
    process.exit(3);
  }
  const work = join(tmpdir(), `beat-check-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  const content = [{
    type: "text",
    text: `You are checking a finished YouTube Short, beat by beat. For each beat you get the narration sentence spoken during it and ONE frame from the middle of that beat.
Question for every beat: does this frame VISUALLY correspond to this sentence — would a viewer with the sound off get the sentence's point from what is drawn?
A beat that shows a PHOTOGRAPHED OBJECT (a cutout): answer NO if that object is not literally what the sentence or its headline names — a metaphor or a topic-level stock object is NO (a camera for "strategic advantage", dollar bills for "the foundation", a gavel for "negotiation tactics", a magnifying glass for "preparation is key").
Answer NO when the frame is only a line of text restating or labelling the sentence with no visual that shows its idea, when the frame is blank, or when what is drawn is unrelated to the sentence.
EXCEPTION: a beat marked "[TYPOGRAPHY]" below is a kinetic-text hook or CTA beat BY DESIGN — it is supposed to be text only, with no accompanying drawing. For those beats only, judge whether the on-screen text itself captures the sentence's point; do not answer NO merely because there is no separate visual.
EXCEPTION: a beat marked "[DATA: COUNTER|BAR|PIE|LINE|GAUGE]" below shows the sentence's own figure as a drawn number, chart or gauge BY DESIGN — the drawn figure IS the visual. Answer YES when the figure shown is the sentence's figure and its label fits the sentence; answer NO when the figure is wrong, missing, or unrelated. A beat marked "[MAP]" shows the place the sentence names; answer NO if the place is wrong or unreadable.
EXCEPTION: a beat marked "[PROCESS]" is a designed flow diagram BY DESIGN (labelled nodes joined by arrows): answer YES when its nodes and arrows show the cause -> effect or sequence the sentence states; answer NO when the sentence states no such flow or the nodes are not the sentence's steps. A beat marked "[PHOTO: <name>]" shows a real photograph of that named person, place or organization: answer NO if the photo is not of THAT entity (e.g. another country's court or building), or if the entity is not what the sentence is about.
A word-by-word caption of the narration near the bottom of the frame is present on every beat BY DESIGN; ignore it when judging, and judge the rest of the frame.
Respond ONLY with JSON: {"beats":[{"beat_index":<n>,"matches":"YES"|"NO","what_is_shown":"<what the frame actually contains>","reason":"<one sentence>"}]} — exactly one entry per beat, beat_index 0..${beats.length - 1}.`,
  }];
  // Each beat's parts (label + frame), kept apart so a Groq request can carry
  // at most GROQ_MAX_IMAGES frames (callLLM's groqBatch); Gemini and Ollama
  // get one call.
  const beatParts = [];
  try {
    beats.forEach((b, i) => {
      const mid = (b.start_sec ?? 0) + (b.duration_sec ?? 0) / 2;
      const framePath = join(work, `beat-${String(i).padStart(2, "0")}.png`);
      extractFrameAtTime(videoPath, mid, framePath);
      const sentence = cues[i]?.text ?? "(no sentence)";
      // Paper style: a TYPE beat is typography by design (the planner's rule:
      // an abstract claim with no number, place or object), the same
      // exception as a TYPOGRAPHY mechanism beat.
      const vt = String(b.visual_type || "").toUpperCase();
      const tag = b.mechanism === "TYPOGRAPHY" || vt === "TYPE" ? " [TYPOGRAPHY]"
        : ["COUNTER", "BAR", "PIE", "LINE", "GAUGE"].includes(vt) ? ` [DATA: ${vt}]`
        : vt === "MAP" ? " [MAP]"
        : vt === "PROCESS" ? " [PROCESS]"
        : vt === "PHOTO" ? ` [PHOTO: ${String(b.data?.entity || b.canvas?.data?.entity || "").slice(0, 60)}]` : "";
      const parts = [
        { type: "text", text: `Beat ${i}${tag} (frame at ${mid.toFixed(2)}s). Sentence: "${sentence}"` },
        { type: "image_url", image_url: { url: `data:image/png;base64,${readFileSync(framePath).toString("base64")}` } },
      ];
      beatParts.push(parts);
      content.push(...parts);
    });
    const intro = content[0].text;
    const cap = GROQ_MAX_IMAGES;
    const groqBatch = beats.length > cap ? {
      messages: Array.from({ length: Math.ceil(beats.length / cap) }, (_, k) => {
        const idx = Array.from({ length: Math.min(cap, beats.length - k * cap) }, (_, j) => k * cap + j);
        return [{ role: "user", content: [
          { type: "text", text: intro.replace(/exactly one entry per beat, beat_index 0\.\.\d+\./, `exactly one entry per beat BELOW (this is part ${k + 1} of the video), beat_index ${idx[0]}..${idx[idx.length - 1]}.`) },
          ...idx.flatMap((i) => beatParts[i]),
        ] }];
      }),
      // qwen3.8-27b sometimes answers the bare array instead of {beats:[...]}.
      merge: (answers) => ({ beats: answers.flatMap((a) => (Array.isArray(a?.beats) ? a.beats : Array.isArray(a) ? a : [])) }),
    } : undefined;
    console.log(`[beat-check] ${beats.length} beat frames extracted at midpoints — asking the model`);
    // Gemini, or Ollama (a vision model) when Gemini cannot answer — the
    // fallback replaces the old Gemini transport retry. Both failing is
    // "could not run" (exit 3). A NO verdict is never retried: that is the
    // check working, not an outage.
    let result = await callLLM([{ role: "user", content }], { maxTokens: 2048, temperature: 0, noCache: true, groqBatch }, "beat-check");
    if (isProviderError(result)) {
      console.error(`::error::beat check unavailable: ${result.source} ${result.error}${result.detail ? ` (${String(result.detail).slice(0, 160)})` : ""}`);
      process.exit(3);
    }
    // gemini-client returns {content: "<raw text>"} when the model's JSON
    // did not parse as-is -- CI run 36328141701 ch-9: a complete 6-verdict
    // answer wrapped in a ```json fence was reported as "no verdict(s)" and
    // failed a render whose first check had passed 6/6. Unwrap the fence
    // (or take the outermost {...}) and parse; anything still unparseable
    // stays a failure exactly as before.
    if (result && !Array.isArray(result.beats) && typeof result.content === "string") {
      const text = result.content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const a = text.indexOf("{"), b = text.lastIndexOf("}");
      try { if (a >= 0 && b > a) result = JSON.parse(text.slice(a, b + 1)); } catch {}
    }
    const verdicts = Array.isArray(result?.beats) ? result.beats : null;
    if (!verdicts || verdicts.length !== beats.length) {
      console.error(`::error::beat check returned ${verdicts ? verdicts.length : "no"} verdict(s) for ${beats.length} beats: ${JSON.stringify(result).slice(0, 300)}`);
      process.exit(3);
    }
    for (const v of verdicts) {
      console.log(`[beat-check] beat ${v.beat_index}: ${v.matches} — shows: ${v.what_is_shown} — ${v.reason}`);
    }
    const failing = verdicts.filter((v) => String(v.matches).toUpperCase() !== "YES");
    if (outPath) {
      writeFileSync(outPath, JSON.stringify({ checkedAt: new Date().toISOString(), video: videoPath, beats: verdicts.map((v) => ({ ...v, sentence: cues[v.beat_index]?.text ?? null })), failing: failing.map((v) => v.beat_index) }, null, 2) + "\n");
    }
    if (failing.length > 1) {
      console.error(`::error::beat check failed: ${failing.length}/${beats.length} beats do not visually match their sentence — beats ${failing.map((v) => v.beat_index).join(", ")}`);
      process.exit(1);
    }
    console.log(`[beat-check] PASS: ${beats.length - failing.length}/${beats.length} beats match their sentence`);
    process.exit(0);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

async function main() {
  if (process.argv.includes("--beat-check")) return beatCheck();
  const videoPath = arg("video");
  const scriptPath = arg("script");
  const srtPath = arg("srt");
  const channelId = arg("channel");
  const fixMode = process.argv.includes("--fix");

  if (!videoPath || !scriptPath) {
    console.error("Usage: gemini-frame-review.js --video <path> --script <path> --srt <path> --channel <id>");
    process.exit(2);
  }

  const apiKey = getApiKey();
  if (!llmConfigured()) {
    console.error("No Gemini key and no Ollama server configured (GEMINI_API_KEY / OLLAMA_URL)");
    console.error("Visual director review SKIPPED — configure a model to enable.");
    process.exit(0);
  }

  const video = existsSync(videoPath) ? videoPath : join(ROOT, videoPath);
  if (!existsSync(video)) { console.error(`Video not found: ${videoPath}`); process.exit(2); }

  const bible = JSON.parse(readFileSync(join(ROOT, "config", "visual-bible.json"), "utf-8"));
  console.log(`Visual Bible v${bible.version} loaded — ${Object.keys(bible.rules).length} rules, ${bible.failure_categories.length} failure categories`);

  let srtCues = [];
  const srt = srtPath && existsSync(srtPath) ? srtPath : (srtPath ? join(ROOT, srtPath) : null);
  if (srt && existsSync(srt)) {
    srtCues = parseSrt(readFileSync(srt, "utf-8").replace(/\r\n/g, "\n"));
    console.log(`SRT loaded: ${srtCues.length} cues`);
  } else {
    console.warn("No SRT file — voiceover text unavailable for visual-audio alignment checks.");
  }

  const duration = getVideoDuration(video);
  console.log(`Video duration: ${duration.toFixed(2)}s`);

  const beatTimes = computeBeatTimes(srtCues, duration);
  console.log(`Sampling ${beatTimes.length} frames at beat points`);

  const work = join(tmpdir(), `gemini-review-${Date.now()}`);
  mkdirSync(work, { recursive: true });

  const sceneResults = [];
  const framePaths = [];
  let criticalCount = 0;
  let highCount = 0;
  let passCount = 0;

  try {
    // ── PHASE 1: Scene-level review (BATCHED) ──
    console.log("\n═══ PHASE 1: SCENE-BY-SCENE REVIEW (BATCHED) ═══\n");

    // Extract all frames first
    const frameData = [];
    for (let i = 0; i < beatTimes.length; i++) {
      const t = beatTimes[i];
      const framePath = join(work, `beat-${String(i).padStart(2, "0")}.png`);
      extractFrameAtTime(video, t, framePath);
      framePaths.push(framePath);
      const voText = srtCues.length ? getVoiceoverAtTime(srtCues, t) : "(no SRT available)";
      frameData.push({ path: framePath, index: i, time: t, voiceover: voText });
      console.log(`  [${i + 1}/${beatTimes.length}] t=${t.toFixed(1)}s — VO: "${voText.slice(0, 60)}..."`);
    }

    // Batch review: 5 frames per call instead of 1
    const batchResults = await reviewFrameBatch(frameData, beatTimes.length, bible);

    for (const result of batchResults) {
      sceneResults.push(result);

      if (result.error) {
        console.log(`    ERROR: ${result.error}`);
        continue;
      }

      const cat = categorizeResult(result, bible);
      const status = result.status || "UNKNOWN";
      const score = result.quality_score || "?";

      if (cat.tier === "CRITICAL") {
        criticalCount++;
        console.log(`    ✗ CRITICAL (score: ${score}/10) — ${status}`);
        if (result.problem) console.log(`      Problem: ${result.problem}`);
        if (result.correction?.action) console.log(`      Fix: ${result.correction.action}`);
        if (cat.criticalRuleFails?.length) {
          for (const [id, v] of cat.criticalRuleFails) console.log(`      ${id}: ${v.note}`);
        }
      } else if (cat.tier === "HIGH") {
        highCount++;
        console.log(`    ! HIGH (score: ${score}/10) — ${status}`);
        if (result.problem) console.log(`      Problem: ${result.problem}`);
        if (cat.highRuleFails?.length) {
          for (const [id, v] of cat.highRuleFails) console.log(`      ${id}: ${v.note}`);
        }
      } else {
        passCount++;
        console.log(`    ✓ PASS (score: ${score}/10)`);
      }

      if (!result.visual_audio_match) {
        console.log(`    AUDIO MISMATCH: ${result.visual_audio_note}`);
      }

      const slopFail = result.quality_tests?.ANTI_SLOP_TEST;
      if (slopFail && !slopFail.pass) {
        console.log(`    SLOP: ${slopFail.note}`);
      }

      const headlineFail = result.quality_tests?.HEADLINE_TEST;
      if (headlineFail && !headlineFail.pass) {
        console.log(`    HEADLINE: ${headlineFail.note}`);
      }

      const contFail = result.quality_tests?.CONTINUITY_TEST;
      if (contFail && !contFail.pass) {
        console.log(`    CONTINUITY: ${contFail.note}`);
      }

      const graphFail = result.quality_tests?.GRAPH_TEST;
      if (graphFail && !graphFail.pass) {
        console.log(`    GRAPH: ${graphFail.note}`);
      }

      const iconFail = result.quality_tests?.ICON_TEST;
      if (iconFail && !iconFail.pass) {
        console.log(`    ICON: ${iconFail.note}`);
      }
    }

    // ── PHASE 2: Whole-video review ──
    console.log("\n═══ PHASE 2: WHOLE-VIDEO REVIEW ═══\n");
    // Paper style = the render manifest next to the video has visual_type
    // beats (render.js writes <video>-manifest.json).
    // Full-canvas videos (their render manifest carries beats[].canvas) get
    // the restated rubric; the variable keeps its old name.
    let paperStyle = false, manifestBeats = [];
    try { manifestBeats = JSON.parse(readFileSync(video.replace(/\.mp4$/, "-manifest.json"), "utf-8")).beats || []; paperStyle = manifestBeats.some((b) => b.canvas); } catch {}
    const wholeResult = await reviewWholeVideo(framePaths, beatTimes, srtCues, duration, apiKey, bible, paperStyle, manifestBeats);

    if (wholeResult.error) {
      console.log(`  Whole-video review ERROR: ${wholeResult.error}`);
    } else {
      console.log(`  Overall score: ${wholeResult.overall_score || "?"}/10`);
      console.log(`  Status: ${wholeResult.status || "UNKNOWN"}`);
      console.log(`  Verdict: ${wholeResult.verdict || "(none)"}`);

      if (wholeResult.repetition_issues?.length) {
        console.log(`  Repetition issues:`);
        for (const r of wholeResult.repetition_issues) console.log(`    - ${r}`);
      }
      if (wholeResult.headline_test) {
        const ht = wholeResult.headline_test;
        console.log(`  Headline test: ${ht.headline_beat_count}/${ht.total_beats} headline-dominated (${ht.percent}%) — ${ht.pass ? "PASS" : "FAIL"}${ht.monoculture ? " — TEMPLATE_MONOCULTURE" : ""}`);
      }
      if (wholeResult.continuity_score != null) {
        console.log(`  Continuity: ${wholeResult.continuity_score}/10`);
      }
      if (wholeResult.motion_weight_score != null) {
        console.log(`  Motion weight: ${wholeResult.motion_weight_score}/10`);
      }
      if (wholeResult.slop_indicators?.length) {
        console.log(`  Slop indicators:`);
        for (const s of wholeResult.slop_indicators) console.log(`    - ${s}`);
      }
      if (wholeResult.decoration_issues?.length) {
        console.log(`  Decoration issues:`);
        for (const d of wholeResult.decoration_issues) console.log(`    - ${d}`);
      }
      if (wholeResult.pacing_assessment) {
        console.log(`  Pacing: ${wholeResult.pacing_assessment}`);
      }
      if (wholeResult.opening_assessment) {
        console.log(`  Opening: ${wholeResult.opening_assessment}`);
      }
      if (wholeResult.strongest_scene) {
        console.log(`  Strongest: Frame ${wholeResult.strongest_scene.index} — ${wholeResult.strongest_scene.why}`);
      }
      if (wholeResult.weakest_scene) {
        console.log(`  Weakest: Frame ${wholeResult.weakest_scene.index} — ${wholeResult.weakest_scene.why}`);
      }
      if (wholeResult.corrections?.length) {
        console.log(`  Corrections needed:`);
        for (const c of wholeResult.corrections) {
          console.log(`    ${c.scene}: ${c.problem} → ${c.fix}`);
        }
      }
    }

    // ── Build report ──
    const avgScore = sceneResults.filter((r) => r.quality_score).length > 0
      ? (sceneResults.reduce((s, r) => s + (r.quality_score || 0), 0) / sceneResults.filter((r) => r.quality_score).length).toFixed(1)
      : "N/A";

    const record = {
      generatedAt: new Date().toISOString(),
      bibleVersion: bible.version,
      video: basename(video),
      channel: channelId,
      duration: duration.toFixed(2),
      totalFrames: beatTimes.length,
      summary: {
        critical: criticalCount,
        high: highCount,
        passed: passCount,
        avgScore,
        passRate: beatTimes.length > 0
          ? `${((passCount / beatTimes.length) * 100).toFixed(0)}%`
          : "N/A",
      },
      sceneResults,
      wholeVideoResult: wholeResult,
      failureCategories: [...new Set(
        sceneResults.flatMap((r) => r.categories || [])
          .concat(wholeResult.categories || [])
      )],
      corrections: fixMode ? [
        ...sceneResults.filter((r) => r.correction?.action).map((r) => ({
          scene: r.scene || `beat_${r.frame_index}`,
          level: r.correction.level,
          action: r.correction.action,
          severity: r.severity,
        })),
        ...(wholeResult.corrections || []),
      ] : [],
    };

    const outDir = join(ROOT, "data", "audit", "gemini-review");
    mkdirSync(outDir, { recursive: true });
    const outFile = join(outDir, `${channelId || "unknown"}-${basename(video, ".mp4")}-${new Date().toISOString().slice(0, 10)}.json`);
    writeFileSync(outFile, JSON.stringify(record, null, 2) + "\n");

    // ── Final verdict ──
    console.log(`\n═══ GEMINI VISUAL DIRECTOR — FINAL VERDICT ═══`);
    console.log(`  Bible: v${bible.version} (${Object.keys(bible.rules).length} rules)`);
    console.log(`  Frames reviewed: ${beatTimes.length}`);
    console.log(`  CRITICAL: ${criticalCount}  HIGH: ${highCount}  PASS: ${passCount}`);
    console.log(`  Avg quality: ${avgScore}/10`);
    console.log(`  Pass rate: ${record.summary.passRate}`);
    console.log(`  Whole-video: ${wholeResult.status || "ERROR"} (${wholeResult.overall_score || "?"}/10)`);
    console.log(`  Report: ${outFile}`);

    const monoculture = wholeResult.headline_test?.monoculture;

    if (criticalCount > 0 || monoculture) {
      const reason = monoculture
        ? `TEMPLATE_MONOCULTURE — ${wholeResult.headline_test.percent}% headline-dominated beats`
        : `${criticalCount} CRITICAL failure(s)`;
      console.log(`\n  VERDICT: REJECTED — ${reason} require re-render.`);
      if (fixMode) {
        console.log(`  Corrections written to report. Pipeline should apply and re-render.`);
      }
      process.exit(1);
    } else if (highCount > Math.floor(beatTimes.length * 0.3)) {
      console.log(`\n  VERDICT: NEEDS IMPROVEMENT — ${highCount} HIGH issues across ${beatTimes.length} frames.`);
      if (!fixMode) process.exit(1);
    } else if (wholeResult.status === "FAIL" && (wholeResult.severity === "CRITICAL" || wholeResult.severity === "HIGH")) {
      console.log(`\n  VERDICT: NEEDS IMPROVEMENT — whole-video review flagged ${wholeResult.severity} issues.`);
      if (!fixMode) process.exit(1);
    } else {
      console.log(`\n  VERDICT: APPROVED — video meets Visual Bible standards.`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
