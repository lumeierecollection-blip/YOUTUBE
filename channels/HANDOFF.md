# Channel expansion handoff — 2026-10-06 (final)

## All four channels render. All four fail a deterministic gate.

| channel | rendered | failed at | detail |
|---|---|---|---|
| ch-05 Broadsheet | yes, 9 beats | **Layer 1 `middle-zone-filled`** | beats 3 & 5 (TYPE-SPLIT) at 13% / 14% vs the 15% floor |
| ch-06 Archive Room | yes | **beat check** (frame↔sentence) | TYPE beats report "description did not name a buildable element" |
| ch-07→ch-08 Ledger | yes | **beat check** (frame↔sentence) | same pattern: TYPE beats, beats 2–5 all unbuildable |
| ch-10 Margin Note | yes, 8 beats | **Layer 1 `canvas-accent`** | "the manifest names no accent colour (channels.json `colors.canvas_accent`)" |

Registration → approval → render works for all four. **No channel has reached
Layer 2 or Layer 3**, so the eval loop still has never run in CI. ch-06 and ch-08
needed sequential dispatching; the earlier SIGTERM and cancellation were the
concurrency group, not the channels.

## Two diagnoses, both measured

### 1. `middle-zone-filled` is CORRECT — do not tune it

Measured with `local-audit.cjs:653`'s exact arithmetic (W=270 H=480, rows
y=155..335, a row counts at ≥3 of 270 px with luma < 235, best of the 62% and 90%
sample points):

| group | frames | mean | p10 | below 15% |
|---|---|---|---|---|
| ch-05 Broadsheet (3 refs) | 27 | 99.3% | 100.0% | 0/27 |
| ch-10 Margin Note | 8 | 94.9% | 80.0% | 0/8 |
| ch-06 Archive Room | 9 | 100.0% | 100.0% | 0/9 |
| ch-08 Ledger | 9 | 100.0% | 100.0% | 0/9 |
| ch-02 Legal Brief (control) | 9 | 73.9% | 33.3% | 0/9 |

53 of 53 reference frames clear the floor, and the built-channel control clears it
with the least margin — which is why 15% is defensible. The planned per-channel
`middle_zone_floor` **must not be implemented**: it would lower the bar for
styles that do not need lowering and hide a real defect. ch-05's render at
13–14% is genuinely wrong; the reference is 95–100% filled.

Likely cause, not yet confirmed: ch-05's spec carries no middle-zone guidance
and its `core_objects` are collage nouns (masthead rule, column gutter) that the
director may be drawing as rules and type only, leaving the middle third bare.

### 2. `canvas_accent` is missing from all four new channels — actionable now

`canvas_accent` exists on 3 of the 6 built channels (ch-01, ch-02, ch-09 — all
full-canvas). All four new entries omit it, so ch-10 fails `canvas-accent`
outright. The palette-consistent values already exist as each channel's
`colors.accent`:

| channel | `colors.accent` | proposed `canvas_accent` |
|---|---|---|
| ch-05 | `#2B2B2B` | `#2B2B2B` |
| ch-06 | `#D8D8D8` | `#D8D8D8` |
| ch-08 | `#8C5A3C` | `#8C5A3C` |
| ch-10 | `#1A1A1A` | `#1A1A1A` |

NOT APPLIED, deliberately. `config/channels.json` cannot be round-tripped (it
stores mojibake — an em dash as the six escape characters `\u00e2\u20ac\u201d` —
so `JSON.parse` → `JSON.stringify` rewrites seven existing lines), and four
byte-splice attempts failed before one succeeded. A fifth splice should not be
attempted without budget to verify it. The byte-splice recipe that worked is in
`EXPANSION-METHOD.md` §6.

### 3. ch-06 and ch-08 share a second failure — beat check

Both fail the frame↔sentence beat check with the same signature: **TYPE beats
whose description "did not name a buildable element"** — ch-08 beats 2, 3, 4 and
5; ch-06 beats 1, 2 and 5. The director fell back to TYPE and then could not
build what it wrote. This is the same class as the ch-02 finding: a fallback that
reads as a pass. Both channels' specs list `core_objects` as collage nouns
(clipped photograph, year marker, terminal line) rather than buildable primitives,
so the director has nothing to compose with and degrades to prose.

## Next actions

1. Add `canvas_accent` to the four new channels via byte splice (values above).
2. Compare a ch-05 TYPE-SPLIT beat against its reference frame at the same
   timestamp, before changing the spec or the check.
3. Give ch-06 and ch-08 `core_objects` that map to buildable primitives, or
   accept that archival/timeline styles need compositions the director cannot yet
   produce.
4. Layer 2 / Layer 3 first CI execution — still owed on whichever channel clears
   Layer 1 first.

## Known gaps carried forward

- Layer 2 and Layer 3 have never run in CI, on any channel.
- The eval loop's beat-index resolver gap is unfixed: Gemini returns MM:SS, not
  `beat_index`, and `resolveRevisions` requires an integer. Hit on the local ch-2
  dry run; untested in production.
- `config/channels.json` mojibake, unfixed by instruction.
- `type: choice` workflow inputs do not dispatch; `type: string` is used and
  `evalLoopMode()` validates instead.
- Dispatch expansion channels **one at a time** — the concurrency group
  serialises runs.