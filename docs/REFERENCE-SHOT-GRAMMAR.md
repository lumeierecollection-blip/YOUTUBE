# Reference shot grammar

What the reference videos actually do, shot by shot, and which of those shots the canvas renderer
now draws. Written 2026-10-09 from contact sheets of the files below (1 frame per second for the
portrait set, 20 evenly spaced frames for each landscape reel). Nothing here is inferred from a
style document; every shot cites the timestamp it was seen at.

## The references

| Reference | Path | Used by |
|---|---|---|
| Shared portrait set (9:16) | `research/motion-graphics-ref/ref-01.mp4` (79.4 s), `ref-02.mp4` (5.0 s), `ref-03.mp4` (16.8 s) | Every channel without its own style spec — on the priority board: ch-1, 2, 9, 26, 44, 49 (`scripts/reference-frames.js` `SHARED_REFS`; Layer 2 scores every channel against the same three) |
| ch-05 Broadsheet | `research/4_5917850534521349135.mp4` (16:9, 62.8 s) | `channels/ch-05/style-spec.json` `reference_video` |
| ch-06 | `research/4_5917850534521349255.mp4` (16:9, 65.1 s) | `channels/ch-06/style-spec.json` |
| ch-08 | `research/4_5917850534521349257.mp4` (16:9, 60.0 s) | `channels/ch-08/style-spec.json` |
| ch-10 | `research/4_5917850534521349264.mp4` (16:9, 23.1 s) | `channels/ch-10/style-spec.json` |

There is no single reference. The shared portrait set is **the** reference for the grammar below:
it is the only 9:16 reference (the format every channel ships), it is what six of the ten priority
channels plan against, and it is what Layer 2 compares every render with. The four landscape reels
are template-pack promos; the shots they add are listed separately (22-30).

## The shot list

Shared portrait set (`ref-01` unless marked):

1. **Stack over object** — serif words stacked centre-top in mixed sizes, built word by word; one
   cutout object centred mid-frame; more words may land below it. (0:00-0:04; 0:56-1:02)
2. **Photo top, caption below** — a real photo fills the top half edge to edge; a short serif
   caption sits under it on the paper. (0:05)
3. **Caption over a cropped document** — the caption mid-frame, a document / book cover inset low
   and cropped by the bottom edge. (0:06)
4. **Card with words around it** — a document card centred, words above and below, one accent
   word in the side margin. (0:07)
5. **Edge-cropped image, phrase on the other side** — a scan cropped by the left frame edge, the
   phrase to its right. (0:08; `ref-02` 0:02-0:05, a lantern cropped by the left edge)
6. **Field with a gap** — the frame tiled with many small drawings / icons, the phrase in a gap.
   (0:10-0:11; 0:54-0:55)
7. **Border frame** — an ornamental border round the frame, text inside it, an illustration at one
   side. (0:12)
8. **Low heavy object** — a large object fills the lower half, a short line high above it with air
   between. (0:13-0:14; 1:04-1:05)
9. **Text inside the object** — the frame is a photographed device; the words sit inside its
   screen. (0:15-0:18; 0:30-0:39; 1:10-1:14)
10. **Archival page, full bleed** — a scanned page fills the frame; a title and a paragraph sit on
    its paper. (0:20-0:26)
11. **Macro full bleed, one line across the middle** — a close-up fills the frame; one line of
    text across its middle. (0:27-0:28)
12. **Full-bleed screen, words stepping in upper right** — (0:43-0:46)
13. **Scatter** — several cutouts at angles across the frame, some cropped by its edges, little or
    no text. (0:47-0:49; `ref-02` 0:00-0:01 money stacks from opposite corners round the words;
    `ref-03` 0:01-0:02 bags hanging from the top)
14. **Dark ground: corner date, object, stepped words** — a big date top-left, a device centred,
    words stepping down beside it. (0:50-0:53)
15. **Big word behind the subject** — a huge condensed word with a cutout figure crossing in front
    of it. (`ref-03` 0:02-0:04, 0:09-0:10)
16. **Spotlight stage** — a dark full-bleed scene under a spotlight; stacked words top-left and
    right; a caption low with one word on a highlight box. (`ref-03` 0:05-0:07)
