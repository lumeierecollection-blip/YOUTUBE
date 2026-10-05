# Plan vs. Render Audit
Date: 2026-10-05
Runs: **37313431912** (ch-26, ch-49, ch-9 — scheduled run), **37308547249** (ch-44)
Channels audited: ch-26, ch-44, ch-49, ch-9
Audited model: `gemini-3.5-flash-lite` (the same vision model the pipeline uses)
Total beats audited: 37 · Frames extracted: 111 (25% / 50% / 75% of every beat)

Raw evidence: `data/audit/plan-vs-render/<channel>/plan.json` (plan fields + beat timings +
per-frame size/mean/ink-bbox), `audit.json` (every Gemini response), `summary.json`,
`rows.json`, and `beat-<N>-<25|50|75>.png` for all 111 frames.

## Summary
- **Total beats: 37**
- **Match YES: 0 (0%)**
- **Match PARTIAL: 12 (32%)**
- **Match NO: 25 (68%)**
- **Timing correct: 3 (8%) — incorrect: 34 (92%)**
- Beats where the drawn `visual_type` differed from the planned one: **11 of 37 (30%)**

## Common divergences

**Missing (Gemini described it, the frame does not have it)**
- dark / black / monochrome background — **3 beats** (and 11 of 37 descriptions ask for one)
- the specific numeral, chart, timeline, document or diagram that was described — 20 beats
- the label text that was specified ("URGENT AUDIT", "WORKFLOWS STALL", "THE PRICE OF BLIND AMBITION", "3-of-7 Safe", "NEW YORK THEATRE") — 8 beats
- photo treatment ("black-and-white", "high-contrast", "sepia") — 5 beats

**Unexpected (in the frame, never described)**
- the running caption / subtitle band — **~24 of 37 beats** (the single most common addition)
- white background where a dark scene was asked for — **3 beats** (plus light-where-dark on 6 more)
- `Source: commons.wikimedia.org` attribution — **6 beats**
- page counter `01 / 10`, `09 / 09` — 3 beats
- accent colour applied to a "monochrome" description (green on ch-49, purple on ch-26) — 4 beats

## Per channel

### ch-26 — `base-vault-whitelist-hack-6m-2026-shorts` (run 37313431912)
Beats 9 · YES 0 · PARTIAL 4 · NO 5 · timing OK 1 · type divergence 0

| Beat | Sentence | Planned description (abridged) | Type | Match | Missing | Unexpected | Timing |
|---|---|---|---|---|---|---|---|
| 0 | Six million dollars vanished from a Base network va… | Large bold serif headline 'Six million vanished', numeral 6,000,000 | PROCESS→PROCESS | PARTIAL | numeral 6,000,000 in oversized type; monochrome (purple used); thin accent line under headline | two circular flowchart nodes; purple connecting arrow; running subtitle | ok |
| 1 | SigIntZero reported that a 3-of-7 Safe executed a c… | structured timeline chart in lower half | COUNTER→COUNTER | NO | the timeline chart; timestamp 08:53 UTC; "SigIntZero" small caps; 3-of-7 label; slow push-in | large number "3"; kinetic typography of the narration | NO |
| 2 | PublicAML noted the vault lost 1,783 wstETH instant… | large number 1,783 centre frame | TYPE→TYPE | PARTIAL | the `wstETH` label; downward-trending chart line | large "PublicAML" branding; narrated captions | NO |
| 3 | How did an approved contract drain the funds withou… | conceptual text-and-node layout | TYPE→TYPE | PARTIAL | the node layout; question mark in headline | large purple checkmark; underline accent | NO |
| 4 | MSB Intel revealed the exploit took 25 minutes, but… | minimalist horizontal progress bar | COUNTER→COUNTER | NO | the progress bar; "MSB Intel" small caps | large serif headline at top; kinetic caption text | NO |
| 5 | Attackers initiated the assault on Base with a test… | data transfer flow chart | TYPE→TYPE | NO | the flow chart; 1 wstETH test transfer; "BASE NETWORK" label | progressive narration text; thin rule above text | NO |
| 6 | That initial probe bypassed every security checkpoi… | security checklist diagram | PROCESS→PROCESS | NO | the checklist; checked rows; whitelisted row; red strike-through | two circular nodes + purple arrow; animated subtitles | NO |
| 7 | The entire 1,783 wstETH drained seamlessly before a… | large data accumulation chart | TYPE→TYPE | NO | the accumulation chart; chart draining; revocation lock icon | kinetic typography of the narration verbatim | NO |
| 8 | Review all 7 Safe signers immediately. | stark monochrome type slide, numeral 7 | COUNTER→COUNTER | PARTIAL | "URGENT AUDIT" base label | progressive text; extra SAFE SIGNERS labels; spread layout | NO |

