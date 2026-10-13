# HANDOFF

Written at the context limit of the session on 2026-10-13. Read this first.

## Hash at stop
`HEAD == origin/main == dbe5de52`, tree clean, both directions empty.

Nothing is left in flight. No code changed this session — it ended on a
diagnosis with a frame, before a change that could not be render-verified.

## Green channels
**None.** Zero of the ten priority channels are in `data/renders/approved/`.
No videos to link.

## NEXT FAILURE: ch-26 beat 0 — off-palette colour (frame pasted)

Run `38380216978`:

```
[canvas] FAIL flat-look — beat 0 (ENTITY-ART plates): 0.97% of the frame is a
colour that is neither ink, neutral nor the accent #6B2A6B (max 0.4%) — a palette
the reference does not use
```

`local-audit` FAIL (28/29). ch-26: Rejected.

The frame (`beat0.png`, pasted in the session transcript) shows exactly what it
is: the **SEC seal in full colour** — gold ring, navy field, red-and-white
stripes — standing on an otherwise ink/neutral/accent frame. The seal is a
verified public-domain mark, so the asset is legitimate; the problem is purely
that its palette is not the channel's.

**Do NOT loosen the 0.4% limit.** The gate is right.

This is a genuine design decision with two defensible answers, and it is not
mine to make unilaterally from a frame:

**(a) Bring the mark into the palette.** Desaturate verified marks toward the
channel's ink. The SEC seal stays real and recognisable, and it is how the rest
of the system treats imagery. Cost: it is a visual change on a widely-used path,
so it needs a render to confirm it does not wash out other channels' marks.

**(b) Fall back to the name in type.** `MarkPlate` already draws a name in type
when there is no usable asset, and the repo treats a typographic treatment as an
honest stand-in (it explicitly rejects monograms because "initials of a name are
text nobody wrote"). Cost: the entity is named but no longer depicted, which
weakens the two-visual rule for a mark we actually have.

**Recommendation: (a)**, scoped to the plates-row path where verified marks are
drawn, so other render paths are untouched. Then render and look.

Note there is no precedent in the codebase: `composition.js:317` sets
`FLAT: { saturate: 1 }`, i.e. full colour is currently the intended treatment,
which is why this has never come up before.

## Read the artifact, not the hypothesis
Every fix that worked this session came from the **rendered manifest** or the
**frame** in one step: `boxes.map` gave `bounds.x = 0`; `canvas.art` gave the
plates row `["SEC","Alexander","Conner"]`; the beat-0 still shows the coloured
seal. Every fix that was wrong came from a log line or a guess — the
`length * 15` width theory, the `bounds.x + 22` clamp. Read the artifact first.

Also: when the channel re-picks a topic between runs, the previous fix is
usually **not exercised**, and a passing gate means nothing. Confirm the beat
you fixed is the beat the run drew before recording anything as verified.

## Next in line, with diagnosis so far

### 2. ch-49 — fix on main, never rendered

`67d17bb3` — `fitText` (`canvas-layout.js`) and `fitHeadline`
(`typography.js`) now step below their floor to `MIN_FIT_FLOOR = 10` instead of
returning a fit taller than `maxLines`, which was clipping the tail off.
Six tests pass (`scripts/__tests__/fit-inside-the-box.test.js`), suite 763/0.

**Unverified.** Dispatch ch-49 alone. The string to look for on the frame is
"Mommy" — it was missing from the stat-card label
"27.5 million dollar opening of Other Mommy".

### 3. ch-5 — diagnosed, not started

`numberParts("$672 million")` parses correctly and returns
`scaleWord: "million"`. The unit is lost at draw time, not parse time.

- `canvas-layout.js:1108` puts the scale word in the **label block**:
  `const label = parts.scaleWord && lab.toLowerCase().startsWith(parts.scaleWord) ? lab : [parts.scaleWord, lab].filter(Boolean).join(" ");`
- `numberSlots(parts, s)` only emits `parts.suffix` — the *letter* form (M/B/K),
  which is empty for a spelled-out "million".

So the figure draws as `$672` and the unit rides a separate element that
`[motion] ... label pops after`. A frame sampled before the label lands shows
the number with no unit. The naming check saw exactly that: first look `$672`,
second look `$672 MILLION ASSETS GO`.

The unit must live inside the number's own slots so it cannot be absent from any
frame. **This is a change to the most-looked-at element on screen** — do not
push it unrendered.

## Other open failures from board `38330253047` (not yet worked)

| Channel | Gate | Detail |
|---|---|---|
| ch-1 | canvas `flat-look` | beat 4 ENTITY-ART flag: 2 corners rounded, reference is sharp |
| ch-2 | challenger ×2 | beat 1 CONTRADICTION — "2026" is hero, sentence says "30 cases"; beat 3 "19" arbitrary. Same family as the ch-6 hero-figure fix |
| ch-6 | canvas `grid` + `pop-transitions` | beat 7 TYPE-CHAPTER at x585 not 540±40; composition empty at boundary frame 10 |
| ch-8 | prep skip `claims` | should be fixed by the re-pick in `4541caa2`, **never verified** |
| ch-9 | `camera check` | 2/3 photo beats show no real camera move (beats 0, 1) |
| ch-10 | canvas `entity-coverage` | beat 6: place "Paris", draws logo + date, not Paris |
| ch-44 | canvas `entity-coverage` | beat 7: org "Starbucks", draws chart, not Starbucks |

ch-10 and ch-44 are the same class as ch-9 was: the ladder declines a second
visual on a composition that has no slot, so the entity reaches the headline only.

## Things learned this session — do not re-derive these

1. **Seven+ checks were reading a proxy, not the artifact.** The recurring
   shape: a check reads the *sentence* when the claim lives in the *beat's
   stated figure* (ch-6's "34 Total Personnel" overlay), or reads a field the
   producer never wrote. Ask "is this the real artifact?" before touching a gate.
2. **`entityLadder` copies the rung kind straight into the concept visual's
   `class`** (`render-and-qa.js:1428`). Any new rung added to
   `entity-ladder.js` without a drawing branch in `ConceptVisual` produces a box
   with nothing in it. `canvas-box-and-repeat.test.js` now asserts that
   invariant — keep it passing.
3. **Parts are a multiset.** "17 researchers and 17 crew" needs two 17s on the
   frame. Dedupe before counting and one 17 satisfies both.
4. **`fitText`/`fitHeadline` floors are band preferences, not clip licences.**
   Fixed in `67d17bb3` but unrendered.
5. **A test passing is not a frame.** Two fixes this session (`0472a56b`, and
   by extension the width theory behind it) were pushed on tests and were wrong.
   Nothing is closed without a rendered frame.
6. `gemini-files.test.js` is flaky against a live HTTP endpoint — it failed once
   with my changes present and passed immediately after. Re-run it alone before
   believing a failure.
7. `git add -A` will sweep scratch files into a commit if they exist. Delete
   scratch files *before* `git add -A`, and check `git status` after.

## Cron
**OFF** (`daily-pipeline-v2.yml` lines 22–24, commented). Nothing is green;
enabling it would only publish blocked runs. Keep it off until most channels
are green.