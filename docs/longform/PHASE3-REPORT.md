# Phase 3 report: research completion, validation and quality gate

Branch `feat/longform`. Nothing was merged to main, published, rendered as video, or changed in Shorts. Only still frames were rendered. Protected files (`server.js`, `rix.json`, `signal_aggregator/lib/**`, `task.txt`) were not touched. Checkpoints: tag `longform-v3-research-checkpoint` (research and tools, before any production component changed); tag `longform-v2-phase2-checkpoint` (Phase 2 state).

## 1. The reference study

- **33 of the 35 planned reference videos were analysed**: 680 minutes inspected of 895 minutes (2,726 sampled frames). Per channel: Hidden Past 5, AI Tested 5, Court & Spotlight 5, Rival Lines 5, Psychology 5, Space 6, Celebrity News 2 (plus the SunnyV2 Corden video, which also fits).
- **Incomplete**: `REor4fN2K3Y` and `x_d9A5W2940` (Celebrity News). YouTube answered every fetch with "sign in to confirm you're not a bot"; the retries ran every 10 minutes for 30 minutes and all failed; no cookies were used. Celebrity News therefore rests on 2 analysed videos (+1 related) and is rated **Low** confidence.
- **Reduced coverage**: two Court & Spotlight videos were analysed from 300-second clips saved in an earlier phase (`jZpq6BCud7s` 47%, `-p_TBe0Re_s` 7% of a 73-minute documentary). Long videos were capped at 2,100 s (Rival Lines *Post-Ferguson* 42%, Canada 66%, Russia 80%).
- **Single-channel groups**: Hidden Past, AI Tested and Rival Lines each come from one reference channel; their results describe that channel's style.
- Everything is in `docs/longform/VISUAL-EDITING-RESEARCH.md`, `CAPTION-RESEARCH.md`, per-video records in `docs/longform/research/phase3/VIDEO-RECORDS.md`, with method beside every number.

## 2. What was verified by hand, and what remains uncertain

Verified manually (contact sheets and window reviews, with files saved in the research workspace): all 2,726 category labels were assigned by eye from 240-px tiles; seven 60-second caption windows from six videos (Psychology, Hidden Past x2, Court, Celebrity, Rival Lines, Space; none from AI Tested) were reviewed tile by tile; three 180-second windows were re-labelled at 3 s steps to measure the sampling error; one 120-second window was counted by eye against the shot detector; seven spectrogram windows were extracted and five were inspected (Psychology, Hidden Past, Court, Rival Lines, Space).

Measured errors: 15-second sampling put the largest category 5-20 points high and missed 5-15% categories entirely on fast-cut videos, so **every category percentage carries about +-5 to +-12 points**. The dissolve-aware shot detector found about 17 of 21 changes in the checked window (+-15%). Camera movement on stills (zoom, pan, crop) was **not measured**. Footage provenance (real vs stock vs commissioned) cannot be read from frames. Automated OCR overstates captions; the manual window reviews are the evidence.

## 3. What the measurements show

- **Visuals** (sampled share of real captured material, footage/photos/archive/real screens and documents): Hidden Past 56-73% per video, AI Tested 56-81%, Court & Spotlight 35-99%, Celebrity News 96-100%, Rival Lines 14-40%, Space 2-93%, Psychology 0-76%. Frames labelled AI-generated appear only in AI Tested (the subject being tested). Median shot length of the cut-based videos is about 3-6 s in every channel; what differs is the share of long holds. Constructed stretches run 60-135 s in Hidden Past and up to 765-885 s in single Kurzgesagt and PsychToons videos.
- **Captions**: narration subtitles were not seen in any reviewed window. Text on screen is mostly content (map labels, documents), provenance (source credits, lower thirds) or structure (chapter cards). Keyword emphasis captions (1-4 words, upper-case, centred, held 2-6 s) appeared in one video (Aperture); perspective-matched footage labels in another (Football Made Simple). Recommendation: no caption on every scene; credit on every borrowed picture.
- **Editing rhythm**: 7-12 shots per minute in Hidden Past, AI Tested, Court and Celebrity; 5-10 in Rival Lines; very slow for panorama and whiteboard formats. 20-30% of time is near-static in Hidden Past; 41-64% in the screen-recording channel (pages being read).
- **Sound** (measured, not heard): reference loudness spans -23.4 to -11.7 LUFS with no common value; one RealLifeLore window is voice only with near-silent gaps; Frontline, Aperture, Astrum and a Football Made Simple window show a continuous low bed under speech; four of five Football Made Simple videos show 7-10 low-frequency impact candidates per minute. Beds sit about 20-36 dB below speech in pauses.

## 4. Sound library, listening and the demo mix

