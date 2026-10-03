# V2 — word-level sync: entity visuals pop on the word that names them (2026-10-03)

Branch `claude/visual-rebuild-from-5f91e75`.

**Result:**
- **Before:** the sync was beat-level. A portrait landed about 1.4 s before
  the narrator said the name.
- **Now:** portraits, full-bleed photos, hero cutouts and hero numbers pop
  on their word.
- **Measured on the CI-rendered ch-26 video**
  ([37104156298](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/37104156298),
  approved): Marco Rubio's portrait starts popping at frame 60 (2.00 s) and
  is fully in by frame 63. "Rubio" is spoken at frames 66–78 (2.20–2.60 s).
  The pop completes 0.1–0.2 s before the word starts.

## How the timing was read

The caption pops each word on the frame of its voiceover word boundary
(`CanvasCaption`: a word is drawn only from its `from` frame). So the
caption in a rendered frame is a frame-accurate readout of when each word is
spoken. Every measurement below steps through the rendered MP4 frame by
frame, reading:
- the caption, to see when the word was spoken;
- the middle-zone ink, to see when the visual appeared.

## Before — beat-level (verified)

[37082751699](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/37082751699)
ch-9, beat 1 (Ilham Aliyev, PORTRAIT), beat start 8.93 s:

| Beat time | On screen |
|---|---|
| +0.0–0.1 s | the previous beat's map popping out |
| +0.2–0.3 s | middle zone empty |
| **+0.4 s** (frame 12) | **portrait fully in** |
| +1.4 s | "Ilham" spoken |
| **+1.8 s – +2.2 s** | **"Aliyev" spoken** |

Every element popped at a fixed offset from the beat's start, so the
portrait was ~1.4 s early.

## What changed

| Commit | Change |
|---|---|
| `e0c8093` | **feat(sync): word-level pop timing for entity visuals** (details below) |
| `82c7011`, `a0b1763`, `7916c04` | Spelled numbers. The voiceover says "two hundred" for "200+", "three point five" for "3.5", "six hundred fifty thousand" for "650,000" and "fifty million" for "$50 million"; each is read and matched (found on CI runs 37100587452 / 37102013192 / 37104156298). A "not found" line now prints the beat's spoken words. |
| `a0b1763` | NUMBER-FULL with a decimal ("3.5", "$387.5", "$2.7 million") reserved descender room under a decimal point that sits on the baseline. The ink ended 70 px above the zone floor and the beat failed canvas-coverage (58.4–59.2%) on several runs. The reserve now applies to commas only. Checked on a local render: the ink ends at y 1333–1336. |

`e0c8093` in detail:
- **Planner:** emits `entity_anchor_word`, which is kept only if it is a
  word of the sentence.
- **`render.js` schedules the pop.** The voiceover's real word timings (Edge
  TTS WordBoundary) are joined to the beats there; `render-and-qa.js` never
  has them, so the spec's lookup lives here.
- **Pure helpers:** `visual/entity-sync.js` matches the anchor and
  schedules the pop; `visual/pop-groups.js` (the pop compositor's groups)
  is now a pure module, so it can be unit-tested.
- **Full-bleed header:** drawn in ink on the white ground until the photo
  lands, then white. The caption follows the photo's arrival.
- **Beat check:** samples 0.4 s after the pop when that is later than the
  midpoint.

### The rules (visual/entity-sync.js)

- **Which word:**
  - the planner's `entity_anchor_word`, if it is part of what is shown;
  - otherwise the shown entity's own words, surname first ("Aliyev" before
    "Ilham", "key" before "door");
  - for a figure, its digits, as written or spelled.
  The first occurrence in the beat wins.
- **When:** the pop (6 frames) starts 6 frames before the word starts, so the
  element is fully in as the word begins, before it ends.
  - A word in the beat's last 0.5 s pops 8 frames earlier still.
  - Never before frame 0, and never later than 0.5 s before the beat's end
    (never pushed past the beat).
- **What moves:** only the group holding the entity visual:
  - the full-bleed photo (SCENE-FULL / ARCHITECTURE / DOCUMENT / MONEY);
  - or the band holding the portrait, hero cutout or hero number.

  The headline still pops at the beat's start and the caption still trails
  its words. If nothing else would be on screen meanwhile, the visual is not
  delayed (no empty frames).
- **Not found:** the visual pops at the beat start, logged, never a failure:
  `[sync] ch-26 beat 5: anchor "50" not found in the spoken words, popping at beat start (spoken: ...)`
- **Logged:** `[sync] ch-26 beat 1: entity "Marco Rubio" (portrait), anchor word "Rubio", spoken at 2.20s-2.60s, pop scheduled at 2.00s (frame 60)`

## Measurements after the change

| Run / video | Beat | Word spoken | Pop scheduled | First visible → fully in | Before the word ends? |
|---|---|---|---|---|---|
| 37104156298 ch-26 (CI, approved) | Marco Rubio, PORTRAIT | "Rubio" frames 66–78 (2.20–2.60 s) | frame 60 (2.00 s) | 60 → 61–63 | yes, before it starts |
| 37102013192 ch-9 (CI) | Thailand, SCENE-FULL | "Thailand's" 0.70–1.20 s | 0.50 s (frame 15) | 0.5 s → 0.6 s | yes, 0.2 s before it starts |
| 37102013192 ch-9 (CI, log) | "650,000", NUMBER-FULL | "six [hundred fifty thousand]" at 3.47 s | 3.27 s | — | — |
| 37100587452 ch-9 (CI, log) | "2", NUMBER-FULL | "two" at 2.67–2.83 s | 2.47 s | — | — |
| local QA render | PORTRAIT (fixture photo) | "Aliyev" frames 27–34 | frame 21 | 22 → 24 | yes |
| local QA render | SCENE-FULL "Baku" | "Baku" frames 48–55 | frame 42 | 44 → before 48 | yes |

On the Thailand beat, the frames show the header "Strategic importance" in
ink on white from 0.2 s; at 0.5 s the photo pops and the header turns white.

Both pop-synced CI videos passed every canvas check (pop-transitions,
zones, middle-zone-filled, coverage). ch-26 and ch-9 in 37104156298 were
**approved**.

Tests: `scripts/test-entity-sync.mjs`, 23 cases covering the anchor
choice, schedule edges, spelled numbers and the compositor's group timing.

## Where this stops

- **The anchor match is word-level.** A paraphrase in the voiceover ("the
  senator" for "Rubio") is not matched, and the visual pops at the beat
  start (logged).
- **The timings are Edge TTS word boundaries.** The audio, captions and
  pops all use the same ones, so they agree with each other. They are not a
  forced alignment of the audio.
- **Charts and maps are not word-synced** (not in the spec's list). Their own
  build animations are drawn settled by the pop compositor.
