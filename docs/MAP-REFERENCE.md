# Map reference — editorial motion-graphics maps

Written before the map family was rebuilt, as the spec for it.

**How this was researched, and where it stops.** Web search ran on
2026-09-24. Every candidate page (nofilmschool.com, medium.com,
cliptude.com, lilys.ai) was **blocked by this environment's egress proxy**,
so no page was read in full. Everything below comes from the search engine's
excerpts of those pages, and each point is attributed to the page the excerpt
came from. No page was read beyond those excerpts, and no Vox video was
watched. A human who can open the links should check the points marked *(excerpt)*.

## References

| URL | Why it is here |
|---|---|
| https://nofilmschool.com/how-create-vox-style-map-animations-after-effects | Names the production stack behind Vox maps (GEOlayers in After Effects), which tells us the look is a styled vector map, not satellite imagery. |
| https://medium.com/google-earth/how-vox-video-uses-earth-studio-for-dynamic-visual-storytelling-703fc871766e | Vox's own account of camera moves on maps (zooms, slow orbits). It is the source for "the map enters by moving toward the region". |
| https://cliptude.com/vox-style-animation/ | The clearest one-sentence description of the Atlas/Borders map: "a clean, decluttered map that zooms toward a region, a country fills with an accent color, and callout lines and labels appear on cue". It also records the labels-stripped map style and animating on twos. |
| https://filmit.io/blog/map-animation-simple | Gives the route technique precisely: a dashed stroke whose trim-path End is keyframed 0→100%, so the route draws itself. |
| https://www.premiumbeat.com/blog/making-maps-for-johnny-harris/ | The Borders series: the camera animates latitude, longitude, zoom, bearing and pitch, with bearing offset so the camera "comes down and orbits". |
| https://observablehq.com/blog/effective-animation | The data-layer rule on the news side: animated maps work when each state answers one question; choropleth shading plus animated overlays show change (the Reuters Ukraine maps). |

## 1. How borders are simplified

- The base map is **decluttered**: a custom map style with **labels stripped
  out** *(excerpt, cliptude)*. Roads, terrain, city names and minor
  borders go. Land/sea and the relevant national borders stay.
- Borders are clean vector outlines. The highlighted country's outline
  comes from its own shape, not a hand-drawn blob *(excerpt, filmit: "clear
  outlines and borders around highlighted countries")*.
- **For this system:** real boundary data simplified to a low point count,
  enough that the silhouette stays recognisable (Venezuela must read as
  Venezuela). Neighbouring countries are drawn quietly around it for
  context, not left out. No terrain, no roads, no text baked into the map.

## 2. How data is layered on top

- The primary data layer is **the region itself filled with an accent
  colour** *(excerpt, cliptude)*. The region is the shape, not a dot inside
  a shape.
- News maps add **choropleth shading plus animated overlays** for change,
  and dot maps for counts and spread (Bloomberg's store-expansion dots)
  *(excerpt, observable)*.
- Movement is a **dashed route stroke** that travels from origin to
  destination *(excerpt, filmit)*.
- **For this system:** accent-filled region; N sequential markers for a
  count; a dashed route that draws itself for movement.

## 3. How the map enters

- **Camera moves toward the region**: zooms, slow orbits, "comes down and
  orbits" *(excerpt, Earth Studio; premiumbeat)*.
- Outlines and routes **draw on** with a stroke reveal (trim paths 0→100%)
  *(excerpt, filmit)*. They are not faded in.
- Motion is often **on twos**, 12 fps inside a 24 fps timeline, which
  gives the handmade feel *(excerpt, cliptude)*.
- **For this system:** the outline draws stroke by stroke. A sweep then
  reveals the region fill. A light push-in toward the region is the
  camera move this renderer can afford. There is no 3D orbit.

## 4. How labels attach

- "**Callout lines and labels appear on cue**" *(excerpt, cliptude)*: a
  thin line from the region to the text, appearing after the region is
  established, timed to the narration.
- A destination is connected to its label with "a dotted, curved line"
  *(excerpt, lilys.ai via search)*.
- **For this system:** after the fill, a leader line draws from the region
  to the label, then the label types on.

## 5. How the map exits

- No excerpt described exits specifically. The pattern visible across the
  excerpts is that **the map is the ground the next state builds on**: the
  camera moves on to the next region, or a new overlay (route, shading)
  arrives on the same map. Nothing cuts to a new card.
- **For this system:** the map holds its final state to the end of the
  beat. The beat transition carries it out. This is a gap to verify
  against real footage.

## The map this system should draw, in one paragraph

A clean white (or channel-ground) frame. The target country is a real,
simplified outline with its neighbours in quiet strokes around it. The
outline draws itself, then an accent sweep fills the country. Markers or a
dashed route arrive in sequence if the sentence has a count or a movement.
Last, a thin leader line runs to a label that types itself on. The map
carries no baked text and no terrain.
