# Motion audit — does the object library build, or appear finished?

Measured 2026-09-24 at `87fa14d`. That is 114 drawings: the 109 audited earlier plus the 5 new map drawings.

## Method

Measured, not judged by reading the code. Every registered drawing was rendered to SVG markup (no pixels) with `react-dom/server` at `p` = 0, 0.25, 0.5, 0.75 and 1, in a 600×600 box. Map drawings were given a real region. For each drawing:

- **Ink at p=0 / ink at p=1**: the count of drawable elements that put visible ink on the frame. An element counts as invisible when its opacity is 0, it sits in a hidden group, its fill and stroke are both off, its stroke is fully dashed off, it has zero size, or it is clipped by a zero-width sweep.
- **What changes between snapshots**: the dash offset (draw-on); the element count or text (sequenced); geometry such as `d`, `x`, `width`, `r` or `transform` (transform); opacity only (fade).

**Bucket** (one per drawing):
- **Static render**: at least 80% of the final ink is already on screen at p=0. The shape arrives finished, even if one sub-part (a clock hand, a plume) moves afterwards.
- **Animated draw-on**: builds, led by strokes growing or a mask sweeping.
- **Sequenced**: builds, led by sub-elements arriving in order.
- **Transform**: builds by changing shape state.
- **Fade-only**: builds only by opacity.

Caveat: ComposedScene also fades and slides every `library_shape` in over the first 22% of the beat (`motionState`). That wrapper is the same for all drawings and is not counted here. A static drawing therefore reaches the screen as a finished picture fading in, which is what the owner saw.

## Result

| Bucket | Count | Share |
|---|---|---|
| static | 64 | 56% |
| draw-on | 13 | 11% |
| sequenced | 34 | 30% |
| transform | 1 | 1% |
| fade-only | 2 | 2% |

**64 of 114 (56%) are static renders: over 50%.** The finding stands: the library is mostly a static illustration set. Of those 64, 58 move some sub-part after arriving finished, and 6 do not change at all across the beat.

## Per drawing

