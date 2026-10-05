# A1 — which component is inverted

Run 2026-10-05, against the fixes committed in `a0eb378` + the provenance work in this
change. Question: the QA gate fails a run on visual variety while the verifier praises
"uniform white ground". One of them is inverted. Which?

> **ARCHIVAL NOTICE — read before citing any number in this file.**
>
> Every verifier reading taken **through the `:330` ground mandate** is superseded and must
> not be cited. That includes: "verifier blind on variety", the "2/10 tie" between frames A
> and B, and the "10/10 for B'" — all three were measured through a clause that was found to
> suppress real defect findings. The ground-neutralised re-run re-establishes the signal
> (9 vs 1 on a ground-matched pair), and production no longer carries the clause, so the
> post-removal readings below are the current ones.
>
> The **QA gate** results are NOT affected. `local-audit.cjs` never reads `:330` — it is
> deterministic and has its own `canvas-ground` check. Its "blind on variety" verdict stands
> as written.
>
> **Calibrate forward, never backward.** Provenance was only recorded from `88064dd` onward,
> so no historical pipeline run records which provider answered. Any A2 threshold calibrated
> against pre-`88064dd` runs is calibrated against unknown providers. Thresholds must come
> from runs that carry a provider record.

## Method

Frozen fixtures in `fixtures/` (sha256 per frame in `fixtures/fixtures.json`; a changed
hash voids this result). Colours all come from ch-1 in `config/channels.json`.

| id | ground | content | purpose |
|---|---|---|---|
| A | uniform white | caption band + page counter only | the fallback signature |
| B | varied (ch-1's own `bg #0A1020`, gradient) | composed: numeral, headline, label, rule | A1's B |
| B' | uniform white | **the same composed elements as B** | EXTENSION, not in the A1 spec |

Each fixture was run through both components independently. The verifier is CLI-only and
selects its rubric by sniffing `<video>-manifest.json` for `beats[].canvas`
(`gemini-frame-review.js:712`), so each fixture got a real constant-image video plus a
canvas-bearing manifest to force the full-canvas rubric. One SRT cue → one sampled frame.

**B' is an addition.** Without it a pass/fail bit cannot be attributed: B differs from A
in ground *and* composition at once. B' holds composition fixed and varies only the ground,
so "correct on composition / inverted on ground" separates from "blind".

## Results

### QA gate (`scripts/local-audit.cjs`) — 17 checks

| | A | B | B' |
|---|---|---|---|
| overall | FAIL 8/17 | FAIL 7/17 | FAIL 8/17 |
| `canvas-ground` | pass | **FAIL** | pass |
| `middle-zone-filled` | **FAIL** | pass | pass |
| `zones-no-overlap` | pass | **FAIL** | **FAIL** |

**A1's expectation ("gate passes B and fails A") does NOT hold.** A fails and B fails.

Only 3 of 17 checks discriminate at all. None of them is a variety axis:
- `canvas-ground` is a **compliance** check — it mandates white, so it cannot prefer a
  varied ground. It is blind to variety by construction, not by accident.
- `middle-zone-filled` is the one check that correctly identifies A as a fallback
  ("the middle zone is 0% filled (< 15%)"). It does so on *emptiness*, and A2's required
  `FALLBACK_DETECTED` machine-readable reason **does not exist** — A fails only via
  unrelated checks (`mechanism-share — NONE 1/1 (100%)` is the nearest thing).
- `zones-no-overlap` failing on B and B' is an artifact of how I built the fixtures (the
  330px numeral and the right-anchored headline cross a zone edge). It is not a property
  of composed scenes and should not be read as a verdict on B.

### Verifier (`scripts/gemini-frame-review.js`), provider pinned to gemini

| | overall_score | status | pipelineVerdict | stated reason |
|---|---|---|---|---|
| A | 2/10 | FAIL | REJECTED | "fails fundamentally by presenting a static text layout instead of a continuous visual argument with proper data or photographic elements" |
| B | 2/10 | FAIL | REJECTED | "a critical violation of the fundamental style rule requiring a uniform solid white background instead of a dark theme" |
| B' | **10/10** | **PASS** | **APPROVED** | "exemplifies high-end editorial motion graphics with exceptional typography, precise data visualization, and strict adherence to the requested design system" |

**A1's expectation ("verifier scores B > A on variety") does NOT hold.** B ties A at 2/10.

