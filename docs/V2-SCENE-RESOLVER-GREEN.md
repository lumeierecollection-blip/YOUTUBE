# V2 — scene description and the entity resolver (2026-10-03)

Branch `claude/visual-rebuild-from-5f91e75`. The planner describes each
beat's picture (`scene_description`) and lists what the sentence names
(`named_entities`). `scripts/resolve-scene.cjs` sources each named thing
from the right place and verifies it before use.

**Status, final run
[37091154782](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/37091154782)
(`02af471`):**
- **Wrong photos: none.** Two wrong photos got through in earlier runs
  (a "HOME Act" photo of a different act, a G7 namesake company); both
  causes are fixed, below.
- **Beat check:** passes on every channel that rendered (6/6, 8/8, 9/9,
  7/7, 5/5).
- **Canvas audit:** passes 17/17 on every channel that rendered.
- **Every named person, place, building or organization** got its own
  verified photo, or its name as a name card. None got a stand-in.
- **Visual-first (60% or more of content beats):** met on 3 of 5 rendered
  channels.
- **Approved and uploaded:** ch-9 only. The other channels went to
  approved-review because of the AI frame reviewer, not the resolver.

## What was built

| Commit | Task |
|---|---|
| `82b0e71` | **1.** `scene_description` on every beat, using the owner's rule text verbatim. `named_entities` gains six types: person / place / building / organization / object / number. Each must be named in its sentence (`checkEntities`). Named objects feed the cutout path. |
| `f01e55c` | **2.** `scripts/resolve-scene.cjs` and `scripts/verify-place-image.cjs` (the owner's question: "Does this image show X? Answer MATCH, CLOSE, or WRONG"; MATCH only). See *Source order*. |
| `05b00c4` | **3.** Place / building photos: full-bleed (cover), a flat rgba(0,0,0,0.35) overlay, a 2% push across the beat (the pop compositor draws the photo group live), the headline over the photo in the top zone. The new PORTRAIT composition: the verified photo at its own aspect, 700–900 px on its longest side, in the middle zone, with the name above. The old circular "iris" reveal is removed. |
| `6216bb3` | **4.** The resolver runs on every content beat that is not already a chart, map, process, list or timeline. A named entity with no verified photo becomes a **name card** (its name large, the sentence's figure or key phrase under it), never a stand-in and never an empty middle. The hook and the CTA stay typography. |

The fixes found by iterating, each from a CI run:

| Commit | Found in | Fix |
|---|---|---|
| `f6d550c` | 37031119023 ch-2 | A **wrong photo**: DOCUMENT "HOME Act" → a photo of people announcing a *different* act. DOCUMENT / MONEY images are now verified too. Commons place files must be named as a view. A country or US state with no verified photo is drawn as its map. |
| `a2a6d3a` | 37067332714 ch-2 | Bracketed acronyms are stripped ("Ontario Landlord and Tenant Board (LTB)"). The white-ground check no longer measures a COMPARISON-SPLIT beat. |
| `8072903` | 37074911159 | Refused acronyms ("AI", "ED") get no name card. The planner prompt is trimmed (see *Not done*). |
| `b749ae5` | 37079127196 | Dates are not entities ("September 2026" typed as a place). A scene_description name must be a proper noun in the sentence ("Safety" was typed as a place). |
| `4fb02ac` | 37082751699 ch-2 | TIMELINE: the header settles at 66%, so its kicker is no longer lost; every date fits beside the line. |
| `f119b2e` | 37082751699 ch-9 | The accent word over a full-bleed photo uses a lightened accent (navy was unreadable on Baku). |
| `2eec02c` | 37086054975 ch-44 | Horizontal bar rows stand on the chart's floor (coverage 58.8% → full zone). |
| `02af471` | 37088913234 ch-9 | A **wrong photo**: "G7" → "G7 AGRI JAPAN CO., LTD." headquarters, verified MATCH. The verifier is now told what the entity is ("G7 (Intergovernmental political and economic forum)"). |

## Source order (as built)

| Type | Sources, in order | Verified by |
|---|---|---|
| person | Wikipedia summary lead image → Wikipedia search → Commons portraits. **Never Pixabay.** | `verify-person-image.cjs` (identity) |
| place, building | Wikipedia summary → Wikipedia search / page photos → Commons → Pixabay (tags must name every word) | `verify-place-image.cjs` + Wikipedia description, MATCH only |
| organization | Wikipedia → Commons (its own building). **No Pixabay.** | same |
| object | Pixabay on demand (cutout path, `fetch-cutout-once.cjs`) | `verify-cutout-image.cjs` (LITERAL + recognizable) |
| number | drawn | — |

**Deviation from the spec:** the spec's last step for an organization is "a
photo of the organization's building type". That is a generic photo standing
in for a named entity, which the same spec ("never substitute a generic
photo") and CLAUDE.md forbid. It is not implemented; the beat gets a name
card instead.

## What the verifier caught

Candidates rejected on real runs:
- **"Maryland":** a highway, the governor at a briefing ×2, a library
  interior, an office block, a plate of fried chicken (all WRONG).
- **"United States dollar banknotes":** a Confederate $100 note (WRONG /
  CLOSE).
- **"Bure" (Eritrea):** radio telescopes on France's Pic de Bure (WRONG ×3).
- **"Middle Corridor":** three architectural corridors (WRONG).
- **"Hitachi":** a Nippon Life office tower (WRONG).
- **"David Leibowitz":** a house and a memorial plaque of a different
  David Leibowitz (no face).
- **"G7"** (after the fix): a namesake company.

Accepted, each verified MATCH and checked on the rendered frame:

| Run / channel | Entity | Source | Rendered as |
|---|---|---|---|
| 37082751699 ch-9 | Ilham Aliyev | Commons official portrait | PORTRAIT, 568×709, centred |
| 37082751699 ch-9 | Baku | Wikipedia lead image (city montage) | SCENE-FULL |
| 37074911159 / 37079127196 ch-48 | FDA (→ Food and Drug Administration) | Wikipedia page photo of its office | ARCHITECTURE |
| 37086054975 ch-9 | Europe | Commons satellite photo | SCENE-FULL |
| 37086054975 ch-48 | Hitachi | Wikipedia page photo, Hitachi offices | ARCHITECTURE |
| 37088913234 ch-48 | Bosch | Wikipedia search, Bosch Renningen campus | ARCHITECTURE |
| 37088913234 ch-2 | Governor Newsom | Commons 2026 official portrait | PORTRAIT |
| 37091154782 ch-26 | David Rivera | Wikipedia lead image (official portrait) | PORTRAIT, 480×710, centred |

## Frames checked (task 5.2)

- **ch-26, run 37091154782:** 8 beats. A 10-year statement, a "7 weeks"
  number, a Venezuela map, a "10 years" number, a US map, David Rivera's
  portrait, two statements. Nothing overlaps; every middle zone is filled
  (the measured ink fill is 0.56–0.99). Beat 3's headline repeats its
  number ("10 years" / "10-year sentence"), an older quirk.
- **ch-9, run 37082751699 (approved):** Azerbaijan map, Aliyev portrait,
  "Partner" statement, Azerbaijan map, Baku full-bleed, close. The Baku
  accent word was unreadable → `f119b2e`.
- **ch-2, run 37072840752:** "40" number, "Congress" and "David Leibowitz"
  name cards, a process, a split close. No overlap, no empty middle.

## Not done / open

- **The 60% ratio is not met everywhere.** It was met on ch-26 (83%), ch-9
  (80%) and ch-2 (71%), but not on ch-1 (33%) or ch-48 (25%). Their scripts
  name things no free source has (Vivian Tu's only Wikipedia image is
  non-free; "Chinaplas 2026", "Fakuma 2026", "Fisher Phillips LLP" have no
  page) or are abstract. A name card is the honest result; it counts as
  type.
- **Number layout coverage, older faults:**
  - A NUMBER-FULL beat with a decimal ("$387.5") reserves 0.12 em under the
    baseline for a separator that does not descend, and stops at ~59%.
  - The swapped NUMBER-FULL draws its middle headline on one short line
    while the layout box assumes two (ch-1, 49.6%).
  Both need frame-measured fixes; I did not guess them.
- **Planner prompt size:** about 8,760 tokens for a 9-sentence script (it
  was ~8,200; adding scene_description pushed it to ~9,100 before
  trimming). Groq's fallback refused it once as too large (413). When
  Gemini returns malformed JSON twice and Ollama times out, the beat has no
  plan (ch-1 / ch-26 in 37074911159).
- **Prep failures are upstream of the resolver.** Discovery duplicates on
  the 3b model (ch-1, ch-26, ch-44) and research citing unreturned URLs
  (ch-9) still cost channels.
- **The AI frame reviewer** sends most videos to approved-review; nothing is
  deleted.
- **Uploads:** ch-9 and ch-26 return `invalid_client`; ch-44's token has
  expired.
