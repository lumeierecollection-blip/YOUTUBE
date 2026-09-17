#!/usr/bin/env node
/**
 * local-visual-auditor.js — deterministic, free QA that runs on EVERY video
 * so an expensive vision model does not have to.
 *
 * The economics for scaling to many channels: most QA questions are things
 * MATH can answer (black frames, static/frozen sections, motion, safe-area,
 * plan compliance, monoculture, audio levels). Only genuine visual-SEMANTIC
 * judgment ("does this visual communicate the intended meaning?") needs
 * Gemini. This auditor does all the deterministic checks locally and emits a
 * RISK assessment plus the specific UNCERTAIN beats — so render-and-qa.js can
 * skip the Gemini review entirely on low-risk videos and, when it does call
 * Gemini, only send the beats the code could not confidently judge.
 *
 * Inputs (all optional except --video):
 *   --video <mp4>       the rendered video
 *   --plan <json>       the authoritative visual plan (director intent)
 *   --manifest <json>   render.js's per-beat manifest (what was actually built)
 *   --srt <srt>         caption timing (beat windows)
 *   --channel <id>      channel id (for the visual fingerprint history)
 *   --out <json>        report path (default: alongside the video)
 *
 * Output: a JSON report { technical, visual, plan_compliance, audio,
 * channel_history, risk, gemini_required, uncertain_beats } and a console
 * summary. Exit code is always 0 — this is advisory; the hard technical gate
 * remains scripts/frame-audit.js. Never throws into the pipeline.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import sharp from "sharp";
import {
  wordCount, estimateEmWidth, isHeadlineLike, isTranscriptLike, toSingleLine,
  TYPO_TARGET_MAX_WORDS, TYPO_HARD_MAX_WORDS, TYPO_MAX_CHARS,
  TYPO_MIN_READABLE_PX, TYPO_SAFE_WIDTH_FRACTION, TYPO_MAX_BEAT_SHARE,
} from "../src/skills/remotion-render/visual/narrative-typography.js";
import {
  isFigureShaped, labelFit, MIN_LABEL_PX,
} from "../src/skills/remotion-render/visual/scene-text.js";

/** Mechanism name for a manifest beat, for readable issue text. */
const mechLabel = (b) => b.mechanism || "object-first";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const compositorPkg = process.platform === "win32"
  ? "@remotion/compositor-win32-x64-msvc" : "@remotion/compositor-linux-x64-gnu";
const binExt = process.platform === "win32" ? ".exe" : "";
const FFMPEG_MIN = join(ROOT, "src", "skills", "remotion-render", "node_modules", compositorPkg, `ffmpeg${binExt}`);
const ffmpegStatic = join(ROOT, "node_modules", "ffmpeg-static", `ffmpeg${binExt}`);
const FFMPEG = existsSync(ffmpegStatic) ? ffmpegStatic : FFMPEG_MIN;
const FFPROBE = join(dirname(FFMPEG_MIN), `ffprobe${binExt}`);

// Safe area for shorts (mirrors src/skills/remotion-render/layout/slots.js).
const SAFE = { top: 288, bottom: 1248, left: 48, right: 888, W: 1080, H: 1920 };
// Mechanisms whose frame is dominated by a number/chart/words.
const TEXT_FORWARD = new Set(["TYPOGRAPHY", "EVIDENCE_FIGURE"]);
const GRAPH_MECHANISMS = new Set(["EVIDENCE_FIGURE", "DATA_CHART"]);

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}
function readJson(p) {
  try { return p && existsSync(p) ? JSON.parse(readFileSync(p, "utf-8")) : null; } catch { return null; }
}
function resolveIn(p) {
  if (!p) return null;
  return existsSync(p) ? p : (existsSync(join(ROOT, p)) ? join(ROOT, p) : null);
}

/* ── ffprobe / ffmpeg helpers ────────────────────────────────────────── */

function probe(video) {
  try {
    const out = execFileSync(FFPROBE, [
      "-v", "error", "-show_entries",
      "stream=codec_type,width,height,r_frame_rate:format=duration",
      "-of", "json", video,
    ], { encoding: "utf-8" });
    const j = JSON.parse(out);
    const v = (j.streams || []).find((s) => s.codec_type === "video") || {};
    const a = (j.streams || []).find((s) => s.codec_type === "audio") || null;
    const [n, d] = String(v.r_frame_rate || "30/1").split("/").map(Number);
    return {
      width: v.width || null, height: v.height || null,
      fps: d ? +(n / d).toFixed(2) : null,
      durationSec: +parseFloat(j.format?.duration || 0).toFixed(2),
      hasAudio: !!a,
    };
  } catch (e) {
    return { error: String(e.message).slice(0, 200) };
  }
}