The extension earns its place: B' scores 10/10 against A's 2/10. So the verifier
**discriminates designed-from-fallback sharply** — it is not blind — but its judgement is
dominated by ground compliance, not variety. A varied ground costs the entire 8-point
margin on its own.

## Verdict per component — CORRECTED, see A1b

**The verdict below was wrong and is superseded by A1b. Kept so the correction is
auditable.** It read the n=1 B row (2/10) as "the verifier is inverted on ground". A1b
shows the 2/10 was produced by `:330`, not by the model's judgement — with the ground
mandate removed the same frame scores 9/10.

- ~~**QA gate: BLIND on variety.**~~ **CONFIRMED.** 17 compliance checks, no variety axis.
- ~~**Verifier: CORRECT on composition, INVERTED on ground.**~~ **WRONG.** The verifier is
  correct. `:330` is the inverted component.

## A1b — ground-neutralised, and multi-beat

The n=1 set could not settle it: `headline_test.percent` can only be 0 or 100 at n=1, and
a single-beat clip gives one reading of one artifact. Two changes:

**`FRAME_REVIEW_NEUTRALIZE_GROUND=1`** (test-only, `gemini-frame-review.js`) strips the two
clauses that make the white ground a rule — the `:330` mandate and PAPER_RUBRIC test 12's
exemption that keeps a plain ground out of the decoration list. Never set in the pipeline.

**A 4-beat pair with ground held constant** (`fixtures-multibeat/`), the comparison A and B'
only approximated:

- `clip-fallback` — 4 beats, every beat caption-only on a white ground
- `clip-designed` — the same 4 sentences, same white ground, same caption layer, each beat
  also carrying the element its sentence describes (numeral, bars, type statement)

| clip | original rubric | ground-neutralised | headline_test |
|---|---|---|---|
| clip-fallback (4x caption-only) | **1/10 FAIL** | 1/10 FAIL | 4/4 = 100% monoculture |
| clip-designed (4 beats composed) | **9/10 PASS** | 9/10 PASS | 1/4 = 25% PASS |

**An 8-point separation with the ground identical on both clips, and it survives
neutralising the ground mandate.** So the verifier's designed-vs-fallback signal is real
and is not a proxy for ground compliance. `headline_test` is also a working fallback
detector at n=4 — the n=1 degeneracy is gone.

### What `:330` actually does — it is a shield, not just a bias

On the n=1 set, neutralising the ground mandate moved **B from 2/10 to 9/10** — the frame
was fine all along and the mandate was the only complaint.

On the first 4-beat `clip-designed` build, neutralising it moved the clip **9/10 -> 4/10**
with the reasons "excessive template repetition" and "a severe text collision bug in the
final frame". Both were **real defects in the fixture**: beat 3 drew "Three months" twice
(once as a small header, once as the 96px statement) and the statement overprinted the
footnote "held in cash, untouched". Fixed — TYPE-FULL beats now draw the statement only,
placed clear of the footnote — and the clip scores 9/10 in *both* modes.

That is the important result. `:330` was suppressing findings the model would otherwise
have reported. It does not merely bias the score; it covers real defects.

### Corrected verdict

- **QA gate: BLIND on variety.** Unchanged. A and clip-designed tie on aggregate check
  count; it has no way to express "designed beats fallback".
- **Verifier: CORRECT.** Separates designed from fallback by 8 points with ground held
  constant, survives ground neutralisation, and catches real layout defects when the
  mandate is off.
- **The inverted component is the hardcoded `:330` ground mandate** — a rule pasted over a
  model judgement that was right. It is also redundant: `canvas-ground` already enforces
  white deterministically at luma >= 245 and held 27/27 on run 37323030454 (PC2).

## What this implies for delegation — reversed

My earlier conclusion was that "the variety decision fails its own eligibility test". **That
is falsified.** The verifier passes A1's discrimination test. The correct reading is the
opposite of "delegate more": **delete a hardcoded clause and let the existing model signal
through**, with `canvas-ground` as the deterministic floor underneath. That is exactly the
A4 position — deterministic veto, model scores the qualitative axes — arrived at by
measurement rather than assumption.

## Caveats — stated, not buried

