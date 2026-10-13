# FIXES.md

Working list of causes, grouped by cause and ranked by how many channels each
one blocks. Phase A: see the whole system, fix nothing. Phase B: work the list.

## Board

**Run `38393719519`** — all ten priority channels, `dry_run=true`, HEAD `2744f143`.

Channels: `1,2,5,6,8,9,10,26,44,49`.

### The headline

**The dominant blocker is not rendering. It is script and plan quality.**

Five of ten channels were stopped before or during planning, by three checks that
all read the same thing — *does this text say what the sentence says*:

| Gate | Channels | What it said |
|---|---|---|
| claims (prep) | 1 | sentence 6 attributes "suggests paying off debt" to the Gerald Financial Research Team; the research says they noted repayment plans fail, not that they suggest this |
| narration judge | 44 | 8/8 sentences read as synthetic or flat |
| challenger | 9, 49 | beat 4 CONTRADICTION / beat 0 CONTRADICTION — the visual contradicts the sentence |

Plus two channels skipped in prep and two cancelled mid-prep.

Two channels reached **`approved-review`** (26, 44) — the furthest anything has
got. **Zero reached `approved`.**

## Causes, ranked by channels affected

### 1. Script writer asserts claims the research does not state — 4 channels
**Channels** 1, 8, 26, 44 · **Gate** prep `claims` (`scripts/validate-script-claims.cjs`)

The gate is **right** and must not be weakened. Every failure is the same shape:
an attribution or an imperative that nobody sourced.

- ch-1: "…before the Gerald Financial Research Team **suggests paying off debt**."
  The research states they noted repayment plans fail.
- ch-8, ch-26 (earlier runs): closing imperatives — "Apply these Harvard
  strategies to your next deal."
- ch-44 (earlier): same imperative shape.

**Class-level fix:** `prompts/write-script.md`. **DONE** — see below.

**Status:** fixed, **unrendered**.

### 1b. The brief was instructing the writer to produce this failure — CLOSED

Read in full, the defect is in the brief itself, not the writer's obedience.

**The close.** The brief said:

> `CLOSE (section close, ONE sentence, 7–11 words). What the viewer does with what
> they now know — a specific action`

That orders an imperative addressed to the viewer. The writer complied and produced
*"Apply these Harvard strategies to your next deal."* (ch-8, ch-26), which the
claims gate correctly called INVENTED. Research reports what happened, not what the
viewer should do about it.

**Attribution, which was absent entirely.** No rule anywhere about attributing a
verb to a source. ch-1's *"the Gerald Financial Research Team **suggests paying
off debt**"* — the research said they noted repayment plans **fail**. This is the
most common way the pipeline loses a channel and nothing warned about it.

Changed in `prompts/write-script.md`:
- A close is a **fact or an echo, never an instruction**, with the exact failing
  imperative named as banned.
- A new **ATTRIBUTION** section: the verb must be one the research uses of *that*
  source; "suggest / recommend / advise / warn / urge / call for" are the ones
  that get scripts skipped; never invent a team, desk or body.
- Two pre-return sweeps, **ATTRIBUTION SWEEP** and **IMPERATIVE SWEEP**.

`scripts/__tests__/script-brief-grounding.test.js` (9 tests) pins the brief using
ch-1's real rejected sentence, asserts the claims gate still reports INVENTED, and
asserts the grounding rules that already worked were not gutted. Suite 790/0.

**Not yet seen on a board.** The next full board is the test.

### 2. Plans that contradict their own sentence — 4 channels
**Channels** 9, 49, 2, 6 · **Gate** challenger

The challenger reads the plan against the sentence and rejects a visual that
misstates it.

- ch-9: beat 4 CONTRADICTION
- ch-49: beat 0 CONTRADICTION
- ch-2: beat 1 — "2026" is the hero figure, the sentence is about "30 cases"
- ch-6: beat 3 — "19" is arbitrary

**Class-level fix:** the hero figure must be the figure the sentence is *about*.
`7ea8a1e6` covers the total/component case (`statedTotalOf`); it does **not**
cover a beat whose hero is simply the wrong number from the same sentence. That
gap is the class. Same file: `scripts/entity-coverage.js` / the planner's figure
choice.

**Status:** open, partial (totals done).