**Verdict:** The pipeline did **not** follow the plan. Only beats 0, 2, 3 and 8 came close, and each of those still lost a named element. Beats 1, 4, 5, 6 and 7 are different compositions from the ones Gemini specified — five of nine beats asked for a *specific drawn artefact* (timeline chart, progress bar, flow chart, checklist, accumulation chart) and every one of them was replaced by type or a two-node diagram. The drawn `visual_type` matched the plan on all 9 beats, so this is not the resolver substituting: it is the **scene translator ignoring the description's cue** and falling through to its own grounded candidates. Timing was wrong on 8 of 9 beats — the only "ok" is beat 0, which has no timed element to get wrong. This is a **renderer/translator bug**, not a planner bug: Gemini asked for things the translator is able to draw (a bar chart, a progress bar, a list) and it drew type instead.

### ch-44 — `stop-managing-ai-agents-blind-pixel-agents-shorts` (run 37308547249)
Beats 9 · YES 0 · PARTIAL 2 · NO 7 · timing OK 0 · type divergence 2

| Beat | Sentence | Planned description (abridged) | Type | Match | Missing | Unexpected | Timing |
|---|---|---|---|---|---|---|---|
| 0 | Running three terminals blind makes coding with AI … | stark **dark** terminal window, 3 prompts | TYPE→TYPE | NO | dark terminal window; blinking prompts; numeral 3; red warning line | **white background**; serif/sans headline; subtitles; counter "01 / 09"; gold underline | NO |
| 1 | Developers juggle 3 Claude Code terminals simultane… | three terminal windows side-by-side | COUNTER→COUNTER | NO | the three windows; scrolling code; "WORKFLOWS STALL" label | large typography; kinetic text animation | NO |
| 2 | Bright Coding exposed this exact struggle on GitHub… | real screenshot of a GitHub issue page | TYPE→TYPE | NO | the GitHub issue screenshot; October 2026 thread; label | "GitHub struggle exposed" heading; octocat logo; subtitles; Source attribution; "EXPOSED ON" | NO |
| 3 | How do you track silent coding processes? | minimalist line chart, deep monochrome grid | TYPE→TYPE | NO | line chart; upward trajectory; deep grid; centred question mark | **light background**; radar/sonar graphic; heading; captions; "04 / 09" | NO |
| 4 | Pablo Delucca built an open-source fix called Pixel… | clean portrait photo of Pablo Delucca | PHOTO→**TYPE** | NO | the portrait; open-source badge | "Pablo Delucca" typography; "PIXEL AGENTS FIX"; incremental captions; line element | NO |
| 5 | Pixel Agents replaces opaque 1970s terminal emulato… | high-contrast pixel-art grid | COUNTER→COUNTER | NO | the pixel-art grid; 1970s terminal emulation | gold "1970"; heading; subtitles; plain white background | NO |
| 6 | You install the extension via VS Code and Open VSX … | real VS Code marketplace interface view | DOCUMENT→DOCUMENT | PARTIAL | extension marketplace view; highlighted search bar; `pablodelucca.pixel-agents` | overlapping subtitle text; Recommended/Walkthroughs cards; Source watermark | NO |
| 7 | Every active agent now renders visibly inside your … | code workspace window with pixel-art sprites | TYPE→TYPE | NO | the workspace window; the sprites | **white background**; large "Visibly"; kinetic typography; line icon | NO |
| 8 | Download Pixel Agents on GitHub today to manage you… | minimalist split screen, oversized numeral 1 | PHOTO→**TYPE** | PARTIAL | split screen; oversized numeral 1 | "Manage coding Agents today" heading; "09 / 09"; Source attribution; progressive body captions | NO |

