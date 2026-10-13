# HANDOFF

Written at the context limit of the session on 2026-10-13. Read this first.

## Hash at stop
`HEAD == origin/main == 70dcbd7c`, tree clean, both directions empty.

Nothing is left in flight.

## Green channels
**None.** Zero of the ten priority channels are in `data/renders/approved/`.
No videos to link.

ch-26 is in `approved-review` (was `rejected` two runs ago) — one step up, but
still not green.

## THE MAP KEY — fixed, and the frame settles it

Run `38376666510`. The real cause, finally:

`MapCentered` wraps the entire map svg in a grow transform
(`full-canvas.jsx:1242`):

```jsx
transformOrigin: `${B.map.x + B.map.w / 2}px ${B.map.y + B.map.h / 2}px`,
transform: `scale(${(1 + grow(local, dur, fps, 0.08)).toFixed(4)})`
```

so a point `x` lands at `cx + (x - cx) * s`. With `cx = 540` and `s` up to
`1.08`, the key at `x = 32` lands at **-8.6 px** — off the frame. The plate was
never off-frame before the transform; **the transform moved it off-frame.**

Two earlier diagnoses were wrong and are recorded so they are not retried:

1. `0472a56b` — "the text overflows its plate". False. Width was never the cause.
2. "clamp to the frame because `bounds.x + 22` is off-frame". Also false. The
   manifest says `boxes.map = { x: 0, y: 640, w: 1080, h: 470 }`; `bounds.x` is
   0 and `x = 22` is well inside a 1080-wide frame.

Fixed in `70dcbd7c`: the key now solves for the position that lands inside the
frame's safe area **after** the scale, and `MapCentered` passes the live scale
in. Both edges solved. `scripts/__tests__/map-key-frame-clamp.test.js` asserts
the OLD placement still lands off-frame, so the test cannot silently stop
testing anything.

**Evidence:** the map-key beat (beat 7, labels "Robert Welsh, U.S. District
Court for the Eastern District of Texas") passed the naming check on
`38376666510`: `[naming-check] beat 7: PASS`.

**Caveat, stated plainly:** the artifacts for that run contain `beat0.png` and
`look-beat-{1,2,5,6,8}.png` — **there is no still of beat 7**, so this fix is
supported by the naming check reading real frames, not by a frame I can paste.
If you want the picture, render beat 7 to a still.

## NEXT FAILURE: ch-26 beat 8 — two words collided

This is what stopped ch-26 on `38376666510`:

```
[naming-check] ::error::naming check failed: 1/9 beats misname an entity (beats 8)
```

Frame pasted in the session transcript (`look-beat-8.png`). It renders:

**`AlexanderConner`**

— two words with no gap between them, on a NAME-LOGO composition beside an SEC
seal. This is **not** a clip: nothing is cut off. The two words are placed as
though they were one, so the on-screen name is a different string from the one
in the sentence.

Where to look: the NAME-LOGO / name-plate path that lays a name out beside a
mark, not `fitText`/`fitHeadline` (which are about wrapping and were fixed in
`67d17bb3`) and not the map key. Suspect either a missing separator in the
source string before layout, or a gap/track computation that collapses to zero
at this size. Print the laid-out name string and the computed gap before
changing anything.

Also note: local-audit passed **29/29** on this video while naming failed it, so
the pixel checks did not catch a name rendered as one word.

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