| Drawing | File | Static render | Animated draw-on | Sequenced | Transform | Ink p=0 → p=1 | Bucket |
|---|---|---|---|---|---|---|---|
| bank statement | index.jsx |  |  | ✓ | ✓ | 14 → 28 | sequenced |
| calculator | index.jsx | ✓ |  |  |  | 19 → 19 | static |
| case file folder | index.jsx | ✓ |  |  |  | 4 → 4 | static |
| date marker | index.jsx | ✓ |  |  |  | 2 → 2 | static |
| ledger notebook | index.jsx | ✓ |  |  |  | 19 → 19 | static |
| legal document | index.jsx | ✓ |  |  | ✓ | 29 → 30 | static |
| national border line | index.jsx |  | ✓ | ✓ |  | 0 → 16 | draw-on |
| satellite terrain | index.jsx | ✓ |  |  |  | 83 → 83 | static |
| territory fill | index.jsx |  | ✓ | ✓ | ✓ | 0 → 17 | draw-on |
| answer frame | library.jsx |  |  | ✓ | ✓ | 6 → 9 | sequenced |
| application window | library.jsx |  |  | ✓ | ✓ | 6 → 18 | sequenced |
| archival map sheet | library.jsx |  |  | ✓ | ✓ | 9 → 13 | sequenced |
| archival photograph | library.jsx | ✓ |  | ✓ | ✓ | 7 → 8 | static |
| balance sheet | library.jsx |  |  | ✓ | ✓ | 3 → 19 | sequenced |
| benchmark bar | library.jsx |  |  | ✓ | ✓ | 1 → 11 | sequenced |
| benefit rule | library.jsx | ✓ |  |  | ✓ | 10 → 10 | static |
| blueprint sheet | library.jsx | ✓ |  | ✓ | ✓ | 28 → 30 | static |
| bolt joint | library.jsx | ✓ |  |  | ✓ | 7 → 7 | static |
| calendar grid | library.jsx |  |  | ✓ |  | 23 → 32 | sequenced |
| cash notes | library.jsx |  |  | ✓ |  | 0 → 16 | sequenced |
| checklist rule | library.jsx |  |  | ✓ |  | 0 → 14 | sequenced |
| clock face | library.jsx | ✓ |  |  | ✓ | 17 → 17 | static |
| component part | library.jsx | ✓ |  |  | ✓ | 4 → 4 | static |
| concept node | library.jsx | ✓ |  |  | ✓ | 6 → 6 | static |
| constitutional text | library.jsx |  |  | ✓ | ✓ | 3 → 17 | sequenced |
| conveyor belt | library.jsx | ✓ |  |  | ✓ | 15 → 15 | static |
| court document | library.jsx |  |  | ✓ | ✓ | 16 → 28 | sequenced |
| courthouse column | library.jsx | ✓ |  |  | ✓ | 12 → 12 | static |
| cross section | library.jsx | ✓ |  |  |  | 35 → 35 | static |
| cursor pointer | library.jsx | ✓ |  |  | ✓ | 2 → 2 | static |
| desk edge | library.jsx | ✓ |  |  | ✓ | 7 → 7 | static |
| dna helix | library.jsx |  |  | ✓ |  | 2 → 16 | sequenced |
| enrollment form | library.jsx |  |  | ✓ |  | 2 → 19 | sequenced |
| evidence exhibit | library.jsx |  |  | ✓ | ✓ | 5 → 12 | sequenced |
| evidence tube | library.jsx | ✓ |  |  | ✓ | 11 → 11 | static |
| family tree | library.jsx |  |  | ✓ |  | 0 → 13 | sequenced |
| figure silhouette | library.jsx | ✓ |  |  | ✓ | 3 → 3 | static |
| film reel | library.jsx | ✓ |  |  | ✓ | 10 → 10 | static |
| galaxy spiral | library.jsx |  |  | ✓ |  | 3 → 19 | sequenced |
| gauge dial | library.jsx | ✓ |  |  | ✓ | 13 → 13 | static |
| gavel | library.jsx | ✓ |  |  | ✓ | 6 → 6 | static |
| gear train | library.jsx | ✓ |  |  | ✓ | 27 → 27 | static |
| handwritten letter | library.jsx |  |  | ✓ | ✓ | 3 → 12 | sequenced |
| iv stand | library.jsx | ✓ |  |  | ✓ | 9 → 9 | static |
| lab bench | library.jsx |  |  | ✓ |  | 7 → 13 | sequenced |
| latency trace | library.jsx |  | ✓ |  |  | 2 → 3 | draw-on |
| link path | library.jsx |  | ✓ |  |  | 3 → 4 | draw-on |
| load curve | library.jsx |  | ✓ |  |  | 3 → 4 | draw-on |
| machine housing | library.jsx | ✓ |  |  |  | 13 → 13 | static |
| medical scan | library.jsx | ✓ |  |  | ✓ | 9 → 9 | static |
| money trail | library.jsx |  |  | ✓ | ✓ | 0 → 19 | sequenced |
| museum artifact | library.jsx | ✓ |  |  |  | 7 → 7 | static |
| office tower | library.jsx | ✓ |  |  | ✓ | 58 → 58 | static |
| orbit path | library.jsx | ✓ |  |  | ✓ | 4 → 4 | static |
| output transcript | library.jsx |  |  | ✓ | ✓ | 2 → 13 | sequenced |
| patient chart | library.jsx | ✓ | ✓ |  |  | 14 → 15 | static |
| period painting | library.jsx | ✓ |  |  | ✓ | 9 → 9 | static |
| phone showing a budgeting app | library.jsx |  |  | ✓ |  | 5 → 13 | sequenced |
| pill dose | library.jsx |  |  | ✓ |  | 0 → 9 | sequenced |
| pinned photograph | library.jsx | ✓ |  | ✓ | ✓ | 6 → 7 | static |
| plan comparison rows | library.jsx |  |  | ✓ |  | 3 → 27 | sequenced |
| planet sphere | library.jsx | ✓ |  |  |  | 7 → 7 | static |
| police dashcam frame | library.jsx | ✓ |  |  | ✓ | 10 → 10 | static |
| press headline | library.jsx |  |  | ✓ | ✓ | 5 → 21 | sequenced |
| prison window | library.jsx | ✓ |  |  |  | 9 → 9 | static |
| process arrow | library.jsx |  |  | ✓ |  | 0 → 3 | sequenced |
| product silhouette | library.jsx | ✓ |  |  |  | 5 → 5 | static |
| progress arc | library.jsx | ✓ |  |  | ✓ | 6 → 6 | static |
| prompt field | library.jsx |  |  |  | ✓ | 3 → 4 | transform |
| question line | library.jsx | ✓ |  |  | ✓ | 4 → 4 | static |
| receipt | library.jsx |  |  | ✓ | ✓ | 3 → 10 | sequenced |
| red string | library.jsx |  |  | ✓ | ✓ | 10 → 15 | sequenced |
| resource site marker | library.jsx | ✓ |  |  | ✓ | 7 → 7 | static |
| robot arm | library.jsx | ✓ |  |  | ✓ | 7 → 7 | static |
| royal seal | library.jsx | ✓ |  |  |  | 5 → 5 | static |
| scale bar | library.jsx | ✓ |  |  | ✓ | 11 → 11 | static |
| share price line | library.jsx | ✓ |  |  | ✓ | 4 → 4 | static |
| spacecraft silhouette | library.jsx | ✓ |  |  | ✓ | 10 → 10 | static |
| stacked layer | library.jsx |  |  | ✓ |  | 0 → 12 | sequenced |
| star field | library.jsx | ✓ |  |  |  | 69 → 69 | static |
| state map | library.jsx |  | ✓ | ✓ | ✓ | 0 → 17 | draw-on |
| stepped platform | library.jsx |  |  | ✓ |  | 1 → 9 | sequenced |
| stock ticker tape | library.jsx | ✓ |  |  | ✓ | 24 → 24 | static |
| stone monument | library.jsx | ✓ |  |  | ✓ | 8 → 8 | static |
| supply route | library.jsx |  | ✓ | ✓ |  | 0 → 176 | draw-on |
| timeline rule | library.jsx |  |  | ✓ |  | 2 → 20 | sequenced |
| vital trace | library.jsx |  | ✓ |  |  | 1 → 2 | draw-on |
| wire node | library.jsx |  |  | ✓ |  | 1 → 13 | sequenced |
| map-label | maps.jsx |  | ✓ | ✓ |  | 0 → 16 | draw-on |
| map-markers | maps.jsx |  | ✓ | ✓ | ✓ | 0 → 25 | draw-on |
| map-outline | maps.jsx |  | ✓ | ✓ |  | 0 → 16 | draw-on |
| map-region-highlight | maps.jsx |  | ✓ | ✓ | ✓ | 0 → 17 | draw-on |
| map-route | maps.jsx |  | ✓ | ✓ |  | 0 → 46 | draw-on |
| bacteria colony | nature.jsx |  |  | ✓ |  | 0 → 12 | sequenced |
| blind spider | nature.jsx | ✓ |  |  | ✓ | 11 → 11 | static |
| cave cross section | nature.jsx |  |  |  |  | 10 → 13 | fade-only |
| cave entrance | nature.jsx | ✓ |  |  |  | 8 → 8 | static |
| cave worker | nature.jsx | ✓ |  |  |  | 8 → 8 | static |
| depth scale | nature.jsx |  |  | ✓ | ✓ | 3 → 15 | sequenced |
| earth globe | nature.jsx | ✓ |  |  | ✓ | 10 → 10 | static |
| ecosystem web | nature.jsx |  |  | ✓ | ✓ | 0 → 16 | sequenced |
| eyeless leech | nature.jsx | ✓ |  |  | ✓ | 13 → 13 | static |
| gas cloud | nature.jsx | ✓ |  |  | ✓ | 26 → 26 | static |
| hydrothermal vent | nature.jsx | ✓ |  |  | ✓ | 10 → 10 | static |
| mineral crystal | nature.jsx | ✓ |  |  | ✓ | 5 → 5 | static |
| no sunlight | nature.jsx |  |  |  |  | 6 → 9 | fade-only |
| oxygen gauge | nature.jsx | ✓ |  |  | ✓ | 13 → 13 | static |
| pale centipede | nature.jsx | ✓ |  |  | ✓ | 41 → 41 | static |
| rock strata | nature.jsx | ✓ |  |  | ✓ | 8 → 8 | static |
| sea surface | nature.jsx | ✓ |  |  | ✓ | 6 → 6 | static |
| sealed entrance | nature.jsx | ✓ |  |  | ✓ | 8 → 9 | static |
| springtail | nature.jsx | ✓ |  |  | ✓ | 11 → 11 | static |
| sunlight | nature.jsx | ✓ |  |  | ✓ | 19 → 19 | static |
| total darkness | nature.jsx | ✓ |  |  | ✓ | 4 → 4 | static |

Columns 4–6 record whether that kind of change occurs at all, even in a drawing whose bucket is static.
