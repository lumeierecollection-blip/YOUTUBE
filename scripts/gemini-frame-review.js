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
import { callLLM, callLLMWithProvenance, isProviderError, llmConfigured, GROQ_MAX_IMAGES } from "../src/lib/llm.js";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const compositorPkg = process.platform === "win32"
  ? "@remotion/compositor-win32-x64-msvc" : "@remotion/compositor-linux-x64-gnu";
const binExt = process.platform === "win32" ? ".exe" : "";
const FFMPEG_MIN = join(ROOT, "src", "skills", "remotion-render", "node_modules",
  compositorPkg, `ffmpeg${binExt}`);
const ffmpegStatic = join(ROOT, "node_modules", "ffmpeg-static", `ffmpeg${binExt}`);
// Binary resolution, in order: ffmpeg-static, the hoisted root compositor, the render
// skill's own copy. FFMPEG and FFPROBE used to disagree — FFMPEG had a one-candidate
// fallback, FFPROBE was derived from that fallback with no check at all — so in an
// install where the compositor is hoisted to the root node_modules, one of them
// resolved and the other pointed at a file that does not exist, and getVideoDuration
// threw before a single frame was reviewed. Both now search the same list.
const FFMPEG_CANDIDATES = [ffmpegStatic, join(ROOT, "node_modules", compositorPkg, `ffmpeg${binExt}`), FFMPEG_MIN];
const FFMPEG = FFMPEG_CANDIDATES.find((p) => existsSync(p)) || FFMPEG_CANDIDATES[0];
const FFPROBE_CANDIDATES = FFMPEG_CANDIDATES.map((p) => join(dirname(p), `ffprobe${binExt}`));
const FFPROBE = FFPROBE_CANDIDATES.find((p) => existsSync(p)) || FFPROBE_CANDIDATES[0];

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.split("=").slice(1).join("=") : fallback;
}

function getApiKey() {
  return process.env.GEMINI_API_KEY_4
    || process.env.GEMINI_API_KEY
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
    "12. DECORATION: Any meaningless visual noise — particles, clutter, gradients without purpose? (The dark gradient that keeps white type readable over a full-frame photo is a technique, not noise. A plain ground is NOT exempt: report a ground that reads flat or empty as a finding.)"],
];

// A1b — TEST ONLY, and now a NO-OP. The clauses it used to strip were removed from
// production on 2026-10-05 (the ground mandate in the STYLE block and the matching
// exemption in PAPER_RUBRIC test 12), because they were found to suppress real defect
// findings rather than merely bias a score. The patterns are kept so a re-run can prove
// the clauses are still absent; the log line fires only if something actually changed,
// so this never claims to have neutralised a clause that is no longer there.
// Set it only to diff a rubric against a proposed edit, never in the pipeline: a real run
// would judge frames against a spec the renderer does not implement.
const NEUTRALIZE_GROUND = process.env.FRAME_REVIEW_NEUTRALIZE_GROUND === "1";
const GROUND_CLAUSES = [
  // :330 — the style block's ground mandate
  [/Every beat is composed for the WHOLE 1080x1920 frame on a uniform white ground \(one solid white on every beat[^)]*\)/,
    "Every beat is composed for the WHOLE 1080x1920 frame. [A1b TEST PROBE: the ground colour mandate is removed for this run — do not treat a dark or tinted ground as a defect, and do not reward a white ground.]"],
  // PAPER_RUBRIC test 12 — the pre-clearance that keeps the white ground out of slop
  [/\(Not noise in this style: the plain uniform white ground, and the dark gradient that keeps white type readable over a full-frame photo\.\)/,
    "[A1b TEST PROBE: the exemption that keeps a plain ground out of the decoration list is removed for this run. Judge ground flatness on its own merits.]"],
];
function neutralizeGroundClauses(text) {
  if (!NEUTRALIZE_GROUND) return text;
  let out = text;
  for (const [from, to] of GROUND_CLAUSES) out = out.replace(from, to);
  return out;
}

/**
 * Providers whose answer may stand as a VISUAL verdict.
 *
 * Ollama is excluded, on evidence rather than taste. In CI run 37349640976 it scored both
 * fixtures 2/10 — a zero delta on a pair Gemini separates by 8 points — and, worse, it
 * reported `4/4 headline-dominated (100%) TEMPLATE_MONOCULTURE` for the well-composed clip
 * that Gemini measures at `1/4 (25%)`. It does not merely score badly: it fabricates the
 * specific signal the variety axes are built on, confidently and specifically.
 *
 * That is worse than no provider at all. An unavailable verifier produces REVIEW_FAILED and
 * an operator sees a gap. A wrong verifier produces a sourced-looking verdict, and the whole
 * failure mode this audit exists to end is a plausible frame passing as a designed one. The
 * same principle as the fail-closed fix below, one layer up.
 *
 * This gates the VISUAL review only. Ollama remains available for text-only callers; its
 * text model is not what was measured here, and `qwen2.5vl:3b` on a CPU runner is.
 *
 * Ollama's reading is DISCARDED, not converted into a rejection — an untrusted answer is not
 * evidence the video is bad. Veto-only would have meant letting it reject on fabricated
 * grounds, which is the failure mode, not a mitigation of it.
 */
const VERDICT_PROVIDERS = new Set(["gemini", "groq"]);