**Verdict:** The pipeline did **not** follow the plan on any beat. This is the only channel where timing was wrong on **every** beat (9 of 9). The two closest beats (6 and 8) are the only PARTIALs, and on both the real screenshot / split-screen composition is absent. Two beats (4 and 8) were planned as PHOTO and rendered as a TYPE name card because no verified portrait or product image existed — the resolver's safety gate behaved correctly, but the planner had asked for images that do not exist in any free source. Beats 0, 3 and 7 asked for a **dark** screen and got a white one: the renderer has exactly one studio ground and never inverts it. Mixed fault: beats 0/1/3/5/7 are a **renderer limitation the planner prompt never warns about** (fixed white ground, no dark mode, no screenshots of software UIs), while beats 4/8 are the **verification gate correctly refusing an image that does not exist**.

### ch-49 — `harvey-keitel-the-method-acting-scene-shorts` (run 37313431912)
Beats 9 · YES 0 · PARTIAL 3 · NO 6 · timing OK 1 · type divergence 5 (worst of the four)

| Beat | Sentence | Planned description (abridged) | Type | Match | Missing | Unexpected | Timing |
|---|---|---|---|---|---|---|---|
| 0 | Will Harvey Keitel survive New York's brutal scene … | high-contrast **B&W** portrait, phrase behind | PHOTO→PHOTO | NO | the B&W treatment; the phrase behind; the label | full-colour framed portrait; green/black header; accent line; captions; Source attribution; drop shadow | NO |
| 1 | Director Gaurav Bhardwaj captures cutthroat ambitio… | B&W promotional still, lower third | PROCESS→PROCESS | NO | the still; the studio setting; lower third | **white background**; green/black diagram nodes; floating text | NO |
| 2 | Travelin Bone Entertainment produced this gritty st… | the two producer logos side by side, dark ground | PHOTO→**TYPE** | PARTIAL | the second logo; side-by-side layout; dark ground; slow zoom-out; "CO-PRODUCTION" | **white background**; subtitles; green on "Entertainment"; different text layout | NO |
| 3 | What drives an acting teacher to extremes? | B&W photo of an empty theatre stage | TYPE→**PROCESS** | NO | the theatre photo; spotlight; thin line; "THE ACTING TEACHER" | **white background**; green header; DRIVES/EXTREMES circles; green arrow; captions | NO |
| 4 | Travelin Bone Entertainment highlights just how ste… | oversized numeral 1 centre frame | PHOTO→**TYPE** | NO | the numeral 1 composition; "THE PRICE OF BLIND AMBITION"; vertical line | company name as type; narrative subtitles; top-right rule | NO |
| 5 | The Method exposes 1 ruthless reality of New York t… | large numeral 1 centred, flanked by labels | MAP→MAP | PARTIAL | numeral 1 centred; "NEW YORK THEATRE" label | a **map of New York state**; subtitles; "EXPOSES 1" top-right | ok |
| 6 | Gaurav Bhardwaj captures raw ambition inside New Yo… | B&W behind-the-scenes photograph | TYPE→**PROCESS** | NO | the photograph; "NEW YORK STUDIOS" | **white background**; large typography; GAURAV BHARDWAY circles; subtitles | NO |
| 7 | This feature by Imagination Infinite Motion Picture… | numeral 1 with "ACTOR SURRENDERS" | PHOTO→**TYPE** | PARTIAL | the numeral; the ACTOR SURRENDERS text | top-left rule; unfolding narration text; different numeral placement | NO |
| 8 | Watch the film to witness this masterclass in actin… | **solid black screen**, centred serif text | TYPE→TYPE | NO | solid black screen; glowing centred text; "WATCH THE FILM"; slow push-in | **white background**; green heading; massive black serif centre text; underline; line icon | NO |

