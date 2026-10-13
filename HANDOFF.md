# HANDOFF

Written at the context limit of the session on 2026-10-13. Read this first.

## Hash at stop
`HEAD == origin/main == 6e98fccd`, tree clean, both directions empty.

Nothing was pushed this session. No code was changed. The session ended on a
diagnosis that disproved the fix in `0472a56b`.

## Green channels
**None.** Zero of the ten priority channels are in `data/renders/approved/`.
No videos to link.

## What is actually broken

### ch-26 map key — the fix on main does NOT work. Frame pasted, below.

Run `38369941305`, rendered frame `beat0.png`. The log names the beat:

```
[ladder] ch-26 beat 0: names "Texas federal court, $91 million" -> a key on the Texas map that covers it
```

The frame's bottom-left reads **`s federal court, $91 million`**. "Texa" is cut.

`0472a56b` ("measure the map key instead of guessing its width") fixed the
WIDTH estimation and the key is **still clipped**, so width was never the cause.

### The correction to last round's diagnosis

The brief said to clamp the plate because `bounds.x + 22` puts it off-frame.
**That is wrong, and the clamp would be a no-op.** Verified:

- `canvas-layout.js:1393` — `boxes.map = box(0, LOW_VISUAL.top, FRAME.w, LOW_VISUAL.h)`
- `canvas-layout.js:1403` — `boxes.map = box(0, BODY_TOP, FRAME.w, BOTTOM - BODY_TOP)`

So **`bounds.x` is 0**. The plate is at x=22, the text at x=32. That is inside
the frame (1080 wide) and only just left of `L_EDGE = 48`. Nothing is placed
off-frame.

Where to look instead, in order:

1. **Z-order.** The key is drawn inside `CenteredMap`'s `<svg>`, which sits
   under the `HeroEl name="map"` content. The plate outline is not visible at
   all in the frame — only its text — which suggests the map is painting over
   the plate, not the plate being clipped.
2. **The vertical `clipPath` in `MapCentered`:**
   `clipPath: inset(${Math.max(0, B.map.y)}px 0 ${Math.max(0, FRAME.h - B.map.y - B.map.h)}px 0)`
   The key is placed at `by = bounds.y + bounds.h - 40 - boxH`, i.e. hard against
   the map's bottom edge, exactly where that band ends. Check whether the key
   lands on the clip boundary.
3. In the frame the key's baseline sits right at the map's lower edge, and the
   text appears cut at the image's left margin (x≈0) while `L_EDGE` is 48. That
   is consistent with the text being drawn somewhere other than x=32 — worth
   printing `bounds` and the computed `by`/`bx` at render time rather than
   inferring them.

### The check also missed it

The naming check **passed** a frame containing a truncated entity name. It
caught `"stralia"` and `".ustralia"` in board `38330253047` but passed
`"s federal court"`. That is a gap in `namingCheck()` / `settleNaming` and is
arguably the more important defect: a check that passed a visibly clipped name
is worse than one that failed a good frame.

### ch-26 has a second, independent failure

The video was queued **rejected** at a different gate — the narration judge:

```
[narration listener] ::error::narration judge: 7/7 sentence(s) read as synthetic or flat on the median of 1 readings (0, 1, 2, 3, 4, 5, 6)
```

`local-audit` passed 29/29, so this is a script-quality gate, not a rendering
one. It is content, not code — but it blocks ch-26 independently of the map key.

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