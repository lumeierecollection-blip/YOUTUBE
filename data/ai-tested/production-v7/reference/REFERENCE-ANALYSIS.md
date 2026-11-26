# AI Tested master reference: analysis

Source: `C:\Users\user\Downloads\ai tested.mp4` (copied nowhere; read in place).
Probe: h264, 720x1280, 30 fps, 18.157 s, AAC 44.1 kHz stereo, 1,909,016 bytes.
Material used: 72 frames at about 4 fps (`frames/f001..f072.jpg`), contact sheets in `sheets/`, a mono 22.05 kHz audio extract (`ref-audio.wav`).

## How this was made, and what it cannot tell us

- Visual findings come from looking at the extracted frames and sheets. Timestamps are approximate (+/- 0.25 s) because they come from frame order, not from a cut detector.
- Audio findings come from per-quarter-second RMS, peak and spectral-centroid measurements of the extract. I did not listen to the video, so sound types below are inferred from loudness and spectrum, not heard. Where I say "likely", treat it as a hypothesis to confirm by ear.
- I did not transcribe the narration. The wording below is read off the on-screen kinetic text, which tracks the voice word by word. Words I could not read cleanly are marked with a question mark.
- The reference is 18 s long and shows one story (ChatGPT forgetting, then a Google Cloud AI / University of Illinois paper called ReasoningBank). It is a sample of the style, not of a full structure. Anything about longer pacing is not covered by it.

## Palette and surfaces

| Role | Measured / observed value | Where |
|---|---|---|
| Light ground | about RGB(220,222,219), a warm light grey, with a fine vertical line texture (scanline / CRT feel) and slight vignette (top edge about RGB 202-211) | Most of the video: every text-led beat |
| Dark ground | near black, RGB about (13-44) | Beats at about 4.5-5.5 s, 7.0-8.0 s, 8.0-9.0 s |
| Ink | near black on light ground | All serif text on light ground |
| Key-word accent bars | electric blue, pale yellow, red, cyan or teal | Highlight bars behind one or two sans key words only |
| Logo colours | ChatGPT black tile with white mark, "chat gpt" in green-teal serif; Google multicolour G | Left as the real brand colours |

Photos are mostly desaturated or high-contrast black and white (MRI, chess piece, 3D sphere) with a few full-colour documentary stills (a room, offices, a stage with a presenter, a university building). Everything carries the same slight CRT softness and line texture, which is what ties mixed material together.

## Typography and hierarchy

- Two voices only.
  - Voice 1, on the light ground: lowercase, high-contrast italic serif, light weight, about 40-70 px tall at 720 px wide. It appears word by word, a word or two at a time ("have you", "why you need to", "keep explaining", "because", "the"). A single word sometimes sits alone on an otherwise empty light frame for about half a second ("because", "the", "so", "then").
  - Voice 2, on the dark ground: bold grotesque sans, larger, with a coloured highlight bar behind it ("adva" on blue, "advanced" on pale yellow, "solve problems" in cyan, "plan" on red, "something" on red). Used to land the key claim words ("most advanced", "write code", "solve problems", "plan").
- Emphasis comes from contrast of voice (serif to sans) and a colour bar, not from size alone. Key serif words are sometimes set larger and tighter than their neighbours ("everything" about 1.5x the size of "Then forget").
- Words are placed in the layout around the picture (above, below, beside, or over it), not in a fixed caption strip. The text is part of the composition and moves with it.
- There are no headlines, subtitles or paragraphs. Maximum on screen at once: about 4 words.

## Image scale, position and treatment

Measured against the 720 px frame width (read from the 360 px-wide frames):

