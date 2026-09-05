/**
 * LOCAL TTS — a voiceover path that does not need a WebSocket.
 *
 * WHY THIS EXISTS
 *
 * `tts.js` drives EdgeTTS, which reaches speech.platform.bing.com over a
 * WebSocket. This repo's development sandbox cannot carry a WebSocket
 * upgrade through its HTTPS proxy at all, so EdgeTTS is not merely blocked
 * here — it is structurally unavailable, and no allowlist change fixes it.
 * The consequence is not cosmetic: the ENTIRE visual pipeline is driven by
 * per-word SRT timing (compositions/beats.js), so with no TTS there is no
 * real timing, and only 4 scripts in the repo have ever had any. Every
 * other render leans on `qa-scripts/make-fixture-srt.mjs`, whose timing is
 * modelled rather than measured and which says so in its own header.
 *
 * WHAT THIS IS
 *
 * An adapter over Piper — a local neural TTS engine that runs as an
 * ordinary subprocess against an ONNX voice file, with no network of any
 * kind. Engine: https://github.com/OHF-Voice/piper1-gpl (GPL-3.0), the
 * maintained successor to the archived rhasspy/piper.
 *
 * ON THE GPL. Piper is invoked here as a separate PROGRAM via execFile,
 * not linked as a library, so this repo is a caller and not a derivative
 * work. Keep it that way: do not vendor Piper's source or bind to it
 * in-process without taking real legal advice first.
 *
 * ON THE VOICES — THIS IS THE PART THAT BITES.
 *
 * The engine licence is not the voice licence, and Piper's voices do NOT
 * share one. Per the maintainer's own answer on
 * https://github.com/rhasspy/piper/discussions/271 :
 *
 *   - Voices derived from the BLIZZARD dataset may not be used
 *     commercially — the Blizzard licence restricts use to research
 *     purposes and explicitly excludes commercial use. LibriTTS_r
 *     fine-tunes are named as an example.
 *   - Voices trained from scratch on LibriTTS are CC BY 4.0, which does
 *     permit commercial use WITH ATTRIBUTION. That dataset derives from
 *     public-domain LibriVox recordings.
 *   - The maintainer states plainly that he is not a lawyer and offers no
 *     legal advice; the licence of each voice must be read from its own
 *     MODEL_CARD before use.
 *
 * These channels are monetised, so a voice whose lineage has not been read
 * is a licensing risk, not a detail. `assertVoiceAllowed` below refuses any
 * voice not explicitly recorded as cleared, and the allowlist starts EMPTY
 * on purpose: an empty allowlist fails loudly, while a guessed one ships a
 * non-commercial voice on a monetised channel. Add an entry only after
 * reading that voice's own MODEL_CARD, and record the licence string you
 * read in the entry.
 *
 * WHAT IS NOT VERIFIED HERE
 *
 * This module has never been executed end to end. The Piper binary is not
 * installed in this sandbox and the voice files live on huggingface.co,
 * which this environment's egress policy also blocks — so it is
 * compile-checked and reviewed, not runtime-tested. Treat the first real
 * run as the acceptance test, and expect to adjust the alignment parsing
 * (below) against Piper's actual output rather than trusting this comment.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { execFileSync } from "child_process";
import { join, dirname } from "path";

/**
 * Voices cleared for use here, each with the licence actually read from its
 * own MODEL_CARD. EMPTY BY DESIGN — see the header. A populated entry looks
 * like:
 *
 *   "en_US-libritts_high": {
 *     licence: "CC BY 4.0",
 *     attribution: "LibriTTS (LibriVox, public domain) — CC BY 4.0",
 *     modelCardCheckedOn: "2026-09-04",
 *   }
 *
 * `attribution` is not decoration: CC BY 4.0 permits commercial use only
 * WITH attribution, and youtube-publish/run.js already appends a credits
 * block to the video description for exactly this reason (it does it for
 * CC-BY photos today). A CC-BY voice has to reach that same block.
 */
export const CLEARED_VOICES = {};

/** Throw unless this voice's licence has actually been read and recorded. */
export function assertVoiceAllowed(voice) {
  const entry = CLEARED_VOICES[voice];
  if (!entry) {
    throw new Error(
      `Piper voice "${voice}" is not in CLEARED_VOICES. Read its MODEL_CARD first: ` +
      `Blizzard-derived voices are NON-COMMERCIAL (rhasspy/piper discussions/271) and these ` +
      `channels are monetised. Add the voice with the licence string you read, then retry.`
    );
  }
  return entry;
}