**Verdict:** The pipeline did **not** follow the plan, and this channel diverged most — **5 of 9 beats were drawn as a different visual type than planned**, including three planned PHOTO beats rendered as TYPE name cards and two beats where the translator invented a two-node PROCESS diagram out of a sentence Gemini had described as a photograph. Beat 8 is the clearest single failure: Gemini asked for a solid black closing screen and the frame is a white background with green header text. Beat 5 is the only PARTIAL where the type matched, and even there the plan's numeral was replaced by a map. Timing was wrong on 8 of 9. The dominant cause is **not** one bug: unresolvable logos (Travelin Bone, Imagination Infinite Motion — 3 attempts each) forced name cards; the translator overrode two photo descriptions with diagrams; and the white studio ground defeated every dark-scene request. This channel shows the **verification gate and the translator both diverging from the plan in the same video**.

### ch-9 — `india-kalapani-territorial-map-dispute-nepal-shorts` (run 37313431912)
Beats 10 · YES 0 · PARTIAL 3 · NO 7 · timing OK 1 · type divergence 4

| Beat | Sentence | Planned description (abridged) | Type | Match | Missing | Unexpected | Timing |
|---|---|---|---|---|---|---|---|
| 0 | One new political map just redrew a disputed mounta… | **dark** ground, political map, accent line, numeral 2 | TYPE→TYPE | NO | dark ground; the political map; accent trace; numeral 2 | **light background**; large serif title; sentence-word captions; "01 / 10"; underline rules | NO |
| 1 | India's Ministry of Home Affairs published the upda… | official seal + HQ building photograph | PHOTO→**MAP** | NO | the ministry seal; the HQ building; the B&W photograph | a **map of India**; location pin; subtitles | NO |
| 2 | Kalapani and Lipulekh landed directly inside Indian… | official government document, highlighted locations | TYPE→TYPE | NO | the document; highlighted locations; accent circles; arrow | large minimalist typography; subtitles; header; stray accent line | NO |
| 3 | Kathmandu reacted with immediate anger. | street-level photograph of Kathmandu, crowds | PHOTO→PHOTO | PARTIAL | warning triangle icon | text overlays; Source attribution; temple architecture with pigeons | ok |
| 4 | Will Nepal accept this unilateral border change? | stark typographic treatment, centred question | MAP→MAP | PARTIAL | dark ground | **light background**; a map of Nepal; multiple subtitle lines; large title | NO |
| 5 | Government spokesperson Gokul Baskota rejected it, … | real photo of demonstrators with signs | PHOTO→PHOTO | PARTIAL | the rising chart line | animated captions; source link; temples, pigeons, an animal in shot | NO |
| 6 | Jammu and Kashmir split into exactly 2 federal unio… | oversized numeral 2, two boundary lines, map | PROCESS→PROCESS | NO | the numeral 2; boundary lines; the map; "FEDERAL UNION TERRITORIES" | circular diagrams; connecting arrow; running transcript at top | NO |
| 7 | Officials in New Delhi triggered regional protests … | line chart comparing the timeline | TYPE→**PHOTO** | NO | the line chart; left-to-right line; monochrome + accent | photo background of an ornate stone interior; captions; Source watermark | NO |
| 8 | Territorial sovereignty remains heavily contested i… | topographical relief map, crosshair | PHOTO→**TYPE** | NO | the relief map; the crosshair; the accent glow | two lines of typography ("Sovereignty contested" / "Territorial sovereignty"); varied font weights | NO |
| 9 | Nepal's Ministry of Foreign Affairs will reject Ind… | stark typographic conclusion, **solid dark** ground | PHOTO→**MAP** | NO | dark ground; "Upcoming bilateral talks"; small icon | **light background**; map of India; location pin; other text; "India" serif type | NO |

