# Sound design research (Phase 3)

## 0. Status, stated plainly

- **No one has listened to anything in this research.** The model that did the analysis cannot hear. Everything below is measurement (loudness, spectrum, timing), pictures of the audio (spectrograms) and licence checking. Where the directive asks for a listening review, the review is **not done**: it has been prepared for a person (`output/longform-audio-demo/audition-reel.mp3`, `audition-index.json`, and the listening record table in `SOUND-LIBRARY-REGISTER.md`).
- A waveform or spectrogram cannot tell which sound it shows. Observations are of shape (sustained low band, narrow tone, gaps near silence); they are not identifications.
- Reference audio was measured for **how** videos are mixed (level, loudness range, pauses, bed level, event timing). Nothing from the reference videos is reused.

## 1. Tools and skills: what was verified and how

| Item | Claim | Verified how | Used? |
|---|---|---|---|
| FFmpeg (Gyan full build 9.0.2 on this PC) | loudness meter, two-pass `loudnorm`, `sidechaincompress` ducking, `adelay`/`amix` placement, `alimiter`, `afade`, `showspectrumpic` | **Run in this session** (script `platform/longform/v2/audio/mix-demo.sh`, `machine_qa.py`, spectrograms); outputs measured with `ebur128` | yes |
| `claude-video-audio` skill (AgriciDaniel/claude-video, MIT, 34 stars, last push 2026-04-06) | FFmpeg audio recipes | Instruction file read; the loudnorm/sidechain recipes followed by hand and run. It is a recipe collection, not software; not installed as a skill and not invoked through the Skill tool | recipes only |
| `mix-master` skill (gooseworks-ai/goose-skills, MIT) | mixing guidance | Instruction file read; partly overlaps the above; not run | read only |
| pyloudnorm (MIT, last push 2026-01-04), librosa (ISC), pydub (MIT) | Python loudness/analysis helpers | Licence and activity from the GitHub API; **not installed or run** (ffmpeg `ebur128` used instead) | no |
| Pedalboard (spotify, GPL-3.0) | effects library | Licence from GitHub API; GPL-3.0 copyleft; not used | no |
| Audacity, Ardour | desktop editors / DAW | GitHub API shows no single SPDX licence (multi-licence); human tools, not scriptable pipeline components here | no |
| SoX | CLI audio tool | **Not installed** on this PC | no |
| Demucs | source separation | facebookresearch repo is **archived** (2024-04-24); adefossez fork MIT, pushed 2026-10-26. Not needed (we do not reuse reference audio) | no |
| Freesound | CC0 / CC BY / CC BY-NC per sound | Per-sound licensing confirmed by secondary sources; API-key rules **not verified**; items reached through Openverse only | via Openverse |
| Openverse API (anonymous) | licence + provider + source URL per audio item | Run in this session (about 60 queries); every pick re-checked at the source page by `library.mjs` | yes |
| BBC Sound Effects (RemArc) | free download | Secondary sources: personal / educational / research only; monetised YouTube needs a commercial licence (Pro Sound Effects) | **excluded** |
| Sonniss GDC bundles | royalty-free commercial, no attribution | Secondary sources only; licence is per bundle year; 2023 text read via an unofficial mirror; 2024 added a no-AI-training clause; **primary licence not read** | not downloaded |
| Pixabay audio | commercial use, no attribution | Secondary sources only; Content ID claims can still occur; **primary terms not read** | not downloaded |
| Reaper | scriptable DAW, commercial licence | not checked in this pass | no |

A repository that contains audio utilities is not treated as a mixing solution: the only automated mixing path actually run here is FFmpeg.

## 2. Reference audio, measured (35 planned, 33 measured)

Method: whole analysed span of each video (up to 2100 s): `ebur128` (integrated loudness, loudness range, true peak); 50 ms RMS windows; speech level = 80th percentile; a pause = a window at least 18 dB below the speech level; 'bed in pauses' = median level of those windows relative to speech; 'impact candidates' = 50 ms windows 12 dB louder than the previous with more than 35% of energy below about 150 Hz (a candidate is **not** an identified sound: it can be a bass note, a beat or a plosive). Limits: the span includes sponsor reads and music-only sections; true peaks above 0 dBTP are decoder-level (the references are lossy 360p-source audio).

