# Reference analysis: AI Search, "New top local AI image generator is here!"

https://www.youtube.com/watch?v=cUeZMUGCxrw · for **AI Tested** · uploaded 2026-10-20 · 21:55 · 419,626 views · 18.6 likes per 1,000 views · 774,000 subscribers (YouTube data, 13 Nov 2026)

## What was inspected (all real files, measured; speech-to-text for scripts)
- Thumbnail (`img/cUeZMUGCxrw-thumb.jpg`); the first 30 s at one frame per 2.5 s (`img/cUeZMUGCxrw-f30.jpg`, left to right, top to bottom: 0, 2.5, 5, ... 27.5 s); the first 90 s at one frame per 7.5 s (`img/cUeZMUGCxrw-open.jpg`); 16 frames spread evenly over the whole video (`img/cUeZMUGCxrw-spread.jpg`, frame i at (i+0.5)/16 of the duration).
- Hard-cut times in the first 240 s (scene-change detector over 0.3): 0:02, 0:05, 0:07, 0:12, 0:15, 0:17, 0:19, 0:21, 0:21, 0:22, 0:24, 0:25, 0:25, 0:26, 0:26, 0:27, 0:30, 0:30, 0:32, 0:33, 0:34, 0:36, 0:42, 0:47, 0:51, 0:53, 0:55, 0:56, 1:00, 1:02, 1:11, 1:14, 1:16, 1:17, 1:18, 1:19, 1:20, 1:22, 1:25, 1:29, 1:33, 1:38, 1:41, 1:44, 1:46, 1:49, 1:54, 1:56, 1:59, 2:01, 2:03, 2:08, 2:11, 2:14, 2:19, 2:23, 2:27, 2:31, 2:35, 2:38, 2:41, 2:43, 2:48, 2:48, 2:49, 2:54, 2:55, 2:57, 2:58, 3:00, 3:10, 3:20, 3:26, 3:37, 3:47, 3:52, 3:56. The detector misses dissolves, fades and slow camera moves, so these are cuts, not all shots.
- Script: transcript of 0:00 to 8:02 and of the last two minutes, local speech-to-text (names can be misspelled).
- NOT inspected: audio, music and sound effects (no audio analysis was run); anything between sampled frames; the script outside the transcribed parts.

## Measured
| Measure | Value |
|---|---|
| Hard cuts in first 240 s | 77 (median gap 2.5 s, shortest 0.2 s, longest uninterrupted opening 2.5 s) |
| Narration pace | 204 words per minute (first 8:02) |
| Sentence length | median 54 words, longest 549 |
| Numbers spoken in the first 2 minutes | 1 |
| Questions asked in the transcribed part | 0 |
| Chapters in the description | 11 |
| Hashtags in the description | 7 |
| Tags | 0 |

## Opening, word for word (first 60 s of the transcript)
```
[0:00] Folks, we have a new open source image generator and this is by far the best image model in its weight class
[0:07] This has a ton of knowledge it can generate a ton of different things including really complex
[0:11] Infographics and diagrams with text plus you can also generate certain crops with this and the best thing is this is really tiny
[0:18] You can even run this with four gigabytes of VRAM or less
[0:22] So it's called Moss image and in this video
[0:24] We're gonna go over some demos and of course
[0:26] I'm gonna show you how to install it plus how to customize it even further how to make this faster how to make it even better quality
[0:31] How to even use this for image editing and more so let's jump right in first of all
[0:37] Let's go over the specs of this. So this is a really small five billion parameter image generator
[0:42] So the quantized versions of this are small enough to fit on even low-end consumer GPUs
[0:47] Now keep in mind that this is just a text to image generators
[0:50] So you can't edit images semantically using natural language like quen image 2.1 or nano banana
[0:57] But later in the video, I'm gonna show you some hacks to still get Moss to edit images and the nice thing is this also supports layout control
```

## Chapter list from the description
- 0:00 MOSS Image intro
- 0:37 Specs and demos
- 2:14 MOSS Image vs Krea 2
- 3:01 How to use MOSS in ComfyUI
- 8:33 How to use layout control
- 11:03 Higgsfield
- 12:30 How to add loras
- 15:20 Better checkpoints
- 16:05 How to make it faster
- 17:50 How to edit images
- 20:28 How to train loras

## Description structure (first lines)
```
MOSS Image review & tutorial. How to use MOSS Image in ComfyUI. How to edit images with MOSS. Thanks to our sponsor Higgsfield. Try it today
#ai #aiart #imagegenerator #aitools #ainews #agi
https://huggingface.co/Comfy-Org/MOSS-Image
https://huggingface.co/lodestones/MOSS-Image-SFT-8-steps-dmd/blob/main/lora.safetensors
https://huggingface.co/lodestones/Kromoss
https://github.com/ostris/ai-toolkit
Also see
ComfyUI tutorial: https://youtu.be/g74Cq9Ip2ik
```

## Visual observations
OBSERVED (first 30 s): black pillarbox with a different vertical or square image per cut (live-stream still, pop-up book, crowd, scanned page, exam paper, food, party, flames), then a landing page, a side-by-side comparison of two model outputs with column titles, then a node-graph UI.
OBSERVED (spread): mostly screen capture of real tools (model card and file list with download sizes, node-graph editors with wires, a folder dialog, generated image beside the settings used), a few full-frame outputs, and a plain white-on-black title ("How to train loras") near the end.
INFERRED: tutorial structure. The viewer watches the actual interface, and results appear next to the settings that produced them.
NOT SEEN: cursor highlight or zoom method; any narration-to-frame sync.
