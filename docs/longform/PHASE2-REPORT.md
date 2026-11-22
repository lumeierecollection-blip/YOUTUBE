# Long form, phase 2: all channels, competitor content and thumbnails, real media (13 Nov 2026)

Stills only. No video or timeline was rendered, nothing was published, nothing merged to `main`, Shorts untouched. The approved
four-channel baseline is kept: git tag `longform-v2-baseline-4ch` and `output/longform-approval-v2-baseline/`.
Approval package: GitHub Actions run on branch `stills/longform-v2-phase2` (artifact `longform-stills-<run>`), local copy
`output/longform-approval-gh2/` — per channel: `contact-sheet.jpg`, `storyboard.jpg` (frames in beat order with narration),
`sheet-opening.jpg`, `sheet-scenes.jpg`, `sheet-transitions.jpg` (start/middle/end), `sheet-thumbs.jpg`, every still labelled.

## 1. Channel audit (`CHANNEL-AUDIT.md`)
Seven channels covered: Hidden Past, AI Tested, Court & Spotlight, Rival Lines (registry, uploads configured), Red Space Facts (Space),
Dopamine Loop + Gray Matter (Psychology; one system serves both), and **Celebrity News, which does not exist in any config**. Court &
Spotlight's registry entry currently owns all three celebrity formats. Celebrity News was therefore built as its own system
(`celebrity-news`) without registering a channel: **owner decision needed** — new channel, or Court & Spotlight's non-legal formats.
World View (geopolitics) exists and was not touched.

## 2. Research
- **Competitors studied: 24 channels** — Space: Astrum, The Space Race, SEA, Kurzgesagt, History of the Universe, ElderFox Documentaries.
  Psychology: Sprouts, PsychToons, Psych2Go, Practical Psychology, Aperture. Celebrity: Nicki Swift, The List, Patrick Cc:, SWOOP, SunnyV2,
  As Told by JP. Original four (editorial): RealLifeLore, Johnny Harris, AI Search, Matt Wolfe, Football Made Simple, Tifo Football, Law&Crime.
- **Videos:** 4,668 titles with views/durations (newest ≤250 long videos per channel); 240 videos with upload dates and thumbnails (top 5 +
  newest 5 per channel); 16 new videos studied in content (frames + transcripts) + the 20 fixed references.
