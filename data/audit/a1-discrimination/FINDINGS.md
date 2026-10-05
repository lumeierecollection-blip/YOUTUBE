# A1 â€” which component is inverted

Run 2026-10-05, against the fixes committed in `a0eb378` + the provenance work in this
change. Question: the QA gate fails a run on visual variety while the verifier praises
"uniform white ground". One of them is inverted. Which?

> **ARCHIVAL NOTICE â€” read before citing any number in this file.**
>
> Every verifier reading taken **through the `:330` ground mandate** is superseded and must
> not be cited. That includes: "verifier blind on variety", the "2/10 tie" between frames A
> and B, and the "10/10 for B'" â€” all three were measured through a clause that was found to
> suppress real defect findings. The ground-neutralised re-run re-establishes the signal
> (9 vs 1 on a ground-matched pair), and production no longer carries the clause, so the
> post-removal readings below are the current ones.
>
> The **QA gate** results are NOT affected. `local-audit.cjs` never reads `:330` â€” it is
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
canvas-bearing manifest to force the full-canvas rubric. One SRT cue â†’ one sampled frame.

**B' is an addition.** Without it a pass/fail bit cannot be attributed: B differs from A
in ground *and* composition at once. B' holds composition fixed and varies only the ground,
so "correct on composition / inverted on ground" separates from "blind".

## Results

### QA gate (`scripts/local-audit.cjs`) â€” 17 checks

| | A | B | B' |
|---|---|---|---|
| overall | FAIL 8/17 | FAIL 7/17 | FAIL 8/17 |
| `canvas-ground` | pass | **FAIL** | pass |
| `middle-zone-filled` | **FAIL** | pass | pass |
| `zones-no-overlap` | pass | **FAIL** | **FAIL** |

**A1's expectation ("gate passes B and fails A") does NOT hold.** A fails and B fails.

Only 3 of 17 checks discriminate at all. None of them is a variety axis:
- `canvas-ground` is a **compliance** check â€” it mandates white, so it cannot prefer a
  varied ground. It is blind to variety by construction, not by accident.
- `middle-zone-filled` is the one check that correctly identifies A as a fallback
  ("the middle zone is 0% filled (< 15%)"). It does so on *emptiness*, and A2's required
  `FALLBACK_DETECTED` machine-readable reason **does not exist** â€” A fails only via
  unrelated checks (`mechanism-share â€” NONE 1/1 (100%)` is the nearest thing).
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
**discriminates designed-from-fallback sharply** â€” it is not blind â€” but its judgement is
dominated by ground compliance, not variety. A varied ground costs the entire 8-point
margin on its own.

## Verdict per component â€” CORRECTED, see A1b

**The verdict below was wrong and is superseded by A1b. Kept so the correction is
auditable.** It read the n=1 B row (2/10) as "the verifier is inverted on ground". A1b
shows the 2/10 was produced by `:330`, not by the model's judgement â€” with the ground
mandate removed the same frame scores 9/10.

- ~~**QA gate: BLIND on variety.**~~ **CONFIRMED.** 17 compliance checks, no variety axis.
- ~~**Verifier: CORRECT on composition, INVERTED on ground.**~~ **WRONG.** The verifier is
  correct. `:330` is the inverted component.

## A1b â€” ground-neutralised, and multi-beat

The n=1 set could not settle it: `headline_test.percent` can only be 0 or 100 at n=1, and
a single-beat clip gives one reading of one artifact. Two changes:

**`FRAME_REVIEW_NEUTRALIZE_GROUND=1`** (test-only, `gemini-frame-review.js`) strips the two
clauses that make the white ground a rule â€” the `:330` mandate and PAPER_RUBRIC test 12's
exemption that keeps a plain ground out of the decoration list. Never set in the pipeline.

**A 4-beat pair with ground held constant** (`fixtures-multibeat/`), the comparison A and B'
only approximated:

- `clip-fallback` â€” 4 beats, every beat caption-only on a white ground
- `clip-designed` â€” the same 4 sentences, same white ground, same caption layer, each beat
  also carrying the element its sentence describes (numeral, bars, type statement)