- **No one has listened to any audio.** The model that did the work cannot hear. The listening review the directive requires is **not done**; it was prepared: `output/longform-audio-demo/audition-reel.mp3` (all 35 assets, 7 min) with `audition-index.json`, and a listening record table in `SOUND-LIBRARY-REGISTER.md`. Assets that passed listening review: **none**. Assets approved: none; rejected: none.
- Machine QA (measurable defects only): **16 of 35 assets need correction before they can be auditioned or mixed** (11 peak at or above 0 dBTP, 15 have samples at full scale; the union is 16: `SFX_SHIP_HORN`, `SFX_APPLAUSE`, `AMB_STADIUM`, `AMB_RADIO_STATIC`, `SFX_ROCKET`, `SFX_GAVEL`, `SFX_MOUSE_CLICK`, `SFX_IMPACT`, `SFX_RECORD_SCRATCH` and seven of the eight music beds). 19 are pending audition. 14 have a loop seam, 5 end without a decay, 13 carry silence to trim. All 35 licences were re-checked at their source pages (CC0 or CC BY only; CC BY needs attribution). BBC Sound Effects is excluded (not for monetised use); Sonniss, Pixabay and Freesound were not cleared from primary text and were not used.
- Demo mix (`mix-demo.sh`, 25.5 s of AI Tested narration, not auditioned): exported **WAV -13.9 LUFS, LRA 2.4, true peak -1.8 dBTP; MP3 -14.2 LUFS, -2.0 dBTP** after a true two-pass `loudnorm` (the first attempt, single pass, measured -13.4 LUFS). Music 26 dB below speech in pauses, 8.3 dB duck. Whether the music is audible or pleasant, and whether the effects serve the story, is unknown. Listening conditions tested: none.
- Seven **cue sheets** (`docs/longform/cue-sheets/`): 2-10 cues per episode, every cue with a written purpose, all "audition pending". Three rules (record scratch, applause, clock tick) were removed after the beats they fired on turned out not to fit their purpose.

## 5. What changed in production components

Kept on purpose (the evidence supports them): the map engine, StatsBomb 360 animation, Commons photo scenes, real court-document pages, drawn Psychology cards, the 3D planet and seasons scenes.

Improved:
1. **Credits**: every authentic photograph now carries a credit line from its attribution record (`credits.mjs` + generic overlay), fixing 3 channels that failed the credit check (Hidden Past 6 pictures, Celebrity News 11, Space 4).
2. **Celebrity News**: three licensed portraits (Braun at TechCrunch 2010 and in a 2020 interview, Swift at the 2023 VMAs) replace repeats of one portrait (5 uses to 3) and one Braun photo (3 uses to 1).
3. **Space**: Miranda's beat shows the real Voyager 2 image (NASA public domain) with label and credit instead of a 3D sphere; timeline thumbnails no longer repeat one Voyager frame (4 uses to 2).
4. **AI Tested**: the paper the narration cites is a real browser capture of the arXiv page with the discussed sentence highlighted (new beat A09b, the old graphic follows as A09c); two unrelated leftover capture files were removed from the episode's media. Authentic share 6% to 12%; longest constructed stretch 193 s to 122 s. The capture is a third-party page screenshot: **owner decision** (quotation use), like the existing model-page capture.
5. **QA system**, **cue sheets**, **sound library tools**, **research tooling**, and a custom skill `.claude/skills/longform-audio-mix` (recipe followed and run; not invoked through the Skill tool because skills are discovered at session start).

Not improved, stated plainly: Hidden Past still reuses one NASA orbital photograph on 4 beats (no further licensed period photographs were found in this pass), and its H04 figure card shows that photograph darkened behind a stats card; Court & Spotlight, Rival Lines and Psychology scenes are unchanged; Celebrity News still fails the authentic-share and constructed-stretch checks against a two-video, provisional band (explainer beats have no real picture); AI Tested remains far below its reference band on authentic share (our test replies are shown in a drawn chat UI; there is no public page to capture).

## 6. QA results (plan-level, same tool before and after)

| Channel | Before | After |
|---|---|---|
| Hidden Past | V5 WARN, **V6 FAIL** | V5 WARN, V6 PASS |
| AI Tested | **V2 FAIL**, V3 WARN, V11 WARN | V2 FAIL (6% to 12%), V3 PASS, V11 WARN |
| Court & Spotlight | clean except V10 and A4 | unchanged |
| Celebrity News | **V2 FAIL, V3 FAIL**, V5 WARN, **V6 FAIL**, V9 WARN | V2 FAIL, V3 FAIL, V5 WARN, V6 PASS, V9 WARN |
| Rival Lines | clean except V10 and A4 | unchanged |
| Space | V5 WARN, **V6 FAIL** | V5 PASS, V6 PASS |
| Psychology | clean except A4 | unchanged |

A4 (assets approved by listening) is WARN everywhere by design until a person auditions the assets; V10 asks a person to confirm that flagged pictures match their narration. Full tables: `PRODUCTION-QA-STANDARDS.md`, `docs/longform/qa-baseline/`, `docs/longform/qa-after/`.

## 7. Approval package (stills and previews only; no video)

In `output/` (not committed):
- `longform-approval-p3/boards/<channel>.jpg` and `overview.jpg`: reference frame | our Phase 2 frame | proposed frame, seven channels; where nothing changed the board says "unchanged".
- `longform-approval-p3/<channel>/`: the re-rendered stills (credit lines, new portraits, Miranda, arXiv paper) with their contact sheets; `longform-approval-before-p3/` keeps the Phase 2 stills for comparison.
- `longform-audio-demo/`: `mix-test-aitested.mp3/.wav` (demo mix), `audition-reel.mp3` + `audition-index.json`.
- In the repo: six research documents, cue sheets, QA reports, the sound library register with machine QA and a blank listening record.

Tested versus proposal: tested = the measurements, the QA tool runs, the rendered stills, the mix chain and its loudness numbers. Proposal = every channel sound grammar, every cue, every caption rule, every threshold (all provisional).

## 8. Limitations that remain

No listening review; 2 references not fetched; single-channel reference groups; sampling error of +-5 to +-12 points; footage licensing for football, celebrity and court material is still unresolved (no licensed footage exists); judiciary.uk reuse terms and StatsBomb commercial terms still to be checked; owner decisions pending on Celebrity News (new channel or a Court & Spotlight format) and on page-screenshot quotation use. Stopping here for approval; no video render, no publish, no merge.