| Channel | Video | LUFS | LRA LU | True peak dBTP | Pauses/min | Bed below speech in pauses dB | Impact candidates/min |
|---|---|---|---|---|---|---|---|
| Hidden Past | [Why The Nepal Flood Was WAY Scarier Than You Think](https://www.youtube.com/watch?v=WiRLNEl-4bk) | -17.2 | 2.3 | -0.7 | 9.8 | 33.3 | 0.9 |
| Hidden Past | [Why Everything is Going Wrong for Saudi Arabia](https://www.youtube.com/watch?v=U_UoAZrOTNU) | -17.0 | 2.2 | -0.8 | 8.8 | 24.8 | 0.0 |
| Hidden Past | [Why Russia Thinks It Can Attack Europe and WIN](https://www.youtube.com/watch?v=FA-oEtccS_k) | -16.6 | 1.8 | -0.7 | 7.6 | 27.3 | 0.6 |
| Hidden Past | [Why The US Is Suddenly Attacking Canada](https://www.youtube.com/watch?v=R60ZGwd3n9E) | -16.0 | 1.9 | -0.7 | 9.6 | 26.7 | 0.1 |
| Hidden Past | [Why the Pacific Northwest Coast is Insanely Empty](https://www.youtube.com/watch?v=3IVbe0xrRt8) | -16.7 | 1.5 | -0.9 | 6.7 | 23.5 | 0.7 |
| AI Tested | [Deepseek strikes again](https://www.youtube.com/watch?v=1Aqhg0FVm-w) | -19.6 | 4.1 | -1.6 | 2.6 | 28.0 | 2.9 |
| AI Tested | [AI is reverse engineering everything](https://www.youtube.com/watch?v=h5zkzon0gM4) | -18.5 | 3.2 | -0.2 | 1.9 | 28.6 | 5.5 |
| AI Tested | [New top local AI image generator is here!](https://www.youtube.com/watch?v=cUeZMUGCxrw) | -20.2 | 3.2 | -0.8 | 4.8 | 28.2 | 3.7 |
| AI Tested | [Quantum breakthrough, Gemini 4 Argon, MOSS Image, KLING 4, O](https://www.youtube.com/watch?v=tDWtcyeNNew) | -18.2 | 2.6 | 0.0 | 1.8 | 28.2 | 2.3 |
| AI Tested | [Cybersecurity chaos, AI for DNA, Kimi K3.1, Claude Duet, Des](https://www.youtube.com/watch?v=EfyQOAJjx1A) | -16.2 | 3.0 | 0.2 | 3.8 | 29.3 | 2.3 |
| Court & Spotlight | [How James Corden Destroyed His Reputation](https://www.youtube.com/watch?v=mxCZUz2F24E) | -17.0 | 4.9 | 0.7 | 0.1 | 19.8 | 0.7 |
| Court & Spotlight | [Ellen Just Tried To Make A Comeback... It's Not Going Well](https://www.youtube.com/watch?v=1aAGV7G5zbo) | -17.7 | 3.5 | -1.0 | 0.0 | 20.6 | 0.6 |
| Court & Spotlight | [Why Joe Rogan & Howard Stern Don't Like Each Other](https://www.youtube.com/watch?v=jZpq6BCud7s) | -13.9 | 5.1 | 0.7 | 0.0 | 19.7 | 1.2 |
| Court & Spotlight | [EL CASO DE P. DIDDY: Completo *DOCUMENTAL*](https://www.youtube.com/watch?v=-p_TBe0Re_s) | -12.3 | 3.0 | 1.7 | 0.2 | 21.4 | 2.6 |
| Court & Spotlight | [How Harvey Weinstein Tried to Silence Accusers (full documen](https://www.youtube.com/watch?v=OJ8fsE_GOlg) | -23.4 | 7.2 | -4.8 | 10.5 | 25.9 | 2.3 |
| Celebrity News | [The Awakening of Jim Carrey: Hollywood's Worst Nightmare](https://www.youtube.com/watch?v=8r3RQD8rE9E) | -17.8 | 6.1 | 0.4 | 3.6 | 23.7 | 0.4 |
| Celebrity News | [News Anchors Who Vanished After Getting Fired](https://www.youtube.com/watch?v=nOZQlDg_Ei4) | -14.1 | 2.3 | -2.6 | 1.1 | 20.3 | 0.3 |
| Rival Lines | [Flick's Barcelona Tactics Are Crazy](https://www.youtube.com/watch?v=N8PZt_9_adI) | -23.2 | 3.6 | 0.2 | 2.8 | 23.2 | 7.0 |
| Rival Lines | [How Chelsea's Tactics Beat United](https://www.youtube.com/watch?v=KC2Vgjw282s) | -23.2 | 16.8 | 0.2 | 5.8 | 23.8 | 9.0 |
| Rival Lines | [This Was Elite Tactical Problem Solving](https://www.youtube.com/watch?v=Nx8h403Sj_s) | -18.4 | 7.0 | -2.2 | 6.6 | 22.2 | 9.6 |
| Rival Lines | [How Mourinho's Tactics Won El Classico](https://www.youtube.com/watch?v=oZaPKaIVIA0) | -23.1 | 4.2 | 0.1 | 2.1 | 21.8 | 9.2 |
| Rival Lines | [The Tactics Of Every Post-Ferguson United Manager](https://www.youtube.com/watch?v=Dki5tjN0rDE) | -15.7 | 2.1 | 0.2 | 3.8 | 25.4 | 2.3 |
| Space (Red Space Facts) | [Uranus: The Weirdest Planet in the Solar System](https://www.youtube.com/watch?v=pZh5BWCNmmE) | -20.3 | 4.2 | -2.8 | 13.8 | 22.0 | 2.3 |
| Space (Red Space Facts) | [What NASA Found on Io](https://www.youtube.com/watch?v=s0mNlXGd2Bc) | -14.9 | 3.7 | 0.4 | 16.2 | 27.0 | 6.6 |
| Space (Red Space Facts) | [The Cosmic Scale](https://www.youtube.com/watch?v=4iC9Qi3y9q8) | -14.2 | 5.2 | 0.3 | 9.8 | 23.0 | 0.7 |
| Space (Red Space Facts) | [What Is Beyond The Edge?](https://www.youtube.com/watch?v=_IkaetPoBZM) | -16.8 | 5.2 | -0.8 | 16.2 | 25.6 | 2.3 |
| Space (Red Space Facts) | [The Largest Black Hole in the Universe - Size Comparison](https://www.youtube.com/watch?v=0FH9cgRhQ-k) | -15.0 | 2.5 | -2.5 | 0.5 | 20.6 | 1.4 |
| Space (Red Space Facts) | [New: Mars In 4K](https://www.youtube.com/watch?v=ZEyAs3NWH4A) | -14.5 | 16.7 | -1.2 | 7.7 | 21.8 | 0.1 |
| Psychology | [The Pygmalion Effect](https://www.youtube.com/watch?v=4aN5TbGW5JA) | -22.6 | 6.3 | -4.0 | 1.0 | 30.2 | 0.2 |
| Psychology | [Psychology of Discipline (And How to Trick Your Brain Into C](https://www.youtube.com/watch?v=CkP_8bkjf1E) | -14.4 | 6.6 | -0.3 | 23.5 | 34.2 | 5.4 |
| Psychology | [Weird Habits That Actually Reveal High Intelligence (Part 2)](https://www.youtube.com/watch?v=fTltSulVbs8) | -11.7 | 4.4 | 1.6 | 4.6 | 20.6 | 0.1 |
| Psychology | [The Asch Line Study - Conformity Experiment](https://www.youtube.com/watch?v=-W-ML_dG_4Y) | -15.7 | 2.0 | -1.0 | 13.7 | 36.0 | 0.2 |
| Psychology | [Every Level of Consciousness](https://www.youtube.com/watch?v=IqXpzcfdtn4) | -21.3 | 4.9 | -2.9 | 14.1 | 22.3 | 2.6 |

Per channel (ranges over videos):

| Channel | LUFS | LRA | Pauses/min | Bed below speech dB | Impact candidates/min |
|---|---|---|---|---|---|
| Hidden Past | -17.2--16.0 | 1.5-2.3 | 6.7-9.8 | 23.5-33.3 | 0.0-0.9 |
| AI Tested | -20.2--16.2 | 2.6-4.1 | 1.8-4.8 | 28.0-29.3 | 2.3-5.5 |
| Court & Spotlight | -23.4--12.3 | 3.0-7.2 | 0.0-10.5 | 19.7-25.9 | 0.6-2.6 |
| Celebrity News | -17.8--14.1 | 2.3-6.1 | 1.1-3.6 | 20.3-23.7 | 0.3-0.4 |
| Rival Lines | -23.2--15.7 | 2.1-16.8 | 2.1-6.6 | 21.8-25.4 | 2.3-9.6 |
| Space (Red Space Facts) | -20.3--14.2 | 2.5-16.7 | 0.5-16.2 | 20.6-27.0 | 0.1-6.6 |
| Psychology | -22.6--11.7 | 2.0-6.6 | 1.0-23.5 | 20.6-36.0 | 0.1-5.4 |

What the numbers say (confidence Medium; they describe mixes, not taste):
- Loudness of the references spans -23.4 to -11.7 LUFS. There is **no common loudness**. Our -14 LUFS target is YouTube's playback reference, not something the references cluster on (the RealLifeLore videos sit at -17 to -16; SunnyV2 at -17.7 to -13.9 (the Spanish Diddy documentary at -12.3); FRONTLINE at -23).
- Loudness range is small (1.5-2.3 LU) for RealLifeLore and larger (up to 16.8 LU) where music-only or sponsor passages exist (Football Made Simple *How Chelsea's Tactics Beat United*, Mars 4K).
- Pauses: RealLifeLore has 7-10 per minute with near-silent gaps; SunnyV2 commentary has about 0 pauses per minute (voice-over wall to wall) and the lowest bed gap (about 20 dB): a continuous bed or effect layer under the voice.
- Impact candidates: four of the five Football Made Simple tactics videos show 7-10 per minute against 0-6 in the rest of the set; consistent with a beat or low pulse under the tactical sections (see the spectrogram observation below).

## 3. Spectrogram observations (60 s windows; observation only)

| Video and window | Observed (shape) | Interpretation (labelled) | Confidence |
|---|---|---|---|
| RealLifeLore Nepal flood, 14:35-15:35 (https://www.youtube.com/watch?v=WiRLNEl-4bk) | Voice only; between sentences the spectrogram is near black (about -100 dB) at all frequencies | no bed and no ambience in this window | Medium (one window) |
| Aperture Every Level of Consciousness, 15:05-16:05 (https://www.youtube.com/watch?v=IqXpzcfdtn4) | Voice plus a continuous low band (about 20-100 Hz) that persists between phrases; broadband verticals | a sustained bed with sub-bass; transients not identified | Medium |
| FRONTLINE Weinstein, 17:00-18:00 (https://www.youtube.com/watch?v=OJ8fsE_GOlg) | Continuous low band through pauses; at about 49-52 s two short narrow tonal pulses near 1 kHz with the low band dropping out around them | a room-tone or drone under interviews; one short tonal event with the bed gated; not identified | Medium-Low |
| Football Made Simple Elite Tactical Problem Solving, 3:39-4:39 (https://www.youtube.com/watch?v=Nx8h403Sj_s) | Strong continuous low band under speech; from about 17 s to 31 s of the window the speech pattern is absent and evenly spaced vertical pulses (about 2 per second) appear while the low band continues | a rhythmic element (music beat or effect) carrying a speech-free stretch | Medium-Low |
| Astrum Uranus, 17:00-18:00 (https://www.youtube.com/watch?v=pZh5BWCNmmE) | Continuous red-orange fill 20-400 Hz through speech and pauses | a sustained pad/drone-like bed | Medium-Low |

## 4. Library: licence and machine QA (35 assets)

- 35 assets (CC0 or CC BY only) downloaded, measured and licence-checked at the source page (all 35 pages confirmed the licence URL). `docs/longform/SOUND-LIBRARY-REGISTER.md` lists each asset, licence, attribution and flags.
- Machine QA flags (measurable defects only): 11 assets at or above 0 dBTP (must be attenuated before any mix), 15 with samples at full scale (possible hard clipping or a very hot master: needs an ear check), 14 with a loop seam (needs a crossfade if looped), 5 that end without a decay, 13 with silence to trim.
- Every asset's approval status is **pending human audition** (or 'needs correction before audition' where the flags show clipping). None is approved or rejected.
- All eight music beds are CC BY 3.0 and mastered hot (-17 to -8 LUFS, six of eight at or above 0 dBTP): at the mix stage they need roughly 10-17 dB of attenuation. Alternatives per channel are still to be sourced; one bed must not serve all channels.

## 5. Mix chain test (technical, not auditioned)

Script `platform/longform/v2/audio/mix-demo.sh` (25.5 s of AI Tested pipeline-repair narration, MUSIC_TECH, keyboard/click/whoosh effects):

| Stage | Setting | Result |
|---|---|---|
| Narration | two-pass `loudnorm` to -16 LUFS, linear | stem level about -15.8 dB RMS |
| Music | -17 dB, `sidechaincompress` threshold 0.05, ratio 2.5, attack 30 ms, release 500 ms | under speech -46.4 dB, in pauses -42.0 dB: duck depth 8.3 dB; pause bed 26.2 dB below speech (reference mixes: about 20-36 dB) |
| Final | two-pass `loudnorm` I=-14, TP=-1.5, LRA=9, linear, then `alimiter` | **WAV -13.9 LUFS, LRA 2.4, true peak -1.8 dBTP; MP3 192 kbit/s -14.2 LUFS, true peak -2.0 dBTP** (the earlier single-pass attempt measured -13.4 LUFS) |

Open: whether the music is audible and pleasant under speech (31 dB below the narration at the stem level in variant A, 30 dB in variant B) cannot be judged without listening; a person needs to play `output/longform-audio-demo/mix-test-aitested.mp3`. The effects' timing (keyboard at 3.0 s, click at 9.0 s, whoosh at 14.6 s) is mechanically exact; whether they serve the story is a listening decision. Listening conditions tested: **none**.

## 6. Channel sound grammar (PROPOSALS, evidence stated for each)

Rule for all channels: **a cue exists only if it has an editorial purpose written next to it in the cue sheet.** A cue type that has no evidence from the reference set is labelled *not evidenced*: it is a hypothesis for a person to approve, not a finding.

Cue types allowed, each with its permitted purpose:

| Cue type | Permitted purpose | Never used for |
|---|---|---|
| Bed (music or drone) | continuity and mood under stretches with no scene change, or under non-narrated passages | covering every scene by default; competing with narration |
| Location ambience | places a real photograph, footage or map in a physical setting | decoration over abstract graphics |
| Action effect (typing, click, paper, shutter, kick, gavel) | matches an action that is visible on screen | any action not on screen |
| Transition effect (whoosh) | a deliberate geographic or section change | every cut |
| Impact / accent | one reveal per section at most | emphasis on ordinary facts |
| Riser | builds to a reveal, immediately followed by it | filler |
| Silence | a deliberate drop before a statement that matters | none; it is a cue too |

Levels, provisional and relative to the narration RMS: bed or music under speech **22-30 dB below** (the reference mixes that have a bed sit about 20-36 dB below speech in pauses; the demo mix is at 26 dB in pauses and 30-31 dB under speech); ambience 28-34 dB below; action effects and accents have **no reference measurement**, so a proposed starting point is 8-14 dB below the narration peak, to be set by ear. Final delivery -14 LUFS integrated, true peak at or below -1.5 dBTP, via two-pass normalisation (measured on the demo).

| Channel | Reference evidence (measured/observed) | Proposed grammar | Confidence |
|---|---|---|---|
| **Hidden Past** | RealLifeLore x5: voice-led; one spectrogram window shows near-silent gaps and no bed; LUFS -17.2 to -16.0; LRA 1.5-2.3; 7-10 pauses/min; impact candidates 0-0.9/min | Voice first. Silence between sentences is not filled. Optional single ambience layer (desert wind, shore) under long aerial or place shots only, at the ambience level; one low impact per major reveal, at most one per two minutes; whoosh only for map-to-map moves; no music under narration (music bed only for a non-narrated stretch of 10 s or more). Library: AMB_DESERT_WIND, AMB_SHORE, SFX_SHIP_HORN (arrival beat), SFX_IMPACT, SFX_WHOOSH, optional MUSIC_HISTORY_DOC | Ambience, impact: *not evidenced*. Voice-led mix: Medium-Low |
| **AI Tested** | AI Search x5: LUFS -20.2 to -16.2; LRA 2.6-4.1; 2-5 pauses/min; bed 28-29 dB below speech; impact candidates 2.3-5.5/min (not identified); no spectrogram inspected | Only sounds that belong to the shown action: key presses and clicks synchronised to the real capture, at natural level. No whooshes on screen-to-screen cuts. A light rhythmic bed at 28 dB below speech is allowed, no bed is also consistent. Library: SFX_KEYBOARD, SFX_MOUSE_CLICK, MUSIC_TECH | Low |
| **Court & Spotlight** | FRONTLINE: continuous low room-tone/drone under interviews; one gated tonal event near 1 kHz; LUFS -23.4; LRA 7.2; 10.5 pauses/min. SunnyV2: about 0 pauses/min, bed about 20 dB below speech (a continuous layer) | Restrained: very low room tone under document and testimony scenes; gavel only where a sentence is actually read; paper only when a document is revealed; at most one riser + impact before a count reveal; deliberate silence before a verdict statement; no music bed. Library: AMB_ROOM_TONE, AMB_COURTROOM, SFX_GAVEL, SFX_PAPER, SFX_RISER, SFX_IMPACT, SFX_CLOCK | Bed: Medium-Low. Events: *not evidenced* |
| **Celebrity News** | Carrey and Nicki Swift videos: LUFS -17.8 and -14.1; 1-4 pauses/min; impact candidates 0.3-0.4/min; no spectrogram inspected | Light, pacing-driven. Shutter only on photo cut-ins; applause only at an actual award beat; vinyl crackle only under archival music-career material; one 'record scratch' at most per video and only for a reversal (a statement then contradicted). Library: SFX_SHUTTER, SFX_APPLAUSE, SFX_VINYL, SFX_RECORD_SCRATCH, MUSIC_CORPORATE (low) | Low (2 videos; no sound events identified) |
| **Rival Lines** | Football Made Simple x5: LUFS -23.2 to -15.7; 2-7 pauses/min; bed 22-25 dB below speech; impact candidates 7-10/min in four of five; spectrogram shows a strong continuous low band and a speech-free stretch carrying evenly spaced pulses | A rhythmic low bed under tactical sections at 22-25 dB below speech; pitch-event effects only at the moment shown (ball kick at a shot, whistle at full time, crowd swell at a goal); deliberate 1-2 s silence before a key reveal; stadium ambience low under footage-like data sequences. Library: MUSIC_TECH, AMB_STADIUM, SFX_BALL_KICK, SFX_WHISTLE, SFX_CROWD_GOAL | Bed: Medium-Low. Events: *not evidenced* |
| **Space** | Six channels: LUFS -20.3 to -14.2; LRA 2.5-16.7; Astrum spectrogram shows a continuous drone/pad fill; pauses 0.5-16/min; bed 21-27 dB below speech | Drone or pad bed at 22-27 dB below speech under image plates; mission audio texture (radio static, mission control) only on mission beats and only if its source is an archive item with a clear licence; rocket sound only at a launch; no sci-fi whooshes on image changes; silence for 'vacuum' or scale reveals. Library: AMB_SPACE_DRONE, MUSIC_SPACE_1, AMB_RADIO_STATIC, AMB_MISSION_CONTROL, SFX_ROCKET | Bed: Medium-Low. Events: *not evidenced* |
| **Psychology** | Five channels: LUFS -22.6 to -11.7 (one video at +1.6 dBTP); Aperture spectrogram shows a continuous low band under speech; PsychToons bed 34 dB below speech (almost none) | Quiet piano or soft bed at 24-30 dB below speech; pencil only when something is drawn on screen; clock tick only for a time-pressure beat; classroom ambience only for a classroom scene; no transition effects beyond a soft one at section change; narration kept clean. Library: MUSIC_PIANO_1, SFX_PENCIL, SFX_CLOCK, AMB_CLASSROOM, AMB_ROOM_TONE | Low-Medium |

## 7. Cue sheets

A cue sheet per episode lists, for every cue: **timecode, scene, cue type, asset, purpose, duration, level (dB relative to narration), source and licence, approval status** (proposed -> audition pending -> approved / rejected). The seven approval cue sheets are generated from the sample-episode scene lists (`platform/longform/v2/audio/cue-sheets.mjs`, output in `docs/longform/cue-sheets/`); every cue status is 'audition pending' until a person records a listening decision in `SOUND-LIBRARY-REGISTER.md`. They are previews of a plan, not mixes.

## 8. What needs a person

1. Listen to all 35 assets (reel provided) and fill in the listening record.
2. Listen to `mix-test-aitested.mp3` on headphones and on speakers and record: voice naturalness, music level under speech, ducking behaviour, effect timing, any abrupt level change, distortion; write the listening conditions down.
3. Approve, change or reject each channel's proposed grammar above (they are hypotheses).
4. Decide whether the missing licence checks (Sonniss, Pixabay primary terms; Freesound API key) are worth completing; until then those sources are unused.