| clip | original rubric | ground-neutralised | headline_test |
|---|---|---|---|
| clip-fallback (4x caption-only) | **1/10 FAIL** | 1/10 FAIL | 4/4 = 100% monoculture |
| clip-designed (4 beats composed) | **9/10 PASS** | 9/10 PASS | 1/4 = 25% PASS |

**An 8-point separation with the ground identical on both clips, and it survives
neutralising the ground mandate.** So the verifier's designed-vs-fallback signal is real
and is not a proxy for ground compliance. `headline_test` is also a working fallback
detector at n=4 â€” the n=1 degeneracy is gone.

### What `:330` actually does â€” it is a shield, not just a bias

On the n=1 set, neutralising the ground mandate moved **B from 2/10 to 9/10** â€” the frame
was fine all along and the mandate was the only complaint.

On the first 4-beat `clip-designed` build, neutralising it moved the clip **9/10 -> 4/10**
with the reasons "excessive template repetition" and "a severe text collision bug in the
final frame". Both were **real defects in the fixture**: beat 3 drew "Three months" twice
(once as a small header, once as the 96px statement) and the statement overprinted the
footnote "held in cash, untouched". Fixed â€” TYPE-FULL beats now draw the statement only,
placed clear of the footnote â€” and the clip scores 9/10 in *both* modes.

That is the important result. `:330` was suppressing findings the model would otherwise
have reported. It does not merely bias the score; it covers real defects.

### Corrected verdict

- **QA gate: BLIND on variety.** Unchanged. A and clip-designed tie on aggregate check
  count; it has no way to express "designed beats fallback".
- **Verifier: CORRECT.** Separates designed from fallback by 8 points with ground held
  constant, survives ground neutralisation, and catches real layout defects when the
  mandate is off.
- **The inverted component is the hardcoded `:330` ground mandate** â€” a rule pasted over a
  model judgement that was right. It is also redundant: `canvas-ground` already enforces
  white deterministically at luma >= 245 and held 27/27 on run 37323030454 (PC2).

## What this implies for delegation â€” reversed

My earlier conclusion was that "the variety decision fails its own eligibility test". **That
is falsified.** The verifier passes A1's discrimination test. The correct reading is the
opposite of "delegate more": **delete a hardcoded clause and let the existing model signal
through**, with `canvas-ground` as the deterministic floor underneath. That is exactly the
A4 position â€” deterministic veto, model scores the qualitative axes â€” arrived at by
measurement rather than assumption.

## Caveats â€” stated, not buried

1. **Groq and Ollama are still untested.** `GROQ_API_KEY` is a repo secret wired at
   `daily-pipeline-v2.yml:933`, but it is unreadable locally, so every number here is
   **Gemini only**. `FORCE_PROVIDER` is committed and the CI leg is the unblock.
2. **Who answered run 37323030454 is not recoverable.** `llm.js` prints
   `gemini: quota_exhausted -> groq` *before* calling Groq â€” it announces the hop, not the
   answer. An earlier note in this file claimed Groq wrote the failing verdict; that was an
   inference from a hop-announcement line and it is not supported. Four Gemini keys, a Groq
   key, and an Ollama vision timeout were all live in that run. Provenance is recorded from
   this change forward (`reviewProvider`, `reviewProviderChain`) and that run is
   retrospectively unresolvable.
3. **A/B/B' rows are n=1.** Only the `clip-fallback` / `clip-designed` rows are n=4. The
   B row in particular should not be cited alone.
4. B is synthetic by necessity â€” `canvas-ground` makes a varied ground unproducible and all
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
#5 are reported here and NOT changed — #3 is the highest-value next edit, because until it
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
## CI leg (run 37344388859) — Groq could not answer, and a live fail-open was found

Every provider call was attributed, so PC1 is validated end to end in CI: `Answered by:
gemini (chain: gemini)`, `groq (chain: groq)`, `ollama (chain: ollama)`.

### The fail-open (fixed, verified)

All four Groq runs printed:

