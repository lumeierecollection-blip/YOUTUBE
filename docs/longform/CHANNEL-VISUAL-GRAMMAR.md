# Channel visual grammar (Phase 3)

Seven grammars, one per channel, **derived from the reference study** (`VISUAL-EDITING-RESEARCH.md`, `CAPTION-RESEARCH.md`, `SOUND-DESIGN-RESEARCH.md`) and checked against the current samples with the QA tool (`PRODUCTION-QA-STANDARDS.md`). Each channel states: what the references do (observed/measured), the rule adopted (recommendation), confidence, what the current system did before Phase 3, and what was changed or deliberately kept. No number below is meant to be copied across channels: the bands differ because the references differ.

How to read the references' numbers: real captured = footage, photographs, archive, genuine screen recordings and documents; constructed = maps, charts, tactical diagrams, illustration, whiteboard, motion graphics, text cards, decorative or AI-generated imagery. Shares are of sampled frames (+-5 to +-12 points).

## Hidden Past (geography, history, geopolitics)

**Reference basis:** 5 videos (5 from RealLifeLore only). Real captured 56%-73%; constructed 27%-44%; longest all-constructed stretch 60-135 s; overlay text on 0%-33% of sampled frames; 7.1-11.7 shots/min, median shot 3.5-5.8 s. **Confidence: Medium.**

**Visual grammar (rule adopted):**

- A map explains, a photograph, clip or archive item proves: alternate them. No map sequence longer than about two minutes (references: 60-135 s) without real material.
- History topics bring in period prints, engravings and archival film with a visible credit; contemporary topics use news and public-appearance footage.
- Map camera moves or an overlay change at least every 10 s; no 30-second hold on one framing.
- No AI-generated imagery; no host on camera.

**Captions:** No narration captions. Place labels live in the map. A credit line on every real clip or photograph; quoted news text only in a boxed, attributed quote caption.

**Sound:** Voice first, silence kept between sentences; optional single ambience under long aerial/place shots; one impact for the one reveal; no music under narration (cue sheet `hidden-past.md`). Evidence for the ambience and impact is *not* from the references.

**Current system before Phase 3 (QA baseline):** Pass on authentic share, constructed stretches and overlay; **fail on credits** (6 pictures shown without a credit line); warn on one NASA orbital photograph reused on 4 beats. Estimated authentic share (upper bound) 60%, longest constructed stretch 25 s, 8 distinct authentic assets.

**Changed in Phase 3:** Every authentic picture now carries its recorded credit line (generic overlay from the attribution record). After: authentic share 60%, longest constructed stretch 25 s, 8 distinct authentic assets.

**Kept on purpose:** Map engine (MapLibre scenes), real Commons photographs, the dated-footage scene with its source-worded caption box. The reused NASA backdrop on 4 beats **remains** (two further licensed period photographs could not be found in this pass).

## AI Tested (software and model tests)

**Reference basis:** 5 videos (5 from AI Search only). Real captured 56%-81%; constructed 19%-44%; longest all-constructed stretch 75-135 s; overlay text on 1%-6% of sampled frames; 6.3-11.7 shots/min, median shot 3.0-4.9 s. **Confidence: Medium.**

**Visual grammar (rule adopted):**

- The picture is the software: real screen recordings, real pages, real papers, real terminals; generated outputs are shown as outputs inside the tool, never as decoration.
- A page or paper is brought in with the discussed line highlighted; long holds are accepted while the page is being read (static stretches up to about 2 minutes in the references).
- No host on camera; narration over the screen.

**Captions:** No captions over screens. Section cards between chapters; highlight boxes and cursor emphasis inside the capture instead.

**Sound:** Only sounds that belong to the shown action (typing, clicks) at natural level; no whooshes on screen cuts; a light bed is optional.

**Current system before Phase 3 (QA baseline):** The weakest authentic share of any channel (screens and documents are 57% of the references; ours rendered replies in a drawn chat/terminal UI): FAIL on authentic share; a 193 s constructed stretch. Estimated authentic share (upper bound) 6%, longest constructed stretch 193 s, 1 distinct authentic assets.

**Changed in Phase 3:** The paper the narration cites (Faith and Fate, arXiv) is now shown as a **real browser capture** with the discussed sentence highlighted (beat A09b), and its summary graphic follows as A09c; two unrelated leftover capture files were removed from the episode's media. After: authentic share 12%, longest constructed stretch 122 s, 2 distinct authentic assets.

**Kept on purpose:** Our own test data and the rendered chat and grid scenes: they show our real model replies (the evidence of the episode) and have no equivalent real capture; the repository's test runs are not publicly capturable. The channel stays below its reference band on authentic share: a limitation, not a pass.

