# Production QA standards (Phase 3)

The QA tool `platform/longform/qa/visual-audio-qa.mjs` checks an episode's plan (beats, media manifest, cue sheet) against per-channel reference bands and hard rules. Run: `node platform/longform/qa/visual-audio-qa.mjs [channel|all] [--out docs/longform/qa]`. Every flag states what was measured, the standard, why it matters and the evidence; every standard says whether it is provisional.

**What it is not:** it does not look at rendered pixels or listen to audio. Visual checks run on the *plan* (scene types, assets, narration length); audio checks run on the cue sheet and, when a mix measurement exists, on loudness. A PASS means the plan does not trip a rule, not that the result looks good.

## 1. Checks

| ID | Check | Measured how | Standard | Level logic | Provisional? |
|---|---|---|---|---|---|
| V1 | AI-generated imagery | share of estimated time showing an asset whose manifest kind says generated | 0 outside AI Tested (none of the 28 non-AI-Tested reference videos shows any); AI Tested only as the subject being tested | FAIL if any outside AI Tested | no (hard rule) |
| V2 | Authentic media share | share of estimated time on beats showing at least one authentic asset (**upper bound**) | channel band of real captured share, minus 12 points tolerance for sampling error | FAIL below band minus tolerance, WARN below band; INFO when the band is wider than 60 points | yes |
| V3 | All-constructed stretch | longest run of beats without any authentic asset, in seconds | longest constructed run in the channel's references; FAIL above 1.5x | WARN / FAIL; INFO for wide bands | yes |
| V4 | Caption / text overlay share | share of time on beats with an editorial caption or kicker (labels, badges, credits are not counted) | channel band of sampled overlay share + 12 points | WARN above | yes |
| V5 | Repeated media | an asset used on more than two beats | no asset on more than 2 beats (author's rule) | WARN | yes (no reference measurement) |
| V6 | Credit on every third-party picture | authentic photographs shown without a credit line (own credit or recorded credit line drawn by the generic overlay) | 100% | FAIL | no (hard rule) |
| V7 | Licence recorded | assets without licence, source URL or commercial-use permission | all recorded | FAIL | no (hard rule) |
| V11 | Permissions cleared | used assets whose manifest `usable` is not 'yes' (third-party page screenshots are 'owner decision') | all cleared by licence | WARN | no |
| V8 | Long unchanging visual | longest single beat in seconds | above max(60 s, the channel's longest static stretch) | WARN | yes |
| V9 | Scene-change rate | beats per minute vs reference shots per minute | indication only (a beat can contain several changes) | INFO / WARN below half the reference minimum | yes |
| V10 | Visual matches narration | real pictures sharing no content word with their narration | a person confirms | CHECK-BY-PERSON (a word match is not proof) | n/a |
| A1 | Cue purpose | cues without a written purpose | every cue has one | FAIL | no (hard rule) |
| A2 | Effect density | action, transition, accent and riser cues per minute | provisional cap 4/min (no reference count exists) | WARN | yes |
| A3 | Bed competes with narration | bed or ambience cues louder than 20 dB below speech | 20 dB (lowest reference value 19.7 dB) | FAIL | yes |
| A4 | Assets approved | assets in the cue sheet without a recorded listening approval | all approved | WARN (no asset has been auditioned) | no |
| A5 | Assets exist | cue assets missing from the library | none missing | FAIL | no |
| A6 | Repeated music | one music bed on more than one channel | none shared | WARN | no (directive) |
| A7 | Final loudness / true peak | measured export of the channel's mix, if one exists | -14 LUFS +-1, true peak <= -1.0 dBTP | FAIL / SKIPPED when no mix has been rendered | no |

Not implemented (honest list): unnecessary captions on individual scenes (only the share is checked); excessive transitions (the episodes have three transitions each, below any reference rate); stock-footage repetition (no stock is used); poor-audio detection on rendered files (no mixes are rendered in this phase); visual-narration relevance beyond a word match.

## 2. Per-channel standards (reference bands, all provisional)

Bands are the minimum-maximum over the channel's analysed reference videos (sampled-frame shares; shot rhythm from the dissolve-aware detector; audio over the analysed span). Sampling tolerance 12 points is added before a share is flagged. Source file: `config/longform-qa-standards.json`.

| Channel | Videos | Real captured | Longest constructed run s | Overlay text | Shots/min | Longest static s | Reference LUFS | Why provisional |
|---|---|---|---|---|---|---|---|---|
| Hidden Past | 5 | 56-73% | 60-135 | 0-33% | 7.1-11.7 | 31-57 | -17.2--16.0 | all references from a single channel |
| AI Tested | 5 | 56-81% | 75-135 | 1-6% | 6.3-11.7 | 20-137 | -20.2--16.2 | all references from a single channel |
| Court & Spotlight | 5 | 35-99% | 0-90 | 9-70% | 7.4-16.6 | 4-26 | -23.4--12.3 | includes videos with <60% coverage |
| Celebrity News | 2 | 96-100% | 0-30 | 14-60% | 10.5-12.1 | 8-28 | -17.8--14.1 | only 2 videos analysed of 4 planned |
| Rival Lines | 5 | 14-40% | 75-180 | 20-36% | 4.7-9.8 | 8-18 | -23.2--15.7 | all references from a single channel; includes videos with <60% coverage |
| Space (Red Space Facts) | 6 | 2-93% | 30-765 | 8-49% | 1.9-10.3 | 8-103 | -20.3--14.2 | small sample (<=6 videos); bands are observed ranges, not tolerances |
| Psychology | 5 | 0-76% | 60-885 | 4-21% | 2.1-17.6 | 7-31 | -22.6--11.7 | small sample (<=6 videos); bands are observed ranges, not tolerances |

Bands wider than 60 points (Court & Spotlight, Space, Psychology real-share bands) cannot constrain anything and are advisory only (INFO).

## 3. Results on the seven sample episodes: before and after the Phase 3 changes

Before = the committed Phase 2 episodes (tag `longform-v2-phase2-checkpoint` content, QA run from the research checkpoint with credits counted only when written in the scene). After = this branch. Both runs use the same QA tool.

| Channel | Check | Before | After |
|---|---|---|---|
| Hidden Past | V5 Repeated media | WARN: lf2/hidden-past/bitter-lake-space.jpg x4 | WARN: lf2/hidden-past/bitter-lake-space.jpg x4 |
| Hidden Past | V6 Credit on every third-party picture | FAIL: 6 shown without a credit line (no scene credit and none recorded in ATTRIBUTIONS.json): H04:bitter-lake-space. | PASS: every authentic picture has a credit field in its scene |
| Hidden Past | V10 Visual matches narration (lexical screen only) | CHECK-BY-PERSON: 3 real pictures share no content word with their narration: H09:bitter-lake-space.jpg, H13:suezship-1973.jpg,  | CHECK-BY-PERSON: 3 real pictures share no content word with their narration: H09:bitter-lake-space.jpg, H13:suezship-1973.jpg,  |
| Hidden Past | A4 Assets approved for use | WARN: 5 asset(s) not yet approved by listening: AMB_SHORE (pending human audition), SFX_IMPACT (needs correction bef | WARN: 5 asset(s) not yet approved by listening: AMB_SHORE (pending human audition), SFX_IMPACT (needs correction bef |
| AI Tested | V2 Authentic media share | FAIL: 6% of estimated time shows at least one authentic asset (upper bound) | FAIL: 12% of estimated time shows at least one authentic asset (upper bound) |
| AI Tested | V3 All-constructed stretch | WARN: 193 s (ending at beat A14) | PASS: 122 s (ending at beat A14) |
| AI Tested | V11 Media permissions verified | WARN: 1 used asset(s) not cleared by licence (owner decision needed): gemini-models-2.jpg | WARN: 2 used asset(s) not cleared by licence (owner decision needed): faith-and-fate-arxiv-0.jpg, gemini-models-2.jp |
| AI Tested | A4 Assets approved for use | WARN: 2 asset(s) not yet approved by listening: SFX_MOUSE_CLICK (needs correction before audition), SFX_KEYBOARD (pe | WARN: 2 asset(s) not yet approved by listening: SFX_MOUSE_CLICK (needs correction before audition), SFX_KEYBOARD (pe |
| Court & Spotlight | V10 Visual matches narration (lexical screen only) | CHECK-BY-PERSON: 5 real pictures share no content word with their narration: C01:becker-2018.jpg, C01:gov-convicted-0.jpg, C01: | CHECK-BY-PERSON: 5 real pictures share no content word with their narration: C01:becker-2018.jpg, C01:gov-convicted-0.jpg, C01: |
| Court & Spotlight | A4 Assets approved for use | WARN: 5 asset(s) not yet approved by listening: AMB_ROOM_TONE (pending human audition), SFX_PAPER (pending human aud | WARN: 5 asset(s) not yet approved by listening: AMB_ROOM_TONE (pending human audition), SFX_PAPER (pending human aud |
| Celebrity News | V2 Authentic media share | FAIL: 65% of estimated time shows at least one authentic asset (upper bound) | FAIL: 65% of estimated time shows at least one authentic asset (upper bound) |
| Celebrity News | V3 All-constructed stretch | FAIL: 54 s (ending at beat N09) | FAIL: 54 s (ending at beat N09) |
| Celebrity News | V5 Repeated media | WARN: lf2/celebrity-news/swift-2019-portrait.jpg x5, lf2/celebrity-news/braun-2022.jpg x3 | WARN: lf2/celebrity-news/swift-2019-portrait.jpg x3 |
| Celebrity News | V6 Credit on every third-party picture | FAIL: 11 shown without a credit line (no scene credit and none recorded in ATTRIBUTIONS.json): N02:swift-2019-portra | PASS: every authentic picture has a credit field in its scene |
| Celebrity News | V9 Scene-change rate | WARN: 2.4 beats/min (a beat can contain several internal changes) | WARN: 2.4 beats/min (a beat can contain several internal changes) |
| Celebrity News | V10 Visual matches narration (lexical screen only) | CHECK-BY-PERSON: 4 real pictures share no content word with their narration: N06:braun-2022.jpg, N07:braun-2022.jpg, N10:braun- | CHECK-BY-PERSON: 2 real pictures share no content word with their narration: N06:braun-2022.jpg, N15:swift-eras-bcplace-2024.jp |
| Celebrity News | A4 Assets approved for use | WARN: 2 asset(s) not yet approved by listening: SFX_SHUTTER (pending human audition), SFX_VINYL (pending human audit | WARN: 2 asset(s) not yet approved by listening: SFX_SHUTTER (pending human audition), SFX_VINYL (pending human audit |
| Rival Lines | V10 Visual matches narration (lexical screen only) | CHECK-BY-PERSON: 1 real pictures share no content word with their narration: R16:spain-moncloa-2024-3.jpg | CHECK-BY-PERSON: 1 real pictures share no content word with their narration: R16:spain-moncloa-2024-3.jpg |
| Rival Lines | A4 Assets approved for use | WARN: 4 asset(s) not yet approved by listening: SFX_WHISTLE (pending human audition), MUSIC_TECH (pending human audi | WARN: 4 asset(s) not yet approved by listening: SFX_WHISTLE (pending human audition), MUSIC_TECH (pending human audi |
| Space (Red Space Facts) | V5 Repeated media | WARN: lf2/red-space-facts/uranus-voyager2-1986.jpg x4 | PASS: 8 distinct authentic assets across 22 beats |
| Space (Red Space Facts) | V6 Credit on every third-party picture | FAIL: 4 shown without a credit line (no scene credit and none recorded in ATTRIBUTIONS.json): S05:uranus-voyager2-19 | PASS: every authentic picture has a credit field in its scene |
| Space (Red Space Facts) | A4 Assets approved for use | WARN: 3 asset(s) not yet approved by listening: AMB_SPACE_DRONE (pending human audition), AMB_RADIO_STATIC (needs co | WARN: 3 asset(s) not yet approved by listening: AMB_SPACE_DRONE (pending human audition), AMB_RADIO_STATIC (needs co |
| Psychology | A4 Assets approved for use | WARN: 3 asset(s) not yet approved by listening: AMB_CLASSROOM (pending human audition), SFX_PENCIL (pending human au | WARN: 3 asset(s) not yet approved by listening: AMB_CLASSROOM (pending human audition), SFX_PENCIL (pending human au |

Metrics before / after:

| Channel | Estimated narration min (target) | Authentic share (upper bound) | Longest constructed stretch s | Distinct authentic assets | Beats |
|---|---|---|---|---|---|
| Hidden Past | 5.5 (10) | 60% / 60% | 25 / 25 | 8 / 8 | 22 / 22 |
| AI Tested | 4.9 (9) | 6% / 12% | 193 / 122 | 1 / 2 | 17 / 18 |
| Court & Spotlight | 5.9 (9) | 27% / 27% | 130 / 130 | 8 / 8 | 22 / 22 |
| Celebrity News | 7.1 (9) | 65% / 65% | 54 / 54 | 7 / 10 | 17 / 17 |
| Rival Lines | 5.5 (10) | 16% / 16% | 171 / 171 | 3 / 3 | 23 / 23 |
| Space (Red Space Facts) | 7.9 (10) | 48% / 53% | 70 / 70 | 6 / 8 | 22 / 22 |
| Psychology | 6.9 (9) | 5% / 5% | 299 / 299 | 1 / 1 | 18 / 18 |

Reading these results:
- The sample episodes' narration (4.9-7.9 estimated minutes) is shorter than the 9-10 minute targets: the sample beats cover part of the episode, which also limits what the checks can say about whole-episode rhythm.
- Remaining FAIL/WARN items are listed above and in `docs/longform/qa-after/*.md`; they were not hidden by loosening a threshold. Items that need a person (V10 matches, A4 audition) stay open by design.
