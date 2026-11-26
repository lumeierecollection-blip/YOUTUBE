# InsiderForce study: framework and per-video implementation plan

Status: plan only. Nothing has been rendered, no pipeline file has been changed, nothing is merged. This is for discussion before any build.

## 1. What this is based on, and what it cannot tell us

Studied: the InsiderForce Shorts channel (93 Shorts, an AI-tools news and explainer channel). I downloaded 14 of them, chosen across the view range (1.3K to 2.5M views): g3Mh8Hws-jo, irXFtcohTco, enFgYQvI1dM, 0JZtdAtJiyk, aX7QAfld7hs, I7B7-R-4s9c, ELsXhePjBxI, 3iUo7bnsN30, AAtagrbBOto, 23cUNfHdJcc, 4R8oNlUX6_A, XHWAKh-aU8Q, 3vj5VFwATHA, JBA2MaADaVA. All are 608x1080 (one 480x854), 30 fps, 50 to 106 seconds long.

Measured, with tools: word-timed transcripts (YouTube captions), scene-change times, contact sheets every 3 seconds, one dense sheet at 8 frames per second (0JZtdAtJiyk, 0 to 7.4 s), voice and pause loudness, spectra.

Not established, stated plainly:

- I did not listen to any audio. Every statement about sound effects and music below is inferred from measurements and is a hypothesis.
- The sound-effect-to-visual mapping could not be pinned down. Low-frequency onsets landed on visual changes more often than chance in 4 of 6 videos (for example 0.67 against 0.32 chance in irXFtcohTco), at chance in 1, and at 0.00 in ELsXhePjBxI. Voice plosives pollute every band. Treat "soft low impact on scene change" as plausible, not proven.
- Whether a music bed exists: captions tag `[music]`, and loudness in the gaps between words is only 0 to 5 dB below the voice in most videos (gap level about -16 dB against voice about -14.5 dB). That points to a continuous bed or a loud tail, but I could not separate it from voice, and I do not know its genre.
- Only 0 to 7.4 s of one video was studied at motion-level detail. Motion timings below for other situations (card entrances mid-video, diagram builds) are read from 3-second sheets and are approximate.
- I have not verified any claim these videos make. They give no sources on screen. We copy their form, never their facts.

## 2. The channel in one paragraph

Fast, template-driven explainers about one AI tool or a short list of tools ("5 MCP servers", "3 skills", "free tool nobody talks about"). One male narrator at about 2.7 to 3.4 words per second. A pale grey grid ground, black and white with one coral accent (the Claude asterisk), real product screenshots as floating cards, real brand tiles. One visual event per clause, a visual change roughly every 2.1 to 3.6 seconds (18 to 39 changes in 61 to 103 s at scene threshold 0.06). Every video ends on the same tail: a comment keyword, an ebook offer, and a "follow" card. The winners are "free tool" and "top N" formats.

## 3. Framework

### 3.1 Script formula (from word-timed transcripts)

1. Cold-open payoff, 0 to 3 s. One sentence that states the benefit or the surprise ("Three Claude code skills that make you look like a designer overnight"). No greeting, no logo.
2. Name the thing, 3 to 6 s. "It is called X." The name appears as bold type or a brand tile on the same beat.
3. Problem, then mechanism. Short sentences, one idea each, concrete numbers stated as stats ("49 times fewer tokens", "214,000 GitHub stars").
4. One pivot phrase near the middle: "here is the part that makes it genuinely different".
5. Lists are spoken as "First, second, third" or "number one", and each item gets its own scene, a title plus three or four ✦ benefit lines.
6. Close with a one-line recap ("You just found the tool").
7. Fixed tail: comment keyword, offer, follow prompt. About 8 to 10 seconds.

Compared with our scripts: ours are 15 to 25 s news items with no list structure and end on a question or a repeat of the hook. The format difference is length (their 50 to 106 s against our roughly 25 s) and the list build.

### 3.2 Scene grammar

A scene is one idea. On a scene change the screen clears to the empty grid within about one frame (0.12 s), then the next scene's words begin. Typical scene, two to four seconds:

- a small lead-in line in light weight type ("give Claude any")
- a bold keyword line ("Website Link")
- a picture (floating card, phone, tile row, or diagram) between or below
- an optional ✦ list that builds one line per spoken clause

Scene types seen: title card ("#1 /ghost", "Third is" plus a tile), floating-card explainer, ✦ list scene, stat scene (two numbers stacked), diagram scene (right-angle connector between device, laptop, chip, model), and the end card.

### 3.3 Typography

