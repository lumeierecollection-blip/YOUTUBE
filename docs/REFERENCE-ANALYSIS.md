# Reference-video analysis

Turns one reference video into measured facts, timestamped contact sheets, and (with a vision model) a
creative-direction doc whose every observation cites the frames the model was shown.

```
node scripts/reference/analyze-reference.mjs <video> [--out dir] [--mode standard|dense] [--dense 12.5-18]
                                              [--no-vision] [--scene-threshold 0.3] [--force]
```

Output dir defaults to `data/reference/analysis/<basename>/`. Frames live in `<out>/frames/` (a lot of small JPEGs;
whether to gitignore them is the repo owner's call, `.gitignore` is not touched here).

## Stages and outputs

| Stage | Module | Output |
|---|---|---|
| metadata | `probe.mjs` | `metadata.json` (duration, fps, size, aspect, codec, audio) |
| scenes | `scenes.mjs` | `scenes.json`: cuts (ffmpeg scene score, default 0.3) + cadence from `scripts/lib/novelty.mjs` |
| samples | `sample.mjs` | `samples.json`, `frames/f001.jpg ...` (<=512 px wide; duplicates dropped and listed) |
| contact | `contact-sheet.mjs` | `contact-01.jpg ...`, `contact-sheets.json`; tile label = frame id + mm:ss.ss |
| audio | `audio.mjs` | `audio.json`: LUFS, silences, candidate sound cues (RMS jumps), transcript only if faster_whisper is importable |
| direction | `direct.mjs` | `direction.json` (schema `schemas/creative-direction.json`), `direction.md` |

Plus `run-log.json` (timings, frames sent, model/provider, errors). Re-running skips stages whose outputs exist and whose
inputs (video size/mtime, parameters) are unchanged; `--force` reruns all.

## Modes

- `standard`: each cut at -0.15 s and +0.15 s, plus one frame every 2 s. Cap 60.
- `dense`: standard plus 4 fps inside windows around strong novelty events and any `--dense a-b` range. Cap 200.
  Giving `--dense` selects dense mode. A video is never exported frame by frame.

## Evidence rule

Numbers (cuts, cadence, loudness, cue times) are measured; the model never supplies them. Every qualitative
observation needs `evidence` (frame ids) and `confidence`. Anything citing a frame id that was not sent, a sound cue
that is not at a measured cue, or a transition at no measured cut is moved to `rejected_observations`. With no model
answer (no key, `--no-vision`, call failure, schema failure) `direction.status` is `measured-only`, `why` says so,
and the qualitative arrays are empty. Colour is recorded as observation only; colour lives in `config/channels.json`.

## Limits

Cadence "events" are edge novelty: shimmer or live-action footage reads as novelty. Candidate sound cues are level
jumps, not identified sounds. Dedup (16x16 gray mean-abs-diff < 1.5) can merge two frames that differ only by a small
new word. Local runs have no API keys, so vision happens in CI.

## Where the analyses are used (wired 2026-10-22)

Committed analyses live in `data/reference/analysis/<video stem>/` (json + `contact-NN.jpg`; `frames/` and `run-log.json`
are not committed). `scripts/reference/channel-direction.mjs` maps a channel to its reference(s) with the same lookup the
planner's stills use (`reference-frames.js referenceSourceFor`: the style spec's `reference_video`, else the shared
`research/motion-graphics-ref/ref-01..03`).

- **Planner** (`gemini-visual-plan.js`): a `REFERENCE DIRECTION` section in the dynamic prompt part, every provider
  (Gemini, Groq, Ollama). Per reference: the measured pacing line (duration, cut times, cuts/changes per 10 s, p90 gap,
  longest hold with its timestamps); then, only for a `complete` vision analysis, one medium/high observation each for
  typography, composition, transitions and pacing, cited `f012@13.4s`. Colour never. Hard cap
  `DIRECTION_SUMMARY_MAX_CHARS` (720); `test-plan-gates.mjs` checks the prompt with a capped section stays under 4,500
  tokens. No analysis -> `[planner] reference_direction_missing — <why>` and nothing is added.
- **Whole-video critic** (`gemini-frame-review.js reviewWholeVideo`): up to 2 contact sheets of the channel's analysed
  reference, else the planner's reference stills, else `[review] reference_images_missing — <why>`. Context only; the
  verdict still does not read `reference_match`.

State on commit: all 7 committed analyses (ref-01..03, and the ch-05/06/08/10 reference videos) are **measured-only**
(`--no-vision`, run locally with no API key). So today the planner gets measured pacing only — no typography,
composition or transition observations exist yet. A vision run (`reference-analysis.yml`, needs the Gemini secrets)
followed by committing its `direction.json`/`samples.json` is what would add them; nothing here fills that gap.

## CI

`.github/workflows/reference-analysis.yml` (manual dispatch: video path, mode, dense ranges) runs the analyzer with
the `GEMINI_API_KEY*` secrets and uploads the output dir as an artifact.

Method (scene-change + uniform sampling, thumbnail dedup, frame cap, 512 px frames) adapted from bradautomates/claude-video (MIT), reimplemented in Node.
