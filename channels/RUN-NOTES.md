---

## 10. What the first real run added (2026-10-06)

Three constraints surfaced only by dispatching, none guessable from config.

**A registered channel is not a running channel.** Two gates, in order:
`config/priority-channels.json` (approved to publish) is checked by the
workflow's setup step, and then the render must pass Layer 1. Every channel here
cleared the first gate once approved, and then met the second.

**Layer 1's `middle-zone-filled` is the first real gate a new channel meets.**
ch-05 rendered 9 beats and failed on beats 3 and 5, both TYPE-SPLIT
compositions, at 13% and 14% filled against a 15% floor. Every other check
passed: `canvas-fit` (safe area, no text overlap, caption band clear),
`canvas-coverage` (min 61% of frame height), `canvas-type`, `canvas-ground`,
`zones-no-overlap`. So a new channel's first failure is very likely to be
**content density in one composition**, not layout or palette. That belongs in
how the next batch of specs is written: the ground and grid in these specs do not
by themselves fill the middle zone on a TYPE-SPLIT beat.

**`type: choice` workflow inputs do not dispatch.** GitHub's dispatch API
rejected the input's own default:

```
HTTP 422: Provided value 'off' for input 'eval_loop_mode' not in the list of
allowed values
```

Both the block-sequence and the inline `options:` form were tried, and
dispatching WITHOUT the parameter failed identically, because GitHub substitutes
the default and validates that too. `type: string` dispatches fine. Strictness
was not lost: `evalLoopMode()` returns `off` for an empty or missing value,
accepts off/dry/live case-insensitively, and throws on anything else, with all
four behaviours asserted in `scripts/__tests__/eval-loop-modes.test.js`.

**Concurrency serialises dispatch runs.** The workflow's concurrency group
(`daily-pipeline-${{ github.ref }}`, `cancel-in-progress: false`) means four
channels dispatched together queue up and compete for runner capacity: one ch-08
run came back `cancelled`, and one ch-06 render job exited 143 (SIGTERM) with no
check output rather than a verdict. **Dispatch expansion channels one at a time**
and read each result before starting the next.