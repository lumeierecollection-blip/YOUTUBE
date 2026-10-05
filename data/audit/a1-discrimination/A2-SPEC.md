# A2 — visual variety, defined operationally

**Status: FINAL, with one open provider question recorded below (§Open provider question).**
That question is a provider-selection matter inside A2. It is not a blocker and does not hold
anything here open.

Two prerequisite commits, both landed: `1ef8b0e` removed the `:330` ground mandate and its
PAPER_RUBRIC test-12 twin; `ae3519a` closed the fail-open that let an errored review return
`APPROVED`. A2 scoring frames through either would have measured the artefact rather than the
frame.

## Calibration provenance — read before using any threshold

Every verifier number in this document was measured with the provider **pinned** to
`gemini` via `FORCE_PROVIDER`, on the **verified** 4-beat fixture (8.00s, "Sampling 4 frames
at beat points", duration assertion green).

**These thresholds do not transfer between providers.** The chain is Gemini → Groq → Ollama
and quota decides which tier actually runs, so "9 vs 1" is a statement about a pinned
provider, not about the verifier. `summarise.mjs` now prints the provider and delta for every
reading and warns when more than one provider is present, so a mixed table cannot be mistaken
for a calibrated one. If the answering tier changes, re-measure before trusting a threshold.

Ollama is **excluded from the verdict path entirely** (`VERDICT_PROVIDERS` in
`gemini-frame-review.js`), on evidence: in run `37349640976` it scored both fixtures 2/10 — a
zero delta on a pair Gemini separates by 8 — and reported `4/4 headline-dominated (100%)
TEMPLATE_MONOCULTURE` for the composed clip Gemini measures at `1/4 (25%)`. It fabricated the
exact signal V2 depends on. Its reading is discarded rather than converted into a rejection;
an untrusted answer is not evidence the video is bad.

## What is settled, and by what

| decision | evidence | outcome |
|---|---|---|
| Ground as a variety axis | PC2 — 27/27 real beats uniform white, within-patch variance 0.04, cross-beat SD **2.91** luma levels (range 246.6–255.0; the residual is an element edge, not ground colour) | **DROPPED.** Not a conflict with `canvas-ground` — no dynamic range to score. `canvas-ground` keeps enforcing luma ≥ 245. |
| Caption band as a variety axis | PC3b — **22 of 27** non-YES beats cite only the word-by-word caption band, which the pipeline mandates, the planner is told not to describe, and PAPER_RUBRIC test 2 forbade reporting | **EXCLUDED.** A resolver defect, not an axis. |
| `zones-no-overlap` | failed the n=1 fixtures from construction (330px numeral crossing a zone edge) | **EXCLUDED.** Fixed at source in the multi-beat set. |
| Does the verifier discriminate? | verified fixture — **1/10 vs 9/10, delta +8**, both rubric modes | **YES.** Model-scored. |
| Is a fallback detectable deterministically? | `middle-zone-filled` fails a caption-only beat ("middle zone is 0% filled, < 15%") and passes a composed one | **YES.** Promoted to V1. |

## Axes

Higher is better. **D** = deterministic, veto-only. **M** = model-scored.

| # | axis | owner | definition | threshold | why |
|---|---|---|---|---|---|
| V1 | **Fallback signature** | **D** | Middle-zone fill < 15% of the middle band at 70% through the beat, **or** the frame's only ink is the caption band + page counter | any beat trips it → `FALLBACK_DETECTED` | `middle-zone-filled`, promoted. The first non-trivial deterministic signal the gate produced, and the axis the reviewer's now-deleted clause forbade in words. |
| V2 | **Cross-beat composition entropy** | **D** | Shannon entropy of the beat→composition mapping, normalised by log(n_beats) | < 0.6 warn · < 0.45 fail | Catches "every beat rendered the same fallback", which no per-beat measure can see. |
| V3 | **Zone coverage spread** | **D** | Fraction of the frame's four quadrants containing ink, averaged over beats | < 0.5 warn | Catches content clumped in one region. |
| V4 | **Palette spread** | **D** | Distinct hues at ≥ 20% pixel share, excluding ground and accent | < 2 warn | One ink plus one accent is the text-dump signature. Independent of the dropped ground axis. |
| V5 | **Designed-vs-fallback judgement** | **M** | Verifier whole-video score + `headline_test.monoculture`, with a rationale citing an axis by name | score ≤ 4 warn · `FAIL` at HIGH/CRITICAL fail | Measured at +8 on the verified fixture. Scores the qualitative axes; cannot lower the floor. |

### Not axes

Ground variance (PC2) · caption-band presence (PC3b — fix the resolver, don't score it) ·
`zones-no-overlap` (fixture noise) · anything without a known-answer pair (ineligible for
authority past Phase 3). V1–V4 each have one: `clip-fallback` vs `clip-designed`.

## Division of authority

- V1–V4 can only **reject**. A deterministic axis failure blocks regardless of the model's
  opinion. Not delegable.
- V5 can only reject or warn. It never approves.
- **Nothing approves.** Approval stays downstream in `frameReviewVerdict` / `backupAudit`.
- `FALLBACK_DETECTED: <beat index>` must be machine-readable. Today a bare frame fails only via
  unrelated checks, which is why the failure mode was survivable.
- A review that did not run is not a pass: `REVIEW_FAILED` (exit 1) or `PROVIDER_UNAVAILABLE`
  (exit 4, an untrusted provider answered). Both block. Neither is softened to unblock a run.

## Verified readings

Measured on the duration-asserted 4-beat fixture, provider pinned to gemini:

| clip | overall | status | headline_test | verdict |
|---|---|---|---|---|
| clip-fallback (4× caption-only) | **1/10** | FAIL | 4/4 = 100% monoculture | REJECTED |
| clip-designed (4 beats composed) | **9/10** | PASS | 1/4 = 25% | APPROVED |
| delta | **+8** | | | |

Behavioural confirmation that the shield removal landed: the fallback verdict now reads
*"all frames are empty fallback screens containing only captions and white space"*. The word
`fallback` is the one the deleted clause prevented the model from applying.

`scripts/test-fallback-detector.mjs` guards this: it asserts a caption-only beat FAILS
`middle-zone-filled` while passing `canvas-ground`, that a composed beat passes both, and that
the three shield clauses stay absent from the prompt and bible. Its header states plainly what
it does **not** cover — that the *model* now reports a bare frame — because that needs a live
call and is verified by the fixture pair above, not by a unit test.

## Open provider question

Groq is unmeasured: `quota_exhausted` in both CI windows (`37344388859`, `37349640976`).
`FORCE_PROVIDER` and the CI leg are in place and it will answer when quota resets. It is not
blocking A2 — nothing here depends on it.

If Groq separates the pair by ≥ 5 points, V5 is safe on either accepted provider. If it is
blind, V5 is dropped for Groq and provider selection moves to Phase 4. If it prefers the
fallback clip, V5 is withdrawn entirely and V1–V4 carry the decision alone.

Calibration is forward-only and these thresholds are provisional: provenance starts at
`88064dd`, so no pre-`88064dd` run records a provider and none can calibrate anything.