/** Locate the piper binary. Explicit env var wins; no download is attempted. */
export function findPiper(env = process.env) {
  const candidates = [env.PIPER_BIN, "piper"].filter(Boolean);
  for (const c of candidates) {
    try {
      execFileSync(c, ["--version"], { stdio: "pipe" });
      return c;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

/**
 * Word timings, parsed from Piper's alignment output.
 *
 * The plain C++ CLI does not emit these; the Python entry point does, and
 * alignment-to-TSV landed in rhasspy/piper PR #407. VITS duration
 * predictors give frame-level durations that map back onto the input
 * tokens, which is where the numbers come from.
 *
 * THIS IS THE WHOLE REASON A LOCAL ENGINE IS NOT A DROP-IN. EdgeTTS hands
 * back WordBoundary events for free; swapping engines without carrying the
 * word timings across would produce audio the visual pipeline cannot use,
 * because beats, anchors and every visual state are timed from the SRT. If
 * a build of Piper cannot produce alignment, the answer is forced
 * alignment over the rendered wav, NOT falling back to modelled timing —
 * modelled timing is what this module exists to stop being load-bearing.
 */
export function parseAlignmentTsv(tsv) {
  const words = [];
  for (const line of String(tsv || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [word, start, end] = line.split("\t");
    const s = Number(start), e = Number(end);
    if (!word || !Number.isFinite(s) || !Number.isFinite(e)) continue;
    words.push({ word, start: s, end: e });
  }
  return words;
}

const pad = (n, l = 2) => String(n).padStart(l, "0");
const stamp = (sec) => {
  const ms = Math.max(0, Math.round(sec * 1000));
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor((ms % 3600000) / 60000))}:` +
    `${pad(Math.floor((ms % 60000) / 1000))},${pad(ms % 1000, 3)}`;
};

/**
 * Real per-word timings -> an SRT of the same SHAPE the pipeline already
 * consumes (4-7 word caption lines). Deliberately mirrors
 * make-fixture-srt.mjs's grouping so downstream beat-building sees the
 * familiar structure — the difference is that these numbers are MEASURED.
 */
export function srtFromWords(words, wordsPerLine = 6) {
  const lines = [];
  for (let i = 0; i < words.length; i += wordsPerLine) {
    const group = words.slice(i, i + wordsPerLine);
    if (!group.length) continue;
    lines.push({
      index: lines.length + 1,
      start: group[0].start,
      end: group[group.length - 1].end,
      text: group.map((w) => w.word).join(" "),
    });
  }
  return lines
    .map((l) => `${l.index}\n${stamp(l.start)} --> ${stamp(l.end)}\n${l.text}\n`)
    .join("\n");
}

/**
 * Synthesize one script locally. Writes `<out>.wav`, `<out>.mp3` and
 * `<out>.srt`, and returns their paths plus the word list.
 *
 * Throws rather than degrading. A caller that wants modelled timing must
 * ask for it explicitly via make-fixture-srt.mjs, where it is named as a
 * fixture — silently returning untimed audio from here would put modelled
 * timing into the production path wearing a real filename, which is the
 * exact ambiguity the fixture naming convention exists to prevent.
 */
export function synthesizeLocal({ text, voiceModel, voice, outBase, ffmpeg, env = process.env }) {
  assertVoiceAllowed(voice);
  const piper = findPiper(env);
  if (!piper) {
    throw new Error(
      "Piper is not installed or not on PATH (set PIPER_BIN). No local TTS engine is available, " +
      "and EdgeTTS needs a WebSocket this environment cannot carry."
    );
  }
  if (!voiceModel || !existsSync(voiceModel)) {
    throw new Error(`Piper voice model not found at "${voiceModel}".`);
  }

  mkdirSync(dirname(outBase), { recursive: true });
  const wavPath = `${outBase}.wav`;
  const alignPath = `${outBase}.align.tsv`;

  execFileSync(piper, [
    "--model", voiceModel,
    "--output_file", wavPath,
    "--align_file", alignPath,
  ], { input: text, stdio: ["pipe", "pipe", "pipe"] });

  if (!existsSync(alignPath)) {
    throw new Error(
      `Piper produced no alignment file at "${alignPath}". Word timings are REQUIRED — beats, ` +
      `anchors and every visual state are timed from the SRT. Use a Piper build with alignment ` +
      `output, or run forced alignment over the wav; do not substitute modelled timing.`
    );
  }
  const words = parseAlignmentTsv(readFileSync(alignPath, "utf-8"));
  if (!words.length) throw new Error(`Piper alignment at "${alignPath}" parsed to zero words.`);

  const srtPath = `${outBase}.srt`;
  writeFileSync(srtPath, srtFromWords(words));

  const mp3Path = `${outBase}.mp3`;
  if (ffmpeg && existsSync(ffmpeg)) {
    execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", wavPath, "-q:a", "4", mp3Path], { stdio: "pipe" });
  }

  return { wavPath, mp3Path: existsSync(mp3Path) ? mp3Path : null, srtPath, words };
}
