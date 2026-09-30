# V2 concept cutouts — status (2026-09-30)

Not the `V2-CUTOUTS-GREEN.md` of the brief: no cutout of the current library exists yet and there
has been no CI run of it. What is true now:

## Decisions

- **Sources: Pixabay (primary), then Unsplash (only for a spec Pixabay could not give).**
  Keys `PIXABAY_API_KEY` / `UNSPLASH_ACCESS_KEY` come from the environment; a missing one is
  logged and skipped; both missing exits 1 "no image source available". Pexels (new API keys
  paused), Wikimedia Commons and Openverse (wrong objects for this project) are gone from the builder.
  Unsplash is paced at one call per 2 s (free tier: 50 / hour).
- **Three classes** (`visual/concept-classes.js`):
  - **28 cutouts** — real photographs isolated onto transparent PNGs (`scripts/cutout-specs.json`).
  - **8 drawn symbols** — upward-arrow, downward-arrow, warning-triangle, checkmark, crosshair,
    radar, broken-chain, dollar-sign: `visual/symbols/`, filled, monochrome, channel accent,
    no outline, no shadow (the dollar sign is a computed shape, not a font glyph).
  - **5 SCENE-FULL photographs** — city-skyline, factory, office-tower, government-building,
    group-people: full-bleed photo with the text over it, never a cutout.
- **The library was deleted**: every previous cutout (from Wikimedia / Openverse) was wrong-object
  or unreviewed and is gone; the rerun rebuilds all 28 from scratch.

## Earlier findings worth keeping

- A 403 on one image host must not disable the search source (fixed: downloads back off per host).
- Every source is paced per key; 429 waits 30 s, then 60 s, and a third in a row disables the source.

## NOT verified

- Any Pixabay or Unsplash query (this session cannot reach either host; a runner can).
- That a fetched photograph is the right object — open the contact sheet the job uploads.
- The wiring of cutouts, symbols and SCENE-FULL photographs into the planner and renderer
  (Tasks 2-4 of the cutout brief), the shadow, placement, animations, and any CI run of them.