- Real photos and brand tiles are large. The MRI plate is about 80% of frame width, the ChatGPT tile about 35% of frame width growing to about 45%, the university photo is full frame width, the Google stage montage about 70% width, the cluster of offices photos about 30% each.
- Subjects sit centred horizontally and vertically around the middle third of the frame (roughly y = 25-65% of the height). The light frames are not "empty": the bottom and top thirds are blank texture, but the subject plus a word fills the middle band, and the next beat starts before the eye rests.
- Stills are framed as plates: thin pale border or no border, slight inner shadow, photographic grain. Montages stack 3-5 overlapping photos with different scales (the Google cloud beat).
- Logos are shown as the real app tile, large, centred, and animated in: appear small, scale up within about 0.5 s while the text beside them updates ("The same" then "The same thing to" then adds "chat gpt").
- Dark-ground beats use full-bleed cut-out or 3D imagery: a planet cut-out, a 3D sphere over a ribbed tunnel, floating screen windows with code, a metallic helix, a chess piece on black. These carry the "technology" mood and provide contrast against the light text beats.
- Glitch treatment: one photo (about 12.5-13.5 s) is pixel-sorted and smeared, then resolves into the clean university photo. Likely a transition device, not a look to use on every image.

## Beat-by-beat timeline (approximate)

Cell n of `sheets/sheet-a.png` is about n x 0.5 s.

| Time | Words on screen | Visual | Notes |
|---|---|---|---|
| 0.0-1.0 | "Have you ever ..." | Blurred warm-toned photo of a person in a window, full height, left aligned, text over it | Soft focus, first frame is already a picture, no title card |
| 1.0-2.0 | "... ever (wondered?) why you need to" | Same photo shifts, then the MRI plate comes in | Hard image swap on the phrase boundary |
| 2.0-2.5 | "keep explaining" | MRI brain scan plate, centred, large | Concept image: "brain / memory" |
| 2.5-3.0 | "The same" | ChatGPT tile, small, centred | Logo enters small |
| 3.0-3.5 | "The same thing to" then "chat" in teal | Tile scales up | Logo growth is the beat |
| 3.5-4.0 | "chat gpt" | Tile, with a faint ChatGPT interface behind it | |
| 4.0-4.5 | "because" | Light blank, single word | Breather word |
| 4.5-5.0 | "the" | Light blank, single word | |
| 5.0-5.5 | "Most adva(nced)" | Cut to dark ground, planet cut-out, blue bar with sans key word | First light-to-dark cut. Largest loudness spike near 4.0 s precedes it |
| 5.5-6.0 | "Most advanced" with "(03)" | Light ground, yellow bar on "advanced", cut-out fragments, a model-name chip "(03)" | Model name is stated as a chip |
| 6.0-7.0 | "Have" | 3D sphere over ribbed tunnel, full bleed | Strong scale change |
| 7.0-7.5 | "Have zero memory" | Same sphere with text over it | |
| 7.5-8.0 | "write code" | Dark ground with floating code windows | Real screen UI crops |
| 8.0-8.5 | "you can write code" | Same windows on a light ground | |
| 8.5-9.0 | blank | Light blank | |
| 9.0-9.5 | "solve problems" | Black ground, metallic helix, cyan sans word | |
| 9.5-10.0 | "plan projects" | Light ground, office photos, "plan" on red bar, "projects" in italic | Photo cluster |
| 10.0-10.5 | "Then" / "Then forget" | Blank light, serif | |
| 10.5-11.0 | "Then forget everything" | Large serif word "everything" | Biggest loudness peak of the video at about 10.5 s |
| 11.0-12.0 | "The second the conversation (ends)" | Chess piece plate with words above and below | |
| 12.0-12.5 | "so" | Single word | |
| 12.5-13.5 | "A team from Google cloud / Google cloud AI" | Stacked photo montage: presenter on stage, Google logo | Real people photos |
| 13.5-14.5 | (glitch) | Pixel-sorted photo | Transition |
| 14.5-15.0 | "and the" | University building photo, text over it | |
| 15.0-16.0 | "University of Illinois" | Same photo, full width | |
| 16.0-17.0 | "build something called" | Terminal / ASCII UI, cyan text, red bar on "something" | Dark, high-energy |
| 17.0-17.7 | "Reasoning" | Light blank, serif word | |
| 17.7-18.1 | "bank" | Light blank, serif word | End on the product name, no outro |