/** 0/1/2/3 were already in use (0 ok, 1 verdict blocks, 2 usage, 3 beat-check could not run). */
const EXIT_PROVIDER_UNAVAILABLE = 4;

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
  const c = b?.canvas;
  const label = compositionLabelBase(b);
  // The ground the plan declared for this beat (absent = the house white).
  return label && c?.ground_color ? `${label} | ground: ${c.ground_color}${c.dark ? " (dark ground, light ink)" : ""}` : label;
}
function compositionLabelBase(b) {
  const c = b?.canvas, vt = String(b?.visual_type || "").toUpperCase();
  if (!c) return "";
  const what = { COUNTER: "one big number (the sentence's figure — a data beat)", BAR: "bar chart", PIE: "donut chart", LINE: "line chart", GAUGE: "gauge", MAP: "map filling the frame",
    PROCESS: "process diagram", PHOTO: `photograph of ${c.photo?.entity || "a named entity"}`, CUTOUT: "photographed object", TYPE: "typography",
    LIST: "an enumeration built item by item", TIMELINE: "a timeline of dated events", COMPARE: "two figures on a diagonal split", DOCUMENT: `scan of ${c.photo?.entity || "a document"}`,
    MONEY: "photograph of money", TREND: "a trend line rising or falling to one point" }[vt] || vt.toLowerCase();
  // A TYPE-FULL beat that carries a HERO is not typography: it was labelled "typography" and
  // the reviewer counted a 640 px drawn symbol beat as headline-led (CI run 37129265971 ch-48,
  // TEMPLATE_MONOCULTURE 60%). The label says what the frame actually draws; the reviewer
  // still judges the frame itself. A name card stays typography (it is the entity's name).
  const hero = (c.concept_visuals || [])[0];
  if (vt === "TYPE" && hero) {
    const heroWhat = hero.logo ? `the logo of ${hero.name || "a named organization"} as the hero visual`
      : hero.money ? "a photographed banknote / coin as the hero visual"
      : hero.class === "symbol" ? `a large drawn ${String(hero.name || "symbol").replace(/-/g, " ")} symbol as the hero visual`
      : `a photographed ${hero.name || "object"} as the hero visual`;
    // The composition NAME is left out: "TYPE-FULL with a hero object" was counted as a TYPE-FULL
    // beat ("Excessive use of TYPE-FULL beats (4/9 frames)", CI run 37837731824 ch-49, where two of
    // the four were verified Universal Pictures / Blumhouse logos). The reviewer still sees the frame.
    return ` | beat: a visual beat — ${heroWhat}`;
  }
  if (vt === "TYPE" && c.name_card) return ` | beat: ${c.composition} — typography: the name of ${c.name_card.name}`;
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
  // The STYLE block below replaced a clause that read, in effect, "do not call a beat
  // empty, unbalanced or off-centre because its middle is clear or its text sits to one
  // side". It is deliberately NOT restated inside the prompt: a model pattern-matches the
  // phrasing, not the framing, so quoting the prohibition inside a sentence that says it was
  // removed is a way of reinstalling it. (An earlier attempt did exactly that — the comment
  // landed INSIDE the template literal and was being sent to the model as prompt text. The
  // prompt now states only the boundary; the history lives here, in code.)
  content.push({ type: "text", text: "\n=== THE STYLE — full-canvas editorial motion graphics with an editorial serif/sans type system (Financial Times x high-end documentary x contemporary magazine). Every beat is composed for the WHOLE 1080x1920 frame. The house ground is white. The plan chooses each beat's ground, and a beat that chose another one says so in its frame label (| ground: #RRGGBB): a beat on white, on a dark colour or on a tint is as the plan intended. Judge whether the beat reads well on the ground it has — type, charts and photos legible against it — and whether the grounds across the video hang together; a ground that reads flat or empty for what the beat is doing is a finding, report it like any other. That the render drew the ground the plan declared is checked deterministically (local-audit.cjs canvas-ground). All text pops into place (a quick scale-up and settle); a word mid-pop may be slightly small or translucent in a sampled frame. There is NO paper, NO card, NO container. Each beat is ONE of: TYPE-FULL / TYPE-SPLIT (a serif statement, sentence case, anchored to one side or split across opposite corners), NUMBER-FULL (ONE oversized serif numeral 260-420 px with a small uppercase sans label), DATA-FULL (bars / donut / line / gauge as the composition), SCENE-FULL / ARCHITECTURE / DOCUMENT / MONEY (a real photograph or scan edge to edge, type over it), MAP-CENTERED (the map fills the frame, labelled at the region), PROCESS-FULL (2-3 nodes, thick arrows), TIMELINE (dated events on a vertical line), COMPARISON-SPLIT (the frame cut on a diagonal, value A / value B), LIST-BUILD (items appearing one by one). Type has three roles: a serif headline (never all-caps), an oversized serif numeral, a small uppercase sans data label. LAYOUTS ARE ASYMMETRIC ON A GRID AND NEGATIVE SPACE IS INTENTIONAL: judge whether the composition spans the frame (elements anchored to opposite regions) and whether the type roles and the picture support the line. ASYMMETRY IS NOT EMPTINESS. 'Intentional negative space' means the space AROUND a composed element, never the absence of one. A beat that carries no element for its sentence, however clean and intentional it looks, is a fallback frame: report it as one under HEADLINE TEST and headline_test. The channel's accent colour marks only the primary value / the arrow / the number that matters. Beats transform into each other (slides, match cuts, a persisted element). The word-by-word caption of the narration near the bottom is REQUIRED on every beat by the channel owner: do not count it as caption duplication, subtitles, redundancy or slop, and do not lower any score for it. A small section folio ('03 / 08') and a hairline rule are page furniture, not defects. Judge each frame's CONTENT against its voiceover line. Reject a frame if a photo shown is not literally about what its sentence names: a generic stock image standing in for a named person, place or organization is a CRITICAL defect (a MONEY beat's picture of currency and a DOCUMENT beat's scan illustrate the literal object the sentence names, not a named entity). A card, a paper page or a framed panel is a HIGH defect; so is a composition shrunk into a small area with no element reaching the frame's regions. Two beats of the same composition kind in a row is a defect. In the headline test, a TYPE-FULL / TYPE-SPLIT typography beat is headline-led by design; a beat labelled as a big number, chart, gauge, map, process, timeline, list, comparison, photograph, document or money is a VISUAL beat, not a headline beat; the video is headline-dominated only when most beats are typography with no chart, number, photo, object or process. Score overall_score on how well the video realises this style AND how well each frame matches its line. ===" });
  content.push({ type: "text", text: "\n=== FRAMES UNDER REVIEW ===" });
  // A1b: strip the ground mandate from the assembled rubric before `head` is taken, so
  // the Groq batch split carries the neutralized text too. No-ops now that production
  // carries no such clause; kept as the check that it stays that way.
  if (NEUTRALIZE_GROUND) {
    for (const part of content) {
      if (part.type !== "text" || typeof part.text !== "string") continue;
      const before = part.text;
      part.text = neutralizeGroundClauses(part.text);
      if (part.text !== before) console.log("[review] A1b: neutralized a ground clause still present in the rubric");
    }
    console.log("[review] A1b TEST PROBE active — production carries no ground mandate, so this run is a baseline re-measure, not a contrast");
  }
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

  // Provenance matters here more than anywhere else in the pipeline: this call's
  // answer becomes the video's verdict, and on a quota-exhausted Gemini account it
  // is Groq that actually writes it (run 37323030454). callLLM cannot tell the two
  // apart, so the caller used to log Groq's text under a Gemini label.
  const { value, provider, chain } = await callLLMWithProvenance([{ role: "user", content }], { maxTokens: 1600, groqBatch }, "reviewer");
  if (value && typeof value === "object") {
    value.provider = provider;
    value.provider_chain = chain;
  }
  console.log(`[reviewer] whole-video answer came from ${provider} (chain: ${chain.join(" → ")})`);
  return value;
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
WRONG PERSON: if the frame shows a person, and the sentence names a specific person, check whether the face plausibly matches the named person. If the face is clearly a different person, or if the person is a child, or if the image is a scene where the person is not the subject, answer NO with reason "wrong-person" (those exact words first in the reason). A beat marked "[PHOTO OF PERSON: <name>]" is meant to show that person's portrait.
A word-by-word caption of the narration near the bottom of the frame is present on every beat BY DESIGN; ignore it when judging, and judge the rest of the frame.
Respond ONLY with JSON: {"beats":[{"beat_index":<n>,"matches":"YES"|"NO","what_is_shown":"<what the frame actually contains>","reason":"<one sentence>"}]} — exactly one entry per beat, beat_index 0..${beats.length - 1}.`,
  }];
  // Each beat's parts (label + frame), kept apart so a Groq request can carry
  // at most GROQ_MAX_IMAGES frames (callLLM's groqBatch); Gemini and Ollama
  // get one call.
  const beatParts = [];
  try {
    beats.forEach((b, i) => {
      // The midpoint — or, when the beat's entity visual pops on its word later than that
      // (word-level sync, canvas.entity_pop), 0.4 s after it lands, inside the beat.
      const popSec = Number.isFinite(b.canvas?.entity_pop?.frame) ? b.canvas.entity_pop.frame / 30 + 0.4 : 0;
      const mid = (b.start_sec ?? 0) + Math.min(Math.max((b.duration_sec ?? 0) / 2, popSec), Math.max(0, (b.duration_sec ?? 0) - 0.1));
      const framePath = join(work, `beat-${String(i).padStart(2, "0")}.png`);
      extractFrameAtTime(videoPath, mid, framePath);
      const sentence = cues[i]?.text ?? "(no sentence)";
      // Paper style: a TYPE beat is typography by design (the planner's rule:
      // an abstract claim with no number, place or object), the same
      // exception as a TYPOGRAPHY mechanism beat.
      const vt = String(b.visual_type || "").toUpperCase();
      const personName = b.canvas?.photo?.kind === "person" ? String(b.canvas.photo.entity || b.data?.entity || "").slice(0, 60) : "";
      const tag = personName ? ` [PHOTO OF PERSON: ${personName}]`
        : b.mechanism === "TYPOGRAPHY" || vt === "TYPE" ? " [TYPOGRAPHY]"
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
    // maxTokens 6144, not 2048: gemini-3.5-flash (a sibling the client falls to on a 503)
    // spends reasoning tokens from the same budget, and CI run 37803694366 ch-26 used exactly
    // 2048 completion tokens and returned the 9-beat verdict cut off mid-JSON ("could not run").
    let result = await callLLM([{ role: "user", content }], { maxTokens: 6144, temperature: 0, noCache: true, groqBatch }, "beat-check");
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
      try { if (a >= 0 && b > a) result = JSON.parse(text.slice(a, b + 1)); } catch {
        // A markdown bullet in front of a key (`- "reason": ...`) — CI run 37125010644 ch-44
        // returned all 8 verdicts with one, and the render lost its beat check. The bullet is
        // removed; nothing else is rewritten, and a still-broken answer stays a failure.
        try { if (a >= 0 && b > a) result = JSON.parse(text.slice(a, b + 1).replace(/(^|\n)([ \t]*)-[ \t]+(?=")/g, "$1$2")); } catch {}
      }
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
    // A wrong-person photo fails the WHOLE video, whatever else passed: a
    // named person is shown as that person or not at all (owner's rule
    // 2026-09-30). The one-NO tolerance below never covers it.
    const wrongPerson = failing.filter((v) => /wrong[- ]person/i.test(String(v.reason || "")));
    for (const v of wrongPerson) {
      const b = beats[v.beat_index] || {};
      const who = b.canvas?.photo?.entity || b.data?.entity || "(a named person)";
      console.log(`[review] beat ${v.beat_index}: wrong-person photo for ${who}`);
    }
    if (outPath) {
      writeFileSync(outPath, JSON.stringify({ checkedAt: new Date().toISOString(), video: videoPath, beats: verdicts.map((v) => ({ ...v, sentence: cues[v.beat_index]?.text ?? null })), failing: failing.map((v) => v.beat_index), wrong_person: wrongPerson.map((v) => v.beat_index) }, null, 2) + "\n");
    }
    if (wrongPerson.length) {
      console.error(`::error::beat check failed: wrong-person photo on beat(s) ${wrongPerson.map((v) => v.beat_index).join(", ")} — the video cannot ship`);
      process.exit(1);
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

/* ── Fake-pan check ──────────────────────────────────────────────────
 *
 *   node scripts/gemini-frame-review.js --camera-check --video <mp4> --manifest <render-manifest.json> [--out <json>]
 *
 * Owner, 2026-10-09: a photo or a graph MOVES by 8% or more across its beat (canvas-layout.js CAMERA).
 * The manifest DECLARES the move (Layer 1 camera-moves); this looks at the pixels. For every beat that
 * declares one, two frames of that beat (20% and 85% of the way through) go to Gemini, which answers
 * whether the PICTURE itself was magnified or shifted between them — ignoring text, captions and anything
 * that only popped in. A picture that is identical, or a chart whose bars merely grew, is NO.
 *
 * Gemini's eye alone was wrong on CI run 37919459134 ch-2: a photo that measures 1.09x between the two
 * frames was called "unchanged", and so was a chart whose axis widened 1.09x. So each beat is ALSO measured on
 * the pixels (scripts/lib/frame-motion.mjs: the best scale+shift taking frame A to B for a photo; the
 * widening of the chart's own axis for a graph). A beat has a real camera move when the pixels measure it OR
 * Gemini sees it; it is a fake pan only when neither does.
 *
 * Exit 0 = at most max(1, 25%) of the camera beats are fake pans. Exit 1 = more (listed). Exit 3 = could not run.
 */
async function cameraCheck() {
  const videoPath = arg("video"), manifestPath = arg("manifest"), outPath = arg("out");
  if (!videoPath || !manifestPath) { console.error("Usage: gemini-frame-review.js --camera-check --video <mp4> --manifest <manifest.json> [--out <json>]"); process.exit(2); }
  if (!llmConfigured()) { console.error("::error::camera check cannot run: no Gemini key and no Ollama server configured"); process.exit(3); }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const cam = (manifest.beats || []).map((b, i) => ({ b, i })).filter(({ b }) => b.canvas?.camera);
  if (!cam.length) { console.log("[camera-check] no photo or graph beat — nothing to check"); if (outPath) writeFileSync(outPath, JSON.stringify({ beats: [], failing: [] }) + "\n"); process.exit(0); }
  const work = join(tmpdir(), `camera-check-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  const content = [{ type: "text", text: `You are checking the CAMERA of a finished vertical video. For each beat below you get two frames, A then B, taken from the SAME beat about a second and a half apart. The beat shows a photograph or a chart; a real camera move means the PICTURE ITSELF is larger (pushed in) or shifted sideways, up or down in B compared with A, by roughly 8% or more.
IGNORE all text: headlines, labels, numbers, captions and anything that merely appeared or changed its value between the frames. Judge only the photograph, or (for a chart) the chart as a whole — its baseline, its axis, the spacing of its labels: are they larger or displaced in B?
Method: pick ONE fixed landmark in the picture (a building edge, a lamp post, the horizon; for a chart its baseline) and compare its size and position in A and in B. A push-in makes every landmark larger and moves the ones away from the centre outward.
Answer NO when the picture is the same size and in the same place in both frames (only text popped in), or when a chart only had its bars grow taller with the chart itself unchanged in size and position.
Respond ONLY with JSON: {"beats":[{"beat_index":<n>,"moved":"YES"|"NO","change":"<what moved: e.g. photo zoomed in about 9%, chart larger and its baseline lower, nothing>"}]} — exactly one entry per beat listed, with the beat_index given.` }];
  const pairs = new Map();
  try {
    for (const { b, i } of cam) {
      const d = b.duration_sec ?? 0, t0 = b.start_sec ?? 0;
      // Early (after the 6-frame pop-in) and late (before the next beat's pop-out): the move is eased over the first 90%.
      const from = (b.canvas.camera.from_frame || 0) / 30;   // the picture appears (its spoken word); the move runs from there
      const tb = t0 + Math.max(from + 0.5, Math.min(d - 0.3, d * 0.92));
      const ta = t0 + Math.min(Math.max(0.35, d * 0.1, from + 0.3), tb - t0 - 0.4);
      const fa = join(work, `b${i}-a.png`), fb = join(work, `b${i}-b.png`);
      extractFrameAtTime(videoPath, ta, fa); extractFrameAtTime(videoPath, tb, fb);
      content.push({ type: "text", text: `Beat ${i} (${b.canvas.camera.subject}): frame A at ${ta.toFixed(2)}s, then frame B at ${tb.toFixed(2)}s` });
      pairs.set(i, { fa, fb, subject: b.canvas.camera.subject });
      for (const f of [fa, fb]) content.push({ type: "image_url", image_url: { url: `data:image/png;base64,${readFileSync(f).toString("base64")}` } });
    }
    console.log(`[camera-check] ${cam.length} beat(s) with a declared camera move — asking the model`);
    let result = await callLLM([{ role: "user", content }], { maxTokens: 6144, temperature: 0, noCache: true }, "camera-check");
    if (isProviderError(result)) { console.error(`::error::camera check unavailable: ${result.source} ${result.error}`); process.exit(3); }
    if (result && !Array.isArray(result.beats) && typeof result.content === "string") {
      const text = result.content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const a = text.indexOf("{"), z = text.lastIndexOf("}");
      try { if (a >= 0 && z > a) result = JSON.parse(text.slice(a, z + 1)); } catch {}
    }
    const verdicts = Array.isArray(result?.beats) ? result.beats : null;
    if (!verdicts || verdicts.length !== cam.length) { console.error(`::error::camera check returned ${verdicts ? verdicts.length : "no"} verdict(s) for ${cam.length} beats: ${JSON.stringify(result).slice(0, 300)}`); process.exit(3); }
    // The pixels.
    const { estimateMotion, axisWidth } = await import("./lib/frame-motion.mjs");
    const measured = new Map();
    for (const [i, p] of pairs) {
      try {
        if (p.subject === "graph") {
          const [wa, wb] = [await axisWidth(p.fa), await axisWidth(p.fb)];
          if (wa && wb) { measured.set(i, { moved: wb / wa >= 1.05 || wa / wb >= 1.05, what: `axis ${wa}px -> ${wb}px (x${(wb / wa).toFixed(3)})` }); continue; }
        }
        const m = await estimateMotion(p.fa, p.fb);
        measured.set(i, { moved: m.moved, what: `scale ${m.scale}, shift ${m.shift.join(",")}, error ${m.identity_mse} -> ${m.best_mse}` });
      } catch (e) { measured.set(i, { moved: false, what: `not measured (${e.message})` }); }
    }
    for (const v of verdicts) {
      const px = measured.get(Number(v.beat_index));
      v.pixels = px || null;
      v.real = String(v.moved).toUpperCase() === "YES" || !!px?.moved;
      console.log(`[camera-check] beat ${v.beat_index}: gemini ${v.moved} (${v.change}); pixels ${px ? (px.moved ? "MOVED" : "still") + " — " + px.what : "n/a"} -> ${v.real ? "REAL" : "FAKE"}`);
    }
    const failing = verdicts.filter((v) => !v.real);
    if (outPath) writeFileSync(outPath, JSON.stringify({ checkedAt: new Date().toISOString(), video: videoPath, beats: verdicts, failing: failing.map((v) => v.beat_index) }, null, 2) + "\n");
    const allowed = Math.max(1, Math.floor(cam.length * 0.25));
    if (failing.length > allowed) { console.error(`::error::camera check failed: ${failing.length}/${cam.length} photo/graph beats show no real camera move (beats ${failing.map((v) => v.beat_index).join(", ")})`); process.exit(1); }
    console.log(`[camera-check] PASS: ${cam.length - failing.length}/${cam.length} beats show a real camera move`);
    process.exit(0);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/* ── Entity check on the rendered frames ─────────────────────────────
 *
 *   node scripts/gemini-frame-review.js --entity-check --video <mp4> --manifest <render-manifest.json> [--out <json>]
 *
 * Owner, 2026-10-09: "Never report a manifest check as proof while the contact sheet shows otherwise." scripts/entity-coverage.js
 * answers from the manifest (what the beat says it drew); this asks Gemini of the PIXELS: one frame per beat that names an
 * entity (after its picture pops), the entities listed, and the question "is it shown — its flag, its map with it highlighted, its
 * portrait or logo, a plate with its name, its date card, its time scale, its figure — or only written?". A flag of the wrong
 * country, a generic map, a name in type alone are NO.
 *
 * Exit 0 = at most max(1, 20%) of those beats are NO. Exit 1 = more (listed). Exit 3 = could not run.
 */
async function entityCheck() {
  const videoPath = arg("video"), manifestPath = arg("manifest"), outPath = arg("out");
  if (!videoPath || !manifestPath) { console.error("Usage: gemini-frame-review.js --entity-check --video <mp4> --manifest <manifest.json> [--out <json>]"); process.exit(2); }
  if (!llmConfigured()) { console.error("::error::entity check cannot run: no Gemini key and no Ollama server configured"); process.exit(3); }
  const { entitiesOf, primaryOf } = await import("./entity-coverage.js");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const jobs = (manifest.beats || []).map((b, i) => {
    const c = b.canvas || {};
    const ents = entitiesOf({ sentence: c.sentence || "", named_entities: c.entities || [] });
    return ents.length ? { b, i, ents, primary: primaryOf(ents, c.photo?.entity || c.data?.entity || null), sentence: c.sentence || "" } : null;
  }).filter(Boolean);
  if (!jobs.length) { console.log("[entity-check] no beat names an entity — nothing to check"); if (outPath) writeFileSync(outPath, JSON.stringify({ beats: [], failing: [] }) + "\n"); process.exit(0); }
  const work = join(tmpdir(), `entity-check-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  const content = [{ type: "text", text: `You are checking a finished vertical video, beat by beat. For each beat you get its narration sentence, the ENTITIES the sentence names, and ONE frame from the beat.
Question for every beat: is an entity the sentence names SHOWN in the frame — drawn, not just written? Shown means: a flag of THAT country; a map with THAT place highlighted; a photograph or portrait of THAT person or place; THAT organisation's logo, building or a plate that carries its name over a drawn symbol; a calendar page or date card with THAT date; a time scale for THAT span; a chart or number card that draws THAT figure.
Answer NO when a generic stock icon (a building, document, file or box glyph) stands in for the entity — the entity's real mark, or its name set in type, is YES; when the entity is only written as words in the headline, when the picture is of a different entity (another country's flag, a generic Europe map for France, a stock photo that is not it), or when the frame is words alone. The owner's rule for an organisation with no free, verified logo, a person with no verified portrait, or a place with no map: its NAME set large in the serif as the frame's centrepiece (between a hairline and an accent rule) IS its visual. Where a beat below says "name plate allowed for X", that type card carrying THAT name answers YES for X. A name in the headline or the caption is still NO.
The word caption at the bottom is on every beat by design: ignore it, and ignore the headline when judging whether the picture shows the entity.
Respond ONLY with JSON: {"beats":[{"beat_index":<n>,"entity_shown":"YES"|"NO","shown":"<what picture the frame has>","missing":"<the entity that is not shown, or empty>"}]} — exactly one entry per beat listed, with the beat_index given.` }];
  try {
    for (const { b, i, ents, primary, sentence } of jobs) {
      const d = b.duration_sec ?? 0, t0 = b.start_sec ?? 0;
      const popSec = Number.isFinite(b.canvas?.entity_pop?.frame) ? b.canvas.entity_pop.frame / 30 + 0.4 : 0;
      const t = t0 + Math.min(Math.max(d * 0.62, popSec), Math.max(0, d - 0.1));
      const fp = join(work, `b${i}.png`);
      extractFrameAtTime(videoPath, t, fp);
      const art = b.canvas?.art || null;
      const plated = art && (String(art.kind).startsWith("plate-") || art.kind === "plates") ? (art.kind === "plates" ? art.names || [] : [art.name]).filter((nm, k) => nm && !(art.items && art.items[k] && art.items[k].asset)) : [];
      content.push({ type: "text", text: `Beat ${i}. Sentence: "${sentence}". Entities named: ${ents.map((e) => `${e.type} "${e.name}"`).join("; ")}. The sentence is mainly about: ${primary ? `${primary.type} "${primary.name}"` : "(unclear)"}.${plated.length ? ` Name plate allowed for: ${plated.map((n) => `"${n}"`).join(", ")} (no free verified logo / portrait / map exists).` : ""}` });
      content.push({ type: "image_url", image_url: { url: `data:image/png;base64,${readFileSync(fp).toString("base64")}` } });
    }
    console.log(`[entity-check] ${jobs.length} beat(s) name an entity — asking the model`);
    let result = await callLLM([{ role: "user", content }], { maxTokens: 6144, temperature: 0, noCache: true }, "entity-check");
    if (isProviderError(result)) { console.error(`::error::entity check unavailable: ${result.source} ${result.error}`); process.exit(3); }
    if (result && !Array.isArray(result.beats) && typeof result.content === "string") {
      const text = result.content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const a = text.indexOf("{"), z = text.lastIndexOf("}");
      try { if (a >= 0 && z > a) result = JSON.parse(text.slice(a, z + 1)); } catch {}
    }
    const verdicts = Array.isArray(result?.beats) ? result.beats : null;
    if (!verdicts || verdicts.length !== jobs.length) { console.error(`::error::entity check returned ${verdicts ? verdicts.length : "no"} verdict(s) for ${jobs.length} beats: ${JSON.stringify(result).slice(0, 300)}`); process.exit(3); }
    for (const v of verdicts) console.log(`[entity-check] beat ${v.beat_index}: ${v.entity_shown} — shows: ${v.shown}${v.missing ? ` — missing: ${v.missing}` : ""}`);
    const failing = verdicts.filter((v) => String(v.entity_shown).toUpperCase() !== "YES");
    if (outPath) writeFileSync(outPath, JSON.stringify({ checkedAt: new Date().toISOString(), video: videoPath, beats: verdicts, failing: failing.map((v) => v.beat_index) }, null, 2) + "\n");
    const allowed = Math.max(1, Math.floor(jobs.length * 0.2));
    if (failing.length > allowed) { console.error(`::error::entity check failed: ${failing.length}/${jobs.length} beats name an entity their frame does not show (beats ${failing.map((v) => v.beat_index).join(", ")})`); process.exit(1); }
    console.log(`[entity-check] PASS: ${jobs.length - failing.length}/${jobs.length} beats show an entity they name`);
    process.exit(0);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/* ── Look check on the rendered frames ───────────────────────────────
 *
 *   node scripts/gemini-frame-review.js --look-check --video <mp4> --manifest <render-manifest.json> [--channel <id>] [--out <json>] [--sheet-dir <dir>]
 *
 * Owner, 2026-10-09: "they shouldn't look playful — actually that motion graphic." The pixel measures (scripts/lib/flat-look.cjs, Layer 1
 * `flat-look`) judge palette, corners and shadows; this asks Gemini the whole-picture question the measures cannot: do the drawn components
 * (chart, date card, time scale, plate, diagram) belong to the REFERENCE's visual family — flat, thin-ruled, typographic — or do they read
 * as a chart library's playful defaults (rounded, thick, saturated, shadowed, bouncy-looking)? The reference frames are the channel's own
 * (scripts/reference-frames.js). For each judged beat a side-by-side PNG (reference frame | rendered beat) is written to --sheet-dir.
 *
 * Exit 0 = at most max(1, 20%) of the judged beats are PLAYFUL / not the same family. Exit 1 = more (listed). Exit 3 = could not run.
 */
async function lookCheck() {
  const videoPath = arg("video"), manifestPath = arg("manifest"), outPath = arg("out"), sheetDir = arg("sheet-dir"), channelId = arg("channel");
  if (!videoPath || !manifestPath) { console.error("Usage: gemini-frame-review.js --look-check --video <mp4> --manifest <manifest.json> [--channel <id>] [--out <json>] [--sheet-dir <dir>]"); process.exit(2); }
  if (!llmConfigured()) { console.error("::error::look check cannot run: no Gemini key and no Ollama server configured"); process.exit(3); }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const COMPS = new Set(["ENTITY-ART", "DATA-FULL", "TIMELINE", "PROCESS-FULL"]);
  const jobs = (manifest.beats || []).map((b, i) => ({ b, i })).filter(({ b }) => COMPS.has(b.canvas?.composition) && !(b.canvas?.composition === "ENTITY-ART" && b.canvas?.art?.kind === "flag"));
  if (!jobs.length) { console.log("[look-check] no chart / date / scale / plate / diagram beat — nothing to check"); if (outPath) writeFileSync(outPath, JSON.stringify({ beats: [], failing: [] }) + "\n"); process.exit(0); }
  const { referenceFramesFor, imageParts } = await import("./reference-frames.js");
  const ref = referenceFramesFor(channelId || "");
  if (!ref.files.length) { console.error(`::error::look check cannot run: no reference frames (${ref.why})`); process.exit(3); }
  const work = join(tmpdir(), `look-check-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  if (sheetDir) mkdirSync(sheetDir, { recursive: true });
  const content = [{ type: "text", text: `You are checking the DRAWN COMPONENTS of a finished vertical video against its REFERENCE. The first ${ref.files.length} images are frames of the reference: the look every component must belong to — flat, sharp-cornered or barely rounded, thin even rules and strokes, a restrained palette (ink, neutrals and ONE accent), no shadows, typographic dates and scales, nothing springy.
Then, for each beat listed, you get ONE rendered frame containing a chart, graph, timeline, date card, time scale, diagram or plate. For each, answer:
- family: YES if it could sit in the reference's visual language; NO if it reads as a different family.
- playful: YES if ANY of these is true — a generic stock icon (building / document / file / box glyph) standing in for a named entity, the same icon repeated on several boxes, rounded corners or pill shapes, thick heavy strokes or rings, saturated or candy colours (more than the one accent), drop shadows or glow, cartoon / filled icons, a wall-calendar grid, chart-library default styling; otherwise NO.
The word caption at the bottom and the headline type are on every beat by design: judge the drawn component, not those.
Respond ONLY with JSON: {"beats":[{"beat_index":<n>,"family":"YES"|"NO","playful":"YES"|"NO","issues":"<what is off, or empty>"}]} — exactly one entry per beat listed, with the beat_index given.` }, ...imageParts(ref.files)];
  try {
    const sheets = [];
    for (const { b, i } of jobs) {
      const d = b.duration_sec ?? 0, t0 = b.start_sec ?? 0, c = b.canvas || {};
      const popSec = Number.isFinite(c.entity_pop?.frame) ? c.entity_pop.frame / 30 + 0.4 : 0.9;
      const t = t0 + Math.min(Math.max(d * 0.62, popSec), Math.max(0, d - 0.1));
      const fp = join(work, `b${i}.png`);
      extractFrameAtTime(videoPath, t, fp);
      content.push({ type: "text", text: `Beat ${i}: ${c.composition}${c.art ? ` (${c.art.kind})` : ""}${c.visual_type ? ` ${c.visual_type}` : ""}.` });
      content.push({ type: "image_url", image_url: { url: `data:image/png;base64,${readFileSync(fp).toString("base64")}` } });
      if (sheetDir) {
        const sp = join(sheetDir, `look-beat-${i}.png`);
        try {
          execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", ref.files[i % ref.files.length], "-i", fp, "-filter_complex", "[0:v]scale=-2:960[a];[1:v]scale=-2:960[b];[a][b]hstack", "-frames:v", "1", sp]);
          sheets.push(sp);
        } catch (e) { console.error(`[look-check] side-by-side for beat ${i} failed: ${String(e.message).slice(0, 120)}`); }
      }
    }
    console.log(`[look-check] ${jobs.length} component beat(s) against ${ref.files.length} reference frame(s) from ${ref.source} — asking the model`);
    let result = await callLLM([{ role: "user", content }], { maxTokens: 6144, temperature: 0, noCache: true }, "look-check");
    if (isProviderError(result)) { console.error(`::error::look check unavailable: ${result.source} ${result.error}`); process.exit(3); }
    if (result && !Array.isArray(result.beats) && typeof result.content === "string") {
      const text = result.content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const a = text.indexOf("{"), z = text.lastIndexOf("}");
      try { if (a >= 0 && z > a) result = JSON.parse(text.slice(a, z + 1)); } catch {}
    }
    // Matched by beat_index: an extra or reordered entry is ignored; a missing one is a check that could not run.
    const byIdx = new Map((Array.isArray(result?.beats) ? result.beats : []).map((v) => [Number(v.beat_index), v]));
    const verdicts = jobs.every(({ i }) => byIdx.has(i)) ? jobs.map(({ i }) => byIdx.get(i)) : null;
    if (!verdicts || verdicts.length !== jobs.length) { console.error(`::error::look check returned ${verdicts ? verdicts.length : "no"} verdict(s) for ${jobs.length} beats: ${JSON.stringify(result).slice(0, 300)}`); process.exit(3); }
    for (const v of verdicts) console.log(`[look-check] beat ${v.beat_index}: family ${v.family}, playful ${v.playful}${v.issues ? ` — ${v.issues}` : ""}`);
    const failing = verdicts.filter((v) => String(v.family).toUpperCase() !== "YES" || String(v.playful).toUpperCase() === "YES");
    if (outPath) writeFileSync(outPath, JSON.stringify({ checkedAt: new Date().toISOString(), video: videoPath, reference: ref.source, beats: verdicts, failing: failing.map((v) => v.beat_index), sheets }, null, 2) + "\n");
    const allowed = Math.max(1, Math.floor(jobs.length * 0.2));
    if (failing.length > allowed) { console.error(`::error::look check failed: ${failing.length}/${jobs.length} component beats are not the reference's family or look playful (beats ${failing.map((v) => v.beat_index).join(", ")})`); process.exit(1); }
    console.log(`[look-check] PASS: ${jobs.length - failing.length}/${jobs.length} component beats match the reference's look${failing.length ? ` (flagged: ${failing.map((v) => v.beat_index).join(", ")})` : ""}`);
    process.exit(0);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/* ── Naming check on the rendered frames ─────────────────────────────
 *
 *   node scripts/gemini-frame-review.js --naming-check --video <mp4> --manifest <render-manifest.json> [--out <json>]
 *
 * Owner, 2026-10-10: "Every entity on screen must be named correctly and consistently ... a misspelling, a wrong place, or an unnamed
 * entity fails the beat" — and "every check must read the RENDERED FRAME". One frame per beat (after its words have landed) goes to Gemini
 * with the beat's sentence: it reads every person, place, organisation and figure the FRAME shows (the bottom word caption excluded) and
 * judges each against the sentence: spelled exactly as the sentence spells it; the same place / person / organisation (not a broader region,
 * not a namesake); a figure with the number and unit the sentence states. ANY failing beat fails the video (no tolerance).
 *
 * Exit 0 = every beat names correctly. Exit 1 = a beat misnames (listed). Exit 3 = could not run.
 */
async function namingCheck() {
  const videoPath = arg("video"), manifestPath = arg("manifest"), outPath = arg("out");
  if (!videoPath || !manifestPath) { console.error("Usage: gemini-frame-review.js --naming-check --video <mp4> --manifest <manifest.json> [--out <json>]"); process.exit(2); }
  if (!llmConfigured()) { console.error("::error::naming check cannot run: no Gemini key and no Ollama server configured"); process.exit(3); }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const jobs = (manifest.beats || []).map((b, i) => ({ b, i, sentence: b.canvas?.sentence || "" })).filter((j) => j.sentence);
  if (!jobs.length) { if (outPath) writeFileSync(outPath, JSON.stringify({ beats: [], failing: [] }) + "\n"); process.exit(0); }
  const work = join(tmpdir(), `naming-check-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  const content = [{ type: "text", text: `You are proof-reading a finished vertical video, beat by beat. For each beat you get its narration sentence and ONE frame.
Read every proper name (person, place, organisation, product), every date and every figure that the FRAME shows — in the headline, labels, plates, logos, maps or charts. IGNORE the word-by-word caption strip at the very bottom of the frame.
For each one judge it against the sentence:
- spelling: exactly as the sentence spells it (case aside). "Gemany" for "Germany", "Elon Musc" for "Elon Musk" are wrong.
- identity: the same place / person / organisation the sentence names — not a broader region (a "Europe" label for "France"), not a different place with the same name, not a different company.
- figures: the number and its unit as the sentence states them ("$86 million", not "$86" or "86 billion").
A frame that shows no name, date or figure passes.
Respond ONLY with JSON: {"beats":[{"beat_index":<n>,"names":[{"shown":"<as on screen>","expected":"<as the sentence has it>","ok":true|false,"problem":"<empty or what is wrong>"}],"verdict":"PASS"|"FAIL"}]} — one entry per beat listed, by beat_index.` }];
  try {
    for (const { b, i, sentence } of jobs) {
      const t = (b.start_sec ?? 0) + Math.max(0.1, (b.duration_sec ?? 0) * 0.85);
      const fp = join(work, `b${i}.png`);
      extractFrameAtTime(videoPath, t, fp);
      content.push({ type: "text", text: `Beat ${i}. Sentence: "${sentence}".` });
      content.push({ type: "image_url", image_url: { url: `data:image/png;base64,${readFileSync(fp).toString("base64")}` } });
    }
    console.log(`[naming-check] ${jobs.length} beat(s) — asking the model`);
    let result = await callLLM([{ role: "user", content }], { maxTokens: 8192, temperature: 0, noCache: true }, "naming-check");
    if (isProviderError(result)) { console.error(`::error::naming check unavailable: ${result.source} ${result.error}`); process.exit(3); }
    if (result && !Array.isArray(result.beats) && typeof result.content === "string") {
      const text = result.content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const a = text.indexOf("{"), z = text.lastIndexOf("}");
      try { if (a >= 0 && z > a) result = JSON.parse(text.slice(a, z + 1)); } catch {}
    }
    const byIdx = new Map((Array.isArray(result?.beats) ? result.beats : []).map((v) => [Number(v.beat_index), v]));
    if (!jobs.every(({ i }) => byIdx.has(i))) { console.error(`::error::naming check returned ${byIdx.size} verdict(s) for ${jobs.length} beats`); process.exit(3); }
    const verdicts = jobs.map(({ i }) => byIdx.get(i));
    for (const v of verdicts) console.log(`[naming-check] beat ${v.beat_index}: ${v.verdict}${(v.names || []).filter((n) => n.ok === false).map((n) => ` — "${n.shown}" should be "${n.expected}" (${n.problem})`).join("")}`);
    const failing = verdicts.filter((v) => String(v.verdict).toUpperCase() !== "PASS" || (v.names || []).some((n) => n.ok === false));
    if (outPath) writeFileSync(outPath, JSON.stringify({ checkedAt: new Date().toISOString(), video: videoPath, beats: verdicts, failing: failing.map((v) => v.beat_index) }, null, 2) + "\n");
    if (failing.length) { console.error(`::error::naming check failed: ${failing.length}/${jobs.length} beats misname an entity (beats ${failing.map((v) => v.beat_index).join(", ")})`); process.exit(1); }
    console.log(`[naming-check] PASS: every name, place, organisation and figure on screen matches the narration`);
    process.exit(0);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

async function main() {
  if (process.argv.includes("--beat-check")) return beatCheck();
  if (process.argv.includes("--camera-check")) return cameraCheck();
  if (process.argv.includes("--entity-check")) return entityCheck();
  if (process.argv.includes("--look-check")) return lookCheck();
  if (process.argv.includes("--naming-check")) return namingCheck();
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

    // The verdict is computed HERE, before the record is written, and persisted with it.
    // It used to be computed after writeFileSync and only ever printed, so the report
    // on disk had no verdict at all — render-and-qa.js:801-806 re-derived one from
    // looser fields and logged "Gemini verdict: UNKNOWN", and backupAudit then let
    // the deterministic audit overrule the model's own FAIL into approved-review.
    // A judgement that is not written down cannot be audited, replayed, or overruled
    // on purpose. Where each threshold came from is noted per branch.
    const monoculture = wholeResult.headline_test?.monoculture;
    // Fail CLOSED on a review that did not run. The guard below is
    // `status === "FAIL" && severity in (CRITICAL, HIGH)`, so a whole-video result that
    // ERRORED — quota exhausted, provider unreachable, unparseable answer, every frame
    // review errored — has no `status` at all, fails that guard, and fell straight
    // through to APPROVED with the reason "video meets Visual Bible standards".
    // Caured live in CI run 37344388859: all four Groq runs printed
    // "Whole-video review ERROR: quota_exhausted" and then "VERDICT: APPROVED".
    //
    // A review that did not happen is not a pass. This is deliberately NOT "REJECTED" —
    // nobody has any evidence the video is bad — it is INDETERMINATE, and it blocks so
    // the stage is treated as failed and backupAudit's deterministic local audit decides.
    // Same rule render-and-qa.js already states for itself: "a review that did not run is
    // NOT a pass".
    //
    // PROVIDER UNAVAILABLE is split out from REVIEW_FAILED because the two call for
    // different operator responses and a run's log should say which one happened. It gets
    // its own exit code (4; 0/1/2/3 were already in use) so a scheduler can retry on one and
    // not the other. REVIEW_FAILED stays blocking either way — this is legibility, not a
    // softening, and an unavailable verifier must never become an approving one.
    const wholeReviewed = !wholeResult.error && !!wholeResult.status;
    const framesReviewed = sceneResults.filter((r) => r.tier !== "ERROR" && r.quality_score != null).length;
    const reviewFailed = !wholeReviewed || framesReviewed === 0;
    const answeringProvider = wholeResult.provider || sceneResults.find((r) => r.provider)?.provider || null;
    const providerNotTrusted = !!answeringProvider && !VERDICT_PROVIDERS.has(answeringProvider);

    const verdict = providerNotTrusted
      ? {
          verdict: "PROVIDER_UNAVAILABLE",
          reason: `${answeringProvider} answered the visual review but is not an accepted verdict provider (accepted: ${[...VERDICT_PROVIDERS].join(", ")}). Its reading is discarded, not counted as a pass or a fail.`,
          rule: "only an accepted provider may produce a visual verdict; an untrusted answer is discarded, never approved",
          blocking: true,
          exit: EXIT_PROVIDER_UNAVAILABLE,
        }
      : reviewFailed
      ? {
          verdict: "REVIEW_FAILED",
          reason: !wholeReviewed
            ? `whole-video review did not run: ${wholeResult.error || "no status returned"}`
            : `no frame review returned a verdict (${framesReviewed} of ${beatTimes.length} frames reviewed)`,
          rule: "a review that did not run is never a pass",
          blocking: true,
          exit: 1,
        }
      : criticalCount > 0 || monoculture
      ? {
          verdict: "REJECTED",
          reason: monoculture
            ? `TEMPLATE_MONOCULTURE — ${wholeResult.headline_test.percent}% headline-dominated beats`
            : `${criticalCount} CRITICAL failure(s)`,
          rule: "any CRITICAL frame, or a headline monoculture",
          blocking: true,
          exit: fixMode ? 0 : 1,
        }
      : highCount > Math.floor(beatTimes.length * 0.3)
        ? {
            verdict: "NEEDS IMPROVEMENT",
            reason: `${highCount} HIGH issues across ${beatTimes.length} frames`,
            rule: `HIGH issues > 30% of frames (${highCount} > ${Math.floor(beatTimes.length * 0.3)})`,
            blocking: !fixMode,
            exit: fixMode ? 0 : 1,
          }
        : wholeResult.status === "FAIL" && (wholeResult.severity === "CRITICAL" || wholeResult.severity === "HIGH")
          ? {
              verdict: "NEEDS IMPROVEMENT",
              reason: `whole-video review flagged ${wholeResult.severity} issues`,
              rule: "whole-video status FAIL at severity CRITICAL/HIGH",
              blocking: !fixMode,
              exit: fixMode ? 0 : 1,
            }
          : {
              verdict: "APPROVED",
              reason: "video meets Visual Bible standards",
              rule: "no CRITICAL, HIGH <= 30% of frames, whole-video not FAIL at CRITICAL/HIGH",
              blocking: false,
              exit: 0,
            };

    // pipelineVerdict / pipelineReason are STRINGS on purpose: render-and-qa.js:810
    // already reads `report.pipelineVerdict === "APPROVED"` and had been falling
    // through to its own re-derivation precisely because this field never existed.
    // Writing an object here would have compared an object to a string and failed
    // every review. The full breakdown is kept alongside, not instead.
    const record = {
      generatedAt: new Date().toISOString(),
      bibleVersion: bible.version,
      video: basename(video),
      channel: channelId,
      duration: duration.toFixed(2),
      totalFrames: beatTimes.length,
      // Who actually answered. `reviewProvider` is the one that produced this verdict;
      // `reviewProviderChain` is every provider tried. Absent on a record written before
      // this field existed — treat that as "unknown", never as "gemini".
      reviewProvider: wholeResult.provider || null,
      reviewProviderChain: wholeResult.provider_chain || null,
      pipelineVerdict: verdict.verdict,
      pipelineReason: verdict.reason,
      verdictRule: verdict.rule,
      verdictBlocking: verdict.blocking,
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
    // Printed from the persisted record, not recomputed, so what is logged is exactly
    // what was written. The banner keeps the old wording; the provider line below it is
    // what makes the judgement attributable.
    console.log(`\n═══ VISUAL REVIEW — FINAL VERDICT ═══`);
    console.log(`  Bible: v${bible.version} (${Object.keys(bible.rules).length} rules)`);
    console.log(`  Frames reviewed: ${beatTimes.length}`);
    console.log(`  CRITICAL: ${criticalCount}  HIGH: ${highCount}  PASS: ${passCount}`);
    console.log(`  Avg quality: ${avgScore}/10`);
    console.log(`  Pass rate: ${record.summary.passRate}`);
    console.log(`  Whole-video: ${wholeResult.status || "ERROR"} (${wholeResult.overall_score || "?"}/10)`);
    console.log(`  Answered by: ${record.reviewProvider || "unknown"}${record.reviewProviderChain ? ` (chain: ${record.reviewProviderChain.join(" → ")})` : ""}`);
    console.log(`  Report: ${outFile}`);

    console.log(`\n  VERDICT: ${verdict.verdict} — ${verdict.reason}`);
    console.log(`  (rule: ${verdict.rule})`);
    if (verdict.verdict === "REJECTED" && fixMode) {
      console.log(`  Corrections written to report. Pipeline should apply and re-render.`);
    }
    if (verdict.blocking) process.exit(verdict.exit ?? 1);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