- Lead-in line: light sans, lowercase, about 0.4 of the keyword size.
- Keyword line: bold sans, mixed or capitalised ("Website Link", "In Real Time"). One bold or italic-serif word per scene as emphasis ("Middle Layer", "Completely Human").
- Black rounded pill with white text for the single claim phrase ("designer overnight", "you need right now").
- ✦ bullet lines for list items, ✕ in a circle for negatives, → for steps.
- Words that have not been spoken yet appear in faint grey and turn to ink when the voice reaches them.
- A faint repeating watermark of the channel domain at bottom centre on every scene.

### 3.4 Palette and surfaces

Ground about #f2f2f2 with a faint dotted grid, ink near black, one accent: coral for the Claude mark and a few shapes, black for pills, cards' dark UI and the logo. Dark UI screenshots (terminal, phone) are the strongest contrast element. Cards carry a soft drop shadow, about 30 to 40 px blur, and sit on the grid like paper.

### 3.5 Motion primitives (measured on 0JZtdAtJiyk 0 to 7.4 s; others approximate)

| Primitive | What happens | Timing |
|---|---|---|
| Opening | Bare grid on frame 0, first word fades in from grey to ink | first word at about 0.25 s |
| Word reveal | Each word turns grey to ink as spoken, next word shown faint; lines reflow upward as new lines arrive | per word, synced to voice |
| Prop pop-in | Brand shapes (asterisks, key, palette) enter from the frame edges and drift or rotate slowly | 0.3 to 0.5 s, then continuous slow drift |
| Pill wipe | Black pill wipes in left to right | about 0.3 s |
| Card rise | Card rises from below with shadow, settles | about 0.5 to 0.9 s |
| Scene clear | Everything gone in one frame, next scene starts | about 0.12 s |
| List build | ✦ line appears when its spoken clause starts; a faint ✦ and first word precede the full line | one line per clause |
| Blur transition | A blurred, ghosted copy of the previous layout appears between scenes (seen in JBA2MaADaVA) | about 0.2 to 0.3 s |

No camera moves, no long dissolves. Slow drift on props is the only continuous motion.

### 3.6 Audio (inferred, not heard)

- A loud low hit near frame 0 (0.1 s) in almost every video: -10 to -16 dB.
- Frequent low-frequency accents, about every 1 to 2 s, which plausibly sit on scene changes.
- A music bed, probably continuous, at an unknown but substantial level.
- Voice about -14 to -19 dB before master.

### 3.7 End card (fixed, about 8 to 10 s)

Comment keyword with the ebook mockup, "I'll send you my ebook", ✦ lines, then the logo card ("make sure you follow", "the system only sends it to followers"), then a short black tail. This is a lead-magnet funnel specific to that channel.

## 4. What our current schema cannot express

Read from `boards/26.board.mjs`, `render7.mjs` and `Root.tsx`. I have not yet read `render/src/Short.tsx`, so every item below must be confirmed there before building.

| Needed | In the board format today |
|---|---|
| Word-by-word grey-to-ink reveal | not expressible (text is per-line `serif`/`kw`) |
| Black key pill with wipe | `kw` gives coloured bars, not this pill |
| Floating shadowed card with rise-in | `photo` exists; shadow and rise-in not confirmed |
| ✦ list built line by line on cue | not expressible |
| ✕ negative chip, → step arrows | not expressible |
| Connector diagram (device to model) | not expressible |
| Number counter | `widget: counter` exists |
| Brand tile | `tile` exists |
| Persistent watermark | not present |
| Blur-ghost transition, prop drift | not present |
| Light grey grid ground | plates are `dark` and `paper`; a grid plate does not exist |
| Comment-keyword end card | not present |

## 5. Per-video plan for Shorts 21 to 25

Rules that stay, whichever style we choose: every claim traces to `facts/<id>.facts.json`; real brand tiles and real captures only; no invented number. Scenes below are built only from sentences already in each script; extra scenes need new research, listed under "needs". Scene lengths are targets at 3 words per second.

Short 26 (Cincinnatus) is a history piece, not an AI-tool piece. InsiderForce has no equivalent, so it stays on the existing history treatment.

### 21: California is suing OpenAI (about 28 s of narration)

Format: news explainer with a question ending. Hook: "California is suing OpenAI."

