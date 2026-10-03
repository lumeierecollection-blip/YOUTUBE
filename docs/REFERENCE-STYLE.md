# Reference style — extracted from the source video

Source: `data/reference/style.mp4` (supplied 2026-09-28; 39.64 s, 576×1024
9:16, 30 fps). Sampled at 2 fps into `data/reference/frames/` (79 frames);
every frame was looked at. Positions below were MEASURED from pixels
(576×1024), and are given scaled to the 1080×1920 render canvas (×1.875).
Where a value is an estimate from eye, it says so.

Examples: `docs/reference-examples/` — f0005 (2.0 s), f0017 (8.0 s),
f0023 (11.0 s), f0027 (13.0 s), f0045 (22.0 s), f0071 (35.0 s).

## Colors
- Background: `#FFFFFF`, with soft grey **palm-frond shadows** (not
  window blinds) falling across the top-right and left of the frame;
  measured darkest luminance 169 (right) and 109 (left). Static.
- Paper: `#FFFFFF` (some beats a faint cool tint, `#F6FCFE`).
- Paper edge shadow: hard, darkest along the RIGHT edge (`#A4A4A5`), soft
  under the bottom.
- Text: black (≈ `#0A0A0A`), with grey (≈ `#9A9A9A`) for words not yet
  "typed" and for light secondary words.
- Cutouts: grayscale only.
- Accent: none on the paper. The only colour in the frame is the editing
  timeline: purple `#802080` / violet `#602080` clips, green `#60C000`
  clips, a cyan audio waveform, on a device fill of `#292929`.

## Layout (9:16) — measured, identical in every sampled frame
| Element | 576×1024 | 1080×1920 |
|---|---|---|
| Paper | x 148–428, y 128–622 (280×494) | x 278–802, y 240–1166 (524×926) |
| Branding rail "MY EDIT" | x 114–138, y 293–444 | x 214–259, y 549–833 |
| Timeline device | x 70–491, y 651–838 | x 131–921, y 1221–1571 |

- The paper is flat: no visible 3D rotation (eye estimate: ≤ 1°).
- The rail sits LEFT of the paper, vertically centred on it, rotated
  90° counter-clockwise (reads bottom to top).
- The device is a rounded black slab in slight perspective (its left end
  sits lower than its right), with a soft shadow. It shows a
  Premiere-style timeline: a ruler, ~6 tracks of purple/violet/green
  clips, an audio waveform, and a playhead that moves left-to-right.
- Everything below the device and above the paper is empty background.
- Zones on the paper (eye estimate, % of the paper's own box):
  - headline zone: upper third (y 8–35%), usually starting near the left
    third, sometimes centred;
  - cutout zone: centre (y 30–70%), sized 35–60% of the paper's width,
    often overlapping a paper edge or corner (coins, cans, bills extend
    off the page);
  - caption/body zone: under the headline or under the cutout (y 55–80%).

## Typography
- **Lead-in:** italic serif, small (≈ 3% of paper width), black or
  grey: "watch how", "went from", "they are selling", "to the tagline",
  "by being impossible". Nearest vendored font: Playfair Display Italic.
- **Headline:** bold grotesk sans, tight tracking, 1–3 words, UPPERCASE
  for punchlines ("LIQUID DEATH", "3 MILLION DOLLARS", "REBELLION",
  "MURDER YOUR THIRST", "ROAR") and lowercase bold for phrases ("1.4
  billion dollar brand", "a place in a", "wild influencer collabs").
  Nearest vendored font: Inter 700.
- **Body:** a tiny 3–4 line paragraph (≈ 1.2% of paper width) under a
  headline — texture, not meant to be read. Inter 400.
- **Annotation marks:** design-tool selection boxes with corner handles
  drawn around a word ("name", "cans", "BRAND ENTERTAINMENT",
  "BEVERAGE"); four-point sparkle bullets (✦ meaning / sustainability /
  culture).

## Motion
- **Camera: static.** Paper, rail and device do not move in any sampled
  frame (device box identical at 2.0, 8.0, 22.0, 30.0 and 37.0 s).
- All motion is ON the paper, plus the timeline playhead.
- **Beats:** 16 content beats in 39.6 s — average ≈ 2.5 s.
- Motions observed on the paper:
  - words type on one at a time; a word appears grey, then turns black;
  - text resolves from a blur ("REBELLION" at 8.5 → 9.0 s);
  - a cutout scales/pops in, often with a soft shadow under it;
  - objects fly or fall across the page (dollar bills, 4.5–6.0 s);
  - thin circles / dotted rings draw around the cutout;
  - black **petal / leaf clusters** grow in from the paper's corners
    (10.0–14.0 s); black **swoosh arcs** sweep across a corner (20–24 s,
    28–29 s); thin hairline curves cross the page;
  - dot grids and faint square grids fade in behind the content;
  - phone mockups (black rounded frame) slide in holding a grayscale photo.
- **Transitions:** on the SAME paper — the content clears (7.5 s shows an
  empty page), then the next beat builds. The page itself never cuts.
- At the very end (38.0 s on) the timeline empties.

## Beat composition
- Every content beat has: the paper, the rail, the timeline device, and
  on the paper a headline (usually with an italic lead-in) plus ONE hero
  cutout or phone mockup; about half add a black abstract shape (petals,
  swoosh, arcs) and/or a grid/rings.
- Typical beat: an italic lead-in and a bold headline in the upper third,
  a grayscale object cutout in the middle with a soft shadow and a thin
  ring around it, a tiny paragraph below, a black petal or swoosh
  entering from a corner — the words typing on over the beat.

## Known conflict with an existing gate
`scripts/frame-audit.js` (MOTION-GRAPHICS-MANUAL A2.1) requires the
background margins to be flat. The reference's palm-frond shadows are
deliberately NOT flat. Building to the reference will fail that gate
wherever a shadow crosses a margin probe; that is recorded in
`data/ci-runs/blocked-reference-vs-flat-bg.txt` if it happens, not
worked around.
