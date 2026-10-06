# Channel expansion handoff — fleet run

## §3.0 answered the question it was built to answer

Fleet run `37540546857`, `channels=1,2,5,6,8,9,10,26,44,49`, one matrix.

**The BUILD GATE PASSED for all ten.** `setup` succeeded, and all ten `prep`
jobs succeeded. That is the outcome §3.0 was testing: the pipeline accepts the
whole registered fleet. The ch-5/6/8/10 rejections that blocked the previous
attempt are gone since `cf16b9d`, and nothing in the matrix path objects to
four new channels.

Render results at the time of writing (run still in progress; logs are not
readable until it completes):

| channel | render |
|---|---|
| ch-1 | failure |
| ch-5 | failure |
| ch-6 | failure |
| ch-8 | failure |
| ch-9 | failure |
| ch-10 | failure |
| ch-2, ch-26, ch-44, ch-49 | still running |

**ch-1 failed too.** That is the most important line in this table: a built
channel with shipped videos failed in the same run as the four new ones. The
fleet is not four new channels hitting a new wall — it is the whole fleet
failing together, which points at something shared (a gate, a quota wall, a
shared dependency) rather than at the new channels' specs.

Do not read the four new channels' failures as their own problem until ch-1's
failure reason is read and compared.

## §1 landed

`6da8809` — `middle-zone-filled` is advisory: it still measures and reports the
fill value, now carrying `advisory: true, pass: true`, with
`[ADVISORY - not gating]` appended when it fires. `frames-nonempty` and
`pop-transitions` stay hard, as do `canvas-fit`, `canvas-coverage`,
`canvas-accent`, `canvas-type`, `canvas-ground`, `zones-no-overlap`,
`motion-tiers`, `kinetic-rules`. Suite 192/192.

**The fleet run was dispatched BEFORE this landed**, so ch-5's result in it
reflects the old gating. ch-5 must be re-run to see whether the advisory
change lets it reach Layer 3.

## Pending, in order

1. **Read `37540546857` logs** once complete — especially ch-1's. Then compare
   ch-5/6/8/10 against it. This is the single highest-value read available.
2. **Re-run ch-10** (`eval_loop_mode=off`, then `dry`, then `live` if dry says
   retry). ch-10 has no known unresolved failure after `436d321` fixed
   `canvas_accent`, so it is the cheapest test of "does a new channel work end
   to end".
3. **Re-run ch-05** after the advisory change. Report whether Layer 3 accepts or
   flags the sparse TYPE-SPLIT beats. That answer settles whether the density
   check was wrong for this style or the render is.
4. **ch-06 / ch-08 TYPE-fallback** — undiagnosed. The beat-check failures name
   TYPE beats whose description "did not name a buildable element". `core_objects`
   was ruled out as the cause (`SPEC-AUDIT.md`): ch-01 resolves 0/6 against the
   object registry and renders fine. Look at what the director's strategy map
   does with a channel it does not recognise.

## Still open

- Layer 2 and Layer 3 have never run in CI on any channel.
- The eval loop's beat-index resolver gap: Gemini returns MM:SS, not
  `beat_index`; `resolveRevisions` requires an integer. Unfixed, untested.
- `config/channels.json` mojibake, unfixed by instruction.
- Dispatch one channel at a time, or use a single fleet matrix — never parallel
  dispatches. The concurrency group serialises them.
- Do not merge `RUN-NOTES.md` / `SPEC-AUDIT.md` into `EXPANSION-METHOD.md` in the
  same push as a run; deferred to housekeeping.