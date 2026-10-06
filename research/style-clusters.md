# Editing-style clusters from `research/`

Derived by measuring every video in `research/` (ground + palette from decoded
pixels, format from the footage itself). No ASR exists in this environment, so
nothing here is derived from narration. `research/channel-map.md` was read and
not rewritten; this file records a different question — not "which channel does
this video map to" but "what editing technique does it demonstrate".

**Two inventory corrections to the brief's list, both verified:**
`VID_20261002_003232_349.mp4` and `VID_20261002_003236_442.mp4` are not in
`research/` — they are byte-for-byte the files now at
`research/motion-graphics-ref/ref-02.mp4` and `ref-03.mp4` (0.44 MB and 1.33 MB,
matching the brief's stated sizes). So the 18 videos in the brief are 15 in
`research/` plus 3 moved to `motion-graphics-ref/`. Measured set below is those
15.

**One measurement is not trustworthy and is not used.** Cut counts came back 0
for videos that visibly cut (e.g. `4_5917850534521349251.mp4`, 60 s, plainly a
layout sequence). A 2 fps sample downsampled to 32 px cannot see a cut between
similar layouts. Grounds and palettes are used; **pacing is unmeasured** and no
clustering decision below rests on a cut rate.

---

## Clusters

### C1 — `newspaper-collage`
**Members:** `4_5917850534521349135.mp4`, `4_5917850534521349251.mp4`, `4_5917850534521349262.mp4`

Ground `#BABDB6` / `#9A9A9B` / `#B7B6B7` — light paper, the lightest group in
the set. All three are 1280x720 landscape, the only landscape group at that
resolution. Serif headlines assembled like a front page; torn or clipped
photographs inset on a grid; parchment and newsprint texture. The dominant
palette is paper (35–37% near-white) with the rest in mid greys, so the image
carries almost no hue — the ink does the work.

Distinct from every built channel: no built channel is light-ground with a
serif-assembly front-page grammar.

### C2 — `stepped-timeline`
**Members:** `4_5917850534521349257.mp4`, `4_5917850534521349249.mp4`

`…257` is a dated timeline (2008 / 2011 / 2014 / 2019) stepped under glitching
type on `#382D28`, 38% near-black. `…249` is typewriter-and-ASCII history:
archival newspaper ephemera, a green-screen terminal running monospace, grids of
vintage bitmap fonts. Shared signature is **dated or enumerated progression
through history, carried by a label per step**, not by a narrator over footage.
One is dark and cinematic, the other is light archival, so this cluster is the
weakest pairing in the set and is kept only because the progression grammar is
shared.

### C3 — `money-explainer`
**Members:** `VID_20261002_003228_944.mp4`, `VID_20261002_003236_442.mp4` (= `ref-03.mp4`)

Cream ground, thin serif against plain grotesque, green duotone currency
photography, a bold condensed label per beat ("FUNDING", "IN ASSETS"). Subject
is money's origin and mechanics, told as collage rather than chart.

**Collides with built ch-01 Money Mind** (Personal Finance, motion-graphics,
white bg, `#22C55E` green accent, same green-on-white idea). Excluded — see
below.

### C4 — `archival-montage`
**Members:** `4_5917850534521349255.mp4`

Letterboxed monochrome on `#595A5B`, film grain, mid-century photography, slow
push-ins. One reference only, but it demonstrates a full format across 65 s:
SCENE 01 through to a Radio City Music Hall close.

Distinct: no built channel is letterboxed monochrome with a slow-push grammar.

### C5 — `dark-data-viz`
**Members:** `4_5917850534521349240.mp4`

Dark red ground `#4E2F2F`, 48% near-black, a ticking counter with a red
sparkline. A 5-second silent loop — a template preview, not editorial footage.

**`repeatable: no`.** Excluded.

### C6 — `live-action-over-type`
**Members:** `4_5917850534521349237.mp4`

Bold outlined display type over live-action b-roll, burned-in word captions,
bright saturated accents on a `#838F9E` ground. Automation and job-displacement
subject matter.

A single reference. Kept as a candidate for the next expansion rather than
assigned now: one reference cannot show whether the style carries topics beyond
robot labour, which is the criterion the subject-domain test turns on.

### C7 — `glitch-corporate`
**Members:** `4_5917850534521349257.mp4`

Red/black palette, jittering frames, timeline markers, all-caps verdict words
(EMOTIONAL / CINEMATIC / ORGANIZED / STUNNING). **Split across clusters** —
its stepped-year grammar put it in C2, its palette into C7. That is exactly the
ambiguity §6 says to merge rather than resolve; merged into C2 above, with the
palette noted.

### C8 — `social-proof-psych`
**Members:** `VID_20261002_003250_292.mp4`

Cream ground, dark-green rules, experiment clips, a comment-section mockup, a
brain graphic. Subject is social psychology.

**Collides with built ch-22 Mind Lab** and ch-50 Synapse, both psychology.
Excluded.

### C9 — `editorial-serif-light`
**Members:** `4_5917850534521349264.mp4`

The lightest ground in the set, `#D4D4D4` at 63% near-white. Serif and
grotesque mixed, B&W art photography, ikigai as life-philosophy. A single
reference, and a light editorial layout rather than a demonstrated series.

### C10 — `editing-service-promo`
**Members:** `VID_20261002_003254_139.mp4`

Grey-to-black `#0B0B0B` with 48% near-black, neon-green condensed type,
before/after split, an Instagram handle in the last frame. **A paid-services
ad for an editing business.** `repeatable: no` — there is no series here to
repeat. Excluded.

---

## Assigned clusters

| cluster | candidate channel | id |
|---|---|---|
| C1 newspaper-collage | **Broadsheet** | `ch-05` |
| C4 archival-montage | **Archive Room** | `ch-06` |
| C2 stepped-timeline | **Ledger** | `ch-08` |
| C9 editorial-serif-light | **Margin Note** | `ch-10` |

Three references, one reference, two references, one reference. C6 is the
strongest excluded candidate and is recorded here for the next expansion.