## Court & Spotlight (legal cases, public records)

**Reference basis:** 5 videos (FRONTLINE, SunnyV2 x3, a Spanish documentary compilation; two videos at 47% and 7% coverage). Real captured 35%-99%; constructed 0%-60%; longest all-constructed stretch 0-90 s; overlay text on 9%-70% of sampled frames; 7.4-16.6 shots/min, median shot 3.0-4.5 s. **Confidence: Low-Medium.**

**Visual grammar (rule adopted):**

- No single editing model exists in the references; the transferable devices are: real documents with the quoted passage highlighted, lower-thirds for each new person, a credit line on every borrowed clip, and interview-led takes of 6-12 s.
- Constructed graphics (amounts, timelines, ledgers) are the exception, not the structure, in the references (0-15% except the transcript-card video).

**Captions:** Lower-third for each new person, highlight on the document, credit on borrowed clips; no narration subtitles.

**Sound:** Restrained: very low room tone under document scenes; gavel only where a sentence is read; at most one riser and impact before the verdict count; deliberate silence before the verdict (cue sheet `court-and-spotlight.md`).

**Current system before Phase 3 (QA baseline):** Authentic share 27% (the references run 35-99%; the band is too wide to constrain); constructed stretch up to 130 s. Estimated authentic share (upper bound) 27%, longest constructed stretch 130 s, 8 distinct authentic assets.

**Changed in Phase 3:** Cue sheet with the gavel, riser and impact placed on the beats that state the sentence and the verdict count. After: authentic share 27%, longest constructed stretch 130 s, 8 distinct authentic assets.

**Kept on purpose:** The scene set (real court-document pages, real web captures with highlight, Commons portraits, constructed amount/timeline cards). Converting the amount and timeline cards into more real document pages would need more official documents than the sample has; **not done** in this pass.

## Celebrity News (entertainment business and public statements)

**Reference basis:** 2 videos (2 analysed (Carrey commentary, Nicki Swift anchors) plus the SunnyV2 Corden video; 2 planned videos could not be fetched). Real captured 96%-100%; constructed 0%-4%; longest all-constructed stretch 0-30 s; overlay text on 14%-60% of sampled frames; 10.5-12.1 shots/min, median shot 4.0-4.2 s. **Confidence: Low.**

**Visual grammar (rule adopted):**

- Almost no constructed graphics (0-4%): archival clips, news clips, stills and real pages with the discussed row or line highlighted.
- A credit or source line on every clip; broadcaster lower-thirds are the original's own.
- Whether a host appears is a channel decision (33% in one reference, 2% in the other).

**Captions:** No narration captions; credit lines; evidence pages with the relevant passage highlighted.

**Sound:** Light: shutter on a photo cut-in, vinyl under archive music material; applause, record scratch and clock ticks were removed from the cue sheet because the beats they fired on did not match their purpose.

**Current system before Phase 3 (QA baseline):** Authentic share 65% against a 96-100% reference band; a 54 s constructed stretch; the Swift portrait on 5 beats and the Braun photo on 3; credits missing on 11 pictures. Estimated authentic share (upper bound) 65%, longest constructed stretch 54 s, 7 distinct authentic assets.

**Changed in Phase 3:** Three new licensed portraits (Braun at TechCrunch 2010 and in a 2020 interview, Swift at the 2023 MTV VMAs) replace repeats; credit lines added. After: authentic share 65%, longest constructed stretch 54 s, 10 distinct authentic assets.

**Kept on purpose:** The magazine-style cover and record cards. **Not fixed:** the explainer beats (copyright, the re-recording mechanism) have no real picture, so authentic share and the constructed stretch still fail against the (2-video, provisional) band.

## Rival Lines (football analysis)

**Reference basis:** 5 videos (5 from Football Made Simple only; one at 42% coverage). Real captured 14%-40%; constructed 60%-86%; longest all-constructed stretch 75-180 s; overlay text on 20%-36% of sampled frames; 4.7-9.8 shots/min, median shot 4.0-9.0 s. **Confidence: Medium.**

**Visual grammar (rule adopted):**