// Extract N evenly-spaced frames (inset past the fade boundaries) as small
// grayscale buffers for hashing/luminance/motion — cheap, deterministic.
async function sampleFrames(video, durationSec, n = 24) {
  const work = join(tmpdir(), `lva-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  const inset = Math.min(0.4, durationSec * 0.05);
  const lo = inset, hi = Math.max(lo + 0.1, durationSec - inset);
  const frames = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? (lo + hi) / 2 : lo + ((hi - lo) * i) / (n - 1);
    const png = join(work, `f${String(i).padStart(2, "0")}.png`);
    try {
      execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-ss", t.toFixed(3),
        "-i", video, "-frames:v", "1", "-vf", "scale=64:114", "-y", png], {});
      const { data } = await sharp(png).grayscale().raw().toBuffer({ resolveWithObject: true });
      frames.push({ i, t: +t.toFixed(2), data, w: 64, h: 114 });
    } catch { /* skip unreadable frame */ }
  }
  try { rmSync(work, { recursive: true, force: true }); } catch {}
  return frames;
}

function meanLuma(f) { let s = 0; for (let i = 0; i < f.data.length; i++) s += f.data[i]; return s / f.data.length / 255; }
// 8x8 average-hash from the 64x114 gray buffer (downsample by block mean).
function aHash(f) {
  const bw = Math.floor(f.w / 8), bh = Math.floor(f.h / 8), cells = [];
  for (let by = 0; by < 8; by++) for (let bx = 0; bx < 8; bx++) {
    let s = 0, c = 0;
    for (let y = by * bh; y < (by + 1) * bh; y++) for (let x = bx * bw; x < (bx + 1) * bw; x++) { s += f.data[y * f.w + x]; c++; }
    cells.push(s / Math.max(1, c));
  }
  const mean = cells.reduce((a, b) => a + b, 0) / cells.length;
  return cells.map((v) => (v >= mean ? 1 : 0));
}
function hamming(a, b) { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; }
function frameDiff(a, b) { let s = 0; for (let i = 0; i < a.data.length; i++) s += Math.abs(a.data[i] - b.data[i]); return s / a.data.length / 255; }

/* ── VISUAL checks ───────────────────────────────────────────────────── */

function auditVisual(frames) {
  if (frames.length < 2) return { ok: false, note: "too few frames sampled" };
  const lumas = frames.map(meanLuma);
  const hashes = frames.map(aHash);
  const blackFrames = frames.filter((f, i) => lumas[i] < 0.02).map((f) => f.t);
  // motion: mean consecutive frame diff
  let motionSum = 0, changes = 0, staticRun = 0, maxStaticRun = 0;
  for (let i = 1; i < frames.length; i++) {
    const d = frameDiff(frames[i - 1], frames[i]);
    motionSum += d;
    const hd = hamming(hashes[i - 1], hashes[i]);
    if (hd >= 12) changes++;           // large composition change
    if (hd <= 2 && d < 0.02) { staticRun++; maxStaticRun = Math.max(maxStaticRun, staticRun); } else staticRun = 0;
  }
  const meanMotion = motionSum / (frames.length - 1);
  // near-duplicate non-adjacent frames (repeated imagery)
  let dupPairs = 0;
  for (let i = 0; i < hashes.length; i++) for (let j = i + 2; j < hashes.length; j++) if (hamming(hashes[i], hashes[j]) <= 2) dupPairs++;
  const secPerFrame = frames.length > 1 ? (frames[frames.length - 1].t - frames[0].t) / (frames.length - 1) : 0;
  return {
    ok: true,
    meanLuma: +(lumas.reduce((a, b) => a + b, 0) / lumas.length).toFixed(3),
    blackFrames,
    blackFrameCount: blackFrames.length,
    meanMotion: +meanMotion.toFixed(4),
    lowMotion: meanMotion < 0.012,
    sceneChanges: changes,
    maxStaticRunSec: +(maxStaticRun * secPerFrame).toFixed(2),
    nearDuplicatePairs: dupPairs,
  };
}

/* ── PLAN-COMPLIANCE checks (manifest vs plan — deterministic) ───────── */

function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

function auditPlanCompliance(plan, manifest) {
  if (!manifest) return { ok: false, note: "no render manifest" };
  const mBeats = manifest.beats || [];
  const pBeats = plan?.beats || [];
  const issues = [];

  // beat count parity
  if (pBeats.length && mBeats.length !== pBeats.length) {
    issues.push({ owner: "PLAN_COMPLIANCE", beat: null, problem: `beat count mismatch: plan ${pBeats.length} vs render ${mBeats.length}` });
  }

  // per-beat typography presence + graph justification
  for (let i = 0; i < mBeats.length; i++) {
    const m = mBeats[i];
    const p = pBeats[i];
    const dir = p?.direction || {};
    // typography: if the director named specific on-screen text, it should appear
    if (dir.typography && dir.typography !== "none" && dir.typography.length <= 40) {
      const want = norm(dir.typography);
      const got = (m.text || []).map(norm).join(" ");
      // only assert when the directed text is a short specific token (a number/label)
      if (want && want.length >= 2 && /[0-9$%]/.test(dir.typography) && !got.includes(want)) {
        issues.push({ owner: "PLAN_COMPLIANCE", beat: i, problem: `directed text "${dir.typography}" not found on screen (rendered "${(m.text || []).join(" ") || "∅"}")` });
      }
    }
    // graph justification: a chart mechanism where the director said graph not justified
    if (p && dir.graph_justified === false && GRAPH_MECHANISMS.has(m.mechanism)) {
      issues.push({ owner: "DIRECTION_QUALITY", beat: i, problem: `mechanism ${m.mechanism} is a chart but graph_justified=false — lazy/graph fallback` });
    }
  }

  // MONOCULTURE — deterministic, from manifest mechanisms
  const mechs = mBeats.map((b) => b.mechanism).filter(Boolean);
  const total = mechs.length || 1;
  const textForward = mechs.filter((m) => TEXT_FORWARD.has(m)).length;
  const distinct = new Set(mechs).size;
  let maxRun = 0, run = 1;
  for (let i = 1; i < mechs.length; i++) { if (mechs[i] === mechs[i - 1]) { run++; maxRun = Math.max(maxRun, run); } else run = 1; }
  maxRun = Math.max(maxRun, mechs.length ? 1 : 0);
  const textForwardPct = Math.round((textForward / total) * 100);
  const monoculture = textForwardPct > 45 || distinct < 4 || maxRun > 3;
  if (monoculture) {
    issues.push({ owner: "DIRECTION_QUALITY", beat: null, problem: `monoculture: ${textForwardPct}% text-forward, ${distinct} distinct mechanisms, longest run ${maxRun}` });
  }

  return {
    ok: true,
    beatCountPlan: pBeats.length, beatCountRender: mBeats.length,
    textForwardPct, distinctMechanisms: distinct, longestMechanismRun: maxRun, monoculture,
    mechanismDistribution: mechs.reduce((o, m) => (o[m] = (o[m] || 0) + 1, o), {}),
    issues,
  };
}

/* ── NARRATIVE TYPOGRAPHY checks (mechanical only) ───────────────────── */

/**
 * Everything here is objectively measurable from the render manifest: line
 * count, word/char budget, whether the phrase would have had to wrap, how
 * often text appears, and whether the same phrase repeats. Whether a phrase
 * is GOOD narrative emphasis is a semantic judgment and is deliberately NOT
 * decided here — that stays with Gemini's post-render review.
 */
// Exported so scripts/test-scene-text-audit.mjs can drive it with the real
// manifest from a failing run instead of needing a video to re-render.
export function auditTypography(manifest, plan, srtCues) {
  if (!manifest) return { ok: false, note: "no render manifest" };
  const beats = manifest.beats || [];
  const pBeats = plan?.beats || [];
  const safeW = (manifest.width || 1080) * 0.78 * TYPO_SAFE_WIDTH_FRACTION; // safe width * budget
  const issues = [];
  const perBeat = [];
  let textBeats = 0, longestTextRun = 0, run = 0;
  const phraseCounts = new Map();

  beats.forEach((b, i) => {
    // ENGINE VOCABULARY — a hard structural failure, checked on every beat
    // whether or not it draws narrative text. These are strings like
    // "EXPECTED" / "REALITY" / "CONSUMED" that named the mechanism to the
    // viewer. render.js tags them role:"banned" in on_screen_text rather
    // than dropping them, precisely so this check can see them.
    for (const t of b.banned_text || []) {
      issues.push({ owner: "PLAN_COMPLIANCE", beat: i, problem: `"${t}" is internal mechanism vocabulary rendered as a section label — must never reach the screen` });
    }

    // FIGURE SLOTS MUST CONTAIN FIGURES.
    //
    // A mechanism with a magnitude slot (EVIDENCE_FIGURE's value,
    // VISIBLE_CONSUMPTION's amount, PHYSICAL_GROWTH's magnitude) expects
    // "$34 MILLION" or "70%" — a number with an optional unit. Run
    // 35264622891 put the sentence "Reshaping employer liability
    // everywhere" in PHYSICAL_GROWTH's magnitude slot; it could only be
    // drawn at ~13px, and a 13px accent glyph measured 3.92:1 no matter how
    // much contrast headroom the colour had.
    //
    // This is DIRECTION_QUALITY, not a render bug, and it is deliberately
    // NOT repaired in the renderer: condensing the phrase to fit would make
    // this direction permanently acceptable and the quality would never
    // improve. The render fails, Gemini gets told which slot and why.
    for (const t of b.on_screen_text || []) {
      if (t.role !== "value") continue;
      if (isFigureShaped(t.text)) continue;
      issues.push({ owner: "DIRECTION_QUALITY", beat: i, problem: `"${t.text}" was written into the ${mechLabel(b)} figure slot (${t.source}), but it is prose, not a measured figure — that slot needs a number with an optional unit ("$34 MILLION", "70%", "2 seconds")` });
    }

    // UNREADABLE LABELS.
    //
    // Any on-screen string that cannot be drawn at MIN_LABEL_PX in the
    // space its slot allows is too long for that slot. Reported, never
    // silently shrunk — a glyph small enough to fail the contrast gate is
    // not a colour problem.
    for (const t of b.on_screen_text || []) {
      if (t.role === "banned") continue;          // already reported above
      const fit = labelFit(t.text, safeW, 180, MIN_LABEL_PX);
      if (fit.readable) continue;
      issues.push({ owner: "DIRECTION_QUALITY", beat: i, problem: `"${t.text}" needs ${fit.required.toFixed(0)}px to fit its slot, below the ${MIN_LABEL_PX}px readable floor — too long to be drawn legibly, shorten the phrase` });
    }

    // The narrative-typography contract applies to role:"narrative" strings.
    // `text` (TypographyScene's centred phrase) stays the primary source;
    // `narrative_text` adds the labels object-first scenes draw, which the
    // manifest used to omit entirely — the blindness that let a two-headline
    // STATE_CHANGE beat report "0 violations" in run 35261545735.
    const narrativeStrings = (b.narrative_text && b.narrative_text.length)
      ? b.narrative_text
      : (b.text || []);

    // A beat drawing TWO OR MORE narrative strings is the stacked
    // headline+subhead structure narrative typography prohibits, no matter
    // which mechanism drew it.
    if (narrativeStrings.length > 1) {
      issues.push({ owner: "PLAN_COMPLIANCE", beat: i, problem: `beat draws ${narrativeStrings.length} narrative lines (${narrativeStrings.map((s) => `"${s}"`).join(", ")}) — one thought per beat, never a headline + supporting line` });
    }

    const raw = narrativeStrings.join(" ");
    const phrase = toSingleLine(raw);
    if (!phrase) { run = 0; perBeat.push({ index: i, hasText: false }); return; }
    textBeats++; run++; longestTextRun = Math.max(longestTextRun, run);

    const narration = srtCues?.[i]?.text || null;
    const wc = wordCount(phrase);
    const chars = phrase.length;
    // Would this phrase have needed more than one line? If the size required
    // to fit it on one line falls under the readable floor, the old renderer
    // would have stacked it — that is the mechanical multi-line signal.
    const onelineSize = safeW / Math.max(0.5, estimateEmWidth(phrase));
    const wouldWrap = onelineSize < TYPO_MIN_READABLE_PX;
    const multiLine = /[\r\n]/.test(raw) || narrativeStrings.length > 1;
    const headline = isHeadlineLike(phrase);
    const transcript = isTranscriptLike(phrase, narration);

    if (multiLine) issues.push({ owner: "PLAN_COMPLIANCE", beat: i, problem: `typography rendered as ${narrativeStrings.length} text blocks — must be ONE line` });
    if (wouldWrap) issues.push({ owner: "DIRECTION_QUALITY", beat: i, problem: `phrase needs ${onelineSize.toFixed(0)}px to fit one line (below the ${TYPO_MIN_READABLE_PX}px readable floor) — phrase is too long, rewrite shorter` });
    if (wc > TYPO_HARD_MAX_WORDS) issues.push({ owner: "DIRECTION_QUALITY", beat: i, problem: `${wc} words exceeds the ${TYPO_HARD_MAX_WORDS}-word cap — this is narration, not emphasis` });
    else if (wc > TYPO_TARGET_MAX_WORDS) issues.push({ owner: "DIRECTION_QUALITY", beat: i, problem: `${wc} words is above the ${TYPO_TARGET_MAX_WORDS}-word target` });
    if (chars > TYPO_MAX_CHARS) issues.push({ owner: "DIRECTION_QUALITY", beat: i, problem: `${chars} chars exceeds the ${TYPO_MAX_CHARS}-char single-line budget` });
    if (headline) issues.push({ owner: "DIRECTION_QUALITY", beat: i, problem: `"${phrase}" reads as a headline/topic label, not narrative emphasis` });
    if (transcript) issues.push({ owner: "DIRECTION_QUALITY", beat: i, problem: `"${phrase}" reads as a transcript/subtitle of the narration` });

    const key = phrase.toLowerCase();
    phraseCounts.set(key, (phraseCounts.get(key) || 0) + 1);
    perBeat.push({ index: i, hasText: true, phrase, words: wc, chars, wouldWrap, multiLine, headline, transcript });
  });

  const repeatedPhrases = [...phraseCounts.entries()].filter(([, n]) => n > 1).map(([p, n]) => ({ phrase: p, count: n }));
  for (const r of repeatedPhrases) {
    issues.push({ owner: "DIRECTION_QUALITY", beat: null, problem: `phrase "${r.phrase}" repeats ${r.count}x — typography monoculture` });
  }

  const textBeatShare = beats.length ? textBeats / beats.length : 0;
  if (textBeatShare > TYPO_MAX_BEAT_SHARE) {
    issues.push({ owner: "DIRECTION_QUALITY", beat: null, problem: `${Math.round(textBeatShare * 100)}% of beats carry on-screen text (max ${Math.round(TYPO_MAX_BEAT_SHARE * 100)}%) — typography must be selective, not the default treatment` });
  }
  if (longestTextRun >= 4) {
    issues.push({ owner: "DIRECTION_QUALITY", beat: null, problem: `${longestTextRun} consecutive text beats — TEXT->TEXT->TEXT reads as a slideshow, not visual storytelling` });
  }

  return {
    ok: true,
    textBeats, totalBeats: beats.length,
    textBeatShare: +textBeatShare.toFixed(2),
    longestTextRun,
    multiLineBeats: perBeat.filter((b) => b.multiLine).length,
    wouldWrapBeats: perBeat.filter((b) => b.wouldWrap).length,
    headlineLikeBeats: perBeat.filter((b) => b.headline).length,
    transcriptLikeBeats: perBeat.filter((b) => b.transcript).length,
    repeatedPhrases,
    perBeat,
    issues,
  };
}

/* ── AUDIO checks (ffmpeg) ───────────────────────────────────────────── */

// ffmpeg writes ebur128/silencedetect stats to STDERR, so capture it via
// spawnSync (execFileSync only returns stdout).
function ffmpegStderr(afilter) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-nostats", "-i", video_ref,
    "-af", afilter, "-f", "null", "-"], { encoding: "utf-8", maxBuffer: 32 * 1024 * 1024 });
  return (r.stderr || "") + (r.stdout || "");
}
let video_ref = null;
function auditAudio(video, hasAudio, durationSec = 0) {
  // No audio stream at all is the same defect as a silent one, and blocks too.
  if (!hasAudio) {
    return {
      ok: true, hasAudio: false, note: "no audio stream",
      effectivelySilent: true,
      blocker: "no audio stream at all — no audible narration",
    };
  }
  video_ref = video;
  const res = { ok: true, hasAudio: true };
  try {
    const out = ffmpegStderr("ebur128=peak=true");
    const I = out.match(/I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/g);
    const peak = out.match(/Peak:\s*(-?\d+(?:\.\d+)?)\s*dBFS/g);
    if (I?.length) res.integratedLufs = +I[I.length - 1].match(/(-?\d+(?:\.\d+)?)/)[0];
    if (peak?.length) res.truePeakDb = +peak[peak.length - 1].match(/(-?\d+(?:\.\d+)?)/)[0];
    res.clipping = res.truePeakDb != null && res.truePeakDb > -0.1;
  } catch (e) { res.loudnessError = String(e.message).slice(0, 120); }
  try {
    const out = ffmpegStderr("silencedetect=noise=-45dB:d=1.5");
    const sil = (out.match(/silence_duration:\s*(\d+(?:\.\d+)?)/g) || []).map((s) => +s.match(/(\d+(?:\.\d+)?)/)[0]);
    res.longSilenceCount = sil.filter((s) => s >= 1.5).length;
    res.maxSilenceSec = sil.length ? Math.max(...sil) : 0;
  } catch { /* silencedetect optional */ }

  // EFFECTIVELY SILENT — a blocking condition, not a risk score.
  //
  // Run 35266860427 rendered two videos whose audio track existed
  // (audio:true) but carried nothing: LUFS -70 with silence spanning the
  // whole duration (41.4s of 41.4s, 57.7s of 57.7s), because
  // DirectedShorts was never handed the voiceover. Silence only added 8
  // points to a risk score, so both videos reported qa=PASS and were
  // treated as shippable. A video nobody can hear is not shippable at any
  // risk level, so this is reported as a blocker for the QA gate.
  //
  // -50 LUFS is far below any real speech (-16 to -23 typical) and below
  // room tone, so it cannot fire on a quiet-but-real mix.
  const SILENT_LUFS = -50;
  res.effectivelySilent =
    (res.integratedLufs != null && res.integratedLufs <= SILENT_LUFS) ||
    (res.maxSilenceSec != null && durationSec > 0 &&
      res.maxSilenceSec >= durationSec * 0.98);
  if (res.effectivelySilent) {
    res.blocker = `video is effectively silent (LUFS=${res.integratedLufs ?? "?"}, ` +
      `${res.maxSilenceSec ?? "?"}s silence of ${durationSec}s) — no audible narration`;
  }
  return res;
}

/* ── CHANNEL fingerprint (rolling history) ───────────────────────────── */

const STATS_PATH = join(ROOT, "data", "audit", "channel-visual-stats.json");

function updateChannelFingerprint(channelId, planComp) {
  if (!channelId || !planComp?.ok) return { ok: false };
  let store = readJson(STATS_PATH) || {};
  const key = String(channelId);
  const hist = store[key] || { videos: [] };
  const entry = {
    date: new Date().toISOString().slice(0, 10),
    textForwardPct: planComp.textForwardPct,
    distinctMechanisms: planComp.distinctMechanisms,
    mechanismDistribution: planComp.mechanismDistribution,
  };
  const recent = hist.videos.slice(-9); // last 9 before this one
  const avgTextFwd = recent.length ? Math.round(recent.reduce((s, v) => s + (v.textForwardPct || 0), 0) / recent.length) : null;
  const outlier = avgTextFwd != null && Math.abs(planComp.textForwardPct - avgTextFwd) > 30;
  hist.videos = [...recent, entry].slice(-10);
  store[key] = hist;
  try { mkdirSync(dirname(STATS_PATH), { recursive: true }); writeFileSync(STATS_PATH, JSON.stringify(store, null, 2) + "\n"); } catch {}
  return { ok: true, recentAvgTextForwardPct: avgTextFwd, thisTextForwardPct: planComp.textForwardPct, outlier };
}

/* ── RISK aggregation ────────────────────────────────────────────────── */

function assessRisk(technical, visual, planComp, audio, channel, typo) {
  const reasons = [];
  let score = 0;
  // technical (these are also the frame-audit hard gate's domain; here they feed risk)
  if (technical.width && (technical.width < 720 || technical.height < 1280)) { score += 40; reasons.push(`resolution ${technical.width}x${technical.height} below 720x1280`); }
  if (visual.ok && visual.blackFrameCount > 0) { score += 25; reasons.push(`${visual.blackFrameCount} black frame(s)`); }
  // Coarse sampling (~24 frames): a single static gap spans several seconds,
  // so only a genuinely long frozen stretch counts.
  if (visual.ok && visual.maxStaticRunSec >= 6) { score += 20; reasons.push(`static/frozen ${visual.maxStaticRunSec}s`); }
  if (visual.ok && visual.lowMotion) { score += 12; reasons.push(`low motion (${visual.meanMotion})`); }
  if (visual.ok && visual.nearDuplicatePairs >= 6) { score += 10; reasons.push(`${visual.nearDuplicatePairs} near-duplicate frame pairs`); }
  // plan compliance
  if (planComp.ok) {
    const impl = planComp.issues.filter((x) => x.owner === "PLAN_COMPLIANCE").length;
    const dir = planComp.issues.filter((x) => x.owner === "DIRECTION_QUALITY").length;
    if (impl) { score += 15 * Math.min(2, impl); reasons.push(`${impl} plan-compliance issue(s)`); }
    if (planComp.monoculture) { score += 20; reasons.push(`monoculture (${planComp.textForwardPct}% text-forward)`); }
    else if (dir) { score += 8; reasons.push(`${dir} direction-quality flag(s)`); }
  }
  // audio
  if (audio.clipping) { score += 10; reasons.push("audio clipping"); }
  if (audio.maxSilenceSec >= 3) { score += 8; reasons.push(`${audio.maxSilenceSec}s silence`); }
  // channel outlier
  if (channel.outlier) { score += 10; reasons.push(`text-forward ${channel.thisTextForwardPct}% vs channel avg ${channel.recentAvgTextForwardPct}%`); }
  // narrative typography — structural violations are the heaviest because a
  // two-line/headline/subtitle frame is exactly the visual language we banned
  if (typo?.ok) {
    if (typo.multiLineBeats) { score += 30; reasons.push(`${typo.multiLineBeats} multi-line typography beat(s)`); }
    if (typo.headlineLikeBeats) { score += 18; reasons.push(`${typo.headlineLikeBeats} headline-like phrase(s)`); }
    if (typo.transcriptLikeBeats) { score += 18; reasons.push(`${typo.transcriptLikeBeats} transcript-like phrase(s)`); }
    if (typo.wouldWrapBeats) { score += 12; reasons.push(`${typo.wouldWrapBeats} phrase(s) too long for one readable line`); }
    if (typo.textBeatShare > TYPO_MAX_BEAT_SHARE) { score += 15; reasons.push(`${Math.round(typo.textBeatShare * 100)}% text beats (max ${Math.round(TYPO_MAX_BEAT_SHARE * 100)}%)`); }
    if (typo.longestTextRun >= 4) { score += 10; reasons.push(`${typo.longestTextRun} consecutive text beats`); }
    if (typo.repeatedPhrases?.length) { score += 8; reasons.push(`${typo.repeatedPhrases.length} repeated phrase(s)`); }
  }

  const level = score >= 30 ? "HIGH" : score >= 12 ? "MEDIUM" : "LOW";
  return { score, level, reasons };
}

// Which specific beats can code NOT confidently judge → send only these to Gemini.
function uncertainBeats(planComp, visual, typo) {
  const set = new Set();
  if (planComp?.ok) for (const iss of planComp.issues) if (iss.beat != null) set.add(iss.beat);
  // A typography beat the code flagged is exactly the kind Gemini must judge
  // semantically (is this emphasis or a headline?), so escalate just those.
  if (typo?.ok) for (const iss of typo.issues) if (iss.beat != null) set.add(iss.beat);
  return [...set].sort((a, b) => a - b);
}

/* ── main ────────────────────────────────────────────────────────────── */

async function main() {
  const videoArg = arg("video");
  if (!videoArg) { console.error("Usage: local-visual-auditor.js --video <mp4> [--plan p] [--manifest m] [--channel id] [--out r]"); process.exit(2); }
  const video = resolveIn(videoArg);
  if (!video) { console.error(`Video not found: ${videoArg}`); process.exit(2); }

  const plan = readJson(resolveIn(arg("plan")));
  let manifestPath = resolveIn(arg("manifest"));
  if (!manifestPath) { const g = video.replace(/\.mp4$/, "-manifest.json"); if (existsSync(g)) manifestPath = g; }
  const manifest = readJson(manifestPath);
  const channelId = arg("channel");

  const technical = probe(video);
  const frames = technical.error ? [] : await sampleFrames(video, technical.durationSec || 60, 24);
  const visual = auditVisual(frames);
  const planComp = auditPlanCompliance(plan, manifest);
  let srtCues = [];
  const srtFile = resolveIn(arg("srt"));
  if (srtFile) {
    try {
      srtCues = readFileSync(srtFile, "utf-8").replace(/\r\n/g, "\n").split(/\n\n+/).map((blk) => {
        const lines = blk.trim().split("\n");
        return lines.length >= 3 ? { text: lines.slice(2).join(" ") } : null;
      }).filter(Boolean);
    } catch { /* srt optional */ }
  }
  const typo = auditTypography(manifest, plan, srtCues);
  const audio = auditAudio(video, technical.hasAudio, technical.durationSec);
  const channel = updateChannelFingerprint(channelId, planComp);
  const risk = assessRisk(technical, visual, planComp, audio, channel, typo);
  const uncertain = uncertainBeats(planComp, visual, typo);
  const geminiRequired = risk.level !== "LOW" || uncertain.length > 0;

  const report = {
    generatedAt: new Date().toISOString(),
    video: basename(video),
    channel: channelId || null,
    technical, visual, plan_compliance: planComp, typography: typo, audio, channel_history: channel,
    risk, gemini_required: geminiRequired, uncertain_beats: uncertain,
    // Objective, catastrophic conditions that must block the ship regardless
    // of risk score. render-and-qa.js reads this alongside the frame-audit
    // exit code, so the auditor stays advisory for everything EXCEPT defects
    // that make a video unpublishable on their face.
    blockers: [audio.blocker].filter(Boolean),
  };

  const outPath = arg("out") || video.replace(/\.mp4$/, "-local-audit.json");
  try { mkdirSync(dirname(outPath), { recursive: true }); writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n"); } catch {}

  console.log("\n═══ LOCAL VISUAL AUDITOR ═══");
  console.log(`  Video: ${report.video}  ${technical.width}x${technical.height} @ ${technical.fps}fps  ${technical.durationSec}s  audio:${technical.hasAudio}`);
  if (visual.ok) console.log(`  Visual: meanLuma=${visual.meanLuma} motion=${visual.meanMotion} black=${visual.blackFrameCount} staticRun=${visual.maxStaticRunSec}s changes=${visual.sceneChanges} dupPairs=${visual.nearDuplicatePairs}`);
  if (planComp.ok) console.log(`  Plan: beats ${planComp.beatCountRender}/${planComp.beatCountPlan} textFwd=${planComp.textForwardPct}% distinct=${planComp.distinctMechanisms} run=${planComp.longestMechanismRun} mono=${planComp.monoculture} issues=${planComp.issues.length}`);
  if (typo.ok) console.log(`  Typography: ${typo.textBeats}/${typo.totalBeats} text beats (${Math.round(typo.textBeatShare * 100)}%) run=${typo.longestTextRun} multiline=${typo.multiLineBeats} headline=${typo.headlineLikeBeats} transcript=${typo.transcriptLikeBeats} tooLong=${typo.wouldWrapBeats} repeated=${typo.repeatedPhrases.length} issues=${typo.issues.length}`);
  if (audio.hasAudio) console.log(`  Audio: LUFS=${audio.integratedLufs ?? "?"} peak=${audio.truePeakDb ?? "?"}dB clip=${!!audio.clipping} silence=${audio.maxSilenceSec ?? 0}s`);
  for (const b of report.blockers) console.log(`  BLOCKER: ${b}`);
  if (channel.ok) console.log(`  Channel: textFwd ${channel.thisTextForwardPct}% (avg ${channel.recentAvgTextForwardPct ?? "n/a"}%) outlier=${!!channel.outlier}`);
  console.log(`  RISK: ${risk.level} (${risk.score})  ${risk.reasons.join("; ") || "clean"}`);
  console.log(`  → gemini_required: ${geminiRequired}${uncertain.length ? `  uncertain beats: [${uncertain.join(", ")}]` : ""}`);
  console.log(`  Report: ${outPath}`);
  process.exit(0);
}

// Only run the CLI when invoked directly. Without this guard, importing
// auditTypography() for a test immediately executed main() and exited on
// the missing --video argument, so the audit rules could not be tested
// without first producing a real MP4.
const invokedDirectly = process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) {
  main().catch((e) => { console.error("local-visual-auditor error (non-fatal):", e.message); process.exit(0); });
}
