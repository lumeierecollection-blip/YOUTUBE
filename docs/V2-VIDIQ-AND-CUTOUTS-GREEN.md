# V2 — trending feed, PNG cutouts, five-iteration CI loop (2026-10-02)

Branch `claude/visual-rebuild-from-5f91e75`. Autonomous loop: push, trigger,
watch, fix, repeat — five full pipeline runs. **Not green on 4 channels**:
the best run approved 2 of 6. What remains is external (OAuth secrets, a
missing API key, the local model's topic discovery) or a content-model
decision (the AI reviewer's monoculture rule) — listed under *Blocked*.

## Outcome per iteration

| Run | ch-1 | ch-2 | ch-9 | ch-26 | ch-44 | ch-48 |
|---|---|---|---|---|---|---|
| [36947929123](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36947929123) | prep: dup topics | prep: 1 source domain | rejected: coverage | rejected: zones | rejected: zones, fit, kinetic | rejected: zones, coverage |
| [36950257339](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36950257339) | **approved, uploaded** `oB4a3oSiGUU` | approved-review (AI) | prep: uncited URL | approved-review (AI) | rejected: zones | rejected: zones |
| [36953236514](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36953236514) | **approved, uploaded** `YirRzlBXmcA` | rejected: coverage | rejected: coverage | approved-review (AI) | approved-review (AI) | rejected: zones |
| [36956234025](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36956234025) | rejected: kinetic | **approved, uploaded** `LdeqQMjrh18` | **approved**, upload refused (OAuth) | approved-review (AI) | no plan (Gemini malformed JSON) | approved-review (AI) |
| [36959124080](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36959124080) | approved-review (AI) | prep: dup topics | approved-review (challenger) | prep: dup topics | approved-review (AI) | prep: dup topics |

Iterations 4 and 5 had **no zone or coverage failure on any channel**. Every
finished video landed in exactly one queue; no MP4 was deleted (the only
removals are superseded correction attempts, logged as such).

## Task 1 — trending topics

- **VidIQ:** no integration in the repo, no key; its API needs the paid Max
  plan. Not used.
- **YouTube Data API v3:** `scripts/fetch-trending.cjs` (a6d6f8c) — category
  per channel, `chart=mostPopular`, last 7 days, ranked by views/day, top 10
  → `data/trending/<ch>.json`; terms in ≥ 5 titles → `<ch>-keywords.json`;
  12 h cache. Wired into discovery (top 5 as `trending_this_week`, a signal,
  never a fact) and the script stage (`seo_keywords`).
- **Status: inactive** — no `YOUTUBE_API_KEY` secret. Every prep logs
  `[trending] … YOUTUBE_API_KEY missing, falling back to unseeded research`
  and continues (graceful degradation verified in all five runs).

## Task 2 — PNG cutouts (Pixabay; Unsplash has no key)

Five builds (commits a22ea72 … 7f38163): 14 → 16 → 23 → 23 → 23 of 39.
Fixes on the way: the offline test stub (44cf7e6), a verifier that cannot
answer is not a rejection (ae53b9c — 72 of the first build's ~140 checks
were Groq 429s / Gemini's per-process token cap), per-object orientation
(519dd13 — vertical only for tall subjects; +7).

Content verifier: runs on the isolated PNG, only MATCH is saved, verdicts
cached in `public/cutouts/verified.json`, 3 content rejections → MISSING.md.
Providers used: Groq (qwen3.8-27b) and Gemini (flash-lite); no Ollama in
the job.

My own check of the 23 built PNGs (contact sheet `docs/cutout-contact-sheet.png`):

| Name | Shows | Match? | Renders as |
|---|---|---|---|
| dollar-bill | a US $20 banknote | yes | cutout |
| coin-stack | a stack of gold coins | yes | cutout |
| wallet | an open leather wallet | yes | cutout |
| person-silhouette | a man in dark silhouette | yes | cutout |
| business-person | a man in a suit | yes | cutout |
| worker | a worker in hi-vis gear | yes | cutout |
| courthouse | a columned courthouse with a dome | yes | cutout |
| bank-building | an office / bank building | plausible | cutout |
| gavel | a wooden gavel on its block | yes | cutout |
| magnifying-glass | a magnifying glass | yes | cutout |
| padlock | a rusty padlock on a chain (padlock small) | partial | cutout |
| radar | a radar dish | yes | symbol (SVG) |
| globe | a terrestrial globe | yes | cutout |
| flag-america | a US flag | yes | cutout |
| handshake | two wooden mannequins shaking hands | partial | cutout |
| **calendar** | **a decorative sun / astrological dial** | **no — wrong** | cutout ⚠ |
| upward-arrow | a road sign with an up arrow | yes | symbol (SVG) |
| warning-triangle | a triangular road sign | yes | symbol (SVG) |
| office-tower | a skyscraper | yes | scene (not used) |
| group-people | five people on a sofa | yes | scene (not used) |
| government-building | a modern office block | no | scene (not used) |
| factory | an assembly-line interior | no | scene (not used) |
| city-skyline | a single tower | no | scene (not used) |

**calendar is wrong and is still in the library** (the verifier said MATCH,
"an astrological calendar"); not removed, per the instruction to report
before fixing. Missing (16): dollar-sign, bank-statement, credit-card,
person-walking, scientist, contract, stamp-approved, scales, evidence-tag,
downward-arrow, checkmark, broken-chain, key, shield, crosshair, map-pin.

## Task 3 — cutouts in the renderer (71dabc7, da308bb)

CUTOUT / SYMBOL / SCENE classes; a concept is shown only when a word of the
sentence names it; only verified cutouts render; no generic people cutout on
a beat naming a person. TYPE-FULL concept beat: statement top zone, primary
visual 420 px bottom-anchored in the middle zone, ≤ 2 secondaries at 180 px,
soft drop shadow, pop entrance. Seen in shipped / queued videos: ch-2
gavel + upward-arrow (approved, uploaded), ch-9 person-silhouette
(approved), ch-26 / ch-1 dollar-bill, ch-1 upward-arrow (approved).

## Fixes made during the loop

| Commit | Cause found on CI frames |
|---|---|
| cf21e36 | numerals are lining (not old-style); years render 0.12 em low; maps' land counts as content; PIE/GAUGE kicker made 4 text elements |
| dd35321 | odometer window showed the next digit below the box; pop scaled from the centre; descender offset applied to lines without descenders |
| 4ec181d | a "q" tail reaches 0.25 em past the line box; decimal separators descend |
| da308bb | the camera lifted bottom-anchored content inside its zone (coverage); more concept beats |
| 0a36e35 | headline markup with no bold / accent word failed kinetic-rules |

## Blocked (data/ci-runs/)

- `blocked-youtube-oauth.txt` — ch-9 / ch-26 `invalid_client` (client ID and
  secret from different clients), ch-44 tokens 17 days old.
- `blocked-trending-no-youtube-api-key.txt` — trending feed inactive.
- `blocked-discover-duplicate-topics.txt` — qwen2.5:3b discovery keeps
  proposing covered topics; no trending seed to break the loop.
- `blocked-template-monoculture.txt` — the AI frame review routes most
  videos to approved-review as headline-dominated.
