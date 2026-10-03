# V2 — trending feed, on-demand cutouts, CI loop (2026-10-02)

Branch `claude/visual-rebuild-from-5f91e75`. Seven full pipeline runs,
operated autonomously (push, trigger, watch, fix, repeat).

**Result: the target is met in run
[36979111190](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36979111190)
(iteration 7): 5 of 6 channels approved or in approved-review** — ch-9
approved; ch-1, ch-2, ch-26, ch-48 approved-review; ch-44 produced no video
(discovery duplicates). No canvas or zone failure on any channel. Private
uploads across the loop: ch-1 `oB4a3oSiGUU`, `YirRzlBXmcA`; ch-2
`LdeqQMjrh18`. ch-9 was approved in iterations 4, 6 and 7, but its upload
is refused (`invalid_client`) — see *Blocked*.

## On-demand cutouts (iterations 6-7) — the primary path

A pre-built library reused one PNG for every video. Each beat's cutout is
now fetched for that beat before the render (`scripts/fetch-cutout-once.cjs`,
ea1f452 / 71130d7): Pixabay "<concept> isolated", then "<concept>" (photo,
safesearch) → the first 3 results whose tags name it → rembg u2net and the
geometric checks → content verification of the isolated PNG (MATCH only) →
`public/cutouts-live/<ch>/<beat>-<slug>.png` + a sidecar JSON. A failed live
fetch falls back to the verified library PNG, then to type. Pixabay is paced
at one request per 2 s for the whole process (a 429 waits 30 s and retries
once); 3 fetches at a time; 4-minute budget per channel; per-run cache only.

| Run | Channel | Live (verified MATCH) | Library | Symbols | Concept beats with no visual | Rendered frame |
|---|---|---|---|---|---|---|
| 36976172356 | ch-2 | courthouse, gavel (candidate 1 each) | 0 | 0 | 0 | — |
| 36979111190 | ch-1 | worker | 0 | 2 | 1 | a hard-hatted construction worker — matches |
| 36979111190 | ch-2 | gavel | 0 | 1 | 1 | a wooden gavel — matches |
| 36979111190 | ch-26 | scientist (used on 3 beats) | 0 | 0 | 3 | a scientist in a protective suit — matches |

No wrong object reached a frame in these runs, and no library fallback was
needed. Person photos stay on the Wikipedia path and are verified per beat:
Abiy Ahmed's lead image verified MATCH and used (ch-9); Youssef Rajji's
candidates rejected NO_MATCH, so the beat was downgraded to type.

## Earlier state (iterations 1-5)

The first five runs approved at most 2 of 6; the sections below are from
that point, updated where noted.

## Outcome per iteration

| Run | ch-1 | ch-2 | ch-9 | ch-26 | ch-44 | ch-48 |
|---|---|---|---|---|---|---|
| [36947929123](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36947929123) | prep: dup topics | prep: 1 source domain | rejected: coverage | rejected: zones | rejected: zones, fit, kinetic | rejected: zones, coverage |
| [36950257339](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36950257339) | **approved, uploaded** `oB4a3oSiGUU` | approved-review (AI) | prep: uncited URL | approved-review (AI) | rejected: zones | rejected: zones |
| [36953236514](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36953236514) | **approved, uploaded** `YirRzlBXmcA` | rejected: coverage | rejected: coverage | approved-review (AI) | approved-review (AI) | rejected: zones |
| [36956234025](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36956234025) | rejected: kinetic | **approved, uploaded** `LdeqQMjrh18` | **approved**, upload refused (OAuth) | approved-review (AI) | no plan (Gemini malformed JSON) | approved-review (AI) |
| [36959124080](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36959124080) | approved-review (AI) | prep: dup topics | approved-review (challenger) | prep: dup topics | approved-review (AI) | prep: dup topics |
| [36976172356](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36976172356) | prep: dup topics | approved-review (challenger) | **approved**, upload refused (OAuth) | prep: 6 ids in one citation | rejected: "%" crossed y 1340 | prep: dup topics |
| [36979111190](https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/36979111190) | approved-review (AI) | approved-review (beat check) | **approved**, upload refused (OAuth) | approved-review (AI) | prep: dup topics | approved-review (AI) |

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
| ea1f452, 71130d7 | on-demand per-beat cutouts, fetched before the render |
| be5e33b | discovery steered to the least-covered content pillar (prep 3/6 → 5/6) |
| 1b9b5a3 | a "%" drops ~0.1 em below the baseline |

## Blocked (data/ci-runs/)

- `blocked-youtube-oauth.txt` — ch-9 / ch-26 `invalid_client` (client ID and
  secret from different clients), ch-44 tokens 17 days old.
- `blocked-trending-no-youtube-api-key.txt` — trending feed inactive.
- `blocked-discover-duplicate-topics.txt` — qwen2.5:3b discovery keeps
  proposing covered topics; no trending seed to break the loop.
- `blocked-template-monoculture.txt` — the AI frame review routes most
  videos to approved-review as headline-dominated.
