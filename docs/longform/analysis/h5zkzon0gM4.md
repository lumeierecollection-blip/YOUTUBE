# Reference analysis: AI Search, "AI is reverse engineering everything"

https://www.youtube.com/watch?v=h5zkzon0gM4 · for **AI Tested** · uploaded 2026-10-06 · 14:29 · 1,096,389 views · 20.9 likes per 1,000 views · 774,000 subscribers (YouTube data, 13 Nov 2026)

## What was inspected (all real files, measured; speech-to-text for scripts)
- Thumbnail (`img/h5zkzon0gM4-thumb.jpg`); the first 30 s at one frame per 2.5 s (`img/h5zkzon0gM4-f30.jpg`, left to right, top to bottom: 0, 2.5, 5, ... 27.5 s); the first 90 s at one frame per 7.5 s (`img/h5zkzon0gM4-open.jpg`); 16 frames spread evenly over the whole video (`img/h5zkzon0gM4-spread.jpg`, frame i at (i+0.5)/16 of the duration).
- Hard-cut times in the first 240 s (scene-change detector over 0.3): 0:04, 0:04, 0:05, 0:08, 0:09, 0:10, 0:10, 0:11, 0:11, 0:11, 0:12, 0:14, 0:24, 0:30, 0:38, 0:41, 0:46, 0:46, 0:51, 0:54, 1:46, 1:53, 2:15, 2:23, 2:28, 2:32, 2:43, 2:50, 2:53, 2:56, 2:57, 3:02, 3:09, 3:13, 3:19, 3:27, 3:40, 3:49. The detector misses dissolves, fades and slow camera moves, so these are cuts, not all shots.
- Script: transcript of 0:00 to 8:25 and of the last two minutes, local speech-to-text (names can be misspelled).
- NOT inspected: audio, music and sound effects (no audio analysis was run); anything between sampled frames; the script outside the transcribed parts.

## Measured
| Measure | Value |
|---|---|
| Hard cuts in first 240 s | 38 (median gap 4.4 s, shortest 0.0 s, longest uninterrupted opening 4.2 s) |
| Narration pace | 180 words per minute (first 8:25) |
| Sentence length | median 15 words, longest 50 |
| Numbers spoken in the first 2 minutes | 3 |
| Questions asked in the transcribed part | 1 |
| Chapters in the description | 11 |
| Hashtags in the description | 6 |
| Tags | 0 |

## Opening, word for word (first 60 s of the transcript)
```
[0:00] Folks, this is pretty crazy.
[0:02] We've now reached a point where AI can seriously disrupt the software and gaming industry.
[0:07] People are now cloning the characters or systems from one game and then just mashing them up
[0:12] with another game.
[0:13] Like you can put Minecraft mechanics inside GTA, you can take Spider-Man and drop him into
[0:19] a Batman game, you can take Mario and drop him into another game, you can recreate the
[0:23] parkour system from Mirror's Edge and put it inside Skyrim.
[0:28] The crazy thing is everything works, it's pretty seamless and anyone can just do this
[0:32] by prompting an AI, like you don't even need much technical knowledge.
[0:37] So in this video we're gonna go over exactly what's going on, how it works and how to actually
[0:42] do this yourself.
[0:44] And this has far bigger implications than just video games, so even if you're not into video
[0:49] games it's still worth watching this video.
[0:52] Let's jump right in.
[0:53] Let's rewind back time to where this all started.
[0:57] So the catalyst for all of this is actually a few weeks ago when OpenAI released GPT-6
```

## Chapter list from the description
- 0:00 Intro
- 0:55 Reverse engineering binaries
- 3:34 Pass through mod
- 5:40 Reverse engineering
- 6:25 Runway
- 7:49 Rebuilding in Rust
- 9:06 Platform compatibility
- 10:00 Porting mechanics
- 11:50 Examples and how to prompt
- 12:31 Cracking software
- 13:08 Inflection point

## Description structure (first lines)
```
How AI is used to mod games. Pass through mod, rebuilding in rust, porting mechanics. Claude Opus 5.5 game mod. Thanks to our sponsor Runway
Use code MKTG50 for 50% off any paid plan for the 1st month
#ai #aitools #gaming #ainews #singularity 
Resources
https://github.com/rehan-remade/universal-modder
https://github.com/morluto/rea
https://github.com/trevaintdead/ai-game-modding-guides
https://github.com/bethington/ghidra-mcp 
```

## Visual observations
OBSERVED (first 30 s): game-capture clips back to back, each with a small pill label top-right naming the two games combined (e.g. "Halo x MW2", "Mario 64 x Elden Ring"); a scope-view and a first-person frame; no title card.
OBSERVED (spread): more game footage, then explainer inserts on black or white: a flow diagram "source code -> compilation -> binary" with a cake photo, a galaxy particle graphic labelled "GPT" and "Astra", repository READMEs, a language homepage, an image-generation UI with a prompt box, an office-suite logo grid, and a circuit-board loop.
INFERRED: the demo is the hook; the explainer diagram comes after, so a viewer who doesn't know the field is not lost. Pill labels are the only on-screen text system.
NOT SEEN: audio-led pacing.