**Verdict:** The pipeline did **not** follow the plan. Four beats were drawn as a different type than planned, and the substitutions are severe: two beats asking for a government **document** and a **relief map** became typography, a beat asking for a **line chart** became a photograph of stone architecture, and two beats asking for a **photograph of a ministry building** became maps of India. Beats 0, 4 and 9 asked for a dark ground and got a white one. Timing was wrong on 9 of 10. The clearest pattern here is that **the scene translator overrides the planned visual_type using its own reading of the sentence** — a place name anywhere in the sentence steers the beat to MAP-CENTERED regardless of what the description said, which is why three separate photo/document/map descriptions all collapsed into "map of India". That is a **translator bug** with a clear trigger (a place name in the sentence), not a planner problem.

## Cross-cutting findings

1. **The renderer has one ground and it is white.** All 111 frames sit on a light ground (mean pixel 203–247). Eleven beat descriptions explicitly ask for dark/black/charcoal. Every one of those beats is a guaranteed divergence. The planner prompt never states that the ground is fixed.
2. **Three renderer elements are in every frame and in no description:** the caption/subtitle band (~24 of 37 beats flagged it "unexpected"), the `Source: …` attribution (6 beats), and the page counter `NN / NN` (3 beats). The scene_description contract does not mention them, so Gemini correctly reports them as unrequested additions on nearly every beat.
3. **The scene translator overrides the plan's `visual_type`.** 11 of 37 beats drew a different type. `ch-9` shows the trigger: a place name in the sentence forces MAP-CENTERED. `ch-49` shows a second: a photo description with a causal sentence is upgraded to a PROCESS diagram.
4. **When an image cannot be verified, the beat silently becomes a name card.** 6 beats (ch-49 ×3, ch-44 ×2, ch-9 ×1). The verification gate is working as designed — it refuses to render a wrong or unlicensed image — but the plan is not told, and Gemini reads the substitution as a renderer failure.
5. **Timing is almost never honoured.** 34 of 37 beats. No description in any of the four videos produced a timed element that landed on cue; where a description named a timing ("finishes drawing by the time the narrator says X"), the drawn animation was a different one.

## What the user must decide

1. **Dark scenes.** Either the renderer gets a dark ground (and the accent palette inverts with it), or the planner prompt must stop describing dark scenes. Right now 11 beats are guaranteed to diverge and the planner cannot know that.
2. **The scene translator's authority.** It currently overrides the planned `visual_type` — most visibly by forcing MAP on any beat whose sentence names a place. Decide whether the translator may override the plan at all; if not, a mismatch should be logged and the planned type honoured or the beat dropped.
3. **The undeclared frame furniture.** The caption band, source attribution and page counter are in every frame and in no description. Either add them to the description contract so the planner can describe them, or tell the audit to ignore them — otherwise ~24 of 37 beats will keep failing on an element the planner was never asked about.
4. **Photo beats for entities that have no free image.** Six beats asked for a logo or portrait that does not exist in Wikipedia/Commons. The planner needs to know the realistic hit rate, or it needs a way to ask for a type treatment instead of a photo.
5. **Timing extraction.** Timing is honoured on 3 of 37 beats. If the timing phrases in scene_description are meant to drive animation, that path needs to be verified end-to-end; if they are decorative prose, they should be removed from the prompt so the audit stops measuring against them.
6. **Whether 0/37 is the real number.** No beat in any channel matched its description. That is a stronger result than "the renderer drifts a little" — it means the plan and the render are not the same artefact today, and the two documents should be reconciled before any further visual tuning.
