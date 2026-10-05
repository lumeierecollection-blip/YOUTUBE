# A1 — which component is inverted

Run 2026-10-05, against the fixes committed in `a0eb378` + the provenance work in this
change. Question: the QA gate fails a run on visual variety while the verifier praises
"uniform white ground". One of them is inverted. Which?

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

## Verdict per component

- **QA gate: BLIND on variety.** No variety axis exists. It is a 17-check compliance
  gate; A and B' tie at 8/17. It cannot express "designed beats fallback" at all. Its
  fallback detection is real but incidental (`middle-zone-filled`), and silent.
- **Verifier: CORRECT on composition, INVERTED on ground.** Not blind. Strongly
  discriminating (2 vs 10), along an axis that answers a different question than the one
  the QA gate is asking. Its own rationale cites style compliance, never variety.

So neither component is inverted in the simple sense. They are answering two different
questions, and only one of them (the verifier) is looking at the frame at all.

## Caveats — stated, not buried

1. **Groq and Ollama were not exercised.** `GROQ_API_KEY` and `OLLAMA_URL` are CI-secrets
   only; locally just `GEMINI_API_KEY` is set. This is Gemini-only. The verdict that
   actually failed run 37323030454 was written by **Groq** (Gemini was quota_exhausted),
   so **the component under investigation has still not been tested.** `FORCE_PROVIDER`
   was added to `src/lib/llm.js` for exactly this and is ready; it needs a Groq key.
2. **One beat per fixture.** `headline_test.percent` can only be 0 or 100 at n=1, so the
   `TEMPLATE_MONOCULTURE` REJECTED on B is partly a single-sample artifact. The reliable
   signals are `overall_score` and `status`. A multi-beat fixture set is needed before
   any verdict is treated as final.
3. B and B' are synthetic. B is synthetic by necessity — `canvas-ground` makes a varied
   ground unproducible, and all 27 real beats in run 37323030454 measured uniform white
   (cross-beat SD 2.91 luma levels).

## What this implies for delegation

Neither component currently owns the variety decision. The gate has no such axis; the
verifier's answer to it is a ground-compliance rule inherited from `gemini-frame-review.js:330`.
Delegating variety to either one, before A2 defines it operationally, would formalise a
question nobody is asking. This is the predicted outcome from the audit append, now
measured: the variety decision fails its own eligibility test.