### 3. Beat draws the wrong entity class — 3 channels
**Channels** 10, 44, 2 · **Gate** canvas `entity-coverage`

- ch-10 beat 2: names persons "Philip Goff", "William Seager" and organization
  "Stanford Encyclopedia" — **draws `plate-place`**, none of it the entity. The
  rung was assigned to the wrong entity type.
- ch-44 (earlier): organization "Starbucks" — draws a chart, not the org.
- ch-2 (earlier): place "Paris" — draws logo + date.

**Class-level fix:** the ladder picks a rung; `coverageOf()` matches a rung to an
entity type. A rung drawn for the wrong type is read as *nothing covered*. The
diagnostic to keep asking: **is the check reading the drawn rung or the entity's
type?** When they disagree, the check is reading a proxy. `plates-row-kinds.test.js`
already pins part of this invariant.

**Status:** open.

### 4. Script reads synthetic or flat to the narration judge — 2 channels
**Channels** 44, 26 (earlier 7/7) · **Gate** narration listener

**Class-level fix:** `prompts/write-script.md` — the same file as cause 1. Worth
doing together: one rewrite of the script brief should address both, since the
claims failures and the flat-writing failures are the same over-writing.

**Status:** open.

### 5. Text laid out taller than its box — 1 observed, class-wide
**Channels** 49 ("Mommy") · **Gate** naming-check

`fitText` / `fitHeadline` returned a fit taller than `maxLines`; the box clipped
the tail. Fixed in `67d17bb3` — **never rendered**. Class-wide by construction:
every stat card label and headline goes through these.

**Status:** fixed, **unverified**.

### 6. Plates row: entries collide, and marks break the palette — 1 observed, class-wide
**Channels** 26 · **Gate** naming-check, flat-look

- `AlexanderConner`: `MarkPlate` sized its text `W = side * 1.6` at a negative
  offset, so every row entry overflowed its slot and neighbours touched.
  Fixed `73ab2fba` — **unverified**.
- SEC seal in full colour: 0.97% of the frame off-palette against a 0.4% limit.
  Fixed `68d3c086` (desaturate marks drawn in a row) — **unverified**. The gate's
  `OFF_SHARE_MAX = 0.004` is unchanged and a test pins it.

**Status:** fixed, **unverified**.

### 7. Map key walks off-frame under the map's grow scale — 1 observed
**Channels** 26 · **Gate** naming-check

`MapCentered` scales the map about its centre by up to 1.08, which moved the key
from x=32 to x=−8.6. Fixed `70dcbd7c`. Verified only indirectly — the map-key beat
passed the naming check, which reads real frames. No still of that beat exists.

**Status:** fixed, **indirect verification**.

### 8. Unit dropped from a number — 1 observed, class-wide
**Channels** 5 · **Gate** naming-check

`canvas-layout.js:1108` puts the scale word in the **label block**, which pops in
after the number, so a frame sampled early shows `$672` with no unit.
**Not seen in this board** (ch-5's render was cancelled).

**Status:** diagnosed, open.

### 9–11. Single observed each, open
- **flat-look rounded corners on a flag** — ch-1 (earlier run). MarkPlate draws
  `rx={2}`; the reference's components have sharp corners.
- **grid off-axis + composition empty at a boundary frame** — ch-6 (earlier).
  TYPE-CHAPTER centred at x 585 against 540 ± 40; `pop-transitions` found frame 10 empty.
- **photo beats with no real camera move** — ch-9 (earlier). 2/3 photo beats.

## Instance-only

None confirmed. Every cause above is in shared code (`prompts/write-script.md`,
`scripts/entity-coverage.js`, `scripts/lib/flat-look.cjs`, the fitters, the plates
row, `MapCentered`). The per-beat symptoms are instances of those classes.

## Method notes
- Causes 1–4 are all *"the text does not say what the sentence says"*, seen by
  three different checks. That is one theme with four faces, and the script brief
  is the highest-leverage single file in the system.
- Three wrong fixes this project (`length * 15` width, `bounds.x + 22` clamp, an
  unverified scope change) were all caught by rendering. Read the manifest and the
  frame first.
- When a channel re-picks a topic between runs, the previous fix is usually **not
  exercised** and a passing gate means nothing.