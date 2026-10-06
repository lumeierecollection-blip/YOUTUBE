# Channel expansion handoff — spec audit result

## §2 was NOT applied. The audit overturned its premise.

**`ADDRESSABLE_ELEMENTS` is the wrong vocabulary.** It lives in
`scripts/beat-element-remediation.js` and is the set of *plan fields a partial
re-render may revise* (visual_type, kind, headline, lead_in, data, ground,
composition, motion_tier, camera_focus, named_entities). It is not a build
vocabulary. `photo` and `data` as `core_objects` would name plan fields, not
drawings — applying §2 as written would have made the specs worse.

**The build vocabulary is the object registry**:
`src/skills/remotion-render/compositions/objects/` — `library.jsx`, `maps.jsx`,
`nature.jsx` calling `registerObject()`, **105 registered drawings**.

### Audit of `core_objects` against the registry

| channel | registered | no drawing |
|---|---|---|
| ch-05 Broadsheet | 0/5 | clipped photograph, newsprint column, masthead rule, pull quote, column gutter |
| ch-06 Archive Room | 1/5 | film-grain plate, letterbox matte, era caption, film reel mark (`archival photograph` resolves) |
| ch-08 Ledger | 0/5 | year marker, progress rail, terminal line, verdict label, stepped card |
| ch-10 Margin Note | 0/5 | art photograph, margin rule, definition line, margin note, plate caption |

19 of 20 unresolved — which looked like the explanation for ch-06/ch-08's
TYPE-fallback beats and ch-05's density failure.

### The built channels say the same thing, and they render fine

| built channel | registered |
|---|---|
| **ch-01 Money Mind** | **0/6** — data visualization, number display, text overlay, progress bar, comparison graphic, animated typography |
| ch-09 Border Lines | 2/6 |
| ch-02 Legal Brief | 4/6 |
| ch-26 | 5/6 |
| ch-44 Skill Stack | 6/6 |
| ch-48 Fit | 6/6 |

**ch-01 resolves 0 of 6 and ships videos every day.** So unresolved
`core_objects` is not a defect at all — descriptive nouns are the intended
convention, and the director resolves them through the visual-identity
`strategies.js` / composition vocabulary, not by drawing lookup.

**Therefore the ch-06/ch-08 TYPE-fallback has a different cause**, and the ch-05
density failure is likewise unexplained by `core_objects`. No spec was changed.

## What DID land

`436d321` — `canvas_accent` added to all four new entries, byte-spliced, 4
additions / 0 deletions. This was ch-10's actual Layer 1 failure and it is
genuinely a missing config field, present on 3 of 6 built channels and absent
from all four new ones.

## What still needs a real diagnosis

1. **ch-06 / ch-08 beat check** — TYPE beats where "description did not name a
   buildable element". ch-06 beats 1, 2, 5; ch-08 beats 2–5. The director falls
   back to TYPE and then cannot build what it wrote. Since `core_objects` is not
   the cause, look at what the **visual director prompt** is told for these
   channels, and at whether ch-06/ch-08 `style` values
   (`cinematic-documentary`, `motion-graphics`) route to a director path built
   for the six originals.
2. **ch-05 density** — beats 3 and 5 TYPE-SPLIT at 13%/14% while all three
   references measure 95–100% in the same band. The check is correct. Compare a
   rendered TYPE-SPLIT beat against a reference TYPE-SPLIT frame before
   theorising.
3. **Re-run all four** once 1 and 2 have answers.

## Method correction for the next expansion

`EXPANSION-METHOD.md` §3 says a cluster is rejected when it "duplicates a built
channel's grammar". The real grammar check is not `core_objects` — every channel
including ch-01 uses descriptive nouns there. The discriminating fields are
`style`, `bg_mode`, `transition_language` and `environment_type`, which do
differ between channels. Do not add a `core_objects`-must-be-buildable rule; the
data says it would be wrong.