- **Databases:** `research/competitors.json` (stats, top/newest, outliers relative to each channel's median), `research/topicdb.json`
  (every title, category, multiple), `research/thumbnail-language.json` (observed language per channel), `research/thumbnail-stats.json`
  (measured colour per thumbnail), boards `research/boards/`.
- **Findings** (`research/COMPETITORS.md`): psychology named effects and classic experiments are the strongest categories (2.0–2.1x median,
  42–48% outliers); space: black holes 1.96x, stars 1.50x, scale 1.44x, one named planet with a fresh angle; celebrity: format beats topic —
  point-of-view commentary/documentary channels (medians 0.9–3.1M) versus collapsed list channels (Nicki Swift 4k, The List 3k on 2–3M subs);
  music-career explainers 1.22x. AI and football long form are low-variance; a clear thesis makes the outliers.
- **Ranked opportunities:** 21 (3 per channel) in `research/OPPORTUNITIES.md`, each with category multiple, competitor signal, evidence,
  usable pictures, thumbnail direction, length, confidence and risk. 7 are researched samples; 14 are desk-checked.
- **Gaps:** dates only for top/newest; titles categorised by keyword rules (30–39% uncategorised); one video studied per new channel; audio
  not analysed for new references.

## 3. Media (`MEDIA-ACQUISITION.md`, per-episode `MEDIA-MANIFEST.json`)
- **Acquired, licensed:** 59 assets in the manifests — NASA/JPL/STScI images (PD), NASA SVS item 4666 video (PD; 2 × 96 s, 520 MB kept
  outside git, frames used), Solar System Scope textures (CC BY 4.0), 22 new Commons photographs (CC0/BY/BY-SA, La Moncloa "Attribution"),
  court PDF pages and gov.uk pages (OGL; judiciary terms to re-read), our own captures and test runs.
- **Not licensed / owner decision:** 6 AI Tested page captures (third-party pages, quotation use).
- **Missing footage:** no licensed match footage, press conferences, interviews, red-carpet, talk-show, music-video or court video. Footage
  gaps per episode (reference used video, we use stills/data): Hidden Past 6, Rival 7, Celebrity News 5, Court 2, AI 0, Space 0, Psychology 0.
- **Replacements:** event-data animation (football), licensed stills with credit, document captures with highlighted lines, recreated public
  statements (words only, cited), diagrams and data charts, NASA visualisation frames labelled as visualisations.

## 4. Production
- **New systems:** `lf2/space.jsx` (three.js planet with real texture and tilt, tilt and seasons models from fact-sheet values, real-image
  plates with provenance badges, true-scale comparison, mission timeline, fact bars), `lf2/psych.jsx` (evidence chips, concept cycle,
  experiment reconstruction, study cards, effect-size plot from real meta-analysis data, claim-vs-evidence, scenario), `lf2/celebnews.jsx`
  (magazine cover and record cards, VOX ownership/money flow, explainer, then-vs-now, bars, recreated statements; reuses Court's evidence
  components for the investigation treatment). Rival Lines gained a licensed-photo scene.
- **Tools:** Playwright capture with recording (`capture.mjs`), pypdfium2 (`pdfpage.py`), Commons with licence enforcement (`assets.mjs`),
  NASA SVS API, StatsBomb prep, media manifest + gap check, topic/thumbnail database scripts (`research/*.mjs|sh`).
- **Skills:** see `SKILL-REGISTER.md`. This phase used the remotion-maps rules again (maps) and the existing in-repo skills; no new skill was
  invoked through the Skill tool in phase 2. Found and not installed: video-shotcraft (already in `.opencode/skills`), motion-skills,
  Claude-Code-Video-Toolkit (overlap).
- **Defects found in review and fixed:** 3D planet blank in the first still of a session (texture race; explicit draw before release),
  planet too close and rings too heavy, tilt counter stopping short, faint timeline events, study cards too high, thumbnail stamp
  overlapping, celebrity photo mismatch on one scene, Rival "wins" miscount (4 → 3) caught in fact-checking.

## 5. Samples and scripts (`episodes/<channel>-<slug>/SCRIPT.md`)
| Channel | Sample | Why chosen | Words | Speech at 150 wpm |
|---|---|---|---|---|
| Red Space Facts | Uranus: The Planet That Rolls Around the Sun | Astrum's Uranus 3.0x (Oct 2026); real PD imagery and NASA data | 1,167 | 7.8 min |
| Celebrity News | Why Taylor Swift Re-Recorded Her Albums, and How She Got Them Back | music explainers 1.22x; documented arc with both sides' statements | 1,058 | 7.1 min |
| Psychology | The Pygmalion Effect: What the Famous Experiment Really Found | named effect 2.11x; Sprouts' top video; real meta-analysis data | 1,030 | 6.9 min |
| Court & Spotlight | Boris Becker: Four Guilty Verdicts, Twenty Acquittals | primary court document; findings vs acquittals | 871 | 5.8 min |
| Hidden Past | The Ships Trapped in the Suez Canal for Eight Years | map-led history; PD photos | 816 | 5.4 min |
| Rival Lines | How Spain Won the Euro 2024 Final, in Data | full 360 data for a major final | 786 | 5.2 min |
| AI Tested | At What Size Does AI Multiplication Break? | our own test, raw replies | 707 | 4.7 min |
Runtime is narration plus visual holds (maps, real images, data animations play without narration), so episodes run longer than the speech
time; **only the three new samples are near the 8-minute floor; the four original samples are still short of 8–13 minutes.**

## 6. Limitations
- Scripts: four originals below 8 minutes of narration; lengthening needs more research per section.
- No motion, audio or pacing verified (stills only). Music beds still missing from the repo.
- Celebrity News has no channel; footage for celebrity, court and football is not licensed; StatsBomb commercial terms unconfirmed;
  judiciary.uk reuse terms to re-read.
- 3D terrain with filled areas fails under software GL (fill scenes use flat maps).
- Two small AI models only; larger ones hit quota.
- Research coverage limits listed in `research/COMPETITORS.md`.
