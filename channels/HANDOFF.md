# Channel expansion handoff — 2026-10-06

## Where the four channels stand

| channel | approved | rendered | Layer 1 | blocking issue |
|---|---|---|---|---|
| ch-05 Broadsheet | yes | yes, 9 beats | **FAIL** | `middle-zone-filled`, beats 3 & 5 at 13%/14% vs 15% floor |
| ch-06 Archive Room | yes | unknown | — | render job SIGTERM (143) under dispatch concurrency |
| ch-08 Ledger | yes | unknown | — | run cancelled before render; re-dispatched, result unread |
| ch-10 Margin Note | yes | yes, 8 beats | **FAIL** | `canvas checks FAILED`, specific check not isolated |

**No channel has reached Layer 2 or Layer 3.** The eval loop runs *after* the
pixel gate, so it has still never executed in CI on any channel.

## The middle-zone-filled diagnostic — answered

**The references PASS. The check is correct. Do not tune it.**

Measured with `local-audit.cjs:653`'s exact arithmetic (W=270 H=480,
rows y=155..335, a row counts when >=3 of 270 px have luma < 235, best of the
62% and 90% sample points):

| group | frames | mean | p10 | below 15% |
|---|---|---|---|---|
| ch-05 Broadsheet (3 refs) | 27 | 99.3% | 100.0% | **0/27** |
| ch-10 Margin Note | 8 | 94.9% | 80.0% | **0/8** |
| ch-06 Archive Room | 9 | 100.0% | 100.0% | **0/9** |
| ch-08 Ledger | 9 | 100.0% | 100.0% | **0/9** |
| ch-02 Legal Brief (built, control) | 9 | 73.9% | 33.3% | **0/9** |

53 of 53 reference frames clear the floor. The built-channel control clears it
too, and with the least margin (p10 33.3%), which is why the floor is defensible.

So the §4 style-aware per-channel floor **must not be implemented**. It would
have lowered the bar for a style that does not need lowering: the references are
95–100% filled, so the 15% floor is nowhere near binding for these styles. The
ch-05 render at 13–14% is a genuine defect — the middle zone is nearly empty
where the reference is nearly solid.

**The gap is in the render, not the check and not the floor.** ch-05's
TYPE-SPLIT beats are producing an empty middle third on footage whose reference
fills it completely.

## Next actions

1. **Re-dispatch ch-06 and ch-08 sequentially**, one at a time. The concurrency
   group `daily-pipeline-${{ github.ref }}` is why they died; four at once is the
   mistake, not the channels.
2. **Isolate ch-10's failing check by id** — the run said only `canvas checks
   FAILED`.
3. **Diagnose the ch-05 TYPE-SPLIT gap.** The composition is putting type in the
   top and bottom zones and nothing between. The reference frames fill 95–100%
   of the middle band. Likely causes, in order of suspicion: the ch-05 style spec
   has `use_of_negative_space: "medium"` with no middle-zone guidance at all,
   and `core_objects` are collage nouns (clipped photograph, masthead rule,
   column gutter) that Gemini may be rendering as rules and type only. Compare a
   rendered TYPE-SPLIT beat against `4_5917850534521349251.mp4` at the same
   timestamps before changing anything.
4. **Layer 2 / Layer 3 first CI execution** — still owed, on whichever channel
   clears Layer 1 first.

## Known gaps carried forward

- Layer 2 and Layer 3 have never run in CI, on any channel.
- The eval loop's beat-index resolver gap is unfixed: Gemini returns MM:SS, not
  `beat_index`, and `resolveRevisions` requires an integer. It was hit on the
  local ch-2 dry run and is untested in production.
- `config/channels.json` mojibake, unfixed by instruction.
- `type: choice` workflow inputs do not dispatch (GitHub rejects the input's own
  default); `type: string` is used and validation lives in `evalLoopMode()`.