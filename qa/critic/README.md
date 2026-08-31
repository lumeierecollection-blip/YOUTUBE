# mograph-critic pass — evidence

Frames and numbers behind the "stop looking machine-made" change on
`claude/render-preview-video-az9hd3`. Fixture: `tech-process.fixture.json`
on channel `ch-48` (motion-graphics), timing from a synthetic
`*-vo.fixture.srt` because EdgeTTS needs a WebSocket the sandbox proxy
does not pass.

Only the JSON reports are tracked. The PNG frame dumps (~170MB) are
regenerable and gitignored:

    node qa-scripts/inspect-anchors.mjs <script> <srt> ch-48 <out> --all-states
    node qa-scripts/motion-metrics.mjs  <script> <srt> ch-48 <out> --to=420

## What the frames showed

The starting render's problem was not its animation curves. It was that
**no scene drew any of the words it was about**:

| scene | before | after |
|---|---|---|
| INTERFACE_SIMULATION | grey bars of pseudo-random width standing in for text | the line's real words; empty rows where the script says nothing |
| PROCESS | three anonymous boxes labelled "1" "2" "3" at 26px | named travelling subject, claim landing at the end of the run, numerals at 38px |
| TIMELINE | two dated flags, no event | the event, set against its own year |

Directories: `before/` is the original render, `after/` the first pass
(words into scenes), `mg5/` the current state after the scenes were made
to use the frame their shot grants them. Intermediate runs between `after`
and `mg5` were deleted; each was superseded by the next.

## Ink: scenes were not taking the frame they were granted

`composition.js` calls `coverage` "the direct answer to the 0.2%-ink
measurement", and FRAMINGS grants each strategy 0.74-1.0 of the frame. The
scenes were discounting it, some of them ignoring `shotFrame` outright:

| scene | granted | drew |
|---|---|---|
| INTERFACE (CLOSE) | 929x760 | hardcoded 760x560 |
| PROCESS (COLUMNAR) | 972 wide | 518 |
| TIMELINE (HORIZON) | 1037 wide | 498 |

    mean ink        before/  4.50%  ->  mg5/  8.86%
    under 5% ink    before/  20/26  ->  mg5/   5/26

The five remaining are early build states — a window still assembling, an
axis before its markers — not finished compositions.

A WARNING FROM THIS PASS: widening the PROCESS board raised measured ink
while the rendered frame showed a *larger empty container* holding the
same three 108px chips. The number moved and the picture did not. Node
size was a flat constant regardless of what the shot granted. Ink is a
useful proxy for "is anything there", not for "is it composed" — the PNGs
remain the acceptance test.

## Numbers

`motion-metrics.mjs` over frames 0-420:

    velocity_linearity   worst 0.656, ZERO hard defects (>= 0.80)
    holds                0 dead holds > 0.5s
    ink                  mean 4.1%, 195/205 frames under 5%
    subject drift        max 0.206 dx / 0.199 dy from centre

The first line is the important one and it points AWAY from the obvious
diagnosis: the motion was never linear. The default easing is already
`bezier(0.16, 1, 0.3, 1)`, the same ease-out the shot cards prescribe. What
reads as machine-made here is the third line — a hairline diagram in an
otherwise empty frame — plus text that was not there at all.

## Two things caught by measuring rather than reasoning

**Renders were not reproducible.** `PostFxReadyGate` drove R3F's clock from
`performance.now()`, so post-fx phase depended on how long a render took.
Rendering the SAME commit twice moved TIMELINE anchor ink by up to 2.4
points and bbox height by 28 points — larger than most real changes move
them. It briefly looked like a regression in this very comparison. Fixed by
driving the clock from the frame number.

**Labels were landing under YouTube's UI.** `DesignSpace` shifts the stage
down by `CAPTION_RESERVE_Y` (110px) whenever captions are off, which is the
default. The PROCESS claim, placed just below the board, delivered at ~91%
of frame height.

## Known limits

- `motion-metrics`' margin number counts ALL ink, and several scenes bleed
  off frame deliberately. Use it to find frames worth opening, not as a
  defect count.
- The PROCESS board still sits left of centre (cx ~0.43) with the right
  ~40% of the frame empty, and for a long claim the safe-rect clamp
  overrides the column alignment the scene asks for.
- `run-visual-tests.js` has one PRE-EXISTING failure unrelated to this
  work: `composition.js` exports `gateMotionBlur`, which nothing imports.
  It implements MOT-18 and looks like a gate that was written and never
  wired up — worth wiring, not deleting.
