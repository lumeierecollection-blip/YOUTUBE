# AI Tested master reference: analysis and reconstructed production blueprint

Source: `C:\Users\user\Downloads\ai tested.mp4`, copied to `data/ai-tested/production-v7/reference/ai-tested-reference.mp4`
(sha256 `1535e3c10a51af428f4b7da059b4be5651ded2252398992eeec136227fc1e066`).
Measured with ffprobe/ffmpeg: 720x1280, 30 fps, 18.157 s, one AAC audio stream, integrated loudness -17.1 LUFS, LRA 2.5 LU, true peak -1.0 dBFS.
Evidence: `reference/frames/f001..f072.jpg` (4 fps), `reference/sheets/*.png` (contact sheets), `reference/ref-audio.wav`.
Frame times below are read off the 0.5 s contact sheet, so treat them as +-0.5 s. Scene-cut times come from ffmpeg `select=gt(scene,0.08)`.

Honest limits: this is one 18-second sample about Google's "ReasoningBank" (AI memory). The narration is in the captions
("Have you ever wondered why you need to keep explaining the same thing to ChatGPT, because the most advanced AI models have zero
memory. They can write code, solve problems, plan projects. Then forget everything the second the conversation ends. So a team from
Google Cloud AI and the University of Illinois build something called ReasoningBank"). I cannot isolate individual SFX from the mixed
track, only energy onsets. The reference video is one sample; it shows the style law, not every scene type we need (line charts,
timelines). Where the reference has no precedent I say so and extend it with its own grammar rather than a new style.

## 1. The identity, in one paragraph

A kinetic-typography explainer. The base canvas is pale warm-grey paper (about `#ced0cd`) with a fine vertical CRT scan-line texture and
a faint vignette. Narration is shown one to three words at a time in an elegant high-contrast italic serif, popping in with a defocus-to-sharp
resolve. Every phrase gets a real picture: a photo in a thin white print border, a real logo on a rounded black tile, a screenshot, stock footage
or a rendered 3D object. Roughly every 1 to 2 seconds the paper scene is interrupted by a full-bleed dark scene (footage, dithered planet,
3D render, terminal) with heavy bold-grotesk words and a coloured highlight bar. Transitions are hard cuts, blur-resolves and digital glitch
(pixel-sort smear). No camera movement, no gradients, no neon UI chrome, no per-video colour theme.

## 2. Palette (measured and eyeballed from frames)

| Role | Value | Where |
|---|---|---|
| Paper | `#ced0cd` (frame bg samples `#c1c3c0` to `#d3d5d2`) | 60% of runtime |
| Ink | near-black `#0b0c0b`, serif italic | words on paper |
| Void | `#050704` to `#1e201d` | full-bleed dark scenes |
| White | `#ffffff` | words on dark, photo borders |
| Highlight bars | blue `#1a2cff`, pale yellow `#f1e9a8`, red `#d9232a` | one emphasised word per phrase, set in bold grotesk |
| Accent text | green `#1a9e7e` ("chat gpt" script) and cyan `#6ee7e0` (terminal text) | brand-matched colour for a named product |
| Photo tone | warm, slightly desaturated, soft grain, some blurred/defocused | lead image at 0 s is deliberately out of focus |

Mapped to our config: the existing ch-02 identity colours in `channels.json` stay the single source of truth; the reference palette above is
what the ch-02 look is rebuilt to. No new per-video palette is introduced.

## 3. Typography hierarchy

1. Narration words: high-contrast condensed italic serif (Instrument Serif Italic is the closest free match; Cormorant Garamond Italic is the fallback).
   Sizes seen: small connector words ~5% of frame width ("The", "so", "the"), standard words ~11 to 14%, emphasis words (e.g. "everything") ~22%.
   Mixed size inside one phrase ("The **same** thing to": small / large / small stacked) is a key signature.
2. Emphasis nouns on dark scenes: heavy neo-grotesk bold (Inter Tight / Helvetica Neue Bold equivalent), mixed case, with a flat colour bar behind one word.
3. Counter/numerals: "(03)" bold grotesk in parentheses at the left of a paper collage, i.e. a structural chapter marker.
4. Brand-coloured script for a product name ("chat gpt" in green), always paired with that product's real logo tile.
5. Position: words track the subject, sitting on or just beside the picture, not in a headline strip at the top. Words are never boxed.

## 4. Timestamped scene log

| t (s) | Visual | Words | Size/position of subject | Transition in |
|---|---|---|---|---|
| 0.0 to 0.7 | Out-of-focus warm film still, woman seated at window, full-bleed left and ~85% height | "Have you ever" | full-bleed, subject left-weighted | opens on the frame (no fade) |
| 0.7 to 1.2 | Same still sharpening, 1.0 s push | "wondered" | same | blur-resolve |
| 1.2 to 2.0 | MRI brain scan, white print border, centred | "why you need to / keep explaining" | ~75% of width, vertically centred | hard cut |
| 2.0 to 2.7 | Paper. Small ChatGPT tile appears under "The same" | "The same" | tile ~15% width | cut to paper |
| 2.7 to 3.3 | Tile grows to ~34% width, green "chat" appears below | "thing to chat" | tile centred, ~33% width | scale-up |
| 3.3 to 3.9 | Paper with ghosted chat UI behind the tile | "gpt" | tile + faint screenshot full-bleed | crossfade |
| 3.9 to 4.5 | Paper, one word | "because", "the" | none (typography only, ~0.5 s each) | cut |
| 4.5 to 5.0 | Black. Dithered planet top-right, white vertical bar, blue bar | "Most adva(nced)" | planet ~25% width | hard cut + glitch |
| 5.0 to 5.5 | White. Collage of fragments, yellow bar, "(03)" | "advanced" | busy paper collage | cut |
| 5.5 to 6.5 | Dark 3D sphere over an empty hall, centred | "Have zero memory" | sphere ~55% width, mid frame | cut |
| 6.5 to 7.5 | Dark then light: floating code windows | "write code" | windows fill frame | cut / dissolve |
| 7.5 to 8.0 | Blank paper | none | none | cut |
| 8.0 to 8.5 | Black, silver helix object | "solve problems" | helix ~70% of height | cut |
| 8.5 to 9.0 | Paper, three office photos scattered at different sizes | "plan projects" (red bar) | photos 18 to 25% width each | cut |
| 9.0 to 10.0 | Paper, word-only beats | "Then", "Then forget", "everything" | type only, "everything" ~22% | cut |
| 10.0 to 11.5 | Chess pawn photo, wide, white print border | "The second the conversation" (words stacked above and below the photo) | ~70% width | cut |
| 11.5 to 12.5 | Photo keeps moving; "conversation ends" | | same | continuous |
| 12.5 to 13.3 | Paper | "so" | type only | cut |
| 13.3 to 15.0 | Google collage: 4 stacked photos, "G" logo | "A team from Google cloud AI" | cluster ~55% width, left of centre | cut then build |
| 15.0 to 15.5 | Glitch pixel-sort smear of a photo | | full-width ~50% height | glitch |
| 15.5 to 16.5 | University of Illinois building photo, banded | "and the University of Illinois" (italic over image) | ~85% width | cut |
| 16.5 to 17.5 | Terminal screen, cyan text, red highlight bar | "build something called" | full-bleed footage | cut |
| 17.5 to 18.2 | Paper | "Reasoning bank" | type only | cut |

Visual-change rate: 70 detected scene-change events in 18.2 s, i.e. a new look every 0.26 s counting word swaps, a new picture roughly every 0.6 to 0.9 s.
Content coverage (my own 72-frame measure): 31% of the frames are paper with almost no ink (coverage below 5%), 25% are full-bleed dark scenes, the remaining 44% are paper plus a picture.
The reference is therefore NOT a "no empty canvas" design. The user's brief asks for the opposite on empty space, so the rule I adopt is:
paper word-only beats stay (they are part of the identity) but never exceed 0.7 s in a row, and every phrase beat above 0.7 s must carry a picture at 40% width or larger.

## 5. Photo and logo treatment

* Photos: real, slightly soft, thin 2 to 3 px white border with a faint outer rule (print-photo look). Sizes: 18 to 85% of width. Not drop-shadowed.
* Defocus-in on arrival (blur ~8 px to 0 in ~6 frames) and a slight ghost/echo trail on departure.
* Logos: ChatGPT mark is white on a rounded black square tile with ~14% corner radius, centred, ~33% of width at its largest. Never a bare corner watermark.
* Stacked-photo cluster (Google): 4 photos, each rotated 0 to 2 degrees, overlapping, one cut-out person (Sundar Pichai) on top. That is the model for our cutout_hero scene.
* Dithered / halftone planet, dark 3D renders: used as a "concept" image when there is no photograph of the idea.

## 6. Motion and transitions

* Word reveal: scale 0.92 to 1, blur 6 px to 0, opacity 0 to 1 over ~5 to 7 frames (ease-out). Words overwrite each other; at most 3 visible.
* Picture reveal: scale from 0.9 with the same blur-resolve; some pictures slide in 20 to 40 px.
* Cuts: hard cuts on word onsets, 70% of transitions. Glitch: horizontal slice displacement with cyan/orange fringing for 3 to 5 frames (seen at 4.5 s and 15 s).
* Paper/dark alternation as rhythm: 3 dark scenes in 18 s.
* No camera moves, no continuous zoom on paper scenes; the only drift is a slow 1.00 to 1.04 push on photographs.

## 7. Audio (measured)

* Mix: voice always dominant at about -17 LUFS integrated, LRA 2.5 LU, so there is very little dynamic swing; true peak -1.0 dBFS.
* Energy onsets in the track at 1.7, 2.7, 3.5, 6.6, 7.5, 7.8, 8.4, 9.3, 10.5, 12.0, 12.5, 13.3 s, which line up with picture changes (MRI cut, tile growth, dark scene
  cut at 6.6, chess at 10.5, "so" at 12.0). Gaps at 6.5 s (-32 dBFS) and 9.0 s (-29 dBFS) are real micro-silences before a hit: SFX land after a short hole.
* Low bed under the voice (music/ambience), no obvious melody. Dark scenes carry a low thump or whoosh; typing/tick on the code scene is plausible but I cannot prove it from the mix.
* Honest limit: individual SFX types cannot be separated from the mixed file, so the SFX style rule is "short, dry, transient-led hits on the picture change, varied per event type, voice never masked".
  Our own mix keeps the established -14 LUFS short-form target in `render-all.mjs` only if the user prefers loudness over reference parity; see decision D1 in the blueprint.

## 8. Reconstructed production blueprint (what the renderer must do)

Scene vocabulary (replaces the old scene list; each maps to a measured reference scene):

| New scene | Reference source | Notes |
|---|---|---|
| `paper_word` | 3.9 to 4.5, 9.0 to 10.0, 12.5 to 13.3, 17.5 to 18.2 | 1 to 3 serif words, mixed sizes, <= 0.7 s |
| `photo_frame` | MRI 1.2 s, chess 10.0 s, Illinois 15.5 s | real photo in white print border, 60 to 85% width, words stacked above/below |
| `logo_tile` | ChatGPT 2.0 to 3.9 | real logo on rounded black tile, 30 to 40% width, brand-colour script word |
| `photo_cluster` | Google 13.3 to 15.0 | 3 to 4 overlapping real photos, one cutout on top, 50 to 60% width |
| `dark_full` | planet, 3D sphere, helix, terminal | full-bleed real footage/screenshot/render, heavy grotesk words, one highlight bar |
| `ui_windows` | code windows 6.5 to 7.5 | real screenshots as floating windows, large |
| `glitch_cut` | 4.5 s, 15.0 s | 3 to 5 frame transition, not a scene |
| `line_chart`, `timeline`, `stat_counter`, `compare` | no reference precedent | drawn in the same paper + serif + grotesk-highlight grammar, real data only, large (>= 70% width) |

Rules distilled:
1. A new picture or typographic state every 0.5 to 1.0 s; a dark scene every 4 to 6 s.
2. Every picture >= 40% of canvas width, logos >= 30%, hero photos 70 to 85%; no logo smaller than 25% width and none in a corner.
3. Words ride the pictures. Never a top headline strip with an empty lower canvas.
4. Real assets only (photos, screenshots, logos, footage frames) with a per-video asset manifest. Rendered-by-us abstract objects only where the reference uses them, and labelled as illustration.
5. Paper texture: scan-line overlay, vignette, grain, applied to every scene including dark ones at low opacity.
6. Audio: voice + low music bed + ambience, varied SFX per event type (hit on cut, tick on counter, riser into reveal, glitch on glitch, soft click on chip), ducked under voice.
7. Charts use the same visual voice: serif axis labels, black ink line on paper, highlight bar behind the key number, real data series only.

Decisions I made (flagged, challengeable):
* D1: loudness stays at -14 LUFS / -1.5 dBTP for upload because our previous Shorts used it; the reference is -17.1 LUFS. Changing to -16 is a one-line edit if you want reference parity.
* D2: fonts. The reference fonts are not identifiable with certainty from pixels; Instrument Serif Italic + Inter Tight Bold are my closest match from Google Fonts.
* D3: the reference's 3D rendered objects (sphere, helix) cannot be reproduced honestly with real assets; we use dithered/halftone treatment of real photos or footage instead.