1. **Groq and Ollama are still untested.** `GROQ_API_KEY` is a repo secret wired at
   `daily-pipeline-v2.yml:933`, but it is unreadable locally, so every number here is
   **Gemini only**. `FORCE_PROVIDER` is committed and the CI leg is the unblock.
2. **Who answered run 37323030454 is not recoverable.** `llm.js` prints
   `gemini: quota_exhausted -> groq` *before* calling Groq — it announces the hop, not the
   answer. An earlier note in this file claimed Groq wrote the failing verdict; that was an
   inference from a hop-announcement line and it is not supported. Four Gemini keys, a Groq
   key, and an Ollama vision timeout were all live in that run. Provenance is recorded from
   this change forward (`reviewProvider`, `reviewProviderChain`) and that run is
   retrospectively unresolvable.
3. **A/B/B' rows are n=1.** Only the `clip-fallback` / `clip-designed` rows are n=4. The
   B row in particular should not be cited alone.
4. B is synthetic by necessity — `canvas-ground` makes a varied ground unproducible and all
   27 real beats measured uniform white.

## Also fixed here

`zones-no-overlap` failed on the n=1 B/B' fixtures and that was fixture construction, not a
property of composed frames. The multi-beat set keeps every element inside its own band
(headline y 210-430, numeral y 560-900, label y 1010, rule y 1128), so that check no longer
carries known noise. It is not in the A2 axis list for that reason.
## Sweep: every clause that forbids reporting something

`:330` and the caption clause were found independently, which means they are not a pair of
one-offs. Every suppression-shaped clause in the reviewer prompt was located and classified.
A **shield** hides a real failure class; a **legitimate suppression** is a noise floor.

| # | clause | location | class | why |
|---|---|---|---|---|
| 1 | ground mandate "one solid white on every beat - no shadows, tint or dark beats" | STYLE block | **SHIELD** | proven: suppressed "template repetition" + "text collision" findings; B scored 2/10 while actually fine |
| 2 | "(Not noise in this style: the plain uniform white ground...)" | PAPER_RUBRIC test 12 | **SHIELD** | second layer of #1; exempts a flat ground from the decoration test, which is the variety signal |
| 3 | "do not call a beat 'empty', 'unbalanced' or 'off-centre' because its middle is clear" | STYLE block | **SHIELD** | protects the exact signature `middle-zone-filled` detects. The model rubric and the deterministic fallback detector are in direct opposition on one signal |
| 4 | caption band "not a defect, not duplication and not a fragment: never list it in slop_indicators, repetition_issues, decoration_issues or corrections" | PAPER_RUBRIC test 2 + STYLE block | **SHIELD** | a frame whose only content is the caption band cannot be reported as repetition - i.e. the fallback frame is undefendable |
| 5 | "A small section folio ('03 / 08') and a hairline rule are page furniture, not defects" | STYLE block | **SHIELD** | narrow, but same shape as #4 |
| 6 | "the dark gradient that keeps white type readable over a full-frame photo" | PAPER_RUBRIC test 12 | LEGITIMATE | a scrim over a photo is a technique, not noise. Kept |
| 7 | "judge whether the composition spans the frame (elements anchored to opposite regions)" | STYLE block | LEGITIMATE | redirects from "is it centred" to "does it span", a better question. Kept |

**Five shields, two legitimate.** #1 and #2 are removed from production (they protected the
same thing in two layers; removing one alone would have left the shield half-up). #3, #4 and
#5 are reported here and NOT changed � #3 is the highest-value next edit, because until it
goes, the model is forbidden from describing the condition the deterministic fallback
detector exists to catch.

### Post-removal confirmation

Re-ran the ground-matched pair with the shield gone from production text:

| clip | before (`:330` live) | after (shield removed) |
|---|---|---|
| clip-fallback | 1/10 FAIL, 100% monoculture | **1/10 FAIL, 100% monoculture** |
| clip-designed | 9/10 PASS, 25% | **9/10 PASS, 25%** |

Scoring is unchanged on a clean fixture set - the removal costs nothing and only changes what
gets reported. The fallback verdict text sharpened: it now reads "only blank white screens
with page numbers" where the mandate previously made that sound like spec compliance.

Also answers the clause-local question: on the FIXED fixture set, `:330` live and `:330`
removed both gave 9 and 1. The 9 -> 4 drop was therefore caused entirely by real defects
waiting to be reported, not by the fixture being unusual. The shield's effect is
clause-local.