- The tactical diagram is the main picture (42-69% of frames); annotated match footage punctuates it (runs of 15-22 s every 40-75 s in the references); stat tables 3-14%.
- Captions only on footage moments (2-4 words, set in the pitch's perspective); none on the diagram.
- Every tactical run longer than about a minute should be followed by real or annotated footage where it can be licensed.

**Captions:** Footage labels in perspective; name tags on the pitch; nothing on the diagrams.

**Sound:** A rhythmic low bed under tactical sections (reference spectrogram shows one); event effects only at the moment shown; deliberate silence before a key reveal (cue sheet `rival-lines.md`).

**Current system before Phase 3 (QA baseline):** Passes the authentic-share band (16% against 14-40%); the licensed match footage the references use is not available to us (7 footage gaps recorded). Estimated authentic share (upper bound) 16%, longest constructed stretch 171 s, 3 distinct authentic assets.

**Changed in Phase 3:** Cue sheet only. After: authentic share 16%, longest constructed stretch 171 s, 3 distinct authentic assets.

**Kept on purpose:** StatsBomb event and 360 animations, the shot map and scorecards: the right primary visual by the evidence. Footage remains a recorded gap until a licence exists.

## Space (planets, missions, science)

**Reference basis:** 6 videos (6 videos from 6 channels). Real captured 2%-93%; constructed 7%-98%; longest all-constructed stretch 30-765 s; overlay text on 8%-49% of sampled frames; 1.9-10.3 shots/min, median shot 4.5-31.4 s. **Confidence: Low-Medium.**

**Visual grammar (rule adopted):**

- Real imagery versus reconstruction is an editorial choice per episode; pooled figures are not a target (real share 2-93%).
- Real images carry a one-line label and a credit line; reconstructions are recognisably illustrative or labelled as reconstruction.
- Use the best available real image for the thing named: a moon's geology is shown with the spacecraft image of that moon, not a sphere.

**Captions:** Label and credit under real images; no caption on CG reconstructions.

**Sound:** A sustained drone under image plates; launch and radio texture only on the beats that name them; silence for the scale reveal.

**Current system before Phase 3 (QA baseline):** Credits missing on 4 pictures; the Voyager 2 image repeated on 4 beats; Miranda told over a 3D sphere. Estimated authentic share (upper bound) 48%, longest constructed stretch 70 s, 6 distinct authentic assets.

**Changed in Phase 3:** Miranda's beat now shows the real Voyager 2 image (processed by Ted Stryk, NASA public domain); the timeline thumbnails use the Voyager montage and the two-colour image instead of repeating one picture; credit lines added. After: authentic share 53%, longest constructed stretch 70 s, 8 distinct authentic assets.

**Kept on purpose:** The 3D planet and seasons scenes (they show geometry that no photograph can).

## Psychology (studies and effects)

**Reference basis:** 5 videos (5 from 5 channels; 4 illustrated/whiteboard, 1 live-action). Real captured 0%-76%; constructed 23%-100%; longest all-constructed stretch 60-885 s; overlay text on 4%-21% of sampled frames; 2.1-17.6 shots/min, median shot 3.0-23.8 s. **Confidence: Low-Medium.**

**Visual grammar (rule adopted):**

- Four of five references are drawn explainers; the one live-action reference uses 1-4 word emphasis captions and real lab footage. Our illustrated cards match the majority format.
- Real experiment or lab footage appears in one reference only; our system should source real papers and records rather than imitate stock 'thinking' footage.

**Captions:** Illustrated: text drawn into the art, no overlay captions. Live-action: 1-4 word emphasis captions on key terms.

**Sound:** Quiet piano bed, pencil when something is drawn, classroom ambience for the classroom scenario only.

**Current system before Phase 3 (QA baseline):** 5% authentic share (INFO: the band 0-76% constrains nothing). Estimated authentic share (upper bound) 5%, longest constructed stretch 299 s, 1 distinct authentic assets.

**Changed in Phase 3:** Cue sheet only. After: authentic share 5%, longest constructed stretch 299 s, 1 distinct authentic assets.

**Kept on purpose:** The scenario, cycle and study cards: consistent with the drawn explainers. No real experiment footage exists for the Rosenthal study in our sources.

## Implementation map

| Research conclusion | Where it lives in the system |
|---|---|
| credit on every borrowed picture | `platform/longform/v2/credits.mjs` (records), `platform/longform/stills/specs.mjs` (adds `autoCredit` to scene props), `src/skills/remotion-render/channels/lf2/compositions.jsx` (generic overlay), QA check V6 |
| per-channel bands | `config/longform-qa-standards.json` (derived, never hand-typed) |
| plan-level visual and audio QA | `platform/longform/qa/visual-audio-qa.mjs`; reports in `docs/longform/qa-baseline` and `docs/longform/qa-after` |
| sound grammar and cue sheets | `config/longform-cue-rules.json`, `platform/longform/v2/audio/cue-sheets.mjs`, `docs/longform/cue-sheets/` |
| real media acquisition | `platform/longform/v2/commons-search.mjs` (lists candidates with licence), `platform/longform/v2/assets.mjs` (licence-enforced download), `platform/longform/v2/capture.mjs` (real browser capture) |
