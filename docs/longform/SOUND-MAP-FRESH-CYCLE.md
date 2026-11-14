# Sound map, fresh cycle (14 Nov 2026): what each visual gets, and why

Owner brief: documentary-style background music under every video, and a written rule for which sound effect goes with which visual. Nobody has heard these mixes (the model cannot hear). Levels come from the measured references (`SOUND-DESIGN-RESEARCH.md` section 6); the sound choices are proposals for the owner to accept or change after listening.

## Music (one licensed track per video, set in `EPISODE.sound`)
| Episode | Track (slot) | Why | Level under the voice |
|---|---|---|---|
| AI Tested, Nvidia chip trail | MUSIC_MYSTERY, "The Mystery Of Haunted Avenue", Daniel Bautista, CC BY 3.0 | library note: investigative-explainer bed | 20 dB below the narration loudness, then ducked a further several dB while the voice speaks |
| AI Tested, Megaspeed numbers | MUSIC_HISTORY_DOC, "Documentary Background", Soundrider/Dope, CC BY 3.0 | sober, very steady (loudness range 0.9 LU), suits a numbers piece | same |
| Rival Lines, Leicester | MUSIC_HISTORY_DOC | calm, steady documentary bed under tactical and result scenes | same |
- Looped with 4-second crossfades to the video length; faded in over 3 s and out over 6 s.
- Sidechain-ducked by the narration (threshold 0.02, ratio 6, attack 20 ms, release 450 ms).
- Before a verdict card the music dips to about 12 % for 1.6 s (the pause before the result is stated), then returns.
- CC BY 3.0 requires credit: `credits.txt` is written next to each video and the attribution line must go in the YouTube description. The earlier owner verdict that a piano bed "sounded like random noise" is why no piano track is used.
- Measured, not heard: both tracks are steady and at -8 to -11 LUFS before being set down to the bed level.

## Sound effects by visual (config/longform-cue-rules.json, `rules`)
| Visual (scene type) | Effect | When | Why | Limit |
|---|---|---|---|---|
| Browser capture of a real page (ai-tested) | SFX_PAPER | 2.3 s in, when the highlight box draws | a document is revealed and marked | at most once per 40 s |
| Verdict card (ai-tested) | music dip, then SFX_IMPACT | dip 0-1.6 s, impact at 1.7 s | silence before the result, one low impact when it lands | impact once per video |
| Flow cards and timelines (ai-tested) | none | | steps appear on their own; sound would decorate | |
| Big number on black (rival-lines) | SFX_IMPACT | 1.4 s in, as the count lands | a counted figure arriving | at most once per 30 s |
| First scoreline card (rival-lines) | SFX_WHISTLE | 0.4 s in | the result of a match is shown (full time) | first card only |
| Title-deciding scoreline (rival-lines) | SFX_CROWD_GOAL | on the spoken word "champions" | the title is won | once per video |
| Photograph, formation diagram, bars, other scorecards | none | | no visible action; the music carries them | |
| Start of each new part of the story | SFX_WHOOSH | 0.1 s before the part starts, soft | marks a section change, not every cut | at most one per 45 s |
Rule kept from the research: a cue exists only where it has a stated purpose, and an effect is never placed on an action that is not on screen.

## Known limits
- Not auditioned by a person. Levels are starting values; the owner's listening is the test.
- Effect levels have no reference measurement (the references' effects could not be separated from music), so they are set relative to the narration by `levels_db_rel_speech`.
- Voice is edge-tts locally; the GitHub render uses Gemini voices when a key is present, so the voice on the GitHub videos will differ from the local test clip.