```
Whole-video review ERROR: quota_exhausted
VERDICT: APPROVED - video meets Visual Bible standards.
```

The guard was `wholeResult.status === "FAIL" && severity in (CRITICAL, HIGH)`. A whole-video
result that ERRORED has no `status`, fails that guard, and fell through to APPROVED. **A
video nobody reviewed was approved with the reason "video meets Visual Bible standards."**
This is the same silent-fallback class as the hidden verdict, still live in the code that
change had just touched.

Now `REVIEW_FAILED`, blocking, exit 1, and deliberately not `REJECTED` — nobody has evidence
the video is bad, so the honest answer is INDETERMINATE and `backupAudit`'s deterministic
local audit decides. Reproduced locally against the same condition (a pinned provider with
no key): `Whole-video review ERROR: no_key` -> `VERDICT: REVIEW_FAILED`, exit 1. Same rule
`render-and-qa.js` already states for itself: a review that did not run is NOT a pass.

### Fixture was not portable (fixed)

CI built a **6.03s** clip, not 8.00s, so the reviewer sampled **3 frames instead of 4** and
never saw the 4th beat. ffmpeg's concat demuxer drops the last entry's duration, and the
local 9.0 build did not reproduce it. CI was therefore measuring a different fixture and
reporting it as a 4-beat result. Fixed by pinning `-t` and **asserting the duration** — the
first attempt at the assertion caught a 10s clip from the repeat-the-last-file idiom, which
is the point of having it. A short clip degrades a measurement silently; it must fail.

### Provider readings (3 of 4 beats for gemini/ollama, see above; re-run pending on 4)

| provider | outcome |
|---|---|
| gemini | separates cleanly, 1/10 vs 9/10 |
| groq | **no verdict** — `quota_exhausted` on `qwen/qwen3.8-27b`; `ERROR: Missing from batch response` on the batched path. Gate still open |
| ollama | answered, but **blind**: 1/10 fallback vs 2/10 designed (+1). Fails both |

Ollama being blind is a provider-selection finding, not a spec change: it is the third tier
and its vision model is a 3b on a CPU runner. It should not carry V5.

**The Groq gate remains open.** Its quota was exhausted for the whole window. `FORCE_PROVIDER`
and the CI leg are in place; what is missing is a Groq account with vision quota.
## CI re-run (37349640976) — fail-closed validated, Groq still unmeasured

Fixture fixed first: `Sampling 4 frames at beat points` on both clips, so the readings below
are on the 4-beat fixture. The duration assertion is what forced that — see `9030d15`.

### The fail-open fix works in production

Four runs — two Gemini, two Groq — returned an unusable review and all four now print:

```
Whole-video review ERROR: quota_exhausted
VERDICT: REVIEW_FAILED - whole-video review did not run: quota_exhausted
```

Before `ae3519a` those same four printed `APPROVED - video meets Visual Bible standards`.
This is the fix validated under the exact conditions that exposed it.

**Operational consequence, stated plainly:** with both Gemini and Groq quota-exhausted, the
verifier now blocks videos it previously approved. That is the correct direction — fail
loudly rather than approve blind — but it means runs will start failing on model
unavailability. This is the same consequence flagged when the `pipelineVerdict` branch was
activated, now concrete and measured. It is a conscious trade: an unviewable video is not a
passable video.

### Provider readings on the 4-beat fixture

| provider | fallback | designed | delta | verdict on A1 eligibility |
|---|---|---|---|---|
| gemini | 1/10 | 9/10 | **+8** | **PASS** — separates cleanly |
| groq | — | — | — | **UNMEASURED** — `quota_exhausted` in both CI windows |
| ollama | 2/10 | 2/10 | **0** | **FAIL** — blind |

**Ollama is not merely blind, it is wrong in a specific, checkable way.** It reported
`4/4 headline-dominated (100%) — TEMPLATE_MONOCULTURE` for `clip-designed`, which Gemini
measures at `1/4 (25%)`. It scored the well-composed clip as a template monoculture and
rejected it. On top of a zero delta it fabricates the specific signal V2 depends on. It must
not carry V5 or V2, and the fact that it produces confident, specific, wrong values — rather
than refusing — is the argument for keeping the deterministic axes able to veto a model
regardless of how confidently it speaks.

