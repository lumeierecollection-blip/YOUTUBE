# Hidden Past: skills and tools inspected

Repo commit when written: `c31a1ee68e39f7782c0cf974c761d3d8889536a2` (origin/feat/platform).
Nothing here needs a Claude session to make a future video.

## Used (reused unedited)

| Component | What it does | Pin | Used for |
|---|---|---|---|
| `.agents/skills/vox-style-treatment/SKILL.md` (repo skill, no external licence) | Acceptance bar: per-photo vignette, halftone, grain, desaturated grade; one accent; no photograph zoom; annotation circles stroke-drawn; book-style chapter openers; visual evidence first | last changed in `461233c6` | Shaped every scene; `voxGate` checks its measurable parts on the MP4 |
| `src/skills/remotion-render/effects/PhotoTreatment.jsx` via composition `VoxStill` | Real vignette / halftone / grain / chromatic aberration / editorial LUT on one image | `66b46965` | All four pictures (two photographs, newspaper, map) baked once each; gamma restored with `eq=gamma=2.2` as `bakeStills` does |
| `scripts/autopilot/map-vox.mjs` `buildMapLayers` | Frames and tints a country, names neighbours, draws pin and ring and a world locator, from Natural Earth | repo | Modern map of Sarajevo (scene 1) |
| `scripts/autopilot/vox-gate.mjs` `voxGate` | Measures the final MP4 against the plan: photo stability, grade, vignette, halftone, grain, annotation draw-on, chapter motion | repo | `qa-report.json`, `vox-compliance-report.json` |
| `scripts/autopilot/visual-common.mjs` | Text fit, layout check, palette, paper background, captions | repo | Layout and captions |
| `tools.renderTimeline` (Remotion 4.0.507) | Renders the editor timeline | repo | The MP4 |

## Added in this channel's own paths

- Document treatment (`treatDocument` in `preview.mjs`): greyscale ink or muted colour, normalised, multiplied onto the paper tone, then PhotoTreatment at a low halftone so small type survives. Applied only to scans confirmed public domain on Commons.
- Dated historical map scene: the Andree / Times Atlas ethnographic map (base 1895; 1914 and 1920 borders added later) shown unmoving with a date tag and a plain statement of which parts were added later. The 1914 red line differs from the modern map shown just before.
- Claim ladder: on-screen labels PRIMARY SOURCE vs LATER INTERPRETATION.

## Data and sound licences

- Natural Earth 1:50m and 1:110m: public domain (`src/skills/remotion-render/public/geo/LICENSE-natural-earth.md`).
- whoosh.mp3 and impact.mp3: CC0 (`public/sfx/CREDITS.md`).
- Images: Wikimedia Commons, each verified `Public domain` through the API at run time; licence, creator and URL recorded in `sources.json` and `qa-report.json`.
- Voice: edge-tts `en-GB-RyanNeural`, generated speech. Narration is PROVISIONAL.

## Not used, and why

No external specialist repository was assigned for this channel beyond the repo skill above, so none was cloned.
