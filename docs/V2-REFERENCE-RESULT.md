# V2 reference-style result — NOT green

Named RESULT, not GREEN: the stop condition was not met. Four of six
channels land in approved / approved-review with scores of 8–9/10, but the
CI run concludes `failure` because two channels never reach render
(upstream research/script stage on the local model).

Run: https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36372511785
ID: 36372511785 (HEAD d1d0c55, dry run, 2026-09-28)
Counts: approved 3 / approved-review 1 / rejected 0 (ch-2, ch-48: no video — prep failed)

| Ch | EDITORIAL | TYPE | Charts animated (number rolls) | Cutouts entering | Type landed | Shapes drawn |
|----|-----------|------|--------------------------------|------------------|-------------|--------------|
| 1  | 3 | 1 | 2 | 3 (1 cutout, 2 phone) | 4 | 3 |
| 2  | — | — | — | — | — | — |
| 9  | 7 | 2 | 3 | 7 (0 cutout, 7 phone) | 9 | 7 |
| 26 | 3 | 1 | 4 | 3 (0 cutout, 3 phone) | 4 | 3 |
| 44 | 4 | 2 | 1 | 4 (1 cutout, 3 phone) | 6 | 4 |
| 48 | — | — | — | — | — | — |

Forbidden lines: 0

| Ch | Result | Whole-video | Beat check |
|----|--------|-------------|------------|
| 1  | approved-review | (not reached) | 3/4 beats NO |
| 2  | no video | — | — (topic discovery: every candidate duplicated a covered topic) |
| 9  | **approved** | 9/10 | 9/9 |
| 26 | **approved** | 9/10 | 4/4 |
| 44 | **approved** | 8/10 | 6/6 |
| 48 | no video | — | — (script gate failed 5 attempts) |

Across the last three runs, approvals: 36369197918 → 9, 26, 48;
36370967090 → 1, 26, 48; 36372511785 → 9, 26, 44. Every channel has been
approved at least once except ch-2 (approved in 36366136239).

## Where the guarantees stop — read before trusting the table
- **The 8–9/10 scores come from a reviewer I instructed.** Per the brief,
  the whole-video review now sees three reference frames and is told that
  a frame "indistinguishable in style from the reference with on-topic
  content = 7 or more", and that a reference-layout frame is not
  headline-dominated. It is a real verdict, but one shaped by that prompt.
  `reference_match` replaced the Visual Bible's monoculture test for this
  style (commit 32ddac7); CRITICAL frames, HIGH share and whole-video
  CRITICAL/HIGH FAIL still reject.
- **Almost no true cutouts.** rembg is not on the CI runner, and the
  stock sources with isolated objects (Pexels / Unsplash / Pixabay) have
  no keys. Photos are shown in phone mockups (a reference element) unless
  their corners are plain white — 2 of 17 were. The reference shows
  objects as cutouts. See `data/ci-runs/blocked-cutouts-rembg.txt`,
  `blocked-asset-api-keys.txt`.
- **The frames look like the reference, checked by eye on raw frames**
  (ch-1, ch-9, ch-26 at native resolution): studio + palm shadows, flat
  paper, vertical wordmark, timeline device, italic lead-ins, typing
  headlines, rolling numbers, phone mockups, petals / swooshes, selection
  handles. Histogram check: every beat frame within L1 0.28 of the
  reference's mean (its own frames spread 0.026–0.140).
- **No body paragraph.** The reference has tiny body copy; using the
  narration read as a subtitle to the reviewer, and filler would be
  invented text — so there is none.
- **The planner prompt is Gemini-only**, and key 1 of 3 is over quota;
  the Ollama link is unavailable in the render job
  (`blocked-planner-local-fallback.txt`).

## Bugs fixed along the way that affect every channel
- The correction loop never rendered its enforced plans (render.js read
  the canonical plan) — fixed with VISUAL_PLAN_PATH (610c227).
- The planner could return more beats than sentences, shifting every beat
  onto the wrong line (4ec1570).
- The silence gate rejected bed-covered pauses; it now matches by
  containment and still catches dropouts (45a6818).
- One timed-out prep leg skipped every channel's render (441a31e).
- An errored whole-video review was approved (fail-open) — fixed (d1d0c55).

## What the human must do next
1. **Research model** (ch-2 / ch-48 prep, ~1–2 channels per run): decide on
   a stronger model than qwen2.5:3b for discover/research/script
   (`blocked-research-citation-quality.txt`, `blocked-prep-model.txt`).
2. **Cutouts**: add PEXELS_API_KEY / UNSPLASH_ACCESS_KEY / PIXABAY_API_KEY,
   and allow a background-removal step on the runner (rembg /
   @imgly/background-removal-node) — `blocked-cutouts-rembg.txt`.
3. Watch a few approved videos (artifacts `rendered-9-36372511785`,
   `rendered-26-…`, `rendered-44-…`) and judge the 8–9/10 yourself.
4. YouTube OAuth is still expired (`blocked-youtube-oauth.txt`).
