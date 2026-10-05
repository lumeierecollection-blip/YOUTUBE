# A2 — visual variety, defined operationally

**Status: DRAFT. Groq gate OPEN.** The axis set is provider-independent and does not move on
the Groq result. What the Groq result changes is the *confidence* attached to "the verifier
has real signal", which is a provider-selection finding inside A2's execution, not a spec
rewrite. Do not finalise while the gate is open.

Prerequisite, landed in `1ef8b0e`: the `:330` ground mandate and its PAPER_RUBRIC test-12
twin are removed. A2 scoring frames through those would measure the shield's residue.

## What is already settled, and by what

| decision | evidence | outcome |
|---|---|---|
| Ground as a variety axis | PC2 — all 27 real beats uniform white, within-patch variance 0.04, cross-beat SD **2.91** luma levels (range 246.6–255.0, and that residual is an element edge, not ground colour) | **DROPPED.** Not a conflict with `canvas-ground` — no dynamic range to score. `canvas-ground` keeps enforcing luma ≥ 245. |
| Caption band as a variety axis | PC3b — **22 of 27** non-YES beats cite only the word-by-word caption band; the pipeline mandates it, the planner is told not to describe it, and PAPER_RUBRIC test 2 forbade reporting it | **EXCLUDED from variety.** It is a resolver/planning defect (81% of model complaints), not an axis. |
| `zones-no-overlap` | n=1 fixtures failed it from construction (330px numeral crossing a zone edge) | **EXCLUDED.** Fixed at source in the multi-beat set; kept out of A2 so known noise can't be cited later as signal. |
| Does the verifier discriminate at all? | A1b — ground-matched pair, 9/10 vs 1/10, survives neutralisation, unchanged after shield removal | **YES.** Model-scored. |
| Is a fallback detectable deterministically? | A1 — `middle-zone-filled` fails A ("middle zone is 0% filled, < 15%") and passes both composed fixtures | **YES.** Promoted below. |

## Axes

Direction: higher is better unless noted. **D** = deterministic (can veto, cannot approve).
**M** = model-scored.

| # | axis | owner | definition | threshold | why it is here |
|---|---|---|---|---|---|
| V1 | **Fallback signature** | **D** | Middle-zone fill < 15% of the middle band, measured per beat at 70% through it, **or** the frame's only ink is the caption band + page counter | any beat trips it → `FALLBACK_DETECTED` | This is `middle-zone-filled`, promoted. It is the first non-trivial deterministic signal the QA gate has produced, and it is the axis the model rubric currently forbids in words (clause #3 in the sweep). |
| V2 | **Cross-beat composition entropy** | **D** | Shannon entropy of the beat→composition mapping over the video, normalised by log(n_beats) | < 0.6 → warn; < 0.45 → fail | Catches "every beat rendered the same fallback", which per-beat measures cannot see. Deterministic because the render manifest already records each beat's composition. |
| V3 | **Zone coverage spread** | **D** | Fraction of the frame's four quadrants containing ink, averaged across beats | < 0.5 → warn | `middle-zone-filled` catches one empty band; this catches content clumped in one region. Directly measures what `:330` used to tell the model not to notice. |
| V4 | **Palette spread** | **D** | Count of distinct hues at ≥ 20% pixel share, excluding the ground and the accent | < 2 → warn | A frame drawn in one ink plus one accent is the signature of a text-dump. Excluding ground/accent keeps it independent of V-dropped ground. |
| V5 | **Designed-vs-fallback judgement** | **M** | The verifier's existing whole-video score, plus a required rationale that cites at least one axis by name | score ≤ 4 → warn; `FAIL` at HIGH/CRITICAL → fail | The model's judgement is sound (A1b). It scores the qualitative axes above the floor; it cannot lower the floor. |

### Explicitly not axes

- **Ground variance** — settled by PC2.
- **Caption-band presence** — settled by PC3b. If this keeps scoring as a defect, fix the resolver; do not score it.
- **`zones-no-overlap`** — fixture noise, excluded.
- **Any axis with no known-answer pair** — per the delegation plan, not eligible for authority past Phase 3. V1–V4 each have one: `clip-fallback` vs `clip-designed` in `fixtures-multibeat/`.

## Division of authority

Per A4: **the deterministic layer owns the veto, the model owns the qualitative read.**

- V1–V4 can only **reject**. A run that trips a deterministic axis does not ship, regardless
  of what the model said. This is unchanged from today's posture and is not delegable.
- V5 can only **reject or warn**. It never approves.
- **Nothing approves.** Approval stays downstream in `frameReviewVerdict` /
  `backupAudit`, and per `88064dd` the model's own persisted verdict now has to be read
  rather than re-derived.
- `FALLBACK_DETECTED: <beat index>` must be machine-readable, per A4. Today a fallback frame
  fails only via unrelated checks (`mechanism-share — NONE 1/1 (100%)` is the nearest
  existing signal), which is why the failure mode was survivable.

## Open gate

**Groq has not answered.** `GROQ_API_KEY` is a repo secret (`daily-pipeline-v2.yml:933`) and
unreadable locally, so every local verifier number in `FINDINGS.md` is Gemini-only. The CI leg
(`.github/workflows/a1-discrimination.yml`) runs each fixture per provider per rubric mode
with `FORCE_PROVIDER` pinned. In run `37344388859` **Groq returned no verdict at all** —
`quota_exhausted` on `qwen/qwen3.8-27b`, plus `ERROR: Missing from batch response` on the
batched path. The gate is open because Groq is unmeasured, not because it failed.

**Ollama is measured and blind.** 1/10 on fallback vs 2/10 on designed — it fails both clips.
It is the third tier with a 3b vision model on a CPU runner. It must not carry V5. This is a
provider-selection finding and does not move the axes.

Three outcomes, and what each implies:

| Groq result | Implication for A2 |
|---|---|
| Separates designed from fallback (≥ +5 points) | A2 confirmed provider-independent. V5 is safe to score on either model. |
| Blind on composition (both clips score alike) | V5 is dropped for Groq. A2 becomes Gemini-primary with Groq excluded from V5, and the provider-selection question moves to Phase 4. |
| Prefers the fallback clip | A2's V5 is withdrawn entirely and V1–V4 carry the decision alone. That is a materially different architecture and is the reason the gate is open. |

Also unresolved and feeding V1: clause #3 of the sweep — the model is currently forbidden
from calling a beat "empty" because its middle is clear. Until that is removed, V1 and V5
disagree by construction on exactly the frames V1 exists to catch. Recommend removing it
next.

## Precondition discovered while running the gate

A2 cannot be enforced until this is closed, and it was found by the CI leg rather than by
the spec: the whole-video review **failed open**. An errored review (quota, unreachable
provider, unparseable answer) has no `status`, failed the `status === "FAIL"` guard, and
produced `APPROVED — video meets Visual Bible standards`. Four Groq runs in run `37344388859`
did exactly that.

Fixed in `REVIEW_FAILED`: blocking, exit 1, machine-readable, and deliberately not
`REJECTED` — an indeterminate review is not evidence of a bad video, so `backupAudit`'s
deterministic audit decides. This is V5's own failure mode (a model score that did not
happen read as a passing score) and it is exactly what the delegation plan's "fallback path
must emit a machine-readable failure, not a plausible frame" forbids.

## Calibration

Forward only. Provenance exists from `88064dd`; no earlier run records which provider
answered. Initial thresholds are the ones above and are **provisional** — they are starting
values to be replaced by measured distributions from runs that carry a provider record, not
values derived from history.