**The Groq gate is still open.** Two CI windows, both `quota_exhausted`. `FORCE_PROVIDER`
and the CI leg are ready; what is missing is Groq vision quota. Until it answers, A2 cannot
be finalised and the claim "the verifier has real signal" rests on Gemini alone.
## Clause #3 removed, and the finding now gets through (verified)

Sweep clause #3 ("do not call a beat 'empty', 'unbalanced' or 'off-centre' because its middle
is clear or its text sits to one side") protected verbatim the condition `middle-zone-filled`
measures, so a frame whose only ink was the caption band could not be reported as a fallback
in words. Removed.

**Partner check, as asked.** One such clause in the reviewer, but TWO in
`config/visual-bible.json` granting the same licence unbounded: EDT-02 ("must not be afraid of
an empty frame — one object sitting still for 1.5s can be better than five animations") and
EDT-03 ("not every frame should contain maximum information... breathing room is intentional").
Both are legitimate pacing rules and neither was removed; each gained an explicit BOUNDARY
saying the permission stops at a bare frame and that an empty middle zone FAILS the rule
rather than satisfying it. Removing clause #3 alone would have left the shield half-up, which
is the mistake the ground pair already taught.

The bible was patched at TEXT level, not by parse-and-reserialise: the first attempt
reformatted every compact array in the file (63 insertions / 29 deletions of unrelated churn to
change two sentences). The patch asserts the result parses and that each description is
exactly original + boundary, so correctness does not depend on the file staying as formatted.
The diff is now 2 lines.

**Verified behaviourally.** With the clause gone and the fixture assertion green, the model
now writes:

> all frames are empty **fallback** screens containing only captions and white space

`fallback` is the word the deleted clause prevented it from applying.

`scripts/test-fallback-detector.mjs` is the guard: a caption-only beat FAILS
`middle-zone-filled` while still passing `canvas-ground` (the two checks are independent), a
composed beat passes both, and the ground and emptiness shield clauses are asserted absent from
prompt and bible. It states in its header what it does not cover — that the MODEL reports a
bare frame — because that needs a live call.

Two mistakes made and caught while doing this, both recorded in code:
- the first STYLE replacement quoted the deleted prohibition inside a sentence saying it was
  removed. A model pattern-matches phrasing, not framing, so that is a way of reinstalling it.
  The prompt now states only the boundary; the history is in a comment.
- an earlier attempt put that comment INSIDE the template literal, so it was being sent to the
  model as prompt text. Caught by the test asserting the prompt contains neither "unbalanced"
  nor "off-centre".

## Verified readings (duration assertion green)

8.00s, "Sampling 4 frames at beat points", provider pinned to gemini:

| clip | overall | status | headline_test |
|---|---|---|---|
| clip-fallback | **1/10** | FAIL | 4/4 = 100% monoculture |
| clip-designed | **9/10** | PASS | 1/4 = 25% |
| delta | **+8** | | |

The earlier 100%/25% and 9/10 figures quoted before this point may have come from the 3-beat
clip; these supersede them and are marked verified. Test sweep unchanged: the same 6
pre-existing failures, bible still 42 rules.

## Ollama removed from the approve path

`VERDICT_PROVIDERS = {gemini, groq}` in `gemini-frame-review.js`. An answer from any other
provider is **discarded**, not converted into a rejection, and reported as
`PROVIDER_UNAVAILABLE` with exit code 4 (0/1/2/3 were taken). REVIEW_FAILED keeps exit 1.
Both block. The split is legibility for the operator, not a softening.

Verified: with `FORCE_PROVIDER=ollama` the run returns
`PROVIDER_UNAVAILABLE — ollama answered the visual review but is not an accepted verdict
provider (accepted: gemini, groq)`, exit 4.

This gates the VISUAL review only; Ollama stays available to text-only callers. `qwen2.5vl:3b`
on a CPU runner is what was measured, not its text model.
## Attribution targets — fixes to charge against 0/27 when it is re-measured

0/27 is the number this work started from and nothing has re-measured it yet. Run 37355596876
could not: Exa's free MCP rate limit was exhausted, every web search failed, and the pipeline
correctly refused to ground ("every web search failed — cannot ground this stage"), so 0 topics
were discovered and 0 channels reached render. **There is currently no evidence any of this
work moved 0/27.** Keep the attribution below so the next run can be read against it.

Ordered roughly by expected contribution. Only (1) is a layout defect; everything else is
verifier/QA or planning, and must not be credited with a layout fix.

**(1) COUNTER_OVERLAY rendered outside the safe rect — a LAYOUT bug, predates all of this.**
`scene-primitives.js:104` positioned the counter/figure overlay against the full canvas
(`CANVAS_H*0.05` = 96, `CANVAS_W*0.95` = 1026). Commit `674b27c` (2026-09-27, "primary drawing
fills 9:16 frame per margin spec") moved `SAFE` inward to top 288 / right 994 and did not move
the overlay. `layoutScene:387-390` places a counter/figure by this constant rather than by the
slot grid, so **every beat with a number/figure beside a drawing since 2026-09-27 rendered
192px above `SAFE.top` and 32px past `SAFE.right`** — the band where Shorts draws the channel
name, title and action chrome. Fixing the bounds then exposed a second latent bug (the overlay
reserved no slot space; it had only avoided overlap by being outside `SAFE`), also fixed.

This is the most likely single contributor from this list. `common_missing` is full of
placement clauses — "giant numeral 40% **filling the centre of the frame**", "single dollar bill
**filling the centre of the frame**", "wallet lying open **in the centre of the frame**", "small
labels **flanking** the bill" — and a COUNTER-cued beat drawn at y=96 instead of centre fails
every one of them as NO/PARTIAL, never YES. Timing caps the attributable share at 6 beats.

**(2) Scene description is now decisive** (`scene-translate.js`). Verified on a
duration-asserted 4-beat fixture with the provider pinned: fallback 1/10, designed 9/10, delta
+8, and the model now writes "empty **fallback** screens" for the bare clip.

**(3) COUNTER cue gained `numeral`/`giant number`/`huge number`.** "A giant numeral 40% fills
the centre" previously matched nothing and lost to LINE on a later supporting clause, landing
on TYPE with no number anywhere (run 37323030454, ch-1 beat 0).

**(4) Shield clauses removed** (`:330` ground mandate, its test-12 twin, clause #3's
"do not call it empty", EDT-02/EDT-03 bounded). Scoring-neutral on a clean fixture set; changes
only what gets reported.

**(5) Fail-closed verdicts** (`REVIEW_FAILED` exit 1, `PROVIDER_UNAVAILABLE` exit 4, Ollama
removed from the approve path). **Expect this to make runs fail more often, not less** — it
blocks videos that were previously approved unviewed. Do not read a lower approval count as a
regression without checking which verdict produced it.

### Two methodology notes, because both cost real time here

- **A diagnostic that does not share the code it diagnoses will lie in the author's
  direction.** My own `cue-hits.mjs` hardcoded a pattern map for `cuesOf` that included
  `numeral`, which the real `CUES` regex did not — so it reported COUNTER coverage that did not
  exist, and I nearly "fixed" a COUNTER bug that was already fixed while a real one (the missing
  `numeral`) went unfixed for two rounds. Same shape as the verifier prompt quoting its own
  removed clause: a copy of the thing under test drifts from the thing under test.
- **A guard that has never fired is not a guard.** `test-assertion-separators.mjs` passed on the
  real tree three times while being unable to detect anything: it inspected only the first
  string literal per line (missing nested `.includes("FLAT — centered")`), then used a regex
  that demanded whitespace before the character preceding the dash, which never matches a real
  case. It also could not see an untracked planted file because the scanner is `git ls-files`
  based. It is only trusted now because it has been shown to FAIL against a planted copy of the
  pre-fix assertion.