# Caption research (Phase 3)

Status: 33 of 35 reference videos have OCR measurements (3 windows of 60 s each = 180 s of each video); **7 windows (from 6 videos) were also reviewed by eye** (30 tiles at 2 s each; none from the AI Tested group). Method limits are stated beside each number. Confidence is rated per finding.

## 1. Vocabulary: a caption is not every piece of text

The study separates text on screen into types. Only the first four are *editorial captions*; the rest are content or provenance and must not be counted as 'captions'.

| Type | Meaning | Seen in the references (reviewed windows and contact sheets) |
|---|---|---|
| Full subtitles | the whole narration shown as text | **not seen** in any reviewed window or contact sheet |
| Selective / emphasis captions | 1-4 words on a key term, often upper-case | Aperture (https://www.youtube.com/watch?v=IqXpzcfdtn4): 'ASYNCHRONOUS', 'HARMONY AND STILLNESS', 'THE SELF BEYOND THE SELF', 'TURIYA' + 'FOURTH STATE', 'EMPTINESS' |
| Footage labels | short phrase tied to a moment of footage | Football Made Simple (https://www.youtube.com/watch?v=Nx8h403Sj_s): 'VAN DIJK DECIDES NOT TO TRACK', 'EASY PROGRESSION', player name tags on the pitch |
| Titles and chapter headings | section card | Aperture 'Level Three/Five/Six' (about 8:35, 18:05, 21:35), AI Search 'How to speedup generations' (https://www.youtube.com/watch?v=cUeZMUGCxrw, about 16:05), History of the Universe 'PART 2 IS IT INFINITE?' (https://www.youtube.com/watch?v=_IkaetPoBZM, about 14:35) |
| Lower thirds | name and role of a speaker | FRONTLINE (https://www.youtube.com/watch?v=OJ8fsE_GOlg) e.g. 'CATHY SCHULMAN, President, Women in Film', about 19:35; broadcaster lower-thirds in Nicki Swift (https://www.youtube.com/watch?v=nOZQlDg_Ei4); Astrum name tag 'MATTHEW CLEMENT' (https://www.youtube.com/watch?v=pZh5BWCNmmE, about 7:05) |
| Source credits | where the clip or image comes from | RealLifeLore 'Source: YouTube @TheIndependent' (https://www.youtube.com/watch?v=WiRLNEl-4bk, 0:03-1:03); SunnyV2 'Credit: Glamour Awards' (https://www.youtube.com/watch?v=mxCZUz2F24E, 2:20-2:50); Astrum credit line under real images |
| Quoted text | a quote or comment shown as text | RealLifeLore quoted news captions (white box, serif); SunnyV2 and Psych2Go comment/tweet cards |
| Map labels / diagram labels | text that is part of a graphic | RealLifeLore maps, Football Made Simple pitch labels, Kurzgesagt art |
| Document / UI text | text inside a real page or interface | AI Search screens, SunnyV2 article pages |
| Sponsor / call-to-action text | commercial text | RealLifeLore sponsor end card (https://www.youtube.com/watch?v=U_UoAZrOTNU, about 24:05), Football Made Simple QR/CTA blocks. Not relevant to us; excluded from the counts below where possible |

## 2. Automated OCR measurements (indicative only)

Method: RapidOCR on frames at 1 fps inside three 60 s windows per video (start, middle, end); confidence >= 0.6. 'Any text' = share of those seconds with any detected text (includes map labels, UI text, credits). 'Filtered' removes seconds whose nearest sampled frame was labelled map, tactical diagram, chart, screen or document, to approximate editorial captions. Words, text height and vertical position are medians over the filtered seconds. **These figures overstate captions** (they include quoted news captions, credit lines, lower thirds and chapter cards) and 180 s is a sample of each video: use them only to compare, never as a caption rate. Manual review below is the stronger evidence.

| Channel | Video | Any text | Filtered | Words (median) | Text height % of frame | Vertical position (0 top, 1 bottom) |
|---|---|---|---|---|---|---|
| Hidden Past | [Why The Nepal Flood Was WAY Scarier Than You Think](https://www.youtube.com/watch?v=WiRLNEl-4bk) | 75% | 48% | 25 | 6.7 | 0.7 |
| Hidden Past | [Why Everything is Going Wrong for Saudi Arabia](https://www.youtube.com/watch?v=U_UoAZrOTNU) | 69% | 22% | 4 | 7.2 | 0.55 |
| Hidden Past | [Why Russia Thinks It Can Attack Europe and WIN](https://www.youtube.com/watch?v=FA-oEtccS_k) | 79% | 16% | 2 | 5.0 | 0.32 |
| Hidden Past | [Why The US Is Suddenly Attacking Canada](https://www.youtube.com/watch?v=R60ZGwd3n9E) | 26% | 20% | 5.5 | 6.5 | 0.49 |
| Hidden Past | [Why the Pacific Northwest Coast is Insanely Empty](https://www.youtube.com/watch?v=3IVbe0xrRt8) | 61% | 7% | 1.0 | 7.9 | 0.66 |
| AI Tested | [Deepseek strikes again](https://www.youtube.com/watch?v=1Aqhg0FVm-w) | 57% | 28% | 3 | 5.0 | 0.35 |
| AI Tested | [AI is reverse engineering everything](https://www.youtube.com/watch?v=h5zkzon0gM4) | 82% | 54% | 2.0 | 4.6 | 0.53 |
| AI Tested | [New top local AI image generator is here!](https://www.youtube.com/watch?v=cUeZMUGCxrw) | 83% | 37% | 29 | 4.4 | 0.55 |
| AI Tested | [Quantum breakthrough, Gemini 4 Argon, MOSS Image, KLING 4, O](https://www.youtube.com/watch?v=tDWtcyeNNew) | 70% | 39% | 3 | 5.3 | 0.47 |
| AI Tested | [Cybersecurity chaos, AI for DNA, Kimi K3.1, Claude Duet, Des](https://www.youtube.com/watch?v=EfyQOAJjx1A) | 87% | 27% | 11 | 5.4 | 0.51 |
| Court & Spotlight | [How James Corden Destroyed His Reputation](https://www.youtube.com/watch?v=mxCZUz2F24E) | 82% | 22% | 7 | 8.1 | 0.5 |
| Court & Spotlight | [Ellen Just Tried To Make A Comeback... It's Not Going Well](https://www.youtube.com/watch?v=1aAGV7G5zbo) | 96% | 26% | 6 | 7.8 | 0.39 |
| Court & Spotlight | [Why Joe Rogan & Howard Stern Don't Like Each Other](https://www.youtube.com/watch?v=jZpq6BCud7s) | 76% | 76% | 8 | 5.1 | 0.35 |
| Court & Spotlight | [EL CASO DE P. DIDDY: Completo *DOCUMENTAL*](https://www.youtube.com/watch?v=-p_TBe0Re_s) | 22% | 22% | 4.0 | 7.4 | 0.81 |
| Court & Spotlight | [How Harvey Weinstein Tried to Silence Accusers (full documen](https://www.youtube.com/watch?v=OJ8fsE_GOlg) | 44% | 36% | 6 | 5.6 | 0.08 |
| Celebrity News | [The Awakening of Jim Carrey: Hollywood's Worst Nightmare](https://www.youtube.com/watch?v=8r3RQD8rE9E) | 73% | 48% | 4 | 10.1 | 0.52 |
| Celebrity News | [News Anchors Who Vanished After Getting Fired](https://www.youtube.com/watch?v=nOZQlDg_Ei4) | 98% | 98% | 4 | 6.0 | 0.65 |
| Rival Lines | [Flick's Barcelona Tactics Are Crazy](https://www.youtube.com/watch?v=N8PZt_9_adI) | 46% | 34% | 4 | 7.5 | 0.4 |
| Rival Lines | [How Chelsea's Tactics Beat United](https://www.youtube.com/watch?v=KC2Vgjw282s) | 66% | 43% | 5 | 7.1 | 0.33 |
| Rival Lines | [This Was Elite Tactical Problem Solving](https://www.youtube.com/watch?v=Nx8h403Sj_s) | 65% | 38% | 6.0 | 8.2 | 0.43 |
| Rival Lines | [How Mourinho's Tactics Won El Classico](https://www.youtube.com/watch?v=oZaPKaIVIA0) | 61% | 8% | 4 | 7.8 | 0.34 |
| Rival Lines | [The Tactics Of Every Post-Ferguson United Manager](https://www.youtube.com/watch?v=Dki5tjN0rDE) | 60% | 43% | 5.0 | 11.9 | 0.56 |
| Space (Red Space Facts) | [Uranus: The Weirdest Planet in the Solar System](https://www.youtube.com/watch?v=pZh5BWCNmmE) | 74% | 74% | 1.0 | 4.7 | 0.03 |
| Space (Red Space Facts) | [What NASA Found on Io](https://www.youtube.com/watch?v=s0mNlXGd2Bc) | 20% | 17% | 2 | 6.4 | 0.8 |
| Space (Red Space Facts) | [The Cosmic Scale](https://www.youtube.com/watch?v=4iC9Qi3y9q8) | 15% | 15% | 2 | 9.6 | 0.5 |
| Space (Red Space Facts) | [What Is Beyond The Edge?](https://www.youtube.com/watch?v=_IkaetPoBZM) | 27% | 27% | 3 | 10.0 | 0.5 |
| Space (Red Space Facts) | [The Largest Black Hole in the Universe - Size Comparison](https://www.youtube.com/watch?v=0FH9cgRhQ-k) | 55% | 49% | 5.0 | 5.1 | 0.49 |
| Space (Red Space Facts) | [New: Mars In 4K](https://www.youtube.com/watch?v=ZEyAs3NWH4A) | 59% | 59% | 2 | 6.2 | 0.91 |
| Psychology | [The Pygmalion Effect](https://www.youtube.com/watch?v=4aN5TbGW5JA) | 100% | 100% | 4.0 | 6.1 | 0.52 |
| Psychology | [Psychology of Discipline (And How to Trick Your Brain Into C](https://www.youtube.com/watch?v=CkP_8bkjf1E) | 17% | 17% | 2.0 | 8.6 | 0.43 |
| Psychology | [Weird Habits That Actually Reveal High Intelligence (Part 2)](https://www.youtube.com/watch?v=fTltSulVbs8) | 23% | 9% | 1 | 22.1 | 0.26 |
| Psychology | [The Asch Line Study - Conformity Experiment](https://www.youtube.com/watch?v=-W-ML_dG_4Y) | 89% | 89% | 4 | 9.6 | 0.22 |
| Psychology | [Every Level of Consciousness](https://www.youtube.com/watch?v=IqXpzcfdtn4) | 18% | 14% | 2.0 | 9.3 | 0.5 |

## 3. Manual review of 60-second windows (observed)

Method: the window's 60 seconds extracted at one tile per 2 s (30 tiles, 6x5) and inspected by eye. Observed facts only; interpretation is separated. Seven windows reviewed from six videos, covering six channel groups (Hidden Past twice); no AI Tested window was reviewed by eye.

| Video and window | Observed | Caption types present | Confidence |
|---|---|---|---|
| Aperture, Every Level of Consciousness, 15:05-16:05 (https://www.youtube.com/watch?v=IqXpzcfdtn4) | Captions on 7-8 of 30 tiles (about 25% of the window). 1-4 words, upper-case bold sans-serif, white, no box, centred horizontally and placed about 55-70% down the frame, held about 2-6 s; 'A' is followed by 'ASYNCHRONOUS' (word build-up). Host-on-camera tiles have no caption; B-roll with no key term has none. 'TURIYA' appears with a small Sanskrit line above and 'FOURTH STATE' small beneath | emphasis, section label | Medium (one window; the only video of 33 where narration keywords were captioned) |
| RealLifeLore, Nepal flood, 14:35-15:35 (https://www.youtube.com/watch?v=WiRLNEl-4bk) | No narration captions. The text is elevation-chart and map labels inside the infographic | map and chart labels | Medium |
| RealLifeLore, Nepal flood, 0:03-1:03 | News clips with white-box black-serif captions of 12-20 words in 2-3 lines in the bottom third, plus 'Source: YouTube @TheIndependent' and the CCTV time stamp | quoted news text, credit | Medium |
| FRONTLINE Weinstein, 17:00-18:00 (https://www.youtube.com/watch?v=OJ8fsE_GOlg) | Zero overlay captions in 60 s: interview takes of about 6-12 s with B-roll of hotel interiors; elsewhere in the video (contact sheets) lower-thirds appear when a new interviewee is introduced | none in window; lower thirds elsewhere | Medium |
| Carrey commentary, 17:00-18:00 (https://www.youtube.com/watch?v=8r3RQD8rE9E) | No narration captions. Evidence pages (box-office page, Wikipedia table with the discussed row highlighted yellow, magazine article) and a 24 s archival interview carrying only the broadcaster's lower third and CNN bug | document text, broadcaster lower third | Medium |
| Football Made Simple, Elite Tactical Problem Solving, 3:39-4:39 (https://www.youtube.com/watch?v=Nx8h403Sj_s) | Two captions in about 12 footage tiles ('VAN DIJK DECIDES NOT TO TRACK', 'EASY PROGRESSION'), thin white upper-case, set in the pitch's perspective, lower-left; none on tactical-diagram tiles; sponsor text with QR at the end | footage labels, sponsor | Medium-Low |
| Astrum, Uranus, 17:00-18:00 (https://www.youtube.com/watch?v=pZh5BWCNmmE) | No narration captions. Real images carry a one-line descriptive label top-left in small white text ('Observation of a polar cyclone on Uranus') and a tiny grey credit line bottom-left; paper figures keep their own labels; CG shots have no text | image label, credit | Medium |

## 4. What the evidence says (inferred) and what to do (recommendation)

**Observed fact:** in the six reviewed windows, narration was never shown as full subtitles, and keyword captions on narration appeared in one video (Aperture). Text that exists is mostly content (labels, documents), provenance (credits, lower thirds) or structure (chapter cards).

**Recommendation (confidence Medium):** do not put a caption on every scene. A caption layer should exist for (a) key-term emphasis on live-action B-roll, (b) footage labels, (c) lower thirds for named people, (d) source credit on every borrowed clip or image, (e) chapter cards. Narration subtitles are not supported by this evidence for any of the seven channels.

### Per-channel caption rules (derived from evidence; provisional where noted)

| Channel | Rule | Evidence | Confidence |
|---|---|---|---|
| Hidden Past | No narration captions. Map/place labels live inside the map. A credit line (small, lower-left) on every real clip or photograph. Quoted news text only when the narration quotes it, in a boxed quote caption with attribution. | RealLifeLore windows above; five videos' overlay share 0-33% of sampled frames (mostly map labels, credits, sponsor card) | Medium |
| AI Tested | No captions over screen recordings. Section cards between chapters. Use highlight boxes and cursor emphasis inside the capture for 'look here'. | AI Search overlay on 1-6% of sampled frames, chapter cards at about 16:05 and 17:50 (cUeZMUGCxrw), 'up to 10 keyframes' call-out (tDWtcyeNNew, about 17:50) | Medium |
| Court & Spotlight | Lower-third for each new person (name + role); highlight the quoted passage on the document; credit line on third-party clips; no narration subtitles. | FRONTLINE lower-thirds; SunnyV2 highlights (Ellen video 3:20, 4:50, 6:35, 9:05-9:50) and 'Credit:' lines (Corden video 2:20-3:20) | Low-Medium (3 formats; 2 low-coverage videos) |
| Celebrity News | Source/credit line on every clip; evidence page with the relevant row highlighted; broadcaster lower-thirds are the original's own and should not be re-created. No decorative text. | Carrey 17:00-18:00; Nicki Swift contact sheet | Low (2 videos) |
| Rival Lines | Short (2-4 words) footage labels in the pitch's perspective on match footage; none on tactical diagrams; player name tags on the pitch. | Football Made Simple 3:39-4:39 and contact sheets of the other four videos | Medium-Low |
| Space | One-line label and credit under every real image; no caption on CG reconstructions except 'reconstruction' where it is not obvious; map/figure labels from the source. | Astrum 17:00-18:00; Mars 4K place-name labels on the panorama at sampled frames (https://www.youtube.com/watch?v=ZEyAs3NWH4A, 0:05, 0:50, 1:05, 1:50 ...) | Medium-Low |
| Psychology | Live-action/cinematic: 1-4 word emphasis captions on key terms (upper-case sans-serif, centred, about 55-70% down, 2-6 s), none on host or on B-roll without a term. Illustrated/whiteboard: text is drawn into the artwork; no overlay captions. | Aperture window; four illustrated references | Medium-Low |

### Open measurements (not done)

- Caption **entrance/exit animation** was not measured frame by frame; only the word build-up in Aperture was observed.
- **Font family and weight** were not identified by name; descriptions are visual (serif, thin sans-serif, bold sans-serif).
- Manual window review covers 6 of 33 videos; the OCR table covers all but is not a caption rate.
