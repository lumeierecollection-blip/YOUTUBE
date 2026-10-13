# HANDOFF

Read this first, then `FIXES.md` (the grouped, ranked list of causes).

## Hash at stop
`HEAD == origin/main == 7e9b5915`, tree clean, both directions empty.
Nothing is left in flight. Suite 794/0.

## Green channels
**None.** `Approved: 0` on all channels tested. `data/renders/approved/` is still
empty on origin/main — no video has ever entered any queue. No videos to link.

## VERIFIED: the rung↔type fix (`7c10463d`)

Run `38455737336`, channels 8, 10, 44. **The fix worked and is closed.**

| Channel | Before | After |
|---|---|---|
| 8 | `entity-coverage — beat 3: date "June 25" — draws figure` | **passed it**; now `approved-review`, stopped at challenger beat 0 CONTRADICTION |
| 44 | `entity-coverage — beat 1: org "Google Scholar" — draws plate-place` | **passed it**; now `approved-review`, stopped at naming-check beat 2 |
| 10 | `entity-coverage — beat 6: org "IdeaLens" — draws plate-place` | the organization is **no longer in the failure**; only a date remains |

Both `plate-place`-for-an-organization failures are gone. Two of three channels
moved from killed to `approved-review`.

The cause was the ladder's own anti-doubling fallback from `6e36891b`, which
hardcoded `kind: "plate-place"` for `row[0]` — the first uncovered entity, often an
organization. It now uses `kinds[0]`, the rung already computed for that entity's
type. `coverageOf()` was not loosened: the frame really was showing a place where
the sentence named a company, so the gate was right and the source was wrong.

## NEXT CAUSE — a date with no YEAR can never be covered (2 channels, one line)

ch-8 (before the fix) and ch-10 (still) fail the same way:

```
[canvas] FAIL entity-coverage — beat 2: date "November 12" — draws figure, none of it the entity
```

`scripts/entity-coverage.js:140`:

```js
} else if (e.type === "date") {
  const y = (e.name.match(/(?:1[89]|20)\d{2}/) || [])[0];
  if (d.kind === "figure" && y && String(d.text).includes(y)) return hit(d, "date card");
  if (d.kind === "chart" && y && d.data && d.data.includes(y)) return hit(d, "timeline");
```

`y` is **required**. "November 12" and "June 25" carry no year, so `y` is
`undefined`, both guards fail, and a date that IS on screen is reported as not on
screen. The frame draws the date; the check cannot see it because it only knows how
to look for a four-digit year.

This is the same family as the rung fix — a check reading a narrower shape than the
artifact. **Class-level fix:** when the entity carries no year, match the figure or
chart against the date's own month/day text instead of giving up. Do NOT simply drop
the guard — "November 12" drawn next to a figure about something else must still
fail. Re-run **8, 10** after.

## Remaining list (`FIXES.md`)
- **Plan contradicts its sentence** — challenger beat MISMATCH/CONTRADICTION. Now
  ch-8 beat 0 and ch-44 beat 5, plus ch-9 and ch-49 in the last board. 4 channels.
- **naming-check** — ch-44 beat 2. Cause 5 (`67d17bb3`) and causes 6/7
  (`73ab2fba`, `68d3c086`, `70dcbd7c`) are fixed but still unrendered.
- **ch-2**: `canvas-type` — TYPE-FULL+NAME twice in a row.
- **Cause 8** (unit dropped from a number) diagnosed, open.
- Causes 9–11 (rounded flag corners / grid off-axis / no camera move) open.

## Cron
**OFF.** The bar set this session was "any channel reaches `approved/`". Every run
has produced `Approved: 0`, so the condition is not met. Two channels now reach
`approved-review` — closer, but `approved-review` is not `approved`. When one lands
in `approved/`, uncomment the `schedule:` block at `daily-pipeline-v2.yml` lines
22–24.

## Method
- The ladder↔coverage "invariant" was **not** broken where it was assumed to be.
  `directiveFor()` and `coverageOf()` agreed for every type; the wrong rung came
  from a different writer. Grepping who writes `art.kind` found it in one pass.
- A green suite is not a frame. But a real case fixture is a good test: tests built
  from ch-10 and ch-44's actual beats passed, while my invented generalizations
  failed and were dropped rather than adjusted to pass.
- When a channel re-picks a topic between runs, the previous fix is usually **not
  exercised** and a passing gate means nothing.

## VERIFIED THIS SESSION: the claims-gate topic re-pick works

Run `38388968513`, ch-26. The re-pick added in `4541caa2` fired exactly as
designed:

```
[script] ch-26: claims gate held after the re-ask — re-picking a topic:
  vanguard-jv-cash-program-ponzi-sec-judgment -> empire-market-operator-40-years-prison
```

The replacement topic was then researched and scripted, and it ALSO failed the
claims gate, so the channel was skipped — which is the "once only" rule working
as written: two ungroundable topics in a row is a content problem, not something
to retry forever. This was the one previously-unverified fix that has now been
seen to work in a real run.

## ch-26 is currently CONTENT-BLOCKED, not code-blocked

The claims gate rejected two consecutive topics' scripts. The gate is right: an
unsourced imperative like the earlier "Apply these Harvard strategies to your
next deal" must not be spoken as fact. Not fixable in code without loosening it.

To clear ch-26, the next step is **option (b)** from the original brief, which was
held in reserve: constrain the script writer so a closing imperative must trace to
research. `prompts/write-script.md` is where that belongs. Do NOT weaken
`scripts/validate-script-claims.cjs`.

## NOT VERIFIED: the plates-row palette fix

`68d3c086` — a mark drawn inside a plates row is desaturated into the channel
palette (the SEC seal went from full colour to neutral). This run produced **no
render**, because prep skipped the channel, so the fix has never been exercised.
Suite 781/0 and a test pins that `OFF_SHARE_MAX = 0.004` has not moved, but that
is not a frame.

It needs a run where ch-26 actually renders a beat with a verified mark in a
plates row. Given ch-26 is content-blocked right now, the cheaper place to verify
it may be **another channel that uses plates rows** — ch-2, ch-10 or ch-44 all
do, and they are blocked on different gates anyway.

## Still queued
1. **ch-49** — `67d17bb3` on main, **still never rendered**. Cheapest win
   available: dispatch it alone and look for "Mommy".
2. **ch-5** — the unit rides a separate label element that pops in after the
   number; it must live in the number's own slots.
3. **ch-26** — the plates-palette fix (above), then the script-writer constraint.
4. ch-1, 2, 6, 8, 9, 10, 44 per the table below.

## Read the artifact, not the hypothesis
Every fix that worked came from the **rendered manifest** or the **frame** in one
step: `boxes.map` gave `bounds.x = 0`; `canvas.art` gave the plates row
`["SEC","Alexander","Conner"]`; the beat-0 still showed the coloured seal. Every
fix that was wrong came from a log line or a guess — the `length * 15` width
theory, the `bounds.x + 22` clamp.

And: when the channel re-picks a topic between runs, the previous fix is usually
**not exercised** and a passing gate means nothing. Confirm the beat you fixed is
the beat the run drew before recording anything as verified.

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