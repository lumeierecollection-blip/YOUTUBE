# Motion Graphics Spec — what one beat looks like on screen

Status: **specification only — not implemented.** This is the reference for
the planner prompt (`scripts/gemini-visual-plan.js`) and for any future
primitive work. Where the current renderer differs, §0 says so; nothing in
§1–§6 is true of today's output yet.

## 0. Where today's output stands against this spec

Measured from CI run 36331165614 (2026-09-27, the last green dry run before
this spec), not estimated:

| Spec rule | Today |
|---|---|
| Beat lasts 2–4 s | Beats run 6–10 s (ch-26: 10.5, 8.3, 6.2, 8.9, 10.8, 7.9 s) — beats are one SRT cue each, and cues are long |
| 8–12 beats per video | 5–9 (ch-1 7, ch-2 5, ch-9 5, ch-26 6, ch-44 6, ch-48 9) |
| One drawing per beat | Compositions carry several objects (a `field` ground plane plus 1–4 primitives), laid out on a slot grid |
| No container | The `field` primitive draws a grid panel behind the scene, and the capability compiler adds one when coverage is under 35% ("adding ground plane") |
| No icons | An `icon` primitive exists (deprecated, still renders) |
| Caption ≤ 3 words | Labels are per-object; length is not capped at 3 words |

Layout was changed toward this spec in 674b27c (8% / 15% margins); the rest
is future work.

## 1. The beat contract

A beat is one sentence. It lasts **2 to 4 seconds**. In that time, exactly
these events happen, in this order:

| Window | Event |
|---|---|
| 0.00 s – 0.30 s | The primary drawing **begins to build**: a bar grows from its anchor, a map outlines itself, a counter starts at 0. The build is the visual beat. |
| 0.30 s – 60% of duration | The build **completes** and the final state holds. If the sentence names a number, the counter reaches its final value in this window. |
| 60% – 80% of duration | The **caption types on**, one word per 0.15 s. If the drawing is a map or a location marker, the caption connects to it with a leader line. |
| 80% – 100% of duration | **Hold.** Nothing else appears — no decoration, no emphasis pulse. |

The build is the only motion. Nothing else moves.

## 2. What a beat is not

- **Not a slideshow card.** The drawing is not centred in a rounded rectangle.
- **Not a chart on a white card.** The drawing sits directly on the frame's
  background colour. No container.
- **Not multiple drawings.** One beat, one drawing. A sentence with two ideas
  is two sentences, and gets two beats.
- **Not decorative motion.** No floating particles, no pulsing rings, no
  parallax. Motion only builds the drawing.
- **Not text on top of art.** The caption is subordinate; the drawing is the
  beat. A caption longer than three words means the planner prompt is wrong.

## 3. The rhythm across beats

A full video is **8 to 12 beats**.

- Beat 1 is **TYPOGRAPHY**: kinetic type, one line, 3–6 words.
- Beats 2 … N-1 alternate between visual mechanisms: **quantity, comparison,
  process, location, transformation.**
- Beat N is **TYPOGRAPHY**: the CTA or closing claim.

Constraints:

- No two consecutive beats use the same mechanism.
- No mechanism appears more than 3 times in a 10-beat video.
- Pace: **2.5 s per beat on average; never under 2 s, never over 4 s.** Cut
  faster during the setup and slower during the payoff (roughly 2–3 s and
  4–5 s — see the note in §5 on where that figure comes from).

## 4. What the viewer's eye does

At any moment in a beat, the viewer can answer three questions:

1. What is the subject? → **the drawing**
2. What is the number? → **the counter**
3. What is the sentence about? → **the caption**

If the viewer has to look at three places at once, the beat is wrong. The
eye moves **drawing → caption → done.**

## 5. Reference videos

From web search results only (2026-09-27); no page was fetched and no video
was watched. **No timestamp range below is verified.** Search results give
URLs, not timestamps, and this repo does not invent facts. Someone has to
watch these and record the ranges before they're treated as evidence of any
specific rule above.

| Source | URL | What the search result says | Timestamp range |
|---|---|---|---|
| Johnny Harris — *Vox Borders* (Vox, 4 seasons, Oct 2017 – Jul 2019) | [Borders playlist](https://www.youtube.com/playlist?list=PL2bOCNRCtxYxdsCX9yxmHDNfeCr35Eilv) · [The 3 Strangest Borders on Earth](https://www.youtube.com/watch?v=Fp2PcrRNlGo) | Border explainers built on animated maps | not verified |
| NYT Visual Investigations | [playlist](https://m.youtube.com/playlist?list=PL4CGYNsoW2iAZt9-UzPyPZOH-AlRMxcIE) · [How The Times Makes Visual Investigations](https://www.youtube.com/watch?v=reTUxfQsSUQ) | Forensic analysis of visual evidence, since 2017 | not verified |
| Vox explainers (animated maps) | [Storybench: How Vox uses animation](https://www.storybench.org/how-vox-uses-animation-to-make-complicated-topics-digestible-for-everyone/) · [Google Earth: How Vox uses Earth Studio](https://medium.com/google-earth/how-vox-video-uses-earth-studio-for-dynamic-visual-storytelling-703fc871766e) | Vox zooms out to show other countries' role in a story and in to show it on the ground | n/a (articles) |
| Bloomberg Originals | [channel](https://www.youtube.com/bloomberg) | "Cinematic, data-led shows" | not verified |

The "Vox cuts every 2–3 s in the setup and every 4–5 s in the payoff" figure
in §3 comes from the brief this spec was written from. It was **not** found
in any search result and has not been measured.

## 6. The forbidden list

No:

- rounded rectangles around content
- drop shadows on drawings
- gradient backgrounds
- progress bars at the top or bottom
- brand watermarks
- icons
- emojis
- stock photography
- anything that looks like a slide in a presentation
