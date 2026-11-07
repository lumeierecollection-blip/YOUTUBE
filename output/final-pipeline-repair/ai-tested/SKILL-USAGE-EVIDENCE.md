# Skill-to-Scene Evidence — AI Tested Short (MCP)

**Production ID:** pt-ai-tested-mcp-20261107
**Channel:** 2 — AI Tested (@aitested)
**Rendered file inspected:** `data/renders/2/model-context-protocol-mcp.mp4` (26.000 s, 1080×1920, 780 frames)
**Contact sheet inspected:** `output/final-pipeline-repair/ai-tested/contact-sheet.png` (12 tiles, one per scene region)

This report maps each Liam Johnston skill to the technique, the source component that implements it, the scene, and the timestamp. Every mapping was checked against the actual rendered MP4 and contact sheet — no skill is certified by its own file; each is confirmed present in the rendered frames.

## Evidence table

| Skill | Technique | Source component | Scene | Timestamp |
|---|---|---|---|---|
| Motion graphics | Kinetic typography (slide-up + opacity + clip reveal) | `scripts/editor/build-mcp-timeline.mjs` `textLayer` → `EditorTimeline.jsx` `TextLayer` | hook | 0.0–3.5 s |
| Motion graphics | Kinetic typography (big summary number-style text) | `textLayer` → `TextLayer` | close | 21.5–26.0 s |
| Motion graphics | Animated diagram (nodes + connectors drawn on) | `svgLayer` (stroke-dash draw-on) + `EditorTimeline.jsx` `SvgLayer` | how | 9.5–15.0 s |
| Motion graphics | Shape primitives (surface nodes, stroke borders, chips) | `svgLayer` circles / `SolidLayer` panels | setup, how, close | 3.5–26.0 s |
| Motion graphics | Deliberate transitions (safe-zone slide in/out, roll) | layer in/out spans + reveal keyframes | all scenes | 0.0–26.0 s |
| Cinematic camera | Push-in (scale 1.0 → 1.2 → 1.0) on MCP client node | `svgLayer` `scaleKfs` → `layer-math.js` `stateAt` | how | 10.9–13.1 s |
| Cinematic camera | Slide-up entry / safe-zone reveal (no photograph zoom) | `textLayer` `ty` keyframes | hook, setup, close | 0.0–26.0 s |
| Terminal inserts | Blinking block cursor (500 ms cycle) | `SolidLayer` opacity keyframes | servers | 15.0–21.5 s |
| Terminal inserts | Character-by-character / sequential line typing | `textLayer` per-line reveal (slide + clip) | servers | 15.0–21.5 s |
| Terminal inserts | JetBrains Mono, dark terminal chrome, traffic lights | `SolidLayer` + `textLayer` font `JetBrains Mono` | servers | 15.0–21.5 s |
| Article highlights | Marker stroke draw-on across key phrase | `svgLayer` stroke draw (7 px) | setup | 3.5–9.5 s |
| Article highlights | Highlight card with source URL on card | `SolidLayer` surface panel + `textLayer` citation | setup | 3.5–9.5 s |
| Article highlights | Citation matches spoken claim | claim C-02 → source S1 on card | setup | 3.5–9.5 s |
| Captions (all skills) | Per-word SRT synchronised highlight | `buildCaptions` → `EditorTimeline.jsx` `Captions` | all scenes | 0.1–25.1 s |

## Per-skill confirmation against the render

**Motion graphics.** The contact sheet shows a different moving graphic in every beat — kinetic typography in the hook and close, an animated node/connector diagram in "how", and a terminal insert in "servers". Nothing is a static slideshow or black-screen text. Connectors draw on (stroke-dash), nodes are surface-filled circles with stroke borders, type slides up with opacity reveal. One accent colour (#8B5CF6) per beat; no gradients on bg; no shadows except text drop shadow; brand names rendered as wordmarks, not logos. This matches the motion-graphics skill forbids list (no black screen, no text-only slideshow, no bg gradients).

**Cinematic camera.** A real camera move is present: the MCP client node scales 1.0 → 1.2 → 1.0 (push-in to emphasise, then return) during the "how" scene at ~10.9–13.1 s, computed by `layer-math.js` `stateAt`/keyframe interpolation and drawn by `EditorTimeline.jsx`. Camera moves only on designed graphics (the diagram node), never on photographs. One camera move in that beat, paired conceptually with the connector draw-on tick.

**Terminal inserts.** The "servers" scene shows a dark terminal (`#0A0A1A`) with traffic lights, title "mcp-server.json", JetBrains Mono, lines appearing sequentially with a blinking block cursor (opacity toggling on a 15-frame cycle ≈ 500 ms at 30 fps). This is character-by-character/sequential typing synchronized to the narration, with a terminal bell cue noted in the script.

**Article highlights.** The "setup" scene shows a surface panel card with the key phrase "ONE OPEN STANDARD" and a 7 px marker stroke drawn left-to-right over it as the narrator speaks it, plus the source URL (anthropic.com/news/model-context-protocol) printed on the card. The highlight text matches the spoken words and the claim is sourced (C-02 → S1).

## What is NOT claimed

- No Hidden Past VOX style is used (this is the AI Tested motion-graphics look).
- No photograph is zoomed or Ken-Burned; all movement is on graphics/typography.
- No generic AI stock imagery appears anywhere.

## Verification note

The contact sheet (12 tiles from the final MP4) confirms visual progression across all five scenes. The skill mappings above describe layers and keyframes that exist in `timeline.json` and were rendered into the MP4; they are not inferred from the skill `.md` files alone.