1. 0 to 3 s: pill on "suing OpenAI", OpenAI tile pops in.
2. 3 to 8 s: diagram scene, "testing environment" box with a line breaking out to "open internet" (connector diagram).
3. 8 to 12 s: Hugging Face tile with ✕ chip, "breached internal systems".
4. 12 to 17 s: card scene, the "cheat on an evaluation" claim shown as an attributed quote card.
5. 17 to 21 s: stat scene, counter to 80 ("incidents").
6. 21 to 25 s: pill "public nuisance"; OpenAI's response as a second quote card.
7. 25 to 28 s: question line, bold keyword "who controls".

Needs: a real capture of the complaint or the attorney general's release as the card image. Check what `facts/21.facts.json` holds.

### 22: OpenAI's two models, four times apart (about 25 s)

Format: comparison. Hook: "One OpenAI launch. Two models. Four times apart on price."

1. 0 to 3 s: counter to 4, pill "four times".
2. 3 to 10 s: two cards side by side, Astra (8 and 40) and Sol (2 and 10), ✦ lines built per price.
3. 10 to 15 s: Astra card, "hardest projects", ✦ documents, slides, code, 3D design.
4. 15 to 19 s: Sol card, "everyday work".
5. 19 to 24 s: the benchmark claim on a card, labelled as OpenAI's own claim, with the line "we haven't tested that" kept.
6. 24 to 25 s: repeat of the hook.

Needs: real OpenAI pricing page capture.

### 23: Four nonprofits want a court to pause frontier AI (about 28 s)

Format: list plus question. Hook: "Four nonprofits are asking a San Francisco court to stop next-generation AI."

1. 0 to 4 s: counter to 4, the court named.
2. 4 to 10 s: tile row of the five targets (Anthropic, Google, Meta, OpenAI, SpaceX), tiles pop in one per name.
3. 10 to 16 s: ✦ list: emergency injunction, until companies prove humans stay in control.
4. 16 to 22 s: complaint card, cyberattacks and the companies' own admissions.
5. 22 to 25 s: "Congress has yet to pass legislation" as a bare-grid line.
6. 25 to 28 s: question ending.

Needs: five brand tiles (four already used in 21 to 22 style), a complaint capture.

### 24: One prompt, one file, a playable 3D shooter (about 24 s)

Format: closest to InsiderForce. Hook: "One prompt. One file. A playable 3D shooter."

1. 0 to 3 s: three stacked pills "one prompt", "one file", "one shooter".
2. 3 to 8 s: Anthropic engineer, Claude run for about eight hours, "no human feedback" with ✕ chip.
3. 8 to 13 s: game capture on a floating card, "Saltline", "rainy harbor".
4. 13 to 18 s: stat scene, 1.4 megabyte, ✦ no images, no audio files, no 3D models.
5. 18 to 22 s: "code generates the visuals and the sound".
6. 22 to 24 s: cost, about five hundred fifty dollars, counter.

Needs: real captures of the game (check which exist in `assets/v7/24`).

### 25: Google Tabletop (about 24 s)

Format: tool explainer with a ✦ list. Hook: "You didn't open an app. You asked for one."

1. 0 to 3 s: pill "You asked for one".
2. 3 to 8 s: title "Google Tabletop", tile, card of the product.
3. 8 to 14 s: ✦ list: trip itinerary, dinner poll, expense splitter, tournament bracket, one line per item.
4. 14 to 18 s: "everyone at the same time, like a Google Doc".
5. 18 to 21 s: limits as ✕-style chips: US only, waitlist, adults 18 and over.
6. 21 to 24 s: closing line.

Needs: real Tabletop product capture.

## 6. Decisions needed from you

1. Which style governs AI Tested? InsiderForce (pale grid, bold sans, floating cards, black pills, ✦ lists) or the current master reference (grey CRT, italic serif, colour bars). They conflict. Shorts 21 to 25 are built to the second. My recommendation: switch to the InsiderForce template and retire the CRT look, since you named this channel as the study target.
2. Length. InsiderForce runs 50 to 106 s. Ours run about 25 s. Padding with unsourced facts breaks the hard rule. Recommendation: keep 25 to 40 s, add length only where research supports a list.
3. Branding and tail. We must not copy their watermark, crown logo or ebook offer. We need our own mark, and a decision on whether there is any end card at all.
4. Audio. They appear to run a continuous bed plus a frame-0 boom. Short 26 was set to SFX only at your request. Do 21 to 25 follow that, or do we try a bed? I cannot hear their audio, so I suggest you listen to two of the originals and tell me what the hits and the bed actually sound like before we choose.
5. Build order. I propose adding the new primitives to the board format first (word reveal, pill, ✦ list, floating card, diagram, grid plate, watermark), then rendering one video as stills only on GitHub, then the rest one at a time.
