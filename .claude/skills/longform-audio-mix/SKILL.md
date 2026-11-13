---
name: longform-audio-mix
description: Build, measure and QA the long-form audio plan (narration, bed, effects, two-pass loudness) with FFmpeg and the repo's tested scripts. Use when making or checking a long-form mix, a cue sheet, or the sound library. It never claims a sound was listened to.
---

# Long-form audio mix (tested recipe)

Written from `docs/longform/SOUND-DESIGN-RESEARCH.md`. Every command below was run on this repo in Phase 3; none of them replaces listening.

1. **Library**: `node platform/longform/v2/audio/library.mjs` downloads and measures every asset in `config/longform-audio-library.json` and re-checks its licence at the source page. Only CC0 / CC BY / public domain; CC BY needs attribution. Then `python platform/longform/v2/audio/machine_qa.py` (clipping, hot true peak, tail cuts, loop seams, silence) and `node platform/longform/v2/audio/register.mjs`.
2. **Cue sheet**: edit `config/longform-cue-rules.json` (every rule must carry a purpose), then `node platform/longform/v2/audio/cue-sheets.mjs`. A rule is kept only if the beat it fires on really is what its purpose says.
3. **Mix chain** (`bash platform/longform/v2/audio/mix-demo.sh`): narration two-pass `loudnorm` to -16 LUFS; music attenuated first (the beds are mastered at about 0 dBTP) and ducked with `sidechaincompress` keyed from the voice; effects placed with `adelay`; **two-pass** `loudnorm` I=-14 TP=-1.5 LRA=9 `linear=true`, then `alimiter`; measure the exported file with `ebur128=peak=true`. A single-pass final stage landed 0.6 LU off target.
4. **QA**: `node platform/longform/qa/visual-audio-qa.mjs <channel>`; A1-A7 are the audio checks (purpose written, effect density, bed at least 20 dB under speech, assets approved, assets exist, no music bed shared between channels, final loudness).
5. **Listening review is a human step**: play `output/longform-audio-demo/audition-reel.mp3` (built by `audition_reel.py`), fill the listening record in `docs/longform/SOUND-LIBRARY-REGISTER.md`, record headphones/speakers used. Until then every asset is "pending human audition" and A4 stays WARN.

Limits: Sonniss, Pixabay and Freesound were not cleared from primary licence text; BBC Sound Effects (RemArc) is excluded (not for monetised use).
