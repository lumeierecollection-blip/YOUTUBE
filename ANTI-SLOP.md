# ANTI-SLOP — the acceptance bar

**PART 9 of the motion-graphics rebuild.** `scripts/slop-check.js` gates a
rendered video against this list. Every row states *how* it's measured —
per `CHECK-REGISTER.md` §1's rule, a check that can't say how it's proven
doesn't belong here as a check, it belongs in this doc as a wish.

Wired into `scripts/render-and-qa.js` (PART 8) right after `frame-audit.js`,
**warn-only**: a slop-check failure is logged and reported, it does not fail
the render job. A brand-new gate that can fail all 17 channels on day one
over a false positive is worse than the slop it's trying to catch — promote
individual rows to blocking once they've run clean against real output for
a while (see `CHECK-REGISTER.md` §1.1 E3: "a check that has never failed on
a real input is untested").

## Why this isn't a vision-model review

The rebuild spec asked for "delegate review to a subagent with no
conversation history — cold review, as if a stranger made it." That's the
right instinct — a reviewer who knows the rationale rationalizes — but the
pipeline's actual model provider is Cerebras, called through OpenCode
(`scripts/opencode-agent.js`, per `CLAUDE.md`), and the model configured
there (`gemma-4-31b`, `daily-pipeline.yml`'s `OPENCODE_MODELS`) is a text
model with no documented image-input support on Cerebras's hosted API.
Wiring a vision call into the daily pipeline on a model that can't actually
see the frame would be worse than not checking at all — it would produce a
confident-sounding verdict from a model reading nothing.

So this gate does the review two ways instead:

1. **Measured checks** — pixel analysis (extending `frame-audit.js`'s own
   raw-buffer style) and structural checks against the `mg` package the
   composition was actually built from (beat archetypes, headline/caption
   text, icon names — reusing `mg-package.js`'s and `beats.js`'s existing
   gate functions rather than re-implementing them). These are real,
   deterministic, and run today.
2. **Cold model pass** (`--with-model-review`, off by default) — a fresh
   `opencode-agent.js` call, zero conversation history by construction
   (every invocation is a new process), given the Part 1's MEASURED
   evidence as text (not pixels) and asked for an independent verdict on
   the residual judgement calls a pixel check can't make. This is real and
   wired, but it inherits `opencode-agent.js`'s existing Cerebras
   dependency — it was not exercised against a live Cerebras call while
   building this (no `CEREBRAS_API_KEY` in this session), so treat it as
   unverified until it's run once for real.

## The bar

| # | Check | How it's measured | Where |
|---|---|---|---|
| 1 | Background is flat pure white or pure black — no gradient, glow, or wash | `frame-audit.js`'s margin-flatness probe (stddev <=14) | frame-audit.js (existing, reused) |
| 2 | Accent color on shapes only, never body text — contrast >=4.5:1 everywhere | `frame-audit.js`'s WCAG contrast probe (COL-23) | frame-audit.js (existing, reused) |
| 3 | No frame >40% empty | New: foreground-pixel fraction over the WHOLE frame (not just margins), per extracted frame | slop-check.js `checkFrameEmptiness` |
| 4 | Every scene has cutout photography or line work — not text alone | Structural: every non-LIST_ITEM archetype in this composition renders a Stage visual by construction (icon/chart/nodes/photo) — this check confirms no beat's `scene` object is visual-empty | slop-check.js `checkSceneHasVisual` |
| 5 | At least one element bleeds off a frame edge per scene | New: pixel presence at the literal canvas edge columns (x=0, x=width-1) within the Stage zone, per extracted frame | slop-check.js `checkEdgeBleed` — **known weak signal**, see note below |
| 6 | No raw photo in a rectangular frame — cutout background genuinely transparent | Structural: every `IMAGE_BEAT` beat's asset carries `treatment` from `treat.js` (`cutout` or `fullbleed`, both deliberate) — flags (warn, not fail) any image asset with no `credit`, the signature of a pre-rebuild untreated fixture | slop-check.js `checkImageTreatment` |
| 7 | No hexagon nodes or connector-line systems | Static: `motion-graphics.jsx` contains no hexagon/connector-node primitives at all (grep-verified) — regression guard, not a per-render check | slop-check.js `checkNoHexagonPrimitives` (static, once) |
| 8 | No linear motion | Static: every `interpolate()` call in `motion-graphics.jsx` goes through the `ease()`/`easeScale()` helpers (both default to `Easing.bezier(0.16,1,0.3,1)`) — regression guard | slop-check.js `checkNoLinearInterpolate` (static, once) |
| 9 | No two consecutive scenes share an entrance type | Structural: no two adjacent non-`LIST_ITEM` beats share an `archetype` | slop-check.js `checkEntranceDiversity` |
| 10 | No duplicated fact stated twice on screen at once | `mg-package.js`'s `gateMgHeadlineOverlap` + `stripHeroNumberTokens` (existing, already wired into every build) | mg-package.js (existing, reused) |
| 11 | No scaffolding text (section labels, channel name as kicker) | Static: the `Kicker` component only ever renders the section ordinal + an accent tick — no text prop reaches it that isn't a number (PART 4.3 of the rebuild) — regression guard | slop-check.js `checkKickerNoScaffolding` (static, once) |
| 12 | Captions never break mid-phrase or orphan a unit | `beats.js`'s `gateCaptions` (existing, already wired into every build) | beats.js (existing, reused) |

**Row 5 note:** "bleeds off a frame edge" genuinely requires seeing that an
object is cropped by the canvas boundary, not just present near it — a
one-pixel-strip sample can't tell a genuine bleed from an element that
merely runs close to the edge. Treat row 5's verdict as a hint, not a
verdict, until it's cross-checked against real frames a few times.

## Log

Every `slop-check.js` run appends one line to `data/audit/slop-check.log`
(channel, video, verdict per row, timestamp) — never overwritten, so a
warn-only gate still leaves a trail once it's time to decide which rows are
solid enough to promote to blocking.
