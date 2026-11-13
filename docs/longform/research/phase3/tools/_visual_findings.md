## 7. Findings by channel

Format of each finding: **Observed** (what was seen, with video, URL and interval) / **Measured** (table or script figure and its method) / **Inferred** (my interpretation, labelled as such) / **Implication** (what it should change in our system) / **Confidence**.

### Hidden Past (5 videos, all RealLifeLore)

**F-HP-1. Real material is the majority; maps are interleaved, not continuous.**
Observed: the five videos alternate map sequences with drone/B-roll footage, news clips, public-appearance footage and archive. Example: *Why Russia Thinks It Can Attack Europe and WIN* (https://www.youtube.com/watch?v=FA-oEtccS_k), 0:00-2:00: three map frames, two public-appearance clips, an armoured-vehicle clip, two more map frames (contact sheet 1, tiles 1-8). Measured: real captured 56-73% of sampled frames, maps and data 26-42% (section 3-4); longest all-map stretch 60-135 s (section 4); no frame labelled AI-generated in 642 sampled frames. Inferred: the channel's rule is 'a map explains, a photograph or clip proves'. Implication: a Hidden Past map sequence should not run past about two minutes without a real photograph, clip or archive item; every map scene should be followed by real material. Confidence: **Medium** (one channel; coverage 66-100%; sampled error +-5-12 points).

**F-HP-2. History topics bring in period material.**
Observed: *Why the Pacific Northwest Coast is Insanely Empty* (https://www.youtube.com/watch?v=3IVbe0xrRt8), about 9:20-9:35, 16:05-16:35, 18:35-19:05 and 22:20-23:05: a period shipping-poster print, engravings of fur traders, archival black-and-white ship footage, an old chart. *Why The US Is Suddenly Attacking Canada* (https://www.youtube.com/watch?v=R60ZGwd3n9E), 8:05-11:05 and 15:35-17:50: engravings, treaty-signing prints, archival film. Measured: photos+archive 24% (Pacific NW) and 16% (Canada) of sampled frames versus 0-1% in the Saudi and Russia videos. Inferred: historical period material is used where the topic has history; contemporary topics use news footage instead. Implication: our Suez/ancient-history style scenes need real period material (Wikimedia/Library of Congress type sources with credit) and the planner should choose it for date-bound beats. Confidence: **Medium**.

**F-HP-3. Borrowed footage carries its source.**
Observed: *Why The Nepal Flood Was WAY Scarier Than You Think* (https://www.youtube.com/watch?v=WiRLNEl-4bk), 0:03-1:03: CCTV and news clips with a white-box quoted news caption in a serif face and a burned-in 'Source: YouTube @TheIndependent' credit plus the original CCTV time stamp (manual review of the 60 s window, 30 tiles at 2 s). Measured: not a rate; one window reviewed manually. Implication: any real clip we use needs a visible credit line; our hard rule (no unsourced media) is the same practice the reference follows. Confidence: **Medium-Low** (one video, one window).

**F-HP-4. Rhythm.**
Measured (dissolve-aware detector): 7-12 shots per minute, median shot 3.5-5.8 s, 21-35% of shots under 3 s, 7-27% over 10 s (section 5; +-15% on shots/min). The over-10-second shots are slow map camera moves and aerials, not holds. Static share of time 20-30% (section 6). Implication: a map scene that holds one framing for 30+ s is outside what these videos do; map scenes should carry camera movement or change of overlay at least every 10 s. Confidence: **Medium**.

### AI Tested (5 videos, all AI Search)

**F-AT-1. The picture is the software.**
Observed: e.g. *Deepseek strikes again* (https://www.youtube.com/watch?v=1Aqhg0FVm-w), sampled 0:35-24:05: terminals, model pages, leaderboards, the tool's own UI, with the generated output shown inside the UI (3D scenes, images, a DAW timeline). Measured: screen recordings and documents 33-77% of sampled frames (pooled 57%); generated output (AI-generated imagery) 0-21% (pooled 14%); charts and benchmark tables inside 'documents'; motion graphics 2-19%. No host on camera (<=1%). Inferred: AI-generated imagery appears only as the subject being tested, never as decoration. Implication: our AI Tested scenes should be real captures (browser, terminal, real pages, real papers) with generated outputs shown as outputs; no invented 'futuristic interface' panels. Confidence: **Medium** (single channel).

**F-AT-2. Text on top of the screen is rare and structural.**
Observed: chapter cards ('How to speedup generations', 'How to edit images with MOSS' in https://www.youtube.com/watch?v=cUeZMUGCxrw, about 16:05 and 17:50), a few call-outs such as 'up to 10 keyframes' (https://www.youtube.com/watch?v=tDWtcyeNNew, about 17:50). Measured: overlay text on 1-6% of sampled frames. Implication: no caption layer on screen scenes; use highlight boxes/cursor emphasis inside the capture where something needs attention. Confidence: **Medium**.

**F-AT-3. Long holds are accepted when the screen is being read.**
Measured: 41-64% of the time is 'static' by the change score; longest static stretch 20-137 s (137 s: https://www.youtube.com/watch?v=EfyQOAJjx1A, a page held on screen). Interpretation: the viewer reads; the narration carries the change. Implication: our QA 'long unchanging visual' limit must be screen-capture-aware (provisional; section PQ in the QA document). Confidence: **Low-Medium**.

### Court & Spotlight (5 videos, three formats, two low coverage)

**F-CS-1. Three different editing models were present.**
(a) Interview-led documentary: *How Harvey Weinstein Tried to Silence Accusers* (FRONTLINE, https://www.youtube.com/watch?v=OJ8fsE_GOlg): real captured 99% of sampled frames, interviews 42%, B-roll of dim reconstructed interiors and city streets, archival TV/film clips; no map/graphic frame in the sampled 35 minutes. Manual window review 17:00-18:00: zero overlay captions. (b) Commentary built on evidence: SunnyV2 *How James Corden Destroyed His Reputation* (https://www.youtube.com/watch?v=mxCZUz2F24E) and *Ellen Just Tried To Make A Comeback...* (https://www.youtube.com/watch?v=1aAGV7G5zbo): 88-90% real captured; screenshots/tweets/articles 42-45% of frames; clips 30%; 49-51% of frames carry overlay text. (c) Dated transcript cards: *Why Joe Rogan & Howard Stern Don't Like Each Other* (https://www.youtube.com/watch?v=jZpq6BCud7s), first 5:00 only: 60% text cards (dated, speaker-coloured transcript) between archival radio-studio clips. (d) Spanish documentary compilation *EL CASO DE P. DIDDY* (https://www.youtube.com/watch?v=-p_TBe0Re_s), first 5:00 of 73:00 only (7% coverage): archival and news clips, a topic-iceberg graphic. Inferred: no single 'Court' style was observed. Implication: our Court & Spotlight needs real court documents, filings and public-record media; the evidence-highlight practice (below) is the one transferable device. Confidence: **Low-Medium** (heterogeneous; two videos at 47% and 7% coverage).

**F-CS-2. Evidence is shown with the exact passage highlighted.**
Observed: SunnyV2 Ellen video, article/tweet/comment screens with yellow, teal or magenta highlights at about 3:20, 4:50, 6:35 and 9:05-9:50 (contact sheet 1, tiles 14, 20, 27, 37-40); Corden video, highlighted article/comment screens at about 1:05, 1:50 and 4:20-5:35. Frontline: none. Implication: our document scenes should highlight the quoted line in sync with the narration. Confidence: **Medium** (two videos, same channel).

**F-CS-3. Third-party clips are credited on screen.**
Observed: SunnyV2 Corden video, 'Credit: Glamour Awards' 2:20-2:50, 'Credit: Rob Brydon Show' 3:20, 'Credit: Joe Rogan / Bill Maher' 7:35; Frontline lower-thirds and 'Originally aired on' tags. Implication: same as F-HP-3. Confidence: **Medium**.

### Celebrity News (2 analysed, 1 shared SunnyV2; 2 blocked)

**F-CN-1. Archive, news clips and documents; almost no constructed graphics.**
Observed: *The Awakening of Jim Carrey* (https://www.youtube.com/watch?v=8r3RQD8rE9E, 81% analysed): host to camera (33% of sampled frames), TV and film clips (archival), news clips, a few stills, box-office and Wikipedia pages as evidence; *News Anchors Who Vanished After Getting Fired* (https://www.youtube.com/watch?v=nOZQlDg_Ei4): news-broadcast and other clips 79% of sampled frames with the broadcaster's own lower-thirds, stills 21%, overlay on 60%. Measured: constructed 0-4%; static share 11-20%; shots 10-12/min, median 4.0-4.2 s. Manual window review 17:00-18:00 of the Carrey video: no narration captions; evidence pages with the relevant row highlighted; an archival interview excerpt kept on screen about 24 s (17:36-17:58). Implication: our Celebrity News must have real stills/clips and real documents, and no decorative graphics; the host-or-no-host choice is a channel decision, not a research result. Confidence: **Low** (2 videos plus 1 related; the other 2 planned videos could not be fetched).

### Rival Lines (5 videos, all Football Made Simple)

**F-RL-1. A tactical diagram is the main picture; annotated match footage punctuates it.**
Observed: https://www.youtube.com/watch?v=Nx8h403Sj_s (This Was Elite Tactical Problem Solving), first 8:00: pitch with player cut-outs, then broadcast footage with highlight beams, name tags and arrows, then the pitch again; stats panel with QR code at the end. Measured: tactical diagrams 42-69% of sampled frames (pooled 55%); real footage 11-36% (pooled 20%); stat tables 3-14%; tactical runs average 26-60 s, footage runs 15-22 s (labels); overlay on 20-36% of frames. Implication: our StatsBomb-360 pitch animation is the right primary visual, and each tactical run longer than about a minute should be followed by real or annotated footage if we can license any. Confidence: **Medium** (single channel; licensing of the footage in the references is unknown).

**F-RL-2. Captions on footage only.**
Observed: https://www.youtube.com/watch?v=Nx8h403Sj_s, 3:39-4:39 (manual window): 'VAN DIJK DECIDES NOT TO TRACK' and 'EASY PROGRESSION' placed in the pitch's perspective on the footage; none on tactical-diagram frames. Implication: captions go on footage moments that need a label; the diagram explains itself. Confidence: **Medium-Low** (one window).

### Space (6 videos, 6 channels)

**F-SP-1. Real imagery versus reconstruction is a genuine editorial axis, not a rule.**
Measured: *New: Mars In 4K* (ElderFox, https://www.youtube.com/watch?v=ZEyAs3NWH4A): 93% real spacecraft photographic panoramas, 7% title/end cards; *What Is Beyond The Edge?* (History of the Universe, https://www.youtube.com/watch?v=_IkaetPoBZM): 55% real (astronomical images, archive, footage), 43% constructed; *Uranus* (Astrum, https://www.youtube.com/watch?v=pZh5BWCNmmE): 34% real (spacecraft/telescope images, interview, papers) and 64% constructed; *The Cosmic Scale* (SEA, https://www.youtube.com/watch?v=4iC9Qi3y9q8) 19% real; *What NASA Found on Io* (The Space Race, https://www.youtube.com/watch?v=s0mNlXGd2Bc) 17%; *The Largest Black Hole* (Kurzgesagt, https://www.youtube.com/watch?v=0FH9cgRhQ-k) 2%. Observed practice on real images (Astrum, manual window 17:00-18:00): one-line descriptive label and a small credit line beneath the image; paper figures keep their own labels. Inferred: the channel with the most reconstruction (Kurzgesagt) uses an original art style, not realism. Implication: for Space we can state the choice per episode; real NASA/ESA images need credit and label, reconstructions should be recognisably illustrative or labelled as reconstruction. Confidence: **Low-Medium** (six different channels; the spread is wide, so the pooled figure should not be used as a target).

### Psychology (5 videos, 5 channels, two formats)

**F-PS-1. Four of five are illustrated or whiteboard explainers.**
Measured: *The Pygmalion Effect* (Sprouts, https://www.youtube.com/watch?v=4aN5TbGW5JA) 95% whiteboard; *The Asch Line Study* (Practical Psychology, https://www.youtube.com/watch?v=-W-ML_dG_4Y) 96% whiteboard; *Psychology of Discipline* (PsychToons, https://www.youtube.com/watch?v=CkP_8bkjf1E) 100% illustrated stills; *Weird Habits That Actually Reveal High Intelligence* (Psych2Go, https://www.youtube.com/watch?v=fTltSulVbs8) 90% illustrated with reddit-style comment cards. The fifth, *Every Level of Consciousness* (Aperture, https://www.youtube.com/watch?v=IqXpzcfdtn4), is cinematic live action: 76% real captured, host 8%, 23% constructed (brain renders, text, collage). The only real research footage in the five is in Aperture (EEG cap fitting, an MRI scanner and an EEG trace at about 15:35-17:50, and an EEG cap on a participant at about 22:35); the four illustrated videos retell experiments in drawings (no original study footage, no study documents). Implication: our current illustrated Psychology approach has four same-format references; real experiment or lab footage appears in one reference only, so 'real experiments' in our system has to come from our own sourcing (papers, archive, lab footage with licence), not from imitation. Confidence: **Low-Medium**.

## 8. Cross-channel observations (not rules)

1. Four of the seven groups (Hidden Past, Court & Spotlight, Celebrity News, AI Tested counting screens) are majority real captured material; the other three (Rival Lines, Space, Psychology) are majority constructed. The constructed channels differ in kind: tactical pitch, CG science, illustration.
2. Frames labelled AI-generated appear only as the subject being tested in AI Tested (0-21% of frames) and in no other group. Caveat: the PsychToons stills have an image-model look, but provenance cannot be read from frames, so they are labelled illustration.
3. Wherever third-party footage or documents are shown, a visible credit, lower-third or source line is common (F-HP-3, F-CS-3, F-SP-1).
4. Human-subject frames (host or interviewee) reach 7% or more in 8 of the 33 videos (Saudi Arabia 11%, Russia 30%, Canada 12%, Frontline 42%, Carrey 33%, Football Made Simple's Post-Ferguson video 9% from press conferences, Astrum 7%, Aperture 8%); the other 25 are voice-over led.
5. Median shot length of cut-based videos sits at 3-6 s in every channel; what differs is the share of long holds (screens, maps, diagrams).

## 9. What this research does not show

- **Camera movement (zoom, pan, crop) on stills** was not measured; only the frame-difference score in section 6 reflects movement, and it cannot separate a pan from a cut.
- **Footage provenance and licensing** cannot be read from frames; nothing here shows the references' footage is licensed.
- **Exact durations**: all category percentages are sampled or estimated (section 1).
- Hidden Past, AI Tested and Rival Lines each rest on one reference channel.
- Court & Spotlight evidence includes two low-coverage videos; Celebrity News has two analysed videos because two planned videos were blocked by YouTube's bot check (REor4fN2K3Y, x_d9A5W2940, retried three times over 30 minutes) and could not be re-fetched.
- Dense re-labelling covered 3 windows of 180 s only (Psychology, Celebrity News, Hidden Past).

## 10. Incomplete

| Video | Channel group | Reason | Plan |
|---|---|---|---|
| REor4fN2K3Y | Celebrity News | YouTube 'sign in to confirm you're not a bot' on fetch; no saved clip | retry later; no cookies used |
| x_d9A5W2940 | Celebrity News | same | same |
