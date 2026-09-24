# Map audit — the map family in the object library

Audited 2026-09-24 at `6c383cd`, before the rebuild. Scope: every
map-related drawing in `compositions/objects/{index,library,nature}.jsx`
(found with the grep in the task, then read one by one).

"Geographic?" asks whether the drawing uses real border data. **None does.**
There is no boundary data anywhere in the repo (no `public/geo/`, no geojson
outside skill examples).

| Drawing | File | What it draws | Animated? | Geographic? | Missing |
|---|---|---|---|---|---|
| `territory fill` | index.jsx | `territoryPath()`: 11 points around an ellipse, "wobbled" by a seeded hash. Accent fill + accent stroke | Fill opacity ramps with `p`; the outline is static | **No — placeholder polygon** | Real borders, draw-on outline, sweep, label |
| `national border line` | index.jsx | The same seeded 11-point wobble, stroked | Yes: the stroke draws on (dashoffset) | **No — placeholder polygon** | Real borders, fill, label |
| `state map` | library.jsx | A paper sheet with a **hand-written 6-point polygon**, a dashed "county line" and one accent dot in the middle. This is the "Venezuela" shape from the owner's review | Fill opacity ramps; the rest is static | **No — placeholder polygon** | Real borders, sweep, markers, leader label; the dot-in-a-polygon is the rejected pattern |
| `archival map sheet` | library.jsx | A paper sheet with 4 nested ellipse "contours", a river curve and a small grid | Sequenced: the contours appear one by one | No, but by design: it depicts a map *document*, not a place | Nothing for its purpose; not a geography drawing |
| `supply route` | library.jsx | A fixed S-curve between two generic dots, with a chevron | Yes: the route draws on | **No — the curve joins no real places** | Real origin/destination |
| `resource site marker` | library.jsx | A derrick over a map pin, with a plume | The plume grows with `p` | No, by design: a pictorial object, not a map | — |
| `earth globe` | nature.jsx | A sphere with turning meridians and one invented blob "landmass" | Yes: the meridians spin | **No — the landmass is invented** | Not in the rebuild's scope (a globe, not a region map) |

## Summary

- **7 map-related drawings; 0 use real geography.**
- **4 are the failing family** (placeholder geography standing in for a
  real place): `territory fill`, `national border line`, `state map`,
  `supply route`.
- 2 are not geography by design (`archival map sheet`, `resource site
  marker`), so they are kept as they are.
- `earth globe` also has an invented landmass, but it is a globe, not a
  region map. It is noted here, not rebuilt.

## What replaced the failing family

`compositions/objects/maps.jsx`, built on Natural Earth 110m borders
(`public/geo/`, public domain, simplified to at most 50 points per region by
`visual/build-geo-regions.mjs`):
`map-outline`, `map-region-highlight`, `map-markers`, `map-route`,
`map-label`.

The four failing names now delegate to that engine whenever they are given a
real region, which is always the case through ComposedScene, because
`validateScene()` rejects a map whose label is not a country or US state. The
older `template-scene` path passes no region at all (its objects come from
`config/visual-identity.json`, with no label), so there the four names still
draw their old placeholder. That path is not the V2 pipeline. It is left
alone rather than given invented borders, and it remains a known gap.