Count: about 20 distinct picture or layout events in 18 s, roughly 1.1 per second. Light blank single-word frames appear about 8 times and last 0.25-0.5 s each.

## Motion and transitions

- The unit of motion is the word, not the scene. Words arrive individually, tied to the voice, with a short blur-in and settle.
- Image changes are hard cuts or short (about 0.1-0.2 s) scale-in-and-blur-settle entrances. There are no camera moves across the page, no slow zooms, no long dissolves. (Matches the user's "no camera movements for now".)
- Light-to-dark and dark-to-light cuts mark a change of idea, not a change of speaker.
- Logos and photos enter small and scale up while the phrase continues.
- One glitch / pixel-sort transition, used once, between two photo beats.
- Layering: texture overlay on everything, picture plate, then text over it. Text sometimes sits over the photo and sometimes beside it, never in a separate band.

## Sound (inferred from measurements only)

- The voice is continuous, close, loud and compressed (RMS about -12 to -19 dBFS, peaks near -1.4 to -7 dBFS). Natural phrase gaps show at about 3.25, 6.25, 9.0, 11.75 and 17.5 s (RMS drops 10-18 dB).
- Short high-centroid events (spectral centroid above 4 kHz) appear at about 1.5, 9.0, 10.25, 16.0 s. These are likely clicks, glitches or hi-hat style transition sounds, not sustained music.
- A low, heavy hit (centroid below 800 Hz, peak -1 dBFS) at about 10.5-10.75 s lands on the word "everything". Likely an impact or sub drop timed to the most important idea.
- A louder opening (0-0.75 s) and a quiet tail (-35 dB by 17.75 s) suggest a fast attack with no intro and a short fade.
- I could not separate music from voice in this measurement. Whether a music bed exists, its genre and its level are not established. Do not claim music from this analysis.

## Storytelling and how pictures reinforce the voice

- Every concept word gets a picture the moment it is said: "explaining" is a brain scan, "ChatGPT" is the real tile, "write code" is real code windows, "solve problems" is a helix, "plan projects" is real offices, "Google cloud" is a real presenter and the real G, "University of Illinois" is a real building. The picture is the noun.
- Structure in 18 s: a question hook that is a human situation (0-2.5 s); the product (2.5-4.5 s); the claim and its irony (most advanced model, zero memory); proof by demonstration (write code, solve problems, plan projects); the turn ("then forget everything the second the conversation ends"); the named solution and its authors (Google Cloud AI, University of Illinois); the product name on the last two words.
- Silence and single-word frames are used as breaths before a claim ("because ... the ...").

## What this means for the production blueprint

1. One identity for all five videos: light warm-grey ground with line texture as the default, black ground as the contrast beat, italic lowercase serif plus bold sans key words on colour bars, real brand tiles, large plates. No per-video themes.
2. Text is kinetic and word-timed, a few words at a time, not a headline stack. The existing `Headline`, ticker band and chip layouts do not match this and should not be kept.
3. Every beat needs a real picture or UI crop for the concept it names. Where a photo cannot be sourced and verified, use a real interface capture, a logo tile or a true data graphic, never a decorative shape.
4. SFX are short and varied, plus one low impact on the single most important line. Music is not established as part of the reference and needs a decision recorded in the blueprint, not an assumption.
5. Open on a human situation or a contradiction, not on a title.

## Gaps to close before building

- Listen to the audio (or have Gemini describe it) to confirm the SFX types and whether there is a bed.
- Get a precise cut list with a scene-change detector, to replace the +/- 0.25 s estimates.
- Confirm exact font identity. The serif looks like a high-contrast display italic (Didone/transitional style) and the sans like a grotesque; neither is identified. A close, licensed substitute must be chosen and recorded.
