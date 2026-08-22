# Music Sourcing — background underscore bed

Sources ONE real, license-verified background music track from Pixabay
Music for the whole-video ducked underscore bed — distinct from the
per-beat SFX system (`sfx-sourcing/`), which is short one-shot cues, not
a continuous bed.

## Why this runs in GitHub Actions, not interactively

`pixabay.com` is blocked by the interactive Claude Code session's egress
proxy (confirmed live: a direct `curl` and the session's own `WebFetch`
tool both failed with the identical `EGRESS_BLOCKED` error) — the exact
same failure mode `asset-sourcing`'s 10 photo sources hit before
`build-asset-library.yml` moved them to a real GitHub Actions runner (see
that workflow's own header comment for the run-verified confirmation that
`ubuntu-latest` runners reach these hosts directly). `.github/workflows/
fetch-underscore-track.yml` applies the same fix here.

## Why Playwright, not a REST call

Pixabay's own documented API (`pixabay.com/api/docs/`) covers images and
videos only — confirmed via search, no music/audio endpoint exists there.
This project also has no `PIXABAY_API_KEY` configured anywhere (grepped:
not in any workflow's secrets, not referenced by any source module),
including for the endpoints that DO have a public API. Pixabay Music
tracks are download-from-the-page only, so `fetch-underscore.mjs` drives
a real headless browser to the search page and the chosen track's page,
and captures whatever license/attribution text the page ITSELF states —
never a hardcoded or assumed license string.

## Usage

```
node src/skills/music-sourcing/fetch-underscore.mjs "kalimba"
```

Output (fixed filenames — a single stable bed track, not a growing
library, so there's one known path to reference rather than a slug to
discover):
- `src/skills/remotion-render/public/music/underscore.mp3` — the real
  downloaded audio, committed (a stable, reused-every-render asset, same
  as asset-library's treated PNGs — not gitignored scratch like `vo.mp3`,
  which is genuinely per-video content).
- `data/music/underscore.json` — page URL, title, license text as found,
  attribution text as found, duration, fetch timestamp: the auditable
  record of what was actually on the page at fetch time, mirroring
  asset-library's own manifest-vs-treated-file split.

## Wiring into the render pipeline

`compositions/motion-graphics.jsx`'s `MotionGraphicsShorts` conditionally
renders the track (via `staticFile("music/underscore.mp3")`, only when
`hasUnderscore` is true) as a persistent, low-volume `<Audio>` bed for the
whole video — well below the per-beat SFX and voiceover levels (static
gain staging, not dynamic sidechain ducking — see UNDERSCORE_DB's comment
in that file for the exact level and why a fixed level is the right
choice here over a more complex reactive system). `render.js` sets
`hasUnderscore` by checking whether the committed MP3 exists — never a
static import (unlike `vo.mp3`, which always exists by the time render.js
runs and is required, a missing OPTIONAL underscore track must not break
the webpack bundle or fail the render).