17. **Torn strip** — a horizontal torn-paper strip across the middle reveals a photo; accent bars
    beside it; small words above and below. (`ref-03` 0:07-0:08)
18. **Small offset card** — a small rounded photo card with a shadow, off to one side, a small
    label above. (`ref-03` 0:00)
19. **Framed portrait with a label** — a portrait in a heavy soft-shadow frame, a short bold label
    above; portraits swap in place. (`ref-03` 0:12-0:14)
20. **Lone phrase** — one short phrase alone on the ground. (`ref-03` 0:15; `ref-01` 0:14)
21. **End card** — a logo centred on black. (1:15-1:18)

Per-channel landscape reels:

22. **Map with a highlighter tag** — (ch-05)
23. **Cutout portrait over a document collage** — (ch-05)
24. **A row of labelled cutouts** — (ch-05, "TAX" bags)
25. **Photo beside a stacked big word** — (ch-06, "MA-RA-TON", "HEAD LINER")
26. **Photo mosaic assembling** — (ch-06, ch-10)
27. **Two framed photos side by side** — (ch-06)
28. **Dated framed photo, year and a tag** — (ch-08)
29. **A word with a shape inline** — (ch-10, "its the ●")
30. **Text in a black box over branches** — (ch-10)

## What the renderer draws

Each built shot is a composition (`src/skills/remotion-render/visual/canvas-layout.js`
`SHOT_COMPOSITIONS`), chosen by Gemini per beat (`shot` in the visual plan) and drawn only when the
beat's content is something that shot frames. Code checks legality; it does not choose.

| Composition | Shot(s) | Frames | Division |
|---|---|---|---|
| `PHOTO-BAND` | 2 | a photo | photo bleeds off the top and both sides through the top band (y 0-604); headline low in the middle band |
| `PHOTO-EDGE` | 5, 25 | a photo | headline in the top band on one side; photo in the middle band bleeding off the opposite edge |
| `PHOTO-CARD` | 4, 19 | a photo | headline in the top band; the photo as a matted card with a soft shadow, centred, standing on the middle band's floor |
| `PHOTO-INSET` | 18 | a photo | headline in the top band on one side; a smaller rounded card with a hard offset shadow on the other |
| `PHOTO-STRIP` | 17 | a photo | headline in the top band; the photo as a torn strip across the middle band, accent bars on its edges |
| `SCENE-LOW` | 11, 16 | a photo | photo full bleed; headline low in the middle band over a darkened foot |
| `SCENE-FULL` / `ARCHITECTURE` | 10, 12 | a photo | photo full bleed; headline in the top band (unchanged) |
| `HERO-LOW` | 8 | a cutout / logo / symbol | a short line high in the top band; the object large on the middle band's floor, off to one side |
| `HERO-SCATTER` | 13 | 1-2 cutouts | headline in the top band; the objects off-centre at opposing angles (logos and money never tilt) |
| `TYPE-FULL` with a hero | 1 | a cutout / logo / symbol | headline top, object centred mid (unchanged) |
| `TYPE-FULL` statement | 20 | text | (unchanged) |
| `MAP-CENTERED` | 22 | a map | (unchanged) |

### Not built, and why

- **Centred type (1, 2, 4, 11, 20).** The reference centres its words. Layer 1 `canvas-type` fails
  a centred headline or one on the frame's centre line; the shots above are built with the text
  aligned to a side. Changing that is an owner decision about a gate, not a layout change.
- **Words over or behind an object (14, 15, 1's lower words).** Layer 1 `zones-no-overlap` allows one
  element type per band and no ink across y 620 / 1340; text sharing the object's band fails it.
- **Cropped by the bottom edge (3), cutouts cropped by the frame (13).** `canvas-fit` keeps every
  box but a photo / map inside the 48 px safe area, and nothing but the caption enters y 1450-1610.
- **Field with a gap (6), border frame (7), mosaic (26), two photos (27).** The plan has no grounded
  set of items to tile and one verified image per beat; a decorative field would be invented content.
- **Text inside the object (9).** Needs the screen's geometry inside a photo; nothing measures it.
- **End card (21), the landscape-only arrangements (23, 24, 28-30).** No logo asset / no 9:16 analogue.
