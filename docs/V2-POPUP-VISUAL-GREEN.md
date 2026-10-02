# V2 — pop-up transitions, visual-first, cutouts right or absent (2026-10-02)

Branch `claude/visual-rebuild-from-5f91e75`. The owner's spec asked for three
checks to pass on at least 4 channels:

1. Every transition pops in place (no wipe, slide, mask or crossfade), and no
   frame is empty across a beat boundary.
2. At least 60% of the content beats (the hook and the CTA excluded) are visual.
3. Every PNG cutout is the right object, or there is no cutout at all.

**Status: checks 1 and 3 hold on 4+ channels. Check 2 does not:** no single
run has reached 60% visual on more than 3 channels. The threshold is
unchanged. The reasons and the trade-off are under *Check 2* below.

## Check 1 — pop-up transitions: PASS

`a82f235` replaced every transition (`transitionInto`, iris, push / flip /
match) with one pop compositor (`full-canvas.jsx` `PopGroups`). Each element
group of a beat — the photo, the top band, the middle band — is drawn
settled, clipped to its zone, and pops in place:

- **In:** scale 0.94 → 1.04 → 1.00 over 6 frames, opacity f/5.
- **Out:** 1 → 0.94, opacity 1 − f/6.5.

Groups are staggered 8 frames apart, major group first, and the camera is
static. `3bff353` put the main element first and fixed the one failure below.

`local-audit.cjs` `pop-transitions` gates it: no empty frame in a 10-frame
window around each boundary.

| Run | ch-1 | ch-2 | ch-26 | ch-44 | ch-48 |
|---|---|---|---|---|---|
| [36985423031](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36985423031) (`789328f`) | PASS | PASS | — | **FAIL**: beats 3 and 5 empty at boundary frames 6–9 | PASS |
| [36988420698](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36988420698) (`3bff353`) | PASS (approved) | PASS | PASS | PASS | PASS |
| [36995441688](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36995441688) (`f4c0fd5`) | PASS | — | — | PASS | PASS (approved) |

Five channels pass in 36988420698. ch-2's boundary window was also checked
frame by frame on the rendered video.

## Check 2 — visual-first: NOT MET on 4 channels

The planner re-asks once when fewer than 60% of the content beats are
visual (`gemini-visual-plan.js`, `[plan] beat ratio`). The resolver then
turns grounded TYPE beats into visuals and logs the final ratio
(`[visual-first] … final`). A TYPE beat that carries a verified cutout
counts as visual.

| Run | ch-1 | ch-2 | ch-9 | ch-26 | ch-44 | ch-48 |
|---|---|---|---|---|---|---|
| 36988420698 | 33% | **100%** | — | 50% | **75%** | 50% |
| 36995441688 | **67%** | prep failed | 50% | prep failed | **67%** | 50% |
| [36999095271](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36999095271) | 43% | planner failed | **100%** (1 content beat) | prep failed | prep failed | 25% |

Why it falls short:

- **The plan meets 60% and the resolver takes it back.** A planned PHOTO,
  DOCUMENT or MONEY beat with no verified real image becomes TYPE, by the hard
  rule. For example, ch-1's "Brad Klontz" had no Wikipedia page, so the beat
  was downgraded. The same happens when every cutout candidate is rejected,
  as ch-1's "bank statement" was: the verifier saw an "Insolvenz" sign and
  answered DIFFERENT. Right-or-absent beats the ratio, as the spec says.
- **Correction attempts re-plan.** ch-9 in 36995441688 was 75% on attempt 1
  and 50% on attempt 2.
- **Two channels a run fail before the render.** Discovery hits duplicate
  topics on ch-2, ch-26 and ch-44. `51eae60` now removes covered stories from
  the search results before the model reads them.

## Check 3 — cutouts right or absent: PASS

`6d601a0` and `789328f` set the rules:

- **Candidates:** 5 per concept, and every word of the concept must be in the
  image's tags.
- **Verifier:** answers LITERAL / FIGURATIVE / DIFFERENT, plus whether the
  object is recognizable. Only LITERAL and recognizable maps to MATCH. "Unsure"
  is not a MATCH, and no answer counts as no cutout.
- **Order:** the PNG bank first, then a live fetch. The library fallback
  and the library itself were deleted later, in `4374b1e` / `f00ed31`; see
  `docs/V2-CUTOUTS-CLEAN.md`.

Live cutouts that reached a frame, each checked on that frame:

- ch-1 worker, ch-2 gavel, ch-26 scientist (run 36979111190)
- ch-44 worker and courthouse, ch-1 person silhouette (36995441688)
- ch-1 globe, ch-48 door key (36999095271)

No wrong object has reached a rendered frame since. Rejections are logged
per candidate. For example:

- ch-1 "bank statement": DIFFERENT, an "Insolvenz" sign.
- Isolation failures: "more than one object / a scene", and "cut by the frame".

## Not done / blocked

- Check 2 on 4 channels: see above. Lowering the bar or skipping the verifier
  would meet it. Neither is allowed.
- Uploads: ch-9 and ch-26 return `invalid_client`, and ch-44's token is stale.
  See `data/ci-runs/blocked-youtube-oauth.txt`.
- The AI frame reviewer still sends typography-heavy videos to
  approved-review as TEMPLATE_MONOCULTURE. That queue is working as designed;
  nothing is deleted.
