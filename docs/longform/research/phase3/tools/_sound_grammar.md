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
