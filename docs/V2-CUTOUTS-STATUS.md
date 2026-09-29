# V2 concept cutouts — status

Branch `claude/visual-rebuild-from-5f91e75`. This is **not** the
`V2-CUTOUTS-GREEN.md` the brief asks for. That document is a table of cutouts
fetched from stock libraries and the per-channel approvals of a green CI run;
**no cutout has been fetched and no CI run has happened.** Everything below says
what exists, what was verified and how, and what is blocked.

## The blocker (Task 1 could not be executed in the session that built this)

The session that wrote this runs behind an egress allowlist. Every stock-photo
host answered `403 to CONNECT (policy denial)`, confirmed on the session's proxy
status endpoint: `pixabay.com`, `api.pexels.com`, `www.pexels.com`,
`upload.wikimedia.org`, `commons.wikimedia.org`, `unsplash.com`,
`images.unsplash.com`, `openverse.org`, `api.openverse.org`, `cdn.pixabay.com`,
`images.pexels.com`, `www.flickr.com`, `loc.gov`, `www.rawpixel.com`,
`pngimg.com`, `www.freepik.com`. `pypi.org` and `github.com` (the rembg model's
host) are reachable, so isolation runs here; **sourcing does not**. Routing
around the policy (a mirror, a proxy, another host) was not attempted. Fixing it
is the environment's Network access setting (allow those hosts), or — the way the
repo already works — a GitHub Actions runner, whose egress is open
(`src/skills/asset-sourcing/SKILL.md` records a runner reaching every source).

The brief's list has **41** names (it says 42).

## What was built

| Piece | Where |
|---|---|
| 41 specs: name, category, 3 queries each ("... isolated white background"), keywords, flags (`rect_ok` for a banknote / card / sheet, `grounded` for a building / standing person, `multi` for a skyline / stack) | `scripts/cutout-specs.json` |
| Isolation + acceptance: rembg u2net keeping the photograph's colour; rejects alpha < 12% of the photo, opaque pixels on all four edges, a mask cut by the frame, more than one object, a rectangle where none is expected, no real transparency; crops to the object, longest side <= 1024 | `scripts/cutout_lib.py` |
| The builder: 5 sources (Pexels, Pixabay, Unsplash, Openverse, Wikimedia), licence allowlist, "not a photograph" / unsafe word filter, keyword relevance, >= 900 px, up to 3 queries x 6 candidates per name, pngquant, `index.json`, `CREDITS.md`, `MISSING.md`, a per-attempt log; never substitutes a drawing; `--from-dir` for photographs you supply | `scripts/build-cutout-library.mjs`, `scripts/cutout-library-lib.mjs` |
| A contact sheet (every cutout on the studio ground with the renderer's shadow, labelled with source and licence; missing ones as empty tiles) — the human look the geometric checks cannot replace | `scripts/cutout-contact-sheet.mjs` |
| A `cutouts` job in the dispatchable workflow: `-f build_cutouts=true` builds the library on a runner with the three API-key secrets and commits it to the branch | `.github/workflows/daily-pipeline-v2.yml` |
| Tests | `scripts/test-cutout-library.mjs` |

Run it (needs `PEXELS_API_KEY`, `PIXABAY_API_KEY`, `UNSPLASH_ACCESS_KEY` in the
repo secrets — a source without a key is skipped and logged):

    gh workflow run daily-pipeline-v2.yml \
      --ref claude/visual-rebuild-from-5f91e75 \
      -f dry_run=true -f build_cutouts=true

The job runs beside the pipeline, not before it: the run that builds the library
does not use it, the next run does.

## Verified here

- The mask checks, on constructed masks: a centred object accepted; a tiny one,
  an empty-background photo, four-edge contact, a frame-cut object, two objects
  and an unexpected rectangle each rejected with the right reason; a banknote
  (`rect_ok`), a grounded building and a multi-part skyline accepted.
- rembg + the model download + the crop, end to end, on the repo's own
  photographs (`b-roll/ch-fixture`): of six, two were accepted and four rejected
  with a stated reason (coverage 0.2-11.8%, a mask cut by the bottom edge).
- The whole builder offline (`--from-dir`): one photograph became an alpha PNG
  with a credit row; a photo the checks reject and an unlicensed one landed in
  `MISSING.md`, and neither left a file. Contact sheet rendered from that run.
- The candidate filters (licence, "vector / icon", unsafe words, keyword match,
  size, ranking) and the CREDITS / MISSING generators, unit-tested.

## NOT verified

- **Any fetch from a stock library.** No query has been run; the three queries
  per name are guesses at what the libraries hold. Expect some names in
  `MISSING.md` after the first run (a "broken chain", "radar", "evidence tag" and
  "checkmark" that is a physical object are the likeliest).
- **That a fetched photograph is the right object.** The geometric checks cannot
  tell a dollar bill from another rectangle, and the keyword filter reads only
  what the source says about the picture (the repo's own SKILL.md records a
  Met "Charity" painting returned for "credit card debt"). Open the contact sheet
  the job uploads before trusting the library.
- **Edge quality.** u2net leaves a soft fringe on fine detail (the test cutouts
  show it); no alpha matting is used.
- **The 30-of-40 use across six videos, the drop shadow, placement and the
  entrance animations of cutouts** (Tasks 2-3), and CI. Tasks 2-4 wait for the
  PNGs, as the brief says ("that is the whole task until the PNGs exist").

## What changed in the meantime

Drawn Lucide icons are **retired as concept visuals** (`ICON_TOKENS_ENABLED =
false` in `scripts/concept-plan.js`): until the library exists a beat draws no
concept visual — the number and label alone — rather than a drawing. The concept
extraction (`visual/concept-visuals.js`: 45 kinds, the lexicon, ranking) and the
placement solver (`visual/token-layout.js`) are unchanged and are what Task 2
will point at the PNGs. Charts and maps stay drawn.
